// Capture the staged screenshots listed in shots.json from a running `node serve.ts --port 8218`.
// Usage: node tools/capture-shots.mjs <playwright module path> <output dir> [only-name]
import { readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';

const [pwPath, outDir, only] = process.argv.slice(2);
const require = createRequire(import.meta.url);
const { chromium } = require(pwPath);
const shots = JSON.parse(readFileSync(new URL('../shots.json', import.meta.url), 'utf8'));
const browser = await chromium.launch({
  executablePath: '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 480 } });
page.on('pageerror', (e) => console.log('pageerror', e.message));
for (const s of shots) {
  if (only && !s.name.includes(only)) continue;
  await page.goto(`http://localhost:8218/${s.query}`, { waitUntil: 'commit', timeout: 300000 });
  await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 600000 });
  const out = `${outDir}/${s.name}`;
  let q = 88;
  do {
    await page.screenshot({ path: out, type: 'jpeg', quality: q, timeout: 300000 });
    q -= 6;
  } while (statSync(out).size > 250 * 1024 && q > 40);
  console.log(s.name, statSync(out).size, 'q', q + 6);
}
await browser.close();
