/**
 * Code.gs — Entry point + menu.
 *
 * onOpen: bouwt het "🚴 Coach" menu.
 * buildAll: (her)bouwt alle tabs van scratch.
 * generateProposal / advanceMeso / resetMeso: zitten in andere modules.
 */

var ACTIVITEITEN_SHEET = 'Activiteiten';
var WELLNESS_SHEET     = 'Wellness';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🚴 Coach')
    .addItem('Genereer voorstel voor deze week', 'generateProposal')
    .addSeparator()
    .addItem('Volgende mesocyclus-week ▶', 'advanceMeso')
    .addItem('Reset mesocyclus naar week 1', 'resetMeso')
    .addSeparator()
    .addItem('Bouw alles opnieuw (reset Sheet)', 'buildAll')
    .addToUi();
}

function buildAll() {
  var ss = SpreadsheetApp.getActive();

  buildSettings(ss);
  buildZones(ss);
  buildDoel(ss);
  buildPlanner(ss);
  buildVoorstelPlaceholder(ss);
  buildActiviteitenPlaceholder(ss);
  buildWellnessPlaceholder(ss);

  // Verwijder default Sheet1 / Blad1 indien aanwezig en niet leeg
  ['Sheet1', 'Blad1'].forEach(function (n) {
    var sh = ss.getSheetByName(n);
    if (sh && ss.getSheets().length > 1) {
      try { ss.deleteSheet(sh); } catch (e) {}
    }
  });

  // Volgorde van tabs
  var order = [SETTINGS_SHEET, ZONES_SHEET, DOEL_SHEET, PLANNER_SHEET,
               PROPOSAL_SHEET, ACTIVITEITEN_SHEET, WELLNESS_SHEET];
  order.forEach(function (name, i) {
    var sh = ss.getSheetByName(name);
    if (sh) ss.setActiveSheet(sh), ss.moveActiveSheet(i + 1);
  });

  ss.setActiveSheet(ss.getSheetByName(SETTINGS_SHEET));
  ss.toast('Alle tabs opgebouwd ✓', '🚴 Coach', 5);
}

function buildVoorstelPlaceholder(ss) {
  var sh = getOrCreateSheet(ss, PROPOSAL_SHEET);
  sh.getRange(1, 1, 1, 5).merge()
    .setValue('🚴  Voorstel — nog leeg')
    .setFontWeight('bold').setFontSize(14)
    .setBackground('#111827').setFontColor('#ffffff');
  sh.getRange(3, 1).setValue('Klik op menu 🚴 Coach → "Genereer voorstel voor deze week".')
    .setFontStyle('italic').setFontColor('#6b7280');
  sh.setColumnWidth(1, 150);
}

function buildActiviteitenPlaceholder(ss) {
  var sh = getOrCreateSheet(ss, ACTIVITEITEN_SHEET);
  sh.getRange(1, 1, 1, 4).merge()
    .setValue('📋  Activiteiten — placeholder (intervals.icu sync komt in volgende stap)')
    .setFontWeight('bold').setBackground('#1f2937').setFontColor('#ffffff');
}

function buildWellnessPlaceholder(ss) {
  var sh = getOrCreateSheet(ss, WELLNESS_SHEET);
  sh.getRange(1, 1, 1, 4).merge()
    .setValue('💤  Wellness — placeholder (intervals.icu sync komt in volgende stap)')
    .setFontWeight('bold').setBackground('#1f2937').setFontColor('#ffffff');
}
