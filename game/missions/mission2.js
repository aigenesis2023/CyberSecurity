// ════════════════════════════════════════════
//  SECTION 2 — AI HALLUCINATION
// ════════════════════════════════════════════
const S2_TOKENS = [
  // 5 hallucinations — single FLAG action, type is teaching-only
  { id:'fig1', type:'wrong-figure',      isHal:true,  text:'34% improvement in operational efficiency' },
  { id:'fig2', type:'wrong-figure',      isHal:true,  text:'\u00A3420,000' },
  { id:'det1', type:'invented-detail',   isHal:true,  text:'James Okafor, Head of Digital Transformation' },
  { id:'det2', type:'invented-detail',   isHal:true,  text:'Pinnacle Group\u2019s 2025 Digital Acceleration Strategy' },
  { id:'claim1', type:'unsupported-claim', isHal:true,  text:'expanding the automation pilot to two additional distribution centres in Q1 2026' },
  // 3 accurate tokens (traps)
  { id:'acc1', isHal:false, text:'a three-week delay due to vendor-related issues' },
  { id:'acc2', isHal:false, text:'Six Meridian consultants are currently deployed on-site' },
  { id:'acc3', isHal:false, text:'interim report is scheduled for delivery on 6 December' },
];

const S2_HAL_COUNT = S2_TOKENS.filter(t => t.isHal).length; // 5

let s2state = {
  tokState:{}, integrity:100, gameActive:false, drainInt:null,
  flagsCorrect:0, flagsWrong:0, activeToken:null,
  cooldownUntil:0, currentSection:1,
};

function s2Init() {
  s2state.tokState={};
  S2_TOKENS.forEach(t => { s2state.tokState[t.id]={ flagged:false, isHal:t.isHal, type:t.type||null }; });
  s2state.integrity=100; s2state.gameActive=false;
  s2state.flagsCorrect=0; s2state.flagsWrong=0;
  s2state.activeToken=null; s2state.cooldownUntil=0;
  clearInterval(s2state.drainInt);
  s2BuildPayload();
  updateIntUI('s2',100,0,S1_MAX_DRAIN);
  document.getElementById('s2verdict').classList.remove('show');
  document.getElementById('s2flagCount').textContent='0';
  document.getElementById('s2mbFlagCounter').textContent='0 / '+S2_HAL_COUNT;
  document.getElementById('s2flagStatus').textContent='Flag any claim in the AI report that doesn\u2019t match the meeting notes.';
  document.getElementById('s2diagSecured').style.display='none';
  document.getElementById('s2vBonus').style.display='none';
  // Reset single-bar diagnostics segments
  const segsEl = document.getElementById('s2segsAll');
  if(segsEl) segsEl.querySelectorAll('.dc-seg').forEach(s=>s.classList.remove('secured'));
  const pillEl = document.getElementById('s2pillAll');
  if(pillEl){ pillEl.className='dc-pill exposed-cred'; pillEl.textContent='0/'+S2_HAL_COUNT; }
  const catEl = document.getElementById('s2catAll');
  if(catEl) catEl.className='diag-cat hal-cat';
  // Reset to report view
  s2SwitchView('report');
  const b=document.getElementById('s2briefing'); b.style.display=''; b.classList.remove('hidden');
}
function s2Reset() { pBleep(); resumeBG(); document.getElementById('s2verdict').classList.remove('show'); s2Init(); }

// ALL tokens per section — must classify every one before advancing
const S2_SECTION_TOKS = { 1:['fig1','fig2','det1','acc1','acc2'], 2:['det2','claim1','acc3'] };

function s2CheckSectionAdvance() {
  // No-op — single consolidated view, no section advancement needed
}

// Per-token teach messages for M2
// 'correct' shown after a correct flag, 'falseflag' shown after flagging an accurate claim,
// 'missed' shown after marking a hallucination as accurate
const S2_TEACH = {
  fig1: { correct: 'The notes say 27% improvement in process turnaround times \u2014 the AI inflated this to 34% and changed \u201Cturnaround times\u201D to \u201Coperational efficiency\u201D. AI tools routinely adjust figures upward and generalise specific metrics.',
          missed: 'You called this accurate, but the notes say 27% improvement in process turnaround times \u2014 the AI inflated this to 34% and changed \u201Cturnaround times\u201D to \u201Coperational efficiency\u201D. This is exactly how hallucinations survive review: the number is close enough to feel right. Always check the exact figure against the source.',
          label: 'Wrong Figure' },
  fig2: { correct: 'The approved budget was \u00A3400,000 \u2014 not \u00A3420,000. A \u00A320,000 discrepancy in a client report could trigger a budget review or damage trust. Always verify financial figures against source documents.',
          missed: 'You called this accurate, but the approved budget was \u00A3400,000 \u2014 not \u00A3420,000. A \u00A320,000 discrepancy sounds minor, but in a client report it could trigger a budget review or damage trust. Small financial errors are the ones that get through because they feel plausible.',
          label: 'Wrong Figure' },
  det1: { correct: 'The notes identify James Okafor as a Pinnacle Group contact but never mention his job title. \u201CHead of Digital Transformation\u201D sounds plausible, but AI models routinely invent professional titles when they aren\u2019t provided.',
          missed: 'You called this accurate, but the notes never mention James Okafor\u2019s job title. \u201CHead of Digital Transformation\u201D sounds plausible \u2014 and that\u2019s the problem. AI models invent professional titles when they aren\u2019t provided, and they always sound credible. If it\u2019s not in the source material, it\u2019s not verified.',
          label: 'Invented Detail' },
  det2: { correct: 'There is no \u201C2025 Digital Acceleration Strategy\u201D in the meeting notes. The AI invented a formal strategy name to make the report sound more authoritative. Fabricated proper nouns are one of the hardest hallucinations to spot.',
          missed: 'You called this accurate, but there is no \u201C2025 Digital Acceleration Strategy\u201D anywhere in the meeting notes. AI models don\u2019t retrieve facts \u2014 they predict what plausible text looks like. A formal strategy name makes the report sound more authoritative, so the model generates one. Fabricated proper nouns are among the hardest hallucinations to spot because they feel like something you\u2019d expect to exist.',
          label: 'Invented Detail' },
  claim1: { correct: 'The notes mention one distribution centre (Birmingham) with positive results. The AI fabricated a recommendation to expand to Leeds and Bristol \u2014 a concrete action plan that was never discussed. This is the most dangerous type: AI-generated recommendations that sound like agreed decisions.',
            missed: 'You called this accurate, but the notes only mention one distribution centre (Birmingham) with positive results. The AI fabricated a recommendation to expand to Leeds and Bristol \u2014 a concrete action plan that was never discussed. This is the most dangerous type of hallucination: AI-generated recommendations that sound like agreed decisions. The client could act on a plan nobody proposed.',
            label: 'Unsupported Claim' },
  acc1: { falseflag: 'The three-week delay due to vendor-related issues is directly in the meeting notes. Flagging accurate claims as hallucinations can be just as damaging \u2014 it undermines confidence in the parts of the report that are correct.' },
  acc2: { falseflag: 'Six Meridian consultants on-site is confirmed in the meeting notes. Not every specific detail is a hallucination \u2014 the skill is checking each claim against the source.' },
  acc3: { falseflag: 'The 6 December interim report deadline is in the meeting notes. Accurate dates and deadlines should be verified, not assumed wrong.' },
};

// Marcus's meeting notes — the source-of-truth reference document
const S2_MEETING_NOTES = `<div class="s2-notes-title">Marcus\u2019s Meeting Notes \u2014 Pinnacle Group</div>
<ul class="s2-notes-list">
<li>Process turnaround times have improved by <strong>27%</strong> since automation rollout began</li>
<li>Total project budget: <strong>\u00A3400,000</strong> (approved at Q2 board) \u2014 currently tracking within budget</li>
<li>Attendees: Marcus Webb, <strong>James Okafor</strong> (Pinnacle Group)</li>
<li>Current phase running <strong>three weeks behind schedule</strong> \u2014 vendor-related delays on the integration module</li>
<li><strong>Six Meridian consultants</strong> currently deployed on-site at Pinnacle\u2019s Manchester office</li>
<li>Automation pilot covers <strong>one distribution centre (Birmingham)</strong> \u2014 results positive so far</li>
<li>James confirmed <strong>interim report due 6 December</strong> to Pinnacle\u2019s senior leadership</li>
<li>Next review meeting scheduled for June 2026</li>
</ul>`;

function s2BuildPayload() {
  const tMap={};
  S2_TOKENS.forEach(t => { tMap[t.id]=t; });
  const ht = (id) => `<span class="tok hallucination" data-id="${id}" tabindex="0" role="button">${tMap[id].text}</span>`;
  const at = (id) => `<span class="tok accurate-claim" data-id="${id}" tabindex="0" role="button">${tMap[id].text}</span>`;

  // Single consolidated report — all tokens visible at once
  const reportHTML = `
    <h4>PERFORMANCE & BUDGET</h4>
    <p>The Pinnacle Group automation programme has delivered a ${ht('fig1')} across all deployed modules since the initial rollout phase. This represents a significant return on the programme\u2019s ${ht('fig2')} investment, which was approved during the Q2 board review.</p>
    <p>${ht('det1')}, has confirmed that despite ${at('acc1')} on the integration module, the programme remains on track. ${at('acc2')} at Pinnacle\u2019s Manchester office, providing hands-on implementation support.</p>
    <h4>OUTLOOK & RECOMMENDATIONS</h4>
    <p>Looking ahead, the programme is aligned with ${ht('det2')}, which prioritises end-to-end process automation across the supply chain.</p>
    <p>Based on the Birmingham pilot results, we recommend ${ht('claim1')}, starting with the Leeds and Bristol facilities. The ${at('acc3')} to Pinnacle\u2019s senior leadership team.</p>`;

  document.getElementById('s2payload').innerHTML = `
    <div class="ai-scenario-frame">
      <strong>Flag any claim in the AI report that doesn\u2019t match the meeting notes.</strong>
      <div class="s2-view-toggle">
        <button class="s2-view-btn active" id="s2btnReport" onclick="s2SwitchView('report')">AI Report</button>
        <button class="s2-view-btn pulsing" id="s2btnNotes" onclick="s2SwitchView('notes')">Meeting Notes</button>
      </div>
    </div>
    <div class="ai-response-window">
      <div class="ai-response-body" id="s2docBody">${reportHTML}</div>
    </div>
`;

  // Reset payload scroll to top
  document.getElementById('s2payload').scrollTop = 0;

  // Populate the notes view
  var notesView = document.getElementById('s2notesView');
  if(notesView) notesView.innerHTML = `
    <div class="ai-scenario-frame">
      <strong>Use these notes to verify the claims in the AI report.</strong>
      <div class="s2-view-toggle">
        <button class="s2-view-btn" id="s2btnReport2" onclick="s2SwitchView('report')">AI Report</button>
        <button class="s2-view-btn active" id="s2btnNotes2" onclick="s2SwitchView('notes')">Meeting Notes</button>
      </div>
    </div>
    <div class="ai-response-window">
      <div class="s2-notes-docbar"><span class="s2-notes-docicon">▪</span> Meeting Notes — Pinnacle Group</div>
      <div class="ai-response-body">${S2_MEETING_NOTES}</div>
    </div>`;

  // Attach listeners for all tokens
  s2AttachVisibleListeners();
}

function s2SwitchView(view) {
  var payload = document.getElementById('s2payload');
  var notesView = document.getElementById('s2notesView');
  if(!payload || !notesView) return;
  if(view === 'notes') {
    payload.style.display = 'none';
    notesView.style.display = 'block';
    // Stop pulsing once user has seen notes
    var nb = document.getElementById('s2btnNotes');
    if(nb) nb.classList.remove('pulsing');
    var mbN = document.getElementById('s2mbNotes');
    if(mbN) mbN.classList.remove('pulsing');
  } else {
    payload.style.display = 'block';
    notesView.style.display = 'none';
  }
  // Update active states on all sets of buttons (inline + mobile bar)
  var btns = [
    ['s2btnReport','s2btnNotes'],
    ['s2btnReport2','s2btnNotes2'],
    ['s2mbReport','s2mbNotes'],
  ];
  btns.forEach(function(pair){
    var r = document.getElementById(pair[0]);
    var n = document.getElementById(pair[1]);
    if(view === 'notes') {
      if(r) r.classList.remove('active');
      if(n) n.classList.add('active');
    } else {
      if(r) r.classList.add('active');
      if(n) n.classList.remove('active');
    }
  });
  // Scroll to top of whichever view is now shown
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Legacy stubs — sections consolidated into single view
function s2ToggleNotes() { s2SwitchView('notes'); }
function s2NextSection() { /* no-op — single section */ }

function s2AttachVisibleListeners() {
  document.querySelectorAll('#s2payload .tok.hallucination, #s2payload .tok.accurate-claim').forEach(el=>{
    if(!el._s2bound) {
      el._s2bound = true;
      el.addEventListener('click', s2TokenClick);
      el.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' '){e.preventDefault();el.click();} });
    }
  });
}


function s2TokenClick(e) {
  if(!s2state.gameActive) return;
  const id=e.currentTarget.dataset.id;
  if(!s2state.tokState[id] || s2state.tokState[id].flagged) return;
  e.stopPropagation();
  e.preventDefault();
  pClick();
  dismissToast();
  s2state.activeToken=id;
  const popup=document.getElementById('s2halPopup');
  popup._justOpened=true;
  popup.classList.add('show');
  const lbl = popup.querySelector('.cat-popup-lbl');
  if(lbl) lbl.textContent = 'Does this match the notes?';
  // Position popup
  const r=e.currentTarget.getBoundingClientRect();
  let top=r.bottom+8, left=r.left;
  if(window.innerWidth<=768) { popup.style.top=''; popup.style.left=''; }
  else {
    if(left+320>window.innerWidth) left=window.innerWidth-324;
    if(left<8) left=8;
    if(top+140>window.innerHeight) top=Math.max(8, r.top-140);
    popup.style.top=top+'px'; popup.style.left=left+'px';
  }
  setTimeout(()=>{ popup._justOpened=false; }, 100);
}
function s2ClosePopup() { const p=document.getElementById('s2halPopup'); p.classList.remove('show'); p._justOpened=false; s2state.activeToken=null; }
document.addEventListener('mousedown', e => {
  const p=document.getElementById('s2halPopup');
  if(p&&p._justOpened) return;
  if(p&&p.classList.contains('show')&&!p.contains(e.target)) s2ClosePopup();
});

function s2AllClassified() {
  // Check if every token (hallucinations + accurate) has been classified
  return Object.keys(s2state.tokState).every(function(id){ return s2state.tokState[id].flagged; });
}

function s2Classify(chosen) {
  const id=s2state.activeToken; if(!id) return;
  const tok=s2state.tokState[id];
  s2ClosePopup();
  const tokEl2=document.querySelector('#s2payload .tok[data-id="'+id+'"]');
  const tokText2=tokEl2 ? tokEl2.textContent.replace(/[\u2713\u26A0]/g,'').trim() : '';

  // ── PLAYER SAYS "LOOKS ACCURATE" ──
  if(chosen==='accurate') {
    if(!tok.isHal) {
      // Correct — it IS accurate
      pSelected();
      tok.flagged=true;
      const el=document.querySelector('#s2payload .tok[data-id="'+id+'"]');
      if(el){ el.className='tok flagged-wrong'; el.innerHTML='<span class="redact-label">'+el.textContent.trim()+'</span>'; el.removeEventListener('click',s2TokenClick); }
      updateIntUI('s2',s2state.integrity,0,S1_MAX_DRAIN);
      if(S2_TEACH[id]&&S2_TEACH[id].falseflag) {
        s2ShowInsight('LOOKS ACCURATE', tokText2, 'Correct \u2014 this claim is in the meeting notes.', function(){ flashDelta('s2', 0, 'accurate \u2014 good call'); s2CheckAllDone(); }, null, true, 'accurate');
      } else {
        flashDelta('s2', 0, 'accurate \u2014 good call');
        s2CheckAllDone();
      }
    } else {
      // MISS — hallucination called accurate — locked, no retry
      pWrong(); tok.flagged=true; s2state.integrity=Math.max(0,s2state.integrity-20);
      s2FlashTok(id,'red');
      const el=document.querySelector('#s2payload .tok[data-id="'+id+'"]');
      if(el){ el.className='tok flagged-missed'; el.innerHTML='<span class="redact-label">'+el.textContent.trim()+'</span>\u2717'; el.removeEventListener('click',s2TokenClick); }
      updateIntUI('s2',s2state.integrity,0,S1_MAX_DRAIN);
      if(s2state.integrity<=0) { s2EndGame('breach'); return; }
      var missMsg = S2_TEACH[id] ? (S2_TEACH[id].missed || S2_TEACH[id].correct) : '';
      s2ShowInsight('FLAG', tokText2, missMsg, function(){ showIntPop('s2',-20); flashDelta('s2',-20,'missed hallucination'); s2CheckAllDone(); }, null, false, 'accurate');
    }
    return;
  }

  // ── PLAYER SAYS "FLAG" ──
  if(!tok.isHal) {
    // False flag — accurate claim flagged as hallucination — locked, no retry
    pWrong(); tok.flagged=true; s2state.integrity=Math.max(0,s2state.integrity-18); s2state.flagsWrong++;
    s2FlashTok(id,'red');
    const el=document.querySelector('#s2payload .tok[data-id="'+id+'"]');
    if(el){ el.className='tok flagged-missed'; el.innerHTML='<span class="redact-label">'+el.textContent.trim()+'</span>\u2717'; el.removeEventListener('click',s2TokenClick); }
    updateIntUI('s2',s2state.integrity,0,S1_MAX_DRAIN);
    if(s2state.integrity<=0) { s2EndGame('breach'); return; }
    var ffMsg = (S2_TEACH[id]&&S2_TEACH[id].falseflag) || 'This claim is in the meeting notes \u2014 flagging accurate content damages your credibility.';
    s2ShowInsight('LOOKS ACCURATE', tokText2, ffMsg, function(){ showIntPop('s2',-18); flashDelta('s2',-18,'false alarm'); s2CheckAllDone(); }, null, false, 'flag');
    return;
  }

  // Correct flag — hallucination identified (no integrity reward — this is the expected job)
  pSelected(); tok.flagged=true; s2state.flagsCorrect++;
  var el=document.querySelector('#s2payload .tok[data-id="'+id+'"]');
  if(el){ el.className='tok flagged-correct-figure'; el.innerHTML='<span class="redact-label">'+el.textContent.trim()+'</span>'; el.removeEventListener('click',s2TokenClick); }
  updateIntUI('s2',s2state.integrity,0,S1_MAX_DRAIN);
  s2UpdateDiag();
  var total=s2state.flagsCorrect;
  document.getElementById('s2flagCount').textContent=total;
  document.getElementById('s2mbFlagCounter').textContent=total+' / '+S2_HAL_COUNT;
  var allHalsFlagged = total>=S2_HAL_COUNT;
  if(allHalsFlagged) {
    document.getElementById('s2flagStatus').textContent='All hallucinations flagged.';
    document.getElementById('s2diagSecured').style.display='flex';
    document.getElementById('s2iwDrain').textContent='\u2713 report verified';
    document.getElementById('s2iwDrain').className='ib-drain-label secured';
  }
  if(S2_TEACH[id]&&S2_TEACH[id].correct) {
    s2ShowInsight('FLAG', tokText2, S2_TEACH[id].correct, function(){ flashDelta('s2', 0, 'hallucination flagged'); s2CheckAllDone(); }, null, true, 'flag');
  } else {
    flashDelta('s2', 0, 'hallucination flagged');
    s2CheckAllDone();
  }
}

function s2CheckAllDone() {
  if(s2AllClassified() && s2state.gameActive) {
    setTimeout(function(){ s2Submit(); }, 600);
    return;
  }
  // Auto-complete remaining safe tokens once all hallucinations are found
  if(s2state.flagsCorrect >= S2_HAL_COUNT) {
    var remaining = Object.keys(s2state.tokState).filter(function(id){ return !s2state.tokState[id].flagged; });
    if(remaining.length > 0) {
      s2ClosePopup();
      remaining.forEach(function(id, i) {
        setTimeout(function() {
          s2state.tokState[id].flagged = true;
          var el = document.querySelector('#s2payload .tok[data-id="'+id+'"]');
          if(el){ el.className='tok flagged-wrong'; el.innerHTML='<span class="redact-label">'+el.textContent.trim()+'</span>'; el.removeEventListener('click',s2TokenClick); }
          // After the last one, submit
          if(i === remaining.length - 1) {
            setTimeout(function(){ s2Submit(); }, 400);
          }
        }, 300 * (i + 1));
      });
    }
  }
}
function s2FlashTok(id,color) {
  var el=document.querySelector('#s2payload .tok[data-id="'+id+'"]'); if(!el) return;
  el.style.background=color==='red'?'rgba(239,68,68,.22)':'rgba(74,222,128,.15)';
  setTimeout(function(){ el.style.background=''; },700);
}
function s2UpdateDiag() {
  var cnt=s2state.flagsCorrect;
  // Update single category bar segments
  var cont=document.getElementById('s2segsAll');
  if(cont){ var next=cont.querySelector('.dc-seg:not(.secured)'); if(next) next.classList.add('secured'); }
  var pill=document.getElementById('s2pillAll');
  if(pill) pill.textContent=cnt+'/'+S2_HAL_COUNT;
  if(cnt>=S2_HAL_COUNT) {
    var catEl=document.getElementById('s2catAll');
    if(catEl) catEl.className='diag-cat hal-cat secured';
    if(pill) pill.className='dc-pill secured';
  }
}
function s2Start() {
  stopVO(); pauseBG();
  var b=document.getElementById('s2briefing'); b.classList.add('hidden'); setTimeout(function(){ b.style.display='none'; },600);
  s2state.gameActive=true;
  // Reset all scroll positions — page and payload
  var s2ResetScroll = function(){
    window.scrollTo(0,0);
    document.getElementById('s2payload').scrollTop = 0;
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };
  s2ResetScroll();
  // After briefing display:none, re-settle layout
  setTimeout(s2ResetScroll, 650);
  // Final reset after scan animation to catch any layout shifts
  setTimeout(s2ResetScroll, 1050);
  updatePauseBtn();
  document.getElementById('s2iwDrain').textContent='under review';
  document.getElementById('s2iwDrain').className='ib-drain-label draining';
  // Gentle drain: 0.3%/min = 0.005%/s
  s2state.drainInt = setInterval(function(){
    if(!s2state.gameActive) return;
    s2state.integrity = Math.max(0, s2state.integrity - 0.0005);
    updateIntUI('s2', s2state.integrity, 0, S1_MAX_DRAIN);
    if(s2state.integrity<=0) s2EndGame('breach');
  }, 100);
  setTimeout(function(){
    var sl=document.getElementById('s2scanline'); sl.classList.remove('run'); void sl.offsetWidth; sl.classList.add('run');
    document.querySelectorAll('#s2payload .tok.hallucination').forEach(function(el,i){
      setTimeout(function(){ el.classList.add('hint-scan'); setTimeout(function(){ el.classList.remove('hint-scan'); },1500); },i*120+200);
    });
  },800);
}
function s2Submit() {
  if(!s2state.gameActive) return;
  s2EndGame('submit');
}
function s2EndGame(reason) {
  if(!s2state.gameActive) return; s2state.gameActive=false;
  dismissToast();
  // Switch back to report view
  s2SwitchView('report');
  vAdvance('s2',1);
  document.getElementById('s2vBonus').style.display='none';
  updatePauseBtn();
  clearInterval(s2state.drainInt);
  var intFinal=Math.max(0,Math.round(s2state.integrity));
  var S2_MIN_HALS = 4; // must catch at least 4 of 5 hallucinations to pass
  var S2_MIN_INTEGRITY = 30; // must retain at least 30% integrity
  var pass=(reason!=='breach')&&intFinal>=S2_MIN_INTEGRITY&&s2state.flagsCorrect>=S2_MIN_HALS;
  var precisionPass = pass && s2state.flagsCorrect>=S2_HAL_COUNT && s2state.flagsWrong===0;
  if(pass){ pSuccess(); courseProgress.s2done=true; saveProgress(); }
  else pError();
  setTimeout(()=>playVO(pass?'VO-M2-PASS':'VO-M2-FAIL'),600);
  scormReport(intFinal, pass, 's2');
  var sg=document.getElementById('s2vSuccess'), fg=document.getElementById('s2vFail');
  sg.style.display='none'; fg.style.display='none'; sg.classList.remove('animate');
  if(pass){ sg.style.display='flex'; setTimeout(function(){ sg.classList.add('animate'); },50); setTimeout(function(){ sg.querySelectorAll('.ring').forEach(function(r){ r.classList.add('frozen'); }); },2000); }
  else fg.style.display='flex';
  document.getElementById('s2vBar').className='v-bar '+(pass?'pass':'fail');
  var missed = S2_HAL_COUNT - s2state.flagsCorrect;
  var vMsg;
  if(!pass) {
    if(reason==='breach') {
      vMsg = 'Your credibility was compromised. Too many errors drained your integrity to zero \u2014 in a real scenario, the client would lose trust in your review process entirely.\n\nTip: Compare every specific number, name, and recommendation against the source material. AI hallucinations are hardest to spot when they sound plausible.';
    } else if(s2state.flagsCorrect<S2_MIN_HALS) {
      vMsg = 'The report reached James Okafor with '+missed+' of '+S2_HAL_COUNT+' fabricated claim'+(missed!==1?'s':'')+' still inside. You only caught '+s2state.flagsCorrect+'/'+S2_HAL_COUNT+' hallucinations \u2014 not enough to consider the report verified. In a real scenario, the client would act on invented figures and recommendations that were never discussed.\n\nYou need to catch at least '+S2_MIN_HALS+' of the '+S2_HAL_COUNT+' hallucinations. Compare every figure, name, and recommendation against the meeting notes.';
    } else {
      vMsg = 'You identified '+s2state.flagsCorrect+' of '+S2_HAL_COUNT+' hallucinations, but too many errors eroded your credibility to '+intFinal+'%. In a real scenario, flagging accurate content as fabricated undermines trust in your review \u2014 colleagues stop acting on valid concerns when surrounded by false alarms.\n\nYou need to maintain at least '+S2_MIN_INTEGRITY+'% integrity. Only flag claims you can confirm are fabricated by checking the source material.';
    }
  } else if(missed===0) {
    vMsg = 'Report intercepted. You found all '+S2_HAL_COUNT+' fabricated claims \u2014 including inflated figures, an invented job title, and a recommendation that doesn\u2019t exist in the source notes. AI generates false information with the same confident tone as accurate information. There is no internal signal.';
  } else {
    vMsg = 'Report reviewed, but '+missed+' fabricated claim'+(missed!==1?'s':'')+' slipped through. In a real scenario, the client could act on invented figures or recommendations that were never discussed. Your integrity held, but the review wasn\u2019t thorough enough.\n\nTip: Compare every specific number, name, and recommendation against the source material \u2014 not just the ones that feel wrong.';
  }
  document.getElementById('s2vMsg').textContent = vMsg;
  const s2StarCount = intFinal >= 80 ? 3 : intFinal >= 50 ? 2 : (pass ? 1 : 0);
  if (!pass) {
    const s2vEl = document.getElementById('s2vInt');
    s2vEl.className = 'v-mv v-stars fail-text';
    s2vEl.textContent = reason === 'breach' ? '— BREACHED —' : '— FAILED —';
  } else {
    renderVerdictStars('s2vInt', s2StarCount);
  }
  // Simplified verdict rows
  document.getElementById('s2vHalsCaught').textContent=s2state.flagsCorrect+'/'+S2_HAL_COUNT;
  document.getElementById('s2vHalsCaught').className='v-rv '+(s2state.flagsCorrect>=S2_HAL_COUNT?'green':s2state.flagsCorrect>=S2_MIN_HALS?'orange':'red');
  document.getElementById('s2vFalseFlags').textContent=s2state.flagsWrong===0?'None':s2state.flagsWrong;
  document.getElementById('s2vFalseFlags').className='v-rv '+(s2state.flagsWrong===0?'green':'red');
  var anchorText2=document.getElementById('s2vAnchorText');
  if(pass) {
    anchorText2.innerHTML = 'In the Mata v. Avianca case (2023), lawyers submitted AI-generated case citations to a US federal court \u2014 every cited case was invented. The attorneys were sanctioned.' + '<br><br><span style="font-family:\'JetBrains Mono\',monospace;font-size:9px;letter-spacing:.12em;color:rgba(56,189,248,.5);text-transform:uppercase;">What you now do differently</span><br><span style="font-size:11px;line-height:1.9;color:rgba(200,220,255,.65);">\u2192 Always verify AI-generated content against the original source<br>\u2192 Check every figure, name, and recommendation \u2014 not just the ones that feel wrong<br>\u2192 Never send an AI-drafted document to a client without a line-by-line review</span>';
    if(precisionPass){ var bonus=document.getElementById('s2vBonus'); bonus.style.display='block'; bonus.innerHTML='<div class="v-bonus-wrap"><span class="v-precision-bonus">\u2B21 PRECISION BONUS \u2014 All hallucinations caught, zero false alarms</span></div>'; }
  } else {
    anchorText2.textContent = 'In the Mata v. Avianca case (2023), lawyers submitted AI-generated case citations to a US federal court \u2014 every cited case was invented. The attorneys were sanctioned. AI-fabricated content in client reports carries direct professional and financial consequences. Always verify against source material.';
  }
  document.getElementById('s2retryBtn').style.display=pass?'none':'block';
  var mb2=document.getElementById('s2menuBtn'); mb2.textContent=pass?'\u25B6 MISSION SELECT':'\u2190 MISSION SELECT';
  var s2ch = document.getElementById('s2vCompact2');
  if (s2ch) {
    s2ch.className = 'v-compact-header' + (pass ? '' : ' fail');
    var txt2 = s2ch.querySelector('.v-compact-header-text');
    if (txt2) txt2.textContent = pass ? 'REPORT VERIFIED' : 'MISINFORMATION SPREAD';
    var dot2 = s2ch.querySelector('.v-compact-header-dot');
    if (dot2) dot2.style.background = pass ? 'rgba(74,222,128,.9)' : 'rgba(239,68,68,.9)';
  }
  forceCloseInsight();
  resumeBG();
  setTimeout(function(){ document.getElementById('s2verdict').classList.add('show'); },400);
}

// ── M2: teach — pause gentle drain during insight ──────────
function s2ShowInsight(category, tokenText, message, afterFn, graphicHtml, isCorrect, userChoice) {
  clearInterval(s2state.drainInt); s2state.drainInt=null; // pause drain
  showInsight(category, tokenText, message, () => {
    if(afterFn) afterFn();
    // Resume gentle drain if game still active
    if(s2state.gameActive) {
      s2state.drainInt = setInterval(()=>{
        if(!s2state.gameActive) return;
        s2state.integrity = Math.max(0, s2state.integrity - 0.0005);
        updateIntUI('s2', s2state.integrity, 0, S1_MAX_DRAIN);
        if(s2state.integrity<=0) s2EndGame('breach');
      }, 100);
    }
  }, null, isCorrect || false, userChoice || null);
}

