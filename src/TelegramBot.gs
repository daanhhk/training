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

/**
 * doPost — Telegram webhook entry point.
 *
 * Verwacht POST naar deploy-URL met query-param ?s=<webhook-secret>.
 * Body is een Telegram Update-object (JSON).
 */
function doPost(e) {
  try {
    // 1. Secret-token validatie via query-param.
    var expectedSecret = getWebhookSecret_();
    var receivedSecret = e && e.parameter && e.parameter.s ? String(e.parameter.s) : '';
    if (!receivedSecret || receivedSecret !== expectedSecret) {
      console.warn('doPost: secret mismatch — request afgewezen.');
      // Return 200 zodat misbruikers niet kunnen detecteren dat de endpoint bestaat,
      // maar zonder enige verwerking.
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

    // 3. v1 negeert non-message updates (callback_query, edited_message, etc.).
    var msg = update && update.message;
    if (!msg) return _tgOk_();

    var chatId = msg.chat && msg.chat.id;
    var text   = msg.text ? String(msg.text) : '';
    if (!chatId) return _tgOk_();

    // 4. Autorisatie — alleen Daan's eigen chat mag interageren.
    var authorizedChatId;
    try {
      authorizedChatId = getTelegramChatId_();
    } catch (authErr) {
      console.warn('doPost: TELEGRAM_CHAT_ID niet ingesteld — ' + authErr.message);
      // Stuur niets terug (we hebben geen "eigenaar" om naartoe te schrijven).
      return _tgOk_();
    }
    if (String(chatId) !== String(authorizedChatId)) {
      console.warn('doPost: onbevoegde chat_id=' + chatId);
      try { tgSendMessage(chatId, 'Niet geautoriseerd.'); } catch (sendErr) { /* swallow */ }
      return _tgOk_();
    }

    // 5. Negeer non-text berichten in v1.
    if (!text) {
      console.log('doPost: non-text message genegeerd (chat ' + chatId + ').');
      return _tgOk_();
    }

    // 6. Dispatch.
    console.log('doPost: chat=' + chatId + ' text="' + text.substring(0, 80) + '"');
    routeCommand_(text, chatId);
    return _tgOk_();

  } catch (err) {
    // Vangnet — Telegram blijft anders retryen.
    console.error('doPost crashed: ' + (err && err.stack ? err.stack : err));
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
  var trimmed = String(text || '').trim();
  if (!trimmed) return;
  var firstSpace = trimmed.indexOf(' ');
  var head = firstSpace < 0 ? trimmed : trimmed.substring(0, firstSpace);
  // Strip @botname (Telegram appendt die in group chats).
  var atIdx = head.indexOf('@');
  if (atIdx > 0) head = head.substring(0, atIdx);
  var cmd = head.toLowerCase();

  switch (cmd) {
    case '/start': return handleStart_(chatId);
    case '/help':  return handleHelp_(chatId);
    default:
      tgSendMessage(chatId, 'Onbekend commando. Stuur /help.');
  }
}

function handleStart_(chatId) {
  var txt =
    '👋 Welkom bij je FTP Trainings Coach.\n\n' +
    'Deze bot stuurt je later in de week voorstellen en vraagt feedback ' +
    'na je ritten.\n\n' +
    'Probeer /help voor beschikbare commands.';
  tgSendMessage(chatId, txt);
}

function handleHelp_(chatId) {
  var txt =
    'Beschikbare commands:\n' +
    '/start — welkomstbericht\n' +
    '/help — deze lijst\n\n' +
    'Meer commands volgen later (voorstel, sync, status, RPE).';
  tgSendMessage(chatId, txt);
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
  var opts = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload || {}),
    muteHttpExceptions: true
  };
  var resp = UrlFetchApp.fetch(url, opts);
  var code = resp.getResponseCode();
  var body = resp.getContentText();
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
 * Default parseMode = HTML (geeft bold/italic/links zonder Markdown-escaping
 * gedoe rond underscores e.d.).
 */
function tgSendMessage(chatId, text, opts) {
  opts = opts || {};
  var payload = {
    chat_id: chatId,
    text: text,
    parse_mode: opts.parseMode || 'HTML'
  };
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
