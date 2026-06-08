// coach-feedback.jsx — Schema dag-detail · coach-feedback (3 staten)
// Eén coach-stem: match · afwijking · gemist. Donkere FTP-Coach-skin.
const { useState } = React;

/* ───────── primitieven (zelfde taal als schema.jsx / workout.jsx) ───────── */
const ZNAME = { 1: 'Herstel', 2: 'Duur', 3: 'Tempo', 4: 'Drempel', 5: 'VO2max', 6: 'Anaeroob' };

const Num = ({ children, size = 22, weight = 600, color = 'var(--text-primary)', style }) => (
  <span style={{ fontFamily: 'var(--font-num)', fontVariantNumeric: 'tabular-nums', fontSize: size, fontWeight: weight, color, lineHeight: 1, letterSpacing: '-0.01em', ...style }}>{children}</span>
);
const Over = ({ children, color = 'var(--text-muted)', style }) => (
  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color, ...style }}>{children}</div>
);

/* ───────── zone-vergelijking (gepland vs gedaan, tijd per zone) ─────────
   Vervangt de twee losse gestapelde zone-balken. Eén rij per zone: een
   faded "geplande-omvang"-balk met de massieve "gedaan"-balk eroverheen,
   plus de gepland/gedaan-minuten. De afwijking per zone leest in één
   oogopslag — gedaan voorbij gepland = méér dan gepland · gepland voorbij
   gedaan = te kort · alleen gedaan = niet gepland · alleen gepland =
   overgeslagen. Stijl-idee uit de intervals.icu-tijd-per-zone-balk, maar
   met gepland ÉN gedaan per zone. */
function ZoneCompareRow({ r, scale }) {
  const zc = `var(--zone-${r.z})`;
  const planPct = (r.plan / scale) * 100;
  const donePct = (r.done / scale) * 100;
  const unplanned = r.plan === 0 && r.done > 0;  // gereden, niet gepland
  const skipped = r.plan > 0 && r.done === 0;     // gepland, niet gereden
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '84px 1fr 58px', columnGap: 10, alignItems: 'center' }}>
      {/* zone-label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
        <span style={{ width: 7, height: 7, borderRadius: 2, background: zc, flexShrink: 0 }} />
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--zcompare-label)', flexShrink: 0 }}>Z{r.z}</span>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{ZNAME[r.z]}</span>
      </div>
      {/* overlay-balk: gepland-omvang (faded) + gedaan (massief) */}
      <div style={{ position: 'relative', height: 'var(--zcompare-track-h)', borderRadius: 4, background: 'var(--zcompare-track)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${planPct}%`, background: `color-mix(in srgb, ${zc} var(--zcompare-plan-strength), transparent)`, borderRadius: 4 }} />
        <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', height: 'var(--zcompare-done-h)', width: `${donePct}%`, minWidth: r.done > 0 ? 3 : 0, background: zc, borderRadius: 999 }} />
      </div>
      {/* minuten + status-tag */}
      <div style={{ textAlign: 'right' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 1, justifyContent: 'flex-end' }}>
          <Num size={13.5} weight={600} color={skipped ? 'var(--zcompare-tag-skipped)' : zc}>{r.done}</Num>
          <span style={{ fontFamily: 'var(--font-num)', fontSize: 10.5, color: 'var(--text-muted)' }}>′</span>
        </div>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 9.5, fontWeight: 600, marginTop: 1, lineHeight: 1.2, color: unplanned ? 'var(--zcompare-tag-unplanned)' : skipped ? 'var(--zcompare-tag-skipped)' : 'var(--reading-planned)' }}>
          {unplanned ? 'niet gepland' : skipped ? 'niet gereden' : `gepland ${r.plan}′`}
        </div>
      </div>
    </div>
  );
}
function ZoneCompare({ zones }) {
  const rows = zones.filter((z) => z.plan > 0 || z.done > 0);
  const scale = Math.max(1, ...rows.map((r) => Math.max(r.plan, r.done)));
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 11 }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--reading-col-label)' }}>Zone-vergelijking · min</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 13, height: 7, borderRadius: 2, background: 'color-mix(in srgb, var(--text-secondary) var(--zcompare-plan-strength), transparent)' }} />
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--reading-planned)' }}>gepland</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 13, height: 5, borderRadius: 999, background: 'var(--text-secondary)' }} />
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--reading-done)' }}>gedaan</span>
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {rows.map((r) => <ZoneCompareRow key={r.z} r={r} scale={scale} />)}
      </div>
    </div>
  );
}

/* ───────── coach-merkje (één herkenbare stem) ───────── */
function CoachMark({ size = 22 }) {
  return (
    <span style={{ width: size, height: size, flexShrink: 0, borderRadius: 999, background: 'var(--coach-mark-bg)', border: '1px solid var(--coach-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 16 16" fill="none">
        <path d="M2.5 6.2a3.3 3.3 0 013.3-3.3h4.4a3.3 3.3 0 013.3 3.3v1.1a3.3 3.3 0 01-3.3 3.3H7l-3 2.3v-2.4a3.3 3.3 0 01-1.5-2.8V6.2z" stroke="var(--coach-mark)" strokeWidth="1.3" strokeLinejoin="round" />
        <circle cx="6.3" cy="6.8" r="0.85" fill="var(--coach-mark)" />
        <circle cx="9.7" cy="6.8" r="0.85" fill="var(--coach-mark)" />
      </svg>
    </span>
  );
}

/* ───────── coach-callout: narratief (+ optioneel impact + adaptatie) ───────── */
function CoachCallout({ impact, narrative, adaptation }) {
  return (
    <div style={{
      marginTop: 14, background: 'var(--coach-bg)',
      border: `1px solid ${impact ? 'var(--coach-border-impact)' : 'var(--coach-border)'}`,
      borderRadius: 'var(--r-md)', padding: '12px 13px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <CoachMark />
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--coach-label)' }}>
          {impact ? 'Coach · impact' : 'Coach'}
        </span>
      </div>
      <div style={{ marginTop: 8, fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: 1.5, color: 'var(--coach-text)' }}>{narrative}</div>
      {adaptation && (
        <div style={{ marginTop: 11, paddingTop: 11, borderTop: '1px solid var(--coach-divider)', display: 'flex', gap: 9 }}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
            <path d="M9 3.5h3a1 1 0 011 1V12a1 1 0 01-1 1H4a1 1 0 01-1-1V4.5a1 1 0 011-1h1" stroke="var(--coach-adapt-icon)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M6.5 5.5l2.2-2-2.2-2" stroke="var(--coach-adapt-icon)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--coach-adapt-label)', marginBottom: 3 }}>Aanpassing</div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, lineHeight: 1.5, color: 'var(--coach-text)' }}>{adaptation}</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────── alignment-chip + alignment-balk ───────── */
const ALIGN = {
  'op-plan':   { c: 'var(--align-on-plan)',   s: 'var(--align-on-plan-soft)',   label: 'Op plan' },
  'afgeweken': { c: 'var(--align-deviated)',  s: 'var(--align-deviated-soft)',  label: 'Licht afgeweken' },
  'anders':    { c: 'var(--align-different)', s: 'var(--align-different-soft)', label: 'Anders getraind' },
  'gemist':    { c: 'var(--align-missed)',    s: 'var(--align-missed-soft)',    label: 'Niet gereden' },
};
function AlignChip({ kind }) {
  const a = ALIGN[kind];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 999, padding: '3px 9px', fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, background: a.s, color: a.c, border: `1px solid color-mix(in srgb, ${a.c} 40%, transparent)` }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: a.c }} />{a.label}
    </span>
  );
}
function AlignBar({ pct }) {
  return (
    <div style={{ marginTop: 13 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11.5, color: 'var(--text-secondary)' }}>Uitvoering volgt plan</span>
        <Num size={13} color="var(--align-on-plan)">{pct}%</Num>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: 'var(--reading-track)', marginTop: 7, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: 'var(--align-on-plan)' }} />
      </div>
    </div>
  );
}

/* ───────── gepland-vs-gedaan-lezing (twee kolommen + zone-balken) ───────── */
function Reading({ planType, doneType, deviate, rows, zones }) {
  return (
    <div style={{ marginTop: 14, background: 'var(--reading-track)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-md)', padding: '13px' }}>
      {/* kolom-kop */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr minmax(56px,auto) minmax(56px,auto)', columnGap: 16, alignItems: 'baseline' }}>
        <span />
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--reading-col-label)', textAlign: 'right' }}>Gepland</span>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--reading-col-label)', textAlign: 'right' }}>Gedaan</span>
      </div>
      {/* type-rij */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr minmax(56px,auto) minmax(56px,auto)', columnGap: 16, alignItems: 'center', padding: '9px 0 10px', borderBottom: '1px solid var(--reading-divider)' }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, color: 'var(--text-secondary)' }}>Type</span>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--reading-planned)', textAlign: 'right' }}>{planType}</span>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 700, color: deviate ? 'var(--align-different)' : 'var(--reading-done)', textAlign: 'right' }}>{doneType}</span>
      </div>
      {/* metric-rijen */}
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr minmax(56px,auto) minmax(56px,auto)', columnGap: 16, alignItems: 'center', padding: '8px 0', borderBottom: i < rows.length - 1 ? '1px solid var(--reading-divider)' : 'none' }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, color: 'var(--text-secondary)' }}>{r.k}</span>
          <Num size={14} weight={500} color="var(--reading-planned)" style={{ textAlign: 'right', display: 'block' }}>{r.p}</Num>
          <Num size={14} weight={600} color="var(--reading-done)" style={{ textAlign: 'right', display: 'block' }}>{r.d}</Num>
        </div>
      ))}
      {/* zone-vergelijking — gepland vs gedaan, tijd per zone */}
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--reading-divider)' }}>
        <ZoneCompare zones={zones} />
      </div>
    </div>
  );
}

/* ───────── kaart-shell + dag-kop ───────── */
function Card({ children }) {
  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--card-shadow)', padding: 'var(--card-pad)' }}>{children}</div>
  );
}
function DayHead({ overline, title, badgeZone, badgeName, right }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Over color="var(--text-muted)">{overline}</Over>
        {right}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 9 }}>
        {badgeZone && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 'var(--r-pill)', background: `color-mix(in srgb, var(--zone-${badgeZone}) 18%, transparent)`, border: `1px solid color-mix(in srgb, var(--zone-${badgeZone}) 45%, transparent)` }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: `var(--zone-${badgeZone})` }} />
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, color: `var(--zone-${badgeZone})` }}>{badgeName}</span>
          </span>
        )}
      </div>
      <div style={{ fontFamily: 'var(--font-sans)', fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text-primary)', marginTop: 10, lineHeight: 1.2 }}>{title}</div>
    </div>
  );
}

/* ════════════════ STAAT 1 — VOLTOOID · MATCH ════════════════ */
function DoneMatch() {
  return (
    <Card>
      <DayHead
        overline="Di 4 jun · voltooid"
        badgeZone={3} badgeName="Sweet Spot"
        title="Sweet Spot 3×12"
        right={<AlignChip kind="op-plan" />}
      />
      <Reading
        planType="Sweet Spot" doneType="Sweet Spot"
        rows={[
          { k: 'Duur', p: '1u00', d: '1u02' },
          { k: 'IF', p: '0,88', d: '0,89' },
          { k: 'TSS', p: '78', d: '81' },
        ]}
        zones={[
          { z: 1, plan: 6, done: 6 },
          { z: 2, plan: 12, done: 13 },
          { z: 3, plan: 38, done: 37 },
          { z: 4, plan: 4, done: 6 },
        ]}
      />
      <AlignBar pct={96} />
      <CoachCallout
        narrative={<>Sterk gereden. Je hield de Sweet Spot strak vast — 96% van de tijd binnen je doelzone, zonder weg te zakken in het laatste blok. Precies dit duwt je drempel verder omhoog.</>}
      />
    </Card>
  );
}

/* ════════════════ STAAT 2 — VOLTOOID · AFWIJKING ════════════════ */
function DoneDeviation() {
  return (
    <Card>
      <DayHead
        overline="Wo 5 jun · voltooid"
        badgeZone={3} badgeName="Tempo"
        title="Tempo-rit · 1u15"
        right={<AlignChip kind="anders" />}
      />
      <Reading
        deviate
        planType="VO2max" doneType="Tempo"
        rows={[
          { k: 'Duur', p: '1u05', d: '1u15' },
          { k: 'IF', p: '0,94', d: '0,81' },
          { k: 'TSS', p: '95', d: '74' },
        ]}
        zones={[
          { z: 1, plan: 4, done: 5 },
          { z: 2, plan: 33, done: 38 },
          { z: 3, plan: 0, done: 30 },
          { z: 4, plan: 8, done: 2 },
          { z: 5, plan: 20, done: 0 },
        ]}
      />
      <CoachCallout
        impact
        narrative={<>Je trainde Tempo i.p.v. de geplande VO2max-intervallen. In deze <strong style={{ color: 'var(--text-primary)' }}>Build-fase</strong> is de VO2max-prikkel de sleutel-stimulus van de week — Tempo houdt je fit, maar tilt je plafond niet op. Eén keer is geen probleem.</>}
        adaptation={<>Ik verplaats je VO2max-sessie naar <strong style={{ color: 'var(--text-primary)' }}>donderdag</strong> en maak vrijdag een rustige hersteldag. Je weekbelasting blijft op koers.</>}
      />
    </Card>
  );
}

/* ════════════════ STAAT 3 — GEMIST ════════════════ */
function Missed() {
  const [reason, setReason] = useState('tijd');
  const reasons = [['tijd', 'Geen tijd'], ['rust', 'Bewust gerust'], ['anders', 'Iets anders']];
  return (
    <Card>
      <DayHead
        overline="Do 6 jun · niet gereden"
        badgeZone={5} badgeName="VO2max"
        title="VO2max 5×4"
        right={<AlignChip kind="gemist" />}
      />
      {/* gemiste lezing — alleen 'gepland', gedaan = streep */}
      <div style={{ marginTop: 14, background: 'var(--reading-track)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-md)', padding: '11px 13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-muted)' }}>Gepland: 1u10 · IF 0,93 · 92 TSS</span>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, color: 'var(--align-missed)' }}>niet gereden</span>
      </div>
      {/* skip-reden (bestaande keuze) */}
      <div style={{ marginTop: 14 }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 8 }}>Wat was de reden?</div>
        <div style={{ display: 'flex', gap: 7 }}>
          {reasons.map(([k, lbl]) => {
            const on = reason === k;
            return (
              <button key={k} onClick={() => setReason(k)} style={{
                flex: 1, height: 36, borderRadius: 'var(--r-sm)', cursor: 'pointer',
                background: on ? 'var(--accent-soft)' : 'var(--bg-elevated)',
                border: `1px solid ${on ? 'var(--accent)' : 'var(--border-strong)'}`,
                color: on ? 'var(--accent)' : 'var(--text-secondary)',
                fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600,
              }}>{lbl}</button>
            );
          })}
        </div>
      </div>
      <CoachCallout
        impact
        narrative={<>Geen punt — één gemiste sessie gooit je blok niet om. Wel was dit je tweede VO2max-prikkel van de week, dus om de <strong style={{ color: 'var(--text-primary)' }}>Build-fase</strong> op gang te houden wil ik 'm niet helemaal laten vallen.</>}
        adaptation={<>Ik schuif een ingekorte VO2max (4×4) naar <strong style={{ color: 'var(--text-primary)' }}>zaterdag</strong> en verlicht de zondagrit. Maandag start je fris aan de nieuwe week — je ligt nog precies op schema voor Girona.</>}
      />
    </Card>
  );
}

/* ───────── frame-wrapper (telefoon 390×844) ───────── */
function Phone({ title, children, bare }) {
  if (bare) {
    return (
      <div style={{ width: 390, height: 844, background: 'var(--bg-app)', overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '54px 16px 40px' }}>
          <div>{children}</div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ fontFamily: 'var(--font-num)', fontSize: 12.5, color: 'var(--label)', letterSpacing: '0.02em' }}>{title}</div>
      <div style={{ width: 390, height: 844, background: 'var(--bg-app)', borderRadius: 30, overflow: 'hidden', border: '1px solid var(--border-subtle)', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '54px 16px 40px' }}>
          <div>{children}</div>
        </div>
      </div>
    </div>
  );
}

const FRAMES = {
  '08-dag-voltooid-match.png': <DoneMatch />,
  '09-dag-voltooid-afwijking.png': <DoneDeviation />,
  '10-dag-gemist.png': <Missed />,
};

function Canvas() {
  const init = (typeof window !== 'undefined' && window.__CF_FRAME) || (typeof location !== 'undefined' ? location.hash : '').replace('#', '') || '';
  const [hash, setHash] = useState(init);
  React.useEffect(() => {
    const on = () => setHash(location.hash.replace('#', ''));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const single = { f1: '08-dag-voltooid-match.png', f2: '09-dag-voltooid-afwijking.png', f3: '10-dag-gemist.png' }[hash];
  if (single) {
    return <div style={{ width: 390, height: 844 }}><Phone bare>{FRAMES[single]}</Phone></div>;
  }
  return (
    <div style={{ minHeight: '100vh', background: 'var(--stage)', padding: '40px 32px 64px' }}>
      <div style={{ display: 'flex', gap: 34, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {Object.keys(FRAMES).map((name) => (
          <Phone key={name} title={name}>{FRAMES[name]}</Phone>
        ))}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Canvas />);
