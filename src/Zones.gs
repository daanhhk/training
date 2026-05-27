/**
 * Zones.gs — Tab "Zones".
 *
 * Toont power-zones (Coggan 7-zones) en HR-zones (Friel) als
 * auto-berekende tabellen met formules die naar Instellingen verwijzen.
 * Formules zijn in pure US-notatie ('.' decimaal, ',' separator);
 * Apps Script setFormula() converteert automatisch naar NL bij render.
 */

var ZONES_SHEET = 'Zones';

function buildZones(ss) {
  var sh = getOrCreateSheet(ss, ZONES_SHEET);

  // FTP-referentie cel adres
  var ftpRef  = SETTINGS_SHEET + '!B' + SETTINGS_FIELDS.FTP.row;
  var lthrRef = SETTINGS_SHEET + '!B' + SETTINGS_FIELDS.LTHR.row;
  var hrMaxRef = SETTINGS_SHEET + '!B' + SETTINGS_FIELDS.HR_MAX.row;

  // ── POWER ZONES (Coggan 7-zones) ──
  sh.getRange(1, 1, 1, 6).merge()
    .setValue('⚡  Power zones (Coggan, % van FTP)')
    .setFontWeight('bold').setBackground('#1f2937').setFontColor('#ffffff')
    .setHorizontalAlignment('left');

  sh.getRange(2, 1, 1, 6).setValues([
    ['Zone', 'Naam', '% min', '% max', 'Watt min', 'Watt max']
  ]).setFontWeight('bold').setBackground('#e5e7eb');

  var powerZones = [
    ['Z1',  'Active Recovery', 0,   55,  '#cbd5e1'],
    ['Z2',  'Endurance',       56,  75,  '#93c5fd'],
    ['Z3',  'Tempo',           76,  87,  '#86efac'],
    ['Z4',  'Sweet Spot',      88,  94,  '#fde68a'],
    ['Z4+', 'Threshold',       95,  105, '#fdba74'],
    ['Z5',  'VO2max',          106, 120, '#fca5a5'],
    ['Z6',  'Anaerobic',       121, 150, '#f472b6'],
    ['Z7',  'Neuromuscular',   151, 250, '#a78bfa']
  ];

  powerZones.forEach(function (z, i) {
    var r = 3 + i;
    sh.getRange(r, 1).setValue(z[0]).setFontWeight('bold');
    sh.getRange(r, 2).setValue(z[1]);
    sh.getRange(r, 3).setValue(z[2] + '%');
    sh.getRange(r, 4).setValue(z[3] + '%');
    sh.getRange(r, 5).setFormula(dutchFormula('=ROUND(' + ftpRef + '*' + (z[2] / 100) + ',0)'));
    sh.getRange(r, 6).setFormula(dutchFormula('=ROUND(' + ftpRef + '*' + (z[3] / 100) + ',0)'));
    sh.getRange(r, 1, 1, 6).setBackground(z[4]);
  });

  // ── HR ZONES (Friel, % LTHR) ──
  var hrStart = 3 + powerZones.length + 2;
  sh.getRange(hrStart, 1, 1, 6).merge()
    .setValue('❤️  HR zones (Friel, % van LTHR)')
    .setFontWeight('bold').setBackground('#1f2937').setFontColor('#ffffff')
    .setHorizontalAlignment('left');

  sh.getRange(hrStart + 1, 1, 1, 6).setValues([
    ['Zone', 'Naam', '% min', '% max', 'BPM min', 'BPM max']
  ]).setFontWeight('bold').setBackground('#e5e7eb');

  var hrZones = [
    ['Z1',  'Recovery',   0,   84,  '#cbd5e1'],
    ['Z2',  'Aerobic',    85,  89,  '#93c5fd'],
    ['Z3',  'Tempo',      90,  94,  '#86efac'],
    ['Z4',  'Threshold',  95,  99,  '#fde68a'],
    ['Z5a', 'VO2 onder',  100, 102, '#fdba74'],
    ['Z5b', 'VO2 boven',  103, 106, '#fca5a5'],
    ['Z5c', 'Anaerobic',  107, 130, '#f472b6']
  ];

  hrZones.forEach(function (z, i) {
    var r = hrStart + 2 + i;
    sh.getRange(r, 1).setValue(z[0]).setFontWeight('bold');
    sh.getRange(r, 2).setValue(z[1]);
    sh.getRange(r, 3).setValue(z[2] + '%');
    sh.getRange(r, 4).setValue(z[3] + '%');
    sh.getRange(r, 5).setFormula(dutchFormula('=ROUND(' + lthrRef + '*' + (z[2] / 100) + ',0)'));
    sh.getRange(r, 6).setFormula(dutchFormula('=ROUND(' + lthrRef + '*' + (z[3] / 100) + ',0)'));
    sh.getRange(r, 1, 1, 6).setBackground(z[4]);
  });

  // HR max referentie onderaan
  var refRow = hrStart + 2 + hrZones.length + 2;
  sh.getRange(refRow, 1).setValue('Referentie HR max:').setFontWeight('bold');
  sh.getRange(refRow, 2).setFormula('=' + hrMaxRef);
  sh.getRange(refRow, 3).setValue('bpm').setFontColor('#6b7280');
  sh.getRange(refRow + 1, 1).setValue('Referentie LTHR:').setFontWeight('bold');
  sh.getRange(refRow + 1, 2).setFormula('=' + lthrRef);
  sh.getRange(refRow + 1, 3).setValue('bpm').setFontColor('#6b7280');
  sh.getRange(refRow + 2, 1).setValue('Referentie FTP:').setFontWeight('bold');
  sh.getRange(refRow + 2, 2).setFormula('=' + ftpRef);
  sh.getRange(refRow + 2, 3).setValue('W').setFontColor('#6b7280');

  SpreadsheetApp.flush();
  sh.setColumnWidth(1, 70);
  sh.setColumnWidth(2, 170);
  sh.setColumnWidth(3, 80);
  sh.setColumnWidth(4, 80);
  sh.setColumnWidth(5, 100);
  sh.setColumnWidth(6, 100);
  sh.setFrozenRows(2);
}
