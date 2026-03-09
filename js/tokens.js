// ════════════════════════════════════════════
//  TOKEN DEFINITIONS
// ════════════════════════════════════════════
const TOKENS = {
  apikey:   { id:'apikey',   cat:'credential', drain:4,   label:'CREDENTIAL' },
  password: { id:'password', cat:'credential', drain:4,   label:'CREDENTIAL' },
  email:    { id:'email',    cat:'pii',        drain:1,   label:'PII' },
  name:     { id:'name',     cat:'pii',        drain:1,   label:'PII' },
  project:  { id:'project',  cat:'internal',   drain:0.3, label:'INTEL' },
  // False positives
  version:   { id:'version',   cat:'noise', drain:0, label:'SAFE' },
  region:    { id:'region',    cat:'noise', drain:0, label:'SAFE' },
  turbine:   { id:'turbine',   cat:'noise', drain:0, label:'SAFE' },
  buildref:  { id:'buildref',  cat:'noise', drain:0, label:'SAFE' },
  cluststat: { id:'cluststat', cat:'noise', drain:0, label:'SAFE' },
  version2:  { id:'version2',  cat:'noise', drain:0, label:'SAFE' },
  region2:   { id:'region2',   cat:'noise', drain:0, label:'SAFE' },
  turbine2:  { id:'turbine2',  cat:'noise', drain:0, label:'SAFE' },
};

// Runtime state per token
function freshTokenState() {
  const s = {};
  Object.keys(TOKENS).forEach(k => { s[k] = { redacted:false }; });
  return s;
}

const CAT_TOKENS = {
  credential: ['apikey','password'],
  pii:        ['name','email'],
  internal:   ['project'],
};
