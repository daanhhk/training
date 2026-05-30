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

  // Reconcile planner — tick Gedaan-checkboxes voor activities die matchen
  try {
    var marked = reconcilePlannerWithActivities();
    if (marked > 0) console.log('Reconcile: ' + marked + ' planner-rij(en) auto-marked als Gedaan.');
  } catch (err) {
    errors.push('Reconcile: ' + err.message);
    console.error('reconcilePlannerWithActivities', err);
  }

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

// ── Push voorstel naar Garmin via intervals.icu ─────────────────

/**
 * Pakt alle toekomstige Train=TRUE/Gedaan=FALSE dagen uit Weekplanner,
 * leest het opgeslagen workout-voorstel uit DocProps en pusht via
 * IntervalsApi.pushWorkout naar intervals.icu kalender.
 *
 * Vereist: eerst Menu → Genereer voorstel (vult de DocProps).
 */
function pushAllPendingWorkouts() {
  var ss = SpreadsheetApp.getActive();
  var ui;
  try { ui = SpreadsheetApp.getUi(); } catch (e) {}

  var planner = readPlanner(ss);
  var today = new Date();
  today.setHours(0, 0, 0, 0);

  var pending = planner.filter(function (d) {
    if (!d.train || d.gedaan || !d.datum) return false;
    var day = new Date(d.datum.getFullYear(), d.datum.getMonth(), d.datum.getDate());
    return day >= today;
  });

  if (!pending.length) {
    if (ui) ui.alert('Geen workouts om te pushen — alle toekomstige dagen zijn al gedaan of leeg.');
    return;
  }

  // Bouw alle event-payloads, één call naar /events/bulk?upsert=true
  var events = [];
  var skipped = [];

  pending.forEach(function (d) {
    var dateISO = formatDate(d.datum, 'yyyy-MM-dd');
    var raw = getDocProp('proposal_' + dateISO, '');
    if (!raw) {
      skipped.push(d.dag + ' (' + dateISO + '): geen opgeslagen voorstel — Genereer voorstel eerst.');
      return;
    }
    try {
      var wo = JSON.parse(raw);
      events.push(buildEventPayload(wo, dateISO, 'Ride'));
    } catch (e) {
      skipped.push(d.dag + ' (' + dateISO + '): ' + e.message);
    }
  });

  if (!events.length) {
    if (ui) ui.alert('Niets om te pushen', skipped.join('\n') || 'Geen geldige voorstellen.', ui.ButtonSet.OK);
    return;
  }

  ss.toast('Pushing ' + events.length + ' workouts in 1 bulk call...', '🚴 Coach', 5);
  try {
    var response = pushEvents_(events);
    var pushedCount = Array.isArray(response) ? response.length : events.length;
    var msg = '✅ ' + pushedCount + ' workouts gepusht naar intervals.icu (upsert).\n' +
              'Re-push met dezelfde external_id triggert update i.p.v. duplicate.\n' +
              'Synct binnen 1-2 minuten naar Garmin Epix.';
    if (skipped.length) {
      msg += '\n\n⚠️ Overgeslagen:\n' + skipped.join('\n');
    }
    if (ui) ui.alert('Push voltooid', msg, ui.ButtonSet.OK);
  } catch (e) {
    console.error('pushAllPendingWorkouts bulk failed', e);
    var fmsg = '❌ Bulk push mislukt: ' + e.message;
    if (skipped.length) fmsg += '\n\nOvergeslagen:\n' + skipped.join('\n');
    if (ui) ui.alert('Push mislukt', fmsg, ui.ButtonSet.OK);
  }
}

// ── Reconcile planner met activities ─────────────────────────────

/**
 * Loopt door alle planner-rijen waar Train=TRUE en Gedaan=FALSE; checkt
 * of er een matching activity bestaat in de Activiteiten-tab. Match-criteria:
 *   - Datum: activity start_date_local valt binnen de plannerdag
 *   - Type:  activity type bevat 'ride' of 'run'
 *   - Duur:  activity duur ≥ 50% van geplande duur
 * Bij match → tikt de Gedaan-checkbox aan.
 *
 * @return aantal rijen dat auto-marked werd
 */
function reconcilePlannerWithActivities() {
  var ss = SpreadsheetApp.getActive();
  var planner = readPlanner(ss);
  var actSheet = ss.getSheetByName(ACTIVITEITEN_SHEET);
  if (!actSheet) return 0;

  var lastRow = actSheet.getLastRow();
  if (lastRow < 2) return 0;

  // Activiteiten kolommen: A=Datum B=Type C=Naam D=Duur(min) ...
  var actData = actSheet.getRange(2, 1, lastRow - 1, ACT_HEADERS.length).getValues();
  var pSheet = ss.getSheetByName(PLANNER_SHEET);
  var marked = 0;

  planner.forEach(function (d) {
    if (!d.train || d.gedaan || !d.datum) return;

    var dayStart = new Date(d.datum.getFullYear(), d.datum.getMonth(), d.datum.getDate());
    var dayEnd   = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    for (var i = 0; i < actData.length; i++) {
      var actDate = actData[i][0];
      if (!(actDate instanceof Date)) continue;
      if (actDate < dayStart || actDate >= dayEnd) continue;

      var actType = String(actData[i][1] || '').toLowerCase();
      if (actType.indexOf('ride') < 0 && actType.indexOf('run') < 0) continue;

      var actMin = Number(actData[i][3]) || 0;
      if (d.minuten > 0 && actMin < d.minuten * 0.5) continue;

      // Match — tik Gedaan aan
      pSheet.getRange(3 + d.dagIdx, 8).setValue(true);
      console.log('Auto-marked Gedaan: ' + d.dag + ' ' + formatDate(d.datum, 'dd-MM') +
                  ' (matched: ' + actData[i][2] + ', ' + actMin + ' min)');
      marked++;
      break;
    }
  });

  return marked;
}

// ── Trigger management ───────────────────────────────────────────

var SYNC_HANDLER = 'syncAll';

function installDailySyncTrigger() {
  // Idempotent: verwijder eerst bestaande syncAll-triggers, dan één nieuwe.
  removeDailySyncTrigger_();
  ScriptApp.newTrigger(SYNC_HANDLER)
    .timeBased()
    .atHour(8)
    .everyDays(1)
    .inTimezone(TZ)
    .create();
  var ui;
  try { ui = SpreadsheetApp.getUi(); } catch (e) {}
  if (ui) ui.alert('Dagelijkse sync geïnstalleerd — draait elke ochtend rond 08:00 (Europe/Amsterdam).');
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

// ── Scope-B: athlete autocast (FTP + gewicht uit intervals.icu) ──

var ATHLETE_SYNC_HANDLER = 'syncAthleteFromIcu';

/**
 * Haalt athlete-data uit intervals.icu en updatet FTP/gewicht in
 * Settings IF de auto-update vinkjes aan staan. Sanity-bounds:
 * FTP 100-500W, gewicht 40-150kg. Stille fail zonder API-key.
 */
function syncAthleteFromIcu() {
  if (!getApiKey()) {
    console.warn('Geen intervals.icu API key — autocast geskipt');
    return;
  }

  var info;
  try { info = getAthleteInfo(); } catch (e) {
    console.warn('syncAthleteFromIcu: getAthleteInfo faalde: ' + e.message);
    return;
  }
  if (!info) return;
  var raw = info.raw || {};

  if (getFtpAutoUpdate()) {
    // Dynamische FTP uit sportSettings[Ride].mmp_model.ftp (intervals.icu's
    // rollende schatting per discipline). Fallback op entry.ftp (gebruikers-
    // instelling) en daarna info.ftp (huidige Settings-waarde = silent no-op).
    var newFtp = null, ftpSource = 'info.ftp (fallback)';
    if (Array.isArray(raw.sportSettings)) {
      for (var i = 0; i < raw.sportSettings.length; i++) {
        var s = raw.sportSettings[i];
        if (s && Array.isArray(s.types) && s.types.indexOf('Ride') >= 0) {
          if (s.mmp_model && s.mmp_model.ftp) {
            newFtp = s.mmp_model.ftp; ftpSource = 'sportSettings[Ride].mmp_model.ftp';
          } else if (s.ftp) {
            newFtp = s.ftp; ftpSource = 'sportSettings[Ride].ftp';
          }
          break;
        }
      }
    }
    if (newFtp == null) {
      console.warn('sportSettings[Ride] niet gevonden of zonder FTP — fallback op info.ftp');
      newFtp = info.ftp;
    }
    newFtp = Number(newFtp);
    if (newFtp && newFtp > 100 && newFtp < 500) {
      setFtp(newFtp);
      setFtpLastSync(new Date());
      console.log('FTP geüpdatet naar ' + newFtp + ' (bron: ' + ftpSource + ')');
    } else {
      console.warn('FTP-waarde verdacht: ' + newFtp + ' (bron: ' + ftpSource + ') — geskipt');
    }
  }

  if (getWeightAutoUpdate()) {
    var newWeight = Number(info.weight);
    if (newWeight && newWeight > 40 && newWeight < 150) {
      setGewicht(newWeight);
      setWeightLastSync(new Date());
      console.log('Gewicht geüpdatet naar ' + newWeight);
    } else {
      console.warn('Gewicht-waarde verdacht: ' + newWeight + ' — geskipt');
    }
  }
}

/**
 * Installeert/herinstalleert de wekelijkse athlete-sync trigger
 * (zondag 23:00 Europe/Amsterdam). Idempotent.
 */
function installAthleteSyncTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === ATHLETE_SYNC_HANDLER) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger(ATHLETE_SYNC_HANDLER)
    .timeBased()
    .everyWeeks(1)
    .onWeekDay(ScriptApp.WeekDay.SUNDAY)
    .atHour(23)
    .inTimezone(TZ)
    .create();
  var ui;
  try { ui = SpreadsheetApp.getUi(); } catch (e) {}
  if (ui) ui.alert('Athlete-sync trigger geïnstalleerd — zondag 23:00 (Europe/Amsterdam).');
}
