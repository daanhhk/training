/**
 * Coach.gs — dag-niveau coach-feedback (PURE; getest via runSelfTest).
 *
 * Vergelijkt het GEPLANDE voorstel met de WERKELIJKE rit (of markeert een gemiste
 * dag) → alignment-staat + score + NL coach-narratief (+ impact/aanpassing bij
 * afwijking/gemist). Geen Sheet/DocProp/API-reads; volledig testbaar.
 *
 * LET OP: de "Gedaan"-zoneverdeling is een IF/intent-BENADERING — de Activiteiten-
 * tab bevat geen time-in-zone (ACT_HEADERS). Reële intervals.icu-time-in-zone =
 * toekomst (zie coachActualIntent_). De AANPASSING is een VOORSTEL (niet auto-
 * uitgevoerd in deze pass → suggestie-toon; executie via de override-replanner = toekomst).
 */

// %FTP-intensiteit (IF) → intent-label (actual-classificatie, benadering).
function intentFromIF_(ifv) {
  if (ifv == null) return 'onbekend';
  if (ifv < 0.70) return 'duur';
  if (ifv < 0.80) return 'tempo';
  if (ifv < 0.88) return 'sweetspot';
  if (ifv < 0.95) return 'drempel';
  return 'vo2';
}

// engine-workoutType → intent-label (planned-classificatie).
var COACH_TYPE_INTENT_ = {
  recovery: 'herstel', long_z2: 'duur', fatox: 'duur', tempo: 'tempo',
  sweet_spot: 'sweetspot', threshold: 'drempel', vo2max: 'vo2', free: 'vrij'
};
function intentFromType_(type) {
  if (!type) return 'onbekend';
  if (COACH_TYPE_INTENT_[type]) return COACH_TYPE_INTENT_[type];
  var t = String(type);
  if (t.indexOf('vo2') >= 0) return 'vo2';
  if (t.indexOf('threshold') >= 0 || t.indexOf('ftp') >= 0) return 'drempel';
  if (t.indexOf('sweet') >= 0 || t.indexOf('ss') >= 0) return 'sweetspot';
  if (t.indexOf('tempo') >= 0) return 'tempo';
  if (t.indexOf('z2') >= 0 || t.indexOf('long') >= 0 || t.indexOf('fatox') >= 0) return 'duur';
  if (t.indexOf('recovery') >= 0) return 'herstel';
  return 'onbekend';
}

var COACH_INTENT_LABEL_ = { herstel: 'Herstel', duur: 'Duur', tempo: 'Tempo', sweetspot: 'Sweet Spot', drempel: 'Drempel', vo2: 'VO2max', vrij: 'Vrije rit', onbekend: 'Training' };
var COACH_INTENT_ZONE_  = { herstel: '--zone-1', duur: '--zone-2', tempo: '--zone-3', sweetspot: '--zone-4', drempel: '--zone-4', vo2: '--zone-5', vrij: '--zone-2', onbekend: '--zone-2' };
var COACH_KEY_INTENTS_  = { vo2: 1, drempel: 1 };   // sleutelprikkels (week-bepalend)
var COACH_CHIP_LABEL_   = { 'on-plan': 'Op plan', deviated: 'Licht afgeweken', different: 'Anders getraind', missed: 'Niet gereden' };

function cfIf_(tss, durMin) {
  if (!tss || !durMin) return null;
  return Math.round(Math.sqrt(tss / (durMin / 60 * 100)) * 100) / 100;
}

// FIX 1 — intervals.icu slaat IF op als PERCENTAGE (icu_intensity ≈ 77 voor IF
// 0,77; Sync.gs:157). Normaliseer naar 0–1 voor classifier + alignment + display.
// Reeds-0–1 (≤ 3) blijft ongemoeid. Eén bron, overal gebruikt.
function cfNormIf_(v) {
  if (v == null) return null;
  return (v > 3) ? (v / 100) : v;
}

// Intensiteits-rang (voor richting van een afwijking: intensiever vs lichter).
var COACH_INTENSITY_RANK_ = { herstel: 0, duur: 1, tempo: 2, sweetspot: 3, drempel: 4, vo2: 5, vrij: 2, onbekend: 2 };
function coachDirection_(plIntent, acIntent) {
  var p = COACH_INTENSITY_RANK_[plIntent], a = COACH_INTENSITY_RANK_[acIntent];
  if (a == null || p == null) return 'ander';
  return (a > p) ? 'intensiever' : (a < p ? 'lichter' : 'ander');
}

// FIX 2 — reële zone-verdeling → intent (zwaarste SIGNIFICANTE bucket, rust telt
// niet). zm = {rust,z2,tempo,drempel,anaeroob} minuten. Zo wordt een Z2-zware rit
// met een drempel-blok 'drempel' (niet vo2); een echt Z5-blok → 'vo2'.
function coachIntentFromZones_(zm) {
  if (!zm) return null;
  var total = (zm.rust || 0) + (zm.z2 || 0) + (zm.tempo || 0) + (zm.drempel || 0) + (zm.anaeroob || 0);
  if (total <= 0) return null;
  var thresh = Math.max(8, total * 0.12);
  if ((zm.anaeroob || 0) >= thresh) return 'vo2';
  if ((zm.drempel || 0) >= thresh) return 'drempel';
  if ((zm.tempo || 0) >= thresh) return 'tempo';
  if ((zm.z2 || 0) >= thresh) return 'duur';
  return 'herstel';
}

// FIX 4 — GEPLANDE zone-balk-segmenten → {rust,z2,tempo,drempel,anaeroob} minuten,
// zodat de planned-prikkel net als de done-kant uit de ECHTE zone-minuten volgt
// (i.p.v. het grove type-label). 5-bucket (segmentsFromBlokken_) of 3-bucket
// fallback (segmentsFromIntent_): low→z2, high→drempel, anaerobic→anaeroob.
function coachZmFromSegs_(segs) {
  if (!segs || !segs.length) return null;
  var BUCKET = { rust: 'rust', z2: 'z2', tempo: 'tempo', drempel: 'drempel', anaeroob: 'anaeroob',
                 low: 'z2', high: 'drempel', anaerobic: 'anaeroob' };
  var zm = { rust: 0, z2: 0, tempo: 0, drempel: 0, anaeroob: 0 }, any = false;
  segs.forEach(function (s) {
    var b = BUCKET[s && s.bucket]; if (!b) return;
    var m = Number(s.minuten) || 0; if (m <= 0) return;
    zm[b] += m; any = true;
  });
  return any ? zm : null;
}

// FIX 2 — reële zone-minuten → zone-balk-segmenten (zone-volgorde, met track-
// hoogte/kleur uit DASH_BUCKET_STYLE_ in WebApp.gs). Zelfde vorm als de geplande bar.
function coachSegsFromZones_(zm) {
  if (!zm) return null;
  var order = ['rust', 'z2', 'tempo', 'drempel', 'anaeroob'];
  var segs = [];
  order.forEach(function (b) {
    var m = Math.round(zm[b] || 0);
    if (m <= 0) return;
    var st = DASH_BUCKET_STYLE_[b] || DASH_BUCKET_STYLE_.z2;
    segs.push({ minuten: m, bucket: b, kleur: st.kleur, hoogtePct: st.hoogtePct });
  });
  return segs.length ? segs : null;
}

// Gedaan-zoneverdeling — BENADERING uit intent-label + duur (geen sheet-zones).
function coachActualIntent_(intent, durMin) {
  var d = Math.max(0, Math.round(durMin || 0));
  if (intent === 'tempo')     return { low: Math.round(d * 0.55), high: Math.round(d * 0.45), anaerobic: 0 };
  if (intent === 'sweetspot' || intent === 'drempel') return { low: Math.round(d * 0.45), high: Math.round(d * 0.55), anaerobic: 0 };
  if (intent === 'vo2')       return { low: Math.round(d * 0.62), high: 0, anaerobic: Math.round(d * 0.38) };
  return { low: d, high: 0, anaerobic: 0 };   // herstel/duur/vrij/onbekend
}

// Alignment: vergelijk WERKELIJK met GEPLAND (relatief op IF + TSS), NIET de
// absolute IF-band — zo telt een trouw uitgevoerde Sweet Spot als 'op plan'.
function coachAlignment_(plTss, plIf, acTss, acIf) {
  var ifDelta = (plIf != null && acIf != null) ? (acIf - plIf) : 0;
  var absIf = Math.abs(ifDelta);
  var tssRatio = (plTss > 0) ? (acTss / plTss) : 1;
  if (absIf <= 0.05 && tssRatio >= 0.85 && tssRatio <= 1.20) {
    return { state: 'on-plan', score: Math.max(85, Math.min(100, Math.round(100 - absIf * 100 - Math.abs(1 - tssRatio) * 25))) };
  }
  if (absIf >= 0.10) {
    return { state: 'different', score: Math.max(20, Math.min(62, Math.round(60 - (absIf - 0.10) * 180))) };
  }
  return { state: 'deviated', score: Math.max(45, Math.min(82, Math.round(82 - Math.abs(1 - tssRatio) * 50 - (absIf - 0.05) * 150))) };
}

// FIX 3 — waardevolle, GEDIFFERENTIEERDE, DOEL-BEWUSTE coach-copy. Verschillende
// dagen → verschillende, kloppende tekst uit ECHTE feiten: de richting van de
// afwijking (intensiever/lichter/ander-type), de fase, de EVENT-demand, en een
// PATROON-teller. ctx = {fase, event:{naam,isEndurance}|null, patternCount}.
// adapt = suggestie ("Voorstel: …"; auto-executie = toekomst). Geen onjuiste claims.
function coachCopy_(state, plIntent, acIntent, isKey, ctx) {
  var pl = COACH_INTENT_LABEL_[plIntent], ac = COACH_INTENT_LABEL_[acIntent] || pl;
  var fase = (ctx && ctx.fase) || 'Build';
  var ev = ctx && ctx.event, pat = (ctx && ctx.patternCount) || 0;
  var evNaam = (ev && ev.naam) ? ev.naam : 'je doel';
  var endur = !!(ev && ev.isEndurance);
  var dir = coachDirection_(plIntent, acIntent);
  var plIsEndur = (plIntent === 'duur' || plIntent === 'herstel');

  if (state === 'on-plan') {
    var spec = (endur && (plIntent === 'duur' || plIntent === 'drempel'))
      ? (' Precies de duur/drempel-prikkel die ' + evNaam + ' vraagt — zo bouw je de basis die je daar nodig hebt.')
      : (' Precies de prikkel die je ' + fase + '-blok vraagt.');
    return { narrative: 'Sterk uitgevoerd — je hield de ' + pl + ' strak vast.' + spec, adapt: null };
  }
  if (state === 'deviated') {
    return { narrative: 'Goed dat je reed. Zelfde ' + pl + '-prikkel, ' + (dir === 'lichter' ? 'wat lichter' : 'iets anders gedoseerd') +
      ' dan gepland — op een drukke dag prima. De lijn richting ' + evNaam + ' blijft kloppen.', adapt: null };
  }
  if (state === 'different') {
    // FIX 4 — zelfde prikkel geraakt, maar IF/TSS week genoeg af voor 'different'
    // (meestal: korter gereden → hogere IF, minder Z2/totaaltijd). Geen
    // intensiever/lichter, geen swap-frasering, geen patroon-escalatie — de
    // prikkel klopt, alleen het duur/volume bleef achter.
    if (plIntent === acIntent) {
      var volSpec = endur
        ? (' Richting ' + evNaam + ' — lange dagen — telt juist die duur/Z2-basis; pak het volume op een verse dag terug.')
        : ' Op een drukke dag is dat prima.';
      return { narrative: 'Je raakte de ' + pl + '-prikkel, maar reed korter dan gepland — minder Z2/totaaltijd dan de sessie vroeg.' + volSpec, adapt: null };
    }
    if (dir === 'intensiever' && endur && plIsEndur) {
      if (pat >= 2) {
        return { narrative: 'Je koos nu ' + pat + '× intensiteit (' + ac + ') i.p.v. de geplande duur. Voor ' + evNaam +
          ' — lange dagen — is juist de duur/drempel-basis bepalend; herhaalde losse intensiteit ondermijnt die opbouw.',
          adapt: 'Voorstel: houd de komende ritten bewust Z2/drempel en parkeer de losse intensiteit tot na ' + evNaam + '.' };
      }
      return { narrative: 'Je verving je duur-prikkel door ' + ac + '. Voor ' + evNaam + ' is duur/drempel de doel-specifieke prikkel — ' +
        ac + ' is een leuke sessie maar tilt je ' + evNaam + '-vorm niet op. Eén keer is geen probleem.',
        adapt: 'Voorstel: pak de gemiste duur op een verse dag later deze week op en houd ’m bewust Z2.' };
    }
    if (dir === 'lichter') {
      return { narrative: 'Je trainde ' + ac + ' i.p.v. de geplande ' + pl + ' — lichter dan bedoeld. ' +
        (isKey ? ('De ' + pl + '-sleutelprikkel van je ' + fase + '-blok bleef zo liggen.') : 'Prima als extra hersteldag.'),
        adapt: isKey ? ('Voorstel: verplaats de ' + pl + '-sessie naar een verse dag later deze week.') : null };
    }
    if (dir === 'intensiever') {
      return { narrative: 'Je trainde ' + ac + ' i.p.v. de geplande ' + pl + ' — intensiever dan bedoeld.' +
        (isKey ? (' Dat dekt de ' + pl + '-prikkel deels, maar kost meer herstel.') : ' Geen sleutelprikkel, dus kleine impact.'), adapt: null };
    }
    return { narrative: 'Je trainde ' + ac + ' i.p.v. de geplande ' + pl + ' — ander type prikkel. Je week blijft op koers richting ' + evNaam + '.', adapt: null };
  }
  // missed
  if (isKey) {
    return { narrative: 'Geen drama — één gemiste sessie gooit je blok niet om. Wel was dit een ' + pl + '-sleutelprikkel' +
      (endur ? (', en richting ' + evNaam + ' telt juist de duur/drempel-opbouw') : (' van je ' + fase + '-blok')) + ', dus ik laat ’m niet vallen.',
      adapt: 'Voorstel: een ingekorte ' + pl + ' op de eerstvolgende verse dag, de dag erna rustig. Maandag start je weer fris.' };
  }
  return { narrative: 'Geen punt — een aanvullende sessie gemist; je week ligt ruim op koers richting ' + evNaam + '.', adapt: null };
}

/**
 * Hoofd-ingang: coach-feedback-object voor één dag (DoneDetail / GemistDetail).
 * @param planned voorstel-achtig {type, titel, duurMin, tss, segmenten} of null
 * @param actual  {naam, duurMin, tss, ifReal(%), zoneMin?{rust..anaeroob}} of null
 * @param ctx     { fase, event:{naam,type,isEndurance}|null, patternCount } | 'Fase'-string (legacy)
 * @param isMissed true → gemiste dag
 */
function coachFeedback_(planned, actual, ctx, isMissed) {
  if (!planned) return null;
  if (typeof ctx === 'string') ctx = { fase: ctx };   // backward-compat
  ctx = ctx || {};
  var cc = { fase: ctx.fase || 'Build', event: ctx.event || null, patternCount: ctx.patternCount || 0 };
  // FIX 4: planned-prikkel uit de ECHTE zone-minuten (IDENTIEKE significantie-
  // regel + rust-exclusie als de done-kant); type-label alleen als fallback.
  var plZm = coachZmFromSegs_(planned.segmenten);
  var plIntent = (plZm ? coachIntentFromZones_(plZm) : null) || intentFromType_(planned.type);
  var plDur = planned.duurMin || 0, plTss = planned.tss || 0;
  var plIf = cfIf_(plTss, plDur);
  var isKey = !!COACH_KEY_INTENTS_[plIntent];
  var plBlock = {
    typeLabel: COACH_INTENT_LABEL_[plIntent], naam: planned.titel || COACH_INTENT_LABEL_[plIntent],
    intent: plIntent, duurMin: plDur, tss: plTss, ifv: plIf, badgeZone: COACH_INTENT_ZONE_[plIntent],
    segmenten: planned.segmenten || null
  };

  if (isMissed || !actual) {
    var cM = coachCopy_('missed', plIntent, null, isKey, cc);
    return { state: 'missed', score: null, chipLabel: COACH_CHIP_LABEL_.missed, isImpact: true,
             planned: plBlock, done: null, narrative: cM.narrative, adapt: cM.adapt };
  }

  var acDur = actual.duurMin || 0, acTss = actual.tss || 0;
  var acIf = (actual.ifReal != null) ? cfNormIf_(actual.ifReal) : cfIf_(acTss, acDur);   // FIX 1: 0–1
  var al = coachAlignment_(plTss, plIf, acTss, acIf);
  // FIX 2: reële zones bepalen het actual-intent robuust; anders IF-benadering.
  var zoneIntent = actual.zoneMin ? coachIntentFromZones_(actual.zoneMin) : null;
  var acIntent;
  if (al.state === 'different') acIntent = zoneIntent || (acIf != null ? intentFromIF_(acIf) : plIntent);
  else                          acIntent = plIntent;       // op-plan/afgeweken = zelfde intent
  var realSegs = actual.zoneMin ? coachSegsFromZones_(actual.zoneMin) : null;
  var c = coachCopy_(al.state, plIntent, acIntent, isKey, cc);
  var doneBlock = {
    typeLabel: COACH_INTENT_LABEL_[acIntent], intent: acIntent,
    duurMin: acDur, tss: acTss, ifv: acIf, badgeZone: COACH_INTENT_ZONE_[acIntent],
    segmenten: realSegs || segmentsFromIntent_(coachActualIntent_(acIntent, acDur)),
    zonesReal: !!realSegs
  };
  return { state: al.state, score: al.score, chipLabel: COACH_CHIP_LABEL_[al.state],
           isImpact: (al.state !== 'on-plan'),
           planned: plBlock, done: doneBlock, narrative: c.narrative, adapt: c.adapt };
}

// intent-label → engine-pool-type (inverse van COACH_TYPE_INTENT_). vrij/onbekend
// hebben geen deterministische make-up → afwezig → coachAdaptatie_ geeft null.
var COACH_INTENT_ENGINE_TYPE_ = {
  herstel: 'recovery', duur: 'long_z2', tempo: 'tempo',
  sweetspot: 'sweet_spot', drempel: 'threshold', vo2: 'vo2max'
};

/**
 * FIX-vervolg — adaptatie-EXECUTIE-payload: leidt een INGEKORTE make-up van de
 * gemiste/vervangen prikkel af naar een GELDIGE saveDayOverride-payload. PUUR.
 * @param planned     coach.planned-blok ({ intent, duurMin })
 * @param library     getTrainingLibrary_-output (voor een echte variantId)
 * @param targetDISO  doel-dag (eerstvolgende plannbare dag; door getDashboardState bepaald)
 * @param targetLabel weergave-label van de doel-dag (bv. "vr 12 jun")
 * @param fromDISO    bron-dag (tag op de override → idempotent, voorkomt dubbel-plannen)
 * @return { dISO, type:'library', workoutType, variantId, durMin, from, label } of null
 */
function coachAdaptatie_(planned, library, targetDISO, targetLabel, fromDISO) {
  if (!planned || !targetDISO || !library || !library.length) return null;
  var wt = COACH_INTENT_ENGINE_TYPE_[planned.intent];
  if (!wt) return null;                              // vrij/onbekend → geen make-up
  var cat = null;
  for (var i = 0; i < library.length; i++) { if (library[i].type === wt) { cat = library[i]; break; } }
  if (!cat || !cat.variants || !cat.variants.length) return null;   // geen schone variant-match
  var v = cat.variants[0];                           // eerste GELDIGE variant (deterministisch)
  var base = planned.duurMin || cat.defaultDur || 60;
  var durMin = Math.round((base * 0.7) / 15) * 15;   // ingekort, op 15-min-stap
  durMin = Math.max(45, Math.min(base, durMin));     // 45 ≤ durMin ≤ origineel
  return {
    dISO: targetDISO, type: 'library', workoutType: wt, variantId: v.variantId, durMin: durMin,
    from: fromDISO || null,
    label: 'Ingekorte ' + (COACH_INTENT_LABEL_[planned.intent] || wt) + ' · ' + durMin + ' min' + (targetLabel ? (' · ' + targetLabel) : '')
  };
}
