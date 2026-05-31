/**
 * Planner.gs — Tab "Weekplanner" + "Weekplanner +1".
 *
 * Twee identieke tabs. "Weekplanner" toont de huidige week (monday → zondag).
 * "Weekplanner +1" toont de week erna (monday+7 → zondag+13), zodat Daan
 * zondag-avond al beschikbaarheid voor de week erna kan invullen zonder
 * op maandag-rollover te wachten.
 *
 * Rollover op maandag (in ensureCurrentWeek): als +1 user-data heeft,
 * wordt die naar Weekplanner gekopieerd; daarna materialiseert
 * ensureCurrentWeekPlus1 een verse +1 voor week +2. Manual fallback via
 * Coach-menu item "📋 Rol Weekplanner +1 naar huidig".
 *
 * Invoer per dag (ma-zo): train? / minuten / dagtype / toelichting + door
 * generator gevuld voorgesteldType + gedaan?. Conditional formatting: rij
 * grijs als gedaan = TRUE.
 */

var PLANNER_SHEET           = 'Weekplanner';
var WEEKPLANNER_PLUS1_SHEET = 'Weekplanner +1';

/** DocProp-keys voor de twee tab_week_start mirrors. */
var TAB_WEEK_KEY        = 'tab_week_start';
var TAB_WEEK_PLUS1_KEY  = 'tab_week_plus1_start';

var DAGEN_NL = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];

var DAGTYPE_OPTIONS = ['pendel', 'vrij', 'weekend', 'recovery'];

var PLANNER_DEFAULTS = {
  1: { train: true, min: 150, type: 'pendel',  note: 'Heen Z2 + terug intervallen' }, // dinsdag
  3: { train: true, min: 90,  type: 'vrij',    note: 'Vrije sessie' },                // donderdag
  5: { train: true, min: 120, type: 'weekend', note: 'Lange rit' }                    // zaterdag
};

var PLANNER_HEADERS = ['Train?', 'Dag', 'Datum', 'Minuten', 'Dagtype', 'Toelichting', 'Voorgesteld type', 'Gedaan?'];

// ── Public build entries ─────────────────────────────────────────

function buildPlanner(ss) {
  var sh = _buildPlannerLike_(ss, PLANNER_SHEET,
    '📆  Weekplanner — invoer per dag (rolt automatisch naar deze week)');
  // Vangnet: materializeWeek_ wordt door ensureCurrentWeek aangeroepen als
  // de tab leeg is — bv. allereerste build, of als savedRows null was.
  ensureCurrentWeek(ss);
  SpreadsheetApp.flush();
  _setPlannerColumnWidths_(sh);
  sh.setFrozenRows(2);
}

function buildPlannerPlus1(ss) {
  var sh = _buildPlannerLike_(ss, WEEKPLANNER_PLUS1_SHEET,
    '📅  Weekplanner +1 — beschikbaarheid volgende week');
  ensureCurrentWeekPlus1(ss);
  SpreadsheetApp.flush();
  _setPlannerColumnWidths_(sh);
  sh.setFrozenRows(2);
}

// ── Shared structure helper ──────────────────────────────────────

/**
 * Bouwt de visuele structuur van een planner-tab (titel, headers, checkboxes,
 * dropdown, conditional formatting) met save→clear→restore van bestaande
 * rij-data. Idempotent: een rebuild herstelt user-edits exact.
 */
function _buildPlannerLike_(ss, sheetName, title) {
  // Bewaar bestaande rij-data (3-9, A-H) vóór de clear in getOrCreateSheet.
  var existing = ss.getSheetByName(sheetName);
  var savedRows = null;
  if (existing && existing.getMaxRows() >= 9 &&
      existing.getRange(3, 3).getValue() instanceof Date) {
    savedRows = existing.getRange(3, 1, 7, 8).getValues();
  }

  var sh = getOrCreateSheet(ss, sheetName);

  // Title
  sh.getRange(1, 1, 1, PLANNER_HEADERS.length).merge()
    .setValue(title)
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

  // Restore bewaarde rij-data (idempotent rebuild) — kol B (dagnamen)
  // is hierboven al expliciet hergezet, dus die slaan we over.
  if (savedRows) {
    for (var k = 0; k < 7; k++) {
      var rr = 3 + k;
      sh.getRange(rr, 1).setValue(savedRows[k][0]);                    // Train? checkbox
      sh.getRange(rr, 3).setValue(savedRows[k][2]).setNumberFormat('ddd dd-MM'); // Datum
      sh.getRange(rr, 4).setValue(savedRows[k][3]);                    // Minuten
      sh.getRange(rr, 5).setValue(savedRows[k][4]);                    // Dagtype
      sh.getRange(rr, 6).setValue(savedRows[k][5]);                    // Toelichting
      sh.getRange(rr, 7).setValue(savedRows[k][6]);                    // Voorgesteld
      sh.getRange(rr, 8).setValue(savedRows[k][7]);                    // Gedaan?
    }
  }

  return sh;
}

function _setPlannerColumnWidths_(sh) {
  sh.setColumnWidth(1, 70);
  sh.setColumnWidth(2, 100);
  sh.setColumnWidth(3, 100);
  sh.setColumnWidth(4, 80);
  sh.setColumnWidth(5, 100);
  sh.setColumnWidth(6, 280);
  sh.setColumnWidth(7, 220);
  sh.setColumnWidth(8, 80);
}

// ── Materialize + has-data helpers ───────────────────────────────

/**
 * Schrijft 7 dagen (datums + patroon-defaults) naar een planner-tab voor
 * de week beginnend op `monday`. Reset Voorgesteld type + Gedaan?.
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
 * Returnt true als een planner-tab-rij gevuld is (C3 = maandag-datum
 * aanwezig). Gebruikt door ensureCurrentWeek-varianten als vangnet.
 */
function plannerHasData_(sh) {
  if (!sh || sh.getMaxRows() < 3) return false;
  return sh.getRange(3, 3).getValue() instanceof Date;
}

// ── Week-state guards ────────────────────────────────────────────

/**
 * LAAG 2 — week-state guard. Rolt de Weekplanner automatisch naar de
 * huidige kalenderweek wanneer tab_week_start verouderd/leeg is, OF
 * wanneer de tab leeg is (vangnet voor rebuilds die de cellen wisten).
 *
 * Rollover-pad: als Weekplanner +1 user-data heeft, wordt die naar
 * Weekplanner gekopieerd (met de huidige-week datums in kol C). Anders
 * wordt vanuit het opgeslagen pattern gematerialiseerd. Na rollover wordt
 * +1 vers neergezet voor week +2.
 */
function ensureCurrentWeek(ss) {
  var sh = ss.getSheetByName(PLANNER_SHEET);
  if (!sh) return;
  var monday = weekStartDate(new Date());
  var mondayStr = formatDate(monday, 'yyyy-MM-dd');
  var stored = getDocProp(TAB_WEEK_KEY, '');
  // Vangnet: ook materializen als tab_week_start matcht maar de data leeg
  // is (bv. na een rebuild die de cellen wiste).
  if (stored === mondayStr && plannerHasData_(sh)) return;

  // ROLLOVER. Probeer eerst +1 te trekken — dat preserveert beschikbaarheid
  // die Daan zondag-avond al had ingevuld voor deze week.
  var rolledFromPlus1 = _pullPlus1IntoCurrent_(ss, monday);
  if (!rolledFromPlus1) {
    materializeWeek_(sh, monday);
  }
  setDocProp(TAB_WEEK_KEY, mondayStr);

  // Refresh +1 voor de NIEUWE volgende week (na rollover schoof "+1" een
  // week op zodat de gebruiker de week erna alvast kan vullen).
  try { ensureCurrentWeekPlus1(ss); }
  catch (e) { console.warn('ensureCurrentWeekPlus1 from rollover: ' + e.message); }

  var msg = 'Weekplanner gerold naar nieuwe week (' + mondayStr + ')' +
            (rolledFromPlus1 ? ' — gevuld vanuit Weekplanner +1' : '');
  try { ss.toast(msg, '🚴 Coach', 5); } catch (e) {}
}

/**
 * Symmetrisch met ensureCurrentWeek: zorgt dat Weekplanner +1 de week
 * NA de huidige toont. Materialiseert vanuit pattern bij verloop of leeg.
 */
function ensureCurrentWeekPlus1(ss) {
  var sh = ss.getSheetByName(WEEKPLANNER_PLUS1_SHEET);
  if (!sh) return;
  var monday = weekStartDate(new Date());
  var plus1Monday = new Date(monday);
  plus1Monday.setDate(monday.getDate() + 7);
  var plus1Str = formatDate(plus1Monday, 'yyyy-MM-dd');
  var stored = getDocProp(TAB_WEEK_PLUS1_KEY, '');
  if (stored === plus1Str && plannerHasData_(sh)) return;

  materializeWeek_(sh, plus1Monday);
  setDocProp(TAB_WEEK_PLUS1_KEY, plus1Str);
  try { ss.toast('Weekplanner +1 gerold naar nieuwe week (' + plus1Str + ')', '🚴 Coach', 4); } catch (e) {}
}

/**
 * Kopieer +1 user-data (train/min/dagtype/notitie) naar de huidige
 * Weekplanner met VERSE datums voor `monday`. Reset voorgesteldType
 * en gedaan zodat de nieuwe week vers begint.
 *
 * Returnt false als er geen +1-tab is of geen data — dan moet de caller
 * vanuit pattern materializen.
 */
function _pullPlus1IntoCurrent_(ss, monday) {
  var sh = ss.getSheetByName(PLANNER_SHEET);
  var plus1Sh = ss.getSheetByName(WEEKPLANNER_PLUS1_SHEET);
  if (!sh || !plus1Sh) return false;
  if (!plannerHasData_(plus1Sh)) return false;

  var data = plus1Sh.getRange(3, 1, 7, 8).getValues();
  for (var i = 0; i < 7; i++) {
    var r = 3 + i;
    var date = new Date(monday);
    date.setDate(monday.getDate() + i);
    sh.getRange(r, 1).setValue(data[i][0] === true);                 // train
    sh.getRange(r, 2).setValue(DAGEN_NL[i]).setFontWeight('bold');   // dag (safety)
    sh.getRange(r, 3).setValue(date).setNumberFormat('ddd dd-MM');   // datum: verse huidige-week
    sh.getRange(r, 4).setValue(data[i][3]);                          // minuten
    sh.getRange(r, 5).setValue(data[i][4]);                          // dagtype
    sh.getRange(r, 6).setValue(data[i][5]);                          // toelichting
    sh.getRange(r, 7).setValue('');                                  // voorgesteld leeg
    sh.getRange(r, 8).setValue(false);                               // gedaan leeg
  }
  return true;
}

/**
 * Coach-menu item "📋 Rol Weekplanner +1 naar huidig". Forceert de
 * rollover-stap ongeacht stored-state. Handig wanneer de auto-rollover
 * gemist is (geen onOpen op maandag) of wanneer Daan een herhaling wil.
 */
function rolWeekplannerPlus1NaarHuidig() {
  var ss = SpreadsheetApp.getActive();
  var ui;
  try { ui = SpreadsheetApp.getUi(); } catch (e) {}
  var sh = ss.getSheetByName(PLANNER_SHEET);
  var plus1Sh = ss.getSheetByName(WEEKPLANNER_PLUS1_SHEET);
  if (!sh || !plus1Sh) {
    if (ui) ui.alert('Tabs ontbreken', 'Draai eerst "Bouw alles opnieuw" zodat beide planner-tabs bestaan.', ui.ButtonSet.OK);
    return;
  }
  if (!plannerHasData_(plus1Sh)) {
    if (ui) ui.alert('Weekplanner +1 is leeg', 'Vul eerst beschikbaarheid in op de "Weekplanner +1"-tab.', ui.ButtonSet.OK);
    return;
  }
  var monday = weekStartDate(new Date());
  var mondayStr = formatDate(monday, 'yyyy-MM-dd');
  var ok = _pullPlus1IntoCurrent_(ss, monday);
  if (!ok) {
    if (ui) ui.alert('Rollover mislukt', 'Onbekende fout — check Apps Script Executions.', ui.ButtonSet.OK);
    return;
  }
  setDocProp(TAB_WEEK_KEY, mondayStr);
  try { ensureCurrentWeekPlus1(ss); } catch (e) { console.warn('ensureCurrentWeekPlus1 from manual rollover: ' + e.message); }
  if (ui) ui.alert('✅ Rollover gedaan', 'Volgende week is nu de huidige Weekplanner geworden.', ui.ButtonSet.OK);
}

// ── Menu-actie: patroon promoten ─────────────────────────────────

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

// ── Lezen + voorgesteld-type schrijven ───────────────────────────

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
