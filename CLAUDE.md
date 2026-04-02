# AI Data Guardian

## Project overview
Gamified cybersecurity awareness training for non-technical employees. Three missions teaching AI security risks: data leakage, hallucination detection, and prompt injection. Targeting 20-minute completion time. SCORM 1.2 compliant for LMS deployment.

## Architecture
- **Landing page**: `index.html` (root) + `website/styles.css` — static marketing site hosted on Cloudflare
- **Game**: `game/index.html` — loads external CSS and JS files
  - `game/styles.css` — all game CSS
  - `game/core.js` — shared logic (audio, navigation, progress, SCORM, certificate, pause/resume, insight engine)
  - `game/missions/mission1.js` — Mission 1: Sensitive Data Exposure
  - `game/missions/mission2.js` — Mission 2: AI Hallucination Detection
  - `game/missions/mission3.js` — Mission 3: Prompt Injection Attacks
  - `game/imsmanifest.xml` — SCORM 1.2 manifest
  - `game/assets/` — audio files and fonts

## Tech stack
Pure vanilla HTML/CSS/JS. Zero dependencies. No build tools. No frameworks.

## Key conventions
- Missions are independent — they communicate only through `courseProgress` object and `showScreen()` navigation
- Each mission has its own state object (`s1state`, `s2state`, `s3state`) and prefixed functions (`s1Start`, `s2Start`, etc.)
- Audio uses Web Audio API with HTML Audio fallback
- Progress persists via localStorage (`adg_progress`)
- SCORM API integration reports composite scores across all missions

## Access modes
Default is **demo mode** (M1 only). Hidden keyboard shortcuts switch modes:
- **A+1** — Full version (normal progression: M2 unlocks after M1, M3 after M2)
- **A+2** — Dev mode (all missions unlocked immediately)
Controlled by `_accessMode` variable in `core.js`. No visible UI for mode switching.

## Do not touch
- `index.html` (root) — landing page, Cloudflare deployment points here
- `.env` files — may contain API keys
- `main` branch — all work happens on feature branches

## Local development
```
python3 serve.py
# Opens on port 8080, use Codespace port forwarding to preview
```

## SCORM packaging
Zip the entire `game/` folder. The manifest (`imsmanifest.xml`) lists all required files. Upload the zip to any SCORM 1.2 compatible LMS.

## Adding new missions
1. Create `game/missions/missionN.js` following existing pattern (prefixed functions, state object)
2. Add mission HTML (briefing, gameplay screen, verdict) to `game/index.html`
3. Add `<script src="missions/missionN.js"></script>` to `game/index.html`
4. Update `courseProgress` in `core.js` for new unlock logic
5. Update `game/imsmanifest.xml` with new file
6. Add corresponding audio files to `game/assets/audio/`

## Accessibility
WCAG 2.1 Level AA. Keyboard navigable, ARIA labels, 4.5:1 contrast, 44x44px touch targets. Mission 3 timer is an allowed exception (essential to learning objective).

## Live site
https://aidataguardians.com (game at /game/index.html)
