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

## VOLGENDE
1. PRIORITY — Girona/key-type: is pendel_<doel>_intervals (nu FTP) het juiste key-type voor een lange tocht/event-doel (Girona Fietsvakantie)? Open: weegt keyIntensity(doel, macroFase, dekking, klimType) het event-karakter (tocht/duur), of staat `doel` vast op FTP? Mogelijk ontbreekt een duur/tocht-key-type, of het doel-setting staat simpelweg op FTP. Read-only recon op keyIntensity/doelKey/het doel-setting VÓÓR enige bouw.
2. v2b-C (open, model GEAKKOORDEERD): vereenvoudigde beschikbaarheid-UI — binaire pendel-vlag -> E='pendel'; auto-weekend za/zo -> E='weekend' tenzij pendel; anders E='vrij'; dropdown recovery/weekend weg; recovery engine-gestuurd.
3. Optioneel: avoid-consecutive-hard op pendel (avond-Z2 na een zware dag — nog niet gevraagd); debt/dekking-asymmetrie (open sinds v2c/v2d); dode waarom-code Script.html:71-75; patches #16-17 (wellness-gedreven keuze, recentHardDayDate_ op actuals).

## BACKLOG (later — niet de huidige priority)
- RPE post-ride (web-app write-feature, UI ontworpen in Claude Design): 1–10 selector + "gepland-vs-gevoeld"-feedbackregel. Logica (latere STAP 0-recon op mismatch-engine + patches #16-17): signaal = TREND, rollende ratio geplande zwaarte (IF/TSS) vs RPE ~14d; RPE -> PLAN direct (trend licht = progressiever, trend zwaar = terugschakelen/herstel); RPE -> NIVEAU INDIRECT (niveau blijft W/kg-verankerd, niet direct opblazen i.v.m. wobble; aanhoudend "voelt licht" -> FTP-cel loopt achter -> coach stelt FTP-test/-ophoging voor; ftp_auto_update blijft UIT). Write-pad zoals v2a (google.script.run -> vers getDashboardState -> onState).
- Visuele redesign / design-track: volledige dark pro-tool mockups + design-tokens (palette/type/spacing + zone-kleur-subpalet) leven in Claude Design — schermen: status-deck, Vorm, Settings, Schema, RPE-invoer, workout-blok-detail. Spec-bron voor een latere polish-pass. Staat NIET in de repo; bij die pass de fragiele deck-CSS (.status-card/.status-wrap) respecteren.
- Events/doel = wederzijds uitsluitende MODUS (UX-intentie, hangt aan uitkomst Girona/key-type): ~2 events/jr (Amstel Gold Race, Girona) + standaard trainingsdoel; bij een nabij A-event neemt evenement-modus het over (doel-blok pauzeert) + coach kondigt de overgang aan; lead-time geschaald op prioriteit (A lang / B kort / C niet). Settings houdt beide (events-lijst + doel).

## Durabele lessen
Zie CLAUDE.md. Kort: visueel verifieren op /dev (incognito + hard refresh); write-pad-patroon = google.script.run -> serverfn returnt vers getDashboardState -> onState (behalve pushWeb); NL-locale-formules bij setFormula (komma decimaal + puntkomma separator) - nu n.v.t. (writes zijn waarden/JSON), relevant zodra een write formules raakt; STAP 0-recon + 200-woorden rapport-cap.
