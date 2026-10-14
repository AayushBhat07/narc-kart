// Records a walkthrough of the app running at localhost:4173 (vite preview).
// Output: recording/<id>.webm plus the time each scene starts. Convert it to
// public/rec.mp4 (see README.md) and check the start times in src/Demo.tsx.
import { chromium } from 'playwright';

const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, recordVideo: { dir: 'recording', size: { width: 1920, height: 1080 } } });
const p = await ctx.newPage();
const t0 = Date.now();
const marks = [];
const mark = (n) => marks.push([n, (Date.now() - t0) / 1000]);
const tab = (label) => p.click(`nav [aria-label="${label}"]`);

await p.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await p.waitForTimeout(4000);

mark('radar');
await p.mouse.move(960, 540); await p.mouse.down();
for (let i = 0; i < 20; i++) { await p.mouse.move(960 - i * 14, 540 + i * 3); await p.waitForTimeout(30); }
await p.mouse.up(); await p.waitForTimeout(2500);

mark('casefile');
await p.locator('[role=marquee] button').nth(2).dispatchEvent('click');
await p.waitForTimeout(5500);

mark('dossier');
await p.getByText('OPEN DRUG DOSSIER').click();
await p.waitForTimeout(3000);
await p.mouse.move(960, 600); await p.mouse.wheel(0, 500); await p.waitForTimeout(2000);
await p.keyboard.press('Escape'); await p.waitForTimeout(400);
await p.keyboard.press('Escape'); await p.waitForTimeout(800);

for (const t of ['INTEL', 'BUSTS', 'TRENDING', 'AGENCY', 'COMPARE', 'FESTIVAL']) {
  mark(t.toLowerCase()); await tab(t); await p.waitForTimeout(4500);
}

mark('terminal'); await tab('TERMINAL'); await p.waitForTimeout(1200);
const inp = p.locator('aside input').first(); await inp.click();
await inp.pressSequentially('stats', { delay: 110 }); await p.keyboard.press('Enter'); await p.waitForTimeout(1500);
await inp.pressSequentially('top 5', { delay: 110 }); await p.keyboard.press('Enter'); await p.waitForTimeout(2500);

mark('filters'); await tab('RADAR'); await p.waitForTimeout(800);
await tab('Filters'); await p.waitForTimeout(1500);
await p.getByRole('button', { name: 'HEROIN', exact: true }).click(); await p.waitForTimeout(800);
await p.getByText('[EXECUTE]').click().catch(() => {}); await p.waitForTimeout(3500);
mark('end');

const path = await p.video().path();
await ctx.close(); await b.close();
console.log(JSON.stringify({ path, marks }));
