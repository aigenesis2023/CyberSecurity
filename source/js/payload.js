// ════════════════════════════════════════════
//  BUILD PAYLOAD
// ════════════════════════════════════════════
function buildPayload() {
  document.getElementById('payload').innerHTML = `
    <div class="gpt-window">

      <div class="gpt-titlebar">
        <div class="gpt-logo">⬡</div>
        <div class="gpt-title-text">ChatGPT</div>
        <div class="gpt-model-pill">GPT-5.2 Instant</div>
      </div>

      <div class="gpt-warning-bar">
        ⚠&nbsp; Sensitive data detected — redact all tokens before sending
      </div>

      <div class="gpt-chat-area">

        <div class="gpt-user-msg">
          <div style="max-width:92%">
            <div class="gpt-user-meta">
              <div class="gpt-user-avatar">MW</div>
              Marcus Webb · just now
            </div>
            <div class="gpt-user-bubble">
              Can you help me write an executive summary for a client presentation? Here's the context.<br><br>
              The engagement is called <span class="tok clickable" data-id="project">Project Cobalt-Seven</span> — that's our internal codename so don't include it in the output. My client contact is <span class="tok clickable" data-id="name">James Okafor</span> at <span class="tok clickable" data-id="email">j.okafor@pinnacle-group.com</span>.<br><br>
              This is a <span class="tok clickable noise" data-id="version">Q4 review</span> covering <span class="tok clickable noise" data-id="turbine">3 workstreams</span>. I've attached my briefing notes doc for the full details — the summary should be formal and about one page.
              <div class="gpt-attach-row">
                <div class="gpt-attach-chip" onclick="toggleAttachment()">
                  <span class="chip-icon">📄</span>
                  <span class="chip-name">client_briefing_notes.docx</span>
                  <span class="chip-arrow" id="chipArrow">▼</span>
                </div>
              </div>
              <div class="word-doc-overlay" id="attachDoc">
                <div class="word-doc-titlebar">
                  <span style="font-size:14px">📄</span>
                  <span class="word-doc-titlebar-text">client_briefing_notes.docx — Word</span>
                  <span style="font-size:10px; color:rgba(255,255,255,.6); cursor:pointer" onclick="toggleAttachment()">✕</span>
                </div>
                <div class="word-doc-ribbon">
                  <span>File</span><span>Home</span><span>Insert</span><span>Review</span><span>View</span>
                </div>
                <div class="word-doc-body">
                  <div class="word-doc-title">Client Briefing Notes</div>
                  <div class="word-doc-subtitle">Meridian Advisory Group · Internal Use Only · Do Not Forward</div>

                  <div>Engagement ref: <span class="tok clickable noise" data-id="region">MAG-2026-Q4</span> &nbsp;·&nbsp; Status: <span class="tok clickable noise" data-id="cluststat">active</span></div>
                  <div>Report version: <span class="tok clickable noise" data-id="version2">v2.1</span> &nbsp;·&nbsp; Deck: <span class="tok clickable noise" data-id="buildref">slide-44</span> &nbsp;·&nbsp; Slides: <span class="tok clickable noise" data-id="turbine2">14</span></div>

                  <div class="word-doc-section" style="font-size:13px;border-top:1px solid #e0e0e0;padding-top:12px;margin-top:14px">⚠ Portal Access — Strictly Confidential</div>
                  <div style="color:#666;font-size:10px;margin-bottom:8px">For the client reporting portal only. Do not share or forward.</div>
                  <div>Password: &nbsp;&nbsp;<span class="tok clickable" data-id="password">Webb@2026!</span></div>
                  <div>API Key: &nbsp;&nbsp;&nbsp;<span class="tok clickable" data-id="apikey">MRD-4491-BETA-77X</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="gpt-input-bar">
        <div class="gpt-input-field">
          <span style="color:#bbb">Message ChatGPT…</span>
          <div class="gpt-input-field-icons">
            <div class="gpt-input-icon">📎</div>
            <div class="gpt-input-icon">↑</div>
          </div>
        </div>
      </div>

    </div>
  `;

  document.querySelectorAll('.tok.clickable').forEach(el => {
    el.addEventListener('click', onTokenClick);
  });
}

// ════════════════════════════════════════════
//  ATTACHMENT TOGGLE
// ════════════════════════════════════════════
function toggleAttachment() {
  const doc = document.getElementById('attachDoc');
  const arrow = document.getElementById('chipArrow');
  const chip = document.querySelector('.gpt-attach-chip');
  if (!doc) return;
  const open = doc.classList.toggle('open');
  if (arrow) arrow.textContent = open ? '▲' : '▼';
  if (open && chip) chip.classList.remove('nudge');
}

// ════════════════════════════════════════════
//  SEGMENT BUILDER
// ════════════════════════════════════════════
function buildSegments() {
  Object.entries(CAT_TOKENS).forEach(([cat, ids]) => {
    const key = catKey(cat);
    const cont = document.getElementById(`segs${key}`);
    if (!cont) return;
    cont.innerHTML = '';
    ids.forEach(id => {
      const s = document.createElement('div');
      s.className = 'dc-seg';
      s.id = `seg_${id}`;
      cont.appendChild(s);
    });
  });
}

function catKey(cat) {
  return { credential:'Cred', pii:'Pii', internal:'Int' }[cat];
}
