# HANDOFF — FTP Coach web-app (project: training)

Read-only HtmlService web-app, tabs Schema + Vorm. /dev:
https://script.google.com/macros/s/AKfycbz51mSRp2LYEIWFPJLmahX14_40w5c85UEDcjCSIW-J/dev

Laatste code-commit vóór deze HANDOFF: eca1483.

## Draad (2) — niveau-kaart (status-deck boven Schema + Vorm)

2a AF — swipe-deck, 2 kaarten, per-mount ids swrap-/sdots-{sfx}. Kaart 1 = ring + verdict (.status-left + .status-right). Kaart 2 = .niveau-block.
Deck-CSS FRAGIEL — NIET aanraken: .status-card { flex:0 0 100%; scroll-snap-align:center; display:flex; gap:12px; }. .status-wrap/.status-deck met rust laten.

2b-1 AF — niveau = clamp(niveauBasis + conditieMod, 0, 50). niveauBasis = computeNiveau_(ftp,gewicht) (W/kg-anker, 1,0=0 / 6,9=50). conditieMod = computeConditieMod_(ctlNow,ctlRef) (CTL_SPAN=10, BAND=2,0, cap ±2). FTP = handmatige cel, ftp_auto_update UIT.

2b-2 AF —
- Frontend: subtekst in .niveau-block ná .niveau-wkg, class .niveau-voortgang (GEEN id, mount-suffix-safe).
- voortgangPct = adherence over VOLTOOIDE weken sinds doelStart (lopende week uitgesloten); 0 voltooide weken → null → placeholder "blok net gestart". Week = ma–zo (weekStartDate). eersteWeekStart = eerste maandag ≥ doelStart; voltooide = [eersteWeekStart, huidigeWeekStart); verwacht per week = midden(getVolumeTargets[fase])×tssPerUur (GEEN /7); werkelijk = sumTssVanafDatum_(eersteWeekStart) − sumTssVanafDatum_(huidigeWeekStart). (commit cac6678)
- Toont nu terecht "blok net gestart": doelStart = vandaag → 0 voltooide weken.

2b-3 AF — beginniveau→huidig delta op de niveau-kaart.
- Frontend: .niveau-progressie regel ná .niveau-voortgang: "+X,X sinds mmm 'jj" (weggelaten zonder begin-data). Geen id, mount-safe. Kaart 2 heeft nu 5 regels (getal→label→wkg→voortgang→progressie); geen overflow.
- Backfill uit intervals.icu-velden die al meekomen in getActivities (volledige objecten, geen fields-filter). Activiteiten-tab +3 kolommen: FTP(idx12), Gewicht(idx13), Rolling FTP(idx14) ← icu_ftp / icu_weight / icu_rolling_ftp. ACT_HEADERS = 15. Readers werken op kolom-INDEX (ACT_HEADERS.length), niet header-naam.
- beginRij = oudste rij (data tot 2024-06-03, ACT_HISTORY_DAYS=730). ftpBegin=icu_ftp, gewichtBegin=icu_weight (null→huidig gewicht). niveauBasisBegin=computeNiveau_. conditieModBegin = 0 (Wellness-tab gecapt ~30d, WELL_STATS_ROW=35 → historische CTL niet leesbaar; data-start=referentie). beginNiveau=clamp(niveauBasisBegin+0,0,50). niveauDelta = huidigNiveau − beginNiveau. Payload top-level: beginNiveau/beginLabel/niveauDelta. (commits aadf53b + 5b72fdc)
- syncActivities borgt rij 1 = ACT_HEADERS idempotent vóór de data-write (zelf-helend bij schema-uitbreiding; full-rewrite sync). (commit eca1483)
- icu-velden referentie: icu_ftp = gezette FTP per rit (260→275 over 2024→2026). icu_rolling_ftp = lopende eFTP (264→272). icu_pm_ftp = per-rit power-model (springerig, ONBRUIKBAAR). icu_weight aanwezig.

## OPEN HANDMATIGE STAP
- Daan draait één keer "Sync nu (intervals.icu)" → headers FTP/Gewicht/Rolling FTP verschijnen boven de bestaande kolommen (cosmetisch; data + delta al correct).

## UITGESTELDE VERIFICATIE
- voortgangPct %-pad nooit met echte voltooide weken gedraaid. Live na Girona zodra doelStart op een echte blok-start staat → dan checken: ~80–115% en stabiel (niet mid-week wiebelend).
- delta-wobble: niveauDelta hangt aan live huidigNiveau (incl. conditieMod ±2), begin = alleen niveauBasis → "+X,X sinds 2024" kan ±~2 dag-tot-dag wiebelen. Bekend/akkoord. Later evt. delta op niveauBasis baseren (stabiel, maar begin+delta ≠ headline).

## VOLGENDE
- 2c — maand-trend op Vorm. LET OP: historische CTL is NIET opgeslagen (Wellness gecapt ~30d). Voor een echte trend CTL herrekenen uit activiteiten-TSS (de "herberekenbaar tot 2024"-belofte; data reikt tot 2024-06-03). Geen API/tab-uitbreiding.
- draad (3) — fase-bewuste status-toon (verdict/gereedheid past zich aan de trainingsfase aan).
- draad (4) — polish.

## FILES / CONTRACTEN
- WebApp.gs: getDashboardState (per-week while-loop voortgangPct), statusGraphicHtml(sfx), niveau-calc.
- Sync.gs: syncActivities (full-rewrite + idempotente header-write).
- Activiteiten.gs: buildActiviteiten, ACT_HEADERS (15).
- IntervalsApi.gs: getActivities(daysBack) /athlete/{id}/activities; getWellness /athlete/{id}/wellness. Wellness-tab kol CTL/ATL/Vorm/Ramp, gecapt ~30d.
- sumTssVanafDatum_(ss,startDate): som datum ≥ startDate t/m vandaag, inclusief, geen bovengrens.
- REGRESSIE-LES: geen lokale vars die payload-keys schaduwen (dagen/vorm/athlete/reeks/event/voortgangPct/niveau/niveauBasis/conditieMod). Bij content-verlies: eerst console + incognito, dan diag — niet CSS/HTML gokken.
