/**
 * Test.gs — TIJDELIJKE verificatie-helpers (verwijderbaar).
 *
 * Twee menu-acties om de 3-laags refactor met één klik te checken zonder
 * DocProperty-gefriemel. Alles is non-destructief: variant-state wordt
 * hersteld, en de rollover-test eindigt op de huidige week.
 *
 * VERWIJDEREN: dit hele bestand + de twee "🔧 TEST"-menu-items in Code.gs.
 */

var TEST_TYPE_LABELS = {
  sweet_spot: 'SS',
  threshold:  'THR',
  vo2max:     'VO2',
  conditie:   'COND',
  klim:       'KLIM',
  long_z2:    'Z2',
  tempo:      'TEMPO'
};

/**
 * Toont welke variant elk relevant hoofdtype krijgt over 4 weken.
 * Wijzigt variant_<type> DocProps niet blijvend (save → restore).
 */
function testDiversiteit() {
  var ss = SpreadsheetApp.getActive();
  var ui = SpreadsheetApp.getUi();
  var settings = readSettings(ss);
  var doel = settings.doel;

  // Relevante hoofdtypes voor het huidige doel + generieke types.
  var types = [];
  if (doel === 'FTP')               types = ['sweet_spot', 'threshold'];
  else if (doel === 'VO2max')       types = ['vo2max'];
  else if (doel === 'Conditie')     types = ['conditie'];
  else if (doel === 'Beklimmingen') types = ['klim'];
  types.push('long_z2');
  types.push('tempo');

  var props = PropertiesService.getDocumentProperties();

  // Bewaar huidige variant-state.
  var saved = {};
  types.forEach(function (t) { saved['variant_' + t] = props.getProperty('variant_' + t); });

  var lines = ['Doel: ' + doel + ' — variant-rotatie over 4 weken:', ''];
  for (var w = 0; w < 4; w++) {
    var parts = [];
    types.forEach(function (t) {
      var v = selectVariant_(t, w);
      var label = TEST_TYPE_LABELS[t] || t;
      parts.push(label + ': ' + (v ? v.id : '—'));
    });
    lines.push('Week ' + w + ' → ' + parts.join(' | '));
  }

  // Herstel variant-state exact.
  types.forEach(function (t) {
    var k = 'variant_' + t;
    if (saved[k] === null) props.deleteProperty(k);
    else props.setProperty(k, saved[k]);
  });

  ui.alert('🔧 TEST: diversiteit (4 weken)', lines.join('\n'), ui.ButtonSet.OK);
}

/**
 * Forceert een week-rollover en laat zien dat de tab zichzelf herstelt
 * naar de huidige week. Eindtoestand is veilig (huidige week).
 */
function testRollover() {
  var ss = SpreadsheetApp.getActive();
  var ui = SpreadsheetApp.getUi();

  var before = getDocProp('tab_week_start', '(leeg)');

  // Zet tab_week_start op de maandag van VORIGE week.
  var huidigeMonday = weekStartDate(new Date());
  var vorigeMonday = new Date(huidigeMonday.getTime() - 7 * 24 * 60 * 60 * 1000);
  setDocProp('tab_week_start', formatDate(vorigeMonday, 'yyyy-MM-dd'));

  // Trigger de rollover-guard.
  ensureCurrentWeek(ss);

  var after = getDocProp('tab_week_start', '(leeg)');
  var verwacht = formatDate(huidigeMonday, 'yyyy-MM-dd');

  ui.alert('🔧 TEST: week-rollover',
    'Voor: tab stond op ' + before + '\n' +
    '(geforceerd naar vorige week: ' + formatDate(vorigeMonday, 'yyyy-MM-dd') + ')\n\n' +
    'Na rollover: tab staat nu op ' + after + '\n' +
    'Verwacht: maandag van DEZE week (' + verwacht + ')\n\n' +
    (after === verwacht ? '✅ Rollover correct.' : '❌ Mismatch!') + '\n\n' +
    'Check in de Weekplanner: datums = deze week, Gedaan? leeg, ' +
    'patroon-defaults (di/do/za) terug.',
    ui.ButtonSet.OK);
}

/**
 * TIJDELIJK — verifieert actualZoneMinutes_ op activity i151660593
 * (De Ronde Venen). Verwacht ≈ low 54.4 · high 3.7 · anaerobic 13.6 min.
 * Verwijder samen met de andere TEST-items zodra geverifieerd.
 */
function testZoneMinutesSample() {
  var ui = SpreadsheetApp.getUi();
  try {
    var act = intervalsRequest_('/activity/i151660593');
    var zm = actualZoneMinutes_(act, null);
    var msg = 'icu_zone_times:\n' + JSON.stringify(act && act.icu_zone_times) + '\n\n';
    msg += zm
      ? ('Resultaat: low ' + zm.low.toFixed(1) + ' · high ' + zm.high.toFixed(1) +
         ' · anaerobic ' + zm.anaerobic.toFixed(1) + '\n\nVerwacht ≈ 54.4 / 3.7 / 13.6')
      : 'null (geen zone-data)';
    ui.alert('🔧 TEST: zone-minuten i151660593', msg, ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('Fout', e.message, ui.ButtonSet.OK);
  }
}

/**
 * Toont zone-debt (geplande intent vs werkelijke zone-times) voor de
 * huidige week, met per-dag details. Verificatie van de feedback-loop.
 */
function testZoneDebt() {
  var ss = SpreadsheetApp.getActive();
  var ui = SpreadsheetApp.getUi();
  var weekStart = weekStartDate(new Date());
  var fb = computeZoneDebt_(ss, weekStart);

  var lines = [];
  if (!fb.hasPlan) {
    lines.push('Geen weekplan-snapshot voor deze week.');
    lines.push('Draai eerst "Genereer voorstel" zodat weekplan_<maandag> wordt opgeslagen.');
  } else {
    lines.push('Netto zone-debt deze week (+ = tekort):');
    lines.push('  low: ' + fb.debt.low + 'min · high: ' + fb.debt.high + 'min · anaerobic: ' + fb.debt.anaerobic + 'min');
    lines.push('');
    if (!fb.details.length) {
      lines.push('Nog geen voltooide+gematchte dagen deze week.');
    } else {
      lines.push('Per voltooide dag (gepland → werkelijk):');
      fb.details.forEach(function (det) {
        if (!det.hasData) {
          lines.push('  ' + det.dag + ' (' + det.type + '): geen zone-data');
          return;
        }
        var ip = det.intent || {}, ac = det.actual || {};
        lines.push('  ' + det.dag + ' (' + det.type + '): ' +
          'low ' + Math.round(ip.low || 0) + '→' + Math.round(ac.low || 0) + ' · ' +
          'high ' + Math.round(ip.high || 0) + '→' + Math.round(ac.high || 0) + ' · ' +
          'anaerobic ' + Math.round(ip.anaerobic || 0) + '→' + Math.round(ac.anaerobic || 0));
      });
    }
  }
  ui.alert('🔧 TEST: zone-debt', lines.join('\n'), ui.ButtonSet.OK);
}
