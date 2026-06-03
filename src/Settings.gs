/**
 * Settings.gs — Tab "Instellingen".
 *
 * Bouwt het Instellingen-tabblad. Waardes worden persistent opgeslagen
 * in DocumentProperties zodat buildAll() ze niet wist. onEdit (in
 * Code.gs) synct cell-edits terug naar properties.
 *
 * SETTINGS_ROW_TO_KEY = mapping rij → property-key (gebruikt door
 * onEdit en readSettings).
 */

var SETTINGS_SHEET = 'Instellingen';

var SETTINGS_FIELDS = {
  FTP:        { row: 3,  label: 'FTP (W)',                 unit: 'W'                  },
  HR_MAX:     { row: 4,  label: 'HR max',                  unit: 'bpm'                },
  HR_RUST:    { row: 5,  label: 'HR rust',                 unit: 'bpm'                },
  LTHR:       { row: 6,  label: 'LTHR',                    unit: 'bpm'                },
  LOOP_PACE:  { row: 7,  label: 'Loop drempel pace',       unit: 'min:sec/km'         },
  DOEL:       { row: 11, label: 'Primair doel',            unit: ''                   },
  DOEL_START: { row: 12, label: 'Startdatum doel',         unit: ''                   },
  DOEL_DUUR:  { row: 13, label: 'Duur (weken)',            unit: 'weken'              },
  FASE:       { row: 19, label: 'Fase',                    unit: ''                   },
  ATHLETE_ID: { row: 23, label: 'Athlete ID',              unit: ''                   },
  API_KEY:    { row: 24, label: 'API Key',                 unit: ''                   },
  BOT_TOKEN:  { row: 28, label: 'Telegram bot token',      unit: ''                   },
  CHAT_ID:    { row: 29, label: 'Telegram chat ID',        unit: ''                   },
  EMAIL:      { row: 33, label: 'Email digest naar',       unit: ''                   },
  MESO_WEEK:  { row: 37, label: 'Huidige meso-week (1-4)', unit: ''                   },
  MACRO_FASE: { row: 38, label: 'Huidige macro-fase',      unit: ''                   },
  // ── Scope-B uitbreidingen (rij 40+; bestaande rijen ongewijzigd) ──
  GEWICHT:           { row: 42, label: 'Gewicht',              unit: 'kg' },
  PROFIEL_PRESET:    { row: 43, label: 'Profiel-preset',       unit: ''   },
  FTP_AUTO:          { row: 47, label: 'FTP auto-update',      unit: ''   },
  WEIGHT_AUTO:       { row: 48, label: 'Gewicht auto-update',  unit: ''   },
  FTP_LAST_SYNC:     { row: 49, label: 'FTP laatst gesynct',   unit: ''   },
  WEIGHT_LAST_SYNC:  { row: 50, label: 'Gewicht laatst gesynct', unit: '' },
  // ── v2b-B multi-session (pendel) ──
  PENDEL_DUUR:       { row: 52, label: 'Pendel duur per rit',   unit: 'min' },
  PENDEL_AANTAL:     { row: 53, label: 'Pendel ritten per dag', unit: ''    }
};

/** Rij → docprop key. Alleen velden die de gebruiker kan bewerken.
 *  NB: secret-velden (API key / Telegram bot token / Telegram chat ID)
 *  staan hier bewust NIET in — die wonen in PropertiesService via Secrets.gs
 *  en het Coach > Setup menu. Rij 24/28/29 tonen alleen instructie-tekst. */
var SETTINGS_ROW_TO_KEY = {
  3:  'ftp',
  4:  'hr_max',
  5:  'hr_rest',
  6:  'lthr',
  7:  'threshold_pace',
  11: 'doel',
  12: 'doel_start',
  13: 'doel_duur',
  19: 'fase',
  23: 'intervals_athlete_id',  // niet-secret, blijft normale cel
  33: 'email_digest',
  // Scope-B (read-write velden; last-sync rijen blijven uit deze map)
  42: 'gewicht',
  43: 'profiel_preset',
  47: 'ftp_auto_update',
  48: 'weight_auto_update',
  // v2b-B multi-session (pendel)
  52: 'pendelDuurMin',
  53: 'pendelAantal'
};

/** Harde defaults, gebruikt als prop niet ingesteld is. */
var SETTINGS_DEFAULTS = {
  ftp:                  280,
  hr_max:               198,
  hr_rest:              51,
  lthr:                 178,
  threshold_pace:       '4:27',
  doel:                 'FTP',
  doel_start:           null,   // → today bij eerste build
  doel_duur:            12,
  fase:                 'build',
  intervals_athlete_id: '',
  // intervals_api_key / telegram_bot_token / telegram_chat_id zitten in
  // PropertiesService (Secrets.gs), niet meer in deze defaults-map.
  email_digest:         '',
  // Scope-B (defaults reproduceren huidige gedrag exact)
  gewicht:              75,
  profiel_preset:       'Gevorderd 7u',
  ftp_auto_update:      false,
  weight_auto_update:   false,
  ftp_last_sync:        '',
  weight_last_sync:     '',
  // v2b-B multi-session (pendel)
  pendelDuurMin:        80,
  pendelAantal:         2
};

var DOEL_OPTIONS = ['FTP', 'Conditie', 'Beklimmingen', 'VO2max'];
var FASE_OPTIONS = ['build', 'maintain'];
var PROFIEL_PRESET_OPTIONS = ['Amateur 3u', 'Gemiddeld 5u', 'Gevorderd 7u', 'Pro 10u+', 'Custom'];

var SETTINGS_SECTIONS = [
  { row: 1,  title: '⚙️  Atleet baseline' },
  { row: 9,  title: '🎯  Doel' },
  { row: 17, title: '📅  Seizoen-modus' },
  { row: 21, title: '🔌  intervals.icu (vul in voor sync)' },
  { row: 26, title: '🤖  Telegram bot (placeholder)' },
  { row: 31, title: '✉️  Notificaties' },
  { row: 35, title: '📊  Status (auto — niet bewerken)' },
  { row: 40, title: '👤  Profiel' },
  { row: 45, title: '📡  Auto-sync vanuit intervals.icu' },
  { row: 51, title: '🚲  Pendel (multi-session)' }
];

/** Numerieke + datum + bool velden (kind hint voor parsen). */
var SETTINGS_KIND = {
  ftp: 'num', hr_max: 'num', hr_rest: 'num', lthr: 'num', doel_duur: 'num',
  gewicht: 'num', pendelDuurMin: 'num', pendelAantal: 'num',
  doel_start: 'date', ftp_last_sync: 'date', weight_last_sync: 'date',
  ftp_auto_update: 'bool', weight_auto_update: 'bool'
};

function buildSettings(ss) {
  var sh = getOrCreateSheet(ss, SETTINGS_SHEET);
  sh.setHiddenGridlines(false);

  // Section headers
  SETTINGS_SECTIONS.forEach(function (s) {
    sh.getRange(s.row, 1, 1, 4).merge()
      .setValue(s.title)
      .setFontWeight('bold')
      .setBackground('#1f2937').setFontColor('#ffffff')
      .setHorizontalAlignment('left').setVerticalAlignment('middle');
    sh.setRowHeight(s.row, 26);
  });

  // Editable fields — write label + persisted value + unit
  Object.keys(SETTINGS_ROW_TO_KEY).forEach(function (rowStr) {
    var row = parseInt(rowStr, 10);
    var key = SETTINGS_ROW_TO_KEY[row];
    var field = findFieldByRow(row);
    if (!field) return;

    sh.getRange(row, 1).setValue(field.label).setFontWeight('bold');

    if (SETTINGS_KIND[key] === 'bool') {
      sh.getRange(row, 2).insertCheckboxes();
      sh.getRange(row, 2).setValue(loadSettingValue(key) === true);
    } else {
      var val = loadSettingValue(key);
      if (val !== null && val !== undefined && val !== '') {
        sh.getRange(row, 2).setValue(val);
      }
    }
    if (SETTINGS_KIND[key] === 'date') {
      sh.getRange(row, 2).setNumberFormat('dd-MM-yyyy');
    }
    if (field.unit) {
      sh.getRange(row, 3).setValue(field.unit).setFontColor('#6b7280');
    }
  });

  // Secret-velden: NIET als invoer-cel, maar als label + instructie-tekst
  // die naar het Setup-menu wijst. De waardes wonen in PropertiesService.
  [
    { field: SETTINGS_FIELDS.API_KEY,   setupLabel: 'intervals.icu API key' },
    { field: SETTINGS_FIELDS.BOT_TOKEN, setupLabel: 'Telegram bot token'    },
    { field: SETTINGS_FIELDS.CHAT_ID,   setupLabel: 'Telegram chat ID'      }
  ].forEach(function (e) {
    sh.getRange(e.field.row, 1).setValue(e.field.label).setFontWeight('bold');
    sh.getRange(e.field.row, 2)
      .clearContent()
      .setValue('(via Coach > Setup > Set ' + e.setupLabel + ')')
      .setFontStyle('italic').setFontColor('#6b7280');
    sh.getRange(e.field.row, 2).clearDataValidations();
  });

  // Dropdowns
  sh.getRange(SETTINGS_FIELDS.DOEL.row, 2).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(DOEL_OPTIONS, true).setAllowInvalid(false).build()
  );
  sh.getRange(SETTINGS_FIELDS.FASE.row, 2).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(FASE_OPTIONS, true).setAllowInvalid(false).build()
  );
  sh.getRange(SETTINGS_FIELDS.PROFIEL_PRESET.row, 2).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(PROFIEL_PRESET_OPTIONS, true).setAllowInvalid(false).build()
  );

  // Read-only last-sync rijen (worden door syncAthleteFromIcu beschreven)
  [
    { field: SETTINGS_FIELDS.FTP_LAST_SYNC,    key: 'ftp_last_sync' },
    { field: SETTINGS_FIELDS.WEIGHT_LAST_SYNC, key: 'weight_last_sync' }
  ].forEach(function (e) {
    sh.getRange(e.field.row, 1).setValue(e.field.label + ':').setFontWeight('bold');
    var raw = getDocProp(e.key, '');
    if (raw) {
      var d = new Date(raw);
      if (!isNaN(d.getTime())) {
        sh.getRange(e.field.row, 2).setValue(d).setNumberFormat('dd-MM-yyyy HH:mm');
      }
    }
    sh.getRange(e.field.row, 2).setFontStyle('italic').setFontColor('#6b7280');
  });

  // Status (auto) — meso week + macro fase
  sh.getRange(SETTINGS_FIELDS.MESO_WEEK.row, 1).setValue(SETTINGS_FIELDS.MESO_WEEK.label).setFontWeight('bold');
  sh.getRange(SETTINGS_FIELDS.MESO_WEEK.row, 2).setValue(getMesoWeek())
    .setFontStyle('italic').setFontColor('#374151');

  var startCell = sh.getRange(SETTINGS_FIELDS.DOEL_START.row, 2).getValue();
  var startDate = startCell instanceof Date ? startCell : new Date();
  var macro = computeMacroPhase(startDate, new Date());
  sh.getRange(SETTINGS_FIELDS.MACRO_FASE.row, 1).setValue(SETTINGS_FIELDS.MACRO_FASE.label).setFontWeight('bold');
  sh.getRange(SETTINGS_FIELDS.MACRO_FASE.row, 2)
    .setValue(macro.fase + ' (week ' + macro.week + ')')
    .setFontStyle('italic').setFontColor('#374151');

  // Last sync info
  var lastSync = getDocProp('last_sync', '');
  if (lastSync) {
    sh.getRange(SETTINGS_FIELDS.MACRO_FASE.row + 1, 1).setValue('Laatste sync:').setFontWeight('bold');
    sh.getRange(SETTINGS_FIELDS.MACRO_FASE.row + 1, 2)
      .setValue(lastSync)
      .setFontStyle('italic').setFontColor('#6b7280');
  }

  SpreadsheetApp.flush();
  sh.setColumnWidth(1, 240);
  sh.setColumnWidth(2, 220);
  sh.setColumnWidth(3, 130);
  sh.setColumnWidth(4, 280);
  sh.setFrozenRows(1);
}

function findFieldByRow(row) {
  var keys = Object.keys(SETTINGS_FIELDS);
  for (var i = 0; i < keys.length; i++) {
    if (SETTINGS_FIELDS[keys[i]].row === row) return SETTINGS_FIELDS[keys[i]];
  }
  return null;
}

/**
 * Laad een setting-waarde: prop value indien gezet, anders default.
 * Voor 'doel_start' returnt het een Date object (today als default).
 * Voor numerieke velden returnt het een Number.
 */
function loadSettingValue(key) {
  var raw = PropertiesService.getDocumentProperties().getProperty(key);
  var hasProp = raw !== null && raw !== '';
  var kind = SETTINGS_KIND[key];

  if (!hasProp) {
    if (key === 'doel_start') return new Date();
    return SETTINGS_DEFAULTS[key];
  }
  if (kind === 'num')  return Number(raw);
  if (kind === 'date') return new Date(raw);
  if (kind === 'bool') return raw === 'true' || raw === true;
  return raw;
}

function readSettings(ss) {
  var sh = ss.getSheetByName(SETTINGS_SHEET);
  if (!sh) throw new Error('Tab "Instellingen" bestaat nog niet — draai eerst Bouw alles opnieuw.');
  function v(key) { return sh.getRange(SETTINGS_FIELDS[key].row, 2).getValue(); }

  var startRaw = v('DOEL_START');
  var startDate = startRaw instanceof Date ? startRaw : new Date(startRaw || new Date());

  return {
    ftp:        Number(v('FTP'))    || SETTINGS_DEFAULTS.ftp,
    hrMax:      Number(v('HR_MAX')) || SETTINGS_DEFAULTS.hr_max,
    hrRust:     Number(v('HR_RUST'))|| SETTINGS_DEFAULTS.hr_rest,
    lthr:       Number(v('LTHR'))   || SETTINGS_DEFAULTS.lthr,
    loopPace:   String(v('LOOP_PACE') || SETTINGS_DEFAULTS.threshold_pace),
    doel:       String(v('DOEL')    || SETTINGS_DEFAULTS.doel),
    doelStart:  startDate,
    doelDuur:   Number(v('DOEL_DUUR')) || SETTINGS_DEFAULTS.doel_duur,
    fase:       String(v('FASE')    || SETTINGS_DEFAULTS.fase),
    athleteId:  String(v('ATHLETE_ID') || ''),
    // apiKey / botToken / chatId zijn secrets — niet uit cellen lezen.
    // Roep getIntervalsApiKey_() / getTelegramBotToken_() / getTelegramChatId_()
    // rechtstreeks aan vanuit code dat ze nodig heeft.
    email:      String(v('EMAIL')      || ''),
    pendelDuurMin: Number(v('PENDEL_DUUR'))   || SETTINGS_DEFAULTS.pendelDuurMin,
    pendelAantal:  Number(v('PENDEL_AANTAL')) || SETTINGS_DEFAULTS.pendelAantal
  };
}

/**
 * Macrocyclus schema: weken 1-4 Base, 5-8 Build, 9-11 Peak, 12 Test.
 * Voorbij week 12 → blijft op Test.
 */
function computeMacroPhase(startDate, today) {
  if (!startDate) startDate = new Date();
  if (!today)     today     = new Date();
  var start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  var now   = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  var diffDays = Math.floor((now - start) / (1000 * 60 * 60 * 24));
  var week = Math.floor(diffDays / 7) + 1;
  if (week < 1) week = 1;

  var fase, isTestWeek = false;
  if (week <= 4)       fase = 'Base';
  else if (week <= 8)  fase = 'Build';
  else if (week <= 11) fase = 'Peak';
  else { fase = 'Test'; isTestWeek = true; }
  if (week > 12) week = 12;
  return { week: week, fase: fase, isTestWeek: isTestWeek };
}

// ── Scope-B getters/setters ───────────────────────────────────────

function getGewicht()           { return Number(loadSettingValue('gewicht')) || SETTINGS_DEFAULTS.gewicht; }
function getProfielPreset()     { return String(loadSettingValue('profiel_preset') || SETTINGS_DEFAULTS.profiel_preset); }
function getFtpAutoUpdate()     { return loadSettingValue('ftp_auto_update') === true; }
function getWeightAutoUpdate()  { return loadSettingValue('weight_auto_update') === true; }

// Secret-getters (getIntervalsApiKey_ / getTelegramBotToken_ /
// getTelegramChatId_) staan in Secrets.gs. Niet hier importeren —
// Apps Script .gs files delen één global scope.

/**
 * Schrijft een waarde naar zowel DocProp als de Settings-tab cel.
 * Voor numerieke/datum velden gebruikt in autocast.
 */
function _writeSettingCell_(key, fieldName, value, dateFormat) {
  setDocProp(key, value instanceof Date ? value.toISOString() : value);
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(SETTINGS_SHEET);
  if (!sh) return;
  var f = SETTINGS_FIELDS[fieldName];
  if (!f) return;
  var cell = sh.getRange(f.row, 2);
  cell.setValue(value);
  if (dateFormat) cell.setNumberFormat(dateFormat);
}

function setFtp(n)              { _writeSettingCell_('ftp', 'FTP', Number(n)); }
function setGewicht(n)          { _writeSettingCell_('gewicht', 'GEWICHT', Number(n)); }
function setFtpLastSync(d)      { _writeSettingCell_('ftp_last_sync', 'FTP_LAST_SYNC', d, 'dd-MM-yyyy HH:mm'); }
function setWeightLastSync(d)   { _writeSettingCell_('weight_last_sync', 'WEIGHT_LAST_SYNC', d, 'dd-MM-yyyy HH:mm'); }
