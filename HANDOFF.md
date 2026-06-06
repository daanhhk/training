# HANDOFF — project training (FTP Coach web-app)

Bron van waarheid voor de projectstand. Conventies + architectuur-detail + code-invarianten staan in CLAUDE.md (auto-load Claude Code); deze HANDOFF = STAND, aanpak, roadmap + engine-referentie.

## STAND (leidend)
INTERACTIEVE HtmlService web-app. /dev:
https://script.google.com/macros/s/AKfycbz51mSRp2LYEIWFPJLmahX14_40w5c85UEDcjCSIW-J/dev
- **DONKERE SKIN IS LIVE.** 4 tabs. **Schema-tab compleet**: plan-kaart (1a), WeekLoad (3b), dag-detail skin (3a), web-RPE + skip-dispositie (3c). **Vorm**: ReadinessCard (1b) + check-in (2) + LevelCard/MetricRow/chart-tokens (3-deel1) + niveau-venster-toggle + gridline-fix (3-deel2). Volgende = Fase 3 deel 3 (conditie-balans-picker + legacy-tegels re-skin + strip-kleuren) of Trainingen (Fase 4).
- VISUEEL nog te verifiëren op /dev (incognito). Eerste actie nieuwe chat: **bevestig 1b + check-in + 3a/3b/3c**: dag-detail on-skin (geen banner/Garmin-regel, zone-kleuren); WeekLoad tussen plan-kaart en dagstrip (refresh-icoon cyclet); RPE 1–10 tikbaar op voltooide dag (persist + mismatch-callout); "Niet gedaan?" → 3 redenen → "Gemist · reden" + dagstrip-×, "Terug" herstelt voorstel.

## Visual system / aanpak
- **design-conventies: zie CLAUDE.md** ("Design — bron van waarheid": UI-build-loop, token-discipline, self-heal).
- Beslissing: **THEME-FIRST**. `design/tokens.css` (donker, 4-tabs) = styling-bron van waarheid; volledig gemirrord in `src/Tokens.html`.
- Het ONTWERP is leidend; bestaande functies bouwen we erin, en vullen aan waar nodig.
- **`design/FTP-Coach-export.md` = de feitelijke per-tab layout-bron** (componenten + states + tokens per scherm). `design/DESIGN.md` = visuele taal (geen per-kaart-layout). **`design/INTERACTIONS.md` = interactie-contract** (per-element READ/WRITE + 💻client/🌐server-gedrag; leidend voor UI-gedrag, zie CLAUDE.md).

## Readiness-formule (bouwklaar — 1b)
- Output 0–100; banden **≥62 ready / 48–61 caution / <48 rest** (uit `tokens.css`).
- Gewogen gemiddelde van genormaliseerde factoren (0–100). **Objectief-geleid (door Daan gekozen).**
- **GELOCKT deze sessie — objectieve/pré-check-in weging (= wat 1b bouwt; check-in bestaat nog niet):**
  - Vorm-trend **0,30** · Belasting (ramp/ATL vs CTL) **0,30** · HRV (vs baseline) **0,25** · Slaap (uit intervals) **0,15**. Som 1,00.
  - Vervangt de eerdere pré-check-in-getallen (30/22/20/13 rescaled). Schuifbaar: zet als named constant bovenaan de readiness-fn.
  - **3 presets** `objectief / gebalanceerd / subjectief` (objectief = default; de andere twee + benen/stress = toekomst, post-check-in).
- **Vol model (post-check-in, TOEKOMST):** voegt Benen + Stress in (subjectief, uit ochtend-check-in) en herberekent; gebalanceerd/subjectief schuiven richting slaap-zwaar (Garmin-achtig). Check-in-capture = future write-side (gebruikt de overlay-primitive uit Fase 0b).
- Ontbrekende factor → wegvallen + herschalen (geen harde nul). **HRV + slaap bevestigd aanwezig** in deze gebruiker's intervals.icu.
- "Waarom dit cijfer": per factor 0–100 + status-dot. **LIVE-drempel (`getReadinessScore_`): good ≥67 / warn 34–66 / muted <34.** (De pré-build ≥70/45–69/<45 is niet geïmplementeerd.)

## Bouw-roadmap (volgorde)
Verticale plakken: UI + Apps Script-handler + Sheet-range per feature. Elke fase = bruikbaar increment.
- **Fase 0 Fundament — DONE.** skin-flip (tokens geserveerd + alias-bridge + IBM Plex + ring→tokens), 4-tab-shell (Trainingen/Niveau lege containers), herbruikbare overlay (sheet/drawer).
- **Fase 1 Status-deck & plan herstructurering — 1a DONE / 1b DONE.**
  - **1a DONE:** Schema-plan-kaart (PeriodTimeline, countdown verhuisd hierheen); deck VERWIJDERD van Schema (design: Schema heeft geen deck).
  - **1b DONE:** readiness-kaart (`ReadinessCard`, export §2a) op Vorm-top; `getReadinessScore_` (objectief preset) → `state.readiness`; vervangt de oude deck-mount.
- **Fase 2 — ochtend-check-in DONE; rest van Schema open.** DONE: check-in-sheet + readiness-bijstelling (±2-model). Open: WeekLoad + stale (F.3), dag-detail-varianten, WorkoutPicker/override, RPE, rust/niet-beschikbaar + toch-trainen (F.2), multi-sessie, edge states.
- **Fase 3 Rest van Vorm:** level-kaart + niveau-grafiek + metrics + conditie-balans; **+ chart/legenda tokeniseren** (off-palette leftovers, zie contracten).
- **Fase 4 Trainingen:** bibliotheek drill-down + Inplannen.
- **Fase 5 Instellingen-drawer** (CRUD; gebruikt overlay drawer-variant). Naar voren te halen indien nodig.
- **Fase 6 Garmin-push** (leaf; incl. teal-knop tokeniseren).
- **Fase 7 Niveau** afmaken + QA-pass.

## Beslissingen & invarianten
- **Schema heeft GEEN status-deck** (design/export §1: trainingsgericht). Status-deck alleen op Vorm/Trainingen/Niveau.
- **INGETROKKEN:** ".status-card/.status-wrap niet aanraken" — ontwerp herwerkt die kaart bewust.
- **Blijven:** `google.script.run` only (geen losse fetch); tss zone-gewogen via `tssFromZoneMinutes_`; v2b-C leidt nooit `'recovery'` af; `design/tokens.css` = styling-bron; readiness = read-side (server rekent, client rendert).
- **[#3]-CORRECTIE:** client leest server-`mode` NIET. countdown = `vorm.event.dagenTot`; "Onderhoudt" = `statusVoor` (vorm/ramp). Mode read-/write-side client = toekomst.

## Hergebruik vs nieuw
- **Hergebruiken:** dagstrip, `assignWorkouts`/`voorgesteldType`, availability F.1a, `getWellnessSignal`/`getFormScore_` (readiness-factoren), niveau-block (→ Fase 3 Vorm-body), intervals.icu-sync, `ringSvg` (readiness-ring), overlay-primitive (check-in-sheet + instellingen-drawer).
- **Echt nieuw:** readiness-score + kaart (1b), check-in-sheet + opslag, WorkoutPicker + override, RPE-UI + opslag, Trainingen-bibliotheek, Instellingen-drawer, Garmin-push, edge states, stale-banner (F.3), toch-trainen (F.2).

## Live stand (geverifieerd, na Fase 0 + 1a)
- HtmlService web-app, **DONKERE skin live**. 4 tabs: `#tab-schema` `#tab-vorm` `#tab-trainingen` `#tab-niveau` + `#bottomnav` (generiek gewired). Trainingen/Niveau = inline-styled placeholders.
- Schema-top = **plan-kaart** (`planCardHtml(state.plan)`); deck weg van Schema.
- Vorm-top = nog de **oude** `statusGraphicHtml('vorm')`-deck → 1b vervangt dit door de readiness-kaart.
- Overlay-primitive aanwezig (`window.openDrawer/closeDrawer`), nog geen UI-trigger.
- Off-palette leftovers: **Vorm/niveau chart-hex getokeniseerd in Fase 3 deel 1** (gridlines waren `#eef2f7`, niet `#e2e8f0`; PMC-lijnen + formZone-banden → tokens via `cssColor_`). Resterend: teal "Push naar Garmin"-knop → **Fase 6**.
- Alles via `google.script.run`.

## Architectuur
Per-user Sheet, geen centrale backend, Apps Script. Elke server-actie = handler + Sheet-range.

## Bronnen (commit-gepinde raw-URL, nooit blob)
`design/tokens.css` (styling-bron, gemirrord in `src/Tokens.html`), `design/DESIGN.md` (taal), `design/FTP-Coach-export.md` (per-tab layout-bron), `design/screenshots/` (01-schema..07-plan-card), `design/F-beschikbaarheid.md`, **`design/INTERACTIONS.md` (interactie-contract, per-element gedrag).**

**Test-gate:** `src/SelfTest.gs` (COMMITTED, permanent — geen wegwerp-`_Diag`). `runSelfTest()` draait de pure-engine asserts en logt `SELFTEST: X passed, Y failed` + returnt `{passed, failed, failures[]}`. Run via Apps Script editor → `runSelfTest`; `clasp run` is NIET ingericht (geen `executionApi` in `appsscript.json`).

## Nieuwe contracten (Fase 0 + 1a — geverifieerd)
**Skin (0a):** `src/Tokens.html` = `<style>` + verbatim `design/tokens.css`. `src/Alias.html` = old→new `:root`-bridge + `html,body{font-family:var(--font-sans)}`. Include-volgorde Index `<head>`: fonts(IBM Plex) → Tokens → Styles → **Alias (overschrijft Styles' legacy lichte :root)**. Base-selector = `html, body` (Styles.html:17). `ringSvg` (Script.html:309) strokes via inline `style`: track `var(--ring-track)`, progress `var(--accent)`.
**4-tab-shell (0b):** hardcoded `<section id="tab-{schema|vorm|trainingen|niveau}">`. `#bottomnav` `<button data-tab="..">` (emoji-`<span>`+bare-text), generiek `querySelectorAll('#bottomnav button')→switchTab`; literal `['schema','vorm','trainingen','niveau']`; niet-actief inline `display:none`, init `switchTab('schema')`. Nieuwe secties nog zonder `class="tab"` (onschadelijk).
**Overlay (0b):** `src/Drawer.html` CSS (head, ná Alias). Markup vóór Script-include: `#overlay-scrim[data-overlay-close]` + `#overlay-panel[data-variant=sheet|drawer]` (off-screen transform, `.is-open`) + `.overlay-handle` + `#overlay-content`. `window.openDrawer({variant,html})`/`closeDrawer()`: `body.overlay-open` scroll-lock, aria-hidden, focus+restore; Esc + gedelegeerde `[data-overlay-close]`. z-index scrim 1000/panel 1001. **Basis voor ochtend-check-in-sheet (F2) + instellingen-drawer (F5).** Console-test = `userHtmlFrame`-context.
**Deck (pre-1b, nu alléén Vorm):** `statusGraphicHtml(sfx)` (Script.html:309) → `.status-wrap#swrap-{sfx}` (scroll-snap+`syncDots`). card1 = `.status-left` (`ringSvg`+`.fase-pill`) + `.status-right` (`.status-word`/`.status-verdict`); card2 `.niveau-block`. `renderVormStatus`→`#vorm-status`. `statusVoor(v)` (Script.html:287) = FUNCTIE→labelstring (leest `v.huidig.vormZone`/`ramp`, `v.rampBuildMin`), geen object.
**Readiness-data (server, read-side — 1b-input):** `getFormScore_`→`{date,ctl,atl,form,ramp,label}`. `state.vorm.huidig`=`{vorm,vormZone,ctl,atl,ramp}` (WebApp.gs:471) + `vorm.macroFase/ftp/rampBuildMin`. `getWellnessSignal` (Algorithm.gs:888)→`{hrvBaseline(28d),hrvRecent(3d),sleepLastNight,sleepAvg3,hrvDeficit%}`. Wellness-tab (Algorithm.gs:900): A=Datum B=RHR C=HRV D=Slaap; baselines computed; cadans `getWellness(30)` bij `syncAll`. **Check-in (ochtend, benen/stress/slaap) = AFWEZIG** (future); `rpeAvondCheck` (Telegram) = avond-RPE, los.
**Plan-kaart (1a, live):** `buildPlanModel_(macro, settings)` (Doel.gs) → `state.plan` (WebApp.gs, na `mode`) = `{modeLabel, eventName, wekenTot, dagenTot, currentPhaseKey, currentPhaseLabel, phases:[{key,label,state}], events:[{naam,prio,type,dagenTot}], volume:{label,value}|null}`. Hergebruikt `bepaalFaseVoorDatum_(weekStart)`→`{fase∈Base/Build/Peak/Taper/Recovery, wekenTotEvent, eventDriven, eventName, eventDate}`, `computeMacroPhase(start,today)`→`{week,fase∈Base/Build/Peak/Test,isTestWeek}`, `getAllEvents_`, `getVolumeTargets()[fase]=[min,max]u/wk`. NL-labels Basis/Build/Peak/Taper. `planCardHtml(plan)` (Script.html, `<details>`, default dicht); CSS in Styles.html. Edge: Test→Taper-bucket(idx3), Recovery→alle-4-past (geen current-marker) — herzien als 't leeg oogt.

## 1b — bouwspec (DONE — contracten in KLAAR hieronder)
Vorm-top `ReadinessCard` (export §2a), vervangt `renderVormStatus('vorm')`→`#vorm-status`-mount.
- **Server** `getReadinessScore_` (combineert `getWellnessSignal`+`getFormScore_`) → `{score 0–100, band(ready/caution/rest), factors:[{key,label,value0-100,status:good/warn/muted}], chips:[{label,tone}]}`. Gewichten als named constant (presets objectief/gebalanceerd/subjectief; default objectief = 0,30/0,30/0,25/0,15). Normaliseer per factor (vorm-trend uit form/TSB, belasting uit ramp/ATL-CTL, HRV uit hrvDeficit/baseline, slaap uit sleepAvg3/need). Expose via getDashboardState (bv. `state.readiness`).
- **Client** `readinessCardHtml`: overline "Status · vandaag"; `ringSvg` gekleurd naar band (`--readiness-ready/caution/rest`, track `--readiness-ring-track`, center `--font-num`); verdict + chips ("Vorm +n" `--fresh/--fresh-soft`, "HRV n" `--text-muted`); "Waarom dit cijfer?"-expander → factor-lijst met status-dots. Onder: gestippelde "+ Ochtend-check-in invullen"-prompt — capture is TOEKOMST. niveau-block valt uit Vorm-top (herbouw = Fase 3).
- STAP 0-recon: `renderVormStatus`/`#vorm-status`-mount, `getWellnessSignal`/`getFormScore_`-shapes, getDashboardState-assembly, `ringSvg`-kleurparam.

## Open punten / tech-debt (post Fase 3c)
- **VISUELE VERIFICATIE OPENSTAAND** voor 1b + check-in + 3a/3b/3c — de Claude Code-agent had geen gekoppelde browser, dus alle pushes zijn logisch geverifieerd + `clasp`-compile, NIET visueel op /dev. Daan: incognito + hard refresh-pass.
- **WeekLoad `stale`** = hardcoded `false` (F.3-signaal bestaat nog niet) — implementeren wanneer er een "plan verouderd"-detectie is.
- **"Doe iets anders" / WorkoutPicker** bewust NIET gebouwd in 3a (geen backing, geen dode knop) — future.
- **Dispositie-besluit:** `saveDisposition` doet bewust géén `generateProposal` (read-side overlay) om "inhalen" via debt te vermijden. Herzien als inhalen ooit wél gewenst is.
- **Fase 3 deel 3 (uitgesteld):** conditie-cluster → **Balans-meter** (§2e); verwijdert de PMC-grafiek (`drawVormChart`) + "Vorm in context"-strip (`drawVormStrip`) + legacy `.metric`-tegels (`vorm-huidig`/`vorm-stats`) + volume-kaarten + de `#period-toggle` 7d/28d/jaar-toggle.
- **Fase 3 deel 4 (uitgesteld):** Vorm swipe-deck + LevelCard-uitbreiding (tier-chip / %-blok / delta).
- **Garmin-push** nog week-niveau (geen per-dag `GarminSync`-knop) → Fase 6.

## Volgende stap
1. Verifieer Fase 3 deel 1+2 (LevelCard/MetricRow/chart-tokens + niveau-AreaChart/toggle/value-delta-header/gridlines) visueel op /dev (incognito). 2. Daarna: Fase 3 deel 3 (conditie → Balans-meter; verwijdert PMC/strip/legacy-tegels/volume/period-toggle) + deel 4 (swipe-deck + LevelCard-uitbreiding), of Trainingen (Fase 4).

---

## Historie & engine-referentie (bruikbare historie — overleeft de restyle)

### KLAAR (done sinds bbd1a6b)
- **Fase 3 deel 2b — gridline render-fix (bf98957):** `vAxis/hAxis.gridlines.color` was al gewired naar `cssColor_('var(--chart-grid)')` (prompt-hypothese "niet gewired" weerlegd). Hard-wit kwam doordat Google Charts de `rgba(255,255,255,0.05)`-alpha NIET honoreert (rendert opaque/bright) + `minorGridlines` stond ongezet (default-licht). Fix: `--chart-grid` → solide `var(--border-subtle)` (beide token-bestanden) + `minorGridlines:{color:'transparent'}` + `baselineColor`=`--chart-grid` op beide assen van `drawNiveauChart`. **Token-vs-render-afwijking:** ontwerp wil 5% white; Charts dwingt solide af (ontwerp-token later reconciliëren). `drawVormChart` (PMC) erft de solide major-gridline via het token; minor niet apart gefixt (verdwijnt in deel 3).
- **Fase 3 deel 2 — niveau-grafiek §2c afgemaakt (5f9f77d fix / 0b0ddb9 feat; 1e pass 0301fa8/b72db9c):** `drawNiveauChart` = **AreaChart** (accent-area `areaOpacity:0.26`, lijn `lineWidth:2.5`, "nu"-punt via style-role fill `--accent`), x-labels `--text-secondary`, y-as `--chart-axis`, gridlines+baseline beide assen via `cssColor_`. **Gridline-fix:** `--chart-grid` = `rgba(255,255,255,0.05)` (literal, beide token-bestanden) — de eerdere `color-mix(white)` gaf via getComputedStyle een `color()`-vorm die Charts niet parsete (+ hAxis stond op Google-default ~`#CCC`). `.seg` segmented `1M/6M/12M/Alles` → `niveauReeksWindow_` slice `-2/-7/-13/all` (default Alles); value/delta-header `renderNiveauHead_` (value = laatste-in-venster NL-komma; delta = laatste−eerste: "+x,x ↑"/"−x,x ↓"/"±0,0", `--good/--bad`); empty (<2 punten) → "—" + geen toggle. Mount `#niveau-head`; los van `#period-toggle`/`statPeriod`. Geen server-calc → geen gate-case. **Google Charts-limieten:** geen gradient-fade (flat 26%), lijn-caps niet rond, "nu"-punt zonder stroke-ring. **Gereconcilieerd tegen `INTERACTIONS.md` §Vorm-analyse** (toggle READ·💻 + delta-redraw + verborgen-bij-eerste-keer; NiveauChart → EmptyChart bij eerste keer) — geen deviatie. NB: LevelCard hoort per INTERACTIONS.md in een swipe-deck (kaart 2) → deel 4.
- **Fase 3 deel 1 — Vorm LevelCard + MetricRow + chart-tokenisatie (e8fbbb1 tokens / 2d2f356 feat):** `levelCardHtml(state)` (niveau/50 + chip `beginLabel` + W/kg + `--accent-grad`-balk + `niveauDelta`; rc-skin; mount `#vorm-level` onder ReadinessCard) + `metricRowHtml(state)` (FTP/Gewicht/Week-TSS uit `state.ftp`/`gewicht`/`weekLoad.tss`; 3a-skin; `#vorm-metrics`). Body herschikt naar export §Vorm: ReadinessCard → LevelCard → niveau-grafiek → MetricRow → conditie-balans (cluster intern ongewijzigd verplaatst; section-kop hernoemd "Trend & details"→"Conditie-balans"). Chart-hex getokeniseerd via `cssColor_(expr)` (Google Charts kent geen CSS-vars → probe-resolve): trend-lijnen → nieuwe `--chart-fitness/fatigue/form` (COMPONENTS-laag, beide token-bestanden), niveau-lijn → `--chart-line`, grid → `--chart-grid`, baseline → `--chart-axis`; `drawVormStrip` banden/strokes/legenda → `--info/good/accent/danger-soft` + `--text-*` via `style="fill:var()"`. Geen nieuwe server-calc → geen gate-case. NB: dot-drempel live = **67/34**.
- **Test-gate — runSelfTest (5f71045):** `src/SelfTest.gs` (COMMITTED). Pure-engine asserts: `tssFromZoneMinutes_`, `checkinDelta_`/`CHECKIN_LEVELS`, `rdyClamp_`, `computeNiveau_` (incl. clamp 0/50 + null), `computeMacroPhase` (Base/Build/Peak/Test + isTestWeek op week-offsets), `getReadinessScore_` factor-dots op de **LIVE drempel 67/34** + missing-factor-rescale (geen harde nul) + band↔score-consistentie (62/48, check-in-robuust), `READINESS_PRESETS`. GEEN side-effects (alleen fixtures + constanten-reads). Uitgesloten want gekoppeld: `bepaalFaseVoorDatum_` (leest Events-tab + Settings; Taper/Recovery-edges). `runSelfTest()` → Logger + `{passed,failed,failures[]}`. NB: dot-drempel **67/34** is live; de "≥70/45" in de readiness-formule-sectie is de oude pré-build-spec.
- **Fase 3c — web-RPE + skip-dispositie (8b2d735):** `saveRpe(dateISO, rpe)` schrijft `rpe_<date>` (1–10) — spiegelt `handleRpeCallback` (DocProps-only, GÉÉN intervals-POST). Client `rpeRatingHtml_` (1–10 knoppen op `actualKaart`, gekozen = `--accent` + `--accent-ring`) → `setRpe`; mismatch → `.rpe-feedback` (`--accent-soft`). `saveDisposition(dateISO, reason∈{geen_tijd,bewust_gerust,iets_anders})` schrijft `disposition_<date>` {reason,ts}; `null` wist (voorstel terug). **GÉÉN generateProposal** bij disponeren (zou via debt "inhalen" + vandaag's voorstel herleven) — read-side overlay: `dashDispositionsByDate_` → dag-status `'gemist'` als dispositie ÉN voorstel ÉN geen actual. Client: affordance "Niet gedaan?" (≤vandaag, gepland, geen actual/rust, niet gedisponeerd), `gemistKaart_` (+ "Terug"), dagstrip-`×`-marker (`--text-muted`).
- **Fase 3b — WeekLoad-kaart (6ff4b47):** `getWeekLoad_(ss, weekStart)` → `state.weekLoad {tss, uren, dagen, geplandTss, progressPct, stale}`. DONE tss/uren/dagen uit Activiteiten-tab (cycling, venster [weekStart,+7d); idx1 Type / idx3 Duur / idx8 TSS), noemer = Σ `weekplan_<maandag>` entry.tss. `stale=false` (F.3-signaal bestaat nog niet, TODO). Client `renderWeekLoad(iconState)` op mount `#week-load` (Index.html, tussen plan-kaart en dagstrip): overline + icon-refresh (idle ↻ / busy spin / done ✓), stat-rij + progress-bar (`--accent-grad`) + stale-banner. Refresh → nieuwe web-fn `refreshWeek()` = `syncActivities()` + verse state (lichter dan regenerateWeb, géén herplanning).
- **Fase 3a — Schema dag-detail skin + opruiming (8c05a1f):** workout-kaart naar skin (`voorstelKaart`/`actualKaart` → `.wk-*` classes; `zoneBar(seg, mini)` kleurt via zone-tokens `--zone-1…6` op `bucket`, niet meer server-hex; multi-sessie → sunken `.wk-sub` sub-kaarten met `wk-minibar`). VERWIJDERD uit `renderDagDetail` 'vandaag'-tak: groene readiness-banner (`v.gereedheid`) + "Garmin-verwachting"-regel (`v.garminStatus.verdict`) — readiness leeft op Vorm. Knoppen: `.act-btn-2` (Garmin) teal→`--btn-secondary-*`, `.act-btn` (Regenereer) → `--btn-primary-*`. NIET toegevoegd: "Doe iets anders"-knop (WorkoutPicker = future, geen dode knop); IF-metric weggelaten (niet in model). Plan-kaart + dagstrip ongemoeid.
- **Fase 2-kern — ochtend-check-in + readiness-bijstelling (a5d0b43):** `saveCheckin(slaap,benen,stress)` schrijft DocProp `checkin_<dISO>` (JSON {slaap,benen,stress,ts}) → herberekende readiness (zelfde shape). `getTodayCheckin_`/`checkinDelta_`/`checkinSummary_`; `CHECKIN_LEVELS` ±2/0 per vraag (slaap slecht/oké/goed · benen zwaar/oké/fris · stress hoog/normaal/laag), somdelta −6..+6 geklemd op de objectieve base-score (GEEN herweging, GEEN 5e factor). Client: `checkinSheetHtml` (overlay sheet via openDrawer, segmented controls, default neutraal), auto-open bij `checkinDone:false` (1×/load, dismissbaar), ingevuld-staat `checkinDoneHtml_` (summary + ronde +-knop + effect-callout). `state.readiness` += `checkinDone/checkinDelta/checkinSummary/checkin`.
- **Fase 1b — Vorm ReadinessCard (6e1b7a9):** `getReadinessScore_(fs,wellness,reeks)` (Algorithm.gs) → `state.readiness {score,band,factors[],chips[]}`, objectief preset `READINESS_PRESETS` (0.30/0.30/0.25/0.15). Normalisatie: vorm-trend TSB −30→+10 + richting-nudge ±10; belasting ATL/CTL 1.5→0.8 (0.6) ⊕ ramp 10→0 (0.4); HRV deficit% −15→+5; slaap 5u→8u. Banden ≥62/48; dot ≥67/34. Client `readinessCardHtml`+`readinessRing_(score,colorVar)` vervangt `renderVormStatus`-mount `#vorm-status`; `.rc-*` CSS. Niveau-block uit Vorm-top (LevelCard = Fase 3).
- **Fase 1a — Schema plan-kaart (8c774da server / 5ff0219 client):** buildPlanModel_→state.plan; planCardHtml (collapsible) vervangt deck-mount op Schema. Detail: zie "Nieuwe contracten".
- **Fase 0b — 4-tab-shell + overlay (3fb917f / ad31aa9):** Trainingen/Niveau containers, switchTab 4-tabs; window.openDrawer/closeDrawer (sheet/drawer) via src/Drawer.html.
- **Fase 0a — dark skin-flip (48ba640):** src/Tokens.html + src/Alias.html, IBM Plex, ring→tokens.
- v2b-B multi-session (2f5a645 feat, 7f6c9a6 docs): per-sessie proposal-keys — base = proposal_<dISO> (s1), extra = proposal_<dISO>_s<n> voor n>=2. external_id: s1 = coach_<dateISO>_ride, n>=2 = coach_<dateISO>_ride_s<n>. Distinct start_date_local (s1 07:00, last 17:00; n>=3 12/19/06h). Single-session events ook verschoven 00:00->07:00 (idempotent via ongewijzigd external_id). Settings PENDEL_DUUR (rij 52, default 80) + PENDEL_AANTAL (rij 53, default 2). Key-format leeft UITSLUITEND in readDaySessions_/writeDaySessions_/deleteDaySessions_ (Algorithm.gs). computeWeekVolumeMin_ sommeert sessies.
- Asymmetrische pendel-intensiteit (9af34fc): sessies 0..N-2 geforceerd pendel_z2; laatste = d.voorgesteldType. genericPendelZ2(mins, settings, mesoWeek, macroFase); recovery-predikaat mesoWeek===4 || macroFase==='Recovery' maakt de "recovery week"-tekst conditioneel.
- Per-sessie kaarten (eab1591/7f076dc/7ee851f): sessies[]-entries {naam, totaalMin, tss, intent, eindopmerking}. dashDayCard_ → voorstel.sessies bij length>1; voorstelKaart → N kaarten via sessieKaart_.
- TRIP-EVENT key-type (HEAD 1e72d6d): trigger isTripEvent (type==='trip'), Build/Peak only. Free-day → 'long_z2' (na climbTypeWorkout_, vóór doel-tak); commute → token 'pendel_trip_intervals' → genericPendelIntervals sweet-spot/tempo. DEMOTE_MAP += pendel_trip_intervals→pendel_z2.
- ITEM C zone-gewogen tss + variant endurance-fill (HEAD 5efd8a6): tssFromZoneMinutes_({low,high,anaerobic}) = round(low*0.7+high*0.95+anaerobic*1.05) = ENIGE rate-bron. renderVariant_ endurance-fill (gap>=5 → Z2-blok, telt als low). genericLongZ2/genericPendelIntervals zone-gewogen. IF daalt nu met duur. CALIBRATIE-NOTITIE: pendel-werkMin VO2max=14@anaerobic < FTP=28@high — eerste tweak-kandidaat, geen blocker.
- [#3] mode-object SERVER-side exposed (commit 381f68d): top-level `mode { eventDriven, macroPhase (Base/Build/Peak/Taper/Recovery), seasonMode (build/maintain), weeksToEvent }` in getDashboardState, uit `bepaalFaseVoorDatum_` (`macro.fase`) + `settings.fase`. LET OP: de CLIENT leest dit NIET (zie [#3]-correctie hierboven); read- én write-side client = toekomst.

### Eerdere milestones
- v2a (521ed24): beschikbaarheid-write-pad — saveAvailability schrijft Weekplanner A3:H9, returnt vers getDashboardState → onState.
- v2b-A (d680037): in-app regenerate + push. pushWeb() = UITZONDERING: returnt {pushedCount,skipped,errors}; onPushResult re-rendert NIET via onState.
- v2c (22c5a30): per-dag rationale (reden) in voorstelKaart, onderdrukt zodra er een actual is.
- v2d (96c57a3): runs = vermoeidheid, niet cycling-fitness — gates op rollingZoneCoverage (r[1]) + computeZoneDebt_ (a.type); recentHardDayDate_ ONGEMOEID (run-inclusief).

### Bestaande stabiele features
Schema-tab: swipe-deck (ring+verdict / niveau-blok). Vorm-tab: niveau-over-tijd grafiek (server dashNiveauReeks_ → payload vorm.niveauReeks, client drawNiveauChart). niveau = clamp(niveauBasis + conditieMod, 0, 50); niveauBasis = computeNiveau_(ftp, gewicht).

### Engine-gedrag (geverifieerd)
- generateProposal: geen args; draait ensureDataAndReconcile_ → syncAll; leest readPlanner live; her-plant alleen tePlannen (train && !gedaan && datum >= vandaag); voltooid behoudt voorgesteldType; schrijft per dag 1..N sessies proposal_<dISO>[_s<n>] + weekplan-aggregaat. Geen auto-regen — alleen menu (Code.gs:44) of web-knop (WebApp.gs:604).
- assignWorkouts: typekeuze per dag uit dagtype + fase + debt/dekking + wellness; minuten schalen alleen de duur, niet het type.
- avoid-consecutive-hard: alleen dag N-1 (calendar), downgradet hard → long_z2; geen N+1-vooruitblik; geen rust-INVOEGING op load.
- recentHardDayDate_ (Algorithm.gs:230): leest Activiteiten-tab actuals, hard op IF >= 0,85 — incl. ongeplande ritten en runs.
- dekking (rollingZoneCoverage, 7d): actuals-bewust; alleen CYCLING_TYPES.
- debt (computeZoneDebt_): alleen dagen met train && gedaan; alleen CYCLING_TYPES. ASYMMETRIE (open): ongeplande ritten zitten wel in dekking, NIET in debt.

### Data & sleutel-functies
Actuals in Activiteiten-tab via syncActivities ← getActivities (intervals.icu; GEEN sport-filter in de sync; Type = idx1 / r[1] / a.type). ACT_HEADERS = 15: Datum idx0, IF idx7 (kolom 8), TSS idx8 (kolom 9), FTP idx12, Gewicht idx13, Rolling FTP idx14. ACT_HISTORY_DAYS = 730. CYCLING_TYPES (Algorithm.gs:42) = Ride/VirtualRide/GravelRide/MountainBikeRide.
Push: pushAllPending_ core / pushAllPendingWorkouts wrapper (Sync.gs); pushEvents_ → POST /events/bulk?upsert=true; external_id = coach_<dateISO>_ride (s1), n>=2 = ..._s<n> (IntervalsApi.gs). Settings: readSettings/loadSettingValue + sheet 'Instellingen' (SETTINGS_SHEET). DAGTYPE_OPTIONS = pendel/vrij/weekend/recovery. Weekplanner A3:H9 (readPlanner): A=Train? D=Minuten E=Dagtype F=Toelichting H=Gedaan?.

### Code-invarianten (engine — overleven de restyle)
- Multi-session: proposal-key-format UITSLUITEND via readDaySessions_/writeDaySessions_/deleteDaySessions_. external_id s1 kaal, n>=2 suffix _s<n>; upsert=true keyed op external_id.
- Pendel-compositie: eerste N-1 sessies = pendel_z2, laatste = d.voorgesteldType.
- sessies[]-shape {naam, totaalMin, tss, intent, eindopmerking}; reden is dag-niveau (d.reden), niet per sessie.
- TRIP: keyIntensity-volgorde Taper → Recovery → climbTypeWorkout_ (Build/Peak) → trip (long_z2) → doel-tak; trip-tak NOOIT vóór Recovery of climb. Pendel-recovery via DEMOTE_MAP (nieuw pendel-key-type MOET DEMOTE_MAP-entry → pendel_z2). workoutZones: pendel_trip_intervals gepind ['low','high'] (1309); pendel_z2 gepind ['low'] (1303). Twee dag-smaken: pendel-dag → token-pad (731), normale dag → keyIntensity (765).
- TSS: tss ALTIJD via tssFromZoneMinutes_; per-zone-minuten uit bestaande intent (renderVariant_/genericLongZ2:1860), warm+cool al in intent.low (niet opnieuw invouwen). Begrensde key-set: extra duur → Z2 (fill-floor 5 min), NOOIT meer reps.
- Opruim-kandidaat (niet urgent): vorm.macroFase (WebApp.gs:476) overlapt met top-level mode.macroPhase → out-of-sync-risico.

## Durabele lessen
Zie CLAUDE.md. Kort: visueel verifieren op /dev (incognito + hard refresh); write-pad-patroon = google.script.run → serverfn returnt vers getDashboardState → onState (behalve pushWeb); NL-locale-formules bij setFormula (komma decimaal + puntkomma separator) — nu n.v.t. (writes zijn waarden/JSON), relevant zodra een write formules raakt; STAP 0-recon + 200-woorden rapport-cap.
