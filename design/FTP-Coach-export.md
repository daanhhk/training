# FTP Coach — Export (schermen & componenten)

Per tab: de layout-opbouw, de componenten, hun states en welke tokens uit
`design/tokens.css` ze gebruiken. Kleuren worden bij naam genoemd, nooit
gehardcode. Dit document beschrijft de **actuele** staat van de mockups.

Viewport: telefoon **390 × 844** (iOS-frame, donker).

---

## Globale shell (op elk scherm)

**Header** — logo "FTP COACH" (accent-balkje `--accent-grad`, geskewd), label
"Week 23" in `--font-num` `--text-muted`, en een avatar-knop "DK" (rand
`--accent`, glow `--accent-ring`) die naar **Instellingen** schuift.

**Bottom tab bar** — vaste navigatie onderaan, altijd op dezelfde hoogte.
Vier tabs in deze volgorde: **Schema · Vorm · Trainingen · Niveau**.
Standaard-tab = **Schema**.
- Achtergrond `--tabbar-bg` (geblurd over content), rand-boven `--tabbar-border`.
- Per tab: icoon + label. Actief = `--tabbar-icon-active` / `--tabbar-label-active`
  (= accent) met een korte indicator-balk `--tabbar-indicator` bovenaan het item;
  inactief = `--tabbar-icon` / `--tabbar-label` (muted).
- Ondermarge `--tabbar-safe-bottom` voor de home-indicator.

**Status-deck** (swipebaar, 2 kaarten) — verschijnt **boven** de tab-content op
Vorm, Trainingen en Niveau. **Niet** op Schema: dat tabblad is volledig op de
training gericht en de gekozen training is al op je status gebaseerd. Paginatie-
dots onder de deck: actief `--accent`, rest `--border-strong`.

**Ochtend-check-in (bottom sheet)** — globale overlay, 1× per dag.
Scrim `--scrim`, paneel `--sheet-bg` met bovenhoeken `--sheet-radius`, greep
`--sheet-handle`, schaduw `--sheet-shadow`. Drie segmented controls (Slaap /
Benen / Stress) + primaire knop "Vastleggen". Verschijnt automatisch zolang er
voor vandaag nog niet is ingevuld; daarna alleen heropenbaar via de **+**-knop in
de statuskaart. Persisteert per datum.

---

## 1. Schema (standaard-tab)

Trainingsgericht; geen status-deck bovenaan. Opbouw top → onder:

### a. Plan / periodisering — *countdown + seizoens-mode* (eigen component)
Inklapbare kaart (`PeriodTimeline`). Dit is de "status bovenaan" van Schema.
- **Kop**: overline "Plan · periodisering" (`--text-muted`), titel
  "Build · nog *n* wkn tot Girona" (`--text-primary`), en de seizoens-mode-chip
  "Doel-gericht" → `--mode-chip-bg` / `--mode-chip-text` / `--mode-chip-border`.
- **Uitgeklapt**: fase-tijdlijn Basis → Build → Peak → Taper. Voltooide fases
  `--phase-past`, huidige `--phase-current`, toekomstige `--phase-future`; de
  "je bent hier"-marker `--phase-marker` met `--accent-ring`-glow. Fase-labels
  `--phase-label`, huidige `--phase-label-current`. Event-tags: A-event (Girona)
  `--event-a-bg` / `--event-a-text`, B-event (Tune-up) `--event-b-bg` /
  `--event-b-text`. Stat-rij (Fase / Tot Girona / Volume) met `--border-subtle`-
  scheiders.
- Kaart: `--card-bg` `--card-border` `--card-radius` `--card-shadow`.

### b. Deze week · gepland vs gedaan (`WeekLoad`)
- Overline + **icoon-only verversknop** (rond, `--bg-elevated` /
  `--border-strong`, refresh-icoon `--accent`).
  States: *idle* (knop) → *busy* (spinner, `--text-muted`) → *done* (check,
  `--good`).
- Stat-rij **TSS / Uren / Dagen** (`--font-num`) met hairline-scheiders.
- Voortgangsbalk: vulling `--accent-grad` over spoor `--bg-sunken`.
- Optionele *stale*-banner ("plan verouderd") in `--warn-soft` / `--warn`.

### c. Dagstrip (`DayStrip`)
Horizontaal scrollbare dag-chips, gecentreerd op vandaag.
- Geselecteerd: vlak `--accent-soft`, rand `--accent`, cijfer `--accent`.
- Vandaag: rand in accent-tint (`color-mix` van `--accent`).
- Overig: `--bg-surface` / `--border-subtle`.
- Status-marker per dag: gedaan = check (`--text-secondary`), gepland = dot in
  `--zone-*`, rustdag = streepje `--border-strong`. Datums in `--font-num`.

### d. Dag-detail (afhankelijk van dag-state)
- **Voorstel / vandaag** (`ProposalDetail`): overline (accent als vandaag),
  zone-badge (`--zone-*`), workout-naam (~22px, `--text-primary`), metrics
  min / IF / TSS (`--font-num`). **ZoneBar + ZoneLegend** in zonekleuren.
  Inklapbare **Blokstructuur** (`--bg-sunken`-rijen). "Waarom deze training?"-
  expander (`--bg-sunken` / `--border-subtle`). Secundaire knop "Doe iets anders"
  → `WorkoutPicker`. **GarminSync**-knop met states:
  *idle* (`--btn-secondary-*`) · *busy* (spinner) · *sent* (`--good-soft`/`--good`)
  · *stale* (`--warn-soft`/`--warn`) · *error* (`--bad-soft`/`--bad`).
- **Meerdere sessies** (`MultiSessionDetail`): Ochtend/Middag-kaarten
  (`--bg-sunken`) met zone-badge, naam, metrics, `MiniZoneBar`.
- **Voltooid** (`DoneDetail`): "Voltooid"-overline + groene check (`--good`),
  naam, metrics, en **RpeRating** 1–10 (gevulde knoppen `--accent`, geselecteerd
  met `--accent-ring`-rand; feedback-callout `--accent-soft`).
- **Rustdag / niet-beschikbaar** (`RecoveryCard` / `UnavailableCard`):
  gecentreerde lege-staat met "Toch trainen"-knop.
- **Handmatig gekozen** (`OverriddenDetail` / `FreeRideCard`): "Handmatig
  gekozen"-pin (`--bg-elevated`/`--border-strong`, accent-dot) + "Terug naar
  voorstel".
- **Beschikbaarheid** (`AvailabilityEditor`): keuze dag/week → `DayControls`
  (Train-toggle `--toggle-*`, minuten-slider `--slider-*`, Pendel-toggle) of een
  week-grid met per dag slider + toggles. Opslaan = primaire knop.

**Data-staten** (via Tweaks-scenario): *niet verbonden* → `ConnectState`,
*sync mislukt* → `SyncBanner`, *lege week* / *eerste keer* → lege-staat + "werk
week bij".

---

## 2. Vorm

Status-deck bovenaan, daarna de vorm-analyse.

### a. Status / readiness-kaart (`ReadinessCard`) — statuskaart van Vorm
- Overline "Status · vandaag". **ProgressRing**: waarde-kleur naar score —
  `--readiness-ready` (≥62) / `--readiness-caution` (48–61) / `--readiness-rest`
  (<48), spoor `--readiness-ring-track`. Centertekst in `--font-num`.
- Verdict-tekst (`--text-primary`) + chips: "Vorm +7" (`--fresh`/`--fresh-soft`),
  "HRV 48" (`--text-muted`). "Waarom dit cijfer?"-expander → factor-lijst met
  status-dots (`--good`/`--warn`/`--text-muted`).
- **Onderaan**: als check-in gedaan → samenvattingsregel + ronde **+**-knop
  (`--accent-soft`) om de bottom sheet te heropenen, plus effect-callout
  (`--accent-soft`). Als nog niet ingevuld → gestippelde prompt
  "+ Ochtend-check-in invullen" (`--bg-sunken`/`--border-strong`).
- Kaart: card-tokens; padding `--card-pad`.

### b. Niveau-kaart (`LevelCard`)
Overline "Niveau" + "Gevorderd"-chip (`--accent-soft`/`--accent`). Groot getal
"28 / 50" (`--font-num`), W/kg. Voortgangsbalk `--accent-grad` over `--bg-sunken`.

### c. Niveau over tijd (lijngrafiek)
Kaart met waarde + delta (`--good`/`--bad`), segmented control 1M/6M/12M/Alles
(`--segment-*`), en **NiveauChart**: lijn `--chart-line`, area `--chart-fill`,
grid `--chart-grid`, as `--chart-axis`, actief punt `--chart-point` met
`--accent`-rand.

### d. Metric-rij (`MetricRow`)
Drie cellen **FTP / Gewicht / Week-TSS** (`--font-num`), gescheiden door
`--border-subtle`. Lege staat = "—" in `--text-muted`.

### e. Conditie-balans
Kaart "vorm = fitheid − vermoeidheid"; één van drie visualisaties
(balans / driehoek / pmc) via Tweaks. Eerste-keer = opbouw-melding.

---

## 1bis. Schema · dag-detail coach-feedback

De voltooide- en gemiste-dag-details zijn verrijkt tot volwaardige
**coach-feedback** met één herkenbare coach-stem. Bouwt voort op de bestaande
dag-detail-skin (zone-badge, `MiniZoneBar`, kaart-tokens) en op de gepland-vs-
gedaan-lezing van `WeekLoad` (de `/`-noemer-stijl), nu op dag-niveau.

### Gedeelde bouwstenen

**Alignment-chip** (`AlignChip`) — rechtsboven in de dag-kop. Vier soorten,
elk `align-*` + `-soft` + dot: *Op plan* (`--align-on-plan`), *Licht afgeweken*
(`--align-deviated`), *Anders getraind* (`--align-different`), *Niet gereden*
(`--align-missed`, neutraal grijs — nóóit danger-rood, geen schuldgevoel).

**Gepland-vs-gedaan-lezing** (`Reading`) — twee kolommen "Gepland" / "Gedaan"
(`--reading-col-label`), rij-hairlines `--reading-divider`, track
`--reading-track`. Type-rij + metric-rijen (Duur · IF · TSS) met geplande waarde
in `--reading-planned` (muted), gedane in `--reading-done` (primary, zwaarder);
bij afwijking kleurt de gedane type-waarde `--align-different`. Onderaan
**zone-vergelijking** (`ZoneCompare`, zie hieronder).

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

**Uitvoerings-/alignment-balk** (`AlignBar`) — bij match/afwijking-met-zelfde-
intent: "Uitvoering volgt plan" + percentage; track `--reading-track`, vulling
in de chip-kleur.

**Coach-callout** (`CoachCallout`) — de coach-stem, één component over alle
staten. Vlak `--coach-bg`, rand `--coach-border` (impact-variant:
`--coach-border-impact`). Links een coach-merkje (`CoachMark`: chat-glyph,
`--coach-mark` op `--coach-mark-bg`), overline "COACH" / "COACH · IMPACT"
(`--coach-label`), narratief `--coach-text`. Optionele **adaptatie-regel**
hairline-gescheiden binnen dezelfde callout (`--coach-divider`), met move/agenda-
icoon (`--coach-adapt-icon`) + label "AANPASSING" (`--coach-adapt-label`).

### Staten
- **08 · Voltooid — match** (`08-dag-voltooid-match.png`): chip *Op plan*,
  gelijke gepland/gedaan-kolommen + een `ZoneCompare` waar de gedane balk per
  zone vrijwel samenvalt met de geplande omvang, `AlignBar` (96%), motiverend narratief.
- **09 · Voltooid — afwijking** (`09-dag-voltooid-afwijking.png`): chip *Anders
  getraind*, `Reading` toont gepland *VO2max* vs gedaan *Tempo* (`--align-different`).
  De `ZoneCompare` maakt het hard zichtbaar: Z5 gepland 20′ → gedaan 0′ (*niet
  gereden* — de gemiste sleutel-stimulus) en Z3 gepland 0′ → gedaan 30′ (*niet
  gepland* — de losse tempo); `CoachCallout impact` met impact + adaptatie.
- **10 · Gemist** (`10-dag-gemist.png`): chip *Niet gereden*, compacte
  "Gepland: … · niet gereden"-lezing, skip-reden-keuze, `CoachCallout impact`
  zonder verwijt + adaptatie + motiverende vooruitblik.

---

## 1ter. Schema · rit-detail (activiteit-statistieken)

Tik op een **gereden** rit in de voltooide dag-detail → een **overlay-sheet**
(de bestaande sheet-variant: `--scrim` + `--sheet-bg/radius/handle/shadow`,
92% hoogte) met de échte activiteit-statistieken uit intervals.icu: de
interval-structuur + vermogensverdeling per blok. Mobiel, scrollbaar. Drie
states: geladen · laden · error.

### Geladen (`RideLoaded`, `11-rit-detail.png`)
Opbouw top → onder:
1. **Kop** — klasse-badge (zone-gekleurd, bv. "Drempel" `--zone-4`) + datum/tijd
   (`--text-muted`), daaronder groot `afstand · duur` (`--font-num`, scheider
   `--ride-divider`).
2. **Tijd-in-zone-balk** (`TimeInZoneBar`) — gestapelde balk, segmenten op
   tijd-aandeel, kleur `--zone-1…6`, spoor `--tiz-track`, hairline-gap
   `--tiz-gap`; legenda eronder (zone-stip + `Z*` + % in `--tiz-legend-text`).
3. **Hero-strip** — drie cellen NP · IF · TSS op `--ride-hero-bg`, scheiders
   `--ride-divider`, waarden `--ride-hero-value`; TSS als enige accent
   (`--ride-hero-accent`).
4. **Metric-grid** (`Metric`, 2 kolommen, 2×3) — herzien voor een fietser die
   z'n rit nabeschouwt (klim-/Girona-doel), niet voor volledigheid: **Gem.
   vermogen** (w) · **W/kg** (uit gem. vermogen ÷ gewicht; klim-relevant) ·
   **Gem. HR** (bpm, met *max NNN* als sub-waarde rechts) · **Hoogtewinst** (m) ·
   **Cadans** (rpm, secundair) · **Arbeid** (kJ). Bewust wég: *Variabiliteit
   (VI)*, losse *Max. HR*-tegel (gevouwen in de sub van Gem. HR) en *Calorieën*
   (overlapt met kJ — kJ is training-relevanter). Tegel `--ride-metric-tile-bg`,
   label `--ride-metric-label`, waarde `--ride-metric-value`, eenheid
   `--ride-metric-unit`, sub `--text-muted`.
5. **Intervallen** (`IntervalRow`) — de kern. Sectie-overline
   `--ride-section-label` + "FTP {n} w". Per blok: zone-gekleurde linker-stripe
   (`--interval-stripe-w`, `--zone-*`), label (`--interval-label`) + `Z*`-badge,
   meta-regel duur · HR · %FTP (`--interval-sub`, %FTP in zonekleur), rechts het
   vermogen groot (`--interval-power` + `--interval-power-unit`). Werk-intervallen
   `--interval-row-bg`, herstel/WU/CD `--interval-rest-bg` (lager contrast).
6. **Gereserveerd** — gestippelde placeholder "Vermogenscurve · binnenkort"
   (`--border-strong` op `--bg-sunken`) — ruimte voor fase 2 (nog niet gebouwd).

### Laden (`RideLoading`, `11b-rit-detail-laden.png`)
Skeleton met dezelfde layout-ritmes: balken `--skeleton-base` + shimmer-sweep
(`--skeleton-sheen`, `prefers-reduced-motion`-gated). Onderaan "Statistieken
laden…" (`--text-muted`). Toont terwijl `getRideDetail` loopt.

### Error / geen data (`RideError`, `11c-rit-detail-error.png`)
Gecentreerde lege-staat: glyph-disc (`--state-icon` op `--state-icon-bg`), titel
(`--state-title`), uitleg (`--state-body`), secundaire knop "Opnieuw proberen"
(`--btn-secondary-*`, refresh-icoon `--accent`).

---

## 3. Trainingen

Status-deck bovenaan; daaronder een drill-down in drie views (`TrainingenTab`):
1. **Bibliotheek · per categorie** — overline + lijst `CategoryCard`s (Herstel,
   Duurvermogen, Tempo, Sweet Spot, FTP/Drempel, …). Elke rij: zone-gekleurde
   marker (`--zone-*`), naam (`--text-primary`), omschrijving (`--text-muted`),
   aantal varianten + chevron.
2. **Categorie** — `BackBar` + duur-slider (`--slider-*`) + "Varianten"-lijst
   (`VariantRow`).
3. **Workout-detail** — `WorkoutDetail` met ZoneBar/blokken en primaire knop
   "Inplannen" (`--btn-primary-*`).

---

## 4. Niveau

Status-deck bovenaan; de detailweergave is nog een **stub**: een gestippelde
kaart "Niveau-detail — volgende iteratie" (`--border-strong`, `--text-muted`).
Placeholder voor een volgende iteratie.

---

## Gedeelde componenten & tokens (referentie)

| Component | Tokens |
| --- | --- |
| Kaart | `--card-bg` `--card-border` `--card-radius` `--card-shadow` `--card-pad` |
| Primaire knop | `--btn-primary-bg` `--btn-primary-text` `--btn-height` `--btn-radius` |
| Secundaire knop | `--btn-secondary-bg/border/text` |
| Segmented control | `--segment-track-bg` `--segment-text` `--segment-active-bg/text/shadow` |
| Toggle | `--toggle-w/h` `--toggle-track-off/on` `--toggle-thumb` `--toggle-thumb-shadow` |
| Slider | `--slider-track` `--slider-fill` `--slider-thumb` |
| Veld | `--field-bg(-focus)` `--field-border(-focus)` `--field-text` `--field-placeholder` |
| Tab bar | `--tabbar-bg/border/icon(-active)/label(-active)/indicator/safe-bottom` |
| Bottom sheet | `--scrim` `--sheet-bg/radius/handle/shadow` |
| Readiness-ring | `--readiness-ready/caution/rest` `--readiness-ring-track` |
| Periodisering | `--phase-past/current/future/marker` `--phase-label(-current)` `--mode-chip-*` `--event-a/b-*` |
| Grafiek | `--chart-line/fill/grid/axis/point` |
| Zones | `--zone-1` … `--zone-6` |

---

## Screenshots om los te exporteren

Exporteer deze naar `design/screenshots/` (390×844, tenzij anders):

| Bestandsnaam | Inhoud |
| --- | --- |
| `01-schema.png` | Schema-tab (standaard) — plan, weeklast, dagstrip, dag-detail |
| `02-vorm.png` | Vorm-tab — status-deck + niveau-grafiek + conditie-balans |
| `03-trainingen.png` | Trainingen-tab — bibliotheek per categorie |
| `04-niveau.png` | Niveau-tab — stub-staat |
| `05-status-card.png` | Readiness-/statuskaart (Vorm) close-up, check-in ingevuld |
| `06-checkin-sheet.png` | Ochtend-check-in bottom sheet (open) |
| `07-plan-card.png` | Plan/periodisering-kaart uitgeklapt (countdown + seizoens-mode) |
| `08-dag-voltooid-match.png` | Dag-detail coach-feedback — voltooid, uitvoering matcht plan |
| `09-dag-voltooid-afwijking.png` | Dag-detail coach-feedback — voltooid, afwijking + impact + adaptatie |
| `10-dag-gemist.png` | Dag-detail coach-feedback — gemist, skip-reden + impact + adaptatie |
| `11-rit-detail.png` | Rit-detail sheet — geladen (tijd-in-zone, hero-metrics, metric-grid, intervallen) |
| `11b-rit-detail-laden.png` | Rit-detail sheet — laden (skeleton, `getRideDetail` loopt) |
| `11c-rit-detail-error.png` | Rit-detail sheet — error / geen data + "Opnieuw proberen" |

---

<!-- Levering 4 — Niveau-tab + Vorm A/B-varianten (gefold uit _import-design-4) -->

## §2 — VORM (met Variant A/B-noot)

## 2. Vorm

Status-deck bovenaan, daarna de vorm-analyse.

### a. Status / readiness-kaart (`ReadinessCard`) — statuskaart van Vorm
- Overline "Status · vandaag". **ProgressRing**: waarde-kleur naar score —
  `--readiness-ready` (≥62) / `--readiness-caution` (48–61) / `--readiness-rest`
  (<48), spoor `--readiness-ring-track`. Centertekst in `--font-num`.
- Verdict-tekst (`--text-primary`) + chips: "Vorm +7" (`--fresh`/`--fresh-soft`),
  "HRV 48" (`--text-muted`). "Waarom dit cijfer?"-expander → factor-lijst met
  status-dots (`--good`/`--warn`/`--text-muted`).
- **Onderaan**: als check-in gedaan → samenvattingsregel + ronde **+**-knop
  (`--accent-soft`) om de bottom sheet te heropenen, plus effect-callout
  (`--accent-soft`). Als nog niet ingevuld → gestippelde prompt
  "+ Ochtend-check-in invullen" (`--bg-sunken`/`--border-strong`).
- Kaart: card-tokens; padding `--card-pad`.

### b. Niveau-kaart (`LevelCard`)
Overline "Niveau" + "Gevorderd"-chip (`--accent-soft`/`--accent`). Groot getal
"28 / 50" (`--font-num`), W/kg. Voortgangsbalk `--accent-grad` over `--bg-sunken`.
*(Dit is de deck-kaart; staat los van de Vorm-variant hieronder.)*

> **Vorm-variant (Tweak):** de body-secties (c) + (d) hieronder horen bij
> **Variant B** (Vorm ongewijzigd). In **Variant A** vervallen (c) + (d) en komt
> er één compacte `VormLevelSummary` (overline "Progressie", W/kg · niveau · FTP
> + delta, "Progressie →"-affordance naar Niveau) voor in de plaats; de diepe
> progressie verhuist naar de Niveau-tab (§4). De conditie-balans (e) blijft in
> beide varianten.

### c. Niveau over tijd (lijngrafiek) — *Variant B*
Kaart met waarde + delta (`--good`/`--bad`), segmented control 1M/6M/12M/Alles
(`--segment-*`), en **NiveauChart**: lijn `--chart-line`, area `--chart-fill`,
grid `--chart-grid`, as `--chart-axis`, actief punt `--chart-point` met
`--accent`-rand.

### d. Metric-rij (`MetricRow`) — *Variant B*
Drie cellen **FTP / Gewicht / Week-TSS** (`--font-num`), gescheiden door
`--border-subtle`. Lege staat = "—" in `--text-muted`.

### e. Conditie-balans
Kaart "vorm = fitheid − vermoeidheid"; één van drie visualisaties
(balans / driehoek / pmc) via Tweaks. Eerste-keer = opbouw-melding.

---

---

## 4. Niveau

De langetermijn-**vermogen & ontwikkeling**-lens. Beantwoordt: waar sta ik ·
word ik sterker · wat voor rijder ben ik · waar kán ik komen. (Vorm = "nu";
Niveau = "hoe sterk + waarheen".) Hoofd-event: **Girona** — lange klimmen,
~90 km / 1200 hm per dag = duurvermogen/durability, geen piek-sprint.

**Geen status-deck op Niveau** (afwijking van Vorm/Trainingen): de deck gaat over
"nu", Niveau over de lange termijn, en de deck-`LevelCard` zou de vermogen-
snapshot dubbelen. De tab opent direct in de vermogen-identiteit. Mobiel-first
kolom (`niveau.jsx`, `NiveauTab`), van boven naar onder:

### a. Vermogen-snapshot (`VermogenSnapshot`) — *element 1 · v1*
Compacte "waar sta ik"-kaart. **FTP** is het kopgetal (`48px`, `--font-num`)
met eFTP als sub-regel. **W/kg** wordt BENADRUKT — dé klimmetric voor Girona:
groot in `--wkg-emphasis` (accent) in een eigen pill `--wkg-emphasis-bg` met
overline "Klimvermogen" + gewicht eronder. Tier-chip rechtsboven
(`Beginner → Recreatief → Getraind → Gevorderd → Zeer goed → Elite`,
`--accent-soft`/`--tier-step-border-active`). Onderaan een **tier-ladder**: zes
segmenten, behaalde in `--accent`, rest `--tier-step`; labels Beginner…Elite
(`--tier-label`).
- *Leeg*: "—" + "Verbind je account". *Laden*: skeletons (`--skeleton-*`).

### b. Progressie over tijd (`ProgressieCard`) — *element 2 · v1*
Eén interactieve trajectorie-grafiek (`NvTrajectoryChart`, viz-laag `--traj-*`,
zelfde area/scrub-stijl als de Vorm-`NiveauChart`). **Metric-switch** Niveau ·
W/kg · Fitheid (segmented `--segment-*`) + **venster-switch** 1M/6M/12M/Alles.
Kop toont de huidige waarde + **periode-delta** (`--traj-delta-up/down`,
"+0,90 ↑ sinds seizoenstart"). De **fitheid/CTL-lijn** (weggehaald bij Vorm)
landt hier als optionele context-overlay (gestippeld, `--traj-ctl-line`,
neutraal — concurreert nooit met de accent-metric).
- *Leeg*: "verschijnt zodra ~4 weken aan ritten binnen zijn". *Laden*: skeleton.

### c. Rijdersprofiel (`Rijdersprofiel`) — *element 3 · FASE 2*
Power-duration-curve (beste inspanning per duur: 5s · 1m · 5m · 20m · 60m) op
log-x, viz-laag `--curve-*`. Girona-relevante duren (5–20 min + lang) gemarkeerd
in `--curve-point-key` (accent-halo); rest `--curve-point`. Daaronder een
type-schaal Sprinter ↔ Allrounder ↔ Diesel·klimmer (`--curve-type-track` /
`--curve-type-marker`) + één-regel-duiding. Vraagt een nieuwe intervals.icu
mean-max-power-fetch → kaart draagt een **"Fase 2"-tag** (`--soon-tag-*`), zelfde
binnenkort-conventie als de vermogenscurve-placeholder in het rit-detail.

### d. Doel-gereedheid + projectie (`DoelProjectie`) — *element 4 · FASE 2 · visie-kopstuk*
- **Doel-gap** (`GapRow`): per dimensie huidig vs Girona-vraag —
  Klimvermogen (W/kg, *op koers* `--goal-ontrack`), Duurvermogen (CTL,
  *nog te gaan* `--goal-gap`), Lange-rit-capaciteit. Samenvattende callout
  (`--goal-ontrack-soft`).
- **Uren → potentieel** (interactieve what-if, `HoursSlider`): sleep de
  uren/week (`--slider-*`) → de projectie beweegt mee.
- **EERLIJKHEID = ontwerp-eis**, twee visueel ONDERSCHEIDEN lagen:
  1. **Fitheid-projectie** (`ProjectionChart`) — de SOLIDE, uit volume berekende
     CTL-ramp (`--proj-solid` + `--proj-solid-fill`) naar het plafond, met de
     duurdoel-lijn (`--goal-target-line`) en een groene **klaar-marker**
     (`--proj-ready-marker`) waar de ramp het doel kruist. Label "berekend uit
     volume". Zakt het plafond ónder het doel → géén klaar-marker + eerlijke
     waarschuwing ("bij Nu/week niet haalbaar", `--warn-soft`).
  2. **Geschat FTP-effect** — de SPECULATIEVE W/FTP-winst als een **band**
     (`--proj-band-fill`, gestreept `--proj-band-hatch`, rand `--proj-band-border`),
     gelabeld **"schatting"** (`--proj-estimate-text`), nooit één vals-precies
     getal — altijd een bereik ("276–284 W over 12 wk") met een uitklapbare
     **aannames**-lijst.
- Readout: "Duurdoel bereikt over ~N weken" + delta "+2u/week ≈ X weken eerder".
- *Leeg*: "Stel je Girona-doel in en verbind je historie."

> **Vorm-overlap (zie §2):** de diepe progressie + LevelCard staan nu óók op
> Vorm. Twee behandelingen, togglebaar via Tweak **Vorm-variant**:
> **A (verplaatsen)** — diepe progressie verhuist naar Niveau; Vorm houdt een
> compacte `VormLevelSummary` (W/kg · niveau · FTP · delta) + "Progressie →"-
> affordance naar Niveau. **B (laten staan)** — Vorm ongewijzigd; Niveau draagt
> de diepe view zelfstandig.

---
