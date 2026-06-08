# FTP Coach — INTERACTIONS · bijgewerkte secties
# C-bis (coach-feedback: Reading + ZoneCompare) + C-ter (rit-detail: herziene metric-grid)
# Plak 1:1 terug in design/INTERACTIONS.md (vervangt de bestaande C-bis/C-ter blokken).

**C-bis. Coach-feedback op voltooide/gemiste dagen** (`DoneMatch` /
`DoneDeviation` / `Missed` — zie export-doc §1bis). De gepland-vs-gedaan-lezing,
de impact-callout en de adaptatie zijn **coach-beslissingen** en daarom
server-geleid.
| Element | Doet | R/W | Effect / voorwaarden |
| --- | --- | --- | --- |
| **Alignment-chip** (`AlignChip`: Op plan / Licht afgeweken / Anders getraind / Niet gereden) | Toont hoe goed de uitvoering het plan volgde. | READ · 🌐 | Soort + percentage worden server-side bepaald (uit de geüploade activiteit). Puur lezen, niet klikbaar. |
| **Gepland-vs-gedaan-lezing** (`Reading`: type · duur · IF · TSS) | Toont plan naast uitvoering. | READ · 🌐 | Geplande waarden uit het plan, gedane waarden uit de activiteit. |
| **Zone-vergelijking** (`ZoneCompare`: gepland vs gedaan, min/zone) | Toont per zone (Z1–6) de geplande tijd naast de gedane tijd; tags *niet gepland* / *niet gereden*. | READ · 🌐 | Geplande zone-minuten uit de workout-structuur, gedane uit de intervals.icu-zonetijden. Puur lezen. *Alleen in de coach-feedback* (vs plan), niet in de rit-detail. |
| **Uitvoerings-balk** (`AlignBar`, alleen bij match) | Toont %-tijd binnen doel. | READ · 🌐 | Server-berekend. |
| **Impact-callout** (`CoachCallout impact`) | Legt uit wat match/afwijking/gemist betekent voor de blok-fase. | READ · 🌐 | **Server-geleid** (coach-engine); narratieftekst, niet bewerkbaar. |
| **Adaptatie-regel** ("Aanpassing: …") | Toont wat de coach met het plan doet (verplaatsen / inkorten / niets). | READ · 🌐 | **Server-geleid**: de engine heeft het plan al aangepast; deze regel rapporteert de uitkomst. Geen knop. |
| **Skip-reden** (Geen tijd / Bewust gerust / Iets anders — alleen `Missed`) | Legt de reden van de gemiste dag vast. | WRITE · 🌐 | Eén actief; voedt de coach-engine (kan de adaptatie/vooruitblik bijstellen). |

**C-ter. Rit-detail / activiteit-statistieken** (`RideLoaded` / `RideLoading` /
`RideError` — zie export-doc §1ter). Opent als overlay-sheet vanuit een
voltooide rit; de detaildata wordt lazy opgehaald.
| Element | Doet | R/W | Effect / voorwaarden |
| --- | --- | --- | --- |
| **Tik-affordance op gereden rit** (de voltooide workout-kaart / "bekijk statistieken") | Opent de rit-detail-sheet. | 💻 | Mount de overlay (`--scrim` + sheet) en triggert `getRideDetail(activityId)`. Alleen op dagen met een gekoppelde activiteit. |
| **Lazy-load** (`getRideDetail`) | Haalt summary-metrics + interval-structuur op bij intervals.icu. | READ · 🌐 | Tijdens het ophalen → `RideLoading` (skeleton). Resultaat wordt per activiteit gecachet; heropenen toont direct de geladen sheet. |
| **Sheet-inhoud** (kop, tijd-in-zone, hero NP·IF·TSS, herziene metric-grid: gem. vermogen · W/kg · gem. HR [max als sub] · hoogtewinst · cadans · arbeid kJ, intervallen) | Toont de statistieken. | READ · 🌐 | Alles server-data; puur lezen, geen muterende controls. W/kg = gem. vermogen ÷ gewicht. VI/max-HR-tegel/calorieën bewust weggelaten (fietser-nut). |
| **Scrollen** binnen de sheet | Bladert door metrics → intervallen → (toekomstige curve). | 💻 | Lokaal. |
