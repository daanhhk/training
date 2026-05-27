/**
 * Workouts/Vo2max.gs — VO2max-doel workout library.
 *
 * Korte/medium/lange VO2-intervallen, 30/15s, microbursts en 5-min test.
 */

function workoutForVo2max(type, mins, settings, mesoWeek, macroFase) {
  var ftp = settings.ftp, lthr = settings.lthr;
  var f = mesoFactor(mesoWeek);

  if (type === 'vo2_short') {
    mins = mins || 60;
    return {
      naam: 'VO2 Short 4x3min (' + macroFase + ')',
      focus: 'VO2 introductie',
      zones: ['anaerobic'],
      totaalMin: mins,
      structuur: [
        ['Warmup', '15 min', wattsRange(ftp, 55, 80), bpmBelow(lthr, 92), 'Progressief + 3x 1min @ 110%'],
        ['VO2', '4x 3 min', wattsRange(ftp, Math.round(106 * f), Math.round(110 * f)),
          bpmRange(lthr, 100, 106), '3 min rust @ 50% tussen reps'],
        ['Cooldown', '12 min', wattsRange(ftp, 45, 55), '—', 'Easy']
      ],
      tss: Math.round(mins * 1.0),
      eindopmerking: 'Korte VO2 reps — meer power per minuut, minder vermoeidheid dan langere intervallen.'
    };
  }

  if (type === 'vo2_medium') {
    mins = mins || 75;
    return {
      naam: 'VO2 Medium 5x4min (' + macroFase + ')',
      focus: 'VO2 build',
      zones: ['anaerobic'],
      totaalMin: mins,
      structuur: [
        ['Warmup', '18 min', wattsRange(ftp, 55, 80), bpmBelow(lthr, 95), 'Progressief + 3x 1min openers'],
        ['VO2', '5x 4 min', wattsRange(ftp, Math.round(108 * f), Math.round(112 * f)),
          bpmRange(lthr, 100, 108), '4 min rust @ 50%'],
        ['Cooldown', '15 min', wattsRange(ftp, 45, 55), '—', 'Easy']
      ],
      tss: Math.round(mins * 1.1),
      eindopmerking: 'De klassieke VO2max build — 20 min cumulatief in zone.'
    };
  }

  if (type === 'vo2_long') {
    mins = mins || 80;
    return {
      naam: 'VO2 Long 4x5min (' + macroFase + ')',
      focus: 'VO2 peak',
      zones: ['anaerobic'],
      totaalMin: mins,
      structuur: [
        ['Warmup', '20 min', wattsRange(ftp, 55, 85), bpmBelow(lthr, 95), 'Progressief + 3x 1min @ 115%'],
        ['VO2', '4x 5 min', wattsRange(ftp, Math.round(110 * f), Math.round(115 * f)),
          bpmRange(lthr, 102, 108), '5 min rust @ 50%'],
        ['Cooldown', '15 min', wattsRange(ftp, 45, 55), '—', 'Easy']
      ],
      tss: Math.round(mins * 1.15),
      eindopmerking: 'Zwaarste duurzame VO2 stack — diep maar effectief.'
    };
  }

  if (type === 'vo2_3015') {
    mins = mins || 65;
    return {
      naam: 'VO2 30/15s — 2x (8 reps)',
      focus: 'VO2 micro',
      zones: ['anaerobic'],
      totaalMin: mins,
      structuur: [
        ['Warmup', '15 min', wattsRange(ftp, 55, 80), bpmBelow(lthr, 92), 'Progressief'],
        ['Blok 1', '8x 30/15s', '30s @ ' + watts(ftp, 115) + 'W / 15s @ ' + watts(ftp, 50) + 'W',
          bpmRange(lthr, 98, 106), 'Eerste 30s pushen, 15s recovery'],
        ['Rust', '5 min', wattsRange(ftp, 45, 55), '—', 'Volledig herstel'],
        ['Blok 2', '8x 30/15s', '30s @ ' + watts(ftp, 115) + 'W / 15s @ ' + watts(ftp, 50) + 'W',
          bpmRange(lthr, 100, 108), 'Hetzelfde — pacing matters'],
        ['Cooldown', '12 min', wattsRange(ftp, 45, 55), '—', 'Easy']
      ],
      tss: Math.round(mins * 1.1),
      eindopmerking: '30/15s pakt VO2max-zone met minder lactaat dan continue intervallen.'
    };
  }

  if (type === 'microbursts') {
    mins = mins || 60;
    return {
      naam: 'Microbursts 2x (12x 15/15s)',
      focus: 'neuromuscular + VO2',
      zones: ['anaerobic'],
      totaalMin: mins,
      structuur: [
        ['Warmup', '15 min', wattsRange(ftp, 55, 80), bpmBelow(lthr, 92), 'Progressief + 2x 1min openers'],
        ['Blok 1', '12x 15/15s', '15s @ ' + watts(ftp, 130) + 'W / 15s @ ' + watts(ftp, 40) + 'W',
          bpmRange(lthr, 95, 105), 'Snap, snap, snap — neuromusculair'],
        ['Rust', '6 min', wattsRange(ftp, 45, 55), '—', 'Volledig herstel'],
        ['Blok 2', '12x 15/15s', '15s @ ' + watts(ftp, 130) + 'W / 15s @ ' + watts(ftp, 40) + 'W',
          bpmRange(lthr, 98, 108), 'Net zo scherp — let op vorm'],
        ['Cooldown', '10 min', wattsRange(ftp, 45, 55), '—', 'Easy']
      ],
      tss: Math.round(mins * 1.05),
      eindopmerking: 'Microbursts trainen power én aerobic capacity tegelijk.'
    };
  }

  if (type === 'test') {
    return {
      naam: '5-min VO2 Test',
      focus: 'test',
      zones: ['anaerobic'],
      totaalMin: 55,
      structuur: [
        ['Warmup', '20 min', wattsRange(ftp, 55, 85), bpmBelow(lthr, 95), 'Progressief + 3x 1min @ 115% + 1x 2min @ 110%'],
        ['Rust', '5 min', wattsRange(ftp, 40, 55), '—', 'Spinnen, focussen'],
        ['5-MIN ALL-OUT', '5 min', '> ' + watts(ftp, 115) + 'W', bpmRange(lthr, 105, 115), 'Maximaal — pacing: niet uit start, maar opbouwen'],
        ['Cooldown', '20 min', wattsRange(ftp, 40, 55), '—', 'Volledig uit']
      ],
      tss: 75,
      eindopmerking: 'Gemiddeld vermogen over de 5 min is je VO2max referentie.'
    };
  }

  return null;
}
