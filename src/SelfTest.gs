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
  testArchetype_(ctx);
  testArchetypeLib_(ctx);
  testGoalWorkout_(ctx);
  testInplug_(ctx);
  testKeyIntensityInplug_(ctx);
  testGoalInplugWeekSim_(ctx);
  testCoachAdaptatie_(ctx);
  testRideDetail_(ctx);

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
  lib.forEach(function (cat) {
    assert_(ctx, 'lib cat niet-leeg: ' + cat.key, true, cat.variants.length > 0);
    cat.variants.forEach(function (v) {
      assert_(ctx, 'lib type match: ' + cat.key + '/' + v.variantId, cat.type, v.type);
      assert_(ctx, 'lib tss>0: ' + cat.key + '/' + v.variantId, true, v.tss > 0);
      assert_(ctx, 'lib segs>0: ' + cat.key + '/' + v.variantId, true, (v.segmenten || []).length > 0);
    });
  });
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
  // recency: zelfde intent, ander archetype dan 't laatst-gebruikte id
  var ga = goalWorkout_(klim, 'Peak', 75, [{ intent: 'sweetspot', archetypeId: 'vo2_hill_repeats' }]);
  assert_(ctx, 'goalWO recency id-avoid', true, ga.type === 'vo2max' && ga.archetypeId !== 'vo2_hill_repeats');
  // profiel-kiezer
  assert_(ctx, 'goalWO doel FTP', PROFILES.ftp, profileForDoel_('FTP'));
  assert_(ctx, 'goalWO doel Beklimmingen', PROFILES.klim, profileForDoel_('Beklimmingen'));
  assert_(ctx, 'goalWO doel VO2max default-klim', PROFILES.klim, profileForDoel_('VO2max'));
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
  // C1 (b) coverage-bias: anaerobic-gat → vo2-boost wint ondanks lagere basis-gewicht.
  assert_(ctx, 'goalWO bias anaerobic-gat', 'vo2',
    goalPickIntent_(klim, 'Build', null, 75, { low: true, high: true, anaerobic: false }));
  // high-gat → een high-bucket-intent (drempel/sweetspot), NIET vo2.
  assert_(ctx, 'goalWO bias high-gat', 'high',
    INTENT_PRIMARY_BUCKET_[goalPickIntent_(klim, 'Build', null, 75, { low: true, high: false, anaerobic: true })]);
  // backward-compat: zonder beschikbareTijd én dekking = ongewijzigd (hoogste gewicht).
  assert_(ctx, 'goalWO backward-compat', 'drempel', goalPickIntent_(klim, 'Build', null));
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
