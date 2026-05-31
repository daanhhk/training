/**
 * Secrets.gs — secret-management laag.
 *
 * Alle gevoelige credentials (intervals.icu API key, Telegram bot token,
 * Telegram chat ID) wonen in PropertiesService.getDocumentProperties().
 * NOOIT in Sheet-cellen, NOOIT in code, NOOIT in commits.
 *
 * Migratie: bij eerste aanroep van een getter wordt gecheckt of de waarde
 * nog in een Sheet-cel staat (oude vorm). Zo ja: cel → property → cel
 * leegmaken. Dat maakt de upgrade naar deze structuur transparant voor
 * bestaande gebruikers van de tool.
 *
 * Setup menu (Code.gs → Coach → Setup) biedt UI om secrets te zetten
 * zonder ze in cellen te plakken.
 */

/** Property-keys waar de secrets opgeslagen worden. */
var SECRET_KEYS = {
  INTERVALS_API_KEY:  'INTERVALS_API_KEY',
  TELEGRAM_BOT_TOKEN: 'TELEGRAM_BOT_TOKEN',
  TELEGRAM_CHAT_ID:   'TELEGRAM_CHAT_ID'
};

/** Rijen in Instellingen-tab waar de secrets HISTORISCH stonden
 *  (vóór deze refactor). Gebruikt door de migratie-stap in elke getter. */
var SECRET_LEGACY_CELLS = {
  INTERVALS_API_KEY:  24,
  TELEGRAM_BOT_TOKEN: 28,
  TELEGRAM_CHAT_ID:   29
};

/**
 * Generieke secret-getter met migratie van legacy-cel.
 *
 * Volgorde:
 *   1. Lees property — als gevuld → return
 *   2. Lees legacy-cel — als gevuld → save naar property, clear cel, return
 *   3. Gooi error die naar het Setup-menu wijst
 *
 * @param {string} key      property-key uit SECRET_KEYS
 * @param {number} cellRow  legacy rij in Instellingen-tab
 * @param {string} label    user-facing label voor de error-message
 */
function getSecret_(key, cellRow, label) {
  var props = PropertiesService.getDocumentProperties();
  var val = props.getProperty(key);
  if (val && String(val).length) return String(val);

  // Migratie: kijk of de waarde nog in de oude cel staat.
  try {
    var ss = SpreadsheetApp.getActive();
    var sh = ss && ss.getSheetByName(SETTINGS_SHEET);
    if (sh) {
      var raw = sh.getRange(cellRow, 2).getValue();
      var legacy = raw == null ? '' : String(raw).trim();
      // Skip de instructie-tekst die we zelf in de cel hebben gezet bij
      // buildSettings (begint met '(via Coach').
      if (legacy && legacy.charAt(0) !== '(') {
        props.setProperty(key, legacy);
        sh.getRange(cellRow, 2).clearContent();
        // Re-render instructie-tekst in de oude cel.
        sh.getRange(cellRow, 2)
          .setValue('(via Coach > Setup > Set ' + label + ')')
          .setFontStyle('italic').setFontColor('#6b7280');
        // Verwijder ook de oude docprop-mirror (uit pre-refactor onEdit-sync).
        props.deleteProperty('intervals_api_key');
        props.deleteProperty('telegram_bot_token');
        props.deleteProperty('telegram_chat_id');
        // Herzet alleen de zojuist gemigreerde waarde.
        props.setProperty(key, legacy);
        return legacy;
      }
    }
  } catch (e) {
    // SpreadsheetApp niet beschikbaar (bv. trigger zonder UI) — val door naar throw.
    console.warn('Secret migration check failed for ' + key + ': ' + e.message);
  }

  throw new Error(label + ' niet ingesteld. Gebruik menu 🚴 Coach > Setup > Set ' + label + '.');
}

/** intervals.icu API key (Basic-auth password). */
function getIntervalsApiKey_() {
  return getSecret_(SECRET_KEYS.INTERVALS_API_KEY,
                    SECRET_LEGACY_CELLS.INTERVALS_API_KEY,
                    'intervals.icu API key');
}

/** Telegram bot-token (HTTPS bot API). */
function getTelegramBotToken_() {
  return getSecret_(SECRET_KEYS.TELEGRAM_BOT_TOKEN,
                    SECRET_LEGACY_CELLS.TELEGRAM_BOT_TOKEN,
                    'Telegram bot token');
}

/** Telegram chat-ID waar berichten naartoe gestuurd worden. */
function getTelegramChatId_() {
  return getSecret_(SECRET_KEYS.TELEGRAM_CHAT_ID,
                    SECRET_LEGACY_CELLS.TELEGRAM_CHAT_ID,
                    'Telegram chat ID');
}

/**
 * intervals.icu athlete ID. NIET een secret (gewoon "i12345"-publieke
 * identifier) — blijft in DocProp 'intervals_athlete_id' via Instellingen!B23
 * + onEdit-sync. Gooit error als leeg zodat de UI hem kan tonen.
 */
function getAthleteId_() {
  var v = getDocProp('intervals_athlete_id', '');
  if (!v) throw new Error('Athlete ID niet ingesteld in Instellingen (rij 23).');
  return String(v);
}

// ── Setup-menu handlers ───────────────────────────────────────────

/**
 * Toont een prompt voor een nieuwe waarde. NIET de oude/nieuwe waarde
 * teruggeven in een alert — ook niet gemaskeerd — om schoudersurf-risico
 * weg te halen. Trimt whitespace.
 */
function setSecret_(key, label) {
  var ui;
  try { ui = SpreadsheetApp.getUi(); } catch (e) {
    throw new Error('setSecret_ alleen via menu — UI niet beschikbaar.');
  }
  var resp = ui.prompt('Set ' + label,
                       'Plak de nieuwe waarde voor ' + label + '. Wordt opgeslagen in PropertiesService (per-document, niet in een cel).',
                       ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  var raw = String(resp.getResponseText() || '').trim();
  if (!raw) {
    ui.alert('Leeg — niets opgeslagen.');
    return;
  }
  PropertiesService.getDocumentProperties().setProperty(key, raw);
  ui.alert('✓ Opgeslagen', label + ' is opgeslagen in PropertiesService.', ui.ButtonSet.OK);
}

function setIntervalsApiKey()  { setSecret_(SECRET_KEYS.INTERVALS_API_KEY,  'intervals.icu API key'); }
function setTelegramBotToken() { setSecret_(SECRET_KEYS.TELEGRAM_BOT_TOKEN, 'Telegram bot token'); }
function setTelegramChatId()   { setSecret_(SECRET_KEYS.TELEGRAM_CHAT_ID,   'Telegram chat ID'); }

/**
 * Toont een alert met de status van alle opgeslagen secrets. De waarde
 * wordt gemaskeerd: '••••' + laatste 4 karakters. Voor lege waardes:
 * '(niet ingesteld)'.
 */
function viewStoredSecrets() {
  var ui;
  try { ui = SpreadsheetApp.getUi(); } catch (e) { return; }

  var props = PropertiesService.getDocumentProperties();
  var labels = [
    { key: SECRET_KEYS.INTERVALS_API_KEY,  label: 'intervals.icu API key' },
    { key: SECRET_KEYS.TELEGRAM_BOT_TOKEN, label: 'Telegram bot token'    },
    { key: SECRET_KEYS.TELEGRAM_CHAT_ID,   label: 'Telegram chat ID'      }
  ];

  var lines = labels.map(function (e) {
    var raw = props.getProperty(e.key) || '';
    var masked = raw
      ? ('•••• ' + raw.substring(Math.max(0, raw.length - 4)))
      : '(niet ingesteld)';
    return e.label + ': ' + masked;
  });

  ui.alert('Opgeslagen secrets', lines.join('\n'), ui.ButtonSet.OK);
}

/**
 * Wist de 3 secret-properties na YES/NO bevestiging.
 *
 * BEWUSTE AFWIJKING van prompt-spec: prompt zegt "deleteAllProperties op
 * DocumentProperties", maar dat zou ALLE app-state vernietigen (pattern,
 * weekplan_<maandag>, intent, FTP, zones, meso_week, etc.). Dat is
 * destructief en onomkeerbaar voor de coach-functionaliteit. We wissen
 * dus alleen de drie secret-keys + de legacy-mirrors uit de oude opslag.
 */
function clearAllSecrets() {
  var ui;
  try { ui = SpreadsheetApp.getUi(); } catch (e) { return; }

  var resp = ui.alert('Alle secrets wissen?',
                      'Dit verwijdert intervals.icu API key, Telegram bot token en Telegram chat ID uit PropertiesService.\n\n' +
                      'Andere app-state (FTP, zones, pattern, weekplan, intent) blijft staan.\n\n' +
                      'Doorgaan?',
                      ui.ButtonSet.YES_NO);
  if (resp !== ui.Button.YES) return;

  var props = PropertiesService.getDocumentProperties();
  Object.keys(SECRET_KEYS).forEach(function (k) {
    props.deleteProperty(SECRET_KEYS[k]);
  });
  // Ook de legacy-mirrors uit de pre-refactor opslag opruimen.
  props.deleteProperty('intervals_api_key');
  props.deleteProperty('telegram_bot_token');
  props.deleteProperty('telegram_chat_id');

  ui.alert('✓ Secrets gewist', 'Alle 3 secrets zijn verwijderd uit PropertiesService. App-state blijft intact.', ui.ButtonSet.OK);
}
