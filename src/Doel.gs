/**
 * Doel.gs — Tab "Doel".
 *
 * Macrocyclus dashboard: huidige week/fase, voortgangsbalk, uitleg
 * per fase en doel-specifieke focus voor de huidige fase.
 */

var DOEL_SHEET = 'Doel';

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
 * Event-driven fase-berekening. Telt terug vanaf het hoofd-event
 * (eerstvolgende A-event of trip) uit de Events-tab.
 *
 * Fase-mapping op wekenTotEvent:
 *   >= 9   → Base
 *   5-8    → Build
 *   3-4    → Peak
 *   2      → Peak (laatste kwaliteit, nog vol volume)
 *   1 / 0  → Taper (laatste 7 dagen voor event)
 *
 * Recovery: A-RACE die deze week al geweest is → Recovery-week.
 * Geen hoofd-event → vaste mesocyclus (fallback).
 *
 * @param weekStart Date — maandag van de te plannen week
 * @return { fase, week, wekenTotEvent, isTaper, isRecovery, isTestWeek,
 *           eventDriven, hoofdEvent, eventName, eventDate }
 */
function bepaalFaseVoorDatum_(weekStart) {
  var ss = SpreadsheetApp.getActive();
  var ws = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var weekEnd = new Date(ws.getTime() + 7 * 24 * 60 * 60 * 1000);

  function vasteMeso(extra) {
    var s = readSettings(ss);
    var m = computeMacroPhase(s.doelStart, new Date());
    var base = {
      fase: m.fase, week: m.week, wekenTotEvent: null,
      isTaper: false, isRecovery: false, isTestWeek: m.isTestWeek,
      eventDriven: false, hoofdEvent: null, eventName: null, eventDate: null
    };
    if (extra) Object.keys(extra).forEach(function (k) { base[k] = extra[k]; });
    return base;
  }

  var all = getAllEvents_();

  // Recovery: A-race die deze week al plaatsvond (datum in [weekStart, vandaag])
  for (var i = 0; i < all.length; i++) {
    var e = all[i];
    var ed = new Date(e.datum.getFullYear(), e.datum.getMonth(), e.datum.getDate());
    if (e.prioriteit === 'A' && e.type === 'race' && ed >= ws && ed <= today) {
      return {
        fase: 'Recovery', week: null, wekenTotEvent: 0,
        isTaper: false, isRecovery: true, isTestWeek: false,
        eventDriven: true, hoofdEvent: e, eventName: e.naam, eventDate: e.datum
      };
    }
  }

  // Hoofd-event = eerstvolgende A-event of trip vanaf deze week
  var hoofd = pickMainEvent_(all, ws);
  if (!hoofd) return vasteMeso();

  var hed = new Date(hoofd.datum.getFullYear(), hoofd.datum.getMonth(), hoofd.datum.getDate());
  var wekenTotEvent = Math.ceil((hed - ws) / (7 * 24 * 60 * 60 * 1000));

  var fase, isTaper = false;
  if (wekenTotEvent >= 9)      fase = 'Base';
  else if (wekenTotEvent >= 5) fase = 'Build';
  else if (wekenTotEvent >= 2) fase = 'Peak';
  else                          { fase = 'Taper'; isTaper = true; } // 1 of 0 (event deze week)

  return {
    fase: fase,
    week: null,
    wekenTotEvent: wekenTotEvent,
    isTaper: isTaper,
    isRecovery: false,
    isTestWeek: false,
    eventDriven: true,
    hoofdEvent: hoofd,
    eventName: hoofd.naam,
    eventDate: hoofd.datum
  };
}
