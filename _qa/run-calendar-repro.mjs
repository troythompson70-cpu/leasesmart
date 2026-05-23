import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import { mkdirSync } from 'fs';

const outDir = new URL('./screenshots/', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
mkdirSync(outDir, { recursive: true });

const reproUrl = pathToFileURL(new URL('./calendar-bug-repro.html', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')).href;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 800 } });

await page.goto(reproUrl);
await page.screenshot({ path: outDir + '01-before-date-select.png', fullPage: true });

await page.fill('#qCalendar', '2026-06-15');
await page.dispatchEvent('#qCalendar', 'change');
await page.waitForTimeout(300);

await page.screenshot({ path: outDir + '02-after-date-auto-advance.png', fullPage: true });

const logText = await page.locator('#log').innerText();
const stepText = await page.locator('#stepLabel').innerText();
const bugReproduced = logText.includes('AUTO-ADVANCED') && stepText.includes('BUG: Jumped');

console.log(JSON.stringify({
  bugReproduced,
  stepAfterSelect: stepText,
  log: logText,
  screenshots: [
    outDir + '01-before-date-select.png',
    outDir + '02-after-date-auto-advance.png'
  ]
}, null, 2));

await browser.close();
