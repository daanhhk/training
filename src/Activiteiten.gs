/**
 * Activiteiten.gs — Tab "Activiteiten".
 *
 * Toont laatste ~28 dagen activiteiten uit intervals.icu (nieuwste
 * bovenaan). Data wordt door Sync.syncActivities() gevuld.
 *
 * Conditional formatting:
 *   - TSS > 200      → oranje (zware sessie)
 *   - PI  < 1.5      → geel   (signal: weinig polarisatie)
 */

var ACTIVITEITEN_SHEET = 'Activiteiten';

var ACT_HEADERS = [
  'Datum', 'Type', 'Naam', 'Duur (min)', 'Afstand (km)',
  'Gem W', 'Norm W', 'IF', 'TSS', 'Gem HR', 'Max HR', 'PI'
];

function buildActiviteiten(ss) {
  var sh = getOrCreateSheet(ss, ACTIVITEITEN_SHEET);

  // Title
  sh.getRange(1, 1, 1, ACT_HEADERS.length).setValues([ACT_HEADERS])
    .setFontWeight('bold').setBackground('#1f2937').setFontColor('#ffffff')
    .setHorizontalAlignment('center');
  sh.setFrozenRows(1);

  // Conditional formatting
  var rules = [];
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenNumberGreaterThan(200)
    .setBackground('#fed7aa')
    .setRanges([sh.getRange('I2:I1000')])
    .build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenNumberLessThan(1.5)
    .setBackground('#fef9c3')
    .setRanges([sh.getRange('L2:L1000')])
    .build());
  sh.setConditionalFormatRules(rules);

  SpreadsheetApp.flush();
  var widths = [100, 80, 240, 80, 100, 70, 75, 60, 70, 80, 80, 60];
  widths.forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
}
