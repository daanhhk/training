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
  // Rol de Weekplanner automatisch naar de huidige week (LAAG 2). De
  // ensureCurrentWeek-stap trekt waar mogelijk Weekplanner +1 erin.
  try { ensureCurrentWeek(SpreadsheetApp.getActive()); } catch (e) { console.warn('ensureCurrentWeek onOpen: ' + e.message); }
  try { ensureCurrentWeekPlus1(SpreadsheetApp.getActive()); } catch (e) { console.warn('ensureCurrentWeekPlus1 onOpen: ' + e.message); }

  var ui = SpreadsheetApp.getUi();
  var setupMenu = ui.createMenu('🔐 Setup')
    .addItem('Set intervals.icu API key',  'setIntervalsApiKey')
    .addItem('Set Telegram bot token',     'setTelegramBotToken')
    .addItem('Set Telegram chat ID',       'setTelegramChatId')
    .addItem('Set Apps Script Deploy URL', 'setDeployUrl')
    .addSeparator()
    .addItem('Test bot connectie (getMe)',  'testBotConnection')
    .addItem('Test send message naar mij',  'testSendMessageToSelf')
    .addItem('Start polling (delete webhook + install trigger)', 'startTelegramPolling')
    .addItem('Stop polling (remove trigger)', 'stopTelegramPolling')
    .addItem('Poll nu (eenmalig)', 'pollTelegramUpdatesOnce')
    .addItem('🏋️ Installeer RPE-avondcheck (20:00)', 'installRpeAvondTrigger')
    .addItem('Verwijder RPE-avondcheck', 'removeRpeAvondTrigger')
    .addItem('🗓️ Installeer zondag-reminder (19:00)', 'installZondagReminderTrigger')
    .addItem('Verwijder zondag-reminder', 'removeZondagReminderTrigger')
    .addSeparator()
    .addItem('Registreer webhook bij Telegram', 'registerTelegramWebhook')
    .addItem('Reset webhook (delete + register)', 'resetTelegramWebhook')
    .addSeparator()
    .addItem('Toon laatste 10 audit-rijen', 'showLastAuditRows')
    .addItem('Toon opgeslagen secrets',    'viewStoredSecrets')
    .addItem('Wis alle secrets',           'clearAllSecrets')
    .addSeparator()
    .addItem('Installeer athlete-sync trigger', 'installAthleteSyncTrigger');

  ui.createMenu('🚴 Coach')
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
    .addSeparator()
    .addItem('Volgende mesocyclus-week ▶', 'advanceMeso')
    .addItem('Reset mesocyclus naar week 1', 'resetMeso')
    .addSeparator()
    .addItem('Open Events-tab', 'openEventsTab')
    .addItem('Sla huidige week op als standaardpatroon', 'savePatternFromTab')
    .addItem('📋 Rol Weekplanner +1 naar huidig', 'rolWeekplannerPlus1NaarHuidig')
    .addItem('🧹 Weekplanner +1 leegmaken', 'blankPlannerPlus1')
    .addSeparator()
    .addSubMenu(setupMenu)
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
  buildPlannerPlus1(ss);
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
               WEEKPLANNER_PLUS1_SHEET,
               PROPOSAL_SHEET, ACTIVITEITEN_SHEET, WELLNESS_SHEET];
  order.forEach(function (name, i) {
    var sh = ss.getSheetByName(name);
    if (sh) {
      ss.setActiveSheet(sh);
      ss.moveActiveSheet(i + 1);
    }
  });

  // Zorg dat beide Weekplanner-tabs op de juiste week staan (buildPlanner +
  // buildPlannerPlus1 deden dit al; dit is de expliciete guard na rebuild).
  ensureCurrentWeek(ss);
  ensureCurrentWeekPlus1(ss);

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
