/**
 * Doel.gs — Tab "Doel".
 *
 * Macrocyclus dashboard: huidige week/fase, voortgangsbalk, uitleg
 * per fase en doel-specifieke focus voor de huidige fase.
 */

var DOEL_SHEET = 'Doel';

// Taper-venster (dagen tot het event, gemeten VANAF VANDAAG — zie eventFase_):
//   A-event/trip ≤ 7 d → volle taper-week (macro = Taper).
//   B-event      ≤ 3 d → mini-taper (alleen die laatste dagen; macro blijft A/trip).
//   C-event             → nooit taperen.
var A_TAPER_DAGEN = 7;
var B_TAPER_DAGEN = 3;

var DOEL_FOCUS = {
  FTP: {
    Base:  'Sweet Spot 2x20 @ 88% + lange Z2',
    Build: 'Sweet Spot 3x20 @ 91% + Threshold 4x10 @ 95%',
    Peak:  'Threshold 3x15 @ 98% + korte VO2 erbij',
    Test:  '20-min FTP test (FTP = 95% van 20min avg)'
  },
  VO2max: {
    Base:  'Korte VO2 4x3min @ 108% intro',
    Build: 'VO2 5x4min @ 110% (2x per week)',
    Peak:  'VO2 4x5min @ 113% + 8x 30/15s blokken',
    Test:  '5-min all-out test (gemiddeld vermogen = VO2 ref)'
  },
  Conditie: {
    Base:  'Lange Z2 90→150 min, tempo intro',
    Build: "Z2 + tempo combo's, lange rit 3u",
    Peak:  'Race-pace simulatie + fat-ox rides',
    Test:  '90-min rit met laatste 30min tempo'
  },
  Beklimmingen: {
    Base:  'SS 2x25 + low-cadence intro 60-70 rpm',
    Build: 'Low-cadence SS + bergsimulatie 30-45 min',
    Peak:  'Sustained climbing 45-60 min @ 80-90%',
    Test:  'PR-poging favoriete klim (manueel)',
    Taper: 'Korte openers + soepele benen voor de klim'
  }
};

// Taper-focus per doel (event-driven laatste week)
DOEL_FOCUS.FTP.Taper      = 'Korte openers + Z2 onderhoud — geen FTP-blokken meer';
DOEL_FOCUS.VO2max.Taper   = 'Korte openers 4x30s @ 115% + rust';
DOEL_FOCUS.Conditie.Taper = 'Korte Z2 ritjes — benen los, fris worden';

var MACRO_UITLEG = {
  Base:     'Fundament leggen — volume + lichte intensiteit voor doel-zone',
  Build:    'Stimulus opvoeren — doel-specifieke intensiteit erbij',
  Peak:     'Specificiteit + race-pace — hoogste belasting per minuut',
  Test:     'Meet vooruitgang — eind-test workout deze week',
  Taper:    'Volume afbouwen, scherpte behouden — kom fris aan de start',
  Recovery: 'Herstel na A-race — alles easy Z2, laat het lichaam aanpassen'
};

var FASE_KLEUR = {
  Base:     '#93c5fd',
  Build:    '#fde68a',
  Peak:     '#fca5a5',
  Test:     '#a78bfa',
  Taper:    '#c4b5fd',
  Recovery: '#86efac'
};

function buildDoel(ss) {
  var sh = getOrCreateSheet(ss, DOEL_SHEET);
  var s = readSettings(ss);
  var macro = computeMacroPhase(s.doelStart, new Date());

  // Title
  sh.getRange(1, 1, 1, 4).merge()
    .setValue('🎯  Doel Dashboard')
    .setFontWeight('bold').setFontSize(14)
    .setBackground('#1f2937').setFontColor('#ffffff')
    .setHorizontalAlignment('left').setVerticalAlignment('middle');
  sh.setRowHeight(1, 32);

  // Doel-naam + datums
  sh.getRange(3, 1).setValue('Primair doel:').setFontWeight('bold');
  sh.getRange(3, 2).setValue(s.doel).setFontSize(13).setFontWeight('bold');

  sh.getRange(4, 1).setValue('Startdatum:').setFontWeight('bold');
  sh.getRange(4, 2).setValue(s.doelStart).setNumberFormat('dd-MM-yyyy');

  var eind = new Date(s.doelStart.getTime() + s.doelDuur * 7 * 24 * 60 * 60 * 1000);
  sh.getRange(5, 1).setValue('Verwachte einddatum:').setFontWeight('bold');
  sh.getRange(5, 2).setValue(eind).setNumberFormat('dd-MM-yyyy');

  // Week + voortgang
  sh.getRange(7, 1).setValue('Week:').setFontWeight('bold');
  sh.getRange(7, 2).setValue(macro.week + ' van ' + s.doelDuur);

  sh.getRange(8, 1).setValue('Voortgang:').setFontWeight('bold');
  var filled = Math.min(macro.week, s.doelDuur);
  var empty  = Math.max(0, s.doelDuur - filled);
  var pct = Math.round(filled / s.doelDuur * 100);
  var bar = repeat('█', filled) + repeat('░', empty) + '  ' + pct + '%';
  sh.getRange(8, 2, 1, 3).merge().setValue(bar).setFontFamily('Courier New');

  // Macro-fase
  sh.getRange(10, 1).setValue('Macro-fase:').setFontWeight('bold');
  var faseCell = sh.getRange(10, 2);
  faseCell.setValue(macro.fase).setFontWeight('bold').setFontSize(13)
    .setBackground(FASE_KLEUR[macro.fase] || '#e5e7eb');

  sh.getRange(11, 1).setValue('Uitleg:').setFontWeight('bold').setVerticalAlignment('top');
  sh.getRange(11, 2, 1, 3).merge()
    .setValue(MACRO_UITLEG[macro.fase] || '—')
    .setWrap(true).setFontStyle('italic').setFontColor('#374151');

  // Focus deze fase voor doel
  sh.getRange(13, 1, 1, 4).merge()
    .setValue('Focus deze fase voor jouw doel:')
    .setFontWeight('bold').setBackground('#e5e7eb');

  var focus = (DOEL_FOCUS[s.doel] || {})[macro.fase] || '—';
  sh.getRange(14, 1).setValue(s.doel + ' — ' + macro.fase + ':').setFontWeight('bold');
  sh.getRange(14, 2, 1, 3).merge().setValue(focus).setWrap(true);

  // Volledige fase-tabel voor referentie
  sh.getRange(16, 1, 1, 4).merge()
    .setValue('Alle fasen voor doel: ' + s.doel)
    .setFontWeight('bold').setBackground('#e5e7eb');

  var alle = DOEL_FOCUS[s.doel] || {};
  var faseList = ['Base', 'Build', 'Peak', 'Test'];
  faseList.forEach(function (f, i) {
    var r = 17 + i;
    sh.getRange(r, 1).setValue(f).setFontWeight('bold')
      .setBackground(FASE_KLEUR[f] || '#e5e7eb');
    sh.getRange(r, 2, 1, 3).merge().setValue(alle[f] || '—').setWrap(true);
    if (f === macro.fase) {
      sh.getRange(r, 1, 1, 4).setBorder(true, true, true, true, false, false, '#111827', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    }
  });

  // Mesocyclus week info
  sh.getRange(22, 1).setValue('Mesocyclus week:').setFontWeight('bold');
  sh.getRange(22, 2).setValue(getMesoWeek() + ' van 4');
  var mesoUitleg = {
    1: '1.00× load — opbouwweek',
    2: '1.08× load — verhogen',
    3: '1.15× load — peak van mesocyclus',
    4: '0.60× load — recovery week'
  };
  sh.getRange(23, 1).setValue('Meso-fase:').setFontWeight('bold');
  sh.getRange(23, 2, 1, 3).merge().setValue(mesoUitleg[getMesoWeek()] || '')
    .setFontStyle('italic').setFontColor('#374151');

  // Doel-event (event-driven periodisering) — bron: Events-tab
  var ed = bepaalFaseVoorDatum_(weekStartDate(new Date()));
  if (ed.isRecovery && ed.hoofdEvent) {
    sh.getRange(25, 1, 1, 4).merge()
      .setValue('🌿  Recovery-week na A-race: ' + (ed.hoofdEvent.naam || ''))
      .setFontWeight('bold').setBackground('#dcfce7');
  } else if (ed.eventDriven && ed.hoofdEvent) {
    var ev = ed.hoofdEvent;
    sh.getRange(25, 1, 1, 4).merge()
      .setValue('🎯  Hoofd-event: ' + (ev.naam || '(naamloos)') +
                '  (' + ev.type + ', prio ' + ev.prioriteit + ')')
      .setFontWeight('bold').setBackground('#ede9fe');
    sh.getRange(26, 1).setValue('Event-datum:').setFontWeight('bold');
    sh.getRange(26, 2).setValue(ev.datum).setNumberFormat('dd-MM-yyyy');
    sh.getRange(27, 1).setValue('Profiel:').setFontWeight('bold');
    sh.getRange(27, 2, 1, 3).merge()
      .setValue((ev.afstandKm || '?') + ' km / ' + (ev.hm || '?') + ' hm — ' + ev.klimType + ' klimmen');
    sh.getRange(28, 1).setValue('Weken tot event:').setFontWeight('bold');
    sh.getRange(28, 2).setValue(ed.wekenTotEvent != null ? ed.wekenTotEvent : '—');
    sh.getRange(29, 1).setValue('Event-fase (deze week):').setFontWeight('bold');
    sh.getRange(29, 2).setValue(ed.fase)
      .setFontWeight('bold').setBackground(FASE_KLEUR[ed.fase] || '#e5e7eb');
  }

  SpreadsheetApp.flush();
  sh.setColumnWidth(1, 200);
  sh.setColumnWidth(2, 200);
  sh.setColumnWidth(3, 200);
  sh.setColumnWidth(4, 200);
  sh.setFrozenRows(1);
}

function repeat(ch, n) {
  if (n <= 0) return '';
  var s = '';
  for (var i = 0; i < n; i++) s += ch;
  return s;
}

/**
 * Kiest het hoofd-event uit een (gesorteerde) events-lijst: het
 * eerstvolgende event dat prioriteit A heeft OF van type 'trip' is.
 */
function pickMainEvent_(events, fromDate) {
  for (var i = 0; i < events.length; i++) {
    var e = events[i];
    var ed = new Date(e.datum.getFullYear(), e.datum.getMonth(), e.datum.getDate());
    if (ed < fromDate) continue;
    if (e.prioriteit === 'A' || e.type === 'trip') return e;
  }
  return null;
}

/**
 * Pure event-driven fase-helper — ÉÉN bron van waarheid voor de fase-mapping.
 * Meet ALLES vanaf refDate (= vandaag voor de huidige week; zie
 * bepaalFaseVoorDatum_ voor de ref-keuze), NIET vanaf de week-maandag.
 *
 * macroFase = de periodisering van het A/trip-hoofdevent (Base/Build/Peak),
 * LOS van een taper. taperEvent/taperVenster = de per-dag-taper-overlay:
 *   Recovery: A-RACE die deze week (maandag..refDate) al plaatsvond.
 *   Taper:    A/trip ≤ A_TAPER_DAGEN (7) d  → taperEvent = hoofd, venster 7;
 *             anders dichtstbijzijnde B met 0..B_TAPER_DAGEN (3) d → venster 3;
 *             C telt nooit. Een near-B drijft de taper maar NIET de macro.
 *   macroFase op wekenTot:  >= 9 Base / >= 5 Build / else Peak.
 *   fase = Recovery > Taper (taperEvent≠null) > macroFase.
 *
 * @param events  array uit getAllEvents_() (Date-datum, prioriteit, type, naam)
 * @param refDate Date — referentie-datum (meestal vandaag)
 * @return { fase, macroFase, hoofdEvent, taperEvent, taperVenster, dagenTot,
 *           wekenTot } of null (geen A/trip-hoofdevent)
 */
function eventFase_(events, refDate) {
  var ref = stripTime_(refDate);

  // Recovery: A-race die deze week (maandag..ref) al geweest is.
  var wkMon = weekStartDate(ref);
  for (var i = 0; i < events.length; i++) {
    var e = events[i];
    var ed = stripTime_(e.datum);
    if (e.prioriteit === 'A' && e.type === 'race' &&
        ed.getTime() >= wkMon.getTime() && ed.getTime() <= ref.getTime()) {
      return { fase: 'Recovery', macroFase: 'Recovery', hoofdEvent: e,
               taperEvent: null, taperVenster: 0, dagenTot: 0, wekenTot: 0 };
    }
  }

  // Hoofd-event = eerstvolgende A-event of trip → drijft de macro.
  var hoofd = pickMainEvent_(events, ref);
  if (!hoofd) return null;

  var hed = stripTime_(hoofd.datum);
  var dagenTot = Math.round((hed.getTime() - ref.getTime()) / 86400000);
  var wekenTot = Math.ceil(dagenTot / 7);

  var macroFase;
  if (wekenTot >= 9)      macroFase = 'Base';
  else if (wekenTot >= 5) macroFase = 'Build';
  else                    macroFase = 'Peak';

  // Taper-overlay: A/trip-venster (7) gaat vóór een near-B-venster (3); C nooit.
  var taperEvent = null, taperVenster = 0;
  if (dagenTot <= A_TAPER_DAGEN) {
    taperEvent = hoofd; taperVenster = A_TAPER_DAGEN;
  } else {
    var besteB = null, besteBd = null;
    for (var j = 0; j < events.length; j++) {
      var b = events[j];
      if (b.prioriteit !== 'B') continue;
      var bd = Math.round((stripTime_(b.datum).getTime() - ref.getTime()) / 86400000);
      if (bd >= 0 && bd <= B_TAPER_DAGEN && (besteBd === null || bd < besteBd)) {
        besteB = b; besteBd = bd;
      }
    }
    if (besteB) { taperEvent = besteB; taperVenster = B_TAPER_DAGEN; }
  }

  var fase = taperEvent ? 'Taper' : macroFase;

  return { fase: fase, macroFase: macroFase, hoofdEvent: hoofd,
           taperEvent: taperEvent, taperVenster: taperVenster,
           dagenTot: dagenTot, wekenTot: wekenTot };
}

/**
 * Event-driven fase voor een te plannen week. Kiest de referentie-datum
 * (vandaag voor de huidige week, anders de week-maandag) en delegeert de
 * mapping aan eventFase_. Geen hoofd-event → vaste mesocyclus (fallback).
 *
 * @param weekStart Date — maandag van de te plannen week
 * @return { fase, week, wekenTotEvent, dagenTotEvent, macroFase, taperEventDate,
 *           taperVenster, taperIsTrip, isTaper, isRecovery, isTestWeek,
 *           eventDriven, hoofdEvent, eventName, eventDate }
 */
/**
 * Fase 1a: plan-card model (PeriodTimeline) voor de Schema-top. Puur afgeleid
 * uit de bestaande fase-logica (macro = bepaalFaseVoorDatum_-resultaat) + Events
 * + getVolumeTargets. Geen nieuwe drempels.
 */
function buildPlanModel_(macro, settings, eventsData) {
  var today = stripTime_(new Date());
  var PHASES = [
    { key: 'Base',  label: 'Basis' },
    { key: 'Build', label: 'Build' },
    { key: 'Peak',  label: 'Peak'  },
    { key: 'Taper', label: 'Taper' }
  ];
  var LABELS = { Base: 'Basis', Build: 'Build', Peak: 'Peak', Taper: 'Taper', Test: 'Test', Recovery: 'Herstel' };
  var IDX    = { Base: 0, Build: 1, Peak: 2, Taper: 3, Test: 3, Recovery: 4 };
  var cur = macro.fase;
  var curIdx = (IDX[cur] != null) ? IDX[cur] : 1;
  var phases = PHASES.map(function (p, i) {
    return { key: p.key, label: p.label,
             state: i < curIdx ? 'past' : (i === curIdx ? 'current' : 'future') };
  });

  var dagenTot = macro.eventDate
    ? Math.round((stripTime_(new Date(macro.eventDate)).getTime() - today.getTime()) / 86400000)
    : null;
  if (dagenTot != null && dagenTot < 0) dagenTot = null;

  var events = (eventsData || getAllEvents_())
    .filter(function (e) {
      return (e.prioriteit === 'A' || e.prioriteit === 'B') && stripTime_(e.datum).getTime() >= today.getTime();
    })
    .slice(0, 3)
    .map(function (e) {
      return { naam: e.naam, prio: e.prioriteit, type: e.type,
               dagenTot: Math.round((stripTime_(e.datum).getTime() - today.getTime()) / 86400000) };
    });

  var band = getVolumeTargets()[cur] || null;

  return {
    modeLabel: macro.eventDriven ? 'Doel-gericht' : (settings.fase === 'maintain' ? 'Onderhoud' : 'Opbouw'),
    eventName: macro.eventName || null,
    wekenTot: (macro.wekenTotEvent != null) ? macro.wekenTotEvent : null,
    dagenTot: dagenTot,
    currentPhaseKey: cur,
    currentPhaseLabel: LABELS[cur] || cur,
    phases: phases,
    events: events,
    volume: band ? { label: 'Volume', value: band[0] + '–' + band[1] + ' u' } : null
  };
}

function bepaalFaseVoorDatum_(weekStart, events) {
  var ss = SpreadsheetApp.getActive();
  var ws = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var weekEnd = new Date(ws.getTime() + 7 * 24 * 60 * 60 * 1000);

  function vasteMeso(extra) {
    var s = readSettings(ss);
    var m = computeMacroPhase(s.doelStart, new Date());
    var base = {
      fase: m.fase, week: m.week, wekenTotEvent: null, dagenTotEvent: null,
      macroFase: m.fase, taperEventDate: null, taperVenster: 0, taperIsTrip: false,
      isTaper: false, isRecovery: false, isTestWeek: m.isTestWeek,
      eventDriven: false, hoofdEvent: null, eventName: null, eventDate: null
    };
    if (extra) Object.keys(extra).forEach(function (k) { base[k] = extra[k]; });
    return base;
  }

  var all = events || getAllEvents_();   // PERF: lever-c — gegeven events hergebruiken, anders zelf lezen

  // Referentie-datum: VANDAAG als de te plannen week de huidige week is (de
  // aftelling leeft vanaf vandaag, niet vanaf maandag — dit is de fix); anders
  // de week-maandag, zodat de historische per-week fase-loop (voortgang,
  // WebApp.gs) én de +1-week-planning vanaf hun eigen weekgrens blijven meten.
  var ref = (today.getTime() >= ws.getTime() && today.getTime() < weekEnd.getTime()) ? today : ws;

  var ef = eventFase_(all, ref);
  if (!ef) return vasteMeso();

  if (ef.fase === 'Recovery') {
    return {
      fase: 'Recovery', week: null, wekenTotEvent: 0, dagenTotEvent: 0,
      macroFase: 'Recovery', taperEventDate: null, taperVenster: 0, taperIsTrip: false,
      isTaper: false, isRecovery: true, isTestWeek: false,
      eventDriven: true, hoofdEvent: ef.hoofdEvent,
      eventName: ef.hoofdEvent.naam, eventDate: ef.hoofdEvent.datum
    };
  }

  return {
    fase: ef.fase,
    week: null,
    wekenTotEvent: ef.wekenTot,
    dagenTotEvent: ef.dagenTot,
    macroFase: ef.macroFase,
    taperEventDate: ef.taperEvent ? ef.taperEvent.datum : null,
    taperVenster: ef.taperVenster,
    taperIsTrip: ef.taperEvent ? ef.taperEvent.type === 'trip' : false,
    isTaper: ef.fase === 'Taper',
    isRecovery: false,
    isTestWeek: false,
    eventDriven: true,
    hoofdEvent: ef.hoofdEvent,
    eventName: ef.hoofdEvent.naam,
    eventDate: ef.hoofdEvent.datum
  };
}
