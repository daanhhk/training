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
