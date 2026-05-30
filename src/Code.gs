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
  // Rol de Weekplanner automatisch naar de huidige week (LAAG 2).
  try { ensureCurrentWeek(SpreadsheetApp.getActive()); } catch (e) { console.warn('ensureCurrentWeek onOpen: ' + e.message); }

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
    .addItem('Installeer dagelijkse sync (08:00)', 'installDailySyncTrigger')
    .addItem('Verwijder dagelijkse sync', 'removeDailySyncTrigger')
    .addItem('🔄 Sync athlete nu', 'syncAthleteFromIcu')
    .addItem('🔧 Setup: athlete-sync trigger', 'installAthleteSyncTrigger')
    .addSeparator()
    .addItem('Volgende mesocyclus-week ▶', 'advanceMeso')
    .addItem('Reset mesocyclus naar week 1', 'resetMeso')
    .addSeparator()
    .addItem('Open Events-tab', 'openEventsTab')
    .addItem('Sla huidige week op als standaardpatroon', 'savePatternFromTab')
    .addSeparator()
    .addItem('Bouw alles opnieuw (reset Sheet)', 'buildAll')
    .addToUi();
}

// Events worden beheerd via de Events-tab (zie Events.gs).
// Menu-actie "Open Events-tab" → openEventsTab() in Events.gs.

/**
 * onEdit simple trigger:
 *  - Instellingen!B → synct naar DocProps (SETTINGS_ROW_TO_KEY).
 *  - Events databereik → saveEventsToProps_ (persist over rebuild).
 * Stille fail bij errors — simple triggers mogen niet throwen.
 */
function onEdit(e) {
  try {
    if (!e || !e.range) return;
    var name = e.range.getSheet().getName();

    if (name === SETTINGS_SHEET) {
      if (e.range.getColumn() !== 2) return;
      var key = SETTINGS_ROW_TO_KEY[e.range.getRow()];
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
    } else if (name === EVENTS_SHEET) {
      // Alleen op edits in het databereik (rij ≥ EVENT_FIRST_ROW, kol A-H)
      if (e.range.getRow() >= EVENT_FIRST_ROW &&
          e.range.getColumn() >= 1 && e.range.getColumn() <= EVENT_HEADERS.length) {
        saveEventsToProps_();
      }
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
  buildEvents(ss);
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
  var order = [SETTINGS_SHEET, ZONES_SHEET, DOEL_SHEET, EVENTS_SHEET, PLANNER_SHEET,
               PROPOSAL_SHEET, ACTIVITEITEN_SHEET, WELLNESS_SHEET];
  order.forEach(function (name, i) {
    var sh = ss.getSheetByName(name);
    if (sh) {
      ss.setActiveSheet(sh);
      ss.moveActiveSheet(i + 1);
    }
  });

  // Zorg dat de Weekplanner de huidige week toont (buildPlanner deed dit al;
  // dit is de expliciete guard zodat de tab altijd klopt na rebuild).
  ensureCurrentWeek(ss);

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
