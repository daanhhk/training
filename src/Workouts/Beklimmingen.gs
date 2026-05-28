/**
 * Workouts/Beklimmingen.gs — Beklimmingen-doel workout library.
 *
 * Lange Sweet Spot, low-cadence kracht-uithouding, big gear, bergsimulatie
 * en de manuele klim PR-poging test.
 */

/**
 * Variant-pool voor Beklimmingen hoofdtype 'klim' (zone: high).
 * Lange sweet spot, low-cadence, big gear, bergsimulatie.
 */
function climbPools_() {
  return {
    klim: [
      { id: 'klim_ss_lang', naam: 'Klim Sweet Spot lang 2×25', zone: 'high', warmup: 15, cooldown: 10,
        blocks: function (a) { return [{ kind: 'int', label: 'SS lang', reps: 2, onMin: 25, onPct: a(89), offMin: 6, offPct: 50 }]; },
        tip: 'Lange sweet spot — uren in de klim-zone kunnen blijven.' },
      { id: 'klim_lowcad', naam: 'Klim Low-cadence 4×10 @60rpm', zone: 'high', warmup: 15, cooldown: 10,
        blocks: function (a) { return [{ kind: 'int', label: 'Low-cad 60rpm', reps: 4, onMin: 10, onPct: a(85), offMin: 5, offPct: 50 }]; },
        tip: 'Lage cadans onder load — kracht-uithouding voor de klim.' },
      { id: 'klim_biggear', naam: 'Klim Big Gear 4×6 @55rpm', zone: 'high', warmup: 15, cooldown: 10,
        blocks: function (a) { return [{ kind: 'int', label: 'Big gear 55rpm', reps: 4, onMin: 6, onPct: a(90), offMin: 5, offPct: 50 }]; },
        tip: 'Big-gear maakt de spier sterker — pas op met de knieën.' },
      { id: 'klim_bergsim', naam: 'Klim Bergsimulatie 35min', zone: 'high', warmup: 15, cooldown: 10,
        blocks: function (a) { return [{ kind: 'steady', label: 'Sustained klim', durMin: 35, pct: a(85) }]; },
        tip: 'Sustained climbing — leer pacen over 30-60 min in klim-zone.' }
    ]
  };
}

function workoutForBeklimmingen(type, mins, settings, mesoWeek, macroFase) {
  var ftp = settings.ftp, lthr = settings.lthr;
  var f = mesoFactor(mesoWeek);

  if (type === 'ss_lang') {
    var reps, len;
    if (macroFase === 'Base')      { reps = 2; len = 25; }
    else if (macroFase === 'Build'){ reps = 2; len = 30; }
    else                            { reps = 1; len = 45; }
    mins = mins || (reps * len + 25);
    var pctLow = macroFase === 'Build' ? 88 : 86;
    var pctHigh = macroFase === 'Build' ? 92 : 90;
    return {
      naam: 'Sweet Spot Lang ' + reps + 'x' + len + ' (Beklim/' + macroFase + ')',
      focus: 'climbing endurance',
      zones: ['high'],
      totaalMin: mins,
      structuur: [
        ['Warmup', '15 min', wattsRange(ftp, 55, 70), bpmBelow(lthr, 88), 'Inrijden'],
        ['SS lang', reps + 'x ' + len + ' min',
          wattsRange(ftp, Math.round(pctLow * f), Math.round(pctHigh * f)),
          bpmRange(lthr, 92, 98),
          '6 min rust tussen reps — simuleert lange klim'],
        ['Cooldown', '10 min', wattsRange(ftp, 45, 55), '—', 'Easy']
      ],
      tss: Math.round(mins * 0.95),
      eindopmerking: 'Lange Sweet Spot reps trainen het vermogen om uren in de klim-zone te blijven.'
    };
  }

  if (type === 'low_cad') {
    var reps2, len2, rpm;
    if (macroFase === 'Base')      { reps2 = 3; len2 = 10; rpm = '65 rpm'; }
    else if (macroFase === 'Build'){ reps2 = 4; len2 = 10; rpm = '60 rpm'; }
    else                            { reps2 = 4; len2 = 12; rpm = '55-60 rpm'; }
    mins = mins || (reps2 * len2 + 25);
    var pctLow = macroFase === 'Build' ? 82 : 78;
    var pctHigh = macroFase === 'Build' ? 87 : 82;
    return {
      naam: 'Low Cadence ' + reps2 + 'x' + len2 + ' @ ' + rpm + ' (Beklim/' + macroFase + ')',
      focus: 'force-endurance',
      zones: ['high'],
      totaalMin: mins,
      structuur: [
        ['Warmup', '15 min', wattsRange(ftp, 55, 70), bpmBelow(lthr, 85), 'Inrijden op normale cadans'],
        ['Low-cad', reps2 + 'x ' + len2 + ' min @ ' + rpm,
          wattsRange(ftp, Math.round(pctLow * f), Math.round(pctHigh * f)),
          bpmRange(lthr, 88, 95),
          'Druk laag houden, focus op zware halen — buitendijks of zwaar verzet binnen'],
        ['Cooldown', '10 min', wattsRange(ftp, 45, 55), '90+ rpm', 'Soepel uit']
      ],
      tss: Math.round(mins * 0.85),
      eindopmerking: 'Lage cadans onder load mimicriek de klim — bouwt kracht-uithouding in de benen.'
    };
  }

  if (type === 'big_gear') {
    var reps3 = 4;
    mins = mins || (reps3 * 6 + 25);
    return {
      naam: 'Big Gear ' + reps3 + 'x6 @ 55-60rpm (Beklim/' + macroFase + ')',
      focus: 'max force',
      zones: ['high'],
      totaalMin: mins,
      structuur: [
        ['Warmup', '15 min', wattsRange(ftp, 55, 70), bpmBelow(lthr, 85), 'Inrijden + 2x 30s big-gear opstart'],
        ['Big gear', reps3 + 'x 6 min @ 55-60 rpm',
          wattsRange(ftp, Math.round(88 * f), Math.round(92 * f)),
          bpmRange(lthr, 88, 95),
          '5 min spinnen rust @ 90+ rpm tussen reps'],
        ['Cooldown', '10 min', wattsRange(ftp, 45, 55), '—', 'Easy']
      ],
      tss: Math.round(mins * 0.85),
      eindopmerking: 'Big-gear werk maakt de spier sterker zonder cardio te belasten — pas op met de knieën.'
    };
  }

  if (type === 'bergsim') {
    var len3 = macroFase === 'Peak' ? 50 : 35;
    mins = mins || (len3 + 30);
    var pctLow = 82, pctHigh = 90;
    return {
      naam: 'Bergsimulatie ' + len3 + ' min (Beklim/' + macroFase + ')',
      focus: 'sustained climb',
      zones: ['high'],
      totaalMin: mins,
      structuur: [
        ['Warmup', '15 min', wattsRange(ftp, 55, 75), bpmBelow(lthr, 90), 'Inrijden + 1x 3min @ 85%'],
        ['Klim', len3 + ' min',
          wattsRange(ftp, Math.round(pctLow * f), Math.round(pctHigh * f)),
          bpmRange(lthr, 90, 98),
          'Continu zonder pauzes — pacing als bij een echte klim. Wissel zit/dans.'],
        ['Cooldown', '10 min', wattsRange(ftp, 45, 55), '—', 'Easy']
      ],
      tss: Math.round(mins * 1.0),
      eindopmerking: 'Sustained climbing — leert pacen over 30-60 min in klim-zone.'
    };
  }

  if (type === 'test') {
    return {
      naam: 'Klim PR-poging (manueel)',
      focus: 'test',
      zones: ['high'],
      totaalMin: 90,
      structuur: [
        ['Aanrijden', '30 min', wattsRange(ftp, 55, 75), bpmBelow(lthr, 90), 'Naar de klim toe + 2x 1min openers'],
        ['KLIM', '15-45 min', '> ' + watts(ftp, 88) + 'W', bpmRange(lthr, 95, 105), 'All-out op je favoriete klim — Strava segment of GPS markering'],
        ['Cooldown', '20 min', wattsRange(ftp, 45, 60), '—', 'Easy terug']
      ],
      tss: 95,
      eindopmerking: 'Vergelijk tijd + gemiddeld vermogen met vorige pogingen. Klim moet je kennen.'
    };
  }

  return null;
}
