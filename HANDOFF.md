# FTP Trainings Coach — Handoff

Wekelijkse fiets-trainingsvoorstellen (Google Sheets + Apps Script), 
gericht op Garmin "Productive" status, met intervals.icu sync en 
Garmin-push. Uitrolbaar voor vrienden.

## Recent gedaan
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
