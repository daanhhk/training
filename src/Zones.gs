/**
 * Zones.gs — Tab "Zones".
 *
 * Toont power-zones (Coggan 7-zones) en HR-zones (Friel) als
 * auto-berekende tabellen met formules die naar Instellingen verwijzen.
 * Formules in pure NL-Sheets stijl: ',' decimaal + ';' separator.
 *
 * Indien intervals.icu zones gesynct zijn (DocumentProperty
 * 'api_power_zones' / 'api_hr_zones' bevat een JSON array van
 * boundary-percentages), gebruikt deze module die boundaries i.p.v.
 * de hardcoded defaults.
 */

var ZONES_SHEET = 'Zones';

var DEFAULT_POWER_ZONES = [
  ['Z1',  'Active Recovery', 0,   55,  '#cbd5e1'],
  ['Z2',  'Endurance',       56,  75,  '#93c5fd'],
  ['Z3',  'Tempo',           76,  87,  '#86efac'],
  ['Z4',  'Sweet Spot',      88,  94,  '#fde68a'],
  ['Z4+', 'Threshold',       95,  105, '#fdba74'],
  ['Z5',  'VO2max',          106, 120, '#fca5a5'],
  ['Z6',  'Anaerobic',       121, 150, '#f472b6'],
  ['Z7',  'Neuromuscular',   151, 250, '#a78bfa']
];

var DEFAULT_HR_ZONES = [
  ['Z1',  'Recovery',  0,   84,  '#cbd5e1'],
  ['Z2',  'Aerobic',   85,  89,  '#93c5fd'],
  ['Z3',  'Tempo',     90,  94,  '#86efac'],
  ['Z4',  'Threshold', 95,  99,  '#fde68a'],
  ['Z5a', 'VO2 onder', 100, 102, '#fdba74'],
  ['Z5b', 'VO2 boven', 103, 106, '#fca5a5'],
  ['Z5c', 'Anaerobic', 107, 130, '#f472b6']
];

var POWER_ZONE_NAMES = [
  ['Z1', 'Active Recovery'], ['Z2', 'Endurance'], ['Z3', 'Tempo'],
  ['Z4', 'Sweet Spot'], ['Z4+', 'Threshold'], ['Z5', 'VO2max'],
  ['Z6', 'Anaerobic'], ['Z7', 'Neuromuscular'], ['Z8', 'Sprint']
];
var POWER_ZONE_COLORS = ['#cbd5e1', '#93c5fd', '#86efac', '#fde68a', '#fdba74',
                         '#fca5a5', '#f472b6', '#a78bfa', '#7c3aed'];

var HR_ZONE_NAMES = [
  ['Z1', 'Recovery'], ['Z2', 'Aerobic'], ['Z3', 'Tempo'],
  ['Z4', 'Threshold'], ['Z5a', 'VO2 onder'], ['Z5b', 'VO2 boven'],
  ['Z5c', 'Anaerobic']
];
var HR_ZONE_COLORS = ['#cbd5e1', '#93c5fd', '#86efac', '#fde68a',
                      '#fdba74', '#fca5a5', '#f472b6'];

/**
 * Converteert een array van boundary-percentages (intervals.icu format)
 * naar het [naam, display, min%, max%, kleur] formaat dat buildZones gebruikt.
 * boundaries = [55, 75, 90, 105, 120, 150, 200] → 7 zones gesplitst.
 */
function zonesFromBoundaries(boundaries, names, colors) {
  if (!Array.isArray(boundaries) || !boundaries.length) return null;
  var zones = [];
  var prev = 0;
  for (var i = 0; i < boundaries.length; i++) {
    var name = names[i] || ['Z' + (i + 1), ''];
    zones.push([name[0], name[1] || '', prev, boundaries[i], colors[i] || '#e5e7eb']);
    prev = boundaries[i];
  }
  return zones;
}

function loadApiZones_(propKey) {
  var raw = getDocProp(propKey, '');
  if (!raw) return null;
  try {
    var parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return null;
    // Filter: alleen numerieke entries (intervals.icu kan ook objecten geven)
    if (typeof parsed[0] === 'object') {
      // Object-vorm — pak 'max' percentage
      parsed = parsed.map(function (z) { return z.max || z.upper || z.maxPct || null; })
                     .filter(function (v) { return v != null; });
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

  // Resolve zones: API-gesynct heeft voorrang, fallback op defaults.
  var apiPower = loadApiZones_('api_power_zones');
  var apiHr    = loadApiZones_('api_hr_zones');
  var powerZones = apiPower ? zonesFromBoundaries(apiPower, POWER_ZONE_NAMES, POWER_ZONE_COLORS) : DEFAULT_POWER_ZONES;
  var hrZones    = apiHr    ? zonesFromBoundaries(apiHr,    HR_ZONE_NAMES,    HR_ZONE_COLORS)    : DEFAULT_HR_ZONES;

  // ── POWER ZONES ──
  sh.getRange(1, 1, 1, 6).merge()
    .setValue('⚡  Power zones' + (apiPower ? ' (intervals.icu)' : '') + ' — % van FTP')
    .setFontWeight('bold').setBackground('#1f2937').setFontColor('#ffffff')
    .setHorizontalAlignment('left');

  sh.getRange(2, 1, 1, 6).setValues([
    ['Zone', 'Naam', '% min', '% max', 'Watt min', 'Watt max']
  ]).setFontWeight('bold').setBackground('#e5e7eb');

  powerZones.forEach(function (z, i) {
    var r = 3 + i;
    sh.getRange(r, 1).setValue(z[0]).setFontWeight('bold');
    sh.getRange(r, 2).setValue(z[1]);
    sh.getRange(r, 3).setValue(z[2] + '%');
    sh.getRange(r, 4).setValue(z[3] + '%');
    sh.getRange(r, 5).setFormula('=ROUND(' + ftpRef + '*' + nlNumber(z[2] / 100) + ';0)');
    sh.getRange(r, 6).setFormula('=ROUND(' + ftpRef + '*' + nlNumber(z[3] / 100) + ';0)');
    sh.getRange(r, 1, 1, 6).setBackground(z[4]);
  });

  // ── HR ZONES ──
  var hrStart = 3 + powerZones.length + 2;
  sh.getRange(hrStart, 1, 1, 6).merge()
    .setValue('❤️  HR zones' + (apiHr ? ' (intervals.icu)' : '') + ' — % van LTHR')
    .setFontWeight('bold').setBackground('#1f2937').setFontColor('#ffffff')
    .setHorizontalAlignment('left');

  sh.getRange(hrStart + 1, 1, 1, 6).setValues([
    ['Zone', 'Naam', '% min', '% max', 'BPM min', 'BPM max']
  ]).setFontWeight('bold').setBackground('#e5e7eb');

  hrZones.forEach(function (z, i) {
    var r = hrStart + 2 + i;
    sh.getRange(r, 1).setValue(z[0]).setFontWeight('bold');
    sh.getRange(r, 2).setValue(z[1]);
    sh.getRange(r, 3).setValue(z[2] + '%');
    sh.getRange(r, 4).setValue(z[3] + '%');
    sh.getRange(r, 5).setFormula('=ROUND(' + lthrRef + '*' + nlNumber(z[2] / 100) + ';0)');
    sh.getRange(r, 6).setFormula('=ROUND(' + lthrRef + '*' + nlNumber(z[3] / 100) + ';0)');
    sh.getRange(r, 1, 1, 6).setBackground(z[4]);
  });

  // Referenties onderaan
  var refRow = hrStart + 2 + hrZones.length + 2;
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
