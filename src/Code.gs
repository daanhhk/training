/**
 * Code.gs — Entry point + menu + onEdit trigger.
 *
 * onOpen: bouwt het "🚴 Coach" menu.
 * onEdit: simple trigger die wijzigingen in Instellingen!B synct naar
 *         DocumentProperties (persistent settings).
 * buildAll: (her)bouwt alle tabs van scratch — settings overleven dit
 *           omdat ze uit DocumentProperties worden geladen.
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🚴 Coach')
    .addItem('Genereer voorstel voor deze week', 'generateProposal')
    .addItem('Push voorstel naar Garmin', 'pushAllPendingWorkouts')
    .addSeparator()
    .addItem('Sync nu (intervals.icu)', 'syncAll')
    .addItem('Test API verbinding', 'menuTestConnection')
    .addItem('Debug API respons (eenmalig)', 'debugApiResponse')
    .addItem('Debug bestaande workout', 'debugExistingWorkout')
    .addSeparator()
    .addItem('Installeer dagelijkse sync (06:00)', 'installDailySyncTrigger')
    .addItem('Verwijder dagelijkse sync', 'removeDailySyncTrigger')
    .addSeparator()
    .addItem('Volgende mesocyclus-week ▶', 'advanceMeso')
    .addItem('Reset mesocyclus naar week 1', 'resetMeso')
    .addSeparator()
    .addItem('Stel doel-event in', 'setEventDate')
    .addItem('Wis doel-event', 'clearEventDate')
    .addSeparator()
    .addItem('Bouw alles opnieuw (reset Sheet)', 'buildAll')
    .addToUi();
}

/**
 * Menu-actie: vraagt event-datum + naam, schrijft naar DocProps en
 * synct naar de Instellingen-cellen. Event-datum activeert event-driven
 * periodisering (terugtellen + taper) in plaats van vaste mesocyclus.
 */
function setEventDate() {
  var ui = SpreadsheetApp.getUi();

  var dateResp = ui.prompt('Doel-event datum',
    'Voer de event-datum in (yyyy-MM-dd), bv. 2026-06-13:', ui.ButtonSet.OK_CANCEL);
  if (dateResp.getSelectedButton() !== ui.Button.OK) return;
  var dateStr = dateResp.getResponseText().trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    ui.alert('Ongeldige datum', 'Gebruik formaat yyyy-MM-dd (bv. 2026-06-13).', ui.ButtonSet.OK);
    return;
  }
  var d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    ui.alert('Ongeldige datum', 'Kon "' + dateStr + '" niet parsen.', ui.ButtonSet.OK);
    return;
  }

  var nameResp = ui.prompt('Doel-event naam',
    'Naam van het event (bv. "Girona fietsvakantie"):', ui.ButtonSet.OK_CANCEL);
  if (nameResp.getSelectedButton() !== ui.Button.OK) return;
  var name = nameResp.getResponseText().trim();

  setDocProp('event_date', dateStr);
  setDocProp('event_name', name);

  var sh = SpreadsheetApp.getActive().getSheetByName(SETTINGS_SHEET);
  if (sh) {
    sh.getRange(SETTINGS_FIELDS.EVENT_DATE.row, 2).setValue(d).setNumberFormat('dd-MM-yyyy');
    sh.getRange(SETTINGS_FIELDS.EVENT_NAME.row, 2).setValue(name);
  }

  ui.alert('Doel-event ingesteld',
    (name || '(naamloos)') + ' op ' + dateStr + '.\n\n' +
    'Genereer voorstel om de fase-aftelling + taper te zien.', ui.ButtonSet.OK);
}

/**
 * Menu-actie: wist het doel-event uit DocProps + Instellingen-cellen.
 * Systeem valt terug op vaste mesocyclus-logica.
 */
function clearEventDate() {
  var props = PropertiesService.getDocumentProperties();
  props.deleteProperty('event_date');
  props.deleteProperty('event_name');

  var sh = SpreadsheetApp.getActive().getSheetByName(SETTINGS_SHEET);
  if (sh) {
    sh.getRange(SETTINGS_FIELDS.EVENT_DATE.row, 2).clearContent();
    sh.getRange(SETTINGS_FIELDS.EVENT_NAME.row, 2).clearContent();
  }

  SpreadsheetApp.getUi().alert('Doel-event gewist — terug naar vaste mesocyclus.');
}

/**
 * onEdit simple trigger: synct edits in tab Instellingen, kolom B,
 * naar DocumentProperties op basis van SETTINGS_ROW_TO_KEY mapping.
 * Stille fail bij errors — simple triggers mogen niet throwen.
 */
function onEdit(e) {
  try {
    if (!e || !e.range) return;
    var sh = e.range.getSheet();
    if (sh.getName() !== SETTINGS_SHEET) return;
    if (e.range.getColumn() !== 2) return;
    var row = e.range.getRow();
    var key = SETTINGS_ROW_TO_KEY[row];
    if (!key) return;

    var newVal = e.range.getValue();
    var props = PropertiesService.getDocumentProperties();
    if (newVal === '' || newVal === null || newVal === undefined) {
      props.deleteProperty(key);
    } else if (newVal instanceof Date) {
      props.setProperty(key, newVal.toISOString());
    } else {
      props.setProperty(key, String(newVal));
    }
  } catch (err) {
    console.error('onEdit error:', err);
  }
}

function menuTestConnection() {
  var ui = SpreadsheetApp.getUi();
  try {
    testConnection();
    ui.alert('✅ Verbinding succesvol', 'intervals.icu API is bereikbaar met de huidige credentials.', ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('❌ Verbinding mislukt', e.message, ui.ButtonSet.OK);
  }
}

function buildAll() {
  var ss = SpreadsheetApp.getActive();

  buildSettings(ss);
  buildZones(ss);
  buildDoel(ss);
  buildPlanner(ss);
  buildVoorstelPlaceholder(ss);
  buildActiviteiten(ss);
  buildWellness(ss);

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
    if (sh) {
      ss.setActiveSheet(sh);
      ss.moveActiveSheet(i + 1);
    }
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
