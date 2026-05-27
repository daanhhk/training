/**
 * IntervalsApi.gs — intervals.icu REST API laag.
 *
 * Auth: HTTP Basic met username "API_KEY" en password = API key uit
 * intervals.icu Developer Settings. Credentials worden uit
 * DocumentProperties gelezen ('intervals_api_key' + 'intervals_athlete_id').
 *
 * Error handling: descriptive errors per HTTP status (401/403/404/429/5xx)
 * zodat de UI ze in een alert kan tonen.
 */

var INTERVALS_BASE_URL = 'https://intervals.icu/api/v1';

/** Prefix voor workout/event-namen — identifier voor onze gegenereerde
 *  workouts (gebruikt om bij re-push idempotent te kunnen verwijderen). */
var COACH_NAME_PREFIX = '🚴 Coach: ';

/**
 * Private helper — bouwt URL, voegt auth toe, parsed JSON, vertaalt
 * HTTP-fouten naar leesbare exceptions.
 *
 * @param {string} endpoint  Path beginnend met /, ondersteunt {id} placeholder
 * @param {object=} options  { method, payload, query }
 * @return {*} parsed JSON response, of null als body leeg
 */
function intervalsRequest_(endpoint, options) {
  options = options || {};

  var apiKey = getDocProp('intervals_api_key', '');
  var athleteId = getDocProp('intervals_athlete_id', '');
  if (!apiKey)    throw new Error('intervals.icu API key niet ingesteld in Instellingen (rij 22).');
  if (!athleteId) throw new Error('intervals.icu Athlete ID niet ingesteld in Instellingen (rij 21).');

  var path = endpoint.replace('{id}', athleteId);
  var url = INTERVALS_BASE_URL + path;

  if (options.query) {
    var qs = Object.keys(options.query).map(function (k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(options.query[k]);
    }).join('&');
    if (qs) url += (url.indexOf('?') === -1 ? '?' : '&') + qs;
  }

  var creds = Utilities.base64Encode('API_KEY:' + apiKey);
  var fetchOpts = {
    method: options.method || 'get',
    headers: {
      'Authorization': 'Basic ' + creds,
      'Accept': 'application/json'
    },
    muteHttpExceptions: true,
    followRedirects: true
  };
  if (options.payload) {
    fetchOpts.contentType = 'application/json';
    fetchOpts.payload = JSON.stringify(options.payload);
  }

  var resp;
  try {
    resp = UrlFetchApp.fetch(url, fetchOpts);
  } catch (e) {
    throw new Error('intervals.icu netwerkfout: ' + e.message);
  }

  var code = resp.getResponseCode();
  var body = resp.getContentText();

  if (code === 401) throw new Error('intervals.icu API error 401 — API key fout of geen toegang tot deze athlete.');
  if (code === 403) throw new Error('intervals.icu API error 403 — geen permissie voor deze resource.');
  if (code === 404) throw new Error('intervals.icu API error 404 — athlete of resource niet gevonden (athlete ID = "' + athleteId + '").');
  if (code === 429) throw new Error('intervals.icu rate limit (429) — probeer over een paar minuten opnieuw.');
  if (code >= 500) throw new Error('intervals.icu server error ' + code + ' — probeer later opnieuw.');
  if (code >= 400) throw new Error('intervals.icu API error ' + code + ': ' + (body || '').substring(0, 200));

  if (!body) return null;
  try {
    return JSON.parse(body);
  } catch (e) {
    throw new Error('intervals.icu response is geen geldige JSON: ' + body.substring(0, 200));
  }
}

/**
 * Test de API verbinding door /athlete/{id} op te halen.
 * Returns true bij success, gooit error bij falen.
 */
function testConnection() {
  intervalsRequest_('/athlete/{id}');
  return true;
}

/**
 * Haalt athlete info op (FTP, zones, gewicht, etc.).
 * Returnt object met genormaliseerde veldnamen; ontbrekende velden null.
 */
function getAthleteInfo() {
  var data = intervalsRequest_('/athlete/{id}') || {};
  return {
    ftp:            data.icu_ftp            != null ? data.icu_ftp            : (data.ftp || null),
    lthr:           data.lthr               != null ? data.lthr               : null,
    maxHr:          data.icu_max_hr         != null ? data.icu_max_hr         : (data.max_hr || null),
    restHr:         data.icu_resting_hr     != null ? data.icu_resting_hr     : (data.resting_hr || null),
    weight:         data.icu_weight         != null ? data.icu_weight         : (data.weight || null),
    sex:            data.sex                || null,
    power_zones:    data.icu_power_zones    || data.power_zones    || null,
    hr_zones:       data.icu_hr_zones       || data.hr_zones       || null,
    threshold_pace: data.icu_threshold_pace || data.threshold_pace || null,
    raw:            data
  };
}

/**
 * Haalt activiteiten op vanaf today - daysBack tot today.
 * Returns array, oudste eerst.
 */
function getActivities(daysBack) {
  daysBack = daysBack || 28;
  var today = new Date();
  var oldest = new Date(today.getTime() - daysBack * 86400000);

  // Geen 'fields' parameter — we halen volledige activity-objecten
  // zodat we via fallback-helpers (powerAvg_/powerNorm_) alternatieve
  // veldnamen kunnen proberen. 28 dagen rides past prima in één call.
  var data = intervalsRequest_('/athlete/{id}/activities', {
    query: {
      oldest: formatDate(oldest, 'yyyy-MM-dd'),
      newest: formatDate(today, 'yyyy-MM-dd')
    }
  });

  if (!Array.isArray(data)) return [];
  data.sort(function (a, b) {
    return new Date(a.start_date_local) - new Date(b.start_date_local);
  });
  return data;
}

/**
 * Haalt wellness data op (HRV, RHR, slaap, etc.) voor laatste daysBack dagen.
 * Returns array (volgorde zoals API teruggeeft).
 */
function getWellness(daysBack) {
  daysBack = daysBack || 30;
  var today = new Date();
  var oldest = new Date(today.getTime() - daysBack * 86400000);

  var data = intervalsRequest_('/athlete/{id}/wellness', {
    query: {
      oldest: formatDate(oldest, 'yyyy-MM-dd'),
      newest: formatDate(today, 'yyyy-MM-dd')
    }
  });

  if (!Array.isArray(data)) return [];
  return data;
}

/**
 * Push een workout naar intervals.icu kalender als WORKOUT event.
 * intervals.icu synct events automatisch naar gekoppelde Garmin devices
 * (verschijnt op Garmin Epix als "Geplande training" binnen 1-2 minuten).
 *
 * Eerste versie: alleen description-tekst (leesbaar op Garmin). Het
 * gestructureerde workout_doc format kan later worden toegevoegd voor
 * step-by-step coaching op het horloge.
 *
 * @param workout  object met { naam, totaalMin, focus, structuur, tss, eindopmerking }
 * @param dateISO  'yyyy-MM-dd' string — datum waarop het op de kalender komt
 * @param type     'Ride' | 'Run' | etc. (default 'Ride')
 * @return parsed response body van intervals.icu
 */
function pushWorkout(workout, dateISO, type) {
  if (!workout || !workout.naam) throw new Error('pushWorkout: geen geldig workout-object.');
  if (!dateISO || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
    throw new Error('pushWorkout: dateISO moet yyyy-MM-dd zijn (kreeg "' + dateISO + '").');
  }
  type = type || 'Ride';

  var prefixedName = COACH_NAME_PREFIX + workout.naam;
  var description  = buildWorkoutDescription_(workout);
  var doc          = buildWorkoutDoc_(workout);

  // Library-route is verplicht voor structured workouts: /events negeert
  // het embedded workout_doc veld stilletjes. We maken eerst een library
  // workout aan, dan een event dat ernaar verwijst via workout_id.
  var folderId = ensureCoachFolderId_();

  var libPayload = {
    name: prefixedName,
    type: type,
    description: description
  };
  if (doc) {
    libPayload.workout_doc = doc;
    libPayload.moving_time = doc.duration;
    console.log('pushWorkout: structured ' + doc.steps.length + ' steps, ' + doc.duration + 's totaal');
  } else {
    console.log('pushWorkout: description-only (kon structuur niet mappen)');
  }

  var libWorkout = intervalsRequest_(
    '/athlete/{id}/folders/' + folderId + '/workouts',
    { method: 'post', payload: libPayload }
  );
  Logger.log('POST /folders/{id}/workouts RAW RESPONSE:');
  Logger.log(JSON.stringify(libWorkout, null, 2));

  // Step 2: maak event dat de library workout pakt
  var eventPayload = {
    category: 'WORKOUT',
    start_date_local: dateISO + 'T00:00:00',
    type: type,
    name: prefixedName,
    workout_id: libWorkout && libWorkout.id,
    targets: ['POWER']
  };

  var event = intervalsRequest_('/athlete/{id}/events', {
    method: 'post',
    payload: eventPayload
  });
  Logger.log('POST /events RAW RESPONSE:');
  Logger.log(JSON.stringify(event, null, 2));

  return { library_workout: libWorkout, event: event };
}

/**
 * Vindt of creëert de "Coach Generated" folder in de library.
 * Folder-id wordt gecached in DocProps voor hergebruik.
 */
function ensureCoachFolderId_() {
  var cached = getDocProp('coach_folder_id', '');
  if (cached) return Number(cached);

  // Zoek bestaande folder met "coach" in de naam
  try {
    var folders = intervalsRequest_('/athlete/{id}/folders');
    if (Array.isArray(folders)) {
      for (var i = 0; i < folders.length; i++) {
        if (/coach/i.test(folders[i].name || '')) {
          console.log('ensureCoachFolderId_: hergebruik bestaande folder "' +
                      folders[i].name + '" (id ' + folders[i].id + ')');
          setDocProp('coach_folder_id', folders[i].id);
          return folders[i].id;
        }
      }
    }
  } catch (e) {
    console.warn('ensureCoachFolderId_: folders lookup failed: ' + e.message);
  }

  // Niet gevonden → creëer nieuw
  var created = intervalsRequest_('/athlete/{id}/folders', {
    method: 'post',
    payload: { name: 'Coach Generated', type: 'FOLDER' }
  });
  if (!created || !created.id) {
    throw new Error('Kon "Coach Generated" folder niet aanmaken.');
  }
  console.log('ensureCoachFolderId_: created folder "' + created.name +
              '" (id ' + created.id + ')');
  setDocProp('coach_folder_id', created.id);
  return created.id;
}

/**
 * Vertaalt onze workout.structuur (5-koloms array per segment) naar
 * intervals.icu's workout_doc format. Returnt null als één of meer
 * segmenten niet geparsed kunnen worden — caller valt dan terug op
 * description-only push.
 *
 * Step formats (uit JOIN voorbeeld geverifieerd):
 *   - Steady:  { power: {units:'%ftp', value: N}, duration: seconds }
 *   - Ramp:    { ramp:true, power: {start, end, units:'%ftp'}, warmup, duration }
 *   - Repeat:  { reps: N, text: 'Nx', steps: [work, rest], duration: total }
 *
 * Targets unit = %ftp (intervals.icu canonical); watts uit structuur
 * worden naar %FTP omgezet via de FTP uit DocumentProperties.
 */
function buildWorkoutDoc_(workout) {
  if (!workout || !Array.isArray(workout.structuur) || !workout.structuur.length) return null;

  var ftp = Number(getDocProp('ftp', '275')) || 275;
  var steps = [];

  for (var i = 0; i < workout.structuur.length; i++) {
    var row = workout.structuur[i];
    var step = parseStructStep_(row, ftp);
    if (!step) {
      console.log('buildWorkoutDoc_: kon segment niet parsen, val terug op description: ' + JSON.stringify(row));
      return null;
    }
    steps.push(step);
  }

  var totalSec = steps.reduce(function (sum, s) { return sum + (s.duration || 0); }, 0);
  return {
    steps: steps,
    options: {},
    distance: 0,
    duration: totalSec,
    description: workout.eindopmerking || ''
  };
}

function parseStructStep_(row, ftp) {
  var name   = String(row[0] || '');
  var durStr = String(row[1] || '');
  var powStr = String(row[2] || '');
  var note   = String(row[4] || '');

  // Repeat-loop: "Nx M min" of "Nx M sec"
  var repMatch = /^\s*(\d+)\s*x\s*(\d+)\s*(min|sec|s)\b/i.exec(durStr);
  if (repMatch) {
    var reps    = parseInt(repMatch[1], 10);
    var workDur = parseInt(repMatch[2], 10);
    var workSec = /min/i.test(repMatch[3]) ? workDur * 60 : workDur;

    var workPow = parsePowerToPct_(powStr, ftp);
    if (!workPow) return null;
    var workStep = { duration: workSec, power: workPow };

    var rest = parseRestFromNote_(note);
    var children = [workStep];
    if (rest && rest.duration > 0) {
      children.push({ duration: rest.duration, power: { units: '%ftp', value: rest.pct } });
    }

    var perRepSec = workSec + (rest ? rest.duration : 0);
    return {
      reps: reps,
      text: reps + 'x',
      steps: children,
      distance: 0,
      duration: reps * perRepSec
    };
  }

  // Enkele step — parse duur
  var seconds = parseDurationSec_(durStr);
  if (!seconds) return null;

  var isWarmup   = /warm[ -]?up|inrijden|opbouw/i.test(name + ' ' + note);
  var isCooldown = /cool[ -]?down|uitrijden|easy uit/i.test(name + ' ' + note);

  var step = { duration: seconds };
  var pow  = parsePowerToPct_(powStr, ftp);

  if (isWarmup && pow && pow.value != null) {
    // Warmup: convert single midpoint naar ramp van laag → midden
    step.ramp = true;
    step.warmup = true;
    step.power = {
      units: '%ftp',
      start: Math.max(40, pow.value - 20),
      end:   pow.value
    };
  } else {
    if (pow) step.power = pow;
    if (isCooldown) step.cooldown = true;
  }

  return step;
}

/**
 * Parse "151-192W" / "240W" / "> 240W" → {units:'%ftp', value:pct}.
 * Range → midpoint. Returnt null bij parse-failure (lege string, HR-only,
 * placeholder '—').
 */
function parsePowerToPct_(powStr, ftp) {
  if (!powStr || powStr === '—') return null;

  var rangeMatch = /(\d+)\s*[-–]\s*(\d+)\s*W/i.exec(powStr);
  if (rangeMatch) {
    var lo = parseInt(rangeMatch[1], 10);
    var hi = parseInt(rangeMatch[2], 10);
    var midWatt = (lo + hi) / 2;
    return { units: '%ftp', value: Math.round(midWatt / ftp * 100) };
  }

  var singleMatch = />?\s*(\d+)\s*W/i.exec(powStr);
  if (singleMatch) {
    var w = parseInt(singleMatch[1], 10);
    return { units: '%ftp', value: Math.round(w / ftp * 100) };
  }

  return null;
}

function parseDurationSec_(str) {
  if (!str) return 0;
  // "15 min" of "15min"
  var m = /(\d+)\s*min/i.exec(str);
  if (m) return parseInt(m[1], 10) * 60;
  // "30s" of "30 s"
  var s = /(\d+)\s*s\b/i.exec(str);
  if (s) return parseInt(s[1], 10);
  return 0;
}

/**
 * Parse rest spec uit toelichting: "5 min rust @ 50%" / "3 min rust" / "5 min rust @ 50% tussen reps".
 * Default rest pct = 50%.
 */
function parseRestFromNote_(note) {
  if (!note) return null;
  var m = /(\d+)\s*min\s+(rust|pauze|recovery)/i.exec(note);
  if (!m) return null;
  var minutes = parseInt(m[1], 10);
  var pctMatch = /@\s*(\d+)\s*%/i.exec(note);
  return { duration: minutes * 60, pct: pctMatch ? parseInt(pctMatch[1], 10) : 50 };
}

/**
 * Bouwt een multi-line description string die zowel in intervals.icu's
 * kalender als op Garmin Epix leesbaar is. Per segment één regel:
 *   "Warmup 15 min @ 150-200W"
 * Eindopmerking wordt afgekapt op 200 chars (Garmin notitie-limiet).
 */
function buildWorkoutDescription_(workout) {
  var lines = [];
  lines.push(workout.naam + ' — ' + (workout.totaalMin || '?') + 'min' +
             (workout.tss ? ' (TSS ' + workout.tss + ')' : ''));
  if (workout.focus) lines.push('Focus: ' + workout.focus);
  lines.push('');

  if (Array.isArray(workout.structuur)) {
    workout.structuur.forEach(function (seg) {
      // seg = [Segment, Duur, Vermogen, Hartslag, Toelichting]
      var label = seg[0] || '';
      var dur   = seg[1] || '';
      var pow   = seg[2] || '';
      lines.push(label + ' ' + dur + (pow ? ' @ ' + pow : ''));
    });
  }

  if (workout.eindopmerking) {
    lines.push('');
    var note = String(workout.eindopmerking);
    lines.push(note.length > 200 ? note.substring(0, 197) + '...' : note);
  }

  return lines.join('\n');
}

/**
 * Diagnostiek: haalt 1 bestaande WORKOUT-event op uit Daan's kalender,
 * plus folders-endpoint, zodat we de exacte structured-workout format
 * van intervals.icu kunnen leren. Resultaat → Executions → console.
 */
function debugExistingWorkout() {
  var athleteId = getDocProp('intervals_athlete_id', '');
  if (!athleteId) throw new Error('Athlete ID niet ingesteld in Instellingen.');

  // Probeer events met category=WORKOUT — laatste 2 maanden
  var today = Utilities.formatDate(new Date(), 'Europe/Amsterdam', 'yyyy-MM-dd');
  var twoMonthsAgo = Utilities.formatDate(
    new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    'Europe/Amsterdam', 'yyyy-MM-dd');

  console.log('=== EVENTS endpoint (category=WORKOUT) ===');
  var events;
  try {
    events = intervalsRequest_(
      '/athlete/' + athleteId + '/events?oldest=' + twoMonthsAgo +
      '&newest=' + today + '&category=WORKOUT');
    console.log('Count: ' + (events ? events.length : 0));
    if (Array.isArray(events) && events.length) {
      console.log('=== FIRST WORKOUT FULL JSON ===');
      console.log(JSON.stringify(events[0], null, 2));
      console.log('=== EVENT KEYS ===');
      console.log(Object.keys(events[0]).sort().join(', '));
    }
  } catch (e) {
    console.log('Events endpoint error: ' + e.message);
  }

  // Probeer folders endpoint
  console.log('=== FOLDERS endpoint ===');
  try {
    var folders = intervalsRequest_('/athlete/' + athleteId + '/folders');
    console.log(JSON.stringify(folders, null, 2).substring(0, 2000));
  } catch (e) {
    console.log('Folders endpoint error: ' + e.message);
  }

  // Probeer workouts endpoint (library)
  console.log('=== WORKOUTS endpoint (library) ===');
  try {
    var lib = intervalsRequest_('/athlete/' + athleteId + '/workouts');
    if (Array.isArray(lib) && lib.length) {
      console.log('Library count: ' + lib.length);
      console.log('=== FIRST LIBRARY WORKOUT ===');
      console.log(JSON.stringify(lib[0], null, 2));
    } else {
      console.log('Library leeg of niet beschikbaar.');
    }
  } catch (e) {
    console.log('Workouts library endpoint error: ' + e.message);
  }

  SpreadsheetApp.getActive().toast(
    'Debug log geschreven — Apps Script Editor → Executions',
    '🚴 Coach', 8);
}

/**
 * Diagnostiek: logt het volledige athlete-object + eerste activity zodat
 * we kunnen zien welke veldnamen intervals.icu gebruikt voor deze account.
 * Resultaat staat in Apps Script Editor → Executions → expand console output.
 */
function debugApiResponse() {
  var athleteId = getDocProp('intervals_athlete_id', '');
  if (!athleteId) throw new Error('Athlete ID niet ingesteld in Instellingen.');

  console.log('=== ATHLETE OBJECT (volledige JSON) ===');
  var athlete = intervalsRequest_('/athlete/' + athleteId);
  console.log(JSON.stringify(athlete, null, 2));

  var today = Utilities.formatDate(new Date(), 'Europe/Amsterdam', 'yyyy-MM-dd');
  var weekAgo = Utilities.formatDate(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    'Europe/Amsterdam', 'yyyy-MM-dd');
  var activities = intervalsRequest_(
    '/athlete/' + athleteId + '/activities?oldest=' + weekAgo + '&newest=' + today);

  console.log('=== EERSTE ACTIVITY (volledige JSON) ===');
  if (Array.isArray(activities) && activities.length) {
    console.log(JSON.stringify(activities[0], null, 2));
    console.log('=== ACTIVITY KEYS ===');
    console.log(Object.keys(activities[0]).sort().join(', '));
  } else {
    console.log('Geen activiteiten in de laatste 7 dagen.');
  }

  SpreadsheetApp.getActive().toast(
    'Debug log geschreven — Apps Script Editor → Executions',
    '🚴 Coach', 8);
}
