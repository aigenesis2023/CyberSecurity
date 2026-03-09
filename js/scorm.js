// ════════════════════════════════════════════
//  SCORM 1.2 API WRAPPER
//  ─────────────────────────────────────────
//  Drop-in module. When loaded inside an LMS,
//  the window.API object is provided by the
//  LMS frame. All calls are no-ops when API
//  is absent (standalone / dev mode).
// ════════════════════════════════════════════

const SCORM = (() => {
  let _api = null;
  let _initialized = false;

  // ── Find the SCORM API in the parent frame chain ──
  function findAPI(win) {
    let attempts = 0;
    while (win.API == null && win.parent != null && win.parent !== win) {
      attempts++;
      if (attempts > 7) return null;
      win = win.parent;
    }
    return win.API || null;
  }

  function getAPI() {
    if (_api) return _api;
    _api = findAPI(window);
    if (!_api && window.opener) _api = findAPI(window.opener);
    return _api;
  }

  // ── Lifecycle ──
  function initialize() {
    const api = getAPI();
    if (!api) return false;
    const result = api.LMSInitialize('');
    _initialized = result === 'true' || result === true;
    return _initialized;
  }

  function finish() {
    const api = getAPI();
    if (!api || !_initialized) return;
    api.LMSCommit('');
    api.LMSFinish('');
    _initialized = false;
  }

  // ── Data model ──
  function setValue(element, value) {
    const api = getAPI();
    if (!api || !_initialized) return;
    api.LMSSetValue(element, String(value));
    api.LMSCommit('');
  }

  function getValue(element) {
    const api = getAPI();
    if (!api || !_initialized) return '';
    return api.LMSGetValue(element);
  }

  // ── Public helpers used by game.js ──
  function setScore(raw, min, max) {
    setValue('cmi.core.score.raw', raw);
    setValue('cmi.core.score.min', min);
    setValue('cmi.core.score.max', max);
  }

  function setCompletion(passed) {
    setValue('cmi.core.lesson_status', passed ? 'passed' : 'failed');
  }

  function setBookmark(data) {
    // Accepts a JSON-serialisable object; stored as string
    setValue('cmi.suspend_data', JSON.stringify(data));
  }

  function getBookmark() {
    const raw = getValue('cmi.suspend_data');
    try { return raw ? JSON.parse(raw) : null; } catch { return null; }
  }

  // ── Auto-initialize on load ──
  initialize();
  window.addEventListener('beforeunload', finish);

  return { initialize, finish, setValue, getValue, setScore, setCompletion, setBookmark, getBookmark };
})();

// ── Convenience globals called by game.js ──
function scormSetScore(raw, min, max) { SCORM.setScore(raw, min, max); }
function scormSetCompletion(passed)   { SCORM.setCompletion(passed); }
function scormSetBookmark(data)       { SCORM.setBookmark(data); }
function scormGetBookmark()           { return SCORM.getBookmark(); }
