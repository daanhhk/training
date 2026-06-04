# HANDOFF — project training (FTP Coach web-app)

Bron van waarheid voor de projectstand. Conventies + architectuur-detail + code-invarianten staan in CLAUDE.md (auto-load Claude Code); deze HANDOFF = STAND, aanpak, roadmap + engine-referentie.

## STAND (leidend)
INTERACTIEVE HtmlService web-app. /dev:
https://script.google.com/macros/s/AKfycbz51mSRp2LYEIWFPJLmahX14_40w5c85UEDcjCSIW-J/dev

## Visual system / aanpak
- Beslissing: **THEME-FIRST**. `design/tokens.css` (donker, 4-tabs) = styling-bron van waarheid.
- Het ONTWERP is leidend; bestaande functies bouwen we erin, en vullen aan waar nodig.
- Nieuwe bron-doc: `design/INTERACTIONS.md` = volledig interactie-contract (wat elke control doet, READ/WRITE, server/client). Leidend voor functioneel gedrag.

## Readiness-formule (bouwklaar)
- Output 0–100; banden **≥62 ready / 48–61 caution / <48 rest** (uit `tokens.css`).
- Gewogen gemiddelde van genormaliseerde factoren (0–100). Objectief-geleid.
- Gewichten (vol model, na check-in):
  - Vorm-trend **30%** — uit `statusVoor` (map buckets → punten).
  - Belasting **22%** — ramp/ATL vs CTL (intervals.icu).
  - HRV **20%** — vandaag vs baseline (intervals.icu).
  - Slaap **13%** — intervals.icu; bij check-in geblend 70% data / 30% feel.
  - Benen **10%** — fris/normaal/zwaar → 100/65/30.
  - Stress **5%** — laag/normaal/hoog → 100/65/30.
- Vóór check-in: alleen vorm-trend/belasting/HRV/slaap, gewichten herschaald naar 100; kaart toont "+ ochtend-check-in"-prompt.
- Ontbrekende factor → wegvallen + herschalen (geen harde nul). HRV + slaap zijn bevestigd aanwezig in deze gebruiker's intervals.icu.
- "Waarom dit cijfer": per factor 0–100 + status-dot (groen ≥70 / amber 45–69 / rood <45, tunebaar).
- `statusVoor` wordt dus HERGEBRUIKT als de vorm-trend-factor, niet weggegooid.

## Bouw-roadmap (volgorde)
Verticale plakken: UI + bijbehorende Apps Script-handler + Sheet-range per feature. Elke fase = bruikbaar increment.
- **Fase 0 Fundament:** skin-flip (tokens serveren + alias-bridge + IBM Plex + ring-literals→tokens) + Trainingen/Niveau als lege tab-containers + drawer open/sluit-mechaniek.
- **Fase 1 Status-deck & plan herstructurering:** countdown VERHUIST naar Schema-plan-kaart; Vorm-prime-kaart WORDT readiness (check-in-sheet + opslag + score per formule hierboven). Lost readiness + countdown-verhuizing samen op.
- **Fase 2 Rest van Schema:** availability F.1b (deze dag + entry-chooser), WeekLoad + stale-banner (F.3), dag-detail-varianten, WorkoutPicker/override, RPE, rust/niet-beschikbaar + toch-trainen (F.2), multi-sessie, edge states.
- **Fase 3 Rest van Vorm:** level-kaart verifiëren, vorm-analyse (grafiek-tijdvenster, metrics, conditie-balans).
- **Fase 4 Trainingen:** bibliotheek drill-down + Inplannen.
- **Fase 5 Instellingen-drawer:** profiel/volume/doel&blok/events/koppelingen/meldingen/account (CRUD op Sheet). Naar voren te halen indien eigen doel/FTP/events vroeg bewerkbaar moeten zijn.
- **Fase 6 Garmin-push** (leaf, laatst/optioneel).
- **Fase 7 Niveau** afmaken + QA-pass.

## Beslissingen & invarianten
- **INGETROKKEN:** ".status-card/.status-wrap niet aanraken" — het ontwerp herwerkt die kaart bewust (countdown→Schema, Vorm-prime→readiness). Was een guardrail, geen blokkade.
- **Blijven:** `google.script.run` only (geen losse fetch); tss zone-gewogen via `tssFromZoneMinutes_`; v2b-C leidt nooit `'recovery'` af; `design/tokens.css` = styling-bron.
- **[#3]-CORRECTIE:** de client leest het server-`mode`-object NIET. countdown = `vorm.event.dagenTot`; "Onderhoudt" = `statusVoor` (vorm/ramp), NIET `mode.seasonMode`. De eerdere claim dat /dev al mode read-side toont was misattributie. Mode read- én write-side = toekomst.

## Hergebruik vs nieuw
- **Hergebruiken** (slot in ontwerp): dagstrip, `assignWorkouts`/`voorgesteldType`, availability F.1a, `vorm.event.dagenTot` (countdown→Schema), `statusVoor` (readiness-factor), niveau-block, intervals.icu-sync, 2-kaart swipe-deck (structuur blijft).
- **Echt nieuw:** check-in-sheet + readiness-score, WorkoutPicker + override-persistentie, RPE-UI + opslag, Trainingen-bibliotheek, Instellingen-drawer, Garmin-push, edge states (ConnectState/SyncBanner/EmptyState), stale-banner (F.3), toch-trainen (F.2).

## Live stand (uit recon)
- HtmlService web-app, OUDE lichte skin op /dev. 2 tabs: `#tab-schema` + `#tab-vorm`, `#bottomnav`. Trainingen/Niveau ontbreken.
- status-deck = `.status-wrap` > `.status-card`×2 (kaart1 ring+verdict via `ringSvg`/`statusVoor`, kaart2 `.niveau-block`), flex/scroll-snap.
- F.1a DONE (commit 44b170f, Script.html+Styles.html): week-editor train/minuten/pendel. `saveAvailability` ONGEMOEID. F.1b nog te bouwen.
- `tokens.css` staat in `design/` (NIET `src/`) → niet geserveerd; skin nog niet geflipt. IBM Plex niet geladen. Live token-namen wijken af (`--bg/--header/--card/--ink/--muted/--ok/warn/dem/rec-*`) → alias-bridge nodig; alleen `--accent/--accent-soft` overlappen qua naam. Ring-stroke `#5B5BD6`/`#e2e8f0` hardcoded in `ringSvg`-JS.
- Alles via `google.script.run`.

## Architectuur
Per-user Sheet, geen centrale backend, Apps Script. Elke server-actie (🌐 in INTERACTIONS.md) = een handler + Sheet-range.

## Bronnen (commit-gepinde raw-URL, nooit blob)
- `design/tokens.css` (styling-bron), `design/DESIGN.md`, `design/FTP-Coach-export.md`, `design/INTERACTIONS.md` (interactie-contract), `design/screenshots/` (01-schema..07-plan-card), `design/F-beschikbaarheid.md` ([F]-contract).

## Volgende stap
Fase 0 skin-flip (skin-flip-buildprompt is in de vorige chat opgesteld), daarna Fase 1.

---

## Historie & engine-referentie (bruikbare historie — overleeft de restyle)

### KLAAR (done sinds bbd1a6b)
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
