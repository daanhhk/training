/**
 * Archetypes.gs — FASE 1 deel 1: doel-AGNOSTISCHE archetype-funderingslaag.
 *
 * PURE additie — NIETS bestaands gewijzigd, GEEN inplug in buildWorkout/keyIntensity/
 * assignWorkouts. expandArchetype_(rec, ctx) → output BYTE-COMPATIBEL met buildWorkout
 * (naam/focus/zones/totaalMin/structuur/intent/tss/eindopmerking/tooLong?) + ÉÉN superset:
 *   blokken: [{minuten, zone, pctLo, pctHi}]   — pctLo/pctHi NUMERIEK (lost de structuur-
 *   string-pct-verdamping op → basis voor push-numeriek + Item 3 slider-live wattlist).
 *   structuur: [[label, duurStr, "lo-hiW", bpm, note]] — EXACT de bestaande grammatica
 *   (push: dslBlockFromRow_/dslPowerRange_ blijven werken).
 *
 * HERGEBRUIK (geen duplicatie): wattsRange/watts (Utils.gs), pctZoneBucket_/
 * tssFromZoneMinutes_ (Algorithm.gs), bpmRange/bpmBelow (Utils.gs).
 *
 * Afwijkingen t.o.v. de prompt (bewust, gemeld in 't rapport):
 *  - blok.zone = bucket-STRING (rust/z2/tempo/drempel/anaeroob) i.p.v. int 1..6 — byte-compat
 *    met de bestaande {minuten,zone} die segmentsFromBlokken_/DASH_BUCKET_STYLE_ leest. De int
 *    1..6 leeft op record-niveau (rec.zone). pctZoneBucket_ returnt strings, niet 1..6.
 *  - ctx krijgt een OPTIONELE `lthr` (de gepinde ctx laat 'm weg, maar bpmRange/bpmBelow eisen 'm);
 *    afwezig → bpm '—' (row[3] = display-only, wordt NOOIT door de push geparsed).
 *  - tooLong = object {available,needed} (byte-compat met buildWorkout) i.p.v. boolean true (truthy).
 *  - zones afgeleid uit ALLE blok-load-buckets (incl. warmup→low) → een vo2-archetype geeft
 *    ['low','anaerobic'] (spec: "zones ... uit de blok-zones").
 */

var ARCHETYPE_STRUCTUURTYPES = ['steady', 'intervals', 'pyramid', 'microburst', 'sandwich', 'race_sim'];

// Effect-tags ⊆ Coach-intent-vocab (COACH_TYPE_INTENT_, Coach.gs) EXCL 'vrij'. Geverifieerd.
var ARCHETYPE_EFFECT_TAGS = ['herstel', 'duur', 'tempo', 'sweetspot', 'drempel', 'vo2'];

// 5-bucket display-zone (pctZoneBucket_) → 3-bucket load-focus (intent/tss). rust+z2→low,
// tempo+drempel→high, anaeroob→anaerobic (spiegelt renderVariant_'s intent-toewijzing).
var ARCHETYPE_LOAD_FROM_BUCKET_ = { rust: 'low', z2: 'low', tempo: 'high', drempel: 'high', anaeroob: 'anaerobic' };

// bpm-rij (row[3]) — HERGEBRUIK bpmBelow/bpmRange als ctx.lthr aanwezig; anders '—'.
// row[3] is display-only: de push (dslBlockFromRow_) leest 'm nooit.
function archBpm_(kind, lthr) {
  if (!lthr) return '—';
  if (kind === 'warmup')   return bpmBelow(lthr, 85);
  if (kind === 'cooldown') return '—';
  if (kind === 'work')     return bpmRange(lthr, 88, 100);
  return bpmRange(lthr, 78, 90);   // steady / fill
}

/**
 * Breidt een archetype-record uit naar een concrete workout (PUUR).
 * ctx = {ftp, doelMin, mesoFactor, faseOffset, lthr?}.
 * 1) adj(pct)=round(pct*mesoFactor)+faseOffset op ALLE pct (zoals renderVariant_).
 * 2) core: steady→1 blok; int→reps×[on,off] runtime-blokken + ÉÉN repeat-structuur-rij.
 * 3) warmup vóór, cooldown ná. 4) fill-endurance tot doelMin (geen negatieve fill → tooLong).
 * 5) per blok: minuten + pctLo/pctHi (na adj) + zone via pctZoneBucket_.
 * 6) structuur-rijen in de bestaande duurStr/watt-grammatica (push-parsebaar).
 * 7) zones + intent uit de blok-zones; tss via tssFromZoneMinutes_.
 */
function expandArchetype_(rec, ctx) {
  ctx = ctx || {};
  var ftp = ctx.ftp, lthr = ctx.lthr || null;
  var mf = (ctx.mesoFactor != null) ? ctx.mesoFactor : 1.0;
  var fo = ctx.faseOffset || 0;
  var doelMin = (ctx.doelMin != null) ? ctx.doelMin : rec.duurRange[0];
  function adj(p) { return Math.round(p * mf) + fo; }
  function r1(x) { return Math.round(x * 10) / 10; }

  var blokken = [], structuur = [];
  // 1:1 blok+rij (warmup/steady/fill/cooldown). Returnt de geëmitte minuten.
  function emit(label, durMin, durStr, pctLo, pctHi, kind, note) {
    var min = r1(durMin);
    var mid = Math.round((pctLo + pctHi) / 2);
    blokken.push({ minuten: min, zone: pctZoneBucket_(mid), pctLo: pctLo, pctHi: pctHi });
    structuur.push([label, durStr, wattsRange(ftp, pctLo, pctHi), archBpm_(kind, lthr), note || '']);
    return min;
  }

  // (3) warmup
  var w = rec.warmup;
  var wLo = (w.pctLo != null) ? adj(w.pctLo) : adj(w.pct);
  var wHi = (w.pctHi != null) ? adj(w.pctHi) : adj(w.pct);
  var preMin = emit('Warmup', w.durMin, w.durMin + ' min', wLo, wHi, 'warmup', 'Inrijden, opbouwend');

  // (2) core
  rec.core.forEach(function (c) {
    if (c.kind === 'steady') {
      var p = adj(c.pct);
      preMin += emit(c.label, c.durMin, c.durMin + ' min', p, p, 'work', c.note || 'Stabiel');
    } else { // int
      var onMin  = (c.onMin != null) ? c.onMin : c.onSec / 60;
      var offMin = (c.offMin != null) ? c.offMin : c.offSec / 60;
      var onUnit  = (c.onMin != null) ? 'min' : 'sec';
      var offUnit = (c.offMin != null) ? 'min' : 'sec';
      var onVal   = (c.onMin != null) ? c.onMin : c.onSec;
      var offVal  = (c.offMin != null) ? c.offMin : c.offSec;
      var onP = adj(c.onPct), offP = adj(c.offPct);
      // ÉÉN repeat-rij ("Nx M min/sec"), rust in de note — exact renderVariant_'s vorm.
      structuur.push([c.label, c.reps + 'x ' + onVal + ' ' + onUnit, wattsRange(ftp, onP, onP),
        archBpm_('work', lthr), offVal + ' ' + offUnit + ' rust @ ' + offP + '%']);
      // reps × [on, off] runtime-blokken (balk + intent), GEEN extra structuur-rij.
      for (var rr = 0; rr < c.reps; rr++) {
        if (onMin > 0)  { blokken.push({ minuten: r1(onMin),  zone: pctZoneBucket_(onP),  pctLo: onP,  pctHi: onP  }); preMin += r1(onMin); }
        if (offMin > 0) { blokken.push({ minuten: r1(offMin), zone: pctZoneBucket_(offP), pctLo: offP, pctHi: offP }); preMin += r1(offMin); }
      }
    }
  });

  // (4) fill-endurance tussen core en cooldown; geen negatieve fill → tooLong.
  var cd = rec.cooldown;
  var cLo = (cd.pctLo != null) ? adj(cd.pctLo) : adj(cd.pct);
  var cHi = (cd.pctHi != null) ? adj(cd.pctHi) : adj(cd.pct);
  var fixed = preMin + cd.durMin;
  var fillMin = Math.round(doelMin - fixed);
  var tooLong = (doelMin < fixed) ? { available: doelMin, needed: fixed } : null;
  if (fillMin >= 1) {
    var fp = adj(rec.fill.pct);
    emit('Z2 endurance', fillMin, fillMin + ' min', fp, fp, 'steady', 'Aanvullende duur — rustige Z2');
  }
  emit('Cooldown', cd.durMin, cd.durMin + ' min', cLo, cHi, 'cooldown', 'Easy uit');

  // (7) zones (load-focus) + intent (minuten) + totaalMin uit de blok-zones.
  var intent = { low: 0, high: 0, anaerobic: 0 }, totaal = 0, zoneSet = {};
  blokken.forEach(function (b) {
    totaal += b.minuten;
    var lf = ARCHETYPE_LOAD_FROM_BUCKET_[b.zone] || 'low';
    intent[lf] += b.minuten;
    zoneSet[lf] = true;
  });
  intent.low = Math.round(intent.low);
  intent.high = Math.round(intent.high);
  intent.anaerobic = Math.round(intent.anaerobic);
  var zones = ['low', 'high', 'anaerobic'].filter(function (z) { return zoneSet[z]; });

  var out = {
    naam: rec.naam,
    focus: rec.focus,
    zones: zones,
    totaalMin: totaal,   // = Σ blok-minuten (NIET her-afronden → test Σ==totaalMin blijft exact)
    structuur: structuur,
    intent: intent,
    blokken: blokken,
    tss: tssFromZoneMinutes_(intent),
    eindopmerking: rec.eindopmerking
  };
  if (tooLong) out.tooLong = tooLong;
  return out;
}

/**
 * 3 TEST-ONLY fixture-archetypes (vorm gepind; getallen realistisch). Dekt
 * steady + min-interval + sec-interval → de volledige push-grammatica (min + sec).
 * NIET in een productie-pool — alleen door testArchetype_ gebruikt.
 */
function archetypeFixtures_() {
  return [
    // (A) steady-duur
    { id: 'fx_steady_duur', structuurtype: 'steady', effectTags: ['duur'], zone: 2,
      duurRange: [75, 180],
      warmup: { durMin: 10, pctLo: 50, pctHi: 65 },
      core: [{ kind: 'steady', label: 'Z2 base', durMin: 60, pct: 65 }],
      cooldown: { durMin: 5, pctLo: 45, pctHi: 55 },
      fill: { zone: 2, pct: 65 },
      naam: 'Fixture Steady Duur', focus: 'aerobic base', eindopmerking: 'Test-fixture steady.' },
    // (B) drempel-intervallen (min-interval)
    { id: 'fx_drempel_int', structuurtype: 'intervals', effectTags: ['drempel'], zone: 4,
      duurRange: [60, 120],
      warmup: { durMin: 12, pctLo: 50, pctHi: 65 },
      core: [{ kind: 'int', label: 'Drempel', reps: 3, onMin: 12, onPct: 98, offMin: 4, offPct: 55 }],
      cooldown: { durMin: 8, pctLo: 45, pctHi: 55 },
      fill: { zone: 2, pct: 65 },
      naam: 'Fixture Drempel Intervallen', focus: 'sustained threshold', eindopmerking: 'Test-fixture intervals.' },
    // (C) microburst (sec-interval)
    { id: 'fx_microburst_vo2', structuurtype: 'microburst', effectTags: ['vo2'], zone: 5,
      duurRange: [35, 75],
      warmup: { durMin: 12, pctLo: 50, pctHi: 65 },
      core: [{ kind: 'int', label: 'Microbursts', reps: 9, onSec: 30, onPct: 118, offSec: 15, offPct: 50 }],
      cooldown: { durMin: 8, pctLo: 45, pctHi: 55 },
      fill: { zone: 2, pct: 65 },
      naam: 'Fixture Microburst', focus: 'vo2 capacity', eindopmerking: 'Test-fixture microburst.' }
  ];
}

/**
 * PRODUCTIE-archetype-register — klim/FTP-kwaliteit (drempel/sweetspot/vo2).
 * Data-only; NIET ingeplugd (geen goalWorkout_/buildWorkout-route nog). Elk record
 * leeft in 't bestaande schema en valideert via expandArchetype_ + push-pariteit.
 * duurRange.min = warmup+core+cooldown (geen fill); .max = + ~30-40 min Z2-fill.
 * Doseringen spiegelen de bestaande generators waar een equivalent bestaat.
 * over-unders + pyramids = sequentie van steady/int-blocks (grammatica past — geen expander-wijziging).
 */
var ARCHETYPES = [
  // ── DREMPEL ──
  { id: 'threshold_long', structuurtype: 'intervals', effectTags: ['drempel'], zone: 4,
    duurRange: [82, 120],
    warmup: { durMin: 15, pctLo: 55, pctHi: 75 },
    core: [{ kind: 'int', label: 'Drempel', reps: 3, onMin: 14, onPct: 98, offMin: 5, offPct: 55 }],
    cooldown: { durMin: 10, pctLo: 45, pctHi: 55 },
    fill: { zone: 2, pct: 65 },
    naam: 'Drempel lang 3×14', focus: 'sustained threshold',
    eindopmerking: 'Lange drempelblokken — pacen als een alpine col.' },
  { id: 'threshold_overunder', structuurtype: 'intervals', effectTags: ['drempel'], zone: 4,
    duurRange: [54, 90],
    warmup: { durMin: 15, pctLo: 55, pctHi: 75 },
    core: [
      { kind: 'steady', label: 'Over', durMin: 3, pct: 105, note: 'Boven FTP — lactaat opbouwen' },
      { kind: 'steady', label: 'Under', durMin: 4, pct: 92, note: 'Onder FTP — klaren, niet uitrusten' },
      { kind: 'steady', label: 'Herstel', durMin: 4, pct: 55, note: 'Easy tussen de sets' },
      { kind: 'steady', label: 'Over', durMin: 3, pct: 105, note: 'Boven FTP' },
      { kind: 'steady', label: 'Under', durMin: 4, pct: 92, note: 'Onder FTP' },
      { kind: 'steady', label: 'Herstel', durMin: 4, pct: 55, note: 'Easy tussen de sets' },
      { kind: 'steady', label: 'Over', durMin: 3, pct: 105, note: 'Boven FTP' },
      { kind: 'steady', label: 'Under', durMin: 4, pct: 92, note: 'Onder FTP, afsluiten' }
    ],
    cooldown: { durMin: 10, pctLo: 45, pctHi: 55 },
    fill: { zone: 2, pct: 65 },
    naam: 'Drempel over-under 3 sets', focus: 'lactate clearance',
    eindopmerking: 'Wisselen boven/onder FTP — leert klaren onder druk.' },
  // ── SWEET SPOT ──
  { id: 'sweetspot_long', structuurtype: 'intervals', effectTags: ['sweetspot'], zone: 4,
    duurRange: [103, 135],
    warmup: { durMin: 15, pctLo: 55, pctHi: 70 },
    core: [{ kind: 'int', label: 'Sweet Spot', reps: 3, onMin: 20, onPct: 90, offMin: 6, offPct: 50 }],
    cooldown: { durMin: 10, pctLo: 45, pctHi: 55 },
    fill: { zone: 2, pct: 65 },
    naam: 'Sweet Spot lang 3×20', focus: 'climbing endurance',
    eindopmerking: 'Lange sweet-spot blokken — uren in de klim-zone.' },
  { id: 'sweetspot_pyramid', structuurtype: 'pyramid', effectTags: ['sweetspot'], zone: 4,
    duurRange: [89, 120],
    warmup: { durMin: 12, pctLo: 55, pctHi: 70 },
    core: [
      { kind: 'steady', label: 'SS 10', durMin: 10, pct: 88, note: 'Opbouwen' },
      { kind: 'steady', label: 'Herstel', durMin: 3, pct: 55, note: 'Kort lossen' },
      { kind: 'steady', label: 'SS 15', durMin: 15, pct: 90, note: 'Middenblok' },
      { kind: 'steady', label: 'Herstel', durMin: 3, pct: 55, note: 'Kort lossen' },
      { kind: 'steady', label: 'SS 20', durMin: 20, pct: 92, note: 'Piekblok' },
      { kind: 'steady', label: 'Herstel', durMin: 3, pct: 55, note: 'Kort lossen' },
      { kind: 'steady', label: 'SS 15', durMin: 15, pct: 90, note: 'Afbouwen' }
    ],
    cooldown: { durMin: 8, pctLo: 45, pctHi: 55 },
    fill: { zone: 2, pct: 65 },
    naam: 'Sweet Spot piramide', focus: 'climbing endurance',
    eindopmerking: 'Oplopend/aflopend — variatie binnen de sweet spot.' },
  // BALANS (toegevoegd): sweet spot was alleen lang-gedekt (min 89-103); deze vult ~52-90min.
  { id: 'sweetspot_short', structuurtype: 'intervals', effectTags: ['sweetspot'], zone: 4,
    duurRange: [52, 90],
    warmup: { durMin: 12, pctLo: 55, pctHi: 70 },
    core: [{ kind: 'int', label: 'Sweet Spot', reps: 2, onMin: 12, onPct: 90, offMin: 4, offPct: 50 }],
    cooldown: { durMin: 8, pctLo: 45, pctHi: 55 },
    fill: { zone: 2, pct: 65 },
    naam: 'Sweet Spot kort 2×12', focus: 'sweet spot',
    eindopmerking: 'Korte sweet-spot dosis — past in een doordeweekse sessie.' },
  // ── VO2 ──
  { id: 'vo2_long', structuurtype: 'intervals', effectTags: ['vo2'], zone: 5,
    duurRange: [65, 100],
    warmup: { durMin: 15, pctLo: 55, pctHi: 80 },
    core: [{ kind: 'int', label: 'VO2 5×4', reps: 5, onMin: 4, onPct: 112, offMin: 4, offPct: 50 }],
    cooldown: { durMin: 10, pctLo: 45, pctHi: 55 },
    fill: { zone: 2, pct: 65 },
    naam: 'VO2max 5×4', focus: 'vo2 capacity',
    eindopmerking: 'Klassieke 5×4 — maximaal aerobe prikkel.' },
  { id: 'vo2_hill_repeats', structuurtype: 'intervals', effectTags: ['vo2'], zone: 5,
    duurRange: [59, 95],
    warmup: { durMin: 15, pctLo: 55, pctHi: 80 },
    core: [{ kind: 'int', label: 'Hill reps', reps: 9, onSec: 90, onPct: 115, offMin: 2, offPct: 50 }],
    cooldown: { durMin: 12, pctLo: 45, pctHi: 55 },
    fill: { zone: 2, pct: 65 },
    naam: 'VO2 Hill Repeats 9×90s', focus: 'explosive climbing',
    eindopmerking: 'Korte explosieve klim-efforts — punchy beklimmingen.' },
  { id: 'vo2_microburst', structuurtype: 'microburst', effectTags: ['vo2'], zone: 5,
    duurRange: [35, 70],
    warmup: { durMin: 15, pctLo: 55, pctHi: 80 },
    core: [{ kind: 'int', label: 'Microbursts 30/30', reps: 10, onSec: 30, onPct: 122, offSec: 30, offPct: 50 }],
    cooldown: { durMin: 10, pctLo: 45, pctHi: 55 },
    fill: { zone: 2, pct: 65 },
    naam: 'Anaerobe capaciteit 10×30/30', focus: 'anaerobic capacity',
    eindopmerking: 'Snelle herhalingen — anaerobe capaciteit + herstel.' },
  { id: 'vo2_pyramid', structuurtype: 'pyramid', effectTags: ['vo2'], zone: 5,
    duurRange: [42, 75],
    warmup: { durMin: 15, pctLo: 55, pctHi: 80 },
    core: [
      { kind: 'steady', label: 'VO2 1', durMin: 1, pct: 115, note: 'Opbouwen' },
      { kind: 'steady', label: 'Herstel', durMin: 2, pct: 50, note: 'Lossen' },
      { kind: 'steady', label: 'VO2 2', durMin: 2, pct: 115, note: 'Door' },
      { kind: 'steady', label: 'Herstel', durMin: 2, pct: 50, note: 'Lossen' },
      { kind: 'steady', label: 'VO2 3', durMin: 3, pct: 115, note: 'Piek' },
      { kind: 'steady', label: 'Herstel', durMin: 2, pct: 50, note: 'Lossen' },
      { kind: 'steady', label: 'VO2 2', durMin: 2, pct: 115, note: 'Afbouwen' },
      { kind: 'steady', label: 'Herstel', durMin: 2, pct: 50, note: 'Lossen' },
      { kind: 'steady', label: 'VO2 1', durMin: 1, pct: 115, note: 'Afsluiten' }
    ],
    cooldown: { durMin: 10, pctLo: 45, pctHi: 55 },
    fill: { zone: 2, pct: 65 },
    naam: 'VO2 piramide 1-2-3-2-1', focus: 'vo2 capacity',
    eindopmerking: 'Oplopende VO2-treden — variatie in de prikkel.' }
];
