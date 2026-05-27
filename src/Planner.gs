/**
 * Planner.gs — Tab "Weekplanner".
 *
 * Invoer per dag (ma-zo) voor de huidige week: train? / minuten /
 * dagtype / toelichting + door generator gevuld voorgesteldType + gedaan?
 * Conditional formatting: rij grijs als gedaan = TRUE.
 */

var PLANNER_SHEET = 'Weekplanner';

var DAGEN_NL = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];

var DAGTYPE_OPTIONS = ['pendel', 'vrij', 'weekend', 'recovery'];

var PLANNER_DEFAULTS = {
  1: { train: true, min: 150, type: 'pendel',  note: 'Heen Z2 + terug intervallen' }, // dinsdag
  3: { train: true, min: 90,  type: 'vrij',    note: 'Vrije sessie' },                // donderdag
  5: { train: true, min: 120, type: 'weekend', note: 'Lange rit' }                    // zaterdag
};

var PLANNER_HEADERS = ['Train?', 'Dag', 'Datum', 'Minuten', 'Dagtype', 'Toelichting', 'Voorgesteld type', 'Gedaan?'];

function buildPlanner(ss) {
  var sh = getOrCreateSheet(ss, PLANNER_SHEET);

  // Title
  sh.getRange(1, 1, 1, PLANNER_HEADERS.length).merge()
    .setValue('📆  Weekplanner — invoer per dag')
    .setFontWeight('bold').setFontSize(13)
    .setBackground('#1f2937').setFontColor('#ffffff')
    .setHorizontalAlignment('left').setVerticalAlignment('middle');
  sh.setRowHeight(1, 28);

  // Headers
  sh.getRange(2, 1, 1, PLANNER_HEADERS.length).setValues([PLANNER_HEADERS])
    .setFontWeight('bold').setBackground('#e5e7eb')
    .setHorizontalAlignment('center');

  // Bereken maandag van deze week. JS getDay(): 0=zo, 1=ma, ..., 6=za.
  // Voor zondag → 6 dagen terug; voor andere dagen → (1 - dow) dagen schuiven.
  var today = new Date();
  var dow = today.getDay();
  var daysToMonday = (dow === 0) ? -6 : 1 - dow;
  var monday = new Date(today);
  monday.setDate(today.getDate() + daysToMonday);

  // 7 rijen
  for (var i = 0; i < 7; i++) {
    var r = 3 + i;
    var def = PLANNER_DEFAULTS[i] || { train: false, min: '', type: '', note: '' };
    var date = new Date(monday);
    date.setDate(monday.getDate() + i);

    sh.getRange(r, 1).insertCheckboxes();
    sh.getRange(r, 1).setValue(def.train);
    sh.getRange(r, 2).setValue(DAGEN_NL[i]).setFontWeight('bold');
    sh.getRange(r, 3).setValue(date).setNumberFormat('ddd dd-MM');
    sh.getRange(r, 4).setValue(def.min).setHorizontalAlignment('center');
    sh.getRange(r, 5).setValue(def.type);
    sh.getRange(r, 6).setValue(def.note).setWrap(true);
    sh.getRange(r, 7).setValue('').setFontStyle('italic').setFontColor('#6b7280');
    sh.getRange(r, 8).insertCheckboxes();
    sh.getRange(r, 8).setValue(false);
  }

  // Dagtype dropdown for D rows
  var dagtypeVal = SpreadsheetApp.newDataValidation()
    .requireValueInList(DAGTYPE_OPTIONS, true)
    .setAllowInvalid(false).build();
  sh.getRange(3, 5, 7, 1).setDataValidation(dagtypeVal);

  // Conditional formatting: rij grijs als kolom H = TRUE
  var rules = sh.getConditionalFormatRules();
  var bodyRange = sh.getRange('A3:H9');
  var rule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$H3=TRUE')
    .setBackground('#d1d5db')
    .setFontColor('#6b7280')
    .setRanges([bodyRange])
    .build();
  rules.push(rule);
  sh.setConditionalFormatRules(rules);

  SpreadsheetApp.flush();
  sh.setColumnWidth(1, 70);
  sh.setColumnWidth(2, 100);
  sh.setColumnWidth(3, 100);
  sh.setColumnWidth(4, 80);
  sh.setColumnWidth(5, 100);
  sh.setColumnWidth(6, 280);
  sh.setColumnWidth(7, 220);
  sh.setColumnWidth(8, 80);
  sh.setFrozenRows(2);
}

function readPlanner(ss) {
  var sh = ss.getSheetByName(PLANNER_SHEET);
  if (!sh) throw new Error('Tab "Weekplanner" bestaat niet — draai Bouw alles opnieuw.');
  var data = sh.getRange(3, 1, 7, 8).getValues();
  var rows = [];
  for (var i = 0; i < 7; i++) {
    var d = data[i];
    rows.push({
      dagIdx: i,
      dag: DAGEN_NL[i],
      train: d[0] === true,
      datum: d[2] instanceof Date ? d[2] : null,
      minuten: Number(d[3]) || 0,
      type: String(d[4] || ''),
      notitie: String(d[5] || ''),
      voorgesteldType: String(d[6] || ''),
      gedaan: d[7] === true
    });
  }
  return rows;
}

function writeVoorgesteldType(ss, days) {
  var sh = ss.getSheetByName(PLANNER_SHEET);
  if (!sh) return;
  for (var i = 0; i < days.length; i++) {
    sh.getRange(3 + i, 7).setValue(days[i].voorgesteldType || '');
  }
}
