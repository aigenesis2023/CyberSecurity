// ════════════════════════════════════════════
//  TOKEN CLICK → POPUP
// ════════════════════════════════════════════
function onTokenClick(e) {
  if (!gameActive) return;
  const id = e.currentTarget.dataset.id;
  if (tokState[id].redacted) return;
  e.stopPropagation();
  playClick();
  showPopup(e.currentTarget, id);
}

function showPopup(el, id) {
  activePopupTokenId = id;
  const popup = document.getElementById('catPopup');
  popup.classList.add('show');

  if (window.innerWidth <= 768) {
    // Mobile/tablet: bottom sheet — CSS handles position:fixed bottom:0
    popup.style.top  = '';
    popup.style.left = '';
  } else {
    // Desktop: position near token
    const rect = el.getBoundingClientRect();
    let top  = rect.bottom + 6;
    let left = rect.left;
    if (left + 210 > window.innerWidth)  left = window.innerWidth - 218;
    if (top + 90   > window.innerHeight) top  = rect.top - 90;
    popup.style.top  = top  + 'px';
    popup.style.left = left + 'px';
  }
}

function closePopup() {
  document.getElementById('catPopup').classList.remove('show');
  activePopupTokenId = null;
}

document.addEventListener('click', e => {
  const popup = document.getElementById('catPopup');
  if (popup.classList.contains('show') && !popup.contains(e.target)) closePopup();
});

// ════════════════════════════════════════════
//  CLASSIFY
// ════════════════════════════════════════════
function classify(chosenCat) {
  if (!activePopupTokenId) return;
  const id = activePopupTokenId;
  const token = TOKENS[id];
  closePopup();

  const isSensitive = token.cat !== 'noise';

  // ── User chose SAFE ──────────────────────────────
  if (chosenCat === 'safe') {
    if (!isSensitive) {
      // Correct: safe token confirmed → +3% integrity
      playSelected();
      safeBonus += 0.008;
      integrity = Math.min(100, integrity + 3);
      safeConfirmed++;
      updateSafeCt();
      showIntPop(+3);
      updateIntUI();
      redactToken(id, 'fp');
    } else {
      // Wrong: sensitive dismissed as safe → −10% integrity penalty
      playWrong();
      integrity = Math.max(0, integrity - 10);
      classifyErrors++;
      showIntPop(-10);
      flashDelta(-10, 'sensitive exposed!', 'penalty');
      updateIntUI();
      const el = document.querySelector(`.tok[data-id="${id}"]`);
      if (el) {
        el.style.background = 'rgba(239,68,68,.22)';
        el.style.color = 'var(--red)';
        setTimeout(() => { el.style.background=''; el.style.color=''; }, 700);
      }
      if (integrity <= 0) endGame('breach');
    }
    return;
  }

  // ── User chose CRED / PII / INTEL ────────────────
  if (!isSensitive) {
    // Noise token flagged as sensitive → integrity penalty
    playWrong();
    integrity = Math.max(0, integrity - 5);
    classifyErrors++;
    showIntPop(-5);
    flashDelta(-5, 'unnecessary flag', 'penalty');
    updateIntUI();
    if (integrity <= 0) endGame('breach');
    return;
  }

  if (chosenCat !== token.cat) {
    // Wrong sensitive category → shake + flash, retry allowed
    playWrong();
    const catEl = document.getElementById(`cat${catKey(token.cat)}`);
    catEl.style.animation = 'none';
    void catEl.offsetWidth;
    catEl.style.animation = 'wrongShake .4s ease';
    const el = document.querySelector(`.tok[data-id="${id}"]`);
    if (el) {
      el.style.background = 'rgba(239,68,68,.22)';
      el.style.color = 'var(--red)';
      setTimeout(() => { el.style.background=''; el.style.color=''; }, 700);
    }
    return;
  }

  // Correct sensitive classification
  playSelected();
  const drainBefore = getDrain();
  redactToken(id, token.cat);
  updateDiag(token.cat, id);
  const drainAfter = getDrain();
  const saved = drainBefore - drainAfter;
  if (saved > 0) {
    const pct = Math.round((saved / MAX_DRAIN) * 100);
    flashDelta(0, `▼ −${pct}% drain rate`, 'gain');
  } else {
    flashDelta(0, 'Token redacted', 'gain');
  }
  updateIntUI();
}

function redactToken(id, cat) {
  tokState[id].redacted = true;
  const el = document.querySelector(`.tok[data-id="${id}"]`);
  if (!el) return;

  // Build redacted block
  const catClass = cat === 'fp' ? 'cat-safe' : `cat-${cat === 'credential' ? 'cred' : cat === 'pii' ? 'pii' : 'int'}`;
  const originalText = el.textContent.trim();
  el.className = `tok redacted ${catClass}`;
  el.innerHTML = `<span class="redact-label">${originalText}</span>`;
  el.removeEventListener('click', onTokenClick);
}
