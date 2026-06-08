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
  // Patroon (≥2 subs) → escalerende tekst.
  var evPat = { fase: 'Build', event: { naam: 'Girona', type: 'trip', isEndurance: true }, patternCount: 3 };
  var fp = coachFeedback_({ type: 'long_z2', titel: 'Lange Z2', duurMin: 120, tss: 80, segmenten: [] }, { duurMin: 90, tss: 95, ifReal: 88 }, evPat, false);
  assert_(ctx, 'coach patroon-escalatie', true, fp.narrative.indexOf('ondermijnt') >= 0);
  // Gemiste sleutelprikkel → missed + aanpassing-voorstel.
  var fm = coachFeedback_({ type: 'vo2max', titel: 'VO2max 5x4', duurMin: 70, tss: 92, segmenten: [] }, null, evCtx, true);
  assert_(ctx, 'coach missed adapt', true, !!fm.adapt);
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
}
