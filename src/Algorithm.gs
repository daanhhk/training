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
  cleanupOldProposals_();

  var ss = SpreadsheetApp.getActive();
  var settings  = readSettings(ss);
  var macro     = computeMacroPhase(settings.doelStart, new Date());
  var mesoWeek  = getMesoWeek();
  var days      = readPlanner(ss);
  var wellness  = getWellnessSignal(ss);
  var today     = stripTime_(new Date());

  // Split: voltooid / gemist / te plannen
  var voltooid  = days.filter(function (d) { return d.train && d.gedaan; });
  var missed    = days.filter(function (d) {
    return d.train && !d.gedaan && d.datum && stripTime_(d.datum) < today;
  });
  var tePlannen = days.filter(function (d) {
    return d.train && !d.gedaan && (!d.datum || stripTime_(d.datum) >= today);
  });

  // Dekking obv voltooide trainingen
  var dekking = { low: false, high: false, anaerobic: false };
  voltooid.forEach(function (d) {
    workoutZones(d.voorgesteldType, settings.doel).forEach(function (z) { dekking[z] = true; });
  });

  assignWorkouts(tePlannen, settings, mesoWeek, macro.fase, dekking, wellness);

  // Persisteer gegenereerde workouts per datum naar DocProps (voor push-to-Garmin)
  tePlannen.forEach(function (d) {
    if (!d.voorgesteldType || !d.datum) return;
    var wo = buildWorkout(d.voorgesteldType, d.minuten, settings, mesoWeek, macro.fase);
    if (!wo) return;
    setDocProp('proposal_' + formatDate(d.datum, 'yyyy-MM-dd'), JSON.stringify(wo));
  });

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

  renderProposal(ss, days, voltooid, missed, settings, mesoWeek, macro, dekking, wellness);

  var prop = ss.getSheetByName(PROPOSAL_SHEET);
  if (prop) ss.setActiveSheet(prop);

  ss.toast('Voorstel gegenereerd ✓ — doel: ' + settings.doel + ', fase: ' + macro.fase +
           ' — wellness: ' + wellness.signal, '🚴 Coach', 7);
}

function stripTime_(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function cleanupOldProposals_() {
  var props = PropertiesService.getDocumentProperties();
  props.getKeys().forEach(function (k) {
    if (k.indexOf('proposal_') === 0) props.deleteProperty(k);
  });
}

/**
 * Wijst per dag een workout-type toe. Muteert days in-place (voorgesteldType
 * + tss-hint) en update dekking.
 *
 * @param wellness  resultaat van getWellnessSignal(); demote/recovery
 *                  signal overschrijft de assignment cascade.
 */
function assignWorkouts(days, settings, mesoWeek, macroFase, dekking, wellness) {
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

  // Wellness-demotie pass: pas type aan op basis van HRV/slaap-signaal
  if (wellness && (wellness.signal === 'demote' || wellness.signal === 'recovery')) {
    days.forEach(function (d) {
      if (!d.voorgesteldType) return;
      if (wellness.signal === 'recovery') {
        d.voorgesteldType = 'recovery';
      } else {
        d.voorgesteldType = demoteType_(d.voorgesteldType);
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
  // Test → recovery (geen testen tijdens slechte recovery)
  'test': 'recovery'
};

function demoteType_(type) {
  return DEMOTE_MAP[type] || type;
}

/**
 * Leest Wellness tab + berekent HRV/slaap-signaal voor het algoritme.
 *
 * Returnt object met diagnostiek + signal ∈ {normal, warning, demote, recovery}.
 * Bij ontbrekende wellness-data → signal='normal'.
 */
function getWellnessSignal(ss) {
  var sh = ss.getSheetByName(WELLNESS_SHEET);
  if (!sh) return wellnessFallback_('geen Wellness tab');

  var maxDataRow = Math.min(sh.getLastRow(), WELL_STATS_ROW - 2);
  if (maxDataRow < 2) return wellnessFallback_('geen wellness data');

  // Kolommen: A=Datum B=RHR C=HRV D=Slaap
  var data = sh.getRange(2, 1, maxDataRow - 1, 4).getValues();
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
  var s = /(\d+)\s*s\b/i.exec(str);
  if (s) return parseInt(s[1], 10);
  return 0;
}

function dslRestFromNote_(note) {
  if (!note) return null;
  var m = /(\d+)\s*min\s+(rust|pauze|recovery)/i.exec(note);
  if (!m) return null;
  var pctMatch = /@\s*(\d+)\s*%/i.exec(note);
  return {
    duration: parseInt(m[1], 10) * 60,
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

  // Generieke types eerst (maar Conditie heeft eigen long_z2 met fase-schaling)
  if (type === 'long_z2' && doel !== 'Conditie') return genericLongZ2(mins, settings, mesoWeek);
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
