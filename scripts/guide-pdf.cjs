// Render docs/guide/guide.html to docs/guide/Fuga-User-Guide.pdf with
// Electron's own Chromium — no extra dependencies.
//   npm run guide
const { app, BrowserWindow } = require('electron');
const { join } = require('node:path');
const { writeFileSync } = require('node:fs');

const source = join(__dirname, '../docs/guide/guide.html');
const target = join(__dirname, '../docs/guide/Fuga-User-Guide.pdf');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1123, height: 794, webPreferences: { sandbox: true, spellcheck: false } });
  await win.loadFile(source);
  // Wait for fonts and every image, or the PDF captures fallbacks.
  await win.webContents.executeJavaScript(`
    Promise.all([document.fonts.ready, ...[...document.images].map((i) =>
      i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))]).then(() => true)`);
  const pdf = await win.webContents.printToPDF({
    preferCSSPageSize: true,
    printBackground: true,
    margins: { marginType: 'none' },
    generateDocumentOutline: true,
  });
  writeFileSync(target, pdf);
  console.log(`wrote ${target} (${Math.round(pdf.length / 1024)} KB)`);
  app.quit();
});
