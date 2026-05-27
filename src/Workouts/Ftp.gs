/**
 * Workouts/Ftp.gs — FTP-doel workout library.
 *
 * Sweet Spot, Threshold, en de 20-min FTP test. Intensiteiten schalen
 * met mesoWeek (1.00/1.08/1.15/0.60) en macroFase (Base/Build/Peak/Test).
 */

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
