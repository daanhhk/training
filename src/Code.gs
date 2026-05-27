/**
 * Code.gs — Entry point.
 *
 * Bevat de onOpen-trigger die het "🚴 Coach" menu toevoegt aan de Sheet
 * en de top-level buildAll() functie die alle tabs (her)opbouwt.
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🚴 Coach')
    .addItem('Bouw alles opnieuw', 'buildAll')
    .addToUi();
}

function buildAll() {
  SpreadsheetApp.getUi().alert('Stub — implementatie komt in volgende stap.');
}
