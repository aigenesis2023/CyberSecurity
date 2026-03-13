/**
 * M2 Sticky Toggle Test — Mobile only
 * Tests the AI Report / Meeting Notes toggle in various scroll states.
 *
 * Run:  node screenshot-m2-sticky.js
 */

const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const fs   = require('fs');

const BASE_URL = 'file:///home/user/CyberSecurity/index.html?dev=1';
const DIR = path.join(__dirname, 'screenshots', 'm2-sticky-test');
const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function dismissInsightHelper(page) {
  const visible = await page.evaluate(() => {
    const o = document.getElementById('insightOverlay');
    return o && o.classList.contains('show');
  });
  if (visible) {
    await page.evaluate(() => dismissInsight());
    await wait(400);
  }
}

async function run() {
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
  let idx = 0;

  const browser = await chromium.launch({
    headless: true,
    executablePath: '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-setuid-sandbox',
           '--disable-gpu', '--allow-file-access-from-files', '--disable-web-security'],
  });

  // iPhone-sized viewport
  const ctx = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();

  await page.route('**/*.{mp3,ogg,wav}', r => r.abort());
  await page.route('https://fonts.googleapis.com/**', r => r.abort());
  await page.route('https://fonts.gstatic.com/**', r => r.abort());

  async function shot(name) {
    idx++;
    const filename = `${String(idx).padStart(2, '0')}-${name}.png`;
    await page.screenshot({ path: path.join(DIR, filename), fullPage: false });
    console.log(`  📸 ${filename}`);
    return filename;
  }

  console.log('\n📸 M2 Sticky Toggle Test (iPhone 393×852)\n');

  // ─── BOOT & SKIP TO M2 ──────────────────
  await page.goto(BASE_URL, { waitUntil: 'commit', timeout: 15000 });
  await wait(800);
  await page.waitForFunction(() => !document.querySelector('.splash-btn')?.disabled, { timeout: 20000 });
  await wait(200);
  await page.click('.splash-btn');

  await page.waitForFunction(() => {
    const o = document.getElementById('objOverlay');
    return o && o.classList.contains('show');
  }, { timeout: 25000 });
  await wait(800);
  await page.evaluate(() => dismissObjectives());
  await page.waitForSelector('#screenMenu.active', { timeout: 8000 });
  await wait(700);

  // Launch M2 directly (dev=1 unlocked all)
  await page.evaluate(() => tryLaunch(2));
  await wait(500);
  await page.evaluate(() => s2Start());
  await wait(1000);

  // ─── TEST STATES ──────────────────────────

  // 1. Initial state — AI Report view, at top
  await shot('report-top');

  // 2. Scroll down in report view
  await page.evaluate(() => document.body.scrollTop = 300);
  await wait(400);
  await shot('report-scrolled-300');

  // 3. Scroll further down
  await page.evaluate(() => document.body.scrollTop = 600);
  await wait(400);
  await shot('report-scrolled-600');

  // 4. Switch to Meeting Notes while scrolled
  await page.evaluate(() => s2SwitchView('notes'));
  await wait(600);
  await shot('notes-top');

  // 5. Scroll down in notes view
  await page.evaluate(() => document.body.scrollTop = 300);
  await wait(400);
  await shot('notes-scrolled-300');

  // 6. Scroll further in notes
  await page.evaluate(() => document.body.scrollTop = 600);
  await wait(400);
  await shot('notes-scrolled-600');

  // 7. Switch back to report while scrolled in notes
  await page.evaluate(() => s2SwitchView('report'));
  await wait(600);
  await shot('report-after-notes-switch');

  // 8. Scroll down again in report
  await page.evaluate(() => document.body.scrollTop = 400);
  await wait(400);
  await shot('report-scrolled-400-again');

  // 9. Switch to notes, scroll, switch back, scroll up
  await page.evaluate(() => s2SwitchView('notes'));
  await wait(400);
  await page.evaluate(() => document.body.scrollTop = 500);
  await wait(400);
  await shot('notes-scrolled-500');

  await page.evaluate(() => s2SwitchView('report'));
  await wait(400);
  await page.evaluate(() => document.body.scrollTop = 0);
  await wait(400);
  await shot('report-back-at-top');

  // 10. Flag some tokens then check toggle still works
  await page.evaluate(() => {
    S2_TOKENS.filter(t => t.isHal).forEach(t => {
      if (!s2state.tokState[t.id].flagged) { s2state.activeToken = t.id; s2Classify('flag'); }
    });
  });
  await wait(500);
  await dismissInsightHelper(page);
  await wait(300);
  await shot('report-with-flags');

  // 11. Scroll with flags
  await page.evaluate(() => document.body.scrollTop = 400);
  await wait(400);
  await shot('report-flags-scrolled');

  // 12. Switch to notes after flagging
  await page.evaluate(() => s2SwitchView('notes'));
  await wait(600);
  await shot('notes-after-flagging');

  // 13. Scroll in notes after flagging
  await page.evaluate(() => document.body.scrollTop = 400);
  await wait(400);
  await shot('notes-after-flagging-scrolled');

  await browser.close();
  console.log(`\n✅ ${idx} screenshots captured in screenshots/m2-sticky-test/\n`);
}

run().catch(err => {
  console.error('\n❌ Test failed:', err.message, err.stack);
  process.exit(1);
});
