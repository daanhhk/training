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

  // Eénmalige migratie van legacy event_date/event_name → events_json
  migrateLegacyEvent_();

  // Herstel opgeslagen events (DocProps) — NA dropdowns zodat validatie
  // de teruggeschreven waarden accepteert.
  restoreEventsFromProps_(ss);

  SpreadsheetApp.flush();
  var widths = [110, 200, 80, 90, 90, 110, 100, 260];
  widths.forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  sh.setFrozenRows(2);
}

/**
 * Eénmalige migratie: zet de oude enkele event_date/event_name DocProps
 * om naar een entry in events_json (type=trip, prio=A, klim=lang) en
 * verwijder de legacy props. No-op als ze al verwerkt zijn.
 */
function migrateLegacyEvent_() {
  var props = PropertiesService.getDocumentProperties();
  var legacyDate = props.getProperty('event_date');
  if (!legacyDate) return;

  var legacyName = props.getProperty('event_name') || 'Doel-event';
  var d = new Date(legacyDate);
  if (!isNaN(d.getTime())) {
    var existing = [];
    var raw = props.getProperty('events_json');
    if (raw) { try { existing = JSON.parse(raw) || []; } catch (e) {} }
    existing.unshift({
      datum:      Utilities.formatDate(d, TZ, 'yyyy-MM-dd'),
      naam:       legacyName,
      type:       'trip',
      prioriteit: 'A',
      afstandKm:  '',
      hm:         '',
      klimType:   'lang',
      notitie:    ''
    });
    props.setProperty('events_json', JSON.stringify(existing));
    console.log('Migrated legacy event → events_json: ' + legacyName + ' (' + legacyDate + ')');
  }
  props.deleteProperty('event_date');
  props.deleteProperty('event_name');
}

/**
 * Serialiseert alle ingevulde Events-rijen naar DocProperty 'events_json'.
 * Aangeroepen door onEdit bij wijzigingen in de Events-tab.
 */
function saveEventsToProps_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(EVENTS_SHEET);
  if (!sh) return;

  var rows = [];
  var lastRow = sh.getLastRow();
  if (lastRow >= EVENT_FIRST_ROW) {
    var n = lastRow - EVENT_FIRST_ROW + 1;
    var data = sh.getRange(EVENT_FIRST_ROW, 1, n, EVENT_HEADERS.length).getValues();
    data.forEach(function (r) {
      // Sla volledig lege rijen over (geen datum én geen naam)
      if (!(r[0] instanceof Date) && !String(r[1] || '').trim()) return;
      rows.push({
        datum:      r[0] instanceof Date ? Utilities.formatDate(r[0], TZ, 'yyyy-MM-dd') : '',
        naam:       String(r[1] || ''),
        type:       String(r[2] || ''),
        prioriteit: String(r[3] || ''),
        afstandKm:  r[4] === '' || r[4] == null ? '' : Number(r[4]),
        hm:         r[5] === '' || r[5] == null ? '' : Number(r[5]),
        klimType:   String(r[6] || ''),
        notitie:    String(r[7] || '')
      });
    });
  }
  PropertiesService.getDocumentProperties().setProperty('events_json', JSON.stringify(rows));
}

/**
 * Schrijft de in DocProps opgeslagen events terug in de Events-tab.
 * No-op als 'events_json' afwezig/leeg is. Vereist dat de dropdowns
 * al gezet zijn (anders weigert validatie de waarden).
 */
function restoreEventsFromProps_(ss) {
  var raw = getDocProp('events_json', '');
  if (!raw) return;

  var rows;
  try { rows = JSON.parse(raw); } catch (e) {
    console.warn('restoreEventsFromProps_ JSON-fout: ' + e.message);
    return;
  }
  if (!Array.isArray(rows) || !rows.length) return;

  var sh = ss.getSheetByName(EVENTS_SHEET);
  if (!sh) return;

  var values = rows.map(function (e) {
    var d = e.datum ? new Date(e.datum) : '';
    if (d !== '' && isNaN(d.getTime())) d = '';
    return [
      d,
      e.naam || '',
      e.type || '',
      e.prioriteit || '',
      (e.afstandKm === '' || e.afstandKm == null) ? '' : e.afstandKm,
      (e.hm === '' || e.hm == null) ? '' : e.hm,
      e.klimType || '',
      e.notitie || ''
    ];
  });

  sh.getRange(EVENT_FIRST_ROW, 1, values.length, EVENT_HEADERS.length).setValues(values);
  sh.getRange(EVENT_FIRST_ROW, 1, values.length, 1).setNumberFormat('yyyy-mm-dd');
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
