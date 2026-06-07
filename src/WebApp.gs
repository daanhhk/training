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
      tss: r[8] !== '' && r[8] != null ? Number(r[8]) : null,
      ifReal: r[7] !== '' && r[7] != null ? Number(r[7]) : null   // IF (idx7) — coach-engine
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
    var plI = intentFromType_(p.workoutType);
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
function getWeekLoad_(ss, weekStart) {
  var wsT = stripTime_(weekStart).getTime();
  var weT = wsT + 7 * 86400000;
  var tss = 0, minuten = 0, dagen = {};
  var sh = ss.getSheetByName(ACTIVITEITEN_SHEET);
  if (sh && sh.getLastRow() >= 2) {
    var data = sh.getRange(2, 1, sh.getLastRow() - 1, ACT_HEADERS.length).getValues();
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

  // Coach-ctx (Fase 4b/4c): event-demand + fase + patroon-teller — éénmaal per state.
  var coachCtx = { fase: macro.macroFase, event: coachEventFromMacro_(macro), patternCount: coachPatternCount_(actuals, wpByDate, today) };
  var library = getTrainingLibrary_(settings);   // hergebruikt door de adaptatie-post-pass + de payload

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
  var reeks = dashVormReeks_();
  var statsBundle = dashStatsFromActivities_();
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
    niveauReeks: dashNiveauReeks_(ss),
    huidig: fs ? { vorm: Math.round(fs.form), vormZone: fs.label, ctl: Math.round(fs.ctl), atl: Math.round(fs.atl), ramp: fs.ramp != null ? Math.round(fs.ramp * 100) / 100 : null } : null
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
      sundayReminder: getDocProp('sunday_reminder', '') === 'true'
    },
    events: getAllEvents_().map(function (e) {
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
    plan: buildPlanModel_(macro, settings),
    // Fase 1b: readiness (read-side) — hergebruikt reeds-berekende fs/wellness/reeks
    // zodat getReadinessScore_ geen extra live getWellness-call doet.
    readiness: getReadinessScore_(fs, wellness, reeks),
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
    weekLoad: getWeekLoad_(ss, weekStart),
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
  setDocProp('override_' + dateISO, JSON.stringify(clean));
  return getDashboardState();
}

/** Wist de day-override (terug naar het coach-voorstel). Returnt verse state. */
function clearDayOverride(dateISO) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateISO))) throw new Error('clearDayOverride: ongeldige datum.');
  PropertiesService.getDocumentProperties().deleteProperty('override_' + dateISO);
  return getDashboardState();
}
