/**
 * Focused script to capture verdict/debrief screens at mobile viewport.
 */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const fs   = require('fs');

const BASE_URL  = 'file:///home/user/CyberSecurity/index.html';
const SHOTS_DIR = path.join(__dirname, 'screenshots', 'verdicts-mobile');
if (!fs.existsSync(SHOTS_DIR)) fs.mkdirSync(SHOTS_DIR, { recursive: true });

let idx = 0;
async function shot(page, name) {
  idx++;
  const filename = `${String(idx).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: path.join(SHOTS_DIR, filename), fullPage: false, timeout: 8000 });
  console.log(`  ✓ ${filename}`);
}
const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('\n📸 Verdict/Debrief — Mobile Audit\n');

  const browser = await chromium.launch({
    headless: true,
    executablePath: '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--disable-dev-shm-usage','--disable-setuid-sandbox',
           '--disable-gpu','--allow-file-access-from-files','--disable-web-security'],
  });

  const ctx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();

  await page.route('**/*.mp3', r => r.abort());
  await page.route('**/*.ogg', r => r.abort());
  await page.route('**/*.wav', r => r.abort());
  await page.route('https://fonts.googleapis.com/**', r => r.abort());
  await page.route('https://fonts.gstatic.com/**', r => r.abort());

  // Load page
  await page.goto(BASE_URL, { waitUntil: 'commit', timeout: 15000 });
  await wait(800);
  await page.evaluate(() => document.fonts.ready);
  await wait(400);

  // Wait for Begin button
  await page.waitForFunction(() => {
    const btn = document.querySelector('.splash-btn');
    return btn && !btn.disabled;
  }, { timeout: 20000 });

  // Enter name and click Begin
  await page.fill('.splash-name-input', 'Test User');
  await wait(200);
  await page.click('.splash-btn');
  await wait(2000);

  // Dismiss objectives if showing
  await page.evaluate(() => {
    const o = document.getElementById('objOverlay');
    if (o && o.classList.contains('show')) dismissObjectives();
  });
  await wait(500);

  // Should be on menu now
  await shot(page, 'menu');

  // ─── M1 VERDICT (PASS) ──────────────────────
  console.log('\n── M1 Verdict ──');
  await page.evaluate(() => tryLaunch(1));
  await wait(500);
  await page.evaluate(() => s1Start());
  await wait(500);

  // Classify all tokens correctly
  await page.evaluate(() => {
    Object.keys(S1_TOKENS).forEach(id => {
      s1state.activeToken = id;
      s1Classify(S1_TOKENS[id].cat);
    });
  });
  await wait(300);

  // Dismiss any insight
  await page.evaluate(() => {
    const o = document.getElementById('insightOverlay');
    if (o && o.classList.contains('show')) dismissInsight();
  });
  await wait(300);

  await page.evaluate(() => s1EndGame('submit'));
  await wait(1200);
  await shot(page, 'm1-verdict-pass-top');

  // Scroll verdict card down
  await page.evaluate(() => document.querySelector('#s1verdict .verdict-card')?.scrollTo(0, 9999));
  await wait(300);
  await shot(page, 'm1-verdict-pass-scrolled');

  // Step 2
  await page.evaluate(() => {
    const el = document.getElementById('s1vStep1');
    if (el) { const btn = el.querySelector('.v-next-btn'); if (btn) btn.click(); }
  });
  await wait(800);
  await shot(page, 'm1-verdict-step2-top');
  await page.evaluate(() => document.querySelector('#s1verdict .verdict-card')?.scrollTo(0, 9999));
  await wait(300);
  await shot(page, 'm1-verdict-step2-scrolled');

  // ─── M2 VERDICT (PASS) ──────────────────────
  console.log('\n── M2 Verdict ──');
  await page.evaluate(() => goMenu());
  await wait(500);
  await page.evaluate(() => tryLaunch(2));
  await wait(500);
  await page.evaluate(() => s2Start());
  await wait(500);

  // Flag all hallucinations correctly
  await page.evaluate(() => {
    S2_TOKENS.filter(t => t.isHal).forEach(t => {
      s2state.activeToken = t.id;
      s2Classify(s2state.tokState[t.id].cat || 'flag');
    });
  });
  await wait(300);
  await page.evaluate(() => {
    const o = document.getElementById('insightOverlay');
    if (o && o.classList.contains('show')) dismissInsight();
  });
  await wait(300);

  // Mark accurate tokens
  await page.evaluate(() => {
    S2_TOKENS.filter(t => !t.isHal).forEach(t => {
      if (!s2state.tokState[t.id].flagged) {
        s2state.activeToken = t.id;
        s2Classify('accurate');
      }
    });
  });
  await wait(300);
  await page.evaluate(() => {
    const o = document.getElementById('insightOverlay');
    if (o && o.classList.contains('show')) dismissInsight();
  });
  await wait(300);

  await page.evaluate(() => s2Submit());
  await wait(1200);
  await shot(page, 'm2-verdict-pass-top');
  await page.evaluate(() => document.querySelector('#s2verdict .verdict-card')?.scrollTo(0, 9999));
  await wait(300);
  await shot(page, 'm2-verdict-pass-scrolled');

  // Step 2
  await page.evaluate(() => {
    const el = document.getElementById('s2vStep1');
    if (el) { const btn = el.querySelector('.v-next-btn'); if (btn) btn.click(); }
  });
  await wait(800);
  await shot(page, 'm2-verdict-step2-top');
  await page.evaluate(() => document.querySelector('#s2verdict .verdict-card')?.scrollTo(0, 9999));
  await wait(300);
  await shot(page, 'm2-verdict-step2-scrolled');

  // ─── M3 VERDICT (PASS) ──────────────────────
  console.log('\n── M3 Verdict ──');
  await page.evaluate(() => goMenu());
  await wait(500);
  await page.evaluate(() => { courseProgress.s2done = true; saveProgress(); updateMenuState(); });
  await wait(200);
  await page.evaluate(() => tryLaunch(3));
  await wait(500);
  await page.evaluate(() => s3Start());
  await wait(500);

  // Play through all 6 levels
  // L1 injection
  await page.evaluate(() => { s3state.activeToken = 'inj1'; s3Flag(true); });
  await wait(400);
  await page.evaluate(() => { const o = document.getElementById('insightOverlay'); if (o && o.classList.contains('show')) dismissInsight(); });
  await wait(600);
  // L2 FP
  await page.evaluate(() => { s3state.activeToken = 'fp1'; s3Flag(false); });
  await wait(600);
  // L3 injection
  await page.evaluate(() => { s3state.activeToken = 'inj2'; s3Flag(true); });
  await wait(400);
  await page.evaluate(() => { const o = document.getElementById('insightOverlay'); if (o && o.classList.contains('show')) dismissInsight(); });
  await wait(600);
  // L4 FP
  await page.evaluate(() => { s3state.activeToken = 'fp2'; s3Flag(false); });
  await wait(600);
  // L5 injection
  await page.evaluate(() => { s3state.activeToken = 'inj3'; s3Flag(true); });
  await wait(400);
  await page.evaluate(() => { const o = document.getElementById('insightOverlay'); if (o && o.classList.contains('show')) dismissInsight(); });
  await wait(600);
  // L6 FP
  await page.evaluate(() => { s3state.activeToken = 'fp3'; s3Flag(false); });
  await wait(1200);

  await shot(page, 'm3-verdict-pass-top');
  await page.evaluate(() => document.querySelector('#s3verdict .verdict-card')?.scrollTo(0, 9999));
  await wait(300);
  await shot(page, 'm3-verdict-pass-scrolled');

  // Step 2
  await page.evaluate(() => {
    const el = document.getElementById('s3vStep1');
    if (el) { const btn = el.querySelector('.v-next-btn'); if (btn) btn.click(); }
  });
  await wait(800);
  await shot(page, 'm3-verdict-step2-top');
  await page.evaluate(() => document.querySelector('#s3verdict .verdict-card')?.scrollTo(0, 9999));
  await wait(300);
  await shot(page, 'm3-verdict-step2-scrolled');

  await browser.close();
  const files = fs.readdirSync(SHOTS_DIR).filter(f => f.endsWith('.png')).sort();
  console.log(`\n✅ ${files.length} screenshots saved to screenshots/verdicts-mobile/\n`);
}

main().catch(err => {
  console.error('\n❌ Failed:', err.message);
  process.exit(1);
});
