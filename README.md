# AI Data Guardian

Gamified AI security awareness training for non-technical employees.

## What's in this repo

```
├── index.html        ← Landing page (what visitors see at aidataguardians.com)
├── website/          ← Landing page styles and images
│
├── game/             ← The training game (everything needed for SCORM export)
│   ├── index.html    ← The game itself
│   └── assets/       ← Audio files and fonts used by the game
│
├── screenshots/      ← Game screenshots (used on the landing page)
│
└── source/           ← Original source CSS/JS files (not loaded by the game —
                        the game has everything inlined in its HTML file)
```

## How to preview locally

Open `index.html` in a browser to see the landing page. Click "Try the Demo" to launch the game.

Or run a local server:
```
python3 serve.py
```
Then visit `http://localhost:8000`

## How to export for SCORM (LMS upload)

1. Zip the entire `game/` folder
2. Add an `imsmanifest.xml` to the zip (SCORM 1.2 format)
3. Upload the zip to your LMS

The game's `index.html` is already the launch file — no renaming needed.

## Live site

Landing page: [aidataguardians.com](https://aidataguardians.com)

## Contact

Leo Duncan — [leo@aidataguardians.com](mailto:leo@aidataguardians.com)
