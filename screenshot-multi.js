/**
 * AI Data Guardian — Multi-Viewport Screenshot Audit
 * Captures every distinct screen at 4 viewports for responsive design audit.
 *
 * Run:  node screenshot-multi.js
 */

const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const fs   = require('fs');

const BASE_URL = 'file:///home/user/CyberSecurity/index.html';

const VIEWPORTS = [
  { name: 'desktop',  width: 1440, height: 900 },
  { name: 'ipad',     width: 1024, height: 1366 },
  { name: 'samsung',  width: 360,  height: 800 },
  { name: 'iphone',   width: 393,  height: 852 },
];

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

async function runViewport(browser, vp) {
  const dir = path.join(__dirname, 'screenshots', vp.name);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  let idx = 0;

  async function shot(page, name) {
    idx++;
    const filename = `${String(idx).padStart(2, '0')}-${name}.png`;
    await page.screenshot({ path: path.join(dir, filename), fullPage: false, timeout: 8000 });
    return filename;
  }

  console.log(`\n════════ ${vp.name.toUpperCase()} (${vp.width}×${vp.height}) ════════`);

  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.width <= 500 ? 2 : 1,
    isMobile: vp.width <= 500,
    hasTouch: vp.width <= 500,
  });
  const page = await ctx.newPage();

  // Block external resources
  await page.route('**/*.mp3', r => r.abort());
  await page.route('**/*.ogg', r => r.abort());
  await page.route('**/*.wav', r => r.abort());
  await page.route('https://fonts.googleapis.com/**', r => r.abort());
  await page.route('https://fonts.gstatic.com/**', r => r.abort());

  // ─── SPLASH ──────────────────────────────────────
  await page.goto(BASE_URL, { waitUntil: 'commit', timeout: 15000 });
  await wait(800);
  await page.evaluate(() => document.fonts.ready);
  await wait(400);
  await shot(page, 'splash-loading');

  await page.waitForFunction(() => {
    const btn = document.querySelector('.splash-btn');
    return btn && !btn.disabled;
  }, { timeout: 20000 });
  await wait(200);
  await shot(page, 'splash-ready');

  // ─── BOOT → OBJECTIVES → MISSION SELECT ─────────
  await page.click('.splash-btn');

  // Wait for boot to finish and objectives overlay to appear
  await page.waitForFunction(() => {
    const o = document.getElementById('objOverlay');
    return o && o.classList.contains('show');
  }, { timeout: 25000 });
  await wait(800);
  await shot(page, 'objectives-interstitial');

  // Dismiss objectives → menu appears
  await page.evaluate(() => dismissObjectives());
  await page.waitForSelector('#screenMenu.active', { timeout: 8000 });
  await wait(700);
  await shot(page, 'mission-select');

  // ─── MISSION 1 ───────────────────────────────────
  console.log(`  [${vp.name}] M1...`);
  await page.evaluate(() => tryLaunch(1));
  await wait(500);
  await shot(page, 'm1-briefing');

  await page.evaluate(() => s1Start());
  await wait(700);
  await shot(page, 'm1-gameplay');

  // Open attachment
  await page.evaluate(() => s1ToggleAttach());
  await wait(400);
  await shot(page, 'm1-attachment-open');
  await page.evaluate(() => s1ToggleAttach());
  await wait(200);

  // Token popup
  await page.evaluate(() => {
    s1state.activeToken = 'name';
    const popup = document.getElementById('s1catPopup');
    popup.classList.add('show');
    popup.style.top = '50%'; popup.style.left = '50%';
    popup.style.transform = 'translate(-50%,-50%)';
  });
  await wait(300);
  await shot(page, 'm1-token-popup');

  // Misclassify → insight
  await page.evaluate(() => s1Classify('credential'));
  await wait(500);
  await shot(page, 'm1-insight-wrong');
  await dismissInsightHelper(page);

  // Classify all correctly
  await page.evaluate(() => {
    ['name','email','project'].forEach(id => { s1state.activeToken = id; s1Classify(S1_TOKENS[id].cat); });
  });
  await wait(300);
  await page.evaluate(() => s1ToggleAttach());
  await wait(200);
  await page.evaluate(() => {
    ['password','apikey'].forEach(id => { s1state.activeToken = id; s1Classify(S1_TOKENS[id].cat); });
  });
  await wait(500);
  await shot(page, 'm1-all-secured');

  // Submit
  await page.evaluate(() => s1EndGame('submit'));
  await wait(900);
  await shot(page, 'm1-verdict-pass');
  await page.evaluate(() => document.querySelector('#s1verdict .verdict-card')?.scrollTo(0, 9999));
  await wait(200);
  await shot(page, 'm1-verdict-scrolled');

  // ─── MISSION 2 ───────────────────────────────────
  console.log(`  [${vp.name}] M2...`);
  await page.evaluate(() => goMenu());
  await wait(500);
  await shot(page, 'mission-select-m1-done');

  await page.evaluate(() => tryLaunch(2));
  await wait(500);
  await shot(page, 'm2-briefing');

  await page.evaluate(() => s2Start());
  await wait(700);
  await shot(page, 'm2-gameplay');

  // Show popup on a hallucination token
  await page.evaluate(() => {
    s2state.activeToken = 'fig1';
    const popup = document.getElementById('s2halPopup');
    popup.classList.add('show');
    popup.style.top = '50%'; popup.style.left = '50%';
    popup.style.transform = 'translate(-50%,-50%)';
  });
  await wait(300);
  await shot(page, 'm2-popup');

  // False alarm — flag an accurate token as hallucination → insight error
  await page.evaluate(() => { s2state.activeToken = 'acc1'; s2Classify('flag'); });
  await wait(500);
  await shot(page, 'm2-insight-wrong');
  await dismissInsightHelper(page);

  // Correctly flag all hallucinations
  await page.evaluate(() => {
    S2_TOKENS.filter(t => t.isHal).forEach(t => {
      if (!s2state.tokState[t.id].flagged) { s2state.activeToken = t.id; s2Classify('flag'); }
    });
  });
  await wait(400);
  // Mark remaining accurate tokens
  await page.evaluate(() => {
    S2_TOKENS.filter(t => !t.isHal).forEach(t => {
      if (!s2state.tokState[t.id].flagged) { s2state.activeToken = t.id; s2Classify('accurate'); }
    });
  });
  await wait(400);
  await dismissInsightHelper(page);
  await wait(300);
  await shot(page, 'm2-all-flagged');

  // Submit
  await page.evaluate(() => s2Submit());
  await wait(900);
  await shot(page, 'm2-verdict-pass');
  await page.evaluate(() => document.querySelector('#s2verdict .verdict-card')?.scrollTo(0, 9999));
  await wait(200);
  await shot(page, 'm2-verdict-scrolled');

  // ─── MISSION 3 ───────────────────────────────────
  console.log(`  [${vp.name}] M3...`);
  await page.evaluate(() => goMenu());
  await wait(500);
  await page.evaluate(() => { courseProgress.s2done = true; saveProgress(); updateMenuState(); });
  await wait(200);
  await shot(page, 'mission-select-m2-done');

  await page.evaluate(() => tryLaunch(3));
  await wait(500);
  await shot(page, 'm3-briefing');

  await page.evaluate(() => s3Start());
  await wait(700);
  await shot(page, 'm3-level1');

  // Flag injection correctly
  await page.evaluate(() => { s3state.activeToken = 'inj1'; s3Flag(true); });
  await wait(500);
  await shot(page, 'm3-insight-found-l1');
  await dismissInsightHelper(page);
  await wait(600);

  // Level 2 (FP)
  await shot(page, 'm3-level2-fp');
  await page.evaluate(() => { s3state.activeToken = 'fp1'; s3Flag(false); });
  await wait(700);

  // Level 3 (injection)
  await shot(page, 'm3-level3');
  await page.evaluate(() => { s3state.activeToken = 'inj2'; s3Flag(true); });
  await wait(500);
  await shot(page, 'm3-insight-found-l3');
  await dismissInsightHelper(page);
  await wait(600);

  // Level 4 (FP)
  await shot(page, 'm3-level4-fp');
  await page.evaluate(() => { s3state.activeToken = 'fp2'; s3Flag(false); });
  await wait(600);

  // Level 5 (injection)
  await shot(page, 'm3-level5');
  await page.evaluate(() => { s3state.activeToken = 'inj3'; s3Flag(true); });
  await wait(500);
  await dismissInsightHelper(page);
  await wait(600);

  // Level 6 (FP)
  await shot(page, 'm3-level6-fp');
  await page.evaluate(() => { s3state.activeToken = 'fp3'; s3Flag(false); });
  await wait(900);

  // Verdict
  await shot(page, 'm3-verdict-pass');
  await page.evaluate(() => document.querySelector('#s3verdict .verdict-card')?.scrollTo(0, 9999));
  await wait(200);
  await shot(page, 'm3-verdict-scrolled');

  // ─── CERTIFICATE ─────────────────────────────────
  console.log(`  [${vp.name}] Certificate...`);
  await page.evaluate(() => goMenu());
  await wait(800);
  const certVisible = await page.evaluate(() =>
    document.getElementById('certOverlay')?.classList.contains('show')
  );
  if (certVisible) {
    await shot(page, 'certificate');
    await page.evaluate(() => closeCert());
    await wait(400);
  } else {
    await page.evaluate(() => showCertificate());
    await wait(400);
    await shot(page, 'certificate');
    await page.evaluate(() => closeCert());
    await wait(400);
  }
  await shot(page, 'mission-select-all-complete');

  // ─── PAUSE OVERLAY ───────────────────────────────
  await page.evaluate(() => { showScreen('screenS1'); s1Init(); s1Start(); });
  await wait(400);
  await page.evaluate(() => togglePause());
  await wait(300);
  await shot(page, 'pause-overlay');
  await page.evaluate(() => togglePause());
  await wait(200);

  await ctx.close();
  console.log(`  ✅ ${vp.name}: ${idx} screenshots`);
}

async function main() {
  console.log('\n📸 AI Data Guardian — Multi-Viewport Audit\n');

  const browser = await chromium.launch({
    headless: true,
    executablePath: '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome',
    args: [
      '--no-sandbox', '--disable-dev-shm-usage', '--disable-setuid-sandbox',
      '--disable-gpu', '--allow-file-access-from-files', '--disable-web-security',
    ],
  });

  for (const vp of VIEWPORTS) {
    await runViewport(browser, vp);
  }

  await browser.close();
  console.log('\n✅ All viewports captured.\n');
}

main().catch(err => {
  console.error('\n❌ Multi-viewport script failed:', err.message, err.stack);
  process.exit(1);
});
