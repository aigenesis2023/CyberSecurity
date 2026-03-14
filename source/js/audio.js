// ════════════════════════════════════════════
//  AUDIO — dynamic Audio() objects, no fetch/CORS issues
// ════════════════════════════════════════════
const SND = {};
let audioReady = false;

// Called on page load — preloads all assets silently (no play yet)
function preloadAudio() {
  const base = 'https://aigenesis2023.github.io/CyberSecurity/assets/audio/';

  SND.bg      = new Audio(base + 'SunoBG.mp3');
  SND.bg.loop = true; SND.bg.volume = 0.5; SND.bg.preload = 'auto';

  SND.vo      = new Audio(base + 'BriefingVO.mp3');
  SND.vo.volume = 1.0; SND.vo.preload = 'auto';

  SND.bleep   = new Audio(base + 'bleep_p8nRzd6T.mp3');
  SND.bleep.volume = 0.325; SND.bleep.preload = 'auto';

  SND.success = new Audio(base + 'success_avrPRnht.mp3');
  SND.success.volume = 1.0; SND.success.preload = 'auto';

  SND.error   = new Audio(base + 'error.mp3');
  SND.error.volume = 1.0; SND.error.preload = 'auto';

  SND.voSuccess = new Audio(base + 'SuccessVO.mp3');
  SND.voSuccess.volume = 1.0; SND.voSuccess.preload = 'auto';

  SND.voFailure = new Audio(base + 'IncorrectVO.mp3');
  SND.voFailure.volume = 1.0; SND.voFailure.preload = 'auto';

  SND.selected = new Audio(base + 'selected_wbItGBcM.mp3');
  SND.selected.volume = 0.8; SND.selected.preload = 'auto';

  SND.hover = new Audio(base + 'hover.mp3');
  SND.hover.volume = 0.6; SND.hover.preload = 'auto';

  SND.click = new Audio(base + 'click.mp3');
  SND.click.volume = 0.35; SND.click.preload = 'auto';

  SND.wrong = new Audio(base + 'wronganswer.mp3');
  SND.wrong.volume = 0.8; SND.wrong.preload = 'auto';

  // Touch each src to trigger browser preload
  Object.values(SND).forEach(a => a.load());
}

// Called on BEGIN click — user gesture required to start playback
function startAudio() {
  if (audioReady) return;
  audioReady = true;
  SND.bg.play().catch(()=>{});
  SND.vo.play().catch(()=>{});
}

function stopVoiceover() {
  if (!SND.vo) return;
  SND.vo.pause(); SND.vo.currentTime = 0;
}

function playBleep() {
  if (!audioReady) return;
  SND.bleep.cloneNode().play().catch(()=>{});
}

function playHover() {
  if (!audioReady || !SND.hover) return;
  const a = new Audio(SND.hover.src);
  a.volume = 0.6; a.play().catch(()=>{});
}

function playClick() {
  if (!audioReady || !SND.click) return;
  const a = new Audio(SND.click.src);
  a.volume = 0.35; a.play().catch(()=>{});
}

function playWrong() {
  if (!audioReady || !SND.wrong) return;
  const a = new Audio(SND.wrong.src);
  a.volume = 0.8; a.play().catch(()=>{});
}

function playSelected() {
  if (!audioReady) return;
  SND.selected.cloneNode().play().catch(()=>{});
}

function playSuccess() {
  if (!audioReady) return;
  const a = new Audio(SND.success.src); a.volume = 1.0; a.play().catch(()=>{});
  // VO success after brief pause
  setTimeout(() => {
    const v = new Audio(SND.voSuccess.src); v.volume = 1.0; v.play().catch(()=>{});
  }, 600);
}

function playError() {
  if (!audioReady) return;
  SND.error.cloneNode().play().catch(()=>{});
  // VO failure after brief pause
  setTimeout(() => {
    const v = new Audio(SND.voFailure.src); v.volume = 1.0; v.play().catch(()=>{});
  }, 600);
}

// Bleep only on 'Start Scrubbing' and 'Vulnerability Scan'
document.addEventListener('click', e => {
  const isBriefingStart = e.target.closest('.briefing-start-btn');
  const isScanBtn       = e.target.closest('#btnScan');
  if (audioReady && (isBriefingStart || isScanBtn)) playBleep();
}, { capture: true });
