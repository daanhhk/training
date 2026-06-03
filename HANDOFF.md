# HANDOFF — project training (FTP Coach web-app)

Bron van waarheid voor de projectstand. Conventies + architectuur-detail + invarianten staan in CLAUDE.md (auto-load Claude Code); deze HANDOFF = STAND, engine-gedrag en roadmap.

## STAND (leidend)
INTERACTIEVE HtmlService web-app, tabs Schema + Vorm. /dev:
https://script.google.com/macros/s/AKfycbz51mSRp2LYEIWFPJLmahX14_40w5c85UEDcjCSIW-J/dev

Architectuur: server WebApp.gs (getDashboardState bouwt payload-state); client Index.html (markup-containers) + Script.html (render-JS: renderSchema/renderVorm/voorstelKaart, switchTab, google.charts). doGet → HtmlService.createTemplateFromFile('Index').evaluate() (gechaind .setTitle()/.addMetaTag()/.setXFrameOptionsMode()). Initiële load: google.script.run.withSuccessHandler(onState).withFailureHandler(showError).getDashboardState() in loadState() (boot() roept loadState).

### Read-only -> interactief: GROTENDEELS GEDAAN
- v2a (521ed24) - beschikbaarheid-write-pad. saveAvailability schrijft Weekplanner A3:H9 (A=Train?/D=Minuten/E=Dagtype) en returnt vers getDashboardState -> onState re-rendert.
- v2b-A (d680037) - in-app regenerate + push. UI-vrije cores returnen resultaat-objecten; menu-functies houden ui.alert als dunne wrapper (web-context kan getUi() niet). regenerateWeb() -> generateProposal -> vers getDashboardState. pushWeb() = UITZONDERING: returnt {pushedCount,skipped,errors}; onPushResult re-rendert NIET via onState. Knoppen "Regenereer voorstel" + "Push naar Garmin" in Schema-tab.
- v2c (22c5a30) - per-dag rationale. reden vastgelegd in assignWorkouts -> weekplan-snapshot -> dashDayCard_-voorstel -> zichtbare regel in voorstelKaart; onderdrukt zodra er een actual is. Dode waarom-array achter ingeklapt <details> (Script.html:71-75) ONGEBRUIKT - opruimen/consolideren = open UX-keuze.
- v2d (96c57a3) - runs = vermoeidheid, niet cycling-fitness. Gates toegevoegd: rollingZoneCoverage (r[1] in CYCLING_TYPES) + computeZoneDebt_ (a.type, gate-first bij actsByDate-opbouw). recentHardDayDate_ ONGEMOEID.

### Bestaande stabiele features
Schema-tab: swipe-deck (ring+verdict / niveau-blok). Vorm-tab: niveau-over-tijd grafiek (server dashNiveauReeks_ -> payload vorm.niveauReeks, client drawNiveauChart). niveau = clamp(niveauBasis + conditieMod, 0, 50); niveauBasis = computeNiveau_(ftp, gewicht).

### Engine-gedrag (geverifieerd - relevant voor adaptiviteit)
- generateProposal: geen args; draait ensureDataAndReconcile_ -> syncAll (verse actuals); leest readPlanner live; her-plant alleen tePlannen (train && !gedaan && datum >= vandaag); voltooid behoudt voorgesteldType; schrijft proposal_<yyyy-MM-dd> + weekplan_<maandag>. Geen auto-regen - alleen menu (Code.gs:44) of web-knop (WebApp.gs:604).
- assignWorkouts: typekeuze per dag uit dagtype + fase + debt/dekking + wellness; minuten schalen alleen de duur, niet het type. GEEN week-volume-bewustheid in de typekeuze.
- avoid-consecutive-hard: alleen dag N-1 (calendar), downgradet hard -> long_z2; rust-gap-dag reset de guard; geen N+1-vooruitblik; geen rust-INVOEGING op load.
- recentHardDayDate_ (Algorithm.gs:230): leest Activiteiten-tab actuals, hard op IF >= 0,85 - incl. ongeplande ritten en runs (na v2d nog steeds run-inclusief).
- dekking (rollingZoneCoverage, 7d): actuals-bewust; na v2d alleen CYCLING_TYPES.
- debt (computeZoneDebt_): alleen dagen met train && gedaan; na v2d alleen CYCLING_TYPES. ASYMMETRIE (open beslissing): ongeplande/niet-aangevinkte ritten zitten wel in dekking, NIET in debt.

### Data & sleutel-functies
Actuals in Activiteiten-tab via syncActivities <- getActivities (intervals.icu; GEEN sport-filter in de sync; Type = idx1 / r[1] / a.type). ACT_HEADERS = 15: Datum idx0, IF idx7 (kolom 8), TSS idx8 (kolom 9), FTP idx12, Gewicht idx13, Rolling FTP idx14. ACT_HISTORY_DAYS = 730. CYCLING_TYPES (Algorithm.gs:42) = Ride/VirtualRide/GravelRide/MountainBikeRide.
Push: pushAllPending_ core / pushAllPendingWorkouts wrapper (Sync.gs); pushEvents_ -> intervalsRequest_ POST /events/bulk?upsert=true; external_id = coach_<dateISO>_<type.toLowerCase()> (IntervalsApi.gs). Settings: readSettings/loadSettingValue + sheet 'Instellingen' (SETTINGS_SHEET). DAGTYPE_OPTIONS = pendel/vrij/weekend/recovery. Weekplanner A3:H9 (readPlanner): A=Train? D=Minuten E=Dagtype F=Toelichting H=Gedaan?.

### Invarianten
Fragiele deck-CSS: .status-card { flex:0 0 100%; scroll-snap-align:center; display:flex; gap:12px; } + .status-wrap - NIET aanraken. (.status-deck bestaat NIET - eerdere drift, gecorrigeerd.) Multi-session NIET ondersteund: 1 dag -> 1 event hard op proposal_<dISO> (een key/datum) + external_id (een per datum/type) - sessie-index in beide nodig voor pendel = 2x.

## GEPARKEERD
- Vorm-tab verfraaiing (fase-bewuste status-toon + polish).
- Dode waarom-code (Script.html:71-75) opruimen/consolideren.
- Open beslissing: debt-asymmetrie / run-middenvariant (runs gewogen in dekking i.p.v. uitgesloten).

## VOLGENDE - v2b-B dan v2b-C
- v2b-B (zwaar, structureel): multi-session. Sessie-index in proposal_<dISO>-key EN external_id; pendel-dag expandeert naar pendelAantal sessies van pendelDuurMin. Nieuwe Instellingen-rijen pendelDuurMin (default 80) + pendelAantal (default 2) via readSettings. Raakt Algorithm.gs + IntervalsApi.gs + settings.
- v2b-C (UI, hangt op v2b-B): vereenvoudigde beschikbaarheid-UI. Binaire pendel-vlag -> E='pendel'; auto-weekend (za/zo -> E='weekend' tenzij pendel) behoudt de lange-rit-branch; anders E='vrij'. Dropdown recovery/weekend weg uit UI; recovery blijft engine-gestuurd (macroFase/mesoWeek=4/wellness). GEAKKOORDEERD model: pendel = 2x80, aanpasbaar in Instellingen; auto-weekend akkoord.
- Volgorde: v2b-B eerst (pendel-UI betekenisloos zonder multi-session), dan v2b-C.
- GEEN bouw voor recon: elke stap start met een read-only STAP 0-recon.

## Durabele lessen
Zie CLAUDE.md. Kort: visueel verifieren op /dev (incognito + hard refresh); write-pad-patroon = google.script.run -> serverfn returnt vers getDashboardState -> onState (behalve pushWeb); NL-locale-formules bij setFormula (komma decimaal + puntkomma separator) - nu n.v.t. (writes zijn waarden/JSON), relevant zodra een write formules raakt; STAP 0-recon + 200-woorden rapport-cap.
