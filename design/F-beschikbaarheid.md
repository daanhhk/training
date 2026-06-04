# DESIGN → CONTRACT — [F] Beschikbaarheid (v2b-C)

> **Status:** ontwerp + recon afgerond. **F.1a build-ready**, rest backlog.
> **Scope deze ronde:** alleen [F]. Volledige 4-tabs-app = noordster (later, per scherm).
> **Platform-invariant:** HtmlService web-app, `google.script.run` write-pad. Geen losse fetch, geen migratie.

---

## 1. Doel & scope

[F] is een **redesign** van de bestaande availability-editor naar v2b-C — geen eerste bouw. De data-laag staat al; alleen de UI-mapping wijzigt. **Geen nieuwe velden, geen nieuwe write-pad.**

De volledige dagtype-dropdown verdwijnt. Per dag alleen: **Train vandaag?** (toggle) · **Minuten** (slider, zichtbaar bij train aan) · **Pendel?** (toggle). De **dagtype (kolom E) wordt afgeleid**, niet gekozen.

---

## 2. Schermen & flow

| Scherm | Rol | Deliverable |
|---|---|---|
| **Hele week** | 7 rijen Ma→Zo, elk Train + Minuten + Pendel + één Opslaan | **F.1a** |
| Entry-chooser "Beschikbaarheid" | Keuze: Alleen deze dag / Hele week | F.1b |
| **Deze dag** | Enkele-dag-editor (slaat volle week-array op, 1 dag gemuteerd) | F.1b |
| Rustdag-kaart → **Toch trainen** | Recovery-override → gegenereerd voorstel | F.2 (backlog) |
| Stale-banner "plan verouderd t.o.v. beschikbaarheid" | Nudge naar regen | F.3 (backlog) |

---

## 3. Recovery — twee gescheiden begrippen (recon R1)

1. **E-kolom dagtype `'recovery'`** — zit in `DAGTYPE_OPTIONS`, wordt door `saveAvailability` naar E geschreven. Legacy/v2a (handmatige dropdown-keuze). **v2b-C leidt 'recovery' NOOIT af** → een bestaande `E='recovery'` wordt bij save overschreven door de afgeleide waarde. Dit is de **bedoelde migratie**: recovery = engine-only.
2. **Engine-geadviseerde recovery** — computed in `assignWorkouts` (`isRecovery` / `isEventRecovery` + wellness-demote `getWellnessSignal`), leeft in `voorgesteldType`, **nooit naar E gepersisteerd**. Ongemoeid door `saveAvailability`. → **geen "behoud recovery"-tak nodig.**

### Afgeleide dagtype-logica (client-side)

`saveAvailability` valideert + schrijft alleen; het **leidt niet af** (recon R3). De client berekent E en stuurt 'm mee. **dagtype is onafhankelijk van train** — voor élke dag versturen:

```
pendel-toggle AAN      -> 'pendel'
anders, index 5/6 (Za/Zo) -> 'weekend'
anders                 -> 'vrij'
nooit                  -> 'recovery'
```

---

## 4. UI → datacontract mapping

Payload-key `availability` = array per dag `{ train, minuten, dagtype, dagLabel }` + `dagtypeOptions`, per-DATUM ma–zo.

| UI-element | Payload / cel | Opmerking |
|---|---|---|
| Train?-toggle | `train` → A3:A9 | per rij = per dag |
| Minuten-slider | `minuten` → D3:D9 | init = bestaande D-waarde (zie §5) |
| Pendel?-toggle | voedt afleiding → `dagtype` → E3:E9 | niet apart opgeslagen |
| (afgeleid) | `dagtype` → E3:E9 | client berekent, §3 |

Bron-tab: `PLANNER_SHEET`, rijen 3–9 = ma–zo. A=Train? · D=Minuten · E=Dagtype · F=Toelichting · H=Gedaan.

---

## 5. Write-pad (recon R2 — alleen volle array)

```
client: renderBeschikbaarheid -> saveAvail() -> 7x {train, minuten, dagtype}
server: saveAvailability(updates)  updates[0..6] -> i+3 -> rijen 3-9 -> A3:A9 / D3:D9 / E3:E9
return: verse getDashboardState -> onState re-render
```

- **Geen single-day server-pad.** "Deze dag" (F.1b) muteert één dag in de volle 7-array client-side en stuurt alsnog alle 7. Server **onaangeraakt**.
- **Minuten-prefill** = bestaande D-celwaarde (`state.availability[i].minuten`). `PLANNER_DEFAULTS` seedt enkel bij planner-build/roll, niet bij render.
- **Week-grens (recon R6, confirmed):** editor-index 0–6 → rijen 3–9 via `i+3`; `state.availability` = `readPlanner`-volgorde ma–zo (`DAGEN_NL`), los van de today±-day-strip (`dagen`). Zondag → rij 9. Geen off-by-one.

---

## 6. Recon-uitkomst (R1–R6 + minuten)

| # | Uitkomst |
|---|---|
| R1 | **differs** — `'recovery'` wél naar E via `saveAvailability` (legacy); engine-recovery = `voorgesteldType` in `assignWorkouts`, nooit in E. → §3 |
| R2 | **differs** — alleen volle ma-zo array; geen single-day pad. → §5 |
| R3 | **differs** — E = door client gestuurde `dagtype` (gevalideerd tegen `DAGTYPE_OPTIONS`, anders `''`), onafhankelijk van `train`; server leidt niet af. → §3 |
| R4 | **absent** — geen `staleHint` in `getDashboardState`; `saveAvailability` zet er geen. = **F.3 backlog** |
| R5 | **absent** — geen recovery→train force-override; rustdag-detail toont enkel "Herstel is training". = **F.2 backlog** |
| R6 | **confirmed** — `i+3` mapping, ma-zo `readPlanner`-volgorde, Zondag→rij 9. |
| min. | bron = bestaande D-waarde; `PLANNER_DEFAULTS` enkel bij build/roll. |

---

## 7. Decompositie & build-volgorde

- **F.1a — v2b-C "Hele week" editor** (NU). Dropdown → Train/Minuten/Pendel-toggles + client-afgeleide dagtype. Server `saveAvailability` ongemoeid. Laagste risico, bewijst het v2b-C-pad end-to-end.
- **F.1b — "Deze dag" + entry-chooser.** Nieuwe UI; slaat volle array op, 1 dag gemuteerd.
- **F.2 — "Toch trainen" recovery-override** (backlog, R5). Nieuw entry point op rustdag-kaart + force-train → voorstel. Raakt `Algorithm.gs`.
- **F.3 — stale-hint banner** (backlog, R4). Nieuw `staleHint`-veld in `getDashboardState` + (her)berekening bij availability-write.

---

## 8. Invarianten

- `.status-card` / `.status-wrap` CSS **niet** aanraken.
- Alles op `google.script.run` — geen losse fetch.
- `mode` blijft READ-only tot write-side gebouwd.
- `tss` altijd zone-gewogen via `tssFromZoneMinutes_`.
- v2b-C leidt **nooit** `'recovery'` af; server `saveAvailability` blijft in F.1 ongewijzigd.

---

## 9. Buiten scope (deze ronde)

- [#3] mode **write-side** (pauze/announce) — toekomst.
- Overige tabs + consistency-laag (workout-detail, varianten, Vrije/groepsrit, RPE, empty-states) — per scherm ingest bij die build.
- [#3] **read-side** client-binding — apart/klein naast [F].
