# HANDOFF — project training (FTP Coach web-app)

Bron van waarheid voor de projectstand. Conventies + architectuur-detail + invarianten staan in CLAUDE.md (auto-load Claude Code); deze HANDOFF = STAND, engine-gedrag en roadmap.

## STAND (leidend)
INTERACTIEVE HtmlService web-app, tabs Schema + Vorm. /dev:
https://script.google.com/macros/s/AKfycbz51mSRp2LYEIWFPJLmahX14_40w5c85UEDcjCSIW-J/dev

Architectuur: server WebApp.gs (getDashboardState bouwt payload-state); client Index.html (markup-containers) + Script.html (render-JS: renderSchema/renderVorm/voorstelKaart, switchTab, google.charts). doGet → HtmlService.createTemplateFromFile('Index').evaluate() (gechaind .setTitle()/.addMetaTag()/.setXFrameOptionsMode()). Initiële load: google.script.run.withSuccessHandler(onState).withFailureHandler(showError).getDashboardState() in loadState() (boot() roept loadState).

### KLAAR sinds vorige HANDOFF (bbd1a6b)
Multi-session is nu ONDERSTEUND — de oude invariant "multi-session NIET ondersteund" is vervallen.
- v2b-B multi-session (2f5a645 feat, 7f6c9a6 docs): per-sessie proposal-keys — base = proposal_<dISO> (s1), extra = proposal_<dISO>_s<n> voor n>=2. external_id: s1 = coach_<dateISO>_ride, n>=2 = coach_<dateISO>_ride_s<n>. Distinct start_date_local (s1 07:00, last 17:00; n>=3 12/19/06h). Single-session events ook verschoven 00:00->07:00 (idempotent via ongewijzigd external_id). Settings PENDEL_DUUR (rij 52, default 80) + PENDEL_AANTAL (rij 53, default 2), sectie-header rij 51, alle zes maps gewired. Key-format leeft UITSLUITEND in readDaySessions_/writeDaySessions_/deleteDaySessions_ (Algorithm.gs). computeWeekVolumeMin_ sommeert sessies. Snapshot draagt sessies[] + aggregaat. Geraakt: Algorithm.gs + IntervalsApi.gs + Sync.gs + Settings.gs.
- Asymmetrische pendel-intensiteit (9af34fc): sessies 0..N-2 van een pendeldag geforceerd type pendel_z2; laatste sessie houdt d.voorgesteldType (engine-keuze — al pendel_z2 op recovery-weken via DEMOTE_MAP, anders pendel_<doel>_intervals). genericPendelZ2-signatuur nu (mins, settings, mesoWeek, macroFase), dispatch Algorithm.gs:1762; recovery-predikaat mesoWeek===4 || macroFase==='Recovery' maakt de "recovery week"-tekst conditioneel (gewone ochtendpendel -> "Pendel + Z2 (<m> min)" + "Rustige pendel — fris op werk aankomen."). Aggregaat-naam "Pendel Z2 + <doel> intervallen" bij gemengd.
- Per-sessie kaarten (eab1591 Algorithm, 7f076dc WebApp, 7ee851f Script.html): sessies[]-entries dragen {naam, totaalMin, tss, intent, eindopmerking} (intent = ensureIntent_(s)). dashDayCard_ (WebApp.gs:281-307): wpEntry.sessies.length>1 -> voorstel.sessies=[{titel,duurMin,tss,segmenten:segmentsFromIntent_(s.intent),eindopmerking}]; aggregaat-voorstel intact; niet uitgezonden bij single-session. Script.html: voorstelKaart vertakt vroeg bij v.sessies.length>1 -> N kaarten via sessieKaart_ (titel + zoneBar + duur/TSS + eindopmerking via .muted), opgeslagen volgorde (s1 ochtend -> last middag). Lege segmenten -> "Geen structuur beschikbaar." (geen crash). Multi toont per-sessie eindopmerking; single toont dag-reden ongewijzigd.
- TRIP-EVENT KEY-TYPE compleet & live (HEAD 1e72d6d). Trigger = isTripEvent (event type==='trip'); afstandKm/hm bewust NIET gethread (latere refinement, zie backlog [C]). Build/Peak only.
  - Free-day (normale dag, keyIntensity site 765): keyIntensity kreeg isTripEvent als 5e param. Trip-tak ná climbTypeWorkout_ (Build/Peak), vóór doel-tak: isTripEvent + geen climb-routing (klimType='vlak'/leeg) → 'long_z2' (genericLongZ2). Climb (lang/kort/gemengd) wint; Taper/Recovery winnen (tak zit ná Recovery).
  - Commute (pendel-dag, site 731): emit token 'pendel_trip_intervals' bij trip+Build/Peak; genericPendelIntervals isTrip-tak bouwt sweet-spot/tempo (2x15min @ 86-92% FTP), naam "Pendel + sweet spot (tocht, …)".
  - Recovery-precedentie pendel via DEMOTE_MAP += pendel_trip_intervals → pendel_z2 (recovery-bewust mesoWeek===4 || macroFase==='Recovery'): token gedemoot vóór de generator, dus trip-tak vuurt niet op recovery → schema-recovery wint.
  - Zone: workoutZones gepind pendel_trip_intervals → ['low','high'] (één expliciete regel vóór de pendel_-prefix-tak 1309), doel-onafhankelijk. Overige pendel_*_intervals houden doel-afhankelijke zone op 1309.
  - Live-geverifieerd: pendel-dag = "Pendel + Z2" (heen) + "Pendel + sweet spot (tocht)" (terug), zone ['low','high'], geen FTP. Girona (2026-06-13, trip, A, 95km/1200hm, lang): free-day = threshold|sweet_spot (climb wint), pendel = sweet-spot/tempo. long_z2-tak inert voor Girona (lang≠vlak); is voor toekomstige vlakke tochten.
- ITEM C zone-gewogen tss + variant endurance-fill compleet & live (HEAD 5efd8a6, Algorithm.gs only). tssFromZoneMinutes_({low,high,anaerobic}) = round(low*0.7+high*0.95+anaerobic*1.05) = ENIGE rate-bron. renderVariant_ tss uit intent (rate-lookup verwijderd) + endurance-fill (gap>=5 → Z2-blok vóór cooldown, telt als low). genericLongZ2 tss uit intent, hilly 0.8/0.7 geschrapt. genericPendelIntervals afgeleide vaste werkMin per doel (FTP/Beklimmingen 28, Conditie/trip 30, VO2max 14=anaeroob, else 24). IF (proxy tss/totaalMin) daalt nu met duur; puur-Z2 blijft constant. CALIBRATIE-NOTITIE: pendel-werkMin VO2max=14@anaerobic levert minder work-tss dan FTP=28@high — eerste tweak-kandidaat als pendel-IF bij VO2max-doel te laag voelt; geen blocker.

### Eerdere milestones (gedaan)
- v2a (521ed24): beschikbaarheid-write-pad — saveAvailability schrijft Weekplanner A3:H9 (A=Train?/D=Minuten/E=Dagtype), returnt vers getDashboardState -> onState.
- v2b-A (d680037): in-app regenerate + push. regenerateWeb() -> generateProposal -> vers getDashboardState. pushWeb() = UITZONDERING: returnt {pushedCount,skipped,errors}; onPushResult re-rendert NIET via onState.
- v2c (22c5a30): per-dag rationale (reden) in voorstelKaart, onderdrukt zodra er een actual is.
- v2d (96c57a3): runs = vermoeidheid, niet cycling-fitness — gates op rollingZoneCoverage (r[1]) + computeZoneDebt_ (a.type); recentHardDayDate_ ONGEMOEID (run-inclusief).

### Bestaande stabiele features
Schema-tab: swipe-deck (ring+verdict / niveau-blok). Vorm-tab: niveau-over-tijd grafiek (server dashNiveauReeks_ -> payload vorm.niveauReeks, client drawNiveauChart). niveau = clamp(niveauBasis + conditieMod, 0, 50); niveauBasis = computeNiveau_(ftp, gewicht).

### Engine-gedrag (geverifieerd - relevant voor adaptiviteit)
- generateProposal: geen args; draait ensureDataAndReconcile_ -> syncAll (verse actuals); leest readPlanner live; her-plant alleen tePlannen (train && !gedaan && datum >= vandaag); voltooid behoudt voorgesteldType; schrijft per dag 1..N sessies proposal_<dISO>[_s<n>] + weekplan-aggregaat. Geen auto-regen - alleen menu (Code.gs:44) of web-knop (WebApp.gs:604).
- assignWorkouts: typekeuze per dag uit dagtype + fase + debt/dekking + wellness; minuten schalen alleen de duur, niet het type. GEEN week-volume-bewustheid in de typekeuze.
- avoid-consecutive-hard: alleen dag N-1 (calendar), downgradet hard -> long_z2; rust-gap-dag reset de guard; geen N+1-vooruitblik; geen rust-INVOEGING op load.
- recentHardDayDate_ (Algorithm.gs:230): leest Activiteiten-tab actuals, hard op IF >= 0,85 - incl. ongeplande ritten en runs (run-inclusief).
- dekking (rollingZoneCoverage, 7d): actuals-bewust; alleen CYCLING_TYPES.
- debt (computeZoneDebt_): alleen dagen met train && gedaan; alleen CYCLING_TYPES. ASYMMETRIE (open beslissing): ongeplande/niet-aangevinkte ritten zitten wel in dekking, NIET in debt.

### Data & sleutel-functies
Actuals in Activiteiten-tab via syncActivities <- getActivities (intervals.icu; GEEN sport-filter in de sync; Type = idx1 / r[1] / a.type). ACT_HEADERS = 15: Datum idx0, IF idx7 (kolom 8), TSS idx8 (kolom 9), FTP idx12, Gewicht idx13, Rolling FTP idx14. ACT_HISTORY_DAYS = 730. CYCLING_TYPES (Algorithm.gs:42) = Ride/VirtualRide/GravelRide/MountainBikeRide.
Push: pushAllPending_ core / pushAllPendingWorkouts wrapper (Sync.gs); pushEvents_ -> intervalsRequest_ POST /events/bulk?upsert=true; external_id = coach_<dateISO>_ride (s1), n>=2 = coach_<dateISO>_ride_s<n> (IntervalsApi.gs). Proposal-keys UITSLUITEND via readDaySessions_/writeDaySessions_/deleteDaySessions_ (Algorithm.gs). Settings: readSettings/loadSettingValue + sheet 'Instellingen' (SETTINGS_SHEET). DAGTYPE_OPTIONS = pendel/vrij/weekend/recovery. Weekplanner A3:H9 (readPlanner): A=Train? D=Minuten E=Dagtype F=Toelichting H=Gedaan?.

## Invarianten — bijgewerkt
- Multi-session ONDERSTEUND. Proposal-key-format UITSLUITEND via readDaySessions_/writeDaySessions_/deleteDaySessions_. external_id s1 kaal, n>=2 suffix _s<n>; upsert=true keyed op external_id (distinct per sessie -> geen collapse).
- Pendel-compositie: eerste N-1 sessies = pendel_z2, laatste = d.voorgesteldType. genericPendelZ2 recovery-predikaat mesoWeek===4 || macroFase==='Recovery'.
- deck-CSS .status-card + .status-wrap NIET aanraken (.status-deck bestaat niet). Per-sessie render gebruikt .card/.metrics/.metric/.muted/.zonebar, alleen in #dag-detail.
- sessies[]-shape {naam, totaalMin, tss, intent, eindopmerking}; reden is dag-niveau (d.reden), niet per sessie.

TRIP-INVARIANTEN:
- keyIntensity-volgorde: Taper → Recovery → climbTypeWorkout_ (Build/Peak) → trip (long_z2) → doel-tak. Trip-tak NOOIT vóór Recovery of climb.
- Pendel-recovery loopt via DEMOTE_MAP, NIET via if-volgorde in de generator. Een nieuw trip/pendel-key-type MOET een DEMOTE_MAP-entry (→ pendel_z2) krijgen, anders breekt recovery.
- workoutZones: pendel_trip_intervals gepind ['low','high'] vóór de pendel_-prefix-tak (1309); pendel_z2 gepind ['low'] (1303); overige pendel_*_intervals doel-afhankelijk op 1309 — niet samenvoegen.
- Twee dag-smaken: pendel-dag → token-pad (731), normale dag → keyIntensity (765). d.voorgesteldType op een pendel-dag komt uit 731, niet uit keyIntensity.

TSS-INVARIANTEN (item C):
- tss ALTIJD via tssFromZoneMinutes_({low,high,anaerobic}) = round(low*0.7+high*0.95+anaerobic*1.05); ENIGE rate-bron, NOOIT single-rate-per-workout (minuten × één rate) herintroduceren.
- Per-zone-minuten uit de bestaande intent (renderVariant_ / genericLongZ2:1860); warm+cool zitten al in intent.low — niet opnieuw invouwen.
- Begrensde key-set: harde minuten plateauen op het template-plafond, extra duur → Z2 (fill-floor 5 min), NOOIT meer reps. IF (proxy tss/totaalMin) daalt met duur; puur-Z2 = constante IF.

## VOLGENDE — [F] Beschikbaarheid-UI (v2b-C) (+ [#3] events/doel-modus parallel)
[C] Variant/duur-schaling = DONE (zone-gewogen tss + endurance-fill, HEAD 5efd8a6, Algorithm.gs only). Kritisch pad: C → (F, #3 parallel) → A/G → B → D → E.
[F] Beschikbaarheid-UI (v2b-C): per-dag knop, scope "deze dag"/"hele week"; Train?+minuten+pendel-toggle (geen dagtype-dropdown, weekend auto, recovery engine-gestuurd). Rustdag niet doodlopend ("toch trainen"); onderscheid onbeschikbaar vs engine-recovery. GEEN bouw voor recon: eerst read-only STAP 0 op saveAvailability (dag- vs week-scope). [#3] events/doel-modus loopt parallel (modus-overname-UX, zie DECISIE).

## DESIGN-TRACK (spec-bron voor de visuele polish-pass = draad 4)
Volledig ontwerp vastgelegd in /design (commit 4b7e1e6): tokens.css (canoniek), FTP-Coach-export.md (React + inline-styles bron), DESIGN.md (spec + harde regels), screenshots/ (1-9.png).
Stijl: dark, data-dicht pro-tool, accent oranje→rood. Zones 1-6 (Z5=accent, Z6=anaeroob); semantisch good/warn/bad/fresh; IBM Plex Sans + Mono.
Harde regels (ook in DESIGN.md): deck-CSS .status-card/.status-wrap niet aanraken; vermogen afronden op 5 W; variant/duur-schaling = begrensde key-set + endurance-vulling, GEEN reps-meeschaling, IF daalt bij langere duur.
Polish-pass: tokens.css als hand-CSS toepassen op Index.html/Script.html; JSX plakt NIET 1:1.

## BACKLOG — ontworpen, nog te bouwen (elk: recon VOOR bouw)
- RPE post-ride (write-feature, write-pad v2a-stijl): 1-10 selector + gepland-vs-gevoeld-feedback. Logica: trend-ratio zwaarte(IF/TSS) vs RPE ~14d; RPE->plan direct, RPE->niveau INDIRECT (W/kg-anker, niet opblazen; "voelt licht"-trend -> FTP-cel achter -> FTP-test/-ophoging voorstellen; ftp_auto_update blijft UIT). Recon: mismatch-engine + patches #16-17.
- Trainingen-tab (bibliotheek): categorie -> VARIANT-keuze, on-demand uit engine (GEEN statisch archief). Recon: variant-pool als opsombare data? sprint/anaerobe key-type aanwezig?
- Variant/duur-schaling (KRITISCH): geen reps-meeschaling; begrensde key-set + endurance-vulling; per-type harde-dosis-cap; IF daalt bij langere duur. Geldt OOK voor de kern-engine (assignWorkouts). Recon: schaalt de generator nu reps of endurance?
- "Doe iets anders"-override (per dag): kies variant/categorie of vrije rit/groepsrit. Pin/lock-vlag zodat regenerate de dag niet overschrijft; stroomt in debt/dekking. Recon: pin-mechanisme.
- Per-dag "Stuur naar Garmin": smalle ingang op bestaande push (zelfde uitzonderings-laag als pushWeb). Swap+re-push overschrijft via upsert (external_id). Recon: per-dag scope + ORPHAN-delete bij override die sessie-aantal verlaagt.
- Beschikbaarheid-UI = v2b-C: per-dag knop, scope "deze dag"/"hele week"; Train?+minuten+pendel-toggle (geen dagtype-dropdown, weekend auto, recovery engine-gestuurd). Rustdag niet doodlopend ("toch trainen"); onderscheid onbeschikbaar vs engine-recovery. Recon: saveAvailability dag- vs week-scope.
- Ochtend-check-in (write-feature): slaap/benen/stress -> bijstelling gereedheid + mogelijke afschaling. Recon: invloed op wellness/gereedheid + dag-voorstel.
- Gereedheid-"waarom"-uitklap (= geparkeerde draad 3). Display.
- Event-/periodisering-tijdlijn: fase-boog + weken + verwachte uren + actieve MODUS. Display.
- Week-belasting + "werk week bij"-regenerate (verouderd-hint bij gewijzigde beschikbaarheid) = bestaande v2b-A.
- Rand-/lege staten: intervals niet verbonden, sync mislukt, geen voorstel, geen historie, push-fout.

## DECISIE — events/doel = wederzijds uitsluitende MODUS
~2 events/jr (Amstel Gold Race, Girona) + standaard trainingsdoel; bij nabij A-event neemt evenement-modus over (doel pauzeert), coach kondigt aan; lead-time op prioriteit (A lang/B kort/C niet). Settings houdt beide. Open: hoe event vs `doel` het key-type sturen = de lopende Girona/key-type-recon.

## Durabele lessen
Zie CLAUDE.md. Kort: visueel verifieren op /dev (incognito + hard refresh); write-pad-patroon = google.script.run -> serverfn returnt vers getDashboardState -> onState (behalve pushWeb); NL-locale-formules bij setFormula (komma decimaal + puntkomma separator) - nu n.v.t. (writes zijn waarden/JSON), relevant zodra een write formules raakt; STAP 0-recon + 200-woorden rapport-cap.
