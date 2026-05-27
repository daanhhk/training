/**
 * Utils.gs — Gedeelde helpers.
 *
 * Algemene helpers: dutchFormula (locale fix), mesoWeek state in
 * DocumentProperties, datum-helpers, getOrCreateSheet.
 */

var TZ = 'Europe/Amsterdam';

/**
 * Identity function — formula passes through unchanged.
 *
 * Apps Script setFormula() handles locale-conversion automatically:
 * input must be in US-notation ("." decimal, "," separator) and rendering
 * uses the spreadsheet's locale (NL → "," decimal, ";" separator).
 *
 * @deprecated Behoud van call-sites tot een latere refactor — de helper
 * doet effectief niets meer, maar voorkomt dat we nu overal moeten editen.
 */
function dutchFormula(formula) {
  return formula;
}

function getDocProp(key, def) {
  var v = PropertiesService.getDocumentProperties().getProperty(key);
  return v == null || v === '' ? def : v;
}

function setDocProp(key, value) {
  PropertiesService.getDocumentProperties().setProperty(key, String(value));
}

function getMesoWeek() {
  var v = parseInt(getDocProp('mesoWeek', '1'), 10);
  if (isNaN(v) || v < 1) v = 1;
  if (v > 4) v = 4;
  return v;
}

function setMesoWeek(n) {
  n = Math.max(1, Math.min(4, parseInt(n, 10) || 1));
  setDocProp('mesoWeek', n);
}

function advanceMeso() {
  var n = getMesoWeek() + 1;
  if (n > 4) n = 1;
  setMesoWeek(n);
  SpreadsheetApp.getActive().toast('Mesocyclus → week ' + n, '🚴 Coach', 5);
}

function resetMeso() {
  setMesoWeek(1);
  SpreadsheetApp.getActive().toast('Mesocyclus gereset naar week 1', '🚴 Coach', 5);
}

function formatDate(date, format) {
  return Utilities.formatDate(date, TZ, format);
}

function weekStartDate(today) {
  today = today || new Date();
  var d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  var day = d.getDay(); // 0=Sun..6=Sat
  var diff = (day === 0 ? -6 : 1 - day); // back to Monday
  d.setDate(d.getDate() + diff);
  return d;
}

function range(start, end) {
  var arr = [];
  for (var i = start; i < end; i++) arr.push(i);
  return arr;
}

function getOrCreateSheet(ss, name) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
  } else {
    sh.clear();
    try { sh.clearConditionalFormatRules(); } catch (e) {}
    var maxRows = sh.getMaxRows();
    var maxCols = sh.getMaxColumns();
    if (maxRows > 1) sh.getRange(1, 1, maxRows, maxCols).clearDataValidations().clearNote();
  }
  return sh;
}

function deleteSheetIfExists(ss, name) {
  var sh = ss.getSheetByName(name);
  if (sh) ss.deleteSheet(sh);
}

function watts(ftp, pct) {
  return Math.round(ftp * pct / 100);
}

function wattsRange(ftp, low, high) {
  return watts(ftp, low) + '-' + watts(ftp, high) + 'W';
}

function bpmRange(lthr, low, high) {
  return Math.round(lthr * low / 100) + '-' + Math.round(lthr * high / 100) + ' bpm';
}

function bpmBelow(lthr, pct) {
  return '<' + Math.round(lthr * pct / 100) + ' bpm';
}

function pad2(n) {
  return (n < 10 ? '0' : '') + n;
}
