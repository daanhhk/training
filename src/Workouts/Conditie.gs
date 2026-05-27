/**
 * Workouts/Conditie.gs — Conditie-doel workout library.
 *
 * Lange Z2 (oplopend per fase), tempo, Z2+tempo combo, fat-ox en de
 * 90-min eindtest met laatste 30min tempo.
 */

function workoutForConditie(type, mins, settings, mesoWeek, macroFase) {
  var ftp = settings.ftp, lthr = settings.lthr;
  var f = mesoFactor(mesoWeek);

  if (type === 'long_z2') {
    var target;
    if (macroFase === 'Base')      target = mins || 105;
    else if (macroFase === 'Build')target = mins || 135;
    else                            target = mins || 165;
    target = Math.round(target * mesoFactor(mesoWeek));
    return {
      naam: 'Lange Z2 (' + target + ' min) — Conditie/' + macroFase,
      focus: 'aerobic base',
      zones: ['low'],
      totaalMin: target,
      structuur: [
        ['Warmup', '10 min', wattsRange(ftp, 50, 65), bpmBelow(lthr, 80), 'Rustig opbouwen'],
        ['Z2 hoofd', (target - 15) + ' min', wattsRange(ftp, 68, 75), bpmRange(lthr, 82, 89), 'Stabiel — hartslag drift toelaten'],
        ['Cooldown', '5 min', wattsRange(ftp, 45, 55), '—', 'Easy']
      ],
      tss: Math.round(target * 0.72),
      eindopmerking: 'Lange Z2 is dé motor van conditie — volume bouwt het zuurstof-systeem.'
    };
  }

  if (type === 'tempo') {
    var reps, len;
    if (macroFase === 'Base')      { reps = 2; len = 20; }
    else if (macroFase === 'Build'){ reps = 3; len = 20; }
    else                            { reps = 3; len = 25; }
    mins = mins || (reps * len + 25);
    var pctLow = macroFase === 'Peak' ? 80 : 76;
    var pctHigh = macroFase === 'Peak' ? 85 : 82;
    return {
      naam: 'Tempo ' + reps + 'x' + len + ' (Conditie/' + macroFase + ')',
      focus: 'tempo',
      zones: ['high'],
      totaalMin: mins,
      structuur: [
        ['Warmup', '15 min', wattsRange(ftp, 55, 70), bpmBelow(lthr, 85), 'Inrijden'],
        ['Tempo', reps + 'x ' + len + ' min',
          wattsRange(ftp, Math.round(pctLow * f), Math.round(pctHigh * f)),
          bpmRange(lthr, 88, 94),
          '4 min rust tussen reps'],
        ['Cooldown', '10 min', wattsRange(ftp, 45, 55), '—', 'Easy']
      ],
      tss: Math.round(mins * 0.85),
      eindopmerking: 'Tempo verlegt de aerobic-anaerobic grens — sub-threshold maar duurzaam.'
    };
  }

  if (type === 'combo_z2_tempo') {
    mins = mins || 100;
    return {
      naam: 'Z2 + Tempo combo (' + mins + ' min) — Conditie',
      focus: 'aerobic + tempo',
      zones: ['low', 'high'],
      totaalMin: mins,
      structuur: [
        ['Warmup', '10 min', wattsRange(ftp, 55, 70), bpmBelow(lthr, 85), 'Inrijden'],
        ['Z2',     '40 min', wattsRange(ftp, 68, 75), bpmRange(lthr, 82, 89), 'Stabiele base'],
        ['Tempo',  '3x 10min', wattsRange(ftp, Math.round(78 * f), Math.round(85 * f)),
          bpmRange(lthr, 88, 94), '5 min Z2 rust tussen reps'],
        ['Cooldown', '10 min', wattsRange(ftp, 45, 55), '—', 'Easy']
      ],
      tss: Math.round(mins * 0.85),
      eindopmerking: 'Lange rit met tempo blokken erin — efficient voor Conditie/Build.'
    };
  }

  if (type === 'fatox') {
    mins = mins || 90;
    return {
      naam: 'Fat-ox nuchter (' + mins + ' min)',
      focus: 'metabolic',
      zones: ['low'],
      totaalMin: mins,
      structuur: [
        ['Warmup', '10 min', wattsRange(ftp, 45, 60), bpmBelow(lthr, 78), 'Heel rustig op'],
        ['Z1-Z2', (mins - 15) + ' min', wattsRange(ftp, 55, 68), bpmRange(lthr, 75, 84), 'Geen koolhydraten — alleen water'],
        ['Cooldown', '5 min', wattsRange(ftp, 45, 55), '—', 'Easy']
      ],
      tss: Math.round(mins * 0.55),
      eindopmerking: 'Nuchter Z1-Z2 traint vetverbranding — niet pushen, ook al voelt het licht.'
    };
  }

  if (type === 'test') {
    return {
      naam: '90-min Conditie Test',
      focus: 'test',
      zones: ['low', 'high'],
      totaalMin: 90,
      structuur: [
        ['Warmup', '10 min', wattsRange(ftp, 55, 70), bpmBelow(lthr, 85), 'Inrijden'],
        ['Z2 base', '50 min', wattsRange(ftp, 68, 75), bpmRange(lthr, 82, 89), 'Stabiel — geen drift'],
        ['Tempo finale', '30 min', wattsRange(ftp, 78, 85), bpmRange(lthr, 88, 94), 'Houden — dit is de test'],
        ['Cooldown', 'rest', wattsRange(ftp, 45, 55), '—', 'Easy uit']
      ],
      tss: 100,
      eindopmerking: 'Kijk naar HR-drift in de tempo finale — bij goede conditie blijft HR stabiel.'
    };
  }

  return null;
}
