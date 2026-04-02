// ════════════════════════════════════════════
//  SECTION 1 — DATA LEAKAGE
// ════════════════════════════════════════════
const S1_TOKENS = {
  apikey:   { cat:'credential', drain:4   },
  password: { cat:'credential', drain:4   },
  email:    { cat:'pii',        drain:1   },
  name:     { cat:'pii',        drain:1   },
  project:  { cat:'internal',   drain:0.3 },
  version:   { cat:'noise' }, region: { cat:'noise' }, turbine: { cat:'noise' },
};
const S1_CAT_TOKENS = { credential:['apikey','password'], pii:['name','email'], internal:['project'] };
// S1_MAX_DRAIN is defined in core.js (shared across missions)

let s1state = {
  tokState:{}, integrity:100, gameActive:false, classifyErrors:0,
  safeBonus:0, timerInt:null, drainInt:null, drainDelayTm:null, insightOpen:false, activeToken:null,
};

function s1FreshState() {
  const s={}; Object.keys(S1_TOKENS).forEach(k=>{ s[k]={redacted:false}; }); return s;
}
function s1Init() {
  s1state.tokState=s1FreshState();
  s1state.integrity=100; s1state.gameActive=false;
  s1state.classifyErrors=0; s1state.safeBonus=0; s1state.activeToken=null;
  clearInterval(s1state.timerInt); clearInterval(s1state.drainInt);
  clearTimeout(s1state.drainDelayTm);
  s1state.drainInt=null; s1state.drainDelayTm=null; s1state.insightOpen=false;
  forceCloseInsight();
  // Snap bar to 100% instantly (no CSS transition) to avoid overflow on retry
  const s1bar=document.getElementById('s1iwIntBar');
  if(s1bar){ s1bar.style.transition='none'; s1bar.style.width='100%'; s1bar.className='ib-bar-fill green'; void s1bar.offsetWidth; s1bar.style.transition=''; }
  s1BuildPayload(); s1BuildSegments();
  updateIntUI('s1', 100, 0, S1_MAX_DRAIN);
  // Reset diag panel to initial (pre-play) state
  document.getElementById('s1diagSecured').style.display='none';
  document.getElementById('s1ibSubmitCta').style.display='none';
  const s1msR = document.getElementById('s1mobileSubmit'); if(s1msR) s1msR.style.display='none';
  document.getElementById('s1ibSeverity').style.opacity='1';
  document.getElementById('s1iwDrain').textContent='';
  document.getElementById('s1iwDrain').className='ib-drain-label';
  // Reset mini banner bars
  ['Cred','Pii','Int'].forEach(k=>{
    const f=document.getElementById('s1mbProg'+k); if(f){f.style.width='0%';f.style.background=k==='Cred'?'rgba(239,68,68,.8)':k==='Pii'?'rgba(251,146,60,.8)':'rgba(250,204,21,.8)';}
    const l=document.getElementById('s1mbLbl'+k); if(l) l.className='ib-mini-lbl '+(k==='Cred'?'red':k==='Pii'?'orange':'yellow');
  });
  // Reset category pills to EXPOSED
  document.getElementById('s1catCred').className='diag-cat exposed';
  document.getElementById('s1catPii').className='diag-cat exposed-pii';
  document.getElementById('s1catInt').className='diag-cat exposed-int';
  document.getElementById('s1pillCred').className='dc-pill exposed';   document.getElementById('s1pillCred').textContent='EXPOSED';
  document.getElementById('s1pillPii').className='dc-pill exposed-pii'; document.getElementById('s1pillPii').textContent='EXPOSED';
  document.getElementById('s1pillInt').className='dc-pill exposed-int'; document.getElementById('s1pillInt').textContent='EXPOSED';
  document.getElementById('s1verdict').classList.remove('show');
  // Reset attachment chip state
  const chip=document.querySelector('.gpt-attach-chip'); if(chip) chip.classList.remove('opened');
  const arr=document.getElementById('s1chipArrow'); if(arr) arr.textContent='▼';
  const cc=document.getElementById('s1chipCallout'); if(cc) cc.classList.remove('hidden');
  const ad=document.getElementById('s1attachDoc'); if(ad) ad.classList.remove('open');
  // Show briefing
  const b=document.getElementById('s1briefing');
  b.style.display=''; b.classList.remove('hidden');
}
function s1Reset() {
  pBleep(); resumeBG();
  document.getElementById('s1verdict').classList.remove('show');
  s1Init();
}

function s1BuildSegments() {
  Object.entries(S1_CAT_TOKENS).forEach(([cat,ids])=>{
    const key={credential:'Cred',pii:'Pii',internal:'Int'}[cat];
    const cont=document.getElementById('s1segs'+key);
    if(!cont) return;
    cont.innerHTML='';
    ids.forEach(id=>{ const s=document.createElement('div'); s.className='dc-seg'; s.id='s1seg_'+id; cont.appendChild(s); });
  });
}

function s1BuildPayload() {
  document.getElementById('s1payload').innerHTML = `
    <div class="ai-scenario-frame">📋 <strong>Your task:</strong> This prompt contains sensitive data. Identify and classify every piece before it reaches the AI.</div>
    <div class="gpt-window">
      <div class="gpt-sidebar">
        <div class="gpt-sidebar-icon">☰</div>
        <div class="gpt-sidebar-history">Executive summary for client…</div>
        <div class="gpt-sidebar-new">✎</div>
      </div>
      <div class="gpt-titlebar">
        <div class="gpt-logo">A</div>
        <div class="gpt-title-text">AI Assistant</div>
        <div class="gpt-model-pill">LLM-4</div>
        <div class="gpt-share-btn">⤴</div>
      </div>
      <div class="gpt-chat-area">
        <div class="gpt-user-msg">
          <div style="max-width:92%">
            <div class="gpt-user-meta">
              <div class="gpt-user-avatar">MW</div>Marcus Webb · just now
            </div>
            <div class="gpt-user-bubble">
              Can you help me write an executive summary for a client presentation? Here's the context.<br><br>
              The engagement is called <span class="tok clickable" data-id="project" tabindex="0" role="button">Project Cobalt-Seven</span> — that's our internal codename so don't include it in the output. My client contact is <span class="tok clickable" data-id="name" tabindex="0" role="button">James Okafor</span> at <span class="tok clickable" data-id="email" tabindex="0" role="button">j.okafor@pinnacle-group.com</span>.<br><br>
              This is a <span class="tok clickable noise" data-id="version" tabindex="0" role="button">Q4 review</span> covering <span class="tok clickable noise" data-id="turbine" tabindex="0" role="button">3 workstreams</span>. I've attached my briefing notes doc — the summary should be formal and about one page.
              <div class="gpt-attach-row">
                <div class="chip-callout" id="s1chipCallout"><span class="chip-callout-arrow">↓</span> Review attached document</div>
                <div class="gpt-attach-chip" onclick="s1ToggleAttach()" tabindex="0" role="button" aria-label="Open attached document" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();s1ToggleAttach();}">
                  <span class="chip-icon">📄</span>
                  <span class="chip-name">client_briefing_notes.docx</span>
                  <span class="chip-arrow" id="s1chipArrow">▼</span>
                </div>
              </div>
              <div class="word-doc-overlay" id="s1attachDoc">
                <div class="word-doc-titlebar">
                  <span style="font-size:14px">📄</span>
                  <span class="word-doc-titlebar-text">Client Briefing Notes — Word Online</span>
                  <span style="font-size:10px;color:rgba(255,255,255,.6);cursor:pointer" onclick="s1ToggleAttach()">✕</span>
                </div>
                <div class="word-doc-ribbon"><span>File</span><span>Home</span><span>Insert</span><span>Review</span><span>View</span></div>
                <div class="word-doc-body">
                  <div class="word-doc-title">Client Briefing Notes</div>
                  <div class="word-doc-subtitle">Meridian Advisory Group · Internal Use Only</div>
                  <div>Engagement ref: <span class="tok clickable noise" data-id="region" tabindex="0" role="button">MAG-2026-Q4</span></div>
                  <div style="color:#888;font-size:11px;margin-top:4px">Status: Active &nbsp;·&nbsp; Report version: v2.1 &nbsp;·&nbsp; Last updated: 14 Feb 2026</div>
                  <div class="word-doc-section" style="font-size:13px;border-top:1px solid #e0e0e0;padding-top:12px;margin-top:14px">⚠ Portal Access — Strictly Confidential</div>
                  <div style="color:#666;font-size:10px;margin-bottom:8px">For the client reporting portal only. Do not share.</div>
                  <div>Password: &nbsp;&nbsp;<span class="tok clickable" data-id="password" tabindex="0" role="button">Webb@2026!</span></div>
                  <div>API Key: &nbsp;&nbsp;&nbsp;<span class="tok clickable" data-id="apikey" tabindex="0" role="button">MRD-4491-BETA-77X</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="gpt-input-bar">
        <div class="gpt-input-field"><span style="color:#8e8e8e;font-family:'DM Sans',sans-serif;font-size:12px">Message AI Assistant</span><div class="gpt-input-field-icons"><div class="gpt-input-icon">↑</div></div></div>
      </div>
    </div>`;
  document.querySelectorAll('#s1payload .tok.clickable').forEach(el => {
    el.addEventListener('click', s1TokenClick);
    el.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' '){e.preventDefault();el.click();} });
  });
}

function s1ToggleAttach() {
  pClick();
  const doc=document.getElementById('s1attachDoc');
  const arr=document.getElementById('s1chipArrow');
  const chip=document.querySelector('.gpt-attach-chip');
  const open=doc.classList.toggle('open');
  if(arr) arr.textContent=open?'▲':'▼';
  if(open&&chip) { chip.classList.add('opened'); const cc=document.getElementById('s1chipCallout'); if(cc) cc.classList.add('hidden'); }
  // On mobile, dismiss any active feedback popup so it doesn't cover the attachment
  if(open && window.innerWidth <= 768) { forceCloseInsight(); }
}
function s1TokenClick(e) {
  if(!s1state.gameActive) return;
  const id=e.currentTarget.dataset.id;
  if(!s1state.tokState[id] || s1state.tokState[id].redacted) return;
  e.stopPropagation(); e.preventDefault(); pClick();
  dismissToast();
  s1state.activeToken=id;
  const popup=document.getElementById('s1catPopup');
  popup._justOpened=true;
  popup.classList.add('show');
  const r=e.currentTarget.getBoundingClientRect();
  if(window.innerWidth<=768) { popup.style.top=''; popup.style.left=''; }
  else {
    let top=r.bottom+8, left=r.left;
    if(left+490>window.innerWidth) left=window.innerWidth-494;
    if(left<8) left=8;
    if(top+120>window.innerHeight) top=Math.max(8,r.top-120);
    popup.style.top=top+'px'; popup.style.left=left+'px';
  }
  setTimeout(()=>{ popup._justOpened=false; }, 100);
}
function s1ClosePopup() { const p=document.getElementById('s1catPopup'); p.classList.remove('show'); p._justOpened=false; s1state.activeToken=null; }
document.addEventListener('mousedown', e => {
  const p=document.getElementById('s1catPopup');
  if(p&&p._justOpened) return;
  if(p&&p.classList.contains('show')&&!p.contains(e.target)) s1ClosePopup();
});

// Per-token teach messages for M1
const S1_TEACH = {
  apikey:   { correct: 'API keys give direct access to company systems. AI tools can log everything you type — if a key appears in a prompt, anyone who accesses that log has the same access you do. Even old keys can reveal how your systems are set up.',
              wrong:   'This is an API key — it falls under CREDENTIALS, not personal data or internal info. The difference matters: credentials give direct system access, which means the damage is immediate and exploitable. Someone with this key can act as your organisation right now.' },
  password: { correct: 'Passwords in prompts are high-risk. AI tools log inputs — a logged password is a compromised password.',
              wrong:   'This is a password — it falls under CREDENTIALS, not personal data. Passwords grant direct access to systems. Personal data is a compliance risk; credentials are an active security breach. Anyone who sees this can log in.' },
  email:    { correct: 'Email addresses are personal data under GDPR. They identify a real person and could be used for phishing or social engineering if they end up in the wrong hands.',
              wrong:   'This is a personal email address — it falls under PERSONAL DATA, not credentials or internal info. It identifies a real individual and is protected under GDPR. Unlike credentials it won\'t grant system access, but it can be used for targeted phishing or social engineering.' },
  name:     { correct: 'Personal names are protected data under GDPR. Combined with someone\'s role and company name, an AI tool could store enough to identify a real person — data your colleague never consented to share.',
              wrong:   'This is a person\'s name — it falls under PERSONAL DATA, not internal info. Names identify real individuals and are protected under GDPR. Internal codenames identify projects and initiatives; personal names identify people. That\'s what makes it personal data.' },
  project:  { correct: 'Internal codenames reveal organisational structure and active work to external services. Competitors pay attention.',
              wrong:   'This is an internal project codename — it falls under INTERNAL INFO, not personal data. It doesn\'t identify a person or grant system access, but it reveals what your organisation is working on. Competitors and external services can piece together strategic direction from codenames alone.' },
};

// Safe-token (noise) teach messages — shown when user correctly marks a token as SAFE
const S1_SAFE_TEACH = {
  version:   'Time references like this are general business context — they don\'t identify systems, credentials, or individuals. No redaction needed.',
  turbine:   'Workflow counts are generic descriptors with no identifying payload. They carry no data risk on their own.',
  region:    'Engagement reference codes are internal filing labels. Without accompanying credentials or system paths, they expose nothing sensitive.',
};

function s1Classify(chosen) {
  const id=s1state.activeToken; if(!id) return;
  const token=S1_TOKENS[id];
  s1ClosePopup();
  const tokEl=document.querySelector(`#s1payload .tok[data-id="${id}"]`);
  const tokText=tokEl ? tokEl.textContent.trim() : id;
  const isSensitive=token.cat!=='noise';

  if(chosen==='safe') {
    if(!isSensitive) {
      // Correct: safe token — show insight, then fire consequences
      pSelected();
      const safeAfterEffect = () => {
        s1state.safeBonus += 0.008;
        s1state.integrity = Math.min(100, s1state.integrity + 3);
        showIntPop('s1', +3);
        flashDelta('s1', +3, 'confirmed safe');
        s1Redact(id, 'fp');
        updateIntUI('s1', s1state.integrity, s1GetDrain(), S1_MAX_DRAIN);
      };
      const safeMsg = S1_SAFE_TEACH[id] || 'This token contains no credentials, personal data, or confidential business information — safe to include in external AI prompts.';
      s1ShowInsight('Safe', tokText, safeMsg, safeAfterEffect, null, true, 'safe');
    } else {
      // Wrong: sensitive dismissed as safe — consequences fire on dismiss
      pWrong();
      s1state.integrity=Math.max(0,s1state.integrity-10);
      s1state.classifyErrors++;
      s1FlashToken(id,'red');
      const willBreach=s1state.integrity<=0;
      if(willBreach) { s1EndGame('breach'); return; }
      const afterEffect=()=>{
        showIntPop('s1',-10);
        flashDelta('s1',-10,'sensitive data exposed!');
        updateIntUI('s1',s1state.integrity,s1GetDrain(),S1_MAX_DRAIN);
      };
      if(S1_TEACH[id]) {
        const catLabel={'credential':'[CREDENTIALS]','pii':'[PERSONAL DATA]','internal':'[INTERNAL INFO]'}[token.cat]||'Wrong Category';
        s1ShowInsight(catLabel,tokText,S1_TEACH[id].wrong,afterEffect,null,false,'safe');
      } else {
        afterEffect();
      }
    }
    return;
  }

  if(!isSensitive) {
    // Noise flagged as sensitive — show feedback, then fire consequences
    pWrong();
    s1state.integrity=Math.max(0,s1state.integrity-5);
    s1state.classifyErrors++;
    s1FlashToken(id,'red');
    const willBreach=s1state.integrity<=0;
    if(willBreach) { s1EndGame('breach'); return; }
    const afterEffect=()=>{
      showIntPop('s1',-5); flashDelta('s1',-5,'false alarm — not sensitive');
      updateIntUI('s1',s1state.integrity,s1GetDrain(),S1_MAX_DRAIN);
    };
    const msg = S1_SAFE_TEACH[id] || 'This item doesn\'t contain credentials, personal data, or confidential information — flagging it wastes time and erodes trust in your review.';
    s1ShowInsight('Safe', tokText, msg, afterEffect, null, false, chosen);
    return;
  }

  if(chosen!==token.cat) {
    // Wrong category — consequences fire on dismiss
    pWrong();
    s1FlashToken(id,'red');
    s1state.integrity=Math.max(0,s1state.integrity-3);
    s1state.classifyErrors++;
    const key={credential:'Cred',pii:'Pii',internal:'Int'}[token.cat];
    const catEl=document.getElementById('s1cat'+key);
    catEl.style.animation='none'; void catEl.offsetWidth; catEl.style.animation='wrongGlow .6s ease';
    const willBreach=s1state.integrity<=0;
    const afterEffect=()=>{
      showIntPop('s1',-3);
      flashDelta('s1',-3,'Wrong category — try again.');
      updateIntUI('s1',s1state.integrity,s1GetDrain(),S1_MAX_DRAIN);
      if(willBreach) s1EndGame('breach');
    };
    if(S1_TEACH[id]) {
      const catLabel={'credential':'[CREDENTIALS]','pii':'[PERSONAL DATA]','internal':'[INTERNAL INFO]'}[token.cat]||'Wrong Category';
      s1ShowInsight(catLabel,tokText,S1_TEACH[id].wrong,afterEffect,null,false,chosen);
    } else {
      afterEffect();
    }
    return;
  }

  // Correct classification — token redacts immediately, all consequences fire on dismiss
  pSelected();
  s1Redact(id,token.cat);
  const allDone=s1AllSecured();
  const afterEffect=()=>{
    s1UpdateDiag(token.cat,id);
    flashDelta('s1',0,'Item secured');
    updateIntUI('s1',s1state.integrity,s1GetDrain(),S1_MAX_DRAIN);
    if(allDone) {
      clearInterval(s1state.drainInt);
      document.getElementById('s1iwDrain').textContent='✓ secured';
      document.getElementById('s1iwDrain').className='ib-drain-label secured';
      document.getElementById('s1diagSecured').style.display='flex';
      document.getElementById('s1ibSubmitCta').style.display='flex';
      const s1ms=document.getElementById('s1mobileSubmit');
      if(s1ms&&window.innerWidth<=768) s1ms.style.display='block';
      document.getElementById('s1ibSeverity').style.opacity='0';
      if(window.innerWidth>768) {
        setTimeout(()=>{
          const diag=document.getElementById('s1diag');
          if(diag&&!diag.classList.contains('panel-open')) {
            diag.classList.add('panel-open');
            const lbl=diag.querySelector('.diag-toggle-lbl');
            if(lbl) lbl.textContent='▼  CLOSE PANEL';
          }
          setTimeout(()=>{
            if(diag) diag.scrollTop=diag.scrollHeight;
            const btn=document.getElementById('s1ibSubmitCta');
            if(btn) btn.scrollIntoView({behavior:'smooth',block:'nearest'});
          },380);
        },200);
      }
    }
  };
  if(S1_TEACH[id]) {
    const catLabel={'credential':'[CREDENTIALS]','pii':'[PERSONAL DATA]','internal':'[INTERNAL INFO]'}[token.cat]||'Secured';
    const redactedEl=document.querySelector(`#s1payload .tok[data-id="${id}"]`);
    const redactedText=redactedEl?redactedEl.querySelector('.redact-label')?.textContent||'':'';
    s1ShowInsight(catLabel,redactedText,S1_TEACH[id].correct,afterEffect,null,true,chosen);
  } else {
    afterEffect();
  }
}
function s1FlashToken(id, color) {
  const el=document.querySelector(`#s1payload .tok[data-id="${id}"]`); if(!el) return;
  el.style.background=color==='red'?'rgba(239,68,68,.22)':'rgba(74,222,128,.15)';
  el.style.color=color==='red'?'var(--red)':'var(--green)';
  setTimeout(()=>{ el.style.background=''; el.style.color=''; }, 700);
}
function s1Redact(id,cat) {
  s1state.tokState[id].redacted=true;
  const el=document.querySelector(`#s1payload .tok[data-id="${id}"]`); if(!el) return;
  const catClass=cat==='fp'?'cat-safe':`cat-${cat}`;
  const badge={credential:'CRED',pii:'DATA',internal:'INT',fp:'SAFE'}[cat]||'';
  const origW=el.offsetWidth;
  el.style.display='inline-block';
  el.style.width=origW+'px';
  el.style.textAlign='center';
  el.style.boxSizing='border-box';
  el.className=`tok redacted ${catClass}`;
  el.innerHTML=`<span class="redact-badge">${badge}</span>`;
  el.removeEventListener('click',s1TokenClick);
}
function s1UpdateDiag(cat,tokenId) {
  const key={credential:'Cred',pii:'Pii',internal:'Int'}[cat];
  const cont=document.getElementById('s1segs'+key);
  if(cont){ const next=cont.querySelector('.dc-seg:not(.secured)'); if(next) next.classList.add('secured'); }
  const ids=S1_CAT_TOKENS[cat];
  const secured=ids.filter(id=>s1state.tokState[id].redacted).length;
  const catEl=document.getElementById('s1cat'+key);
  catEl.classList.remove('pulse'); void catEl.offsetWidth; catEl.classList.add('pulse');
  setTimeout(()=>catEl.classList.remove('pulse'),750);
  // Sync mini banner bar
  const miniBarKey={credential:'Cred',pii:'Pii',internal:'Int'}[cat];
  const miniFill=document.getElementById('s1mbProg'+miniBarKey);
  if(miniFill) miniFill.style.width=Math.round((secured/ids.length)*100)+'%';
  if(secured===ids.length) {
    catEl.className='diag-cat secured';
    document.getElementById('s1pill'+key).className='dc-pill secured';
    document.getElementById('s1pill'+key).textContent='SECURED';
    // Keep mini label colour unchanged (red/orange/yellow) — only the fill bar signals secured
    if(miniFill){ miniFill.style.background='rgba(74,222,128,.85)'; }
  }
}
function s1AllSecured() { return ['apikey','password','name','email','project'].every(id=>s1state.tokState[id].redacted); }
function s1GetDrain() {
  if(s1AllSecured()) return 0;
  let r=0.16;
  ['apikey','password'].forEach(id=>{ if(!s1state.tokState[id].redacted) r+=0.56; });
  ['name','email'].forEach(id=>{ if(!s1state.tokState[id].redacted) r+=0.16; });
  if(!s1state.tokState.project.redacted) r+=0.064;
  const MAX_DRAIN = 0.72; // cap prevents unrecoverable early mistakes
  return Math.min(MAX_DRAIN, Math.max(0.05, r-s1state.safeBonus));
}
function s1Submit() { s1EndGame('submit'); }
function s1Start() {
  stopVO(); pauseBG();
  const b=document.getElementById('s1briefing'); b.classList.add('hidden');
  setTimeout(()=>b.style.display='none',600);
  s1state.gameActive=true;
  updatePauseBtn();
  // Delay drain start by 5s — give learners time to read first
  s1state.drainDelayTm=setTimeout(()=>{
    s1state.drainDelayTm=null;
    if(!s1state.gameActive) return;
    clearInterval(s1state.drainInt); // guard against ghost drain if insight dismissed early
    s1state.drainInt=setInterval(()=>{
      if(!s1state.gameActive||s1state.insightOpen) return;
      s1state.integrity=Math.max(0,s1state.integrity-s1GetDrain()*(100/1000));
      const drain=s1GetDrain();
      document.getElementById('s1iwDrain').textContent='▼ data exposed';
      document.getElementById('s1iwDrain').className='ib-drain-label draining';
      updateIntUI('s1',s1state.integrity,drain,S1_MAX_DRAIN);
      if(s1state.integrity<=0) s1EndGame('breach');
    },100);
  }, 5000);
  // (nudge/zoom removed — chip uses subtle breathing glow to indicate it's clickable)
}
// vAdvance and renderVerdictStars are defined in core.js (shared across missions)

function s1EndGame(reason) {
  if(!s1state.gameActive) return; s1state.gameActive=false;
  dismissToast();
  const s1msEnd = document.getElementById('s1mobileSubmit'); if(s1msEnd) s1msEnd.style.display='none';
  vAdvance('s1',1);
  document.getElementById('s1vBonus').style.display='none';
  updatePauseBtn();
  clearInterval(s1state.drainInt);
  const intFinal=Math.max(0,Math.round(s1state.integrity));
  const credLeft=S1_CAT_TOKENS.credential.filter(id=>!s1state.tokState[id].redacted).length;
  const piiLeft=S1_CAT_TOKENS.pii.filter(id=>!s1state.tokState[id].redacted).length;
  const intLeft=S1_CAT_TOKENS.internal.filter(id=>!s1state.tokState[id].redacted).length;
  const totalLeft=credLeft+piiLeft+intLeft;
  const pass=(reason!=='breach')&&totalLeft===0;
  const precisionPass = pass && s1state.classifyErrors===0;
  if(pass){ pSuccess(); courseProgress.s1done=true; saveProgress(); }
  else pError();
  setTimeout(()=>playVO(pass?'VO-M1-PASS':'VO-M1-FAIL'),600);
  scormReport(intFinal, pass, 's1');
  const sg=document.getElementById('s1vSuccess'), fg=document.getElementById('s1vFail');
  sg.style.display='none'; fg.style.display='none'; sg.classList.remove('animate');
  if(pass){ sg.style.display='flex'; setTimeout(()=>sg.classList.add('animate'),50); setTimeout(()=>sg.querySelectorAll('.ring').forEach(r=>r.classList.add('frozen')),2000); }
  else fg.style.display='flex';
  document.getElementById('s1vBar').className='v-bar '+(pass?'pass':'fail');
  // Dynamic verdict message
  let vMsg;
  if(pass) {
    vMsg = 'Transmission blocked. Every piece of sensitive data was identified and contained before it reached an external server. That matters because AI tools retain and may reuse everything you submit \u2014 every prompt is an email to a stranger.';
  } else {
    const missed=[];
    if(credLeft>0) missed.push('credentials (API key / password)');
    if(piiLeft>0) missed.push('personal data (name / email)');
    if(intLeft>0) missed.push('internal codenames');
    vMsg = `Data transmitted. ${totalLeft} piece${totalLeft>1?'s':''} of sensitive data reached the AI assistant — including ${missed.join(' and ')}. In a real incident, this would be a reportable breach under GDPR.\n\nTip: Open the attachment early — it contains the most sensitive credentials. Classify credentials first — they drain integrity the fastest.`;
  }
  document.getElementById('s1vMsg').textContent = vMsg;
  const s1StarCount = intFinal >= 80 ? 3 : intFinal >= 50 ? 2 : (pass ? 1 : 0);
  if (!pass) {
    const el = document.getElementById('s1vInt');
    el.className = 'v-mv v-stars fail-text';
    el.textContent = reason === 'breach' ? '— BREACHED —' : '— FAILED —';
  } else {
    renderVerdictStars('s1vInt', s1StarCount);
  }
  document.getElementById('s1vCred').textContent=credLeft===0?'Secured':credLeft+' Exposed';
  document.getElementById('s1vCred').className='v-rv '+(credLeft===0?'green':'red');
  document.getElementById('s1vPii').textContent=piiLeft===0?'Secured':piiLeft+' Exposed';
  document.getElementById('s1vPii').className='v-rv '+(piiLeft===0?'green':'orange');
  document.getElementById('s1vIntel').textContent=intLeft===0?'Secured':'Exposed';
  document.getElementById('s1vIntel').className='v-rv '+(intLeft===0?'green':'yellow');
  document.getElementById('s1vErrors').textContent=s1state.classifyErrors===0?'None':s1state.classifyErrors+' Errors';
  document.getElementById('s1vErrors').className='v-rv '+(s1state.classifyErrors===0?'green':'red');
  document.getElementById('s1retryBtn').style.display=pass?'none':'block';
  document.getElementById('s1menuBtn').textContent=pass?'▶ MISSION SELECT':'← MISSION SELECT';
  // Update compact status headers for steps 2 & 3
  const s1ch = document.getElementById('s1vCompact2');
  if (s1ch) {
    s1ch.className = 'v-compact-header' + (pass ? '' : ' fail');
    const txt = s1ch.querySelector('.v-compact-header-text');
    if (txt) txt.textContent = pass ? 'TRANSMISSION SECURED' : 'DATA BREACH DETECTED';
    const dot = s1ch.querySelector('.v-compact-header-dot');
    if (dot) dot.style.background = pass ? 'rgba(74,222,128,.9)' : 'rgba(239,68,68,.9)';
  }
  const anchorText1=document.getElementById('s1vAnchorText');
  if(pass) {
    anchorText1.innerHTML = 'In 2023, Samsung engineers pasted proprietary source code into ChatGPT. The data was potentially retained for model training. Samsung banned AI tools company-wide.' + '<br><br><span style="font-family:\'JetBrains Mono\',monospace;font-size:9px;letter-spacing:.12em;color:rgba(56,189,248,.5);text-transform:uppercase;">What you now do differently</span><br><span style="font-size:11px;line-height:1.9;color:rgba(200,220,255,.65);">→ Never paste credentials, personal data, or internal codenames into public AI tools<br>→ Treat every AI prompt like an email sent to a stranger<br>→ When in doubt, redact first — ask your manager before including sensitive data</span>';
    if(precisionPass){ const b=document.getElementById('s1vBonus'); b.style.display='block'; b.innerHTML='<div class="v-bonus-wrap"><span class="v-precision-bonus">⬡ PRECISION BONUS — Zero classification errors</span></div>'; }
  } else {
    anchorText1.textContent = 'In 2023, Samsung engineers pasted proprietary source code into ChatGPT — the data was potentially retained for model training. Samsung banned AI tools company-wide. Every unclassified item you missed could have the same consequence.';
  }
  forceCloseInsight();
  resumeBG();
  setTimeout(()=>document.getElementById('s1verdict').classList.add('show'),400);
}

// ── M1: teach with drain pause ──────────────────────────────
function s1ShowInsight(category, tokenText, message, afterFn, graphicHtml, isCorrect, userChoice) {
  s1state.insightOpen=true;
  clearInterval(s1state.drainInt); // pause drain
  // Snap bar — kill CSS transition so no visual drift during feedback
  const _bar=document.getElementById('s1iwIntBar');
  if(_bar){ _bar.style.transition='none'; void _bar.offsetWidth; }
  showInsight(category, tokenText, message, () => {
    s1state.insightOpen=false;
    // Restore CSS transition
    if(_bar) _bar.style.transition='';
    if(afterFn) afterFn();
    // Resume drain using original 100ms tick and scaled formula
    if(s1state.gameActive && !s1AllSecured()) {
      s1state.drainInt = setInterval(()=>{
        if(!s1state.gameActive||s1state.insightOpen) return;
        s1state.integrity = Math.max(0, s1state.integrity - s1GetDrain()*(100/1000));
        const drain = s1GetDrain();
        document.getElementById('s1iwDrain').textContent = '▼ data exposed';
        document.getElementById('s1iwDrain').className = 'ib-drain-label draining';
        updateIntUI('s1', s1state.integrity, drain, S1_MAX_DRAIN);
        if(s1state.integrity <= 0) s1EndGame('breach');
      }, 100);
    }
  }, null, isCorrect, userChoice || null);
}
