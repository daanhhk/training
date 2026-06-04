# FTP Coach — Design

Dit document beschrijft de visuele beslissingen achter de mockups en hoe je de
tokens uit `design/tokens.css` toepast. `tokens.css` is de single source of
truth: elke kleur, maat, radius en schaduw die hieronder genoemd wordt bestaat
daar als token. Hardcode nooit een waarde die ook een token heeft.

---

## 1. Thema & sfeer

Donkere, koel-neutrale performance-tool. Telefoon-first (~390px breed),
data-dicht maar rustig. De achtergrond is bijna zwart met een koele ondertoon;
content leeft op donkere kaarten die met subtiele hairlines en een lichte
schaduw van de canvas worden getild.

- **Canvas**: `--bg-app`
- **Ingedrukte vlakken** (velden, grafiek-plot, lege rijen): `--bg-sunken`
- **Kaarten / panelen**: `--bg-surface` met rand `--border-subtle`, radius
  `--card-radius` en `--card-shadow`
- **Verhoogd** (chips, tooltips, actieve tegels): `--bg-elevated`

De stack werkt op één principe: **hoger = lichter = dichterbij**. Gebruik nooit
puur zwart of puur wit als vlak; tekst is `--text-primary` (zacht wit), nooit
`#FFF` behalve op accentvlakken (`--text-on-accent`).

## 2. Hiërarchie

Drie tekstniveaus dragen vrijwel de hele UI:

| Niveau | Token | Gebruik |
| --- | --- | --- |
| Primair | `--text-primary` | koppen, key-getallen, knop-labels |
| Secundair | `--text-secondary` | labels, ondersteunende zinnen |
| Muted | `--text-muted` | overlines, captions, as-tekst, inactieve tabs |

Getallen krijgen extra gewicht via de **mono-numeriek** stack (`--font-num`,
tabular) en de numerieke schaal (`--fs-num-lg/md/sm`). Eén hero-getal per scherm
(ring-waarde, niveau) mag groot; de rest is ingetogen.

## 3. Accent vs. status vs. zones

Dit zijn **drie gescheiden kleurrollen**. Ze nooit door elkaar gebruiken.

### Accent (oranje → rood) — `--accent`
Energie, spaarzaam ingezet. Eén keer per scherm laten knallen.
- **WEL**: actieve ring-voortgang, primaire CTA (`--accent-grad`), actieve
  tab + indicator, de niveau-grafieklijn, één key-getal-highlight.
- **NIET**: lopende tekst, borders, semantische status, grote gevulde vlakken.

Interactieve states: `--accent-hover` (lichter), `--accent-active` (donkerder),
`--accent-disabled`, focus-glow `--accent-ring`. Tints via `--accent-soft`.

### Status / feedback — `--success` `--warning` `--danger` `--info`
Betekenis, niet decoratie. Aliassen die in de mock gebruikt worden:
- `--good` (= success) — productief / opbouwend, waar je wilt zitten
- `--warn` (= warning) — let op
- `--bad` (= danger) — oververmoeid
- `--fresh` (= info) — fris / getaperd, uitgerust

Elke status heeft een `-soft` variant voor zachte achtergrondvlakken
(banners, badges, callouts).

### Trainingszones — `--zone-1` … `--zone-6`
De vermogensschaal in workout-visualisaties: rustig (koel blauw) → fel.
`--zone-5` en `--zone-6` **erven het accent**, zodat ze meeschuiven als de
accentkleur verandert. Zones zijn alleen voor zone-balken, zone-badges en
de bijbehorende legenda — nooit voor gewone UI-chrome.

## 4. Density & spacing

4-punts grid (`--s-1` … `--s-8`). Kaart-padding standaard `--s-4` (16px).
Verticale ritme tussen blokken ~`--s-5`/`--s-6`. Hou de UI compact maar laat
key-elementen ademen: een hero-getal of ring krijgt ruime witruimte, dichte
metric-rijen worden met hairlines (`--border-subtle`) gescheiden i.p.v. ruimte.

Radius-schaal `--r-xs` … `--r-pill`: velden `--r-sm`, kaarten `--r-lg`,
knoppen `--r-md`, pills/chips `--r-pill`, bottom sheet `--r-2xl`.

## 5. Typografie-gebruik

- **`--font-sans`** (IBM Plex Sans): alle UI, labels, koppen.
- **`--font-num`** (IBM Plex Mono, tabular): álle getallen — tijden, TSS, IF,
  watt, niveau, datums in de dagstrip. Dit geeft cijfers hun "instrument"-gevoel.
- **Overlines**: `--fs-caption`, uppercase, `letter-spacing: var(--tracking-overline)`,
  kleur `--text-muted`.
- Type-scale stappen hebben elk een vaste size + weight + line-height; gebruik
  de stap, verzin geen tussenmaten.

## 6. Token → element-mapping

| UI-element | Belangrijkste tokens |
| --- | --- |
| Kaart / paneel | `--card-bg` `--card-border` `--card-radius` `--card-shadow` `--card-pad` |
| Primaire knop | `--btn-primary-bg` `--btn-primary-text` `--btn-height` `--btn-radius` |
| Secundaire knop | `--btn-secondary-bg` `--btn-secondary-border` `--btn-secondary-text` |
| Destructieve knop | `--btn-destructive-bg` `--btn-destructive-text` |
| Tab bar (onder) | `--tabbar-bg` `--tabbar-border` `--tabbar-icon(-active)` `--tabbar-label(-active)` `--tabbar-indicator` `--tabbar-safe-bottom` |
| Tekst-/getalveld | `--field-bg(-focus)` `--field-border(-focus)` `--field-text` `--field-placeholder` `--field-height` `--field-radius` |
| Toggle / switch | `--toggle-w/h` `--toggle-track-off/on` `--toggle-thumb` `--toggle-thumb-shadow` |
| Segmented control | `--segment-track-bg` `--segment-text` `--segment-active-bg/text/shadow` |
| Select / dropdown | `--select-bg` `--select-border` `--select-menu-bg/border` `--select-option-active` |
| Range slider | `--slider-track` `--slider-fill` `--slider-thumb` |
| Bottom sheet + scrim | `--scrim` `--sheet-bg` `--sheet-radius` `--sheet-handle` `--sheet-shadow` |
| Readiness-/statuskaart | `--readiness-ready/caution/rest` `--readiness-ring-track` + card-tokens |
| Plan-/periodiseringkaart | `--phase-past/current/future/marker` `--mode-chip-*` `--event-a/b-*` |
| Status-badge | `--badge-good-bg` `--badge-good-text` |
| Grafiek | `--chart-line` `--chart-fill` `--chart-grid` `--chart-axis` `--chart-point` |

## 7. Do / Don't

**Do**
- Gebruik semantische tokens, niet primitives, in UI-code (`--bg-surface`,
  niet `--gray-900`).
- Eén accent-moment per scherm; laat status- en zonekleuren hun eigen werk doen.
- Zet alle getallen in `--font-num`.
- Leid tints/varianten af met `color-mix(... var(--token) ...)` zodat ze
  meebewegen met het accent.
- Scheid dichte data met `--border-subtle` i.p.v. extra ruimte.

**Don't**
- Geen losse hex in componenten — alles loopt via tokens.
- Accent niet gebruiken voor borders, body-tekst of status.
- Zonekleuren niet lenen voor gewone UI-chrome.
- Geen puur `#000`/`#FFF` vlakken; gebruik de neutrale ramp.
- Geen tussenliggende radius/spacing-waarden buiten de schaal.
