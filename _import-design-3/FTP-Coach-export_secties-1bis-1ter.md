# FTP Coach — export-doc · bijgewerkte secties
# 1bis (coach-feedback met ZoneCompare) + 1ter (rit-detail met herziene metrics)
# Plak 1:1 terug in design/FTP-Coach-export.md (vervangt de bestaande 1bis/1ter).

## 1bis. Schema · dag-detail coach-feedback

De voltooide- en gemiste-dag-details zijn verrijkt tot volwaardige
**coach-feedback** met één herkenbare coach-stem. Bouwt voort op de bestaande
dag-detail-skin (zone-badge, `MiniZoneBar`, kaart-tokens) en op de gepland-vs-
gedaan-lezing van `WeekLoad` (de `/`-noemer-stijl), nu op dag-niveau.

### Gedeelde bouwstenen

**Alignment-chip** (`AlignChip`) — rechtsboven in de dag-kop. Vier soorten,
elk `align-*` + `-soft` + dot:
- *Op plan* → `--align-on-plan` / `--align-on-plan-soft`
- *Licht afgeweken* → `--align-deviated` / `--align-deviated-soft`
- *Anders getraind* → `--align-different` / `--align-different-soft`
- *Niet gereden* → `--align-missed` / `--align-missed-soft` (neutraal grijs,
  nóóit danger-rood — geen schuldgevoel)

**Gepland-vs-gedaan-lezing** (`Reading`) — twee kolommen "Gepland" / "Gedaan"
(`--reading-col-label`), rij-hairlines `--reading-divider`, track
`--reading-track`. Type-rij + metric-rijen (Duur · IF · TSS) met geplande
waarde in `--reading-planned` (muted) en gedane waarde in `--reading-done`
(primary, zwaarder). Bij afwijking kleurt de gedane type-waarde
`--align-different`. Onderaan **zone-vergelijking** (`ZoneCompare`, zie hieronder).

**Zone-vergelijking** (`ZoneCompare`) — vervangt de twee losse gestapelde
zone-balken (die lazen als twee aparte trainingen — de gedane stapel oogde
rommelig terwijl het een normale rit was). Nu één **rij per zone** (Z1–6, alleen
zones met gepland óf gedaan > 0): een faded "geplande-omvang"-balk
(`color-mix(--zone-N, --zcompare-plan-strength)`, `--zcompare-track-h`) met een
massieve, in hoogte ingesprongen "gedaan"-balk eroverheen (`--zone-N`,
`--zcompare-done-h`), op een gedeelde minuten-schaal. Rechts de minuten:
gedaan groot in zonekleur, eronder `gepland N′` (`--reading-planned`). De
afwijking per zone leest in één oogopslag — gedaan voorbij gepland = méér ·
gepland voorbij gedaan = te kort · alléén gedaan = tag *niet gepland*
(`--zcompare-tag-unplanned`) · alléén gepland = tag *niet gereden*
(`--zcompare-tag-skipped`). Stijl-idee uit de intervals.icu-tijd-per-zone-balk,
maar met gepland ÉN gedaan per zone. *Alleen in de coach-feedback* (plan vs
uitvoering); de rit-detail (§1ter) houdt z'n enkele gereden-zone-verdeling-balk
(`TimeInZoneBar` = "wat deed ik", los van een plan).

**Uitvoerings-/alignment-balk** (`AlignBar`) — alleen bij een sterke match:
"Uitvoering volgt plan" + percentage; track `--reading-track`, vulling
`--align-on-plan`.

**Coach-callout** (`CoachCallout`) — de coach-stem, één component over alle
staten. Vlak `--coach-bg`, rand `--coach-border` (impact-variant:
`--coach-border-impact`). Links een coach-merkje (`CoachMark`: chat-glyph,
`--coach-mark` op `--coach-mark-bg`), overline "COACH" of "COACH · IMPACT"
(`--coach-label`), narratieftekst `--coach-text`. Optionele **adaptatie-regel**
hairline-gescheiden binnen dezelfde callout (`--coach-divider`), met
move/agenda-icoon (`--coach-adapt-icon`) + label "AANPASSING"
(`--coach-adapt-label`) — zo leest narratief + aanpassing als één stem.

### Staten

- **08 · Voltooid — match** (`DoneMatch`, `08-dag-voltooid-match.png`):
  `AlignChip kind=op-plan`, `Reading` met gelijke gepland/gedaan-kolommen en
  een `ZoneCompare` waar de gedane balk per zone vrijwel samenvalt met de
  geplande omvang (rustige, uitgelijnde lezing), `AlignBar` (96%), en een
  motiverende `CoachCallout` (narratief, geen impact/adaptatie).
- **09 · Voltooid — afwijking** (`DoneDeviation`, `09-dag-voltooid-afwijking.png`):
  `AlignChip kind=anders`, `Reading` toont de afwijking expliciet (gepland
  *VO2max* vs gedaan *Tempo* in `--align-different`). De `ZoneCompare` maakt het
  hard zichtbaar: Z5 gepland 20′ → gedaan 0′ (*niet gereden* — de gemiste
  sleutel-stimulus) en Z3 gepland 0′ → gedaan 30′ (*niet gepland* — de losse
  tempo). Prominente `CoachCallout impact` met **impact** + **adaptatie**.
- **10 · Gemist** (`Missed`, `10-dag-gemist.png`): `AlignChip kind=gemist`,
  een compacte gemiste-lezing (alleen "Gepland: … · niet gereden" in
  `--align-missed`), de bestaande **skip-reden-keuze** (Geen tijd / Bewust
  gerust / Iets anders; geselecteerd `--accent-soft`/`--accent`), en een
  `CoachCallout impact` zonder verwijt + adaptatie + motiverende vooruitblik.

---

## 1ter. Schema · rit-detail (activiteit-statistieken)

Tik op een **gereden** rit in de voltooide dag-detail → een **overlay-sheet**
(de bestaande sheet-variant: `--scrim` + `--sheet-bg/radius/handle/shadow`,
92% hoogte) met de échte activiteit-statistieken uit intervals.icu. Verbergt het
aggregaat niet langer: toont de interval-structuur + vermogensverdeling per blok.
Mobiel, scrollbaar. Drie states: geladen · laden · error.

### Geladen (`RideLoaded`, `11-rit-detail.png`)

Opbouw top → onder:
1. **Kop** — klasse-badge (zone-gekleurd, bv. "Drempel" `--zone-4`) + datum/tijd
   (`--text-muted`), daaronder groot `afstand · duur` (`--font-num`, scheider
   `--ride-divider`).
2. **Tijd-in-zone-balk** (`TimeInZoneBar`) — gestapelde balk, segmenten op
   tijd-aandeel, kleur `--zone-1…6`, spoor `--tiz-track`, hairline-gap
   `--tiz-gap`; legenda eronder (zone-stip + `Z*` + % in `--tiz-legend-text`).
3. **Hero-strip** — drie cellen NP · IF · TSS op `--ride-hero-bg`, scheiders
   `--ride-divider`, waarden `--ride-hero-value`; TSS als de enige accent
   (`--ride-hero-accent`).
4. **Metric-grid** (`Metric`, 2 kolommen, 2×3) — herzien voor een fietser die
   z'n rit nabeschouwt (klim-/Girona-doel), niet voor volledigheid: **Gem.
   vermogen** (w) · **W/kg** (uit gem. vermogen ÷ gewicht; klim-relevant) ·
   **Gem. HR** (bpm, met *max NNN* als sub-waarde rechts) · **Hoogtewinst** (m) ·
   **Cadans** (rpm, secundair) · **Arbeid** (kJ). Bewust wég: *Variabiliteit
   (VI)* (zegt een gewone fietser weinig), losse *Max. HR*-tegel (gevouwen in de
   sub van Gem. HR) en *Calorieën* (overlapt met kJ — kJ is training-relevanter).
   Tegel `--ride-metric-tile-bg`, label `--ride-metric-label`, waarde
   `--ride-metric-value`, eenheid `--ride-metric-unit`, sub `--text-muted`.
5. **Intervallen** (`IntervalRow`) — de kern. Sectie-overline
   `--ride-section-label` + "FTP {n} w". Per blok: zone-gekleurde linker-stripe
   (`--interval-stripe-w`, `--zone-*`), label (`--interval-label`) + `Z*`-badge,
   meta-regel duur · HR · %FTP (`--interval-sub`, %FTP in zonekleur), en rechts
   het vermogen groot (`--interval-power` + `--interval-power-unit`).
   Werk-intervallen `--interval-row-bg`, herstel/WU/CD `--interval-rest-bg`
   (lager contrast) — zo springt de structuur eruit (bv. Z4 · Z5 · Z4 tussen
   Z2-blokken).
6. **Gereserveerd** — gestippelde placeholder "Vermogenscurve · binnenkort"
   (`--border-strong` op `--bg-sunken`) — ruimte voor fase 2 (zone-gekleurde
   vermogenscurve over tijd), nu nog niet gespecificeerd.

### Laden (`RideLoading`, `11b-rit-detail-laden.png`)
Skeleton met dezelfde layout-ritmes: balken op `--skeleton-base` met
shimmer-sweep (`--skeleton-sheen`, `prefers-reduced-motion`-gated). Onderaan
"Statistieken laden…" (`--text-muted`). Toont terwijl `getRideDetail` loopt.

### Error / geen data (`RideError`, `11c-rit-detail-error.png`)
Gecentreerde lege-staat: glyph-disc (`--state-icon` op `--state-icon-bg`), titel
(`--state-title`), uitleg (`--state-body`), en een secundaire knop "Opnieuw
proberen" (`--btn-secondary-*`, refresh-icoon `--accent`).

