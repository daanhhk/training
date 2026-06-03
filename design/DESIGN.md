# Design-track — FTP Coach (spec-bron voor de visuele polish-pass)
Stijl: dark, data-dicht performance-pro-tool, accent oranje→rood. Bron: Claude Design.
Formaat: React-componenten met inline-styles die tokens.css consumeren. Volledige bron in FTP-Coach-export.md; canonieke tokens los in tokens.css.
Schermen gedekt: status-deck (ring+verdict / niveau-blok), ochtend-check-in, gereedheid-"waarom", Vorm, Schema (dag-strip + dag-detail voorstel/voltooid/rustdag/multi-sessie, RPE, blok-detail, override, Garmin-push incl. "verouderd", beschikbaarheid dag/week, event-tijdlijn, week-belasting + "werk week bij"), Trainingen (categorie→varianten), Instellingen, lege/fout-staten.
Tokens: zones 1–6 (Z5=accent, Z6=anaeroob); semantisch good/warn/bad/fresh; IBM Plex Sans + Mono; 4pt-spacing.
NEGEER bij de bouw (Design-steigers, geen app-code): IOSDevice, TweaksPanel, TWEAK_DEFAULTS, hexA.
Niveau-tab = placeholder ("volgende iteratie"), bewust uitgesteld.
HARDE REGELS bij implementatie:
- deck-CSS .status-card / .status-wrap NIET aanraken.
- vermogen afronden op 5 W.
- variant/duur-schaling: begrensde key-set + endurance-vulling, GEEN reps-meeschaling met duur; IF daalt bij langere duur.
Gebruik: bij de polish-pass tokens.css + screenshots als doel; toepassen als hand-CSS op Index.html/Script.html. JSX in de export plakt NIET 1:1 (andere architectuur) — referentie voor structuur/markup.
