// ════════════════════════════════════════════
//  GAME STATE
// ════════════════════════════════════════════
let tokState = freshTokenState();
let integrity = 100;
let timeLeft = 120;
let gameActive = false;
let startTime = 0;
let scansLeft = 3;
let scansUsed = 0;
let classifyErrors = 0;
let safeConfirmed = 0;
let safeBonus = 0; // accumulates drain reduction from correctly confirmed safe tokens
let timerInt = null, drainInt = null;
let activePopupTokenId = null;

// Max drain rate: 0.16 base + 0.56×2 cred + 0.16×2 pii + 0.064 intel = 1.664%/s
const MAX_DRAIN = 1.664;
let _prevDrainRate = 0;

// ════════════════════════════════════════════
//  DIAGNOSTICS UPDATE
// ════════════════════════════════════════════
const CAT_EXPOSED_CLASS = { credential:'exposed', pii:'exposed-pii', internal:'exposed-int' };
const CAT_DOT_CLASS     = { credential:'exposed', pii:'exposed-pii', internal:'exposed-int' };

function updateDiag(cat, tokenId) {
  const key  = catKey(cat);

  // Fill the next unfilled segment from left (left-to-right fill)
  const cont = document.getElementById(`segs${key}`);
  if (cont) {
    const next = cont.querySelector('.dc-seg:not(.secured)');
    if (next) next.classList.add('secured');
  }

  const ids  = CAT_TOKENS[cat];
  const total = ids.length;
  const secured = ids.filter(id => tokState[id].redacted).length;
  const left = total - secured;
  const catEl = document.getElementById(`cat${key}`);

  // Update progress bar — fill proportionally to tokens secured
  const progEl = document.getElementById(`prog${key}`);
  if (progEl) {
    progEl.style.width = Math.round((secured / total) * 100) + '%';
  }

  // Positive pulse across whole panel
  catEl.classList.remove('pulse');
  void catEl.offsetWidth;
  catEl.classList.add('pulse');
  setTimeout(() => catEl.classList.remove('pulse'), 750);

  if (left === 0) {
    catEl.className = 'diag-cat secured';
    document.getElementById(`pill${key}`).className = 'dc-pill secured';
    document.getElementById(`pill${key}`).textContent = 'SECURED';
    // Full green bar on secured
    if (progEl) { progEl.style.width = '100%'; }
  }
}

// ════════════════════════════════════════════
//  INTEGRITY DRAIN
// ════════════════════════════════════════════
function allSecured() {
  return ['apikey','password','name','email','project'].every(id => tokState[id].redacted);
}

function getDrain() {
  if (allSecured()) return 0;
  let r = 0.16;
  ['apikey','password'].forEach(id => { if (!tokState[id].redacted) r += 0.56; });
  ['name','email'].forEach(id => { if (!tokState[id].redacted) r += 0.16; });
  if (!tokState.project.redacted) r += 0.064;
  r = Math.max(0.05, r - safeBonus); // safe tokens reduce drain, floor at 0.05
  return r;
}

function startDrain() {
  const TICK = 100;
  drainInt = setInterval(() => {
    if (!gameActive) return;
    integrity = Math.max(0, integrity - getDrain() * TICK / 1000);
    updateIntUI();
    if (integrity <= 0) endGame('breach');
  }, TICK);
}

function startTimer() {
  timerInt = setInterval(() => {
    if (!gameActive) return;
    timeLeft--;
    if (timeLeft <= 0) endGame('timeout');
  }, 1000);
}

// ════════════════════════════════════════════
//  START (triggered by briefing button)
// ════════════════════════════════════════════
function startGame() {
  const overlay = document.getElementById('briefingOverlay');
  overlay.classList.add('hidden');
  setTimeout(() => overlay.style.display = 'none', 600);

  stopVoiceover();
  gameActive = true;
  startTime = Date.now();
  startTimer();
  startDrain();
  // Free scan on first load — shows all tokens to orient the learner
  setTimeout(() => runScan(true), 1800);
  // Nudge the attachment chip so learner knows to open it
  setTimeout(() => {
    const chip = document.querySelector('.gpt-attach-chip');
    if (chip) chip.classList.add('nudge');
  }, 2400);
}

// ════════════════════════════════════════════
//  END GAME
// ════════════════════════════════════════════
function submitGame() { endGame('submit'); }

function endGame(reason) {
  if (!gameActive) return;
  gameActive = false;
  clearInterval(timerInt); clearInterval(drainInt);

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  const intFinal = Math.max(0, Math.round(integrity));
  const credLeft  = CAT_TOKENS.credential.filter(id => !tokState[id].redacted).length;
  const piiLeft   = CAT_TOKENS.pii.filter(id => !tokState[id].redacted).length;
  const intLeft   = CAT_TOKENS.internal.filter(id => !tokState[id].redacted).length;
  const totalLeft = credLeft + piiLeft + intLeft;

  let cls, sys, syscls;
  if (reason === 'breach')         { cls='fail';    sys='COMPROMISED'; syscls='breached'; }
  else if (totalLeft===0 && classifyErrors===0) { cls='pass'; sys='CONTAINED'; syscls='contained'; }
  else if (totalLeft===0)          { cls='pass';    sys='CONTAINED'; syscls='contained'; }
  else if (totalLeft<=2)           { cls='partial'; sys='AT RISK';   syscls='partial'; }
  else                             { cls='fail';    sys='COMPROMISED'; syscls='breached'; }

  if (cls === 'pass' && audioReady) setTimeout(playSuccess, 450);
  if ((cls === 'fail') && audioReady) setTimeout(playError, 450);

  // SCORM: report score and completion
  scormSetScore(intFinal, 0, 100);
  scormSetCompletion(cls === 'pass' || cls === 'partial');

  // Show/hide verdict graphics
  const sg = document.getElementById('vSuccessGraphic');
  const fg = document.getElementById('vFailGraphic');
  sg.style.display = 'none'; fg.style.display = 'none';
  sg.classList.remove('animate'); fg.classList.remove('animate');
  if (cls === 'pass') {
    sg.style.display = 'flex';
    setTimeout(() => sg.classList.add('animate'), 50);
    // Stop ring pulse after 2 seconds
    setTimeout(() => {
      sg.querySelectorAll('.ring').forEach(r => r.classList.add('frozen'));
    }, 2000);
  } else if (cls === 'fail') {
    fg.style.display = 'flex';
  }

  const rid = 'RPT-' + Date.now().toString(36).toUpperCase().slice(-6);
  document.getElementById('vBar').className = `v-bar ${cls}`;

  const iEl = document.getElementById('vInt');
  if (iEl) iEl.textContent = intFinal + '%';
  iEl.className = `v-mv ${intFinal>60?'green':intFinal>30?'orange':'red'}`;

  document.getElementById('vCred').textContent  = credLeft===0  ? 'Mitigated' : credLeft+' Still Exposed';
  document.getElementById('vCred').className    = `v-rv ${credLeft===0?'green':'red'}`;
  document.getElementById('vPii').textContent   = piiLeft===0   ? 'Mitigated' : piiLeft+' Still Exposed';
  document.getElementById('vPii').className     = `v-rv ${piiLeft===0?'green':'orange'}`;
  document.getElementById('vIntel').textContent = intLeft===0   ? 'Secured'   : 'Exposed';
  document.getElementById('vIntel').className   = `v-rv ${intLeft===0?'green':'yellow'}`;
  document.getElementById('vErrors').textContent = classifyErrors===0 ? 'None' : classifyErrors+' Errors';
  document.getElementById('vErrors').className   = `v-rv ${classifyErrors===0?'green':'red'}`;

  setTimeout(() => document.getElementById('verdictOverlay').classList.add('show'), 400);
}

// ════════════════════════════════════════════
//  RESET
// ════════════════════════════════════════════
function updateSeverityBlocks(rate) {
  const thresholds = [0.08, 0.20, 0.36, 0.52, 0.68, 0.84, 1.00, 1.18, 1.38, 1.55];
  const classes    = ['s1','s2','s3','s4','s5','s6','s7','s8','s9','s10'];
  for (let i = 0; i < 10; i++) {
    const seg = document.getElementById(`ibSeg${i+1}`);
    if (!seg) continue;
    seg.className = 'ib-seg' + (rate > thresholds[i] ? ` ${classes[i]}` : '');
  }
}

function flashDrainRate(direction) {
  const el = document.getElementById('iwDrain');
  if (!el) return;
  el.classList.remove('flash-up','flash-down');
  void el.offsetWidth;
  el.classList.add(direction === 'up' ? 'flash-up' : 'flash-down');
  setTimeout(() => el.classList.remove('flash-up','flash-down'), 600);
}

function showIntPop(amount) {
  const el = document.getElementById('iwIntPop');
  if (!el) return;
  el.textContent = (amount > 0 ? '+' : '') + amount + '%';
  el.classList.remove('pop','gain','penalty');
  void el.offsetWidth;
  el.classList.add('pop', amount > 0 ? 'gain' : 'penalty');
}

function flashDelta(amount, msg, type) {
  const el = document.getElementById('iwDelta');
  el.classList.remove('visible','gain','penalty');
  void el.offsetWidth;
  const colClass = type === 'gain' ? 'gain' : type === 'penalty' ? 'penalty' : (amount > 0 ? 'gain' : 'penalty');
  if (amount !== 0) {
    el.textContent = (amount > 0 ? '+' : '') + amount.toFixed(0) + '%  ' + (msg || '');
  } else {
    el.textContent = msg || '';
  }
  el.classList.add('visible', colClass);
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('visible'), 2200);
}

function updateIntUI() {
  const pct = Math.max(0, Math.round(integrity));
  const numEl = document.getElementById('iwNum');
  numEl.textContent = pct;
  const cls = pct > 60 ? 'green' : pct > 30 ? 'orange' : 'red';
  numEl.className = `ib-num ${cls}`;

  // Integrity bar fill
  const bar = document.getElementById('iwIntBar');
  if (bar) { bar.style.width = pct + '%'; bar.className = `ib-bar-fill ${cls}`; }

  const rate = getDrain();
  updateSeverityBlocks(rate);

  // Flash drain rate text if rate changed
  if (Math.abs(rate - _prevDrainRate) > 0.001) {
    flashDrainRate(rate > _prevDrainRate ? 'up' : 'down');
    _prevDrainRate = rate;
  }

  const drainEl  = document.getElementById('iwDrain');
  const ctaEl    = document.getElementById('ibSubmitCta');
  const sevEl    = document.getElementById('ibSeverity');
  const barSubEl = document.querySelector('.ib-bar-sub');
  if (!gameActive) return;
  if (allSecured()) {
    drainEl.textContent = '';
    drainEl.className = 'ib-drain-label secured';
    if (ctaEl)    { ctaEl.style.display  = 'flex'; }
    if (sevEl)    { sevEl.style.opacity  = '0.2'; }
    if (barSubEl) { barSubEl.style.display = 'none'; }
    const ds = document.getElementById('diagSecured');
    if (ds) { ds.style.display = 'flex'; }
  } else {
    drainEl.textContent = 'active drain';
    drainEl.className = 'ib-drain-label draining';
    if (ctaEl)    { ctaEl.style.display  = 'none'; }
    if (sevEl)    { sevEl.style.opacity  = '1'; }
    if (barSubEl) { barSubEl.style.display = ''; }
    const ds = document.getElementById('diagSecured');
    if (ds) { ds.style.display = 'none'; }
  }
}

function updateSafeCt() { /* no-op — safe counter not displayed */ }
function updateDrainBar() { /* no-op — handled in updateIntUI */ }

function resetGame() {
  stopVoiceover();
  tokState = freshTokenState();
  integrity=100; timeLeft=120; scansLeft=3; scansUsed=0; classifyErrors=0; safeConfirmed=0; safeBonus=0; _prevDrainRate=0;
  clearInterval(timerInt); clearInterval(drainInt);

  document.getElementById('verdictOverlay').classList.remove('show');
  const ds = document.getElementById('diagSecured'); if (ds) ds.style.display = 'none';
  const timerEl = document.getElementById('timerVal');
  if (timerEl) { timerEl.textContent = '120'; timerEl.className = 'sb-timer-val'; }
  document.getElementById('scanCt').textContent   = '3';
  document.getElementById('btnScan').disabled     = false;
  updateIntUI();

  document.getElementById('catCred').className  = 'diag-cat exposed';
  document.getElementById('pillCred').className = 'dc-pill exposed';
  document.getElementById('pillCred').textContent = 'EXPOSED';
  const pCred = document.getElementById('progCred'); if (pCred) pCred.style.width = '0%';

  document.getElementById('catPii').className   = 'diag-cat exposed-pii';
  document.getElementById('pillPii').className  = 'dc-pill exposed-pii';
  document.getElementById('pillPii').textContent = 'EXPOSED';
  const pPii = document.getElementById('progPii'); if (pPii) pPii.style.width = '0%';

  document.getElementById('catInt').className   = 'diag-cat exposed-int';
  document.getElementById('pillInt').className  = 'dc-pill exposed-int';
  document.getElementById('pillInt').textContent = 'EXPOSED';
  const pInt = document.getElementById('progInt'); if (pInt) pInt.style.width = '0%';

  for (let i=1;i<=10;i++) { const s=document.getElementById(`ibSeg${i}`); if(s) s.className='ib-seg'; }
  const ctaEl = document.getElementById('ibSubmitCta');
  const sevEl = document.getElementById('ibSeverity');
  if (ctaEl) ctaEl.style.display = 'none';
  if (sevEl) sevEl.style.opacity = '1';
  document.getElementById('iwDrain').textContent = '— paused —';
  document.getElementById('iwDrain').className   = 'ib-drain-label';
  const barSubEl = document.querySelector('.ib-bar-sub');
  if (barSubEl) barSubEl.style.display = '';
  const intBar = document.getElementById('iwIntBar');
  if (intBar) { intBar.style.width='100%'; intBar.className='ib-bar-fill green'; }
  document.getElementById('iwDelta').classList.remove('visible','gain','penalty');
  const numEl = document.getElementById('iwNum');
  numEl.textContent = '100'; numEl.className = 'ib-num green';

  buildPayload(); buildSegments();

  // Show briefing again + restart voiceover
  const b = document.getElementById('briefingOverlay');
  b.style.display = ''; b.classList.remove('hidden');
  if (audioReady && SND.vo) { SND.vo.currentTime = 0; SND.vo.play().catch(()=>{}); }
}
