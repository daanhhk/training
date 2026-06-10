/**
 * Algorithm.gs — Core: assignWorkouts + generieke workouts + buildWorkout
 * router naar doel-specifieke libraries (Workouts/Ftp, Vo2max, Conditie,
 * Beklimmingen). Bevat ook generateProposal() entry point.
 *
 * Zone-aware load focus: low (Z1-Z2), high (Z3-Z4+), anaerobic (Z5+).
 * Mesocyclus modifiers: 1.00 / 1.08 / 1.15 / 0.60 (recovery).
 * Macro-fase intensiteits-boost gebeurt binnen workout-libraries.
 */

var MESO_MOD = { 1: 1.00, 2: 1.08, 3: 1.15, 4: 0.60 };

// Feedback-loop drempels.
var DEKKING_MIN_MIN     = 15;   // ≥15min werkelijk in bucket = gedekt
var DEBT_FORCE_HIGH_MIN = 30;   // high-debt > 30min → force weekend combo
var DEBT_FORCE_ANAER_MIN = 20;  // anaerobic-debt > 20min → idem

// Volume-advies drempels (informatief).
var VOLUME_ADVIES_MIN_TEKORT   = 60;   // niet adviseren onder 60min tekort
var VOLUME_ADVIES_MAX_SUGGESTIE = 120; // cap suggestie per rit op 120min

// Compensatie-suggesties voor open vrije dagen (feedback-blok).
var SUGGESTIE_MAX_MIN = 90; // cap op voorgestelde duur per vrije dag
var SUGGESTIE_MIN_MIN = 30; // onder dit niveau geen suggestie

/**
 * Target uren/week per macroFase, op basis van de gekozen profiel-preset
 * uit Settings. 'Gevorderd 7u' (default) reproduceert het pre-scope-B
 * gedrag exact. 'Custom' valt v1 terug op 'Gevorderd 7u'.
 */
function getVolumeTargets() {
  var presets = {
    'Amateur 3u':   { Base: [2, 4],  Build: [3, 5],   Peak: [3, 5],   Taper: [2, 3], Recovery: [1, 2] },
    'Gemiddeld 5u': { Base: [4, 6],  Build: [5, 7],   Peak: [5, 7],   Taper: [3, 4], Recovery: [2, 3] },
    'Gevorderd 7u': { Base: [4, 7],  Build: [6, 9],   Peak: [6, 9],   Taper: [3, 5], Recovery: [2, 4] },
    'Pro 10u+':     { Base: [8, 11], Build: [10, 14], Peak: [10, 14], Taper: [5, 7], Recovery: [3, 5] }
  };
  return presets[getProfielPreset()] || presets['Gevorderd 7u'];
}

// Activity-types die als fiets-volume tellen (incl. gravel/MTB).
var CYCLING_TYPES = ['Ride', 'VirtualRide', 'GravelRide', 'MountainBikeRide'];

function mesoFactor(week) {
  // b2: week-op-week demping (loadCarry, gezet door generateProposal) bovenop
  // de meso-ramp. Default 1 → geen demping als de prop niet gezet is.
  return (MESO_MOD[week] || 1.00) * (parseFloat(getDocProp('loadCarry', '1')) || 1);
}

/**
 * Entry point — gekoppeld aan menu item "Genereer voorstel voor deze week".
 */
function generateProposal() {
  cleanupOldProposals_();

  var ss = SpreadsheetApp.getActive();
  ensureCurrentWeek(ss);            // LAAG 2: rol planner naar huidige week
  var settings  = readSettings(ss);

  // Volgorde-onafhankelijke gemist-detectie + verse data.
  ensureDataAndReconcile_(ss);

  var weekStart = weekStartDate(new Date());
  var macro     = bepaalFaseVoorDatum_(weekStart);  // event-driven, valt terug op vaste meso
  var mesoWeek  = getMesoWeek();
  var loadCarry = loadCarryFactor_(mesoWeek);       // b2: week-op-week ramp-demping uit vorige-week-RPE
  setDocProp('loadCarry', loadCarry.factor);        // mesoFactor() leest dit DocProp
  var days      = readPlanner(ss);                  // nu met gereconcileerde Gedaan-vinkjes
  var wellness  = getWellnessSignal(ss);
  wellness      = combineSignals_(wellness, rpeSignal_());  // RPE-bijsturing → zelfde demote-pad
  var today     = stripTime_(new Date());

  // Split: voltooid / gemist / te plannen
  var voltooid  = days.filter(function (d) { return d.train && d.gedaan; });
  var missed    = days.filter(function (d) {
    return d.train && !d.gedaan && d.datum && stripTime_(d.datum) < today;
  });
  var tePlannen = days.filter(function (d) {
    return d.train && !d.gedaan && (!d.datum || stripTime_(d.datum) >= today);
  });

  // Feedback-loop: geplande intent vs werkelijke zone-times deze week.
  var feedback = computeZoneDebt_(ss, weekStart);

  // DEEL 2 — rollend dekkings-venster (laatste 7 dagen, over weekgrens heen)
  var rolling = rollingZoneCoverage(ss, 7);
  var dekking = { low: rolling.low > 0, high: rolling.high > 0, anaerobic: rolling.anaerobic > 0 };

  // Reeds-voltooide dagen van deze week: dekking op ACTUALS (≥DEKKING_MIN_MIN
  // werkelijke minuten in een bucket = gedekt). Fallback op intent-gebaseerde
  // marking als er geen zone-data (power én HR) is.
  var detailByDate = {};
  feedback.details.forEach(function (det) { detailByDate[det.datum] = det; });
  voltooid.forEach(function (d) {
    var det = d.datum ? detailByDate[formatDate(d.datum, 'yyyy-MM-dd')] : null;
    if (det && det.actual) {
      ['low', 'high', 'anaerobic'].forEach(function (b) {
        if ((det.actual[b] || 0) >= DEKKING_MIN_MIN) dekking[b] = true;
      });
    } else {
      // Geen zone-data → val terug op intent-gebaseerde marking (oud gedrag).
      workoutZones(d.voorgesteldType, settings.doel).forEach(function (z) { dekking[z] = true; });
    }
  });

  var klimType = (macro.hoofdEvent && macro.hoofdEvent.klimType) || null;
  var isTripEvent = !!(macro.hoofdEvent && macro.hoofdEvent.type === 'trip');
  var eventDate = macro.eventDate || (macro.hoofdEvent && macro.hoofdEvent.datum) || null;
  var recentHard = recentHardDayDate_(ss);
  // Taper-overlay (Deel 2): per-dag-gating rond het taper-event (A/trip 7 d of
  // near-B 3 d). macro.macroFase = de onderliggende periodisering (nooit Taper),
  // zodat niet-taper-dagen in een taper-week normaal worden toegewezen.
  var taperCtx = macro.taperEventDate
    ? { datum: macro.taperEventDate, venster: macro.taperVenster, isTrip: !!macro.taperIsTrip }
    : null;
  assignWorkouts(tePlannen, settings, mesoWeek, macro.macroFase, dekking, wellness, klimType, recentHard, feedback.debt, isTripEvent, eventDate, taperCtx);

  // Sync voorgesteldType terug naar planner (full days array)
  var byIdx = {};
  tePlannen.forEach(function (d) { byIdx[d.dagIdx] = d.voorgesteldType; });
  voltooid.forEach(function (d) { byIdx[d.dagIdx] = d.voorgesteldType; });
  missed.forEach(function (d) { byIdx[d.dagIdx] = ''; }); // gemist → leeg
  days.forEach(function (d) {
    if (byIdx.hasOwnProperty(d.dagIdx)) d.voorgesteldType = byIdx[d.dagIdx];
    else d.voorgesteldType = '';
  });
  writeVoorgesteldType(ss, days);

  // DEEL 4 — persisteer per-dag workout (proposal_<datum>) + weekplan-snapshot
  var eventCtx = eventContextFrom_(macro);
  var overrides = dashOverridesByDate_();   // day-overrides winnen bij her-plannen
  var weekplan = [];
  // Types die hun template ZELF schalen naar d.minuten (zie genericLongZ2 /
  // genericCombo). Voor andere types loggen we als template > 30min afwijkt.
  var SCALABLE_TYPES = { long_z2: 1, combo_long_with_efforts: 1 };
  // Knip-fix (a): bevries voorbije/niet-tePlannen dagen — behoud hun vorige
  // weekplan-entry i.p.v. retroactief herbouwen met nieuwe template-minuten.
  var prevByDate = {};
  try {
    var prevRaw = getDocProp('weekplan_' + formatDate(weekStart, 'yyyy-MM-dd'), '');
    if (prevRaw) {
      var prevArr = JSON.parse(prevRaw);
      if (Array.isArray(prevArr)) prevArr.forEach(function (e) { if (e && e.datum) prevByDate[e.datum] = e; });
    }
  } catch (e) {}
  var tePlannenSet = {};
  tePlannen.forEach(function (tp) { if (tp.datum) tePlannenSet[formatDate(tp.datum, 'yyyy-MM-dd')] = true; });
  days.forEach(function (d) {
    if (!d.datum) return;
    var dISO = formatDate(d.datum, 'yyyy-MM-dd');
    // Day-override wint: bouw de handmatig gekozen workout en sla de engine-afleiding
    // OVER (ook op een niet-train-dag → forceer de workout zonder het planner/
    // beschikbaarheids-model te muteren). Eén proposal-key-write, geen dubbele.
    if (overrides[dISO] && !d.gedaan) {
      var ovWo = buildOverrideWorkout_(overrides[dISO], settings, mesoWeek, macro.macroFase, eventCtx, d.dagIdx);
      if (ovWo) {
        writeDaySessions_(dISO, [ovWo]);
        weekplan.push(overrideWeekplanEntry_(dISO, overrides[dISO], ovWo));
        return;
      }
    }
    if (!d.train || !d.voorgesteldType) return;
    // Niet-tePlannen (voorbij/voltooid) + vorige entry aanwezig → bevries (geen retroactieve wijziging).
    if (!tePlannenSet[dISO] && prevByDate[dISO]) { weekplan.push(prevByDate[dISO]); return; }

    // v2b-B: pendel-dag expandeert naar pendelAantal sessies van pendelDuurMin;
    // overige dagen = één sessie van d.minuten (basiskey, ongewijzigd gedrag).
    var isPendel = d.type === 'pendel';
    var sessieCount = isPendel ? Math.max(1, Math.round(settings.pendelAantal) || 1) : 1;
    var sessieMin = isPendel ? (settings.pendelDuurMin || d.minuten) : d.minuten;

    var sessions = [], sessieTypes = [];
    for (var si = 0; si < sessieCount; si++) {
      // Asymmetrische pendel: vroege sessie(s) geforceerd Z2, laatste = engine-keuze
      // (d.voorgesteldType). Niet-pendel: altijd d.voorgesteldType (1 sessie).
      var sessieType = (isPendel && si < sessieCount - 1) ? 'pendel_z2' : d.voorgesteldType;
      // 2b.2: archetypeId reist mee met de ENGINE-sessie (laatste bij pendel); forced-Z2-sessies krijgen 'm niet.
      var sessieArch = (isPendel && si < sessieCount - 1) ? null : (d.archetypeId || null);
      var wo = buildWorkout(sessieType, sessieMin, settings, mesoWeek, macro.macroFase, eventCtx, d.dagIdx, sessieArch);
      if (wo) { sessions.push(wo); sessieTypes.push(sessieType); }
    }
    if (!sessions.length) return;

    if (!isPendel && !SCALABLE_TYPES[d.voorgesteldType] && d.minuten > 0 &&
        Math.abs(d.minuten - (sessions[0].totaalMin || 0)) > 30) {
      Logger.log('Workout-duur mismatch: dag=' + d.dag + ' type=' + d.voorgesteldType +
                 ' beschikbaar=' + d.minuten + 'min template=' + sessions[0].totaalMin + 'min');
    }

    writeDaySessions_(dISO, sessions);

    // Aggregaat-snapshot: top-level velden blijven werken (naam samengevat,
    // totaalMin/tss/intent = som, blokken/zones samengevoegd) + sessies[] forward-compat.
    var sumMin = 0, sumTss = 0;
    var aggIntent = { low: 0, high: 0, anaerobic: 0 };
    var aggBlok = [], zoneSet = {}, aggStruct = [];
    sessions.forEach(function (s) {
      sumMin += s.totaalMin || 0;
      sumTss += s.tss || 0;
      var it = ensureIntent_(s);
      ['low', 'high', 'anaerobic'].forEach(function (b) { aggIntent[b] += (it[b] || 0); });
      (s.blokken || []).forEach(function (b) { aggBlok.push(b); });
      (s.structuur || []).forEach(function (r) { aggStruct.push(r); });
      (s.zones || []).forEach(function (z) { zoneSet[z] = true; });
    });

    // Aggregaat-naam: gelijke sessies → "Pendel N× <m>m"; gemengd (Z2 + engine) → mix.
    var alleZelfde = sessieTypes.every(function (t) { return t === sessieTypes[0]; });
    var aggNaam = sessions.length > 1
      ? (alleZelfde ? ('Pendel ' + sessions.length + '× ' + sessieMin + 'm')
                    : ('Pendel Z2 + ' + settings.doel + ' intervallen'))
      : (sessions[0].naam || '');

    weekplan.push({
      datum: dISO,
      workoutType: d.voorgesteldType,
      archetypeId: d.archetypeId || null,   // 2b.2: traceability + recency-bron (null tot commit 2)
      naam: aggNaam,
      variantId: sessions[0].variantId || null,
      zones: Object.keys(zoneSet),
      intent: aggIntent,
      blokken: aggBlok.length ? aggBlok : null,
      structuur: aggStruct.length ? aggStruct : null,
      tss: Math.round(sumTss),
      minuten: Math.round(sumMin),
      reden: d.reden || '',   // v2c: per-dag rationale (leeg voor voltooid/missed)
      sessies: sessions.map(function (s) {
        // v2c-pendel: per-sessie intent (voor eigen zonebar) + eigen eindopmerking.
        return { naam: s.naam || '', totaalMin: s.totaalMin || 0, tss: Math.round(s.tss || 0),
                 intent: ensureIntent_(s), eindopmerking: s.eindopmerking || '' };
      })
    });
  });
  setDocProp('weekplan_' + formatDate(weekStart, 'yyyy-MM-dd'), JSON.stringify(weekplan));

  renderProposal(ss, days, voltooid, missed, settings, mesoWeek, macro, dekking, wellness, feedback);

  var prop = ss.getSheetByName(PROPOSAL_SHEET);
  if (prop) ss.setActiveSheet(prop);

  ss.toast('Voorstel gegenereerd ✓ — doel: ' + settings.doel + ', fase: ' + macro.fase +
           ' — wellness: ' + wellness.signal, '🚴 Coach', 7);
}

function stripTime_(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// ── DEEL 2 — rollend dekkings-venster ─────────────────────────────

/**
 * Zoekt de load-focus zones van een activiteit op een datum uit de
 * opgeslagen weekplan-snapshot (intent). Returnt zones-array of null.
 */
function intentZonesForDate_(d) {
  var ws = weekStartDate(d);
  var raw = getDocProp('weekplan_' + formatDate(ws, 'yyyy-MM-dd'), '');
  if (!raw) return null;
  try {
    var plan = JSON.parse(raw);
    var ds = formatDate(stripTime_(d), 'yyyy-MM-dd');
    for (var i = 0; i < plan.length; i++) {
      if (plan[i].datum === ds) return plan[i].zones || null;
    }
  } catch (e) {}
  return null;
}

/**
 * Telt recente stimulus per load-focus bucket over de laatste `daysBack`
 * dagen (over de kalenderweekgrens heen). Mapping per activiteit:
 *   a) gematchte geplande dag met opgeslagen intent → die zones
 *   b) anders heuristisch uit IF: ≥0,95 anaerobic / 0,85-0,95 high /
 *      <0,80 low / 0,80-0,85 high (sub-threshold tempo).
 * @return {low, high, anaerobic} counts
 */
function rollingZoneCoverage(ss, daysBack) {
  daysBack = daysBack || 7;
  var cov = { low: 0, high: 0, anaerobic: 0 };
  var sh = ss.getSheetByName(ACTIVITEITEN_SHEET);
  if (!sh) return cov;
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return cov;

  var data = sh.getRange(2, 1, lastRow - 1, ACT_HEADERS.length).getValues();
  var today = stripTime_(new Date());
  var cutoff = new Date(today.getTime() - daysBack * 24 * 60 * 60 * 1000);

  data.forEach(function (r) {
    var d = r[0];
    if (!(d instanceof Date)) return;
    if (stripTime_(d) < cutoff) return;
    if (CYCLING_TYPES.indexOf(String(r[1] || '')) < 0) return;  // alleen fiets — runs niet in dekking (v2d)

    var intentZones = intentZonesForDate_(d);
    if (intentZones && intentZones.length) {
      intentZones.forEach(function (z) { if (cov[z] != null) cov[z]++; });
      return;
    }
    var iff = Number(r[7]) || 0; // kolom 8 = IF
    if (iff >= 0.95)      cov.anaerobic++;
    else if (iff >= 0.85) cov.high++;
    else if (iff >= 0.80) cov.high++;
    else if (iff > 0)     cov.low++;
  });
  return cov;
}

/**
 * Datum van de meest recente "harde" sessie (high/anaerobic) uit de
 * Activiteiten-tab. Gebruikt voor avoid-consecutive-hard. Null indien geen.
 */
function recentHardDayDate_(ss) {
  var sh = ss.getSheetByName(ACTIVITEITEN_SHEET);
  if (!sh) return null;
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return null;
  var data = sh.getRange(2, 1, lastRow - 1, ACT_HEADERS.length).getValues();
  var best = null;
  data.forEach(function (r) {
    var d = r[0];
    if (!(d instanceof Date)) return;
    var hard = (Number(r[7]) || 0) >= 0.85;
    var iz = intentZonesForDate_(d);
    if (iz && (iz.indexOf('high') >= 0 || iz.indexOf('anaerobic') >= 0)) hard = true;
    if (hard) { var dd = stripTime_(d); if (!best || dd > best) best = dd; }
  });
  return best;
}

// ── FEEDBACK-LOOP (intent vs werkelijke zone-times) ───────────────

/**
 * Werkelijke tijd-in-zone (MINUTEN) per bucket uit een activity.
 * Router: power-zones eerst (nauwkeurigst), anders HR-zones (fallback
 * voor vrienden zonder powermeter / Daan's rare rit zonder power).
 * Return {low,high,anaerobic,source:'power'|'hr'} of null.
 *
 * @param zoneBoundaries ongebruikt — gereserveerd voor toekomst.
 */
function actualZoneMinutes_(activity, zoneBoundaries) {
  var p = tryPowerZoneTimes_(activity);
  if (p) { p.source = 'power'; return p; }
  var h = tryHrZoneTimes_(activity);
  if (h) { h.source = 'hr'; return h; }
  return null;
}

/**
 * Power-pad: icu_zone_times = [{id:'Z1',secs},...,{id:'Z7',secs},{id:'SS',secs}].
 * Z1-Z2 → low, Z3-Z4 → high, Z5-Z7 → anaerobic, SS/overig → skip (overlay).
 */
function tryPowerZoneTimes_(activity) {
  var zt = activity && activity.icu_zone_times;
  if (!zt || !Array.isArray(zt) || zt.length === 0) return null;
  var map = { Z1: 'low', Z2: 'low', Z3: 'high', Z4: 'high',
              Z5: 'anaerobic', Z6: 'anaerobic', Z7: 'anaerobic' };
  var b = { low: 0, high: 0, anaerobic: 0 };
  var saw = false;
  for (var i = 0; i < zt.length; i++) {
    var z = zt[i];
    if (!z || typeof z.id !== 'string') continue;
    var bk = map[z.id];              // 'SS' en overlays → undefined → skip
    if (!bk) continue;
    b[bk] += Number(z.secs) || 0;
    saw = true;
  }
  if (!saw) return null;
  return { low: b.low / 60, high: b.high / 60, anaerobic: b.anaerobic / 60 };
}

/**
 * HR-pad (fallback): icu_hr_zone_times = platte [7]-array seconden.
 * Index → bucket, zelfde verdeling als power: 0-1 low, 2-3 high, 4-6 anaerobic.
 * NB: HR loopt achter op power bij intervallen → meer 'low', minder
 * 'anaerobic' dan de power-meting. Verwacht gedrag, minder nauwkeurig.
 */
function tryHrZoneTimes_(activity) {
  var zt = activity && activity.icu_hr_zone_times;
  if (!zt || !Array.isArray(zt) || zt.length === 0) return null;
  var idxBucket = ['low', 'low', 'high', 'high', 'anaerobic', 'anaerobic', 'anaerobic'];
  var b = { low: 0, high: 0, anaerobic: 0 };
  var saw = false;
  for (var i = 0; i < Math.min(zt.length, 7); i++) {
    var secs = Number(zt[i]) || 0;
    if (secs <= 0) continue;
    b[idxBucket[i]] += secs;
    saw = true;
  }
  if (!saw) return null;
  return { low: b.low / 60, high: b.high / 60, anaerobic: b.anaerobic / 60 };
}

/** Primaire load-focus bucket van een workout-type. */
function typeBucket_(type, doel) {
  var z = workoutZones(type, doel);
  if (z.indexOf('anaerobic') >= 0) return 'anaerobic';
  if (z.indexOf('high') >= 0) return 'high';
  return 'low';
}

/**
 * Vergelijkt geplande intent (weekplan_<weekStart>) met werkelijke
 * zone-minuten van voltooide+gematchte dagen DEZE week.
 * debt[bucket] = Σ intent - Σ actual (positief = tekort).
 * |debt| < 5 min → 0 (verwaarloosbaar). Geen zone-data voor een dag →
 * aanname dat de intent gehaald is (debt 0 voor die dag).
 *
 * @return { debt:{low,high,anaerobic}, details:[per dag], hasPlan:bool }
 */
function computeZoneDebt_(ss, weekStart) {
  var result = { debt: { low: 0, high: 0, anaerobic: 0 }, details: [], hasPlan: false };

  var raw = getDocProp('weekplan_' + formatDate(weekStart, 'yyyy-MM-dd'), '');
  if (!raw) return result;
  var plan;
  try { plan = JSON.parse(raw); } catch (e) { return result; }
  if (!Array.isArray(plan) || !plan.length) return result;
  result.hasPlan = true;

  var planByDate = {};
  plan.forEach(function (p) { planByDate[p.datum] = p; });

  // Activities ophalen (icu_zone_times zit niet in de tab) — stil falen.
  var acts = [];
  try { acts = getActivities(14) || []; } catch (e) { console.warn('computeZoneDebt getActivities: ' + e.message); }
  var actsByDate = {};
  acts.forEach(function (a) {
    if (CYCLING_TYPES.indexOf(String(a.type || '')) < 0) return;  // alleen fiets — runs betalen geen cycling-debt (v2d)
    if (!a.start_date_local) return;
    var key = formatDate(stripTime_(new Date(a.start_date_local)), 'yyyy-MM-dd');
    (actsByDate[key] = actsByDate[key] || []).push(a);
  });

  var wsT = stripTime_(weekStart).getTime();
  var weT = wsT + 7 * 24 * 60 * 60 * 1000;

  var planner = readPlanner(ss);
  planner.forEach(function (day) {
    if (!day.train || !day.gedaan || !day.datum) return;
    var dt = stripTime_(day.datum);
    if (dt.getTime() < wsT || dt.getTime() >= weT) return;
    var key = formatDate(dt, 'yyyy-MM-dd');
    var p = planByDate[key];
    if (!p || !p.intent) return;

    var dayActs = actsByDate[key] || [];
    var actual = null;
    var source = null;
    dayActs.forEach(function (a) {
      var az = actualZoneMinutes_(a, null);
      if (az) {
        if (!actual) actual = { low: 0, high: 0, anaerobic: 0 };
        actual.low += az.low; actual.high += az.high; actual.anaerobic += az.anaerobic;
        // 'power' heeft voorrang als ten minste één rit power-data had
        if (az.source === 'power' || source === null) source = az.source;
      }
    });

    result.details.push({
      datum: key, dag: day.dag, type: p.workoutType,
      intent: p.intent, actual: actual, hasData: !!actual, source: source
    });

    if (!actual) return; // geen data → aanname plan gehaald
    ['low', 'high', 'anaerobic'].forEach(function (b) {
      result.debt[b] += (p.intent[b] || 0) - (actual[b] || 0);
    });
  });

  ['low', 'high', 'anaerobic'].forEach(function (b) {
    result.debt[b] = Math.round(result.debt[b]);
    if (Math.abs(result.debt[b]) < 5) result.debt[b] = 0;
  });
  return result;
}

/**
 * Kiest een workout-categorie die de grootste positieve debt-bucket
 * aanpakt. Null als er geen significant tekort (<5 min) is.
 */
function debtPreferredType_(debt, doel, macroFase) {
  if (!debt) return null;
  var best = null, bestVal = 4; // drempel 5
  ['anaerobic', 'high', 'low'].forEach(function (b) {
    if (debt[b] > bestVal) { bestVal = debt[b]; best = b; }
  });
  if (!best) return null;
  if (best === 'anaerobic') return 'vo2max';
  if (best === 'high') {
    if (doel === 'Beklimmingen') return 'klim';
    return (macroFase === 'Peak') ? 'threshold' : 'sweet_spot';
  }
  return 'long_z2';
}

/**
 * Week-volume (MINUTEN) als één bron van waarheid: actuals winnen waar
 * gematched (ook ritten zónder Weekplanner-intent), toekomstige geplande
 * dagen tellen hun intent-minuten, de rest 0.
 *
 * Per dag ma..zo van weekStart:
 *   - gematchte activities (Ride/VirtualRide, zelfde dag) → Σ moving_time/60
 *   - anders: d > vandaag én Weekplanner train=TRUE → intent-minuten
 *   - anders → 0
 */
function computeWeekVolumeMin_(ss, weekStart) {
  var planner = readPlanner(ss);
  var today = stripTime_(new Date());
  var wsT = stripTime_(weekStart).getTime();
  var weT = wsT + 7 * 24 * 60 * 60 * 1000;

  var acts = [];
  try { acts = getActivities(14) || []; } catch (e) { console.warn('computeWeekVolumeMin getActivities: ' + e.message); }

  var minByDate = {};
  acts.forEach(function (a) {
    if (CYCLING_TYPES.indexOf(String(a.type || '')) < 0) return;  // alleen fiets (incl. gravel/MTB)
    if (!a.start_date_local) return;
    var dd = stripTime_(new Date(a.start_date_local));
    if (dd.getTime() < wsT || dd.getTime() >= weT) return; // alleen deze week
    var key = formatDate(dd, 'yyyy-MM-dd');
    var mins = a.moving_time ? a.moving_time / 60 : 0;
    minByDate[key] = (minByDate[key] || 0) + mins;
  });

  var total = 0;
  for (var i = 0; i < 7; i++) {
    var dayDate = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i);
    var key = formatDate(dayDate, 'yyyy-MM-dd');
    if (minByDate[key] > 0) {
      total += minByDate[key];                      // actuals winnen
    } else if (stripTime_(dayDate).getTime() >= today.getTime() && planner[i] && planner[i].train === true) {
      // Toekomst/vandaag geplande dag → geplande (geschaalde) workout-duur uit
      // de proposal-snapshot; val terug op beschikbaarheid als er nog geen
      // voorstel voor die dag bestaat.
      var plannedMin = 0;
      readDaySessions_(key).forEach(function (s) { plannedMin += (s.totaalMin || 0); });
      total += plannedMin || (planner[i].minuten || 0);
    }
  }
  return Math.round(total);
}

/**
 * Fiets-activities (incl. gravel/MTB) van deze week, gegroepeerd per
 * datum (yyyy-MM-dd) → [{name, min}]. Voor de render van ongeplande-
 * maar-gefietste dagen in het Voorstel.
 */
function cyclingActivitiesByDate_(weekStart) {
  var wsT = stripTime_(weekStart).getTime();
  var weT = wsT + 7 * 24 * 60 * 60 * 1000;
  var acts = [];
  try { acts = getActivities(14) || []; } catch (e) { console.warn('cyclingActivitiesByDate_ getActivities: ' + e.message); }

  var byDate = {};
  acts.forEach(function (a) {
    if (CYCLING_TYPES.indexOf(String(a.type || '')) < 0) return;
    if (!a.start_date_local) return;
    var dd = stripTime_(new Date(a.start_date_local));
    if (dd.getTime() < wsT || dd.getTime() >= weT) return;
    var key = formatDate(dd, 'yyyy-MM-dd');
    (byDate[key] = byDate[key] || []).push({
      name: String(a.name || 'Rit'),
      min: a.moving_time ? Math.round(a.moving_time / 60) : 0
    });
  });
  return byDate;
}

/**
 * Werkelijke TSS per datum deze week. Spiegelt _statusWeekTss_ (TelegramBot.gs)
 * qua bron/filter/keying, maar returnt een map { 'yyyy-MM-dd': Σ TSS } i.p.v.
 * één som. Gebruikt voor de Voorstel-dashboard week-TSS zodat voltooide dagen
 * hun ECHTE load bijdragen i.p.v. 0 (planned-only-bug).
 */
function actualTssByDate_(weekStart) {
  var wsT = stripTime_(weekStart).getTime();
  var weT = wsT + 7 * 24 * 60 * 60 * 1000;
  var acts = [];
  try { acts = getActivities(14) || []; } catch (e) { console.warn('actualTssByDate_ getActivities: ' + e.message); }

  var byDate = {};
  acts.forEach(function (a) {
    if (CYCLING_TYPES.indexOf(String(a.type || '')) < 0) return;
    if (!a.start_date_local) return;
    var dd = stripTime_(new Date(a.start_date_local));
    if (dd.getTime() < wsT || dd.getTime() >= weT) return;
    var tss = a.icu_training_load != null ? a.icu_training_load
            : (a.training_load != null ? a.training_load
            : (a.tss != null ? a.tss : 0));
    var key = formatDate(dd, 'yyyy-MM-dd');
    byDate[key] = (byDate[key] || 0) + (Number(tss) || 0);
  });
  return byDate;
}

/**
 * Zorgt dat de data-tabs (Activiteiten + Wellness) gevuld zijn vóór
 * generateProposal draait, en reconcilet de Gedaan-checkboxes.
 *
 * Na "Bouw alles opnieuw" zijn ALLE data-tabs leeg → dan een volledige
 * syncAll (activities + wellness + zones + reconcile in juiste volgorde).
 * Zijn ze al gevuld → alleen reconcile. Faalt stil zonder API-key.
 */
function ensureDataAndReconcile_(ss) {
  var act  = ss.getSheetByName(ACTIVITEITEN_SHEET);
  var well = ss.getSheetByName(WELLNESS_SHEET);
  var actLeeg  = !act  || act.getLastRow()  <= 1;
  var wellLeeg = !well || well.getLastRow() <= 1;

  if (actLeeg || wellLeeg) {
    ss.toast('Gegevens ophalen voor voorstel...', '🚴 Coach', 5);
    try { syncAll(); }  // bevat zelf de reconcile-stap
    catch (e) { console.warn('syncAll in generateProposal faalde: ' + e.message); }
  } else {
    try { reconcilePlannerWithActivities(); }
    catch (e) { console.warn('reconcile in generateProposal faalde: ' + e.message); }
  }
}

/**
 * Bouwt event-context voor endurance-scaling uit het macro-object.
 * Returnt null als er geen hoofd-event is.
 */
function eventContextFrom_(macro) {
  if (!macro || !macro.hoofdEvent) return null;
  var ev = macro.hoofdEvent;
  return {
    naam:      ev.naam,
    afstandKm: ev.afstandKm || 0,
    hm:        ev.hm || 0,
    klimType:  ev.klimType,
    weken:     macro.wekenTotEvent
  };
}

function cleanupOldProposals_() {
  var props = PropertiesService.getDocumentProperties();
  props.getKeys().forEach(function (k) {
    if (k.indexOf('proposal_') === 0) props.deleteProperty(k);  // dekt ook _s<n>-suffixen (prefix-match)
  });
}

// ── v2b-B multi-session: proposal key-scheme (ENIGE plek waar het sleutelformaat leeft) ──
// Sessie 1 = basiskey proposal_<dISO> (byte-identiek aan vroeger single-session);
// sessie n>=2 = proposal_<dISO>_s<n>. Alle lezers/schrijvers/verwijderaars lopen via deze helpers.
function readDaySessions_(dISO) {
  var out = [];
  var base = getDocProp('proposal_' + dISO, '');
  if (!base) return out;
  try { out.push(JSON.parse(base)); } catch (e) { return out; }
  for (var n = 2; ; n++) {
    var raw = getDocProp('proposal_' + dISO + '_s' + n, '');
    if (!raw) break;
    try { out.push(JSON.parse(raw)); } catch (e) { break; }
  }
  return out;
}
function writeDaySessions_(dISO, sessions) {
  if (!sessions || !sessions.length) return;
  deleteDaySessions_(dISO);  // ruim eventuele stale (hogere) suffixen op
  setDocProp('proposal_' + dISO, JSON.stringify(sessions[0]));
  for (var n = 2; n <= sessions.length; n++) {
    setDocProp('proposal_' + dISO + '_s' + n, JSON.stringify(sessions[n - 1]));
  }
}
function deleteDaySessions_(dISO) {
  var props = PropertiesService.getDocumentProperties();
  props.deleteProperty('proposal_' + dISO);
  for (var n = 2; ; n++) {
    var k = 'proposal_' + dISO + '_s' + n;
    if (props.getProperty(k) === null) break;
    props.deleteProperty(k);
  }
}

/**
 * Geeft de intent (tijd-in-zone in min per bucket) van een workout terug.
 * Variant-workouts hebben dit al; voor overige workouts schatten we het:
 * ~45% van de tijd als werk in de niet-low zones, rest naar low.
 */
function ensureIntent_(wo) {
  if (wo.intent) return wo.intent;
  var total = wo.totaalMin || 0;
  var intent = { low: 0, high: 0, anaerobic: 0 };
  var zones = (wo.zones && wo.zones.length) ? wo.zones : ['low'];
  var workZones = zones.filter(function (z) { return z !== 'low'; });
  if (!workZones.length) { intent.low = total; return intent; }
  var per = Math.round(total * 0.45 / workZones.length);
  workZones.forEach(function (z) { if (intent[z] != null) intent[z] += per; });
  intent.low = Math.max(0, total - per * workZones.length);
  return intent;
}

// v2c: zone-bucket → korte NL-term voor de reden-string (UI).
function redenZoneLabel_(b) {
  return b === 'low' ? 'duur' : b === 'high' ? 'intensiteit' : b === 'anaerobic' ? 'anaeroob' : String(b || '');
}

/**
 * Wijst per dag een workout-type toe. Muteert days in-place (voorgesteldType
 * + reden + tss-hint) en update dekking.
 *
 * @param wellness  resultaat van getWellnessSignal(); demote/recovery
 *                  signal overschrijft de assignment cascade.
 */
function assignWorkouts(days, settings, mesoWeek, macroFase, dekking, wellness, klimType, recentHardDate, debt, isTripEvent, eventDate, taperCtx) {
  var doel = settings.doel;
  // Taper is een per-dag-overlay (Deel 2): taperCtx = { datum, venster, isTrip }
  // of null. macroFase is hier ALTIJD de onderliggende fase (nooit 'Taper').
  var taperActief = !!(taperCtx && taperCtx.datum && taperCtx.venster > 0);
  var isEventRecovery = macroFase === 'Recovery';
  var isMesoRecovery  = mesoWeek === 4;
  var isRecovery = isMesoRecovery;
  var isTestWeek = macroFase === 'Test';
  var testGedaan = false;
  var openersGedaan = false;
  // Avoid-consecutive-hard: laatste harde dag vóór het te-plannen venster.
  var lastHardDate = recentHardDate ? stripTime_(recentHardDate) : null;
  // Debt-weging alleen in opbouwfasen (niet tijdens taper/recovery —
  // dan geen compensatie-intensiteit forceren; herstel respecteren).
  var debtActief = !!debt && !taperActief && !isEventRecovery && !isRecovery;
  var debtWerk = debtActief ? { low: debt.low, high: debt.high, anaerobic: debt.anaerobic } : null;

  // Sorteer op dagIdx zodat ma→zo wordt verwerkt
  days.sort(function (a, b) { return a.dagIdx - b.dagIdx; });

  days.forEach(function (d) {
    var type;
    var reden = '';        // v2c: primaire reden bij het FINALE type
    var debtForced = false; // debt-geforceerde compensatie → exempt van avoid-consecutive-hard

    // Per-dag taper-gating: een dag tapert ALLEEN als hij 0..venster dagen vóór
    // het taper-event ligt; anders (ook post-event) → normale toewijzing.
    var dToTaper = (taperActief && d.datum)
      ? Math.round((stripTime_(taperCtx.datum).getTime() - stripTime_(d.datum).getTime()) / 86400000)
      : null;
    var dayTapers = taperActief && dToTaper != null && dToTaper >= 0 && dToTaper <= taperCtx.venster;

    if (isEventRecovery) {
      // Recovery-week na A-race: alles easy Z2.
      type = 'recovery';
      reden = 'Herstel — herstelweek na A-race';
    } else if (dayTapers) {
      if (taperCtx.isTrip) {
        // Tour-taper: meerdaagse rittenreis vraagt durability, geen race-snap.
        // Endurance-volume vasthouden; alleen de laatste 2 dagen kort + soepel.
        var isLaatste2 = (dToTaper <= 2);
        type = isLaatste2 ? 'taper_z2_kort' : 'tour_taper_z2';
        reden = isLaatste2 ? 'Korte taper-rit — vers worden voor de trip'
                           : 'Taper-duurrit — durability vasthouden';
      } else {
        // Race-taper: één korte openers-sessie, rest korte Z2.
        if (!openersGedaan && (d.type === 'vrij' || d.type === 'weekend')) {
          type = 'taper_openers';
          openersGedaan = true;
          reden = 'Openers — kort en scherp voor de wedstrijd';
        } else {
          type = 'taper_z2_kort';
          reden = 'Korte taper-rit — vers worden';
        }
      }
    } else if (isRecovery) {
      // Recovery week: alleen lichte sessies
      if (d.type === 'pendel')       type = 'pendel_z2';
      else if (d.type === 'weekend') type = 'long_z2';
      else                            type = 'recovery';
      reden = 'Herstel — herstelweek';
    } else if (isTestWeek && !testGedaan && (d.type === 'vrij' || d.type === 'weekend')) {
      type = 'test';
      testGedaan = true;
      reden = 'Test — FTP/conditie bepalen';
    } else if (d.type === 'pendel') {
      type = (isTripEvent && (macroFase === 'Build' || macroFase === 'Peak'))
        ? 'pendel_trip_intervals'                          // tocht-pendel → sweet-spot/tempo (zie genericPendelIntervals)
        : ('pendel_' + doelKey(doel) + '_intervals');
      reden = 'Pendelrit — vaste woon-werkrit';
    } else if (d.type === 'weekend') {
      // Debt-aware: groot high/anaerobic tekort → forceer combo met
      // expliciete high-blokken (i.p.v. alleen long_z2 + klim-sim).
      if (debtActief && debtWerk.high > DEBT_FORCE_HIGH_MIN) {
        type = 'combo_long_with_efforts';
        debtWerk.high = 0; // gecompenseerd
        debtForced = true;
        reden = 'Inhaalsessie — ' + redenZoneLabel_('high') + ' tekort';
      } else if (debtActief && debtWerk.anaerobic > DEBT_FORCE_ANAER_MIN) {
        type = 'combo_long_with_efforts';
        debtWerk.anaerobic = 0;
        debtForced = true;
        reden = 'Inhaalsessie — ' + redenZoneLabel_('anaerobic') + ' tekort';
      } else if (!dekking.low) {
        type = 'long_z2';
        reden = 'Lange duurrit — weekend';
      } else if (!dekking.high && macroFase !== 'Base') {
        type = 'combo_long_with_efforts';
        reden = 'Lange rit met blokken — intensiteit aanvullen';
      } else {
        type = 'long_z2';
        reden = 'Lange duurrit — weekend';
      }
    } else if (d.type === 'vrij') {
      // Debt-weging: prioriteer grootste positieve tekort-bucket.
      var dp = debtWerk ? debtPreferredType_(debtWerk, doel, macroFase) : null;
      if (dp) {
        type = dp;
        var dpBucket = typeBucket_(dp, doel);
        debtWerk[dpBucket] = 0; // verbruikt → volgende dag andere bucket
        reden = 'Inhaalsessie — ' + redenZoneLabel_(dpBucket) + ' tekort';
      } else {
        type = keyIntensity(doel, macroFase, dekking, klimType, isTripEvent);
        reden = 'Sleutelsessie · ' + doel + ' — fase ' + macroFase;
      }
    } else if (d.type === 'recovery') {
      type = 'recovery';
      reden = 'Herstel — ingeroosterd';
    } else {
      type = 'recovery';
      reden = 'Rustige dag — geen sleutelprikkel nodig';
    }

    // Avoid-consecutive-hard: als de vorige kalenderdag een harde dag was
    // (deze week of vorige week) en deze dag óók hard zou zijn → downgrade
    // naar long_z2. Voorkomt twee zware dagen op rij, ook over de weekgrens.
    var zonesPre = workoutZones(type, doel);
    var isHard = zonesPre.indexOf('high') >= 0 || zonesPre.indexOf('anaerobic') >= 0;
    if (isHard && !debtForced && d.datum && lastHardDate) {
      var prevDay = stripTime_(new Date(d.datum.getTime() - 24 * 60 * 60 * 1000));
      if (prevDay.getTime() === lastHardDate.getTime()) {
        type = 'long_z2';
        isHard = false;
        reden = 'Rustige duurrit — dag na een zware dag';  // load-context wint
      }
    }

    d.voorgesteldType = type;
    d.reden = reden;
    var zones = workoutZones(type, doel);
    zones.forEach(function (z) { dekking[z] = true; });
    if (isHard && d.datum) lastHardDate = stripTime_(d.datum);
  });

  // Wellness-demotie pass: pas type aan op basis van HRV/slaap-signaal
  if (wellness && (wellness.signal === 'demote' || wellness.signal === 'recovery')) {
    days.forEach(function (d) {
      if (!d.voorgesteldType) return;
      if (wellness.signal === 'recovery') {
        d.voorgesteldType = 'recovery';
        d.reden = 'Herstel — wellness laag';
      } else {
        var gedemoot = demoteType_(d.voorgesteldType);
        if (gedemoot !== d.voorgesteldType) {
          d.voorgesteldType = gedemoot;
          d.reden = 'Lichter gehouden — wellness laag';
        }
      }
    });
  }
}

// ── Wellness signal + demotion ─────────────────────────────

/**
 * Maps high-intensity workout types naar lichtere alternatieven voor
 * 'demote' signal. Types die niet in de map staan blijven onveranderd.
 */
var DEMOTE_MAP = {
  // FTP
  'sweet_spot': 'tempo',
  'threshold':  'tempo',
  // VO2max
  'vo2_short':  'tempo',
  'vo2_medium': 'tempo',
  'vo2_long':   'tempo',
  'vo2_3015':   'long_z2',
  'microbursts':'long_z2',
  'vo2max':     'tempo',
  // Beklimmingen
  'big_gear':   'tempo',
  'bergsim':    'tempo',
  'ss_lang':    'tempo',
  'low_cad':    'tempo',
  // Conditie
  'fatox':      'long_z2',
  // Combos
  'combo_z2_vo2':     'long_z2',
  'combo_ss_sprints': 'tempo',
  'combo_all_three':  'combo_long_with_efforts',
  // Pendel — terug-intervallen vervangen door pendel_z2
  'pendel_ftp_intervals':      'pendel_z2',
  'pendel_vo2_intervals':      'pendel_z2',
  'pendel_conditie_intervals': 'pendel_z2',
  'pendel_climb_intervals':    'pendel_z2',
  'pendel_trip_intervals':     'pendel_z2',
  // Test → recovery (geen testen tijdens slechte recovery)
  'test': 'recovery'
};

function demoteType_(type) {
  return DEMOTE_MAP[type] || type;
}

/**
 * Severity-rang voor signaal-merge. recovery > demote > warning > normal.
 */
var SIGNAL_RANK_ = { normal: 0, warning: 1, demote: 2, recovery: 3 };

/**
 * Combineert wellness- en RPE-signaal tot één bijstuur-object via max
 * severity. RPE is al gecapt op 'demote', dus 'recovery' blijft objectief
 * (slaap/HRV). Behoudt de overige wellness-velden (sleepLastNight, …). Bij
 * gelijke/zwakkere RPE maar beide actief → reasons samenvoegen voor de banner.
 * Geen stacking: de demote-pass draait één keer op het eindsignaal.
 */
function combineSignals_(wellness, rpe) {
  wellness = wellness || { signal: 'normal', reason: '' };
  if (!rpe || rpe.signal === 'normal') return wellness;

  var wRank = SIGNAL_RANK_[wellness.signal] || 0;
  var rRank = SIGNAL_RANK_[rpe.signal] || 0;

  if (rRank > wRank) {
    wellness.signal = rpe.signal;
    wellness.reason = rpe.reason;
  } else if (wellness.reason && rpe.reason) {
    wellness.reason = wellness.reason + ' + ' + rpe.reason;
  }
  return wellness;
}

/**
 * Leest Wellness tab + berekent HRV/slaap-signaal voor het algoritme.
 *
 * Returnt object met diagnostiek + signal ∈ {normal, warning, demote, recovery}.
 * Bij ontbrekende wellness-data → signal='normal'.
 */
function getWellnessSignal(ss, wellValues) {
  if (!wellValues) wellValues = readWellnessValues_();
  if (!wellValues) return wellnessFallback_('geen Wellness tab');
  if (!wellValues.length) return wellnessFallback_('geen wellness data');

  // Kolommen: A=Datum B=RHR C=HRV D=Slaap (extra kolommen in de array genegeerd)
  var data = wellValues;
  var hrvSeries = data.map(function (r) {
    var v = Number(r[2]); return isNaN(v) || v === 0 ? null : v;
  });
  var sleepSeries = data.map(function (r) {
    var v = Number(r[3]); return isNaN(v) || v === 0 ? null : v;
  });

  function avgNonNull(arr) {
    var sum = 0, n = 0;
    arr.forEach(function (v) { if (v != null) { sum += v; n++; } });
    return n > 0 ? sum / n : null;
  }

  var hrvBaseline    = avgNonNull(hrvSeries.slice(0, 28));
  var hrvRecent      = avgNonNull(hrvSeries.slice(0, 3));
  var sleepLastNight = sleepSeries.length ? sleepSeries[0] : null;
  var sleepAvg3      = avgNonNull(sleepSeries.slice(0, 3));

  var hrvDeficit = (hrvBaseline && hrvRecent)
    ? Math.round((hrvRecent - hrvBaseline) / hrvBaseline * 100)
    : null;

  // Demotie-regels — eerste hit telt
  var signal, reason;
  if ((sleepLastNight != null && sleepLastNight < 5) ||
      (sleepAvg3      != null && sleepAvg3      < 5)) {
    signal = 'recovery';
    reason = 'slaap kritiek laag (' + (sleepLastNight != null ? sleepLastNight : sleepAvg3) + 'u)';
  } else if (hrvDeficit != null && hrvDeficit < -10 &&
             sleepAvg3 != null && sleepAvg3 < 6) {
    signal = 'recovery';
    reason = 'HRV én slaap onder baseline (HRV ' + hrvDeficit + '%, slaap ' + sleepAvg3 + 'u)';
  } else if ((hrvDeficit != null && hrvDeficit < -10) ||
             (sleepLastNight != null && sleepLastNight < 6)) {
    signal = 'demote';
    reason = (hrvDeficit != null && hrvDeficit < -10)
      ? 'HRV ' + hrvDeficit + '% onder baseline'
      : 'slaap ' + sleepLastNight + 'u onder ondergrens';
  } else if ((hrvDeficit != null && hrvDeficit < -5) ||
             (sleepLastNight != null && sleepLastNight < 7)) {
    signal = 'warning';
    reason = 'lichte afwijking';
  } else {
    signal = 'normal';
    reason = 'binnen baseline';
  }

  return {
    hrvBaseline:    hrvBaseline    ? Math.round(hrvBaseline    * 10) / 10 : null,
    hrvRecent:      hrvRecent      ? Math.round(hrvRecent      * 10) / 10 : null,
    hrvDeficit:     hrvDeficit,
    sleepLastNight: sleepLastNight,
    sleepAvg3:      sleepAvg3      ? Math.round(sleepAvg3      * 10) / 10 : null,
    signal:         signal,
    reason:         reason
  };
}

function wellnessFallback_(reason) {
  return {
    hrvBaseline: null, hrvRecent: null, hrvDeficit: null,
    sleepLastNight: null, sleepAvg3: null,
    signal: 'normal', reason: reason
  };
}

// ── Form-score TSB (Friel/intervals.icu Vorm = CTL - ATL) ────────
// Friel/intervals.icu Vorm-zones. Dutch labels match the app.
function formZone_(form) {
  if (form >  25) return 'Overgang';
  if (form >   5) return 'Fris';
  if (form > -10) return 'Grijze zone';
  if (form > -30) return 'Optimaal';
  return 'Hoog risico';
}

// Latest CTL/ATL/Form from the most recent wellness record carrying them.
// Field names confirmed 2026-06-02 as plain ctl/atl/rampRate (no icu_ prefix);
// live-read at display time, spiegelt actualTssByDate_/_statusWeekTss_ (geen persistence).
function getFormScore_(wellValues) {
  try {
    // PERF: Sheet-pad — meest-recente Wellness-rij (idx0 Datum / idx8 CTL / idx9 ATL /
    // idx11 Ramp) i.p.v. live getWellness(7). Zelfde afleiding (form=ctl-atl, formZone_)
    // + zelfde null-handling (geen rij met ctl+atl → null). Geen array → live ongewijzigd.
    if (wellValues) {
      var best = null;
      for (var j = 0; j < wellValues.length; j++) {
        var w = wellValues[j];
        if (!(w[0] instanceof Date)) continue;
        var wc = (w[8] !== '' && w[8] != null) ? Number(w[8]) : null;
        var wa = (w[9] !== '' && w[9] != null) ? Number(w[9]) : null;
        if (wc == null || wa == null) continue;
        var wt = w[0].getTime();
        if (!best || wt > best.t) {
          best = { t: wt, date: formatDate(w[0], 'yyyy-MM-dd'), ctl: wc, atl: wa,
                   ramp: (w[11] !== '' && w[11] != null) ? Number(w[11]) : null };
        }
      }
      if (!best) return null;
      var formW = best.ctl - best.atl;
      return { date: best.date, ctl: best.ctl, atl: best.atl, form: formW, ramp: best.ramp, label: formZone_(formW) };
    }
    var arr = getWellness(7);            // raw /wellness records
    if (!arr || !arr.length) return null;
    arr.sort(function (a, b) { return String(b.id).localeCompare(String(a.id)); }); // newest first
    for (var i = 0; i < arr.length; i++) {
      var r = arr[i];
      var ctl  = (r.ctl != null) ? r.ctl : null;
      var atl  = (r.atl != null) ? r.atl : null;
      var ramp = (r.rampRate != null) ? r.rampRate : null;
      if (ctl != null && atl != null) {
        var form = ctl - atl;
        return { date: r.id, ctl: ctl, atl: atl, form: form, ramp: ramp, label: formZone_(form) };
      }
    }
    return null;
  } catch (e) { Logger.log('getFormScore_ error: ' + e); return null; }
}

// ── Readiness score (Fase 1b) — objectief preset ─────────────────
// Gewogen 0-100 readiness uit 4 genormaliseerde factoren. Server rekent,
// client rendert (read-side). De ochtend-check-in (benen/stress) voedt de
// score pas in Fase 2 — gebalanceerd/subjectief blijven tot dan placeholder.
var READINESS_PRESETS = {
  objectief:    { vormTrend: 0.30, belasting: 0.30, hrv: 0.25, slaap: 0.15 }, // som 1,00
  gebalanceerd: null,   // TODO Fase 2+ (benen/stress + post-check-in herweging)
  subjectief:   null    // TODO Fase 2+
};

function rdyClamp_(x) { return Math.max(0, Math.min(100, x)); }

/** Lineaire normalisatie v∈[lo,hi] → [0,100], geklemd. null → null. */
function rdyLerp_(v, lo, hi) {
  if (v == null) return null;
  return rdyClamp_((v - lo) / (hi - lo) * 100);
}

/** Decimale uren → "Xu YY" (7,33 → "7u20"). */
function rdyUren_(h) {
  var hh = Math.floor(h), mm = Math.round((h - hh) * 60);
  if (mm === 60) { hh++; mm = 0; }
  return hh + 'u' + (mm < 10 ? '0' + mm : mm);
}

// ── Ochtend-check-in (Fase 2) — begrensde bijstelling op de objectieve score ──
// Drie vragen × 3 niveaus → delta −2/0/+2; somdelta −6..+6 op de base-score.
// GEEN herweging, GEEN 5e factor: puur een geklemde nudge + callout.
var CHECKIN_LEVELS = {
  slaap:  { goed: 2, matig: 0, slecht: -2 },
  benen:  { fris: 2, normaal: 0, zwaar: -2 },
  stress: { laag: 2, normaal: 0, hoog: -2 }
};
var CHECKIN_QUESTIONS = [
  { key: 'slaap',  label: 'Slaap',  opts: ['goed', 'matig', 'slecht'] },
  { key: 'benen',  label: 'Benen',  opts: ['fris', 'normaal', 'zwaar'] },
  { key: 'stress', label: 'Stress', opts: ['laag', 'normaal', 'hoog'] }
];

/** DocProp checkin_<today> → {slaap,benen,stress} of null. */
function getTodayCheckin_() {
  var dISO = formatDate(stripTime_(new Date()), 'yyyy-MM-dd');
  var raw = getDocProp('checkin_' + dISO, '');
  if (!raw) return null;
  try {
    var o = JSON.parse(raw);
    if (o && o.slaap && o.benen && o.stress) {
      // Migreer oude labels ('oké') → nieuwe (slaap→matig, benen→normaal) zodat oude
      // opgeslagen check-ins correct tonen + de nieuwe delta-map (CHECKIN_LEVELS) raken.
      return {
        slaap:  (o.slaap === 'oké') ? 'matig' : o.slaap,
        benen:  (o.benen === 'oké') ? 'normaal' : o.benen,
        stress: o.stress
      };
    }
  } catch (e) {}
  return null;
}

/** Som van de drie deltas, geklemd op −6..+6. Onbekend niveau → 0. */
function checkinDelta_(checkin) {
  if (!checkin) return 0;
  var d = 0;
  ['slaap', 'benen', 'stress'].forEach(function (k) {
    var v = CHECKIN_LEVELS[k] ? CHECKIN_LEVELS[k][checkin[k]] : undefined;
    if (typeof v === 'number') d += v;
  });
  return Math.max(-6, Math.min(6, d));
}

/** Leesbare samenvatting "Slaap goed · Benen oké · Stress laag". */
function checkinSummary_(checkin) {
  if (!checkin) return '';
  return CHECKIN_QUESTIONS.map(function (q) { return q.label + ' ' + (checkin[q.key] || '?'); }).join(' · ');
}

/**
 * Readiness 0-100 + band + factor-breakdown + chips. Objectief-preset.
 * Args optioneel: hergebruikt reeds-berekende signalen uit getDashboardState
 * (vermijdt een extra live getWellness-call). Ontbrekende factor → wegvallen
 * + herschalen over de resterende gewichten (geen harde nul).
 *
 * Normalisatie-breakpoints (0→100, geklemd):
 *   vorm-trend : Vorm/TSB  -30 → +10  (frisser = readier) + richting-nudge ±10
 *   belasting  : ATL/CTL   1.5 → 0.8  (gew. 0.6) ⊕ ramp/wk 10 → 0 (gew. 0.4)
 *   HRV        : deficit%  -15 → +5   (boven baseline = hoger)
 *   slaap      : uren        5 → 8
 * Banden: ≥62 ready / 48-61 caution / <48 rest. dot: ≥67 good / 34-66 warn / <34 muted.
 */
function getReadinessScore_(fs, wellness, reeks) {
  if (fs === undefined)       fs = getFormScore_();
  if (wellness === undefined) wellness = getWellnessSignal(SpreadsheetApp.getActive());
  if (reeks === undefined)    reeks = (typeof dashVormReeks_ === 'function') ? dashVormReeks_() : [];
  var W = READINESS_PRESETS.objectief;
  fs = fs || {}; wellness = wellness || {};

  // factor 1 — vorm-trend: niveau (TSB) + richting over de Vorm-reeks.
  var form = (fs.form != null) ? fs.form : null;
  var vtSub = rdyLerp_(form, -30, 10);
  var vtText = '–';
  if (vtSub != null && reeks && reeks.length >= 2) {
    var vs = reeks.filter(function (r) { return r.vorm != null; });
    if (vs.length >= 2) {
      var span = Math.min(7, vs.length - 1);
      var delta = vs[vs.length - 1].vorm - vs[vs.length - 1 - span].vorm;
      vtSub = rdyClamp_(vtSub + Math.max(-10, Math.min(10, delta)));
      vtText = (delta > 2) ? 'stijgend' : (delta < -2 ? 'dalend' : 'stabiel');
    }
  }
  if (vtSub != null && vtText === '–') vtText = (form >= 0) ? 'fris' : 'belast';

  // factor 2 — belasting: ATL/CTL-ratio (acuut) ⊕ ramp (duurzaamheid).
  var ctl = (fs.ctl != null) ? fs.ctl : null, atl = (fs.atl != null) ? fs.atl : null;
  var ramp = (fs.ramp != null) ? fs.ramp : null;
  var blSub = null, blText = '–';
  if (ctl != null && atl != null && ctl > 0) {
    var ratio = atl / ctl;
    var ratioSub = rdyClamp_(100 - (ratio - 0.8) / (1.5 - 0.8) * 100);
    var rampSub = (ramp != null) ? rdyClamp_(100 - Math.max(0, Math.min(10, ramp)) / 10 * 100) : ratioSub;
    blSub = Math.round(0.6 * ratioSub + 0.4 * rampSub);
    blText = (ratio > 1.15) ? 'ATL-piek' : ((ramp != null && ramp >= 6) ? 'ramp steil' : 'in balans');
  }

  // factor 3 — HRV: recent t.o.v. 28d-baseline (deficit%).
  var def = (wellness.hrvDeficit != null) ? wellness.hrvDeficit : null;
  var hrvSub = rdyLerp_(def, -15, 5);
  var hrvText = (def == null) ? '–' : (def >= 2 ? 'boven baseline' : (def <= -2 ? 'onder baseline' : 'op baseline'));

  // factor 4 — slaap: 3-daags gemiddelde (val terug op laatste nacht).
  var slp = (wellness.sleepAvg3 != null) ? wellness.sleepAvg3
          : (wellness.sleepLastNight != null ? wellness.sleepLastNight : null);
  var slpSub = rdyLerp_(slp, 5, 8);
  var slpText = (slp == null) ? '–' : rdyUren_(slp);

  var raw = [
    { key: 'vormTrend', label: 'Vorm-trend', sub: vtSub,  weight: W.vormTrend, valueText: vtText },
    { key: 'belasting', label: 'Belasting',  sub: blSub,  weight: W.belasting, valueText: blText },
    { key: 'hrv',       label: 'HRV',        sub: hrvSub, weight: W.hrv,       valueText: hrvText },
    { key: 'slaap',     label: 'Slaap',      sub: slpSub, weight: W.slaap,     valueText: slpText }
  ];

  // Gewogen som over aanwezige factoren; herschaal de gewichten (geen harde nul).
  var present = raw.filter(function (f) { return f.sub != null; });
  var totW = present.reduce(function (a, f) { return a + f.weight; }, 0);
  var score = null;
  if (totW > 0) {
    score = Math.round(present.reduce(function (a, f) { return a + f.sub * f.weight; }, 0) / totW);
  }
  // Fase 2 — ochtend-check-in: begrensde nudge op de objectieve base-score (geen herweging).
  var checkin = getTodayCheckin_();
  var cDelta = checkin ? checkinDelta_(checkin) : 0;
  if (score != null && checkin) score = rdyClamp_(score + cDelta);
  var band = (score == null) ? null : (score >= 62 ? 'ready' : (score >= 48 ? 'caution' : 'rest'));

  var factors = raw.map(function (f) {
    var dot = (f.sub == null) ? 'muted' : (f.sub >= 67 ? 'good' : (f.sub >= 34 ? 'warn' : 'muted'));
    return { key: f.key, label: f.label, sub: (f.sub == null) ? null : Math.round(f.sub),
             dot: dot, valueText: f.valueText };
  });

  // Chips (export §2a): Vorm ±N (fresh als >0) + HRV N (muted).
  var chips = [];
  if (form != null) {
    var fv = Math.round(form);
    chips.push({ label: 'Vorm ' + (fv > 0 ? '+' : '') + fv, tone: fv > 0 ? 'fresh' : 'muted' });
  }
  if (wellness.hrvRecent != null) chips.push({ label: 'HRV ' + Math.round(wellness.hrvRecent), tone: 'muted' });

  return {
    score: score, band: band, factors: factors, chips: chips,
    checkinDone: !!checkin, checkinDelta: cDelta,
    checkinSummary: checkin ? checkinSummary_(checkin) : '',
    checkin: checkin || null   // raw {slaap,benen,stress} → client pre-select bij heropenen
  };
}

/**
 * Web-callable: schrijf de check-in van vandaag (DocProp checkin_<dISO>) en
 * retourneer de HERBEREKENDE readiness (zelfde shape als state.readiness) zodat
 * de client de kaart ververst zonder full reload.
 */
function saveCheckin(slaap, benen, stress) {
  function ok(k, v) { return CHECKIN_LEVELS[k] && CHECKIN_LEVELS[k][v] !== undefined; }
  if (!ok('slaap', slaap) || !ok('benen', benen) || !ok('stress', stress)) {
    throw new Error('saveCheckin: ongeldige check-in-waarde.');
  }
  var dISO = formatDate(stripTime_(new Date()), 'yyyy-MM-dd');
  setDocProp('checkin_' + dISO, JSON.stringify({ slaap: slaap, benen: benen, stress: stress, ts: new Date().toISOString() }));
  return getReadinessScore_();
}

function doelKey(doel) {
  if (doel === 'FTP')         return 'ftp';
  if (doel === 'VO2max')      return 'vo2';
  if (doel === 'Conditie')    return 'conditie';
  if (doel === 'Beklimmingen')return 'climb';
  return 'ftp';
}

// ── DSL builder — intervals.icu description-format ───────────────

/**
 * Vertaalt workout.structuur naar intervals.icu's eigen workout-DSL,
 * die intervals.icu zelf parsed naar structured workout (chart, Garmin sync).
 *
 * DSL syntax (zie forum.intervals.icu/.../63624):
 *   - "- 15m 55%"          single step steady
 *   - "- 15m 55-70%"       ramp
 *   - "- 20m 90% Sweet Spot" met label
 *   - "Nx" header + "- ..." children = repeat block (afgesloten met blank line)
 *
 * Returnt null als één segment niet parsed kan worden (caller valt
 * dan terug op description-only push).
 */
function buildWorkoutDsl_(workout) {
  if (!workout || !Array.isArray(workout.structuur) || !workout.structuur.length) return null;

  var ftp = Number(getDocProp('ftp', '275')) || 275;
  var blocks = [];

  for (var i = 0; i < workout.structuur.length; i++) {
    var block = dslBlockFromRow_(workout.structuur[i], ftp);
    if (!block) {
      console.log('buildWorkoutDsl_: kon segment niet parsen, terugval op description-only: ' +
                  JSON.stringify(workout.structuur[i]));
      return null;
    }
    blocks.push(block);
  }

  // Blocks gescheiden door dubbele newline — sluit ook impliciet repeat-blokken.
  return blocks.join('\n\n');
}

function dslBlockFromRow_(row, ftp) {
  var name   = String(row[0] || '');
  var durStr = String(row[1] || '');
  var powStr = String(row[2] || '');
  var note   = String(row[4] || '');

  // Repeat-loop: "Nx M min" of "Nx M sec"
  var repMatch = /^\s*(\d+)\s*x\s*(\d+)\s*(min|sec|s)\b/i.exec(durStr);
  if (repMatch) {
    var reps    = parseInt(repMatch[1], 10);
    var workDur = parseInt(repMatch[2], 10);
    var workUnit = /min/i.test(repMatch[3]) ? 'm' : 's';
    var workPct = dslMidPct_(powStr, ftp);
    if (workPct == null) return null;

    var lines = [reps + 'x', '- ' + workDur + workUnit + ' ' + workPct + '%'];

    var rest = dslRestFromNote_(note);
    if (rest && rest.duration > 0) {
      var restUnit = rest.duration >= 60 && rest.duration % 60 === 0 ? 'm' : 's';
      var restDur  = restUnit === 'm' ? rest.duration / 60 : rest.duration;
      lines.push('- ' + restDur + restUnit + ' ' + rest.pct + '%');
    }
    return lines.join('\n');
  }

  // Enkele step — duur parsen
  var seconds = dslDurationSec_(durStr);
  if (!seconds) return null;
  var durTxt = (seconds % 60 === 0) ? (seconds / 60) + 'm' : seconds + 's';

  var isWarmup   = /warm[ -]?up|inrijden|opbouw/i.test(name + ' ' + note);
  var isCooldown = /cool[ -]?down|uitrijden|easy uit/i.test(name + ' ' + note);
  var label = isWarmup ? ' Warmup' : (isCooldown ? ' Cooldown' : '');

  var range = dslPowerRange_(powStr, ftp);
  if (!range) return null;

  // Warmup met een range → echte ramp; anders midpoint als steady.
  if (isWarmup && range.lo !== range.hi) {
    return '- ' + durTxt + ' ' + range.lo + '-' + range.hi + '%' + label;
  }
  return '- ' + durTxt + ' ' + range.mid + '%' + label;
}

function dslPowerRange_(powStr, ftp) {
  if (!powStr || powStr === '—') return null;
  var rangeMatch = /(\d+)\s*[-–]\s*(\d+)\s*W/i.exec(powStr);
  if (rangeMatch) {
    var lo = parseInt(rangeMatch[1], 10);
    var hi = parseInt(rangeMatch[2], 10);
    return {
      lo:  Math.round(lo / ftp * 100),
      hi:  Math.round(hi / ftp * 100),
      mid: Math.round((lo + hi) / 2 / ftp * 100)
    };
  }
  var singleMatch = />?\s*(\d+)\s*W/i.exec(powStr);
  if (singleMatch) {
    var w = parseInt(singleMatch[1], 10);
    var p = Math.round(w / ftp * 100);
    return { lo: p, hi: p, mid: p };
  }
  return null;
}

function dslMidPct_(powStr, ftp) {
  var r = dslPowerRange_(powStr, ftp);
  return r ? r.mid : null;
}

function dslDurationSec_(str) {
  if (!str) return 0;
  var m = /(\d+)\s*min/i.exec(str);
  if (m) return parseInt(m[1], 10) * 60;
  var s = /(\d+)\s*(?:sec|s)\b/i.exec(str);
  if (s) return parseInt(s[1], 10);
  return 0;
}

function dslRestFromNote_(note) {
  if (!note) return null;
  var m = /(\d+)\s*(min|sec|s)\s+(rust|pauze|recovery)/i.exec(note);
  if (!m) return null;
  var val = parseInt(m[1], 10);
  var seconds = /min/i.test(m[2]) ? val * 60 : val;
  var pctMatch = /@\s*(\d+)\s*%/i.exec(note);
  return {
    duration: seconds,
    pct:      pctMatch ? parseInt(pctMatch[1], 10) : 50
  };
}

// ── ZWO XML builder ──────────────────────────────────────────────

/**
 * Genereert een ZWO (Zwift Workout) XML string uit workout.structuur.
 * intervals.icu zet ZWO om naar structured FIT die Garmin Epix als
 * multi-step workout aanvaardt (met laps per step).
 *
 * Element-mapping:
 *   - Warmup row    → <Warmup Duration=S PowerLow=X PowerHigh=Y/>
 *   - Cooldown row  → <Cooldown Duration=S PowerLow=X PowerHigh=Y/>
 *   - Repeat row    → <IntervalsT Repeat=N OnDuration OnPower OffDuration OffPower/>
 *   - Steady row    → <SteadyState Duration=S Power=X/>
 *
 * Power als decimal (0.55, niet "55%"). Duration in seconden.
 * Returnt null als één segment niet parsed kan worden.
 */
function buildWorkoutZwo_(workout) {
  if (!workout || !Array.isArray(workout.structuur) || !workout.structuur.length) return null;

  var ftp = Number(getDocProp('ftp', '275')) || 275;
  var stepXmls = [];

  for (var i = 0; i < workout.structuur.length; i++) {
    var xml = zwoStepFromRow_(workout.structuur[i], ftp);
    if (!xml) {
      console.log('buildWorkoutZwo_: kon segment niet parsen, terugval op DSL: ' +
                  JSON.stringify(workout.structuur[i]));
      return null;
    }
    stepXmls.push(xml);
  }

  var name = xmlEscape_(workout.naam || 'Workout');
  var desc = xmlEscape_(workout.focus || workout.eindopmerking || '');

  return [
    '<workout_file>',
    '  <author>Coach</author>',
    '  <name>' + name + '</name>',
    '  <description>' + desc + '</description>',
    '  <sportType>bike</sportType>',
    '  <tags/>',
    '  <workout>',
    '    ' + stepXmls.join('\n    '),
    '  </workout>',
    '</workout_file>'
  ].join('\n');
}

function zwoStepFromRow_(row, ftp) {
  var name   = String(row[0] || '');
  var durStr = String(row[1] || '');
  var powStr = String(row[2] || '');
  var note   = String(row[4] || '');

  // Repeat-loop
  var repMatch = /^\s*(\d+)\s*x\s*(\d+)\s*(min|sec|s)\b/i.exec(durStr);
  if (repMatch) {
    var reps    = parseInt(repMatch[1], 10);
    var workDur = parseInt(repMatch[2], 10);
    var workSec = /min/i.test(repMatch[3]) ? workDur * 60 : workDur;
    var workRange = dslPowerRange_(powStr, ftp);
    if (!workRange) return null;

    var rest    = dslRestFromNote_(note);
    var restSec = rest ? rest.duration : 0;
    var restPct = rest ? rest.pct      : 50;

    return '<IntervalsT Repeat="' + reps + '" ' +
           'OnDuration="'  + workSec + '" OnPower="'  + zwoPct_(workRange.mid) + '" ' +
           'OffDuration="' + restSec + '" OffPower="' + zwoPct_(restPct)        + '"/>';
  }

  // Enkele step
  var seconds = dslDurationSec_(durStr);
  if (!seconds) return null;
  var range = dslPowerRange_(powStr, ftp);
  if (!range) return null;

  var isWarmup   = /warm[ -]?up|inrijden|opbouw/i.test(name + ' ' + note);
  var isCooldown = /cool[ -]?down|uitrijden|easy uit/i.test(name + ' ' + note);

  if (isWarmup) {
    var lo = range.lo, hi = range.hi;
    if (lo === hi) lo = Math.max(40, hi - 20); // synthesize ramp als geen range
    return '<Warmup Duration="' + seconds + '" ' +
           'PowerLow="' + zwoPct_(lo) + '" PowerHigh="' + zwoPct_(hi) + '"/>';
  }
  if (isCooldown) {
    var clo = range.lo, chi = range.hi;
    if (clo === chi) chi = clo; // steady cooldown — beide attrs gelijk
    return '<Cooldown Duration="' + seconds + '" ' +
           'PowerLow="' + zwoPct_(clo) + '" PowerHigh="' + zwoPct_(chi) + '"/>';
  }

  // Default: steady state op midpoint
  return '<SteadyState Duration="' + seconds + '" Power="' + zwoPct_(range.mid) + '"/>';
}

function zwoPct_(pct) {
  return (pct / 100).toFixed(2);
}

function xmlEscape_(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Kiest de key-intensity workout voor een vrije dag op basis van doel,
 * macro-fase en wat nog open staat in dekking.
 */
function keyIntensity(doel, macroFase, dekking, klimType, isTripEvent) {
  if (macroFase === 'Taper')    return 'taper_openers'; // defensief — taper handled in assignWorkouts
  if (macroFase === 'Recovery') return 'recovery';

  // Klim-type stuurt de kwaliteitsdag in Build/Peak (event-driven).
  if (macroFase === 'Build' || macroFase === 'Peak') {
    var ct = climbTypeWorkout_(klimType, macroFase, dekking);
    if (ct) return ct;
    // Trip/tocht-event zonder klim-routing → duur-key i.p.v. doel-FTP-intervallen.
    if (isTripEvent) return 'long_z2';
  }

  // Categorie-types → variant-pools (selectVariant_ roteert de vorm).
  if (doel === 'FTP') {
    if (macroFase === 'Base')  return 'sweet_spot';
    if (macroFase === 'Build') return dekking.high ? 'threshold' : 'sweet_spot';
    if (macroFase === 'Peak')  return 'threshold';
    return 'sweet_spot';
  }
  if (doel === 'VO2max')       return 'vo2max';
  if (doel === 'Conditie')     return 'conditie';
  if (doel === 'Beklimmingen') return 'klim';
  return 'sweet_spot';
}

/**
 * Klim-type-gestuurde keuze van de kwaliteitsdag-categorie (event-driven).
 * Mapt naar variant-pool categorieën i.p.v. losse types:
 *   kort    → vo2max  (pool bevat 8x2 / 30-30 / 40-20 explosief)
 *   lang    → threshold / sweet_spot (sustained)
 *   gemengd → afwisselen op basis van dekking
 *   vlak    → null (val terug op doel-standaard)
 */
function climbTypeWorkout_(klimType, macroFase, dekking) {
  if (!klimType || klimType === 'vlak') return null;
  if (klimType === 'kort') return 'vo2max';
  if (klimType === 'lang') return dekking.high ? 'threshold' : 'sweet_spot';
  if (klimType === 'gemengd') return dekking.anaerobic ? 'threshold' : 'vo2max';
  return null;
}

/**
 * Lookup: welke load-focus zones dekt deze workout? (low/high/anaerobic)
 */
function workoutZones(type, doel) {
  if (!type) return [];
  if (type === 'taper_z2_kort') return ['low'];
  if (type === 'tour_taper_z2') return ['low'];
  if (type === 'taper_openers') return ['anaerobic'];
  if (type === 'vo2_hill_repeats' || type === 'anaerobic_capacity') return ['anaerobic'];
  if (type === 'threshold_long' || type === 'sweet_spot_long') return ['high'];
  if (type === 'long_z2' || type === 'recovery' || type === 'pendel_z2' || type === 'fatox') return ['low'];
  if (type === 'sweet_spot' || type === 'threshold' || type === 'tempo' || type === 'klim' ||
      type === 'conditie' ||
      type === 'ss_lang' || type === 'low_cad' || type === 'big_gear' || type === 'bergsim') return ['high'];
  if (type === 'vo2max' || type === 'vo2_short' || type === 'vo2_medium' || type === 'vo2_long' ||
      type === 'vo2_3015' || type === 'microbursts') return ['anaerobic'];
  if (type === 'pendel_trip_intervals') return ['low', 'high'];  // tocht-pendel: vast low+high (heen Z2 + terug sweet-spot), doel-onafhankelijk
  if (type.indexOf('pendel_') === 0) {
    // pendel met intervallen — afhankelijk van doel
    if (doel === 'VO2max') return ['low', 'anaerobic'];
    return ['low', 'high'];
  }
  if (type === 'combo_long_with_efforts') return ['low', 'high'];
  if (type === 'combo_z2_tempo')          return ['low', 'high'];
  if (type === 'combo_z2_vo2')            return ['low', 'anaerobic'];
  if (type === 'combo_ss_sprints')        return ['high', 'anaerobic'];
  if (type === 'combo_all_three')         return ['low', 'high', 'anaerobic'];
  if (type === 'test') {
    if (doel === 'FTP' || doel === 'Beklimmingen') return ['high'];
    if (doel === 'VO2max') return ['anaerobic'];
    return ['low', 'high'];
  }
  return [];
}

// ── RPE-3: expected RPE + mismatch flag ─────────────────────────────
// Peak intensity drives perceived exertion → combos take their hardest bucket.
// Bucket lists mirror workoutZones. workoutZones() vereist een `doel`-arg
// (pendel/test hangen ervan af) die deze context-vrije helpers niet hebben;
// daarom hier expliciete lijsten i.p.v. workoutZones-reuse.
var RPE_LOW_TYPES_  = ['long_z2','recovery','pendel_z2','fatox','taper_z2_kort','tour_taper_z2'];
var RPE_HIGH_TYPES_ = ['sweet_spot','threshold','tempo','klim','conditie','ss_lang','low_cad','big_gear','bergsim','threshold_long','sweet_spot_long'];
var RPE_ANA_TYPES_  = ['vo2max','vo2_short','vo2_medium','vo2_long','vo2_3015','microbursts','taper_openers','vo2_hill_repeats','anaerobic_capacity'];
var RPE_EXPECTED_   = { low: 3.5, high: 7, anaerobic: 9 };

function rpeBucket_(type) {
  if (!type) return null;
  var t = String(type);
  if (RPE_ANA_TYPES_.indexOf(t)  >= 0) return 'anaerobic';
  if (RPE_HIGH_TYPES_.indexOf(t) >= 0) return 'high';
  if (RPE_LOW_TYPES_.indexOf(t)  >= 0) return 'low';
  // combos / variants not in explicit lists: classify by hardest component
  if (t.indexOf('vo2') >= 0 || t === 'combo_z2_vo2' || t === 'combo_ss_sprints' || t === 'combo_all_three') return 'anaerobic';
  if (t === 'combo_long_with_efforts' || t === 'combo_z2_tempo' || t.indexOf('tempo') >= 0 || t.indexOf('sweet') >= 0 || t.indexOf('threshold') >= 0) return 'high';
  if (t.indexOf('pendel') >= 0) return 'high';
  if (t.indexOf('z2') >= 0 || t.indexOf('recovery') >= 0 || t.indexOf('taper') >= 0) return 'low';
  return null;
}

function expectedRpe_(type) {
  var b = rpeBucket_(type);
  return b ? RPE_EXPECTED_[b] : null;
}

function plannedTypeForDate_(dISO, mondayISO) {
  try {
    var w = getDocProp('weekplan_' + mondayISO, '');
    if (w) { var arr = JSON.parse(w); for (var i = 0; i < arr.length; i++) {
      var e = arr[i];
      if (e && formatDate(new Date(e.datum),'yyyy-MM-dd') === dISO && e.workoutType) return e.workoutType;
    } }
  } catch (e) {}
  try {
    var p = getDocProp('proposal_' + dISO, '');
    if (p) { var o = JSON.parse(p); if (o) return o.workoutType || o.type || null; }
  } catch (e) {}
  return null;
}

function rpeWeekData_() {
  var today = new Date();
  var monday = weekStartDate(today);   // hergebruik bestaande maandag-helper
  var mondayISO = formatDate(monday,'yyyy-MM-dd');
  var out = []; var d = new Date(monday);
  while (d <= today) {
    var dISO = formatDate(d,'yyyy-MM-dd');
    var raw = getDocProp('rpe_' + dISO, '');
    if (raw !== '') {
      var type = plannedTypeForDate_(dISO, mondayISO);
      out.push({ dISO: dISO, date: new Date(d), actual: parseInt(raw,10), type: type, expected: expectedRpe_(type) });
    }
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/**
 * Gemiddelde RPE-mismatch (werkelijk − verwacht) over de laatste ≤3
 * gegradeerde sessies van deze week. Null bij < 2 sessies. Gedeeld door
 * rpeMismatchFlag_ (display) en rpeSignal_ (bijsturing) zodat ze nooit
 * uit elkaar lopen.
 */
function rpeRecentMismatch_() {
  var data = rpeWeekData_().filter(function (x) { return x.expected != null; });
  if (data.length < 2) return null;
  var recent = data.slice(-3);
  var sum = 0;
  for (var i = 0; i < recent.length; i++) sum += (recent[i].actual - recent[i].expected);
  return { avg: sum / recent.length, n: recent.length };
}

function rpeMismatchFlag_() {
  var m = rpeRecentMismatch_();
  if (!m || m.avg < 2) return '';
  return '⚠️ Laatste ' + m.n + ' sessies voelden zwaarder dan gepland (gem. +' +
         m.avg.toFixed(1).replace('.', ',') + ' RPE) — resterende harde sessies automatisch lichter gemaakt.';
}

/**
 * RPE-gedreven bijstuur-signaal voor assignWorkouts. Eénrichting (alleen
 * demote bij zwaarder-dan-gepland), gecapt op 'demote' — nooit 'recovery'.
 * Drempel +2 = identiek aan rpeMismatchFlag_ zodat banner en actie samenvallen.
 */
function rpeSignal_() {
  var m = rpeRecentMismatch_();
  if (!m || m.avg < 2) return { signal: 'normal', reason: '' };
  return {
    signal: 'demote',
    reason: 'RPE +' + m.avg.toFixed(1).replace('.', ',') + ' deze week (laatste ' + m.n + ' sessies zwaarder dan gepland)'
  };
}

/**
 * Gemiddelde RPE-mismatch (werkelijk − verwacht) over VORIGE week (ma t/m zo).
 * Durabele keys: rpe_<datum> (nooit gewist) + weekplan_<vorige-maandag> (per
 * maandag, niet gewist door cleanupOldProposals_). Null bij < 2 gegradeerde
 * sessies. Hele-week-gemiddelde (niet laatste-3) — dit is een week-trend.
 */
function rpeLastWeekMismatch_() {
  var thisMonday = weekStartDate(new Date());
  var lastMonday = new Date(thisMonday.getTime() - 7 * 24 * 60 * 60 * 1000);
  var lastMondayISO = formatDate(lastMonday, 'yyyy-MM-dd');
  var diffs = [];
  var d = new Date(lastMonday);
  for (var i = 0; i < 7; i++) {
    var dISO = formatDate(d, 'yyyy-MM-dd');
    var raw = getDocProp('rpe_' + dISO, '');
    if (raw !== '') {
      var exp = expectedRpe_(plannedTypeForDate_(dISO, lastMondayISO));
      if (exp != null) diffs.push(parseInt(raw, 10) - exp);
    }
    d.setDate(d.getDate() + 1);
  }
  if (diffs.length < 2) return null;
  var sum = 0; for (var j = 0; j < diffs.length; j++) sum += diffs[j];
  return { avg: sum / diffs.length, n: diffs.length };
}

/**
 * Pure mapping mismatch-gemiddelde → demp-factor. < 2 = geen demping (1);
 * ≥ 2 = ×0,93 (cancelt ~één build-step); ≥ 3,5 = ×0,88 (vloer).
 */
function carryFactorForAvg_(avg) {
  if (avg == null || avg < 2) return 1;
  return (avg >= 3.5) ? 0.88 : 0.93;
}

/**
 * Week-op-week load-demping (b2). Recovery-week overgeslagen (niet dubbel
 * snijden bovenop MESO_MOD[4]=0,60). Geeft { factor, reason }.
 */
function loadCarryFactor_(mesoWeek) {
  if (mesoWeek === 4) return { factor: 1, reason: '' };
  var m = rpeLastWeekMismatch_();
  var factor = m ? carryFactorForAvg_(m.avg) : 1;
  if (factor === 1) return { factor: 1, reason: '' };
  return {
    factor: factor,
    reason: 'Vorige week +' + m.avg.toFixed(1).replace('.', ',') + ' RPE zwaarder (' +
            m.n + ' sessies) → load gedempt (×' + factor.toFixed(2).replace('.', ',') +
            ', ramp aangehouden)'
  };
}

function rpeStatusLines_() {
  var data = rpeWeekData_();
  if (!data.length) return [];
  var lines = ['', '🟦 Recente RPE'];
  for (var i = 0; i < data.length; i++) {
    var x = data[i];
    var expTxt = (x.expected != null) ? ' (verwacht ~' + Math.round(x.expected) + ')' : '';
    lines.push('  ' + formatDate(x.date,'d/M') + ': RPE ' + x.actual + expTxt);
  }
  var flag = rpeMismatchFlag_();
  if (flag) lines.push(flag);
  return lines;
}

// ════════════════════════════════════════════════════════════════
// VARIANT-ENGINE (DEEL 3) — pools + selectie + renderer
// ════════════════════════════════════════════════════════════════

// Fase past %FTP-offset toe bovenop de meso-factor (variant = vorm,
// fase/meso = intensiteit/volume).
var VARIANT_FASE_OFFSET = { Base: -2, Build: 0, Peak: 2, Taper: 0, Recovery: 0, Test: 0 };

/** Weken sinds doel-startdatum (deterministisch, reproduceerbaar). */
function weekIndexFromStart_(settings) {
  var start = settings.doelStart || new Date();
  var s0 = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  var ws = weekStartDate(new Date());
  var diff = Math.floor((ws - s0) / (7 * 24 * 60 * 60 * 1000));
  return diff < 0 ? 0 : diff;
}

/** Verzamelt alle pools (generiek + per doel-library) in één object. */
function getPool_(type) {
  var pools = {};
  function merge(p) { if (p) Object.keys(p).forEach(function (k) { pools[k] = p[k]; }); }
  merge(genericPools_());
  merge(ftpPools_());
  merge(vo2Pools_());
  merge(conditiePools_());
  merge(climbPools_());
  return pools[type] || null;
}

function findVariantById_(pool, id) {
  for (var i = 0; i < pool.length; i++) if (pool[i].id === id) return pool[i];
  return null;
}

/**
 * Kiest een variant uit de pool voor `type`. Pure functie van
 * (type, weekIndex, slot) — geen DocProp-state meer.
 *
 * Roteert wekelijks via weekIndex EN verschilt per dag via slot (dagIdx),
 * zodat twee dagen van hetzelfde type NIET dezelfde workout krijgen.
 * Omdat opslag (assignWorkouts) en render (renderProposal) beide met
 * dezelfde (weekIndex, dagIdx) aanroepen, matchen ze altijd zonder cache.
 */
function selectVariant_(type, weekIndex, slot) {
  var pool = getPool_(type);
  if (!pool || !pool.length) return null;
  var idx = (((weekIndex + (slot || 0)) % pool.length) + pool.length) % pool.length;
  return pool[idx];
}

/**
 * Schaalt een blocks-array (steady + interval entries) zodat de hoofd-
 * duur past binnen (mins - warm - cool). Returnt de originele array als
 * mins ontbreekt, target ≤ 0, of de blocks al passen. Anders een kopie
 * met aangepaste reps/durMin.
 *
 * Strategie: één globale factor toepassen op alle reps (intervals) en
 * durMin (steady). Daarna in een guard-loop nog 1-rep-tegelijk per
 * grootste interval-blok eraf trimmen tot het past. Floor per interval:
 * 2 reps voor lange werk-intervals (onMin >= 8), anders 3. Steady minimum
 * 10 min.
 */
function scaleBlocksToFit_(blocks, mins, warm, cool) {
  if (!mins || mins <= 0) return blocks;
  function mainDur(bs) {
    var t = 0;
    bs.forEach(function (b) {
      if (b.kind === 'int') {
        var on  = b.onMin != null ? b.onMin : b.onSec / 60;
        var off = b.offMin != null ? b.offMin : b.offSec / 60;
        t += b.reps * (on + off);
      } else { t += b.durMin; }
    });
    return t;
  }
  var target = mins - warm - cool;
  if (target <= 0) return blocks;
  if (mainDur(blocks) <= target) return blocks;
  var out = blocks.map(function (b) { var c = {}; for (var k in b) c[k] = b[k]; return c; });
  var factor = target / mainDur(out);
  out.forEach(function (b) {
    if (b.kind === 'int') {
      var on = b.onMin != null ? b.onMin : b.onSec / 60;
      var floorReps = Math.min(b.reps, on >= 8 ? 2 : 3);
      b.reps = Math.max(floorReps, Math.round(b.reps * factor));
    } else {
      b.durMin = Math.max(b.minMin != null ? b.minMin : 10, Math.round(b.durMin * factor));
    }
  });
  var guard = 0;
  while (mainDur(out) > target && guard++ < 50) {
    var pick = null, pickDur = -1;
    out.forEach(function (b) {
      if (b.kind !== 'int') return;
      var on = b.onMin != null ? b.onMin : b.onSec / 60;
      var floorReps = Math.min(b.reps, on >= 8 ? 2 : 3);
      if (b.reps > floorReps) {
        var off = b.offMin != null ? b.offMin : b.offSec / 60;
        var dur = b.reps * (on + off);
        if (dur > pickDur) { pickDur = dur; pick = b; }
      }
    });
    if (!pick) break;
    pick.reps -= 1;
  }
  // Pass 3: reps zitten op de floor maar het past nog niet → kort de
  // interval-lengte (onMin) en steady-duur in tot het past, met ondergrenzen.
  // Korte (sec-based) intervallen blijven ongemoeid — die zijn al kort.
  if (mainDur(out) > target) {
    var f2 = target / mainDur(out); // < 1
    out.forEach(function (b) {
      if (b.kind === 'int') {
        if (b.onMin != null) {
          b.onMin = Math.max(5, Math.round(b.onMin * f2));
          if (b.offMin != null) b.offMin = Math.max(2, Math.round(b.offMin * f2));
        }
      } else {
        b.durMin = Math.max(b.minMin != null ? b.minMin : 8, Math.round(b.durMin * f2));
      }
    });
  }
  return out;
}

/**
 * %FTP → zone-bucket voor de dashboard zone-balk (5-bucket resolutie).
 * rust < 56 / z2 56-75 / tempo 76-90 / drempel 91-105 / anaeroob > 105.
 */
function pctZoneBucket_(pct) {
  pct = Number(pct) || 0;
  if (pct < 56)  return 'rust';
  if (pct <= 75) return 'z2';
  if (pct <= 90) return 'tempo';
  if (pct <= 105) return 'drempel';
  return 'anaeroob';
}

/**
 * Item C: zone-gewogen TSS — ENIGE bron van de per-zone-rates.
 * buckets = {low, high, anaerobic} in MINUTEN (warm/cool tellen mee als low).
 * Effectieve IF daalt als low-minuten groeien (langere duur → meer Z2-vulling).
 */
function tssFromZoneMinutes_(buckets) {
  buckets = buckets || {};
  var low = buckets.low || 0, high = buckets.high || 0, anaerobic = buckets.anaerobic || 0;
  return Math.round(low * 0.7 + high * 0.95 + anaerobic * 1.05);
}

/**
 * Rendert een variant-spec naar een workout-object met intent.
 * adj(basePct) = round(basePct * mesoFactor) + fase-offset.
 * intent = target tijd-in-zone (min) per load-focus bucket.
 * mins (optioneel) = beschikbare minuten — als gegeven, krimpen blocks
 * via scaleBlocksToFit_ zodat totaalMin onder mins blijft waar mogelijk.
 *
 * ADDITIEF: emit ook `blokken` = geordende [{minuten, zone}] (zone uit
 * %FTP via pctZoneBucket_) voor de dashboard zone-balk. structuur/intent/
 * generatie ongewijzigd.
 */
function renderVariant_(variant, settings, mesoWeek, macroFase, mins) {
  var ftp = settings.ftp, lthr = settings.lthr;
  var f = mesoFactor(mesoWeek);
  var off = VARIANT_FASE_OFFSET[macroFase] || 0;
  var adj = function (p) { return Math.round(p * f) + off; };

  var warm = variant.warmup || 12, cool = variant.cooldown || 10;
  // Pack short sessions: bij ≤75 min beschikbaar trimmen we de warmup/
  // cooldown alvast, anders eet die overhead te veel van de main op
  // (een 3×10 threshold past dan niet meer in 60 min).
  if (mins && mins <= 75) { warm = Math.min(warm, 10); cool = Math.min(cool, 8); }
  var structuur = [['Warmup', warm + ' min', wattsRange(ftp, 50, 68), bpmBelow(lthr, 85), 'Inrijden, opbouwend']];
  var intent = { low: warm + cool, high: 0, anaerobic: 0 };
  var mainMin = 0;
  var blokken = [{ minuten: warm, zone: 'rust' }];   // warmup laag-intensief

  var rawBlocks = variant.blocks(adj);
  var blocks = scaleBlocksToFit_(rawBlocks, mins, warm, cool);
  var ingekort = (blocks !== rawBlocks);
  blocks.forEach(function (b) {
    if (b.kind === 'int') {
      var onMin  = b.onMin != null ? b.onMin : b.onSec / 60;
      var offMin = b.offMin != null ? b.offMin : b.offSec / 60;
      var onStr  = (b.onMin != null ? b.onMin + ' min' : b.onSec + ' sec');
      var offStr = (b.offMin != null ? b.offMin + ' min' : b.offSec + ' sec');
      structuur.push([
        b.label,
        b.reps + 'x ' + onStr,
        wattsRange(ftp, b.onPct - 2, b.onPct + 2),
        bpmRange(lthr, 95, 106),
        offStr + ' rust @ ' + b.offPct + '%'
      ]);
      intent[variant.zone] += b.reps * onMin;
      intent.low += b.reps * offMin;
      mainMin += b.reps * (onMin + offMin);
      // per rep: werk-blok + rust-blok → interval-vorm in de balk
      var onZone = pctZoneBucket_(b.onPct), offZone = pctZoneBucket_(b.offPct);
      for (var rr = 0; rr < b.reps; rr++) {
        if (onMin > 0)  blokken.push({ minuten: Math.round(onMin * 10) / 10, zone: onZone });
        if (offMin > 0) blokken.push({ minuten: Math.round(offMin * 10) / 10, zone: offZone });
      }
    } else { // steady
      var z = b.zone || variant.zone;
      structuur.push([
        b.label, b.durMin + ' min',
        wattsRange(ftp, b.pct - 2, b.pct + 2),
        bpmRange(lthr, 78, 92), b.note || 'Stabiel'
      ]);
      intent[z] += b.durMin;
      mainMin += b.durMin;
      blokken.push({ minuten: b.durMin, zone: pctZoneBucket_(b.pct) });
    }
  });

  // (A) Endurance-fill: lange dag → vul de restduur met Z2 i.p.v. onder-vullen.
  // Vaste harde set (scaleBlocksToFit_ schaalt reps NIET omhoog) + Z2-rest.
  if (mins) {
    var gap = (mins - warm - cool) - mainMin;
    if (gap >= 5) {
      structuur.push(['Z2 endurance', gap + ' min', wattsRange(ftp, 63, 72), bpmRange(lthr, 78, 88), 'Aanvullende duur — rustige Z2']);
      blokken.push({ minuten: gap, zone: 'z2' });
      mainMin += gap;
      intent.low += gap;   // helper telt deze als low (0.7) → IF daalt
    }
  }

  structuur.push(['Cooldown', cool + ' min', wattsRange(ftp, 45, 55), '—', 'Easy uit']);
  blokken.push({ minuten: cool, zone: 'rust' });

  var totaalMin = warm + cool + mainMin;
  Object.keys(intent).forEach(function (k) { intent[k] = Math.round(intent[k]); });

  var tooLong = (mins && totaalMin > mins) ? { available: mins, needed: totaalMin } : null;

  return {
    naam: variant.naam + ' (' + macroFase + (ingekort ? ', ingekort' : '') + ')',
    focus: variant.zone,
    zones: [variant.zone],
    variantId: variant.id,
    totaalMin: totaalMin,
    structuur: structuur,
    intent: intent,
    blokken: blokken,
    tss: tssFromZoneMinutes_(intent),
    eindopmerking: variant.tip || (variant.naam + ' — variant van deze week (roteert wekelijks).'),
    tooLong: tooLong
  };
}

// ════════════════════════════════════════════════════════════════
// TRAININGEN-BIBLIOTHEEK (read-side) — {categorie → varianten[]} via de
// BESTAANDE pure builders (renderVariant_ + segmentsFromBlokken_ +
// tssFromZoneMinutes_). Géén DocProp-state; veilig per request.
// ════════════════════════════════════════════════════════════════

// Display-categorie → engine-pool-type + design-tokens. zoneVar = marker/naam-
// kleur uit het 6-zone-model (tr_cats.png + tokens.css). defaultDur = slider-start.
// Sweet Spot + FTP/Drempel delen --zone-4 (amber, threshold-familie; geen aparte token).
var TRAINING_CATS_ = [
  { key: 'herstel',   label: 'Herstel',       type: 'recovery',   zoneVar: '--zone-1', fase: 'Base',  defaultDur: 45,  omschrijving: 'Actief herstel, heel rustig' },
  { key: 'duur',      label: 'Duurvermogen',  type: 'long_z2',    zoneVar: '--zone-2', fase: 'Base',  defaultDur: 120, omschrijving: 'Aerobe basis · lange rustige ritten' },
  { key: 'tempo',     label: 'Tempo',         type: 'tempo',      zoneVar: '--zone-3', fase: 'Build', defaultDur: 75,  omschrijving: 'Stevig aeroob · comfortabel-hard' },
  { key: 'sweetspot', label: 'Sweet Spot',    type: 'sweet_spot', zoneVar: '--zone-4', fase: 'Build', defaultDur: 75,  omschrijving: 'Veel prikkel · beheersbare vermoeidheid' },
  { key: 'ftp',       label: 'FTP / Drempel', type: 'threshold',  zoneVar: '--zone-4', fase: 'Build', defaultDur: 75,  omschrijving: 'Rond je 1-uurs vermogen' },
  { key: 'vo2max',    label: 'VO2max',        type: 'vo2max',     zoneVar: '--zone-5', fase: 'Peak',  defaultDur: 75,  omschrijving: 'Korte, felle intervallen' }
];

// Herstel heeft geen variant-pool → kleine declaratieve set in dezelfde spec-vorm.
function recoveryPool_() {
  return [
    { id: 'rec_licht', naam: 'Hersteldrit licht', zone: 'low', warmup: 5, cooldown: 5,
      blocks: function (a) { return [{ kind: 'steady', label: 'Herstel', durMin: 35, pct: a(50) }]; },
      tip: 'Heel licht — actief herstel, niet pushen.' },
    { id: 'rec_los', naam: 'Benen losdraaien', zone: 'low', warmup: 5, cooldown: 5,
      blocks: function (a) { return [{ kind: 'steady', label: 'Soepel', durMin: 20, pct: a(48) }]; },
      tip: 'Soepel draaien op hoge cadans.' }
  ];
}

/**
 * Bouwt de Trainingen-bibliotheek: per categorie tot 5 varianten met ZoneBar-
 * segmenten (+hoogtePct), blok-structuur (label/duur/watt) en zone-gewogen TSS —
 * alles uit de bestaande builders. `intent` {low,high,anaerobic} gaat mee zodat
 * de client de duur-slider live kan herrekenen (extra duur → Z2 → tssFromZoneMinutes_).
 * @return [{ key,label,zoneVar,omschrijving,defaultDur,type, variants:[...] }]
 */
function getTrainingLibrary_(settings) {
  return TRAINING_CATS_.map(function (cat) {
    var pool = (cat.type === 'recovery') ? recoveryPool_() : (getPool_(cat.type) || []);
    var variants = pool.slice(0, 5).map(function (v) {
      var wo = renderVariant_(v, settings, 1, cat.fase, cat.defaultDur);
      return {
        variantId: v.id,
        naam: v.naam,
        type: cat.type,
        durMin: wo.totaalMin,
        intent: { low: wo.intent.low || 0, high: wo.intent.high || 0, anaerobic: wo.intent.anaerobic || 0 },
        segmenten: segmentsFromBlokken_(wo.blokken) || [],
        structuur: wo.structuur,
        tss: wo.tss,
        tip: v.tip || ''
      };
    });
    return {
      key: cat.key, label: cat.label, zoneVar: cat.zoneVar,
      omschrijving: cat.omschrijving, defaultDur: cat.defaultDur, type: cat.type,
      variants: variants
    };
  });
}

// PERF: cross-execution cache van getTrainingLibrary_ (puur in settings.ftp +
// settings.lthr; mesoWeek=1 + macroFase=cat.fase zijn statisch → géén datum/fase/
// wellness-afhankelijkheid). Key bevat exact die twee inputs → zelf-invalidatie bij
// FTP/LTHR-wijziging; 6h backstop. getTrainingLibrary_ blijft ONGEMOEID (test-gate).
function getTrainingLibraryCached_(settings) {
  var cache = CacheService.getUserCache();
  var key = 'trainlib_v1_' + Utilities.base64Encode(
    Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify([settings.ftp, settings.lthr])));
  var hit = cache.get(key);
  if (hit) { try { return JSON.parse(hit); } catch (e) {} }
  var lib = getTrainingLibrary_(settings);
  try { cache.put(key, JSON.stringify(lib), 21600); } catch (e) {}   // 6h; key zelf-invalideert op input-wijziging
  return lib;
}

// ── Day-override: bouw de gekozen workout (bibliotheek-variant óf vrije rit) ──
// Bibliotheek: render de SPECIFIEKE variant (variantId) op de gekozen duur; valt
// terug op buildWorkout(type) als de variant ontbreekt. Vrij/groep: synthese met
// één steady-blok (intensiteit → %FTP-zone) zodat TSS/zones bestaan voor Garmin.
var FREE_RIDE_PCT_  = { rustig: 65, tempo: 80, stevig: 96 };
var FREE_RIDE_ZONE_ = { rustig: 'low', tempo: 'high', stevig: 'high' };

function buildFreeRideWorkout_(ov, settings) {
  var dur = Math.max(20, Math.round(ov.durMin || 90));
  var pct = FREE_RIDE_PCT_[ov.intensiteit] || 65;
  var zone = FREE_RIDE_ZONE_[ov.intensiteit] || 'low';
  var intent = { low: 0, high: 0, anaerobic: 0 };
  intent[zone] = dur;
  var label = (ov.ritType === 'groep') ? 'Groepsrit' : 'Vrije rit';
  return {
    naam: label + ' · ' + (ov.intensiteit || 'rustig'),
    focus: 'free', zones: [zone], totaalMin: dur, intent: intent,
    blokken: [{ minuten: dur, zone: pctZoneBucket_(pct) }],
    structuur: [[label, dur + ' min', wattsRange(settings.ftp, pct - 8, pct + 4), '—', 'Op gevoel rijden']],
    tss: tssFromZoneMinutes_(intent),
    eindopmerking: label + ' op gevoel — geen vaste blokstructuur.'
  };
}

function buildOverrideWorkout_(ov, settings, mesoWeek, macroFase, eventCtx, dagIdx) {
  if (!ov) return null;
  if (ov.type === 'free') return buildFreeRideWorkout_(ov, settings);
  var dur = Math.max(20, Math.round(ov.durMin || 60));
  if (ov.variantId) {
    var pool = (ov.workoutType === 'recovery') ? recoveryPool_() : getPool_(ov.workoutType);
    var v = pool ? findVariantById_(pool, ov.variantId) : null;
    if (v) return renderVariant_(v, settings, mesoWeek, macroFase, dur);
  }
  return buildWorkout(ov.workoutType, dur, settings, mesoWeek, macroFase, eventCtx, dagIdx);
}

/** Override → weekplan-entry (zelfde shape als een gewone dag; override:true-vlag). */
function overrideWeekplanEntry_(dISO, ov, wo) {
  var intent = ensureIntent_(wo);
  return {
    datum: dISO,
    workoutType: (ov.type === 'free') ? 'free' : ov.workoutType,
    naam: wo.naam || 'Handmatig gekozen',
    variantId: ov.variantId || wo.variantId || null,
    zones: wo.zones || [],
    intent: intent,
    blokken: wo.blokken || null,
    structuur: wo.structuur || null,
    tss: Math.round(wo.tss || 0),
    minuten: Math.round(wo.totaalMin || 0),
    reden: 'Handmatig gekozen',
    override: true,
    sessies: [{ naam: wo.naam || '', totaalMin: wo.totaalMin || 0, tss: Math.round(wo.tss || 0), intent: intent, eindopmerking: wo.eindopmerking || '' }]
  };
}

/** Unieke geplande workout-types in de huidige week (voor de "In je blok"-badge). */
function weekPlannedTypes_(weekStart) {
  var raw = getDocProp('weekplan_' + formatDate(weekStart, 'yyyy-MM-dd'), '');
  if (!raw) return [];
  var set = {};
  try {
    var arr = JSON.parse(raw);
    if (Array.isArray(arr)) arr.forEach(function (e) {
      var t = e && (e.workoutType || e.voorgesteldType);
      if (t) set[t] = true;
    });
  } catch (e) {}
  return Object.keys(set);
}

/** Generieke pools (doel-onafhankelijk): lange Z2 + tempo. */
function genericPools_() {
  return {
    long_z2: [
      { id: 'z2_steady', naam: 'Lange Z2 steady', zone: 'low', warmup: 10, cooldown: 5,
        blocks: function (a) { return [{ kind: 'steady', label: 'Z2', durMin: 90, pct: a(70) }]; },
        tip: 'Continu Z2 — aerobe motor.' },
      { id: 'z2_cadans', naam: 'Z2 + hoge cadans', zone: 'low', warmup: 10, cooldown: 5,
        blocks: function (a) { return [
          { kind: 'steady', label: 'Z2', durMin: 50, pct: a(70) },
          { kind: 'int', label: 'Hoge cadans 95+rpm', reps: 3, onMin: 10, onPct: a(72), offMin: 5, offPct: a(60) }
        ]; },
        tip: 'Z2 met cadans-blokken 95+ rpm — pedaalefficiëntie.' },
      { id: 'z2_progressief', naam: 'Z2 progressief', zone: 'low', warmup: 10, cooldown: 5,
        blocks: function (a) { return [
          { kind: 'steady', label: 'Z2', durMin: 70, pct: a(68) },
          { kind: 'steady', label: 'Bovenkant Z2', durMin: 20, pct: a(75) }
        ]; },
        tip: 'Laatste 20% naar bovenkant Z2.' },
      { id: 'z2_nuchter', naam: 'Z2 nuchter', zone: 'low', warmup: 10, cooldown: 5,
        blocks: function (a) { return [{ kind: 'steady', label: 'Z2 nuchter', durMin: 80, pct: a(68) }]; },
        tip: 'Ochtend nuchter, strak Z2 — vetverbranding.' }
    ],
    tempo: [
      { id: 'tempo_2x20', naam: 'Tempo 2×20', zone: 'high', warmup: 12, cooldown: 8,
        blocks: function (a) { return [{ kind: 'int', label: 'Tempo', reps: 2, onMin: 20, onPct: a(82), offMin: 5, offPct: 50 }]; } },
      { id: 'tempo_3x15', naam: 'Tempo 3×15', zone: 'high', warmup: 12, cooldown: 8,
        blocks: function (a) { return [{ kind: 'int', label: 'Tempo', reps: 3, onMin: 15, onPct: a(80), offMin: 4, offPct: 50 }]; } },
      { id: 'tempo_45', naam: 'Tempo 45min continu', zone: 'high', warmup: 12, cooldown: 8,
        blocks: function (a) { return [{ kind: 'steady', label: 'Tempo continu', durMin: 45, pct: a(78) }]; } }
    ]
  };
}

/**
 * Bouwt een concrete workout. Variant-pools eerst, dan generieke/doel-
 * specifieke routing. macroFase/meso schalen intensiteit binnen de variant.
 */
function buildWorkout(type, mins, settings, mesoWeek, macroFase, eventCtx, slot, archetypeId) {
  // FASE 1 deel 2b.2 — een gekozen archetype expandeert direct (overrulet de type-dispatch).
  // INERT tot keyIntensity een archetypeId zet (commit 2). Onbekend id → val door naar de dispatch.
  if (archetypeId) {
    var arec = null;
    for (var ai = 0; ai < ARCHETYPES.length; ai++) { if (ARCHETYPES[ai].id === archetypeId) { arec = ARCHETYPES[ai]; break; } }
    if (arec) {
      var awo = expandArchetype_(arec, { ftp: settings.ftp, lthr: settings.lthr, doelMin: mins,
        mesoFactor: mesoFactor(mesoWeek), faseOffset: (VARIANT_FASE_OFFSET[macroFase] || 0) });
      if (awo) { awo.archetypeId = archetypeId; return awo; }
    }
  }
  var doel = settings.doel;
  var ftp = settings.ftp, lthr = settings.lthr;

  // Taper-workouts (event-driven laatste week)
  if (type === 'taper_openers')  return genericTaperOpeners(settings);
  if (type === 'taper_z2_kort')  return genericTaperZ2Kort(mins, settings);
  if (type === 'tour_taper_z2')  return genericTourTaperZ2(mins, settings, eventCtx);

  // long_z2 met event-context → endurance scaling (behoud event-feature)
  if (type === 'long_z2' && eventCtx) return genericLongZ2(mins, settings, mesoWeek, eventCtx);

  // Variant-pool categorie? (vo2max/sweet_spot/threshold/tempo/long_z2/klim/conditie)
  if (getPool_(type)) {
    var variant = selectVariant_(type, weekIndexFromStart_(settings), slot);
    if (variant) return renderVariant_(variant, settings, mesoWeek, macroFase, mins);
  }

  // Klim-type-specifieke legacy workouts (nog callable; niet meer geselecteerd)
  if (type === 'vo2_hill_repeats')   return genericVo2HillRepeats(mins, settings, mesoWeek);
  if (type === 'anaerobic_capacity') return genericAnaerobicCapacity(mins, settings, mesoWeek);
  if (type === 'threshold_long')     return genericThresholdLong(mins, settings, mesoWeek);
  if (type === 'sweet_spot_long')    return genericSweetSpotLong(mins, settings, mesoWeek);

  if (type === 'recovery')    return genericRecovery(mins, settings);
  if (type === 'pendel_z2')   return genericPendelZ2(mins, settings, mesoWeek, macroFase);
  if (type.indexOf('pendel_') === 0 && type.indexOf('_intervals') > 0) {
    return genericPendelIntervals(type, mins, settings, mesoWeek, macroFase, doel);
  }
  if (type.indexOf('combo_') === 0) {
    return genericCombo(type, mins, settings, mesoWeek, doel);
  }

  // Doel-specifieke library
  var wo;
  if (doel === 'FTP')          wo = workoutForFtp(type, mins, settings, mesoWeek, macroFase);
  else if (doel === 'VO2max')  wo = workoutForVo2max(type, mins, settings, mesoWeek, macroFase);
  else if (doel === 'Conditie')wo = workoutForConditie(type, mins, settings, mesoWeek, macroFase);
  else if (doel === 'Beklimmingen') wo = workoutForBeklimmingen(type, mins, settings, mesoWeek, macroFase);

  if (wo) return wo;

  // Fallback
  return genericRecovery(mins, settings);
}

// ─── Generieke workouts ──────────────────────────────────────────

/**
 * Lange Z2. Schaalt naar event-afstand wanneer eventCtx is meegegeven:
 * bouwt geleidelijk op naar 40→80% van de geschatte event-rijtijd in de
 * weken vóór het event (cap 5u). Bij bergachtig profiel (hm/km > 1.0)
 * worden klim-simulatie tempo/threshold blokken toegevoegd.
 */
function genericLongZ2(mins, settings, mesoWeek, eventCtx) {
  var ftp = settings.ftp, lthr = settings.lthr;
  // Beschikbaarheid (d.minuten via mins) is leidend; meso-factor mag nog
  // krimpen voor recovery-week. EventCtx geeft alleen het hilly-profiel,
  // NIET een duur-override (eerder werd 120 → 163 gepusht, fout).
  var requested = Math.max(60, Math.round((mins || 90) * mesoFactor(mesoWeek)));

  var hilly = !!(eventCtx && eventCtx.hm > 0 && eventCtx.afstandKm > 0 &&
                 (eventCtx.hm / Math.max(1, eventCtx.afstandKm) > 1.0));

  // Duration-aware klim-sim: schaal het aantal 8-min reps zodat warmup +
  // klim + minimum Z2-base binnen de beschikbare tijd past. klimReps van
  // 3 → 2 → 1 als nodig; valt nooit onder 1 rep zolang de tab hilly is.
  var minBase = 30; // onder 30min Z2 base is een long-rit niet zinvol
  var overhead = 15; // 10 warmup + 5 cooldown
  var klimReps = 0;
  function klimMin_(r) { return r * 8 + Math.max(0, r - 1) * 5; } // work + intra-rest
  if (hilly) {
    klimReps = 3;
    while (klimReps > 1 && overhead + klimMin_(klimReps) + minBase > requested) klimReps--;
  }
  var fixed = overhead + (hilly ? klimMin_(klimReps) : 0);
  var fits = requested >= fixed + minBase;
  var baseMin = fits ? (requested - fixed) : minBase;
  var totaalMin = fixed + baseMin;
  var tooLong = fits ? null : { available: requested, needed: fixed + minBase };

  var eind = 'Volume zonder vermoeidheid — de basis voor alle andere workouts.';
  if (eventCtx && eventCtx.naam) {
    eind = 'Bouw richting ' + eventCtx.naam + ' — ' +
           (eventCtx.afstandKm || '?') + 'km/' + (eventCtx.hm || '?') + 'hm.';
  }
  if (hilly) eind += ' Bergachtig profiel → klim-simulatie blokken erin.';

  var structuur;
  if (hilly) {
    structuur = [
      ['Warmup',   '10 min',         wattsRange(ftp, 50, 65), bpmBelow(lthr, 80), 'Rustig opbouwen'],
      ['Z2 base',  baseMin + ' min', wattsRange(ftp, 65, 75), bpmRange(lthr, 80, 89), 'Stabiele Z2'],
      ['Klim-sim', klimReps + 'x 8 min', wattsRange(ftp, 88, 95), bpmRange(lthr, 92, 99), '5 min rust @ 60% — simuleert de cols'],
      ['Cooldown', '5 min',          wattsRange(ftp, 45, 55), '—', 'Easy']
    ];
  } else {
    structuur = [
      ['Warmup',  '10 min',         wattsRange(ftp, 50, 65), bpmBelow(lthr, 80), 'Rustig opbouwen'],
      ['Hoofd',   baseMin + ' min', wattsRange(ftp, 65, 75), bpmRange(lthr, 80, 89), 'Stabiele Z2 — aerobic base'],
      ['Cooldown','5 min',          wattsRange(ftp, 45, 55), '—', 'Easy']
    ];
  }

  // Intent: high (klim-sim work) is vast, low schaalt met base.
  var intent = hilly
    ? { low: 10 + baseMin + Math.max(0, klimReps - 1) * 5 + 5, high: klimReps * 8, anaerobic: 0 }  // warmup + base + intra-rest + cooldown
    : { low: totaalMin, high: 0, anaerobic: 0 };

  // Geordende blokken voor de dashboard zone-balk (sluit de long_z2-gap +
  // fixt de onterechte gele staart: zonder blokken viel de balk terug op
  // de intent en kleurde klim-sim (high) geel i.p.v. groen/drempel).
  var blokken = [{ minuten: 10, zone: 'rust' }, { minuten: baseMin, zone: 'z2' }];
  if (hilly) {
    for (var kr = 0; kr < klimReps; kr++) {
      blokken.push({ minuten: 8, zone: pctZoneBucket_(91) });          // 88-95% → drempel (groen)
      if (kr < klimReps - 1) blokken.push({ minuten: 5, zone: 'z2' });  // intra-rust @ 60%
    }
  }
  blokken.push({ minuten: 5, zone: 'rust' });

  return {
    naam: 'Lange Z2 (' + totaalMin + ' min)',
    focus: 'aerobic base',
    zones: hilly ? ['low', 'high'] : ['low'],
    totaalMin: totaalMin,
    structuur: structuur,
    intent: intent,
    blokken: blokken,
    tss: tssFromZoneMinutes_(intent),
    eindopmerking: eind,
    tooLong: tooLong
  };
}

function genericRecovery(mins, settings) {
  var ftp = settings.ftp, lthr = settings.lthr;
  mins = Math.max(30, Math.min(60, mins || 45));
  return {
    naam: 'Recovery (' + mins + ' min)',
    focus: 'recovery',
    zones: ['low'],
    totaalMin: mins,
    structuur: [
      ['Hele rit', mins + ' min', wattsRange(ftp, 40, 55), bpmBelow(lthr, 75), 'Praat-tempo, soepel benen']
    ],
    tss: Math.round(mins * 0.35),
    eindopmerking: 'Bloed laten stromen, geen stress. Niet skippen — herstel is training.'
  };
}

// ─── Taper workouts (event-driven laatste week) ──────────────────

function genericTaperOpeners(settings) {
  var ftp = settings.ftp, lthr = settings.lthr;
  return {
    naam: 'Taper Openers (30 min)',
    focus: 'sharpness',
    zones: ['anaerobic'],
    totaalMin: 30,
    structuur: [
      ['Warmup',   '12 min', wattsRange(ftp, 50, 65),   bpmBelow(lthr, 80),    'Rustig opbouwen'],
      ['Openers',  '4x 30 sec', wattsRange(ftp, 110, 120), bpmRange(lthr, 95, 105), '90 sec rust @ 50% tussen reps'],
      ['Cooldown', '8 min',  wattsRange(ftp, 45, 55),   '—',                   'Easy uit']
    ],
    tss: 28,
    eindopmerking: 'Benen wakker maken, niet vermoeien. Kort en scherp — fitness is al gemaakt.'
  };
}

function genericTaperZ2Kort(mins, settings) {
  var ftp = settings.ftp, lthr = settings.lthr;
  mins = Math.max(30, Math.min(45, Math.round((mins || 40) * 0.5)));
  return {
    naam: 'Taper Z2 kort (' + mins + ' min)',
    focus: 'aerobic onderhoud',
    zones: ['low'],
    totaalMin: mins,
    structuur: [
      ['Hele rit', mins + ' min', wattsRange(ftp, 60, 72), bpmRange(lthr, 78, 86), 'Soepel, laag volume — fris blijven voor het event']
    ],
    tss: Math.round(mins * 0.6),
    eindopmerking: 'Volume bewust gehalveerd. Niet opbouwen meer — fris worden is het doel.'
  };
}

function genericTourTaperZ2(mins, settings, eventCtx) {
  var ftp = settings.ftp, lthr = settings.lthr;
  // Tour-taper endurance: NIET halveren — volume vasthouden voor durability,
  // intensiteit blijft Z2. Gebruik beschikbare tijd tot een redelijk plafond.
  var dur = Math.max(45, Math.min(120, Math.round(mins || 75)));
  var warm = 8, cool = 5;
  var base = dur - warm - cool;
  var eind = 'Endurance vasthouden voor durability — back-to-back dagen vragen zadeltijd. Intensiteit eruit, fris blijven.';
  if (eventCtx && eventCtx.naam) eind = 'Richting ' + eventCtx.naam + ': benen wennen aan uren, rustig aan. ' + eind;
  return {
    naam: 'Tour-taper Z2 (' + dur + ' min)',
    focus: 'aerobic onderhoud',
    zones: ['low'],
    totaalMin: dur,
    structuur: [
      ['Warmup',   warm + ' min', wattsRange(ftp, 50, 62), bpmBelow(lthr, 80),    'Rustig op gang'],
      ['Z2',       base + ' min', wattsRange(ftp, 62, 72), bpmRange(lthr, 76, 86), 'Soepel, tijd vol benutten'],
      ['Cooldown', cool + ' min', wattsRange(ftp, 45, 55), '—',                    'Easy uit']
    ],
    tss: Math.round(dur * 0.65),
    eindopmerking: eind
  };
}

// ─── Klim-type-specifieke workouts (event-driven) ────────────────

function genericVo2HillRepeats(mins, settings, mesoWeek) {
  var ftp = settings.ftp, lthr = settings.lthr;
  var f = mesoFactor(mesoWeek);
  mins = mins || 70;
  return {
    naam: 'VO2 Hill Repeats 9x90s',
    focus: 'explosive climbing',
    zones: ['anaerobic'],
    totaalMin: mins,
    structuur: [
      ['Warmup',   '15 min', wattsRange(ftp, 55, 80), bpmBelow(lthr, 92), 'Inrijden + 3x 30s openers'],
      ['Hill reps','9x 90 sec', wattsRange(ftp, Math.round(112 * f), Math.round(118 * f)), bpmRange(lthr, 100, 108), '2 min rust @ 50% — sta op bij de steile stukken'],
      ['Cooldown', '12 min', wattsRange(ftp, 45, 55), '—', 'Easy']
    ],
    tss: Math.round(mins * 1.05),
    eindopmerking: 'Korte explosieve klim-efforts voor punchy beklimmingen (Amstel/Ardennen) — herhaalbaar vermogen.'
  };
}

function genericAnaerobicCapacity(mins, settings, mesoWeek) {
  var ftp = settings.ftp, lthr = settings.lthr;
  var f = mesoFactor(mesoWeek);
  mins = mins || 60;
  return {
    naam: 'Anaerobic Capacity 10x 30/30s',
    focus: 'anaerobic capacity',
    zones: ['anaerobic'],
    totaalMin: mins,
    structuur: [
      ['Warmup', '15 min', wattsRange(ftp, 55, 80), bpmBelow(lthr, 92), 'Inrijden + 2x 1min openers'],
      ['30/30s', '10x 30 sec', wattsRange(ftp, Math.round(120 * f), Math.round(130 * f)), bpmRange(lthr, 100, 110), '30 sec rust @ 50% — maximaal herhaalbaar'],
      ['Cooldown', '10 min', wattsRange(ftp, 45, 55), '—', 'Easy']
    ],
    tss: Math.round(mins * 1.0),
    eindopmerking: 'Korte, snelle herhalingen voor steile korte klimmetjes — anaerobe capaciteit + snel herstel.'
  };
}

function genericThresholdLong(mins, settings, mesoWeek) {
  var ftp = settings.ftp, lthr = settings.lthr;
  var f = mesoFactor(mesoWeek);
  mins = mins || 80;
  return {
    naam: 'Threshold Long 3x14min',
    focus: 'sustained climbing',
    zones: ['high'],
    totaalMin: mins,
    structuur: [
      ['Warmup',   '15 min', wattsRange(ftp, 55, 75), bpmBelow(lthr, 90), 'Inrijden + 1x 3min @ 90%'],
      ['Threshold','3x 14 min', wattsRange(ftp, Math.round(95 * f), Math.round(102 * f)), bpmRange(lthr, 96, 100), '5 min rust @ 55% — pacing als een lange col'],
      ['Cooldown', '10 min', wattsRange(ftp, 45, 55), '—', 'Easy']
    ],
    tss: Math.round(mins * 1.1),
    eindopmerking: 'Sustained threshold voor lange alpine cols (Girona/Alpen) — leer uren in de klim-zone te pacen.'
  };
}

function genericSweetSpotLong(mins, settings, mesoWeek) {
  var ftp = settings.ftp, lthr = settings.lthr;
  var f = mesoFactor(mesoWeek);
  mins = mins || 85;
  return {
    naam: 'Sweet Spot Long 3x20min',
    focus: 'climbing endurance',
    zones: ['high'],
    totaalMin: mins,
    structuur: [
      ['Warmup',     '15 min', wattsRange(ftp, 55, 70), bpmBelow(lthr, 88), 'Inrijden'],
      ['Sweet Spot', '3x 20 min', wattsRange(ftp, Math.round(88 * f), Math.round(93 * f)), bpmRange(lthr, 92, 98), '6 min rust @ 50% — duurzame klim-belasting'],
      ['Cooldown',   '10 min', wattsRange(ftp, 45, 55), '—', 'Easy']
    ],
    tss: Math.round(mins * 1.0),
    eindopmerking: 'Lange sweet spot blokken bouwen het vermogen om uren in de klim-zone te blijven.'
  };
}

function genericPendelZ2(mins, settings, mesoWeek, macroFase) {
  var ftp = settings.ftp, lthr = settings.lthr;
  mins = mins || 150;
  var heen = Math.floor(mins / 2), terug = mins - heen;
  var isRecoveryWeek = (mesoWeek === 4) || (macroFase === 'Recovery');
  return {
    naam: isRecoveryWeek ? ('Pendel Z2 (' + mins + ' min, recovery week)')
                         : ('Pendel + Z2 (' + mins + ' min)'),
    focus: 'aerobic base',
    zones: ['low'],
    totaalMin: mins,
    structuur: [
      ['Heen',  heen + ' min',  wattsRange(ftp, 60, 72), bpmRange(lthr, 78, 86), 'Rustige Z2'],
      ['Terug', terug + ' min', wattsRange(ftp, 60, 72), bpmRange(lthr, 78, 86), 'Rustige Z2']
    ],
    tss: Math.round(mins * 0.6),
    eindopmerking: isRecoveryWeek ? 'Recovery-week pendel — geen intensiteit, alleen volume.'
                                  : 'Rustige pendel — fris op werk aankomen.'
  };
}

function genericPendelIntervals(type, mins, settings, mesoWeek, macroFase, doel) {
  var ftp = settings.ftp, lthr = settings.lthr;
  mins = mins || 150;
  var heen = Math.floor(mins / 2), terug = mins - heen;
  var f = mesoFactor(mesoWeek);

  var blok = ['—', '—', '—', '—', '—'];
  var isTrip = (type === 'pendel_trip_intervals');
  if (isTrip) {
    // Tocht/trip-pendel: sweet-spot/tempo (duurspecifiek), niet doel-FTP-intervallen.
    blok = ['Terug-sweetspot', '2x15min',
            wattsRange(ftp, Math.round(86 * f), Math.round(92 * f)),
            bpmRange(lthr, 90, 96),
            'Sweet spot / tempo — tocht-specifieke duurkracht'];
  } else if (doel === 'FTP') {
    blok = ['Terug-intervallen', '3-4x 8min',
            wattsRange(ftp, Math.round(88 * f), Math.round(94 * f)),
            bpmRange(lthr, 95, 102),
            'Sweet Spot blokken met 4 min rust ertussen'];
  } else if (doel === 'VO2max') {
    blok = ['Terug-intervallen', '4-5x 3min',
            wattsRange(ftp, Math.round(108 * f), Math.round(115 * f)),
            bpmRange(lthr, 100, 108),
            'VO2 reps, 3 min rust — sluit aan op verkeerslichten'];
  } else if (doel === 'Conditie') {
    blok = ['Terug-tempo', '2-3x 12min',
            wattsRange(ftp, Math.round(76 * f), Math.round(85 * f)),
            bpmRange(lthr, 88, 94),
            'Tempo blokken, 5 min rust ertussen'];
  } else if (doel === 'Beklimmingen') {
    blok = ['Terug-low-cad', '3-4x 8min @ 60-70rpm',
            wattsRange(ftp, Math.round(85 * f), Math.round(92 * f)),
            bpmRange(lthr, 92, 100),
            'Lage cadans op een vals plat — kracht-uithouding'];
  }

  // (B) Zone-gewogen tss: harde werkminuten (≈ vast, los van mins) → IF daalt bij langere pendel.
  var werkMin = isTrip ? 30 : (doel === 'FTP' ? 28 : doel === 'VO2max' ? 14 : doel === 'Conditie' ? 30 : doel === 'Beklimmingen' ? 28 : 24);
  var werkAnaeroob = (!isTrip && doel === 'VO2max');
  var pendelBuckets = {
    low: Math.max(0, mins - werkMin),
    high: werkAnaeroob ? 0 : werkMin,
    anaerobic: werkAnaeroob ? werkMin : 0
  };

  return {
    naam: isTrip ? ('Pendel + sweet spot (tocht, ' + mins + ' min)')
                 : ('Pendel + ' + doel + ' intervallen (' + mins + ' min)'),
    focus: 'pendel + doel-specifiek',
    zones: workoutZones(type, doel),
    totaalMin: mins,
    structuur: [
      ['Heen Z2', heen + ' min', wattsRange(ftp, 60, 72), bpmRange(lthr, 78, 86), 'Aanrijden naar werk, rustig'],
      blok,
      ['Cooldown', '5 min', wattsRange(ftp, 45, 55), '—', 'Uitrijden']
    ],
    tss: tssFromZoneMinutes_(pendelBuckets),
    eindopmerking: 'Pendel-dag — heen rustig, terug doel-specifieke intensiteit.'
  };
}

function genericCombo(type, mins, settings, mesoWeek, doel) {
  var ftp = settings.ftp, lthr = settings.lthr;
  var f = mesoFactor(mesoWeek);

  if (type === 'combo_long_with_efforts') {
    // Beschikbaarheid leidend (zelfde patroon als genericLongZ2).
    var requested = Math.max(60, mins || 120);
    var fixed = 75; // 15 warmup + 45 efforts (3×(10+5)) + 15 uitrijden
    var minBase = 30;
    var fits = requested >= fixed + minBase;
    var baseMin = fits ? (requested - fixed) : minBase;
    var totaalMin = fixed + baseMin;
    var tooLong = fits ? null : { available: requested, needed: fixed + minBase };

    return {
      naam: 'Lange rit + ' + doel + ' efforts (' + totaalMin + ' min)',
      focus: 'volume + key zone',
      zones: ['low', 'high'],
      totaalMin: totaalMin,
      structuur: [
        ['Warmup',    '15 min',         wattsRange(ftp, 55, 70), bpmBelow(lthr, 85), 'Inrijden Z2'],
        ['Z2 base',   baseMin + ' min', wattsRange(ftp, 65, 75), bpmRange(lthr, 80, 89), 'Stabiele Z2'],
        ['Efforts',   '3x 10min',       wattsRange(ftp, Math.round(85 * f), Math.round(92 * f)), bpmRange(lthr, 92, 99), 'Tempo/SS blokken, 5 min rust'],
        ['Uitrijden', '15 min',         wattsRange(ftp, 55, 65), '—', 'Z2 uit']
      ],
      // Intent: efforts work (30) is vast high, low = warmup + base + intra-rest + uitrijden
      intent: { low: 15 + baseMin + 10 + 15, high: 30, anaerobic: 0 },
      tss: Math.round(totaalMin * 0.85),
      eindopmerking: 'Lange rit met geïntegreerde efforts — dekt low + high in één sessie.',
      tooLong: tooLong
    };
  }

  if (type === 'combo_z2_tempo') {
    mins = mins || 90;
    return {
      naam: 'Z2 + Tempo combo (' + mins + ' min)',
      focus: 'aerobic + tempo',
      zones: ['low', 'high'],
      totaalMin: mins,
      structuur: [
        ['Warmup', '10 min', wattsRange(ftp, 55, 70), bpmBelow(lthr, 85), 'Inrijden'],
        ['Z2',     '30 min', wattsRange(ftp, 65, 75), bpmRange(lthr, 80, 89), 'Stabiel'],
        ['Tempo',  '3x 10min', wattsRange(ftp, Math.round(76 * f), Math.round(85 * f)), bpmRange(lthr, 88, 94), '3 min rust'],
        ['Uitrijden', '10 min', wattsRange(ftp, 50, 60), '—', 'Cooldown']
      ],
      tss: Math.round(mins * 0.85),
      eindopmerking: 'Klassieke Conditie-build: Z2 base met tempo blokken.'
    };
  }

  if (type === 'combo_z2_vo2') {
    mins = mins || 75;
    return {
      naam: 'Z2 + VO2 combo (' + mins + ' min)',
      focus: 'aerobic + VO2',
      zones: ['low', 'anaerobic'],
      totaalMin: mins,
      structuur: [
        ['Warmup', '15 min', wattsRange(ftp, 55, 70), bpmBelow(lthr, 85), 'Inrijden + 2x 1min openers'],
        ['Z2',     '20 min', wattsRange(ftp, 65, 75), bpmRange(lthr, 80, 89), 'Stabiel'],
        ['VO2',    '4x 3min', wattsRange(ftp, Math.round(108 * f), Math.round(115 * f)), bpmRange(lthr, 100, 108), '3 min rust'],
        ['Uitrijden', '10 min', wattsRange(ftp, 50, 60), '—', 'Cooldown']
      ],
      tss: Math.round(mins * 0.9),
      eindopmerking: 'Aerobic base + VO2 prikkel in één sessie.'
    };
  }

  if (type === 'combo_ss_sprints') {
    mins = mins || 75;
    return {
      naam: 'Sweet Spot + Sprints combo (' + mins + ' min)',
      focus: 'high + anaerobic',
      zones: ['high', 'anaerobic'],
      totaalMin: mins,
      structuur: [
        ['Warmup', '15 min', wattsRange(ftp, 55, 70), bpmBelow(lthr, 85), 'Inrijden'],
        ['Sweet Spot', '2x 15min', wattsRange(ftp, Math.round(88 * f), Math.round(93 * f)), bpmRange(lthr, 92, 98), '5 min rust'],
        ['Sprints', '6x 15s all-out', '>' + watts(ftp, 200) + 'W', '—', '4 min rust — full recovery'],
        ['Uitrijden', '10 min', wattsRange(ftp, 50, 60), '—', 'Cooldown']
      ],
      tss: Math.round(mins * 0.9),
      eindopmerking: 'Aerobic capacity + neuromuscular punch.'
    };
  }

  if (type === 'combo_all_three') {
    mins = mins || 90;
    return {
      naam: 'Alles in één (' + mins + ' min)',
      focus: 'low + high + anaerobic',
      zones: ['low', 'high', 'anaerobic'],
      totaalMin: mins,
      structuur: [
        ['Warmup', '15 min', wattsRange(ftp, 55, 70), bpmBelow(lthr, 85), 'Inrijden + openers'],
        ['Z2',     '20 min', wattsRange(ftp, 65, 75), bpmRange(lthr, 80, 89), 'Aerobic base'],
        ['Sweet Spot', '2x 10min', wattsRange(ftp, Math.round(88 * f), Math.round(92 * f)), bpmRange(lthr, 92, 98), '3 min rust'],
        ['VO2',    '4x 2min', wattsRange(ftp, Math.round(110 * f), Math.round(115 * f)), bpmRange(lthr, 100, 108), '2 min rust'],
        ['Uitrijden', '10 min', wattsRange(ftp, 50, 60), '—', 'Cooldown']
      ],
      tss: Math.round(mins * 0.95),
      eindopmerking: 'Polariserende stack — niet vaker dan 1x per week.'
    };
  }

  return genericLongZ2(mins, settings, mesoWeek);
}
