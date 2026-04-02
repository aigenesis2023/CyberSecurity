// ════════════════════════════════════════════
//  AUDIO
// ════════════════════════════════════════════
const SND = {};
let audioReady = false;

// ── Audio path helper — resolves relative to the HTML file ──────────────
const AUDIO_BASE = 'assets/audio/';
const AUDIO_FILES = {
  bg:       { file:'SunoBG.mp3',              loop:true,  volume:0.1625 },
  bleep:    { file:'bleep_p8nRzd6T.mp3',      volume:0.325 },
  success:  { file:'success_avrPRnht.mp3',    volume:1.0 },
  error:    { file:'error.mp3',               volume:1.0 },
  selected: { file:'selected_wbItGBcM.mp3',   volume:0.8 },
  click:    { file:'click.mp3',               volume:0.35 },
  wrong:    { file:'wronganswer.mp3',         volume:0.8 },
  hover:    { file:'Hover.mp3',              volume:0.6 },
};

// ── Per-screen voiceover clips ──────────────────────────────────────────
const VO_CLIPS = [
  'VO-INTRO',
  'VO-M1-BRIEF','VO-M1-PASS','VO-M1-FAIL',
  'VO-M2-BRIEF','VO-M2-PASS','VO-M2-FAIL',
  'VO-M3-BRIEF','VO-M3-PASS','VO-M3-FAIL',
  'VO-COMPLETE'
];
let _activeVO = null;

// ── Web Audio API for instant SFX playback (esp. mobile) ────────────────
let _actx = null;     // AudioContext — created on first user gesture
const _buf = {};      // key → AudioBuffer (pre-decoded PCM, instant play)
const _vobuf = {};    // voiceover name → AudioBuffer

function _ensureCtx() {
  if (_actx) return _actx;
  try { _actx = new (window.AudioContext || window.webkitAudioContext)(); }
  catch(e) { _actx = null; }
  return _actx;
}

function _fetchAndDecode(url, target, key) {
  fetch(url).then(r => r.arrayBuffer()).then(ab => {
    if (!_actx) return;
    return _actx.decodeAudioData(ab);
  }).then(buf => { if(buf) target[key] = buf; }).catch(()=>{});
}

// Play a pre-decoded buffer through Web Audio API — instant, overlapping
function _playSFX(key, vol) {
  if (!audioReady || _muted || !_actx || !_buf[key]) return;
  try {
    const src = _actx.createBufferSource();
    src.buffer = _buf[key];
    const gain = _actx.createGain();
    gain.gain.value = vol;
    src.connect(gain).connect(_actx.destination);
    src.start(0);
  } catch(e){}
}

// ── HTML Audio fallback for BG music (needs streaming/loop) ─────────────
function _makeAudio(key, def) {
  try {
    const a = new Audio(AUDIO_BASE + def.file);
    a.volume = def.volume ?? 1.0;
    if (def.loop) a.loop = true;
    a.preload = 'auto';
    a.addEventListener('error', () => { SND[key] = null; }, { once:true });
    return a;
  } catch(e) { return null; }
}

function preloadAudio() {
  // BG music still uses HTML Audio for streaming/loop
  SND.bg = _makeAudio('bg', AUDIO_FILES.bg);
  // Pre-create HTML Audio objects (used as fallback & for preload)
  Object.entries(AUDIO_FILES).forEach(([key, def]) => {
    if (key !== 'bg') SND[key] = _makeAudio(key, def);
  });
  // Preload per-screen voiceover clips
  SND.vo = {};
  VO_CLIPS.forEach(name => {
    SND.vo[name] = _makeAudio('vo_'+name, { file: name+'.mp3', volume: 1.0 });
  });
  // Trigger browser preload on all audio objects
  Object.entries(SND).forEach(([k,v]) => {
    if(k==='vo') Object.values(v).forEach(a => { if(a) try { a.load(); } catch(e){} });
    else if(v) try { v.load(); } catch(e){}
  });
}
let _muted = false;
function startAudio() {
  if (audioReady) return; audioReady=true;
  // Create AudioContext on user gesture (required by mobile browsers)
  _ensureCtx();
  if (_actx && _actx.state === 'suspended') _actx.resume().catch(()=>{});
  // Decode all SFX into AudioBuffers for instant playback
  Object.entries(AUDIO_FILES).forEach(([key, def]) => {
    if (key !== 'bg') _fetchAndDecode(AUDIO_BASE + def.file, _buf, key);
  });
  // Decode voiceover clips
  VO_CLIPS.forEach(name => {
    _fetchAndDecode(AUDIO_BASE + name + '.mp3', _vobuf, name);
  });
  if (!_muted && SND.bg) SND.bg.play().catch(()=>{});
  playVO('VO-INTRO');
}
function _setMuteIcon(muted) {
  const x = document.getElementById('muteX'); if(x) x.setAttribute('opacity', muted ? '1' : '0');
  const lbl = document.querySelector('#muteBtn .ctrl-lbl'); if(lbl) lbl.textContent = muted ? 'MUTED' : 'SOUND';
}
function toggleMute() {
  _muted = !_muted;
  const btn = document.getElementById('muteBtn');
  if(btn) btn.classList.toggle('muted', _muted);
  _setMuteIcon(_muted);
  _muteAllSND(_muted);
  try { localStorage.setItem('adg_muted', _muted ? '1' : '0'); } catch(e){}
}
function loadMuteState() {
  try {
    const saved = localStorage.getItem('adg_muted');
    if(saved === '1') { _muted = true; const btn=document.getElementById('muteBtn'); if(btn) btn.classList.add('muted'); _setMuteIcon(true); }
  } catch(e){}
}
function _play(a) { if(a) { a.muted=_muted; a.play().catch(()=>{}); } }
function _muteAllSND(muted) {
  // Mute/unmute BG music (HTML Audio)
  if(SND.bg && typeof SND.bg.muted !== 'undefined') SND.bg.muted = muted;
  // Mute/unmute active voiceover (HTML Audio or Web Audio API)
  if(_activeVO) {
    if (_activeVO._gain) _activeVO._gain.gain.value = muted ? 0 : 1.0;
    else if (typeof _activeVO.muted !== 'undefined') _activeVO.muted = muted;
  }
  // Web Audio API SFX respect _muted flag checked in _playSFX
}

// ── Voiceover playback (Web Audio API with HTML Audio fallback) ─────────
function playVO(name) {
  if(!audioReady) return;
  stopVO();
  // Try Web Audio API first (instant on mobile)
  if (_actx && _vobuf[name]) {
    try {
      const src = _actx.createBufferSource();
      src.buffer = _vobuf[name];
      const gain = _actx.createGain();
      gain.gain.value = _muted ? 0 : 1.0;
      src.connect(gain).connect(_actx.destination);
      src.start(0);
      _activeVO = { _src: src, _gain: gain, pause: function(){ try{this._src.stop();}catch(e){} }, currentTime: 0 };
      return;
    } catch(e){}
  }
  // Fallback to HTML Audio
  const clip = SND.vo && SND.vo[name];
  if(!clip) return;
  try {
    const a = new Audio(clip.src);
    a.volume = 1.0;
    a.muted = _muted;
    a.play().catch(()=>{});
    _activeVO = a;
  } catch(e){}
}
function stopVO() {
  if(_activeVO) { _activeVO.pause(); _activeVO.currentTime = 0; _activeVO = null; }
}
function stopVoiceover() { stopVO(); }
function pauseBG() { if(SND.bg) { SND.bg.pause(); } }
function resumeBG() { if(SND.bg && audioReady) { SND.bg.muted = _muted; if(!_muted) SND.bg.play().catch(()=>{}); } }
function pClick()    { _playSFX('click',    0.35); }
function pWrong()    { _playSFX('wrong',    0.8);  }
function pSelected() { _playSFX('selected', 0.8);  }
function pSuccess()  { _playSFX('success',  1.0);  }
function pError()    { _playSFX('error',    1.0);  }
function pBleep()    { _playSFX('bleep',    0.325); }
function pHover()    { _playSFX('hover',    0.6);  }

// ════════════════════════════════════════════
//  COURSE PROGRESS
// ════════════════════════════════════════════
let courseProgress = { s1done:false, s2done:false, s3done:false, s1score:null, s2score:null, s3score:null, certShown:false };
let menuFirstRender = true;

function saveProgress() {
  try { localStorage.setItem('adg_progress', JSON.stringify(courseProgress)); } catch(e){}
}
function loadProgress() {
  try {
    const saved = localStorage.getItem('adg_progress');
    if(saved) {
      const p = JSON.parse(saved);
      if(p.s1done) courseProgress.s1done = true;
      if(p.s2done) courseProgress.s2done = true;
      if(p.s3done) courseProgress.s3done = true;
      if(p.s1score != null) courseProgress.s1score = p.s1score;
      if(p.s2score != null) courseProgress.s2score = p.s2score;
      if(p.s3score != null) courseProgress.s3score = p.s3score;
      if(p.certShown) courseProgress.certShown = true;
    }
  } catch(e){}
}
function updateMenuState() {
  loadProgress();

  // ── M1 (always available — only state changes are AVAILABLE ↔ COMPLETE) ──
  const b1 = document.getElementById('m1btn');
  const m1status = document.getElementById('m1status');
  const m1dot = document.getElementById('m1dot');
  const m1lbl = document.getElementById('m1statuslbl');
  if (courseProgress.s1done) {
    if(m1lbl) m1lbl.textContent = 'COMPLETE';
    if(m1dot) m1dot.className = 'mc-dot-s green';
    if(m1status) m1status.className = 'mc-status unlocked-s';
    if(b1) { b1.textContent = '↺  REPLAY MISSION'; b1.classList.add('replay-btn'); b1.classList.remove('locked-btn'); }
  } else {
    if(m1lbl) m1lbl.textContent = 'AVAILABLE';
    if(m1dot) m1dot.className = 'mc-dot-s green';
    if(m1status) m1status.className = 'mc-status unlocked-s';
    if(b1) { b1.textContent = '▶  LAUNCH MISSION'; b1.classList.remove('replay-btn'); b1.classList.remove('locked-btn'); }
  }

  // ── M2 — demo: locked, full: locked until M1 done, dev: always open ──
  const mcard2 = document.getElementById('mcard2');
  const b2 = document.getElementById('m2btn');
  const m2open = _accessMode === 'dev' || (_accessMode === 'full' && courseProgress.s1done);
  if (m2open) {
    mcard2.classList.remove('locked'); mcard2.classList.add('unlocked');
    document.getElementById('m2status').className = 'mc-status unlocked-s';
    document.getElementById('m2dot').className = 'mc-dot-s green';
    if (courseProgress.s2done) {
      document.getElementById('m2statuslbl').textContent = 'COMPLETE';
      if(b2) { b2.textContent = '↺  REPLAY MISSION'; b2.classList.add('replay-btn'); b2.classList.remove('locked-btn'); }
    } else {
      document.getElementById('m2statuslbl').textContent = 'AVAILABLE';
      if(b2) { b2.textContent = '▶  LAUNCH MISSION'; b2.classList.remove('replay-btn'); b2.classList.remove('locked-btn'); }
    }
  } else {
    mcard2.classList.add('locked'); mcard2.classList.remove('unlocked');
    document.getElementById('m2status').className = 'mc-status locked-s';
    document.getElementById('m2dot').className = 'mc-dot-s grey';
    const m2lockSvg = '<svg width="11" height="13" viewBox="0 0 11 13" fill="none"><rect x="1" y="5.5" width="9" height="7" rx="1.5" stroke="rgba(255,255,255,.3)" stroke-width="1.2" fill="rgba(255,255,255,.04)"/><path d="M3 5.5V3.5a2.5 2.5 0 0 1 5 0v2" stroke="rgba(255,255,255,.3)" stroke-width="1.2" stroke-linecap="round" fill="none"/><circle cx="5.5" cy="9" r="1" fill="rgba(255,255,255,.25)"/></svg>';
    if (_accessMode === 'demo') {
      document.getElementById('m2statuslbl').textContent = 'FULL VERSION';
      if(b2) { b2.innerHTML = m2lockSvg + 'AVAILABLE IN FULL VERSION'; b2.classList.add('locked-btn'); b2.classList.remove('replay-btn'); }
    } else {
      document.getElementById('m2statuslbl').textContent = 'LOCKED';
      if(b2) { b2.innerHTML = m2lockSvg + 'COMPLETE MISSION 01 TO UNLOCK'; b2.classList.add('locked-btn'); b2.classList.remove('replay-btn'); }
    }
  }

  // ── M3 — demo: locked, full: locked until M2 done, dev: always open ──
  const mcard3 = document.getElementById('mcard3');
  const b3 = document.getElementById('m3btn');
  const m3open = _accessMode === 'dev' || (_accessMode === 'full' && courseProgress.s2done);
  if (m3open) {
    mcard3.classList.remove('locked'); mcard3.classList.add('unlocked');
    document.getElementById('m3status').className = 'mc-status unlocked-s';
    document.getElementById('m3dot').className = 'mc-dot-s green';
    if (courseProgress.s3done) {
      document.getElementById('m3statuslbl').textContent = 'COMPLETE';
      if(b3) { b3.textContent = '↺  REPLAY MISSION'; b3.classList.add('replay-btn'); b3.classList.remove('locked-btn'); }
    } else {
      document.getElementById('m3statuslbl').textContent = 'AVAILABLE';
      if(b3) { b3.textContent = '▶  LAUNCH MISSION'; b3.classList.remove('replay-btn'); b3.classList.remove('locked-btn'); }
    }
  } else {
    mcard3.classList.add('locked'); mcard3.classList.remove('unlocked');
    document.getElementById('m3status').className = 'mc-status locked-s';
    document.getElementById('m3dot').className = 'mc-dot-s grey';
    const m3lockSvg = '<svg width="11" height="13" viewBox="0 0 11 13" fill="none"><rect x="1" y="5.5" width="9" height="7" rx="1.5" stroke="rgba(255,255,255,.3)" stroke-width="1.2" fill="rgba(255,255,255,.04)"/><path d="M3 5.5V3.5a2.5 2.5 0 0 1 5 0v2" stroke="rgba(255,255,255,.3)" stroke-width="1.2" stroke-linecap="round" fill="none"/><circle cx="5.5" cy="9" r="1" fill="rgba(255,255,255,.25)"/></svg>';
    if (_accessMode === 'demo') {
      document.getElementById('m3statuslbl').textContent = 'FULL VERSION';
      if(b3) { b3.innerHTML = m3lockSvg + 'AVAILABLE IN FULL VERSION'; b3.classList.add('locked-btn'); b3.classList.remove('replay-btn'); }
    } else {
      document.getElementById('m3statuslbl').textContent = 'LOCKED';
      if(b3) { b3.innerHTML = m3lockSvg + 'COMPLETE MISSION 02 TO UNLOCK'; b3.classList.add('locked-btn'); b3.classList.remove('replay-btn'); }
    }
  }

  // Pulse the next available mission's launch button
  [b1, b2, b3].forEach(b => { if(b) b.classList.remove('next-up'); });
  if (!courseProgress.s1done && b1) b1.classList.add('next-up');
  else if (m2open && !courseProgress.s2done && b2) b2.classList.add('next-up');
  else if (m3open && !courseProgress.s3done && b3) b3.classList.add('next-up');

  // Progress dots (legacy — hidden, kept for compat)
  const d1=document.getElementById('pdot1'), d2=document.getElementById('pdot2'), d3=document.getElementById('pdot3');
  d1.className = courseProgress.s1done ? 'mp-dot done' : 'mp-dot active';
  d2.className = courseProgress.s2done ? 'mp-dot done' : (courseProgress.s1done ? 'mp-dot active' : 'mp-dot');
  d3.className = courseProgress.s3done ? 'mp-dot done' : (courseProgress.s2done ? 'mp-dot active' : 'mp-dot');
  // Mastery meter
  const lvlCount = (courseProgress.s1done?1:0)+(courseProgress.s2done?1:0)+(courseProgress.s3done?1:0);
  ['mseg1','mseg2','mseg3'].forEach((id,i) => {
    const el=document.getElementById(id); if(!el) return;
    if(lvlCount>i) el.className='mastery-seg filled s'+(i+1);
    else if(lvlCount===i) el.className='mastery-seg active';
    else el.className='mastery-seg';
  });
  const mc=document.getElementById('masteryCount');
  if(mc){ mc.textContent=lvlCount+' / 3'; mc.className='mastery-count'+(lvlCount>=3?' complete':''); }
  // Star ratings on mission cards + collapsed card stars
  ['1','2','3'].forEach(n => {
    const starsEl = document.getElementById('m'+n+'stars');
    const starsCEl = document.getElementById('m'+n+'starsC');
    const score = courseProgress['s'+n+'score'];
    if (!courseProgress['s'+n+'done'] || score == null) {
      if (starsEl) starsEl.textContent = '';
      if (starsCEl) starsCEl.textContent = '';
      return;
    }
    const starCount = score >= 80 ? 3 : score >= 50 ? 2 : 1;
    const starStr = '★'.repeat(starCount) + '☆'.repeat(3 - starCount);
    if (starsEl) { starsEl.textContent = starStr; starsEl.title = 'Score: ' + score + '%'; }
    if (starsCEl) { starsCEl.textContent = starStr; starsCEl.title = 'Score: ' + score + '%'; }
  });

  // ── Collapsible mission cards — mobile: always collapsed; desktop: always expanded ──
  const isMobile = window.innerWidth <= 768;
  const nextMission = !courseProgress.s1done ? 1 : !courseProgress.s2done ? 2 : !courseProgress.s3done ? 3 : 0;
  [1, 2, 3].forEach(n => {
    const card = document.getElementById('mcard' + n);
    if (!card) return;
    const isDone = courseProgress['s' + n + 'done'];
    const isLocked = (n === 2 && !courseProgress.s1done) || (n === 3 && !courseProgress.s2done);
    card.classList.remove('next-mission');
    if (isMobile) {
      // Mobile: auto-expand M1 on first render; others collapsed unless user expanded
      if (n === 1 && menuFirstRender) {
        card.classList.remove('collapsed');
        card.classList.add('expanded');
        const chevron = card.querySelector('.mc-collapse-chevron');
        if (chevron) chevron.style.transform = 'rotate(180deg)';
        const btn = document.getElementById('m1btn');
        if (btn) btn.classList.add('first-pulse');
      } else if (!card.classList.contains('expanded')) {
        card.classList.add('collapsed');
      }
      // Keep next-mission glow for visual prominence even when collapsed
      if (!isDone && n === nextMission) card.classList.add('next-mission');
    } else {
      // Desktop: allow user to toggle collapse/expand — preserve their choice
      // Only add next-mission highlight; don't force-expand
      if (!isDone && n === nextMission) card.classList.add('next-mission');
    }
    // Update collapse row status badge
    const badge = document.getElementById('m' + n + 'collapseBadge');
    if (badge) {
      if (isDone) {
        badge.textContent = '✓';
        badge.className = 'mc-collapse-badge done';
      } else if (isLocked) {
        badge.textContent = '🔒';
        badge.className = 'mc-collapse-badge locked-icon';
      } else {
        badge.textContent = '';
        badge.className = 'mc-collapse-badge unlocked';
      }
    }
  });
  menuFirstRender = false;

  // Clearance label removed
  const tu=document.getElementById('titleUnlock');
  if(tu){ tu.className='title-unlock'+(lvlCount>=3?' show':''); }
  // Legacy level label (hidden)
  const lvlEl=document.getElementById('mpLevelLabel'); if(lvlEl) lvlEl.textContent='';
}

function tryLaunch(n) {
  if (_accessMode === 'demo' && n >= 2) { pWrong(); shakeCard(n); return; }
  if (_accessMode === 'full') {
    if (n===2 && !courseProgress.s1done) { pWrong(); shakeCard(n); return; }
    if (n===3 && !courseProgress.s2done) { pWrong(); shakeCard(n); return; }
  }
  launchSection(n);
}
function shakeCard(n) {
  const c = document.getElementById('mcard'+n);
  c.style.animation='none'; void c.offsetWidth;
  c.style.animation='wrongGlow .6s ease';
  setTimeout(()=>c.style.animation='',600);
}

function handleMissionClick(n) {
  const card = document.getElementById('mcard'+n);
  // If collapsed, expand instead of launching
  if (card.classList.contains('collapsed')) {
    toggleMissionCard(n);
    return;
  }
  // Otherwise, normal launch flow
  if (n === 1) launchSection(1);
  else tryLaunch(n);
}

function toggleMissionCard(n) {
  const card = document.getElementById('mcard'+n);
  if (card.classList.contains('collapsed')) {
    card.classList.remove('collapsed');
    card.classList.add('expanded');
    const chevron = card.querySelector('.mc-collapse-chevron');
    if (chevron) chevron.style.transform = 'rotate(180deg)';
  } else {
    card.classList.add('collapsed');
    card.classList.remove('expanded');
    const chevron = card.querySelector('.mc-collapse-chevron');
    if (chevron) chevron.style.transform = '';
    // Remove pulse if user collapses M1
    if (n === 1) {
      const btn = document.getElementById('m1btn');
      if (btn) btn.classList.remove('first-pulse');
    }
  }
}

// ════════════════════════════════════════════
//  NAVIGATION
// ════════════════════════════════════════════
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0,0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}
function goMenu() {
  pBleep(); stopVO();
  dismissToast();
  clearAllTimers();
  // Close any open mobile diag panels
  document.querySelectorAll('.diag.panel-open').forEach(d => {
    d.classList.remove('panel-open');
    const lbl = d.querySelector('.diag-toggle-lbl');
    if(lbl) lbl.textContent = lbl.textContent.replace('▼','▲').replace('CLOSE PANEL','ANALYSIS PANEL');
  });
  ['s1verdict','s2verdict','s3verdict','abortOverlay'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.classList.remove('show');
  });
  updateMenuState();
  // On mobile, auto-collapse completed missions then expand the next incomplete one
  if (window.innerWidth <= 768) {
    [1, 2, 3].forEach(n => {
      if (courseProgress['s' + n + 'done']) {
        const card = document.getElementById('mcard' + n);
        if (card) {
          card.classList.remove('expanded');
          card.classList.add('collapsed');
          const chevron = card.querySelector('.mc-collapse-chevron');
          if (chevron) chevron.style.transform = '';
        }
      }
    });
    // Auto-expand the next incomplete mission
    const nextMission = !courseProgress.s1done ? 1 : !courseProgress.s2done ? 2 : !courseProgress.s3done ? 3 : 0;
    if (nextMission > 0) {
      const nextCard = document.getElementById('mcard' + nextMission);
      if (nextCard) {
        nextCard.classList.remove('collapsed');
        nextCard.classList.add('expanded');
        const chevron = nextCard.querySelector('.mc-collapse-chevron');
        if (chevron) chevron.style.transform = 'rotate(180deg)';
      }
    }
  }
  showScreen('screenMenu');
  // Scroll to center on the next incomplete mission (or all-complete progress section)
  setTimeout(() => {
    let targetId = null;
    if (!courseProgress.s1done) targetId = 'mcard1';
    else if (!courseProgress.s2done) targetId = 'mcard2';
    else if (!courseProgress.s3done) targetId = 'mcard3';
    else targetId = 'titleUnlock';
    if (targetId) {
      const el = document.getElementById(targetId);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, 150);
  if (courseProgress.s1done && courseProgress.s2done && courseProgress.s3done && !courseProgress.certShown) {
    courseProgress.certShown = true;
    saveProgress();
    showCertificate();
  }
}
function launchSection(n) {
  pBleep();
  showScreen('screenS'+n);
  if (n===1) s1Init();
  if (n===2) s2Init();
  if (n===3) s3Init();
  // Briefing VO — plays over the briefing overlay (Step 1 only)
  playVO('VO-M'+n+'-BRIEF');
}
function clearAllTimers() {
  [s1state, s2state].forEach(s => {
    clearInterval(s.timerInt); clearInterval(s.drainInt);
  });
  clearInterval(s3state.globalTimerInt);
}

// ════════════════════════════════════════════
//  SHARED UI HELPERS
// ════════════════════════════════════════════
function showIntPop(pfx, amount) {
  const el = document.getElementById(pfx+'iwIntPop');
  if(!el) return;
  el.textContent = (amount>0?'+':'')+amount+'%';
  el.classList.remove('pop','gain','penalty'); void el.offsetWidth;
  el.classList.add('pop', amount>0?'gain':'penalty');
}
function flashDelta(pfx, amount, msg) {
  const el = document.getElementById(pfx+'iwDelta');
  if(!el) return;
  el.classList.remove('visible','gain','penalty'); void el.offsetWidth;
  el.textContent = amount!==0 ? (amount>0?'+':'')+amount.toFixed(0)+'%  '+(msg||'') : (msg||'');
  el.classList.add('visible', amount>=0?'gain':'penalty');
  clearTimeout(el._t);
  el._t = setTimeout(()=>el.classList.remove('visible'), 2200);
}
function flashTeach(pfx, msg) {
  const el = document.getElementById(pfx+'iwTeach');
  if(!el) return;
  el.classList.remove('visible'); void el.offsetWidth;
  el.textContent = msg;
  el.classList.add('visible');
  clearTimeout(el._t);
  el._t = setTimeout(()=>el.classList.remove('visible'), 3800);
}
// Shared constant used by all three missions for integrity UI
const S1_MAX_DRAIN = 1.664;

function updateIntUI(pfx, integrity, drainRate, maxDrain) {
  const pct = Math.min(100, Math.max(0, Math.round(integrity)));
  const numEl = document.getElementById(pfx+'iwNum');
  if(!numEl) return;
  numEl.textContent = pct;
  const cls = pct>60?'green':pct>30?'orange':'red';
  numEl.className = 'ib-num '+cls;
  const numMEl = document.getElementById(pfx+'iwNumM');
  if(numMEl) { numMEl.textContent = pct; numMEl.className = 'ib-num-compact '+cls; }
  const bar = document.getElementById(pfx+'iwIntBar');
  if(bar) { bar.style.width=pct+'%'; bar.className='ib-bar-fill '+cls; }
  // severity segs
  const thresholds=[0.08,0.20,0.36,0.52,0.68,0.84,1.00,1.18,1.38,1.55];
  const segCls=['s1','s2','s3','s4','s5','s6','s7','s8','s9','s10'];
  for(let i=0;i<10;i++){
    const seg=document.getElementById(pfx+'ibSeg'+(i+1));
    if(seg) seg.className='ib-seg'+(drainRate>thresholds[i]?' '+segCls[i]:'');
  }
}

// ════════════════════════════════════════════
//  SCORM INTEGRATION
// ════════════════════════════════════════════
//  Auto-initialises; finishes on unload.
// ════════════════════════════════════════════
const SCORM = (() => {
  let _api = null, _init = false, _sessionTime = 0, _sessionStart = Date.now();
  function _findAPI(w) {
    let n = 0;
    while (!w.API && w.parent && w.parent !== w) { if(++n > 7) return null; w = w.parent; }
    return w.API || null;
  }
  function _getAPI() {
    if (_api) return _api;
    _api = _findAPI(window);
    if (!_api && window.opener) _api = _findAPI(window.opener);
    return _api;
  }
  function initialize() {
    const api = _getAPI(); if (!api) return false;
    const r = api.LMSInitialize('');
    _init = (r === 'true' || r === true);
    _sessionStart = Date.now();
    return _init;
  }
  function finish() {
    const api = _getAPI(); if (!api || !_init) return;
    // Report session time in hh:mm:ss
    const secs = Math.round((Date.now() - _sessionStart) / 1000);
    const hh = String(Math.floor(secs/3600)).padStart(2,'0');
    const mm = String(Math.floor((secs%3600)/60)).padStart(2,'0');
    const ss = String(secs%60).padStart(2,'0');
    api.LMSSetValue('cmi.core.session_time', `${hh}:${mm}:${ss}`);
    api.LMSCommit(''); api.LMSFinish(''); _init = false;
  }
  function set(el, val) { const api=_getAPI(); if(!api||!_init) return; api.LMSSetValue(el, String(val)); api.LMSCommit(''); }
  function get(el)       { const api=_getAPI(); if(!api||!_init) return ''; return api.LMSGetValue(el); }
  function setScore(raw, min=0, max=100) { set('cmi.core.score.raw',raw); set('cmi.core.score.min',min); set('cmi.core.score.max',max); }
  function setStatus(passed) { set('cmi.core.lesson_status', passed ? 'passed' : 'failed'); }
  function setBookmark(obj)  { try { set('cmi.suspend_data', JSON.stringify(obj)); } catch(e){} }
  function getBookmark()     { try { const r=get('cmi.suspend_data'); return r ? JSON.parse(r) : null; } catch(e){ return null; } }
  initialize();
  window.addEventListener('beforeunload', finish);
  return { initialize, finish, set, get, setScore, setStatus, setBookmark, getBookmark };
})();

// ── Certificate screen ──────────────────────────────────────────────────
function showCertificate() {
  const scores = window._scormScores || {};
  const fmt = (v) => v !== null && v !== undefined ? v + '%' : '—';
  const cls = (v) => !v ? '' : v > 60 ? '' : v > 30 ? 'orange' : 'red';
  ['s1','s2','s3'].forEach(k => {
    const el = document.getElementById('cert'+k.toUpperCase());
    if (!el) return;
    const v = scores[k];
    el.textContent = fmt(v);
    el.className = 'cert-score-val ' + cls(v);
  });
  const nameEl = document.getElementById('certName');
  if (nameEl) nameEl.textContent = window._userName || '';
  const dateEl = document.getElementById('certDate');
  if (dateEl) {
    const now = new Date();
    dateEl.textContent = '⬡ Completed: ' + now.toLocaleDateString('en-GB', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  }
  document.getElementById('certOverlay').classList.add('show');
  playVO('VO-COMPLETE');
}
function closeCert() {
  stopVO();
  document.getElementById('certOverlay').classList.remove('show');
  goMenu();
}

// ── Called by each mission's endGame to report to LMS ──────────────────
function scormReport(score, passed, missionId) {
  // Composite score: average of all completed missions
  const scores = { s1: null, s2: null, s3: null };
  if (window._scormScores) Object.assign(scores, window._scormScores);
  scores[missionId] = score;
  window._scormScores = scores;
  // Persist best score for star-rating display across reloads
  const scoreKey = missionId + 'score';
  if (courseProgress[scoreKey] == null || score > courseProgress[scoreKey]) {
    courseProgress[scoreKey] = score;
    saveProgress();
  }
  const completed = Object.values(scores).filter(v => v !== null);
  const avgScore = completed.length ? Math.round(completed.reduce((a,b)=>a+b,0) / completed.length) : score;
  const allPassed = courseProgress.s1done && courseProgress.s2done && courseProgress.s3done;
  SCORM.setScore(avgScore, 0, 100);
  SCORM.setStatus(allPassed ? true : passed);
  SCORM.setBookmark({ progress: courseProgress, scores });
}

// ════════════════════════════════════════════
//  SPLASH SCREEN
// ════════════════════════════════════════════
// ── Access modes: 'demo' (M1 only), 'full' (normal progression), 'dev' (all unlocked) ──
let _accessMode = 'demo';

// Shortcuts: A+1 = full version, A+2 = dev unlock all
const _devKeys = {};
document.addEventListener('keydown', e => {
  _devKeys[e.key.toLowerCase()] = true;
  if (_devKeys['a'] && _devKeys['1'] && _accessMode !== 'full') {
    _accessMode = 'full'; updateMenuState();
  }
  if (_devKeys['a'] && _devKeys['2']) {
    _accessMode = 'dev';
    courseProgress.s1done = true; courseProgress.s2done = true; courseProgress.s3done = true;
    saveProgress(); updateMenuState();
  }
});
document.addEventListener('keyup', e => { _devKeys[e.key.toLowerCase()] = false; });

function splashBegin() {
  // Validate name input
  const nameInput = document.getElementById('splashNameInput');
  const nameHint = document.getElementById('splashNameHint');
  const name = nameInput.value.trim();
  window._userName = name || 'Learner';
  // Dev mode: ?dev=1 unlocks all missions
  if(new URLSearchParams(window.location.search).get('dev')==='1'){
    courseProgress.s1done=true; courseProgress.s2done=true; courseProgress.s3done=true;
    saveProgress(); setTimeout(function(){ updateMenuState(); },500);
  }
  // Play bleep directly on user gesture — audio context requires this
  try { const b=_makeAudio('_bleep',AUDIO_FILES.bleep); if(b){b.volume=0.325;b.play().catch(()=>{});} } catch(e){}
  startAudio();
  const el=document.getElementById('splashScreen');
  el.classList.add('hidden'); setTimeout(()=>el.style.display='none',800);
}
document.addEventListener('DOMContentLoaded', () => {
  const ni = document.getElementById('splashNameInput');
  if (ni) ni.addEventListener('input', () => {
    ni.classList.remove('error');
    const h = document.getElementById('splashNameHint');
    if (h) { h.classList.remove('error'); h.textContent = 'Optional — used for your completion certificate'; }
  });
});
function runSplashLoader() {
  const fill=document.getElementById('splashFill');
  const msg=document.getElementById('splashMsg');
  const btn=document.getElementById('splashBtn');
  const steps=[[0,'LOADING...'],[20,'LOADING AUDIO...'],[45,'LOADING MODULES...'],[70,'PREPARING...'],[90,'PREPARING MISSIONS...'],[100,'READY']];
  const DURATION=2200; const start=Date.now(); let stepIdx=0;
  const iv=setInterval(()=>{
    const elapsed=Date.now()-start;
    const pct=Math.min(100,(elapsed/DURATION)*100);
    fill.style.width=pct+'%';
    while(stepIdx<steps.length-1&&pct>=steps[stepIdx+1][0]) stepIdx++;
    msg.textContent=steps[stepIdx][1];
    if(pct>=100){ clearInterval(iv); btn.disabled=false; }
  },40);
}

// ════════════════════════════════════════════
//  CINEMATIC THREAT BRIEFING
// ════════════════════════════════════════════
const OBJ_TERMINAL_LINES = [
  '> sec-ops :: threat-monitor v4.2.1 active',
  '> scanning organisational AI endpoints...',
  '> ██ 3 active threat vectors detected',
  '> classification: DATA LEAK / HALLUCINATION / INJECTION',
  '> escalation level: URGENT — agent briefing required',
  '> preparing threat briefing...',
];

function _scrambleText(el, finalText, duration, cb) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&*!?<>{}[]';
  const len = finalText.length;
  const start = performance.now();
  el.style.opacity = '1';
  el.classList.add('show');
  function frame(now) {
    const elapsed = now - start;
    const progress = Math.min(1, elapsed / duration);
    // Characters resolve left-to-right
    const resolved = Math.floor(progress * len);
    let out = '';
    for (let i = 0; i < len; i++) {
      if (finalText[i] === ' ') { out += ' '; continue; }
      if (i < resolved) { out += finalText[i]; }
      else { out += chars[Math.floor(Math.random() * chars.length)]; }
    }
    el.textContent = out;
    if (progress < 1) requestAnimationFrame(frame);
    else { el.textContent = finalText; if (cb) cb(); }
  }
  requestAnimationFrame(frame);
}

function runThreatBriefing() {
  const terminal = document.getElementById('objTerminal');
  const scanLine = document.getElementById('objScanLine');
  const priority = document.getElementById('objPriority');
  const heading  = document.getElementById('objHeading');
  const sub      = document.getElementById('objSub');
  const threats  = [document.getElementById('objT1'), document.getElementById('objT2'), document.getElementById('objT3')];
  const ctaWrap  = document.getElementById('objCtaWrap');
  const cta      = document.getElementById('objCta');

  let t = 0; // running delay in ms

  // Phase 1: Terminal lines trickle in (0–1800ms)
  terminal.classList.add('show');
  OBJ_TERMINAL_LINES.forEach((line, i) => {
    setTimeout(() => {
      const div = document.createElement('div');
      div.textContent = line;
      div.style.animationDelay = '0s';
      terminal.appendChild(div);
    }, t);
    t += 280;
  });

  // Phase 2: Scan line sweeps (1800ms)
  setTimeout(() => { scanLine.classList.add('active'); }, t);
  t += 600;

  // Phase 3: Priority badge appears (2400ms)
  setTimeout(() => { priority.classList.add('show'); }, t);
  t += 400;

  // Phase 4: Heading decrypts (2800ms)
  const headingText = '3 THREATS DETECTED';
  setTimeout(() => { _scrambleText(heading, headingText, 1200); }, t);
  t += 1400;

  // Phase 5: Subtitle fades up (4200ms)
  setTimeout(() => { sub.classList.add('show'); }, t);
  t += 400;

  // Phase 6: Threat cards slide in staggered (4600ms)
  threats.forEach((card, i) => {
    setTimeout(() => { card.classList.add('show'); }, t + i * 220);
  });
  t += threats.length * 220 + 300;

  // Phase 7: CTA appears with glow (5560ms)
  setTimeout(() => {
    ctaWrap.classList.add('show');
    setTimeout(() => cta.classList.add('glow'), 400);
  }, t);

  // Fade terminal after everything is shown
  setTimeout(() => { terminal.style.opacity = '0.15'; }, t + 200);
}

function showObjectivesIfNeeded() {
  const el=document.getElementById('objOverlay');
  el.classList.add('show');
  document.getElementById('objCtaWrap').classList.add('show');
  // Stagger-reveal objectives: title first, then cards
  var objTitle = document.querySelector('#introObjectives .intro-obj-title');
  if(objTitle) setTimeout(function(){ objTitle.classList.add('reveal'); }, 200);
  document.querySelectorAll('#introObjectives .intro-obj-item').forEach(function(item, i) {
    setTimeout(function(){ item.classList.add('reveal'); }, 600 + i * 180);
  });
}
function dismissObjectives() {
  stopVO();
  document.getElementById('objOverlay').classList.remove('show');
  try { localStorage.setItem('adg_objectives_seen', '1'); } catch(e){}
  showScreen('screenMenu');
}

// ════════════════════════════════════════════
//  BOOT
// ════════════════════════════════════════════
const BOOT_STEPS=['LOADING TRAINING MODULES...','ANALYSIS ENGINE READY...','THREE SCENARIOS LOADED...','INTEGRITY MONITOR READY...','BRIEFING LOADED...','READY \u2014 LET\u2019S BEGIN.'];
function boot() {
  const msgEl=document.getElementById('bootMsg');
  const fillEl=document.getElementById('bootFill');
  let step=0;
  const iv=setInterval(()=>{
    if(step>=BOOT_STEPS.length){
      clearInterval(iv);
      document.getElementById('boot').classList.add('hidden');
      showObjectivesIfNeeded();
      setTimeout(()=>{ document.getElementById('boot').style.display='none'; },900);
      return;
    }
    msgEl.textContent=BOOT_STEPS[step];
    fillEl.style.width=((step+1)/BOOT_STEPS.length*100)+'%';
    step++;
  },380);
}

// ════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════
window.addEventListener('load', ()=>{
  preloadAudio();
  // Always start fresh — clear saved progress on every page load
  try { localStorage.removeItem('adg_progress'); localStorage.removeItem('adg_objectives_seen'); } catch(e){}
  loadMuteState();
  updateMenuState();
  runSplashLoader();
  setTimeout(boot, 200);
});

// ════════════════════════════════════════════
//  MOBILE DIAG PANEL TOGGLE
// ════════════════════════════════════════════
function toggleDiag(btn) {
  const diag = btn.closest('.diag');
  const isOpen = diag.classList.toggle('panel-open');
  const lbl = btn.querySelector('.diag-toggle-lbl');
  if (lbl) lbl.textContent = isOpen ? '▼  CLOSE PANEL' : '▲  ANALYSIS PANEL';
}

// ════════════════════════════════════════════
//  PAUSE / RESUME
// ════════════════════════════════════════════
let _paused = false;

function _getActiveSection() {
  if (s1state.gameActive) return 's1';
  if (s2state.gameActive) return 's2';
  if (s3state.gameActive) return 's3';
  return null;
}

function togglePause() {
  const sec = _getActiveSection();
  if (!sec && !_paused) return; // nothing running, nothing to pause
  pClick();
  _paused = !_paused;
  const overlay = document.getElementById('pauseOverlay');
  overlay.classList.toggle('show', _paused);

  if (_paused) {
    // Close any open classification popup so it doesn't sit behind the overlay
    if (sec === 's1') s1ClosePopup();
    if (sec === 's2') s2ClosePopup();
    if (sec === 's3') s3ClosePopup();
    // Pause timers/drains for active section
    if (sec === 's1') { clearInterval(s1state.drainInt); }
    if (sec === 's3') { clearInterval(s3state.globalTimerInt); }
    // Mute audio while paused (without toggling the mute preference)
    _muteAllSND(true);
    // Switch to play icon
    const pi=document.getElementById('pauseIcon'); if(pi) pi.innerHTML='<polygon points="4,2 14,8 4,14"/>';
  } else {
    // Resume — switch back to pause icon
    const pi=document.getElementById('pauseIcon'); if(pi) pi.innerHTML='<rect x="3" y="2" width="3.5" height="12" rx="1"/><rect x="9.5" y="2" width="3.5" height="12" rx="1"/>';
    const pl=document.querySelector('#pauseBtn .ctrl-lbl'); if(pl) pl.textContent='PAUSE';
    // Restore mute state
    _muteAllSND(_muted);
    // Restart drain / timer for active section
    if (sec === 's1' && s1state.gameActive && !s1AllSecured()) {
      s1state.drainInt = setInterval(()=>{
        if(!s1state.gameActive||s1state.insightOpen) return;
        s1state.integrity = Math.max(0, s1state.integrity - s1GetDrain()*(100/1000));
        document.getElementById('s1iwDrain').textContent = '▼ data exposed';
        document.getElementById('s1iwDrain').className = 'ib-drain-label draining';
        updateIntUI('s1', s1state.integrity, s1GetDrain(), S1_MAX_DRAIN);
        if(s1state.integrity <= 0) s1EndGame('breach');
      }, 100);
    }
    if (sec === 's3' && s3state.gameActive) {
      s3StartGlobalTimer();
    }
  }
}

function pauseQuitToMenu() {
  _paused = false;
  document.getElementById('pauseOverlay').classList.remove('show');
  _muteAllSND(_muted); // restore audio state before goMenu
  goMenu();
}

// Abort mission — confirmation overlay
function showAbortConfirm() {
  pBleep();
  // Pause gameplay while confirming
  if (!_paused && _getActiveSection()) togglePause();
  document.getElementById('abortOverlay').classList.add('show');
}
function confirmAbort() {
  document.getElementById('abortOverlay').classList.remove('show');
  // If paused (we auto-paused on open), clean up pause state
  if (_paused) {
    _paused = false;
    document.getElementById('pauseOverlay').classList.remove('show');
  }
  _muteAllSND(_muted);
  goMenu();
}
function cancelAbort() {
  pBleep();
  document.getElementById('abortOverlay').classList.remove('show');
  // Resume from auto-pause
  if (_paused) togglePause();
}

// Show/hide pause + abort buttons based on whether a mission is active
function updatePauseBtn() {
  const active = _getActiveSection() !== null;
  const pauseBtn = document.getElementById('pauseBtn');
  const abortBtn = document.getElementById('abortBtn');
  if(pauseBtn) pauseBtn.classList.toggle('visible', active);
  if(abortBtn) abortBtn.classList.toggle('visible', active);
}

// Keyboard shortcut: P to pause/resume, M to mute, Escape to dismiss abort overlay
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const ao = document.getElementById('abortOverlay');
    if (ao && ao.classList.contains('show')) { cancelAbort(); return; }
  }
  if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
  if (e.key === 'p' || e.key === 'P') { if (_getActiveSection() || _paused) togglePause(); }
  if (e.key === 'm' || e.key === 'M') toggleMute();
});

// Auto-pause when tab loses visibility (prevents drain/timer running in background)
document.addEventListener('visibilitychange', () => {
  if (document.hidden && !_paused && _getActiveSection()) togglePause();
});

// ════════════════════════════════════════════
//  BEFOREUNLOAD GUARD
// ════════════════════════════════════════════
window.addEventListener('beforeunload', e => {
  if (_getActiveSection()) {
    e.preventDefault();
    e.returnValue = ''; // Required for Chrome to show the dialog
  }
});


/* ═══════════════════════════════════════════════════════════
   INSIGHT LIGHTBOX ENGINE
═══════════════════════════════════════════════════════════ */
const INSIGHT_TONE = {
  '[CREDENTIALS]': 'credential', '[PERSONAL DATA]': 'pii', '[INTERNAL INFO]': 'internal',
  'Wrong Category': 'warn', 'False Alarm': 'warn', 'Missed': 'warn', 'Timeout': 'warn',
  'Fake Citation': 'credential', 'Wrong Figure': 'pii', 'Fake Law': 'internal',
  'Invented Detail': 'internal', 'Unsupported Claim': 'credential',
  'Accurate': 'neutral', 'Safe': 'neutral', 'Accurate Claim': 'neutral', 'Safe Item': 'neutral', 'Injection Found': 'ok', 'Document Cleared': 'ok',
  'FLAG': 'warn', 'LOOKS ACCURATE': 'neutral',
};

// Map user-facing choice labels to tones for badge colouring
const CHOICE_TONE = {
  'credential': 'credential', 'pii': 'pii', 'internal': 'internal', 'safe': 'neutral',
  'citation': 'credential', 'figure': 'pii', 'law': 'internal', 'accurate': 'neutral',
  'flag': 'warn', 'injection': 'warn', 'not-injection': 'ok',
};
// Friendly labels for raw choice keys
const CHOICE_LABEL = {
  'credential': '[CREDENTIALS]', 'pii': '[PERSONAL DATA]', 'internal': '[INTERNAL INFO]', 'safe': 'SAFE',
  'citation': 'Fake Citation', 'figure': 'Wrong Figure', 'law': 'Fake Law',
  'flag': 'FLAG', 'accurate': 'LOOKS ACCURATE', 'injection': 'INJECTION', 'not-injection': 'SAFE',
};

let _insightCallback = null;

/**
 * Unified feedback lightbox.
 * @param {string} category     — correct category label (e.g. '[CREDENTIALS]', 'Fake Law', 'Injection Found')
 * @param {string} tokenText    — the text the user clicked on (shown in quote box)
 * @param {string} message      — explanation / teaching text
 * @param {Function} onDismiss  — callback after user clicks UNDERSTOOD
 * @param {string|null} graphicHtml — (deprecated, ignored) kept for signature compat
 * @param {boolean} isCorrect   — whether the user got it right
 * @param {string|null} userChoice — raw choice key the user selected (e.g. 'credential', 'citation', 'injection')
 */
function showInsight(category, tokenText, message, onDismiss, graphicHtml, isCorrect, userChoice) {
  const overlay = document.getElementById('insightOverlay');
  const card    = overlay.querySelector('.insight-card');
  const msgEl   = document.getElementById('insightMsg');

  const tone = INSIGHT_TONE[category] || 'warn';
  const isError = !isCorrect;

  // ── Verdict heading ──
  const verdictIcon = document.getElementById('insightVerdictIcon');
  const verdictText = document.getElementById('insightVerdictText');
  if(isCorrect) {
    verdictIcon.textContent = '✓';
    verdictText.textContent = 'CONFIRMED';
  } else {
    verdictIcon.textContent = '✗';
    verdictText.textContent = 'MISCLASSIFIED';
  }

  // ── Apply mode and restart animation ──
  card.classList.remove('error-mode', 'correct-mode');
  void card.offsetWidth;
  if(isError) card.classList.add('error-mode');
  else card.classList.add('correct-mode');

  // ── Flagged element quote box ──
  const elemBox  = document.getElementById('insightElementBox');
  const elemText = document.getElementById('insightElementText');
  if(tokenText) {
    elemText.textContent = tokenText;
    elemBox.classList.add('show');
  } else {
    elemBox.classList.remove('show');
    elemText.textContent = '';
  }

  // ── Category comparison row ──
  const compEl = document.getElementById('insightComparison');
  compEl.innerHTML = '';
  compEl.classList.remove('show', 'single');

  const correctTone = tone;
  const noBadgeCategories = ['Timeout', 'Missed'];

  if(!noBadgeCategories.includes(category)) {
    if(!isCorrect && userChoice) {
      // Show: YOUR ANSWER (struck-through) → ACTUAL ANSWER
      const userTone = CHOICE_TONE[userChoice] || 'warn';
      const userLabel = CHOICE_LABEL[userChoice] || userChoice;
      compEl.innerHTML =
        '<div>' +
          '<span class="insight-comparison-label">YOUR ANSWER</span>' +
          '<span class="insight-badge insight-badge-' + userTone + ' insight-badge-strikethrough">' + userLabel + ' ✗</span>' +
        '</div>' +
        '<span class="insight-comparison-arrow">→</span>' +
        '<div>' +
          '<span class="insight-comparison-label">ACTUAL</span>' +
          '<span class="insight-badge insight-badge-' + correctTone + '">' + category + '</span>' +
        '</div>';
      compEl.classList.add('show');
    } else {
      // Single badge — correct answer confirmation
      compEl.innerHTML = '<span class="insight-badge insight-badge-' + correctTone + '">' + category + '</span>';
      compEl.classList.add('show', 'single');
    }
  }

  // ── Explanation text (plain, no inline badge) ──
  if(message) {
    msgEl.textContent = message;
  } else {
    msgEl.textContent = '';
  }

  _insightCallback = onDismiss || null;
  overlay.classList.add('show');
  setTimeout(()=>{ const btn=document.getElementById('insightBtn'); if(btn) btn.focus(); }, 120);
}

function dismissInsight() {
  const overlay = document.getElementById('insightOverlay');
  overlay.classList.remove('show');
  const cb = _insightCallback;
  _insightCallback = null;
  if(cb) cb();
}
function forceCloseInsight() {
  _insightCallback = null;
  document.getElementById('insightOverlay').classList.remove('show');
}

// ════════════════════════════════════════════
//  TOAST NOTIFICATIONS
// ════════════════════════════════════════════
let _toastTimer = null;
function showToast(label, message) {
  const el = document.getElementById('successToast');
  document.getElementById('toastLabel').textContent = label;
  document.getElementById('toastText').textContent = message;
  clearTimeout(_toastTimer);
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
}
function dismissToast() {
  clearTimeout(_toastTimer);
  document.getElementById('successToast').classList.remove('show');
}

// ════════════════════════════════════════════
//  SHARED VERDICT FUNCTIONS
// ════════════════════════════════════════════
function vAdvance(prefix, step) {
  if(step>1) { stopVO(); pClick(); } // VO only on Step 1
  for(let i=1;i<=2;i++){
    const el=document.getElementById(prefix+'vStep'+i);
    if(el) el.style.display=(i===step)?'':'none';
  }
  // Update step progress dots inside active step's v-body
  const activeStep = document.getElementById(prefix+'vStep'+step);
  if(activeStep) {
    // Remove any existing prog row
    const existing = activeStep.querySelector('.v-step-prog');
    if(!existing) {
      const body = activeStep.querySelector('.v-body');
      if(body) {
        const prog = document.createElement('div');
        prog.className = 'v-step-prog';
        for(let d=1;d<=2;d++) {
          const dot = document.createElement('span');
          dot.className = 'vsp-dot' + (d < step ? ' done' : d === step ? ' active' : '');
          prog.appendChild(dot);
        }
        const eyebrow = body.querySelector('.v-eyebrow');
        if(eyebrow) {
          const wrapper = document.createElement('div');
          wrapper.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;';
          eyebrow.parentNode.insertBefore(wrapper, eyebrow);
          eyebrow.style.marginBottom = '0';
          prog.style.marginBottom = '0';
          prog.style.flexShrink = '0';
          wrapper.appendChild(eyebrow);
          wrapper.appendChild(prog);
        } else {
          body.insertBefore(prog, body.firstChild);
        }
      }
    }
  }
  const overlay=document.getElementById(prefix+'verdict');
  if(overlay) overlay.scrollTop=0;
}

function renderVerdictStars(elId, starCount) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.className = 'v-mv v-stars';
  el.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const span = document.createElement('span');
    span.className = 'v-star ' + (i < starCount ? 'filled star-glow' : 'empty');
    span.textContent = i < starCount ? '★' : '☆';
    el.appendChild(span);
  }
}

// ════════════════════════════════════════════
//  ACCESSIBILITY UTILITIES
// ════════════════════════════════════════════

// ── Focus Trapping ──────────────────────────
function trapFocus(container) {
  const focusable = container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if(!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  container._trapHandler = function(e) {
    if(e.key !== 'Tab') return;
    if(e.shiftKey) {
      if(document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if(document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  container.addEventListener('keydown', container._trapHandler);
  first.focus();
}
function releaseFocus(container) {
  if(container._trapHandler) {
    container.removeEventListener('keydown', container._trapHandler);
    delete container._trapHandler;
  }
}

// ── Manage aria-hidden on background when dialogs open ──
function setBackgroundInert(dialogEl) {
  document.querySelectorAll('.screen.active, #mainContent').forEach(el => {
    if(!dialogEl.contains(el) && el !== dialogEl) el.setAttribute('aria-hidden', 'true');
  });
}
function clearBackgroundInert() {
  document.querySelectorAll('.screen.active, #mainContent').forEach(el => {
    el.removeAttribute('aria-hidden');
  });
}

// ── Patch showScreen for document.title + focus ──
const _origShowScreen = showScreen;
showScreen = function(id) {
  _origShowScreen(id);
  const titles = {
    splashScreen: 'Cybersecurity Training — Welcome',
    bootScreen: 'Cybersecurity Training — Loading',
    objScreen: 'Cybersecurity Training — Objectives',
    screenMenu: 'Cybersecurity Training — Mission Select',
    screenS1: 'Mission 01 — Data Leakage',
    screenS2: 'Mission 02 — AI Hallucination',
    screenS3: 'Mission 03 — Prompt Injection'
  };
  document.title = titles[id] || 'Cybersecurity Awareness Training';
  const target = document.getElementById(id);
  if(target) {
    const h = target.querySelector('h1, h2, [tabindex="-1"]');
    if(h) { h.setAttribute('tabindex', '-1'); h.focus({preventScroll: true}); }
  }
};

// ── Patch dialog open/close for focus management ──
(function() {
  const popupMap = {
    s1catPopup: { closeFn: 's1ClosePopup', stateKey: 's1state' },
    s2halPopup: { closeFn: 's2ClosePopup', stateKey: 's2state' },
    s3injPopup: { closeFn: 's3ClosePopup', stateKey: 's3state' }
  };

  const observer = new MutationObserver(mutations => {
    mutations.forEach(m => {
      if(m.attributeName !== 'class') return;
      const el = m.target;
      const id = el.id;
      if(!id) return;

      const isDialog = el.hasAttribute('role') && el.getAttribute('role') === 'dialog';
      if(!isDialog) return;

      const isShown = el.classList.contains('show');
      if(isShown) {
        el._prevFocus = document.activeElement;
        setBackgroundInert(el);
        trapFocus(el);
        el._escHandler = function(e) {
          if(e.key === 'Escape') {
            if(popupMap[id] && window[popupMap[id].closeFn]) window[popupMap[id].closeFn]();
            else if(id === 'certOverlay' && typeof closeCert === 'function') closeCert();
            else if(id === 'insightOverlay' && typeof forceCloseInsight === 'function') forceCloseInsight();
            else if(id === 'pauseOverlay' && typeof resumeGame === 'function') resumeGame();
            else el.classList.remove('show');
          }
        };
        document.addEventListener('keydown', el._escHandler);
      } else {
        releaseFocus(el);
        clearBackgroundInert();
        if(el._escHandler) { document.removeEventListener('keydown', el._escHandler); delete el._escHandler; }
        if(el._prevFocus && el._prevFocus.focus) {
          try { el._prevFocus.focus(); } catch(e) {}
          delete el._prevFocus;
        }
      }
    });
  });

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[role="dialog"]').forEach(el => {
      observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    });
  });
})();

// ── Verdict overlay focus management ──
(function() {
  const verdictIds = ['s1verdict', 's2verdict', 's3verdict'];
  const observer = new MutationObserver(mutations => {
    mutations.forEach(m => {
      if(m.attributeName !== 'class') return;
      const el = m.target;
      if(!verdictIds.includes(el.id)) return;
      if(el.classList.contains('show')) {
        document.title = el.id.replace('s','Mission 0').replace('verdict',' — Results');
        setTimeout(() => {
          setBackgroundInert(el);
          trapFocus(el);
        }, 500);
      } else {
        releaseFocus(el);
        clearBackgroundInert();
      }
    });
  });
  document.addEventListener('DOMContentLoaded', () => {
    verdictIds.forEach(id => {
      const el = document.getElementById(id);
      if(el) observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    });
  });
})();

// ── ARIA live regions for integrity/timer ──
document.addEventListener('DOMContentLoaded', () => {
  ['s1iwNum','s2iwNum','s3iwNum'].forEach(id => {
    const el = document.getElementById(id);
    if(el) {
      const wrap = el.closest('.ib-num-wrap') || el.parentElement;
      wrap.setAttribute('aria-live', 'polite');
      wrap.setAttribute('aria-atomic', 'true');
      wrap.setAttribute('role', 'status');
    }
  });
  const timer = document.getElementById('s3timerVal');
  if(timer) {
    const wrap = timer.closest('.sb-timer') || timer.parentElement;
    wrap.setAttribute('aria-live', 'assertive');
    wrap.setAttribute('aria-atomic', 'true');
    wrap.setAttribute('role', 'timer');
  }
});

// ── Name input validation: aria-invalid ──
(function() {
  const origSplashBegin = window.splashBegin;
  window.splashBegin = function() {
    const nameInput = document.getElementById('splashNameInput');
    nameInput.removeAttribute('aria-invalid');
    const nameHint = document.getElementById('splashNameHint');
    if(nameHint) nameHint.removeAttribute('role');
    origSplashBegin.call(this);
  };

  document.addEventListener('DOMContentLoaded', () => {
    const ni = document.getElementById('splashNameInput');
    if(ni) ni.addEventListener('input', () => {
      ni.removeAttribute('aria-invalid');
      const h = document.getElementById('splashNameHint');
      if(h) h.removeAttribute('role');
    });
  });
})();

// ── Certificate overlay: title update ──
(function() {
  const origShowCert = window.showCert;
  if(origShowCert) {
    window.showCert = function() {
      origShowCert.apply(this, arguments);
      document.title = 'Cybersecurity Training — Certificate';
    };
  }
  const origCloseCert = window.closeCert;
  if(origCloseCert) {
    window.closeCert = function() {
      origCloseCert.apply(this, arguments);
      document.title = 'Cybersecurity Training — Mission Select';
    };
  }
})();
