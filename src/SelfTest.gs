/**
 * SelfTest.gs — COMMITTED pure-engine test-gate (géén wegwerp-_Diag).
 *
 * Draait alleen PURE seams met fixture-inputs + constanten-reads. GEEN
 * side-effects: geen Sheet-writes, geen DocProp-writes, geen intervals-POST.
 *
 * Bewust UITGESLOTEN (gekoppeld):
 *   - bepaalFaseVoorDatum_ — leest Events-tab + Settings → Taper/Recovery-edges
 *     niet puur testbaar; alleen de pure computeMacroPhase (Base/Build/Peak/Test).
 *   - getReadinessScore_ leest intern getTodayCheckin_ (DocProp-READ). De
 *     factor-subs/dots komen puur uit de fixtures, dus die assert ik direct;
 *     de absolute band test ik via band↔score-consistentie (check-in-robuust),
 *     niet via vaste band-fixtures. Geen writes — alleen een read.
 *
 * Run: Apps Script editor → runSelfTest → View → Logs. clasp run is NIET
 * ingericht (geen executionApi in appsscript.json); de return dient een
 * latere run-integratie.
 */

function runSelfTest() {
  var ctx = { passed: 0, failed: 0, failures: [] };
  testTss_(ctx);
  testCheckinDelta_(ctx);
  testClamp_(ctx);
  testNiveau_(ctx);
  testMacroPhase_(ctx);
  testEventFase_(ctx);
  testReadiness_(ctx);
  testConstants_(ctx);
  testTier_(ctx);
  testWeekLoad_(ctx);
  testTrainingLibrary_(ctx);
  testDayOverride_(ctx);
  testCoach_(ctx);
  testReadinessAdjust_(ctx);
  testPowerCurve_(ctx);
  testGoalProjection_(ctx);
  testActiveGoalProfile_(ctx);
  testCtlAtWeek_(ctx);
  testDoelTestWeken_(ctx);
  testArchetype_(ctx);
  testArchetypeLib_(ctx);
  testGoalWorkout_(ctx);
  testGoalWorkoutRotatie_(ctx);
  testInplug_(ctx);
  testKeyIntensityInplug_(ctx);
  testGoalInplugWeekSim_(ctx);
  testAllocateQualityWeek_(ctx);
  testGatherWeekplanEntries_(ctx);
  testVolumeModulatie_(ctx);
  testCovGateBase_(ctx);
  testProfielenVo2maxConditie_(ctx);
  testSnapshotDayAction_(ctx);
  testCoachAdaptatie_(ctx);
  testRideDetail_(ctx);
  testZoneTimesFromCell_(ctx);
  testZoneDebtSheet_(ctx);
  testDashActuals_(ctx);
  testDashStats_(ctx);
  testDashBeginAnker_(ctx);
  testDashNiveauReeks_(ctx);
  testActivityToRow_(ctx);
  testMergeById_(ctx);

  Logger.log('SELFTEST: ' + ctx.passed + ' passed, ' + ctx.failed + ' failed');
  ctx.failures.forEach(function (f) {
    Logger.log('  FAIL [' + f.case + '] expected=' + JSON.stringify(f.expected) +
               ' actual=' + JSON.stringify(f.actual));
  });
  return { passed: ctx.passed, failed: ctx.failed, failures: ctx.failures };
}

/** Strikte gelijkheid (string/number/bool/null). */
function assert_(ctx, name, expected, actual) {
  if (expected === actual) { ctx.passed++; return true; }
  ctx.failed++;
  ctx.failures.push({ case: name, expected: expected, actual: actual });
  return false;
}

/** Numerieke gelijkheid met tolerantie (floats). */
function assertClose_(ctx, name, expected, actual, eps) {
  eps = eps || 0.01;
  if (typeof actual === 'number' && Math.abs(expected - actual) <= eps) { ctx.passed++; return true; }
  ctx.failed++;
  ctx.failures.push({ case: name, expected: expected, actual: actual });
  return false;
}

// ── tssFromZoneMinutes_ (puur) ──────────────────────────────────────
function testTss_(ctx) {
  assert_(ctx, 'tss low-only', 42, tssFromZoneMinutes_({ low: 60, high: 0, anaerobic: 0 }));
  assert_(ctx, 'tss high-only', 57, tssFromZoneMinutes_({ low: 0, high: 60, anaerobic: 0 }));
  assert_(ctx, 'tss anaerobic-only', 63, tssFromZoneMinutes_({ low: 0, high: 0, anaerobic: 60 }));
  assert_(ctx, 'tss mixed', 47, tssFromZoneMinutes_({ low: 40, high: 20, anaerobic: 0 }));
  assert_(ctx, 'tss empty', 0, tssFromZoneMinutes_({}));
  assert_(ctx, 'tss monotone-low', true,
    tssFromZoneMinutes_({ low: 120 }) > tssFromZoneMinutes_({ low: 60 }));
}

// ── checkinDelta_ (puur, leest CHECKIN_LEVELS) ──────────────────────
function testCheckinDelta_(ctx) {
  assert_(ctx, 'checkin all-worst', -6, checkinDelta_({ slaap: 'slecht', benen: 'zwaar', stress: 'hoog' }));
  assert_(ctx, 'checkin all-best', 6, checkinDelta_({ slaap: 'goed', benen: 'fris', stress: 'laag' }));
  assert_(ctx, 'checkin neutral', 0, checkinDelta_({ slaap: 'matig', benen: 'normaal', stress: 'normaal' }));
  assert_(ctx, 'checkin null', 0, checkinDelta_(null));
  assert_(ctx, 'checkin unknown-level', 0, checkinDelta_({ slaap: 'xyz', benen: 'normaal', stress: 'normaal' }));
}

// ── rdyClamp_ (puur) — dekt "clamp base+delta binnen 0–100" ─────────
function testClamp_(ctx) {
  assert_(ctx, 'clamp over', 100, rdyClamp_(105));
  assert_(ctx, 'clamp under', 0, rdyClamp_(-5));
  assert_(ctx, 'clamp mid', 50, rdyClamp_(50));
}

// ── computeNiveau_ (puur) ───────────────────────────────────────────
function testNiveau_(ctx) {
  assertClose_(ctx, 'niveau wkg1 → 0', 0, computeNiveau_(70, 70).niveau);
  assertClose_(ctx, 'niveau wkg6.9 → 50', 50, computeNiveau_(690, 100).niveau);
  assertClose_(ctx, 'niveau mid → 25', 25, computeNiveau_(395, 100).niveau);
  assertClose_(ctx, 'niveau clamp-high → 50', 50, computeNiveau_(1000, 100).niveau);
  assertClose_(ctx, 'niveau clamp-low → 0', 0, computeNiveau_(35, 70).niveau);
  assert_(ctx, 'niveau null-ftp', null, computeNiveau_(null, 70).niveau);
  assert_(ctx, 'niveau null-gewicht', null, computeNiveau_(295, null).niveau);
  // Niveau-tab progressie (Fase 7) — ctlReeksMaandelijks_ (daily PMC) + niveauProgressie_.
  function actRow_(d, tss) { var r = []; r[0] = d; r[8] = tss; return r; }
  assert_(ctx, 'ctl leeg → {}', 0, Object.keys(ctlReeksMaandelijks_([])).length);
  var c1 = ctlReeksMaandelijks_([actRow_(new Date(2026, 0, 15), 100)]);
  assertClose_(ctx, 'ctl 1-rit', 2.4, c1['2026-01'], 0.05);
  var c2 = ctlReeksMaandelijks_([actRow_(new Date(2026, 0, 31), 42), actRow_(new Date(2026, 1, 1), 42)]);
  assertClose_(ctx, 'ctl maand jan', 1.0, c2['2026-01'], 0.05);
  assertClose_(ctx, 'ctl maand feb (build + maand-eind wint)', 2.0, c2['2026-02'], 0.05);
  var np = niveauProgressie_([{ maand: '2026-01', niveau: 25, ftp: 275, gewicht: 72 }], { '2026-01': 40 });
  assert_(ctx, 'prog lengte', 1, np.length);
  assertClose_(ctx, 'prog wkg', 3.82, np[0].wkg, 0.001);
  assert_(ctx, 'prog ctl', 40, np[0].ctl);
  assert_(ctx, 'prog lege reeks → []', 0, niveauProgressie_([], {}).length);
  assert_(ctx, 'prog wkg null bij geen gewicht', null, niveauProgressie_([{ maand: 'x', niveau: 10, ftp: 275, gewicht: null }], {})[0].wkg);
}

// ── computeMacroPhase (puur) — week-offsets + isTestWeek ────────────
function testMacroPhase_(ctx) {
  var t0 = new Date(2026, 0, 5);   // ma 5 jan 2026 (alle test-dagen < DST-grens 29 mrt)
  var m1 = computeMacroPhase(t0, new Date(2026, 0, 5));      // week 1
  assert_(ctx, 'macro w1 fase', 'Base', m1.fase);
  assert_(ctx, 'macro w1 week', 1, m1.week);
  assert_(ctx, 'macro w1 isTest', false, m1.isTestWeek);
  assert_(ctx, 'macro w5 build', 'Build', computeMacroPhase(t0, new Date(2026, 1, 2)).fase);   // +28d
  assert_(ctx, 'macro w9 peak', 'Peak', computeMacroPhase(t0, new Date(2026, 2, 2)).fase);     // +56d
  var m12 = computeMacroPhase(t0, new Date(2026, 2, 23));    // +77d
  assert_(ctx, 'macro w12 test', 'Test', m12.fase);
  assert_(ctx, 'macro w12 isTest', true, m12.isTestWeek);
  assert_(ctx, 'macro w12 week-clamp', 12, m12.week);
}

// ── eventFase_ (puur) — referentie-datum vanaf vandaag + A-taper ≤7d ──
function testEventFase_(ctx) {
  function ev(jaar, maand0, dag, prio, type) {
    return { datum: new Date(jaar, maand0, dag), prioriteit: prio, type: type, naam: 'X' };
  }
  var woe = new Date(2026, 5, 10);   // wo 10 jun 2026 (week-maandag = ma 8 jun)

  // A-event op exact A_TAPER_DAGEN (7) dagen → Taper (venster 7); vanaf vandaag.
  var t7 = eventFase_([ev(2026, 5, 17, 'A', 'race')], woe);
  assert_(ctx, 'eventFase A@7d fase', 'Taper', t7.fase);
  assert_(ctx, 'eventFase A@7d dagen', 7, t7.dagenTot);
  assert_(ctx, 'eventFase A@7d venster', 7, t7.taperVenster);

  // A-event op 8 dagen → net buiten taper → Peak (wekenTot = 2), geen taper.
  var t8 = eventFase_([ev(2026, 5, 18, 'A', 'race')], woe);
  assert_(ctx, 'eventFase A@8d fase', 'Peak', t8.fase);
  assert_(ctx, 'eventFase A@8d venster', 0, t8.taperVenster);

  // Ver A-event (≥ 9 wkn) → Base.
  assert_(ctx, 'eventFase verA fase', 'Base', eventFase_([ev(2026, 7, 15, 'A', 'race')], woe).fase);

  // A-race eerder deze week (ma 8 jun, ref = do 11 jun) → Recovery.
  var rec = eventFase_([ev(2026, 5, 8, 'A', 'race')], new Date(2026, 5, 11));
  assert_(ctx, 'eventFase recovery fase', 'Recovery', rec.fase);

  // Geen hoofd-event → null (val terug op vaste meso in bepaalFaseVoorDatum_).
  assert_(ctx, 'eventFase geen event', null, eventFase_([], woe));

  // ── Deel 2: B-mini-taper. A staat ruim weg (macro = Base); B/C dichtbij. ──
  var Aver = ev(2026, 7, 15, 'A', 'race');   // ~9+ wkn → macro Base

  // B op 3 dagen → Taper (venster 3); B drijft de taper, macro blijft Base.
  var b3 = eventFase_([Aver, ev(2026, 5, 13, 'B', 'race')], woe);
  assert_(ctx, 'eventFase B@3d fase', 'Taper', b3.fase);
  assert_(ctx, 'eventFase B@3d venster', 3, b3.taperVenster);
  assert_(ctx, 'eventFase B@3d macro', 'Base', b3.macroFase);

  // B op 4 dagen → buiten B-venster → geen taper → macro Base.
  assert_(ctx, 'eventFase B@4d fase', 'Base', eventFase_([Aver, ev(2026, 5, 14, 'B', 'race')], woe).fase);

  // C op 1 dag → C telt nooit → geen taper → macro Base.
  assert_(ctx, 'eventFase C@1d fase', 'Base', eventFase_([Aver, ev(2026, 5, 11, 'C', 'race')], woe).fase);
}

// ── getReadinessScore_ (factor-subs/dots puur; band via consistentie) ──
function testReadiness_(ctx) {
  function findF(res, key) {
    var hit = null;
    (res.factors || []).forEach(function (f) { if (f.key === key) hit = f; });
    return hit;
  }
  function bandRule(score) { return score >= 62 ? 'ready' : (score >= 48 ? 'caution' : 'rest'); }
  var well = { hrvDeficit: 0, hrvRecent: 50, sleepAvg3: 7, sleepLastNight: 7 };

  // Factor-dot op de LIVE constante (≥67 good / 34–66 warn / <34 muted).
  // reeks=[] → geen richting-nudge, dus vtSub = rdyLerp_(form,-30,10) exact.
  var good  = getReadinessScore_({ form: 2,   ctl: 50, atl: 45, ramp: 3 }, well, []);  // vtSub 80
  var warn  = getReadinessScore_({ form: -10, ctl: 50, atl: 45, ramp: 3 }, well, []);  // vtSub 50
  var muted = getReadinessScore_({ form: -25, ctl: 50, atl: 45, ramp: 3 }, well, []);  // vtSub 12.5
  assert_(ctx, 'rdy dot good',  'good',  (findF(good,  'vormTrend') || {}).dot);
  assert_(ctx, 'rdy dot warn',  'warn',  (findF(warn,  'vormTrend') || {}).dot);
  assert_(ctx, 'rdy dot muted', 'muted', (findF(muted, 'vormTrend') || {}).dot);

  // Missing-factor → rescale over de rest, geen harde nul.
  var miss = getReadinessScore_({ form: 2, ctl: 50, atl: 45, ramp: 3 },
    { hrvDeficit: null, hrvRecent: null, sleepAvg3: 7 }, []);
  var hrvF = findF(miss, 'hrv');
  assert_(ctx, 'rdy missing hrv sub', null, hrvF ? hrvF.sub : 'NO-FACTOR');
  assert_(ctx, 'rdy missing hrv dot', 'muted', hrvF ? hrvF.dot : 'NO-FACTOR');
  assert_(ctx, 'rdy missing score not-null', true, typeof miss.score === 'number');

  // Band ↔ score-consistentie (check-in-robuust; valideert de 62/48-drempels).
  [good, warn, muted, miss].forEach(function (r, i) {
    assert_(ctx, 'rdy band-consistent #' + i, bandRule(r.score), r.band);
  });
}

// ── Constanten ──────────────────────────────────────────────────────
function testConstants_(ctx) {
  var p = READINESS_PRESETS.objectief;
  assertClose_(ctx, 'preset vormTrend', 0.30, p.vormTrend, 0.0001);
  assertClose_(ctx, 'preset belasting', 0.30, p.belasting, 0.0001);
  assertClose_(ctx, 'preset hrv', 0.25, p.hrv, 0.0001);
  assertClose_(ctx, 'preset slaap', 0.15, p.slaap, 0.0001);
  assertClose_(ctx, 'preset sum = 1.00', 1.0, p.vormTrend + p.belasting + p.hrv + p.slaap, 0.0001);
  assert_(ctx, 'checkin slaap slecht', -2, CHECKIN_LEVELS.slaap.slecht);
  assert_(ctx, 'checkin slaap goed', 2, CHECKIN_LEVELS.slaap.goed);
  assert_(ctx, 'checkin stress laag', 2, CHECKIN_LEVELS.stress.laag);
}

// ── niveauTier_ (puur) — Fase 3 deel 4 band-grenzen ─────────────────
function testTier_(ctx) {
  assert_(ctx, 'tier 14 Beginner', 'Beginner', niveauTier_(14));
  assert_(ctx, 'tier 15 Gemiddeld', 'Gemiddeld', niveauTier_(15));
  assert_(ctx, 'tier 24 Gemiddeld', 'Gemiddeld', niveauTier_(24));
  assert_(ctx, 'tier 25 Gevorderd', 'Gevorderd', niveauTier_(25));
  assert_(ctx, 'tier 34 Gevorderd', 'Gevorderd', niveauTier_(34));
  assert_(ctx, 'tier 35 Vergevorderd', 'Vergevorderd', niveauTier_(35));
  assert_(ctx, 'tier 44 Vergevorderd', 'Vergevorderd', niveauTier_(44));
  assert_(ctx, 'tier 45 Elite', 'Elite', niveauTier_(45));
}

// ── WeekLoad sliver (puur): hhmmFromMin_ + weekPlanSummary_ ──────────
function testWeekLoad_(ctx) {
  assert_(ctx, 'hhmm 190', '3:10', hhmmFromMin_(190));
  assert_(ctx, 'hhmm 0', '0:00', hhmmFromMin_(0));
  assert_(ctx, 'hhmm 300', '5:00', hhmmFromMin_(300));
  assert_(ctx, 'hhmm 65', '1:05', hhmmFromMin_(65));
  var s = weekPlanSummary_([{ tss: 80, minuten: 90 }, { tss: 140, minuten: 100 }, { tss: 0, minuten: 0 }]);
  assert_(ctx, 'plan tss', 220, s.tss);
  assert_(ctx, 'plan min', 190, s.min);
  assert_(ctx, 'plan dagen excl-0', 2, s.dagen);
  assert_(ctx, 'plan multi-session=1dag', 1, weekPlanSummary_([{ tss: 120, minuten: 160 }]).dagen);
  assert_(ctx, 'plan empty tss', 0, weekPlanSummary_([]).tss);
  assert_(ctx, 'plan empty dagen', 0, weekPlanSummary_([]).dagen);
}

// ── getTrainingLibrary_ (puur) — integriteit van de Trainingen-bibliotheek ──
function testTrainingLibrary_(ctx) {
  var settings = { ftp: 250, lthr: 160, doel: 'FTP', doelStart: new Date(2026, 0, 5) };
  var lib = getTrainingLibrary_(settings);
  assert_(ctx, 'lib 6 categorieën', 6, lib.length);
  var pctOk = true;   // elke library-segment draagt numerieke pctLo/pctHi (pctLo<=pctHi) — voedt de client-wattlijst
  lib.forEach(function (cat) {
    assert_(ctx, 'lib cat niet-leeg: ' + cat.key, true, cat.variants.length > 0);
    cat.variants.forEach(function (v) {
      assert_(ctx, 'lib type match: ' + cat.key + '/' + v.variantId, cat.type, v.type);
      assert_(ctx, 'lib tss>0: ' + cat.key + '/' + v.variantId, true, v.tss > 0);
      assert_(ctx, 'lib segs>0: ' + cat.key + '/' + v.variantId, true, (v.segmenten || []).length > 0);
      (v.segmenten || []).forEach(function (s) {
        if (!(typeof s.pctLo === 'number' && typeof s.pctHi === 'number' && s.pctLo <= s.pctHi)) pctOk = false;
      });
    });
  });
  assert_(ctx, 'lib segs pctLo/pctHi numeriek', true, pctOk);
}

// ── buildOverrideWorkout_ / buildFreeRideWorkout_ (puur) — day-override ──
function testDayOverride_(ctx) {
  var settings = { ftp: 250, lthr: 160, doel: 'FTP', doelStart: new Date(2026, 0, 5) };
  // Vrije rit (stevig) → geldige werk-zone + TSS>0 + duur behouden.
  var fr = buildOverrideWorkout_({ type: 'free', ritType: 'vrij', intensiteit: 'stevig', durMin: 90 }, settings, 1, 'Build', null, 0);
  assert_(ctx, 'override free tss>0', true, fr.tss > 0);
  assert_(ctx, 'override free duur', 90, fr.totaalMin);
  assert_(ctx, 'override free zones', true, (fr.zones || []).length > 0);
  // Rustige vrije rit → low-bucket → TSS < duur (IF<1).
  var frR = buildFreeRideWorkout_({ type: 'free', ritType: 'groep', intensiteit: 'rustig', durMin: 60 }, settings);
  assert_(ctx, 'override free rustig laag', true, frR.tss > 0 && frR.tss < frR.totaalMin);
  // Bibliotheek-override op een specifieke variant → resolvet + TSS>0.
  var lib = getTrainingLibrary_(settings);
  var vo2 = lib.filter(function (c) { return c.type === 'vo2max'; })[0];
  var wo = buildOverrideWorkout_({ type: 'library', workoutType: 'vo2max', variantId: vo2.variants[0].variantId, durMin: 75 }, settings, 1, 'Peak', null, 0);
  assert_(ctx, 'override lib tss>0', true, wo.tss > 0);
  assert_(ctx, 'override lib resolved', true, !!wo.naam);
}

// ── Coach-engine (puur) — IF-normalisatie + zone-classificatie + doel-bewust ──
// ── STAP 2 — readinessAdjust_ (puur) — band×fase×isHard → keep/demote ──
function testReadinessAdjust_(ctx) {
  function adj(type, isHard, band, macroFase) { return readinessAdjust_({ type: type, isHard: isHard }, band, macroFase); }
  assert_(ctx, 'rdyAdj ready+hard keep', 'keep', adj('vo2max', true, 'ready', 'Build').action);
  var a1 = adj('threshold', true, 'caution', 'Build');
  assert_(ctx, 'rdyAdj caution threshold action', 'demote', a1.action);
  assert_(ctx, 'rdyAdj caution threshold toType', 'tempo', a1.toType);
  assert_(ctx, 'rdyAdj caution threshold intensiteit', 'tempo', a1.intensiteit);
  var a2 = adj('vo2_3015', true, 'caution', 'Build');
  assert_(ctx, 'rdyAdj caution vo2_3015 toType', 'long_z2', a2.toType);
  assert_(ctx, 'rdyAdj caution vo2_3015 intensiteit', 'rustig', a2.intensiteit);
  assert_(ctx, 'rdyAdj caution vo2max toType', 'tempo', adj('vo2max', true, 'caution', 'Build').toType);
  assert_(ctx, 'rdyAdj caution !hard keep', 'keep', adj('long_z2', false, 'caution', 'Build').action);
  var a3 = adj('vo2max', true, 'rest', 'Build');
  assert_(ctx, 'rdyAdj rest action', 'demote', a3.action);
  assert_(ctx, 'rdyAdj rest toType', 'recovery', a3.toType);
  assert_(ctx, 'rdyAdj rest intensiteit', 'rustig', a3.intensiteit);
  assert_(ctx, 'rdyAdj rest reden', 'rest_key', a3.reden);
  assert_(ctx, 'rdyAdj rest !hard keep', 'keep', adj('long_z2', false, 'rest', 'Build').action);
  assert_(ctx, 'rdyAdj caution Taper keep', 'keep', adj('vo2max', true, 'caution', 'Taper').action);
  assert_(ctx, 'rdyAdj rest Recovery keep', 'keep', adj('vo2max', true, 'rest', 'Recovery').action);
  assert_(ctx, 'rdyAdj caution not-in-map keep', 'keep', adj('taper_openers', true, 'caution', 'Build').action);
}

// ── Niveau Fase-2 §c — power-curve normalisatie (puur) ──
function testPowerCurve_(ctx) {
  var S = [5, 60, 300, 1200, 3600], V = [980, 560, 372, 312, 276], WK = [16, 9, 5.5, 4.6, 4.1], A = ['a', 'a', 'a3', 'a', 'a'];
  assert_(ctx, 'pcMarkerAt exact 60', 60, pcMarkerAt_(S, V, WK, A, 60).secs);
  assert_(ctx, 'pcMarkerAt nearest 100→300', 300, pcMarkerAt_(S, V, WK, A, 100).secs);
  assert_(ctx, 'pcMarkerAt none→null', null, pcMarkerAt_(S, V, WK, A, 7200));
  // Daan-fixture (intervals.icu-cijfers 5s/60s/5m/eFTP-W/kg): pint de fix op echte data → All-rounder.
  var rtD = riderTypeFromCurve_(15.56, 5.59, 4.27, 3.67);
  assert_(ctx, 'riderType Daan label', 'All-rounder', rtD.label);
  assert_(ctx, 'riderType Daan pos>=lo', true, rtD.pos >= 0.42);
  assert_(ctx, 'riderType Daan pos<=hi', true, rtD.pos <= 0.58);
  assert_(ctx, 'riderType sprint label', 'Sprinter', riderTypeFromCurve_(20, 10, 3.5, 2.9).label);   // hoog kort, laag lang
  assert_(ctx, 'riderType diesel label', 'Diesel · klimmer', riderTypeFromCurve_(10, 5.6, 7, 6).label); // laag kort, hoog lang
  // Live 1-jaars-cijfers (5s/60s/5m/eFTP-W/kg): pint de classificatie van het ECHTE live-pad, niet alleen 42d.
  var rtL = riderTypeFromCurve_(15.6, 6.5, 4.6, 3.71);
  assert_(ctx, 'riderType live All-rounder+band', true, rtL.label === 'All-rounder' && rtL.pos >= 0.42 && rtL.pos <= 0.58);
  var c = { label: '1y', days: 365, weight: 72,
    secs: [5, 60, 120, 300, 1200, 3600, 7200], values: [980, 560, 0, 372, 312, 276, 250],
    watts_per_kg: [16, 9, 0, 5.5, 4.6, 4.1, 3.7], activity_id: ['a', 'a', 'a', 'a3', 'a', 'a', 'a'] };
  var n = pcNormalize_(c, { a3: { start_date_local: '2026-03-10' } });
  assert_(ctx, 'pcNorm curve cap+skip', 5, n.curve.length);          // 7200 capped, 120/0-watt skipped
  assert_(ctx, 'pcNorm markers', 5, n.markers.length);
  var m5m = null; n.markers.forEach(function (m) { if (m.label === '5m') m5m = m; });
  assert_(ctx, 'pcNorm 5m date', '2026-03-10', m5m.date);
  assert_(ctx, 'pcNorm empty', true, pcNormalize_({ secs: [], values: [] }).empty);
}

// ── Niveau Fase-2 §d — doel-gereedheid + projectie (puur) ──
function testGoalProjection_(ctx) {
  // goalGap_ — op-koers (>=target) · nog-te-gaan + gap-waarde · grens (==target).
  assert_(ctx, 'goalGap op-koers', true, goalGap_(4.1, 4.0, 'up').onTrack);
  assert_(ctx, 'goalGap te-gaan onTrack', false, goalGap_(58, 65, 'up').onTrack);
  assert_(ctx, 'goalGap te-gaan gap', 7, goalGap_(58, 65, 'up').gap);
  assert_(ctx, 'goalGap grens onTrack', true, goalGap_(65, 65, 'up').onTrack);
  // ctlPlateauFromVolume_ = uren*tss/7 + 0-guard.
  assert_(ctx, 'ctlPlateau 8x56', 64, ctlPlateauFromVolume_(8, 56));
  assert_(ctx, 'ctlPlateau 0-guard', 0, ctlPlateauFromVolume_(0, 56));
  // ctlApproachWeeks_ — bereikbaar (>0) · onbereikbaar (plateau<=doel→null) · al-bereikt (cur>=doel→0).
  assert_(ctx, 'ctlWeeks bereikbaar>0', true, ctlApproachWeeks_(45, 80, 65) > 0);
  assert_(ctx, 'ctlWeeks onbereikbaar', null, ctlApproachWeeks_(45, 60, 65));
  assert_(ctx, 'ctlWeeks al-bereikt', 0, ctlApproachWeeks_(70, 80, 65));
  // ftpBandFromProjection_ — low<high · aannames aanwezig · band breder bij grotere ΔCTL.
  var b1 = ftpBandFromProjection_(275, 50, 60), b2 = ftpBandFromProjection_(275, 50, 90);
  assert_(ctx, 'ftpBand low<high', true, b1.lowW < b1.highW);
  assert_(ctx, 'ftpBand aannames', true, b1.aannames.length > 0);
  assert_(ctx, 'ftpBand breder ΔCTL', true, (b2.highW - b2.lowW) > (b1.highW - b1.lowW));
  // recent-window helpers (newest-first; idx0 datum, idx3 duur-min, idx8 TSS). Anker = 2026-06-08.
  var AV = [
    ['2026-06-08', 'Ride', '', 120, 0, 0, 0, 0, 110],   // 2u · 110 TSS (binnen 42d)
    ['2026-06-05', 'Ride', '', 60, 0, 0, 0, 0, 55],     // 1u · 55 TSS  (binnen 42d)
    ['2026-04-01', 'Ride', '', 240, 0, 0, 0, 0, 200]    // 4u · 200 TSS (buiten 42d, binnen 90d)
  ];
  assert_(ctx, 'maxRecentRideH 90d', 4, maxRecentRideH_(AV, 90));
  assert_(ctx, 'maxRecentRideH 42d', 2, maxRecentRideH_(AV, 42));
  assert_(ctx, 'tssPerHourRecent 42d', 55, tssPerHourRecent_(AV, 42));
  assert_(ctx, 'weeklyHoursRecent 42d', 0.5, weeklyHoursRecent_(AV, 42));
}

// ── FTP goal-profile — doel-gedreven activeGoalProfile_ + ftp-profiel-vorm ──
function testActiveGoalProfile_(ctx) {
  // doel → profiel-mapping (object-identiteit; geen side-effects).
  assert_(ctx, 'activeProfile FTP->ftp', GOAL_PROFILES_.ftp, activeGoalProfile_({ doel: 'FTP' }));
  assert_(ctx, 'activeProfile Beklimmingen->girona', GOAL_PROFILES_.girona, activeGoalProfile_({ doel: 'Beklimmingen' }));
  assert_(ctx, 'activeProfile VO2max->girona', GOAL_PROFILES_.girona, activeGoalProfile_({ doel: 'VO2max' }));
  assert_(ctx, 'activeProfile Conditie->girona', GOAL_PROFILES_.girona, activeGoalProfile_({ doel: 'Conditie' }));
  assert_(ctx, 'activeProfile onbekend->girona', GOAL_PROFILES_.girona, activeGoalProfile_({ doel: 'xyz' }));
  assert_(ctx, 'activeProfile missing->girona', GOAL_PROFILES_.girona, activeGoalProfile_({}));
  assert_(ctx, 'activeProfile null-settings->girona', GOAL_PROFILES_.girona, activeGoalProfile_(null));
  // ftp-profiel: key 'ftp' + PRECIES 1 dim (ctl / 65 / up).
  var ftp = GOAL_PROFILES_.ftp;
  assert_(ctx, 'ftp profiel key', 'ftp', ftp.key);
  assert_(ctx, 'ftp profiel 1 dim', 1, ftp.dims.length);
  assert_(ctx, 'ftp dim metric', 'ctl', ftp.dims[0].metric);
  assert_(ctx, 'ftp dim target', 65, ftp.dims[0].target);
  assert_(ctx, 'ftp dim dir', 'up', ftp.dims[0].dir);
  // ctlApproachWeeks_ met de ftp duur-target = eindig getal (bereikbaar pad).
  assert_(ctx, 'ftp target ctlWeeks finite', true, isFinite(ctlApproachWeeks_(45, 80, ftp.dims[0].target)));
  // projectiemodus per profiel.
  assert_(ctx, 'girona projectieMode gap', 'gap', GOAL_PROFILES_.girona.projectieMode);
  assert_(ctx, 'ftp projectieMode test', 'test', GOAL_PROFILES_.ftp.projectieMode);
}

// ── FTP-test-projectie — ctlAtWeek_ (PMC-approach) + doelTestWeken_ (weken tot testdag) ──
function testCtlAtWeek_(ctx) {
  assert_(ctx, 'ctlAtWeek wk0=current', 50, ctlAtWeek_(50, 80, 0));
  assert_(ctx, 'ctlAtWeek groot->plateau', 80, ctlAtWeek_(50, 80, 200));
  var a = ctlAtWeek_(50, 80, 6), b = ctlAtWeek_(50, 80, 12);
  assert_(ctx, 'ctlAtWeek monotoon stijgend', true, a > 50 && b > a && b < 80);
  var dn = ctlAtWeek_(70, 50, 6);
  assert_(ctx, 'ctlAtWeek dalend (cur>plateau)', true, dn < 70 && dn > 50);
  assert_(ctx, 'ctlAtWeek null-guard', null, ctlAtWeek_(null, 80, 6));
  assert_(ctx, 'ctlAtWeek neg-weken null', null, ctlAtWeek_(50, 80, -1));
}
function testDoelTestWeken_(ctx) {
  // 2026-06-02 + 12*7 = 2026-08-25; vanaf 2026-06-11 = 75 dgn → ceil(75/7) = 11.
  assert_(ctx, 'doelTestWeken normaal', 11, doelTestWeken_('2026-06-02', 12, '2026-06-11'));
  // testdag al voorbij → clamp 0.
  assert_(ctx, 'doelTestWeken voorbij->0', 0, doelTestWeken_('2026-06-02', 1, '2026-08-01'));
  // exact veelvoud (7 dgn) → 1 week.
  assert_(ctx, 'doelTestWeken ceil exact', 1, doelTestWeken_('2026-06-02', 1, '2026-06-02'));
  assert_(ctx, 'doelTestWeken missing->null', null, doelTestWeken_(null, 12, '2026-06-11'));
  assert_(ctx, 'doelTestWeken bad-dur->null', null, doelTestWeken_('2026-06-02', 0, '2026-06-11'));
}

// ── Fase 1 deel 1 — archetype-expander (puur) ──
function testArchetype_(ctx) {
  var fx = archetypeFixtures_();
  var REQ = ['naam', 'focus', 'zones', 'totaalMin', 'structuur', 'intent', 'tss', 'eindopmerking', 'blokken'];
  var doelMap = { fx_steady_duur: 90, fx_drempel_int: 80, fx_microburst_vo2: 40 };
  fx.forEach(function (rec) {
    var dm = doelMap[rec.id];
    var wo = expandArchetype_(rec, { ftp: 275, doelMin: dm, mesoFactor: 1.0, faseOffset: 0 });
    // (1) verplichte output-velden aanwezig
    var veldenOk = true;
    REQ.forEach(function (k) { if (wo[k] == null) veldenOk = false; });
    assert_(ctx, 'arch ' + rec.id + ' velden', true, veldenOk);
    // (2) per blok: 0<pctLo≤pctHi≤150, minuten>0, zone consistent met pctZoneBucket_
    var sum = 0, blokOk = true, zoneOk = true;
    wo.blokken.forEach(function (b) {
      sum += b.minuten;
      if (!(b.pctLo > 0 && b.pctLo <= b.pctHi && b.pctHi <= 150 && b.minuten > 0)) blokOk = false;
      if (b.zone !== pctZoneBucket_(Math.round((b.pctLo + b.pctHi) / 2))) zoneOk = false;
    });
    assert_(ctx, 'arch ' + rec.id + ' blok-bounds', true, blokOk);
    assert_(ctx, 'arch ' + rec.id + ' blok-zone', true, zoneOk);
    // (3) Σblok==totaalMin én ≈doelMin (binnen fill-stap)
    assertClose_(ctx, 'arch ' + rec.id + ' som==totaal', wo.totaalMin, sum, 0.01);
    assertClose_(ctx, 'arch ' + rec.id + ' ~doelMin', dm, wo.totaalMin, 1.5);
    // (4)+(5) elke structuur-rij push-parsebaar + row[2] reproduceert watts(pctLo)-watts(pctHi)
    var pushOk = true, wattOk = true;
    wo.structuur.forEach(function (row) {
      if (dslBlockFromRow_(row, 275) == null) pushOk = false;
      var r = dslPowerRange_(row[2], 275);
      if (!r || row[2] !== (watts(275, r.lo) + '-' + watts(275, r.hi) + 'W')) wattOk = false;
    });
    assert_(ctx, 'arch ' + rec.id + ' push-parse', true, pushOk);
    assert_(ctx, 'arch ' + rec.id + ' watt-roundtrip', true, wattOk);
    // (6) tss == tssFromZoneMinutes_(intent)
    assert_(ctx, 'arch ' + rec.id + ' tss', tssFromZoneMinutes_(wo.intent), wo.tss);
  });
  // (7) richting: mesoFactor 1.1 > 1.0 → hogere werk-pct (drempel-fixture)
  function workPct(wo) { var m = 0; wo.blokken.forEach(function (b) { if (b.pctLo > m) m = b.pctLo; }); return m; }
  var b10 = expandArchetype_(fx[1], { ftp: 275, doelMin: 80, mesoFactor: 1.0, faseOffset: 0 });
  var b11 = expandArchetype_(fx[1], { ftp: 275, doelMin: 80, mesoFactor: 1.1, faseOffset: 0 });
  assert_(ctx, 'arch meso-richting', true, workPct(b11) > workPct(b10));
  // onPct-fallback (geen werk-range op de fixture): leidt nog pctLo/pctHi af (collapsed onLo==onHi).
  var foBlk = b10.blokken.filter(function (b) { return b.pctLo === 98 && b.pctHi === 98; });
  assert_(ctx, 'arch onPct-fallback', true, foBlk.length > 0);
}

// ── Fase 1 deel 2a — productie-archetype-register (data + push-pariteit) ──
function testArchetypeLib_(ctx) {
  var REQ = ['naam', 'focus', 'zones', 'totaalMin', 'structuur', 'intent', 'tss', 'eindopmerking', 'blokken'];
  ARCHETYPES.forEach(function (rec) {
    var dm = rec.duurRange[0] + 10;   // binnen [min, max]
    var wo = expandArchetype_(rec, { ftp: 275, lthr: 178, doelMin: dm, mesoFactor: 1.0, faseOffset: 0 });
    var veldenOk = true;
    REQ.forEach(function (k) { if (wo[k] == null) veldenOk = false; });
    assert_(ctx, 'lib ' + rec.id + ' velden', true, veldenOk);
    var sum = 0, blokOk = true, zoneOk = true;
    wo.blokken.forEach(function (b) {
      sum += b.minuten;
      if (!(b.pctLo > 0 && b.pctLo <= b.pctHi && b.pctHi <= 150 && b.minuten > 0)) blokOk = false;
      if (b.zone !== pctZoneBucket_(Math.round((b.pctLo + b.pctHi) / 2))) zoneOk = false;
    });
    assert_(ctx, 'lib ' + rec.id + ' blok-bounds', true, blokOk);
    assert_(ctx, 'lib ' + rec.id + ' blok-zone', true, zoneOk);
    assertClose_(ctx, 'lib ' + rec.id + ' som==totaal', wo.totaalMin, sum, 0.01);
    assertClose_(ctx, 'lib ' + rec.id + ' ~doelMin', dm, wo.totaalMin, 1.5);
    var pushOk = true, wattOk = true;
    wo.structuur.forEach(function (row) {
      if (dslBlockFromRow_(row, 275) == null) pushOk = false;
      var r = dslPowerRange_(row[2], 275);
      if (!r || row[2] !== (watts(275, r.lo) + '-' + watts(275, r.hi) + 'W')) wattOk = false;
    });
    assert_(ctx, 'lib ' + rec.id + ' push-parse', true, pushOk);
    assert_(ctx, 'lib ' + rec.id + ' watt-roundtrip', true, wattOk);
    assert_(ctx, 'lib ' + rec.id + ' tss', tssFromZoneMinutes_(wo.intent), wo.tss);
    var tagsOk = rec.effectTags.length > 0;
    rec.effectTags.forEach(function (t) { if (ARCHETYPE_EFFECT_TAGS.indexOf(t) < 0) tagsOk = false; });
    assert_(ctx, 'lib ' + rec.id + ' effectTags', true, tagsOk);
    assert_(ctx, 'lib ' + rec.id + ' structuurtype', true, ARCHETYPE_STRUCTUURTYPES.indexOf(rec.structuurtype) >= 0);
    var coreMin = expandArchetype_(rec, { ftp: 275, lthr: 178, doelMin: 0, mesoFactor: 1.0, faseOffset: 0 }).totaalMin;
    assertClose_(ctx, 'lib ' + rec.id + ' min~core', rec.duurRange[0], coreMin, 1.5);
    // NIEUW — int-werk-blok met werk-range: een ECHTE range (pctHi-pctLo == onPctHi-onPctLo > 0, niet ±2).
    rec.core.forEach(function (c) {
      if (c.kind === 'int' && c.onPctLo != null && c.onPctHi != null) {
        var hit = wo.blokken.filter(function (b) { return b.pctLo === c.onPctLo && b.pctHi === c.onPctHi; });
        assert_(ctx, 'lib ' + rec.id + ' werk-range', true, hit.length > 0 && (c.onPctHi - c.onPctLo) > 0);
      }
    });
  });
}

// ── Fase 1 deel 2b.1 — profiel-laag + goalWorkout_-selector (deterministisch) ──
function testGoalWorkout_(ctx) {
  var klim = profileForDoel_('Beklimmingen'), ftp = profileForDoel_('FTP');
  // determinisme: zelfde input → zelfde keuze
  var g1 = goalWorkout_(klim, 'Build', 75, []);
  var g2 = goalWorkout_(klim, 'Build', 75, []);
  assert_(ctx, 'goalWO det type', g1.type, g2.type);
  assert_(ctx, 'goalWO det id', g1.archetypeId, g2.archetypeId);
  // intent-keuze respecteert gewichten over de fasen
  assert_(ctx, 'goalWO klim Build->drempel', 'drempel', goalPickIntent_(klim, 'Build', null));
  assert_(ctx, 'goalWO klim Peak->vo2', 'vo2', goalPickIntent_(klim, 'Peak', null));
  assert_(ctx, 'goalWO ftp Build->drempel', 'drempel', goalPickIntent_(ftp, 'Build', null));
  // filter: bij 75 min drempel past ALLEEN threshold_overunder (threshold_long min 82)
  assert_(ctx, 'goalWO filter id', 'threshold_overunder', g1.archetypeId);
  assert_(ctx, 'goalWO filter type', 'threshold', g1.type);
  var rec = null; ARCHETYPES.forEach(function (a) { if (a.id === g1.archetypeId) rec = a; });
  assert_(ctx, 'goalWO match intent+range', true,
    rec.effectTags.indexOf('drempel') >= 0 && 75 >= rec.duurRange[0] && 75 <= rec.duurRange[1]);
  // recency: vorige intent drempel → kiest een andere intent (ander type)
  var gr = goalWorkout_(klim, 'Build', 75, [{ intent: 'drempel', archetypeId: 'threshold_overunder' }]);
  assert_(ctx, 'goalWO recency intent-avoid', true, gr.type !== 'threshold');
  // per-intent id-avoid: bij 51 min is ALLEEN vo2 haalbaar → intent blijft vo2 ondanks de vermijd;
  // 't recency-VENSTER mijdt 't laatst-gebruikte vo2-id → rotatie naar vo2_pyramid.
  var ga = goalWorkout_(klim, 'Build', 51, [{ intent: 'vo2', archetypeId: 'vo2_microburst' }]);
  assert_(ctx, 'goalWO recency id-avoid same-intent', true, ga.type === 'vo2max' && ga.archetypeId !== 'vo2_microburst');
  // profiel-kiezer
  assert_(ctx, 'goalWO doel FTP', PROFILES.ftp, profileForDoel_('FTP'));
  assert_(ctx, 'goalWO doel Beklimmingen', PROFILES.klim, profileForDoel_('Beklimmingen'));
  assert_(ctx, 'goalWO doel VO2max', PROFILES.vo2max, profileForDoel_('VO2max'));
  assert_(ctx, 'goalWO doel Conditie', PROFILES.conditie, profileForDoel_('Conditie'));
  assert_(ctx, 'goalWO doel onbekend->klim', PROFILES.klim, profileForDoel_('xyz'));
  // effectTag->engine-type zit in ALLE bekende koppel-maps (cruciaal voor de 2b.2-inplug)
  GOAL_KWALITEIT_INTENTS_.forEach(function (it) {
    var t = COACH_INTENT_ENGINE_TYPE_[it];
    assert_(ctx, 'goalWO type-in-maps ' + it, true,
      COACH_TYPE_INTENT_[t] != null && DEMOTE_MAP[t] != null && workoutZones(t, 'FTP').length > 0);
  });
  // klim kiest UITSLUITEND klim-relevante intents (drempel/sweetspot/vo2)
  var klimOnly = true;
  ['Base', 'Build', 'Peak'].forEach(function (f) {
    if (GOAL_KWALITEIT_INTENTS_.indexOf(goalPickIntent_(klim, f, null)) < 0) klimOnly = false;
    if (GOAL_KWALITEIT_INTENTS_.indexOf(goalPickIntent_(klim, f, 'drempel')) < 0) klimOnly = false;
  });
  assert_(ctx, 'goalWO klim klim-only-intents', true, klimOnly);
  // C1 (a) duur-haalbaar-eerst: bij 40 min heeft de top-intent (drempel, min 54) GEEN archetype, maar
  // vo2 (vo2_microburst[35,70]) wel → kiest vo2, NIET null (oud intent-vóór-duur-gedrag was null).
  var gShort = goalWorkout_(klim, 'Build', 40, []);
  assert_(ctx, 'goalWO duur-haalbaar niet-null', true, gShort != null);
  assert_(ctx, 'goalWO duur-haalbaar vo2', 'vo2max', gShort && gShort.type);
  // C1b coverage-bias = MODULATIE, niet override (COVERAGE_BOOST_ 0.10):
  // klim NAUWE keuze (vo2 0.35+0.10=0.45 > drempel 0.40) → anaerobic-gat tipt naar vo2.
  assert_(ctx, 'goalWO bias klim anaerobic-gat->vo2', 'vo2',
    goalPickIntent_(klim, 'Build', null, 75, { low: true, high: true, anaerobic: false }));
  // ftp BESLISSENDE voorkeur HOUDT (drempel 0.45 > vo2 0.20+0.10=0.30) → high-bucket, NIET vo2.
  assert_(ctx, 'goalWO bias ftp anaerobic-gat houdt-high', 'high',
    INTENT_PRIMARY_BUCKET_[goalPickIntent_(ftp, 'Build', null, 75, { low: true, high: true, anaerobic: false })]);
  // high-gat → high-bucket-intent (drempel/sweetspot), NIET vo2.
  assert_(ctx, 'goalWO bias high-gat', 'high',
    INTENT_PRIMARY_BUCKET_[goalPickIntent_(klim, 'Build', null, 75, { low: true, high: false, anaerobic: true })]);
  // backward-compat: zonder beschikbareTijd én dekking = ongewijzigd (hoogste gewicht).
  assert_(ctx, 'goalWO backward-compat', 'drempel', goalPickIntent_(klim, 'Build', null));
}

// ── Fase 1b — per-intent recency-VENSTER rotatie (goalWorkout_) ──
function testGoalWorkoutRotatie_(ctx) {
  // Duur-isolatie: bij 51 min is ALLEEN vo2 haalbaar (drempel min 54 / sweetspot min 52 buiten
  // bereik) → goalPickIntent_ houdt vo2 vast ongeacht de recency-vermijd. M = vo2-archetypes ⊇ 51.
  var TIJD = 51, INTENT = 'vo2';
  var fitting = ARCHETYPES.filter(function (a) {
    return a.effectTags.indexOf(INTENT) >= 0 && TIJD >= a.duurRange[0] && TIJD <= a.duurRange[1];
  }).map(function (a) { return a.id; });
  var M = fitting.length;
  assert_(ctx, 'rot M>=2 (rotatie zinnig)', true, M >= 2);

  // Rotatie: M calls → M verschillende id's; call M+1 == call 1 (stalest-eerst na reset).
  var prof = { id: 'rot', soort: 'capaciteit',
    intentGewichten: { drempel: 0, sweetspot: 0, vo2: 1 }, archetypeVoorkeuren: {} };
  var rec = [], seen = {}, first = null, distinct = true;
  for (var i = 0; i < M; i++) {
    var g = goalWorkout_(prof, 'Build', TIJD, rec);
    if (i === 0) first = g.archetypeId;
    if (seen[g.archetypeId]) distinct = false;
    seen[g.archetypeId] = true;
    rec.push({ intent: INTENT, archetypeId: g.archetypeId });
  }
  assert_(ctx, 'rot M-distinct (volledige rotatie)', true, distinct && Object.keys(seen).length === M);
  assert_(ctx, 'rot call M+1 == call 1', first, goalWorkout_(prof, 'Build', TIJD, rec).archetypeId);

  // Bias: één vorm voorkeur 0.5 → komt >= zo vaak als elke andere; élke fitting vorm >= 1x.
  var boostId = fitting[M - 1];
  var voork = {}; voork[boostId] = 0.5;
  var profB = { id: 'rotB', soort: 'capaciteit',
    intentGewichten: { drempel: 0, sweetspot: 0, vo2: 1 }, archetypeVoorkeuren: voork };
  var recB = [], count = {};
  fitting.forEach(function (id) { count[id] = 0; });
  for (var j = 0; j < 3 * M; j++) {
    var gb = goalWorkout_(profB, 'Build', TIJD, recB);
    count[gb.archetypeId] = (count[gb.archetypeId] || 0) + 1;
    recB.push({ intent: INTENT, archetypeId: gb.archetypeId });
  }
  var boostOk = true, eachOk = true;
  fitting.forEach(function (id) {
    if (count[id] < 1) eachOk = false;
    if (id !== boostId && count[boostId] < count[id]) boostOk = false;
  });
  assert_(ctx, 'rot bias boosted >= elke andere', true, boostOk);
  assert_(ctx, 'rot bias élke vorm >=1', true, eachOk);
}

// ── Fase 1b — cross-week recency-seed (gatherWeekplanEntries_) ──
function testGatherWeekplanEntries_(ctx) {
  // Synthetische base in jaar 2000 → raakt geen echte weekplan_-sleutels. Week k=2 blijft ONGEZET
  // (gat) zodat we bewijzen dat lege/ontbrekende weken niets bijdragen. try/finally ruimt op, ook
  // bij assert-falen.
  var props = PropertiesService.getDocumentProperties();
  var base = new Date(2000, 0, 3);
  function key(d) { return 'weekplan_' + formatDate(d, 'yyyy-MM-dd'); }
  var d1 = new Date(base.getFullYear(), base.getMonth(), base.getDate() - 7);
  var k0 = key(base), k1 = key(d1);
  try {
    props.setProperty(k0, JSON.stringify([{ datum: '2000-01-03', workoutType: 'vo2max', archetypeId: 'vo2_long' }]));
    props.setProperty(k1, JSON.stringify([
      { datum: '1999-12-27', workoutType: 'threshold', archetypeId: 'threshold_long' },
      { datum: '1999-12-28', workoutType: 'sweet_spot', archetypeId: 'sweetspot_long' }
    ]));
    var res = gatherWeekplanEntries_(8, base);
    var ids = res.map(function (e) { return e.archetypeId; });
    assert_(ctx, 'gather len 1+2+gat==3', 3, res.length);
    assert_(ctx, 'gather week0-id aanwezig', true, ids.indexOf('vo2_long') >= 0);
    assert_(ctx, 'gather week1-id aanwezig', true, ids.indexOf('threshold_long') >= 0);
  } finally {
    props.deleteProperty(k0);
    props.deleteProperty(k1);
  }
}

// ── Pass 1 — volume-adaptieve Base-intent-weging (volumeModulatie, rauwe sort-scores) ──
function testVolumeModulatie_(ctx) {
  var klim = PROFILES.klim, ftp = PROFILES.ftp;
  // klim Base @V<V0: drempel 0.45 > sweetspot 0.35 > vo2 0.25 (geen vo2-boost → vo2 3rd → afwezig in 2-quality).
  var k6 = goalEffWeights_(klim, 'Base', 6);
  assert_(ctx, 'vol klim Base V6 vo2 3rd', true, k6.vo2 < k6.sweetspot && k6.sweetspot < k6.drempel);
  // klim @13u: vo2 ramt boven sweetspot (#2), blijft onder drempel (#1) → vo2 wordt #2, nooit #1.
  var k13 = goalEffWeights_(klim, 'Base', 13);
  assert_(ctx, 'vol klim Base V13 vo2 enters', true, k13.sweetspot < k13.vo2 && k13.vo2 < k13.drempel);
  // ftp Base @V<V0: drempel 0.50 > sweetspot 0.45 > vo2 0.10 (vo2 3rd).
  var f6 = goalEffWeights_(ftp, 'Base', 6);
  assert_(ctx, 'vol ftp Base V6 vo2 3rd', true, f6.vo2 < f6.sweetspot && f6.sweetspot < f6.drempel);
  // ftp @20u: vo2 boven sweetspot (0.45), onder drempel (0.50).
  var f20 = goalEffWeights_(ftp, 'Base', 20);
  assert_(ctx, 'vol ftp Base V20 vo2 enters', true, f20.sweetspot < f20.vo2 && f20.vo2 < f20.drempel);
  // Build/Peak: volume-NEUTRAAL (delta 0) — goalEffWeights_ identiek over V=6/V=20/no-V.
  function neutral(profiel, fase) {
    var lo = goalEffWeights_(profiel, fase, 6), hi = goalEffWeights_(profiel, fase, 20), nov = goalEffWeights_(profiel, fase);
    return GOAL_KWALITEIT_INTENTS_.every(function (k) { return lo[k] === hi[k] && hi[k] === nov[k]; });
  }
  assert_(ctx, 'vol klim Build neutraal', true, neutral(klim, 'Build'));
  assert_(ctx, 'vol klim Peak neutraal', true, neutral(klim, 'Peak'));
  assert_(ctx, 'vol ftp Build neutraal', true, neutral(ftp, 'Build'));
  // volumeModulatie zelf: niet-Base / niet-eindige V / geen volumeResponse → 0.
  assert_(ctx, 'vol mod Build=0', 0, volumeModulatie(20, 'Build', klim).vo2);
  assert_(ctx, 'vol mod NaN=0', 0, volumeModulatie(undefined, 'Base', klim).vo2);
  assert_(ctx, 'vol mod geen-response=0', 0, volumeModulatie(20, 'Base', { id: 'x' }).vo2);
}

// ── Pass 1b — coverage-boost volume-gate in Base (vo2 niet geïnjecteerd ≤ U0) ──
function testCovGateBase_(ctx) {
  var klim = PROFILES.klim, ftp = PROFILES.ftp;
  var gap = { low: true, high: true, anaerobic: false };   // alleen 'n anaerobic-gat
  function pick(p, fase, V) { return goalPickIntent_(p, fase, null, 75, gap, V); }
  // Base ≤ U0: vo2 krijgt GEEN coverage-boost → niet gekozen (#1 leidt).
  assert_(ctx, 'covgate klim Base V6 !vo2', true, pick(klim, 'Base', 6) !== 'vo2');
  assert_(ctx, 'covgate ftp Base V6 !vo2', true, pick(ftp, 'Base', 6) !== 'vo2');
  // Base hoog volume: ramp(cap)+boost verslaat #1 → vo2 gekozen (boost actief boven U0).
  assert_(ctx, 'covgate klim Base V15 vo2', 'vo2', pick(klim, 'Base', 15));
  assert_(ctx, 'covgate ftp Base V20 vo2', 'vo2', pick(ftp, 'Base', 20));
  // Build: gate geldt NIET → coverage injecteert vo2 (anaerobic-gat) ongeacht V (volume-onafhankelijk).
  assert_(ctx, 'covgate Build niet-gated vo2', 'vo2', pick(klim, 'Build', 6));
  assert_(ctx, 'covgate Build V-onafhankelijk', pick(klim, 'Build', 6), pick(klim, 'Build', 20));
}

// ── Pass 2-track — eigen PROFILES vo2max + conditie (ordering + neutraal + archetype-resolutie) ──
function testProfielenVo2maxConditie_(ctx) {
  var vo2 = PROFILES.vo2max, cond = PROFILES.conditie;
  // vo2max Base: drempel 0.40 > sweetspot 0.35 > vo2 0.30 (vo2 3e); @hoog V vo2 #2 (< #1 drempel).
  var v6 = goalEffWeights_(vo2, 'Base', 6);
  assert_(ctx, 'prof vo2max Base V6 vo2 3rd', true, v6.vo2 < v6.sweetspot && v6.sweetspot < v6.drempel);
  var v13 = goalEffWeights_(vo2, 'Base', 13);
  assert_(ctx, 'prof vo2max Base V13 vo2 enters', true, v13.sweetspot < v13.vo2 && v13.vo2 < v13.drempel);
  // conditie Base: sweetspot 0.55 > drempel 0.40 > vo2 0.10 (sweetspot-led); @hoog V vo2 #2 (< #1 sweetspot).
  var c6 = goalEffWeights_(cond, 'Base', 6);
  assert_(ctx, 'prof conditie Base V6 vo2 3rd', true, c6.vo2 < c6.drempel && c6.drempel < c6.sweetspot);
  var c20 = goalEffWeights_(cond, 'Base', 20);
  assert_(ctx, 'prof conditie Base V20 vo2 enters', true, c20.drempel < c20.vo2 && c20.vo2 < c20.sweetspot);
  // Build volume-neutraal (delta 0) voor beide.
  function neutral(p, fase) { var lo = goalEffWeights_(p, fase, 6), hi = goalEffWeights_(p, fase, 20); return GOAL_KWALITEIT_INTENTS_.every(function (k) { return lo[k] === hi[k]; }); }
  assert_(ctx, 'prof vo2max Build neutraal', true, neutral(vo2, 'Build'));
  assert_(ctx, 'prof conditie Build neutraal', true, neutral(cond, 'Build'));
  // Archetype-resolutie smoke: goalWorkout_ levert een geldig archetype per profiel op haalbare duur.
  function archOk(p) { var g = goalWorkout_(p, 'Build', 75, []); return !!(g && g.archetypeId && ARCHETYPES.filter(function (a) { return a.id === g.archetypeId; }).length > 0); }
  assert_(ctx, 'prof vo2max archetype-resolutie', true, archOk(vo2));
  assert_(ctx, 'prof conditie archetype-resolutie', true, archOk(cond));
}

// ── Knip-a — snapshotDayAction_ (puur): freeze-first voor VOORBIJE dagen ──
function testSnapshotDayAction_(ctx) {
  var today = '2026-06-11';
  // VOORBIJ + vorige entry → freeze, ongeacht train/type (gemist + avail-uit + de bug-case verbatim).
  assert_(ctx, 'snap past+prev freeze', 'freeze', snapshotDayAction_('2026-06-10', today, true, true, 'taper_z2_kort'));
  assert_(ctx, 'snap past+prev bug-case (type leeg) freeze', 'freeze', snapshotDayAction_('2026-06-10', today, true, true, ''));
  assert_(ctx, 'snap past+prev avail-uit freeze', 'freeze', snapshotDayAction_('2026-06-10', today, true, false, ''));
  // VOORBIJ + geen prev → rebuild als er 'n type is, anders skip.
  assert_(ctx, 'snap past+noprev+type rebuild', 'rebuild', snapshotDayAction_('2026-06-10', today, false, true, 'long_z2'));
  assert_(ctx, 'snap past+noprev+geen-type skip', 'skip', snapshotDayAction_('2026-06-10', today, false, true, ''));
  // VANDAAG/TOEKOMST: train+type → rebuild; anders skip; NOOIT freeze (ook niet met prev).
  assert_(ctx, 'snap today train+type rebuild', 'rebuild', snapshotDayAction_('2026-06-11', today, false, true, 'sweet_spot'));
  assert_(ctx, 'snap future train+type rebuild', 'rebuild', snapshotDayAction_('2026-06-14', today, true, true, 'long_z2'));
  assert_(ctx, 'snap future restdag+prev skip (volgt nieuw plan)', 'skip', snapshotDayAction_('2026-06-14', today, true, false, ''));
  assert_(ctx, 'snap future geen-type skip', 'skip', snapshotDayAction_('2026-06-13', today, false, false, ''));
}

// ── Fase 1 deel 2b.2 commit 1 — plumbing: buildWorkout-routing + recency-extractor ──
function testInplug_(ctx) {
  var S = { ftp: 275, lthr: 178, doel: 'FTP' };
  // (a) buildWorkout MET archetypeId → archetype-contract + getagd id.
  var wa = buildWorkout('threshold', 90, S, 1, 'Build', null, 0, 'threshold_long');
  assert_(ctx, 'inplug buildWO arch id', 'threshold_long', wa.archetypeId);
  assert_(ctx, 'inplug buildWO arch blokken-pct', true,
    !!(wa.blokken && wa.blokken.length && wa.blokken[0].pctLo != null && wa.blokken[0].pctHi != null));
  assert_(ctx, 'inplug buildWO arch contract', true,
    wa.structuur != null && wa.intent != null && typeof wa.tss === 'number' && wa.zones != null);
  // (b) buildWorkout ZONDER archetypeId → bestaande dispatch byte-identiek (regressie).
  var wr = buildWorkout('recovery', 45, S, 1, 'Base', null, 0);
  assert_(ctx, 'inplug buildWO recovery focus', 'recovery', wr.focus);
  assert_(ctx, 'inplug buildWO recovery geen-arch', true, wr.archetypeId == null);
  assert_(ctx, 'inplug buildWO pendel_z2 focus', 'aerobic base', buildWorkout('pendel_z2', 120, S, 1, 'Base', null, 0).focus);
  assert_(ctx, 'inplug buildWO taper focus', 'sharpness', buildWorkout('taper_openers', 30, S, 1, 'Base', null, 0).focus);
  // onbekend archetypeId → val door naar dispatch (geen crash).
  assert_(ctx, 'inplug buildWO onbekend-arch fallback', 'recovery', buildWorkout('recovery', 45, S, 1, 'Base', null, 0, 'bestaat_niet').focus);
  // (c) recencyFromWeekplan_ uit mock-snapshot → kwaliteit-only, gesorteerd, refISO-filter.
  var wp = [
    { datum: '2026-06-01', workoutType: 'long_z2', archetypeId: null },
    { datum: '2026-06-03', workoutType: 'threshold', archetypeId: 'threshold_long' },
    { datum: '2026-06-05', workoutType: 'vo2max', archetypeId: 'vo2_long' }
  ];
  var rec = recencyFromWeekplan_(wp, '2026-06-10');
  assert_(ctx, 'inplug recency len', 2, rec.length);
  assert_(ctx, 'inplug recency laatste intent', 'vo2', rec[rec.length - 1].intent);
  assert_(ctx, 'inplug recency laatste id', 'vo2_long', rec[rec.length - 1].archetypeId);
  assert_(ctx, 'inplug recency refISO-filter', 1, recencyFromWeekplan_(wp, '2026-06-04').length);
}

// ── Fase 1 deel 2b.2 commit 2 — activatie: goalWorkout_ in keyIntensity (order-invariant) ──
function testKeyIntensityInplug_(ctx) {
  var dek = { low: true, high: false, anaerobic: false };
  // Build met ctx → goalWorkout_ kiest een kwaliteit-type + zet out.archetypeId.
  var out = {};
  var t = keyIntensity('Beklimmingen', 'Build', dek, null, false,
    { beschikbareTijd: 75, recency: [], settings: { doel: 'Beklimmingen' }, out: out });
  assert_(ctx, 'kiPlug Build quality-type', true, t === 'threshold' || t === 'sweet_spot' || t === 'vo2max');
  assert_(ctx, 'kiPlug Build archetypeId-set', true, out.archetypeId != null);
  // order-invariant: Taper/Recovery nemen hun eigen tak (vóór de goalWorkout_-stap), GEEN archetype.
  var o2 = {};
  assert_(ctx, 'kiPlug Taper eigen-tak', 'taper_openers',
    keyIntensity('Beklimmingen', 'Taper', dek, null, false, { beschikbareTijd: 75, recency: [], settings: { doel: 'Beklimmingen' }, out: o2 }));
  assert_(ctx, 'kiPlug Taper geen-arch', true, o2.archetypeId == null);
  assert_(ctx, 'kiPlug Recovery eigen-tak', 'recovery',
    keyIntensity('Beklimmingen', 'Recovery', dek, null, false, { beschikbareTijd: 75, recency: [], settings: { doel: 'Beklimmingen' }, out: {} }));
  // Base: goalWorkout_ vuurt niet (geen Build/Peak) → doel-tak ongewijzigd (FTP Base → sweet_spot).
  assert_(ctx, 'kiPlug Base doel-tak', 'sweet_spot',
    keyIntensity('FTP', 'Base', dek, null, false, { beschikbareTijd: 75, recency: [], settings: { doel: 'FTP' }, out: {} }));
  // Zonder ctx → climbTypeWorkout_-fallback (revert-pad): klimType 'lang' + !high → sweet_spot.
  assert_(ctx, 'kiPlug geen-ctx climb-fallback', 'sweet_spot',
    keyIntensity('FTP', 'Build', dek, 'lang', false));
  // goalWorkout_ null (geen archetype past in 300 min) → fallback-keten → trip-tak long_z2.
  assert_(ctx, 'kiPlug goalWO-null trip-fallback', 'long_z2',
    keyIntensity('FTP', 'Build', dek, null, true, { beschikbareTijd: 300, recency: [], settings: { doel: 'FTP' }, out: {} }));
}

// ── Fase 1 deel 2b.2-VERIFY — Build/Peak-weeksimulatie (keyIntensity is PUUR: goalWorkout_/
// climbTypeWorkout_/doel-tak doen geen Sheet/DocProp → end-to-end keuze puur simuleerbaar) ──
function testGoalInplugWeekSim_(ctx) {
  var QUALITY = { threshold: 1, sweet_spot: 1, vo2max: 1 };
  var dekNorm = { low: true, high: true, anaerobic: false };   // wellness normaal, dekking aanwezig
  var klimS = { doel: 'Beklimmingen' };
  var tijden = [50, 60, 75, 90, 120, 150];
  function archIn_(id) { return ARCHETYPES.filter(function (a) { return a.id === id; }).length > 0; }

  ['Build', 'Peak'].forEach(function (fase) {
    var recency = [], ids = [], consistent = true, klimIntentsOk = true, fallbackClean = true;
    tijden.forEach(function (tijd) {
      var out = {};
      var type = keyIntensity('Beklimmingen', fase, dekNorm, null, false,
        { beschikbareTijd: tijd, recency: recency, settings: klimS, out: out });
      if (QUALITY[type]) {
        if (!(out.archetypeId != null && archIn_(out.archetypeId))) consistent = false;
        if (GOAL_KWALITEIT_INTENTS_.indexOf(COACH_TYPE_INTENT_[type]) < 0) klimIntentsOk = false;
        recency.push({ intent: COACH_TYPE_INTENT_[type], archetypeId: out.archetypeId });
        ids.push(out.archetypeId);
      } else if (out.archetypeId != null) {
        fallbackClean = false;   // fallback-type mag NOOIT een archetypeId dragen
      }
    });
    assert_(ctx, 'sim ' + fase + ' type<->arch consistent', true, consistent);
    assert_(ctx, 'sim ' + fase + ' klim-intents only', true, klimIntentsOk);
    assert_(ctx, 'sim ' + fase + ' fallback geen-arch', true, fallbackClean);
    assert_(ctx, 'sim ' + fase + ' archetype-dagen >=3', true, ids.length >= 3);
    var uniq = {}; ids.forEach(function (id) { uniq[id] = 1; });
    assert_(ctx, 'sim ' + fase + ' variatie >=2', true, Object.keys(uniq).length >= 2);
    var herh = false; for (var i = 1; i < ids.length; i++) { if (ids[i] === ids[i - 1]) herh = true; }
    assert_(ctx, 'sim ' + fase + ' geen-directe-herhaling', false, herh);
  });

  // Duur-extremen.
  assert_(ctx, 'sim >135min trip-fallback', 'long_z2',
    keyIntensity('Beklimmingen', 'Build', dekNorm, null, true,
      { beschikbareTijd: 150, recency: [], settings: klimS, out: {} }));
  var kort = keyIntensity('FTP', 'Build', { low: true, high: false, anaerobic: false }, null, false,
    { beschikbareTijd: 30, recency: [], settings: { doel: 'FTP' }, out: {} });
  assert_(ctx, 'sim <minRange doel-tak', true, kort === 'sweet_spot' || kort === 'threshold');

  // Gedrag-shift: dekking-tekort in Build → type komt van goalWorkout_ (archetypeId gezet), niet de doel-tak.
  var outDek = {};
  var tDek = keyIntensity('FTP', 'Build', { low: false, high: false, anaerobic: false }, null, false,
    { beschikbareTijd: 75, recency: [], settings: { doel: 'FTP' }, out: outDek });
  assert_(ctx, 'sim dekking-shift via goalWO', true, !!QUALITY[tDek] && outDek.archetypeId != null);

  // Elk gekozen archetype → buildWorkout → geldige, push-parsebare workout.
  var S = { ftp: 275, lthr: 178, doel: 'Beklimmingen' };
  var bw = buildWorkout('threshold', 90, S, 1, 'Build', null, 0, 'threshold_overunder');
  assert_(ctx, 'sim buildWO contract', true,
    bw.archetypeId === 'threshold_overunder' && bw.structuur != null && typeof bw.tss === 'number' &&
    !!(bw.blokken && bw.blokken.length && bw.blokken[0].pctLo != null));
  var pushOk = true;
  bw.structuur.forEach(function (row) { if (dslBlockFromRow_(row, 275) == null) pushOk = false; });
  assert_(ctx, 'sim buildWO push-parse', true, pushOk);

  // FTP-profiel-variant: ftp-profiel gekozen + drempel/sweetspot domineren vo2 over de reeks.
  assert_(ctx, 'sim ftp-profiel gekozen', PROFILES.ftp, profileForDoel_('FTP'));
  var ftpIntents = {};
  ['Build', 'Peak'].forEach(function (fase) {
    var rec = [];
    [60, 75, 90].forEach(function (tijd) {
      var o = {};
      var ty = keyIntensity('FTP', fase, dekNorm, null, false, { beschikbareTijd: tijd, recency: rec, settings: { doel: 'FTP' }, out: o });
      if (QUALITY[ty]) { var it = COACH_TYPE_INTENT_[ty]; ftpIntents[it] = (ftpIntents[it] || 0) + 1; if (o.archetypeId) rec.push({ intent: it, archetypeId: o.archetypeId }); }
    });
  });
  assert_(ctx, 'sim ftp drempel/sweetspot-zwaar', true,
    ((ftpIntents.drempel || 0) + (ftpIntents.sweetspot || 0)) > (ftpIntents.vo2 || 0));
}

// ── Fase 1b C3 — pure week-allocator (allocateQualityWeek_) ──
function testAllocateQualityWeek_(ctx) {
  function dW(idx, type, minuten, o) {
    o = o || {};
    return { dagIdx: idx, dag: 'd' + idx, train: o.train !== false, datum: new Date(2026, 5, 8 + idx),
             minuten: minuten, type: type, gedaan: !!o.gedaan, voorgesteldType: o.vt || '' };
  }
  function week() {
    return [dW(0, 'vrij', 60), dW(1, 'pendel', 0), dW(2, 'vrij', 75), dW(3, 'recovery', 45),
            dW(4, 'vrij', 90), dW(5, 'weekend', 180), dW(6, 'weekend', 120)];
  }
  var klim = PROFILES.klim, ftp = PROFILES.ftp;
  var dekFresh = { low: false, high: false, anaerobic: false };
  var today = new Date(2026, 5, 8);
  var SK = { doel: 'Beklimmingen', pendelDuurMin: 80 }, SF = { doel: 'FTP', pendelDuurMin: 80 };
  function qCount(p) { var n = 0; Object.keys(p).forEach(function (k) { if (p[k].role === 'quality') n++; }); return n; }
  function hardIdxs(p) { var a = []; Object.keys(p).forEach(function (k) { if (p[k].role === 'quality' || p[k].role === 'longride_efforts') a.push(Number(k)); }); return a.sort(function (x, y) { return x - y; }); }
  function noAdjacent(idxs) { for (var i = 1; i < idxs.length; i++) if (idxs[i] - idxs[i - 1] < 2) return false; return true; }

  // A — klim Build: longride_efforts + 2 quality, recovery excluded, pendel→endurance, gespreid.
  var pa = allocateQualityWeek_(week(), klim, 'Build', dekFresh, [], null, null, SK, today, false, null);
  assert_(ctx, 'alloc klim Build longride_efforts', 'longride_efforts', pa[5] && pa[5].role);
  assert_(ctx, 'alloc klim Build combo-type', 'combo_long_with_efforts', pa[5] && pa[5].type);
  assert_(ctx, 'alloc klim Build 2 quality', 2, qCount(pa));
  assert_(ctx, 'alloc klim Build recovery-excl', true, pa[3] === undefined);
  assert_(ctx, 'alloc klim Build pendel endurance', 'pendel_z2', pa[1] && pa[1].type);
  assert_(ctx, 'alloc klim Build no-adjacent-hard', true, noAdjacent(hardIdxs(pa)));
  assert_(ctx, 'alloc klim Build weekend-pair vermeden', 'endurance', pa[6] && pa[6].role);
  var qOk = true;
  Object.keys(pa).forEach(function (k) {
    if (pa[k].role === 'quality') { var t = pa[k].type; if (!(t === 'threshold' || t === 'sweet_spot' || t === 'vo2max') || !pa[k].archetypeId) qOk = false; }
  });
  assert_(ctx, 'alloc klim Build quality types+arch', true, qOk);

  // B — klim Base: longride/long_z2 + 2 sweet_spot quality (geen archetype); pendel KAN quality.
  var pb = allocateQualityWeek_(week(), klim, 'Base', dekFresh, [], null, null, SK, today, false, null);
  assert_(ctx, 'alloc Base longride role', 'longride', pb[5] && pb[5].role);
  assert_(ctx, 'alloc Base longride long_z2', 'long_z2', pb[5] && pb[5].type);
  assert_(ctx, 'alloc Base 2 quality', 2, qCount(pb));
  // Pass 1: Base loopt nu via goalWorkout_ (was hardcoded sweet_spot) → quality = echte archetypes,
  // drempel-led (#1 Base-intent), geen herhaalde vorm. Bij dit fixture-volume (~9,5u) komt vo2 via de
  // coverage-bias (anaerobic-gat), niet via de volume-ramp — de ramp wordt puur getest in testVolumeModulatie_.
  var baseQ = Object.keys(pb).filter(function (k) { return pb[k].role === 'quality'; }).map(function (k) { return pb[k]; });
  var baseTypesOk = baseQ.every(function (q) { return (q.type === 'threshold' || q.type === 'sweet_spot' || q.type === 'vo2max') && !!q.archetypeId; });
  assert_(ctx, 'alloc Base quality types+arch', true, baseTypesOk);
  assert_(ctx, 'alloc Base drempel-led (#1)', true, baseQ.some(function (q) { return q.type === 'threshold'; }));
  var baseIds = baseQ.map(function (q) { return q.archetypeId; }), baseUniq = {};
  baseIds.forEach(function (id) { baseUniq[id] = 1; });
  assert_(ctx, 'alloc Base geen-herhaalde-vorm', baseIds.length, Object.keys(baseUniq).length);
  assert_(ctx, 'alloc Base pendel kan quality', 'quality', pb[1] && pb[1].role);

  // C — Recovery (geen quota-entry) → leeg plan.
  var pc = allocateQualityWeek_(week(), klim, 'Recovery', dekFresh, [], null, null, SK, today, false, null);
  assert_(ctx, 'alloc Recovery leeg', 0, Object.keys(pc).length);

  // D — ftp (weekendBlok=false): nooit aaneengesloten harde dagen; quota 3.
  var pd = allocateQualityWeek_(week(), ftp, 'Build', dekFresh, [], null, null, SF, today, false, null);
  assert_(ctx, 'alloc ftp no-adjacent-hard', true, noAdjacent(hardIdxs(pd)));
  assert_(ctx, 'alloc ftp 3 quality', 3, qCount(pd));
  // E — done-quality threading (#3): pendel-only week (geen longride_efforts → volle 3 quality-slots);
  // weekDays met 1 done-hard dag (threshold) reduceert de quota 3 → 2.
  var daysP = [dW(0, 'pendel', 80), dW(1, 'pendel', 80), dW(2, 'pendel', 80), dW(3, 'pendel', 80), dW(4, 'pendel', 80)];
  var baseN = qCount(allocateQualityWeek_(daysP, klim, 'Build', dekFresh, [], null, null, SK, today, false, null));
  var redN = qCount(allocateQualityWeek_(daysP, klim, 'Build', dekFresh, [], null, null, SK, today, false, null,
    daysP.concat([dW(0, 'vrij', 75, { gedaan: true, vt: 'threshold' })])));
  assert_(ctx, 'alloc done-quality reductie 3->2', true, baseN === 3 && redN === 2);
}

function testCoach_(ctx) {
  // FIX 1 — IF-normalisatie: percentage → 0–1; reeds-ratio ongemoeid; 0,77 ≠ vo2.
  assertClose_(ctx, 'normIf 77.09', 0.7709, cfNormIf_(77.09), 0.0001);
  assertClose_(ctx, 'normIf 88', 0.88, cfNormIf_(88), 0.0001);
  assertClose_(ctx, 'normIf 0.77', 0.77, cfNormIf_(0.77), 0.0001);
  assert_(ctx, 'normIf 77 niet vo2', 'tempo', intentFromIF_(cfNormIf_(77)));
  assert_(ctx, 'coach IF duur', 'duur', intentFromIF_(0.62));
  assert_(ctx, 'coach type sweetspot', 'sweetspot', intentFromType_('sweet_spot'));
  // FIX 2 — intent uit reële zone-verdeling (Z2-zwaar→niet-vo2; Z5-blok→vo2).
  assert_(ctx, 'zones Z2-zwaar', 'drempel', coachIntentFromZones_({ rust: 5, z2: 70, tempo: 5, drempel: 20, anaeroob: 0 }));
  assert_(ctx, 'zones Z5-blok', 'vo2', coachIntentFromZones_({ rust: 5, z2: 40, tempo: 0, drempel: 5, anaeroob: 18 }));
  assert_(ctx, 'zones puur Z2', 'duur', coachIntentFromZones_({ rust: 8, z2: 90, tempo: 0, drempel: 0, anaeroob: 0 }));
  // Alignment relatief op IF/TSS.
  assert_(ctx, 'align on-plan', 'on-plan', coachAlignment_(78, 0.88, 81, 0.89).state);
  assert_(ctx, 'align different', 'different', coachAlignment_(95, 0.94, 74, 0.81).state);
  assert_(ctx, 'align deviated', 'deviated', coachAlignment_(90, 0.90, 70, 0.84).state);
  // End-to-end FIX 1: actual-IF als PERCENTAGE → genormaliseerd → on-plan + done.ifv 0–1.
  var fb = coachFeedback_({ type: 'sweet_spot', titel: 'Sweet Spot 3x12', duurMin: 60, tss: 78, segmenten: [] }, { duurMin: 62, tss: 81, ifReal: 89 }, { fase: 'Build' }, false);
  assert_(ctx, 'coach pct-IF on-plan', 'on-plan', fb.state);
  assertClose_(ctx, 'coach done IF 0–1', 0.89, fb.done.ifv, 0.001);
  // FIX 3 — doel-bewust: endurance-event, duur gepland, intensiever gereden → different + adapt + event-naam.
  var evCtx = { fase: 'Build', event: { naam: 'Girona', type: 'trip', isEndurance: true }, patternCount: 1 };
  var fd = coachFeedback_({ type: 'long_z2', titel: 'Lange Z2', duurMin: 120, tss: 80, segmenten: [] }, { duurMin: 90, tss: 95, ifReal: 88 }, evCtx, false);
  assert_(ctx, 'coach endurance-sub different', 'different', fd.state);
  assert_(ctx, 'coach endurance-sub adapt', true, !!fd.adapt);
  assert_(ctx, 'coach narratief event', true, fd.narrative.indexOf('Girona') >= 0);
  // Polish — drempel-substitutie op endurance-event = klim-specifiek credit (geen "tilt niet op").
  assert_(ctx, 'coach drempel-credit klim-framing', true, fd.narrative.indexOf('klim') >= 0);
  assert_(ctx, 'coach drempel-credit geen "tilt"', true, fd.narrative.indexOf('tilt') < 0);
  // vo2-substitutie blijft niet-specifiek ("tilt ... niet op").
  var fv2 = coachFeedback_({ type: 'long_z2', titel: 'Lange Z2', duurMin: 120, tss: 80, segmenten: [] }, { duurMin: 70, tss: 92, ifReal: 96 }, evCtx, false);
  assert_(ctx, 'coach vo2-sub niet-specifiek', true, fv2.narrative.indexOf('tilt') >= 0);
  // Patroon (≥2 subs) → escalerende tekst.
  var evPat = { fase: 'Build', event: { naam: 'Girona', type: 'trip', isEndurance: true }, patternCount: 3 };
  var fp = coachFeedback_({ type: 'long_z2', titel: 'Lange Z2', duurMin: 120, tss: 80, segmenten: [] }, { duurMin: 90, tss: 95, ifReal: 88 }, evPat, false);
  assert_(ctx, 'coach patroon-escalatie', true, fp.narrative.indexOf('ondermijnt') >= 0);
  // Gemiste sleutelprikkel → missed + aanpassing-voorstel.
  var fm = coachFeedback_({ type: 'vo2max', titel: 'VO2max 5x4', duurMin: 70, tss: 92, segmenten: [] }, null, evCtx, true);
  assert_(ctx, 'coach missed adapt', true, !!fm.adapt);
  // FIX 4 — planned-prikkel uit de GEPLANDE zone-minuten: 'duur'-type met een
  // significant Z4-blok + Z2-basis → 'drempel' (niet 'duur'); lege segmenten →
  // type-fallback ongemoeid.
  var fa = coachFeedback_({ type: 'long_z2', titel: 'Lange Z2 + blok', duurMin: 120, tss: 90,
    segmenten: [{ minuten: 90, bucket: 'z2' }, { minuten: 24, bucket: 'drempel' }] }, null, evCtx, true);
  assert_(ctx, 'coach planned uit zones', 'drempel', fa.planned.intent);
  var fb2 = coachFeedback_({ type: 'long_z2', titel: 'Lange Z2', duurMin: 120, tss: 80, segmenten: [] }, null, evCtx, true);
  assert_(ctx, 'coach planned type-fallback', 'duur', fb2.planned.intent);
  // FIX 4 — zelfde-intent 'different' (plIntent==acIntent='drempel', |ΔIF|≥0,10,
  // TSS net boven plan): nieuwe onder-volume-branch — géén swap-frasering ('i.p.v.'),
  // wél event-bewust, geen adapt/patroon-escalatie.
  var fc = coachFeedback_({ type: 'threshold', titel: 'Drempel 3x10', duurMin: 90, tss: 85, segmenten: [] },
    { duurMin: 75, tss: 88, ifReal: 88, zoneMin: { rust: 3, z2: 50, tempo: 3, drempel: 20, anaeroob: 0 } }, evCtx, false);
  assert_(ctx, 'coach same-intent different', 'different', fc.state);
  assert_(ctx, 'coach same-intent geen swap', true, fc.narrative.indexOf('i.p.v.') < 0);
  assert_(ctx, 'coach same-intent event-bewust', true, fc.narrative.indexOf('Girona') >= 0);
  assert_(ctx, 'coach same-intent geen adapt', null, fc.adapt);
}

// ── coachAdaptatie_ (puur) — make-up-payload deterministisch + GELDIGE variant ──
function testCoachAdaptatie_(ctx) {
  var settings = { ftp: 250, lthr: 160, doel: 'FTP', doelStart: new Date(2026, 0, 5) };
  var lib = getTrainingLibrary_(settings);
  function inLib(wt, vid) {
    for (var i = 0; i < lib.length; i++) if (lib[i].type === wt) {
      for (var j = 0; j < lib[i].variants.length; j++) if (lib[i].variants[j].variantId === vid) return true;
    }
    return false;
  }
  // (i) afgeweken intensiteit-substitutie (gepland duur) → ingekorte long_z2-make-up.
  var aDuur = coachAdaptatie_({ intent: 'duur', duurMin: 120 }, lib, '2026-06-12', 'vr 12 jun', '2026-06-07');
  assert_(ctx, 'adapt duur type', 'library', aDuur.type);
  assert_(ctx, 'adapt duur workoutType', 'long_z2', aDuur.workoutType);
  assert_(ctx, 'adapt duur variant geldig', true, !!aDuur.variantId && inLib(aDuur.workoutType, aDuur.variantId));
  assert_(ctx, 'adapt duur ingekort', true, aDuur.durMin > 0 && aDuur.durMin <= 120);
  assert_(ctx, 'adapt duur dISO', '2026-06-12', aDuur.dISO);
  assert_(ctx, 'adapt duur from', '2026-06-07', aDuur.from);
  // (ii) gemiste sleutelprikkel (vo2) → ingekorte vo2max-make-up, geldige variant.
  var aVo2 = coachAdaptatie_({ intent: 'vo2', duurMin: 70 }, lib, '2026-06-10', 'di 10 jun', '2026-06-06');
  assert_(ctx, 'adapt vo2 workoutType', 'vo2max', aVo2.workoutType);
  assert_(ctx, 'adapt vo2 variant geldig', true, inLib(aVo2.workoutType, aVo2.variantId));
  assert_(ctx, 'adapt vo2 durMin>0', true, aVo2.durMin > 0);
  // (iii) null: geen target / intent zonder deterministische make-up.
  assert_(ctx, 'adapt geen target', null, coachAdaptatie_({ intent: 'duur', duurMin: 120 }, lib, null, '', '2026-06-07'));
  assert_(ctx, 'adapt vrij null', null, coachAdaptatie_({ intent: 'vrij', duurMin: 90 }, lib, '2026-06-12', 'vr', '2026-06-07'));
}

// ── Rit-detail (puur) — %FTP + zone-bucket + duur-format ──
function testRideDetail_(ctx) {
  // %FTP uit watt (fallback-bron): round(watt/ftp*100).
  assert_(ctx, 'rd pctFtp 103', 103, rdPctFtp_(283, 275));
  assert_(ctx, 'rd pctFtp 61', 61, rdPctFtp_(168, 275));
  assert_(ctx, 'rd pctFtp geen ftp', null, rdPctFtp_(200, 0));
  // zone-bucket-grenzen (pctZoneBucket_: <56 rust / ≤75 z2 / ≤90 tempo / ≤105 drempel / >105 anaeroob).
  assert_(ctx, 'rd zone 55', 'rust', pctZoneBucket_(55));
  assert_(ctx, 'rd zone 75', 'z2', pctZoneBucket_(75));
  assert_(ctx, 'rd zone 90', 'tempo', pctZoneBucket_(90));
  assert_(ctx, 'rd zone 105', 'drempel', pctZoneBucket_(105));
  assert_(ctx, 'rd zone 110', 'anaeroob', pctZoneBucket_(110));
  // duur-format: m:ss; ride-totaal h:mm:ss.
  assert_(ctx, 'rd dur 483', '8:03', rdDurMs_(483));
  assert_(ctx, 'rd dur 180', '3:00', rdDurMs_(180));
  assert_(ctx, 'rd dur ms 1u', '1:08:03', rdDurMs_(4083));
  assert_(ctx, 'rd dur hms', '0:58:32', rdDurHms_(3512));
  // W/kg = gem. vermogen ÷ gewicht (1 decimaal; null bij ontbrekend/0-gewicht).
  assert_(ctx, 'rd wkg 3.0', 3, rdWkg_(210, 70));
  assertClose_(ctx, 'rd wkg 3.5', 3.5, rdWkg_(245, 70), 0.001);
  assert_(ctx, 'rd wkg geen gewicht', null, rdWkg_(200, 0));
  assert_(ctx, 'rd wkg geen watt', null, rdWkg_(null, 70));
}

// ── 0-API zone-debt: cel-parser + tab-sourcing (puur) ───────────────
function testZoneTimesFromCell_(ctx) {
  var valid = JSON.stringify([{ id: 'Z1', secs: 600 }, { id: 'Z3', secs: 300 }]);
  var p = zoneTimesFromCell_(valid);
  assert_(ctx, 'zt valid is-array', true, Array.isArray(p));
  assert_(ctx, 'zt valid len', 2, p ? p.length : -1);
  assert_(ctx, 'zt valid id0', 'Z1', p ? p[0].id : null);
  assert_(ctx, 'zt empty-string → null', null, zoneTimesFromCell_(''));
  assert_(ctx, 'zt whitespace → null', null, zoneTimesFromCell_('   '));
  assert_(ctx, 'zt null → null', null, zoneTimesFromCell_(null));
  assert_(ctx, 'zt empty-array → null', null, zoneTimesFromCell_('[]'));
  assert_(ctx, 'zt non-array json → null', null, zoneTimesFromCell_('{"a":1}'));
  assert_(ctx, 'zt scalar json → null', null, zoneTimesFromCell_('5'));
  assert_(ctx, 'zt malformed → null', null, zoneTimesFromCell_('[{id:'));
}

function testZoneDebtSheet_(ctx) {
  // Equivalentie: een tab-rij met icu_zone_times-JSON levert via
  // zoneActsByDateFromTab_ → actualZoneMinutes_ DEZELFDE bucket-minuten als een
  // live activity met dezelfde icu_zone_times (per-dag-loop is gedeelde code).
  var zt = [{ id: 'Z1', secs: 600 }, { id: 'Z2', secs: 600 },
            { id: 'Z3', secs: 300 }, { id: 'Z5', secs: 120 }, { id: 'SS', secs: 90 }];
  var liveAct = { type: 'Ride', start_date_local: new Date(2026, 0, 5), icu_zone_times: zt };
  var live = actualZoneMinutes_(liveAct, null);
  assertClose_(ctx, 'live low (Z1+Z2=20m)', 20, live.low, 0.001);
  assertClose_(ctx, 'live high (Z3=5m)', 5, live.high, 0.001);
  assertClose_(ctx, 'live anaerobic (Z5=2m)', 2, live.anaerobic, 0.001);
  assert_(ctx, 'live source power', 'power', live.source);

  // Tab-rij (idx0 Datum, idx1 Type, idx15 Zone-tijden-JSON) → pseudo-activity.
  var row = ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''];
  row[0] = new Date(2026, 0, 5);
  row[1] = 'Ride';
  row[ACT_ZONE_TIMES_IDX] = JSON.stringify(zt);
  var key = formatDate(stripTime_(new Date(2026, 0, 5)), 'yyyy-MM-dd');
  var arr = zoneActsByDateFromTab_([row])[key];
  assert_(ctx, 'tab byDate has key', 1, arr ? arr.length : 0);
  var tab = arr ? actualZoneMinutes_(arr[0], null) : null;
  assertClose_(ctx, 'tab low == live', live.low, tab ? tab.low : -1, 0.001);
  assertClose_(ctx, 'tab high == live', live.high, tab ? tab.high : -1, 0.001);
  assertClose_(ctx, 'tab anaerobic == live', live.anaerobic, tab ? tab.anaerobic : -1, 0.001);
  assert_(ctx, 'tab source power', 'power', tab ? tab.source : null);

  // Lege zone-cel → pseudo zonder data → actualZoneMinutes_ null (drijft coverageGap).
  var emptyRow = ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''];
  emptyRow[0] = new Date(2026, 0, 6);
  emptyRow[1] = 'Ride';
  emptyRow[ACT_ZONE_TIMES_IDX] = '';
  var key2 = formatDate(stripTime_(new Date(2026, 0, 6)), 'yyyy-MM-dd');
  var arr2 = zoneActsByDateFromTab_([emptyRow])[key2];
  assert_(ctx, 'tab empty-cell row present', 1, arr2 ? arr2.length : 0);
  assert_(ctx, 'tab empty-cell → null zonemin', null, arr2 ? actualZoneMinutes_(arr2[0], null) : 'NOPE');

  // Niet-fiets (Run) wordt gefilterd (geen entry in de map).
  var runRow = ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''];
  runRow[0] = new Date(2026, 0, 7);
  runRow[1] = 'Run';
  runRow[ACT_ZONE_TIMES_IDX] = JSON.stringify(zt);
  assert_(ctx, 'tab non-cycling filtered', 0, Object.keys(zoneActsByDateFromTab_([runRow])).length);
}

// ── dash-calc characterization (4 fns, pin vóór single-pass consolidatie) ──
// 16-koloms actValues-rij (idx0..15). Deze fns filteren NIET op type.
function _dcRow_(date, o) {
  o = o || {};
  var r = ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''];
  r[0] = date;
  if (o.naam !== undefined) r[2]  = o.naam;
  if (o.min  !== undefined) r[3]  = o.min;
  if (o.ifv  !== undefined) r[7]  = o.ifv;
  if (o.tss  !== undefined) r[8]  = o.tss;
  if (o.ftp  !== undefined) r[12] = o.ftp;
  if (o.gew  !== undefined) r[13] = o.gew;
  return r;
}
function _dcDayOffset_(n) { return new Date(stripTime_(new Date()).getTime() - n * 86400000); }
function _dcFindMaand_(arr, mk) { for (var i = 0; i < arr.length; i++) if (arr[i].maand === mk) return arr[i]; return null; }

function testDashActuals_(ctx) {
  // Twee ritten zelfde datum, verschillende idx0-tijd, in "verkeerde" volgorde (oudste
  // eerst) → hoogste-timestamp wint ongeacht array-positie (pint volgorde-onafhankelijkheid).
  var rows = [
    _dcRow_(new Date(2025, 5, 10, 7, 0),  { naam: 'Ochtendrit', min: 75, ifv: 0.82, tss: 85 }), // 07:00 (ouder, staat eerst)
    _dcRow_(new Date(2025, 5, 10, 18, 0), { naam: 'Avondrit',   min: 40, ifv: 0.70, tss: 45 }), // 18:00 (nieuwer → wint)
    _dcRow_(new Date(2025, 5, 8),  { naam: '', min: 0 }),                                         // naam-fallback + lege tss/IF
    _dcRow_('geen-datum', { naam: 'x', min: 99 })                                                 // niet-Date → skip
  ];
  var m = dashActualsByDate_(rows);
  assert_(ctx, 'actuals key-count', 2, Object.keys(m).length);
  assert_(ctx, 'actuals hoogste-ts wint naam', 'Avondrit', m['2025-06-10'].naam);   // 18:00 wint, niet de eerste rij
  assert_(ctx, 'actuals hoogste-ts wint dur', 40, m['2025-06-10'].duurMin);
  assert_(ctx, 'actuals hoogste-ts wint tss', 45, m['2025-06-10'].tss);
  assertClose_(ctx, 'actuals hoogste-ts wint IF', 0.70, m['2025-06-10'].ifReal, 0.0001);
  assert_(ctx, 'actuals naam-fallback', 'Rit', m['2025-06-08'].naam);
  assert_(ctx, 'actuals lege dur → 0', 0, m['2025-06-08'].duurMin);
  assert_(ctx, 'actuals lege tss → null', null, m['2025-06-08'].tss);
  assert_(ctx, 'actuals lege IF → null', null, m['2025-06-08'].ifReal);
}

function testDashStats_(ctx) {
  var rows = [
    _dcRow_(_dcDayOffset_(3),   { min: 60,  tss: 50 }),   // d7 + d28 + jaar
    _dcRow_(_dcDayOffset_(5),   { min: 30,  tss: 20 }),   // d7 + d28 + jaar
    _dcRow_(_dcDayOffset_(100), { min: 90,  tss: 70 }),   // jaar
    _dcRow_(_dcDayOffset_(400), { min: 120, tss: 100 }),  // geen bucket (oudste)
    _dcRow_('x', { min: 99, tss: 99 })                    // niet-Date → skip
  ];
  var s = dashStatsFromActivities_(rows);
  assert_(ctx, 'stats d7 ritten', 2, s.stats.d7.ritten);
  assert_(ctx, 'stats d7 min', 90, s.stats.d7.tijdMin);
  assert_(ctx, 'stats d7 tss', 70, s.stats.d7.tss);
  assert_(ctx, 'stats d28 ritten', 2, s.stats.d28.ritten);   // 100d/400d uitgesloten
  assert_(ctx, 'stats d28 tss', 70, s.stats.d28.tss);
  assert_(ctx, 'stats jaar ritten', 3, s.stats.jaar.ritten); // 400d uitgesloten
  assert_(ctx, 'stats jaar min', 180, s.stats.jaar.tijdMin);
  assert_(ctx, 'stats jaar tss', 140, s.stats.jaar.tss);
  assert_(ctx, 'stats spanDagen', 400, s.spanDagen);
  assert_(ctx, 'stats eersteDatum', formatDate(_dcDayOffset_(400), 'yyyy-MM-dd'), s.eersteDatum);
  // maandtotalen: som-invariant t.o.v. maand-split (geen flake bij maandgrens)
  var mr = 0, mt = 0;
  s.maandTotalen.forEach(function (x) { mr += x.ritten; mt += x.tss; });
  assert_(ctx, 'stats maand som-ritten', 4, mr);
  assert_(ctx, 'stats maand som-tss', 240, mt);
  var sorted = true;
  for (var i = 1; i < s.maandTotalen.length; i++) if (s.maandTotalen[i - 1].maand < s.maandTotalen[i].maand) sorted = false;
  assert_(ctx, 'stats maand sorted-desc', true, sorted);
}

function testDashBeginAnker_(ctx) {
  var rows = [
    _dcRow_(new Date(2025, 5, 10), { ftp: 275, gew: 70 }),
    _dcRow_(new Date(2025, 2, 1),  { ftp: 260, gew: 71 }),
    _dcRow_(new Date(2025, 0, 5),  { ftp: 240, gew: 72 }),  // oudste → anker
    _dcRow_('x', { ftp: 999, gew: 99 })                     // niet-Date → skip
  ];
  var a = dashBeginAnker_(null, rows);
  assert_(ctx, 'anker ftp', 240, a.ftp);
  assert_(ctx, 'anker gewicht', 72, a.gewicht);
  assert_(ctx, 'anker datum', '2025-01-05', formatDate(a.datum, 'yyyy-MM-dd'));
  assert_(ctx, 'anker leeg → null', null, dashBeginAnker_(null, []));
  var a2 = dashBeginAnker_(null, [_dcRow_(new Date(2025, 0, 5), {})]);
  assert_(ctx, 'anker lege ftp → null', null, a2.ftp);
  assert_(ctx, 'anker lege gew → null', null, a2.gewicht);
}

function testDashNiveauReeks_(ctx) {
  var rows = [
    _dcRow_(new Date(2025, 4, 15), { ftp: 270, gew: 68 }),  // mei: telt
    _dcRow_(new Date(2025, 4, 2),  { ftp: 999 }),           // mei: gew leeg → skip
    _dcRow_(new Date(2025, 2, 20), { ftp: 260, gew: 70 }),  // mrt: later → wint
    _dcRow_(new Date(2025, 2, 10), { ftp: 250, gew: 70 }),  // mrt: vroeger → verliest
    _dcRow_(new Date(2025, 0, 25), { ftp: 245, gew: 71 }),  // jan: later, MAAR anker overschrijft
    _dcRow_(new Date(2025, 0, 5),  { ftp: 240, gew: 72 }),  // jan: oudste = anker
    _dcRow_('x', { ftp: 1, gew: 1 })                        // niet-Date → skip
  ];
  var out = dashNiveauReeks_(null, rows);
  assert_(ctx, 'niveau out[0] maand', '2025-01', out[0].maand);
  assert_(ctx, 'niveau anker-overschrijft ftp', 240, out[0].ftp);   // 245 (later) verliest van anker 240
  assert_(ctx, 'niveau anker-overschrijft gew', 72, out[0].gewicht);
  var exp01 = Math.round(computeNiveau_(240, 72).niveau * 10) / 10;
  assertClose_(ctx, 'niveau anker-niveau', exp01, out[0].niveau, 0.0001);
  var mrt = _dcFindMaand_(out, '2025-03');
  assert_(ctx, 'niveau mrt last-on-date ftp', 260, mrt.ftp);        // 03-20 wint van 03-10
  assert_(ctx, 'niveau mrt gew', 70, mrt.gewicht);
  var mei = _dcFindMaand_(out, '2025-05');
  assert_(ctx, 'niveau mei null-gew-skip ftp', 270, mei.ftp);       // 999/leeg-gew genegeerd
  assert_(ctx, 'niveau mei gew', 68, mei.gewicht);
  var feb = _dcFindMaand_(out, '2025-02');
  assert_(ctx, 'niveau feb gap ftp', null, feb.ftp);
  assert_(ctx, 'niveau feb gap niveau', null, feb.niveau);
  assert_(ctx, 'niveau lengte >= 6', true, out.length >= 6);        // jan..nu minstens
}

// ── activityToRow_ (pure mapper, 17-koloms) ─────────────────────────
function testActivityToRow_(ctx) {
  var zt = [{ id: 'Z1', secs: 600 }, { id: 'Z3', secs: 300 }];
  var fx = {
    id: 'i12345', start_date_local: '2026-06-10T07:30:00', type: 'Ride', name: 'Ochtendrit',
    moving_time: 3600, distance: 30000, icu_average_watts: 210, icu_weighted_avg_watts: 225,
    icu_intensity: 77, icu_training_load: 85, polarization_index: 1.83,
    average_heartrate: 142, max_heartrate: 176, icu_ftp: 270, icu_weight: 70,
    icu_rolling_ftp: 268, icu_zone_times: zt
  };
  var row = activityToRow_(fx);
  assert_(ctx, 'a2r length=17', ACT_HEADERS.length, row.length);
  assert_(ctx, 'a2r idx0 datum', '2026-06-10', formatDate(row[0], 'yyyy-MM-dd'));
  assert_(ctx, 'a2r idx1 type', 'Ride', row[1]);
  assert_(ctx, 'a2r idx2 naam', 'Ochtendrit', row[2]);
  assert_(ctx, 'a2r idx3 duur-min', 60, row[3]);
  assert_(ctx, 'a2r idx4 afstand-km', 30, row[4]);
  assert_(ctx, 'a2r idx5 gem-W', 210, row[5]);
  assert_(ctx, 'a2r idx6 norm-W', 225, row[6]);
  assert_(ctx, 'a2r idx7 IF=percentage', 77, row[7]);
  assert_(ctx, 'a2r idx8 TSS', 85, row[8]);
  assert_(ctx, 'a2r idx9 gem-HR', 142, row[9]);
  assert_(ctx, 'a2r idx10 max-HR', 176, row[10]);
  assertClose_(ctx, 'a2r idx11 PI', 1.83, row[11], 0.0001);
  assert_(ctx, 'a2r idx12 FTP', 270, row[12]);
  assert_(ctx, 'a2r idx13 gewicht', 70, row[13]);
  assert_(ctx, 'a2r idx14 rolling-FTP', 268, row[14]);
  assert_(ctx, 'a2r idx15 zone-tijden JSON', JSON.stringify(zt), row[15]);
  assert_(ctx, 'a2r idx16 id', 'i12345', row[16]);
  assert_(ctx, 'a2r geen id → leeg', '', activityToRow_({ start_date_local: '2026-06-10T07:30:00' })[16]);
  assert_(ctx, 'a2r numeriek id → String', '999', activityToRow_({ id: 999, start_date_local: '2026-06-10T07:30:00' })[16]);
}

// ── mergeById_ (pure upsert) ────────────────────────────────────────
function _mkAct_(id, iso, extra) {
  var a = { type: 'Ride', name: 'Rit', start_date_local: iso, moving_time: 3600, icu_training_load: 50 };
  if (id != null) a.id = id;
  if (extra) Object.keys(extra).forEach(function (k) { a[k] = extra[k]; });
  return a;
}
function testMergeById_(ctx) {
  // (a) verse id nog niet in tab → append
  var rA = mergeById_([activityToRow_(_mkAct_('A', '2026-06-01T08:00:00'))], [_mkAct_('B', '2026-06-02T08:00:00')]);
  assert_(ctx, 'merge(a) added', 1, rA.added);
  assert_(ctx, 'merge(a) updated', 0, rA.updated);
  assert_(ctx, 'merge(a) len', 2, rA.rows.length);
  assert_(ctx, 'merge(a) nieuwe id', 'B', rA.rows[1][ACT_ID_IDX]);

  // (b) verse id al in tab → update-in-plaats
  var rB = mergeById_([activityToRow_(_mkAct_('A', '2026-06-01T08:00:00', { name: 'Oud' }))],
                      [_mkAct_('A', '2026-06-01T08:00:00', { name: 'Nieuw' })]);
  assert_(ctx, 'merge(b) added', 0, rB.added);
  assert_(ctx, 'merge(b) updated', 1, rB.updated);
  assert_(ctx, 'merge(b) len', 1, rB.rows.length);
  assert_(ctx, 'merge(b) vervangen naam', 'Nieuw', rB.rows[0][2]);
  assert_(ctx, 'merge(b) id behouden', 'A', rB.rows[0][ACT_ID_IDX]);

  // (c) pre-migratie rij (lege id) matcht op minuut → fallback-update + id ingezet
  var exC = [activityToRow_(_mkAct_(null, '2026-06-01T08:00:00'))];
  assert_(ctx, 'merge(c) pre-id leeg', '', exC[0][ACT_ID_IDX]);
  var rC = mergeById_(exC, [_mkAct_('A', '2026-06-01T08:00:30')]);   // zelfde minuut
  assert_(ctx, 'merge(c) added', 0, rC.added);
  assert_(ctx, 'merge(c) updated', 1, rC.updated);
  assert_(ctx, 'merge(c) id gemigreerd', 'A', rC.rows[0][ACT_ID_IDX]);

  // (d) twee ritten zelfde dag, andere id → beide, geen collision
  var rD = mergeById_([], [_mkAct_('A', '2026-06-01T08:00:00'), _mkAct_('B', '2026-06-01T17:00:00')]);
  assert_(ctx, 'merge(d) added', 2, rD.added);
  assert_(ctx, 'merge(d) updated', 0, rD.updated);
  assert_(ctx, 'merge(d) id0', 'A', rD.rows[0][ACT_ID_IDX]);
  assert_(ctx, 'merge(d) id1', 'B', rD.rows[1][ACT_ID_IDX]);

  // (e) lege verse set → no-op
  var rE = mergeById_([activityToRow_(_mkAct_('A', '2026-06-01T08:00:00'))], []);
  assert_(ctx, 'merge(e) added', 0, rE.added);
  assert_(ctx, 'merge(e) updated', 0, rE.updated);
  assert_(ctx, 'merge(e) len', 1, rE.rows.length);
  assert_(ctx, 'merge(e) id', 'A', rE.rows[0][ACT_ID_IDX]);

  // (f) existing buiten verse set → blijft staan
  var rF = mergeById_([activityToRow_(_mkAct_('A', '2026-06-01T08:00:00')), activityToRow_(_mkAct_('B', '2026-06-02T08:00:00'))],
                      [_mkAct_('A', '2026-06-01T08:00:00', { name: 'A2' })]);
  assert_(ctx, 'merge(f) added', 0, rF.added);
  assert_(ctx, 'merge(f) updated', 1, rF.updated);
  assert_(ctx, 'merge(f) len', 2, rF.rows.length);
  assert_(ctx, 'merge(f) B blijft', true, rF.rows[0][ACT_ID_IDX] === 'B' || rF.rows[1][ACT_ID_IDX] === 'B');
}
