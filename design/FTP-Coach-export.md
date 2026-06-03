================================================================
FTP COACH — DESIGN EXPORT
Mobiele wieler-trainingsapp · dark pro-tool · NL
================================================================

FORMAAT: de schermen zijn React-componenten met inline-styles die
allemaal de CSS-custom-properties uit tokens.css consumeren. Per
bestand staat hieronder welke schermen/onderdelen erin zitten.

SCHERM → BESTAND
- Status-deck (gereedheid-ring, niveau-blok), ochtend-check-in,
  gereedheid-"waarom", Vorm-tab, MetricRow .......... app.jsx
- ProgressRing, NiveauChart (lijngrafiek) ........... chart.jsx
- Conditie-balans (balans/driehoek/PMC) ............. conditie.jsx
- Zone-balk, blok-detail, workout-detail, bibliotheek
  (categorie+varianten), picker, lege/fout-staten .... workout.jsx
- Trainingen-tab (categorie → varianten → detail) ... trainingen.jsx
- Schema: dag-strip, dag-detail (voorstel/voltooid/rustdag/
  multi-sessie), RPE, override-flow, Garmin-push (incl.
  "verouderd"), beschikbaarheid dag/week, event-tijdlijn,
  week-belasting + "werk week bij" ................... schema.jsx
- Instellingen (profiel, doel&blok, events, koppelingen) settings.jsx
- App-shell, tabs, scherm-navigatie, HTML+globale CSS . app.jsx / .html



////////////////////////////////////////////////////////////////
// FILE: tokens.css
////////////////////////////////////////////////////////////////

```css
/* ============================================================================
   FTP COACH — Design Tokens
   Dark, data-dichte performance-tool. Telefoon-first (~390px).
   Implementeer deze als hand-CSS; de mock consumeert exact dezelfde namen.
   ============================================================================ */

:root {

  /* ─────────────────────────────────────────────────────────────
     ACHTERGROND-LAGEN
     Donkere, koel-neutrale stack. Hoger = lichter = "dichterbij".
     ───────────────────────────────────────────────────────────── */
  --bg-app:        #0A0D12;   /* app-canvas, diepste laag                   */
  --bg-sunken:     #070A0E;   /* ingedrukte velden, grafiek-plot, lege rij  */
  --bg-surface:    #12161D;   /* standaard kaart / paneel                   */
  --bg-elevated:   #1A212B;   /* chips, tooltips, actieve tegel             */
  --border-subtle: #232B36;   /* hairline-scheiding binnen surfaces         */
  --border-strong: #313B49;   /* rand van interactieve / verhoogde objecten */

  /* ─────────────────────────────────────────────────────────────
     TEKST  (op donkere lagen)
     ───────────────────────────────────────────────────────────── */
  --text-primary:   #EDF1F5;  /* koppen, key-getallen                       */
  --text-secondary: #9BA7B4;  /* labels, ondersteunende tekst               */
  --text-muted:     #5C6775;  /* as-tekst, captions, inactief               */

  /* ─────────────────────────────────────────────────────────────
     ACCENT  (oranje → rood)  — energie, spaarzaam inzetten
       WEL:  actieve ring-voortgang · primaire CTA · actieve tab/dot ·
             de niveau-grafieklijn · één key-getal-highlight per scherm.
       NIET: gewone tekst · borders · semantische status (zie hieronder) ·
             grote gevulde vlakken. Spaarzaam = krachtig.
     ───────────────────────────────────────────────────────────── */
  --accent:        #FF5A1F;                               /* primair accent          */
  --accent-strong: #FF3526;                               /* dieper rood (piek/eind) */
  --accent-soft:   rgba(255, 90, 31, 0.14);               /* tint-fill, hover         */
  --accent-grad:   linear-gradient(135deg, #FF7A2F 0%, #FF3526 100%);

  /* ─────────────────────────────────────────────────────────────
     SEMANTISCH  — status & vorm. Nooit verwarren met het accent.
       bad  = oververmoeid (rood)   ·  good = productief / opbouwend,
       de zone waar je wilt zitten (groen)   ·  warn = let op (amber)
       fresh = fris / getaperd, uitgerust (blauw)
     ───────────────────────────────────────────────────────────── */
  --good:      #34D17F;
  --warn:      #F5B83D;
  --bad:       #FF5267;
  --fresh:     #3DA5F0;
  --good-soft: rgba(52, 209, 127, 0.15);
  --warn-soft: rgba(245, 184, 61, 0.15);
  --bad-soft:  rgba(255, 82, 103, 0.15);
  --fresh-soft: rgba(61, 165, 240, 0.16);

  /* ─────────────────────────────────────────────────────────────
     GRAFIEK-PALET
     ───────────────────────────────────────────────────────────── */
  --chart-line:  var(--accent);
  --chart-fill:  rgba(255, 90, 31, 0.12);   /* area-gradient bovenkant */
  --chart-grid:  rgba(255, 255, 255, 0.05); /* gridlines               */
  --chart-axis:  #5C6775;                    /* as-tekst                */
  --chart-point: #FFFFFF;                    /* actieve datapunt-marker */

  /* ─────────────────────────────────────────────────────────────
     TRAININGSZONES (vermogen)  — rustig → fel, accent voor de hoogste.
     Gebruikt in de zone-balk van een workout. Z5/Z6 erven het accent,
     dus ze verschuiven mee als de accentkleur verandert.
     ───────────────────────────────────────────────────────────── */
  --zone-1: #5C84A6;              /* Herstel   (rustig, koel)        */
  --zone-2: #3E9BC9;              /* Duur      (blauw)               */
  --zone-3: #36B0A4;              /* Tempo     (teal)                */
  --zone-4: #E0A93C;             /* Drempel   (amber)               */
  --zone-5: var(--accent);        /* VO2max    (accent oranje)       */
  --zone-6: var(--accent-strong); /* Anaeroob  (fel rood)            */

  /* ─────────────────────────────────────────────────────────────
     TYPOGRAFIE
       sans → UI, labels, koppen      num → alle getallen (tabular, mono)
     ───────────────────────────────────────────────────────────── */
  --font-sans: 'IBM Plex Sans', system-ui, -apple-system, sans-serif;
  --font-num:  'IBM Plex Mono', ui-monospace, 'SF Mono', monospace;

  /* type-scale  (px / line-height / weight) */
  --fs-display:  56px;  --lh-display:  1.0;   --fw-display: 600;  /* hero-getal      */
  --fs-h1:       22px;  --lh-h1:       1.2;   --fw-h1:      600;  /* sectiekop       */
  --fs-h2:       16px;  --lh-h2:       1.3;   --fw-h2:      600;  /* kaartkop        */
  --fs-body:     15px;  --lh-body:     1.45;  --fw-body:    400;  /* lopende tekst   */
  --fs-caption:  11px;  --lh-caption:  1.3;   --fw-caption: 600;  /* label / overline*/

  /* getal-scale (mono, tabular) */
  --fs-num-lg:   44px;  --fw-num-lg:   600;  /* niveau, ring-waarde   */
  --fs-num-md:   26px;  --fw-num-md:   600;  /* metric-waarde         */
  --fs-num-sm:   17px;  --fw-num-sm:   500;  /* inline getal          */

  --tracking-overline: 0.14em;  /* letterspacing voor CAPS-overlines */

  /* ─────────────────────────────────────────────────────────────
     BORDER-RADIUS-SCHAAL
     ───────────────────────────────────────────────────────────── */
  --r-xs:   6px;
  --r-sm:   9px;
  --r-md:   12px;
  --r-lg:   16px;
  --r-xl:   20px;
  --r-pill: 999px;

  /* ─────────────────────────────────────────────────────────────
     SPACING-SCHAAL  (4-punts grid)
     ───────────────────────────────────────────────────────────── */
  --s-1:   4px;
  --s-2:   8px;
  --s-3:  12px;
  --s-4:  16px;
  --s-5:  20px;
  --s-6:  24px;
  --s-7:  32px;
  --s-8:  40px;

  /* schaduw — donker, subtiel */
  --shadow-card: 0 1px 0 rgba(255,255,255,0.02) inset, 0 2px 8px rgba(0,0,0,0.35);

  /* ─────────────────────────────────────────────────────────────
     FORM-COMPONENTEN  (instellingen / invoer)
     Consistente bouwstenen voor velden, toggles, keuzes en knoppen.
     ───────────────────────────────────────────────────────────── */

  /* tekst- / getalveld */
  --field-bg:            var(--bg-sunken);
  --field-bg-focus:      #0C1117;
  --field-border:        var(--border-strong);
  --field-border-focus:  var(--accent);
  --field-text:          var(--text-primary);
  --field-placeholder:   var(--text-muted);
  --field-height:        38px;
  --field-pad-x:         12px;
  --field-radius:        var(--r-sm);

  /* toggle / switch  (uit = neutraal, aan = accent) */
  --toggle-w:            44px;
  --toggle-h:            26px;
  --toggle-track-off:    #2A323D;
  --toggle-track-on:     var(--accent);
  --toggle-thumb:        #EDF1F5;
  --toggle-thumb-shadow: 0 1px 3px rgba(0,0,0,0.5);

  /* segmented control */
  --segment-track-bg:    var(--bg-sunken);
  --segment-text:        var(--text-muted);
  --segment-active-bg:   var(--bg-elevated);
  --segment-active-text: var(--text-primary);
  --segment-active-shadow: 0 1px 3px rgba(0,0,0,0.45);

  /* dropdown / select */
  --select-bg:           var(--bg-sunken);
  --select-border:       var(--border-strong);
  --select-text:         var(--text-primary);
  --select-menu-bg:      var(--bg-elevated);
  --select-menu-border:  var(--border-strong);
  --select-option-active: var(--accent-soft);

  /* datum-picker (erft veld-stijl) */
  --date-bg:             var(--field-bg);
  --date-border:         var(--field-border);
  --date-text:           var(--field-text);

  /* knop-varianten */
  --btn-primary-bg:      var(--accent-grad);
  --btn-primary-text:    #FFFFFF;
  --btn-secondary-bg:    var(--bg-elevated);
  --btn-secondary-border: var(--border-strong);
  --btn-secondary-text:  var(--text-primary);
  --btn-destructive-bg:  var(--bad-soft);
  --btn-destructive-text: var(--bad);
  --btn-height:          44px;
  --btn-radius:          var(--r-md);

  /* status-badge (bv. "Gekoppeld") */
  --badge-good-bg:       var(--good-soft);
  --badge-good-text:     var(--good);
}

```


////////////////////////////////////////////////////////////////
// FILE: chart.jsx
////////////////////////////////////////////////////////////////

```jsx
// chart.jsx — Data-viz primitives voor FTP Coach (Ring + Niveau-lijngrafiek)
// Exports to window: ProgressRing, NiveauChart
const { useState, useEffect, useRef, useMemo } = React;

// ─────────────────────────────────────────────────────────────
// ProgressRing — ronde voortgangs-/readiness-ring met centertekst
// ─────────────────────────────────────────────────────────────
function ProgressRing({
  value = 82, size = 124, stroke = 11,
  color = 'var(--good)', track = 'rgba(255,255,255,0.07)',
  children, delay = 250,
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const [offset, setOffset] = useState(circ);
  useEffect(() => {
    const t = setTimeout(() => setOffset(circ * (1 - Math.max(0, Math.min(100, value)) / 100)), delay);
    return () => clearTimeout(t);
  }, [value, circ, delay]);

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color}
          strokeWidth={stroke} strokeLinecap="round"
          style={{
            strokeDasharray: circ, strokeDashoffset: offset,
            transition: 'stroke-dashoffset 1.1s cubic-bezier(.22,.61,.36,1)',
          }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', textAlign: 'center',
      }}>{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// NiveauChart — maandelijkse niveau-lijn met area-fill + scrub-tooltip
// ─────────────────────────────────────────────────────────────
const MND = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

// 25 maandpunten jun '24 → jun '26 (niveau 0–50), oplopend met winterdip
const FULL_VALUES = [
  19.0, 19.8, 20.3, 21.0, 20.6, 21.4, 22.1, 21.5, 20.8, 21.9, 23.0, 23.6,
  24.1, 23.4, 24.5, 25.2, 26.0, 25.4, 26.3, 27.0, 26.6, 27.4, 27.9, 27.5, 28.0,
];
function buildSeries() {
  const out = [];
  let m = 5, y = 2024; // jun '24
  for (let i = 0; i < FULL_VALUES.length; i++) {
    out.push({ v: FULL_VALUES[i], label: `${MND[m]} '${String(y).slice(2)}` });
    m++; if (m > 11) { m = 0; y++; }
  }
  return out;
}
const SERIES = buildSeries();

function sliceNiveau(range) {
  if (range === '1m') return SERIES.slice(-2);
  if (range === '6m') return SERIES.slice(-7);
  if (range === '12m') return SERIES.slice(-13);
  return SERIES;
}

function NiveauChart({ range = 'all' }) {
  const wrapRef = useRef(null);
  const [w, setW] = useState(326);
  const [active, setActive] = useState(null); // index van gescrubd punt
  const H = 168;
  const padT = 16, padB = 24, padL = 4, padR = 6;

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((e) => setW(e[0].contentRect.width));
    ro.observe(wrapRef.current);
    setW(wrapRef.current.clientWidth);
    return () => ro.disconnect();
  }, []);

  const data = useMemo(() => sliceNiveau(range), [range]);

  const { pts, areaD, lineD, minV, maxV, plotW, plotH } = useMemo(() => {
    const vals = data.map(d => d.v);
    const lo = Math.floor(Math.min(...vals) - 1);
    const hi = Math.ceil(Math.max(...vals) + 1);
    const pw = w - padL - padR;
    const ph = H - padT - padB;
    const x = (i) => padL + (data.length === 1 ? pw / 2 : (i / (data.length - 1)) * pw);
    const y = (v) => padT + (1 - (v - lo) / (hi - lo)) * ph;
    const p = data.map((d, i) => ({ x: x(i), y: y(d.v), ...d }));
    const line = p.map((q, i) => `${i ? 'L' : 'M'}${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(' ');
    const area = `${line} L${p[p.length - 1].x.toFixed(1)} ${(padT + ph).toFixed(1)} L${p[0].x.toFixed(1)} ${(padT + ph).toFixed(1)} Z`;
    return { pts: p, areaD: area, lineD: line, minV: lo, maxV: hi, plotW: pw, plotH: ph };
  }, [data, w]);

  // gridlines op nette niveau-waarden
  const gridVals = useMemo(() => {
    const out = []; const step = (maxV - minV) <= 6 ? 2 : 5;
    for (let v = Math.ceil(minV / step) * step; v <= maxV; v += step) out.push(v);
    return out;
  }, [minV, maxV]);
  const yOf = (v) => padT + (1 - (v - minV) / (maxV - minV)) * plotH;

  const handleMove = (clientX) => {
    const rect = wrapRef.current.getBoundingClientRect();
    const rel = clientX - rect.left;
    let best = 0, bd = Infinity;
    pts.forEach((p, i) => { const d = Math.abs(p.x - rel); if (d < bd) { bd = d; best = i; } });
    setActive(best);
  };

  const ap = active != null ? pts[active] : null;
  // dun de labels uit tot ≤~4 en voorkom dat ze overlappen aan het einde
  const xLabels = useMemo(() => {
    const n = data.length;
    if (n <= 1) return [0];
    const step = Math.max(1, Math.ceil((n - 1) / 4));
    const idxs = [];
    for (let i = 0; i < n; i += step) idxs.push(i);
    const lastL = idxs[idxs.length - 1];
    if (lastL !== n - 1) {
      if ((n - 1) - lastL < step * 0.6) idxs.pop();
      idxs.push(n - 1);
    }
    return idxs;
  }, [data]);

  return (
    <div ref={wrapRef} style={{ width: '100%', position: 'relative', userSelect: 'none', touchAction: 'pan-y' }}>
      <svg
        width={w} height={H} style={{ display: 'block', overflow: 'visible' }}
        onMouseMove={(e) => handleMove(e.clientX)}
        onMouseLeave={() => setActive(null)}
        onTouchStart={(e) => handleMove(e.touches[0].clientX)}
        onTouchMove={(e) => handleMove(e.touches[0].clientX)}
        onTouchEnd={() => setActive(null)}
      >
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.26" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* gridlines + y-labels */}
        {gridVals.map((v) => (
          <g key={v}>
            <line x1={padL} x2={w - padR} y1={yOf(v)} y2={yOf(v)} stroke="var(--chart-grid)" strokeWidth="1" />
            <text x={padL + 2} y={yOf(v) - 4} fill="var(--chart-axis)"
              fontSize="10" fontFamily="var(--font-num)">{v}</text>
          </g>
        ))}

        {/* area + lijn */}
        <path d={areaD} fill="url(#areaFill)" />
        <path d={lineD} fill="none" stroke="var(--chart-line)" strokeWidth="2.5"
          strokeLinejoin="round" strokeLinecap="round" />

        {/* laatste punt = nu */}
        {!ap && pts.length > 0 && (
          <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="4"
            fill="var(--accent)" stroke="var(--bg-surface)" strokeWidth="2.5" />
        )}

        {/* scrubber */}
        {ap && (
          <g>
            <line x1={ap.x} x2={ap.x} y1={padT - 4} y2={padT + plotH} stroke="var(--border-strong)" strokeWidth="1" />
            <circle cx={ap.x} cy={ap.y} r="5" fill="var(--chart-point)" stroke="var(--accent)" strokeWidth="2.5" />
          </g>
        )}

        {/* x-labels */}
        {xLabels.map((i) => (
          <text key={i} x={Math.max(padL + 8, Math.min(w - padR - 8, pts[i].x))}
            y={H - 6} fill="var(--text-secondary)" fontSize="10.5" fontFamily="var(--font-num)"
            textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}>
            {data[i].label}
          </text>
        ))}
      </svg>

      {/* tooltip-bubble */}
      {ap && (
        <div style={{
          position: 'absolute', top: -2,
          left: Math.max(0, Math.min(w - 96, ap.x - 48)), width: 96,
          background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)',
          borderRadius: 'var(--r-sm)', padding: '5px 8px', pointerEvents: 'none',
          boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
        }}>
          <div style={{ fontFamily: 'var(--font-num)', fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1 }}>
            {ap.v.toFixed(1)}
          </div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
            niveau · {ap.label}
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { ProgressRing, NiveauChart, sliceNiveau });

```


////////////////////////////////////////////////////////////////
// FILE: workout.jsx
////////////////////////////////////////////////////////////////

```jsx
// workout.jsx — gedeelde workout-primitieven, varianten-engine, bibliotheek + picker
// Exports to window: ZNAME, FTP, watt, fmtDur, ZoneBar, ZoneLegend, MiniZoneBar,
//   BlockList, WorkoutDetail, CategoryCard, VariantRow, DurationSlider,
//   WORKOUT_CATS, buildWorkout, WorkoutPicker
(function () {
  const { useState } = React;

  /* ── basis ── */
  const ZNAME = { 1: 'Herstel', 2: 'Duur', 3: 'Tempo', 4: 'Drempel', 5: 'VO2max', 6: 'Anaeroob' };
  const FTP = 275; // referentie voor doel-vermogen (uit Instellingen)
  const watt = (pct) => Math.round((pct / 100) * FTP / 5) * 5;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const fmtDur = (m) => {
    m = Math.round(m);
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60), r = m % 60;
    return r ? `${h}u ${r}` : `${h}u`;
  };
  const fmtBlk = (m) => (m < 1 ? `${Math.round(m * 60)} s` : `${Math.round(m)} min`);

  const Num = ({ children, size = 22, weight = 600, color = 'var(--text-primary)', style }) => (
    <span style={{ fontFamily: 'var(--font-num)', fontVariantNumeric: 'tabular-nums', fontSize: size, fontWeight: weight, color, lineHeight: 1, letterSpacing: '-0.01em', ...style }}>{children}</span>
  );
  const Over = ({ children, color = 'var(--text-muted)', style }) => (
    <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color, ...style }}>{children}</div>
  );
  const Chevron = ({ dir = 'right', color = 'var(--text-muted)', size = 13 }) => {
    const d = { right: 'M5 2l5 5-5 5', left: 'M9 2L4 7l5 5', down: 'M3 5l4 4 4-4' }[dir];
    return <svg width={size} height={size} viewBox="0 0 14 14" fill="none"><path d={d} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  };

  /* ── structuur-helpers + expand ── */
  const warm = (m, lo = 55, hi = 65, z = 2) => ({ type: 'block', label: 'Warming-up', z, m, lo, hi });
  const cool = (m, lo = 50, hi = 50, z = 1) => ({ type: 'block', label: 'Cooling-down', z, m, lo, hi });
  const steady = (label, z, m, lo, hi) => ({ type: 'block', label, z, m, lo, hi });
  const setp = (label, reps, z, m, lo, hi, offM, tailOff = true) => ({ type: 'set', label, reps, z, m, lo, hi, offM, tailOff });

  function expand(structure) {
    const segs = [], blocks = [];
    for (const p of structure) {
      if (p.type === 'set') {
        const onP = (p.lo + p.hi) / 2;
        for (let i = 0; i < p.reps; i++) {
          segs.push({ z: p.z, m: p.m, p: onP });
          if (i < p.reps - 1 || p.tailOff) segs.push({ z: 1, m: p.offM, p: 50 });
        }
        const recCount = p.tailOff ? p.reps : p.reps - 1;
        blocks.push({ label: p.label, reps: p.reps, dur: p.m, z: p.z, lo: p.lo, hi: p.hi });
        if (recCount > 0) blocks.push({ label: 'Herstel', reps: recCount, dur: p.offM, z: 1, lo: 50, hi: 50 });
      } else {
        segs.push({ z: p.z, m: p.m, p: (p.lo + p.hi) / 2 });
        blocks.push({ label: p.label, dur: p.m, z: p.z, lo: p.lo, hi: p.hi });
      }
    }
    return { segs, blocks, min: segs.reduce((a, s) => a + s.m, 0) };
  }

  // IF ≈ NP/FTP; piek-intensiteit gecapt op 150% om 30s-smoothing van korte pieken na te bootsen
  function computeIF(segs) {
    let num = 0, tot = 0;
    for (const s of segs) { const p = Math.min(1.5, s.p / 100); num += s.m * Math.pow(p, 4); tot += s.m; }
    return tot ? Math.pow(num / tot, 0.25) : 0;
  }
  function phasesMin(phases) {
    let m = 0;
    for (const p of phases) m += (p.type === 'set') ? p.reps * p.m + (p.tailOff ? p.reps : p.reps - 1) * p.offM : p.m;
    return m;
  }
  const z2 = (m) => steady('Endurance', 2, m, 65, 75);

  /* ── varianten → schaalbare workout ── */
  // begrensde key-set (vaste dosis); de duur-slider voegt Z2 toe RONDOM de kern, niet meer harde reps
  function buildStructure(v, D) {
    if (v.kind === 'steady') {
      const wM = 12, cM = 12, accent = v.accent ? 12 : 0;
      const main = Math.max(20, D - wM - cM - accent);
      const st = [warm(wM, 50, 60, 1), steady(v.label || 'Duurblok', v.z, main, v.lo, v.hi)];
      if (v.accent) st.push(steady('Tempo-accent', 3, 12, 80, 85));
      st.push(cool(cM));
      return st;
    }
    const wM = 15, cM = 10;
    let key = [];
    if (v.kind === 'intervals') key = [setp('Interval', v.reps, v.z, v.len, v.lo, v.hi, v.off, true)];
    else if (v.kind === 'sprint') key = [setp('Sprint', v.reps, v.z, v.onSec / 60, v.lo, v.hi, v.recMin, true)];
    else if (v.kind === 'micro') {
      for (let s = 0; s < v.sets; s++) {
        key.push(setp(`${v.onSec}/${v.offSec}s`, v.perSet, v.z, v.onSec / 60, v.lo, v.hi, v.offSec / 60, true));
        if (s < v.sets - 1) key.push(steady('Setpauze', 1, v.between, 45, 50));
      }
    }
    const keyMin = phasesMin(key);
    const pad = Math.max(0, Math.round((D - wM - cM - keyMin) / 5) * 5);
    const padA = Math.round(pad / 2 / 5) * 5, padB = pad - padA;
    const st = [warm(wM)];
    if (padA > 0) st.push(z2(padA));
    st.push(...key);
    if (padB > 0) st.push(z2(padB));
    st.push(cool(cM));
    return st;
  }
  function buildWorkout(v, D) {
    const { segs, blocks, min } = expand(buildStructure(v, D));
    const iffNum = computeIF(segs);
    const iff = iffNum.toFixed(2).replace('.', ',');
    const tss = Math.round(iffNum * iffNum * (min / 60) * 100);
    let naam;
    if (v.kind === 'steady') naam = v.label;
    else if (v.kind === 'micro') naam = `${v.sets}×${v.perSet} ${v.onSec}/${v.offSec}s`;
    else if (v.kind === 'sprint') naam = `${v.reps}× ${v.onSec}s sprint`;
    else naam = `${v.reps}×${v.len}min @${v.pct}%`;
    return { id: v.id, naam, zone: v.z, catZone: v.z, iff, tss, segs, blocks, min, inPlan: v.inPlan, micro: v.kind === 'micro' };
  }

  /* ── bibliotheek: categorieën met varianten ── */
  const WORKOUT_CATS = [
    { key: 'herstel', naam: 'Herstel', zone: 1, desc: 'Actief herstel, heel rustig', def: 60, variants: [
      { id: 'h-rust', kind: 'steady', z: 1, lo: 50, hi: 60, inPlan: true, label: 'Hersteltrit' },
      { id: 'h-koffie', kind: 'steady', z: 1, lo: 52, hi: 62, inPlan: false, label: 'Koffierit' },
    ] },
    { key: 'duur', naam: 'Duurvermogen', zone: 2, desc: 'Aerobe basis · lange rustige ritten', def: 120, variants: [
      { id: 'd-vlak', kind: 'steady', z: 2, lo: 65, hi: 75, inPlan: true, label: 'Z2 duurrit' },
      { id: 'd-tempo', kind: 'steady', accent: true, z: 2, lo: 65, hi: 75, inPlan: true, label: 'Z2 + tempo-finale' },
      { id: 'd-rit', kind: 'steady', z: 2, lo: 68, hi: 76, inPlan: false, label: 'Vaste-ritme rit' },
    ] },
    { key: 'tempo', naam: 'Tempo', zone: 3, desc: 'Stevig aeroob · comfortabel-hard', def: 90, variants: [
      { id: 't-20', kind: 'intervals', reps: 2, len: 20, pct: 83, lo: 80, hi: 85, off: 5, z: 3, inPlan: true },
      { id: 't-15', kind: 'intervals', reps: 3, len: 15, pct: 84, lo: 81, hi: 86, off: 4, z: 3, inPlan: false },
    ] },
    { key: 'sweetspot', naam: 'Sweet Spot', zone: 4, desc: 'Veel prikkel · beheersbare vermoeidheid', def: 90, variants: [
      { id: 's-15', kind: 'intervals', reps: 3, len: 15, pct: 90, lo: 88, hi: 93, off: 5, z: 4, inPlan: true },
      { id: 's-12', kind: 'intervals', reps: 4, len: 12, pct: 91, lo: 88, hi: 94, off: 4, z: 4, inPlan: true },
    ] },
    { key: 'drempel', naam: 'FTP / Drempel', zone: 4, desc: 'Rond je 1-uurs vermogen', def: 80, variants: [
      { id: 'f-20', kind: 'intervals', reps: 2, len: 20, pct: 98, lo: 95, hi: 100, off: 6, z: 4, inPlan: true },
      { id: 'f-12', kind: 'intervals', reps: 3, len: 12, pct: 100, lo: 98, hi: 103, off: 5, z: 4, inPlan: true },
    ] },
    { key: 'vo2', naam: 'VO2max', zone: 5, desc: 'Korte, felle intervallen', def: 75, variants: [
      { id: 'v-54', kind: 'intervals', reps: 5, len: 4, pct: 110, lo: 108, hi: 112, off: 4, z: 5, inPlan: true },
      { id: 'v-45', kind: 'intervals', reps: 4, len: 5, pct: 108, lo: 106, hi: 110, off: 5, z: 5, inPlan: true },
      { id: 'v-63', kind: 'intervals', reps: 6, len: 3, pct: 112, lo: 110, hi: 115, off: 3, z: 5, inPlan: true },
      { id: 'v-3030', kind: 'micro', sets: 3, perSet: 10, onSec: 30, offSec: 30, lo: 115, hi: 122, between: 5, z: 6, inPlan: false },
      { id: 'v-4020', kind: 'micro', sets: 3, perSet: 10, onSec: 40, offSec: 20, lo: 118, hi: 125, between: 5, z: 6, inPlan: false },
      { id: 'v-spr', kind: 'sprint', reps: 8, onSec: 12, recMin: 2.5, lo: 175, hi: 205, z: 6, inPlan: false },
    ] },
  ];

  /* ── zone-balk + legenda ── */
  function ZoneBar({ segments, height = 124 }) {
    const base = 10;
    const lvl = (z) => base + (z / 6) * (height - base);
    return (
      <div style={{ position: 'relative', height, marginTop: 8 }}>
        {[1, 2, 3, 4, 5, 6].map((z) => (
          <div key={z} style={{ position: 'absolute', left: 0, right: 0, bottom: lvl(z), height: 1, background: 'var(--chart-grid)' }} />
        ))}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', gap: 1.5 }}>
          {segments.map((s, i) => (
            <div key={i} title={`Z${s.z} ${ZNAME[s.z]} · ${fmtBlk(s.m)}`} style={{ flex: s.m, height: lvl(s.z), minWidth: 1.5, background: `var(--zone-${s.z})`, borderRadius: '2px 2px 0 0' }} />
          ))}
        </div>
      </div>
    );
  }
  function MiniZoneBar({ segments, height = 30 }) {
    const base = 5;
    const lvl = (z) => base + (z / 6) * (height - base);
    return (
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height, marginTop: 8 }}>
        {segments.map((s, i) => (
          <div key={i} style={{ flex: s.m, height: lvl(s.z), minWidth: 1, background: `var(--zone-${s.z})`, borderRadius: '1.5px 1.5px 0 0' }} />
        ))}
      </div>
    );
  }
  function ZoneLegend({ segments }) {
    const zones = [...new Set(segments.map((s) => s.z))].sort();
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
        {zones.map((z) => (
          <div key={z} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: `var(--zone-${z})` }} />
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11.5, color: 'var(--text-secondary)' }}>{ZNAME[z]}</span>
          </div>
        ))}
      </div>
    );
  }

  /* ── blok-voor-blok lijst ── */
  function BlockList({ blocks }) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {blocks.map((b, i) => {
          const single = b.lo === b.hi;
          const pct = single ? `${b.lo}% FTP` : `${b.lo}–${b.hi}% FTP`;
          const watts = single ? `≈${watt(b.lo)} W` : `≈${watt(b.lo)}–${watt(b.hi)} W`;
          return (
            <div key={i} style={{ display: 'flex', gap: 11, background: 'var(--bg-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-md)', padding: '10px 12px' }}>
              <span style={{ width: 4, borderRadius: 2, background: `var(--zone-${b.z})`, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{b.reps ? `${b.reps}× ` : ''}{b.label}</span>
                  <Num size={12.5} color="var(--text-secondary)">{fmtBlk(b.dur)}</Num>
                </div>
                <div style={{ marginTop: 3, fontFamily: 'var(--font-sans)', fontSize: 11.5, color: 'var(--text-muted)' }}>
                  <span style={{ color: `var(--zone-${b.z})`, fontWeight: 600 }}>{ZNAME[b.z]}</span> · {pct} · <span style={{ fontFamily: 'var(--font-num)' }}>{watts}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const PlanBadge = ({ inPlan }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: 999, padding: '2px 8px', fontFamily: 'var(--font-sans)', fontSize: 10.5, fontWeight: 600,
      background: inPlan ? 'var(--accent-soft)' : 'var(--bg-elevated)',
      color: inPlan ? 'var(--accent)' : 'var(--text-muted)',
      border: `1px solid ${inPlan ? 'color-mix(in srgb, var(--accent) 40%, transparent)' : 'var(--border-strong)'}` }}>
      {inPlan ? 'In je blok' : 'Buiten plan'}
    </span>
  );
  const ZoneBadge = ({ z }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 999, padding: '3px 9px', fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600,
      background: `color-mix(in srgb, var(--zone-${z}) 16%, transparent)`, color: `var(--zone-${z})`, border: `1px solid color-mix(in srgb, var(--zone-${z}) 45%, transparent)` }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: `var(--zone-${z})` }} />{ZNAME[z]}
    </span>
  );

  /* ── kaarten / rijen ── */
  function CategoryCard({ cat, onClick }) {
    const c = `var(--zone-${cat.zone})`;
    return (
      <button onClick={onClick} style={{ width: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 14px', borderRadius: 'var(--r-lg)',
        background: `color-mix(in srgb, ${c} 11%, var(--bg-surface))`, border: `1px solid color-mix(in srgb, ${c} 32%, var(--border-subtle))` }}>
        <span style={{ width: 11, height: 11, borderRadius: 3, background: c, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 15.5, fontWeight: 600, color: c }}>{cat.naam}</div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{cat.desc}</div>
        </div>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', fontSize: 11.5, flexShrink: 0 }}>
          {cat.variants.length}<Chevron />
        </span>
      </button>
    );
  }
  function VariantRow({ wo, onClick }) {
    return (
      <button onClick={onClick} style={{ width: '100%', textAlign: 'left', cursor: 'pointer', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-lg)', padding: '13px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{wo.naam}</span>
          <PlanBadge inPlan={wo.inPlan} />
        </div>
        <MiniZoneBar segments={wo.segs} />
        <div style={{ marginTop: 9, fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-secondary)' }}>
          <Num size={12.5} weight={600}>{fmtDur(wo.min)}</Num><span style={{ color: 'var(--text-muted)', margin: '0 6px' }}>·</span><span style={{ color: 'var(--text-muted)' }}>IF</span> <Num size={12.5} weight={600}>{wo.iff}</Num><span style={{ color: 'var(--text-muted)', margin: '0 6px' }}>·</span><span style={{ color: 'var(--text-muted)' }}>TSS</span> <Num size={12.5} weight={600}>{wo.tss}</Num>
        </div>
      </button>
    );
  }

  function DurationSlider({ value, onChange, min = 45, max = 240 }) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Over>Duur-budget · vult aan met Z2, niet meer reps</Over>
          <Num size={14} weight={600} color="var(--accent)">{fmtDur(value)}</Num>
        </div>
        <input type="range" min={min} max={max} step={15} value={value} onChange={(e) => onChange(Number(e.target.value))}
          style={{ width: '100%', marginTop: 8, accentColor: 'var(--accent)', cursor: 'pointer' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-num)', fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
          <span>45 min</span><span>4 u</span>
        </div>
      </div>
    );
  }

  function WorkoutDetail({ wo, overline, onAction, actionLabel = 'Inplannen', onRevert }) {
    const [done, setDone] = useState(false);
    return (
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-lg)', padding: 16, boxShadow: 'var(--shadow-card)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          {typeof overline === 'string' ? <Over>{overline}</Over> : overline}
          <ZoneBadge z={wo.catZone} />
        </div>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 23, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', marginTop: 8 }}>{wo.naam}</div>
        <div style={{ marginTop: 8, fontFamily: 'var(--font-sans)', fontSize: 13.5, color: 'var(--text-secondary)' }}>
          <Num size={14} weight={600}>{fmtDur(wo.min)}</Num><span style={{ color: 'var(--text-muted)', margin: '0 7px' }}>·</span><span style={{ color: 'var(--text-muted)' }}>IF</span> <Num size={14} weight={600}>{wo.iff}</Num><span style={{ color: 'var(--text-muted)', margin: '0 7px' }}>·</span><span style={{ color: 'var(--text-muted)' }}>TSS</span> <Num size={14} weight={600}>{wo.tss}</Num>
        </div>
        <ZoneBar segments={wo.segs} />
        <ZoneLegend segments={wo.segs} />
        <div style={{ marginTop: 14 }}><BlockList blocks={wo.blocks} /></div>
        {onAction && (
          <button onClick={() => { setDone(true); onAction(wo); }} disabled={done} style={{ marginTop: 16, width: '100%', height: 'var(--btn-height)', borderRadius: 'var(--btn-radius)', border: 'none', cursor: done ? 'default' : 'pointer',
            background: done ? 'var(--good-soft)' : 'var(--accent-grad)', color: done ? 'var(--good)' : '#fff', fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600 }}>
            {done ? '✓ Ingepland' : actionLabel}
          </button>
        )}
        {onRevert && (
          <button onClick={onRevert} style={{ marginTop: 10, width: '100%', height: 38, borderRadius: 'var(--r-md)', border: '1px solid var(--border-strong)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600 }}>
            Terug naar voorstel
          </button>
        )}
      </div>
    );
  }

  /* ── picker (voor "Doe iets anders") ── */
  function WorkoutPicker({ onPick, onClose }) {
    const [route, setRoute] = useState('home');
    const [cat, setCat] = useState(null);
    const [target, setTarget] = useState(75);
    const [freeKind, setFreeKind] = useState('vrij');
    const [freeMin, setFreeMin] = useState(90);
    const [freeInt, setFreeInt] = useState('tempo');
    const back = () => { if (route === 'vars') setRoute('cats'); else if (route === 'cats' || route === 'free') setRoute('home'); else onClose(); };
    const Seg = ({ value, options, onChange }) => (
      <div style={{ display: 'flex', gap: 4, background: 'var(--bg-sunken)', borderRadius: 'var(--r-pill)', padding: 3 }}>
        {options.map(([k, l]) => (
          <button key={k} onClick={() => onChange(k)} style={{ flex: 1, border: 'none', cursor: 'pointer', borderRadius: 'var(--r-pill)', padding: '7px 0', fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 600,
            background: value === k ? 'var(--bg-elevated)' : 'transparent', color: value === k ? 'var(--text-primary)' : 'var(--text-muted)', boxShadow: value === k ? '0 1px 3px rgba(0,0,0,0.4)' : 'none' }}>{l}</button>
        ))}
      </div>
    );
    return (
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-lg)', padding: 16, boxShadow: 'var(--shadow-card)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <button onClick={back} aria-label="Terug" style={{ width: 30, height: 30, borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Chevron dir="left" color="var(--text-secondary)" /></button>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            {route === 'home' ? 'Kies iets anders' : route === 'free' ? 'Vrije / groepsrit' : cat ? cat.naam : 'Uit bibliotheek'}
          </div>
        </div>

        {route === 'home' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[['cats', 'Uit bibliotheek', 'Kies een categorie en variant'], ['free', 'Vrije / groepsrit', 'Alleen duur + intensiteit, geen structuur']].map(([r, t, s]) => (
              <button key={r} onClick={() => setRoute(r)} style={{ textAlign: 'left', cursor: 'pointer', background: 'var(--bg-sunken)', border: '1px solid var(--border-strong)', borderRadius: 'var(--r-md)', padding: '14px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div><div style={{ fontFamily: 'var(--font-sans)', fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary)' }}>{t}</div><div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{s}</div></div>
                <Chevron />
              </button>
            ))}
          </div>
        )}
        {route === 'cats' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {WORKOUT_CATS.map((c) => <CategoryCard key={c.key} cat={c} onClick={() => { setCat(c); setTarget(c.def); setRoute('vars'); }} />)}
          </div>
        )}
        {route === 'vars' && cat && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <DurationSlider value={target} onChange={setTarget} />
            {cat.variants.map((v) => { const w = buildWorkout(v, target); return <VariantRow key={v.id} wo={w} onClick={() => onPick({ type: 'library', wo: w })} />; })}
          </div>
        )}
        {route === 'free' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Seg value={freeKind} options={[['vrij', 'Vrije rit'], ['groep', 'Groepsrit']]} onChange={setFreeKind} />
            <DurationSlider value={freeMin} onChange={setFreeMin} />
            <div><Over style={{ marginBottom: 8 }}>Globale intensiteit</Over><Seg value={freeInt} options={[['rustig', 'Rustig'], ['tempo', 'Tempo'], ['stevig', 'Stevig']]} onChange={setFreeInt} /></div>
            <button onClick={() => onPick({ type: 'free', kind: freeKind, min: freeMin, intensity: freeInt })} style={{ width: '100%', height: 'var(--btn-height)', borderRadius: 'var(--btn-radius)', border: 'none', cursor: 'pointer', background: 'var(--accent-grad)', color: '#fff', fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600 }}>Kies deze rit</button>
          </div>
        )}
      </div>
    );
  }

  /* ── rand- / lege staten ── */
  function ConnectState({ onConnect }) {
    return (
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-lg)', padding: '28px 20px', textAlign: 'center' }}>
        <div style={{ width: 46, height: 46, borderRadius: 999, background: 'var(--bg-sunken)', border: '1px solid var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M9.5 14.5l5-5" stroke="var(--text-secondary)" strokeWidth="1.6" strokeLinecap="round" /><path d="M8 11l-1.8 1.8a2.8 2.8 0 004 4L12 15" stroke="var(--text-secondary)" strokeWidth="1.6" strokeLinecap="round" /><path d="M16 13l1.8-1.8a2.8 2.8 0 00-4-4L12 9" stroke="var(--text-secondary)" strokeWidth="1.6" strokeLinecap="round" /><path d="M4 4l16 16" stroke="var(--bad)" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </div>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginTop: 14 }}>Verbind intervals.icu</div>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary)', marginTop: 6, maxWidth: 260, marginLeft: 'auto', marginRight: 'auto' }}>Vorm en schema gebruiken je trainingsdata. Koppel je account om te beginnen.</div>
        <button onClick={onConnect} style={{ marginTop: 18, height: 'var(--btn-height)', padding: '0 20px', borderRadius: 'var(--btn-radius)', border: 'none', background: 'var(--accent-grad)', color: '#fff', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600 }}>Verbinden in Instellingen</button>
      </div>
    );
  }
  function SyncBanner({ onRetry }) {
    const [busy, setBusy] = useState(false);
    const go = () => { setBusy(true); setTimeout(() => { setBusy(false); onRetry && onRetry(); }, 1200); };
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bad-soft)', border: '1px solid color-mix(in srgb, var(--bad) 40%, transparent)', borderRadius: 'var(--r-md)', padding: '10px 12px' }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><circle cx="8" cy="8" r="6.3" stroke="var(--bad)" strokeWidth="1.4" /><path d="M8 4.6v4M8 10.8v.05" stroke="var(--bad)" strokeWidth="1.5" strokeLinecap="round" /></svg>
        <span style={{ flex: 1, fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--bad)' }}>Synchroniseren met intervals.icu mislukt</span>
        <button onClick={go} disabled={busy} style={{ flexShrink: 0, height: 30, padding: '0 12px', borderRadius: 'var(--r-pill)', border: '1px solid color-mix(in srgb, var(--bad) 45%, transparent)', background: 'transparent', cursor: busy ? 'default' : 'pointer', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, color: 'var(--bad)', display: 'flex', alignItems: 'center', gap: 6 }}>{busy && <span className="gm-spin" style={{ borderColor: 'var(--bad)', borderTopColor: 'transparent' }} />}{busy ? 'Bezig…' : 'Opnieuw proberen'}</button>
      </div>
    );
  }
  function EmptyState({ title, text, actionLabel, onAction }) {
    return (
      <div style={{ background: 'var(--bg-surface)', border: '1px dashed var(--border-strong)', borderRadius: 'var(--r-lg)', padding: '26px 20px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</div>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary)', marginTop: 6, maxWidth: 260, marginLeft: 'auto', marginRight: 'auto' }}>{text}</div>
        {actionLabel && <button onClick={onAction} style={{ marginTop: 16, height: 40, padding: '0 18px', borderRadius: 'var(--r-md)', border: '1px solid var(--border-strong)', background: 'var(--bg-elevated)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{actionLabel}</button>}
      </div>
    );
  }
  function EmptyChart() {
    return (
      <div style={{ position: 'relative', height: 150, borderRadius: 'var(--r-md)', background: 'var(--bg-sunken)', border: '1px dashed var(--border-strong)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <svg width="120" height="40" viewBox="0 0 120 40" fill="none"><path d="M2 30 Q30 28 60 22 T118 12" stroke="var(--border-strong)" strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" /></svg>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-muted)' }}>Nog geen data — verschijnt na je eerste ritten</span>
      </div>
    );
  }

  Object.assign(window, { ZNAME, FTP, watt, fmtDur, fmtBlk, ZoneBar, MiniZoneBar, ZoneLegend, BlockList, WorkoutDetail, CategoryCard, VariantRow, DurationSlider, WORKOUT_CATS, buildWorkout, WorkoutPicker, ZoneBadge, PlanBadge, ConnectState, SyncBanner, EmptyState, EmptyChart });
})();

```


////////////////////////////////////////////////////////////////
// FILE: conditie.jsx
////////////////////////////////////////////////////////////////

```jsx
// conditie.jsx — drie visualisaties van de conditie-balans (CTL · ATL · TSB)
// Exports to window: ConditieDriehoek, ConditieBalans, ConditiePMC
(function () {
  const { useState, useEffect, useRef, useMemo } = React;

  /* lokale helpers (eigen scope) */
  function useWidth() {
    const ref = useRef(null);
    const [w, setW] = useState(326);
    useEffect(() => {
      if (!ref.current) return;
      const ro = new ResizeObserver((e) => setW(e[0].contentRect.width));
      ro.observe(ref.current); setW(ref.current.clientWidth);
      return () => ro.disconnect();
    }, []);
    return [ref, w];
  }
  const Over = ({ children, color = 'var(--text-muted)', style }) => (
    <div style={{ fontFamily: 'var(--font-sans)', fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color, ...style }}>{children}</div>
  );
  const N = ({ children, size = 24, weight = 600, color = 'var(--text-primary)', style }) => (
    <span style={{ fontFamily: 'var(--font-num)', fontVariantNumeric: 'tabular-nums', fontSize: size, fontWeight: weight, color, lineHeight: 1, letterSpacing: '-0.01em', ...style }}>{children}</span>
  );

  /* ───────── A · DRIEHOEK ───────── */
  function ConditieDriehoek() {
    const [ref, w] = useWidth();
    const H = 172;
    const top = { x: w / 2, y: 38 }, bl = { x: 58, y: 140 }, br = { x: w - 58, y: 140 };
    const Node = ({ x, y, value, vColor, label, sub, subColor, hi }) => (
      <div style={{
        position: 'absolute', left: x, top: y, transform: 'translate(-50%,-50%)',
        width: 104, textAlign: 'center',
        background: hi ? 'var(--fresh-soft)' : 'var(--bg-elevated)',
        border: `1px solid ${hi ? 'rgba(61,165,240,0.45)' : 'var(--border-strong)'}`,
        borderRadius: 'var(--r-md)', padding: '9px 6px',
      }}>
        <N size={24} color={vColor}>{value}</N>
        <Over style={{ marginTop: 5 }}>{label}</Over>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10.5, fontWeight: 600, color: subColor, marginTop: 3 }}>{sub}</div>
      </div>
    );
    return (
      <div ref={ref} style={{ position: 'relative', width: '100%', height: H, marginTop: 4 }}>
        <svg width={w} height={H} style={{ position: 'absolute', inset: 0 }}>
          <path d={`M${top.x} ${top.y} L${bl.x} ${bl.y} L${br.x} ${br.y} Z`} fill="none" stroke="var(--border-subtle)" strokeWidth="1.5" strokeDasharray="3 4" />
        </svg>
        <Node {...top} value="+7" vColor="var(--fresh)" label="Vorm · TSB" sub="Fris" subColor="var(--fresh)" hi />
        <Node {...bl} value="65" vColor="var(--text-primary)" label="Fitheid · CTL" sub="opbouwend" subColor="var(--text-muted)" />
        <Node {...br} value="58" vColor="var(--text-primary)" label="Vermoeidheid · ATL" sub="beheersbaar" subColor="var(--text-muted)" />
      </div>
    );
  }

  /* ───────── B · BALANS-METER ───────── */
  function ConditieBalans() {
    const min = -30, max = 25, tsb = 7;
    const pct = (v) => ((v - min) / (max - min)) * 100;
    const redW = pct(-10) - pct(min), amberW = pct(5) - pct(-10), greenW = pct(max) - pct(5);
    const mark = pct(tsb), zero = pct(0);

    const Bar = ({ label, value, max: mx, fill }) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 96, flexShrink: 0 }}>
          <Over>{label.o}</Over>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{label.s}</div>
        </div>
        <div style={{ flex: 1, height: 8, borderRadius: 999, background: 'var(--bg-sunken)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(value / mx) * 100}%`, borderRadius: 999, background: fill }} />
        </div>
        <N size={16} weight={600} style={{ width: 26, textAlign: 'right' }}>{value}</N>
      </div>
    );

    return (
      <div style={{ marginTop: 12 }}>
        {/* headline */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
          <N size={30} color="var(--fresh)">+7</N>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--fresh-soft)', color: 'var(--fresh)', border: '1px solid rgba(61,165,240,0.45)', borderRadius: 999, padding: '3px 9px', fontFamily: 'var(--font-sans)', fontSize: 11.5, fontWeight: 600 }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--fresh)' }} />Fris
          </span>
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--text-muted)' }}>TSB · vorm-saldo</span>
        </div>

        {/* gauge */}
        <div style={{ position: 'relative', marginTop: 20, marginBottom: 6 }}>
          <div style={{ display: 'flex', height: 10, borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${redW}%`, background: 'var(--bad-soft)' }} />
            <div style={{ width: `${amberW}%`, background: 'var(--good-soft)' }} />
            <div style={{ width: `${greenW}%`, background: 'var(--fresh-soft)' }} />
          </div>
          {/* nul-tick */}
          <div style={{ position: 'absolute', top: -3, left: `${zero}%`, width: 1, height: 16, background: 'var(--border-strong)' }} />
          {/* marker */}
          <div style={{ position: 'absolute', top: -7, left: `${mark}%`, transform: 'translateX(-50%)' }}>
            <div style={{ width: 14, height: 14, borderRadius: 999, background: 'var(--fresh)', border: '3px solid var(--bg-surface)', boxShadow: '0 0 0 1px var(--fresh)' }} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--text-muted)' }}>
          <span>oververmoeid</span><span>productief</span><span>fris</span>
        </div>

        {/* bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 18 }}>
          <Bar label={{ o: 'Fitheid', s: 'CTL' }} value={65} max={80} fill="var(--text-secondary)" />
          <Bar label={{ o: 'Vermoeidheid', s: 'ATL' }} value={58} max={80} fill="var(--warn)" />
        </div>
      </div>
    );
  }

  /* ───────── C · PMC-MINI ───────── */
  const CTL = [56, 57, 58, 59, 60, 61, 62, 63, 63, 64, 65, 65];
  const ATL = [60, 52, 64, 58, 70, 55, 66, 52, 63, 57, 64, 58];
  function ConditiePMC() {
    const [ref, w] = useWidth();
    const H = 150, padT = 14, padB = 22, padL = 4, padR = 40;
    const all = CTL.concat(ATL);
    const lo = Math.min(...all) - 3, hi = Math.max(...all) + 3;
    const pw = w - padL - padR, ph = H - padT - padB;
    const x = (i) => padL + (i / (CTL.length - 1)) * pw;
    const y = (v) => padT + (1 - (v - lo) / (hi - lo)) * ph;
    const path = (arr) => arr.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
    const eC = { x: x(CTL.length - 1), y: y(CTL[CTL.length - 1]) };
    const eA = { x: x(ATL.length - 1), y: y(ATL[ATL.length - 1]) };

    const Leg = ({ c, o, s, v }) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 9, height: 3, borderRadius: 2, background: c }} />
        <Over color="var(--text-muted)">{o}</Over>
        <N size={13} weight={600} color={s}>{v}</N>
      </div>
    );

    return (
      <div ref={ref} style={{ width: '100%', marginTop: 8 }}>
        <svg width={w} height={H} style={{ display: 'block', overflow: 'visible' }}>
          {[lo + (hi - lo) * 0.5].map((v, i) => (
            <line key={i} x1={padL} x2={w - padR} y1={y(v)} y2={y(v)} stroke="var(--chart-grid)" strokeWidth="1" />
          ))}
          {/* vorm-kloof aan het einde */}
          <line x1={eC.x} x2={eC.x} y1={eC.y} y2={eA.y} stroke="var(--fresh)" strokeWidth="2" />
          <path d={path(ATL)} fill="none" stroke="var(--warn)" strokeWidth="2" strokeLinejoin="round" strokeDasharray="4 3" opacity="0.85" />
          <path d={path(CTL)} fill="none" stroke="var(--text-secondary)" strokeWidth="2.5" strokeLinejoin="round" />
          <circle cx={eA.x} cy={eA.y} r="3.5" fill="var(--warn)" />
          <circle cx={eC.x} cy={eC.y} r="3.5" fill="var(--text-primary)" />
          {/* vorm-badge */}
          <g transform={`translate(${eC.x + 8}, ${(eC.y + eA.y) / 2})`}>
            <rect x="0" y="-10" width="34" height="20" rx="5" fill="var(--fresh-soft)" stroke="rgba(61,165,240,0.5)" />
            <text x="17" y="4" textAnchor="middle" fontFamily="var(--font-num)" fontSize="12" fontWeight="600" fill="var(--fresh)">+7</text>
          </g>
          <text x={padL} y={H - 6} fill="var(--chart-axis)" fontSize="10" fontFamily="var(--font-num)">12 wk</text>
          <text x={w - padR} y={H - 6} textAnchor="end" fill="var(--chart-axis)" fontSize="10" fontFamily="var(--font-num)">nu</text>
        </svg>
        <div style={{ display: 'flex', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
          <Leg c="var(--text-secondary)" o="Fitheid" s="var(--text-primary)" v="65" />
          <Leg c="var(--warn)" o="Vermoeidheid" s="var(--text-primary)" v="58" />
          <Leg c="var(--fresh)" o="Vorm" s="var(--fresh)" v="+7" />
        </div>
      </div>
    );
  }

  Object.assign(window, { ConditieDriehoek, ConditieBalans, ConditiePMC });
})();

```


////////////////////////////////////////////////////////////////
// FILE: schema.jsx
////////////////////////////////////////////////////////////////

```jsx
// schema.jsx — Schema-tab: dag-strip + dag-detail (voorstel / voltooid / rustdag)
// Export to window: SchemaTab
(function () {
  const { useState, useRef, useEffect, useMemo } = React;
  const { ZNAME, ZoneBar, ZoneLegend, BlockList, WorkoutDetail, WorkoutPicker, ZoneBadge, MiniZoneBar, fmtDur, ConnectState, SyncBanner, EmptyState } = window;

  /* ── helpers ── */
  const Over = ({ children, color = 'var(--text-muted)', style }) => (
    <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color, ...style }}>{children}</div>
  );
  const Num = ({ children, size = 22, weight = 600, color = 'var(--text-primary)', style }) => (
    <span style={{ fontFamily: 'var(--font-num)', fontVariantNumeric: 'tabular-nums', fontSize: size, fontWeight: weight, color, lineHeight: 1, letterSpacing: '-0.01em', ...style }}>{children}</span>
  );
  const WD = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
  const MND = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

  /* ── segment-sets (zone, minuten) ── */
  const rep = (n, arr) => Array.from({ length: n }, () => arr).flat();
  const SEG_VO2 = [
    { z: 1, m: 8 }, { z: 2, m: 12 },
    { z: 5, m: 4 }, { z: 1, m: 5 }, { z: 5, m: 4 }, { z: 1, m: 5 }, { z: 5, m: 4 }, { z: 1, m: 5 }, { z: 5, m: 4 }, { z: 1, m: 5 }, { z: 5, m: 4 },
    { z: 2, m: 8 }, { z: 1, m: 7 },
  ];
  const SEG_THRESH = [{ z: 1, m: 8 }, { z: 2, m: 10 }, { z: 4, m: 20 }, { z: 1, m: 6 }, { z: 4, m: 20 }, { z: 2, m: 8 }, { z: 1, m: 8 }];
  const SEG_ENDUR = [{ z: 1, m: 12 }, { z: 2, m: 110 }, { z: 3, m: 12 }, { z: 2, m: 34 }, { z: 1, m: 12 }];
  const SEG_SS = [{ z: 1, m: 8 }, { z: 2, m: 9 }, { z: 4, m: 15 }, { z: 1, m: 5 }, { z: 4, m: 15 }, { z: 1, m: 5 }, { z: 4, m: 15 }, { z: 2, m: 7 }, { z: 1, m: 11 }];
  const SEG_VO2B = [{ z: 1, m: 6 }, { z: 2, m: 12 }, ...rep(7, [{ z: 5, m: 2 }, { z: 1, m: 2 }]), { z: 5, m: 2 }, { z: 2, m: 6 }, { z: 1, m: 6 }];

  /* ── blok-structuur (label, reps, duur, zone, %FTP-bereik) ── */
  const BLK_VO2 = [
    { label: 'Warming-up', dur: 15, z: 2, lo: 55, hi: 65 },
    { label: 'Interval', reps: 5, dur: 4, z: 5, lo: 110, hi: 115 },
    { label: 'Herstel', reps: 5, dur: 4, z: 1, lo: 50, hi: 50 },
    { label: 'Cooling-down', dur: 10, z: 1, lo: 50, hi: 50 },
  ];
  const BLK_THRESH = [
    { label: 'Warming-up', dur: 18, z: 2, lo: 55, hi: 65 },
    { label: 'Interval', reps: 2, dur: 20, z: 4, lo: 95, hi: 100 },
    { label: 'Herstel', reps: 1, dur: 6, z: 1, lo: 50, hi: 50 },
    { label: 'Cooling-down', dur: 8, z: 1, lo: 50, hi: 50 },
  ];
  const BLK_ENDUR = [
    { label: 'Warming-up', dur: 12, z: 1, lo: 50, hi: 55 },
    { label: 'Duurblok', dur: 144, z: 2, lo: 65, hi: 75 },
    { label: 'Tempo-accent', dur: 12, z: 3, lo: 80, hi: 85 },
    { label: 'Uitrijden', dur: 12, z: 1, lo: 50, hi: 50 },
  ];
  const BLK_SS = [
    { label: 'Warming-up', dur: 17, z: 2, lo: 55, hi: 65 },
    { label: 'Sweet Spot', reps: 3, dur: 15, z: 4, lo: 88, hi: 93 },
    { label: 'Herstel', reps: 2, dur: 5, z: 1, lo: 50, hi: 50 },
    { label: 'Cooling-down', dur: 11, z: 1, lo: 50, hi: 50 },
  ];
  const BLK_VO2B = [
    { label: 'Warming-up', dur: 18, z: 2, lo: 55, hi: 65 },
    { label: 'Interval', reps: 8, dur: 2, z: 5, lo: 115, hi: 120 },
    { label: 'Herstel', reps: 7, dur: 2, z: 1, lo: 50, hi: 50 },
    { label: 'Cooling-down', dur: 12, z: 1, lo: 50, hi: 50 },
  ];

  /* ── schema rond 'vandaag' (wo 3 jun 2026) ── */
  const TODAY = new Date(2026, 5, 3);
  const PLAN = [
    { st: 'done', d: { kind: 'done', naam: 'Duurrit Veluwe', min: 120, tss: 78, rpe: 4, iff: '0,68' }, zone: 2 },
    { st: 'rest' },
    { st: 'done', d: { kind: 'done', naam: 'VO2max 6×3min', min: 68, tss: 82, rpe: 8, iff: '0,93' }, zone: 5 },
    { st: 'done', d: { kind: 'done', naam: 'Tempo 2×20min', min: 80, tss: 75, rpe: null, iff: '0,88' }, zone: 3 },
    { st: 'rest' },
    { st: 'done', d: { kind: 'done', naam: 'Haarlem Wegwielrennen', min: 149, tss: 95, rpe: 6, iff: '0,85' }, zone: 6 },
    { st: 'rest' },
    { st: 'rest' },
    { st: 'today', d: { kind: 'proposal', naam: 'VO2max 5×4min', min: 75, iff: '0,92', tss: 88, segs: SEG_VO2, blocks: BLK_VO2, why: 'Je VO2max-dekking liep achter; deze sessie vult dat aan in de Build-fase.' }, zone: 5 },
    { st: 'planned', d: { kind: 'proposal', naam: 'Drempel 2×20min', min: 80, iff: '0,95', tss: 92, segs: SEG_THRESH, blocks: BLK_THRESH, why: 'Consolideer je FTP met stevige drempelblokken richting de piek voor Girona.' }, zone: 4 },
    { st: 'rest' },
    { st: 'planned', zone: 2, sessions: [
      { label: 'Ochtend', naam: 'Lange duurrit Z2', min: 150, iff: '0,68', tss: 116, zone: 2, segs: [{ z: 1, m: 12 }, { z: 2, m: 126 }, { z: 1, m: 12 }] },
      { label: 'Middag', naam: 'Openingssprints 6×12s', min: 50, iff: '0,80', tss: 48, zone: 6, segs: [{ z: 1, m: 8 }, { z: 2, m: 10 }, { z: 6, m: 0.2 }, { z: 1, m: 4 }, { z: 6, m: 0.2 }, { z: 1, m: 4 }, { z: 6, m: 0.2 }, { z: 1, m: 4 }, { z: 6, m: 0.2 }, { z: 1, m: 4 }, { z: 6, m: 0.2 }, { z: 1, m: 4 }, { z: 6, m: 0.2 }, { z: 1, m: 6 }] },
    ] },
    { st: 'planned', d: { kind: 'proposal', naam: 'Sweet Spot 3×15min', min: 90, iff: '0,88', tss: 95, segs: SEG_SS, blocks: BLK_SS, why: 'Veel kwaliteit met beheersbare vermoeidheid: ideaal in de Build-fase.' }, zone: 4 },
    { st: 'rest' },
    { st: 'planned', d: { kind: 'proposal', naam: 'VO2max 8×2min', min: 62, iff: '0,90', tss: 78, segs: SEG_VO2B, blocks: BLK_VO2B, why: 'Korte, scherpe prikkels om de scherpte vast te houden.' }, zone: 5 },
  ];
  const DAYS = PLAN.map((p, i) => {
    const dt = new Date(TODAY); dt.setDate(TODAY.getDate() + (i - 8));
    return { ...p, idx: i, coachRest: p.st === 'rest', date: dt, wd: WD[dt.getDay()], dnum: dt.getDate(), mon: MND[dt.getMonth()] };
  });
  const TODAY_IDX = 8;

  const Dot = ({ between }) => <span style={{ color: 'var(--text-muted)', margin: '0 7px' }}>·</span>;

  /* ── RPE-beoordeling ── */
  function rpeFeedback(iffStr, rpe) {
    const iff = parseFloat(String(iffStr).replace(',', '.'));
    const pWord = iff >= 0.95 ? 'zeer zwaar' : iff >= 0.88 ? 'zwaar' : iff >= 0.80 ? 'stevig' : iff >= 0.70 ? 'gemiddeld' : 'rustig';
    const pLvl = iff >= 0.95 ? 5 : iff >= 0.88 ? 4 : iff >= 0.80 ? 3 : iff >= 0.70 ? 2 : 1;
    const fWord = rpe >= 9 ? 'maximaal' : rpe >= 7 ? 'zwaar' : rpe >= 5 ? 'stevig' : rpe >= 3 ? 'licht' : 'heel licht';
    const fLvl = rpe >= 9 ? 5 : rpe >= 7 ? 4 : rpe >= 5 ? 3 : rpe >= 3 ? 2 : 1;
    const diff = fLvl - pLvl;
    const note = diff === 0 ? 'goed afgestemd' : diff < 0 ? 'lichter dan gepland — goed hersteld' : 'zwaarder dan gepland';
    return { line: `Gepland ${pWord} (IF ${iffStr}) · jij gaf ${rpe} → voelde ${fWord}.`, note, diff };
  }

  function RpeRating({ seed, iff }) {
    const [val, setVal] = useState(seed != null ? seed : null);
    const [confirmed, setConfirmed] = useState(seed != null);
    const fb = (confirmed && val != null && iff) ? rpeFeedback(iff, val) : null;
    return (
      <div style={{ marginTop: 14, borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Over>RPE · ervaren inspanning</Over>
          {val != null && <Num size={13} color={confirmed ? 'var(--accent)' : 'var(--text-secondary)'}>{val}/10</Num>}
        </div>
        {!confirmed && (
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>Hoe zwaar voelde deze rit?</div>
        )}
        <div style={{ display: 'flex', gap: 3, marginTop: 10 }}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
            const filled = val != null && n <= val;
            const isSel = n === val;
            return (
              <button key={n} onClick={() => { setVal(n); setConfirmed(false); }} style={{
                flex: 1, height: 34, borderRadius: 'var(--r-sm)', cursor: 'pointer', padding: 0,
                border: `1px solid ${isSel ? 'var(--accent)' : filled ? 'transparent' : 'var(--border-strong)'}`,
                background: filled ? 'var(--accent)' : 'var(--bg-sunken)',
                color: filled ? '#fff' : 'var(--text-muted)',
                fontFamily: 'var(--font-num)', fontSize: 12, fontWeight: 600, transition: 'all .12s',
                boxShadow: isSel ? '0 0 0 2px color-mix(in srgb, var(--accent) 35%, transparent)' : 'none',
              }}>{n}</button>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--text-muted)' }}>
          <span>1 · heel licht</span><span>10 · maximaal</span>
        </div>
        {val != null && !confirmed && (
          <button onClick={() => setConfirmed(true)} style={{ marginTop: 12, width: '100%', height: 40, borderRadius: 'var(--r-md)', border: 'none', cursor: 'pointer', background: 'var(--accent-grad)', color: '#fff', fontFamily: 'var(--font-sans)', fontSize: 13.5, fontWeight: 600 }}>Vastleggen</button>
        )}
        {fb && (
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 9, background: 'var(--accent-soft)', border: '1px solid color-mix(in srgb, var(--accent) 35%, transparent)', borderRadius: 'var(--r-md)', padding: '10px 12px' }}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M8 1.5l1.8 3.9 4.2.5-3.1 2.9.8 4.2L8 11.4 4.3 13l.8-4.2L2 5.9l4.2-.5L8 1.5z" stroke="var(--accent)" strokeWidth="1.2" strokeLinejoin="round" /></svg>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, lineHeight: 1.4, color: 'var(--text-secondary)' }}>{fb.line}</span>
          </div>
        )}
      </div>
    );
  }

  /* ── detail-staten ── */
  const PinOverline = () => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', borderRadius: 999, padding: '4px 10px', fontFamily: 'var(--font-sans)', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--accent)' }} />Handmatig gekozen
    </span>
  );
  function FreeRideCard({ override, onRevert }) {
    const intZone = override.intensity === 'rustig' ? 2 : override.intensity === 'stevig' ? 4 : 3;
    const intLabel = { rustig: 'Rustig', tempo: 'Tempo', stevig: 'Stevig' }[override.intensity];
    const iff = override.intensity === 'rustig' ? '0,65' : override.intensity === 'stevig' ? '0,88' : '0,80';
    const naam = override.kind === 'groep' ? 'Groepsrit' : 'Vrije rit';
    return (
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-lg)', padding: 16, boxShadow: 'var(--shadow-card)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <PinOverline />
          <ZoneBadge z={intZone} />
        </div>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 23, fontWeight: 700, color: 'var(--text-primary)', marginTop: 8 }}>{naam}</div>
        <div style={{ marginTop: 8, fontFamily: 'var(--font-sans)', fontSize: 13.5, color: 'var(--text-secondary)' }}>
          <Num size={14} weight={600}>{fmtDur(override.min)}</Num><Dot /><span style={{ color: 'var(--text-muted)' }}>{intLabel}</span><Dot /><span style={{ color: 'var(--text-muted)' }}>≈IF {iff}</span>
        </div>
        <div style={{ height: 22, borderRadius: 6, background: `color-mix(in srgb, var(--zone-${intZone}) 55%, var(--bg-sunken))`, border: `1px solid color-mix(in srgb, var(--zone-${intZone}) 50%, transparent)`, marginTop: 14 }} />
        <div style={{ marginTop: 10, fontFamily: 'var(--font-sans)', fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-muted)' }}>Vrije rit — geen vaste blokstructuur. Rij op gevoel binnen {intLabel.toLowerCase()}.</div>
        <button onClick={onRevert} style={{ marginTop: 14, width: '100%', height: 38, borderRadius: 'var(--r-md)', border: '1px solid var(--border-strong)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600 }}>Terug naar voorstel</button>
      </div>
    );
  }
  function OverriddenDetail({ day, override, onRevert }) {
    if (override.type === 'free') return <FreeRideCard override={override} onRevert={onRevert} />;
    return <WorkoutDetail wo={override.wo} overline={<PinOverline />} onRevert={onRevert} />;
  }

  function ProposalDetail({ day, override, setOverride }) {
    const { d } = day;
    const [openWhy, setOpenWhy] = useState(false);
    const [openBlocks, setOpenBlocks] = useState(false);
    const [picking, setPicking] = useState(false);
    const isToday = day.st === 'today';
    if (override) return <OverriddenDetail day={day} override={override} onRevert={() => setOverride(null)} />;
    if (picking) return <WorkoutPicker onClose={() => setPicking(false)} onPick={(o) => { setOverride(o); setPicking(false); }} />;
    return (
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-lg)', padding: 16, boxShadow: 'var(--shadow-card)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Over color={isToday ? 'var(--accent)' : 'var(--text-muted)'}>{isToday ? 'Vandaag' : 'Voorstel'} · {day.wd} {day.dnum} {day.mon}</Over>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: `color-mix(in srgb, var(--zone-${day.zone}) 16%, transparent)`, color: `var(--zone-${day.zone})`, border: `1px solid color-mix(in srgb, var(--zone-${day.zone}) 45%, transparent)`, borderRadius: 999, padding: '3px 9px', fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600 }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: `var(--zone-${day.zone})` }} />{ZNAME[day.zone]}
          </span>
        </div>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 23, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', marginTop: 8 }}>{d.naam}</div>
        <div style={{ marginTop: 8, fontFamily: 'var(--font-sans)', fontSize: 13.5, color: 'var(--text-secondary)' }}>
          <Num size={14} weight={600}>{d.min}</Num> min<Dot /><span style={{ color: 'var(--text-muted)' }}>IF</span> <Num size={14} weight={600}>{d.iff}</Num><Dot /><span style={{ color: 'var(--text-muted)' }}>TSS</span> <Num size={14} weight={600}>{d.tss}</Num>
        </div>

        {/* zone-balk — tik om de blokstructuur uit te klappen */}
        <div onClick={() => setOpenBlocks((v) => !v)} role="button" aria-expanded={openBlocks} style={{ cursor: 'pointer' }}>
          <ZoneBar segments={d.segs} />
          <ZoneLegend segments={d.segs} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, borderTop: '1px solid var(--border-subtle)', paddingTop: 11 }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>Blokstructuur</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', fontSize: 11 }}>
              {d.blocks.length} blokken
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ transform: openBlocks ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}><path d="M3 5l4 4 4-4" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
          </div>
        </div>
        {openBlocks && (
          <div style={{ marginTop: 10 }}><BlockList blocks={d.blocks} /></div>
        )}

        {/* uitklap: waarom deze training */}
        <button onClick={() => setOpenWhy((v) => !v)} style={{
          width: '100%', marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--bg-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-md)',
          padding: '11px 13px', cursor: 'pointer', color: 'var(--text-primary)',
          fontFamily: 'var(--font-sans)', fontSize: 13.5, fontWeight: 600,
        }}>
          Waarom deze training?
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ transform: openWhy ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
            <path d="M3 5l4 4 4-4" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {openWhy && (
          <div style={{ marginTop: 8, padding: '0 2px', fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary)' }}>{d.why}</div>
        )}

        <button onClick={() => setPicking(true)} style={{ marginTop: 12, width: '100%', height: 'var(--btn-height)', borderRadius: 'var(--btn-radius)', border: '1px solid var(--btn-secondary-border)', background: 'var(--btn-secondary-bg)', cursor: 'pointer', color: 'var(--btn-secondary-text)', fontFamily: 'var(--font-sans)', fontSize: 13.5, fontWeight: 600 }}>Doe iets anders</button>
      </div>
    );
  }

  function DoneDetail({ day }) {
    const { d } = day;
    return (
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-lg)', padding: 16, opacity: 0.92 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Over>Voltooid · {day.wd} {day.dnum} {day.mon}</Over>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--good)', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600 }}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 7.5l3.2 3.5L12 3.5" stroke="var(--good)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Gedaan
          </span>
        </div>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginTop: 7 }}>{d.naam}</div>
        <div style={{ marginTop: 8, fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--text-secondary)' }}>
          <Num size={13.5} weight={600}>{d.min}</Num> min<Dot /><span style={{ color: 'var(--text-muted)' }}>TSS</span> <Num size={13.5} weight={600}>{d.tss}</Num>
        </div>
        <RpeRating key={day.idx} seed={d.rpe} iff={d.iff} />
      </div>
    );
  }

  function RecoveryCard({ day, onToch }) {
    return (
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-lg)', padding: '22px 16px', textAlign: 'center' }}>
        <Over style={{ color: 'var(--text-muted)' }}>Rustdag · {day.wd} {day.dnum} {day.mon}</Over>
        <div style={{ width: 38, height: 38, borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--bg-sunken)', margin: '14px auto 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M14.5 10.2A6 6 0 016.8 3.5a6 6 0 107.7 6.7z" stroke="var(--text-secondary)" strokeWidth="1.4" strokeLinejoin="round" /></svg>
        </div>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--text-secondary)', marginTop: 12, maxWidth: 240, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>Van herstel word je beter — vandaag geen rit.</div>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>Je coach adviseert herstel.</div>
        <button onClick={onToch} style={{ marginTop: 16, height: 38, padding: '0 18px', borderRadius: 'var(--r-md)', border: '1px solid var(--border-strong)', background: 'var(--bg-elevated)', cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600 }}>Toch trainen</button>
      </div>
    );
  }
  function UnavailableCard({ day, onToch }) {
    return (
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-lg)', padding: '22px 16px', textAlign: 'center' }}>
        <Over style={{ color: 'var(--text-muted)' }}>Niet beschikbaar · {day.wd} {day.dnum} {day.mon}</Over>
        <div style={{ width: 38, height: 38, borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--bg-sunken)', margin: '14px auto 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="17" height="17" viewBox="0 0 18 18" fill="none"><rect x="2.5" y="3.5" width="13" height="12" rx="2" stroke="var(--text-secondary)" strokeWidth="1.4" /><path d="M2.5 7h13M6 2v3M12 2v3" stroke="var(--text-secondary)" strokeWidth="1.4" strokeLinecap="round" /></svg>
        </div>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--text-secondary)', marginTop: 12, maxWidth: 240, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>Je hebt aangegeven vandaag niet te trainen.</div>
        <button onClick={onToch} style={{ marginTop: 16, height: 38, padding: '0 18px', borderRadius: 'var(--r-md)', border: 'none', background: 'var(--accent-grad)', cursor: 'pointer', color: '#fff', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600 }}>Toch trainen</button>
      </div>
    );
  }

  /* ── dag-strip ── */
  function DayStrip({ sel, setSel }) {
    const ref = useRef(null);
    useEffect(() => {
      const c = ref.current; if (!c) return;
      const center = () => {
        const chip = c.querySelector(`[data-idx="${TODAY_IDX}"]`);
        if (chip) c.scrollLeft = chip.offsetLeft - c.clientWidth / 2 + chip.offsetWidth / 2;
      };
      requestAnimationFrame(() => requestAnimationFrame(center));
    }, []);
    return (
      <div ref={ref} className="daystrip" style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '2px 16px 6px', scrollSnapType: 'x proximity' }}>
        {DAYS.map((day) => {
          const isSel = day.idx === sel;
          const isToday = day.st === 'today';
          const accentEdge = isSel || isToday;
          return (
            <button key={day.idx} data-idx={day.idx} onClick={() => setSel(day.idx)} style={{
              flex: '0 0 auto', scrollSnapAlign: 'center', width: 50, padding: '9px 0 8px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'pointer',
              borderRadius: 'var(--r-md)',
              background: isSel ? 'var(--accent-soft)' : 'var(--bg-surface)',
              border: `1.5px solid ${isSel ? 'var(--accent)' : isToday ? 'color-mix(in srgb, var(--accent) 55%, transparent)' : 'var(--border-subtle)'}`,
              transition: 'all .15s',
            }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: accentEdge ? 'var(--accent)' : 'var(--text-muted)' }}>{day.wd}</span>
              <Num size={17} weight={600} color={isSel ? 'var(--accent)' : 'var(--text-primary)'}>{day.dnum}</Num>
              <span style={{ height: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {day.st === 'done' && (
                  <svg width="11" height="11" viewBox="0 0 14 14" fill="none"><path d="M2 7.5l3.2 3.5L12 3.5" stroke="var(--text-secondary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                )}
                {(day.st === 'planned' || day.st === 'today') && (
                  day.sessions
                    ? <span style={{ display: 'flex', gap: 2 }}>{day.sessions.map((s, i) => <span key={i} style={{ width: 6, height: 6, borderRadius: 999, background: `var(--zone-${s.zone})` }} />)}</span>
                    : <span style={{ width: 7, height: 7, borderRadius: 999, background: `var(--zone-${day.zone})` }} />
                )}
                {day.st === 'rest' && (
                  <span style={{ width: 8, height: 2, borderRadius: 2, background: 'var(--border-strong)' }} />
                )}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  /* ── Garmin-sync (per dag · alle sessies) ── */
  function nowTime() { return new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }); }
  function computeSig(day, override) {
    if (day.sessions) return 'm:' + day.sessions.map((s) => s.naam).join('+');
    if (override) return override.type === 'free' ? `f:${override.kind}:${override.min}:${override.intensity}` : `l:${override.wo.naam}:${override.wo.min}`;
    return 'e:' + (day.d ? day.d.naam : '');
  }
  function GarminSync({ state, at, sessions, onSend }) {
    const multi = sessions > 1;
    const label = multi ? `Stuur ${sessions} sessies naar Garmin` : 'Stuur naar Garmin';
    const baseBtn = { width: '100%', height: 'var(--btn-height)', borderRadius: 'var(--btn-radius)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 13.5, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 };
    const Up = () => <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M8 10.5V2.5M5 5.5l3-3 3 3" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /><path d="M2.7 9v3.3a1 1 0 001 1h8.6a1 1 0 001-1V9" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" /></svg>;
    if (state === 'busy') return (<button disabled style={{ ...baseBtn, border: '1px solid var(--border-strong)', background: 'var(--bg-elevated)', color: 'var(--text-muted)', cursor: 'default' }}><span className="gm-spin" /> Versturen…</button>);
    if (state === 'sent') return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--good-soft)', border: '1px solid color-mix(in srgb, var(--good) 35%, transparent)', borderRadius: 'var(--btn-radius)', padding: '11px 14px', opacity: 0.9 }}>
        <svg width="15" height="15" viewBox="0 0 14 14" fill="none"><path d="M2 7.5l3.2 3.5L12 3.5" stroke="var(--good)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <span style={{ flex: 1, fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, color: 'var(--good)' }}>{multi ? `${sessions} sessies verstuurd` : 'Verstuurd naar Garmin'}</span>
        <span style={{ fontFamily: 'var(--font-num)', fontSize: 12, color: 'var(--text-muted)' }}>{at}</span>
      </div>
    );
    if (state === 'stale') return (
      <div style={{ background: 'var(--warn-soft)', border: '1px solid color-mix(in srgb, var(--warn) 40%, transparent)', borderRadius: 'var(--r-md)', padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M8 1.7l6.4 11.3H1.6L8 1.7z" stroke="var(--warn)" strokeWidth="1.4" strokeLinejoin="round" /><path d="M8 6.4v3.1M8 11.3v.05" stroke="var(--warn)" strokeWidth="1.6" strokeLinecap="round" /></svg>
          <span style={{ flex: 1, fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--warn)' }}>Garmin heeft nog de oude training</span>
        </div>
        <button onClick={onSend} style={{ ...baseBtn, marginTop: 10, border: 'none', background: 'var(--accent-grad)', color: '#fff' }}>Bijgewerkte training versturen</button>
      </div>
    );
    if (state === 'error') return (
      <div style={{ background: 'var(--bad-soft)', border: '1px solid color-mix(in srgb, var(--bad) 40%, transparent)', borderRadius: 'var(--r-md)', padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.3" stroke="var(--bad)" strokeWidth="1.4" /><path d="M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8" stroke="var(--bad)" strokeWidth="1.5" strokeLinecap="round" /></svg>
          <span style={{ flex: 1, fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--bad)' }}>Versturen naar Garmin mislukt</span>
        </div>
        <button onClick={onSend} style={{ ...baseBtn, marginTop: 10, border: '1px solid var(--border-strong)', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>Opnieuw proberen</button>
      </div>
    );
    return (<button onClick={onSend} style={{ ...baseBtn, border: '1px solid var(--border-strong)', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}><Up /> {label}</button>);
  }

  function MultiSessionDetail({ day }) {
    const isToday = day.st === 'today';
    return (
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-lg)', padding: 16, boxShadow: 'var(--shadow-card)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Over color={isToday ? 'var(--accent)' : 'var(--text-muted)'}>{isToday ? 'Vandaag' : 'Voorstel'} · {day.wd} {day.dnum} {day.mon}</Over>
          <span style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', borderRadius: 999, padding: '3px 9px', fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>{day.sessions.length} sessies</span>
        </div>
        {day.sessions.map((s, i) => (
          <div key={i} style={{ background: 'var(--bg-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-md)', padding: '12px 12px', marginTop: i ? 10 : 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{s.label}</span>
              <ZoneBadge z={s.zone} />
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginTop: 7 }}>{s.naam}</div>
            <div style={{ marginTop: 6, fontFamily: 'var(--font-sans)', fontSize: 12.5, color: 'var(--text-secondary)' }}>
              <Num size={13} weight={600}>{fmtDur(s.min)}</Num><Dot /><span style={{ color: 'var(--text-muted)' }}>IF</span> <Num size={13} weight={600}>{s.iff}</Num><Dot /><span style={{ color: 'var(--text-muted)' }}>TSS</span> <Num size={13} weight={600}>{s.tss}</Num>
            </div>
            <MiniZoneBar segments={s.segs} />
          </div>
        ))}
      </div>
    );
  }

  /* ── beschikbaarheid ── */
  const isWeekend = (day) => [0, 6].includes(day.date.getDay());
  const defaultAvail = (day) => ({ train: day.st !== 'rest', minutes: day.sessions ? day.sessions.reduce((a, s) => a + s.min, 0) : (day.d ? day.d.min : 60), pendel: false });
  function synthDay(day, minutes) {
    const dv = window.WORKOUT_CATS.find((c) => c.key === 'duur').variants[0];
    const w = window.buildWorkout(dv, minutes);
    return { ...day, st: day.st === 'today' ? 'today' : 'planned', zone: w.zone, d: { kind: 'proposal', naam: w.naam, min: w.min, iff: w.iff, tss: w.tss, segs: w.segs, blocks: w.blocks, why: 'Voorstel op basis van je beschikbaarheid — een rustige duurrit. Kies eventueel zelf iets anders.' } };
  }
  const Toggle = ({ on, onChange, sm }) => (
    <button role="switch" aria-checked={on} onClick={() => onChange(!on)} style={{ width: sm ? 38 : 44, height: sm ? 22 : 26, borderRadius: 999, border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0, position: 'relative', background: on ? 'var(--accent)' : '#2A323D', transition: 'background .2s' }}>
      <span style={{ position: 'absolute', top: 3, left: on ? `calc(100% - ${sm ? 19 : 23}px)` : 3, width: sm ? 16 : 20, height: sm ? 16 : 20, borderRadius: 999, background: '#EDF1F5', boxShadow: '0 1px 3px rgba(0,0,0,0.5)', transition: 'left .2s' }} />
    </button>
  );
  const ERow = ({ label, sub, right }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</div>
        {sub && <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
  function DayControls({ val, onChange }) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <ERow label="Train vandaag?" right={<Toggle on={val.train} onChange={(v) => onChange({ ...val, train: v })} />} />
        {val.train && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--text-secondary)' }}>Minuten</span>
              <Num size={15} color="var(--accent)">{val.minutes}</Num>
            </div>
            <input type="range" min={30} max={240} step={15} value={val.minutes} onChange={(e) => onChange({ ...val, minutes: Number(e.target.value) })} style={{ width: '100%', marginTop: 8, accentColor: 'var(--accent)', cursor: 'pointer' }} />
          </div>
        )}
        <ERow label="Pendel?" sub="woon-werk meegeteld" right={<Toggle on={val.pendel} onChange={(v) => onChange({ ...val, pendel: v })} />} />
      </div>
    );
  }
  function AvailabilityEditor({ sel, weekIdxs, getAvail, forceTrain, onSave, onClose }) {
    const [scope, setScope] = useState(forceTrain ? 'day' : 'choose');
    const init = getAvail(sel);
    const [d, setD] = useState(forceTrain ? { ...init, train: true, minutes: init.minutes || 60 } : init);
    const [wk, setWk] = useState(() => weekIdxs.map((i) => getAvail(i)));
    const dayLabel = `${DAYS[sel].wd} ${DAYS[sel].dnum} ${DAYS[sel].mon}`;
    const card = { background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-lg)', padding: 16, boxShadow: 'var(--shadow-card)' };
    const back = (scope === 'choose' || forceTrain) ? onClose : () => setScope('choose');
    const Head = ({ title }) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <button onClick={back} aria-label="Terug" style={{ width: 30, height: 30, borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
      </div>
    );
    const saveBtn = (onClick) => (<button onClick={onClick} style={{ marginTop: 16, width: '100%', height: 'var(--btn-height)', borderRadius: 'var(--btn-radius)', border: 'none', cursor: 'pointer', background: 'var(--accent-grad)', color: '#fff', fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600 }}>Opslaan</button>);
    if (scope === 'choose') return (
      <div style={card}>
        <Head title="Beschikbaarheid" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[['day', 'Alleen deze dag', dayLabel], ['week', 'Hele week', 'ma–zo in één keer']].map(([k, t, s]) => (
            <button key={k} onClick={() => setScope(k)} style={{ textAlign: 'left', cursor: 'pointer', background: 'var(--bg-sunken)', border: '1px solid var(--border-strong)', borderRadius: 'var(--r-md)', padding: '14px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div><div style={{ fontFamily: 'var(--font-sans)', fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary)' }}>{t}</div><div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{s}</div></div>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M5 2l5 5-5 5" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          ))}
        </div>
      </div>
    );
    if (scope === 'day') return (
      <div style={card}>
        <Head title={forceTrain ? 'Toch trainen' : 'Deze dag'} />
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>{dayLabel}{isWeekend(DAYS[sel]) ? ' · weekend' : ''}</div>
        <DayControls val={d} onChange={setD} />
        {saveBtn(() => onSave({ updates: { [sel]: d } }))}
      </div>
    );
    return (
      <div style={card}>
        <Head title="Hele week" />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 14, fontFamily: 'var(--font-sans)', fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, paddingRight: 2 }}><span>Train</span><span>Pendel</span></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {weekIdxs.map((idx, i) => {
            const v = wk[i]; const set = (nv) => setWk((w) => w.map((x, j) => (j === i ? nv : x)));
            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-md)', padding: '8px 12px' }}>
                <span style={{ width: 42, fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{DAYS[idx].wd} {DAYS[idx].dnum}</span>
                {v.train
                  ? <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}><input type="range" min={30} max={240} step={15} value={v.minutes} onChange={(e) => set({ ...v, minutes: Number(e.target.value) })} style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }} /><Num size={12} color="var(--text-secondary)" style={{ width: 34, textAlign: 'right' }}>{v.minutes}</Num></div>
                  : <span style={{ flex: 1, fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-muted)' }}>rustdag</span>}
                <Toggle sm on={v.train} onChange={(t) => set({ ...v, train: t })} />
                <Toggle sm on={v.pendel} onChange={(p) => set({ ...v, pendel: p })} />
              </div>
            );
          })}
        </div>
        {saveBtn(() => onSave({ updates: Object.fromEntries(weekIdxs.map((idx, i) => [idx, wk[i]])) }))}
      </div>
    );
  }

  function PeriodTimeline() {
    const [open, setOpen] = useState(false);
    const ev = new Date(2026, 8, 12);
    const wks = Math.max(0, Math.round((ev - TODAY) / (7 * 86400000)));
    const phases = [{ k: 'Basis', wk: 5 }, { k: 'Build', wk: 9, cur: true }, { k: 'Peak', wk: 4 }, { k: 'Taper', wk: 1 }];
    const total = phases.reduce((a, p) => a + p.wk, 0);
    const curIdx = phases.findIndex((p) => p.cur);
    const elapsed = phases.slice(0, curIdx).reduce((a, p) => a + p.wk, 0) + 1.5;
    const markerPct = (elapsed / total) * 100;
    const events = [{ pct: 73, tag: 'B', label: 'Tune-up' }, { pct: 100, tag: 'A', label: 'Girona' }];
    const segBg = (i) => (i < curIdx ? 'color-mix(in srgb, var(--accent) 28%, var(--bg-sunken))' : i === curIdx ? 'var(--accent)' : 'var(--bg-elevated)');
    const ModeChip = () => (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid color-mix(in srgb, var(--accent) 38%, transparent)', borderRadius: 999, padding: '3px 9px', fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600 }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--accent)' }} />Doel-gericht
      </span>
    );
    const Stat = ({ label, val, accent, first }) => (
      <div style={{ flex: 1, borderLeft: first ? 'none' : '1px solid var(--border-subtle)', paddingLeft: first ? 0 : 12 }}>
        <Over style={{ fontSize: 9.5 }}>{label}</Over>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, color: accent ? 'var(--accent)' : 'var(--text-primary)', marginTop: 4 }}>{val}</div>
      </div>
    );
    return (
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-lg)', padding: 14, boxShadow: 'var(--shadow-card)' }}>
        <button onClick={() => setOpen((v) => !v)} style={{ width: '100%', border: 'none', background: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ textAlign: 'left', minWidth: 0 }}>
            <Over>Plan · periodisering</Over>
            <div style={{ marginTop: 5, fontFamily: 'var(--font-sans)', fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>Build · nog {wks} wkn tot Girona</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {!open && <ModeChip />}
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}><path d="M3 5l4 4 4-4" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
        </button>
        {open && (
          <div style={{ marginTop: 16 }}>
            <div style={{ position: 'relative' }}>
              {events.map((e, i) => (
                <div key={i} style={{ position: 'absolute', top: 0, left: e.pct >= 100 ? undefined : `${e.pct}%`, right: e.pct >= 100 ? 0 : undefined, transform: e.pct >= 100 ? 'none' : 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: e.pct >= 100 ? 'flex-end' : 'center' }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: e.tag === 'A' ? 'var(--accent-soft)' : 'var(--bg-elevated)', color: e.tag === 'A' ? 'var(--accent)' : 'var(--text-secondary)', border: `1px solid ${e.tag === 'A' ? 'color-mix(in srgb, var(--accent) 40%, transparent)' : 'var(--border-strong)'}`, whiteSpace: 'nowrap' }}>{e.label} · {e.tag}</span>
                  <span style={{ width: 1, height: 6, background: e.tag === 'A' ? 'var(--accent)' : 'var(--border-strong)' }} />
                </div>
              ))}
              <div style={{ display: 'flex', gap: 3, marginTop: 26 }}>
                {phases.map((p, i) => (
                  <div key={p.k} style={{ flex: p.wk, height: 12, borderRadius: 3, background: segBg(i), border: i > curIdx ? '1px solid var(--border-subtle)' : 'none' }} />
                ))}
              </div>
              <div style={{ position: 'absolute', top: 23, left: `${markerPct}%`, transform: 'translateX(-50%)', width: 12, height: 12, borderRadius: 999, background: '#EDF1F5', border: '2px solid var(--accent)', boxShadow: '0 0 0 3px var(--accent-soft)' }} />
              <div style={{ display: 'flex', gap: 3, marginTop: 8 }}>
                {phases.map((p, i) => (
                  <div key={p.k} style={{ flex: p.wk, textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: 9.5, fontWeight: 600, color: i === curIdx ? 'var(--accent)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>{p.k}</div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', marginTop: 18 }}>
              <Stat first label="Fase" val="Build" accent />
              <Stat label="Tot Girona" val={`${wks} wkn`} />
              <Stat label="Volume" val="~8 u/wk" />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              <ModeChip />
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11.5, color: 'var(--text-muted)' }}>→ Evenement-gericht ~3 wkn vóór Girona</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  function WeekLoad({ stale, regen, regenAt, onRegen }) {
    const pct = 67;
    const Stat = ({ val, sub, label, first }) => (
      <div style={{ flex: 1, textAlign: 'center', borderLeft: first ? 'none' : '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 3 }}>
          <Num size={20} weight={600}>{val}</Num>
          <span style={{ fontFamily: 'var(--font-num)', fontSize: 11, color: 'var(--text-muted)' }}>/{sub}</span>
        </div>
        <Over style={{ marginTop: 5, fontSize: 9.5 }}>{label}</Over>
      </div>
    );
    let action;
    if (regen === 'busy') action = (<span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}><span className="gm-spin" /> Bijwerken…</span>);
    else if (!stale && regen === 'done') action = (<span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, color: 'var(--good)' }}><svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 7.5l3.2 3.5L12 3.5" stroke="var(--good)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>Bijgewerkt{regenAt ? ` · ${regenAt}` : ''}</span>);
    else action = (<button onClick={onRegen} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 12px', borderRadius: 'var(--r-pill)', border: '1px solid var(--border-strong)', background: 'var(--bg-elevated)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}><svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M12 7a5 5 0 11-1.5-3.6" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" /><path d="M12 1.5V4.2H9.3" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>Werk week bij</button>);
    return (
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-lg)', padding: 14, boxShadow: 'var(--shadow-card)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Over>Deze week · gepland vs gedaan</Over>
          {action}
        </div>
        <div style={{ display: 'flex', marginTop: 12 }}>
          <Stat first val="320" sub="480" label="TSS" />
          <Stat val="3:10" sub="5:00" label="Uren" />
          <Stat val="3" sub="5" label="Dagen" />
        </div>
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11.5, color: 'var(--text-secondary)' }}>Voortgang</span>
            <Num size={11} weight={600} color="var(--text-secondary)">{pct}% van plan</Num>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: 'var(--bg-sunken)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, background: 'var(--accent-grad)' }} />
          </div>
        </div>
        {stale && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, background: 'var(--warn-soft)', border: '1px solid color-mix(in srgb, var(--warn) 40%, transparent)', borderRadius: 'var(--r-md)', padding: '9px 12px' }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M8 1.7l6.4 11.3H1.6L8 1.7z" stroke="var(--warn)" strokeWidth="1.4" strokeLinejoin="round" /><path d="M8 6.4v3.1M8 11.3v.05" stroke="var(--warn)" strokeWidth="1.6" strokeLinecap="round" /></svg>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--warn)' }}>Je plan is verouderd t.o.v. je beschikbaarheid — werk bij.</span>
          </div>
        )}
      </div>
    );
  }

  function SchemaTab({ dataState, setDataState, onOpenSettings }) {
    const [sel, setSel] = useState(TODAY_IDX);
    const [overrides, setOverrides] = useState({});
    const [garmin, setGarmin] = useState({});
    const [avail, setAvail] = useState({});
    const [editing, setEditing] = useState(null);
    const [availDirty, setAvailDirty] = useState(false);
    const [regen, setRegen] = useState('idle');
    const [regenAt, setRegenAt] = useState(null);
    const regenWeek = () => { setRegen('busy'); setTimeout(() => { setRegen('done'); setRegenAt(nowTime()); setAvailDirty(false); if (dataState === 'lege week' || dataState === 'eerste keer') setDataState && setDataState('normaal'); }, 1200); };
    const day = DAYS[sel];
    const selectDay = (i) => { setSel(i); setEditing(null); };
    const override = overrides[sel] || null;
    const setOverride = (o) => setOverrides((m) => ({ ...m, [sel]: o }));
    const getAvail = (i) => avail[i] || defaultAvail(DAYS[i]);
    const a = getAvail(sel);
    const gd = DAYS[TODAY_IDX].date.getDay();
    const monIdx = TODAY_IDX - (gd === 0 ? 6 : gd - 1);
    const weekIdxs = [0, 1, 2, 3, 4, 5, 6].map((i) => monIdx + i).filter((i) => i >= 0 && i < DAYS.length);
    const saveAvail = ({ updates }) => { setAvail((m) => ({ ...m, ...updates })); setEditing(null); setAvailDirty(true); };

    const sessions = day.sessions ? day.sessions.length : 1;
    const sig = computeSig(day, override);
    const stored = garmin[sel];
    const effState = !stored ? 'idle' : (stored.state === 'sent' && stored.sig !== sig ? 'stale' : stored.state);
    const send = () => {
      setGarmin((m) => ({ ...m, [sel]: { state: 'busy', sig } }));
      setTimeout(() => {
        setGarmin((m) => {
          const fail = Math.random() < 0.18;
          return { ...m, [sel]: fail ? { state: 'error', sig } : { state: 'sent', sig, at: nowTime() } };
        });
      }, 1300);
    };

    if (dataState === 'niet verbonden') return <div style={{ padding: '0 16px' }}><ConnectState onConnect={onOpenSettings} /></div>;
    if (dataState === 'lege week' || dataState === 'eerste keer') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, margin: '0 -16px' }}>
          <div style={{ padding: '0 16px' }}><WeekLoad stale={false} regen={regen} regenAt={regenAt} onRegen={regenWeek} /></div>
          <div style={{ padding: '0 16px' }}>
            <EmptyState title="Nog geen voorstellen deze week" text="Werk je week bij om sessies te genereren op basis van je doel en beschikbaarheid." actionLabel="Werk week bij" onAction={regenWeek} />
          </div>
        </div>
      );
    }

    if (editing) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, margin: '0 -16px' }}>
          <DayStrip sel={sel} setSel={selectDay} />
          <div style={{ padding: '0 16px' }}>
            <AvailabilityEditor sel={sel} weekIdxs={weekIdxs} getAvail={getAvail} forceTrain={editing.forceTrain} onSave={saveAvail} onClose={() => setEditing(null)} />
          </div>
        </div>
      );
    }

    let detail; let sendable = false;
    if (day.st === 'done') detail = <DoneDetail day={day} />;
    else if (!a.train) detail = day.coachRest
      ? <RecoveryCard day={day} onToch={() => setEditing({ forceTrain: true })} />
      : <UnavailableCard day={day} onToch={() => setEditing({ forceTrain: true })} />;
    else {
      sendable = true;
      if (override) detail = <OverriddenDetail day={day} override={override} onRevert={() => setOverride(null)} />;
      else if (day.sessions) detail = <MultiSessionDetail day={day} />;
      else if (day.d && day.d.kind === 'proposal') detail = <ProposalDetail day={day} override={override} setOverride={setOverride} />;
      else detail = <ProposalDetail day={synthDay(day, a.minutes)} override={override} setOverride={setOverride} />;
    }
    const showRecoveryNote = day.coachRest && a.train;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, margin: '0 -16px' }}>
        {dataState === 'sync mislukt' && <div style={{ padding: '0 16px' }}><SyncBanner onRetry={() => setDataState('normaal')} /></div>}
        <div style={{ padding: '0 16px' }}><PeriodTimeline /></div>
        <div style={{ padding: '0 16px' }}><WeekLoad stale={availDirty} regen={regen} regenAt={regenAt} onRegen={regenWeek} /></div>
        <DayStrip sel={sel} setSel={selectDay} />
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {showRecoveryNote && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', borderRadius: 'var(--r-md)', padding: '9px 12px' }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--warn)', flexShrink: 0 }} />
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11.5, color: 'var(--text-secondary)' }}>Herstel was aanbevolen — luister naar je lichaam.</span>
            </div>
          )}
          <div key={sel}>{detail}</div>
          {sendable && <GarminSync state={effState} at={stored && stored.at} sessions={sessions} onSend={send} />}
          <button onClick={() => setEditing({ forceTrain: false })} style={{ width: '100%', height: 42, borderRadius: 'var(--r-md)', border: '1px solid var(--border-strong)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <svg width="15" height="15" viewBox="0 0 18 18" fill="none" style={{ color: 'var(--text-muted)' }}><rect x="2.5" y="3.5" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" /><path d="M2.5 7h13M6 2v3M12 2v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
            Beschikbaarheid
          </button>
        </div>
      </div>
    );
  }

  Object.assign(window, { SchemaTab });
})();

```


////////////////////////////////////////////////////////////////
// FILE: settings.jsx
////////////////////////////////////////////////////////////////

```jsx
// settings.jsx — Instellingen-scherm (dark, token-gedreven form-componenten)
// Export to window: SettingsScreen
(function () {
  const { useState, useRef } = React;

  /* ── helpers ── */
  const Over = ({ children, style }) => (
    <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', fontWeight: 600, letterSpacing: 'var(--tracking-overline)', textTransform: 'uppercase', color: 'var(--text-muted)', ...style }}>{children}</div>
  );
  const Chevron = ({ dir = 'down', size = 14, color = 'var(--text-muted)' }) => {
    const d = { down: 'M3 5l4 4 4-4', left: 'M9 2L4 7l5 5', right: 'M5 2l5 5-5 5' }[dir];
    const vb = dir === 'down' ? '0 0 14 14' : '0 0 13 14';
    return <svg width={size} height={size} viewBox={vb} fill="none"><path d={d} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  };
  const Check = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7.5l3.2 3.5L12 3.5" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;

  /* ── form-componenten ── */
  function Section({ title, children, footer }) {
    return (
      <div style={{ marginBottom: 18 }}>
        {title && <Over style={{ margin: '0 4px 8px' }}>{title}</Over>}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>{children}</div>
        {footer}
      </div>
    );
  }
  function Row({ label, sub, right, children, last }) {
    return (
      <div style={{ padding: '12px 14px', borderBottom: last ? 'none' : '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 26 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14.5, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</div>
            {sub && <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
          </div>
          {right}
        </div>
        {children && <div style={{ marginTop: 10 }}>{children}</div>}
      </div>
    );
  }
  const ReadValue = ({ children, mono }) => (
    <span style={{ fontFamily: mono ? 'var(--font-num)' : 'var(--font-sans)', fontSize: 14.5, fontWeight: mono ? 600 : 400, color: 'var(--text-secondary)' }}>{children}</span>
  );

  function NumberField({ value, onChange, unit, width = 76 }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <input type="number" inputMode="decimal" className="field" value={value}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          style={{ width, height: 'var(--field-height)', background: 'var(--field-bg)', border: '1px solid var(--field-border)', borderRadius: 'var(--field-radius)', color: 'var(--field-text)', textAlign: 'right', padding: '0 10px', fontFamily: 'var(--font-num)', fontSize: 15, fontWeight: 600, outline: 'none', WebkitAppearance: 'none', MozAppearance: 'textfield' }} />
        {unit && <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-muted)', width: 16 }}>{unit}</span>}
      </div>
    );
  }
  function TextField({ value, onChange, placeholder, full }) {
    return (
      <input className="field" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
        style={{ width: full ? '100%' : 150, height: 'var(--field-height)', background: 'var(--field-bg)', border: '1px solid var(--field-border)', borderRadius: 'var(--field-radius)', color: 'var(--field-text)', textAlign: full ? 'left' : 'right', padding: '0 12px', fontFamily: 'var(--font-sans)', fontSize: 14.5, outline: 'none', boxSizing: 'border-box' }} />
    );
  }
  function DateField({ value, onChange }) {
    return (
      <input type="date" className="field" value={value} onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%', height: 'var(--field-height)', background: 'var(--date-bg)', border: '1px solid var(--date-border)', borderRadius: 'var(--field-radius)', color: 'var(--date-text)', padding: '0 10px', fontFamily: 'var(--font-num)', fontSize: 13.5, outline: 'none', colorScheme: 'dark', boxSizing: 'border-box' }} />
    );
  }
  function Toggle({ on, onChange }) {
    return (
      <button role="switch" aria-checked={on} onClick={() => onChange(!on)}
        style={{ width: 'var(--toggle-w)', height: 'var(--toggle-h)', borderRadius: 999, border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0, position: 'relative', background: on ? 'var(--toggle-track-on)' : 'var(--toggle-track-off)', transition: 'background .2s' }}>
        <span style={{ position: 'absolute', top: 3, left: on ? 'calc(100% - 23px)' : 3, width: 20, height: 20, borderRadius: 999, background: 'var(--toggle-thumb)', boxShadow: 'var(--toggle-thumb-shadow)', transition: 'left .2s cubic-bezier(.4,0,.2,1)' }} />
      </button>
    );
  }
  function Select({ value, options, onChange }) {
    const [open, setOpen] = useState(false);
    const cur = options.find((o) => o.k === value) || options[0];
    return (
      <div style={{ position: 'relative' }}>
        <button onClick={() => setOpen(!open)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 44, background: 'var(--select-bg)', border: `1px solid ${open ? 'var(--accent)' : 'var(--select-border)'}`, borderRadius: 'var(--field-radius)', padding: '0 12px', cursor: 'pointer', transition: 'border-color .15s' }}>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 14.5, fontWeight: 600, color: 'var(--select-text)' }}>{cur.t}</span>
            <span style={{ fontFamily: 'var(--font-num)', fontSize: 12, color: 'var(--text-muted)' }}>{cur.s}</span>
          </span>
          <span style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}><Chevron dir="down" /></span>
        </button>
        {open && (
          <div style={{ marginTop: 6, background: 'var(--select-menu-bg)', border: '1px solid var(--select-menu-border)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
            {options.map((o, i) => (
              <button key={o.k} onClick={() => { onChange(o.k); setOpen(false); }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 12px', border: 'none', borderTop: i ? '1px solid var(--border-subtle)' : 'none', background: o.k === value ? 'var(--select-option-active)' : 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{o.t}</span>
                  <span style={{ fontFamily: 'var(--font-num)', fontSize: 11.5, color: 'var(--text-muted)' }}>{o.s}</span>
                </span>
                {o.k === value && <Check />}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
  function Button({ variant = 'secondary', children, onClick, full }) {
    const base = { height: 'var(--btn-height)', borderRadius: 'var(--btn-radius)', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, padding: '0 18px', width: full ? '100%' : 'auto', transition: 'filter .15s' };
    const v = {
      primary: { background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' },
      secondary: { background: 'var(--btn-secondary-bg)', color: 'var(--btn-secondary-text)', border: '1px solid var(--btn-secondary-border)' },
      destructive: { background: 'var(--btn-destructive-bg)', color: 'var(--btn-destructive-text)', border: '1px solid rgba(255,82,103,0.25)' },
    }[variant];
    return <button onClick={onClick} style={{ ...base, ...v }}>{children}</button>;
  }
  const Badge = ({ children }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--badge-good-bg)', color: 'var(--badge-good-text)', border: '1px solid rgba(52,209,127,0.4)', borderRadius: 999, padding: '3px 9px', fontFamily: 'var(--font-sans)', fontSize: 11.5, fontWeight: 600 }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--good)' }} />{children}
    </span>
  );

  const VOLUMES = [
    { k: 'amateur', t: 'Amateur', s: '~3u/wk' },
    { k: 'gemiddeld', t: 'Gemiddeld', s: '~5u/wk' },
    { k: 'gevorderd', t: 'Gevorderd', s: '~7u/wk' },
    { k: 'professional', t: 'Professional', s: '10u+/wk' },
  ];

  const DOELEN = [
    { k: 'duur', t: 'Duurvermogen', s: 'basis' },
    { k: 'ftp', t: 'FTP / drempel', s: 'drempel' },
    { k: 'vo2', t: 'VO2max', s: 'scherpte' },
    { k: 'onderhoud', t: 'Onderhoud', s: 'behoud' },
  ];
  const PRIO = {
    A: { bg: 'var(--accent-soft)', col: 'var(--accent)', bd: 'var(--accent)', hint: 'hoofddoel' },
    B: { bg: 'var(--warn-soft)', col: 'var(--warn)', bd: 'rgba(245,184,61,0.45)', hint: 'mini-taper' },
    C: { bg: 'var(--bg-elevated)', col: 'var(--text-secondary)', bd: 'var(--border-strong)', hint: 'doortrainen' },
  };

  // keuze-tegels (2 kolommen) — actieve in accent
  function ChoiceGrid({ value, options, onChange }) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {options.map((o) => {
          const on = o.k === value;
          return (
            <button key={o.k} onClick={() => onChange(o.k)} style={{
              textAlign: 'left', padding: '10px 12px', borderRadius: 'var(--r-md)', cursor: 'pointer',
              background: on ? 'var(--accent-soft)' : 'var(--bg-sunken)',
              border: `1px solid ${on ? 'var(--accent)' : 'var(--border-strong)'}`, transition: 'all .15s',
            }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13.5, fontWeight: 600, color: on ? 'var(--accent)' : 'var(--text-primary)' }}>{o.t}</div>
              {o.s && <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{o.s}</div>}
            </button>
          );
        })}
      </div>
    );
  }

  const Trash = () => (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M2.5 4h11M6 4V2.7h4V4M5 4l.6 9.3h4.8L11 4" stroke="var(--text-muted)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  // één event-rij: naam (bewerkbaar) · datum · prioriteit-chip (cyclt) · verwijderen
  function EventRow({ ev, onChange, onDelete, last }) {
    const cyc = { A: 'B', B: 'C', C: 'A' };
    const ps = PRIO[ev.prio];
    return (
      <div style={{ padding: '12px 14px', borderBottom: last ? 'none' : '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input className="field-bare" value={ev.naam} placeholder="Event-naam…"
            onChange={(e) => onChange(ev.id, { naam: e.target.value })}
            style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontSize: 14.5, fontWeight: 600, outline: 'none', padding: 0 }} />
          <button onClick={() => onChange(ev.id, { prio: cyc[ev.prio] })} title={`Prioriteit ${ev.prio} · ${ps.hint}`}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 26, height: 24, padding: '0 9px', borderRadius: 999, border: `1px solid ${ps.bd}`, background: ps.bg, color: ps.col, fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', flexShrink: 0 }}>{ev.prio}</button>
          <button onClick={() => onDelete(ev.id)} aria-label="Verwijder event"
            style={{ width: 28, height: 24, borderRadius: 'var(--r-sm)', border: '1px solid var(--border-strong)', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}><Trash /></button>
        </div>
        <div style={{ marginTop: 8, width: 150 }}>
          <DateField value={ev.datum} onChange={(d) => onChange(ev.id, { datum: d })} />
        </div>
      </div>
    );
  }

  /* ── scherm ── */
  function SettingsScreen({ onBack }) {
    const [ftp, setFtp] = useState(275);
    const [gewicht, setGewicht] = useState(72);
    const [ftpAuto, setFtpAuto] = useState(false);
    const [volume, setVolume] = useState('gevorderd');
    const [doel, setDoel] = useState('ftp');
    const [blokStart, setBlokStart] = useState('2026-06-01');
    const [blokEind, setBlokEind] = useState('2026-08-31');
    const [events, setEvents] = useState([
      { id: 1, naam: 'Girona', datum: '2026-09-12', prio: 'A' },
      { id: 2, naam: 'Gravel-tocht Veluwe', datum: '2026-05-18', prio: 'B' },
    ]);
    const nextId = useRef(3);
    const updateEvent = (id, patch) => setEvents((es) => es.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    const deleteEvent = (id) => setEvents((es) => es.filter((e) => e.id !== id));
    const addEvent = () => setEvents((es) => [...es, { id: nextId.current++, naam: '', datum: '2026-07-01', prio: 'C' }]);
    const [garminPush, setGarminPush] = useState(true);
    const [zondag, setZondag] = useState(true);

    const wkg = (ftp && gewicht) ? (ftp / gewicht).toFixed(1).replace('.', ',') : '—';

    return (
      <div style={{ minHeight: '100%', background: 'var(--bg-app)', paddingBottom: 48 }}>
        {/* sticky top-bar */}
        <div style={{ position: 'sticky', top: 0, zIndex: 5, background: 'var(--bg-app)', borderBottom: '1px solid var(--border-subtle)', padding: '52px 12px 12px', display: 'flex', alignItems: 'center', gap: 4 }}>
          <button onClick={onBack} aria-label="Terug" style={{ width: 36, height: 36, borderRadius: 999, background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <Chevron dir="left" size={16} color="var(--text-secondary)" />
          </button>
          <h1 style={{ margin: '0 0 0 6px', fontFamily: 'var(--font-sans)', fontSize: 19, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Instellingen</h1>
        </div>

        <div style={{ padding: '18px 16px 0' }}>
          {/* 1 · Profiel */}
          <Section title="Profiel">
            <Row label="Naam" right={<ReadValue>Daan Korteweg</ReadValue>} />
            <Row label="FTP" right={<NumberField value={ftp} onChange={setFtp} unit="W" />} />
            <Row label="Gewicht" right={<NumberField value={gewicht} onChange={setGewicht} unit="kg" />} />
            <Row label="W/kg" sub="afgeleid" right={<ReadValue mono>{wkg}</ReadValue>} />
            <Row label="FTP automatisch bijwerken" sub="uit intervals.icu" last right={<Toggle on={ftpAuto} onChange={setFtpAuto} />} />
          </Section>

          {/* 2 · Trainingsprofiel */}
          <Section title="Trainingsprofiel">
            <Row label="Volume-profiel" sub="bepaalt je wekelijkse belasting" last>
              <Select value={volume} options={VOLUMES} onChange={setVolume} />
            </Row>
          </Section>

          {/* 3 · Doel & blok */}
          <Section title="Doel & blok">
            <Row label="Trainingsdoel" sub="huidig blok · ~3 maanden">
              <ChoiceGrid value={doel} options={DOELEN} onChange={setDoel} />
            </Row>
            <Row label="Blok-periode" sub="start → einde" last>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1 }}><DateField value={blokStart} onChange={setBlokStart} /></div>
                <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', fontSize: 15 }}>→</span>
                <div style={{ flex: 1 }}><DateField value={blokEind} onChange={setBlokEind} /></div>
              </div>
            </Row>
          </Section>

          {/* Events */}
          <Section title="Events">
            {events.length === 0 && (
              <div style={{ padding: '18px 14px', textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: 12.5, color: 'var(--text-muted)' }}>Nog geen events — voeg er één toe.</div>
            )}
            {events.map((e) => (
              <EventRow key={e.id} ev={e} onChange={updateEvent} onDelete={deleteEvent} last={false} />
            ))}
            <div style={{ padding: '12px 14px' }}>
              <button onClick={addEvent} style={{
                width: '100%', height: 40, borderRadius: 'var(--r-md)', cursor: 'pointer',
                background: 'transparent', border: '1px dashed var(--border-strong)',
                color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', fontSize: 13.5, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                <span style={{ fontSize: 17, lineHeight: 1, color: 'var(--accent)' }}>+</span> Event toevoegen
              </button>
            </div>
          </Section>

          {/* 4 · Koppelingen */}
          <Section title="Koppelingen">
            <Row label="intervals.icu" right={<Badge>Gekoppeld</Badge>} />
            <Row label="Athlete-ID" right={<ReadValue mono>i142357</ReadValue>} />
            <Row label="API-key" right={<ReadValue mono>••••••••</ReadValue>} />
            <Row label={null} last>
              <Button variant="secondary" full onClick={() => {}}>Opnieuw koppelen</Button>
            </Row>
          </Section>
          <Section>
            <Row label="Garmin" sub="via intervals.icu" right={<ReadValue>Gesynct · 2 min geleden</ReadValue>} />
            <Row label="Workouts naar Garmin pushen" last right={<Toggle on={garminPush} onChange={setGarminPush} />} />
          </Section>

          {/* 5 · Meldingen */}
          <Section title="Meldingen">
            <Row label="Zondag-herinnering" sub="beschikbaarheid invullen" last right={<Toggle on={zondag} onChange={setZondag} />} />
          </Section>

          {/* 6 · Account */}
          <Section title="Account">
            <Row label="E-mailadres" right={<ReadValue>daan.korteweg@gmail.com</ReadValue>} />
            <Row label={null} last>
              <Button variant="destructive" full onClick={() => {}}>Uitloggen</Button>
            </Row>
          </Section>

          <div style={{ textAlign: 'center', fontFamily: 'var(--font-num)', fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
            FTP Coach · v1.4.0 (build 238)
          </div>
        </div>
      </div>
    );
  }

  Object.assign(window, { SettingsScreen });
})();

```


////////////////////////////////////////////////////////////////
// FILE: trainingen.jsx
////////////////////////////////////////////////////////////////

```jsx
// trainingen.jsx — Trainingen-tab: categorie-overzicht → varianten → workout-detail
// Export to window: TrainingenTab
(function () {
  const { useState } = React;
  const { WORKOUT_CATS, CategoryCard, VariantRow, WorkoutDetail, DurationSlider, buildWorkout } = window;

  const Over = ({ children, style }) => (
    <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', ...style }}>{children}</div>
  );
  const BackBar = ({ title, sub, onBack }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
      <button onClick={onBack} aria-label="Terug" style={{ width: 32, height: 32, borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
        {sub && <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11.5, color: 'var(--text-muted)' }}>{sub}</div>}
      </div>
    </div>
  );

  function TrainingenTab() {
    const [view, setView] = useState('cats');
    const [cat, setCat] = useState(null);
    const [variant, setVariant] = useState(null);
    const [target, setTarget] = useState(75);

    if (view === 'workout' && variant && cat) {
      const wo = buildWorkout(variant, target);
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <BackBar title={cat.naam} sub="Workout-detail" onBack={() => setView('category')} />
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-lg)', padding: '14px 14px' }}>
            <DurationSlider value={target} onChange={setTarget} />
          </div>
          <WorkoutDetail wo={wo} overline="Workout" onAction={() => {}} actionLabel="Inplannen" />
        </div>
      );
    }

    if (view === 'category' && cat) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <BackBar title={cat.naam} sub={cat.desc} onBack={() => setView('cats')} />
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-lg)', padding: '14px 14px' }}>
            <DurationSlider value={target} onChange={setTarget} />
          </div>
          <Over>Varianten</Over>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {cat.variants.map((v) => (
              <VariantRow key={v.id} wo={buildWorkout(v, target)} onClick={() => { setVariant(v); setView('workout'); }} />
            ))}
          </div>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Over style={{ marginBottom: 2 }}>Bibliotheek · per categorie</Over>
        {WORKOUT_CATS.map((c) => (
          <CategoryCard key={c.key} cat={c} onClick={() => { setCat(c); setTarget(c.def); setView('category'); }} />
        ))}
      </div>
    );
  }

  Object.assign(window, { TrainingenTab });
})();

```


////////////////////////////////////////////////////////////////
// FILE: app.jsx
////////////////////////////////////////////////////////////////

```jsx
// app.jsx — FTP Coach · hoofdscherm (status-deck + vorm-tab)
const { useState, useEffect, useRef } = React;

/* ───────── kleine bouwstenen ───────── */
function Overline({ children, color = 'var(--text-muted)', style }) {
  return (
    <div style={{
      fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', fontWeight: 600,
      letterSpacing: 'var(--tracking-overline)', textTransform: 'uppercase',
      color, ...style,
    }}>{children}</div>
  );
}
function Num({ children, size = 'var(--fs-num-md)', weight = 600, color = 'var(--text-primary)', style }) {
  return (
    <span style={{
      fontFamily: 'var(--font-num)', fontVariantNumeric: 'tabular-nums',
      fontSize: size, fontWeight: weight, color, letterSpacing: '-0.01em',
      lineHeight: 1, ...style,
    }}>{children}</span>
  );
}
function Chip({ children, color = 'var(--text-secondary)', bg = 'var(--bg-elevated)', dot }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: bg, color, border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--r-pill)', padding: '4px 9px',
      fontFamily: 'var(--font-sans)', fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: 999, background: dot, flexShrink: 0 }} />}
      {children}
    </span>
  );
}


/* ───────── kaart 1: ring + verdict + waarom + check-in ───────── */
function Seg({ label, value, options, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ width: 50, flexShrink: 0, fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
      <div style={{ flex: 1, display: 'flex', gap: 4, background: 'var(--bg-sunken)', borderRadius: 'var(--r-pill)', padding: 3 }}>
        {options.map((o) => (
          <button key={o} onClick={() => onChange(o)} style={{
            flex: 1, border: 'none', cursor: 'pointer', borderRadius: 'var(--r-pill)', padding: '6px 0',
            fontFamily: 'var(--font-sans)', fontSize: 11.5, fontWeight: 600, textTransform: 'capitalize',
            background: value === o ? 'var(--bg-elevated)' : 'transparent',
            color: value === o ? 'var(--text-primary)' : 'var(--text-muted)',
            boxShadow: value === o ? '0 1px 3px rgba(0,0,0,0.4)' : 'none', transition: 'all .12s',
          }}>{o}</button>
        ))}
      </div>
    </div>
  );
}
function ReadinessCard() {
  const [whyOpen, setWhyOpen] = useState(false);
  const [checkin, setCheckin] = useState(null);
  const [draft, setDraft] = useState({ slaap: null, benen: null, stress: null });
  const adj = checkin
    ? ((checkin.slaap === 'goed' ? 0 : checkin.slaap === 'matig' ? -4 : -10)
      + (checkin.benen === 'fris' ? 3 : checkin.benen === 'normaal' ? 0 : -8)
      + (checkin.stress === 'laag' ? 2 : checkin.stress === 'normaal' ? 0 : -6))
    : 0;
  const val = Math.max(0, Math.min(100, 82 + adj));
  const rc = val >= 62 ? 'var(--good)' : val >= 48 ? 'var(--warn)' : 'var(--bad)';
  const verdict = val >= 78 ? 'Klaar om te trainen' : val >= 62 ? 'Goed — normaal trainen' : val >= 48 ? 'Let op — tandje terug' : 'Herstel aanbevolen';
  const effect = checkin
    ? (checkin.benen === 'zwaar' ? 'Benen zwaar → vandaag een tandje terug.'
      : checkin.slaap === 'slecht' ? 'Slecht geslapen → houd het rustig vandaag.'
      : checkin.stress === 'hoog' ? 'Hoge stress → kies een beheersbare sessie.'
      : (checkin.benen === 'fris' && checkin.slaap === 'goed') ? 'Top hersteld → ruimte voor een stevige sessie.'
      : 'Niks bijzonders → volg gewoon je plan.')
    : null;
  const slaapF = checkin
    ? (checkin.slaap === 'goed' ? { v: 'Goed — uitgerust', s: 'pos' } : checkin.slaap === 'matig' ? { v: 'Matig', s: 'neutral' } : { v: 'Slecht — let op', s: 'warn' })
    : { v: 'Vul je check-in in', s: 'neutral' };
  const factors = [
    { l: 'Vorm-trend', v: '+7 — fris', s: 'pos' },
    { l: 'HRV vs baseline', v: '48 — iets onder baseline', s: 'neutral' },
    { l: 'Recente belasting', v: 'Laag — ruimte voor intensiteit', s: 'pos' },
    { l: 'Slaap', v: slaapF.v, s: slaapF.s },
  ];
  const sdot = (s) => (s === 'pos' ? 'var(--good)' : s === 'warn' ? 'var(--warn)' : 'var(--text-muted)');
  const ready = draft.slaap && draft.benen && draft.stress;
  return (
    <div className="deck-card">
      <Overline>Status · vandaag</Overline>
      <div role="button" onClick={() => setWhyOpen((v) => !v)} style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 14, cursor: 'pointer' }}>
        <ProgressRing value={val} size={118} stroke={10} color={rc}>
          <Num size="34px" weight={600}>{val}</Num>
          <div style={{ marginTop: 3 }}><Overline color="var(--text-muted)" style={{ fontSize: 9 }}>Gereed</Overline></div>
        </ProgressRing>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 19, fontWeight: 600, lineHeight: 1.2, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{verdict}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            <Chip color="var(--fresh)" bg="var(--fresh-soft)" dot="var(--fresh)">Vorm +7</Chip>
            <Chip dot="var(--text-muted)">HRV 48</Chip>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 10, fontFamily: 'var(--font-sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)' }}>
            Waarom dit cijfer?
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none" style={{ transform: whyOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}><path d="M3 5l4 4 4-4" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
        </div>
      </div>

      {whyOpen && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 9, background: 'var(--bg-sunken)', borderRadius: 'var(--r-md)', padding: 12 }}>
          {factors.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: sdot(f.s), flexShrink: 0 }} />
              <span style={{ width: 116, flexShrink: 0, fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-secondary)' }}>{f.l}</span>
              <span style={{ flex: 1, fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-primary)', textAlign: 'right' }}>{f.v}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 14, borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
        {!checkin ? (
          <div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>Hoe voel je je vanochtend?</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              <Seg label="Slaap" value={draft.slaap} options={['goed', 'matig', 'slecht']} onChange={(v) => setDraft((d) => ({ ...d, slaap: v }))} />
              <Seg label="Benen" value={draft.benen} options={['fris', 'normaal', 'zwaar']} onChange={(v) => setDraft((d) => ({ ...d, benen: v }))} />
              <Seg label="Stress" value={draft.stress} options={['laag', 'normaal', 'hoog']} onChange={(v) => setDraft((d) => ({ ...d, stress: v }))} />
            </div>
            <button disabled={!ready} onClick={() => setCheckin(draft)} style={{ marginTop: 12, width: '100%', height: 40, borderRadius: 'var(--r-md)', border: 'none', cursor: ready ? 'pointer' : 'default', background: ready ? 'var(--accent-grad)' : 'var(--bg-elevated)', color: ready ? '#fff' : 'var(--text-muted)', fontFamily: 'var(--font-sans)', fontSize: 13.5, fontWeight: 600 }}>Vastleggen</button>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Overline>Ochtend-check-in</Overline>
              <button onClick={() => setCheckin(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--accent)' }}>wijzig</button>
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 5 }}>Slaap {checkin.slaap} · benen {checkin.benen} · stress {checkin.stress}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, background: 'var(--accent-soft)', border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)', borderRadius: 'var(--r-md)', padding: '9px 12px' }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M8 1.5l1.8 3.9 4.2.5-3.1 2.9.8 4.2L8 11.4 4.3 13l.8-4.2L2 5.9l4.2-.5L8 1.5z" stroke="var(--accent)" strokeWidth="1.2" strokeLinejoin="round" /></svg>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{effect}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────── kaart 2: niveau-blok ───────── */
function LevelCard() {
  return (
    <div className="deck-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Overline>Niveau</Overline>
        <Chip color="var(--accent)" bg="var(--accent-soft)" dot="var(--accent)">Gevorderd</Chip>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <Num size="52px" weight={600} color="var(--text-primary)">28</Num>
          <Num size="18px" weight={500} color="var(--text-muted)">/ 50</Num>
        </div>
        <div style={{ paddingBottom: 4 }}>
          <Num size="20px" weight={600} color="var(--text-primary)">3,8</Num>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-secondary)', marginLeft: 4 }}>W/kg</span>
        </div>
      </div>

      {/* voortgang in blok */}
      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-secondary)' }}>92% van je blok behaald</span>
          <Num size="11px" weight={600} color="var(--good)" style={{ fontFamily: 'var(--font-num)' }}>+4,5 ↑ sinds jun '24</Num>
        </div>
        <div style={{ height: 6, borderRadius: 999, background: 'var(--bg-sunken)', overflow: 'hidden' }}>
          <div className="grow-bar" style={{ height: '100%', width: '92%', borderRadius: 999, background: 'var(--accent-grad)' }} />
        </div>
      </div>
    </div>
  );
}

/* ───────── status-deck (swipe + dots) ───────── */
function StatusDeck() {
  const scrollRef = useRef(null);
  const [idx, setIdx] = useState(0);
  const onScroll = () => {
    const el = scrollRef.current; if (!el) return;
    const cards = el.querySelectorAll('.deck-card');
    if (cards.length < 2) return;
    const step = cards[1].offsetLeft - cards[0].offsetLeft;
    setIdx(Math.round(el.scrollLeft / step));
  };
  const go = (i) => {
    const el = scrollRef.current; const cards = el.querySelectorAll('.deck-card');
    const step = cards[1].offsetLeft - cards[0].offsetLeft;
    el.scrollTo({ left: step * i, behavior: 'smooth' });
  };
  return (
    <div>
      <div ref={scrollRef} className="deck" onScroll={onScroll}>
        <ReadinessCard />
        <LevelCard />
      </div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 12 }}>
        {[0, 1].map((i) => (
          <button key={i} onClick={() => go(i)} aria-label={`kaart ${i + 1}`} style={{
            width: i === idx ? 18 : 6, height: 6, borderRadius: 999, border: 'none', padding: 0,
            cursor: 'pointer', transition: 'all .25s ease',
            background: i === idx ? 'var(--accent)' : 'var(--border-strong)',
          }} />
        ))}
      </div>
    </div>
  );
}

/* ───────── metric-rij ───────── */
function MetricRow({ empty }) {
  const items = [
    { v: '275', u: 'W', l: 'FTP' },
    { v: '72', u: 'kg', l: 'Gewicht' },
    { v: '480', u: 'TSS', l: 'Week' },
  ];
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
      background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--r-lg)', overflow: 'hidden',
    }}>
      {items.map((m, i) => (
        <div key={m.l} style={{
          padding: '14px 12px', textAlign: 'center',
          borderLeft: i ? '1px solid var(--border-subtle)' : 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 3 }}>
            <Num size="22px" weight={600} color={empty ? 'var(--text-muted)' : 'var(--text-primary)'}>{empty ? '—' : m.v}</Num>
            {!empty && <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--text-muted)' }}>{m.u}</span>}
          </div>
          <Overline style={{ marginTop: 6, fontSize: 10 }}>{m.l}</Overline>
        </div>
      ))}
    </div>
  );
}

/* ───────── vorm-tab ───────── */
function VormTab({ conditie, dataState, setDataState, onOpenSettings }) {
  const ConditieView = conditie === 'pmc' ? ConditiePMC
    : conditie === 'driehoek' ? ConditieDriehoek : ConditieBalans;
  const [range, setRange] = useState('all');
  const ranges = [['1m', '1M'], ['6m', '6M'], ['12m', '12M'], ['all', 'Alles']];
  const series = window.sliceNiveau(range);
  const current = series[series.length - 1].v;
  const delta = current - series[0].v;
  const up = delta >= 0;
  const fmt = (n) => Math.abs(n).toFixed(1).replace('.', ',');
  if (dataState === 'niet verbonden') return <ConnectState onConnect={onOpenSettings} />;
  const first = dataState === 'eerste keer';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {dataState === 'sync mislukt' && <SyncBanner onRetry={() => setDataState('normaal')} />}
      {/* lijngrafiek-kaart */}
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--r-lg)', padding: '16px 14px 10px',
      }}>
        <div style={{ padding: '0 2px' }}>
          <Overline>Niveau over tijd</Overline>
          {first ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginTop: 5 }}>
              <Num size="26px" weight={600} color="var(--text-muted)">—</Num>
            </div>
          ) : (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginTop: 5 }}>
            <Num size="26px" weight={600}>{fmt(current)}</Num>
            <Num size="12px" weight={600} color={up ? 'var(--good)' : 'var(--bad)'} style={{ fontFamily: 'var(--font-num)' }}>
              {delta === 0 ? '±0,0' : `${up ? '+' : '−'}${fmt(delta)} ${up ? '↑' : '↓'}`}
            </Num>
          </div>
          )}
        </div>
        {!first && (
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-sunken)', borderRadius: 'var(--r-pill)', padding: 3, marginTop: 12 }}>
          {ranges.map(([k, lbl]) => (
            <button key={k} onClick={() => setRange(k)} style={{
              flex: 1, border: 'none', cursor: 'pointer', borderRadius: 'var(--r-pill)',
              padding: '6px 0', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600,
              background: range === k ? 'var(--bg-elevated)' : 'transparent',
              color: range === k ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: range === k ? '0 1px 3px rgba(0,0,0,0.4)' : 'none', transition: 'all .15s',
            }}>{lbl}</button>
          ))}
        </div>
        )}
        <div style={{ marginTop: 12 }}>{first ? <EmptyChart /> : <NiveauChart range={range} />}</div>
      </div>

      <MetricRow empty={first} />

      {/* conditie-balans */}
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--r-lg)', padding: '14px 14px 16px',
      }}>
        <Overline>Conditie-balans</Overline>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>vorm = fitheid − vermoeidheid</div>
        {first
          ? <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 8px', lineHeight: 1.5 }}>Je conditie-balans bouwt op zodra je ritten binnenkomen.</div>
          : <ConditieView />}
      </div>
    </div>
  );
}

/* ───────── tabs onder de deck ───────── */
function SectionTabs({ tab, setTab }) {
  const tabs = [['vorm', 'Vorm'], ['schema', 'Schema'], ['trainingen', 'Trainingen'], ['niveau', 'Niveau']];
  return (
    <div style={{ display: 'flex', gap: 17, borderBottom: '1px solid var(--border-subtle)', padding: '0 2px' }}>
      {tabs.map(([k, lbl]) => (
        <button key={k} onClick={() => setTab(k)} style={{
          border: 'none', background: 'none', cursor: 'pointer', padding: '0 0 11px',
          fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 600,
          color: tab === k ? 'var(--text-primary)' : 'var(--text-muted)',
          borderBottom: tab === k ? '2px solid var(--accent)' : '2px solid transparent',
          marginBottom: -1, transition: 'color .15s',
        }}>{lbl}</button>
      ))}
    </div>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [tab, setTab] = useState('vorm');
  const [screen, setScreen] = useState('home');
  const [dataState, setDataState] = useState('normaal');
  useEffect(() => { setDataState(t.data || 'normaal'); }, [t.data]);

  // accent-tweak → CSS-variabelen
  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--accent', t.accent[0]);
    r.style.setProperty('--accent-strong', t.accent[1]);
    r.style.setProperty('--accent-soft', t.accent[0].replace('rgb', 'rgba').length ? hexA(t.accent[0], 0.14) : t.accent[0]);
    r.style.setProperty('--accent-grad', `linear-gradient(135deg, ${t.accent[0]} 0%, ${t.accent[1]} 100%)`);
  }, [t.accent]);

  return (
    <IOSDevice dark width={390} height={844}>
      <div style={{ height: '100%', position: 'relative', overflow: 'hidden', background: 'var(--bg-app)' }}>

        {/* ── HOME ── */}
        <div className="screen" style={{
          transform: screen === 'settings' ? 'translateX(-22%)' : 'translateX(0)',
          filter: screen === 'settings' ? 'brightness(0.5)' : 'none',
          pointerEvents: screen === 'settings' ? 'none' : 'auto',
        }}>
          <div className="app" style={{ background: 'var(--bg-app)', minHeight: '100%', paddingBottom: 40 }}>
            <header style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '52px 18px 14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ width: 9, height: 18, borderRadius: 2, background: 'var(--accent-grad)', display: 'inline-block', transform: 'skewX(-12deg)' }} />
                <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 16, letterSpacing: '0.02em', color: 'var(--text-primary)' }}>FTP&nbsp;COACH</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontFamily: 'var(--font-num)', fontSize: 12, color: 'var(--text-muted)' }}>Week 23</span>
                <button onClick={() => setScreen('settings')} aria-label="Instellingen" style={{
                  width: 32, height: 32, borderRadius: 999, background: 'var(--bg-elevated)',
                  border: '1.5px solid var(--accent)', boxShadow: '0 0 0 3px var(--accent-soft)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: 'pointer',
                  fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)',
                }}>DK</button>
              </div>
            </header>

            <main style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
              <StatusDeck />

              <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                <SectionTabs tab={tab} setTab={setTab} />
                {tab === 'vorm'
                  ? <VormTab conditie={t.conditie} dataState={dataState} setDataState={setDataState} onOpenSettings={() => setScreen('settings')} />
                  : tab === 'schema'
                    ? <SchemaTab dataState={dataState} setDataState={setDataState} onOpenSettings={() => setScreen('settings')} />
                    : tab === 'trainingen'
                      ? <TrainingenTab />
                      : <div style={{ padding: '38px 16px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', fontSize: 13, background: 'var(--bg-surface)', border: '1px dashed var(--border-strong)', borderRadius: 'var(--r-lg)' }}>
                          Niveau-detail — volgende iteratie
                        </div>}
              </div>
            </main>
          </div>
        </div>

        {/* ── INSTELLINGEN ── */}
        <div className="screen" style={{
          transform: screen === 'settings' ? 'translateX(0)' : 'translateX(100%)',
          boxShadow: screen === 'settings' ? '-10px 0 34px rgba(0,0,0,0.55)' : 'none',
        }}>
          <SettingsScreen onBack={() => setScreen('home')} />
        </div>

      </div>

      <TweaksPanel>
        <TweakSection label="Accent" />
        <TweakColor label="Accentkleur" value={t.accent}
          options={[['#FF5A1F', '#FF3526'], ['#FF8A00', '#FF5400'], ['#FF3D6E', '#E11D48'], ['#27C2A0', '#0E9F8C']]}
          onChange={(v) => setTweak('accent', v)} />
        <TweakSection label="Conditie-balans" />
        <TweakRadio label="Visualisatie" value={t.conditie}
          options={['balans', 'driehoek', 'pmc']}
          onChange={(v) => setTweak('conditie', v)} />
        <TweakSection label="Weergave" />
        <TweakRadio label="Sectie" value={tab} options={['vorm', 'schema', 'trainingen', 'niveau']} onChange={setTab} />
        <TweakSection label="Data-staat" />
        <TweakSelect label="Scenario" value={t.data || 'normaal'}
          options={['normaal', 'niet verbonden', 'sync mislukt', 'lege week', 'eerste keer']}
          onChange={(v) => setTweak('data', v)} />
      </TweaksPanel>
    </IOSDevice>
  );
}

function hexA(hex, a) {
  const n = hex.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": ["#FF5A1F", "#FF3526"],
  "conditie": "balans",
  "data": "normaal"
}/*EDITMODE-END*/;

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

```


////////////////////////////////////////////////////////////////
// FILE: FTP Coach — Hoofdscherm.html
////////////////////////////////////////////////////////////////

```html
/* kon niet lezen: Error: invalid path "FTP Coach — Hoofdscherm.html": disallowed characters */
```


////////////////////////////////////////////////////////////////
// COMPONENT-INVENTARIS  (herbruikbaar + token-afhankelijkheden)
////////////////////////////////////////////////////////////////

PRIMITIEVEN (tekst/getallen)
- Overline  — caps-label.        tokens: --font-sans, --fs-caption, --text-muted, --tracking-overline
- Num       — tabular getal.      tokens: --font-num
- Chip      — pill-label+stip.    tokens: --r-pill, --bg-elevated, --border-subtle, --font-sans

KAARTEN / LAYOUT
- deck-card / surface-card        tokens: --bg-surface, --border-subtle, --r-lg, --shadow-card
- MetricRow (app.jsx)             tokens: --bg-surface, --border-subtle, --font-num ; prop: empty → "—"
- Card-rij / sectie (settings)    tokens: --bg-surface, --border-subtle, --r-lg

DATA-VIZ
- ProgressRing (chart.jsx)        tokens: stroke=--good/--warn/--bad/--fresh, track rgba ; props: value,size,stroke,color
- NiveauChart (chart.jsx)         tokens: --chart-line,--chart-fill,--chart-grid,--chart-axis,--text-secondary,--accent,--font-num
- ZoneBar / MiniZoneBar (workout) tokens: --zone-1..6, --chart-grid
- ZoneLegend (workout)            tokens: --zone-1..6, --text-secondary
- Conditie-balans/driehoek/PMC    tokens: --good,--fresh,--warn,--bad(+ -soft), --zone-*, --bg-elevated
- PeriodTimeline (schema)         tokens: --accent(+grad,-soft), color-mix(--accent,…), --bg-elevated/-sunken
- WeekLoad (schema)               tokens: --accent-grad, --bg-sunken, --good, --warn(+ -soft), .gm-spin

WORKOUT-COMPONENTEN (workout.jsx)
- BlockList                       tokens: --zone-*, --bg-sunken, --border-subtle, --r-md ; helper: watt()/FTP
- WorkoutDetail                   componeert ZoneBar+ZoneLegend+BlockList+ZoneBadge ; tokens: --accent-grad,--btn-*
- CategoryCard                    tokens: --zone-* via color-mix, --bg-surface, --border-subtle, --r-lg
- VariantRow                      componeert MiniZoneBar + PlanBadge ; tokens: --bg-surface, --font-num
- PlanBadge ("In je blok"/"Buiten plan")  tokens: --accent-soft/--accent of --bg-elevated/--text-muted
- ZoneBadge                       tokens: --zone-N via color-mix
- DurationSlider                  tokens: accentColor=--accent, --font-num
- WorkoutPicker                   componeert CategoryCard+VariantRow+DurationSlider (+ vrije/groepsrit-form)

FORM-CONTROLS
- Toggle (schema.jsx/settings.jsx) tokens: aan=--accent, uit=--toggle-track-off, thumb=--toggle-thumb
- Segmented control (Seg / Select) tokens: --segment-track-bg,--segment-active-bg,--segment-active-text,--segment-text,--r-pill
- TextField / NumberField          tokens: --field-bg,--field-border,--field-border-focus(=--accent),--field-text,--field-height,--field-radius
- DateField                        erft --field-* + color-scheme:dark
- Knoppen                          tokens: primair=--btn-primary-bg(=--accent-grad), secundair=--btn-secondary-*, destructief=--btn-destructive-*

DOMEIN-COMPONENTEN (schema.jsx)
- RpeRating (leeg/gekozen/bevestigd) tokens: --accent(+grad,-soft), --bg-sunken, --font-num
- GarminSync (idle/busy/sent/stale/error) tokens: --good-soft,--warn-soft,--bad-soft,--accent-grad,.gm-spin
- AvailabilityEditor + DayControls   componeert Toggle + slider ; tokens: --field-*, --accent
- DayStrip-chip                      tokens: --accent(+soft), --zone-* (stip), --bg-surface, --border-subtle

RAND/LEGE STATEN (workout.jsx)
- ConnectState   tokens: --accent-grad (CTA), --bad (slash), --bg-sunken
- SyncBanner     tokens: --bad(+ -soft), --r-md, .gm-spin
- EmptyState     tokens: --border-strong (dashed), --bg-surface, --bg-elevated
- EmptyChart     tokens: --bg-sunken, --border-strong (dashed), --text-muted

FRAME / INFRA (starters)
- IOSDevice (ios-frame.jsx)  — telefoon-bezel + statusbar + home-indicator (dark)
- TweaksPanel (tweaks-panel.jsx) — in-design tweaks (accent, conditie-stijl, sectie, data-staat)
