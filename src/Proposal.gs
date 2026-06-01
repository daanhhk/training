/**
 * Proposal.gs — Tab "Voorstel".
 *
 * Rendert het wekelijkse trainingsvoorstel: header (doel + macro-week
 * + fase + meso-week), dekking-banner, per-dag workout-blokken,
 * en weektotaal + Garmin Training Status heuristic.
 */

var PROPOSAL_SHEET = 'Voorstel';

function renderProposal(ss, days, voltooid, missed, settings, mesoWeek, macro, dekking, wellness, feedback) {
  var sh = getOrCreateSheet(ss, PROPOSAL_SHEET);
  var r = 1;
  var COLS = 5;

  // ── Header ──
  var headerWeek = macro.eventDriven
    ? macro.fase + ' fase (event-driven)'
    : 'Week ' + macro.week + ' van ' + settings.doelDuur + ' — ' + macro.fase + ' fase';
  sh.getRange(r, 1, 1, COLS).merge()
    .setValue('🚴  Voorstel — ' + settings.doel + ' — ' + headerWeek)
    .setFontWeight('bold').setFontSize(14)
    .setBackground('#111827').setFontColor('#ffffff')
    .setHorizontalAlignment('left').setVerticalAlignment('middle');
  sh.setRowHeight(r, 34);
  r += 2;

  // ── Recovery-week banner (na A-race) ──
  if (macro.isRecovery) {
    sh.getRange(r, 1, 1, COLS).merge()
      .setValue('🌿  Recovery-week na A-race' + (macro.eventName ? ' (' + macro.eventName + ')' : '') +
                ' — alles easy Z2, laat het lichaam aanpassen.')
      .setBackground('#dcfce7').setFontWeight('bold').setFontColor('#166534').setWrap(true);
    r += 2;
  } else if (macro.eventDate) {
    // ── Event countdown banner (event-driven periodisering) ──
    var today0 = new Date(); today0.setHours(0, 0, 0, 0);
    var ev0 = new Date(macro.eventDate.getFullYear(), macro.eventDate.getMonth(), macro.eventDate.getDate());
    var dagenTot = Math.round((ev0 - today0) / (24 * 60 * 60 * 1000));
    var evNaam = macro.eventName || 'Doel-event';
    var ev = macro.hoofdEvent || {};
    var profiel = (ev.afstandKm ? ev.afstandKm + 'km' : '?km') + ' / ' +
                  (ev.hm ? ev.hm + 'hm' : '?hm') + ', ' + (ev.klimType || 'vlak') + ' klimmen';

    if (dagenTot < 0) {
      sh.getRange(r, 1, 1, COLS).merge()
        .setValue('🎯  ' + evNaam + ' is voorbij — terug naar vaste mesocyclus.')
        .setBackground('#e5e7eb').setFontStyle('italic');
      r += 1;
    } else {
      var faseUitleg = (typeof MACRO_UITLEG !== 'undefined' && MACRO_UITLEG[macro.fase]) || '';
      sh.getRange(r, 1, 1, COLS).merge()
        .setValue('🎯  ' + evNaam + ' over ' + dagenTot + ' dagen — ' + profiel +
                  ' — fase: ' + macro.fase + '. ' + faseUitleg + '.')
        .setBackground('#ede9fe').setFontWeight('bold').setWrap(true);
      r += 1;

      if (macro.wekenTotEvent != null && macro.wekenTotEvent <= 2 && !macro.isTaper) {
        sh.getRange(r, 1, 1, COLS).merge()
          .setValue('⚠️  <2 weken tot event: fitness is gemaakt. Nu fris worden, niet meer opbouwen.')
          .setBackground('#fef3c7').setFontStyle('italic').setFontColor('#92400e').setWrap(true);
        r += 1;
      }
      if (macro.isTaper) {
        sh.getRange(r, 1, 1, COLS).merge()
          .setValue('🪶  Taper-week: volume gehalveerd, één korte openers-sessie voor scherpte. Kom fris aan de start.')
          .setBackground('#f5f3ff').setFontStyle('italic').setFontColor('#5b21b6').setWrap(true);
        r += 1;
      }
    }
    r += 1;
  }

  // ── B/C-races deze week (mini-taper / training-race) ──
  var bcRaces = bcRacesThisWeek_(days);
  bcRaces.forEach(function (race) {
    sh.getRange(r, 1, 1, COLS).merge()
      .setValue('🏁  ' + formatDate(race.datum, 'EEE dd-MM') + ' — ' + race.naam +
                ' (' + race.type + ', prio ' + race.prioriteit + '): ' +
                (race.prioriteit === 'B' ? 'mini-taper, ga met frisse benen' : 'training-race, gewoon doorrijden') + '.')
      .setBackground('#fef9c3').setFontStyle('italic').setWrap(true);
    r += 1;
  });
  if (bcRaces.length) r += 1;

  // Mesocyclus regel
  sh.getRange(r, 1, 1, COLS).merge()
    .setValue('Mesocyclus week ' + mesoWeek + ' van 4   ·   load factor ' + mesoFactor(mesoWeek).toFixed(2) + '×' +
              (mesoWeek === 4 ? '   ·   RECOVERY WEEK' : ''))
    .setBackground(mesoWeek === 4 ? '#fef3c7' : '#e5e7eb')
    .setFontStyle('italic').setFontColor('#374151');
  r += 1;

  // Dekking banner
  var icon = function (ok) { return ok ? '✅' : '⬜'; };
  var dekText = 'Load focus dekking deze week:   ' +
    icon(dekking.low)       + ' Low   ' +
    icon(dekking.high)      + ' High   ' +
    icon(dekking.anaerobic) + ' Anaerobic';
  sh.getRange(r, 1, 1, COLS).merge()
    .setValue(dekText)
    .setBackground('#e0f2fe').setFontWeight('bold');
  r += 1;

  if (mesoWeek === 4) {
    sh.getRange(r, 1, 1, COLS).merge()
      .setValue('⚠️  Recovery week — alle workouts zijn lichter. Druk je niet bij de wedstrijd-zone, herstel is training.')
      .setBackground('#fef3c7').setFontStyle('italic');
    r += 1;
  }
  if (macro.isTestWeek) {
    sh.getRange(r, 1, 1, COLS).merge()
      .setValue('🧪  Test week — je krijgt deze week 1 test-workout. Vul resultaten in op Instellingen.')
      .setBackground('#ede9fe').setFontStyle('italic');
    r += 1;
  }

  // Wellness banner
  if (wellness) {
    var wText, wBg, wFg;
    var diag = wellness.hrvRecent != null
      ? 'HRV ' + wellness.hrvRecent + '/' + wellness.hrvBaseline + ' (' +
        (wellness.hrvDeficit != null ? (wellness.hrvDeficit > 0 ? '+' : '') + wellness.hrvDeficit + '%' : 'n/a') +
        ')   slaap ' + (wellness.sleepLastNight != null ? wellness.sleepLastNight + 'u' : 'n/a')
      : 'geen wellness data';

    if (wellness.signal === 'recovery') {
      wText = '🛑  Wellness: ' + wellness.reason + ' — ALLE workouts → recovery.   (' + diag + ')';
      wBg = '#fee2e2'; wFg = '#991b1b';
    } else if (wellness.signal === 'demote') {
      wText = '⚠️  Wellness: ' + wellness.reason + ' — intensiteit gedemoot.   (' + diag + ')';
      wBg = '#fef3c7'; wFg = '#92400e';
    } else if (wellness.signal === 'warning') {
      wText = '🟡  Wellness: ' + wellness.reason + ' — geen demotie maar let op herstel.   (' + diag + ')';
      wBg = '#fefce8'; wFg = '#854d0e';
    } else {
      wText = '✅  Wellness: ' + wellness.reason + ' — geen aanpassingen.   (' + diag + ')';
      wBg = '#dcfce7'; wFg = '#166534';
    }
    sh.getRange(r, 1, 1, COLS).merge()
      .setValue(wText)
      .setBackground(wBg).setFontColor(wFg).setFontWeight('bold').setWrap(true);
    r += 1;
  }

  // ── Feedback op voltooide trainingen (DEEL 4) ──
  if (feedback && feedback.hasPlan && feedback.details && feedback.details.length) {
    sh.getRange(r, 1, 1, COLS).merge()
      .setValue('📊  Feedback op voltooide trainingen (gepland vs werkelijk)')
      .setFontWeight('bold').setBackground('#1f2937').setFontColor('#ffffff');
    r += 1;

    feedback.details.forEach(function (det) {
      var dayLabel = det.dag;
      if (!det.hasData) {
        sh.getRange(r, 1, 1, COLS).merge()
          .setValue(dayLabel + ' — ' + det.type + ': geen zone-data, aangenomen volgens plan')
          .setFontStyle('italic').setFontColor('#6b7280').setBackground('#f3f4f6').setWrap(true);
        r += 1;
        return;
      }
      var intent = det.intent || {};
      var pb = 'low', pbVal = -1;
      ['low', 'high', 'anaerobic'].forEach(function (b) {
        if ((intent[b] || 0) > pbVal) { pbVal = intent[b] || 0; pb = b; }
      });
      var planned = Math.round(intent[pb] || 0);
      var act = Math.round((det.actual && det.actual[pb]) || 0);
      var diff = act - planned;
      var mark, bg;
      if (diff <= -5)      { mark = '⚠️ ' + diff + 'min'; bg = '#fef3c7'; }
      else if (diff >= 5)  { mark = '↑ +' + diff + 'min'; bg = '#dcfce7'; }
      else                 { mark = '✅'; bg = '#f0fdf4'; }
      var srcTag = (det.source === 'hr') ? ' (via HR)' : '';
      sh.getRange(r, 1, 1, COLS).merge()
        .setValue(dayLabel + ' — ' + det.type + ' gepland (' + pb + ' ' + planned + 'min) → werkelijk ' + act + 'min' + srcTag + '  ' + mark)
        .setBackground(bg).setWrap(true);
      r += 1;
    });

    // Samenvatting netto debt + compensatie
    var debt = feedback.debt || { low: 0, high: 0, anaerobic: 0 };
    var parts = [];
    ['low', 'high', 'anaerobic'].forEach(function (b) {
      if (debt[b] > 0) parts.push(b + ' -' + debt[b] + 'min tekort');
      else if (debt[b] < 0) parts.push(b + ' +' + (-debt[b]) + 'min over');
    });
    var sumText;
    if (!parts.length) {
      sumText = 'Netto: alles op schema ✅';
    } else if (macro.isTaper || macro.isRecovery) {
      sumText = 'Netto debt: ' + parts.join(' · ') + '   |   taper/recovery — niet gecompenseerd (herstel gaat voor).';
    } else {
      // Pass 1: train=true resterende dagen die bucket matchen.
      var resterend = days.filter(function (d) { return d.train && !d.gedaan && d.voorgesteldType; });
      var hasRemaining = resterend.length > 0;

      var comp = [];
      var covered = {};
      ['anaerobic', 'high', 'low'].forEach(function (b) {
        if (debt[b] <= 0) return;
        var match = null;
        resterend.forEach(function (d) {
          if (match) return;
          if (typeBucket_(d.voorgesteldType, settings.doel) === b) match = d;
        });
        if (match) {
          comp.push('→ ' + match.dag + ' (' + match.voorgesteldType + ') compenseert ' + b);
          covered[b] = true;
        }
      });

      // Vrije dagen deze week (train=false, datum ≥ vandaag).
      var fbToday = new Date(); fbToday.setHours(0, 0, 0, 0);
      var vrijeDagen = days.filter(function (d) {
        if (d.train || !d.datum) return false;
        var dd = new Date(d.datum.getFullYear(), d.datum.getMonth(), d.datum.getDate());
        return dd >= fbToday;
      });

      // Pass 2: 💡-suggesties voor open buckets op vrije dagen.
      // Wellness-gate: alleen bij signal==='normal' (zelfde principe als volume-advies).
      var suggesties = [];
      var suggBuckets = {};
      if (vrijeDagen.length && wellness && wellness.signal === 'normal') {
        var openBuckets = ['high', 'anaerobic', 'low'].filter(function (b) {
          return debt[b] > 0 && !covered[b];
        });
        vrijeDagen.forEach(function (vd) {
          if (!openBuckets.length) return;
          // Pak de bucket met de grootste nog-open debt.
          var best = null, bestVal = 0;
          openBuckets.forEach(function (b) {
            var remaining = debt[b] - (suggBuckets[b] || 0);
            if (remaining > bestVal) { bestVal = remaining; best = b; }
          });
          if (!best) return;
          var rawMin = Math.min(SUGGESTIE_MAX_MIN, debt[best] - (suggBuckets[best] || 0));
          // 15-min-stappen, nearest (matcht verificatie-voorbeeld 32→30 i.p.v. 45).
          var n = Math.round(rawMin / 15) * 15;
          if (n < SUGGESTIE_MIN_MIN) return;
          suggBuckets[best] = (suggBuckets[best] || 0) + n;
          var typeStr = best === 'low'  ? 'rustige Z2-rit'
                       : best === 'high' ? 'tempo of sweet spot rit'
                                         : 'korte VO2-sessie met 4-6 intervallen';
          suggesties.push({ dag: vd.dag, bucket: best, min: n, type: typeStr, totaalDebt: debt[best] });
          if (suggBuckets[best] >= debt[best]) {
            openBuckets = openBuckets.filter(function (b) { return b !== best; });
          }
        });
      }

      // Pass 3: uncomp = niet gedekt door pass-1 én niet door pass-2.
      var uncomp = [];
      ['high', 'anaerobic', 'low'].forEach(function (b) {
        if (debt[b] > 0 && !covered[b] && !suggBuckets[b]) uncomp.push(b + ' -' + debt[b] + 'min');
      });

      sumText = 'Netto debt: ' + parts.join(' · ');
      if (comp.length) sumText += '   |   ' + comp.join(', ');
      if (uncomp.length) {
        // "Week voorbij" alleen als ECHT geen dagen over (geen train=true resterend ÉN geen vrije dagen).
        var noDaysLeft = !hasRemaining && vrijeDagen.length === 0;
        sumText += '   |   ' + uncomp.join(', ') +
          (noDaysLeft
            ? ': week voorbij, niet meer compenseerbaar'
            : ': niet gecompenseerd in huidige plan');
      }
    }
    sh.getRange(r, 1, 1, COLS).merge()
      .setValue('Σ  ' + sumText)
      .setFontStyle('italic').setFontColor('#374151').setBackground('#e0f2fe').setWrap(true);
    r += 1;

    // 💡-suggestie-regels (één per vrije dag met geadviseerde compensatie).
    if (typeof suggesties !== 'undefined' && suggesties.length) {
      suggesties.forEach(function (s) {
        sh.getRange(r, 1, 1, COLS).merge()
          .setValue('💡  ' + s.dag + ' is vrij — overweeg ~' + s.min + ' min ' + s.type +
                    ' om ' + s.bucket + ' (' + s.totaalDebt + 'min) bij te trekken.')
          .setBackground('#e0f2fe').setFontStyle('italic').setFontColor('#075985').setWrap(true);
        r += 1;
      });
    }
    r += 1;
  }

  // Gemiste dagen — 1-regel notitie per dag
  if (missed && missed.length) {
    missed.forEach(function (d) {
      var dateStr = d.datum ? formatDate(d.datum, 'EEE dd-MM') : '';
      sh.getRange(r, 1, 1, COLS).merge()
        .setValue('❌  ' + d.dag + ' ' + dateStr + ': gepland maar niet gedaan — zone-dekking herverdeeld.')
        .setBackground('#fef2f2').setFontColor('#b91c1c').setFontStyle('italic');
      r += 1;
    });
  }
  r += 1;

  // ── Per dag ──
  var missedIdxSet = {};
  (missed || []).forEach(function (m) { missedIdxSet[m.dagIdx] = true; });

  var eventCtx = eventContextFrom_(macro);
  var actByDate = cyclingActivitiesByDate_(weekStartDate(new Date()));
  var totalTss = 0, totalMin = 0;
  days.forEach(function (d) {
    if (missedIdxSet[d.dagIdx]) return; // al getoond in missed-banner

    var dISO = d.datum ? formatDate(d.datum, 'yyyy-MM-dd') : null;
    var dayActs = dISO ? actByDate[dISO] : null;
    // Render train-dagen, én niet-geplande dagen mét een gematchte rit.
    if (!d.train && !(dayActs && dayActs.length)) return;

    var wo = d.voorgesteldType
      ? buildWorkout(d.voorgesteldType, d.minuten, settings, mesoWeek, macro.fase, eventCtx, d.dagIdx)
      : null;

    // Aggregeer eventueel gematchte fiets-activities van die dag.
    var actInfo = null;
    if (dayActs && dayActs.length) {
      var totMin = 0;
      dayActs.forEach(function (a) { totMin += a.min; });
      var nm = (dayActs.length === 1)
        ? truncate_(dayActs[0].name, 50)
        : truncate_(dayActs[0].name, 40) + ' (+' + (dayActs.length - 1) + ')';
      actInfo = { naam: nm, min: totMin };
    }

    // Render-mode (zie commit-message): waarheid is d.train (kol A), niet wo.
    //   'workout'   = wo aanwezig → volle structuur-rendering
    //   'planned'   = train=true zonder wo → fallback uit planner-data
    //                 (typisch voor reeds-gedane dagen; kol G is dan leeg)
    //   'unplanned' = train=false mét gematchte rit → "Ongepland-maar-gefietst"
    var mode = wo ? 'workout' : (d.train ? 'planned' : 'unplanned');

    // Day header
    var dateStr = d.datum ? formatDate(d.datum, 'EEE dd-MM') : '';
    var statusStr = d.gedaan ? '   ✅ GEDAAN' : '';
    var nameStr;
    if (mode === 'workout') {
      nameStr = wo.naam;
    } else if (mode === 'planned') {
      var typeName = capitalize_(d.type || 'Training');
      nameStr = typeName + (d.minuten ? ' (' + d.minuten + 'min)' : '');
      if (actInfo) nameStr += ' — ' + actInfo.naam;
    } else { // unplanned
      nameStr = actInfo.naam + ' (' + actInfo.min + 'min)';
    }

    sh.getRange(r, 1, 1, COLS).merge()
      .setValue(d.dag + '   ·   ' + dateStr + '   ·   ' + nameStr + statusStr)
      .setFontWeight('bold').setFontSize(12)
      .setBackground(d.gedaan ? '#d1d5db' : '#374151')
      .setFontColor('#ffffff')
      .setHorizontalAlignment('left').setVerticalAlignment('middle');
    sh.setRowHeight(r, 28);
    r += 1;

    if (mode === 'planned') {
      // Sub-regel uit toelichting (kol F) + eventueel activity-info.
      var sub = d.notitie || '';
      if (actInfo) {
        var extra = actInfo.naam + ' (' + actInfo.min + 'min)';
        sub = sub ? (sub + '   ·   ' + extra) : extra;
      }
      if (!sub) sub = '(geen toelichting)';
      sh.getRange(r, 1, 1, COLS).merge()
        .setValue(sub)
        .setFontStyle('italic').setFontColor('#374151').setBackground('#f3f4f6').setWrap(true);
      r += 2;
      return;
    }

    if (mode === 'unplanned') {
      sh.getRange(r, 1, 1, COLS).merge()
        .setValue('Ongepland — wel gefietst, telt mee in week-volume.')
        .setFontStyle('italic').setFontColor('#6b7280');
      r += 2;
      return;
    }

    // Focus + duur + TSS regel
    sh.getRange(r, 1, 1, COLS).merge()
      .setValue('Focus: ' + wo.focus + '   ·   Duur: ' + wo.totaalMin + ' min   ·   TSS: ' + wo.tss +
                '   ·   Dekking: ' + (wo.zones || []).join(', '))
      .setBackground('#f3f4f6').setFontColor('#374151').setFontStyle('italic');
    r += 1;

    // tooLong-waarschuwing: workout-template paste niet binnen d.minuten.
    if (wo.tooLong) {
      sh.getRange(r, 1, 1, COLS).merge()
        .setValue('⚠️  Workout vereist meer tijd dan beschikbaar (gepland ' + wo.tooLong.needed +
                  'min, beschikbaar ' + wo.tooLong.available + 'min). Overweeg langere beschikbaarheid of korter workout-type.')
        .setBackground('#fef3c7').setFontColor('#92400e').setFontStyle('italic').setWrap(true);
      r += 1;
    }

    // Structuur header
    sh.getRange(r, 1, 1, COLS).setValues([['Segment', 'Duur', 'Vermogen', 'Hartslag', 'Toelichting']])
      .setFontWeight('bold').setBackground('#e5e7eb');
    r += 1;

    // Structuur rows
    var structRows = wo.structuur || [];
    if (structRows.length) {
      sh.getRange(r, 1, structRows.length, 5).setValues(structRows);
      sh.getRange(r, 5, structRows.length, 1).setWrap(true);
      r += structRows.length;
    }

    // Eindopmerking
    if (wo.eindopmerking) {
      sh.getRange(r, 1, 1, COLS).merge()
        .setValue('💡  ' + wo.eindopmerking)
        .setFontStyle('italic').setFontColor('#1e40af').setWrap(true);
      r += 1;
    }
    r += 1;

    totalTss += wo.tss || 0;
    totalMin += wo.totaalMin || 0;
  });

  // ── Weektotaal + Garmin heuristic ──
  sh.getRange(r, 1, 1, COLS).merge()
    .setValue('Week totaal')
    .setFontWeight('bold').setBackground('#1f2937').setFontColor('#ffffff');
  r += 1;
  sh.getRange(r, 1).setValue('Totaal TSS:').setFontWeight('bold');
  sh.getRange(r, 2).setValue(totalTss);
  r += 1;
  // Week-volume: één bron van waarheid (actuals + intent toekomst), incl.
  // ritten zonder Weekplanner-intent. Vervangt de loop-som over train-rijen.
  var weekVolMin = computeWeekVolumeMin_(ss, weekStartDate(new Date()));
  sh.getRange(r, 1).setValue('Totaal tijd:').setFontWeight('bold');
  var tijdStr = Math.floor(weekVolMin / 60) + 'u ' + (weekVolMin % 60) + 'm';
  var volTarget = getVolumeTargets()[macro.fase];
  if (volTarget) tijdStr += '   ·   richting ' + macro.fase + ': ' + volTarget[0] + '-' + volTarget[1] + 'u';
  sh.getRange(r, 2, 1, 4).merge().setValue(tijdStr);
  r += 1;
  sh.getRange(r, 1).setValue('Verwachte Garmin status:').setFontWeight('bold');
  sh.getRange(r, 2, 1, 4).merge().setValue(garminHeuristic(totalTss, mesoWeek, macro.fase))
    .setFontStyle('italic').setWrap(true);
  r += 1;

  // ── DEEL 2 — Volume-advies (informatief, conditioneel) ──
  var totalUur = weekVolMin / 60;
  if (volTarget && totalUur < volTarget[0] && wellness && wellness.signal === 'normal') {
    var tekortMin = Math.round((volTarget[0] - totalUur) * 60);
    if (tekortMin >= VOLUME_ADVIES_MIN_TEKORT) {
      var vToday = new Date(); vToday.setHours(0, 0, 0, 0);
      var vrij = null;
      days.forEach(function (d) {
        if (vrij || !d.datum) return;
        var dd = new Date(d.datum.getFullYear(), d.datum.getMonth(), d.datum.getDate());
        if (dd < vToday) return;
        if (d.train === false || !d.type) vrij = d;
      });
      if (vrij) {
        var sugg = Math.round(Math.min(tekortMin, VOLUME_ADVIES_MAX_SUGGESTIE) / 15) * 15;
        sh.getRange(r, 1, 1, COLS).merge()
          .setValue('💡  Plan is ' + totalUur.toFixed(1) + 'u — onder dosering voor ' + macro.fase +
            '-fase (richting ' + volTarget[0] + '-' + volTarget[1] + 'u). ' + vrij.dag +
            ' is nog vrij, overweeg ' + sugg + ' min rustige Z2-rit toe te voegen.')
          .setBackground('#e0f2fe').setFontStyle('italic').setFontColor('#075985').setWrap(true);
        r += 1;
      }
    }
  }

  SpreadsheetApp.flush();
  sh.setColumnWidth(1, 150);
  sh.setColumnWidth(2, 110);
  sh.setColumnWidth(3, 160);
  sh.setColumnWidth(4, 140);
  sh.setColumnWidth(5, 400);
  sh.setFrozenRows(1);
}

/** Kapt een string af op n chars met ellipsis. */
function truncate_(s, n) {
  s = String(s || '');
  return s.length > n ? s.substring(0, n - 1) + '…' : s;
}

/** Eerste letter hoofdletter, rest unchanged. */
function capitalize_(s) {
  s = String(s || '');
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/**
 * B/C-races die binnen de huidige week vallen (mini-taper / training-race).
 */
function bcRacesThisWeek_(days) {
  var ws = weekStartDate(new Date());
  var weekEnd = new Date(ws.getTime() + 7 * 24 * 60 * 60 * 1000);
  return getAllEvents_().filter(function (e) {
    if (e.prioriteit !== 'B' && e.prioriteit !== 'C') return false;
    var ed = new Date(e.datum.getFullYear(), e.datum.getMonth(), e.datum.getDate());
    return ed >= ws && ed < weekEnd;
  });
}

/**
 * Heuristic — zonder echte CTL-data inschatting op basis van weektotaal TSS,
 * mesoWeek en macroFase. Drempels gekozen voor een 280W FTP cyclist met
 * ongeveer 6-9u/week training.
 */
function garminHeuristic(totalTss, mesoWeek, macroFase) {
  if (mesoWeek === 4) {
    if (totalTss < 200) return 'Recovering / Unproductive → Productive (na herstel)';
    return 'Recovering — load lager dan vorige week is gewenst';
  }
  if (macroFase === 'Test') {
    return 'Maintaining / Peaking — test week, kort en specifiek';
  }
  if (totalTss < 200)      return 'Maintaining / Low load — sub-optimaal voor groei';
  if (totalTss < 350)      return 'Productive — load ligt in groei-zone';
  if (totalTss < 500)      return 'Productive — bovenkant van groei-zone';
  if (totalTss < 650)      return 'Productive (hoog) — let op slaap + voeding';
  return 'Overreaching risk — overweeg of dit duurzaam is';
}
