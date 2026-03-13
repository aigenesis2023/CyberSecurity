/**
 * screenshot-back-buttons.cjs
 * Captures back-button visibility on mobile (390px) and desktop (1280px)
 * for each mission's briefing screen (← MENU) and in-game abort button.
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME = '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome';
const FILE_URL = 'file://' + path.resolve(__dirname, 'index.html');
const OUT = path.join(__dirname, 'screenshots', 'back-buttons');

const VIEWPORTS = {
  mobile:  { width: 390,  height: 844 },
  desktop: { width: 1280, height: 800 },
};

const MISSIONS = [1, 2, 3];

fs.mkdirSync(OUT, { recursive: true });

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--disable-setuid-sandbox'],
  });

  for (const [label, vp] of Object.entries(VIEWPORTS)) {
    const page = await browser.newPage();
    await page.setViewport(vp);
    await page.goto(FILE_URL, { waitUntil: 'networkidle0', timeout: 30000 });

    // Wait for splash button to be enabled
    await page.waitForFunction(() => {
      const btn = document.getElementById('splashBtn');
      return btn && !btn.disabled;
    }, { timeout: 20000 });

    // Enter name and click ENTER
    await page.type('#splashNameInput', 'Test Player');
    await page.click('#splashBtn');

    // Wait for boot to finish and objectives overlay to appear
    await page.waitForFunction(() => {
      const obj = document.getElementById('objOverlay');
      return obj && obj.classList.contains('show');
    }, { timeout: 20000 });
    await delay(800);

    // Dismiss objectives → shows menu
    await page.evaluate(() => dismissObjectives());
    await delay(800);

    // Verify menu is active
    await page.waitForFunction(() => {
      const m = document.getElementById('screenMenu');
      return m && m.classList.contains('active');
    }, { timeout: 10000 });

    for (const m of MISSIONS) {
      console.log(`\n--- ${label} M${m} ---`);

      // --- BRIEFING BACK BUTTON ---
      await page.evaluate((n) => launchSection(n), m);
      await delay(1000);

      // Screenshot: briefing with ← MENU button
      await page.screenshot({
        path: path.join(OUT, `${label}-m${m}-briefing-back-btn.png`),
        fullPage: false,
      });
      console.log(`✓ ${label} m${m} briefing back button`);

      // --- IN-GAME ABORT BUTTON ---
      // Click the START button within the briefing overlay
      await page.click(`#s${m}briefing .briefing-start-btn`);
      await delay(1200);

      // Screenshot: gameplay with abort (back) button in ctrl pill
      await page.screenshot({
        path: path.join(OUT, `${label}-m${m}-gameplay-abort-btn.png`),
        fullPage: false,
      });
      console.log(`✓ ${label} m${m} gameplay abort button`);

      // Click abort → confirmation overlay
      await page.evaluate(() => showAbortConfirm());
      await delay(500);

      // Screenshot: abort confirmation overlay
      await page.screenshot({
        path: path.join(OUT, `${label}-m${m}-abort-confirm.png`),
        fullPage: false,
      });
      console.log(`✓ ${label} m${m} abort confirmation`);

      // Confirm abort → back to menu
      await page.evaluate(() => confirmAbort());
      await delay(600);
    }

    await page.close();
  }

  await browser.close();
  console.log(`\n✅ Done — screenshots in ${OUT}`);
})();
