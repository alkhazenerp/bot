// node render.js <out.png> [only]
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const path = require('path');
(async () => {
  const [out, only] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 3600, height: 2800 } });
  const url = 'file://' + path.resolve(__dirname, 'gallery.html') + (only ? `?only=${only}` : '');
  page.on('console', m => console.log('console:', m.text()));
  page.on('pageerror', e => console.log('error:', e.message));
  await page.goto(url);
  await page.waitForFunction(() => document.title === 'done', null, { timeout: 20000 });
  const el = await page.$('#c');
  await el.screenshot({ path: out, omitBackground: true });
  await browser.close();
})();
