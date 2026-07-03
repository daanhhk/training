# REBUILD-SCOPE.md — Cloudflare-herbouw architectuur-recon

Read-only planningsdoc (geen code gewijzigd). Doel: bepalen wat as-is naar een
Cloudflare Worker + D1 + React kan, en wat sterft. Bron = repo-broncode; live
Sheet-kolomschema's zijn geïnfereerd uit header-constanten/`getRange` → gemarkeerd
**verify tegen live Sheet**.

Kern-onderscheid: `SpreadsheetApp` / `PropertiesService` / `CacheService` /
`UrlFetchApp` / `Session` / `Utilities` / `Logger` / `ScriptApp` / `HtmlService`
= GAS-runtime-globals. GAS-globals per bestand (grep-telling): TelegramBot 56 ·
WebApp 23 · Secrets 19 · Sync 19 · IntervalsApi 12 · Events 11 · Planner 10 ·
Algorithm 9 · Settings 9 · Code 6 · Utils 5 · Wellness 4 · Activiteiten 3 · Doel 3 ·
SelfTest 3 · Zones 2 · Proposal 1. **Archetypes.gs, Coach.gs en Workouts/*.gs staan
NIET in de lijst → 0 GAS-globals → volledig portabel.**

---

## A. Engine-portabiliteit

| Module | GAS-vrij? | Gekoppelde globals / kern-fns | Abstraheerbaar |
|---|---|---|---|
| `Archetypes.gs` | **JA (100%)** | geen. `ARCHETYPES`, `PROFILES`, `profileForDoel_`, `expandArchetype_`, `goalWorkout_`, `goalPickIntent_`, `intentHaalbaar_`, `archetypeAllowedForProfile_`, `volumeModulatie`, `goalEffWeights_` | port as-is |
| `Coach.gs` | **JA (100%)** | geen (CLAUDE.md: "Geen Sheet/DocProp/API-reads; volledig testbaar") — coach-narratief/classificatie | port as-is |
| `Workouts/{Ftp,Vo2max,Conditie,Beklimmingen}.gs` | **JA (100%)** | geen — workout-libraries (param-in/uit) | port as-is |
| `Algorithm.gs` | **MIXED** | PURE: `allocateQualityWeek_`, `assignWorkouts`, `buildWorkout`, `keyIntensity`, `effectiveMacroFase_`, `debtPreferredType_`, `tssFromZoneMinutes_`, `snapshotDayAction_`, `workoutZones`. GAS: `generateProposal` (`SpreadsheetApp`+DocProps), `computeZoneDebt_` (`getActivities`), `rpeSignal_`/`getFormScore_` (DocProps/Sheet), `getTrainingLibraryCached_` (`CacheService` :2380) | pure-fns port as-is; orchestratie herschrijven op D1 |
| `WebApp.gs` | **MIXED** | PURE: `dashActivityScan_`, `dashActualsByDate_`, `dashStatsFromActivities_`, `dashNiveauReeks_`, `dashBeginAnker_`, `computeNiveau_`, `niveauProgressie_`, `ctlAtWeek_`, `eftpFromActivities_`, `ftpBandFromProjection_`. GAS: `doGet`, `getDashboardState`, `refreshActivities` (23 globals) | pure dash-calc port as-is; `getDashboardState`-assembly herschrijven |
| `Settings.gs` | **MIXED** | PURE: `computeMacroPhase`, `DOEL_OPTIONS`, `FASE_OPTIONS`. GAS: `readSettings`, `loadSettingValue`, `getGewicht` (Sheet/DocProps) | computeMacroPhase as-is; readSettings → D1 |
| `Doel.gs` | **MIXED** | PURE: `planModeLabel_`, `eventFase_` (param-in), `buildGoalProfile_`. GAS: `bepaalFaseVoorDatum_` (`SpreadsheetApp.getActive`+`readSettings`+`getAllEvents_`), `buildDoelTab` | fase-logica achter een events/settings-port |
| `Sync.gs` | **MIXED** | PURE: `mergeById_`, `activityToRow_`, `sortActivityRowsNewestFirst_`, `zoneTimesFromCell_`, `_rowId_`, `rowMinuteKey_`. GAS: `syncAll`, `syncActivities`, `reconcilePlannerWithActivities` (19: `SpreadsheetApp`+`UrlFetch`) | merge/mapper as-is; sync-orchestratie herschrijven |
| `Utils.gs` | **MIXED** | PURE: `formatDate`, `stripTime_`, `nlNumber`, `weekStartDate`. GAS: `getDocProp`/`setDocProp`, `getMesoWeek` (DocProps) | pure helpers as-is; DocProp-helpers → storage-port |
| `IntervalsApi.gs` | **GAS (http)** | `intervalsRequest_` (`UrlFetchApp`, Basic auth), `getActivities`, `getWellness`, `getAthleteInfo`, `pushEvents_` | **abstraheerbaar** achter http-port: `UrlFetchApp.fetch` → `fetch()`; logica portabel |
| `TelegramBot.gs` | **GAS (io)** | `doPost`, `pollTelegramUpdates`, `tgSendMessage`, `routeCommand_`, `handleKlaar_`, dedupe (`UrlFetch`+DocProps+Sheet). PURE: `_statusWeekTss_` (param `actValues`) | webhook-route herschrijven; polling sterft |
| `Secrets.gs` | **GAS** | `PropertiesService` (`SECRET_KEYS`) | → Worker-env |
| `Events/Planner/Zones/Activiteiten/Proposal/Wellness/Code.gs` | **GAS (Sheet-builders)** | Sheet-tab-render/-lezers, `onEdit`, menu | **sterft** (§E) |

**Reeds Worker-ready volgens de gate — belangrijke nuance:** `test-gate.mjs` voert
GEEN bronbestanden in node uit. Het doet `clasp push -f` + `clasp run-function
runSelfTest` → de selftest draait REMOTE op Apps Script V8. Er is dus geen
"node-uitgevoerd" oppervlak. WEL bewijst `runSelfTest` (SelfTest.gs, 886 asserts)
de PORTABILITEIT: elke test bouwt fixtures en roept de pure engine-fns aan ZONDER
GAS-globals — `expandArchetype_`, `goalWorkout_`, `allocateQualityWeek_`,
`effectiveMacroFase_`, `computeMacroPhase`, `eventFase_`, `computeNiveau_`,
`ctlAtWeek_`, dash-calc (`dashActivityScan_` c.s.), `mergeById_`, `activityToRow_`,
`zoneTimesFromCell_`, `planModeLabel_`, coach-narratief, `tssFromZoneMinutes_`.
**Conclusie: de VOLLEDIGE trainings-generatie-engine (archetype → profiel → intent →
week-allocator → workout-expansie → TSS/CTL → niveau → coach → dash-calc) is
GAS-vrij en port-as-is; alleen ORCHESTRATIE (`generateProposal`/`getDashboardState`)
+ IO (intervals/sync/telegram/secrets/Sheet-tabs) is GAS-gebonden.** Ruwweg 3
volledig-pure modules + de pure kern van 6 mixed modules = Worker-ready; ~7 modules
(IO/plumbing/tab-builders) herschrijven.

---

## B. Datamodel → D1

### Huidige stores

**Sheet-tabs** (constanten): `ACTIVITEITEN_SHEET='Activiteiten'` · `WELLNESS_SHEET='Wellness'` ·
`PLANNER_SHEET='Weekplanner'` (verify) + `WEEKPLANNER_PLUS1_SHEET='Weekplanner +1'` ·
`SETTINGS_SHEET='Instellingen'` · `EVENTS_SHEET='Events'` · `DOEL_SHEET='Doel'` ·
`PROPOSAL_SHEET='Voorstel'` · `ZONES_SHEET='Zones'` · `AUDIT_SHEET='Audit'`.

| Store | Shape (verify tegen live Sheet) | Patroon | Durable? |
|---|---|---|---|
| Activiteiten | `ACT_HEADERS` = 17 kol (idx0 Datum … idx14 Rolling FTP, idx15 Zone-tijden JSON, idx16 Activiteit-ID) | **full-rewrite 730d** (`syncActivities`) of incr-upsert (`syncActivitiesIncremental_`) | durable |
| Wellness | `WELL_HEADERS` (A Datum, B RHR, C HRV, D Slaap, idx8 CTL/idx9 ATL/idx10 Vorm/idx11 Ramp) + stats-blok ≥ `WELL_STATS_ROW=35` | overschreven per sync (30d) | durable |
| Weekplanner | `readPlanner` leest A3:H9 (A train, D minuten, E type, F notitie, H gedaan) | user-edit + reconcile-tick | durable |
| Events | `EVENT_HEADERS` (naam/datum/prio/type/klimType…) → mirror in DocProp `events_json` | user-edit | durable |
| Instellingen | key-value cellen (ftp/lthr/gewicht/doel/doel_start/doel_duur/coach_naam/profiel_preset…) | overschreven | durable |
| Doel/Voorstel/Zones/Audit | render/log-tabs | display/append | **display (sterft)** |

**DocumentProperties-keys** (durable K/V): settings-mirror (`ftp`, `lthr`, `hr_max`,
`hr_rest`, `gewicht`, `doel`, `doel_start`, `doel_duur`, `coach_naam`, `profiel_preset`,
`sweet_spot_min/max`, `api_power_zones`, `api_hr_zones`) · `intervals_athlete_id` ·
`events_json` · `mesoWeek` · `pattern` · `loadCarry` · `avail_dirty` · `last_sync` ·
per-datum JSON-blobs: `weekplan_<maandag-dISO>` (intent-array), `proposal_<dISO>[_s<n>]`
(workout-JSON per sessie), `override_<dISO>`, `disposition_<dISO>`, `checkin_<dISO>`,
`rpe_<dISO>`, `rpePrompted_<dISO>` · Telegram: `POLL_OFFSET_KEY`, `SEEN_UPDATE_IDS_KEY` ·
secrets (§D).

**CacheService** (`getUserCache`, VOLATILE): `trainlib_v2_<base64(ftp|lthr)>`
(Algorithm.gs:2381) · `powercurve_raw_<window>_<yyyyMMdd>` · `ridedetail_<id>` ·
coach-zone-per-dag (verify key). → herbouwen als Worker-cache/KV; nooit durable.

### D1-schema-schets (vervangt de stores; alles user-gescoped)

```
users(id PK, email, intervals_athlete_id, created_at)
activities(id PK, user_id FK, start_local, type, name, dur_min, dist_km,
           avg_w, norm_w, if_pct, tss, avg_hr, max_hr, pi, ftp, weight,
           rolling_ftp, zone_times_json, activity_id_ext)   -- activity_id_ext = idx16
wellness(id PK, user_id FK, date, rhr, hrv, sleep, ctl, atl, vorm, ramp)
planner_days(id PK, user_id FK, date, train, minutes, daytype, note, done)
events(id PK, user_id FK, date, name, prio, type, klim_type)
settings(user_id PK, ftp, lthr, hr_max, hr_rest, weight, doel, doel_start,
         doel_duur, coach_naam, profiel_preset, sweet_spot_min, sweet_spot_max,
         power_zones_json, hr_zones_json)   -- vervangt de DocProp-mirror
proposals(id PK, user_id FK, date, session_idx, workout_json)   -- vervangt proposal_<dISO>[_s<n>]
weekplans(user_id, week_monday, intent_json, PK(user_id,week_monday))  -- weekplan_<mon>
day_state(user_id, date, override_json, disposition_json, checkin_json,
          rpe, rpe_prompted, PK(user_id,date))   -- override_/disposition_/checkin_/rpe_/rpePrompted_
sync_state(user_id PK, last_sync, load_carry, avail_dirty, meso_week)
telegram(user_id, poll_offset, seen_update_ids_json)   -- of laten vallen bij webhook-only
```

**User-scoping:** nu single-user (impliciet via één athlete + één Telegram `chat_id`).
Straks: `user_id`-kolom + row-scoping op elke tabel; `intervals_athlete_id`/`chat_id`
verhuizen naar `users`. Secrets per user (§D) i.p.v. één DocProp-set.

---

## C. Frontend↔engine API (`google.script.run` → toekomstige Worker-routes)

Alle calls in `src/Script.html`. READ = grote/lazy leesassemblies; WRITE = muteren + verse state terug.

| `google.script.run`-fn | R/W | Input | Output-shape | → Worker |
|---|---|---|---|---|
| `getDashboardState` | R | — | groot `state`-object (athlete/ftp/wkg/niveau/dagen/vorm/plan/readiness/niveauReeks/projection/availability/settings/weekLoad/vandaag/waarom…) | `GET /state` |
| `refreshActivities` | W→R | — | verse `state` (na `syncActivitiesIncremental_(7)`) | `POST /refresh` |
| `regenerateWeb` | W→R | — | verse `state` (`syncAll`+`generateProposal`) | `POST /regenerate` |
| `pushWeb` | W | — | `{pushedCount,skipped,errors}` (→ intervals/Garmin) | `POST /push` |
| `saveAvailability` / `saveAvailabilityPlus1` | W | updates-array | verse `state` | `POST /availability` (+ `?plus1`) |
| `saveRpe` | W | `(dISO, rpe)` | verse `state` | `POST /rpe` |
| `saveDisposition` | W | `(dISO, reason\|null)` | verse `state` | `POST /disposition` |
| `saveDayOverride` | W | `(dISO, payload)` | verse `state` | `POST /override` |
| `clearDayOverride` | W | `(dISO)` | verse `state` | `DELETE /override/:date` |
| `saveSettings` | W | updates-obj | verse `state` | `POST /settings` |
| `saveCheckin` | W | check-in-obj | readiness | `POST /checkin` |
| `getRideDetail` | R (lazy) | `(dISO\|id)` | rit-detail-model (intervals `/activity/:id`) | `GET /ride/:id` |
| `getDayCoachZones` | R (lazy) | `(dISO)` | reële zone-minuten/dag | `GET /coachzones/:date` |
| `getPowerCurve` | R (lazy) | `(window)` | power-duration-curve | `GET /powercurve?window` |

`getDashboardState` (grote read, 0-API, puur Sheet/DocProps) + `refreshActivities`
(= `syncActivitiesIncremental_` + `getDashboardState`) apart benoemen: de Worker
splitst dit in een snelle `GET /state` (leest D1) en een `POST /refresh` (pull
intervals → upsert D1 → verse state). De 3 lazy reads blijven aparte endpoints.

---

## D. Externe integraties (call-logica + secrets → Worker-env/D1)

- **intervals.icu** — `src/IntervalsApi.gs`. `intervalsRequest_` (Basic auth =
  `base64('API_KEY:' + <key>)`, `UrlFetchApp.fetch`), `getActivities(daysBack)`
  (query `oldest`/`newest`, volledige objecten incl. `icu_zone_times`),
  `getWellness`, `getAthleteInfo`, `pushEvents_` (`POST /athlete/{id}/events/bulk?upsert=true`,
  ZWO via `file_contents_base64`). Port = `fetch()` + Basic-auth-header; logica
  portabel. Secret: **`INTERVALS_API_KEY`** (+ DocProp `intervals_athlete_id`).
- **Garmin** — geen directe API. Workouts gaan intervals.icu → Garmin via
  `pushEvents_` + athlete-toggle `icu_garmin_upload_workouts`. Blijft indirect.
- **Telegram** — `src/TelegramBot.gs`. `doPost` (webhook, `?s=`-secret) +
  `pollTelegramUpdates` (1-min trigger) → `_processTelegramUpdate_` → `routeCommand_`
  → handlers; `tgSendMessage` (`UrlFetch`). Secrets: **`TELEGRAM_BOT_TOKEN`**,
  **`TELEGRAM_CHAT_ID`**, **webhook-secret**. In Worker: alleen webhook-route
  (polling sterft); dedupe via D1.
- **Secrets → Worker-env** (namen, geen waarden): `INTERVALS_API_KEY`,
  `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_WEBHOOK_SECRET`, deploy-URL.
  Nu in `PropertiesService` via `SECRET_KEYS` (Secrets.gs:18). Per-user bij multi-user.

---

## E. Wat sterft (NIET porten)

- **HtmlService-templates**: `Index/Script/Styles/Tokens/Alias/Drawer.html` →
  React (client rendert nu `plan.modeLabel` etc.; alle render-fns herbouwen).
- **clasp/Apps-Script-plumbing**: `appsscript.json`, `clasp push`, `doGet`,
  `include()`, `setFaviconUrl`/`setXFrameOptionsMode`, `test-gate.mjs`
  (clasp-run-function-wrapper → vervangen door node/vitest op de pure engine).
- **`PropertiesService`/DocProps** → D1/KV. **`CacheService`** → Worker-cache/KV.
  **`LockService`** → D1-transacties/atomaire upserts.
- **`doPost`/`pollTelegramUpdates`/dedupe-ringbuffer/offset** → Worker-webhook.
- **Sheet-tab-builders + `onEdit` + Coach-menu** (`Code.gs`, `Events/Zones/Planner/
  Activiteiten/Proposal/Wellness/Doel.gs`-render-delen) — display-only, sterven.
- **`google.script.run`** → `fetch()`. **`Logger`/`console` GAS-Executions** →
  Worker-logs.

---

## F. Port-volgorde + top-risico's

1. **Pure engine → TS Worker-lib** (Archetypes/Coach/Workouts/* + pure-fns uit
   Algorithm/WebApp/Sync/Settings/Doel/Utils). Hergebruik `SelfTest.gs`-cases als
   node/vitest-suite. *Risico:* `??`/`?.` (V8+TS OK), `Date`-parsing van
   `start_date_local` zonder `Z` (tz-gevoelig — nu GAS-scripttz).
2. **D1-schema + migratie** uit DocProps/Sheets. *Risico:* de per-datum JSON-blobs
   (`weekplan_`/`proposal_<dISO>_s<n>`) + het sleutel-scheme (`readDaySessions_`/
   `writeDaySessions_`) → relationele modellering; kolomschema's alleen live →
   **verify tegen live Sheet**.
3. **intervals.icu http-port** (`UrlFetch`→`fetch`, Basic auth). *Risico:* rate,
   `?upsert=true`-idempotentie, ZWO-base64.
4. **Orchestratie herschrijven** (`generateProposal`/`getDashboardState` lezen D1
   i.p.v. Sheet/DocProps; `computeZoneDebt_` uit tab). *Risico:* de READ-ONCE-THREAD-
   assemblage exact reproduceren; multi-sessie-aggregatie (§D-spec).
5. **React-frontend** (incl. de multi-sessie dag-detail-rebuild-spec: per-sessie
   status, gesomde actuals, geen day-collapse bij partiële voltooiing).
6. **Telegram → Worker-webhook** (polling laten vallen). *Risico:* webhook-secret,
   dedupe in D1.

**Top-risico's overkoepelend:** (a) test-harness is remote (clasp) — de node-gate
moet vervangen worden; de fns zijn puur genoeg om mechanisch te porten, maar de
HARNESS is nieuw. (b) DocProp-JSON-blobs → D1 relationeel. (c) multi-user-scoping
(nu impliciet single-user). (d) live-Sheet-kolomschema's niet in de repo → verify.
