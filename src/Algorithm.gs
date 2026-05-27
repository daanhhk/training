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

function mesoFactor(week) {
  return MESO_MOD[week] || 1.00;
}

/**
 * Entry point — gekoppeld aan menu item "Genereer voorstel voor deze week".
 */
function generateProposal() {
  var ss = SpreadsheetApp.getActive();
  var settings  = readSettings(ss);
  var macro     = computeMacroPhase(settings.doelStart, new Date());
  var mesoWeek  = getMesoWeek();
  var days      = readPlanner(ss);

  // Split voltooid vs te plannen
  var voltooid = days.filter(function (d) { return d.train && d.gedaan; });
  var tePlannen = days.filter(function (d) { return d.train && !d.gedaan; });

  // Dekking obv voltooide trainingen
  var dekking = { low: false, high: false, anaerobic: false };
  voltooid.forEach(function (d) {
    var zones = workoutZones(d.voorgesteldType, settings.doel);
    zones.forEach(function (z) { dekking[z] = true; });
  });

  assignWorkouts(tePlannen, settings, mesoWeek, macro.fase, dekking);

  // Sync voorgesteldType terug naar planner (full days array)
  var byIdx = {};
  tePlannen.forEach(function (d) { byIdx[d.dagIdx] = d.voorgesteldType; });
  voltooid.forEach(function (d) { byIdx[d.dagIdx] = d.voorgesteldType; });
  days.forEach(function (d) {
    if (byIdx.hasOwnProperty(d.dagIdx)) d.voorgesteldType = byIdx[d.dagIdx];
    else d.voorgesteldType = '';
  });
  writeVoorgesteldType(ss, days);

  // Render proposal
  renderProposal(ss, days, voltooid, settings, mesoWeek, macro, dekking);

  // Activeer Voorstel-tab
  var prop = ss.getSheetByName(PROPOSAL_SHEET);
  if (prop) ss.setActiveSheet(prop);

  ss.toast('Voorstel gegenereerd ✓ — doel: ' + settings.doel + ', fase: ' + macro.fase, '🚴 Coach', 6);
}

/**
 * Wijst per dag een workout-type toe. Muteert days in-place (voorgesteldType
 * + tss-hint) en update dekking.
 */
function assignWorkouts(days, settings, mesoWeek, macroFase, dekking) {
  var doel = settings.doel;
  var isRecovery = mesoWeek === 4;
  var isTestWeek = macroFase === 'Test';
  var testGedaan = false;

  // Sorteer op dagIdx zodat ma→zo wordt verwerkt
  days.sort(function (a, b) { return a.dagIdx - b.dagIdx; });

  days.forEach(function (d) {
    var type;

    if (isRecovery) {
      // Recovery week: alleen lichte sessies
      if (d.type === 'pendel')       type = 'pendel_z2';
      else if (d.type === 'weekend') type = 'long_z2';
      else                            type = 'recovery';
    } else if (isTestWeek && !testGedaan && (d.type === 'vrij' || d.type === 'weekend')) {
      type = 'test';
      testGedaan = true;
    } else if (d.type === 'pendel') {
      type = 'pendel_' + doelKey(doel) + '_intervals';
    } else if (d.type === 'weekend') {
      if (!dekking.low) {
        type = 'long_z2';
      } else if (!dekking.high && macroFase !== 'Base') {
        type = 'combo_long_with_efforts';
      } else {
        type = 'long_z2';
      }
    } else if (d.type === 'vrij') {
      type = keyIntensity(doel, macroFase, dekking);
    } else if (d.type === 'recovery') {
      type = 'recovery';
    } else {
      type = 'recovery';
    }

    d.voorgesteldType = type;
    var zones = workoutZones(type, doel);
    zones.forEach(function (z) { dekking[z] = true; });
  });
}

function doelKey(doel) {
  if (doel === 'FTP')         return 'ftp';
  if (doel === 'VO2max')      return 'vo2';
  if (doel === 'Conditie')    return 'conditie';
  if (doel === 'Beklimmingen')return 'climb';
  return 'ftp';
}

/**
 * Kiest de key-intensity workout voor een vrije dag op basis van doel,
 * macro-fase en wat nog open staat in dekking.
 */
function keyIntensity(doel, macroFase, dekking) {
  if (doel === 'FTP') {
    if (macroFase === 'Base')  return 'sweet_spot';
    if (macroFase === 'Build') return dekking.high ? 'threshold' : 'sweet_spot';
    if (macroFase === 'Peak')  return 'threshold';
    return 'sweet_spot';
  }
  if (doel === 'VO2max') {
    if (macroFase === 'Base')  return 'vo2_short';
    if (macroFase === 'Build') return 'vo2_medium';
    if (macroFase === 'Peak')  return dekking.anaerobic ? 'vo2_3015' : 'vo2_long';
    return 'vo2_short';
  }
  if (doel === 'Conditie') {
    if (macroFase === 'Base')  return 'tempo';
    if (macroFase === 'Build') return dekking.high ? 'combo_z2_tempo' : 'tempo';
    if (macroFase === 'Peak')  return 'fatox';
    return 'tempo';
  }
  if (doel === 'Beklimmingen') {
    if (macroFase === 'Base')  return 'low_cad';
    if (macroFase === 'Build') return dekking.high ? 'bergsim' : 'big_gear';
    if (macroFase === 'Peak')  return 'bergsim';
    return 'low_cad';
  }
  return 'sweet_spot';
}

/**
 * Lookup: welke load-focus zones dekt deze workout? (low/high/anaerobic)
 */
function workoutZones(type, doel) {
  if (!type) return [];
  if (type === 'long_z2' || type === 'recovery' || type === 'pendel_z2' || type === 'fatox') return ['low'];
  if (type === 'sweet_spot' || type === 'threshold' || type === 'tempo' ||
      type === 'ss_lang' || type === 'low_cad' || type === 'big_gear' || type === 'bergsim') return ['high'];
  if (type === 'vo2max' || type === 'vo2_short' || type === 'vo2_medium' || type === 'vo2_long' ||
      type === 'vo2_3015' || type === 'microbursts') return ['anaerobic'];
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

/**
 * Bouwt een concrete workout. Routet naar doel-specifieke library voor
 * doel-gespecificeerde types. Generieke types worden hier afgehandeld.
 */
function buildWorkout(type, mins, settings, mesoWeek, macroFase) {
  var doel = settings.doel;
  var ftp = settings.ftp, lthr = settings.lthr;

  // Generieke types eerst
  if (type === 'long_z2')     return genericLongZ2(mins, settings, mesoWeek);
  if (type === 'recovery')    return genericRecovery(mins, settings);
  if (type === 'pendel_z2')   return genericPendelZ2(mins, settings);
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

function genericLongZ2(mins, settings, mesoWeek) {
  var ftp = settings.ftp, lthr = settings.lthr;
  mins = Math.max(60, Math.round(mins * mesoFactor(mesoWeek)));
  return {
    naam: 'Lange Z2 (' + mins + ' min)',
    focus: 'aerobic base',
    zones: ['low'],
    totaalMin: mins,
    structuur: [
      ['Warmup', '10 min', wattsRange(ftp, 50, 65), bpmBelow(lthr, 80), 'Rustig opbouwen'],
      ['Hoofd',  (mins - 15) + ' min', wattsRange(ftp, 65, 75), bpmRange(lthr, 80, 89), 'Stabiele Z2 — aerobic base'],
      ['Cooldown', '5 min', wattsRange(ftp, 45, 55), '—', 'Easy']
    ],
    tss: Math.round(mins * 0.7),
    eindopmerking: 'Volume zonder vermoeidheid — de basis voor alle andere workouts.'
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

function genericPendelZ2(mins, settings) {
  var ftp = settings.ftp, lthr = settings.lthr;
  mins = mins || 150;
  var heen = Math.floor(mins / 2), terug = mins - heen;
  return {
    naam: 'Pendel Z2 (' + mins + ' min, recovery week)',
    focus: 'aerobic base',
    zones: ['low'],
    totaalMin: mins,
    structuur: [
      ['Heen',  heen + ' min',  wattsRange(ftp, 60, 72), bpmRange(lthr, 78, 86), 'Rustige Z2'],
      ['Terug', terug + ' min', wattsRange(ftp, 60, 72), bpmRange(lthr, 78, 86), 'Rustige Z2']
    ],
    tss: Math.round(mins * 0.6),
    eindopmerking: 'Recovery-week pendel — geen intensiteit, alleen volume.'
  };
}

function genericPendelIntervals(type, mins, settings, mesoWeek, macroFase, doel) {
  var ftp = settings.ftp, lthr = settings.lthr;
  mins = mins || 150;
  var heen = Math.floor(mins / 2), terug = mins - heen;
  var f = mesoFactor(mesoWeek);

  var blok = ['—', '—', '—', '—', '—'];
  if (doel === 'FTP') {
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

  return {
    naam: 'Pendel + ' + doel + ' intervallen (' + mins + ' min)',
    focus: 'pendel + doel-specifiek',
    zones: workoutZones(type, doel),
    totaalMin: mins,
    structuur: [
      ['Heen Z2', heen + ' min', wattsRange(ftp, 60, 72), bpmRange(lthr, 78, 86), 'Aanrijden naar werk, rustig'],
      blok,
      ['Cooldown', '5 min', wattsRange(ftp, 45, 55), '—', 'Uitrijden']
    ],
    tss: Math.round(mins * 0.85),
    eindopmerking: 'Pendel-dag — heen rustig, terug doel-specifieke intensiteit.'
  };
}

function genericCombo(type, mins, settings, mesoWeek, doel) {
  var ftp = settings.ftp, lthr = settings.lthr;
  var f = mesoFactor(mesoWeek);

  if (type === 'combo_long_with_efforts') {
    mins = mins || 120;
    return {
      naam: 'Lange rit + ' + doel + ' efforts (' + mins + ' min)',
      focus: 'volume + key zone',
      zones: ['low', 'high'],
      totaalMin: mins,
      structuur: [
        ['Warmup',  '15 min', wattsRange(ftp, 55, 70), bpmBelow(lthr, 85), 'Inrijden Z2'],
        ['Z2 base', Math.max(30, mins - 75) + ' min', wattsRange(ftp, 65, 75), bpmRange(lthr, 80, 89), 'Stabiele Z2'],
        ['Efforts', '3x 10min', wattsRange(ftp, Math.round(85 * f), Math.round(92 * f)), bpmRange(lthr, 92, 99), 'Tempo/SS blokken, 5 min rust'],
        ['Uitrijden', '15 min', wattsRange(ftp, 55, 65), '—', 'Z2 uit']
      ],
      tss: Math.round(mins * 0.85),
      eindopmerking: 'Lange rit met geïntegreerde efforts — dekt low + high in één sessie.'
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
