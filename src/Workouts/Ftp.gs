/**
 * Workouts/Ftp.gs — FTP-doel workout library.
 *
 * Sweet Spot, Threshold, en de 20-min FTP test. Intensiteiten schalen
 * met mesoWeek (1.00/1.08/1.15/0.60) en macroFase (Base/Build/Peak/Test).
 */

/**
 * Variant-pools voor FTP: sweet_spot (high) + threshold (high).
 * Variant = vorm; fase/meso schalen %FTP via adj() in renderVariant_.
 */
function ftpPools_() {
  return {
    sweet_spot: [
      { id: 'ss_2x20', naam: 'Sweet Spot 2×20', zone: 'high', warmup: 15, cooldown: 10,
        blocks: function (a) { return [{ kind: 'int', label: 'Sweet Spot', reps: 2, onMin: 20, onPct: a(90), offMin: 5, offPct: 50 }]; },
        tip: 'Sweet Spot bouwt FTP zonder grote vermoeidheid.' },
      { id: 'ss_3x15', naam: 'Sweet Spot 3×15', zone: 'high', warmup: 15, cooldown: 10,
        blocks: function (a) { return [{ kind: 'int', label: 'Sweet Spot', reps: 3, onMin: 15, onPct: a(91), offMin: 4, offPct: 50 }]; } },
      { id: 'ss_2x30', naam: 'Sweet Spot 2×30', zone: 'high', warmup: 15, cooldown: 10,
        blocks: function (a) { return [{ kind: 'int', label: 'Sweet Spot', reps: 2, onMin: 30, onPct: a(89), offMin: 6, offPct: 50 }]; } },
      { id: 'ss_pyramide', naam: 'Sweet Spot pyramide 10-15-20-15-10', zone: 'high', warmup: 15, cooldown: 10,
        blocks: function (a) { return [
          { kind: 'steady', label: 'SS 10', durMin: 10, pct: a(90) },
          { kind: 'steady', label: 'rust',  durMin: 5,  pct: a(50), zone: 'low' },
          { kind: 'steady', label: 'SS 15', durMin: 15, pct: a(90) },
          { kind: 'steady', label: 'rust',  durMin: 5,  pct: a(50), zone: 'low' },
          { kind: 'steady', label: 'SS 20', durMin: 20, pct: a(90) },
          { kind: 'steady', label: 'rust',  durMin: 5,  pct: a(50), zone: 'low' },
          { kind: 'steady', label: 'SS 15', durMin: 15, pct: a(90) },
          { kind: 'steady', label: 'rust',  durMin: 5,  pct: a(50), zone: 'low' },
          { kind: 'steady', label: 'SS 10', durMin: 10, pct: a(90) }
        ]; } },
      { id: 'ss_overunder', naam: 'Sweet Spot over/under 4×(2-3)', zone: 'high', warmup: 15, cooldown: 10,
        blocks: function (a) { var arr = []; for (var i = 0; i < 4; i++) {
          arr.push({ kind: 'steady', label: 'Over/under', durMin: 5, pct: a(91), minMin: 4,
            note: '2 min @ ' + a(95) + '% / 3 min @ ' + a(88) + '% FTP' });
        } return arr; } }
    ],
    threshold: [
      { id: 'thr_4x10', naam: 'Threshold 4×10', zone: 'high', warmup: 15, cooldown: 10,
        blocks: function (a) { return [{ kind: 'int', label: 'Threshold', reps: 4, onMin: 10, onPct: a(98), offMin: 5, offPct: 50 }]; },
        tip: 'Op de scherpe rand van duurzaam — verbetert FTP.' },
      { id: 'thr_3x15', naam: 'Threshold 3×15', zone: 'high', warmup: 15, cooldown: 10,
        blocks: function (a) { return [{ kind: 'int', label: 'Threshold', reps: 3, onMin: 15, onPct: a(98), offMin: 5, offPct: 50 }]; } },
      { id: 'thr_2x20', naam: 'Threshold 2×20', zone: 'high', warmup: 15, cooldown: 10,
        blocks: function (a) { return [{ kind: 'int', label: 'Threshold', reps: 2, onMin: 20, onPct: a(100), offMin: 6, offPct: 50 }]; } },
      { id: 'thr_overunder', naam: 'Threshold over/under 3×8', zone: 'high', warmup: 15, cooldown: 10,
        blocks: function (a) { var arr = []; for (var s = 0; s < 3; s++) {
          arr.push({ kind: 'steady', label: 'Over/under', durMin: 8, pct: a(100), minMin: 4,
            note: 'Wissel 1 min @ ' + a(105) + '% / 1 min @ ' + a(95) + '% FTP (4×)' });
          if (s < 2) arr.push({ kind: 'steady', label: 'rust', durMin: 4, pct: a(50), zone: 'low', minMin: 2 });
        } return arr; } }
    ]
  };
}

function workoutForFtp(type, mins, settings, mesoWeek, macroFase) {
  var ftp = settings.ftp, lthr = settings.lthr;
  var f = mesoFactor(mesoWeek);

  if (type === 'sweet_spot') {
    var reps, len, pctLow, pctHigh;
    if (macroFase === 'Base')      { reps = 2; len = 20; pctLow = 86; pctHigh = 90; }
    else if (macroFase === 'Build'){ reps = 3; len = 20; pctLow = 89; pctHigh = 93; }
    else                            { reps = 2; len = 30; pctLow = 90; pctHigh = 94; }
    mins = mins || (reps * len + 25);
    return {
      naam: 'Sweet Spot ' + reps + 'x' + len + ' (FTP/' + macroFase + ')',
      focus: 'high aerobic',
      zones: ['high'],
      totaalMin: mins,
      structuur: [
        ['Warmup', '15 min', wattsRange(ftp, 55, 70), bpmBelow(lthr, 88), 'Inrijden + 2x 1min openers'],
        ['Sweet Spot', reps + 'x ' + len + ' min',
          wattsRange(ftp, Math.round(pctLow * f), Math.round(pctHigh * f)),
          bpmRange(lthr, 92, 98),
          '5 min rust @ 50% tussen reps'],
        ['Cooldown', '10 min', wattsRange(ftp, 45, 55), '—', 'Easy']
      ],
      tss: Math.round(mins * 0.95),
      eindopmerking: 'Sweet Spot bouwt FTP zonder grote vermoeidheid — hoogste rendement per uur.'
    };
  }

  if (type === 'threshold') {
    var reps2, len2, pct;
    if (macroFase === 'Build')     { reps2 = 4; len2 = 10; pct = 95; }
    else if (macroFase === 'Peak') { reps2 = 3; len2 = 15; pct = 98; }
    else                            { reps2 = 4; len2 = 8;  pct = 95; }
    mins = mins || (reps2 * len2 + 30);
    return {
      naam: 'Threshold ' + reps2 + 'x' + len2 + ' (FTP/' + macroFase + ')',
      focus: 'threshold',
      zones: ['high'],
      totaalMin: mins,
      structuur: [
        ['Warmup', '15 min', wattsRange(ftp, 55, 75), bpmBelow(lthr, 92), 'Inrijden + 3x 1min openers'],
        ['Threshold', reps2 + 'x ' + len2 + ' min',
          wattsRange(ftp, Math.round((pct - 2) * f), Math.round((pct + 2) * f)),
          bpmRange(lthr, 96, 100),
          '5 min rust tussen reps'],
        ['Cooldown', '10 min', wattsRange(ftp, 45, 55), '—', 'Easy']
      ],
      tss: Math.round(mins * 1.05),
      eindopmerking: 'Op de scherpe rand van duurzaam — verbetert FTP via top-end aerobic capacity.'
    };
  }

  if (type === 'test') {
    return {
      naam: '20-min FTP Test',
      focus: 'test',
      zones: ['high'],
      totaalMin: 60,
      structuur: [
        ['Warmup', '20 min', wattsRange(ftp, 55, 80), bpmBelow(lthr, 95), 'Progressief + 3x 1min openers + 1x 5min @ 95%'],
        ['Rust',   '5 min', wattsRange(ftp, 40, 55), '—', 'Spinnen, voorbereid'],
        ['20-MIN ALL-OUT', '20 min', '> ' + watts(ftp, 95) + 'W', bpmRange(lthr, 98, 105), 'Maximaal duurzaam — pacing is alles'],
        ['Cooldown', '15 min', wattsRange(ftp, 40, 55), '—', 'Easy uit']
      ],
      tss: 105,
      eindopmerking: 'Nieuwe FTP = 95% van gemiddeld vermogen over de 20 min. Vul in op Instellingen.'
    };
  }

  return null;
}
