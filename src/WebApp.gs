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
// Fijne 5-bucket schaal voor blokken (Optie B); de intent-fallback gebruikt
// alleen low/high/anaerobic.
var DASH_BUCKET_STYLE_ = {
  rust:      { kleur: '#cfd8dc', hoogtePct: 25 },
  z2:        { kleur: '#4fc3f7', hoogtePct: 45 },
  tempo:     { kleur: '#ffd54f', hoogtePct: 65 },
  drempel:   { kleur: '#66bb6a', hoogtePct: 85 },
  anaeroob:  { kleur: '#ef6c00', hoogtePct: 100 },
  // intent-fallback buckets
  low:       { kleur: '#4fc3f7', hoogtePct: 45 },
  high:      { kleur: '#ffd54f', hoogtePct: 65 },
  anaerobic: { kleur: '#ef6c00', hoogtePct: 100 }
};
var DASH_INTENT_ORDER_ = ['low', 'high', 'anaerobic'];

/** Optie B: geordende blokken [{minuten, zone}] → zone-balk segmenten. */
function segmentsFromBlokken_(blokken) {
  if (!blokken || !blokken.length) return null;
  var segs = [];
  blokken.forEach(function (b) {
    var min = Number(b.minuten) || 0;
    if (min <= 0) return;
    var st = DASH_BUCKET_STYLE_[b.zone] || DASH_BUCKET_STYLE_.z2;
    segs.push({ minuten: min, bucket: b.zone, kleur: st.kleur, hoogtePct: st.hoogtePct });
  });
  return segs.length ? segs : null;
}

/** Fallback: intent {low,high,anaerobic} → één segment per bucket. */
function segmentsFromIntent_(intent) {
  if (!intent) return [];
  var segs = [];
  DASH_INTENT_ORDER_.forEach(function (b) {
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
  var oudste = null;
  data.forEach(function (r) {
    if (!(r[0] instanceof Date)) return;
    var t = stripTime_(r[0]).getTime();
    if (oudste === null || t < oudste) oudste = t;
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
  // Werkelijke historie-span: de Activiteiten-tab wordt door syncActivities
  // met getActivities(28) gevoed → ~28 dagen, dus "jaar" == d28. Geef de span
  // mee zodat de client het jaar-label eerlijk kan degraderen.
  var spanDagen = oudste !== null ? Math.round((now - oudste) / 86400000) : 0;
  return {
    stats: res, maandTotalen: maandArr,
    spanDagen: spanDagen,
    eersteDatum: oudste !== null ? formatDate(new Date(oudste), 'yyyy-MM-dd') : null
  };
}

/** Som van TSS (Activiteiten kol I) voor alle ritten met datum (kol A) >= startDate. */
function sumTssVanafDatum_(ss, startDate) {
  var sh = ss.getSheetByName(ACTIVITEITEN_SHEET);
  if (!sh) return 0;
  var last = sh.getLastRow();
  if (last < 2) return 0;
  var data = sh.getRange(2, 1, last - 1, ACT_HEADERS.length).getValues();
  var s0 = stripTime_(startDate).getTime();
  var sum = 0;
  data.forEach(function (r) {
    if (!(r[0] instanceof Date)) return;
    if (stripTime_(r[0]).getTime() < s0) return;
    if (r[8] !== '' && r[8] != null) sum += Number(r[8]) || 0;
  });
  return Math.round(sum);
}

/** Oudste Activiteiten-rij (= vroegste datum) → begin-anker voor niveau-historie.
 *  Kolommen: A datum(0), M FTP(12), N Gewicht(13). Null bij ontbreken/pre-backfill. */
function dashBeginAnker_(ss) {
  var sh = ss.getSheetByName(ACTIVITEITEN_SHEET);
  if (!sh) return null;
  var last = sh.getLastRow();
  if (last < 2) return null;
  var data = sh.getRange(2, 1, last - 1, ACT_HEADERS.length).getValues();
  var oudste = null;
  data.forEach(function (r) {
    if (!(r[0] instanceof Date)) return;
    if (!oudste || stripTime_(r[0]).getTime() < stripTime_(oudste[0]).getTime()) oudste = r;
  });
  if (!oudste) return null;
  return {
    datum: oudste[0],
    ftp: (oudste[12] !== '' && oudste[12] != null) ? Number(oudste[12]) : null,
    gewicht: (oudste[13] !== '' && oudste[13] != null) ? Number(oudste[13]) : null
  };
}

/**
 * 2c: niveau (0–50 W/kg-metric) per kalendermaand, begin-ankermaand → nu.
 * Onafhankelijk van vorm.reeks (Wellness ~30d). Per maand = ftp+gewicht van
 * de LAATSTE rij (op datum) met beide gevuld; begin-ankermaand = exact
 * beginNiveau. Ontbrekende maand → niveau:null (chart interpoleert).
 * Shape: [{maand:'yyyy-MM', niveau:Number|null, ftp:Number|null, gewicht:Number|null}].
 */
function dashNiveauReeks_(ss) {
  var sh = ss.getSheetByName(ACTIVITEITEN_SHEET);
  if (!sh) return [];
  var last = sh.getLastRow();
  if (last < 2) return [];
  var data = sh.getRange(2, 1, last - 1, ACT_HEADERS.length).getValues();

  var byMonth = {};   // 'yyyy-MM' → { t, ftp, gewicht } (laatste-op-datum met beide gevuld)
  data.forEach(function (r) {
    if (!(r[0] instanceof Date)) return;
    var ftp = (r[12] !== '' && r[12] != null) ? Number(r[12]) : null;
    var gew = (r[13] !== '' && r[13] != null) ? Number(r[13]) : null;
    if (ftp == null || gew == null) return;
    var mk = formatDate(r[0], 'yyyy-MM');
    var t = stripTime_(r[0]).getTime();
    if (!byMonth[mk] || t > byMonth[mk].t) byMonth[mk] = { t: t, ftp: ftp, gewicht: gew };
  });

  var anker = dashBeginAnker_(ss);
  if (!anker || !anker.datum) return [];
  // Begin-ankermaand overschrijven zodat punt 1 EXACT beginNiveau is.
  if (anker.ftp) {
    byMonth[formatDate(anker.datum, 'yyyy-MM')] =
      { t: stripTime_(anker.datum).getTime(), ftp: anker.ftp, gewicht: anker.gewicht || null };
  }

  var huidigGewicht = getGewicht();
  var now = new Date();
  var out = [];
  var cur = new Date(anker.datum.getFullYear(), anker.datum.getMonth(), 1);
  while (cur.getFullYear() < now.getFullYear() ||
         (cur.getFullYear() === now.getFullYear() && cur.getMonth() <= now.getMonth())) {
    var mk2 = formatDate(cur, 'yyyy-MM');
    var b = byMonth[mk2];
    var niveau = null, ftpM = null, gewM = null;
    if (b) {
      ftpM = b.ftp; gewM = b.gewicht;
      var nv = computeNiveau_(ftpM, gewM || huidigGewicht);
      niveau = nv.niveau != null ? Math.round(nv.niveau * 10) / 10 : null;
    }
    out.push({ maand: mk2, niveau: niveau, ftp: ftpM, gewicht: gewM });
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  return out;
}

// ── Dag-kaart bouwer (gedeeld door Vandaag + Kalender) ───────────
function dashDayCard_(dISO, wpEntry, actual, rpe) {
  var voorstel = null;
  if (wpEntry) {
    // Optie B: blokken indien aanwezig (huidige week na generatie), anders
    // intent-fallback (oudere snapshots zonder blokken).
    var segs = segmentsFromBlokken_(wpEntry.blokken) || segmentsFromIntent_(wpEntry.intent);
    voorstel = {
      type: wpEntry.workoutType || null,
      titel: wpEntry.naam || wpEntry.workoutType || 'Training',
      duurMin: wpEntry.minuten || 0,
      tss: wpEntry.tss || 0,
      segmenten: segs
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

/**
 * W/kg-anker → niveau (0–50). Bewust stabiel: beweegt alleen op FTP/gewicht.
 * De taper-bewuste conditie-modifier komt pas in 2b. Pure helper.
 */
function computeNiveau_(ftp, gewicht) {
  if (!ftp || !gewicht) return { wkg: null, niveau: null };
  var wkg = ftp / gewicht;
  var WKG_LOW = 1.0, WKG_HIGH = 6.9, LVL_MAX = 50;  // ankers: 1,0 W/kg=0 / 6,9 W/kg=50
  var niveau = (wkg - WKG_LOW) / (WKG_HIGH - WKG_LOW) * LVL_MAX;
  niveau = Math.max(0, Math.min(LVL_MAX, niveau));
  return { wkg: wkg, niveau: niveau };
}

/**
 * CTL-gedreven conditie-modifier op het W/kg-anker (2b-1). Band-capped op
 * ±BAND niveau-punten; dalen toegestaan (geen taper-freeze). ctlRef = CTL
 * aan het begin van het zichtbare venster. Geen data → 0.
 */
function computeConditieMod_(ctlNow, ctlRef) {
  if (ctlNow == null || ctlRef == null) return 0;
  var CTL_SPAN = 10, BAND = 2.0;   // ±10 CTL-verandering = ±2,0 niveau-punten; tunable
  var raw = (ctlNow - ctlRef) / CTL_SPAN * BAND;
  return Math.max(-BAND, Math.min(BAND, raw));
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

  // ── Dagen: venster [vandaag−28d (geklemd op vroegste data) … vandaag+7d] ──
  // Continu per kalenderdag (rustdagen inbegrepen), date-only setDate-stepping
  // (DST-immuun). Week+1-beschikbaarheid (Weekplanner+1) wordt als previewMin
  // in de loop meegenomen voor toekomstige dagen zonder uitgewerkt voorstel.
  var plus1Avail = {};   // dISO → minuten beschikbaarheid (volgende week)
  try {
    var plus1 = ss.getSheetByName(WEEKPLANNER_PLUS1_SHEET);
    if (plus1 && plannerHasData_(plus1)) {
      var p1 = plus1.getRange(3, 1, 7, 8).getValues();
      for (var pi = 0; pi < 7; pi++) {
        if (!(p1[pi][2] instanceof Date)) continue;
        plus1Avail[formatDate(p1[pi][2], 'yyyy-MM-dd')] =
          (p1[pi][0] === true ? (Number(p1[pi][3]) || 0) : null);
      }
    }
  } catch (e) {}

  var dagen = [];
  var lowerBound = stripTime_(new Date(today.getTime() - 28 * 86400000));
  // Klem ondergrens op de vroegste datum in actuals/weekplan (geen lege voorloop).
  var earliest = null;
  [actuals, wpByDate].forEach(function (m) {
    Object.keys(m).forEach(function (k) {
      var kt = stripTime_(new Date(k)).getTime();
      if (kt <= today.getTime() && (earliest === null || kt < earliest)) earliest = kt;
    });
  });
  if (earliest !== null && earliest > lowerBound.getTime()) lowerBound = new Date(earliest);
  var upperBound = stripTime_(new Date(today.getTime() + 7 * 86400000));
  var d = new Date(lowerBound.getFullYear(), lowerBound.getMonth(), lowerBound.getDate());
  while (d.getTime() <= upperBound.getTime()) {
    var dISO = formatDate(d, 'yyyy-MM-dd');
    var card = dashDayCard_(dISO, wpByDate[dISO], actuals[dISO], rpeFor(dISO));
    var isToday = dISO === todayISO;
    var isFuture = d.getTime() > today.getTime();
    var status, kleur = null, previewMin = null;
    if (isToday)                      { status = 'vandaag'; }
    else if (actuals[dISO])           { status = 'voltooid'; }
    else if (card.voorstel)           { status = 'gepland'; }
    else if (isFuture && plus1Avail[dISO] != null) { status = 'preview'; previewMin = plus1Avail[dISO]; }
    else                              { status = 'rust'; }
    if (card.voorstel) {
      var seg0 = card.voorstel.segmenten[card.voorstel.segmenten.length - 1];
      kleur = seg0 ? seg0.kleur : '#90a4ae';
    } else if (status === 'preview') { kleur = '#b0bec5'; }
    dagen.push({
      dateISO: dISO, weekdag: dashWeekdag_(d), kort: dashKort_(d),
      status: status, kleur: kleur,
      voorstel: card.voorstel, actual: card.actual, previewMin: previewMin
    });
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);  // DST-immuun
  }

  // ── Vorm ──
  var reeks = dashVormReeks_();
  var statsBundle = dashStatsFromActivities_();
  // Event-countdown uit bepaalFaseVoorDatum_ (al berekend in `macro`).
  var evDatum = macro.eventDate || (macro.hoofdEvent && macro.hoofdEvent.datum) || null;
  var dagenTot = null;
  if (evDatum) {
    var dt = Math.round((stripTime_(new Date(evDatum)).getTime() - today.getTime()) / 86400000);
    dagenTot = dt >= 0 ? dt : null;
  }
  var vorm = {
    reeks: reeks,
    niveauReeks: dashNiveauReeks_(ss),
    huidig: fs ? { vorm: Math.round(fs.form), vormZone: fs.label, ctl: Math.round(fs.ctl), atl: Math.round(fs.atl), ramp: fs.ramp != null ? Math.round(fs.ramp * 100) / 100 : null } : null,
    stats: statsBundle.stats,
    spanDagen: statsBundle.spanDagen,
    eersteDatum: statsBundle.eersteDatum,
    ftp: settings.ftp || null,
    macroFase: macro.fase || null,
    rampBuildMin: (typeof RAMP_BUILD_MIN !== 'undefined') ? RAMP_BUILD_MIN : 3,
    garminVerdict: garminVerdict,
    event: {
      naam: macro.eventName || (macro.hoofdEvent && macro.hoofdEvent.naam) || null,
      datum: evDatum ? formatDate(new Date(evDatum), 'yyyy-MM-dd') : null,
      dagenTot: dagenTot
    }
  };

  var gewicht = getGewicht();
  var niv = computeNiveau_(settings.ftp, gewicht);

  // 2b-1: conditie-modifier op het anker. ctlNow = actuele CTL; ctlRef =
  // gemiddelde CTL over de oudste min(7, span) punten van vorm.reeks
  // (= waar dit venster begon). Reeks leeg → ctlRef = ctlNow → mod 0.
  var ctlNow = (vorm.huidig && vorm.huidig.ctl != null) ? vorm.huidig.ctl : null;
  var ctlRef = ctlNow;
  if (reeks && reeks.length) {
    var head = reeks.slice(0, Math.min(7, reeks.length));
    var sum = 0, cnt = 0;
    head.forEach(function (r) { if (r.ctl != null) { sum += r.ctl; cnt++; } });
    if (cnt) ctlRef = sum / cnt;
  }
  var niveauBasis = niv.niveau;
  var conditieMod = computeConditieMod_(ctlNow, ctlRef);
  var niveauLevend = (niveauBasis == null) ? null
    : Math.max(0, Math.min(50, niveauBasis + conditieMod));

  // 2b-3: beginniveau-anker uit de oudste Activiteiten-rij (icu_ftp/icu_weight).
  // conditieModBegin = 0 (data-start = referentie; Wellness-tab reikt niet tot 2024).
  var DASH_MND_ = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
  var anker = dashBeginAnker_(ss);
  var beginNiveau = null, beginLabel = null, niveauDelta = null;
  if (anker && anker.ftp) {
    var nivBegin = computeNiveau_(anker.ftp, anker.gewicht || gewicht);
    if (nivBegin.niveau != null) {
      beginNiveau = Math.max(0, Math.min(50, nivBegin.niveau));   // conditieMod 0
      var bd = anker.datum;
      beginLabel = DASH_MND_[bd.getMonth()] + " '" + String(bd.getFullYear()).slice(-2);
      if (niveauLevend != null) niveauDelta = Math.round((niveauLevend - beginNiveau) * 10) / 10;
    }
  }

  // 2b-2: voortgang% = adherence over VOLTOOIDE weken sinds doelStart. Per week
  // (uren/week × tssPerUur), de lopende week valt eruit (geen mid-week-dip).
  // Bij 0 voltooide weken → null (frontend toont "blok net gestart").
  var jaarTSS = (statsBundle.stats && statsBundle.stats.jaar) ? statsBundle.stats.jaar.tss : 0;
  var jaarUren = (statsBundle.stats && statsBundle.stats.jaar) ? statsBundle.stats.jaar.tijdMin / 60 : 0;
  var tssPerUur = jaarUren > 0 ? jaarTSS / jaarUren : 54;

  var vt = getVolumeTargets();
  // eersteWeekStart = eerste maandag >= doelStart (partiële eerste week valt af).
  var eersteWeekStart = weekStartDate(settings.doelStart);
  if (eersteWeekStart.getTime() < stripTime_(settings.doelStart).getTime()) {
    eersteWeekStart = new Date(eersteWeekStart.getFullYear(), eersteWeekStart.getMonth(), eersteWeekStart.getDate() + 7);
  }
  var huidigeWeekStart = weekStartDate(today);

  var verwachtTssCum = null, werkelijkTssCum = null, voortgangPct = null;
  var aantalVoltooideWeken = 0;
  var verwachtCum = 0;
  var wkM = new Date(eersteWeekStart.getFullYear(), eersteWeekStart.getMonth(), eersteWeekStart.getDate());
  while (wkM.getTime() < huidigeWeekStart.getTime()) {
    var wkFase = bepaalFaseVoorDatum_(wkM).fase;
    var band = vt[wkFase] || vt.Build || [4, 7];   // Test/onbekend → Build-fallback
    verwachtCum += ((band[0] + band[1]) / 2) * tssPerUur;   // per week, geen /7
    aantalVoltooideWeken++;
    wkM = new Date(wkM.getFullYear(), wkM.getMonth(), wkM.getDate() + 7);
  }
  if (aantalVoltooideWeken > 0) {
    verwachtTssCum = Math.round(verwachtCum);
    // aftrek-truc: [eersteWeekStart, huidigeWeekStart) = voltooide weken.
    werkelijkTssCum = sumTssVanafDatum_(ss, eersteWeekStart) - sumTssVanafDatum_(ss, huidigeWeekStart);
    voortgangPct = verwachtTssCum > 0 ? Math.round(werkelijkTssCum / verwachtTssCum * 100) : null;
  }

  return {
    athlete: { ftp: settings.ftp || null, naam: '' },
    ftp: settings.ftp || null,
    gewicht: gewicht || null,
    wkg: niv.wkg,
    niveau: niveauLevend,
    niveauBasis: niveauBasis,
    conditieMod: conditieMod,
    ctlRef: ctlRef != null ? Math.round(ctlRef * 10) / 10 : null,
    voortgangPct: voortgangPct,
    werkelijkTssCum: werkelijkTssCum,
    verwachtTssCum: verwachtTssCum,
    tssPerUur: Math.round(tssPerUur * 10) / 10,
    beginNiveau: beginNiveau,
    beginLabel: beginLabel,
    niveauDelta: niveauDelta,
    availability: planner.map(function (p) {
      return { train: p.train === true, minuten: p.minuten || 0, dagtype: p.type || '', dagLabel: p.dag };
    }),
    dagtypeOptions: DAGTYPE_OPTIONS,
    vandaag: vandaag,
    dagen: dagen,
    vorm: vorm,
    maandTotalen: statsBundle.maandTotalen
  };
}

/**
 * v2a write-pad: schrijf beschikbaarheid terug naar 'Weekplanner' (A/D/E,
 * rijen 3-9). Server-side gevalideerd vóór write. Schrijft ECHTE numbers
 * (setValues, geen formules → NL-locale-formuletrap niet van toepassing).
 * F (toelichting) + H (gedaan) blijven ongemoeid. Returnt verse state
 * (atomic write+refresh in één round-trip).
 *
 * @param {Array<{train, minuten, dagtype}>} updates  index 0-6 = rij 3-9
 */
function saveAvailability(updates) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(PLANNER_SHEET);
  if (!sh) throw new Error('Tab "Weekplanner" ontbreekt.');
  updates = updates || [];
  var trainCol = [], minCol = [], typeCol = [];
  for (var i = 0; i < 7; i++) {
    var u = updates[i] || {};
    var dt = String(u.dagtype || '');
    if (DAGTYPE_OPTIONS.indexOf(dt) < 0) dt = '';        // onbekend → leeg (geen validatie-break)
    var min = Number(u.minuten);
    if (isNaN(min) || min < 0) min = 0;
    if (min > 600) min = 600;
    trainCol.push([u.train === true]);
    minCol.push([min]);
    typeCol.push([dt]);
  }
  sh.getRange(3, 1, 7, 1).setValues(trainCol);   // A3:A9 Train?
  sh.getRange(3, 4, 7, 1).setValues(minCol);     // D3:D9 Minuten
  sh.getRange(3, 5, 7, 1).setValues(typeCol);    // E3:E9 Dagtype
  return getDashboardState();
}
