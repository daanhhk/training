# FTP Coach — Interactie-contract

Wat elk interactief element **doet**. Pure gedragsspecificatie; styling staat in
`tokens.css` / `DESIGN.md`. Labels zijn exact zoals in de mock.

**Legenda**
- **READ** = toont alleen data · **WRITE** = bewaart/muteert state.
- 🌐 **SERVER** = moet data ophalen of bewaren (backend-call nodig).
- 💻 **CLIENT** = puur visueel / lokale UI-state, geen backend.
- In de mock zijn server-acties gesimuleerd met een timer; de markering geeft
  aan wat in de echte app naar de server moet.

---

## Globale navigatie

### Bottom tab-bar (vaste onderbalk)
Vier tabs, vaste volgorde, altijd zichtbaar op het home-scherm (verborgen zodra
de instellingen-drawer open is).

| Label | Doet | R/W | Effect |
| --- | --- | --- | --- |
| **Schema** | Wisselt naar de Schema-tab. | READ · 💻 | `tab='schema'`; tab-content wisselt, status-deck verborgen. Standaard-tab bij openen. |
| **Vorm** | Wisselt naar de Vorm-tab. | READ · 💻 | `tab='vorm'`; status-deck verschijnt boven de content. |
| **Trainingen** | Wisselt naar de Trainingen-tab. | READ · 💻 | `tab='trainingen'`; bibliotheek-overzicht. |
| **Niveau** | Wisselt naar de Niveau-tab. | READ · 💻 | `tab='niveau'`; stub-scherm. |

- **Actieve staat**: icoon + label in accent, indicator-balkje boven het item.
  Inactief = muted. Geen disabled-staat; altijd alle vier klikbaar.
- **Navigatie-effect**: switcht tab in-place, geen sheet/drawer. Scrollpositie
  per tab wordt niet bewaard (elke tab rendert vers).

### Statusbalk-avatar "DK" (header, rechtsboven)
- **Doet**: opent het instellingen-scherm. — READ · 💻
- **Effect**: `screen='settings'`; instellingen schuiven van rechts in als
  drawer, home-scherm schuift 22% naar links + dimt, tab-bar verdwijnt.
- **Voorwaarden**: altijd beschikbaar.

### Instellingen-drawer — knop "Terug" (chevron, linksboven)
- **Doet**: sluit instellingen, terug naar home. — 💻
- **Effect**: `screen='home'`; drawer schuift naar rechts uit beeld, tab-bar
  keert terug op de laatst-actieve tab.

### Ochtend-check-in (bottom sheet) — "Hoe voel je je vanochtend?"
Globale overlay, **één keer per dag**. Verschijnt automatisch bij openen zolang
er voor vandaag nog niet is ingevuld; daarna alleen heropenbaar via de
**+**-knop in de status-/readinesskaart (zie Vorm).

| Element | Doet | R/W | Effect / voorwaarden |
| --- | --- | --- | --- |
| Segmented **Slaap** (`goed` / `matig` / `slecht`) | Kiest slaap-oordeel. | WRITE · 💻 | Zet `draft.slaap`; lokaal tot "Vastleggen". |
| Segmented **Benen** (`fris` / `normaal` / `zwaar`) | Kiest been-gevoel. | WRITE · 💻 | Zet `draft.benen`. |
| Segmented **Stress** (`laag` / `normaal` / `hoog`) | Kiest stress-niveau. | WRITE · 💻 | Zet `draft.stress`. |
| **Vastleggen** | Bewaart de check-in van vandaag en sluit de sheet. | WRITE · 🌐 | **Disabled** tot alle drie gekozen zijn. Bewaart per datum (mock: localStorage); in de echte app → server, want het herberekent de gereedheidsscore. Sheet sluit, readinesskaart toont samenvatting + effect-regel. |
| **Later** / **Annuleren** | Sluit de sheet zonder op te slaan. | 💻 | Label = "Later" bij eerste keer, "Annuleren" bij heropenen/bewerken. Klik op scrim of greep heeft hetzelfde effect. Bij "Later" verschijnt de prompt later opnieuw tot ingevuld. |

---

## Tab: Schema

Trainingsgericht; **geen** status-deck. Volgorde: plan → weeklast → dagstrip →
dag-detail. Randstaten (niet verbonden / sync mislukt / lege week / eerste keer)
overschrijven (delen van) de normale opbouw.

### Plan / periodisering (`PeriodTimeline`) — "Plan · periodisering"
- **Kaart-header (klikbaar)**: klapt de fase-tijdlijn uit/in. — READ · 💻
  - Effect: toont/verbergt fasebalk (Basis/Build/Peak/Taper), "je bent
    hier"-marker, event-tags (Girona · A, Tune-up · B) en stat-rij
    (Fase / Tot Girona / Volume). Ingeklapt toont de header de chip "Doel-gericht".
  - Puur lezen; geen muterende controls binnen deze kaart.

### Deze week (`WeekLoad`) — "Deze week · gepland vs gedaan"
- **Stat-rij** TSS / Uren / Dagen + voortgangsbalk: READ · 🌐 (cijfers komen van
  de server).
- **Verversknop** (icoon-only, rond, refresh-icoon):
  - **Doet**: werkt het weekplan bij op basis van doel + beschikbaarheid. — WRITE · 🌐
  - **States**: *idle* (knop) → klik → *busy* (spinner "Bijwerken…") → *done*
    (groene check "Bijgewerkt · {tijd}"). Bij *lege week* / *eerste keer*
    genereert dit de sessies en zet de tab terug op *normaal*.
  - **Voorwaarden**: altijd klikbaar; tijdens *busy* niet opnieuw aanroepbaar.
- **Stale-banner** "Je plan is verouderd t.o.v. je beschikbaarheid — werk bij":
  - Verschijnt alleen nadat beschikbaarheid is gewijzigd (`availDirty`). READ;
    de verversknop lost hem op.

### Dagstrip (`DayStrip`)
- **Dag-chip** (per dag, wd + datum + status-marker):
  - **Doet**: selecteert die dag. — READ · 💻
  - **Effect**: `sel=idx`; dag-detail eronder verandert; sluit een eventueel open
    beschikbaarheid-editor. Strip centreert bij laden op vandaag.
  - **Marker (read)**: check = gedaan, gekleurde dot(s) = gepland (per zone;
    twee dots bij dubbele sessie), streepje = rustdag.

### Dag-detail — afhankelijk van dag-staat

**A. Voorstel / vandaag (`ProposalDetail`)**
| Element | Doet | R/W | Effect / voorwaarden |
| --- | --- | --- | --- |
| **Zone-balk + legenda** (klikbaar) | Klapt de blokstructuur uit/in. | READ · 💻 | Toont/verbergt blokkenlijst (warming-up, intervallen, cooling-down). |
| **"Waarom deze training?"** | Klapt de coach-onderbouwing uit/in. | READ · 💻 | Toont uitlegtekst. |
| **"Doe iets anders"** | Opent de workout-picker. | 💻 | Vervangt het detail door `WorkoutPicker` (zie onder). |
| **GarminSync-knop** | Stuurt de training naar Garmin. | WRITE · 🌐 | Zie GarminSync-states onder. Alleen zichtbaar als de dag traineerbaar is (`sendable`). |
| **"Beschikbaarheid"** (onderaan) | Opent de beschikbaarheid-editor. | 💻 | `editing={forceTrain:false}`; toont `AvailabilityEditor`. |

**B. Meerdere sessies (`MultiSessionDetail`)**
- Toont Ochtend- en Middag-kaart (zone-badge, naam, min/IF/TSS, mini-zonebalk). READ.
- Onderaan dezelfde **GarminSync** ("Stuur 2 sessies naar Garmin") en
  **"Beschikbaarheid"**-knop.

**C. Voltooid (`DoneDetail`)** — RPE-beoordeling
| Element | Doet | R/W | Effect / voorwaarden |
| --- | --- | --- | --- |
| **RPE-schaal 1–10** (knoppenrij) | Kiest ervaren inspanning. | WRITE · 💻 | Zet waarde, toont "Vastleggen"; lokaal tot bevestigd. |
| **Vastleggen** (RPE) | Bewaart de RPE-score. | WRITE · 🌐 | Alleen zichtbaar nadat een cijfer is gekozen én nog niet bevestigd. Daarna verschijnt de feedback-callout (gepland vs ervaren). Bij een reeds beoordeelde rit start de schaal voor-ingevuld en bevestigd. |
| GarminSync wordt **niet** getoond bij voltooide dagen. | — | — | — |

**C-bis. Coach-feedback op voltooide/gemiste dagen** (`DoneMatch` /
`DoneDeviation` / `Missed` — zie export-doc §1bis). De gepland-vs-gedaan-lezing,
de impact-callout en de adaptatie zijn **coach-beslissingen** en daarom
server-geleid.
| Element | Doet | R/W | Effect / voorwaarden |
| --- | --- | --- | --- |
| **Alignment-chip** (`AlignChip`: Op plan / Licht afgeweken / Anders getraind / Niet gereden) | Toont hoe goed de uitvoering het plan volgde. | READ · 🌐 | Soort + percentage server-side bepaald (uit de geüploade activiteit). Puur lezen. |
| **Gepland-vs-gedaan-lezing** (`Reading`: type · duur · IF · TSS) | Toont plan naast uitvoering. | READ · 🌐 | Geplande waarden uit het plan, gedane uit de activiteit. IF genormaliseerd naar 0–1. |
| **Zone-vergelijking** (`ZoneCompare`: gepland vs gedaan, min/zone) | Toont per zone (Z1–6) de geplande tijd naast de gedane tijd; tags *niet gepland* / *niet gereden*. | READ · 🌐 | Geplande zone-minuten uit de workout-structuur, gedane uit de intervals.icu-zonetijden (lazy + per dag gecachet; IF/intent-benadering als fallback). Puur lezen. *Alleen in de coach-feedback* (vs plan), niet in de rit-detail. |
| **Uitvoerings-balk** (`AlignBar`, bij zelfde-intent) | Toont alignment-%. | READ · 🌐 | Server-berekend. |
| **Impact-callout** (`CoachCallout impact`) | Legt uit wat match/afwijking/gemist betekent voor de blok-fase. | READ · 🌐 | **Server-geleid** (coach-engine); narratief, niet bewerkbaar. |
| **Adaptatie-regel** ("Voorstel: …") | Toont wat de coach voorstelt (verplaatsen / inkorten / niets). | READ · 🌐 | **Server-geleid** (coach-engine). NB: in deze pass een VOORSTEL (uitleg); auto-executie via de override-replanner = toekomst. |
| **Skip-reden** (Geen tijd / Bewust gerust / Iets anders — alleen `Missed`) | Legt de reden van de gemiste dag vast. | WRITE · 🌐 | Eén actief; voedt de coach-engine. |

**C-ter. Rit-detail / activiteit-statistieken** (`RideLoaded` / `RideLoading` /
`RideError` — zie export-doc §1ter). Opent als overlay-sheet vanuit een
voltooide rit; de detaildata wordt lazy opgehaald.
| Element | Doet | R/W | Effect / voorwaarden |
| --- | --- | --- | --- |
| **Tik-affordance op gereden rit** ("Bekijk ritdetails") | Opent de rit-detail-sheet. | 💻 | Mount de overlay (`--scrim` + sheet) en triggert `getRideDetail(dISO)`. Alleen op dagen met een gekoppelde activiteit. |
| **Lazy-load** (`getRideDetail`) | Haalt summary-metrics + interval-structuur op bij intervals.icu. | READ · 🌐 | Tijdens het ophalen → `RideLoading` (skeleton). Resultaat gecachet per activiteit (DocProps `ridedetail_<id>` + client-cache); heropenen toont direct de geladen sheet. |
| **Sheet-inhoud** (kop, tijd-in-zone, hero NP·IF·TSS, herziene metric-grid: gem. vermogen · W/kg · gem. HR [max als sub] · hoogtewinst · cadans · arbeid kJ, intervallen) | Toont de statistieken. | READ · 🌐 | Alles server-data; puur lezen. W/kg = gem. vermogen ÷ gewicht. VI/max-HR-tegel/calorieën bewust weggelaten (fietser-nut). |
| **Sluiten** (✕ of tik op scrim / sleep omlaag) | Sluit de sheet. | 💻 | Unmount overlay; geen server-call. |
| **"Opnieuw proberen"** (alleen `RideError`) | Herhaalt `getRideDetail`. | READ · 🌐 | Bij mislukte/lege respons; klik → terug naar `RideLoading`. |

**D. Rustdag (`RecoveryCard`) / Niet beschikbaar (`UnavailableCard`)**
| Element | Doet | R/W | Effect |
| --- | --- | --- | --- |
| **"Toch trainen"** | Opent de editor in "geforceerd trainen"-modus. | 💻 | `editing={forceTrain:true}`; `AvailabilityEditor` opent direct op de dag-modus met `train=true`. |
- Rustdag = coach adviseert herstel; Niet-beschikbaar = gebruiker gaf zelf op.
  Geen GarminSync (niet traineerbaar). Bij coach-rust + tóch trainen verschijnt
  bovenaan een herstel-waarschuwingsregel (READ).

**E. Handmatig gekozen (`OverriddenDetail` / `FreeRideCard`)**
| Element | Doet | R/W | Effect |
| --- | --- | --- | --- |
| **"Terug naar voorstel"** | Verwijdert de override. | WRITE · 🌐 | `override=null` voor die dag; detail valt terug op het coach-voorstel. (Override = afwijken van het plan → server.) |
- Toont "Handmatig gekozen"-pin. Bibliotheek-override toont volledige
  `WorkoutDetail`; vrije/groepsrit toont `FreeRideCard` (duur + intensiteit,
  geen blokstructuur).

### GarminSync-knop — alle states
"Stuur naar Garmin" / "Stuur N sessies naar Garmin". WRITE · 🌐
| State | Trigger | Wat de gebruiker ziet |
| --- | --- | --- |
| **idle** | Standaard | Knop met upload-icoon. Klik → busy. |
| **busy** | Na klik | Disabled knop "Versturen…" met spinner. |
| **sent** | Succes | Groene bevestiging "Verstuurd naar Garmin" + tijdstip. |
| **stale** | Training is gewijzigd ná verzenden (signatuur wijkt af) | Waarschuwing "Garmin heeft nog de oude training" + knop "Bijgewerkte training versturen" → busy. |
| **error** | Verzenden mislukt | Rode melding "Versturen naar Garmin mislukt" + knop "Opnieuw proberen" → busy. |
- Per dag/sessie-set onthouden. Wijzigt de gekozen training (override, andere
  beschikbaarheid) → status wordt automatisch *stale*.

### Workout-picker (`WorkoutPicker`) — "Kies iets anders"
Vervangt het dag-detail; eigen interne navigatie.
| Element | Doet | R/W | Effect |
| --- | --- | --- | --- |
| **Terug** (chevron) | Eén stap terug; vanaf de home-keuze sluit het de picker. | 💻 | `vars→cats→home→sluiten`. |
| Tegel **"Uit bibliotheek"** | Naar categorie-keuze. | 💻 | route `cats`. |
| Tegel **"Vrije / groepsrit"** | Naar vrije-rit-form. | 💻 | route `free`. |
| **Categorie-kaart** | Toont varianten van die categorie. | 💻 | route `vars`. |
| **Duur-budget-slider** | Stelt doelduur in; herberekent varianten live. | READ · 💻 | Vult tijd aan met Z2, niet met meer intervallen. |
| **Variant-rij** | Kiest deze workout als override. | WRITE · 🌐 | `onPick({type:'library'})`; dag krijgt override, picker sluit. |
| Segmented **Vrije rit / Groepsrit** | Kiest rit-type. | WRITE · 💻 | Lokaal tot "Kies deze rit". |
| Segmented **Rustig / Tempo / Stevig** | Kiest globale intensiteit. | WRITE · 💻 | Lokaal. |
| **"Kies deze rit"** | Legt de vrije/groepsrit vast als override. | WRITE · 🌐 | `onPick({type:'free'})`; dag krijgt override, picker sluit. |

### Beschikbaarheid-editor (`AvailabilityEditor`)
| Element | Doet | R/W | Effect / voorwaarden |
| --- | --- | --- | --- |
| **Terug** (chevron) | Stap terug naar scope-keuze, of sluit (bij forceTrain / vanaf keuze). | 💻 | — |
| Tegel **"Alleen deze dag"** | Scope = dag. | 💻 | Toont dag-controls. |
| Tegel **"Hele week"** | Scope = week. | 💻 | Toont week-grid (ma–zo). |
| Toggle **"Train vandaag?"** | Zet of er op de dag getraind wordt. | WRITE · 💻 | Bij uit verdwijnt de minuten-slider; lokaal tot Opslaan. |
| Slider **"Minuten"** (30–240, stap 15) | Stelt trainingsduur in. | WRITE · 💻 | Alleen zichtbaar als "Train" aan staat. |
| Toggle **"Pendel?"** | Markeert woon-werk meegeteld. | WRITE · 💻 | Lokaal. |
| Week-grid per dag: **slider + Train-toggle + Pendel-toggle** | Stelt elke dag in. | WRITE · 💻 | Uit = "rustdag". |
| **Opslaan** | Bewaart beschikbaarheid en sluit de editor. | WRITE · 🌐 | Zet `availDirty=true` → stale-banner bij WeekLoad (plan moet bijgewerkt). In de echte app → server. |

### Randstaten (Schema)
| Element | Doet | R/W | Effect |
| --- | --- | --- | --- |
| `ConnectState` **"Verbinden in Instellingen"** | Opent instellingen om intervals.icu te koppelen. | 💻 | `screen='settings'`. Toont alleen bij *niet verbonden*. |
| `SyncBanner` **"Opnieuw proberen"** | Herhaalt de sync met intervals.icu. | WRITE · 🌐 | busy → bij succes terug naar *normaal*. Toont bij *sync mislukt*. |
| `EmptyState` **"Werk week bij"** | Genereert sessies (= verversknop). | WRITE · 🌐 | Zie WeekLoad-verversknop. Toont bij *lege week* / *eerste keer*. |

---

## Tab: Vorm

Status-deck bovenaan, daaronder de vorm-analyse. Bij *niet verbonden* toont de
hele tab `ConnectState`; bij *sync mislukt* staat de `SyncBanner` bovenaan;
bij *eerste keer* tonen grafiek, metrics en conditie hun lege staat.

### Status-deck — kaart 1: Readiness (`ReadinessCard`) — "Status · vandaag"
| Element | Doet | R/W | Effect / voorwaarden |
| --- | --- | --- | --- |
| **Ring + verdict-blok** (klikbaar) | Klapt "Waarom dit cijfer?" uit/in. | READ · 💻 | Toont factor-lijst (vorm-trend, HRV, belasting, slaap) met status-dots. |
| **"+ Ochtend-check-in invullen"** (gestippelde prompt) | Opent de check-in-sheet. | 💻 | Alleen zichtbaar als er vandaag nog niet is ingevuld. Opent bottom sheet. |
| **+** (rond, accent) | Heropent de check-in om aan te passen. | 💻 | Alleen zichtbaar nadat is ingevuld; opent de sheet voor-ingevuld. |
| Samenvattingsregel + effect-callout | Toont de ingevulde check-in en het effect op vandaag. | READ · 🌐 | Verschijnt na invullen; de score (ring + verdict) is herberekend uit de check-in. |

### Status-deck — kaart 2: Niveau (`LevelCard`) — "Niveau"
- Volledig **READ** · 🌐: niveau-getal (28/50), W/kg, blok-voortgangsbalk, delta.
  Geen interactieve controls.

### Status-deck — paginatie
| Element | Doet | R/W | Effect |
| --- | --- | --- | --- |
| **Swipe / horizontaal scrollen** | Wisselt tussen Readiness- en Niveau-kaart. | 💻 | Update de actieve dot. |
| **Dot 1 / Dot 2** | Springt naar kaart 1 of 2. | 💻 | Smooth-scrollt de deck. |

### Vorm-analyse
| Element | Doet | R/W | Effect / voorwaarden |
| --- | --- | --- | --- |
| Segmented **1M / 6M / 12M / Alles** | Kiest het tijdvenster van de niveau-grafiek. | READ · 💻 | Herrendert `NiveauChart` met die reeks + delta. Verborgen bij *eerste keer*. |
| **Niveau-grafiek** (`NiveauChart`) | Toont niveau-verloop. | READ · 🌐 | Bij *eerste keer* → `EmptyChart`-placeholder. |
| **Metric-rij** FTP / Gewicht / Week-TSS | Toont kerncijfers. | READ · 🌐 | Bij *eerste keer* → "—". |
| **Conditie-balans** (`ConditieBalans` / `Driehoek` / `PMC`) | Toont fitheid − vermoeidheid. | READ · 🌐 | Visualisatie-variant via Tweaks gekozen, niet in-scherm. Bij *eerste keer* → opbouw-melding. |

---

## Tab: Trainingen

Status-deck bovenaan; daaronder een drill-down bibliotheek (`TrainingenTab`)
met drie views.

| Element | Doet | R/W | Effect |
| --- | --- | --- | --- |
| **Categorie-kaart** (`CategoryCard`: Herstel, Duurvermogen, Tempo, Sweet Spot, FTP/drempel, VO2max…) | Opent de categorie. | 💻 | view `category`; toont varianten. Zet doelduur op de categorie-default. |
| **Duur-budget-slider** (`DurationSlider`, 45–240) | Stelt doelduur in; herberekent alle varianten live. | READ · 💻 | Aanwezig in zowel categorie- als workout-view. |
| **Variant-rij** (`VariantRow`) | Opent het workout-detail. | 💻 | view `workout`. Toont "in plan"-badge als die variant al gepland staat. |
| **Terug** (`BackBar` chevron) | Eén niveau terug. | 💻 | `workout→category→cats`. |
| **"Inplannen"** (`WorkoutDetail`) | Plant deze workout in. | WRITE · 🌐 | Eenmalig; knop wordt daarna "✓ Ingepland" en disabled. In de echte app → server (zet in het plan). |

---

## Tab: Niveau

- **Stub**: gestippelde kaart "Niveau-detail — volgende iteratie". Geen
  interactieve elementen. READ.

---

## Instellingen-scherm (drawer)

Alle wijzigingen zijn **WRITE · 🌐** (profiel/voorkeuren horen op de server);
de mock houdt ze in lokale state. Afgeleide en read-only velden expliciet
gemarkeerd.

### Profiel
| Element | Doet | R/W | Effect / voorwaarden |
| --- | --- | --- | --- |
| **Naam** | Toont de naam. | READ | Niet bewerkbaar in dit scherm. |
| **FTP** (getalveld, W) | Stelt het FTP-vermogen in. | WRITE · 🌐 | Herberekent W/kg live. |
| **Gewicht** (getalveld, kg) | Stelt het lichaamsgewicht in. | WRITE · 🌐 | Herberekent W/kg live. |
| **W/kg** | Toont FTP ÷ gewicht. | READ | Afgeleid; "—" als een veld leeg is. |
| **FTP automatisch bijwerken** (toggle) | Zet auto-update vanuit intervals.icu aan/uit. | WRITE · 🌐 | — |

### Trainingsprofiel
| Element | Doet | R/W | Effect |
| --- | --- | --- | --- |
| **Volume-profiel** (select: Amateur / Gemiddeld / Gevorderd / Professional) | Kiest wekelijkse belasting. | WRITE · 🌐 | Dropdown opent/sluit (💻); keuze → server. |

### Doel & blok
| Element | Doet | R/W | Effect |
| --- | --- | --- | --- |
| **Trainingsdoel** (tegelgrid: Duurvermogen / FTP-drempel / VO2max / Onderhoud) | Kiest het doel van het huidige blok. | WRITE · 🌐 | Eén actief. |
| **Blok-periode** (twee datumvelden, start → einde) | Stelt de blok-periode in. | WRITE · 🌐 | — |

### Events
| Element | Doet | R/W | Effect / voorwaarden |
| --- | --- | --- | --- |
| **Event-naam** (inline tekstveld) | Hernoemt het event. | WRITE · 🌐 | Placeholder "Event-naam…" als leeg. |
| **Prioriteit-chip** (A → B → C, cyclt) | Wisselt de prioriteit. | WRITE · 🌐 | Klik cyclet A→B→C→A; kleur/hint verandert mee (A hoofddoel, B mini-taper, C doortrainen). |
| **Datumveld** | Stelt de eventdatum in. | WRITE · 🌐 | — |
| **Verwijder-knop** (prullenbak) | Verwijdert het event. | WRITE · 🌐 | Geen bevestiging; rij verdwijnt. Bij 0 events → "Nog geen events"-tekst. |
| **"Event toevoegen"** | Voegt een leeg event toe (prio C). | WRITE · 🌐 | Nieuwe rij onderaan, klaar om te benoemen. |

### Koppelingen
| Element | Doet | R/W | Effect |
| --- | --- | --- | --- |
| **intervals.icu** status-badge "Gekoppeld" | Toont koppelingsstatus. | READ · 🌐 | — |
| **Athlete-ID / API-key** | Tonen identifiers (key gemaskeerd). | READ · 🌐 | — |
| **"Opnieuw koppelen"** | Start de koppel-flow opnieuw. | WRITE · 🌐 | — |
| **Garmin** "Gesynct · 2 min geleden" | Toont sync-status. | READ · 🌐 | — |
| **Workouts naar Garmin pushen** (toggle) | Zet automatisch pushen aan/uit. | WRITE · 🌐 | — |

### Meldingen
| Element | Doet | R/W | Effect |
| --- | --- | --- | --- |
| **Zondag-herinnering** (toggle) | Zet de wekelijkse beschikbaarheid-reminder aan/uit. | WRITE · 🌐 | — |

### Account
| Element | Doet | R/W | Effect |
| --- | --- | --- | --- |
| **E-mailadres** | Toont het account-e-mail. | READ · 🌐 | — |
| **"Uitloggen"** (destructief) | Logt de gebruiker uit. | WRITE · 🌐 | Beëindigt de sessie. |

---

## Samenvatting — wat naar de server moet

**🌐 Server (ophalen of bewaren):**
- intervals.icu koppelen / opnieuw koppelen / sync (haalt alle trainingsdata,
  vorm, niveau, metrics, conditie-balans op).
- Ochtend-check-in **Vastleggen** (herberekent gereedheid).
- RPE-score **Vastleggen** op een voltooide rit.
- Weekplan bijwerken (verversknop / "Werk week bij") na doel-/beschikbaarheidswijziging.
- Beschikbaarheid **Opslaan** (dag of hele week).
- Workout-override kiezen (bibliotheek of vrije/groepsrit) en "Terug naar voorstel".
- Workout **Inplannen** vanuit de bibliotheek.
- Training naar **Garmin** sturen (incl. opnieuw / bijgewerkt versturen).
- Alle **Instellingen**: FTP, gewicht, FTP-auto, volume, doel, blok-periode,
  events (toevoegen/hernoemen/prio/datum/verwijderen), Garmin-push, zondag-
  reminder, opnieuw koppelen, uitloggen.

**💻 Client (puur visueel/lokaal):**
- Tab wisselen, status-deck swipen + dots, settings-drawer openen/sluiten.
- Alle uitklappers (waarom dit cijfer, waarom deze training, blokstructuur,
  periodisering-tijdlijn) en de check-in-sheet openen/sluiten.
- Dagstrip-selectie, grafiek-tijdvenster (1M/6M/12M/Alles).
- Duur-budget-sliders en alle picker-/editor-keuzes vóór "Opslaan"/"Kies"/"Vastleggen".
- Conditie-visualisatie-variant (via Tweaks).

---

<!-- Levering 4 — Niveau-tab + Vorm-analyse (gefold uit _import-design-4) -->

## Vorm-analyse (Variant A/B-schakel)

### Vorm-analyse
**Vorm-variant** (Tweak A/B). Bij **A** vervalt onderstaande niveau-grafiek +
metric-rij; ze worden vervangen door één `VormLevelSummary`-rij (READ · 🌐;
klik → `tab='niveau'`). De diepe progressie woont dan op Niveau (zie Tab:
Niveau). Bij **B** blijft onderstaande ongewijzigd. De conditie-balans blijft in
beide.

| Element | Doet | R/W | Effect / voorwaarden |
| --- | --- | --- | --- |
| **`VormLevelSummary` → "Progressie →"** *(alleen Variant A)* | Springt naar de Niveau-tab. | READ · 💻 | `tab='niveau'`; toont W/kg · niveau · FTP + delta als samenvatting. |
| Segmented **1M / 6M / 12M / Alles** *(Variant B)* | Kiest het tijdvenster van de niveau-grafiek. | READ · 💻 | Herrendert `NiveauChart` met die reeks + delta. Verborgen bij *eerste keer*. |
| **Niveau-grafiek** (`NiveauChart`) *(Variant B)* | Toont niveau-verloop. | READ · 🌐 | Bij *eerste keer* → `EmptyChart`-placeholder. |
| **Metric-rij** FTP / Gewicht / Week-TSS *(Variant B)* | Toont kerncijfers. | READ · 🌐 | Bij *eerste keer* → "—". |
| **Conditie-balans** (`ConditieBalans` / `Driehoek` / `PMC`) | Toont fitheid − vermoeidheid. | READ · 🌐 | Visualisatie-variant via Tweaks gekozen, niet in-scherm. Bij *eerste keer* → opbouw-melding. |

---

---

## Tab: Niveau

Langetermijn vermogen & ontwikkeling. **Geen status-deck.** Data-staten:
*gevuld* (normaal), *laden* (skeletons) en *leeg* (eerste keer / lege historie).
Vrijwel alles READ; de enige WRITE-achtige interacties zijn lokale view-state
(metric/venster-switch, what-if-slider).

### a. Vermogen-snapshot
- Volledig **READ · 🌐** — FTP, eFTP, W/kg, gewicht, tier + tier-ladder.
  Geen controls. Tier = afgeleid van W/kg.

### b. Progressie over tijd
| Element | Doet | R/W | Effect / voorwaarden |
| --- | --- | --- | --- |
| Segmented **Niveau / W/kg / Fitheid** | Kiest de metric van de grafiek. | READ · 💻 | Herrendert `NvTrajectoryChart`; kop-waarde + delta + y-as schalen mee. |
| Segmented **1M / 6M / 12M / Alles** | Kiest het tijdvenster. | READ · 💻 | Slice van de 730d-reeks; delta = waarde − vensterstart. |
| **Fitheid**-overlay-toggle | Toont/verbergt de CTL-context-lijn. | READ · 💻 | Alleen bij metric Niveau/W/kg; gestippelde neutrale lijn. |
| **Grafiek-scrub** (sleep/hover) | Leest een punt af. | READ · 💻 | Tooltip met waarde + maandlabel. |
| Reeksen | niveau, W/kg, fitheid (CTL). | READ · 🌐 | Afgeleid uit 730d FTP/TSS/gewicht-historie. Bij *leeg* → placeholder. |

### c. Rijdersprofiel — *Fase 2*
- **READ · 🌐** — power-duration-curve + type-duiding. Vraagt een nieuwe
  intervals.icu mean-max-power-fetch; tot dan een "Fase 2"-preview-kaart.
  (Toekomst: tik op een duur-marker → die best-effort-rit openen.)

### d. Doel-gereedheid + projectie — *Fase 2 · visie*
| Element | Doet | R/W | Effect / voorwaarden |
| --- | --- | --- | --- |
| **Doel-gap-rijen** (Klimvermogen / Duurvermogen / Lange-rit) | Tonen huidig vs Girona-vraag + op-koers/nog-te-gaan. | READ · 🌐 | Huidig uit historie; Girona-vraag uit de doel-definitie (vereist een target-instelling). |
| **Uren → potentieel** (`HoursSlider`, sleep) | Stelt de aangenomen uren/week in voor de projectie. | READ · 💻 | Lokale what-if; de app kent het werkelijke gemiddelde al uit beschikbaarheid. Drijft plafond + ramp + readout. Muteert geen plan. |
| **Fitheid-projectie** (`ProjectionChart`) | Toont de uit-volume-berekende CTL-ramp → plafond, met duurdoel-lijn + klaar-marker. | READ · 💻 | **Solide** = wiskundig gefundeerd. Plafond ≤ doel → géén klaar-marker + eerlijke "niet haalbaar"-melding. |
| **Geschat FTP-effect** (band + "schatting") | Toont het speculatieve W/FTP-bereik over de horizon. | READ · 💻 | **Nadrukkelijk onderscheiden** van de solide ramp: gestreepte band, gelabeld "schatting", nooit één getal. |
| **Aannames tonen/verbergen** | Klapt de aannames onder de band uit/in. | READ · 💻 | Maakt de basis van de schatting zichtbaar (sleutelsessies, regelmaat, herstel, afvlakking). |
| Readout + "+2u/week ≈ X weken eerder" | Vertaalt de slider naar een gereedheid-tijdlijn. | READ · 💻 | Herberekent live bij elke sliderstap. |

> **Eerlijkheid = harde eis.** Het fitheid-plafond (uit volume) is wiskundig
> gefundeerd → solide weergegeven. De FTP/W-kg-winst is een schatting → een
> gelabelde band met zichtbare aannames, géén vals-precieze enkel-getal-belofte.

---

---

<!-- Cadans-rebrand (STAP 1 deel A) — gefold -->
## Cadans — coachnaam (Instellingen + header)

| Element | Doet | R/W | Effect / voorwaarden |
| --- | --- | --- | --- |
| **"Jouw coach" — tekstveld + chips** (Instellingen, sectie 0) | Stelt de coachnaam in. | WRITE · 🌐 | Eén-Opslaan → `saveSettings` → DocProp `coach_naam` (Sheet rij 54); raakt API-key niet. Default "Coach". |
| **#appbar-wordmark** | Toont de coachnaam (uppercase) naast de CadansMark. | READ · 🌐 | `state.coachName`; default "COACH". |
| **Coach-callout-overline** | Toont de coachnaam i.p.v. "COACH". | READ · 🌐 | `state.coachName`; impact-variant → "{NAAM} · IMPACT". |
