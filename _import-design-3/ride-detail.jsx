// ride-detail.jsx — FTP Coach · rit-detail / activiteit-statistieken (overlay-sheet)
// Opent vanuit een tik op een gereden rit. States: loaded · loading · error.
const { useState } = React;

/* ───────── primitieven (zelfde taal als de rest van de app) ───────── */
const ZNAME = { 1: 'Herstel', 2: 'Duur', 3: 'Tempo', 4: 'Drempel', 5: 'VO2max', 6: 'Anaeroob' };
const Num = ({ children, size = 22, weight = 600, color = 'var(--text-primary)', style }) => (
  <span style={{ fontFamily: 'var(--font-num)', fontVariantNumeric: 'tabular-nums', fontSize: size, fontWeight: weight, color, lineHeight: 1, letterSpacing: '-0.01em', ...style }}>{children}</span>
);
const Over = ({ children, color = 'var(--ride-section-label)', style }) => (
  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color, ...style }}>{children}</div>
);

/* ───────── realistische rit-data (uit de referentie) ───────── */
const RIDE = {
  klasse: 'Drempel', klasseZone: 4,
  datum: 'do 4 jun 2026', tijd: '19:22',
  afstand: '29,4', duur: '0:58:32',
  np: 242, avg: 211, vi: '1,14', if: '0,88', tss: 76,
  weight: 70, wkg: '3,0',
  hrAvg: 155, hrMax: 187, cad: 85, climb: 95, work: 744, kcal: 832, ftp: 275,
  // tijd-in-zone (aandeel %, telt op tot 100)
  tiz: [{ z: 1, pct: 5 }, { z: 2, pct: 50 }, { z: 3, pct: 9 }, { z: 4, pct: 26 }, { z: 5, pct: 10 }],
  intervals: [
    { label: 'Warming-up', rest: true, dur: '10:03', w: 170, hr: 134, z: 2, pct: 61 },
    { label: 'Interval 1', dur: '8:03', w: 285, hr: 173, z: 4, pct: 103 },
    { label: 'Herstel', rest: true, dur: '3:00', w: 145, hr: 150, z: 1, pct: 53 },
    { label: 'Interval 2', dur: '5:28', w: 308, hr: 177, z: 5, pct: 112 },
    { label: 'Herstel', rest: true, dur: '3:00', w: 150, hr: 148, z: 2, pct: 55 },
    { label: 'Interval 3', dur: '7:40', w: 287, hr: 176, z: 4, pct: 104 },
    { label: 'Cooling-down', rest: true, dur: '17:08', w: 156, hr: 140, z: 2, pct: 56 },
  ],
};

/* ───────── tijd-in-zone-balk ───────── */
function TimeInZoneBar({ tiz }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', gap: 'var(--tiz-gap)', height: 12, borderRadius: 999, overflow: 'hidden', background: 'var(--tiz-track)' }}>
        {tiz.map((s, i) => (
          <div key={i} style={{ flex: s.pct, background: `var(--zone-${s.z})` }} title={`Z${s.z} · ${s.pct}%`} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginTop: 10 }}>
        {tiz.map((s, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: `var(--zone-${s.z})` }} />
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11.5, color: 'var(--tiz-legend-text)' }}>Z{s.z}</span>
            <Num size={11.5} weight={500} color="var(--text-muted)">{s.pct}%</Num>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ───────── metric-tegel ───────── */
function Metric({ label, value, unit, sub, accent }) {
  return (
    <div style={{ background: 'var(--ride-metric-tile-bg)', border: '1px solid var(--ride-divider)', borderRadius: 'var(--r-md)', padding: '11px 12px' }}>
      <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ride-metric-label)' }}>{label}</div>
      <div style={{ marginTop: 7, display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <Num size={20} color={accent ? 'var(--ride-hero-accent)' : 'var(--ride-metric-value)'}>{value}</Num>
        {unit && <span style={{ fontFamily: 'var(--font-num)', fontSize: 12, fontWeight: 500, color: 'var(--ride-metric-unit)' }}>{unit}</span>}
        {sub && <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', marginLeft: 'auto' }}>{sub}</span>}
      </div>
    </div>
  );
}

/* ───────── interval-rij ───────── */
function IntervalRow({ it }) {
  const zc = `var(--zone-${it.z})`;
  return (
    <div style={{ display: 'flex', background: it.rest ? 'var(--interval-rest-bg)' : 'var(--interval-row-bg)', border: '1px solid var(--ride-divider)', borderRadius: 'var(--r-sm)', overflow: 'hidden' }}>
      <div style={{ width: 'var(--interval-stripe-w)', flexShrink: 0, background: zc }} />
      <div style={{ flex: 1, minWidth: 0, padding: '11px 13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13.5, fontWeight: 600, color: 'var(--interval-label)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.label}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 999, flexShrink: 0, background: `color-mix(in srgb, ${zc} 18%, transparent)`, border: `1px solid color-mix(in srgb, ${zc} 45%, transparent)` }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 700, color: zc }}>Z{it.z}</span>
            </span>
          </div>
          <div style={{ marginTop: 5, fontFamily: 'var(--font-sans)', fontSize: 11.5, color: 'var(--interval-sub)', display: 'flex', alignItems: 'center', gap: 7 }}>
            <Num size={11.5} weight={500} color="var(--interval-sub)">{it.dur}</Num>
            <span style={{ opacity: 0.5 }}>·</span>
            <Num size={11.5} weight={500} color="var(--interval-sub)">{it.hr}</Num><span>bpm</span>
            <span style={{ opacity: 0.5 }}>·</span>
            <Num size={11.5} weight={500} color={zc}>{it.pct}%</Num><span>FTP</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, flexShrink: 0 }}>
          <Num size={21} color="var(--interval-power)">{it.w}</Num>
          <span style={{ fontFamily: 'var(--font-num)', fontSize: 12, fontWeight: 500, color: 'var(--interval-power-unit)' }}>w</span>
        </div>
      </div>
    </div>
  );
}

/* ───────── sheet-shell ───────── */
function Sheet({ children }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--scrim)', display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ width: '100%', height: '92%', background: 'var(--sheet-bg)', borderTopLeftRadius: 'var(--sheet-radius)', borderTopRightRadius: 'var(--sheet-radius)', borderTop: '1px solid var(--border-subtle)', boxShadow: 'var(--sheet-shadow)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* greep + sluiten */}
        <div style={{ position: 'relative', paddingTop: 10, flexShrink: 0 }}>
          <div style={{ width: 38, height: 4, borderRadius: 999, background: 'var(--sheet-handle)', margin: '0 auto' }} />
          <button aria-label="Sluiten" style={{ position: 'absolute', top: 8, right: 14, width: 30, height: 30, borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--bg-elevated)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="var(--text-secondary)" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 28px' }}>{children}</div>
      </div>
    </div>
  );
}

/* ════════════════ STAAT: GELADEN ════════════════ */
function RideLoaded() {
  const r = RIDE;
  const zc = `var(--zone-${r.klasseZone})`;
  return (
    <Sheet>
      {/* kop */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 'var(--r-pill)', background: `color-mix(in srgb, ${zc} 18%, transparent)`, border: `1px solid color-mix(in srgb, ${zc} 45%, transparent)` }}>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: zc }} />
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, color: zc }}>{r.klasse}</span>
        </span>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, color: 'var(--text-muted)' }}>{r.datum} · {r.tijd}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <Num size={30} color="var(--text-primary)">{r.afstand}</Num>
          <span style={{ fontFamily: 'var(--font-num)', fontSize: 14, color: 'var(--text-muted)' }}>km</span>
        </div>
        <div style={{ width: 1, height: 22, background: 'var(--ride-divider)' }} />
        <Num size={30} color="var(--text-primary)">{r.duur}</Num>
      </div>

      {/* tijd-in-zone */}
      <TimeInZoneBar tiz={r.tiz} />

      {/* hero: NP · IF · TSS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', marginTop: 16, background: 'var(--ride-hero-bg)', border: '1px solid var(--ride-divider)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
        {[['NP', r.np, 'w', false], ['IF', r.if, '', false], ['TSS', r.tss, '', true]].map(([l, v, u, acc], i) => (
          <div key={l} style={{ padding: '13px 12px', borderLeft: i ? '1px solid var(--ride-divider)' : 'none' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ride-metric-label)' }}>{l}</div>
            <div style={{ marginTop: 7, display: 'flex', alignItems: 'baseline', gap: 3 }}>
              <Num size={24} color={acc ? 'var(--ride-hero-accent)' : 'var(--ride-hero-value)'}>{v}</Num>
              {u && <span style={{ fontFamily: 'var(--font-num)', fontSize: 12, color: 'var(--ride-metric-unit)' }}>{u}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* metric-grid — rit-nabeschouwing voor een fietser (klim-/Girona-doel) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
        <Metric label="Gem. vermogen" value={r.avg} unit="w" />
        <Metric label="W/kg" value={r.wkg} unit="W/kg" />
        <Metric label="Gem. HR" value={r.hrAvg} unit="bpm" sub={`max ${r.hrMax}`} />
        <Metric label="Hoogtewinst" value={r.climb} unit="m" />
        <Metric label="Cadans" value={r.cad} unit="rpm" />
        <Metric label="Arbeid" value={r.work} unit="kJ" />
      </div>

      {/* intervallen */}
      <div style={{ marginTop: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Over>Intervallen</Over>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11.5, color: 'var(--text-muted)' }}>FTP {r.ftp} w</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 11 }}>
        {r.intervals.map((it, i) => <IntervalRow key={i} it={it} />)}
      </div>

      {/* gereserveerd voor fase 2: vermogenscurve */}
      <div style={{ marginTop: 16, height: 92, borderRadius: 'var(--r-md)', border: '1px dashed var(--border-strong)', background: 'var(--bg-sunken)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11.5, color: 'var(--text-muted)' }}>Vermogenscurve · binnenkort</span>
      </div>
    </Sheet>
  );
}

/* ════════════════ STAAT: LADEN (skeleton) ════════════════ */
function Bar({ w, h = 14, r = 6, mt = 0 }) {
  return <div className="sk" style={{ width: w, height: h, borderRadius: r, marginTop: mt, background: 'var(--skeleton-base)', position: 'relative', overflow: 'hidden' }} />;
}
function RideLoading() {
  return (
    <Sheet>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <Bar w={84} h={22} r={999} />
        <Bar w={140} h={13} />
      </div>
      <Bar w={200} h={30} mt={14} />
      <Bar w="100%" h={12} r={999} mt={18} />
      <Bar w={160} h={12} mt={12} />
      <Bar w="100%" h={58} r={12} mt={18} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
        {Array.from({ length: 6 }).map((_, i) => <Bar key={i} w="100%" h={58} r={12} />)}
      </div>
      <Bar w={110} h={12} mt={22} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
        {Array.from({ length: 5 }).map((_, i) => <Bar key={i} w="100%" h={56} r={9} />)}
      </div>
      <div style={{ position: 'absolute', bottom: 18, left: 0, right: 0, textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-muted)' }}>Statistieken laden…</div>
    </Sheet>
  );
}

/* ════════════════ STAAT: ERROR / GEEN DATA ════════════════ */
function RideError() {
  return (
    <Sheet>
      <div style={{ height: '100%', minHeight: 460, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 24px' }}>
        <div style={{ width: 56, height: 56, borderRadius: 999, background: 'var(--state-icon-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M12 8v5" stroke="var(--state-icon)" strokeWidth="1.8" strokeLinecap="round" /><circle cx="12" cy="16.5" r="1.1" fill="var(--state-icon)" /><path d="M4 6.5C7 4.5 17 4.5 20 6.5" stroke="var(--state-icon)" strokeWidth="1.6" strokeLinecap="round" opacity="0.5" /></svg>
        </div>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 600, color: 'var(--state-title)', marginTop: 16 }}>Statistieken niet beschikbaar</div>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: 1.5, color: 'var(--state-body)', marginTop: 7, maxWidth: 260 }}>De ritdata kon niet bij intervals.icu worden opgehaald. Controleer je verbinding en probeer opnieuw.</div>
        <button style={{ marginTop: 20, height: 'var(--btn-height)', padding: '0 22px', borderRadius: 'var(--btn-radius)', border: '1px solid var(--btn-secondary-border)', background: 'var(--btn-secondary-bg)', color: 'var(--btn-secondary-text)', fontFamily: 'var(--font-sans)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <svg width="15" height="15" viewBox="0 0 14 14" fill="none"><path d="M12 7a5 5 0 11-1.5-3.6" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" /><path d="M12 1.5V4.2H9.3" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Opnieuw proberen
        </button>
      </div>
    </Sheet>
  );
}

/* ───────── frame-wrapper + canvas ───────── */
function Phone({ title, children, bare }) {
  const inner = (
    <div style={{ width: 390, height: 844, background: 'var(--bg-app)', borderRadius: bare ? 0 : 30, overflow: 'hidden', border: bare ? 'none' : '1px solid var(--border-subtle)', position: 'relative' }}>
      {/* dimmend dag-detail eronder (context) */}
      <div style={{ position: 'absolute', inset: 0, padding: '54px 16px', opacity: 0.4 }}>
        <div style={{ height: 150, borderRadius: 16, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }} />
      </div>
      {children}
    </div>
  );
  if (bare) return inner;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ fontFamily: 'var(--font-num)', fontSize: 12.5, color: 'var(--label)', letterSpacing: '0.02em' }}>{title}</div>
      {inner}
    </div>
  );
}

const FRAMES = {
  '11-rit-detail.png': <RideLoaded />,
  '11b-rit-detail-laden.png': <RideLoading />,
  '11c-rit-detail-error.png': <RideError />,
};

function Canvas() {
  const f = typeof window !== 'undefined' && window.__RD_FRAME;
  if (f && FRAMES[f]) return <div style={{ width: 390, height: 844 }}><Phone bare>{FRAMES[f]}</Phone></div>;
  return (
    <div style={{ minHeight: '100vh', background: 'var(--stage)', padding: '40px 32px 64px' }}>
      <div style={{ display: 'flex', gap: 34, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {Object.keys(FRAMES).map((name) => <Phone key={name} title={name}>{FRAMES[name]}</Phone>)}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Canvas />);
