/**
 * Wellness.gs — Tab "Wellness".
 *
 * Toont laatste ~30 dagen wellness data uit intervals.icu (nieuwste
 * bovenaan). Onderaan mini-statistiekjes voor afgelopen 7 dagen.
 *
 * Conditional formatting:
 *   - Slaap < 6u   → oranje
 *   - Slaap > 8u   → groen
 *   - HRV < 7d-gem * 0.9 → rood (significant lager dan gemiddelde)
 */

var WELLNESS_SHEET = 'Wellness';

var WELL_HEADERS = [
  'Datum', 'RHR', 'HRV', 'Slaap (u)', 'Slaap-score', 'Readiness', 'Mood', 'Weight (kg)'
];

var WELL_STATS_ROW = 35;

function buildWellness(ss) {
  var sh = getOrCreateSheet(ss, WELLNESS_SHEET);

  sh.getRange(1, 1, 1, WELL_HEADERS.length).setValues([WELL_HEADERS])
    .setFontWeight('bold').setBackground('#1f2937').setFontColor('#ffffff')
    .setHorizontalAlignment('center');
  sh.setFrozenRows(1);

  var rules = [];
  // Slaap < 6 oranje
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenNumberLessThan(6)
    .setBackground('#fed7aa')
    .setRanges([sh.getRange('D2:D' + (WELL_STATS_ROW - 2))])
    .build());
  // Slaap > 8 groen
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenNumberGreaterThan(8)
    .setBackground('#bbf7d0')
    .setRanges([sh.getRange('D2:D' + (WELL_STATS_ROW - 2))])
    .build());
  // HRV < 7d-gemiddelde * 0.9
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=AND(ISNUMBER(C2);C2<AVERAGE($C$2:$C$8)*0,9)')
    .setBackground('#fecaca')
    .setRanges([sh.getRange('C2:C' + (WELL_STATS_ROW - 2))])
    .build());
  sh.setConditionalFormatRules(rules);

  // Mini-statistiekjes (laatste 7 dagen)
  sh.getRange(WELL_STATS_ROW, 1, 1, WELL_HEADERS.length).merge()
    .setValue('📊  Gemiddelden laatste 7 dagen')
    .setFontWeight('bold').setBackground('#e5e7eb');

  sh.getRange(WELL_STATS_ROW + 1, 1).setValue('Gem HRV:').setFontWeight('bold');
  sh.getRange(WELL_STATS_ROW + 1, 2).setFormula('=IFERROR(ROUND(AVERAGE(C2:C8);1);"")');

  sh.getRange(WELL_STATS_ROW + 2, 1).setValue('Gem Slaap (u):').setFontWeight('bold');
  sh.getRange(WELL_STATS_ROW + 2, 2).setFormula('=IFERROR(ROUND(AVERAGE(D2:D8);2);"")');

  sh.getRange(WELL_STATS_ROW + 3, 1).setValue('Gem RHR:').setFontWeight('bold');
  sh.getRange(WELL_STATS_ROW + 3, 2).setFormula('=IFERROR(ROUND(AVERAGE(B2:B8);1);"")');

  sh.getRange(WELL_STATS_ROW + 4, 1).setValue('Gem Readiness:').setFontWeight('bold');
  sh.getRange(WELL_STATS_ROW + 4, 2).setFormula('=IFERROR(ROUND(AVERAGE(F2:F8);1);"")');

  SpreadsheetApp.flush();
  var widths = [100, 80, 80, 100, 110, 110, 80, 110];
  widths.forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
}
