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
    .setValue('📆  Weekplanner — invoer per dag (rolt automatisch naar deze week)')
    .setFontWeight('bold').setFontSize(13)
    .setBackground('#1f2937').setFontColor('#ffffff')
    .setHorizontalAlignment('left').setVerticalAlignment('middle');
  sh.setRowHeight(1, 28);

  // Headers
  sh.getRange(2, 1, 1, PLANNER_HEADERS.length).setValues([PLANNER_HEADERS])
    .setFontWeight('bold').setBackground('#e5e7eb')
    .setHorizontalAlignment('center');

  // Statische structuur: checkboxes + dagnamen (data komt uit materialize)
  for (var i = 0; i < 7; i++) {
    var r = 3 + i;
    sh.getRange(r, 1).insertCheckboxes();
    sh.getRange(r, 2).setValue(DAGEN_NL[i]).setFontWeight('bold');
    sh.getRange(r, 4).setHorizontalAlignment('center');
    sh.getRange(r, 6).setWrap(true);
    sh.getRange(r, 7).setFontStyle('italic').setFontColor('#6b7280');
    sh.getRange(r, 8).insertCheckboxes();
  }

  // Dagtype dropdown for E rows
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

  // Materialiseer de huidige week uit het patroon (non-destructive t.o.v. patroon).
  // Forceer omdat de tab net opnieuw is opgebouwd.
  var monday = weekStartDate(new Date());
  materializeWeek_(sh, monday);
  setDocProp('tab_week_start', formatDate(monday, 'yyyy-MM-dd'));

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

/**
 * Schrijft 7 dagen (datums + patroon-defaults) naar de Weekplanner-tab
 * voor de week beginnend op `monday`. Reset Voorgesteld type + Gedaan?.
 * Vereist dat checkboxes (kol A/H) al bestaan.
 */
function materializeWeek_(sh, monday) {
  var pattern = getPattern();
  for (var i = 0; i < 7; i++) {
    var r = 3 + i;
    var p = pattern[i] || { train: false, minuten: 0, dagtype: '', note: '' };
    var date = new Date(monday);
    date.setDate(monday.getDate() + i);

    sh.getRange(r, 1).setValue(!!p.train);
    sh.getRange(r, 2).setValue(DAGEN_NL[i]).setFontWeight('bold');
    sh.getRange(r, 3).setValue(date).setNumberFormat('ddd dd-MM');
    sh.getRange(r, 4).setValue(p.minuten || '');
    sh.getRange(r, 5).setValue(p.dagtype || '');
    sh.getRange(r, 6).setValue(p.note || '');
    sh.getRange(r, 7).setValue('');      // voorgesteld type leeg
    sh.getRange(r, 8).setValue(false);   // gedaan leeg
  }
}

/**
 * LAAG 2 — week-state guard. Rolt de Weekplanner automatisch naar de
 * huidige kalenderweek wanneer tab_week_start verouderd/leeg is.
 * Actueel → niks doen (behoud gebruikers-edits van deze week).
 */
function ensureCurrentWeek(ss) {
  var sh = ss.getSheetByName(PLANNER_SHEET);
  if (!sh) return;
  var monday = weekStartDate(new Date());
  var mondayStr = formatDate(monday, 'yyyy-MM-dd');
  var stored = getDocProp('tab_week_start', '');
  if (stored === mondayStr) return; // tab is actueel

  // ROLLOVER: materialiseer nieuwe week uit patroon
  materializeWeek_(sh, monday);
  setDocProp('tab_week_start', mondayStr);
  try { ss.toast('Weekplanner gerold naar nieuwe week (' + mondayStr + ')', '🚴 Coach', 5); } catch (e) {}
}

/**
 * Menu-actie: promoveer de huidige Weekplanner tot standaardpatroon.
 */
function savePatternFromTab() {
  var ss = SpreadsheetApp.getActive();
  var days = readPlanner(ss);
  var pattern = days.map(function (d) {
    return { dag: d.dag, train: !!d.train, minuten: d.minuten || 0, dagtype: d.type || '', note: d.notitie || '' };
  });
  savePattern(pattern);
  var ui;
  try { ui = SpreadsheetApp.getUi(); } catch (e) {}
  if (ui) ui.alert('Patroon bijgewerkt', 'Dit is voortaan je standaardweek. Losse afwijkingen rollen vanzelf weg bij de volgende week.', ui.ButtonSet.OK);
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
