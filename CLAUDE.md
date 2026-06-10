# FTP Trainings Coach

Custom training-tool voor Daan (en uitrolbaar voor fietsende vrienden).
Leest intervals.icu-data, genereert wekelijkse trainingsvoorstellen en
pusht structured workouts (ZWO) naar Garmin Epix. Frontend = read/write
HtmlService web-app (dashboard) bovenop Google Sheets.

> **STAND / roadmap / openstaande draden → [HANDOFF.md](HANDOFF.md).**
> Dit bestand bevat ALLEEN de durable laag (werkwijze + conventies +
> architectuur + invarianten). HANDOFF.md = de actuele projectstatus;
> roadmap NIET hier dupliceren.

## Tech stack

- Google Sheets + Apps Script (.gs) — primair platform, geen alternatief
  (geen Excel, geen server-based oplossing). Python alleen voor preprocessing.
- HtmlService web-app (Index/Script/Styles.html) — dashboard, read + write.
- intervals.icu API (Basic auth via base64 API key).
- Garmin Connect (via intervals.icu sync).
- ZWO XML voor structured workouts naar Epix.
- Telegram bot (`doPost` webhook) — 2-way interactie.

## Locaties

- GitHub: daanhhk/training
- Apps Script: 18Q5UXRSUU1ZVIWnkeXg6_HnejuVh-G-DIoqVIJbFxRP22irbc_err-CN
- Sheet: 1YTgfkwehC1VJKo-MZTYDRJ_6e6SrjT3auMmHfD97ozA
- Lokaal: C:\Users\daan\Projects\training
- Web-app /dev deploy-URL: zie HANDOFF.md

## Werkwijze & communicatie

Twee-laags: **claude.ai-chat** = ontwerper/prompt-schrijver; **Claude Code
(CLI lokaal)** = uitvoerder.

- Daan plakt NOOIT code. Alles loopt via Claude Code + `clasp push -f`.
  Diagnostiek via read-only `_Diag.gs` (gitignored — niet committen,
  opruimen na gebruik); een diag die zijn bevindingen RETOURNEERT kan nu via
  `clasp run-function` draaien (geen editor-plak meer nodig).
- Close-out van ELKE wijziging: `clasp push -f` (Apps Script → direct live
  op /dev, geen redeploy) **én** `git push` (GitHub). CLAUDE.md en
  HANDOFF.md gaan via **git, NIET clasp** (geen Apps Script-bestanden, niet
  in src/).
- Elke prompt start met **STAP 0-recon**: de chat zet aannames, Claude Code
  verifieert die tegen de ECHTE code (functies/signatures/literals) vóór
  bouwen, en meldt afwijkingen.
- **Rapport-cap**: MAX 200 woorden proza. Literals (bestand/functie/regel/
  key/commit-hash) exact en tellen niet mee. Geen code-dumps, geen
  prompt-herhaling, afwijkingen expliciet melden.
- **Test-gate (self-enforced)**: elke wijziging draait `node test-gate.mjs`
  (= `clasp push -f` + remote `clasp run-function runSelfTest`) vóór commit;
  geen commit tenzij groen (`failed==0` én `passed>=BASELINE`). De oude
  handmatige editor-loop is VERVALLEN. Detail → §"Werkwijze — autonome CC-loop".
- Mobiel-signaal "ik zit op mijn telefoon" → lever prompts als PLATTE TEKST,
  geen triple-backtick-blokken (slecht plakbaar op telefoon).
- **HANDOFF.md = bron van waarheid voor de STAND** (chat leest die).
  **CLAUDE.md = conventies + architectuur** (auto-load, durable).
- **HANDOFF-item-lifecycle**: elk engine-item leeft in precies ÉÉN van
  BACKLOG / VOLGENDE / KLAAR. Bij promotie naar VOLGENDE of voltooiing naar
  KLAAR: VERWIJDER het uit BACKLOG. BACKLOG = uitsluitend nog-niet-gestart —
  voorkomt stale dubbelingen.
- Taal: NL met Daan; English voor code/commits/logging; NL voor UI-strings.

## Werkwijze — autonome CC-loop

**Test-gate (self-enforced).** Elke wijziging draait door `node test-gate.mjs` vóór
commit: pusht de huidige source (`clasp push -f`) + draait de selftest remote
(`clasp run-function runSelfTest`), parset de envelope `{ failures, passed, failed }`, en
exit non-zero als `failed > 0` OF `passed < BASELINE`. Geen commit tenzij de gate exit 0
geeft. BASELINE (479) is een VLOER: nieuwe testcases (hoger `passed`) breken de gate
niet; verhoog BASELINE alleen om te ratelen ná een feature die tests toevoegt. De oude
handmatige selftest-loop (Daan draait `runSelfTest` in de editor) is VERVALLEN.

**Mission-scoped prompts.** Een prompt = doel + acceptatiecriteria + expliciete
toestemming om binnen scope te itereren + no-go-zones. Vaste no-go's (raken =
stop-and-ask): Deck CSS (`.status-card`/`.status-wrap`), token-mirror (`design/tokens.css`
↔ `src/Tokens.html` byte-identiek, geen off-palette hex), calc-consolidation
(`dashStatsFromActivities_` c.s. — eigen hoog-risico-sessie).

**Stop-and-ask.** CC stopt en vraagt (format: situatie / opties / aanbeveling /
trade-off) bij: design/UX-ambiguïteit → Claude Design; een fragile/locked zone;
selftest niet groen na ~3 pogingen; een niet-gelockte architectuurkeuze; iets met een
credential. Bij twijfel: stoppen boven improviseren.

**Run-log (autonome runs).** Rapporteer: gedraaide stappen, gate-uitslag
(`passed`/`failed`), commit-hash(es), eerlijke afwijkingen. Max 200 woorden prose;
literals (bestandsnamen/hashes/URLs) los + exact; plain text óf één code-blok.

**Handmatig blijft: visuele /dev-verificatie.** CC heeft geen browser → visuele
checkpoints doet Daan op /dev. Krimp die stap via (a) meer pure-function-dekking onder de
gate, (b) visuele checks batchen aan einde-feature, (c) deterministische demo-states
(rdydemo-stijl) voor toestanden zonder live-trigger.

## Design — bron van waarheid

**Claude Design is de ENIGE bron voor visueel design.** In de repo (`design/`):
`tokens.css` (styling-tokens), `FTP-Coach-export.md` (per-tab layout +
componenten + states), `DESIGN.md` (visuele taal), `INTERACTIONS.md`
(interactie-contract: per-element READ/WRITE + 💻client/🌐server-gedrag), en
`screenshots/`. `tokens.css` is verbatim gemirrord in `src/Tokens.html`
(= wat live geserveerd wordt).

- **Het ONTWERP is leidend.** Bestaande functies bouwen we erin; bij een
  live-vs-design-conflict wint het ontwerp.
- **UI-build-loop** (UI-specifieke STAP 0-recon — zie Werkwijze): lees vóór de
  build de relevante `FTP-Coach-export.md §X` + `INTERACTIONS.md §X` +
  `tokens.css`, reconcileer de implementatie ertegen, en meld de afwijkingen
  (kleur / token / layout / gedrag) VÓÓR je
  bouwt. Bouw naar de exacte ontwerp-token-namen/-waarden + -gedrag: verzin
  geen waarden en overrule het ontwerp niet.
- **Token-discipline:** `design/tokens.css` ↔ `src/Tokens.html` = styling-bron;
  GEEN off-palette hex in de UI. Google Charts kent geen CSS-vars → resolve
  tokens op draw-tijd via `cssColor_` (CSS-var → concrete kleur).
- **Self-heal:** corrigeer stale feiten (verschoven regels, achterhaalde
  hex/token, ingetrokken invarianten) die je tijdens een taak in HANDOFF.md of
  CLAUDE.md tegenkomt.
- **Nieuwe tabs = DESIGN-FIRST:** Schema + Vorm zijn af; Instellingen + Training
  (en verdere schermen) eerst in Claude Design / canvas 424c9d ontwerpen, dán
  bouwen. NB: `export.md` loopt achter op de canvas (dag-detail-viz/staaf +
  inline-metrics kwamen uit 424c9d) → reconcile bij gelegenheid.

## Conventies (HARD-EARNED — niet zelf herontdekken)

### NL-locale Google Sheets formules (bij ELKE setFormula-write)
- KOMMA als decimaal EN PUNTKOMMA als argument-separator: `=ROUND(B3*0,55;0)`.
- `setFormula()` doet GEEN locale-conversie. JS-Number interpoleert met "."
  → altijd `.replace('.', ',')` of via `nlNumber()` (Utils.gs). Genereer
  complete, hardcoded formule-strings.
- Zone max-watt: FLOOR (niet ROUND) voor parity met intervals.icu.
  Z3 max @ 90% = FLOOR(247.5) = 247W.
- Boundary: zone N min = zone N-1 max + 1 (parity). Z2 = 56-75%.

### intervals.icu API quirks
- Base URL `https://intervals.icu/api/v1` (`INTERVALS_BASE_URL`). Auth:
  `Basic ` + base64(`API_KEY:<api_key>`).
- `/events` NEGEERT embedded `workout_doc` (slikt zonder error). Voor
  structured workouts → `file_contents_base64` met ZWO XML.
- DSL-in-description werkt voor de intervals.icu UI-chart, maar Garmin krijgt
  dan ALLEEN TEKST (1 lap). Multi-step op Epix = alleen via ZWO.
- Idempotent push: `external_id` + `POST /events/bulk?upsert=true` (geen
  aparte delete).
- Garmin-sync: athlete-toggle "Upload workouts to Garmin"
  (`icu_garmin_upload_workouts: true`) MOET aan.

### Zone-data quirks
- `sportSettings[Ride].hr_zones` = RAW BPM. Power zones = % FTP. Niet mixen.
- `icu_sweet_spot_min/max` op athlete = vaak NULL; aanwezig op activity met
  power. Fallback 84/97.
- 999 in zone-array = onbegrensd → render als ∞.

### Code-stijl & Apps Script gotchas
- Engelse code + commits; Nederlandse UI-strings.
- `setItalic()` bestaat NIET op Range → `setFontStyle('italic')`.
- `setFrozenColumns()` conflicteert met merged title-rows over alle kolommen.
- Column widths als LAATSTE stap (na `SpreadsheetApp.flush()`) — anders
  overschrijven merge/write dit.
- `getLastRow()` onbetrouwbaar bij ARRAYFORMULA-tabs → scan kolom A voor
  eerste lege cel.
- Sheet-tab-rendering toont pas effect NA `🚴 Coach → Bouw alles opnieuw`;
  pure clasp-push is niet genoeg. (Web-app /dev reflecteert clasp-push WEL
  direct.)
- Dedup: Date-object vs text-string consistent typen.
- ARRAYFORMULA + dropdown-validation kan imports crashen — let op
  reset-volgorde; column count in sync houden met script-logica.
- **Favicon in HtmlService:** `setFaviconUrl` ondersteunt GÉÉN SVG → THROWT
  ("afbeeldingstype wordt niet ondersteund") en crasht zo `doGet` — het faalt
  NIET stil. Werkend = PNG + host met correct content-type (raw.githubusercontent
  = `text/plain` → genegeerd; jsDelivr = `image/png` → werkt). Wikkel
  `setFaviconUrl` ALTIJD in try/catch zodat een slecht icoon `doGet` nooit plat legt.

### Performance (GAS)
- **PERF-MEETDISCIPLINE:** execution-timing is high-variance; per-run-deltas
  <~1s zijn onbetrouwbaar onder load. Meet op off-peak; gebruik een
  pure-compute-functie (`getTrainingLibrary_` §3) als CPU-canary om server-load
  te detecteren (~650ms kalm vs >1100ms belast). Verifieer perf-refactors
  STRUCTUREEL (read-tellingen + selftest + /dev), niet puur op de klok.
- **READ-ONCE-THREAD-PATROON:** om redundante Sheet-reads/API-calls in een
  assembly-functie (bv. `getDashboardState`) te collapsen: geef consumenten een
  OPTIONELE TRAILING-param (de voor-gelezen array/data), default = huidig
  zelf-lezen/live-pad. De assembly leest 1× bovenaan en threaded door. Alle
  andere callers + `runSelfTest` blijven byte-identiek.

### Security
- API-keys NOOIT in chat. Bij blootstelling: meteen regenereren
  (intervals.icu Developer Settings).
- Alle secrets (API key, Telegram token/chat-id/webhook-secret, deploy-URL)
  in DocumentProperties via Secrets.gs (`SECRET_KEYS`). NOOIT in cellen, code
  of commits.

## Bestandsstructuur

Web-app laag:
- src/WebApp.gs — `doGet` (dashboard-template), `getDashboardState`,
  write-pad serverfns (`saveAvailability` / `regenerateWeb` / `pushWeb`),
  niveau-calc (`computeNiveau_`, `computeConditieMod_`, `dashNiveauReeks_`,
  `dashBeginAnker_`, `dashStatsFromActivities_`).
- src/Index.html — HtmlService-template (alleen includes + tab-markup).
- src/Script.html — client-JS (boot/loadState/onState/render*/switchTab/charts).
- src/Styles.html — CSS (incl. fragiele status-CSS — zie invarianten).

Domein-laag (.gs):
- src/Code.gs — menu + onEdit handlers + Setup-UI.
- src/Settings.gs — DocProps-settings + Instellingen-tab (`SETTINGS_SHEET`,
  `readSettings`, `loadSettingValue`).
- src/Secrets.gs — secret-laag (DocumentProperties, legacy-cel-migratie).
- src/Zones.gs — Zones-tab (power + HR + Sweet Spot).
- src/Doel.gs — 12-week mesocyclus + macro-fase + event-fase.
- src/Events.gs — Events-tab (race/trip-kalender met profiel; stuurt
  periodisering + klim-type-selectie).
- src/Planner.gs — Weekplanner-tab + `readPlanner` + `DAGTYPE_OPTIONS`.
- src/Algorithm.gs — `generateProposal`, `buildWorkout`, `getWellnessSignal`,
  `buildWorkoutZwo_`.
- src/Proposal.gs — Voorstel-tab rendering (`renderProposal`).
- src/IntervalsApi.gs — intervals.icu API (`intervalsRequest_`, `pushEvents_`,
  `getActivities`, `getWellness`).
- src/Sync.gs — `syncAll` orchestratie + `syncActivities` +
  `pushAllPending_` / `pushAllPendingWorkouts`.
- src/Activiteiten.gs — Activiteiten-tab (`ACT_HEADERS`).
- src/Wellness.gs — Wellness-tab.
- src/TelegramBot.gs — `doPost` webhook + command-router + audit/dedupe.
- src/Email.gs — stub (dagelijkse digest, nog te implementeren).
- src/Utils.gs — helpers (`nlNumber`, sanitize, datum, DocProps).
- src/Workouts/{Ftp,Vo2max,Conditie,Beklimmingen}.gs — workout-libraries.

## Web-app architectuur (geverifieerde literals)

Twee web-entrypoints: `doGet` (dashboard, WebApp.gs) + `doPost` (Telegram
webhook, TelegramBot.gs).

**Boot / read-pad:**
- `doGet` → `HtmlService.createTemplateFromFile('Index').evaluate()`
  (+ `.setTitle().addMetaTag().setXFrameOptionsMode()`), WebApp.gs. Index
  injecteert alleen includes (Styles, Script) + tab-markup.
- Initial load: `boot()` → `loadState()` doet
  `google.script.run.withSuccessHandler(onState).withFailureHandler(showError).getDashboardState()`
  (Script.html). `onState(s)` re-rendert (renderSchema / renderVorm /
  renderBeschikbaarheid → switchTab('schema')).

**Write/action-pad:** `google.script.run` → serverfn returnt een vers
`getDashboardState()` → `onState` re-rendert. Concreet:
- `regenerateWeb()` (regenWeek) → roept `generateProposal()`, returnt
  `getDashboardState()` → onState.
- `saveAvailability(updates)` (saveAvail) → schrijft Weekplanner A/D/E,
  returnt `getDashboardState()` → onState.
- UITZONDERING: `pushWeb()` (pushGarmin) returnt `{ pushedCount, skipped,
  errors }`; client-handler `onPushResult` update ALLEEN de knop-status,
  GEEN volledige re-render.

**UI-vrije cores** returnen resultaat-objecten; menu-functies houden
`ui.alert` als dunne wrapper (web-context kan `getUi()` niet gebruiken).
Bijv. core `pushAllPending_(ss)` (Sync.gs) ↔ wrapper `pushAllPendingWorkouts()`.

**Sleutel-functies:**
- `generateProposal` (Algorithm.gs): leest `readPlanner` live, schrijft per dag
  1..N sessies als DocProps `proposal_<yyyy-MM-dd>[_s<n>]` + een aggregaat in
  `weekplan_<maandag yyyy-MM-dd>`, dan `renderProposal`.
- **Multi-session key-scheme (v2b-B)**: sessie 1 = basiskey `proposal_<dISO>`
  (byte-identiek aan vroeger single-session); sessie n≥2 = `proposal_<dISO>_s<n>`.
  Het sleutelformaat leeft op ÉÉN plek: `readDaySessions_` / `writeDaySessions_` /
  `deleteDaySessions_` (Algorithm.gs) — niet elders hardcoden. Een pendel-dag
  expandeert naar `pendelAantal` (default 2) sessies van `pendelDuurMin`
  (default 80), beide in Settings.
- `pushEvents_` → `intervalsRequest_` `POST /athlete/{id}/events/bulk?upsert=true`
  (IntervalsApi.gs); `external_id = 'coach_' + dateISO + '_' + type.toLowerCase()`
  + `_s<n>` voor n≥2 (sessie 1 ongesuffixt). `buildEventPayload(workout, dateISO,
  type, sessionIndex, sessionCount)` zet distinct start-uur per sessie (07/17h).
- `readSettings` / `loadSettingValue` + `SETTINGS_SHEET = 'Instellingen'`
  (Settings.gs).
- `DAGTYPE_OPTIONS = ['pendel','vrij','weekend','recovery']` (Planner.gs).
  `readPlanner` leest A3:H9 (`getRange(3,1,7,8)`): A=train `d[0]`,
  D=minuten `d[3]`, E=type `d[4]`, F=notitie `d[5]`, H=gedaan `d[7]`.
- `syncAll(e)` (Sync.gs): syncAthleteZones → syncActivities → syncWellness →
  reconcilePlannerWithActivities; zet `last_sync` DocProp.

**Activiteiten-tab op kolom-INDEX** (NIET header-naam; `ACT_HEADERS` = 15,
self-healing header-write): datum `idx0`, FTP `idx12`, Gewicht `idx13`,
Rolling FTP `idx14`. `ACT_HISTORY_DAYS = 730`.

## Invarianten / niet aanraken

- **Status-deck CSS** (Styles.html `.status-card`/`.status-wrap`): SUPERSEDED
  door de `ReadinessCard` (Fase 1b) — `statusGraphicHtml` wordt niet meer
  gerenderd → legacy/dead CSS. Het oude "NIET wijzigen" is INGETROKKEN (zie
  HANDOFF); opruimen = future. (Er is GEEN `.status-deck`-class.)
- **Geaccepteerde render-limiet:** de niveau-grafiek (`drawNiveauChart`) toont
  het actieve punt zónder stroke-rand — Google Charts kan dat niet; bewust zo.
- **Multi-session ONDERSTEUND (v2b-B)**: per dag 1..N sessies via
  `proposal_<dISO>[_s<n>]` + `external_id`-suffix `_s<n>` (n≥2). Sleutelformaat
  UITSLUITEND via `readDaySessions_` / `writeDaySessions_` / `deleteDaySessions_`
  (Algorithm.gs) — niet elders hardcoden. Dashboard rendert nog het aggregaat
  (naam "Pendel N× <m>", som-TSS/min); per-sessie kaarten = v2b-C. `TelegramBot.gs`
  + de `proposedType`-fallback lezen bewust alleen de basiskey (sessie 1).
- **Visueel verifiëren op de /dev-URL** (incognito + hard refresh), niet op een
  diag leunen. Geen lokale vars die payload-keys schaduwen (dagen / vorm /
  athlete / event / voortgangPct / niveau / niveauBasis / conditieMod /
  niveauReeks).
- **Readers werken op kolom-INDEX** (`ACT_HEADERS.length`): header-rename is
  puur cosmetisch + self-healing, breekt de readers niet.
- `doPost` (Telegram) moet ALTIJD HTTP 200 returnen (anders Telegram
  retry-loop); secret als `?s=` query-param want Apps Script geeft custom
  headers niet door aan doPost.
- **Taper-prio-model** (Doel.gs — meet event-nabijheid VANAF VANDAAG, niet de
  week-maandag). `eventFase_(events, refDate)` = de ENIGE bron voor de fase-mapping
  → `{ fase, macroFase, hoofdEvent, taperEvent, taperVenster, dagenTot, wekenTot }`.
  Constanten `A_TAPER_DAGEN=7` / `B_TAPER_DAGEN=3` / **C nooit**. `macroFase`
  (Base ≥9wk / Build ≥5 / else Peak) = periodisering van 't A/trip-hoofdevent, LOS
  van de taper. Taper-overlay: A/trip ≤7d → venster 7; anders dichtstbijzijnde B ≤3d
  → venster 3; `fase = Recovery > Taper(taperEvent≠null) > macroFase`. Een near-B
  drijft de taper maar NOOIT de macro. **Per-dag-gating in `assignWorkouts`** via
  `taperCtx={datum,venster,isTrip}`: een dag tapert ALLEEN 0..venster dagen vóór 't
  taper-event — anders (en post-event) normale toewijzing volgens de onderliggende
  `macroFase` (die ook naar `buildWorkout` gaat; taper-workouts blijven type-gedreven).
  `bepaalFaseVoorDatum_` kiest ref = vandaag voor de huidige week, anders de
  week-maandag (historische voortgang-loop WebApp.gs + +1-planning blijven per
  weekgrens meten). NB: een near-B zet `fase='Taper'` → de plan-card-kop leest "Taper"
  terwijl `macroFase` de echte periode is (kaart-refinement = future).
- **Trip-event key-type volgorde** (`keyIntensity`): Taper → Recovery →
  `climbTypeWorkout_` (Build/Peak) → trip (`long_z2`) → doel-tak. De trip-tak
  staat NOOIT vóór Recovery of climb.
- **Pendel-recovery via `DEMOTE_MAP`**, niet via if-volgorde in de generator. Een
  nieuw trip/pendel-key-type MOET een `DEMOTE_MAP`-entry (→ `pendel_z2`) krijgen,
  anders breekt recovery.
- **`workoutZones` pendel-pinning**: `pendel_trip_intervals` gepind `['low','high']`
  vóór de `pendel_`-prefix-tak; `pendel_z2` gepind `['low']`; overige
  `pendel_*_intervals` blijven doel-afhankelijk — niet samenvoegen.
- **Twee dag-smaken**: pendel-dag → token-pad (`assignWorkouts` pendel-branch),
  normale dag → `keyIntensity`. `d.voorgesteldType` op een pendel-dag komt uit de
  pendel-branch, niet uit `keyIntensity`.
- **Zone-gewogen tss** (item C): tss is ALTIJD `tssFromZoneMinutes_({low,high,anaerobic})`
  = `round(low*0.7 + high*0.95 + anaerobic*1.05)` — ENIGE rate-bron. NOOIT single-rate-
  per-workout (minuten × één rate) herintroduceren, in geen enkel pad.
- **Per-zone-minuten uit `intent`**: komen uit de bestaande `intent`-objecten
  (`renderVariant_`, `genericLongZ2`:1860), 3-bucket. warm+cool zitten AL in
  `intent.low` — nooit opnieuw invouwen.
- **Variant endurance-fill** (`renderVariant_`): `gap = (mins − warm − cool) − mainMin`;
  bij `gap >= 5` → één Z2-blok vóór de cooldown, geteld als low (fill-floor 5 min). De
  generators (`genericLongZ2` / `genericPendelIntervals`) vullen zichzelf al.
- **Begrensde key-set**: harde minuten plateauen op het template-plafond; extra duur gaat
  naar Z2, NOOIT naar meer harde reps. IF (proxy `tss/totaalMin`) MOET dalen met duur.
  Puur-Z2 houdt constante IF (duur-onafhankelijk) — verwacht.
