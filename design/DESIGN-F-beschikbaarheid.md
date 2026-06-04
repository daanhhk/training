# DESIGN → CONTRACT — [F] Beschikbaarheid (v2b-C)

> **Status:** ontwerp vastgelegd, recon openstaand. Bron voor Claude Code build-prompts.
> **Scope deze ronde:** alleen [F]. Volledige 4-tabs-app = noordster (later, per scherm).
> **Platform-invariant:** HtmlService web-app, `google.script.run` write-pad. Geen losse fetch, geen migratie.

---

## 1. Doel & scope

[F] is een **redesign** van de bestaande availability-editor naar de v2b-C-vereenvoudiging — geen eerste bouw. De data-laag staat al; alleen de UI-mapping wijzigt. **Geen nieuwe velden, geen nieuwe write-pad.**

De volledige dagtype-dropdown verdwijnt. De gebruiker zet per dag alleen:
- **Train vandaag?** (toggle)
- **Minuten** (slider, alleen zichtbaar als train aan)
- **Pendel?** (toggle, "woon-werk meegeteld")

De **dagtype (kolom E) wordt afgeleid**, niet gekozen.

---

## 2. Schermen & flow

| Scherm | Rol | Bron-screenshot |
|---|---|---|
| Entry-chooser "Beschikbaarheid" | Keuze: **Alleen deze dag** / **Hele week (ma–zo in één keer)** | `02-av_*` |
| **Deze dag** | Enkele-dag-editor (Train? + Minuten + Pendel? + Opslaan) | `03-av_*`, `1780561494101` |
| **Hele week** | 7 rijen Ma→Zo, elk Train + Minuten + Pendel + één Opslaan | `1780561475596` |
| Rustdag-kaart → **Toch trainen** | Override-pad: opent editor met train=aan op een advies-rustdag | `02-img16`, `03-img20` |

Entry's: vanuit de dagkaart (Vorm/Schema) én vanuit de rustdag-kaart-knop "Beschikbaarheid".

---

## 3. Afgeleide dagtype-logica (client-side, vóór de write)

De client berekent kolom E uit de toggles en stuurt dezelfde payload-vorm terug — zo blijft `saveAvailability` onaangeraakt.

```
pendel-toggle AAN            -> 'pendel'
anders, za/zo               -> 'weekend'
anders                      -> 'vrij'
recovery                    -> ENGINE-gestuurd, NIET handmatig (zie recon R1)
```

`dagtypeOptions` = `pendel | vrij | weekend | recovery`. "rustdag" is een **UI-label** voor train=false, geen E-waarde.

---

## 4. UI → datacontract mapping

Payload-key `availability` = array per dag `{ train, minuten, dagtype, dagLabel }` + `dagtypeOptions`, per-DATUM ma–zo.

| UI-element | Payload / cel | Opmerking |
|---|---|---|
| Train?-toggle | `train` → A3:A9 | per rij = per dag |
| Minuten-slider | `minuten` → D3:D9 | alleen zichtbaar bij train=aan |
| Pendel?-toggle | voedt afleiding → `dagtype` → E3:E9 | niet apart opgeslagen |
| (afgeleid) | `dagtype` → E3:E9 | client berekent, zie §3 |
| dag-label | `dagLabel` | read-only weergave |

Bron-tab: `PLANNER_SHEET`, rijen 3–9 = ma–zo. A=Train? · D=Minuten · E=Dagtype · F=Toelichting · H=Gedaan. Default = `PLANNER_DEFAULTS`.

---

## 5. Write-pad

```
client: renderBeschikbaarheid -> saveAvail() -> google.script.run
server: saveAvailability (WebApp.gs) -> schrijft A3:A9 / D3:D9 / E3:E9
return: verse getDashboardState -> onState re-render
```

- **Hele week** → mapt 1:1 op de volledige A3:A9-write (bestaand pad, geen serverwijziging).
- **Deze dag** → enkele rij. Aansluiting op de write-pad = recon **R2**.

---

## 6. Stale-plan-koppeling

Na een availability-edit moet het plan als verouderd markeren:

```
banner (Schema): "Je plan is verouderd t.o.v. je beschikbaarheid — werk bij"
probe:           staleHint=true
vervolg:         "Werk week bij" (regen) -> states idle/busy/sent/error
```

Een availability-write moet `staleHint` (her)berekenen, anders verschijnt de banner niet. Bestaan/triggeren = recon **R4**.

---

## 7. Recovery-override-loop

```
rustdag-kaart: "Je coach adviseert herstel" [Toch trainen] [Beschikbaarheid]
  -> editor "Toch trainen" (train=aan, minuten voorgevuld)
  -> save -> gegenereerd voorstel mét caveat:
     "Herstel was aanbevolen — luister naar je lichaam"
probe: restCard=true editForceTrain=true · voorstel: note/garmin/anders=true
```

De minuten uit de override-editor voeden de voorstel-duur. Bestaand pad of nieuw = recon **R5**.

---

## 8. Invarianten (ontwerp-relevant)

- Deck-CSS `.status-card` / `.status-wrap` **niet** aanraken.
- Alles op de `google.script.run` write-pad — geen losse fetch.
- `mode` blijft READ-only tot de write-side gebouwd is.
- `tss` altijd zone-gewogen via `tssFromZoneMinutes_`.
- Geen nieuwe payload-velden buiten de bestaande `availability` / `dagtypeOptions`.

---

## 9. Open recon-items (Claude Code, READ-ONLY, vóór build)

| # | Vraag | Check tegen | Bepaalt |
|---|---|---|---|
| R1 | Wordt `recovery` naar kolom E **geschreven** door de engine, of live-berekend (niet in E)? | Conditie.gs / Algorithm.gs / planner-read | Of save een "behoud recovery"-tak nodig heeft |
| R2 | Accepteert `saveAvailability` een **enkel-rij**-payload, of alleen de volle ma–zo array? | WebApp.gs `saveAvailability` signatuur | "Deze dag"-write-aanpak |
| R3 | Wat schrijft de save naar **E bij train=false** (geen "rustdag" in opties)? Afgeleid of ongemoeid? | saveAvailability + render | E-waarde rustdag-rijen |
| R4 | Bestaat `staleHint` al in `getDashboardState`, en zet een availability-write die (her)? | WebApp.gs `getDashboardState` + Sync.gs | Of stale-banner vanzelf vuurt |
| R5 | Is het pad `restCard`/`editForceTrain` → gegenereerd voorstel **bestaand of nieuw**? | Algorithm.gs / WebApp.gs | Omvang override-werk |
| R6 | Haalt de "Hele week"-editor zijn datums uit de **ISO-week ma–zo** (→ rijen 3–9), los van de top-strip (zo–za venster)? | client week-date-berekening + rij-mapping | Voorkomt off-by-one (Zo 7 ≠ volgende week rij 3) |

**Minuten-prefill** (sub-vraag): initiële slider-waarde — `PLANNER_DEFAULTS` of bestaande D-waarde van die dag? Normaal pad (R2-context) én override-pad (R5-context, de 60 op een rustdag).

---

## 10. Buiten scope (deze ronde)

- [#3] mode **write-side** (pauze/announce-mutatie) — blijft toekomst.
- Overige tabs (Trainingen/Niveau) + consistency-laag (workout-detail, varianten, Vrije/groepsrit, RPE, empty-states) — visuele richting, per scherm ingest bij die build.
- [#3] **read-side** client-binding wordt apart/klein opgepakt naast [F] (mode tonen, niet muteren).
