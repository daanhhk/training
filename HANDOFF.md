# HANDOFF — FTP Coach web-app (project: training)

Read-only HtmlService web-app, tabs Schema + Vorm. /dev:
https://script.google.com/macros/s/AKfycbz51mSRp2LYEIWFPJLmahX14_40w5c85UEDcjCSIW-J/dev

Laatste code-commit vóór deze HANDOFF: 95f72cb.

## Draad (2) — niveau-kaart (status-deck boven Schema + Vorm) — VOLLEDIG AF (2a/2b/2c)

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

2c AF — niveau-over-tijd grafiek op Vorm-tab, per kalendermaand jun '24→huidig (commit 95f72cb, visueel geverifieerd op /dev incognito).
- Server: dashNiveauReeks_(ss) (WebApp.gs) — bucket Activiteiten per yyyy-MM (datum idx0, ftp idx12, gewicht idx13); representatief = laatste-op-datum rij met ftp+gewicht beide gevuld; begin-ankermaand overschreven met dashBeginAnker_ → punt 1 = exact beginNiveau; reeks begin→huidige maand, gat → niveau:null. Payload-key vorm.niveauReeks [{maand,niveau,ftp,gewicht}]. dashStatsFromActivities_ en de 12-maand-cap ongemoeid.
- Client: Index.html "Niveau-trend"-blok ná #vorm-stats; drawNiveauChart() (LineChart corechart, kleur #5B5BD6, interpolateNulls:true, vAxis auto-zoom floor(min−1)/ceil(max+1), tooltip komma-decimaal + W/kg); helper nlMaandLabel_('yyyy-MM')→"mmm 'jj"; subregel uit state.beginLabel; gewired in google.charts load-callback + switchTab('vorm'). Toggle-onafhankelijk.
- Metric: puur computeNiveau_ (niveauBasis, W/kg-gedreven), conditieMod overal 0 → glad/wobble-vrij. Eindpunt = niveauBasisNow (valt alleen samen met kaart-niveau als conditieMod≈0; bewust niet conditieMod-inclusief). Begin-anker = oudste Activiteiten-rij. Waargenomen: punt 1 ≈ 20,6, eind ≈ 22,7, ~24 punten, plateau sinds najaar '25.

## 2b-3 SYNC/HEADER — FEITELIJK AFGEROND
- Volle historie rendert, dus Activiteiten-kolommen 12/13 (icu_ftp/icu_weight) zijn gevuld over de hele tab; headers FTP/Gewicht/Rolling FTP staan correct (idempotente header-write). Geen openstaande handmatige stap meer.

## UITGESTELDE VERIFICATIE
- voortgangPct %-pad nooit met echte voltooide weken gedraaid. Live na Girona zodra doelStart op een echte blok-start staat → dan checken: ~80–115% en stabiel (niet mid-week wiebelend).
- delta-wobble: niveauDelta hangt aan live huidigNiveau (incl. conditieMod ±2), begin = alleen niveauBasis → "+X,X sinds 2024" kan ±~2 dag-tot-dag wiebelen. Bekend/akkoord. Later evt. delta op niveauBasis baseren (stabiel, maar begin+delta ≠ headline).

## GEPARKEERD (later mooi maken — niet weggegooid)
- Vorm-tab verfraaiing.
- draad (3) — fase-bewuste status-toon (verdict/gereedheid past zich aan de trainingsfase aan).
- draad (4) — polish.

## VOLGENDE — app interactief maken
Nu is het een read-only HtmlService web-app. Eerste stap in de verse chat = SCOPE SCHERP vóór bouwen:
- Wélke interactiviteit? Invoer/acties die terugschrijven naar Sheets? RPE/post-ride-feedback vanuit de web-app? Settings aanpassen? Knoppen die Apps Script-functies triggeren?
- Op welke tab, en de read/write-implicatie — read-only → er moet een write-pad bij (google.script.run of doPost).
- Geen bouw vóór scope; daarna read-only recon-prompt (STAP 0), dan bouw-prompt.

## FILES / CONTRACTEN
- WebApp.gs: getDashboardState (per-week while-loop voortgangPct), statusGraphicHtml(sfx), niveau-calc.
- Sync.gs: syncActivities (full-rewrite + idempotente header-write).
- Activiteiten.gs: buildActiviteiten, ACT_HEADERS (15).
- IntervalsApi.gs: getActivities(daysBack) /athlete/{id}/activities; getWellness /athlete/{id}/wellness. Wellness-tab kol CTL/ATL/Vorm/Ramp, gecapt ~30d.
- sumTssVanafDatum_(ss,startDate): som datum ≥ startDate t/m vandaag, inclusief, geen bovengrens.
## DURABELE LESSEN / WERKWIJZE
- REGRESSIE-LES: geen lokale vars die payload-keys schaduwen (dagen/vorm/athlete/reeks/event/voortgangPct/niveau/niveauBasis/conditieMod/niveauReeks). Bij content-verlies: eerst console + incognito, dan diag — niet CSS/HTML gokken.
- Deck-CSS is FRAGIEL — .status-card/.status-wrap/.status-deck NIET aanraken (zie draad 2a).
- Elke implementatie/recon-prompt: STAP 0-recon (lees echte functies/signatures, bevestig/pas-aan, meld afwijkingen) + rapport-cap MAX 200 woorden proza, literals exact.
- Visueel verifiëren op de /dev (HEAD) URL in incognito + hard refresh — niet op een diag leunen. clasp push -f = direct live op /dev (geen redeploy); _Diag.gs read-only + gitignored, opruimen na gebruik.
- HANDOFF.md via git (commit+push), GEEN clasp (niet in src/).
