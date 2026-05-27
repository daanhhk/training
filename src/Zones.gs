/**
 * Zones.gs — Tab "Zones".
 *
 * Twee tabellen + één referentie-rij:
 *   1) Power zones (7-zone systeem, intervals.icu-compatibel).
 *      API levert boundaries als percentages van FTP, watts berekend via × FTP.
 *   2) Sweet Spot referentie-rij (apart, niet in 7-zone systeem).
 *      Uit icu_sweet_spot_min/max — alleen na sync zichtbaar.
 *   3) HR zones. LET OP: intervals.icu levert hr_zones als RAW BPM
 *      (bv. [143, 158, ...]), niet als percentages. BPM-kolommen tonen
 *      array-waardes; %-kolommen berekenen bpm/lthr×100 via formule.
 *
 * Top-zone bovengrens >= 500% → render als "∞" (anders 999% × FTP = 2747W).
 */

var ZONES_SHEET = 'Zones';

var POWER_ZONE_NAMES = [
  ['Z1', 'Active Recovery'],
  ['Z2', 'Endurance'],
  ['Z3', 'Tempo'],
  ['Z4', 'Threshold'],
  ['Z5', 'VO2max'],
  ['Z6', 'Anaerobic'],
  ['Z7', 'Neuromuscular']
];
var POWER_ZONE_COLORS = ['#cbd5e1', '#93c5fd', '#86efac', '#fde68a', '#fca5a5', '#f472b6', '#a78bfa'];

var HR_ZONE_NAMES = [
  ['Z1',  'Recovery'],
  ['Z2',  'Aerobic'],
  ['Z3',  'Tempo'],
  ['Z4',  'Threshold'],
  ['Z5a', 'VO2 onder'],
  ['Z5b', 'VO2 boven'],
  ['Z5c', 'Anaerobic']
];
var HR_ZONE_COLORS = ['#cbd5e1', '#93c5fd', '#86efac', '#fde68a', '#fdba74', '#fca5a5', '#f472b6'];

// +1 boundary conventie (parity met intervals.icu): Z2.min = Z1.max + 1, etc.
// Z1 ondergrens blijft 0.
var DEFAULT_POWER_ZONES = [
  ['Z1', 'Active Recovery', 0,   55,  '#cbd5e1'],
  ['Z2', 'Endurance',       56,  75,  '#93c5fd'],
  ['Z3', 'Tempo',           76,  87,  '#86efac'],
  ['Z4', 'Threshold',       88,  105, '#fde68a'],
  ['Z5', 'VO2max',          106, 120, '#fca5a5'],
  ['Z6', 'Anaerobic',       121, 150, '#f472b6'],
  ['Z7', 'Neuromuscular',   151, 999, '#a78bfa']
];

var DEFAULT_HR_PCT_ZONES = [
  ['Z1',  'Recovery',  0,   84,  '#cbd5e1'],
  ['Z2',  'Aerobic',   85,  89,  '#93c5fd'],
  ['Z3',  'Tempo',     90,  94,  '#86efac'],
  ['Z4',  'Threshold', 95,  99,  '#fde68a'],
  ['Z5a', 'VO2 onder', 100, 102, '#fdba74'],
  ['Z5b', 'VO2 boven', 103, 106, '#fca5a5'],
  ['Z5c', 'Anaerobic', 107, 130, '#f472b6']
];

var INF_PCT = 500; // >= 500% → render als ∞

// +1 conventie voor min waardes (behalve Z1).
function powerZonesFromPct_(pctBoundaries) {
  var zones = [];
  var prev = 0;
  for (var i = 0; i < pctBoundaries.length && i < POWER_ZONE_NAMES.length; i++) {
    zones.push([
      POWER_ZONE_NAMES[i][0],
      POWER_ZONE_NAMES[i][1],
      i === 0 ? 0 : prev + 1,
      pctBoundaries[i],
      POWER_ZONE_COLORS[i] || '#e5e7eb'
    ]);
    prev = pctBoundaries[i];
  }
  return zones;
}

function hrZonesFromBpm_(bpmBoundaries) {
  var zones = [];
  var prev = 0;
  for (var i = 0; i < bpmBoundaries.length && i < HR_ZONE_NAMES.length; i++) {
    zones.push([
      HR_ZONE_NAMES[i][0],
      HR_ZONE_NAMES[i][1],
      i === 0 ? 0 : prev + 1,
      bpmBoundaries[i],
      HR_ZONE_COLORS[i] || '#e5e7eb'
    ]);
    prev = bpmBoundaries[i];
  }
  return zones;
}

function loadApiZones_(propKey) {
  var raw = getDocProp(propKey, '');
  if (!raw) return null;
  try {
    var parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return null;
    if (typeof parsed[0] === 'object') {
      parsed = parsed.map(function (z) {
        return z.max ?? z.upper ?? z.maxPct ?? z.upperPct ?? z.high ?? null;
      }).filter(function (v) { return v != null; });
    }
    return parsed.length ? parsed : null;
  } catch (e) {
    console.error('loadApiZones_ JSON error:', e);
    return null;
  }
}

function buildZones(ss) {
  var sh = getOrCreateSheet(ss, ZONES_SHEET);

  var ftpRef   = SETTINGS_SHEET + '!B' + SETTINGS_FIELDS.FTP.row;
  var lthrRef  = SETTINGS_SHEET + '!B' + SETTINGS_FIELDS.LTHR.row;
  var hrMaxRef = SETTINGS_SHEET + '!B' + SETTINGS_FIELDS.HR_MAX.row;

  var apiPower = loadApiZones_('api_power_zones');
  var apiHr    = loadApiZones_('api_hr_zones');
  var powerZones = apiPower ? powerZonesFromPct_(apiPower) : DEFAULT_POWER_ZONES;

  // ── POWER ZONES ────────────────────────────────────────
  sh.getRange(1, 1, 1, 6).merge()
    .setValue('⚡  Power zones' + (apiPower ? ' (intervals.icu)' : '') + ' — % van FTP')
    .setFontWeight('bold').setBackground('#1f2937').setFontColor('#ffffff')
    .setHorizontalAlignment('left');

  sh.getRange(2, 1, 1, 6).setValues([
    ['Zone', 'Naam', '% min', '% max', 'Watt min', 'Watt max']
  ]).setFontWeight('bold').setBackground('#e5e7eb');

  powerZones.forEach(function (z, i) {
    var r = 3 + i;
    var min = z[2], max = z[3];
    var isInf = max >= INF_PCT;

    sh.getRange(r, 1).setValue(z[0]).setFontWeight('bold');
    sh.getRange(r, 2).setValue(z[1]);
    sh.getRange(r, 3).setValue(min + '%');
    sh.getRange(r, 4).setValue(isInf ? '∞' : (max + '%'));

    // Watt min: Z1 = ROUND(FTP * 0/100) = 0. Z2+ = vorige rij Watt max + 1.
    if (i === 0) {
      sh.getRange(r, 5).setFormula('=ROUND(' + ftpRef + '*' + nlNumber(min / 100) + ';0)');
    } else {
      sh.getRange(r, 5).setFormula('=F' + (r - 1) + '+1');
    }

    if (isInf) {
      sh.getRange(r, 6).setValue('∞').setHorizontalAlignment('center');
    } else {
      sh.getRange(r, 6).setFormula('=ROUND(' + ftpRef + '*' + nlNumber(max / 100) + ';0)');
    }
    sh.getRange(r, 1, 1, 6).setBackground(z[4]);
  });

  // ── SWEET SPOT REFERENTIE ROW ───────────────────────────
  var ssMinRaw = getDocProp('sweet_spot_min', '');
  var ssMaxRaw = getDocProp('sweet_spot_max', '');
  var ssMin = ssMinRaw === '' ? null : Number(ssMinRaw);
  var ssMax = ssMaxRaw === '' ? null : Number(ssMaxRaw);
  var nextRow = 3 + powerZones.length + 1;
  if (ssMin != null && !isNaN(ssMin) && ssMax != null && !isNaN(ssMax)) {
    sh.getRange(nextRow, 1).setValue('📍').setHorizontalAlignment('center');
    sh.getRange(nextRow, 2).setValue('Sweet Spot').setFontWeight('bold');
    sh.getRange(nextRow, 3).setValue(ssMin + '%');
    sh.getRange(nextRow, 4).setValue(ssMax + '%');
    sh.getRange(nextRow, 5).setFormula('=ROUND(' + ftpRef + '*' + nlNumber(ssMin / 100) + ';0)');
    sh.getRange(nextRow, 6).setFormula('=ROUND(' + ftpRef + '*' + nlNumber(ssMax / 100) + ';0)');
    sh.getRange(nextRow, 1, 1, 6).setBackground('#fef3c7')
      .setBorder(true, true, true, true, false, false, '#92400e',
                 SpreadsheetApp.BorderStyle.SOLID);
    nextRow += 1;
  }

  // ── HR ZONES ───────────────────────────────────────────
  var hrStart = nextRow + 1;
  sh.getRange(hrStart, 1, 1, 6).merge()
    .setValue('❤️  HR zones' + (apiHr ? ' (intervals.icu)' : '') + ' — BPM en % van LTHR')
    .setFontWeight('bold').setBackground('#1f2937').setFontColor('#ffffff')
    .setHorizontalAlignment('left');

  sh.getRange(hrStart + 1, 1, 1, 6).setValues([
    ['Zone', 'Naam', '% min', '% max', 'BPM min', 'BPM max']
  ]).setFontWeight('bold').setBackground('#e5e7eb');

  if (apiHr) {
    // API levert RAW BPM-boundaries — BPM-kolommen direct, %-kolommen via formule
    var hrZones = hrZonesFromBpm_(apiHr);
    hrZones.forEach(function (z, i) {
      var r = hrStart + 2 + i;
      var bpmMin = z[2], bpmMax = z[3];

      sh.getRange(r, 1).setValue(z[0]).setFontWeight('bold');
      sh.getRange(r, 2).setValue(z[1]);
      sh.getRange(r, 3).setFormula('=ROUND(' + nlNumber(bpmMin) + '/' + lthrRef + '*100;0) & "%"');
      sh.getRange(r, 4).setFormula('=ROUND(' + nlNumber(bpmMax) + '/' + lthrRef + '*100;0) & "%"');
      sh.getRange(r, 5).setValue(bpmMin);
      sh.getRange(r, 6).setValue(bpmMax);
      sh.getRange(r, 1, 1, 6).setBackground(z[4]);
    });
  } else {
    // Default: percentages drive BPM-formules.
    // +1 conventie: BPM min van Z2+ = vorige BPM max + 1.
    DEFAULT_HR_PCT_ZONES.forEach(function (z, i) {
      var r = hrStart + 2 + i;
      sh.getRange(r, 1).setValue(z[0]).setFontWeight('bold');
      sh.getRange(r, 2).setValue(z[1]);
      sh.getRange(r, 3).setValue(z[2] + '%');
      sh.getRange(r, 4).setValue(z[3] + '%');
      if (i === 0) {
        sh.getRange(r, 5).setFormula('=ROUND(' + lthrRef + '*' + nlNumber(z[2] / 100) + ';0)');
      } else {
        sh.getRange(r, 5).setFormula('=F' + (r - 1) + '+1');
      }
      sh.getRange(r, 6).setFormula('=ROUND(' + lthrRef + '*' + nlNumber(z[3] / 100) + ';0)');
      sh.getRange(r, 1, 1, 6).setBackground(z[4]);
    });
  }

  // Referenties onderaan
  var hrZonesCount = apiHr ? Math.min(apiHr.length, HR_ZONE_NAMES.length) : DEFAULT_HR_PCT_ZONES.length;
  var refRow = hrStart + 2 + hrZonesCount + 2;
  sh.getRange(refRow, 1).setValue('Referentie HR max:').setFontWeight('bold');
  sh.getRange(refRow, 2).setFormula('=' + hrMaxRef);
  sh.getRange(refRow, 3).setValue('bpm').setFontColor('#6b7280');
  sh.getRange(refRow + 1, 1).setValue('Referentie LTHR:').setFontWeight('bold');
  sh.getRange(refRow + 1, 2).setFormula('=' + lthrRef);
  sh.getRange(refRow + 1, 3).setValue('bpm').setFontColor('#6b7280');
  sh.getRange(refRow + 2, 1).setValue('Referentie FTP:').setFontWeight('bold');
  sh.getRange(refRow + 2, 2).setFormula('=' + ftpRef);
  sh.getRange(refRow + 2, 3).setValue('W').setFontColor('#6b7280');

  SpreadsheetApp.flush();
  sh.setColumnWidth(1, 70);
  sh.setColumnWidth(2, 170);
  sh.setColumnWidth(3, 80);
  sh.setColumnWidth(4, 80);
  sh.setColumnWidth(5, 100);
  sh.setColumnWidth(6, 100);
  sh.setFrozenRows(2);
}
