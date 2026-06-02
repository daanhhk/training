/**
 * WebApp.gs — read-only HtmlService dashboard (JOIN-geïnspireerd).
 *
 * doGet rendert Index. getDashboardState() levert ALLES in één call uit
 * gepersisteerde snapshots + tabs — NOOIT generateProposal (read-only,
 * mirrort de /status bot-command). Klaar voor latere write-back.
 *
 * Zone-balk: het workout-object exposeert geen geordende numerieke blokken
 * (structuur = display-strings), dus segmenten worden uit intent
 * {low,high,anaerobic} gebouwd — één segment per bucket, licht→zwaar.
 */

function doGet(e) {
  var t = HtmlService.createTemplateFromFile('Index');
  return t.evaluate()
    .setTitle('FTP Coach')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Include-helper voor CSS/JS-partials in Index. */
function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/** Web app URL (head /dev + versioned /exec via deployments). */
function getWebAppUrl() {
  return ScriptApp.getService().getUrl();
}

// ── Bucket → kleur/hoogte (zone-balk) ────────────────────────────
var DASH_BUCKET_STYLE_ = {
  low:       { kleur: '#4fc3f7', hoogtePct: 45 },
  high:      { kleur: '#ffd54f', hoogtePct: 65 },
  anaerobic: { kleur: '#ef6c00', hoogtePct: 100 }
};
var DASH_BUCKET_ORDER_ = ['low', 'high', 'anaerobic'];

function segmentsFromIntent_(intent) {
  if (!intent) return [];
  var segs = [];
  DASH_BUCKET_ORDER_.forEach(function (b) {
    var min = Math.round(Number(intent[b]) || 0);
    if (min <= 0) return;
    var st = DASH_BUCKET_STYLE_[b];
    segs.push({ minuten: min, bucket: b, kleur: st.kleur, hoogtePct: st.hoogtePct });
  });
  return segs;
}

// ── Tab-lezers (read-only) ───────────────────────────────────────

/** Activiteiten-tab → map dISO → {naam, duurMin, tss} (cycling, nieuwste wint). */
function dashActualsByDate_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(ACTIVITEITEN_SHEET);
  var map = {};
  if (!sh) return map;
  var last = sh.getLastRow();
  if (last < 2) return map;
  var data = sh.getRange(2, 1, last - 1, ACT_HEADERS.length).getValues();
  data.forEach(function (r) {
    if (!(r[0] instanceof Date)) return;
    var key = formatDate(r[0], 'yyyy-MM-dd');
    if (map[key]) return; // nieuwste eerst → eerste hit wint
    map[key] = {
      naam: String(r[2] || 'Rit'),
      duurMin: Number(r[3]) || 0,
      tss: r[8] !== '' && r[8] != null ? Number(r[8]) : null
    };
  });
  return map;
}

/** Alle weekplan_<maandag> snapshots → map dISO → entry. Volledige historie. */
function dashWeekplanByDate_() {
  var props = PropertiesService.getDocumentProperties();
  var all = props.getProperties();
  var byDate = {};
  Object.keys(all).forEach(function (k) {
    if (k.indexOf('weekplan_') !== 0) return;
    try {
      var arr = JSON.parse(all[k]);
      if (!Array.isArray(arr)) return;
      arr.forEach(function (entry) {
        if (entry && entry.datum) byDate[entry.datum] = entry;
      });
    } catch (e) {}
  });
  return byDate;
}

/** Wellness-tab CTL/ATL/Vorm reeks (oudste→nieuwste) + stats-bron. */
function dashVormReeks_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(WELLNESS_SHEET);
  var out = [];
  if (!sh) return out;
  var last = Math.min(sh.getLastRow(), WELL_STATS_ROW - 2);
  if (last < 2) return out;
  var data = sh.getRange(2, 1, last - 1, WELL_HEADERS.length).getValues();
  data.forEach(function (r) {
    if (!(r[0] instanceof Date)) return;
    var ctl = r[8], atl = r[9], vorm = r[10];
    if (ctl === '' && atl === '' && vorm === '') return;
    out.push({
      dateISO: formatDate(r[0], 'yyyy-MM-dd'),
      ctl: ctl === '' ? null : Number(ctl),
      atl: atl === '' ? null : Number(atl),
      vorm: vorm === '' ? null : Number(vorm)
    });
  });
  out.sort(function (a, b) { return a.dateISO < b.dateISO ? -1 : 1; }); // oudste links
  return out;
}

var DASH_WD_ = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
var DASH_MAAND_ = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
function dashKort_(d) { return DASH_WD_[d.getDay()] + ' ' + d.getDate() + ' ' + DASH_MAAND_[d.getMonth()]; }
function dashWeekdag_(d) {
  var v = ['zondag','maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag'];
  return v[d.getDay()];
}

// ── Stats (d7/d28/jaar + maandtotalen) ───────────────────────────
function dashStatsFromActivities_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(ACTIVITEITEN_SHEET);
  var empty = { tss: 0, tijdMin: 0, ritten: 0 };
  var res = { d7: { tss: 0, tijdMin: 0, ritten: 0 }, d28: { tss: 0, tijdMin: 0, ritten: 0 }, jaar: { tss: 0, tijdMin: 0, ritten: 0 } };
  var maand = {};
  if (!sh) return { stats: res, maandTotalen: [] };
  var last = sh.getLastRow();
  if (last < 2) return { stats: res, maandTotalen: [] };
  var data = sh.getRange(2, 1, last - 1, ACT_HEADERS.length).getValues();
  var now = stripTime_(new Date()).getTime();
  data.forEach(function (r) {
    if (!(r[0] instanceof Date)) return;
    var t = stripTime_(r[0]).getTime();
    var ageDays = (now - t) / 86400000;
    var min = Number(r[3]) || 0;
    var tss = (r[8] !== '' && r[8] != null) ? Number(r[8]) : 0;
    if (ageDays >= 0 && ageDays < 7)   { res.d7.tss += tss; res.d7.tijdMin += min; res.d7.ritten++; }
    if (ageDays >= 0 && ageDays < 28)  { res.d28.tss += tss; res.d28.tijdMin += min; res.d28.ritten++; }
    if (ageDays >= 0 && ageDays < 365) { res.jaar.tss += tss; res.jaar.tijdMin += min; res.jaar.ritten++; }
    var mk = formatDate(r[0], 'yyyy-MM');
    if (!maand[mk]) maand[mk] = { maand: mk, ritten: 0, tijdMin: 0, tss: 0 };
    maand[mk].ritten++; maand[mk].tijdMin += min; maand[mk].tss += tss;
  });
  ['d7','d28','jaar'].forEach(function (k) { res[k].tss = Math.round(res[k].tss); });
  var maandArr = Object.keys(maand).sort().reverse().slice(0, 12).map(function (k) {
    var m = maand[k]; m.tss = Math.round(m.tss); return m;
  });
  return { stats: res, maandTotalen: maandArr };
}

// ── Dag-kaart bouwer (gedeeld door Vandaag + Kalender) ───────────
function dashDayCard_(dISO, wpEntry, actual, rpe) {
  var voorstel = null;
  if (wpEntry) {
    voorstel = {
      type: wpEntry.workoutType || null,
      titel: wpEntry.naam || wpEntry.workoutType || 'Training',
      duurMin: wpEntry.minuten || 0,
      tss: wpEntry.tss || 0,
      segmenten: segmentsFromIntent_(wpEntry.intent)
    };
  }
  var act = null;
  if (actual) {
    var exp = expectedRpe_(wpEntry ? wpEntry.workoutType : null);
    act = {
      naam: actual.naam, duurMin: actual.duurMin, tss: actual.tss,
      rpe: rpe != null ? rpe : null,
      rpeVerwacht: exp != null ? exp : null,
      mismatch: (rpe != null && exp != null) ? Math.round((rpe - exp) * 10) / 10 : null
    };
  }
  return { voorstel: voorstel, actual: act };
}

// ── Hoofdgetter ──────────────────────────────────────────────────
function getDashboardState() {
  var ss = SpreadsheetApp.getActive();
  var settings = readSettings(ss);
  var weekStart = weekStartDate(new Date());
  var mesoWeek = getMesoWeek();
  var macro = bepaalFaseVoorDatum_(weekStart);
  var wellness = combineSignals_(getWellnessSignal(ss), rpeSignal_());
  var fs = getFormScore_();
  var weekTss = _statusWeekTss_(weekStart);
  var garminVerdict = garminHeuristic(weekTss, mesoWeek, macro.fase, fs);

  var planner = readPlanner(ss);
  var actuals = dashActualsByDate_();
  var wpByDate = dashWeekplanByDate_();
  var today = stripTime_(new Date());
  var todayISO = formatDate(today, 'yyyy-MM-dd');

  // ── Vandaag ──
  function rpeFor(dISO) { var v = getDocProp('rpe_' + dISO, ''); return v === '' ? null : parseInt(v, 10); }
  var todayCard = dashDayCard_(todayISO, wpByDate[todayISO], actuals[todayISO], rpeFor(todayISO));
  var todayPlanner = null;
  planner.forEach(function (p) { if (p.datum && formatDate(p.datum, 'yyyy-MM-dd') === todayISO) todayPlanner = p; });
  var todayStatus = actuals[todayISO] ? 'voltooid'
    : (todayPlanner && todayPlanner.train ? 'gepland' : 'rust');

  var gereedheid = {
    signaal: wellness.signal, label: wellness.reason || '',
    vorm: fs ? Math.round(fs.form) : null,
    vormZone: fs ? fs.label : null,
    ramp: fs && fs.ramp != null ? Math.round(fs.ramp * 100) / 100 : null
  };

  // ── "Waarom" regels ──
  var waarom = [];
  waarom.push('Macro-fase: ' + macro.fase + (macro.wekenTotEvent != null ? ' (' + macro.wekenTotEvent + " wk tot event)" : ''));
  if (macro.isTaper) waarom.push('Taper — fris worden voor het event.');
  if (wellness.signal !== 'normal') waarom.push('Bijsturing: ' + wellness.reason);
  waarom.push('Garmin-verwachting: ' + garminVerdict);
  try {
    var fb = computeZoneDebt_(ss, weekStart);
    if (fb && fb.hasPlan) {
      ['high','anaerobic','low'].forEach(function (b) {
        var v = Number(fb.debt[b]) || 0;
        if (v >= 5) waarom.push('Zone-debt ' + b + ': +' + v + ' min tekort.');
      });
    }
  } catch (e) {}
  waarom.push('Mesocyclus week ' + mesoWeek + '/4 · load ' + mesoFactor(mesoWeek).toFixed(2) + '×');

  var vandaag = {
    dateISO: todayISO, weekdag: dashWeekdag_(today), status: todayStatus,
    gereedheid: gereedheid,
    garminStatus: { verdict: garminVerdict, ramp: gereedheid.ramp },
    voorstel: todayCard.voorstel ? Object.assign({ waarom: waarom }, todayCard.voorstel) : null,
    actual: todayCard.actual
  };

  // ── Dagen (~90d terug t/m einde huidige week + week+1 preview) ──
  var dagen = [];
  var windowStart = new Date(today.getTime() - 90 * 86400000);
  var curWeekEnd = new Date(weekStart.getTime() + 6 * 86400000);
  var d = stripTime_(windowStart);
  while (d.getTime() <= curWeekEnd.getTime()) {
    var dISO = formatDate(d, 'yyyy-MM-dd');
    var card = dashDayCard_(dISO, wpByDate[dISO], actuals[dISO], rpeFor(dISO));
    var isToday = dISO === todayISO;
    var status, kleur = null;
    if (actuals[dISO]) { status = isToday ? 'vandaag' : 'voltooid'; }
    else if (isToday)  { status = 'vandaag'; }
    else if (d.getTime() > today.getTime() && card.voorstel) { status = 'gepland'; }
    else if (card.voorstel) { status = 'gepland'; }
    else { status = 'rust'; }
    if (card.voorstel) {
      var seg0 = card.voorstel.segmenten[card.voorstel.segmenten.length - 1];
      kleur = seg0 ? seg0.kleur : '#90a4ae';
    }
    dagen.push({
      dateISO: dISO, weekdag: dashWeekdag_(d), kort: dashKort_(d),
      status: status, kleur: kleur,
      voorstel: card.voorstel, actual: card.actual, previewMin: null
    });
    d = new Date(d.getTime() + 86400000);
  }
  // Week+1 preview-chips uit de Weekplanner +1-tab (alleen beschikbaarheid).
  try {
    var plus1 = ss.getSheetByName(WEEKPLANNER_PLUS1_SHEET);
    if (plus1 && plannerHasData_(plus1)) {
      var p1 = plus1.getRange(3, 1, 7, 8).getValues();
      for (var i = 0; i < 7; i++) {
        if (!(p1[i][2] instanceof Date)) continue;
        var pISO = formatDate(p1[i][2], 'yyyy-MM-dd');
        var pdate = stripTime_(p1[i][2]);
        dagen.push({
          dateISO: pISO, weekdag: dashWeekdag_(pdate), kort: dashKort_(pdate),
          status: 'preview', kleur: '#b0bec5',
          voorstel: null, actual: null,
          previewMin: (p1[i][0] === true ? (Number(p1[i][3]) || 0) : null)
        });
      }
    }
  } catch (e) {}

  // ── Vorm ──
  var reeks = dashVormReeks_();
  var statsBundle = dashStatsFromActivities_();
  var vorm = {
    reeks: reeks,
    huidig: fs ? { vorm: Math.round(fs.form), vormZone: fs.label, ctl: Math.round(fs.ctl), atl: Math.round(fs.atl), ramp: fs.ramp != null ? Math.round(fs.ramp * 100) / 100 : null } : null,
    stats: statsBundle.stats,
    ftp: settings.ftp || null
  };

  return {
    athlete: { ftp: settings.ftp || null, naam: '' },
    vandaag: vandaag,
    dagen: dagen,
    vorm: vorm,
    maandTotalen: statsBundle.maandTotalen
  };
}
