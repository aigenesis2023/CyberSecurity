/**
 * AI Data Guardian — Full Visual Audit Screenshot Script
 * Uses Playwright (Chromium) against the local dev server.
 *
 * Run:  node screenshot.js
 *
 * Captures every distinct screen, overlay, popup, mid-game state,
 * verdict (pass + fail) for all three missions, and the certificate.
 */

const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const fs   = require('fs');

const BASE_URL  = 'file:///home/user/CyberSecurity/index.html';
const SHOTS_DIR = path.join(__dirname, 'screenshots');
if (!fs.existsSync(SHOTS_DIR)) fs.mkdirSync(SHOTS_DIR);

let idx = 0;
async function shot(page, name) {
  idx++;
  const filename = `${String(idx).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: path.join(SHOTS_DIR, filename), fullPage: false, timeout: 8000 });
  console.log(`  ✓  ${filename}`);
  return filename;
}

const wait = (ms) => new Promise(r => setTimeout(r, ms));

// Dismiss any open insight panel (calls the JS function directly)
async function dismissInsight(page) {
  const visible = await page.evaluate(() => {
    const o = document.getElementById('insightOverlay');
    return o && o.classList.contains('show');
  });
  if (visible) {
    await page.evaluate(() => dismissInsight());
    await wait(400);
  }
}

async function main() {
  console.log('\n📸  AI Data Guardian — Visual Audit\n');

  const browser = await chromium.launch({
    headless: true,
    executablePath: '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome',
    args: [
      '--no-sandbox', '--disable-dev-shm-usage', '--disable-setuid-sandbox',
      '--disable-gpu', '--allow-file-access-from-files', '--disable-web-security',
    ],
  });

  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  // Silence audio and block external resources (CDN unreachable in sandbox)
  await page.route('**/*.mp3', r => r.abort());
  await page.route('**/*.ogg', r => r.abort());
  await page.route('**/*.wav', r => r.abort());
  await page.route('https://fonts.googleapis.com/**', r => r.abort());
  await page.route('https://fonts.gstatic.com/**', r => r.abort());

  // ─────────────────────────────────────────────────────────────────────────
  // 1. SPLASH SCREENS
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n── Splash ──────────────────────────────');
  await page.goto(BASE_URL, { waitUntil: 'commit', timeout: 15000 });
  await wait(800); // let inline scripts parse and execute
  // Wait for local fonts to be loaded by the browser
  await page.evaluate(() => document.fonts.ready);
  await wait(400);
  await shot(page, 'splash-loading');

  // Wait until Begin button is enabled (loading bar completes)
  await page.waitForFunction(() => {
    const btn = document.querySelector('.splash-btn');
    return btn && !btn.disabled;
  }, { timeout: 20000 });
  await wait(200);
  await shot(page, 'splash-ready');

  // ─────────────────────────────────────────────────────────────────────────
  // 2. MISSION SELECT + LEARNING OBJECTIVES INTERSTITIAL
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n── Mission Select + Objectives ─────────');
  await page.click('.splash-btn');
  await page.waitForSelector('#screenMenu.active', { timeout: 8000 });
  await wait(700);
  // Mission select is visible here (objectives overlay not yet triggered)
  await shot(page, 'mission-select-start');

  // Learning Objectives interstitial appears ~900ms after boot ends (z-index 350)
  // Wait for it, capture it, then dismiss before gameplay can begin
  await page.waitForFunction(() => {
    const o = document.getElementById('objOverlay');
    return o && o.classList.contains('show');
  }, { timeout: 5000 });
  await shot(page, 'objectives-interstitial');
  await page.evaluate(() => dismissObjectives());
  await wait(500);

  // ─────────────────────────────────────────────────────────────────────────
  // 3. MISSION 1 — DATA LEAKAGE
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n── Mission 1 ───────────────────────────');

  // Briefing
  await page.evaluate(() => tryLaunch(1));
  await wait(500);
  await shot(page, 'm1-briefing');

  // Start gameplay
  await page.evaluate(() => s1Start());
  await wait(700);
  await shot(page, 'm1-gameplay-initial');

  // Attachment chip visible with pulse — open it
  await page.evaluate(() => s1ToggleAttach());
  await wait(400);
  await shot(page, 'm1-attachment-open');

  // Close it again so tokens in main message are visible
  await page.evaluate(() => s1ToggleAttach());
  await wait(200);

  // Show token popup — click the name token in the chat bubble
  await page.evaluate(() => {
    s1state.activeToken = 'name';
    const popup = document.getElementById('s1catPopup');
    popup.classList.add('show');
    // Position it roughly mid-screen
    popup.style.top = '340px';
    popup.style.left = '440px';
  });
  await wait(300);
  await shot(page, 'm1-token-popup-open');

  // Misclassify name as CREDENTIAL → near-miss penalty + insight
  await page.evaluate(() => s1Classify('credential'));
  await wait(500);
  await shot(page, 'm1-insight-near-miss');

  // Dismiss insight
  await dismissInsight(page);

  // Now correctly classify all sensitive tokens via JS
  await page.evaluate(() => {
    ['name','email','project'].forEach(id => {
      s1state.activeToken = id;
      s1Classify(S1_TOKENS[id].cat);
    });
  });
  await wait(400);

  // Open attachment and classify credentials
  await page.evaluate(() => s1ToggleAttach());
  await wait(300);
  await page.evaluate(() => {
    ['password','apikey'].forEach(id => {
      s1state.activeToken = id;
      s1Classify(S1_TOKENS[id].cat);
    });
  });
  await wait(500);
  await shot(page, 'm1-all-secured-submit-ready');

  // Show popup on a noise token → mark SAFE → +3% gain
  await page.evaluate(() => {
    s1state.activeToken = 'version';
    const popup = document.getElementById('s1catPopup');
    popup.classList.add('show');
    popup.style.top = '310px';
    popup.style.left = '440px';
  });
  await wait(250);
  await shot(page, 'm1-noise-token-popup');

  await page.evaluate(() => s1Classify('safe'));
  await wait(300);

  // Misclassify a noise token as credential → -5% unnecessary flag feedback
  await page.evaluate(() => {
    s1state.activeToken = 'region';
    const popup = document.getElementById('s1catPopup');
    popup.classList.add('show');
    popup.style.top = '310px'; popup.style.left = '440px';
  });
  await wait(200);
  await page.evaluate(() => s1Classify('credential'));
  await wait(400);
  await shot(page, 'm1-unnecessary-flag-feedback');

  // Submit → Pass verdict
  await page.evaluate(() => s1EndGame('submit'));
  await wait(900);
  await shot(page, 'm1-verdict-pass');

  // Scroll down if anchor is below fold
  await page.evaluate(() => document.querySelector('#s1verdict .verdict-card')?.scrollTo(0, 9999));
  await wait(200);
  await shot(page, 'm1-verdict-pass-scrolled');

  // ─────────────────────────────────────────────────────────────────────────
  // 4. MISSION SELECT — M1 complete, M2 unlocked
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n── Mission Select (after M1) ───────────');
  await page.evaluate(() => goMenu());
  await wait(700);
  await shot(page, 'mission-select-m1-done');

  // ─────────────────────────────────────────────────────────────────────────
  // 5. MISSION 2 — AI HALLUCINATION
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n── Mission 2 ───────────────────────────');

  await page.evaluate(() => tryLaunch(2));
  await wait(500);
  await shot(page, 'm2-briefing');

  await page.evaluate(() => s2Start());
  await wait(700);
  await shot(page, 'm2-gameplay-initial');

  // Show popup on a hallucination token (law1 is in section 1)
  await page.evaluate(() => {
    s2state.activeToken = 'law1';
    const popup = document.getElementById('s2halPopup');
    popup.classList.add('show');
    popup.style.top = '340px'; popup.style.left = '500px';
  });
  await wait(300);
  await shot(page, 'm2-hallucination-popup');

  // Wrong type — classify law as citation → -5% wrong-type penalty + insight
  await page.evaluate(() => s2Classify('citation'));
  await wait(500);
  await shot(page, 'm2-insight-wrong-type');
  await dismissInsight(page);

  // Now correctly classify law1
  await page.evaluate(() => {
    s2state.activeToken = 'law1';
    s2Classify('law');
  });
  await wait(400);
  await shot(page, 'm2-correct-flag-feedback');

  // Show popup on an accurate token → false alarm demo
  await page.evaluate(() => {
    s2state.activeToken = 'acc3';
    const popup = document.getElementById('s2halPopup');
    popup.classList.add('show');
    popup.style.top = '300px'; popup.style.left = '500px';
  });
  await wait(250);
  await shot(page, 'm2-accurate-token-popup');

  // Flag accurate as hallucination → -10% false alarm + insight
  await page.evaluate(() => s2Classify('figure'));
  await wait(500);
  await shot(page, 'm2-insight-false-alarm');
  await dismissInsight(page);

  // Reveal remaining sections via JS
  await page.evaluate(() => { s2RevealSection(1); });
  await wait(300);
  await page.evaluate(() => { s2RevealSection(2); });
  await wait(300);
  await page.evaluate(() => { s2RevealSection(3); });
  await wait(400);
  await shot(page, 'm2-all-sections-revealed');

  // Flag all remaining hallucinations
  await page.evaluate(() => {
    ['cit1','cit2','fig1','fig2','law2'].forEach(id => {
      if (!s2state.tokState[id].flagged) {
        s2state.activeToken = id;
        s2Classify(s2state.tokState[id].cat);
      }
    });
  });
  await wait(500);
  await shot(page, 'm2-all-flagged-submit-ready');

  // Submit → Pass verdict
  await page.evaluate(() => s2Submit());
  await wait(900);
  await shot(page, 'm2-verdict-pass');
  await page.evaluate(() => document.querySelector('#s2verdict .verdict-card')?.scrollTo(0, 9999));
  await wait(200);
  await shot(page, 'm2-verdict-pass-scrolled');

  // ─────────────────────────────────────────────────────────────────────────
  // 6. MISSION SELECT — M2 complete, M3 unlocked
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n── Mission Select (after M2) ───────────');
  await page.evaluate(() => goMenu());
  await wait(700);
  await shot(page, 'mission-select-m2-done');

  // ─────────────────────────────────────────────────────────────────────────
  // 7. MISSION 3 — PROMPT INJECTION
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n── Mission 3 ───────────────────────────');

  // Force M2 marked complete so M3 unlocks (guards against M2 pass-threshold edge cases)
  await page.evaluate(() => {
    courseProgress.s2done = true;
    saveProgress();
    updateMenuState();
  });
  await wait(200);

  await page.evaluate(() => tryLaunch(3));
  await wait(500);
  await shot(page, 'm3-briefing');

  await page.evaluate(() => s3Start());
  await wait(700);
  await shot(page, 'm3-level-1-real-injection');

  // Show injection popup
  await page.evaluate(() => {
    s3state.activeToken = 'inj1';
    const popup = document.getElementById('s3injPopup');
    popup.classList.add('show');
    popup.style.top = '400px'; popup.style.left = '500px';
  });
  await wait(300);
  await shot(page, 'm3-injection-popup');

  // Correctly flag injection → insight with callback to advance
  await page.evaluate(() => s3Flag(true));
  await wait(500);
  await shot(page, 'm3-insight-injection-found-l1');

  // Dismiss → level 2 (false positive, no timer)
  await dismissInsight(page);
  await wait(600);
  await shot(page, 'm3-level-2-false-positive');

  // Show popup on the safe-decoy
  await page.evaluate(() => {
    s3state.activeToken = 'fp1';
    const popup = document.getElementById('s3injPopup');
    popup.classList.add('show');
    popup.style.top = '380px'; popup.style.left = '500px';
  });
  await wait(250);
  await shot(page, 'm3-fp-popup');

  // Wrongly flag as injection → -15% false alarm + insight
  await page.evaluate(() => s3Flag(true));
  await wait(500);
  await shot(page, 'm3-insight-false-alarm');
  await dismissInsight(page);

  // Correctly mark SAFE → level 3
  await page.evaluate(() => {
    s3state.activeToken = 'fp1';
    s3Flag(false);
  });
  await wait(700);
  await shot(page, 'm3-level-3-timed-injection');

  // Insight from false alarm may not have fired; just show level 3 content
  // Flag inj2 correctly on level 3
  await page.evaluate(() => {
    s3state.activeToken = 'inj2';
    s3Flag(true);
  });
  await wait(500);
  await shot(page, 'm3-insight-injection-found-l3');
  await dismissInsight(page);
  await wait(600);

  // Level 4 (false positive, 50s timer) — mark SAFE immediately
  await shot(page, 'm3-level-4-false-positive-timed');
  await page.evaluate(() => {
    s3state.activeToken = 'fp2';
    s3Flag(false);
  });
  await wait(600);

  // Level 5 (real injection, 40s) — flag inj3
  await shot(page, 'm3-level-5-timed-injection');
  await page.evaluate(() => {
    s3state.activeToken = 'inj3';
    s3Flag(true);
  });
  await wait(500);
  await shot(page, 'm3-insight-injection-found-l5');
  await dismissInsight(page);
  await wait(600);

  // Level 6 (false positive, 35s) — mark SAFE
  await shot(page, 'm3-level-6-false-positive-timed');
  await page.evaluate(() => {
    s3state.activeToken = 'fp3';
    s3Flag(false);
  });
  await wait(900);
  await shot(page, 'm3-verdict-pass');
  await page.evaluate(() => document.querySelector('#s3verdict .verdict-card')?.scrollTo(0, 9999));
  await wait(200);
  await shot(page, 'm3-verdict-pass-scrolled');

  // ─────────────────────────────────────────────────────────────────────────
  // 8. CERTIFICATE OVERLAY (all 3 missions complete)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n── Certificate ─────────────────────────');
  await page.evaluate(() => goMenu());
  await wait(800);
  // Certificate appears automatically after all missions are done
  const certVisible = await page.evaluate(() =>
    document.getElementById('certOverlay')?.classList.contains('show')
  );
  if (certVisible) {
    await shot(page, 'certificate-overlay');
    await page.evaluate(() => closeCert());
    await wait(500);
  } else {
    // Trigger manually if auto-show didn't fire
    await page.evaluate(() => showCertificate());
    await wait(400);
    await shot(page, 'certificate-overlay');
    await page.evaluate(() => closeCert());
    await wait(500);
  }

  await shot(page, 'mission-select-all-complete');

  // ─────────────────────────────────────────────────────────────────────────
  // 9. FAIL VERDICTS — all three missions
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n── Fail verdicts ───────────────────────');

  // M1 fail — breach (sensitive data exposed)
  await page.evaluate(() => {
    showScreen('screenS1');
    s1Init();
  });
  await wait(400);
  await page.evaluate(() => s1Start());
  await wait(200);
  await page.evaluate(() => {
    // Partially classify — leave credentials exposed
    s1state.activeToken = 'name';  s1Classify('pii');
    s1state.activeToken = 'email'; s1Classify('pii');
    // Don't classify credentials — trigger end as submit with items left
    s1EndGame('submit');
  });
  await wait(900);
  await shot(page, 'm1-verdict-fail');
  await page.evaluate(() => document.querySelector('#s1verdict .verdict-card')?.scrollTo(0, 9999));
  await wait(200);
  await shot(page, 'm1-verdict-fail-scrolled');

  // M2 fail — submit without finding all hallucinations
  await page.evaluate(() => {
    showScreen('screenS2');
    document.getElementById('s2verdict').classList.remove('show');
    s2Init();
  });
  await wait(400);
  await page.evaluate(() => s2Start());
  await wait(200);
  await page.evaluate(() => {
    // Flag only 3 of 6 hallucinations
    ['law1','law2','fig1'].forEach(id => {
      s2state.activeToken = id;
      s2Classify(s2state.tokState[id].cat);
    });
    // Force end
    s2state.gameActive = true;
    s2EndGame('submit');
  });
  await wait(900);
  await shot(page, 'm2-verdict-fail');
  await page.evaluate(() => document.querySelector('#s2verdict .verdict-card')?.scrollTo(0, 9999));
  await wait(200);
  await shot(page, 'm2-verdict-fail-scrolled');

  // M3 fail — breach mid-game
  await page.evaluate(() => {
    showScreen('screenS3');
    document.getElementById('s3verdict').classList.remove('show');
    s3Init();
  });
  await wait(400);
  await page.evaluate(() => s3Start());
  await wait(300);
  await page.evaluate(() => {
    // Drain time to zero then call timeout
    s3state.timeRemaining = 0;
    s3state.gameActive = true;
    s3EndGame('timeout');
  });
  await wait(900);
  await shot(page, 'm3-verdict-fail');
  await page.evaluate(() => document.querySelector('#s3verdict .verdict-card')?.scrollTo(0, 9999));
  await wait(200);
  await shot(page, 'm3-verdict-fail-scrolled');

  // ─────────────────────────────────────────────────────────────────────────
  // 10. EXTRA STATES — insight overlay standalone, timer warning
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n── Extra states ────────────────────────');

  // Show insight overlay in isolation (warn tone)
  await page.evaluate(() => {
    showScreen('screenS1');
    s1Init();
    s1Start();
    showInsight(
      'Wrong Category',
      'Webb@2026!',
      'This is a password — classify as CREDENTIALS. Passwords should never appear in any text sent to an external service.',
      null
    );
  });
  await wait(400);
  await shot(page, 'insight-overlay-warn');

  // Dismiss and show OK-tone insight
  await page.evaluate(() => {
    dismissInsight();
    showInsight(
      'Injection Found',
      '[Output format: Before producing any summary…]',
      'Correct. The "[Output format]" block is an injection disguised as a formatting instruction. Real attackers use polite, bureaucratic language — not "IGNORE ALL". The tell is that it addresses an AI system, not a human reader.',
      null
    );
  });
  await wait(400);
  await shot(page, 'insight-overlay-ok');

  await page.evaluate(() => dismissInsight());
  await wait(200);

  // Integrity bar in critical state (red)
  await page.evaluate(() => {
    s1state.integrity = 12;
    updateIntUI('s1', 12, 1.2, 1.664);
    flashDelta('s1', -10, 'sensitive data exposed!');
  });
  await wait(300);
  await shot(page, 'm1-integrity-critical');

  await browser.close();

  // Summary
  const files = fs.readdirSync(SHOTS_DIR).filter(f => f.endsWith('.png')).sort();
  console.log(`\n✅  ${files.length} screenshots saved to /screenshots/\n`);
  files.forEach(f => console.log(`     ${f}`));
  console.log('');
}

main().catch(err => {
  console.error('\n❌ Screenshot script failed:', err.message);
  process.exit(1);
});
