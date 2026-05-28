/**
 * Events.gs — Tab "Events".
 *
 * Race/trip kalender met profiel (afstand, hoogtemeters, klim-type).
 * Stuurt event-driven periodisering (Doel.bepaalFaseVoorDatum_) en
 * klim-type-gestuurde workout-selectie (Algorithm.gs).
 *
 * Vervangt de oude enkele event_date/event_name DocProps. Migratie van
 * die legacy props gebeurt in buildEvents → migrateLegacyEvent_.
 */

var EVENTS_SHEET = 'Events';

var EVENT_HEADERS = [
  'Datum', 'Naam', 'Type', 'Prioriteit', 'Afstand km', 'Hoogtemeters', 'Klim-type', 'Notitie'
];

var EVENT_TYPE_OPTIONS = ['trip', 'race'];
var EVENT_PRIO_OPTIONS = ['A', 'B', 'C'];
var EVENT_KLIM_OPTIONS = ['lang', 'kort', 'gemengd', 'vlak'];

var EVENT_FIRST_ROW = 3;   // header op rij 2, titel op rij 1
var EVENT_ROW_COUNT = 10;

function buildEvents(ss) {
  var sh = getOrCreateSheet(ss, EVENTS_SHEET);

  // Title
  sh.getRange(1, 1, 1, EVENT_HEADERS.length).merge()
    .setValue('📅  Events — races & trips met profiel')
    .setFontWeight('bold').setFontSize(13)
    .setBackground('#1f2937').setFontColor('#ffffff')
    .setHorizontalAlignment('left').setVerticalAlignment('middle');
  sh.setRowHeight(1, 28);

  // Headers
  sh.getRange(2, 1, 1, EVENT_HEADERS.length).setValues([EVENT_HEADERS])
    .setFontWeight('bold').setBackground('#e5e7eb').setHorizontalAlignment('center');

  // Datum-format
  sh.getRange(EVENT_FIRST_ROW, 1, EVENT_ROW_COUNT, 1).setNumberFormat('yyyy-mm-dd');

  // Dropdowns
  sh.getRange(EVENT_FIRST_ROW, 3, EVENT_ROW_COUNT, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(EVENT_TYPE_OPTIONS, true).setAllowInvalid(false).build());
  sh.getRange(EVENT_FIRST_ROW, 4, EVENT_ROW_COUNT, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(EVENT_PRIO_OPTIONS, true).setAllowInvalid(false).build());
  sh.getRange(EVENT_FIRST_ROW, 7, EVENT_ROW_COUNT, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(EVENT_KLIM_OPTIONS, true).setAllowInvalid(false).build());

  // Migreer legacy event_date/event_name → rij 1 (type=trip, prio=A)
  migrateLegacyEvent_(sh);

  SpreadsheetApp.flush();
  var widths = [110, 200, 80, 90, 90, 110, 100, 260];
  widths.forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  sh.setFrozenRows(2);
}

function migrateLegacyEvent_(sh) {
  var props = PropertiesService.getDocumentProperties();
  var legacyDate = props.getProperty('event_date');
  if (!legacyDate) return;

  var legacyName = props.getProperty('event_name') || 'Doel-event';
  var d = new Date(legacyDate);
  if (!isNaN(d.getTime())) {
    sh.getRange(EVENT_FIRST_ROW, 1).setValue(d).setNumberFormat('yyyy-mm-dd');
    sh.getRange(EVENT_FIRST_ROW, 2).setValue(legacyName);
    sh.getRange(EVENT_FIRST_ROW, 3).setValue('trip');
    sh.getRange(EVENT_FIRST_ROW, 4).setValue('A');
    sh.getRange(EVENT_FIRST_ROW, 7).setValue('lang');
    console.log('Migrated legacy event → Events rij 1: ' + legacyName + ' (' + legacyDate + ')');
  }
  props.deleteProperty('event_date');
  props.deleteProperty('event_name');
}

/**
 * Leest alle events (ongefilterd), gesorteerd op datum oplopend.
 * Rijen zonder geldige datum worden overgeslagen.
 */
function getAllEvents_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(EVENTS_SHEET);
  if (!sh) return [];
  var lastRow = sh.getLastRow();
  if (lastRow < EVENT_FIRST_ROW) return [];

  var n = lastRow - EVENT_FIRST_ROW + 1;
  var data = sh.getRange(EVENT_FIRST_ROW, 1, n, EVENT_HEADERS.length).getValues();
  var events = [];
  data.forEach(function (r) {
    if (!(r[0] instanceof Date)) return;
    events.push({
      datum:      r[0],
      naam:       String(r[1] || ''),
      type:       String(r[2] || 'race'),
      prioriteit: String(r[3] || 'C'),
      afstandKm:  Number(r[4]) || 0,
      hm:         Number(r[5]) || 0,
      klimType:   String(r[6] || 'vlak'),
      notitie:    String(r[7] || '')
    });
  });
  events.sort(function (a, b) { return a.datum - b.datum; });
  return events;
}

/**
 * Toekomstige events (datum >= vandaag), gesorteerd op datum.
 */
function getEvents() {
  var today = new Date(); today.setHours(0, 0, 0, 0);
  return getAllEvents_().filter(function (e) { return e.datum >= today; });
}

/** Menu-actie: activeer de Events-tab (bouw indien nog niet aanwezig). */
function openEventsTab() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(EVENTS_SHEET);
  if (!sh) { buildEvents(ss); sh = ss.getSheetByName(EVENTS_SHEET); }
  ss.setActiveSheet(sh);
}
