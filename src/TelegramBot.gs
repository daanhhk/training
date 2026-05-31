/**
 * TelegramBot.gs — Telegram bot integration.
 *
 * doPost ontvangt webhook van Telegram, router dispatcht naar command
 * handlers. Sendmessage via Telegram Bot API. Secret-token validatie
 * tegen replay/spoofing.
 *
 * Secret-token quirk: Apps Script web apps geven custom HTTP-headers
 * (X-Telegram-Bot-Api-Secret-Token) NIET door aan doPost. We passen
 * de secret daarom als URL query-parameter (?s=...). De webhook wordt
 * geregistreerd met die URL en Telegram POST't naar exact die URL,
 * waardoor e.parameter.s gevuld is voor validatie. Functioneel veilig
 * zolang de URL niet lekt.
 *
 * Autorisatie: alleen berichten van getTelegramChatId_() worden
 * inhoudelijk verwerkt. Andere chat IDs krijgen een korte "niet
 * geautoriseerd" en de update wordt verder genegeerd.
 *
 * doPost moet ALTIJD HTTP 200 returnen — anders gaat Telegram in
 * exponential retry-loop. try/catch wrapt alles.
 */

var TELEGRAM_API_BASE = 'https://api.telegram.org/bot';

// ── Audit + dedupe ───────────────────────────────────────────────

var AUDIT_SHEET = 'Audit';
var AUDIT_HEADERS = ['timestamp', 'update_id', 'chat_id', 'text', 'branch', 'response_ok', 'duration_ms'];
var AUDIT_MAX_ROWS = 200;

/** DocProperty key + cap voor update_id-dedupe (FIFO ring buffer). */
var SEEN_UPDATE_IDS_KEY = 'TELEGRAM_SEEN_UPDATE_IDS';
var SEEN_UPDATE_IDS_MAX = 50;

/**
 * Lazy-create de Audit-tab met headers + freeze + kolombreedtes.
 * Idempotent — bestaande tab wordt niet gemodificeerd.
 */
function _ensureAuditSheet_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(AUDIT_SHEET);
  if (sh) return sh;
  sh = ss.insertSheet(AUDIT_SHEET);
  sh.getRange(1, 1, 1, AUDIT_HEADERS.length).setValues([AUDIT_HEADERS])
    .setFontWeight('bold').setBackground('#e5e7eb')
    .setHorizontalAlignment('center');
  sh.setFrozenRows(1);
  sh.setColumnWidth(1, 150); // timestamp
  sh.setColumnWidth(2, 120); // update_id
  sh.setColumnWidth(3, 120); // chat_id
  sh.setColumnWidth(4, 260); // text
  sh.setColumnWidth(5, 100); // branch
  sh.setColumnWidth(6, 100); // response_ok
  sh.setColumnWidth(7, 110); // duration_ms
  return sh;
}

/**
 * Schrijf één rij naar de Audit-tab. Nieuwste rij komt bovenaan (rij 2)
 * zodat je op mobiel zonder te scrollen de laatste activiteit ziet.
 * Cap op AUDIT_MAX_ROWS data-rijen — oudste rij eronder wordt verwijderd.
 *
 * Failures worden opgevangen + console-gewaarschuwd zodat een audit-bug
 * nooit een doPost laat crashen.
 */
function auditLog_(entry) {
  try {
    var sh = _ensureAuditSheet_();
    sh.insertRowBefore(2);
    sh.getRange(2, 1, 1, AUDIT_HEADERS.length).setValues([[
      entry.timestamp || new Date(),
      entry.update_id == null ? '' : entry.update_id,
      entry.chat_id   == null ? '' : entry.chat_id,
      String(entry.text || '').substring(0, 200),
      entry.branch || '',
      entry.response_ok === undefined ? '' : !!entry.response_ok,
      entry.duration_ms == null ? '' : Number(entry.duration_ms)
    ]]);
    sh.getRange(2, 1).setNumberFormat('yyyy-MM-dd HH:mm:ss');
    var dataRows = sh.getLastRow() - 1;
    if (dataRows > AUDIT_MAX_ROWS) {
      var excess = dataRows - AUDIT_MAX_ROWS;
      sh.deleteRows(2 + AUDIT_MAX_ROWS, excess);
    }
  } catch (e) {
    console.warn('auditLog_ failed: ' + (e && e.message ? e.message : e));
  }
}

/**
 * Check + register update_id tegen de FIFO ring buffer. Bij eerste
 * voorkomen: return false en voeg toe (oudste eruit als > MAX).
 * Bij hervoorkomen: return true zonder side-effects.
 *
 * Lege/missende updateId wordt nooit als duplicate gemarkeerd.
 */
function isDuplicateUpdate_(updateId) {
  if (updateId == null || updateId === '') return false;
  var props = PropertiesService.getDocumentProperties();
  var raw = props.getProperty(SEEN_UPDATE_IDS_KEY) || '[]';
  var arr;
  try { arr = JSON.parse(raw); if (!Array.isArray(arr)) arr = []; }
  catch (e) { arr = []; }
  var idStr = String(updateId);
  for (var i = 0; i < arr.length; i++) {
    if (String(arr[i]) === idStr) return true;
  }
  arr.push(idStr);
  while (arr.length > SEEN_UPDATE_IDS_MAX) arr.shift();
  props.setProperty(SEEN_UPDATE_IDS_KEY, JSON.stringify(arr));
  return false;
}

/**
 * doPost — Telegram webhook entry point.
 *
 * Verwacht POST naar deploy-URL met query-param ?s=<webhook-secret>.
 * Body is een Telegram Update-object (JSON).
 */
function doPost(e) {
  var startMs = Date.now();
  var audit = {
    timestamp: new Date(),
    update_id: '',
    chat_id: '',
    text: '',
    branch: '',
    response_ok: undefined,
    duration_ms: 0
  };

  try {
    // 1. Secret-token validatie via query-param. GEEN audit — anonymous probes
    // zouden anders de tab vervuilen.
    var expectedSecret = getWebhookSecret_();
    var receivedSecret = e && e.parameter && e.parameter.s ? String(e.parameter.s) : '';
    if (!receivedSecret || receivedSecret !== expectedSecret) {
      console.warn('doPost: secret mismatch — request afgewezen.');
      return _tgOk_();
    }

    // 2. Parse update body.
    var update;
    try {
      update = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      console.warn('doPost: ongeldige JSON body: ' + parseErr.message);
      return _tgOk_();
    }
    audit.update_id = update && update.update_id != null ? update.update_id : '';

    // 3. v1 negeert non-message updates (callback_query, edited_message, etc.).
    var msg = update && update.message;
    if (!msg) return _tgOk_();

    var chatId = msg.chat && msg.chat.id;
    var text   = msg.text ? String(msg.text) : '';
    if (!chatId) return _tgOk_();
    audit.chat_id = chatId;
    audit.text = text;

    // 4. Dedupe — Telegram kan dezelfde update_id opnieuw leveren bij
    // timeouts/retries. Vroeg eruit zodat we geen dubbele sends doen.
    if (isDuplicateUpdate_(audit.update_id)) {
      console.log('doPost: duplicate update_id=' + audit.update_id + ', skipping');
      audit.branch = 'duplicate';
      audit.response_ok = true;
      audit.duration_ms = Date.now() - startMs;
      auditLog_(audit);
      return _tgOk_();
    }

    // 5. Autorisatie — alleen Daan's eigen chat mag interageren.
    var authorizedChatId;
    try {
      authorizedChatId = getTelegramChatId_();
    } catch (authErr) {
      console.warn('doPost: TELEGRAM_CHAT_ID niet ingesteld — ' + authErr.message);
      return _tgOk_();
    }
    if (String(chatId) !== String(authorizedChatId)) {
      console.warn('doPost: onbevoegde chat_id=' + chatId);
      var authOk = false;
      try { tgSendMessage(chatId, 'Niet geautoriseerd.'); authOk = true; } catch (sendErr) { /* swallow */ }
      audit.branch = 'auth_failed';
      audit.response_ok = authOk;
      audit.duration_ms = Date.now() - startMs;
      auditLog_(audit);
      return _tgOk_();
    }

    // 6. Negeer non-text berichten in v1. Geen audit — te ruisig.
    if (!text) {
      console.log('doPost: non-text message genegeerd (chat ' + chatId + ').');
      return _tgOk_();
    }

    // 7. Dispatch — branch label uit routeCommand_ vullen we in audit in.
    console.log('doPost: chat=' + chatId + ' text="' + text.substring(0, 80) + '"');
    var routeOk = true;
    try {
      audit.branch = routeCommand_(text, chatId) || 'default';
    } catch (routeErr) {
      console.error('routeCommand_ throw: ' + (routeErr && routeErr.stack ? routeErr.stack : routeErr));
      audit.branch = audit.branch || 'crash';
      routeOk = false;
    }
    audit.response_ok = routeOk;
    audit.duration_ms = Date.now() - startMs;
    auditLog_(audit);
    return _tgOk_();

  } catch (err) {
    // Vangnet — Telegram blijft anders retryen.
    console.error('doPost crashed: ' + (err && err.stack ? err.stack : err));
    try {
      audit.branch = audit.branch || 'crash';
      audit.response_ok = false;
      audit.duration_ms = Date.now() - startMs;
      auditLog_(audit);
    } catch (auditErr) { /* swallow */ }
    return _tgOk_();
  }
}

/** Standaard 200 OK response (lege body). */
function _tgOk_() {
  return ContentService.createTextOutput('').setMimeType(ContentService.MimeType.TEXT);
}

// ── Command router ───────────────────────────────────────────────

/**
 * Splitst text op spatie, eerste token is de command (eventueel met
 * @botname suffix die we strippen). Onbekend → /help-hint.
 */
function routeCommand_(text, chatId) {
  Logger.log('routeCommand_ ontving: ' + JSON.stringify(text));

  // Robuust splitsen: alle whitespace (spaties, tabs, newlines) als separator.
  var tokens = String(text || '').trim().split(/\s+/);
  var head = tokens[0] || '';
  if (!head) {
    Logger.log('routeCommand_ leeg, niets te doen');
    return 'empty';
  }
  // Strip @botname suffix (Telegram appendt die in group chats — defensief
  // ook voor private chats waar het niet zou moeten gebeuren).
  head = head.split('@')[0];
  var cmd = head.toLowerCase();
  Logger.log('routeCommand_ matched cmd: ' + JSON.stringify(cmd));

  // Explicit if/else-if met early-return per branch. Return-waarde =
  // branch-label dat door doPost in de Audit-tab wordt gelogd.
  if (cmd === '/start') {
    Logger.log('routeCommand_ -> handleStart_');
    handleStart_(chatId);
    return 'start';
  }
  if (cmd === '/status') {
    Logger.log('routeCommand_ -> handleStatus_');
    handleStatus_(chatId);
    return 'status';
  }
  if (cmd === '/help') {
    Logger.log('routeCommand_ -> handleHelp_');
    handleHelp_(chatId);
    return 'help';
  }
  Logger.log('routeCommand_ -> default (onbekend cmd=' + JSON.stringify(cmd) + ')');
  tgSendMessage(chatId, 'Onbekend commando. Stuur /help.');
  return 'default';
}

function handleStart_(chatId) {
  Logger.log('handleStart_ aangeroepen voor chatId: ' + chatId);
  var txt =
    '👋 Welkom bij je FTP Trainings Coach.\n\n' +
    'Deze bot stuurt je later in de week voorstellen en vraagt feedback ' +
    'na je ritten.\n\n' +
    'Probeer /help voor beschikbare commands.';
  var resp = tgSendMessage(chatId, txt);
  Logger.log('handleStart_ tgSendMessage response: ' + JSON.stringify(resp));
}

function handleHelp_(chatId) {
  Logger.log('handleHelp_ aangeroepen voor chatId: ' + chatId);
  // Plain text — gewone hyphens, geen em-dashes, geen markdown/HTML markers.
  var txt =
    'Beschikbare commands:\n' +
    '/start - welkomstbericht\n' +
    '/status - week samenvatting\n' +
    '/help - deze lijst\n\n' +
    'Meer commands volgen later (voorstel, sync, RPE).';
  var resp = tgSendMessage(chatId, txt);
  Logger.log('handleHelp_ tgSendMessage response: ' + JSON.stringify(resp));
}

/**
 * Beknopte mobile-friendly weekstatus. Hergebruikt de helpers die ook
 * generateProposal en renderProposal voeden: getMesoWeek, bepaalFaseVoorDatum_,
 * getVolumeTargets, computeWeekVolumeMin_, getWellnessSignal, computeZoneDebt_.
 *
 * Layout: vier secties (periode, week, wellness, debt) gescheiden door
 * lege regels. Debt-sectie wordt overgeslagen als alle drie de buckets
 * binnen ±5 min van plan zijn. Totale lengte gemikt onder ~15 regels.
 *
 * Failure-modus: bij elke onverwachte fout een korte foutmelding sturen —
 * geen status is beter dan een halve verwarrende status.
 */
function handleStatus_(chatId) {
  Logger.log('handleStatus_ aangeroepen voor chatId: ' + chatId);
  try {
    var ss = SpreadsheetApp.getActive();
    var weekStart = weekStartDate(new Date());
    var mesoWeek = getMesoWeek();
    var macro = bepaalFaseVoorDatum_(weekStart);
    var targets = getVolumeTargets();
    var volTarget = targets[macro.fase] || null;
    var weekMin = 0;
    try { weekMin = computeWeekVolumeMin_(ss, weekStart); } catch (e) { console.warn('computeWeekVolumeMin_: ' + e.message); }
    var weekTss = _statusWeekTss_(weekStart);
    var wellness = getWellnessSignal(ss);
    var debt = null;
    try { debt = computeZoneDebt_(ss, weekStart); } catch (e) { console.warn('computeZoneDebt_: ' + e.message); }

    var lines = [];
    lines.push('📊 Status');
    lines.push('');

    // ── Periode ──
    lines.push('Meso week ' + mesoWeek + '/4 · macro: ' + macro.fase);
    if (macro.eventDriven && macro.eventName && macro.eventDate) {
      var days = Math.max(0, Math.round((stripTime_(macro.eventDate).getTime() - stripTime_(new Date()).getTime()) / 86400000));
      lines.push('Event: ' + macro.eventName + ' over ' + days + ' dagen');
    }
    lines.push('');

    // ── Week ──
    var tijdStr = Math.floor(weekMin / 60) + 'u ' + (weekMin % 60) + 'm';
    lines.push('Week TSS: ' + weekTss + ' · tijd: ' + tijdStr);
    if (volTarget) {
      lines.push('Richting ' + macro.fase + ': ' + volTarget[0] + '-' + volTarget[1] + 'u');
    }
    lines.push('');

    // ── Wellness ──
    var hrvStr;
    if (wellness.hrvRecent != null && wellness.hrvBaseline != null) {
      var pct = wellness.hrvDeficit != null ? (wellness.hrvDeficit >= 0 ? '+' : '') + wellness.hrvDeficit + '%' : '?';
      hrvStr = 'HRV ' + wellness.hrvRecent + ' (baseline ' + wellness.hrvBaseline + ', ' + pct + ')';
    } else {
      hrvStr = 'HRV: geen data';
    }
    lines.push(hrvStr);
    var slaapStr;
    if (wellness.sleepLastNight != null) {
      slaapStr = 'Slaap ' + wellness.sleepLastNight + 'u · ' + _statusWellnessLabel_(wellness.signal);
    } else {
      slaapStr = 'Slaap: geen data · ' + _statusWellnessLabel_(wellness.signal);
    }
    lines.push(slaapStr);

    // ── Debt (alleen als open) ──
    var debtLines = _statusDebtLines_(debt);
    if (debtLines.length) {
      lines.push('');
      lines.push('Zone-debt deze week:');
      debtLines.forEach(function (l) { lines.push(l); });
    }

    var resp = tgSendMessage(chatId, lines.join('\n'));
    Logger.log('handleStatus_ tgSendMessage response: ' + JSON.stringify(resp));
  } catch (err) {
    console.error('handleStatus_ crashed: ' + (err && err.stack ? err.stack : err));
    try { tgSendMessage(chatId, 'Status kon niet worden opgebouwd: ' + (err && err.message ? err.message : err)); } catch (e2) {}
  }
}

/** Sum icu_training_load over cycling activities tussen weekStart en +7d. */
function _statusWeekTss_(weekStart) {
  var acts = [];
  try { acts = getActivities(14) || []; } catch (e) { console.warn('_statusWeekTss_ getActivities: ' + e.message); return 0; }
  var wsT = stripTime_(weekStart).getTime();
  var weT = wsT + 7 * 86400000;
  var sum = 0;
  acts.forEach(function (a) {
    if (CYCLING_TYPES.indexOf(String(a.type || '')) < 0) return;
    if (!a.start_date_local) return;
    var dd = stripTime_(new Date(a.start_date_local)).getTime();
    if (dd < wsT || dd >= weT) return;
    var tss = a.icu_training_load != null ? a.icu_training_load
            : (a.training_load != null ? a.training_load
            : (a.tss != null ? a.tss : 0));
    sum += Number(tss) || 0;
  });
  return Math.round(sum);
}

function _statusWellnessLabel_(signal) {
  if (signal === 'recovery' || signal === 'demote') return 'sterke afwijking';
  if (signal === 'warning') return 'lichte afwijking';
  return 'binnen baseline';
}

/**
 * Bouw 1-3 regels voor de debt-sectie. Tekort = positief getal (intent>actual).
 * Surplus = negatief. Skip buckets onder de ±5 min drempel (al door
 * computeZoneDebt_ op 0 gezet, dus we filteren simpelweg op !=0).
 */
function _statusDebtLines_(debt) {
  if (!debt || !debt.hasPlan || !debt.debt) return [];
  var lines = [];
  ['high', 'anaerobic', 'low'].forEach(function (b) {
    var v = Number(debt.debt[b]) || 0;
    if (v === 0) return;
    var sign = v > 0 ? '+' : '';
    var note = v > 0 ? ' (tekort)' : ' (overschot)';
    lines.push('  ' + b + ': ' + sign + v + ' min' + note);
  });
  return lines;
}

// ── Telegram Bot API helpers ─────────────────────────────────────

/** Bouwt base URL met token: https://api.telegram.org/bot<token> */
function _tgApiBase_() {
  return TELEGRAM_API_BASE + getTelegramBotToken_();
}

/**
 * POST naar Telegram Bot API. Returned parsed JSON (of throws bij HTTP-fout).
 */
function _tgRequest_(method, payload) {
  var url = _tgApiBase_() + '/' + method;
  var payloadStr = JSON.stringify(payload || {});
  // Log token-gemaskeerd zodat we URL+body in Executions kunnen volgen.
  Logger.log('_tgRequest_ POST ' + method + ' body: ' + payloadStr);
  var opts = {
    method: 'post',
    contentType: 'application/json',
    payload: payloadStr,
    muteHttpExceptions: true
  };
  var resp = UrlFetchApp.fetch(url, opts);
  var code = resp.getResponseCode();
  var body = resp.getContentText();
  Logger.log('_tgRequest_ ' + method + ' → ' + code + ' body: ' + body);
  var parsed;
  try { parsed = body ? JSON.parse(body) : {}; } catch (e) { parsed = { raw: body }; }
  if (code >= 400 || parsed.ok === false) {
    throw new Error('Telegram ' + method + ' error ' + code + ': ' +
                    (parsed.description || body || '').substring(0, 300));
  }
  return parsed;
}

/**
 * Stuur tekstbericht. opts: { parseMode, replyMarkup, disableWebPagePreview }.
 *
 * Default = PLAIN TEXT (geen parse_mode in payload). Dat sluit alle HTML- en
 * Markdown-parse-conflicten uit (em-dashes, underscores, asterisken). Voor
 * opzettelijke styling moet de caller expliciet parseMode: 'HTML' of
 * 'MarkdownV2' meegeven — en zelf escaping verzorgen.
 */
function tgSendMessage(chatId, text, opts) {
  opts = opts || {};
  var payload = {
    chat_id: chatId,
    text: text
  };
  // Alleen toevoegen als de caller expliciet een parseMode wenst.
  if (opts.parseMode !== undefined && opts.parseMode !== null && opts.parseMode !== '') {
    payload.parse_mode = opts.parseMode;
  }
  if (opts.replyMarkup) payload.reply_markup = opts.replyMarkup;
  if (opts.disableWebPagePreview) payload.disable_web_page_preview = true;
  return _tgRequest_('sendMessage', payload);
}

/** GET /getMe — bot identiteit (username, id). */
function tgGetMe() {
  var resp = UrlFetchApp.fetch(_tgApiBase_() + '/getMe', { muteHttpExceptions: true });
  var body = resp.getContentText();
  var parsed = body ? JSON.parse(body) : {};
  if (resp.getResponseCode() >= 400 || parsed.ok === false) {
    throw new Error('Telegram getMe error: ' + (parsed.description || body));
  }
  return parsed;
}

/**
 * Registreer webhook bij Telegram. drop_pending_updates=true voorkomt
 * dat oude queue (van vorige misconfig) ineens binnenkomt. allowed_updates
 * beperkt verkeer tot wat we straks daadwerkelijk verwerken.
 *
 * NB: de URL die we registreren MOET de ?s=<secret> query-parameter
 * bevatten (zie doPost). secret_token in de body zou via header gaan
 * en Apps Script kan headers niet lezen — daarom alleen query-param.
 */
function tgSetWebhook(url, secret) {
  return _tgRequest_('setWebhook', {
    url: url,
    drop_pending_updates: true,
    allowed_updates: ['message', 'callback_query']
  });
}

/** GET /getWebhookInfo — handig voor verificatie na setWebhook. */
function tgGetWebhookInfo() {
  var resp = UrlFetchApp.fetch(_tgApiBase_() + '/getWebhookInfo', { muteHttpExceptions: true });
  return JSON.parse(resp.getContentText() || '{}');
}

/**
 * DELETE webhook + drop pending updates. Gebruikt om de queue 100% leeg
 * te maken vóór een opnieuw registreren — voorkomt herhaling van het
 * burst-symptoom waar oude /start-berichten in 30+ retries binnenkwamen.
 */
function tgDeleteWebhook() {
  return _tgRequest_('deleteWebhook', { drop_pending_updates: true });
}

// ── Setup-menu acties ────────────────────────────────────────────

/**
 * Setup-menu: registreer de huidige deploy-URL + webhook-secret bij Telegram.
 * URL wordt opgebouwd als <deployUrl>?s=<webhookSecret>.
 */
function registerTelegramWebhook() {
  var ui;
  try { ui = SpreadsheetApp.getUi(); } catch (e) {}
  try {
    var deploy = getDeployUrl_();
    var secret = getWebhookSecret_();
    var fullUrl = deploy + (deploy.indexOf('?') >= 0 ? '&' : '?') + 's=' + encodeURIComponent(secret);
    var resp = tgSetWebhook(fullUrl, secret);
    var info;
    try { info = tgGetWebhookInfo(); } catch (e2) { info = { error: e2.message }; }
    var msg = 'setWebhook response:\n' + JSON.stringify(resp, null, 2) +
              '\n\ngetWebhookInfo:\n' +
              JSON.stringify({
                url:                (info.result || {}).url,
                pending_update_count: (info.result || {}).pending_update_count,
                last_error_message: (info.result || {}).last_error_message
              }, null, 2);
    if (ui) ui.alert('Webhook geregistreerd', msg, ui.ButtonSet.OK);
  } catch (err) {
    if (ui) ui.alert('Webhook setup mislukt', err.message, ui.ButtonSet.OK);
    else throw err;
  }
}

/**
 * Setup-menu: 1-klik reset — delete webhook (incl. drop_pending_updates) +
 * opnieuw registreren met huidige deploy-URL + secret. Dit garandeert dat
 * de queue daadwerkelijk leeg is voordat we nieuwe verkeer gaan ontvangen.
 */
function resetTelegramWebhook() {
  var ui;
  try { ui = SpreadsheetApp.getUi(); } catch (e) {}
  try {
    var del = tgDeleteWebhook();
    var deploy = getDeployUrl_();
    var secret = getWebhookSecret_();
    var fullUrl = deploy + (deploy.indexOf('?') >= 0 ? '&' : '?') + 's=' + encodeURIComponent(secret);
    var set = tgSetWebhook(fullUrl, secret);
    var info;
    try { info = tgGetWebhookInfo(); } catch (e2) { info = { error: e2.message }; }
    var msg =
      'deleteWebhook:\n' + JSON.stringify(del, null, 2) +
      '\n\nsetWebhook:\n' + JSON.stringify(set, null, 2) +
      '\n\ngetWebhookInfo:\n' +
      JSON.stringify({
        url:                  (info.result || {}).url,
        pending_update_count: (info.result || {}).pending_update_count,
        last_error_message:   (info.result || {}).last_error_message
      }, null, 2);
    if (ui) ui.alert('Webhook gereset', msg, ui.ButtonSet.OK);
  } catch (err) {
    if (ui) ui.alert('Webhook reset mislukt', err.message, ui.ButtonSet.OK);
    else throw err;
  }
}

/** Setup-menu: getMe call → bot username + id alert. */
function testBotConnection() {
  var ui;
  try { ui = SpreadsheetApp.getUi(); } catch (e) {}
  try {
    var me = tgGetMe();
    var r = me.result || {};
    var msg = 'Bot: @' + (r.username || '?') + '\nid: ' + (r.id || '?') +
              '\nnaam: ' + (r.first_name || '?') +
              '\ncan_join_groups: ' + r.can_join_groups +
              '\nsupports_inline: ' + r.supports_inline_queries;
    if (ui) ui.alert('✅ Bot bereikbaar', msg, ui.ButtonSet.OK);
  } catch (err) {
    if (ui) ui.alert('❌ Bot niet bereikbaar', err.message, ui.ButtonSet.OK);
    else throw err;
  }
}

/**
 * Setup-menu: toont de 10 meest recente Audit-rijen in een alert. Format
 * per regel:  HH:mm:ss | upd_id | branch | "text-preview" | ok|err | NNms
 * Bedoeld voor snelle mobiel-diagnose zonder Apps Script Editor te openen.
 */
function showLastAuditRows() {
  var ui;
  try { ui = SpreadsheetApp.getUi(); } catch (e) { return; }
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(AUDIT_SHEET);
  if (!sh || sh.getLastRow() < 2) {
    ui.alert('Audit', 'Nog geen audit-rijen aanwezig.', ui.ButtonSet.OK);
    return;
  }
  var rowsToShow = Math.min(10, sh.getLastRow() - 1);
  var data = sh.getRange(2, 1, rowsToShow, AUDIT_HEADERS.length).getValues();
  var tz = (typeof TZ !== 'undefined' && TZ) ? TZ : 'Europe/Amsterdam';
  var lines = data.map(function (r) {
    var ts = r[0] instanceof Date ? Utilities.formatDate(r[0], tz, 'HH:mm:ss') : String(r[0]);
    var upd = r[1] === '' ? '?' : r[1];
    var text = String(r[3] || '').substring(0, 30);
    var branch = r[4] || '?';
    var ok = r[5] === true ? 'ok' : (r[5] === false ? 'err' : '-');
    var dur = (r[6] === '' || r[6] == null) ? '?' : (r[6] + 'ms');
    return ts + ' | ' + upd + ' | ' + branch + ' | "' + text + '" | ' + ok + ' | ' + dur;
  });
  ui.alert('Laatste ' + rowsToShow + ' audit-rijen', lines.join('\n'), ui.ButtonSet.OK);
}

/** Setup-menu: stuurt testbericht naar eigen chat → bevestigt token + chatId. */
function testSendMessageToSelf() {
  var ui;
  try { ui = SpreadsheetApp.getUi(); } catch (e) {}
  try {
    var chatId = getTelegramChatId_();
    var ts = Utilities.formatDate(new Date(), TZ || 'Europe/Amsterdam', 'dd-MM-yyyy HH:mm:ss');
    tgSendMessage(chatId, '🧪 Test van Setup-menu om ' + ts);
    if (ui) ui.alert('✓ Testbericht verstuurd', 'Check je Telegram-chat.', ui.ButtonSet.OK);
  } catch (err) {
    if (ui) ui.alert('❌ Testbericht mislukt', err.message, ui.ButtonSet.OK);
    else throw err;
  }
}
