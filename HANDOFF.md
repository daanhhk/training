LAATST BIJGEWERKT: 2026-06-02 · COMMIT: 318190b · STAND: web-app dashboard v1+v1.1 live (3 tabs, zone-balk Optie B, /dev-URL). Volgende: Prompt 2 (Vorm status-first + long_z2-fix).

OPENER VOLGENDE CHAT — kopieer alles tussen de streepjes als eerste bericht in een nieuwe chat:
----------------------------------------------------------------
Lees HANDOFF.md via web_fetch: https://github.com/daanhhk/training/blob/main/HANDOFF.md — diep archief (FTP Trainings Coach). LET OP: die fetch kan gecached/oud zijn; de stand hieronder is leidend. Lijkt de gefetchte HANDOFF ouder dan commit 318190b → dat is de cache, NIET "niet gepusht". Je leest mijn lokale repo niet; voor code schrijf jij Claude Code-prompts, jij draait geen clasp/git in de chat.

WERKWIJZE (staande regels):
- Code-contracten (return-shapes, signatures, exacte logica) haal je via Claude Code, NOOIT door Daan om code te vragen. Vouw in elke implementatie-prompt een "STAP 0: lees functies X/Y, bevestig/pas contract aan, implementeer, meld afwijkingen" (zoals de v1-prompt), of schrijf een aparte read-only recon-prompt die Claude Code laat rapporteren. Jij mag zelf aannames neerzetten; Claude Code verifieert tegen de echte code.
- Elke Claude Code-prompt (implementatie én recon) eindigt met een rapport-cap: MAX 200 woorden proza; literals (bestandsnamen, deployment-ID/URL, commit-hash) tellen niet mee en geef je exact; geen code-dumps, geen prompt-herhaling, geen uitleg van wat is gebouwd tenzij afgeweken.
- Daan plakt nooit code handmatig in de editor; alles via Claude Code + clasp push -f. Throwaway diagnostics: src/_Diag.gs (read-only Logger, in .gitignore), clasp push -f, Daan runt uit editor-dropdown en plakt output terug, daarna opruimen.
- Prompts naar Claude Code: platte tekst, geen markdown code-blocks, wanneer Daan op zijn telefoon zit (hij meldt expliciet wanneer hij weer op laptop zit).
- HANDOFF.md committen gaat via git commit + push, GEEN clasp push (staat niet in src/).
- Deployment: dev/test loopt ALTIJD via de /dev (HEAD) URL — elke clasp push -f is daar direct live, NOOIT redeployen. /exec is een vastgepinde versie; die bump je alleen indien nodig via clasp update-deployment <id> door Claude Code in de close-out, NOOIT handmatig in de editor (Implementaties beheren). Negeer oudere "redeploy via Implementaties beheren"-lessen in het archief — die golden voor de inmiddels dode webhook-bot, niet voor deze web-app.

STAND (leidend, commit 318190b): read-only HtmlService web-app, 3 tabs Vandaag/Kalender/Vorm. v1.1 Optie B: renderVariant_ emit geordende blokken {minuten,zone} (5-bucket pctZoneBucket_); zone-balk segmentsFromBlokken_ + intent-fallback (segmentsFromIntent_), past op scherm. Palet CSS-vars, accent indigo #5B5BD6; zone-kleuren ongewijzigd. Kalender opent op vandaag. getDashboardState() triggert NOOIT generateProposal; voorstellen uit weekplan_<maandag>, RPE uit rpe_<dISO>, week+1 uit Weekplanner+1. /dev-URL: https://script.google.com/macros/s/AKfycbz51mSRp2LYEIWFPJLmahX14_40w5c85UEDcjCSIW-J/dev · /exec-deployment-ID: AKfycbxE4ycR3nkOJHIS28GcYnlSFMmoXr42q9gpXK6-MWT1ET4OB9hWPaZobwkklxS4cag1Ug. Known gaps: genericLongZ2/combo/pendel geen blokken; long_z2 onterechte gele staart.

VOLGENDE STAP — Prompt 2: Vorm-tab status-first (JOIN-geïnspireerd): status-graphic (ring Girona-countdown + macro-fase links, status-badge uit ramp/garminHeuristic/formZone_ rechts) + "i"-uitleg in mensentaal (bouwt-op/onderhoudt/te-veel/achteruit/fris, eigen logica, NIET JOIN's niveau-%) + CTL/ATL/Vorm-grafiek degraderen tot trend/details, herstyled + losse fix long_z2 gele-staart. Ik stuur de Vorm-tab-screenshots erbij.

Bevestig kort de stand, vraag wat je nog nodig hebt (welke vorm-velden getDashboardState nu levert), schrijf dan Prompt 2.
----------------------------------------------------------------

# FTP Trainings Coach — Handoff

Wekelijkse fiets-trainingsvoorstellen (Google Sheets + Apps Script), 
gericht op Garmin "Productive" status, met intervals.icu sync en 
Garmin-push. Uitrolbaar voor vrienden.

## Recent gedaan

### Sessie 2 juni 2026 — web-app dashboard v1 + v1.1 (Optie B zone-balk)

- Nieuw: read-only HtmlService web-app op dezelfde Sheet. 3 tabs onderin: Vandaag / Kalender / Vorm. Bestanden src/WebApp.gs, src/Index.html, src/Styles.html, src/Script.html; appsscript.json kreeg een webapp-blok (executeAs USER_DEPLOYING, access MYSELF).
- Architectuur: één getDashboardState()-getter levert alles in één call; client rendert puur uit state; tab- en dag-selectie zijn client-only; gearchitectureerd voor latere write-back (één loadState, render-uit-state). READ-ONLY: triggert NOOIT generateProposal; hergebruikt readSettings, weekStartDate, getMesoWeek, bepaalFaseVoorDatum_, getWellnessSignal+combineSignals_+rpeSignal_, getFormScore_, _statusWeekTss_, garminHeuristic, computeZoneDebt_, readPlanner, expectedRpe_/plannedTypeForDate_. Actuals/Vorm/stats uit Activiteiten- + Wellness-tab; voorstellen uit weekplan_<maandag>; RPE uit rpe_<dISO>; week+1-preview uit de Weekplanner+1-tab.
- Deployment: dev-iteratie via de /dev (HEAD) URL — altijd laatste code, GEEN redeploy (lost de webhook-tijdperk redeploy-pijn op); prod-bump via clasp update-deployment <id>. getWebAppUrl()-helper geeft de URL.
  - /exec-deployment-ID: AKfycbxE4ycR3nkOJHIS28GcYnlSFMmoXr42q9gpXK6-MWT1ET4OB9hWPaZobwkklxS4cag1Ug (huidig @12)
  - /exec-URL: https://script.google.com/macros/s/AKfycbxE4ycR3nkOJHIS28GcYnlSFMmoXr42q9gpXK6-MWT1ET4OB9hWPaZobwkklxS4cag1Ug/exec
  - /dev-URL (HEAD, altijd laatste code): https://script.google.com/macros/s/AKfycbz51mSRp2LYEIWFPJLmahX14_40w5c85UEDcjCSIW-J/dev
- v1.1 (Optie B — geordende blokken): renderVariant_ (variant/pool-pad: sweet_spot, threshold, vo2max, tempo, klim, conditie, long_z2) emit een parallelle geordende lijst blokken {minuten, zone}, 5-bucket via pctZoneBucket_ (rust<56 / z2 56-75 / tempo 76-90 / drempel 91-105 / anaeroob>105). Interval-blokken per rep gesplitst in werk+rust → de balk toont de echte interval-comb. Warmup/cooldown → rust. PUUR ADDITIEF: structuur, intent en generatie-logica ongemoeid; weekplan-snapshot key blokken: wo.blokken||null. getDashboardState bouwt zone-balk-segmenten uit blokken (segmentsFromBlokken_) als aanwezig, anders intent-fallback (segmentsFromIntent_). Zone-balk: SVG viewBox 0 0 100 100, preserveAspectRatio none, width 100%, genormaliseerde breedtes + min-breedte 1,4 met herormalisatie → past altijd op scherm, recoveries zichtbaar. Eigen palet via CSS-variabelen (accent indigo #5B5BD6); zone-/blok-kleuren ongewijzigd (grijs/blauw/geel/groen/oranje). Kalender scrollt standaard naar vandaag. Commits 89f491a (engine) + 505eb53 (frontend).

Known gaps:
- genericLongZ2, combo_long_with_efforts en pendel emitten geen blokken → intent-fallback (vlak). blokken verschijnen pas na een volgende "Genereer voorstel" (read-only dashboard genereert niet); oude snapshots draaien op de fallback.
- Live waargenomen bug: de long_z2 zone-balk toont via de intent-fallback een onterechte gele staart; pure Z2 hoort vrijwel volledig blauw. Te fixen in Prompt 2.

Convention/learnings:
- Het workout-object had origineel geen geordende numerieke blokken (structuur = display-strings); Optie B voegde numerieke blokken toe op het variant-pad.
- De /dev (HEAD) URL geeft altijd de laatste code zonder redeploy.
- access MYSELF is veilig want de bot draait op long-polling (geen actieve webhook).

Volgende code-stap (Prompt 2) — Vorm-tab herontwerp naar status-first (JOIN-geïnspireerd):
- Bovenaan een "hoe sta je ervoor"-graphic in JOIN-layout: links een ring met Girona-countdown (dagen resterend) + huidige macro-fase (bepaalFaseVoorDatum_); rechts een status-badge (icoon + semantische kleur + 1-regel verdict) afgeleid van ramp + garminHeuristic + formZone_.
- Een "i"/uitleg-paneel (inline uitklap) dat in mensentaal zegt wat de status betekent én wat te doen: bouwt-op / onderhoudt / doet-te-veel / gaat-achteruit / fris. Copy server-side (statusUitleg: titel, tekst, icon, kleur) uit formZone_ + ramp + garminHeuristic + fase. JOIN-explainers als toon-referentie — NIET JOIN's niveau/voortgang-%-model (event-driven i.p.v.).
- CTL/ATL/Vorm-grafiek behouden maar degraderen tot "trend/details" eronder, herstyled (smooth lijnen, zachte gridlines, palet-kleuren, spaarzame datum-labels), evt inklapbaar.
- Losse fix: de long_z2 gele-staart-bug (genericLongZ2 intent-fallback) uitzoeken en corrigeren.
Vervolgstap (Prompt 3): tikken op een voltooide training → uitklap met relevante data (gem. vermogen/NP, gem. HR, IF, afstand, hm, time-in-zone) — vergt uitbreiding van het actual-object.
Write-back-roadmap (na visuele afronding): settings/onboarding-tab (PropertiesService-secrets) als eerste write-back-stap, dan beschikbaarheid terugschrijven, dan regenerate-knop.

### Sessie 2 juni 2026 — RAMP_BUILD_MIN-kalibratie + RPE auto-bijsturen (a) + CTL/ATL-persist & TSB-trend (b1) + RPE-carry (b2)

KALIBRATIE (a175f8c): RAMP_BUILD_MIN=3 vastgezet. Live: ramp 0,78/wk, Garmin "Aanhouden", gate vuurt correct (0,78<3). Veldnamen bevestigd als platte ctl/atl/rampRate (geen icu_-prefix) → dode icu_-coalescing in getFormScore_ verwijderd.

(a) RPE auto-bijsturen (3022b0f): rpeRecentMismatch_ (gedeelde helper, ≤3 sessies deze week), rpeSignal_ (eenrichting, capped op demote, +2 drempel = identiek aan rpeMismatchFlag_). SIGNAL_RANK_ + combineSignals_ (max-severity merge wellness+RPE; RPE nooit recovery; geen stacking). Gewired generateProposal:66 → voedt zelfde demote-pad als wellness; assignWorkouts krijgt alleen tePlannen → within-week/future-only structureel. Banner "Wellness:" → "Bijsturing:". rpeMismatchFlag_-tekst → "resterende harde sessies automatisch lichter gemaakt". _Diag-validatie 6 merge-cases ✓.

b1 (2930e1d): Wellness-tab +4 kolommen CTL/ATL/Vorm/Ramp (I–L). syncWellness vult ze (ctl/atl/vorm 0,1; ramp 0,01). Ingebedde LINE-chart (CTL/ATL/Vorm vs Datum, hAxis.direction -1 → oudste-links), idempotent (removeChart vóór insert). Stat-regels Huidige Vorm (=K2) + CTL-ramp/wk (=L2). getWellnessSignal (leest A–D) + getFormScore_ (live-read API) ONGEWIJZIGD — kolommen zijn puur historie/visualisatie.

b2 (42d578e): mesoFactor × loadCarry-DocProp (gezet door generateProposal vóór alle mesoFactor-calls). loadCarryFactor_: vorige-week hele-week RPE-gem via durabele keys (rpe_<datum> + weekplan_<vorige-maandag>; proposal_* wordt elke generatie gewist, NIET gebruikt). carryFactorForAvg_: <2→1, ≥2→×0,93, ≥3,5→×0,88-vloer. Recovery-week (mesoWeek 4) skip, eenrichting, niet-cumulatief (verse herberekening per week). 📉-display-regel onder meso-rij. _Diag-validatie grenzen + mesoFactor-prop-wiring ✓.

Convention/learnings:
- intervals.icu /wellness: platte ctl/atl/rampRate (geen icu_-prefix), live bevestigd.
- Kalibratie is 1-punt-match (Garmin "Aanhouden" ↔ ramp 0,78 < 3). Verfijn RAMP_BUILD_MIN zodra een week met Garmin "Productive" een ramp > drempel oplevert (klem dan tussen beide).
- Twee bijstuur-assen, bewust gescheiden: (a) demoot losse sessies acuut binnen-de-week (demote-pad); (b2) dempt de week-load-ramp o.b.v. vorige week (mesoFactor). Beide eenrichting + begrensd; verschillende mechanismen, geen dubbeltelling.
- cleanupOldProposals_ wist proposal_* elke generatie; alleen weekplan_<maandag> + rpe_<datum> zijn durabel → enige betrouwbare bron voor "wat was gepland/gevoeld" over weekgrenzen.
- Live-bevestiging (screenshots): Voorstel toont Aanhouden(ramp 0,8/Peak), Bijsturing-banner, Vorm -8, load factor 1.00× (carry=1, vorige week null), Totaal TSS 237.

Openstaande stappen (Daan):
- Live validatie (a) + (b2): treden pas in werking bij een week met ≥2 gegradeerde hot-RPE sessies (nu beide inactief bij normale RPE — correct).
- (indien nog niet) Setup → RPE-avondcheck + zondag-reminder geïnstalleerd.

Volgende code-stap (keuze):
(1) getFormScore_ optioneel van de gepersisteerde Wellness-kolommen lezen i.p.v. live-API (minder API-calls; alleen als gewenst).
(2) RPE-carry verfijnen met objectieve gate (Vorm/ramp uit b1-kolommen) bovenop de subjectieve RPE.
(3) Resterende backlog: README gap-check, bot-latency (defer), getActivities/getWellness-dedup (minor).

## Volgende richting

Frontend/app-laag bovenop de bestaande data, geïnspireerd op JOIN
(commerciële adaptieve wielren-coach).
- [DONE] Web-app v1 + v1.1: read-only HtmlService-dashboard (Vandaag/
  Kalender/Vorm) + Optie B geordende zone-balk. Apps Script web-app via
  HtmlService die dezelfde Sheet leest — platform-keuze bevestigd.
- [VOLGENDE — Prompt 2] Vorm-tab herontwerp naar status-first: JOIN-stijl
  "hoe sta je ervoor"-graphic (Girona-ring + macro-fase, status-badge uit
  ramp/garminHeuristic/formZone_), inline uitleg-paneel (statusUitleg),
  CTL/ATL/Vorm-grafiek gedegradeerd tot herstylede trend eronder. Plus de
  long_z2 gele-staart-bug fixen.
- [Prompt 3] Tik-op-voltooide-training → uitklap met rit-detail (NP/HR/IF/
  afstand/hm/time-in-zone); vergt uitbreiding actual-object.
- [Daarna] Write-back-roadmap: settings/onboarding-tab → beschikbaarheid
  terugschrijven → regenerate-knop.

### Sessie 1 juni 2026 — RPE-3 + week-TSS-fixes + Form-score TSB (Vorm) + Garmin-ramp-gate

RPE-loop compleet (capture + reminders + display/flag), MVP — GEEN auto-bijsturen.
- Algorithm.gs (onder workoutZones): rpeBucket_/expectedRpe_ (bucket-map low 3,5 / high 7 / anaerobic 9; peak-bucket voor combo's), plannedTypeForDate_ (workoutType uit weekplan_<mondayISO>, proposal_<dISO> fallback — NIET col G/voorgesteldType, blanco bij voltooide dagen), rpeWeekData_, rpeMismatchFlag_ (gedeeld), rpeStatusLines_.
- Mismatch = werkelijke RPE - verwachte RPE; vlag bij gem. >= +2 over laatste 2-3 gegradeerde sessies deze week. /status na wellness-blok; Sheet-banner amber rij (mirror wellness-row). Commit 8adbf68. Live OK (/status toont Recente RPE).

Week-TSS dashboard-fix (Sheet "Totaal TSS" telde alleen planned; bot _statusWeekTss_ telde actuals al):
- 8a94420: helper actualTssByDate_(weekStart) in Algorithm.gs (model: _statusWeekTss_; {dISO:werkelijke TSS} via icu_training_load, cycling). 'planned'-tak (verleden voltooide dagen) telt actual vóór early-return.
- a2598a7: vandaag-voltooide dagen renderen in mode==='workout' en telden nog planned; workout-tak prefereert nu ook actual (tssActual[dISO] != null ? actual : wo.tss). Net: elke dag telt ACTUAL als er een activity is, anders planned — ongeacht render-modus. Geen dubbeltelling.
- Resultaat: "Totaal TSS" = actuals-to-date + planned-remaining; voltooid deel klopt nu met bot Week-TSS.

Form-score TSB (Vorm) — display-only, live-read:
- 5da75ea: Algorithm.gs formZone_ (Overgang>25 / Fris>5 / Grijze zone>-10 / Optimaal>-30 / Hoog risico) + getFormScore_ (getWellness(7), nieuwste record met ctl+atl, Vorm=ctl-atl, ramp=rampRate; defensief ctl??icu_ctl etc.). getWellnessSignal + syncWellness ONGEWIJZIGD (CTL/ATL niet gepersisteerd — live-read MVP). /status Vorm-regel vóór RPE-sectie; Sheet-banner diag-segment.
- 2060e20: Garmin-status eerlijk gemaakt — garminHeuristic(totalTss, mesoWeek, macroFase, fs) gate't de 'Productive'-verdicts op de CTL-ramp: ramp < RAMP_BUILD_MIN (=3, Proposal.gs:521, TUNABLE) -> 'Aanhouden — load houdt fitheid vast'. ramp null -> originele TSS-verdict (geen regressie). Bestaande verdict-strings byte-identiek. /status Vorm-regel toont nu ook ramp.

Convention/learnings:
- Render-modus is GEEN betrouwbare "voltooid"-proxy (vandaag-voltooid rendert 'workout'); gebruik presence van een activity.
- Garmin noemt het pas "Productief" bij stíjgende CTL; gate TSS-verdict op rampRate (vlak -> Maintaining).
- Form = live-read nieuwste wellness-record (ctl-atl); CTL/ATL nog niet gepersisteerd.
- nlNumber (Utils.gs) rondt NIET af -> rond getallen af vóór formatteren (anders lange decimalen).
- RPE_*_TYPES_-lijsten spiegelen workoutZones maar hergebruiken die NIET (doel-arg); nieuwe types ook hier bijwerken.
- Voor "wat was gepland" op voltooide dagen: persisterende snapshot (weekplan_/proposal_), nooit col G.

Openstaande stappen (Daan):
- KALIBRATIE: lees /status ramp-waarde door; tune RAMP_BUILD_MIN zodat de huidige vlakke ramp -> "Aanhouden" matcht met Garmin (nu Aanhouden bij TSS ~224).
- Bevestig wellness-veldnamen (Object.keys(getWellness(2)[0])) -> ctl/atl/rampRate of icu_-prefix? Daarna defensieve coalescing simplificeren.
- /status Vorm+ramp-regel + Genereer voorstel ("Verwachte Garmin" -> Aanhouden) + Totaal TSS ~237 verifiëren.
- (indien nog niet) Setup > Installeer RPE-avondcheck + zondag-reminder.
- Live cyclus- + tour-taper-validatie.

Volgende code-stap: na kalibratie RAMP_BUILD_MIN -> keuze tussen (a) RPE auto-bijsturen (RPE voedt volgend voorstel — echte adaptieve loop) of (b) CTL/ATL persisteren in Wellness-tab cols I/J voor TSB-trendgrafiek.

Backlog: (1) RPE auto-bijsturen. (2) CTL/ATL persist + TSB-trend. (3) README gap-check. (4) Bot-latency Cloud Functions/Cloudflare (defer). (5) getActivities()/getWellness()-dedup in render (optioneel, minor).

### Sessie 1 juni 2026 — proposal-engine + RPE-loop (HEAD bij sessie-einde: deze commit)
- Rollover-bug: Weekplanner +1 start blanco; rollover trekt +1 alleen
  binnen bij echte user-input (plannerHasUserInput_), anders patroon-
  fallback. Menu "🧹 Weekplanner +1 leegmaken".
- Proposal-engine duration-aware: scaleBlocksToFit_ schaalt reps ->
  interval-lengte, respecteert per-blok minMin; genericLongZ2 schaalt
  klim-sim reps; warmup/cooldown ingekort bij <=75 min; ingekorte
  workouts dragen ", ingekort". Beschikbare minuten = plafond, geen target.
- selectVariant_(type, week, dagIdx) nu deterministisch (geen DocProp-
  cache) -> twee dagen zelfde type krijgen verschillende variant.
  computeWeekVolumeMin_ leest geplande (geschaalde) duur uit
  proposal_<dISO> i.p.v. beschikbaarheid.
- Messaging: Peak-banner houdt volume (niet "niet opbouwen"); volume-
  nudge zacht, stelt geen niet-aangevinkte dagen voor. Tour-taper:
  trip-event -> tour_taper_z2 (endurance vasthouden, laatste 2 dagen
  kort) i.p.v. race-openers-taper; banner schakelt mee.
- Over/under-workouts: één rij per set i.p.v. per minuut. Bot:
  /voorstel + /sync.
- RPE-loop (MVP capture): /klaar -> syncActivities + RPE 1-10 inline-
  knoppen -> opslag DocProp rpe_<datum>. callback_query verwerkt via
  handleRpeCallback. Avond-vangnet rpeAvondCheck (20:00) + zondag-
  reminder zondagReminder (19:00). Beide via Setup-menu te installeren.
- Nieuwe convention: op long polling is clasp push genoeg, GEEN redeploy
  (triggers/menu/onOpen draaien editor-code). Redeploy alleen bij terug
  naar webhook (doPost via /exec).
- Openstaande handmatige stappen (Daan): Setup > Installeer RPE-
  avondcheck + zondag-reminder (elk 1x); test /klaar in Telegram; live
  cyclus- + tour-taper-validatie maandag.
- Volgende code-stap: RPE-3 — RPE tonen in /status + wellness-banner met
  mismatch-vlag (werkelijke RPE vs verwachte RPE uit intensiteit: Z2
  ~3-4, sweet spot ~6, threshold ~7-8, vo2 ~9; bij gemiddelde mismatch
  >= +2 over laatste 2-3 sessies een rust-signaal). MVP = tonen +
  vlaggen, GEEN auto-bijsturen.
- Backlog daarna: (1) TSS=0-bug — gematchte/voltooide ritten tellen niet
  in week-TSS; fix = icu_training_load uit gematchte activities
  optellen. (2) Form-score TSB (CTL/ATL rolling baseline in wellness-
  banner, stretch). (3) README gap-check (grotendeels af). (4) Bot-
  latency Cloud Functions/Cloudflare — defer.

- ✅ Feedback-loop (mei 2026): zone-mapping geverifieerd, HR-fallback 
  voor power-loze rides, dekking-op-actuals, weekend-branch debt-aware 
  via combo_long_with_efforts, expliciete compensatie-regel in 
  feedback-blok.

### Sessie 31 mei 2026 avond — bot-foundation klaar

Volledige scope-B fundering live. Secrets verhuisd van Sheet-cellen
naar PropertiesService met een 🔐 Setup-submenu voor set/view/clear,
inclusief migratie-logica die oude cel-waarden bij eerste read
automatisch overzet. Apps Script project gemigreerd naar persoonlijk
gmail account (dtkorteweg@gmail.com) wegens Workspace-domain-restrictie
op Web App deployment — het oude werk-account weigerde externe webhook-
calls. Telegram bot foundation gebouwd: doPost-endpoint met query-param
secret-validatie, autorisatie tegen TELEGRAM_CHAT_ID, command-router
voor /start /help, plus Setup-menu acties voor getMe-test, send-self-
test, webhook-registratie en een "Reset webhook (delete + register)"
voor queue-flush. update_id dedupe via FIFO ring buffer (cap 50) in
DocumentProperties tegen herhaalde verwerking. Audit-tab in de Sheet
die elke doPost-call logt (timestamp, update_id, chat_id, text, branch,
response_ok, duration_ms) met nieuwste rij bovenaan en cap op 200,
plus een Setup-menu actie "Toon laatste 10 audit-rijen" voor mobiele
diagnose zonder Apps Script Editor te hoeven openen. Vandaag toegevoegd:
/status command voor beknopte mobile-friendly weeksamenvatting (periode,
week TSS+tijd, wellness, debt) die de bestaande Algorithm.gs en
Doel.gs helpers hergebruikt zonder generateProposal te triggeren.

Hard-earned lessons uit deze sessie:

Apps Script Web App deployment onder Google Workspace account is
domain-restricted en NIET toegankelijk voor externe diensten zoals
Telegram, ook al staat Who-has-access op Anyone. Persoonlijk gmail
account vereist. De URL van een geforceerd-Workspace deploy heeft het
patroon /a/macros/<domain>/ in het pad — die is direct te herkennen
als onbruikbaar voor publieke webhooks. Een persoonlijk-account deploy
gebruikt de schone /macros/s/<id>/exec vorm.

clasp push update alleen de editor-snapshot, niet de gedeployde Web
App. Na elke clasp push die TelegramBot.gs of het doPost-pad raakt
moet Daan in de Apps Script Editor rechtsboven Implementeren openen,
Implementaties beheren kiezen, het potlood-icoon bij de actieve
deployment klikken, Versie op Nieuwe versie zetten en Implementeren
klikken. Zonder die stap blijft Telegram op de oude code roeren en
lijken bugs onverklaarbaar persistent. Dit is de meest voorkomende
diagnose-valkuil in deze stack.

Telegram retried webhook deliveries met klassiek exponential backoff
ook al retourneert doPost netjes 200 OK. Vermoedelijke oorzaak: Apps
Script's response signaal komt niet correct of niet snel genoeg door
aan Telegram. update_id dedupe in DocProperties cache is daarom
noodzakelijk om duplicate verwerking en herhaalde antwoorden te
voorkomen. Tijdens debug-sessie kwam een burst van 30+ /start-replies
binnen wat exact dit symptoom was.

Apps Script API moet expliciet enabled zijn op een nieuw Google
account voor clasp push te laten werken. Toggle is te vinden via
script.google.com/home/usersettings. Zonder dat geeft clasp push de
weinig informatieve foutmelding Invalid script key en list-scripts
toont No script files found.

DocumentProperties wordt niet meegekopieerd bij Sheet-kopie naar
ander account. Bij migratie moet je alle secrets opnieuw invoeren via
het Setup-menu en triggers via Setup-acties opnieuw installeren. De
in PROMPT G ingebouwde migratie van cel naar PropertiesService werkt
alleen binnen één account-context, niet over account-grenzen.

Weekplanner +1 implementatie toegevoegd vóór sluit-tijd vandaag,
zodat Daan zondag-avond beschikbaarheid voor volgende week kan
invullen zonder op maandag-rollover te wachten. Tweede tab
"Weekplanner +1" gespiegeld aan de bestaande Weekplanner, met een
gedeelde structuur-helper. ensureCurrentWeek trekt nu op rollover
de +1 user-data verbatim naar de huidige week (train/min/dagtype/
notitie, met verse datums in kol C en G+H gereset) en materialiseert
+1 vers voor week +2. Manual fallback in Coach-menu via "📋 Rol
Weekplanner +1 naar huidig" voor het geval onOpen op maandag gemist
is. onOpen roept beide ensure-functies aan; buildAll bouwt beide
tabs in volgorde en plaatst +1 direct na Weekplanner in de tab-
order.

Respond-via-webhook techniek geprobeerd in PROMPT O — doPost zou
de sendMessage actie direct als JSON-body in de HTTP-response
teruggeven (formaat method/chat_id/text met MimeType JSON) om de
extra UrlFetchApp round-trip naar api.telegram.org te besparen en
het 200-signaal eerder te leveren. Bleek niet te werken op Apps
Script Web Apps: Telegram herkent de JSON-sendMessage-body niet,
vermoedelijk omdat Apps Script de response via een 302-redirect
naar googleusercontent.com routeert waardoor het JSON-formaat niet
direct aankomt. Bot stuurde geen bericht meer en retries gingen
gewoon door. PROMPT P rollback naar tgSendMessage als primaire
route — handlers gebruiken weer UrlFetchApp via _tgRequest_,
routeCommand_ returnt enkel branch-string, doPost retourneert
altijd lege OK. Dedupe blijft de praktische mitigatie voor het
retry-symptoom; root-cause op Apps Script's HTTP response-pipeline
blijkt niet via code-fix oplosbaar binnen dit platform. Een echte
oplossing vereist migratie naar Cloud Functions of een ander
hosting-model.

Switch naar long polling architectuur in PROMPT Q. Telegram retry-
blokkering definitief opgelost door webhook te verlaten en
getUpdates te pollen elke minuut via Apps Script time-driven
trigger. pollTelegramUpdates leest TELEGRAM_POLL_OFFSET uit
DocProperties, roept getUpdates aan met die offset en timeout 0,
processed elke update via een gedeelde _processTelegramUpdate_-
helper (gerefactord uit doPost zodat webhook- en polling-pad
identiek dezelfde dedupe/auth/audit/dispatch-flow gebruiken), en
zet de offset op de hoogste update_id plus 1 zodat Telegram de
verwerkte updates server-side opschoont. Nieuwe Setup-menu acties:
Start polling (deleteWebhook + install minute-trigger + opslag
trigger-ID), Stop polling (verwijdert triggers + wist DocProp),
Poll nu (eenmalig voor testing). doPost en de webhook-acties blijven
in de code als optie voor toekomstige migratie naar Cloud Functions.
Trade-off: 0-60 sec latency tussen bericht en antwoord. Voor coach-
bot acceptabel. Voor real-time chat-ervaring later: migratie naar
Cloud Functions of Cloudflare Worker.

Open punten voor morgen, in volgorde van prioriteit:

1. Live cyclus-verificatie van afgelopen week (taper naar Girona)
   na maandag's data-input. Beoordeel of FTP-build de Garmin
   Productive-status heeft vastgehouden onder de week-prikkel.

2. README aanvullen met Setup en Deployment secties inclusief alle
   hard-earned lessons hierboven, plus een security-sectie voor
   toekomstige vrienden of open-source users die het template
   willen kopiëren. Repo is sinds vanavond public.

3. Form-score TSB integratie in feedback-loop. CTL en ATL uit
   intervals.icu activities oprollend baseline berekenen en
   integreren in de wellness-banner als adaptiviteits-gat van het
   huidige systeem. Roadmap-punt 11 wordt hiermee geadresseerd.

4. Volgende bot commands: /voorstel voor het weekvoorstel als
   Telegram-bericht, /sync voor handmatige sync-trigger. Beide
   relatief klein bovenop de bestaande /status fundering.

5. Real-time bot latency verbeteren via Cloud Functions of
   Cloudflare Worker migratie als 0-60 sec polling-latency op
   termijn te traag voelt. Webhook-mode is dan ook weer bruikbaar
   (doPost en register-webhook acties staan nog in de code) en
   respond-via-webhook zou dan ook eindelijk werken zonder de Apps
   Script 302-redirect die het hier blokkeerde.

Notitie: repo is sinds 31 mei avond public. Secrets-refactor en
history-audit hebben dit veilig gemaakt — geen secrets in code of
git history, alleen propertynamen.

### Sessie 30 mei 2026
- Feedback-loop adaptief gemaakt: dekking-op-actuals, debt-weegt 
  weekend, expliciete no-compensation (5bdfc94, 2f2abc7, 3dfcdca).
- Scope-B foundation 1-2 af: Settings uitbreiding (gewicht / profiel-
  preset / telegram-velden / autocast-vinkjes), VOLUME_TARGETS via 
  preset-getter, FTP-autocast (1605dd1, 11a748a). FTP-bron na 
  diagnose: sportSettings[Ride].mmp_model.ftp (106a93b).
- buildPlanner idempotent: save→rebuild→restore + vangnet in 
  ensureCurrentWeek (68f8c8d, dcabb40).
- renderProposal planned-mode: voltooide dagen renderen netjes ook 
  zonder voorgesteldType (dcd62c4).
- Workout-duur scaling: long_z2 en combo_long_with_efforts honoreren 
  d.minuten i.p.v. event-target override (f5203a8).

## Locaties
- Lokaal: C:\Users\daan\Projects\training
- GitHub: github.com/daanhhk/training
- Sheet: 1YTgfkwehC1VJKo-MZTYDRJ_6e6SrjT3auMmHfD97ozA
- Apps Script: 18Q5UXRSUU1ZVIWnkeXg6_HnejuVh-G-DIoqVIJbFxRP22irbc_err-CN
- intervals.icu Athlete ID: i50690

## Atleet (Daan)
FTP 275W · HRmax 198 · rust 51 · LTHR 178 · loop-pace 4:27 · Garmin 
Epix Gen 2. Fiets primair. Patroon: di (soms vr) pendel 2×36km, wo/do 
vrije sessie, weekend lange rit. 3-4 dagen/week.

## Werkwijze
Twee-laags: Claude (chat) = ontwerper/prompt-schrijver; Claude Code 
(CLI) = uitvoerder (commit + clasp push + git push). Prompts gelabeld 
[NIEUWE PROMPT] / [VERVANGT VORIGE] / [AANVULLING].

## Modules (src/)
Code · Settings · Zones · Doel · Planner · Algorithm · Proposal · 
IntervalsApi · Sync · Email(stub) · Utils · Activiteiten · Wellness · 
Events · Test(tijdelijk) · Workouts/{Ftp,Vo2max,Conditie,Beklimmingen}

## Architectuur — 3-lagen week-model (GEBOUWD, geverifieerd)
- L1 Patroon: persistent default week (DocProp 'pattern', getPattern/
  savePattern). Di/do/za defaults.
- L2 Week-state: Weekplanner-tab = live view huidige week. 
  ensureCurrentWeek doet auto-rollover (geen handmatig doorschuiven); 
  draait bij onOpen + generateProposal + buildAll. tab_week_start DocProp.
- L3 Completion: uit intervals.icu sync (reconcilePlannerWithActivities); 
  manuele Gedaan? als fallback.
- Menu "Sla huidige week op als standaardpatroon".

## Rollend venster
rollingZoneCoverage(ss,7): zone-dekking over laatste 7 dagen, cross-week 
(geen maandag-reset). avoid-consecutive-hard via recentHardDayDate_.

## Variant-pools (diversiteit)
Per workout-type een pool (zelfde load-focus zone, andere vorm). 
selectVariant_(type, weekIndex): index = weekIndex % length + avoid-repeat. 
Idempotent per week via DocProp variant_<type>={week,id}. Centrale 
renderVariant_ bouwt structuur+intent+tss. Pools: ftpPools_/vo2Pools_/
conditiePools_/climbPools_/genericPools_.
- VO2: 5x4/4x5/6x3/8x2/30-30/40-20 · SS: 2x20/3x15/2x30/pyramide/overunder
- THR: 4x10/3x15/2x20/overunder · Tempo: 2x20/3x15/45
- Z2: steady/cadans/progressief/nuchter · Klim: ss_lang/lowcad/biggear/bergsim

## Intent-opslag (fundering feedback-loop)
Elk workout-object heeft intent {zone: minuten}. Per generate: DocProp 
weekplan_<maandag> = volledige week + intent (+ week-historie).

## Periodisering
- Mesocyclus (handmatige teller 1-4): loadFactor 1.00/1.08/1.15/0.60.
- Macro-fase event-driven: bepaalFaseVoorDatum_ telt terug vanaf 
  hoofd-event: ≥9wk Base, 5-8 Build, 3-4 Peak, 2 Peak, 1 Taper, 0 recovery.
- Events-tab (persistent DocProps): datum/naam/type/prioriteit/afstand/
  hm/klim-type/notitie.

## Huidige event
Girona fietsvakantie, vertrek 13 juni 2026 (trip/A/lang klim, ~90km/
1200hm/dag). Peak nu → Taper laatste 7 dagen. Primair doel nu = FTP 
(instelbaar: FTP/Conditie/Beklimmingen/VO2max).

## intervals.icu sync
IntervalsApi.gs (Basic auth base64). Dagelijkse trigger 08:00 
Europe/Amsterdam (slaapdata pas dan beschikbaar). Activiteiten + Wellness 
auto-gevuld; zones uit sportSettings[Ride]; power-velden via fallback 
(icu_average_watts e.a.).

## Wellness
HRV/slaap demotie-banner in Voorstel (recovery/demote/warning/normal). 
NB: past nu nog NIET de workout aan — alleen banner (roadmap).

## Garmin-push
ZWO XML base64 in file_contents_base64 → intervals.icu maakt FIT → Epix. 
Idempotent via external_id + POST /events/bulk?upsert=true. NB: /events 
negeert embedded workout_doc. Complexe workouts (30/30, over/under) 
vallen nu terug op blok-structuur in ZWO (verfijn-punt).

## Hard-earned conventies
- NL-locale formules: komma decimaal + puntkomma separator 
  (=ROUND(B3*0,55;0)). nlNumber(n) helper voor geïnterpoleerde getallen. 
  setFormula() converteert NIET betrouwbaar — lever pure NL-notatie.
- setFontStyle('italic') (niet setItalic); geen setFrozenColumns met 
  merged titles; kolombreedtes ná flush(); getLastRow() onbetrouwbaar 
  bij ARRAYFORMULA; render-wijzigingen pas zichtbaar na "Bouw alles 
  opnieuw"; maandag-berekening dow=getDay(), daysToMonday=(dow===0)?-6:1-dow; 
  state in DocumentProperties.
- icu_zone_times shape: array van {id,secs}; Z1-Z7 power-zones + 
  SS-overlay. SS moet geskipt; sum Z1-Z7 == moving_time bevestigt dat. 
  Mapping per id (niet array-index): Z1-Z2→low, Z3-Z4→high, Z5-Z7→anaerobic.
- icu_hr_zone_times is platte [7]-array (andere shape dan power). 
  Index→bucket zelfde verdeling. Source-tracking: power wint van HR 
  bij gemengde dag.
- Dekking: ≥15min werkelijke minuten per bucket = gedekt 
  (DEKKING_MIN_MIN). Debt-force op weekend-dag: high>30 of anaerobic>20 
  → combo_long_with_efforts, uitgeschakeld in taper/recovery.
- Render-bug patroon: render-conditie die leunt op afgeleid veld 
  (bv. d.voorgesteldType, alleen door assignWorkouts gevuld voor 
  toekomstige dagen) i.p.v. brondata (d.train kolom A) geeft 
  fout-negatieven bij voltooide dagen. Bij render-bugs eerst checken: 
  leunt de conditie op een afgeleid veld dat nog niet gevuld kan zijn 
  in deze lifecycle? Brondata = kolommen waar gebruiker direct schrijft 
  (Train, Datum, Dagtype, Toelichting, Gedaan). Afgeleide velden 
  (Voorgesteld type, weekplan-snapshot intent, dekking-flags) komen 
  later in de flow.

## Roadmap — scope B (app/bot)

Vastgelegd mei 2026: Telegram bot + open-source, single-user-Sheet
per gebruiker.

### Foundation (uitrol-klaar zonder bot)
1. [DONE — commits 1605dd1, 11a748a, 106a93b] Settings uitbreiden:
   gewicht, profiel-preset, telegram_chat_id, telegram_bot_token.
   FTP-autocast vanuit **sportSettings[Ride].mmp_model.ftp** (de
   werkende bron na diagnose; icu_rolling_ftp bleek athlete-level niet
   te bestaan).
2. [DONE — commit 1605dd1] Profielen-presets (Amateur 3u / Gemiddeld
   5u / Gevorderd 7u / Pro 10u+) via `getVolumeTargets()` getter.
3. Multi-user-klaar code: state-keys met chat_id-prefix.
4. Onboarding-wizard ("🎯 Eerste keer instellen" menu).
5. README + install guide in repo.

### Telegram bot
6. Apps Script doPost endpoint + bot-token verificatie.
7. Zondag 19:00 trigger → beschikbaarheid-bericht met inline buttons.
8. Post-rit RPE-prompt bij sync, opslag in ActiviteitenFeedback.
9. RPE vs geplande zwaarte → mismatch-detectie in wellness-laag.

### Later (na scope-B)
10. Multi-event A/B/C-prioriteits-periodisering.
11. Form/TSB-score uit intervals.icu in plaats van single-day HRV.
12. RPE pattern-detectie over 14 dagen.
13. Visualisaties (dashboards, kalender-view, FTP-trend).
14. Workout-library scraping van whatsonzwift.
15. FTP-groei-voorspelling.
16. Wellness drijft workout-keuze (oude roadmap-punt 2).
17. recentHardDayDate_ op actuals i.p.v. intent — dan kan
    debtForced-exemptie van avoid-consecutive-hard weg.
18. Off-bike training (krachttraining, mobility).
19. Workout-duur volledig: combo en pendel-types ook scaleable maken,
    plus variant-pools met duur-tags voor type-selectie op basis van
    beschikbaarheid (Aanpak B/C uit ontwerp-discussie).
20. TSS-berekening uit actuals (analoog aan week-volume-uit-actuals).
21. Live cyclus-verificatie maandag 1 juni met hele nieuwe week aan
    data (verificatie-taak, geen feature).

### Achterhouden tot duidelijk waarom
- Voeding (intervals.icu doet 't).
- Sociale features.
- LLM-gedreven workout-generatie.
