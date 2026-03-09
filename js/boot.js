// ════════════════════════════════════════════
//  SPLASH SCREEN
// ════════════════════════════════════════════
function splashBegin() {
  // Play bleep directly (audio already preloaded, this is the gesture)
  const b = new Audio('https://aigenesis2023.github.io/CyberSecurity/assets/audio/bleep_p8nRzd6T.mp3');
  b.volume = 0.325; b.play().catch(()=>{});
  startAudio();
  const el = document.getElementById('splashScreen');
  el.classList.add('hidden');
  setTimeout(() => el.style.display = 'none', 800);
}

function runSplashLoader() {
  const fill = document.getElementById('splashFill');
  const msg  = document.getElementById('splashMsg');
  const btn  = document.getElementById('splashBtn');
  const sub  = document.getElementById('splashSub');
  const steps = [
    [0,   'LOADING ASSETS...'],
    [20,  'FETCHING AUDIO...'],
    [50,  'SCANNING SUBMISSION...'],
    [80,  'CALIBRATING INTEGRITY MONITOR...'],
    [100, 'READY'],
  ];
  const DURATION = 2000; // 2 seconds total
  const start = Date.now();
  let stepIdx = 0;

  const iv = setInterval(() => {
    const elapsed = Date.now() - start;
    const pct = Math.min(100, (elapsed / DURATION) * 100);
    fill.style.width = pct + '%';

    // Update message at thresholds
    while (stepIdx < steps.length - 1 && pct >= steps[stepIdx + 1][0]) stepIdx++;
    msg.textContent = steps[stepIdx][1];

    if (pct >= 100) {
      clearInterval(iv);
      btn.disabled = false;
      sub.textContent = 'Click to begin';
    }
  }, 40);
}

// ════════════════════════════════════════════
//  BOOT
// ════════════════════════════════════════════
const BOOT_STEPS = [
  'LOADING DETECTION MODULES...','TOKENISATION ENGINE READY...',
  'SCANNING SUBMISSION CONTENT...','FLAGGING SENSITIVE DATA...',
  'CALIBRATING INTEGRITY MONITOR...','REVIEW READY.',
];

function boot() {
  buildPayload(); buildSegments();
  const msgEl = document.getElementById('bootMsg');
  const fillEl = document.getElementById('bootFill');
  let step = 0;
  const iv = setInterval(() => {
    if (step >= BOOT_STEPS.length) {
      clearInterval(iv);
      document.getElementById('boot').classList.add('hidden');
      setTimeout(() => document.getElementById('boot').style.display='none', 900);
      return;
    }
    msgEl.textContent = BOOT_STEPS[step];
    fillEl.style.width = ((step+1)/BOOT_STEPS.length*100) + '%';
    step++;
  }, 380);
}

window.addEventListener('load', () => {
  preloadAudio();
  runSplashLoader();
  setTimeout(boot, 200);
});
