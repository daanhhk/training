# _import-design-3 — herontwerp coach-vergelijking + rit-detail-metrics

Vervolg op frames 08–11. Twee wijzigingen, klaar voor 1:1 integratie.

## Wat is er veranderd
- **Probleem A — ZoneCompare (frames 08–10):** de twee losse gestapelde
  zone-balken (gepland/gedaan) zijn vervangen door een per-zone-vergelijking:
  één rij per zone (Z1–6) met een faded "geplande-omvang"-balk en de massieve
  "gedaan"-balk eroverheen, op één minuten-schaal. Tags *niet gepland* (gereden,
  niet in plan) en *niet gereden* (gepland, niet gereden). Alleen in de
  coach-feedback (vs plan) — de rit-detail houdt z'n enkele TimeInZoneBar.
- **Probleem B — rit-detail-metrics (frame 11):** hero NP·IF·TSS blijft.
  Grid herzien naar 6 tegels: Gem. vermogen · W/kg · Gem. HR (max als sub) ·
  Hoogtewinst · Cadans · Arbeid (kJ). VI, losse Max.-HR-tegel en Calorieën weg.

## Inhoud
| Bestand | Wat |
| --- | --- |
| `08-dag-voltooid-match.png` | Frame 08 — match (ZoneCompare, gepland≈gedaan) · 390×844 |
| `09-dag-voltooid-afwijking.png` | Frame 09 — afwijking (Z5 niet gereden, Z3 niet gepland) · 390×844 |
| `10-dag-gemist.png` | Frame 10 — gemist · 390×844 |
| `11-rit-detail.png` | Frame 11 — rit-detail met herziene 6-tegel-grid · 390×844 |
| `tokens.css` | Volledig tokenbestand, incl. nieuwe `--zcompare-*` in de component-laag |
| `coach-feedback.jsx` | Bron frames 08–10 (bevat `ZoneCompare` / `ZoneCompareRow`) |
| `ride-detail.jsx` | Bron frame 11 (herziene `Metric`-grid) |
| `Dag-feedback (frames 08-10).html` | Standalone render-host (coach-feedback.jsx) |
| `Rit-detail (frame 11).html` | Standalone render-host (ride-detail.jsx) |
| `FTP-Coach-export_secties-1bis-1ter.md` | Bijgewerkte export-doc-secties §1bis + §1ter |
| `INTERACTIONS_secties_coach-feedback_rit-detail.md` | Bijgewerkte INTERACTIONS C-bis + C-ter |

## Nieuwe tokens (verbatim, in de component-laag van tokens.css)
```
--zcompare-track:         var(--reading-track);
--zcompare-plan-strength: 26%;
--zcompare-track-h:       18px;
--zcompare-done-h:        8px;
--zcompare-label:         var(--text-secondary);
--zcompare-tag-unplanned: var(--align-different);
--zcompare-tag-skipped:   var(--text-muted);
```

HTML standalone openen: zet de map in z'n geheel neer; de twee .html-bestanden
verwijzen relatief naar `tokens.css` + de bijbehorende `.jsx`.
