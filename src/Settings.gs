/**
 * Settings.gs — Tab "Instellingen".
 *
 * Bouwt het Instellingen-tabblad (atleet baseline + doel + seizoen-modus
 * + intervals.icu placeholders + status). readSettings(ss) leest alles
 * terug. computeMacroPhase(start, today) berekent macrocyclus week/fase.
 */

var SETTINGS_SHEET = 'Instellingen';

var SETTINGS_FIELDS = {
  FTP:        { row: 3,  label: 'FTP (W)',                 def: 280,    unit: 'W',           kind: 'num'  },
  HR_MAX:     { row: 4,  label: 'HR max',                  def: 198,    unit: 'bpm',         kind: 'num'  },
  HR_RUST:    { row: 5,  label: 'HR rust',                 def: 51,     unit: 'bpm',         kind: 'num'  },
  LTHR:       { row: 6,  label: 'LTHR',                    def: 178,    unit: 'bpm',         kind: 'num'  },
  LOOP_PACE:  { row: 7,  label: 'Loop drempel pace',       def: '4:27', unit: 'min:sec/km',  kind: 'str'  },
  DOEL:       { row: 11, label: 'Primair doel',            def: 'FTP',  unit: '',            kind: 'str'  },
  DOEL_START: { row: 12, label: 'Startdatum doel',         def: null,   unit: '',            kind: 'date' },
  DOEL_DUUR:  { row: 13, label: 'Duur (weken)',            def: 12,     unit: 'weken',       kind: 'num'  },
  FASE:       { row: 17, label: 'Fase',                    def: 'build',unit: '',            kind: 'str'  },
  ATHLETE_ID: { row: 21, label: 'Athlete ID',              def: '',     unit: '',            kind: 'str'  },
  API_KEY:    { row: 22, label: 'API Key',                 def: '',     unit: '',            kind: 'str'  },
  EMAIL:      { row: 26, label: 'Email digest naar',       def: '',     unit: '',            kind: 'str'  },
  MESO_WEEK:  { row: 30, label: 'Huidige meso-week (1-4)', def: 1,      unit: '',            kind: 'num'  },
  MACRO_FASE: { row: 31, label: 'Huidige macro-fase',      def: 'Base', unit: '',            kind: 'str'  }
};

var DOEL_OPTIONS = ['FTP', 'Conditie', 'Beklimmingen', 'VO2max'];
var FASE_OPTIONS = ['build', 'maintain'];

function buildSettings(ss) {
  var sh = getOrCreateSheet(ss, SETTINGS_SHEET);
  sh.setHiddenGridlines(false);

  var sections = [
    { row: 1,  title: '⚙️  Atleet baseline' },
    { row: 9,  title: '🎯  Doel' },
    { row: 15, title: '📅  Seizoen-modus' },
    { row: 19, title: '🔌  intervals.icu (komt in volgende stap)' },
    { row: 24, title: '✉️  Notificaties (komt in volgende stap)' },
    { row: 28, title: '📊  Status (auto — niet bewerken)' }
  ];

  sections.forEach(function (s) {
    sh.getRange(s.row, 1, 1, 4).merge()
      .setValue(s.title)
      .setFontWeight('bold')
      .setBackground('#1f2937')
      .setFontColor('#ffffff')
      .setHorizontalAlignment('left')
      .setVerticalAlignment('middle');
    sh.setRowHeight(s.row, 26);
  });

  // Write all field rows
  Object.keys(SETTINGS_FIELDS).forEach(function (key) {
    var f = SETTINGS_FIELDS[key];
    sh.getRange(f.row, 1).setValue(f.label).setFontWeight('bold');
    var val = f.def;
    if (key === 'DOEL_START') val = new Date();
    if (key === 'MESO_WEEK') val = getMesoWeek();
    if (key === 'MACRO_FASE') {
      // computed via formula referencing start + today
      sh.getRange(f.row, 2).setFormula('=B31');
      // we will overwrite with explicit value after computing
    }
    if (val !== null && val !== undefined) {
      sh.getRange(f.row, 2).setValue(val);
    }
    if (f.unit) sh.getRange(f.row, 3).setValue(f.unit).setFontColor('#6b7280');
  });

  // Date formatting for startdatum
  sh.getRange(SETTINGS_FIELDS.DOEL_START.row, 2).setNumberFormat('dd-MM-yyyy');

  // Doel dropdown
  var doelVal = SpreadsheetApp.newDataValidation()
    .requireValueInList(DOEL_OPTIONS, true)
    .setAllowInvalid(false).build();
  sh.getRange(SETTINGS_FIELDS.DOEL.row, 2).setDataValidation(doelVal);

  // Fase dropdown
  var faseVal = SpreadsheetApp.newDataValidation()
    .requireValueInList(FASE_OPTIONS, true)
    .setAllowInvalid(false).build();
  sh.getRange(SETTINGS_FIELDS.FASE.row, 2).setDataValidation(faseVal);

  // Compute macro fase now and write back as plain value
  var startCell = sh.getRange(SETTINGS_FIELDS.DOEL_START.row, 2).getValue();
  var startDate = startCell instanceof Date ? startCell : new Date();
  var macro = computeMacroPhase(startDate, new Date());
  sh.getRange(SETTINGS_FIELDS.MACRO_FASE.row, 2).setValue(macro.fase + ' (week ' + macro.week + ')');
  sh.getRange(SETTINGS_FIELDS.MACRO_FASE.row, 2).setFontStyle('italic').setFontColor('#374151');
  sh.getRange(SETTINGS_FIELDS.MESO_WEEK.row, 2).setFontStyle('italic').setFontColor('#374151');

  // Column widths (after writes)
  SpreadsheetApp.flush();
  sh.setColumnWidth(1, 240);
  sh.setColumnWidth(2, 180);
  sh.setColumnWidth(3, 130);
  sh.setColumnWidth(4, 280);

  sh.setFrozenRows(1);
}

function readSettings(ss) {
  var sh = ss.getSheetByName(SETTINGS_SHEET);
  if (!sh) throw new Error('Tab "Instellingen" bestaat nog niet — draai eerst Bouw alles opnieuw.');
  function v(key) { return sh.getRange(SETTINGS_FIELDS[key].row, 2).getValue(); }

  var startRaw = v('DOEL_START');
  var startDate = startRaw instanceof Date ? startRaw : new Date(startRaw || new Date());

  return {
    ftp:        Number(v('FTP'))    || 280,
    hrMax:      Number(v('HR_MAX')) || 198,
    hrRust:     Number(v('HR_RUST'))|| 51,
    lthr:       Number(v('LTHR'))   || 178,
    loopPace:   String(v('LOOP_PACE') || '4:27'),
    doel:       String(v('DOEL')    || 'FTP'),
    doelStart:  startDate,
    doelDuur:   Number(v('DOEL_DUUR')) || 12,
    fase:       String(v('FASE')    || 'build'),
    athleteId:  String(v('ATHLETE_ID') || ''),
    apiKey:     String(v('API_KEY')    || ''),
    email:      String(v('EMAIL')      || '')
  };
}

/**
 * Macrocyclus schema: weken 1-4 Base, 5-8 Build, 9-11 Peak, 12 Test.
 * Voorbij week 12 → blijven op Test.
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
