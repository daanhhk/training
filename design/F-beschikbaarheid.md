# DESIGN → CONTRACT — [F] Beschikbaarheid (v2b-C)

> **Status:** F.1a **DONE** (commit 44b170f). F.1b = next. F.2/F.3 = backlog.
> **Scope:** [F]. Volledige 4-tabs-app = noordster. Visuele restyle = aparte workstream (zie §10).
> **Platform-invariant:** HtmlService web-app, `google.script.run` write-pad. Geen losse fetch, geen migratie.

---

## 1. Doel & scope

Redesign van de availability-editor naar v2b-C. Per dag: **Train?** (toggle) · **Minuten** (slider, bij train aan) · **Pendel?** (toggle). Dagtype (kolom E) **afgeleid**, niet gekozen. Geen nieuwe velden, geen nieuwe write-pad.

---

## 2. Schermen & flow

| Scherm | Rol | Deliverable |
|---|---|---|
| **Hele week** | 7 rijen Ma→Zo, Train+Minuten+Pendel, één Opslaan | **F.1a — DONE** |
| Entry-chooser | Keuze: Alleen deze dag / Hele week | F.1b |
| **Deze dag** | Enkele-dag-editor (slaat volle week-array op, 1 dag gemuteerd) | F.1b |
| Rustdag → **Toch trainen** | Recovery-override → voorstel | F.2 (backlog) |
| Stale-banner | Nudge naar regen | F.3 (backlog) |

---

## 3. Recovery — twee gescheiden begrippen (recon R1)

1. **E-kolom `'recovery'`** — legacy/v2a (handmatig). v2b-C leidt het **nooit** af; bestaande `E='recovery'` wordt bij save overschreven door de afgeleide waarde. Bedoelde migratie: recovery = engine-only.
2. **Engine-recovery** — `voorgesteldType` in `assignWorkouts` (`isRecovery`/`isEventRecovery` + `getWellnessSignal`), nooit in E. Ongemoeid. → geen behoud-tak.

### Afgeleide dagtype (client-side, server valideert+schrijft alleen, R3)

```
pendel-toggle AAN          -> 'pendel'
anders, index 5/6 (Za/Zo)  -> 'weekend'
anders                     -> 'vrij'
nooit                      -> 'recovery'
```

Onafhankelijk van train; voor élke dag verstuurd.

**F.1a-implementatie:** pendel-toggle initieel afgeleid uit `d.dagtype === 'pendel'` (geen apart pendel-veld). `state.dagtypeOptions` nu ongebruikt (blijft in payload).

---

## 4. UI → datacontract

`availability` = array per dag `{ train, minuten, dagtype, dagLabel }`. PLANNER_SHEET rijen 3–9 = ma–zo. A=Train · D=Minuten · E=Dagtype.

| UI | cel | opmerking |
|---|---|---|
| Train?-toggle | A3:A9 | |
| Minuten-slider | D3:D9 | init = bestaande D-waarde; **slider max=600** (= `saveAvailability`-cap) |
| Pendel? → afgeleid dagtype | E3:E9 | client berekent (§3) |

---

## 5. Write-pad (recon R2 — alleen volle array)

```
saveAvail() -> 7x {train, minuten, dagtype}
saveAvailability(updates)  updates[0..6] -> i+3 -> rijen 3-9 -> A3:A9 / D3:D9 / E3:E9
return: verse getDashboardState -> onState re-render
```

Geen single-day server-pad. "Deze dag" (F.1b) muteert één dag in de volle 7-array client-side, stuurt alsnog alle 7. **Week-grens (R6 confirmed):** `i+3`, ma-zo `readPlanner`-volgorde, Zondag→rij 9, geen off-by-one.

---

## 6. Recon-uitkomst

| # | Uitkomst |
|---|---|
| R1 | differs — `'recovery'` legacy in E; engine-recovery = `voorgesteldType`. → §3 |
| R2 | differs — alleen volle ma-zo array. → §5 |
| R3 | differs — E = client-`dagtype`, onafhankelijk van train; server leidt niet af. → §3 |
| R4 | absent — geen `staleHint`. = **F.3 backlog** |
| R5 | absent — geen recovery→train override. = **F.2 backlog** |
| R6 | confirmed — `i+3`, Zondag→rij 9. |
| 770 | engine-tak `d.type === 'recovery'` (Algorithm.gs:770) bestaat, intact gelaten. **Open:** leest die planner-E of `voorgesteldType`? Bij planner-E loopt-ie dood naarmate recovery migreert → opruim-backlog. (F.1b rapporteert dit gratis mee.) |

---

## 7. Decompositie & build-volgorde

- **F.1a — DONE** (commit 44b170f, Script.html + Styles.html). Toggle-UI + client-afgeleide dagtype. Server ongemoeid. Live op /dev (oude skin).
- **F.1b — NEXT.** "Deze dag" + entry-chooser. Hergebruikt de F.1a-rij. Slaat volle array op, 1 dag gemuteerd.
- **F.2 — backlog (R5).** "Toch trainen" recovery-override → voorstel. Raakt Algorithm.gs.
- **F.3 — backlog (R4).** Stale-hint banner. Nieuw `staleHint` + (her)berekening bij write.

---

## 8. Invarianten

- `.status-card`/`.status-wrap` niet aanraken. `google.script.run` only. `mode` read-only tot write-side. `tss` zone-gewogen via `tssFromZoneMinutes_`. v2b-C leidt nooit `'recovery'` af. `saveAvailability` ongewijzigd in F.1.

---

## 9. [#3] mode read-side — RECONCILE

STAND-origineel: "client leest mode NIET". Maar /dev toont nu wél countdown ("9 dagen tot Girona") + seasonMode ("Onderhoudt / Je houdt je fitheid vast"). **Te bevestigen in volgende chat:** welke mode-UI is al live vs wat de STAND claimt. Mogelijk is [#3] read-side verder dan gedacht.

---

## 10. Visual system & integratie (open beslissing)

De app draait nog op de **oude lichte skin**; de Claude Design-mockups zijn **donker + 4-tabs**. Het dichten van dat gat = een **app-brede workstream**, niet per-feature.

- **Design-bron in repo** (`design/`): `tokens.css` (kleuren/typografie/spacing), `DESIGN.md` + `FTP-Coach-export.md` (export), `screenshots/`. Publiek → fetchbaar door chat (raw-URL) én lokaal leesbaar door Claude Code.
- **Brug = `tokens.css`** als CSS-variabele-fundament: features bouwen "tegen de tokens" i.p.v. screenshots na-oogen.
- **Functioneel werk is NIET weggegooid:** contracten (afleiding, write-pad, structuur) overleven een restyle; alleen CSS/markup verandert.
- **Beslissing (eerste in volgende chat):** *function-first* (eerst [F]/[#3]-contracten af, dán globale skin-pass via tokens.css) vs *theme-first* (eerst tokens.css globaal adopteren, dan features in de nieuwe skin bouwen).
