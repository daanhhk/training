# FTP Trainings Coach

Custom training-tool voor Daan (en uitrolbaar voor fietsende vrienden).
Genereert wekelijkse trainingsvoorstellen op basis van intervals.icu
data en pusht structured workouts naar Garmin Epix.

Status: MVP werkend (mei 2026). Mesocyclus + Wellness-demotie +
ZWO-push naar Garmin live. Outcome-based feedback loop = volgende fase.

## Tech stack

- Google Sheets + Apps Script (.gs) — primair platform
- intervals.icu API (Basic auth via base64 API key)
- Garmin Connect (via intervals.icu sync)
- ZWO XML format voor structured workouts naar Epix

## Locaties

- GitHub: daanhhk/training
- Apps Script: 18Q5UXRSUU1ZVIWnkeXg6_HnejuVh-G-DIoqVIJbFxRP22irbc_err-CN
- Sheet: 1YTgfkwehC1VJKo-MZTYDRJ_6e6SrjT3auMmHfD97ozA
- Lokaal: C:\Users\daan\Projects\training

## Bestandsstructuur

- src/Code.gs — menu + onEdit handlers
- src/Settings.gs — DocProps persistente settings + Instellingen tab
- src/Zones.gs — Zones tab rendering (power + HR + Sweet Spot)
- src/Doel.gs — 12-week mesocyclus + macro-fase logica
- src/Planner.gs — Weekplanner tab build
- src/Algorithm.gs — workout selection + buildWorkout +
  getWellnessSignal + buildWorkoutZwo_
- src/Proposal.gs — Voorstel tab rendering (banner + per-dag blokken)
- src/IntervalsApi.gs — intervals.icu API calls + pushWorkout
- src/Sync.gs — data sync orchestratie + pushAllPendingWorkouts
- src/Email.gs — stub (07:00 digest, nog te implementeren)
- src/Utils.gs — helpers (nlNumber, sanitize, etc.)
- src/Activiteiten.gs — Activiteiten tab
- src/Wellness.gs — Wellness tab
- src/Workouts/{Ftp,Vo2max,Conditie,Beklimmingen}.gs — workout
  libraries per doel

## Workflow

Daan (chat in Claude.ai) ↔ Claude Code (CLI lokaal):

1. Daan beschrijft wens of bug aan Claude (chat)
2. Claude schrijft uitgewerkte prompt → Daan plakt in Claude Code
3. Claude Code implementeert + commit + clasp push + git push
4. Resultaat-rapport (incl. eerlijke notities over afwijkingen) terug
   naar Claude (chat) voor volgende iteratie

Commits in logische stappen — bundeling voor samenhangende changes
is OK, geen geforceerde 1-commit-per-prompt-subitem splits.

## Conventies (HARD-EARNED — niet zelf herontdekken)

### NL-locale Google Sheets formules
- KOMMA als decimaal EN PUNTKOMMA als argument-separator:
  `=ROUND(B3*0,55;0)`
- `setFormula()` doet GEEN automatische locale-conversie.
  String-interpolatie van JS Number geeft "." dus altijd
  `.replace('.', ',')` of via `nlNumber()` helper in Utils.gs.
- Zone max-watt rendering: gebruik FLOOR (niet ROUND) voor exact
  parity met intervals.icu. Z3 max @ 90% = FLOOR(247.5) = 247W,
  niet 248W.
- Boundary conventie: zone N min = zone N-1 max + 1 (parity met
  intervals.icu). Z2 = 56-75%, niet 55-75%.

### intervals.icu API quirks
- Base URL: `https://intervals.icu/api/v1`
- Auth: `Basic ` + base64(`API_KEY:<api_key>`)
- `/events` endpoint NEGEERT `workout_doc` embedded (slikt zonder
  error, slaat niet op). Voor structured workouts gebruik
  `file_contents_base64` met ZWO XML.
- DSL-in-description werkt voor intervals.icu UI-chart, maar Garmin
  krijgt dan ALLEEN TEKST (1 lap). Voor multi-step op Epix is
  ZWO-file de enige route die werkt.
- Idempotent push: `external_id` +
  `POST /events/bulk?upsert=true` (geen aparte delete nodig).
- Athlete settings → Garmin → "Upload workouts to Garmin" toggle
  MOET aan staan (`icu_garmin_upload_workouts: true`) anders
  syncen workouts niet naar Garmin Connect.

### Zone-data quirks
- HR zones uit `sportSettings[Ride].hr_zones` = RAW BPM-waardes
  (geen percentages). Power zones = % FTP. Mix dit niet op.
- `icu_sweet_spot_min/max` op athlete-object = NULL voor velen.
  Aanwezig op activity-object van rides met power. Fallback: 84/97
  (intervals.icu standaard).
- 999 in zone-array = "onbegrensd" indicator. Render als ∞ niet
  als percentage of W-waarde.

### Code stijl
- Engelse code en commit messages
- Nederlandse UI-strings (menu's, Sheet labels, banner-teksten,
  toast-meldingen)
- `setItalic()` bestaat NIET op Range; gebruik `setFontStyle('italic')`
- `setFrozenColumns()` conflicteert met merged title rows over
  alle kolommen
- Column widths zetten als LAATSTE stap (`stelBreedtes()` na
  `SpreadsheetApp.flush()`) — anders overschrijven merge/write
  operaties dit
- `getLastRow()` onbetrouwbaar bij ARRAYFORMULA-tabs; scan kolom A
  voor eerste lege cel

### Security
- API keys NOOIT in chat plakken. Bij blootstelling: regenereer
  meteen via intervals.icu Developer Settings.
- API key wordt in DocProperties opgeslagen (Apps Script encrypted
  storage).

## Bekende open punten

- **Prompt 5 — Outcome-based feedback loop**: vergelijk werkelijke
  zoneTimes van voltooide rides met intent van geplande workout.
  Compenseer gemiste zone-load in resterende week. Self-correcting
  algoritme.
- **Email digest 07:00**: Email.gs is stub. Eén ochtend-mail met
  vandaag's workout + wellness-signaal + week-overview.
- **ZWO-fallback voor complexe workouts**: vo2_3015 (30/15s
  dual-power patterns) en sommige combos parsen we niet naar ZWO.
  Vallen terug op description-only (Epix wordt 1-lap voor die
  specifieke types). Niet urgent — komt pas in mesocyclus-week 5+.
- **Telegram bot** (optioneel): 2-way interactie voor on-the-fly
  herziening ("ik kan donderdag niet trainen, regenereer voorstel").

## Veel-gemaakte fouten (lessons learned)

- Sheet-rendering wijzigingen tonen pas effect NA `🚴 Coach → Bouw
  alles opnieuw`. Pure code-push via clasp is niet genoeg.
- Bij dedup: Date object vs text-string mismatch — typen consistent
  houden.
- ARRAYFORMULA + dropdown validation kan imports crashen — careful met
  reset-volgorde.
- Het 13e Status-kolom in km-registratie crashte ooit; column count
  moet in sync met script logic blijven.
