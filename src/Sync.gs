/**
 * Sync.gs — intervals.icu data sync + dagelijkse trigger.
 *
 * syncAll(): orchestrator — roept syncAthleteZones / syncActivities /
 * syncWellness aan, catcht errors per sub-functie (geen partial failure
 * mag de andere syncs blokkeren), update 'last_sync' docprop.
 *
 * installDailySyncTrigger / removeDailySyncTrigger: time-based trigger
 * voor 06:00 Europe/Amsterdam.
 */

function syncAll(e) {
  var fromTrigger = !!(e && e.triggerUid);
  var errors = [];

  try { syncAthleteZones(); }
  catch (err) { errors.push('Zones: ' + err.message); console.error('syncAthleteZones', err); }

  try { syncActivities(); }
  catch (err) { errors.push('Activiteiten: ' + err.message); console.error('syncActivities', err); }

  try { syncWellness(); }
  catch (err) { errors.push('Wellness: ' + err.message); console.error('syncWellness', err); }

  setDocProp('last_sync', formatDate(new Date(), 'dd-MM-yyyy HH:mm'));

  if (!fromTrigger) {
    var ui;
    try { ui = SpreadsheetApp.getUi(); } catch (uiErr) { ui = null; }
    if (errors.length === 0) {
      SpreadsheetApp.getActive().toast('Sync voltooid ✓', '🚴 Coach', 6);
    } else if (ui) {
      ui.alert('Sync deels mislukt', errors.join('\n\n'), ui.ButtonSet.OK);
    }
  } else if (errors.length) {
    console.error('Sync errors (trigger context):', errors.join(' | '));
  }
}

/**
 * Synct athlete-level info (FTP/LTHR/maxHR/restHR + zones).
 * Overschrijft DocumentProperties — intervals.icu is source of truth.
 */
function syncAthleteZones() {
  var info = getAthleteInfo();
  var ss = SpreadsheetApp.getActive();

  if (info.ftp)    setDocProp('ftp',     info.ftp);
  if (info.lthr)   setDocProp('lthr',    info.lthr);
  if (info.maxHr)  setDocProp('hr_max',  info.maxHr);
  if (info.restHr) setDocProp('hr_rest', info.restHr);

  if (info.power_zones) setDocProp('api_power_zones', JSON.stringify(info.power_zones));
  if (info.hr_zones)    setDocProp('api_hr_zones',    JSON.stringify(info.hr_zones));

  // Sync cellen in Instellingen-tab
  var sh = ss.getSheetByName(SETTINGS_SHEET);
  if (sh) {
    if (info.ftp)    sh.getRange(SETTINGS_FIELDS.FTP.row,     2).setValue(info.ftp);
    if (info.lthr)   sh.getRange(SETTINGS_FIELDS.LTHR.row,    2).setValue(info.lthr);
    if (info.maxHr)  sh.getRange(SETTINGS_FIELDS.HR_MAX.row,  2).setValue(info.maxHr);
    if (info.restHr) sh.getRange(SETTINGS_FIELDS.HR_RUST.row, 2).setValue(info.restHr);
  }

  // Herbouw Zones-tab met API zones (als we ze hebben)
  if (info.power_zones || info.hr_zones) {
    buildZones(ss);
  }
}

function syncActivities() {
  var data = getActivities(28);
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(ACTIVITEITEN_SHEET);
  if (!sh) return;

  // Clear bestaande data rijen (behoud header)
  var lastRow = sh.getLastRow();
  if (lastRow > 1) {
    sh.getRange(2, 1, lastRow - 1, ACT_HEADERS.length).clearContent();
  }

  // Sorteer nieuwste eerst (rij 2 = meest recent)
  data.sort(function (a, b) {
    return new Date(b.start_date_local) - new Date(a.start_date_local);
  });

  var rows = data.map(function (a) {
    return [
      a.start_date_local ? new Date(a.start_date_local) : '',
      a.type || '',
      a.name || '',
      a.moving_time != null ? Math.round(a.moving_time / 60) : '',
      a.distance     != null ? Math.round(a.distance / 100) / 10 : '',
      a.average_watts          != null ? a.average_watts          : '',
      a.weighted_average_watts != null ? a.weighted_average_watts : '',
      a.icu_intensity          != null ? Math.round(a.icu_intensity * 100) / 100 : '',
      a.icu_training_load      != null ? Math.round(a.icu_training_load) : '',
      a.average_heartrate      != null ? a.average_heartrate      : '',
      a.max_heartrate          != null ? a.max_heartrate          : '',
      a.polarization_index     != null ? Math.round(a.polarization_index * 100) / 100 : ''
    ];
  });

  if (rows.length) {
    sh.getRange(2, 1, rows.length, ACT_HEADERS.length).setValues(rows);
    sh.getRange(2, 1, rows.length, 1).setNumberFormat('dd-MM-yyyy');
  }
}

function syncWellness() {
  var data = getWellness(30);
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(WELLNESS_SHEET);
  if (!sh) return;

  // Clear bestaande data rijen (behoud header + statistiekjes-blok)
  var lastDataRow = WELL_STATS_ROW - 2;
  if (lastDataRow >= 2) {
    sh.getRange(2, 1, lastDataRow - 1, WELL_HEADERS.length).clearContent();
  }

  // Sorteer nieuwste eerst (gebruik id, fallback date)
  data.sort(function (a, b) {
    return new Date(b.id || b.date) - new Date(a.id || a.date);
  });

  // Slaap kan in seconden komen (sleepSecs) of in uren (sleep_hours)
  function sleepHours(w) {
    if (w.sleepSecs != null)   return Math.round(w.sleepSecs / 360) / 10;
    if (w.sleep_hours != null) return w.sleep_hours;
    if (w.sleep != null)       return w.sleep;
    return '';
  }

  var rows = data.map(function (w) {
    var date = w.id ? new Date(w.id) : (w.date ? new Date(w.date) : '');
    return [
      date,
      blankIfNull_(w.restingHR != null ? w.restingHR : w.resting_hr),
      blankIfNull_(w.hrv != null ? w.hrv : w.hrv_rmssd),
      sleepHours(w),
      blankIfNull_(w.sleepScore != null ? w.sleepScore : w.sleep_score),
      blankIfNull_(w.readiness),
      blankIfNull_(w.mood),
      blankIfNull_(w.weight)
    ];
  });

  // Knip af op aantal data rijen dat past
  var maxRows = WELL_STATS_ROW - 2;
  if (rows.length > maxRows) rows = rows.slice(0, maxRows);

  if (rows.length) {
    sh.getRange(2, 1, rows.length, WELL_HEADERS.length).setValues(rows);
    sh.getRange(2, 1, rows.length, 1).setNumberFormat('dd-MM-yyyy');
  }
}

function blankIfNull_(v) {
  return (v == null || v === '') ? '' : v;
}

// ── Trigger management ───────────────────────────────────────────

var SYNC_HANDLER = 'syncAll';

function installDailySyncTrigger() {
  removeDailySyncTrigger_();
  ScriptApp.newTrigger(SYNC_HANDLER)
    .timeBased()
    .atHour(6)
    .everyDays(1)
    .inTimezone(TZ)
    .create();
  var ui;
  try { ui = SpreadsheetApp.getUi(); } catch (e) {}
  if (ui) ui.alert('✓ Dagelijkse sync trigger geïnstalleerd (06:00 Europe/Amsterdam).');
}

function removeDailySyncTrigger() {
  var n = removeDailySyncTrigger_();
  var ui;
  try { ui = SpreadsheetApp.getUi(); } catch (e) {}
  if (ui) ui.alert(n > 0
    ? '✓ Sync trigger verwijderd (' + n + ').'
    : 'Geen sync trigger aanwezig om te verwijderen.');
}

function removeDailySyncTrigger_() {
  var triggers = ScriptApp.getProjectTriggers();
  var n = 0;
  triggers.forEach(function (t) {
    if (t.getHandlerFunction() === SYNC_HANDLER) {
      ScriptApp.deleteTrigger(t);
      n++;
    }
  });
  return n;
}
