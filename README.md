# FTP Trainings Coach

Google Sheet + Apps Script die wekelijkse training-voorstellen
genereert op basis van intervals.icu data en jou in Garmin's
"Productive" status houdt.

## Setup

Een kopie van de Sheet draaien voor jezelf:

1. **Sheet kopiëren** — open de template-Sheet en File > Make a copy.
2. **Bouw alles opnieuw** — menu `🚴 Coach > Bouw alles opnieuw (reset Sheet)`.
   Dit zet de tabs op (Instellingen, Zones, Doel, Events, Weekplanner,
   Voorstel, Activiteiten, Wellness).
3. **Vul Instellingen** — tab `Instellingen`:
   - FTP, HRmax, HRrust, LTHR, loop-pace
   - Doel + startdatum + duur
   - intervals.icu **Athlete ID** (rij 23, formaat `i12345`)
   - Profiel-preset (Amateur 3u / Gemiddeld 5u / Gevorderd 7u / Pro 10u+)
   - Optioneel: gewicht, FTP/gewicht auto-update vinkjes
4. **Vul secrets via Setup-menu** — menu `🚴 Coach > 🔐 Setup`:
   - `Set intervals.icu API key` — Basic-auth password
     (haal uit intervals.icu → Settings → Developer Settings)
   - `Set Telegram bot token` — alleen nodig als je de bot-laag aan gaat
     zetten (placeholder, nog niet live)
   - `Set Telegram chat ID` — idem
   - `Toon opgeslagen secrets` — geeft een gemaskeerde status-alert
     (`•••• 1234`) zodat je kunt zien of een waarde gezet is
   - `Wis alle secrets` — verwijdert de 3 secrets uit PropertiesService.
     App-state (FTP, zones, pattern, weekplan, intent) blijft staan.
5. **Test verbinding** — menu `🚴 Coach > Test API verbinding`. Bij ✅
   is de sync klaar voor gebruik.
6. **Installeer triggers**:
   - `Installeer dagelijkse sync (08:00)` — activiteiten + wellness
   - `🔐 Setup > Installeer athlete-sync trigger` — wekelijks (zondag
     23:00) FTP/gewicht refresh als de vinkjes aan staan
7. **Eerste voorstel** — menu `🚴 Coach > Genereer voorstel voor deze
   week` → tab `Voorstel`. Push naar Garmin via
   `Push voorstel naar Garmin` (vereist dat `Upload workouts to Garmin`
   aan staat in intervals.icu → Settings → Garmin).

## Security

Deze tool slaat **geen secrets in cellen op**. Alle gevoelige
credentials (intervals.icu API key, Telegram bot token, Telegram chat
ID) wonen in `PropertiesService.getDocumentProperties()`:

- **Per-document opslag** — alleen leesbaar voor scripts die aan deze
  specifieke Sheet hangen. Niet zichtbaar in de Sheet zelf en niet
  voor users die de Sheet via Drive openen zonder editor-rechten.
- **Niet in git** — er staat geen geheim in `src/`. De Setup-menu
  prompts schrijven direct naar PropertiesService.
- **Migratie van oude vorm** — als je een Sheet upgrade vanuit een
  pre-refactor versie waarbij de API key nog in B24 stond: de eerste
  keer dat een API-call de key nodig heeft, wordt B24 leeggemaakt en
  de waarde naar PropertiesService verplaatst. Daarna toont B24
  alleen nog de instructie-tekst.
- **Roteren** — bij vermoedelijke blootstelling: genereer een nieuwe
  key via intervals.icu Developer Settings, plak via
  `🐩 Coach > 🔐 Setup > Set intervals.icu API key`.

**Oudere commits** in deze repo kunnen referenties naar
oude/geroteerde keys bevatten in code-paden die destijds keys uit
cellen lazen (de keys zelf zijn nooit in code gepland — alleen
property-namen). Eventuele keys uit historische Sheets die in
private clones bestonden zijn inmiddels geroteerd. Veilig om de
repo public te maken.

### .gitignore
`.env`, `.env.*`, `*.local`, `secrets.json` en `credentials.json` zijn
genegeerd zodat lokaal-gegenereerde keys niet per ongeluk gecommit
worden.

## Telegram bot setup

De bot stuurt later in de week voorstellen en vraagt feedback na ritten.
Eerste keer instellen:

a. **Maak een bot bij @BotFather** in Telegram, kopieer het token.
b. **Vind je eigen chat-ID** — stuur een bericht naar @userinfobot of
   @RawDataBot in Telegram, die geeft je `id`.
c. Sheet > `🚴 Coach > 🔐 Setup > Set Telegram bot token` → plak token.
d. Sheet > `🚴 Coach > 🔐 Setup > Set Telegram chat ID` → plak chat-ID.
e. Sheet > `🚴 Coach > 🔐 Setup > Test bot connectie (getMe)` → moet
   alert met bot username tonen. Bevestigt dat het token klopt.
f. **Deploy als Web App**: Sheet > Extensions > Apps Script > rechts­
   boven knop `Deploy > New deployment` > type `Web app`.
   - Execute as: **Me**
   - Who has access: **Anyone**

   Klik Deploy, kopieer de Web app URL (eindigt op `/exec`).
g. Sheet > `🚴 Coach > 🔐 Setup > Set Apps Script Deploy URL` → plak URL.
h. Sheet > `🚴 Coach > 🔐 Setup > Test send message naar mij` → krijg
   testbericht in Telegram. Bevestigt end-to-end.
i. Sheet > `🚴 Coach > 🔐 Setup > Registreer webhook bij Telegram` →
   alert toont `ok: true`. Telegram POST't vanaf nu updates naar de
   deploy-URL.
j. **Test in Telegram**: stuur `/start` aan de bot → bot antwoordt
   met welkomstbericht.
k. `/help` → krijg lijst van commands.
l. Random tekst (bv. `abc`) → krijg `Onbekend commando. Stuur /help.`

### Bij code-updates aan TelegramBot.gs

Apps Script Editor > Deploy > Manage deployments > edit current
deployment > New version > Deploy. URL blijft hetzelfde → géén
opnieuw-registreren bij Telegram nodig.

### Webhook-secret

doPost valideert een per-document UUID-secret die als `?s=<secret>`
query-param in de webhook-URL meegaat. Wordt automatisch gegenereerd
bij eerste `getWebhookSecret_()`-aanroep en blijft in PropertiesService.
Wis hem via `🔐 Setup > Wis alle secrets` als je 'm wil roteren —
daarna webhook opnieuw registreren.

## Development

- `clasp push`    → wijzigingen naar Apps Script sturen
- `clasp open`    → de Sheet in browser openen
- `clasp pull`    → wijzigingen uit Apps Script ophalen (als je daar
                    iets in de editor hebt aangepast)
