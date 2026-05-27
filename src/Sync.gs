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
  var raw  = info.raw || {};
  var ss = SpreadsheetApp.getActive();

  if (info.ftp)    setDocProp('ftp',     info.ftp);
  if (info.lthr)   setDocProp('lthr',    info.lthr);
  if (info.maxHr)  setDocProp('hr_max',  info.maxHr);
  if (info.restHr) setDocProp('hr_rest', info.restHr);

  // Robuuste zone-resolutie: probeer meerdere structuren in de athlete-respons
  var powerBoundaries = resolvePowerZones_(raw);
  var hrBoundaries    = resolveHrZones_(raw);

  if (powerBoundaries) setDocProp('api_power_zones', JSON.stringify(powerBoundaries));
  if (hrBoundaries)    setDocProp('api_hr_zones',    JSON.stringify(hrBoundaries));

  // Sweet Spot range — drie-laagse resolutie:
  //   1. Uit athlete-object (icu_sweet_spot_min/max). Vaak null voor users.
  //   2. Uit meest recente activity met power-data (intervals.icu vult deze
  //      velden per activity in op basis van de athlete's instellingen).
  //   3. Hardcoded defaults 84/97 (intervals.icu standaard).
  var ssMin = raw.icu_sweet_spot_min ?? raw.sweet_spot_min ?? null;
  var ssMax = raw.icu_sweet_spot_max ?? raw.sweet_spot_max ?? null;
  var ssSource = 'athlete object';

  if (ssMin == null || ssMax == null) {
    try {
      var fromActivity = sweetSpotFromActivity_();
      if (fromActivity) {
        if (ssMin == null) ssMin = fromActivity.min;
        if (ssMax == null) ssMax = fromActivity.max;
        ssSource = 'recent activity ("' + fromActivity.activityName + '")';
      }
    } catch (e) {
      console.warn('sweetSpotFromActivity_ failed:', e.message);
    }
  }
  if (ssMin == null) { ssMin = 84; ssSource = 'hardcoded default'; }
  if (ssMax == null) { ssMax = 97; ssSource = 'hardcoded default'; }

  setDocProp('sweet_spot_min', ssMin);
  setDocProp('sweet_spot_max', ssMax);
  console.log('Sweet Spot: ' + ssMin + '% – ' + ssMax + '% FTP (bron: ' + ssSource + ')');

  // Sync cellen in Instellingen-tab
  var sh = ss.getSheetByName(SETTINGS_SHEET);
  if (sh) {
    if (info.ftp)    sh.getRange(SETTINGS_FIELDS.FTP.row,     2).setValue(info.ftp);
    if (info.lthr)   sh.getRange(SETTINGS_FIELDS.LTHR.row,    2).setValue(info.lthr);
    if (info.maxHr)  sh.getRange(SETTINGS_FIELDS.HR_MAX.row,  2).setValue(info.maxHr);
    if (info.restHr) sh.getRange(SETTINGS_FIELDS.HR_RUST.row, 2).setValue(info.restHr);
  }

  // Herbouw Zones-tab als we (nieuwe) zones hebben
  if (powerBoundaries || hrBoundaries) {
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
    var avg  = powerAvg_(a);
    var norm = powerNorm_(a);
    var ifv  = a.icu_intensity ?? a.intensity ?? null;
    var tss  = a.icu_training_load ?? a.training_load ?? a.tss ?? null;
    var pi   = a.polarization_index ?? a.icu_polarization_index ?? null;
    var ahr  = a.average_heartrate ?? a.avg_hr ?? null;
    var mhr  = a.max_heartrate ?? a.max_hr ?? null;

    return [
      a.start_date_local ? new Date(a.start_date_local) : '',
      a.type || '',
      a.name || '',
      a.moving_time != null ? Math.round(a.moving_time / 60) : '',
      a.distance    != null ? Math.round(a.distance / 100) / 10 : '',
      avg  != null ? avg  : '',
      norm != null ? norm : '',
      ifv  != null ? Math.round(ifv  * 100) / 100 : '',
      tss  != null ? Math.round(tss) : '',
      ahr  != null ? ahr  : '',
      mhr  != null ? mhr  : '',
      pi   != null ? Math.round(pi   * 100) / 100 : ''
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

// ── Activity field fallback helpers ──────────────────────────────

/**
 * Gemiddeld vermogen — probeert meerdere veldnaam-varianten.
 * intervals.icu gebruikt soms icu_average_watts (eigen berekening),
 * soms average_watts (Strava-pulled), soms avg_power (legacy).
 */
function powerAvg_(act) {
  return act.icu_average_watts ?? act.average_watts ?? act.avg_power ?? null;
}

/**
 * Normalized Power — idem, meerdere mogelijke veldnamen.
 */
function powerNorm_(act) {
  return act.icu_weighted_avg_watts ?? act.weighted_average_watts
      ?? act.normalized_power ?? act.icu_normalized_power ?? null;
}

/**
 * Fallback: pakt sweet_spot_min/max uit de meest recente activity die
 * power-data heeft. intervals.icu vult per activity icu_sweet_spot_min/max
 * in op basis van de athlete's huidige instellingen, ook al staan ze niet
 * direct op het athlete-object.
 */
function sweetSpotFromActivity_() {
  var data = getActivities(14);
  if (!Array.isArray(data) || !data.length) return null;
  // getActivities sorteert oldest-first → iterate van eind voor nieuwste eerst.
  for (var i = data.length - 1; i >= 0; i--) {
    var a = data[i];
    var min = a.icu_sweet_spot_min ?? a.sweet_spot_min ?? null;
    var max = a.icu_sweet_spot_max ?? a.sweet_spot_max ?? null;
    if (min != null && max != null) {
      return { min: min, max: max, activityName: a.name || '?' };
    }
  }
  return null;
}

// ── Zone resolver ────────────────────────────────────────────────

/**
 * Normaliseert een zone-array naar een boundary-array (numbers).
 * - [55, 75, 90, ...] → return as-is
 * - [{min,max,name}, ...] → extract .max (of .upper) per zone
 */
function normalizeZones_(zones) {
  if (!Array.isArray(zones) || !zones.length) return null;
  if (typeof zones[0] === 'number') return zones;
  if (typeof zones[0] === 'object') {
    var mapped = zones.map(function (z) {
      return z.max ?? z.upper ?? z.maxPct ?? z.upperPct ?? z.high ?? null;
    }).filter(function (v) { return v != null; });
    return mapped.length ? mapped : null;
  }
  return null;
}

/**
 * Probeert in volgorde meerdere mogelijke locaties voor power_zones in
 * het athlete-object. Logt welke variant getroffen werd; bij geen match
 * logt het de top-level keys zodat we kunnen zien wat we missen.
 */
function resolvePowerZones_(athlete) {
  return resolveZones_(athlete, 'power_zones');
}

function resolveHrZones_(athlete) {
  return resolveZones_(athlete, 'hr_zones');
}

function resolveZones_(athlete, kind) {
  if (!athlete) return null;
  var icuKey = 'icu_' + kind;

  var candidates = [];
  // Variant a/b: direct op athlete (icu_ prefix of plain)
  candidates.push({ source: icuKey, value: athlete[icuKey] });
  candidates.push({ source: kind,   value: athlete[kind] });
  // Variant c: bio-nested
  if (athlete.bio) {
    candidates.push({ source: 'bio.' + icuKey, value: athlete.bio[icuKey] });
    candidates.push({ source: 'bio.' + kind,   value: athlete.bio[kind] });
  }
  // Variant d: sportSettings array — pak de entry waar types 'Ride' bevat
  if (Array.isArray(athlete.sportSettings)) {
    for (var i = 0; i < athlete.sportSettings.length; i++) {
      var s = athlete.sportSettings[i];
      var types = s && s.types;
      var isRide = Array.isArray(types) && types.indexOf('Ride') >= 0;
      if (isRide) {
        candidates.push({ source: 'sportSettings[Ride].' + icuKey, value: s[icuKey] });
        candidates.push({ source: 'sportSettings[Ride].' + kind,   value: s[kind] });
        break;
      }
    }
  }

  for (var j = 0; j < candidates.length; j++) {
    var normalized = normalizeZones_(candidates[j].value);
    if (normalized) {
      console.log(kind + ' bron: ' + candidates[j].source + ' → ' + JSON.stringify(normalized));
      return normalized;
    }
  }

  console.warn('Geen ' + kind + ' gevonden. Athlete keys: ' +
               Object.keys(athlete).sort().join(', '));
  if (athlete.bio) {
    console.warn('  bio keys: ' + Object.keys(athlete.bio).sort().join(', '));
  }
  if (Array.isArray(athlete.sportSettings)) {
    console.warn('  sportSettings: ' + athlete.sportSettings.length + ' entries');
    athlete.sportSettings.forEach(function (s, i) {
      console.warn('    [' + i + '] types=' + JSON.stringify(s && s.types) +
                   ' keys=' + (s ? Object.keys(s).sort().join(',') : ''));
    });
  }
  return null;
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
