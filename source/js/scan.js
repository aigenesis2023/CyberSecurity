// ════════════════════════════════════════════
//  SCAN TOOL
// ════════════════════════════════════════════
function runScan(free = false) {
  if (!gameActive) return;
  if (!free) {
    if (scansLeft <= 0) return;
    scansLeft--; scansUsed++;
    document.getElementById('scanCt').textContent = scansLeft;
    if (scansLeft === 0) document.getElementById('btnScan').disabled = true;
  }

  const sl = document.getElementById('scanline');
  sl.classList.remove('run'); void sl.offsetWidth; sl.classList.add('run');

  // Highlight ALL unredacted tokens with a single uniform colour — no clues
  document.querySelectorAll('.tok.clickable').forEach(el => {
    if (tokState[el.dataset.id]?.redacted) return;
    el.classList.add('hint-scan');
    setTimeout(() => el.classList.remove('hint-scan'), 2000);
  });
}

// ════════════════════════════════════════════
//  GHOST SCAN ON START
// ════════════════════════════════════════════
function runGhostScan() {
  document.querySelectorAll('.tok.clickable:not(.noise)').forEach((el, i) => {
    setTimeout(() => {
      el.classList.add('ghost');
      setTimeout(() => el.classList.remove('ghost'), 500);
    }, i * 170 + 800);
  });
}
