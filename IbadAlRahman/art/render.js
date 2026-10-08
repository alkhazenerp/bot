// Usage: node render.js <input.svg> <output.png> <sizePx> [maskShape: none|circle|squircle]
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
(async () => {
  const [input, output, sizeArg, mask = 'none'] = process.argv.slice(2);
  const size = parseInt(sizeArg, 10);
  const svg = fs.readFileSync(input, 'utf8');
  const radius = mask === 'circle' ? '50%' : mask === 'squircle' ? '22%' : '0';
  const html = `<!doctype html><html><body style="margin:0;background:transparent">
    <div style="width:${size}px;height:${size}px;border-radius:${radius};overflow:hidden">
      ${svg.replace('<svg ', `<svg style="width:${size}px;height:${size}px;display:block" `)}
    </div></body></html>`;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(html);
  await page.screenshot({ path: output, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  await browser.close();
})();
