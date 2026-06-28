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
  var output = HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle('Cadans')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  // PNG-favicon via jsDelivr (juiste content-type). CRASH-VEILIG: setFaviconUrl throwt
  // op niet-ondersteunde/onbereikbare types → NOOIT uit doGet laten ontsnappen.
  try { output.setFaviconUrl('https://cdn.jsdelivr.net/gh/daanhhk/training@main/favicon.png'); }
  catch (e2) { Logger.log('favicon skip: ' + e2); }
  return output;
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
    segs.push({ minuten: min, bucket: b.zone, kleur: st.kleur, hoogtePct: st.hoogtePct, pctLo: b.pctLo, pctHi: b.pctHi });
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

// ── PERF: single-read helpers (open-flow) ────────────────────────
// Lees elke grote tab ÉÉN keer en thread de array door alle consumenten. De
// arrays zijn EXACT de sub-range die de consumenten vandaag zelf lezen (rij 2..,
// kolom-cap) — NIET getDataRange(), die de header-rij + (Wellness) de stats-rijen
// >= WELL_STATS_ROW zou meenemen en getWellnessSignal's ongeguarde map verschuiven.
function readActiviteitenValues_() {
  var sh = SpreadsheetApp.getActive().getSheetByName(ACTIVITEITEN_SHEET);
  if (!sh) return null;
  var last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, ACT_HEADERS.length).getValues();
}
function readWellnessValues_() {
  var sh = SpreadsheetApp.getActive().getSheetByName(WELLNESS_SHEET);
  if (!sh) return null;
  var last = Math.min(sh.getLastRow(), WELL_STATS_ROW - 2);
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, WELL_HEADERS.length).getValues();
}

/**
 * Single-pass scan over de Activiteiten-tab-array (idx0..15). Vult in ÉÉN
 * iteratie de accumulators voor dashActualsByDate_ / dashStatsFromActivities_ /
 * dashBeginAnker_ / dashNiveauReeks_ (READ-ONCE-THREAD). De vier outputs blijven
 * byte-identiek aan de losse fns; deze collapse't 4 (5 incl. niveau's interne
 * anker-call) full-passes naar 1. `empty` = de truthy-lege-actValues-tak van stats.
 */
function dashActivityScan_(actValues) {
  var scan = {
    actualsByDate: {},
    stats: { d7: { tss: 0, tijdMin: 0, ritten: 0 }, d28: { tss: 0, tijdMin: 0, ritten: 0 }, jaar: { tss: 0, tijdMin: 0, ritten: 0 } },
    maand: {}, oudsteT: null, oudsteRow: null, byMonth: {},
    now: stripTime_(new Date()).getTime(),
    empty: (!actValues || !actValues.length)
  };
  if (!actValues || !actValues.length) return scan;
  var actTByKey = {};   // per datum-key de winnaar-timestamp (idx0 incl. tijd) — volgorde-onafhankelijk
  actValues.forEach(function (r) {
    if (!(r[0] instanceof Date)) return;
    var d = r[0];
    var key = formatDate(d, 'yyyy-MM-dd');
    var mk  = formatDate(d, 'yyyy-MM');
    var t   = stripTime_(d).getTime();

    // (1) actualsByDate — HOOGSTE idx0-timestamp per datum wint (volgorde-onafhankelijk).
    // NB: t is stripTime'd (middernacht) en scheidt same-day-ritten niet → vergelijk op d.getTime().
    var tFull = d.getTime();
    if (!(key in actTByKey) || tFull > actTByKey[key]) {
      actTByKey[key] = tFull;
      scan.actualsByDate[key] = {
        naam: String(r[2] || 'Rit'),
        duurMin: Number(r[3]) || 0,
        tss: r[8] !== '' && r[8] != null ? Number(r[8]) : null,
        ifReal: r[7] !== '' && r[7] != null ? Number(r[7]) : null   // IF (idx7) — coach-engine
      };
    }

    // (2) stats: d7/d28/jaar-buckets + maandtotalen + oudste t
    var min = Number(r[3]) || 0;
    var tss = (r[8] !== '' && r[8] != null) ? Number(r[8]) : 0;
    var ageDays = (scan.now - t) / 86400000;
    if (ageDays >= 0 && ageDays < 7)   { scan.stats.d7.tss   += tss; scan.stats.d7.tijdMin   += min; scan.stats.d7.ritten++; }
    if (ageDays >= 0 && ageDays < 28)  { scan.stats.d28.tss  += tss; scan.stats.d28.tijdMin  += min; scan.stats.d28.ritten++; }
    if (ageDays >= 0 && ageDays < 365) { scan.stats.jaar.tss += tss; scan.stats.jaar.tijdMin += min; scan.stats.jaar.ritten++; }
    if (!scan.maand[mk]) scan.maand[mk] = { maand: mk, ritten: 0, tijdMin: 0, tss: 0 };
    scan.maand[mk].ritten++; scan.maand[mk].tijdMin += min; scan.maand[mk].tss += tss;
    if (scan.oudsteT === null || t < scan.oudsteT) scan.oudsteT = t;

    // (3) oudste ROW (niveau-anker) — eerste-min-wint (strikt <, byte-identiek aan dashBeginAnker_)
    if (!scan.oudsteRow || t < stripTime_(scan.oudsteRow[0]).getTime()) scan.oudsteRow = r;

    // (4) byMonth (niveau) — laatste-op-datum met BEIDE ftp(idx12)+gewicht(idx13) gevuld
    var ftp = (r[12] !== '' && r[12] != null) ? Number(r[12]) : null;
    var gew = (r[13] !== '' && r[13] != null) ? Number(r[13]) : null;
    if (ftp != null && gew != null) {
      if (!scan.byMonth[mk] || t > scan.byMonth[mk].t) scan.byMonth[mk] = { t: t, ftp: ftp, gewicht: gew };
    }
  });
  return scan;
}

/** Oudste-rij → niveau/anker-object {datum, ftp, gewicht} (idx0/12/13), null bij geen rij. */
function _ankerFromRow_(row) {
  if (!row) return null;
  return {
    datum: row[0],
    ftp: (row[12] !== '' && row[12] != null) ? Number(row[12]) : null,
    gewicht: (row[13] !== '' && row[13] != null) ? Number(row[13]) : null
  };
}

/** Activiteiten-tab → map dISO → {naam, duurMin, tss, ifReal} (nieuwste wint).
 *  actValues (optioneel) = voor-gelezen readActiviteitenValues_() — anders zelf-lezen.
 *  scan (optioneel) = gedeelde dashActivityScan_ (READ-ONCE-THREAD). */
function dashActualsByDate_(actValues, scan) {
  if (!scan) scan = dashActivityScan_(actValues || readActiviteitenValues_());
  return scan.actualsByDate;
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

/** Alle disposition_<dISO> snapshots → map dISO → {reason}. (Fase 3c) */
function dashDispositionsByDate_() {
  var props = PropertiesService.getDocumentProperties().getProperties();
  var out = {};
  Object.keys(props).forEach(function (k) {
    if (k.indexOf('disposition_') !== 0) return;
    try {
      var o = JSON.parse(props[k]);
      if (o && o.reason) out[k.substring('disposition_'.length)] = { reason: o.reason };
    } catch (e) {}
  });
  return out;
}

/** Alle override_<dISO> snapshots → map dISO → {type, workoutType, variantId, durMin, ...}. (Fase 4) */
function dashOverridesByDate_() {
  var props = PropertiesService.getDocumentProperties().getProperties();
  var out = {};
  Object.keys(props).forEach(function (k) {
    if (k.indexOf('override_') !== 0) return;
    try {
      var o = JSON.parse(props[k]);
      if (o && o.type) out[k.substring('override_'.length)] = o;
    } catch (e) {}
  });
  return out;
}

/** Wellness-tab CTL/ATL/Vorm reeks (oudste→nieuwste) + stats-bron. */
function dashVormReeks_(wellValues) {
  if (!wellValues) wellValues = readWellnessValues_();
  var out = [];
  if (!wellValues || !wellValues.length) return out;
  var data = wellValues;
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
//  scan (optioneel) = gedeelde dashActivityScan_ (READ-ONCE-THREAD); anders zelf-lezen.
function dashStatsFromActivities_(actValues, scan) {
  if (!scan) scan = dashActivityScan_(actValues || readActiviteitenValues_());
  var res = {
    d7:   { tss: Math.round(scan.stats.d7.tss),   tijdMin: scan.stats.d7.tijdMin,   ritten: scan.stats.d7.ritten },
    d28:  { tss: Math.round(scan.stats.d28.tss),  tijdMin: scan.stats.d28.tijdMin,  ritten: scan.stats.d28.ritten },
    jaar: { tss: Math.round(scan.stats.jaar.tss), tijdMin: scan.stats.jaar.tijdMin, ritten: scan.stats.jaar.ritten }
  };
  if (scan.empty) return { stats: res, maandTotalen: [] };
  var maandArr = Object.keys(scan.maand).sort().reverse().slice(0, 12).map(function (k) {
    var m = scan.maand[k];
    return { maand: m.maand, ritten: m.ritten, tijdMin: m.tijdMin, tss: Math.round(m.tss) };
  });
  // Werkelijke historie-span: de Activiteiten-tab wordt door syncActivities
  // met getActivities(28) gevoed → ~28 dagen, dus "jaar" == d28. Geef de span
  // mee zodat de client het jaar-label eerlijk kan degraderen.
  var oudste = scan.oudsteT;
  var spanDagen = oudste !== null ? Math.round((scan.now - oudste) / 86400000) : 0;
  return {
    stats: res, maandTotalen: maandArr,
    spanDagen: spanDagen,
    eersteDatum: oudste !== null ? formatDate(new Date(oudste), 'yyyy-MM-dd') : null
  };
}

/** Som van TSS (Activiteiten kol I) voor alle ritten met datum (kol A) >= startDate. */
function sumTssVanafDatum_(ss, startDate, actValues) {
  if (!actValues) actValues = readActiviteitenValues_();
  if (!actValues || !actValues.length) return 0;
  var data = actValues;
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
 *  Kolommen: A datum(0), M FTP(12), N Gewicht(13). Null bij ontbreken/pre-backfill.
 *  scan (optioneel) = gedeelde dashActivityScan_ (READ-ONCE-THREAD). */
function dashBeginAnker_(ss, actValues, scan) {
  if (!scan) scan = dashActivityScan_(actValues || readActiviteitenValues_());
  return _ankerFromRow_(scan.oudsteRow);
}

/**
 * 2c: niveau (0–50 W/kg-metric) per kalendermaand, begin-ankermaand → nu.
 * Onafhankelijk van vorm.reeks (Wellness ~30d). Per maand = ftp+gewicht van
 * de LAATSTE rij (op datum) met beide gevuld; begin-ankermaand = exact
 * beginNiveau. Ontbrekende maand → niveau:null (chart interpoleert).
 * Shape: [{maand:'yyyy-MM', niveau:Number|null, ftp:Number|null, gewicht:Number|null}].
 */
function dashNiveauReeks_(ss, actValues, scan) {
  if (!scan) scan = dashActivityScan_(actValues || readActiviteitenValues_());

  var anker = _ankerFromRow_(scan.oudsteRow);
  if (!anker || !anker.datum) return [];

  // byMonth uit de gedeelde scan; clone vóór de anker-overwrite zodat scan.byMonth
  // ongemoeid blijft (byte-identiek aan de oude lokale-byMonth-semantiek).
  var byMonth = {};
  Object.keys(scan.byMonth).forEach(function (k) { byMonth[k] = scan.byMonth[k]; });
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

// ── Niveau-tab (Fase 7) — W/kg- + fitheid(CTL)-progressie (PURE; getest) ──
// Maandelijkse CTL uit een daily PMC (exp-gewogen TSS, 42d-tau) over de
// Activiteiten-historie (idx0 datum, idx8 TSS; alle sporten = totale load, net als
// intervals.icu). CTL[d] = CTL[d-1] + (TSS[d] − CTL[d-1])/42; maand-eind wint.
// actValues = readActiviteitenValues_()-array. Returnt {'yyyy-MM': ctl} (1 dec).
var PMC_TAU_ = 42;
function ctlReeksMaandelijks_(actValues) {
  if (!actValues || !actValues.length) return {};
  var byDay = {}, minD = null, maxD = null;
  actValues.forEach(function (r) {
    if (!(r[0] instanceof Date)) return;
    var d = stripTime_(r[0]), t = d.getTime();
    var tss = (r[8] !== '' && r[8] != null) ? (Number(r[8]) || 0) : 0;
    byDay[t] = (byDay[t] || 0) + tss;
    if (minD === null || t < minD.getTime()) minD = d;
    if (maxD === null || t > maxD.getTime()) maxD = d;
  });
  if (minD === null) return {};
  var out = {}, ctl = 0;
  var cur = new Date(minD.getFullYear(), minD.getMonth(), minD.getDate());
  var endT = maxD.getTime();
  while (cur.getTime() <= endT) {
    var tss = byDay[cur.getTime()] || 0;
    ctl = ctl + (tss - ctl) / PMC_TAU_;
    out[formatDate(cur, 'yyyy-MM')] = Math.round(ctl * 10) / 10;   // maand-eind = laatste dag wint
    cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);   // DST-immuun
  }
  return out;
}

// niveau-reeks (maand) + ctl-map → progressie-series [{maand, niveau, wkg, ctl}].
// W/kg = ftp/gewicht (2 dec) per punt; ctl = maand-CTL of null. PURE.
function niveauProgressie_(niveauReeks, ctlByMonth) {
  if (!Array.isArray(niveauReeks)) return [];
  ctlByMonth = ctlByMonth || {};
  return niveauReeks.map(function (p) {
    var wkg = (p.ftp && p.gewicht) ? Math.round(p.ftp / p.gewicht * 100) / 100 : null;
    return {
      maand: p.maand,
      niveau: (p.niveau != null) ? p.niveau : null,
      wkg: wkg,
      ctl: (ctlByMonth[p.maand] != null) ? ctlByMonth[p.maand] : null
    };
  });
}

// ════════════════════════════════════════════════════════════════
// NIVEAU FASE-2 §c — power-curve (mean-max) normalisatie (PUUR; getest).
// ════════════════════════════════════════════════════════════════
var PC_MARKERS_ = [
  { sec: 5, label: '5s', key: false }, { sec: 60, label: '1m', key: false },
  { sec: 300, label: '5m', key: true }, { sec: 1200, label: '20m', key: true }, { sec: 3600, label: '60m', key: true }
];
// Coggan-stijl rijderstype: per-duur W/kg → score t.o.v. [recreatief, wereldklasse]; korte vs lange duren.
// Referentieparen + gevoeligheid/banden TUNEBAAR (sluit aan op intervals.icu's 4-anker-profiel).
var PP_REF_5S_ = [9.7, 24.0], PP_REF_60S_ = [5.5, 11.5], PP_REF_5M_ = [3.4, 7.6], PP_REF_FT_ = [2.8, 6.4];
var PP_SENS_ = 2.0, PP_BAND_LO_ = 0.42, PP_BAND_HI_ = 0.58;

// Marker op de duur >= targetSec dichtstbij (exact of eerstvolgende); null als geen.
function pcMarkerAt_(secs, values, wkg, actIds, targetSec) {
  if (!secs || !secs.length) return null;
  for (var i = 0; i < secs.length; i++) {
    if (secs[i] >= targetSec) {
      var w = (values && values[i] != null) ? values[i] : null;
      if (w == null) return null;
      return { secs: secs[i], watts: Math.round(w),
               wkg: (wkg && wkg[i] != null) ? Math.round(wkg[i] * 100) / 100 : null,
               activityId: (actIds && actIds[i] != null) ? actIds[i] : null };
    }
  }
  return null;
}

// 4 anker-W/kg (5s/60s/5m/eFTP) → rijderstype-positie 0..1 (0=Diesel·klimmer .. 1=Sprinter) + label.
// Coggan-stijl: korte duren (5s+60s) vs lange (5m+eFTP), elk gescoord t.o.v. recreatief↔wereldklasse.
function riderTypeFromCurve_(wkg5, wkg60, wkg300, ftWkg) {
  if (wkg5 == null || wkg60 == null || wkg300 == null || ftWkg == null) return null;
  function score(w, ref) { return Math.max(0, Math.min(1, (w - ref[0]) / (ref[1] - ref[0]))); }
  var shortAvg = (score(wkg5, PP_REF_5S_) + score(wkg60, PP_REF_60S_)) / 2;
  var longAvg = (score(wkg300, PP_REF_5M_) + score(ftWkg, PP_REF_FT_)) / 2;
  var pos = Math.max(0, Math.min(1, 0.5 + (shortAvg - longAvg) * PP_SENS_));
  var label = (pos < PP_BAND_LO_) ? 'Diesel · klimmer' : (pos > PP_BAND_HI_ ? 'Sprinter' : 'All-rounder');
  return { pos: Math.round(pos * 100) / 100, label: label };
}

// power-curves list[0] (+ activities-map) → genormaliseerd profiel (PUUR). curve = punten
// secs<=3600 (60min-cap), null/≤0-watt overgeslagen; markers op PC_MARKERS_; date per marker
// uit activities[activityId] (start_date_local → date → null).
function pcNormalize_(c, activities, ftp) {
  if (!c || !c.secs || !c.secs.length || !c.values) return { empty: true };
  activities = activities || {};
  var secs = c.secs, vals = c.values, wkg = c.watts_per_kg || [], actIds = c.activity_id || [];
  var curve = [];
  for (var i = 0; i < secs.length; i++) {
    if (secs[i] > 3600) break;                       // 60min-cap (secs oplopend)
    var w = vals[i];
    if (w == null || w <= 0) continue;               // null/0-watt overslaan
    curve.push({ secs: secs[i], watts: Math.round(w) });
  }
  if (!curve.length) return { empty: true };
  var markers = [];
  PC_MARKERS_.forEach(function (M) {
    var mk = pcMarkerAt_(secs, vals, wkg, actIds, M.sec);
    if (!mk || mk.watts == null || mk.watts <= 0) return;
    var date = null;
    if (mk.activityId != null && activities[mk.activityId]) {
      var am = activities[mk.activityId];
      date = am.start_date_local || am.date || null;
    }
    markers.push({ secs: mk.secs, label: M.label, key: M.key, watts: mk.watts, wkg: mk.wkg, activityId: mk.activityId, date: date });
  });
  // Rijderstype op 4 ankers (W/kg): 5s/60s/5m uit de markers; eFTP-W/kg = ftp/gewicht,
  // null-guard → val terug op de 20min-marker-wkg (≈ FTP-proxy).
  function mwkg_(lbl) { var f = null; markers.forEach(function (m) { if (m.label === lbl) f = m; }); return (f && f.wkg != null) ? f.wkg : null; }
  var ftWkg = (ftp && c.weight) ? (ftp / c.weight) : null;
  if (ftWkg == null) ftWkg = mwkg_('20m');
  return {
    window: { label: c.label || null, days: c.days || null, start: c.start_date_local || null, end: c.end_date_local || null },
    weight: (c.weight != null) ? c.weight : null,
    curve: curve, markers: markers,
    riderType: riderTypeFromCurve_(mwkg_('5s'), mwkg_('1m'), mwkg_('5m'), ftWkg)
  };
}

// eFTP (API-vrij): recentste niet-lege idx14 ("Rolling FTP") uit de Activiteiten-array (newest-first).
function eftpFromActivities_(actValues) {
  if (!actValues || !actValues.length) return null;
  // Volgorde-onafhankelijk: de geldige Rolling-FTP (idx14) van de rij met de HOOGSTE
  // idx0-timestamp wint (niet de eerste array-positie). Geldigheids-check identiek.
  var bestT = -Infinity, bestV = null;
  for (var i = 0; i < actValues.length; i++) {
    var v = actValues[i][14];
    if (v === '' || v == null || isNaN(Number(v)) || Number(v) <= 0) continue;
    var d0 = actValues[i][0];
    var t = (d0 instanceof Date && !isNaN(d0.getTime())) ? d0.getTime() : -Infinity;  // ondateerbaar → laagste prio
    if (bestV === null || t > bestT) { bestT = t; bestV = Number(v); }
  }
  return bestV != null ? Math.round(bestV) : null;
}

// ════════════════════════════════════════════════════════════════
// NIVEAU FASE-2 §d — doel-gereedheid + projectie (PUUR; getest).
// Eerlijkheid = ontwerp-eis: SOLIDE volume→CTL-ramp vs SPECULATIEVE FTP-band.
// ════════════════════════════════════════════════════════════════
// Swap-able doel-seam: generaliseert voorbij Girona. Per dim {metric, target, unit, dir}.
var GOAL_PROFILES_ = {
  girona: { key: 'girona', label: 'Girona', sub: '~90 km · 1200 hm/dag · lange klimmen', projectieMode: 'gap', dims: [
    { key: 'klim', label: 'Klimvermogen', metric: 'ftpWkg', target: 4.0, unit: 'W/kg', dir: 'up' },
    { key: 'duur', label: 'Duurvermogen', metric: 'ctl', target: 65, unit: 'CTL', dir: 'up' },
    { key: 'lang', label: 'Lange-rit', metric: 'longRideH', target: 4.0, unit: 'u', dir: 'up' }
  ] },
  // FTP-doel: 'test'-projectiemodus — vaste testdatum + gegeven volume → "wat te verwachten op
  // testdag". De duur-dim (CTL 65) blijft voor chain-robuustheid maar is ONGEBRUIKT in test-modus
  // (geen gap-rij/target-lijn); de ftpBandFromProjection_-band (gevoed met ctlAtTest) IS de doel-uitspraak.
  ftp: { key: 'ftp', label: 'FTP', sub: 'opbouw naar FTP-test', projectieMode: 'test', dims: [
    { key: 'duur', label: 'Duurvermogen', metric: 'ctl', target: 65, unit: 'CTL', dir: 'up' }
  ] }
};
var FTP_GAIN_PER_CTL_ = 0.004, FTP_GAIN_CAP_ = 0.08;   // speculatieve FTP-winst (tunebaar)
var PROJ_TAU_DAYS_ = 42;                               // PMC-tijdconstante (CTL-ramp)

// Actief doelprofiel — doel-gedreven (PUUR, geen side-effects). FTP → ftp; Beklimmingen +
// VO2max/Conditie/onbekend/missing → girona (fallback).
function activeGoalProfile_(settings) {
  var doel = settings && settings.doel;
  if (doel === 'FTP') return GOAL_PROFILES_.ftp;
  return GOAL_PROFILES_.girona;
}

// gap t.o.v. target; dir 'up' = hoger is beter. onTrack = doel gehaald; pct = voortgang 0..1.
function goalGap_(current, target, dir) {
  if (current == null || target == null) return { gap: null, onTrack: false, pct: null };
  var up = (dir !== 'down');
  var onTrack = up ? (current >= target) : (current <= target);
  var gap = up ? (target - current) : (current - target);
  var pct = null;
  if (target > 0 && current >= 0) pct = up ? (current / target) : (target / Math.max(current, 1e-9));
  if (pct != null) pct = Math.max(0, Math.min(1, pct));
  return { gap: Math.round(gap * 100) / 100, onTrack: onTrack, pct: (pct != null ? Math.round(pct * 100) / 100 : null) };
}

// plateau-CTL bij gegeven weekvolume: uren*tss/uur, verspreid over 7 dagen.
function ctlPlateauFromVolume_(weeklyHours, tssPerHour) {
  if (!weeklyHours || !tssPerHour) return 0;
  return Math.round((weeklyHours * tssPerHour / 7) * 10) / 10;
}

// weken tot targetCtl via exp. PMC-benadering (tau 42d). null = onbereikbaar; 0 = al bereikt.
function ctlApproachWeeks_(currentCtl, plateauCtl, targetCtl) {
  if (currentCtl == null || plateauCtl == null || targetCtl == null) return null;
  if (currentCtl >= targetCtl) return 0;
  if (plateauCtl <= targetCtl) return null;            // plafond onder doel → onbereikbaar
  var tDays = -PROJ_TAU_DAYS_ * Math.log((targetCtl - plateauCtl) / (currentCtl - plateauCtl));
  if (!isFinite(tDays) || tDays < 0) return null;
  return Math.round((tDays / 7) * 10) / 10;
}

// SPECULATIEF FTP-bereik (NOOIT één getal). low = currentFtp (eerlijke vloer: winst niet gegarandeerd);
// high = currentFtp*(1 + min(cap, perCtl*max(0, plateau-current))). gewicht (optioneel) → W/kg-bereik.
function ftpBandFromProjection_(currentFtp, currentCtl, plateauCtl, gewicht) {
  if (!currentFtp) return null;
  var dCtl = Math.max(0, (plateauCtl != null && currentCtl != null) ? (plateauCtl - currentCtl) : 0);
  var gain = Math.min(FTP_GAIN_CAP_, FTP_GAIN_PER_CTL_ * dCtl);
  var lowW = Math.round(currentFtp), highW = Math.round(currentFtp * (1 + gain));
  return {
    lowW: lowW, highW: highW,
    lowWkg: gewicht ? Math.round(lowW / gewicht * 100) / 100 : null,
    highWkg: gewicht ? Math.round(highW / gewicht * 100) / 100 : null,
    aannames: [
      '2 sleutelsessies per week, consequent',
      'Regelmaat ≥ 90% — geen lange onderbrekingen',
      'Herstel & voeding op orde',
      'FTP-winst vlakt af richting je plafond'
    ]
  };
}

// CTL op week N via exp. PMC-benadering (tau 42d). week 0 = current; groot N → plateau;
// current>plateau → dalend richting plateau. Finite guards; null bij ontbrekende/negatieve input.
function ctlAtWeek_(currentCtl, plateauCtl, weeks) {
  if (currentCtl == null || plateauCtl == null || weeks == null) return null;
  var w = Number(weeks); if (!isFinite(w) || w < 0) return null;
  return Math.round((plateauCtl + (currentCtl - plateauCtl) * Math.exp(-w * 7 / PROJ_TAU_DAYS_)) * 10) / 10;
}

// Hele weken (ceil) van vandaag tot doelStart + doelDuur*7 dagen (= testdag). Clamp ≥ 0; null bij
// ontbrekende/ongeldige input. Kalender-datum-rekenkunde (DST-veilig).
function doelTestWeken_(doelStartISO, doelDuurWeeks, todayISO) {
  function parse(iso) {
    if (!iso || typeof iso !== 'string') return null;
    var m = iso.split('-'); if (m.length !== 3) return null;
    var d = new Date(Number(m[0]), Number(m[1]) - 1, Number(m[2]));
    return isNaN(d.getTime()) ? null : d;
  }
  var start = parse(doelStartISO), today = parse(todayISO), dur = Number(doelDuurWeeks);
  if (!start || !today || !isFinite(dur) || dur <= 0) return null;
  var test = new Date(start.getFullYear(), start.getMonth(), start.getDate() + dur * 7);
  var days = Math.round((test.getTime() - today.getTime()) / 86400000);
  return Math.max(0, Math.ceil(days / 7));
}

// ── Activiteiten-array recent-window helpers (newest-first; idx0=datum, idx3=duur-min, idx8=TSS).
// Anker = nieuwste rit-datum (deterministisch/testbaar); venster = [anker − days, anker].
function actParseDate_(v) {
  if (v instanceof Date) return stripTime_(v);
  if (v == null || v === '') return null;
  var d = new Date(v); return isNaN(d.getTime()) ? null : stripTime_(d);
}
function actAnchorDate_(actValues) {
  // Volgorde-onafhankelijk: de meest recente (hoogste) parseerbare idx0-datum, niet de
  // eerste array-positie. Onder een newest-first tab byte-identiek aan "eerste rij".
  var best = null;
  for (var i = 0; i < actValues.length; i++) {
    var d = actParseDate_(actValues[i][0]);
    if (d && (best === null || d.getTime() > best.getTime())) best = d;
  }
  return best;
}
// max moving-time (uren) over ritten in laatste `days`.
function maxRecentRideH_(actValues, days) {
  if (!actValues || !actValues.length) return null;
  var anchor = actAnchorDate_(actValues); if (!anchor) return null;
  var floor = anchor.getTime() - days * 86400000, maxMin = 0, seen = false;
  for (var i = 0; i < actValues.length; i++) {
    var d = actParseDate_(actValues[i][0]); if (!d || d.getTime() < floor) continue;
    var mins = Number(actValues[i][3]); if (isNaN(mins) || mins <= 0) continue;
    seen = true; if (mins > maxMin) maxMin = mins;
  }
  return seen ? Math.round(maxMin / 60 * 10) / 10 : null;
}
// Σtss / Σuren over laatste `days` (TSS-dichtheid).
function tssPerHourRecent_(actValues, days) {
  if (!actValues || !actValues.length) return null;
  var anchor = actAnchorDate_(actValues); if (!anchor) return null;
  var floor = anchor.getTime() - days * 86400000, sumTss = 0, sumH = 0;
  for (var i = 0; i < actValues.length; i++) {
    var d = actParseDate_(actValues[i][0]); if (!d || d.getTime() < floor) continue;
    var mins = Number(actValues[i][3]), tss = Number(actValues[i][8]);
    if (isNaN(mins) || mins <= 0) continue;
    sumH += mins / 60; if (!isNaN(tss) && tss > 0) sumTss += tss;
  }
  return sumH > 0 ? Math.round(sumTss / sumH * 10) / 10 : null;
}
// gem. uren/week over laatste `days`.
function weeklyHoursRecent_(actValues, days) {
  if (!actValues || !actValues.length) return null;
  var anchor = actAnchorDate_(actValues); if (!anchor) return null;
  var floor = anchor.getTime() - days * 86400000, sumH = 0;
  for (var i = 0; i < actValues.length; i++) {
    var d = actParseDate_(actValues[i][0]); if (!d || d.getTime() < floor) continue;
    var mins = Number(actValues[i][3]); if (isNaN(mins) || mins <= 0) continue;
    sumH += mins / 60;
  }
  return Math.round((sumH / (days / 7)) * 10) / 10;
}

// state.goalProfile (per-dim {current,target,gap,onTrack,pct}) + state.projection-inputs. PUUR.
// inputs = { ftpWkg, ctl, longRideH }; settings selecteert 't profiel (nu altijd Girona).
function buildGoalProfile_(settings, inputs) {
  var prof = activeGoalProfile_(settings);
  var dims = prof.dims.map(function (d) {
    var cur = (inputs && inputs[d.metric] != null) ? inputs[d.metric] : null;
    var g = goalGap_(cur, d.target, d.dir);
    return { key: d.key, label: d.label, metric: d.metric, unit: d.unit, dir: d.dir,
             target: d.target, current: cur, gap: g.gap, onTrack: g.onTrack, pct: g.pct };
  });
  return { key: prof.key, label: prof.label, sub: prof.sub || null, projectieMode: prof.projectieMode || 'gap', dims: dims };
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
      segmenten: segs,
      structuur: wpEntry.structuur || null,   // optie D: per-blok label/duur/doel-watt (= ZWO)
      // v2c: rationale alleen tonen voor (nog) niet-gefietste dagen.
      reden: actual ? '' : (wpEntry.reden || '')
    };
    // v2c-pendel: multi-session → losse sessie-kaarten met eigen zonebar (alleen bij >1).
    if (wpEntry.sessies && wpEntry.sessies.length > 1) {
      voorstel.sessies = wpEntry.sessies.map(function (s) {
        return {
          titel: s.naam || 'Sessie',
          duurMin: s.totaalMin || 0,
          tss: s.tss || 0,
          segmenten: segmentsFromIntent_(s.intent),
          eindopmerking: s.eindopmerking || ''
        };
      });
    }
  }
  var act = null;
  if (actual) {
    var exp = expectedRpe_(wpEntry ? wpEntry.workoutType : null);
    act = {
      naam: actual.naam, duurMin: actual.duurMin, tss: actual.tss,
      ifReal: actual.ifReal != null ? actual.ifReal : null,
      rpe: rpe != null ? rpe : null,
      rpeVerwacht: exp != null ? exp : null,
      mismatch: (rpe != null && exp != null) ? Math.round((rpe - exp) * 10) / 10 : null
    };
  }
  return { voorstel: voorstel, actual: act };
}

// ── Coach-glue (Fase 4c) — event-ctx, patroon, reële zones (lazy) ──
/** macro → coach-event-ctx. trip = meerdaagse/endurance-reis → duur/drempel-doel. */
function coachEventFromMacro_(macro) {
  if (!macro || !macro.hoofdEvent) return null;
  var ev = macro.hoofdEvent, type = ev.type || 'race';
  return { naam: macro.eventName || ev.naam || 'je doel', type: type, isEndurance: (type === 'trip') };
}

/** Telt recente intensiteit-substituties (laatste 14 d): geplande duur/herstel
 *  maar werkelijk intensiever (genormaliseerde IF) → patroon-signaal voor de coach. */
function coachPatternCount_(actualsByDate, planByDate, today) {
  var n = 0;
  for (var i = 0; i < 14; i++) {
    var k = formatDate(new Date(today.getTime() - i * 86400000), 'yyyy-MM-dd');
    var a = actualsByDate[k], p = planByDate[k];
    if (!a || !p || a.ifReal == null) continue;
    // FIX 4 — planned-prikkel uit de ECHTE zone-minuten (zelfde route als
    // Coach.gs:189): een 'duur'-TYPE-dag mét drempel-intervallen telt zo NIET
    // als duur-substitutie. Lege segmenten → type-label-fallback ongemoeid.
    var plSegs = segmentsFromBlokken_(p.blokken) || segmentsFromIntent_(p.intent);
    var plZm = coachZmFromSegs_(plSegs);
    var plI = (plZm ? coachIntentFromZones_(plZm) : null) || intentFromType_(p.workoutType);
    var acI = intentFromIF_(cfNormIf_(a.ifReal));
    if ((plI === 'duur' || plI === 'herstel') && COACH_INTENSITY_RANK_[acI] > COACH_INTENSITY_RANK_[plI]) n++;
  }
  return n;
}

/** Reële power-time-in-zone (minuten, 5-bucket) voor één dag uit intervals.icu
 *  (on-demand getActivities-match; geen schema-migratie). Null = geen zone-data. */
function coachActualZoneMin_(dISO) {
  var acts = [];
  try { acts = getActivities(35) || []; } catch (e) { return null; }
  var hit = null;
  for (var i = 0; i < acts.length; i++) {
    var a = acts[i];
    if (!a.start_date_local || CYCLING_TYPES.indexOf(String(a.type || '')) < 0) continue;
    if (formatDate(stripTime_(new Date(a.start_date_local)), 'yyyy-MM-dd') === dISO) { hit = a; break; }
  }
  if (!hit || !Array.isArray(hit.icu_zone_times)) return null;
  var map = { Z1: 'rust', Z2: 'z2', Z3: 'tempo', Z4: 'drempel', Z5: 'anaeroob', Z6: 'anaeroob', Z7: 'anaeroob' };
  var zm = { rust: 0, z2: 0, tempo: 0, drempel: 0, anaeroob: 0 }, saw = false;
  hit.icu_zone_times.forEach(function (z) {
    if (!z || typeof z.id !== 'string') return;
    var bk = map[z.id]; if (!bk) return;
    zm[bk] += (Number(z.secs) || 0) / 60; saw = true;
  });
  return saw ? zm : null;
}

/** FIX 2 — lazy callable: herberekent de coach voor één voltooide dag MET reële
 *  zone-verdeling (echte Gedaan-bar + zone-gebaseerde classificatie). Null = val
 *  terug op de IF-benadering. On-demand (client cachet per dag). */
function getDayCoachZones(dISO) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dISO))) return null;
  var zm = coachActualZoneMin_(dISO);
  if (!zm) return null;
  var wpMap = dashWeekplanByDate_(), actMap = dashActualsByDate_();
  var wp = wpMap[dISO], actual = actMap[dISO];
  if (!wp || !actual) return null;
  var card = dashDayCard_(dISO, wp, actual, null);
  if (!card.voorstel || !card.actual) return null;
  card.actual.zoneMin = zm;
  var macro = bepaalFaseVoorDatum_(weekStartDate(new Date()));
  var ctx = { fase: macro.macroFase, event: coachEventFromMacro_(macro),
              patternCount: coachPatternCount_(actMap, wpMap, stripTime_(new Date())) };
  return coachFeedback_(card.voorstel, card.actual, ctx, false);
}

// ════════════════════════════════════════════════════════════════
// RIT-DETAIL (Fase 1ter) — lazy activiteit-statistieken uit intervals.icu.
// Resolveert de activity-id via match-by-date (getRideDetail-patroon = getDay-
// CoachZones), fetcht /activity/<id> + /activity/<id>/intervals, cachet per
// activity-id (DocProps, jaar-immutable). PURE afgeleide helpers = getest.
// ════════════════════════════════════════════════════════════════
function rdPctFtp_(watts, ftp) {                 // %FTP uit watt (fallback-bron)
  if (watts == null || !ftp || ftp <= 0) return null;
  return Math.round(Number(watts) / ftp * 100);
}
function rdPad2_(n) { return (n < 10 ? '0' : '') + n; }
function rdDurMs_(secs) {                          // "8:03" (m:ss); ≥1u → "1:08:03"
  secs = Math.max(0, Math.round(Number(secs) || 0));
  var h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
  return (h > 0 ? (h + ':' + rdPad2_(m)) : ('' + m)) + ':' + rdPad2_(s);
}
function rdDurHms_(secs) {                         // "0:58:32" (altijd h:mm:ss)
  secs = Math.max(0, Math.round(Number(secs) || 0));
  var h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
  return h + ':' + rdPad2_(m) + ':' + rdPad2_(s);
}
var RD_BUCKET_Z_ = {
  rust: { z: 'Z1', v: '--zone-1' }, z2: { z: 'Z2', v: '--zone-2' }, tempo: { z: 'Z3', v: '--zone-3' },
  drempel: { z: 'Z4', v: '--zone-4' }, anaeroob: { z: 'Z5', v: '--zone-5' }
};
var RD_ZTIME_ = { Z1: '--zone-1', Z2: '--zone-2', Z3: '--zone-3', Z4: '--zone-4', Z5: '--zone-5', Z6: '--zone-6', Z7: '--zone-6' };
function rdField_(o, keys) { for (var i = 0; i < keys.length; i++) { var v = o ? o[keys[i]] : null; if (v != null) return v; } return null; }
function rdNum_(v) { return v != null ? Math.round(Number(v)) : null; }
function rdFloat_(v) { return (v != null && v !== '') ? Number(v) : null; }
function rdWkg_(avgWatts, gewicht) {              // W/kg op 1 decimaal; null bij ontbrekend gewicht
  if (avgWatts == null || !gewicht || gewicht <= 0) return null;
  return Math.round(Number(avgWatts) / gewicht * 10) / 10;
}

function rideTimeInZone_(activity) {               // icu_zone_times → balk-segmenten
  var zt = activity && activity.icu_zone_times;
  if (!Array.isArray(zt) || !zt.length) return null;
  var total = 0; zt.forEach(function (z) { if (z && RD_ZTIME_[z.id]) total += Number(z.secs) || 0; });
  if (total <= 0) return null;
  var segs = [];
  zt.forEach(function (z) {
    if (!z || !RD_ZTIME_[z.id]) return;
    var secs = Number(z.secs) || 0; if (secs <= 0) return;
    segs.push({ z: z.id, zoneVar: RD_ZTIME_[z.id], pct: Math.round(secs / total * 100) });
  });
  return segs.length ? segs : null;
}
function rideIntervals_(ivs, ftp) {                 // /intervals → per-blok-rijen
  var arr = (ivs && Array.isArray(ivs.icu_intervals)) ? ivs.icu_intervals : (Array.isArray(ivs) ? ivs : []);
  var out = [];
  arr.forEach(function (iv, n) {
    var watt = rdField_(iv, ['average_watts', 'icu_average_watts', 'avg_watts']);
    var dur = rdField_(iv, ['moving_time', 'elapsed_time', 'secs']);
    if (watt == null && dur == null) return;
    var pct = rdPctFtp_(watt, ftp);
    var bucket = (pct != null) ? pctZoneBucket_(pct) : 'z2';
    var zi = RD_BUCKET_Z_[bucket] || RD_BUCKET_Z_.z2;
    out.push({
      label: String(rdField_(iv, ['label', 'name']) || ('Blok ' + (n + 1))),
      zone: zi.z, zoneVar: zi.v, durStr: rdDurMs_(dur),
      hr: rdNum_(rdField_(iv, ['average_hr', 'average_heartrate', 'avg_hr'])),
      pctFtp: pct, watt: rdNum_(watt),
      isWork: (bucket === 'tempo' || bucket === 'drempel' || bucket === 'anaeroob')
    });
  });
  return out;
}
function rideDetailModel_(hit, detail, ivs, ftp, gewicht) {  // → client-model voor §1ter
  var d = detail || hit || {};
  var start = (hit && hit.start_date_local) ? new Date(hit.start_date_local) : null;
  var ifRaw = rdField_(d, ['icu_intensity', 'intensity']);
  var ifNorm = (ifRaw != null) ? (ifRaw > 3 ? ifRaw / 100 : ifRaw) : null;   // % → 0–1
  var klasse = (ifNorm != null) ? intentFromIF_(ifNorm) : 'onbekend';
  var distM = rdField_(d, ['distance']);
  var movS = rdField_(d, ['moving_time', 'elapsed_time']);
  var joules = rdField_(d, ['icu_joules', 'icu_work']);
  var gemW = rdNum_(rdField_(d, ['average_watts', 'icu_average_watts']));
  return {
    klasseLabel: COACH_INTENT_LABEL_[klasse] || 'Rit', klasseZone: COACH_INTENT_ZONE_[klasse] || '--zone-2',
    datum: start ? (dashKort_(start) + ' ' + start.getFullYear()) : '',
    tijd: start ? (rdPad2_(start.getHours()) + ':' + rdPad2_(start.getMinutes())) : '',
    afstandKm: distM != null ? Math.round(distM / 100) / 10 : null,
    duurStr: movS != null ? rdDurHms_(movS) : null,
    tiz: rideTimeInZone_(hit),
    np: rdNum_(rdField_(d, ['icu_np', 'icu_weighted_avg_watts'])),
    ifv: ifNorm != null ? Math.round(ifNorm * 100) / 100 : null,
    tss: rdNum_(rdField_(d, ['icu_training_load', 'training_load'])),
    gewicht: gewicht || null,
    metrics: {
      gemW: gemW,
      wkg: rdWkg_(gemW, gewicht),               // W/kg = gem. vermogen ÷ gewicht (niet NP)
      gemHr: rdNum_(rdField_(d, ['average_heartrate', 'average_hr'])),
      maxHr: rdNum_(rdField_(d, ['max_heartrate', 'max_hr'])),
      cadans: rdNum_(rdField_(d, ['average_cadence', 'icu_average_cadence'])),
      hoogte: rdNum_(rdField_(d, ['total_elevation_gain', 'icu_elevation_gain'])),
      arbeidKj: joules != null ? Math.round(Number(joules) / 1000) : null
    },
    ftp: ftp || null,
    intervallen: rideIntervals_(ivs, ftp)
  };
}

/** Lazy callable: rit-detail voor een gereden dag. null/{error} → RideError-state. */
function getRideDetail(dISO) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dISO))) return null;
  var acts = [];
  try { acts = getActivities(40) || []; } catch (e) { return { error: true }; }
  var hit = null;
  for (var i = 0; i < acts.length; i++) {
    var a = acts[i];
    if (!a.start_date_local || CYCLING_TYPES.indexOf(String(a.type || '')) < 0) continue;
    if (formatDate(stripTime_(new Date(a.start_date_local)), 'yyyy-MM-dd') === dISO) { hit = a; break; }
  }
  if (!hit || !hit.id) return null;                       // geen gekoppelde activiteit
  var ftp = rdNum_(rdField_(hit, ['icu_ftp']));
  if (!ftp) { try { ftp = readSettings(SpreadsheetApp.getActive()).ftp || null; } catch (e) {} }
  var cacheKey = 'ridedetail_' + hit.id;
  var cached = getDocProp(cacheKey, '');
  if (cached) { try { var m = JSON.parse(cached); if (m && !m.error) return m; } catch (e) {} }
  var detail = null, ivs = null;
  try { detail = intervalsRequest_('/activity/' + hit.id); } catch (e) { detail = null; }
  try { ivs = intervalsRequest_('/activity/' + hit.id + '/intervals'); } catch (e) { ivs = null; }
  ftp = rdNum_(rdField_(detail || {}, ['icu_ftp'])) || ftp;   // FTP zoals die VOOR die rit gold
  // Gewicht (voor W/kg): detail → hit → settings (spiegelt de FTP-vóór-de-rit-resolutie).
  var gewicht = rdFloat_(rdField_(detail || {}, ['icu_weight'])) || rdFloat_(rdField_(hit, ['icu_weight']));
  if (!gewicht) { try { gewicht = Number(getGewicht()) || null; } catch (e) {} }
  var model = rideDetailModel_(hit, detail, ivs, ftp, gewicht);
  if (detail) { try { setDocProp(cacheKey, JSON.stringify(model)); } catch (e) {} }   // cache alleen bij geslaagde detail-fetch
  return model;
}

/**
 * Niveau Fase-2 §c — power-curve (mean-max) voor de Rijdersprofiel-kaart. LAZY web-callable
 * (GEEN open-flow). intervals.icu /power-curves?type=Ride (type VERPLICHT → 422 zonder).
 * window-id ('90d' | '1y', default '1y') → API-param curves=<window> (start/end worden GENEGEERD;
 * curves=<id> is de enige venster-control). Cache de RAUWE respons onder
 * powercurve_raw_<window>_<yyyyMMdd> (dag-bucket, per-venster), ALLEEN na succes; pcNormalize_ draait
 * bij ELKE read → classificatie volgt altijd de huidige code. Returnt model | {empty:true} | {error:true}.
 */
function getPowerCurve(window) {
  window = (window === '90d') ? '90d' : '1y';   // whitelisted venster-id; default 1y
  var key = 'powercurve_raw_' + window + '_' + formatDate(stripTime_(new Date()), 'yyyyMMdd');
  var raw = null;
  var cached = getDocProp(key, '');
  if (cached) { try { raw = JSON.parse(cached); } catch (e) { raw = null; } }
  if (!raw) {
    try { raw = intervalsRequest_('/athlete/{id}/power-curves?type=Ride&curves=' + window, {}); } catch (e) { return { error: true }; }
    if (raw && raw.list && raw.list[0] && raw.list[0].secs && raw.list[0].secs.length) {
      try { setDocProp(key, JSON.stringify(raw)); } catch (e) {}   // raw cachen, alleen na succes-fetch met data
    }
  }
  var curve = (raw && raw.list && raw.list[0]) ? raw.list[0] : null;
  if (!curve || !curve.secs || !curve.secs.length) return { empty: true };
  var ftp = null;
  try { ftp = readSettings(SpreadsheetApp.getActive()).ftp || null; } catch (e) {}
  return pcNormalize_(curve, raw.activities || {}, ftp);   // window-label uit curve.label; elke call genormaliseerd
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
 * Fase 3 deel 4 — niveau-tier-label (PUUR; getest in runSelfTest). Niveau-gebaseerd
 * (NIET W/kg) zodat de chip nooit de balk (niveau/50) tegenspreekt.
 * 0–14 Beginner · 15–24 Gemiddeld · 25–34 Gevorderd · 35–44 Vergevorderd · 45–50 Elite.
 */
function niveauTier_(niveau) {
  if (niveau == null) return null;
  if (niveau < 15) return 'Beginner';
  if (niveau < 25) return 'Gemiddeld';
  if (niveau < 35) return 'Gevorderd';
  if (niveau < 45) return 'Vergevorderd';
  return 'Elite';
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

/** Pure: minuten → "H:MM" (190 → "3:10", 0 → "0:00"). */
function hhmmFromMin_(min) {
  min = Math.max(0, Math.round(Number(min) || 0));
  var h = Math.floor(min / 60), m = min % 60;
  return h + ':' + (m < 10 ? '0' + m : '' + m);
}

/** Pure: weekplan-array → {tss, min, dagen}. Eén entry = één dag (multi-sessie
 *  al geaggregeerd); dagen = entries met minuten>0 (rustdag telt niet mee). */
function weekPlanSummary_(arr) {
  var tss = 0, min = 0, dagen = 0;
  if (Array.isArray(arr)) {
    arr.forEach(function (e) {
      tss += Number(e.tss) || 0;
      var m = Number(e.minuten) || 0;
      min += m;
      if (m > 0) dagen++;
    });
  }
  return { tss: Math.round(tss), min: Math.round(min), dagen: dagen };
}

/**
 * Fase 3b — WeekLoad: gepland-vs-gedaan voor de huidige kalenderweek.
 * DONE tss/uren/dagen uit de Activiteiten-tab (cycling, [weekStart, +7d)) —
 * één bron, consistent met dagstrip/dag-detail, geen extra live getActivities.
 * Noemer = geplande week-TSS uit weekplan_<maandag> (Σ entry.tss).
 * stale: F.3-signaal bestaat nog niet → false (TODO).
 * @return {tss, gedaanUur, dagen, geplandTss, geplandUur, geplandDagen, progressPct, stale, lastSync}
 */
function getWeekLoad_(ss, weekStart, actValues) {
  if (!actValues) actValues = readActiviteitenValues_();
  var wsT = stripTime_(weekStart).getTime();
  var weT = wsT + 7 * 86400000;
  var tss = 0, minuten = 0, dagen = {};
  if (actValues && actValues.length) {
    var data = actValues;
    data.forEach(function (r) {
      if (!(r[0] instanceof Date)) return;
      if (CYCLING_TYPES.indexOf(String(r[1] || '')) < 0) return;   // alleen fiets (idx1 = Type)
      var t = stripTime_(r[0]).getTime();
      if (t < wsT || t >= weT) return;
      minuten += Number(r[3]) || 0;                                // idx3 = Duur (min)
      if (r[8] !== '' && r[8] != null) tss += Number(r[8]) || 0;   // idx8 = TSS
      dagen[formatDate(r[0], 'yyyy-MM-dd')] = true;
    });
  }
  var plan = { tss: 0, min: 0, dagen: 0 };
  var raw = getDocProp('weekplan_' + formatDate(weekStart, 'yyyy-MM-dd'), '');
  if (raw) { try { plan = weekPlanSummary_(JSON.parse(raw)); } catch (e) {} }
  return {
    tss: Math.round(tss),
    uren: Math.round(minuten / 60 * 10) / 10,
    gedaanMin: Math.round(minuten),
    gedaanUur: hhmmFromMin_(minuten),
    dagen: Object.keys(dagen).length,
    geplandTss: plan.tss,
    geplandMin: plan.min,
    geplandUur: hhmmFromMin_(plan.min),
    geplandDagen: plan.dagen,
    progressPct: plan.tss > 0 ? Math.max(0, Math.min(100, Math.round(tss / plan.tss * 100))) : null,
    stale: getDocProp('avail_dirty', '') === '1',
    lastSync: getDocProp('last_sync', '') || null
  };
}

// ── Hoofdgetter ──────────────────────────────────────────────────
function getDashboardState() {
  var ss = SpreadsheetApp.getActive();
  var settings = readSettings(ss);
  // PERF: lees Activiteiten + Wellness ÉÉN keer; thread door alle consumenten.
  var actValues = readActiviteitenValues_();
  // PERF: scan de Activiteiten-array ÉÉN keer; alle dash-calc-consumenten lezen eruit.
  var actScan = dashActivityScan_(actValues);
  var wellValues = readWellnessValues_();
  var weekStart = weekStartDate(new Date());
  var mesoWeek = getMesoWeek();
  var eventsData = getAllEvents_();   // PERF: één Events-read; gedeeld door alle fase-consumenten + payload
  var macro = bepaalFaseVoorDatum_(weekStart, eventsData);
  var wellness = combineSignals_(getWellnessSignal(ss, wellValues), rpeSignal_());
  var fs = getFormScore_(wellValues);
  var weekTss = _statusWeekTss_(weekStart, actValues);
  var garminVerdict = garminHeuristic(weekTss, mesoWeek, macro.fase, fs);

  var planner = readPlanner(ss);
  var actuals = dashActualsByDate_(actValues, actScan);
  var wpByDate = dashWeekplanByDate_();
  var disposities = dashDispositionsByDate_();
  var overrides = dashOverridesByDate_();
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
    var fb = computeZoneDebt_(ss, weekStart, actValues);   // 0-API: lees uit de gethreade tab-array
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

  // Coach-ctx (Fase 4b/4c): event-demand + fase + patroon-teller — éénmaal per state.
  var coachCtx = { fase: macro.macroFase, event: coachEventFromMacro_(macro), patternCount: coachPatternCount_(actuals, wpByDate, today) };
  var library = getTrainingLibraryCached_(settings);   // hergebruikt door de adaptatie-post-pass + de payload

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
    // Fase 3c: gedisponeerde (gemiste) dag met een voorstel en geen actual → 'gemist'.
    var disp = disposities[dISO];
    if (disp && card.voorstel && !actuals[dISO]) status = 'gemist';
    if (card.voorstel) {
      var seg0 = card.voorstel.segmenten[card.voorstel.segmenten.length - 1];
      kleur = seg0 ? seg0.kleur : '#90a4ae';
    } else if (status === 'preview') { kleur = '#b0bec5'; }
    if (status === 'gemist') kleur = null;
    // Fase 4b — coach-feedback op dag-niveau (voltooid: plan vs actual; gemist: plan).
    // Doel-bewuste ctx (event + fase + patroon); reële zones lazy via getDayCoachZones.
    var coach = null;
    if (card.voorstel && card.actual) coach = coachFeedback_(card.voorstel, card.actual, coachCtx, false);
    else if (status === 'gemist')     coach = coachFeedback_(card.voorstel, null, coachCtx, true);
    dagen.push({
      dateISO: dISO, weekdag: dashWeekdag_(d), kort: dashKort_(d),
      status: status, kleur: kleur,
      voorstel: card.voorstel, actual: card.actual, previewMin: previewMin,
      dispositie: disp || null,
      override: overrides[dISO] || null,
      coach: coach
    });
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);  // DST-immuun
  }

  // ── Adaptatie-EXECUTIE (Fase 4c): koppel elke coach-suggestie (afgeweken/gemist)
  // aan de eerstvolgende plannbare toekomstige dag + een GELDIGE make-up-payload.
  // Idempotent: een override met .from = bron-dag → al ingepland (geen dubbel-plant).
  var madeFrom = {};
  Object.keys(overrides).forEach(function (k) { var o = overrides[k]; if (o && o.from) madeFrom[o.from] = k; });
  var claimedTarget = {};
  dagen.forEach(function (cd) {
    if (!cd.coach || !cd.coach.adapt) return;                          // alleen waar de "Voorstel:"-suggestie staat
    if (cd.coach.state !== 'different' && cd.coach.state !== 'missed') return;
    if (madeFrom[cd.dateISO]) { cd.coach.adaptatie = { planned: true, dISO: madeFrom[cd.dateISO] }; return; }
    var target = null;
    for (var ti = 0; ti < dagen.length; ti++) {
      var t = dagen[ti];
      if (t.dateISO <= cd.dateISO || t.dateISO <= todayISO) continue;  // toekomst, ná de bron-dag
      if (claimedTarget[t.dateISO] || t.override || t.actual) continue;
      if (t.status !== 'gepland' && t.status !== 'rust' && t.status !== 'vandaag') continue;
      target = t; break;
    }
    if (!target) { cd.coach.adaptatie = null; return; }                // geen geldige target → geen knop
    claimedTarget[target.dateISO] = true;
    cd.coach.adaptatie = coachAdaptatie_(cd.coach.planned, library, target.dateISO, target.kort, cd.dateISO);
  });

  // ── Vorm ──
  var reeks = dashVormReeks_(wellValues);
  var statsBundle = dashStatsFromActivities_(actValues, actScan);

  // ── STAP 2: readiness→plan-overlay (read-side) ──────────────────────────────
  // Zet een readiness-coach (kind:'readiness') op de VANDAAG-dag. macro.fase draagt
  // Taper/Recovery (engine-fase incl. taper). Los van de completed/missed coach
  // (wederzijds exclusief; de C12-post-pass raakt 'm niet — geen .adapt-veld).
  //   - readiness-make-up actief (override.src==='readiness') → COMMITTED-coach (bevestigd).
  //   - handmatige override → géén coach.  - anders → SUGGEST-coach bij demote.
  var readinessState = getReadinessScore_(fs, wellness, reeks);
  var rdyCoach = (function () {
    if (actuals[todayISO]) return null;                                  // al gereden
    var wp = wpByDate[todayISO];
    if (!wp || !wp.workoutType || wp.workoutType === 'free') return null; // geen geplande engine-sessie vandaag
    if (!readinessState || !readinessState.band) return null;
    var fromNaam = wp.naam || COACH_INTENT_LABEL_[intentFromType_(wp.workoutType)] || 'je sessie';
    var ovToday = overrides[todayISO];
    if (ovToday) {
      if (ovToday.src === 'readiness') {
        return { kind: 'readiness', committed: true, gereedheid: readinessState.score,
                 status: readinessState.band, regel: readinessRegelDone_(fromNaam) };
      }
      return null;                                                       // handmatige override → geen coach
    }
    if (wp.sessies && wp.sessies.length > 1) return null;               // multi-sessie overslaan
    var zs = workoutZones(wp.workoutType, settings.doel);
    var isHard = zs.indexOf('high') >= 0 || zs.indexOf('anaerobic') >= 0;
    var adj = readinessAdjust_({ type: wp.workoutType, isHard: isHard }, readinessState.band, macro.fase);
    if (adj.action !== 'demote') return null;
    var toNaam = readinessEaseNaam_(adj.toType);
    return {
      kind: 'readiness', gereedheid: readinessState.score, status: readinessState.band, reden: adj.reden,
      fromType: adj.fromType, toType: adj.toType, fromNaam: fromNaam, toNaam: toNaam,
      regel: readinessRegel_(readinessState.band, readinessState.score, fromNaam, toNaam),
      adaptatie: { dISO: todayISO, type: 'free', ritType: 'vrij', intensiteit: adj.intensiteit,
                   durMin: Math.round(wp.minuten || 0), src: 'readiness', label: 'Verlicht naar ' + toNaam }
    };
  })();
  if (rdyCoach) { for (var rdi = 0; rdi < dagen.length; rdi++) { if (dagen[rdi].dateISO === todayISO) { dagen[rdi].coach = rdyCoach; break; } } }
  // Event-countdown uit bepaalFaseVoorDatum_ (al berekend in `macro`).
  var evDatum = macro.eventDate || (macro.hoofdEvent && macro.hoofdEvent.datum) || null;
  var dagenTot = null;
  if (evDatum) {
    var dt = Math.round((stripTime_(new Date(evDatum)).getTime() - today.getTime()) / 86400000);
    dagenTot = dt >= 0 ? dt : null;
  }
  // Fase 3 deel 3: conditie-cluster (PMC/strip/volume) verwijderd → vorm-payload
  // getrimd tot wat de Vorm-body nog leest (niveau-grafiek + Balans-meter). De
  // reeks/stats blijven lokaal berekend (ctlRef/voortgang/readiness), maar gaan
  // niet meer mee als payload-velden.
  var vorm = {
    niveauReeks: dashNiveauReeks_(ss, actValues, actScan),
    huidig: fs ? { vorm: Math.round(fs.form), vormZone: fs.label, ctl: Math.round(fs.ctl), atl: Math.round(fs.atl), ramp: fs.ramp != null ? Math.round(fs.ramp * 100) / 100 : null } : null
  };
  // Niveau-tab progressie-series (W/kg + fitheid·CTL) — hergebruikt vorm.niveauReeks
  // (maand) + maandelijkse CTL uit de Activiteiten-historie (PURE). Vorm leest dit niet.
  var niveauProgressie = niveauProgressie_(vorm.niveauReeks, ctlReeksMaandelijks_(actValues));

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
  // §d Doel-projectie: actieve doel-assen + projectie-inputs (PURE; client recomputet what-if inline).
  var projLongRideH = maxRecentRideH_(actValues, 90);
  var goalProfile = buildGoalProfile_(settings, { ftpWkg: niv.wkg, ctl: ctlNow, longRideH: projLongRideH });
  var dStartISO = settings.doelStart ? formatDate(settings.doelStart, 'yyyy-MM-dd') : null;
  var projection = {
    currentCtl: (ctlNow != null ? Math.round(ctlNow * 10) / 10 : null),
    tssPerHour: tssPerHourRecent_(actValues, 42),
    weeklyHoursDefault: weeklyHoursRecent_(actValues, 42),
    ftp: settings.ftp || null, gewicht: gewicht || null,
    testWeken: doelTestWeken_(dStartISO, settings.doelDuur, formatDate(new Date(), 'yyyy-MM-dd')),
    testDatumISO: (dStartISO && settings.doelDuur)
      ? formatDate(new Date(stripTime_(settings.doelStart).getFullYear(), stripTime_(settings.doelStart).getMonth(), stripTime_(settings.doelStart).getDate() + settings.doelDuur * 7), 'yyyy-MM-dd')
      : null
  };
  var niveauBasis = niv.niveau;
  var conditieMod = computeConditieMod_(ctlNow, ctlRef);
  var niveauLevend = (niveauBasis == null) ? null
    : Math.max(0, Math.min(50, niveauBasis + conditieMod));

  // 2b-3: beginniveau-anker uit de oudste Activiteiten-rij (icu_ftp/icu_weight).
  // conditieModBegin = 0 (data-start = referentie; Wellness-tab reikt niet tot 2024).
  var DASH_MND_ = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
  var anker = dashBeginAnker_(ss, actValues, actScan);
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
    var wkFase = bepaalFaseVoorDatum_(wkM, eventsData).fase;
    var band = vt[wkFase] || vt.Build || [4, 7];   // Test/onbekend → Build-fallback
    verwachtCum += ((band[0] + band[1]) / 2) * tssPerUur;   // per week, geen /7
    aantalVoltooideWeken++;
    wkM = new Date(wkM.getFullYear(), wkM.getMonth(), wkM.getDate() + 7);
  }
  if (aantalVoltooideWeken > 0) {
    verwachtTssCum = Math.round(verwachtCum);
    // aftrek-truc: [eersteWeekStart, huidigeWeekStart) = voltooide weken.
    werkelijkTssCum = sumTssVanafDatum_(ss, eersteWeekStart, actValues) - sumTssVanafDatum_(ss, huidigeWeekStart, actValues);
    voortgangPct = verwachtTssCum > 0 ? Math.round(werkelijkTssCum / verwachtTssCum * 100) : null;
  }

  return {
    athlete: { ftp: settings.ftp || null, naam: '' },
    ftp: settings.ftp || null,
    gewicht: gewicht || null,
    wkg: niv.wkg,
    niveau: niveauLevend,
    niveauTier: niveauTier_(niveauLevend != null ? Math.round(niveauLevend) : null),
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
    niveauProgressie: niveauProgressie,
    eftp: eftpFromActivities_(actValues),
    goalProfile: goalProfile,
    projection: projection,
    availability: planner.map(function (p) {
      return { train: p.train === true, minuten: p.minuten || 0, dagtype: p.type || '', dagLabel: p.dag };
    }),
    availabilityPlus1: readAvailabilityPlus1_(ss),
    settings: {
      naam: 'Daan',
      ftp: settings.ftp,
      gewicht: loadSettingValue('gewicht'),
      ftpAuto: loadSettingValue('ftp_auto_update') === true,
      profielPreset: loadSettingValue('profiel_preset'),
      profielOpties: PROFIEL_PRESET_OPTIONS,
      doel: settings.doel,
      doelOpties: DOEL_OPTIONS,
      doelStart: settings.doelStart ? formatDate(settings.doelStart, 'yyyy-MM-dd') : null,
      doelDuur: settings.doelDuur,
      gekoppeld: !!settings.athleteId,
      athleteId: settings.athleteId || null,
      garminLastSync: getDocProp('last_sync', '') || null,
      sundayReminder: getDocProp('sunday_reminder', '') === 'true',
      coachName: loadSettingValue('coach_naam') || 'Coach'
    },
    coachName: loadSettingValue('coach_naam') || 'Coach',
    events: eventsData.map(function (e) {
      return { datum: formatDate(e.datum, 'yyyy-MM-dd'), naam: e.naam, type: e.type, prioriteit: e.prioriteit,
               afstandKm: e.afstandKm, hm: e.hm, klimType: e.klimType, notitie: e.notitie };
    }),
    dagtypeOptions: DAGTYPE_OPTIONS,
    // Read-only spiegel van de fase-engine (bepaalFaseVoorDatum_ @353, hergebruikt) —
    // databron voor latere [#3] takeover-UX. Geen nieuwe afleiding, geen relabeling.
    mode: {
      eventDriven: macro.eventDriven === true,   // bepaalFaseVoorDatum_ (Doel.gs)
      macroPhase: macro.fase || null,            // engine-fase: Base/Build/Peak/Taper/Recovery
      seasonMode: settings.fase || null,         // FASE-setting: build/maintain
      weeksToEvent: (macro.wekenTotEvent != null) ? macro.wekenTotEvent : null
    },
    plan: buildPlanModel_(macro, settings, eventsData),
    // Fase 1b: readiness (read-side) — hergebruikt reeds-berekende fs/wellness/reeks
    // zodat getReadinessScore_ geen extra live getWellness-call doet.
    readiness: readinessState,
    // Fase 4: Trainingen-bibliotheek (read-side) + geplande types (In-je-blok-badge).
    library: library,
    plannedTypes: (function () {
      var base = weekPlannedTypes_(weekStart);
      var wkEnd = new Date(weekStart.getTime() + 7 * 86400000);
      Object.keys(overrides).forEach(function (dISO) {
        var dt = stripTime_(new Date(dISO));
        if (dt.getTime() < weekStart.getTime() || dt.getTime() >= wkEnd.getTime()) return;
        var t = (overrides[dISO].type === 'free') ? 'free' : overrides[dISO].workoutType;
        if (t && base.indexOf(t) < 0) base.push(t);
      });
      return base;
    })(),
    weekLoad: getWeekLoad_(ss, weekStart, actValues),
    vandaag: vandaag,
    dagen: dagen,
    vorm: vorm
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
  setDocProp('avail_dirty', '1');   // pass 2: plan verouderd t.o.v. nieuwe beschikbaarheid → stale-banner
  return getDashboardState();
}

/**
 * Fix (b): lees de Weekplanner +1-tab als 7-rij-array (zelfde vorm als
 * state.availability). Blanco/afwezig → defaults (rust). Read-only.
 */
function readAvailabilityPlus1_(ss) {
  var sh = ss.getSheetByName(WEEKPLANNER_PLUS1_SHEET);
  var data = (sh && plannerHasData_(sh)) ? sh.getRange(3, 1, 7, 8).getValues() : null;
  var rows = [];
  for (var i = 0; i < 7; i++) {
    var d = data ? data[i] : null;
    rows.push({
      train: d ? (d[0] === true) : false,
      minuten: d ? (Number(d[3]) || 0) : 0,
      dagtype: d ? String(d[4] || '') : '',
      dagLabel: DAGEN_NL[i]
    });
  }
  return rows;
}

/**
 * Fix (b): schrijf beschikbaarheid naar de Weekplanner +1-tab (volgende week).
 * Spiegelt saveAvailability, maar: (a) ensureCurrentWeekPlus1 EERST (web-context:
 * onOpen draait niet, +1-datums moeten bestaan; mid-week re-blankt 't niet), en
 * (b) GEEN avail_dirty (een +1-edit maakt de HUIDIGE week niet verouderd).
 */
function saveAvailabilityPlus1(updates) {
  var ss = SpreadsheetApp.getActive();
  try { ensureCurrentWeekPlus1(ss); }
  catch (e) { console.warn('saveAvailabilityPlus1 ensure: ' + (e && e.message ? e.message : e)); }
  var sh = ss.getSheetByName(WEEKPLANNER_PLUS1_SHEET);
  if (!sh) throw new Error('Tab "Weekplanner +1" ontbreekt.');
  updates = updates || [];
  var trainCol = [], minCol = [], typeCol = [];
  for (var i = 0; i < 7; i++) {
    var u = updates[i] || {};
    var dt = String(u.dagtype || '');
    if (DAGTYPE_OPTIONS.indexOf(dt) < 0) dt = '';
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
  return getDashboardState();   // BEWUST geen avail_dirty: +1-edit raakt de huidige week niet
}

/**
 * Instellingen-drawer Fase 1: web-write-pad. Schrijft elk meegegeven veld naar
 * de Sheet-cel (readSettings leest de Sheet) ÉN de DocProp (loadSettingValue/
 * persistence). GEEN API-key-write (security). Zondag-herinnering heeft geen
 * Sheet-rij → DocProp 'sunday_reminder'. Returnt verse getDashboardState.
 */
function saveSettings(updates) {
  updates = updates || {};
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(SETTINGS_SHEET);
  function writeField(prop, row, value, kind) {
    var docVal = (kind === 'date') ? formatDate(value, 'yyyy-MM-dd')
               : (kind === 'bool') ? (value ? 'true' : 'false') : String(value);
    setDocProp(prop, docVal);
    if (sh && row) {
      var cell = sh.getRange(row, 2);
      if (kind === 'bool')      cell.setValue(value === true);
      else if (kind === 'num')  cell.setValue(Number(value));
      else if (kind === 'date') cell.setValue(value).setNumberFormat('dd-MM-yyyy');
      else                      cell.setValue(String(value));
    }
  }
  if (updates.ftp != null && !isNaN(Number(updates.ftp)))         writeField('ftp', 3, Number(updates.ftp), 'num');
  if (updates.gewicht != null && !isNaN(Number(updates.gewicht))) writeField('gewicht', 42, Number(updates.gewicht), 'num');
  if (updates.profielPreset != null && PROFIEL_PRESET_OPTIONS.indexOf(String(updates.profielPreset)) >= 0)
    writeField('profiel_preset', 43, String(updates.profielPreset), 'str');
  if (updates.doel != null && DOEL_OPTIONS.indexOf(String(updates.doel)) >= 0)
    writeField('doel', 11, String(updates.doel), 'str');
  if (updates.doelStart) {
    var ds = new Date(String(updates.doelStart).slice(0, 10) + 'T00:00:00');
    if (!isNaN(ds.getTime())) writeField('doel_start', 12, ds, 'date');
  }
  if (updates.doelDuur != null && !isNaN(Number(updates.doelDuur)))
    writeField('doel_duur', 13, Math.max(1, Math.round(Number(updates.doelDuur))), 'num');
  if (typeof updates.ftpAuto === 'boolean')        writeField('ftp_auto_update', 47, updates.ftpAuto, 'bool');
  if (typeof updates.sundayReminder === 'boolean') setDocProp('sunday_reminder', updates.sundayReminder ? 'true' : 'false');
  if (updates.coachName != null) {
    var cn = String(updates.coachName).trim().slice(0, 24) || 'Coach';   // Cadans-coachnaam; raakt API_KEY niet
    writeField('coach_naam', SETTINGS_FIELDS.COACH_NAAM.row, cn, 'str');
  }
  SpreadsheetApp.flush();
  return getDashboardState();
}

/**
 * Events-CRUD Fase 2: volledige-array write-pad (zoals saveAvailability).
 * Schrijft rij 3..12 in de Events-tab (volle 8 kolommen — verborgen velden
 * type/afstand/hm/klim/notitie uit de werkkopie behouden), blankt de rest,
 * synct events_json (saveEventsToProps_) en zet avail_dirty (events wijzigen
 * de fase/workout-selectie → regen-prompt). Datum vereist; cap 10. GEEN regen.
 */
function saveEvents(events) {
  events = Array.isArray(events) ? events : [];
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(EVENTS_SHEET);
  if (!sh) throw new Error('Tab "Events" ontbreekt.');
  var clean = [];
  events.forEach(function (e) {
    if (!e || !e.datum) return;                                  // datum vereist
    var d = new Date(String(e.datum).slice(0, 10) + 'T00:00:00');
    if (isNaN(d.getTime())) return;
    var prio = (EVENT_PRIO_OPTIONS.indexOf(String(e.prioriteit)) >= 0) ? String(e.prioriteit) : 'C';
    var type = (EVENT_TYPE_OPTIONS.indexOf(String(e.type)) >= 0) ? String(e.type) : 'race';
    clean.push([
      d, String(e.naam || ''), type, prio,
      (e.afstandKm === '' || e.afstandKm == null) ? '' : Number(e.afstandKm),
      (e.hm === '' || e.hm == null) ? '' : Number(e.hm),
      String(e.klimType || ''), String(e.notitie || '')
    ]);
  });
  if (clean.length > EVENT_ROW_COUNT) clean = clean.slice(0, EVENT_ROW_COUNT);
  var rows = clean.slice();
  while (rows.length < EVENT_ROW_COUNT) rows.push(['', '', '', '', '', '', '', '']);   // blank de rest
  sh.getRange(EVENT_FIRST_ROW, 1, EVENT_ROW_COUNT, EVENT_HEADERS.length).setValues(rows);
  sh.getRange(EVENT_FIRST_ROW, 1, EVENT_ROW_COUNT, 1).setNumberFormat('yyyy-mm-dd');
  SpreadsheetApp.flush();
  try { saveEventsToProps_(); } catch (e) { console.warn('saveEvents props: ' + (e && e.message ? e.message : e)); }
  setDocProp('avail_dirty', '1');   // events → fase/workouts veranderd → "werk bij"
  return getDashboardState();
}

/**
 * v2b-A web-callable: (re)genereer het weekvoorstel. generateProposal
 * gebruikt geen getUi (alleen ss.toast/setActiveSheet ná de cache-writes);
 * die UI-stappen worden in web-context geslikt. Returnt verse state.
 */
function regenerateWeb() {
  // pass 3a: ↻ pullt EERST verse actuals + wellness + stempelt last_sync (ensureDataAndReconcile_
  // sync't alleen-als-leeg, dus zonder dit zou een regen op een gevulde tab niks pullen). Daarna
  // reconcileert generateProposal enkel op de verse tab (geen dubbel-netwerk).
  try { syncAll(); }
  catch (e) { console.warn('regenerateWeb syncAll: ' + (e && e.message ? e.message : e)); }
  try { generateProposal(); }
  catch (e) { console.warn('regenerateWeb: ' + (e && e.message ? e.message : e)); }
  setDocProp('avail_dirty', '');   // plan vers geregenereerd op verse data → niet meer verouderd
  return getDashboardState();
}

/**
 * Fase 2 — background-refresh entry (client fire-and-forget achter het openen).
 * Incr-synct de laatste 7 dagen activiteiten de tab in (idempotente upsert, bewezen
 * 478→478→478) + returnt de verse 0-API getDashboardState. GEEN generateProposal (geen
 * herplan — getDashboardState leest de verse tab) en GEEN last_sync-stempel ("laatst
 * gesynct" blijft van de laatste volledige syncAll/↻; dit is een activiteiten-only top-up).
 */
function refreshActivities() {
  var r = syncActivitiesIncremental_(7);   // incr-write; {added,updated} = latere log-hook (niet in return)
  var state = getDashboardState();         // 0-API, leest de verse tab
  return state;
}

/**
 * v2b-A web-callable: push de pending voorstellen naar intervals.icu.
 * Returnt { pushedCount, skipped, errors } uit de UI-vrije core.
 */
function pushWeb() {
  return pushAllPending_(SpreadsheetApp.getActive());
}

/**
 * Fase 3b — WeekLoad refresh: re-sync de werkelijke ritten (Activiteiten-tab)
 * en geef verse state terug. Lichter dan regenerateWeb (geen herplanning) —
 * puur de gepland-vs-gedaan-cijfers verversen. syncActivities = web-veilig.
 */
function refreshWeek() {
  try { syncActivities(); }
  catch (e) { console.warn('refreshWeek: ' + (e && e.message ? e.message : e)); }
  return getDashboardState();
}

/**
 * Fase 3c-A — web-RPE: schrijf rpe_<date> (1–10). Spiegelt handleRpeCallback
 * (TelegramBot.gs): DocProps-only, GEEN intervals-POST. Returnt verse state.
 */
function saveRpe(dateISO, rpe) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateISO))) throw new Error('saveRpe: ongeldige datum.');
  var n = parseInt(rpe, 10);
  if (isNaN(n) || n < 1 || n > 10) throw new Error('saveRpe: RPE moet 1–10 zijn.');
  setDocProp('rpe_' + dateISO, String(n));
  return getDashboardState();
}

var DISPOSITION_REASONS = ['geen_tijd', 'bewust_gerust', 'iets_anders'];

/**
 * Fase 3c-B — skip-dispositie: markeer een geplande-niet-gedane dag als gemist
 * met een reden (DocProp disposition_<date> = {reason, ts}). reason=null wist 'm
 * (voorstel terug). GEEN generateProposal: dat zou via debt "inhalen" en vandaag's
 * voorstel herleven; assignWorkouts leidt resterende dagen al vers af bij de
 * eerstvolgende regen. Returnt verse state.
 */
function saveDisposition(dateISO, reason) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateISO))) throw new Error('saveDisposition: ongeldige datum.');
  var key = 'disposition_' + dateISO;
  if (reason == null || reason === '') {
    PropertiesService.getDocumentProperties().deleteProperty(key);
  } else {
    if (DISPOSITION_REASONS.indexOf(String(reason)) < 0) throw new Error('saveDisposition: onbekende reden.');
    setDocProp(key, JSON.stringify({ reason: String(reason), ts: new Date().toISOString() }));
  }
  return getDashboardState();
}

var OVERRIDE_DUR_MIN_ = 20, OVERRIDE_DUR_MAX_ = 360;
var FREE_RIT_TYPES_ = ['vrij', 'groep'];
var FREE_INTENS_ = ['rustig', 'tempo', 'stevig'];

/**
 * Fase 4 — day-override: "andere training kiezen / inplannen op een dag".
 * Spiegelt saveDisposition (DocProp override_<date>, GEEN generateProposal →
 * directe read-side toon; de eerstvolgende regen bakt 'm in het weekplan).
 * overrideJson = {type:'library', workoutType, variantId?, durMin}
 *              | {type:'free', ritType:'vrij'|'groep', intensiteit:'rustig'|'tempo'|'stevig', durMin}.
 * Returnt verse state.
 */
function saveDayOverride(dateISO, overrideJson) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateISO))) throw new Error('saveDayOverride: ongeldige datum.');
  var ov = (typeof overrideJson === 'string') ? JSON.parse(overrideJson) : overrideJson;
  if (!ov || (ov.type !== 'library' && ov.type !== 'free')) throw new Error('saveDayOverride: onbekend override-type.');
  var dur = Math.round(Number(ov.durMin) || 0);
  if (dur < OVERRIDE_DUR_MIN_ || dur > OVERRIDE_DUR_MAX_) throw new Error('saveDayOverride: duur buiten bereik.');
  var clean;
  if (ov.type === 'library') {
    if (!ov.workoutType) throw new Error('saveDayOverride: workoutType ontbreekt.');
    clean = { type: 'library', workoutType: String(ov.workoutType), variantId: ov.variantId ? String(ov.variantId) : null, durMin: dur };
  } else {
    var rit = (FREE_RIT_TYPES_.indexOf(ov.ritType) >= 0) ? ov.ritType : 'vrij';
    var inten = (FREE_INTENS_.indexOf(ov.intensiteit) >= 0) ? ov.intensiteit : 'rustig';
    clean = { type: 'free', ritType: rit, intensiteit: inten, durMin: dur };
  }
  clean.ts = new Date().toISOString();
  // Optioneel: coach-make-up tagt de bron-dag → idempotent (geen dubbel-plant).
  if (ov.from && /^\d{4}-\d{2}-\d{2}$/.test(String(ov.from))) clean.from = String(ov.from);
  if (ov.src) clean.src = String(ov.src);   // STAP 2: bron-tag (bv. 'readiness'); display-lezers negeren 't
  setDocProp('override_' + dateISO, JSON.stringify(clean));
  return getDashboardState();
}

/** Wist de day-override (terug naar het coach-voorstel). Returnt verse state. */
function clearDayOverride(dateISO) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateISO))) throw new Error('clearDayOverride: ongeldige datum.');
  PropertiesService.getDocumentProperties().deleteProperty('override_' + dateISO);
  return getDashboardState();
}
