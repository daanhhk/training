# FTP Trainings Coach — Handoff

Wekelijkse fiets-trainingsvoorstellen (Google Sheets + Apps Script), 
gericht op Garmin "Productive" status, met intervals.icu sync en 
Garmin-push. Uitrolbaar voor vrienden.

## Recent gedaan
- ✅ Feedback-loop (mei 2026): zone-mapping geverifieerd, HR-fallback 
  voor power-loze rides, dekking-op-actuals, weekend-branch debt-aware 
  via combo_long_with_efforts, expliciete compensatie-regel in 
  feedback-blok.

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

## Roadmap (open)
1. Wellness-gestuurde dag-aanpassing (niet alleen banner).
2. Vooruitgang-dashboard (FTP-trend, power curve).
3. Email digest 07:00 (Email.gs stub).
4. ZWO-fallback verfijnen voor 30/30 & over/under micro-structuur.
5. Telegram bot (2-way, dunne interface op generateProposal + week-overrides).
6. Opruimen: dode code + TEST-menu verwijderen.
7. Fundamenteel: recentHardDayDate_ op actuals i.p.v. intent — dan kan 
   de debtForced-exemptie van avoid-consecutive-hard weg.
