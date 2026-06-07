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

// NL coach-copy uit {state, intent, sleutelprikkel, fase}. Echte feiten ingevuld,
// motiverend/uitleggend, geen schuld. adapt = AANPASSING-VOORSTEL (suggestie-toon).
function coachCopy_(state, plIntent, acIntent, isKey, fase) {
  var pl = COACH_INTENT_LABEL_[plIntent], ac = COACH_INTENT_LABEL_[acIntent] || '';
  if (state === 'on-plan')  return { narrative: 'Sterk gereden. Je hield de ' + pl + ' strak vast — precies de prikkel die je ' + fase + '-blok nodig heeft. Zo duw je je drempel verder omhoog.', adapt: null };
  if (state === 'deviated') return { narrative: 'Goed dat je reed. Dezelfde ' + pl + '-prikkel, alleen wat lichter dan gepland — prima op een drukke dag. De lijn blijft kloppen.', adapt: null };
  if (state === 'different') {
    return { narrative: 'Je trainde ' + ac + ' i.p.v. de geplande ' + pl + '. ' +
      (isKey ? ('In deze ' + fase + '-fase is de ' + pl + '-prikkel de sleutel van de week — ' + ac + ' houdt je fit, maar tilt je plafond niet op. Één keer is geen probleem.')
             : (ac + ' houdt je aerobe basis op peil; de week blijft op koers.')),
      adapt: isKey ? ('Voorstel: verplaats de ' + pl + '-sessie naar een verse dag later deze week en houd de dag erna rustig. Zo blijft je weekbelasting op koers.') : null };
  }
  // missed
  return { narrative: 'Geen punt — één gemiste sessie gooit je blok niet om. ' +
    (isKey ? ('Wel was dit een ' + pl + '-sleutelprikkel, dus om je ' + fase + '-fase op gang te houden laat ik ’m niet helemaal vallen.')
           : ('Het was een aanvullende sessie; je week ligt nog ruim op koers.')),
    adapt: isKey ? ('Voorstel: een ingekorte ' + pl + ' op de eerstvolgende verse dag en de dag erna wat rustiger. Maandag start je weer fris.') : null };
}

/**
 * Hoofd-ingang: coach-feedback-object voor één dag (DoneDetail / GemistDetail).
 * @param planned   voorstel-achtig {type, titel, duurMin, tss, segmenten} of null
 * @param actual    {naam, duurMin, tss, ifReal} of null
 * @param macroFase 'Base'|'Build'|'Peak'|...
 * @param isMissed  true → gemiste dag
 */
function coachFeedback_(planned, actual, macroFase, isMissed) {
  if (!planned) return null;
  var fase = macroFase || 'Build';
  var plIntent = intentFromType_(planned.type);
  var plDur = planned.duurMin || 0, plTss = planned.tss || 0;
  var plIf = cfIf_(plTss, plDur);
  var isKey = !!COACH_KEY_INTENTS_[plIntent];
  var plBlock = {
    typeLabel: COACH_INTENT_LABEL_[plIntent], naam: planned.titel || COACH_INTENT_LABEL_[plIntent],
    duurMin: plDur, tss: plTss, ifv: plIf, badgeZone: COACH_INTENT_ZONE_[plIntent],
    segmenten: planned.segmenten || null
  };

  if (isMissed || !actual) {
    var cM = coachCopy_('missed', plIntent, null, isKey, fase);
    return { state: 'missed', score: null, chipLabel: COACH_CHIP_LABEL_.missed, isImpact: true,
             planned: plBlock, done: null, narrative: cM.narrative, adapt: cM.adapt };
  }

  var acDur = actual.duurMin || 0, acTss = actual.tss || 0;
  var acIf = (actual.ifReal != null) ? actual.ifReal : cfIf_(acTss, acDur);
  var al = coachAlignment_(plTss, plIf, acTss, acIf);
  var acIntent = (al.state === 'different' && acIf != null) ? intentFromIF_(acIf) : plIntent;
  var c = coachCopy_(al.state, plIntent, acIntent, isKey, fase);
  var doneBlock = {
    typeLabel: COACH_INTENT_LABEL_[acIntent], intent: acIntent,
    duurMin: acDur, tss: acTss, ifv: acIf, badgeZone: COACH_INTENT_ZONE_[acIntent],
    segmenten: segmentsFromIntent_(coachActualIntent_(acIntent, acDur))
  };
  return { state: al.state, score: al.score, chipLabel: COACH_CHIP_LABEL_[al.state],
           isImpact: (al.state !== 'on-plan'),
           planned: plBlock, done: doneBlock, narrative: c.narrative, adapt: c.adapt };
}
