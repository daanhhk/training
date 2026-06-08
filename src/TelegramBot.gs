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

    // 3. Process via gedeelde update-processor (zelfde logica als polling).
    _processTelegramUpdate_(update, 'webhook');
    return _tgOk_();

  } catch (err) {
    console.error('doPost crashed: ' + (err && err.stack ? err.stack : err));
    return _tgOk_();
  }
}

/**
 * Gedeelde update-processor voor beide entry points (webhook doPost en
 * polling). Doet dedupe, autorisatie, audit en dispatch via routeCommand_.
 * Source-parameter is alleen voor logging zodat we in Executions zien
 * waar de update vandaan komt.
 */
function _processTelegramUpdate_(update, source) {
  // Inline-button taps (RPE-knoppen) → aparte callback-flow, vóór de
  // tekst-flow zodat ze niet als bericht worden geïnterpreteerd.
  if (update && update.callback_query) { handleRpeCallback(update, source); return; }

  var startMs = Date.now();
  var audit = {
    timestamp: new Date(),
    update_id: update && update.update_id != null ? update.update_id : '',
    chat_id: '',
    text: '',
    branch: '',
    response_ok: undefined,
    duration_ms: 0
  };

  try {
    // v1 negeert non-message updates (callback_query, edited_message, etc.).
    var msg = update && update.message;
    if (!msg) return;

    var chatId = msg.chat && msg.chat.id;
    var text   = msg.text ? String(msg.text) : '';
    if (!chatId) return;
    audit.chat_id = chatId;
    audit.text = text;

    // Dedupe — zelfde FIFO ring buffer. In polling-mode komt dit zelden voor
    // (Telegram cleart updates met offset-confirmatie) maar redundancy schaadt
    // niet en blijft het webhook-pad robuust.
    if (isDuplicateUpdate_(audit.update_id)) {
      console.log(source + ': duplicate update_id=' + audit.update_id + ', skipping');
      audit.branch = 'duplicate';
      audit.response_ok = true;
      audit.duration_ms = Date.now() - startMs;
      auditLog_(audit);
      return;
    }

    // Autorisatie — alleen Daan's eigen chat mag interageren.
    var authorizedChatId;
    try {
      authorizedChatId = getTelegramChatId_();
    } catch (authErr) {
      console.warn(source + ': TELEGRAM_CHAT_ID niet ingesteld — ' + authErr.message);
      return;
    }
    if (String(chatId) !== String(authorizedChatId)) {
      console.warn(source + ': onbevoegde chat_id=' + chatId);
      var authOk = false;
      try { tgSendMessage(chatId, 'Niet geautoriseerd.'); authOk = true; } catch (sendErr) { /* swallow */ }
      audit.branch = 'auth_failed';
      audit.response_ok = authOk;
      audit.duration_ms = Date.now() - startMs;
      auditLog_(audit);
      return;
    }

    // Negeer non-text berichten in v1. Geen audit — te ruisig.
    if (!text) {
      console.log(source + ': non-text message genegeerd (chat ' + chatId + ').');
      return;
    }

    // Dispatch — handlers sturen zelf via tgSendMessage. routeCommand_
    // returnt de branch-string die we in de Audit-tab loggen.
    console.log(source + ': chat=' + chatId + ' text="' + text.substring(0, 80) + '"');
    var routeOk = true;
    try {
      audit.branch = routeCommand_(text, chatId) || 'default';
    } catch (routeErr) {
      console.error('routeCommand_ throw (' + source + '): ' + (routeErr && routeErr.stack ? routeErr.stack : routeErr));
      audit.branch = audit.branch || 'crash';
      routeOk = false;
    }
    audit.response_ok = routeOk;
    audit.duration_ms = Date.now() - startMs;
    auditLog_(audit);

  } catch (err) {
    console.error('_processTelegramUpdate_ crashed (' + source + '): ' + (err && err.stack ? err.stack : err));
    try {
      audit.branch = audit.branch || 'crash';
      audit.response_ok = false;
      audit.duration_ms = Date.now() - startMs;
      auditLog_(audit);
    } catch (auditErr) { /* swallow */ }
  }
}

/** Standaard 200 OK response (lege body). */
function _tgOk_() {
  return ContentService.createTextOutput('').setMimeType(ContentService.MimeType.TEXT);
}

/**
 * Verwerkt een inline-button tap (callback_query) — RPE-knoppen. Parse
 * callback_data 'rpe:<yyyy-MM-dd>:<n>', sla rpe_<date> op, bevestig via
 * answerCallbackQuery + editMessageText. Zelfde dedupe/auth/audit-flow als
 * de tekst-processor.
 */
function handleRpeCallback(update, source) {
  var startMs = Date.now();
  var cbq = update.callback_query || {};
  var audit = { timestamp: new Date(), update_id: update.update_id != null ? update.update_id : '',
    chat_id: '', text: cbq.data || '', branch: 'callback', response_ok: false, duration_ms: 0 };
  try {
    if (isDuplicateUpdate_(audit.update_id)) { audit.branch = 'duplicate'; audit.response_ok = true; audit.duration_ms = Date.now() - startMs; auditLog_(audit); return; }
    var chatId = (cbq.message && cbq.message.chat) ? cbq.message.chat.id : (cbq.from ? cbq.from.id : null);
    audit.chat_id = chatId;
    var authChat;
    try { authChat = getTelegramChatId_(); } catch (e) { console.warn(source + ': geen TELEGRAM_CHAT_ID'); return; }
    if (String(chatId) !== String(authChat)) {
      try { _tgRequest_('answerCallbackQuery', { callback_query_id: cbq.id, text: 'Niet geautoriseerd.' }); } catch (e2) {}
      audit.branch = 'auth_failed'; audit.duration_ms = Date.now() - startMs; auditLog_(audit); return;
    }
    var m = (cbq.data || '').match(/^rpe:(\d{4}-\d{2}-\d{2}):(\d{1,2})$/);
    if (!m) {
      try { _tgRequest_('answerCallbackQuery', { callback_query_id: cbq.id }); } catch (e3) {}
      audit.branch = 'callback_unknown'; audit.response_ok = true; audit.duration_ms = Date.now() - startMs; auditLog_(audit); return;
    }
    var dISO = m[1], rpe = parseInt(m[2], 10);
    setDocProp('rpe_' + dISO, String(rpe));
    try { _tgRequest_('answerCallbackQuery', { callback_query_id: cbq.id, text: 'RPE ' + rpe + ' opgeslagen' }); } catch (e4) {}
    try { _tgRequest_('editMessageText', { chat_id: chatId, message_id: cbq.message.message_id,
      text: '✅ RPE ' + rpe + '/10 genoteerd voor ' + dISO + '. Bedankt!' }); } catch (e5) {}
    audit.branch = 'rpe'; audit.response_ok = true; audit.duration_ms = Date.now() - startMs; auditLog_(audit);
  } catch (err) {
    console.error('handleRpeCallback crashed (' + source + '): ' + (err && err.stack ? err.stack : err));
    audit.branch = audit.branch || 'crash'; audit.duration_ms = Date.now() - startMs;
    try { auditLog_(audit); } catch (e6) {}
  }
}

// NB: PROMPT O probeerde respond-via-webhook (sendMessage als JSON-body in
// de HTTP-response) maar Telegram herkent dat formaat niet op Apps Script
// Web Apps — vermoedelijk wegens de 302-redirect naar googleusercontent.com
// die Apps Script automatisch doet. Bot stuurde geen bericht meer, dus
// gerolled-back naar tgSendMessage als primaire route in PROMPT P.
// Dedupe blijft de praktische mitigatie voor het retry-symptoom.

// ── Command router ───────────────────────────────────────────────

/**
 * Splitst text op spatie, eerste token is de command (eventueel met
 * @botname suffix die we strippen). Onbekend → /help-hint.
 */
/**
 * Returnt een branch-string (start, status, help, default, empty).
 * Handlers sturen zelf via tgSendMessage; routeCommand_ rapporteert
 * alleen welke branch geraakt is voor de Audit-tab.
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
  if (cmd === '/voorstel') {
    Logger.log('routeCommand_ -> handleVoorstel_');
    handleVoorstel_(chatId);
    return 'voorstel';
  }
  if (cmd === '/sync') {
    Logger.log('routeCommand_ -> handleSync_');
    handleSync_(chatId);
    return 'sync';
  }
  if (cmd === '/klaar') {
    Logger.log('routeCommand_ -> handleKlaar_');
    handleKlaar_(chatId);
    return 'klaar';
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
    '/voorstel - weekvoorstel als bericht\n' +
    '/sync - haal intervals.icu data op\n' +
    '/klaar - log RPE na je rit\n' +
    '/help - deze lijst\n\n' +
    'RPE-loop actief.';
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

    // Form-score (Vorm = CTL - ATL) uit intervals.icu — null → geen regel.
    var fs = getFormScore_();
    if (fs) lines.push('Vorm ' + Math.round(fs.form) + ' · ' + fs.label + ' (Conditie ' + Math.round(fs.ctl) + ' / Verm. ' + Math.round(fs.atl) + (fs.ramp != null ? ' · ramp ' + (Math.round(fs.ramp * 10) / 10) + '/wk' : '') + ')');

    // RPE-3: recente RPE + mismatch-vlag (lege array bij geen RPE deze week)
    Array.prototype.push.apply(lines, rpeStatusLines_());

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

/**
 * /voorstel — toont het weekvoorstel uit de weekplan-snapshot als bericht.
 */
function handleVoorstel_(chatId) {
  Logger.log('handleVoorstel_ aangeroepen voor chatId: ' + chatId);
  try {
    var monday = weekStartDate(new Date());
    var raw = getDocProp('weekplan_' + formatDate(monday, 'yyyy-MM-dd'), '');
    if (!raw) { tgSendMessage(chatId, 'Nog geen voorstel voor deze week. Draai eerst Coach > Genereer voorstel in de Sheet.'); return; }
    var plan = [];
    try { plan = JSON.parse(raw); } catch (e) {}
    if (!plan.length) { tgSendMessage(chatId, 'Voorstel is leeg voor deze week.'); return; }
    var lines = ['🚴 Voorstel week ' + formatDate(monday, 'dd-MM') + ':'];
    var totMin = 0, totTss = 0;
    plan.forEach(function (p) {
      var dag = p.datum ? formatDate(new Date(p.datum), 'EEE dd-MM') : '?';
      var naam = p.naam || p.workoutType || '?';
      lines.push('• ' + dag + ': ' + naam + ' — ' + (p.minuten || 0) + ' min, TSS ' + (p.tss || 0));
      totMin += p.minuten || 0; totTss += p.tss || 0;
    });
    lines.push('');
    lines.push('Totaal: ' + Math.floor(totMin / 60) + 'u ' + (totMin % 60) + 'm · TSS ' + totTss);
    tgSendMessage(chatId, lines.join('\n'));
  } catch (e) {
    console.error('handleVoorstel_ fout: ' + (e && e.stack ? e.stack : e));
    tgSendMessage(chatId, '⚠️ Kon voorstel niet ophalen: ' + (e && e.message ? e.message : 'onbekende fout') + '.');
  }
}

/**
 * /sync — draait syncAll() (intervals.icu data ophalen) en bevestigt.
 */
function handleSync_(chatId) {
  Logger.log('handleSync_ aangeroepen voor chatId: ' + chatId);
  tgSendMessage(chatId, '🔄 Sync met intervals.icu gestart...');
  try {
    syncAll();
    var last = getDocProp('last_sync', '');
    tgSendMessage(chatId, '✅ Sync klaar.' + (last ? ' Laatste sync: ' + last : ''));
  } catch (e) {
    console.error('handleSync_ syncAll fout: ' + (e && e.stack ? e.stack : e));
    tgSendMessage(chatId, '⚠️ Sync mislukt: ' + (e && e.message ? e.message : 'onbekende fout') + '. Check de Audit-tab.');
  }
}

/**
 * Stuurt een RPE 1-10 prompt met inline-buttons (twee rijen van 5).
 * callback_data 'rpe:<dISO>:<n>' wordt door handleRpeCallback verwerkt.
 */
function sendRpePrompt(chatId, dISO, sessieNaam) {
  var rows = [], r = [];
  for (var n = 1; n <= 10; n++) {
    r.push({ text: String(n), callback_data: 'rpe:' + dISO + ':' + n });
    if (n === 5 || n === 10) { rows.push(r); r = []; }
  }
  var txt = 'Hoe zwaar voelde ' + (sessieNaam ? '"' + sessieNaam + '" ' : 'je rit ') +
    'vandaag? Tik je RPE (1 = heel licht, 10 = maximaal):';
  return tgSendMessage(chatId, txt, { replyMarkup: { inline_keyboard: rows } });
}

/** Leest de workout-naam uit de proposal-snapshot voor een datum (of ''). */
function rpeSessieNaamVoorDatum(dISO) {
  try { var raw = getDocProp('proposal_' + dISO, ''); if (raw) { var wo = JSON.parse(raw); return (wo && wo.naam) ? wo.naam : ''; } } catch (e) {}
  return '';
}

/** /klaar — sync activities en vraag RPE voor vandaag via inline-buttons. */
function handleKlaar_(chatId) {
  Logger.log('handleKlaar_ aangeroepen voor chatId: ' + chatId);
  try { syncActivities(); } catch (e) { console.warn('handleKlaar_ syncActivities: ' + (e && e.message ? e.message : e)); }
  var dISO = formatDate(new Date(), 'yyyy-MM-dd');
  sendRpePrompt(chatId, dISO, rpeSessieNaamVoorDatum(dISO));
}

/** Sum icu_training_load over cycling activities tussen weekStart en +7d. */
function _statusWeekTss_(weekStart, actValues) {
  var wsT = stripTime_(weekStart).getTime();
  var weT = wsT + 7 * 86400000;
  // PERF: Sheet-pad (actValues = Activiteiten-array) — zelfde week+cycling-filter +
  // TSS-som (idx0 Datum / idx1 Type / idx8 TSS) als getWeekLoad_. Geen array → live.
  if (actValues) {
    var sumA = 0;
    actValues.forEach(function (r) {
      if (!(r[0] instanceof Date)) return;
      if (CYCLING_TYPES.indexOf(String(r[1] || '')) < 0) return;
      var t = stripTime_(r[0]).getTime();
      if (t < wsT || t >= weT) return;
      if (r[8] !== '' && r[8] != null) sumA += Number(r[8]) || 0;
    });
    return Math.round(sumA);
  }
  var acts = [];
  try { acts = getActivities(14) || []; } catch (e) { console.warn('_statusWeekTss_ getActivities: ' + e.message); return 0; }
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
 * Wordt ook gebruikt door Start polling: een bot kan niet tegelijk in
 * webhook- en polling-mode staan.
 */
function tgDeleteWebhook() {
  return _tgRequest_('deleteWebhook', { drop_pending_updates: true });
}

// ── Long polling ─────────────────────────────────────────────────

var POLL_OFFSET_KEY  = 'TELEGRAM_POLL_OFFSET';
var POLL_TRIGGER_KEY = 'TELEGRAM_POLL_TRIGGER_ID';
var POLL_HANDLER     = 'pollTelegramUpdates';

/**
 * Time-based trigger entry-point. Roept getUpdates aan met de opgeslagen
 * offset, processed elke update via _processTelegramUpdate_, en advance't
 * de offset op de hoogste update_id plus 1.
 *
 * timeout=0 = short polling (geen long-hold). We bouwen long-poll niet in
 * omdat Apps Script triggers maximaal 6 minuten draaien en we toch al
 * elke minuut polten.
 */
function pollTelegramUpdates() {
  try {
    var props = PropertiesService.getDocumentProperties();
    var offset = Number(props.getProperty(POLL_OFFSET_KEY) || 0);

    var response;
    try {
      response = _tgRequest_('getUpdates', {
        offset: offset,
        timeout: 0,
        allowed_updates: ['message', 'callback_query']
      });
    } catch (e) {
      console.error('pollTelegramUpdates getUpdates faalde: ' + e.message);
      return;
    }

    var updates = (response && response.result) || [];
    if (!updates.length) return;
    console.log('pollTelegramUpdates: ' + updates.length + ' update(s) ontvangen (offset=' + offset + ')');

    var maxUpdateId = offset - 1;
    updates.forEach(function (update) {
      if (update && typeof update.update_id === 'number' && update.update_id > maxUpdateId) {
        maxUpdateId = update.update_id;
      }
      _processTelegramUpdate_(update, 'polling');
    });

    // Confirm processed updates: volgende getUpdates-call met deze offset
    // verwijdert ze van Telegram's server-side queue.
    if (maxUpdateId >= 0) {
      props.setProperty(POLL_OFFSET_KEY, String(maxUpdateId + 1));
    }
  } catch (outerErr) {
    console.error('pollTelegramUpdates crashed: ' + (outerErr && outerErr.stack ? outerErr.stack : outerErr));
  }
}

/** Verwijder alle bestaande polling-triggers. Returnt aantal verwijderd. */
function _removePollingTriggers_() {
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === POLL_HANDLER) {
      ScriptApp.deleteTrigger(t);
      n++;
    }
  });
  return n;
}

/**
 * Setup-menu: schakel naar polling-mode. Verwijdert eerst de webhook
 * (Telegram laat niet tegelijk webhook + polling toe), installeert dan
 * een time-based trigger elke minuut op pollTelegramUpdates, en slaat
 * de trigger-ID op in DocProperties zodat Stop polling 'm netjes kan
 * verwijderen.
 */
function startTelegramPolling() {
  var ui;
  try { ui = SpreadsheetApp.getUi(); } catch (e) {}
  try {
    var del;
    try { del = tgDeleteWebhook(); }
    catch (e) { del = { error: e.message }; }

    _removePollingTriggers_();
    var trigger = ScriptApp.newTrigger(POLL_HANDLER)
      .timeBased()
      .everyMinutes(1)
      .create();
    PropertiesService.getDocumentProperties()
      .setProperty(POLL_TRIGGER_KEY, trigger.getUniqueId());

    var msg = 'Webhook verwijderd, trigger geïnstalleerd (elke minuut).\n' +
              'Bot reageert nu binnen 0-60 seconden op berichten.\n\n' +
              'deleteWebhook response:\n' + JSON.stringify(del, null, 2);
    if (ui) ui.alert('✅ Polling actief', msg, ui.ButtonSet.OK);
  } catch (err) {
    if (ui) ui.alert('Polling start mislukt', err.message, ui.ButtonSet.OK);
    else throw err;
  }
}

/**
 * Setup-menu: stop polling-mode. Verwijdert alle polling-triggers en
 * wist de trigger-ID DocProp. De webhook blijft uit (bot ontvangt
 * niets tot je weer Start polling of Registreer webhook draait).
 */
function stopTelegramPolling() {
  var ui;
  try { ui = SpreadsheetApp.getUi(); } catch (e) {}
  var n = _removePollingTriggers_();
  PropertiesService.getDocumentProperties().deleteProperty(POLL_TRIGGER_KEY);
  if (ui) {
    ui.alert('Polling gestopt',
      n + ' trigger(s) verwijderd.\n\nBot ontvangt geen berichten meer tot je opnieuw Start polling of Registreer webhook kiest.',
      ui.ButtonSet.OK);
  }
}

/**
 * Setup-menu: roep pollTelegramUpdates eenmalig aan. Handig voor testing
 * zonder op de minuut-trigger te wachten.
 */
function pollTelegramUpdatesOnce() {
  var ui;
  try { ui = SpreadsheetApp.getUi(); } catch (e) {}
  try {
    pollTelegramUpdates();
    if (ui) ui.alert('✓ Poll gedaan',
      'getUpdates is eenmalig aangeroepen. Check de Audit-tab voor binnengekomen berichten.',
      ui.ButtonSet.OK);
  } catch (err) {
    if (ui) ui.alert('Poll mislukt', err.message, ui.ButtonSet.OK);
    else throw err;
  }
}

// ── RPE-avondcheck (fallback-trigger) ────────────────────────────

/**
 * Time-trigger ~20:00. Als vandaag een geplande trainingsdag was én er
 * nog geen rpe_<date> bestaat, stuur de RPE-prompt. Stil falen zonder
 * chat_id of buiten trainingsdag.
 */
function rpeAvondCheck() {
  try {
    var chatId; try { chatId = getTelegramChatId_(); } catch (e) { console.warn('rpeAvondCheck: geen chat_id'); return; }
    var ss = SpreadsheetApp.getActive();
    var dISO = formatDate(new Date(), 'yyyy-MM-dd');
    if (getDocProp('rpe_' + dISO, '')) { Logger.log('rpeAvondCheck: RPE bestaat al voor ' + dISO); return; }
    var planner = readPlanner(ss) || [];
    var today = stripTime_(new Date()).getTime();
    var row = null;
    planner.forEach(function (p) { if (p.datum && stripTime_(p.datum).getTime() === today) row = p; });
    if (!row || row.train !== true) { Logger.log('rpeAvondCheck: geen geplande trainingsdag vandaag'); return; }
    sendRpePrompt(chatId, dISO, rpeSessieNaamVoorDatum(dISO));
  } catch (err) { console.error('rpeAvondCheck crashed: ' + (err && err.stack ? err.stack : err)); }
}

/** Silent shared helper: verwijder alle triggers voor een handler-naam. */
function removeTriggersByHandler(handlerName) {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === handlerName) ScriptApp.deleteTrigger(t);
  });
}

function installRpeAvondTrigger() {
  removeTriggersByHandler('rpeAvondCheck');
  ScriptApp.newTrigger('rpeAvondCheck').timeBased().everyDays(1).atHour(20).create();
  var ui; try { ui = SpreadsheetApp.getUi(); } catch (e) {}
  if (ui) ui.alert('✅ RPE-avondcheck geïnstalleerd', 'Rond 20:00 vraagt de bot RPE als je die dag een trainingsdag had en nog niets invulde.', ui.ButtonSet.OK);
}

function removeRpeAvondTrigger() {
  removeTriggersByHandler('rpeAvondCheck');
  var ui; try { ui = SpreadsheetApp.getUi(); } catch (e) {}
  if (ui) ui.alert('RPE-avondcheck verwijderd.');
}

function zondagReminder() {
  try {
    var chatId; try { chatId = getTelegramChatId_(); } catch (e) { console.warn('zondagReminder: geen chat_id'); return; }
    var txt = '🗓️ Zondagavond — plan je week:\n' +
      '• Vul je beschikbaarheid voor volgende week in (Weekplanner +1).\n' +
      '• Draai daarna Coach > Genereer voorstel, of stuur /voorstel zodra het klaarstaat.';
    tgSendMessage(chatId, txt);
  } catch (err) { console.error('zondagReminder crashed: ' + (err && err.stack ? err.stack : err)); }
}

function installZondagReminderTrigger() {
  removeTriggersByHandler('zondagReminder');
  ScriptApp.newTrigger('zondagReminder').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(19).create();
  var ui; try { ui = SpreadsheetApp.getUi(); } catch (e) {}
  if (ui) ui.alert('✅ Zondag-reminder geïnstalleerd', 'Elke zondag rond 19:00 een herinnering om je week in te plannen.', ui.ButtonSet.OK);
}

function removeZondagReminderTrigger() {
  removeTriggersByHandler('zondagReminder');
  var ui; try { ui = SpreadsheetApp.getUi(); } catch (e) {}
  if (ui) ui.alert('Zondag-reminder verwijderd.');
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
