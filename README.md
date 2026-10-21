# Floatspace — Local-first Productivity Workspace

Floatspace is an MVP productivity workspace with Pomodoro, tasks, notes, quick links, focus history, local backup/restore, a Chrome Extension side panel, and a floating Document Picture-in-Picture window where supported.

## Privacy model

- No account, backend, remote database, or automatic cloud sync.
- Website and Chrome extension store data separately in their own browser origins.
- Use JSON export/import to manually move data between the website and extension.
- No automatic browser-history collection.

## MVP includes

- Responsive React + TypeScript dashboard
- Timestamp-based Pomodoro timer, breaks, stopwatch/countdown utilities
- Tasks, quick notes, saved links, focus-session history
- IndexedDB persistence, configurable settings and themes
- JSON export/import with schema validation
- Document PiP workspace with supported-browser fallback
- Chrome Extension Manifest V3 side panel and alarms

## Requirements

- Node.js 20+
- npm
- A supporting Chromium browser for the extension and Document PiP; use HTTPS or localhost for the web app

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run typecheck
npm test
npm run build
```

## Load the Chrome extension

1. Run `npm install` and `npm run build`.
2. Open `chrome://extensions` and enable Developer mode.
3. Click **Load unpacked** and select the generated `dist/` directory.
4. Pin Floatspace and click its toolbar icon to open the side panel.

## Storage and backup

App data is stored locally in IndexedDB. Extension and website storage are isolated, so this MVP uses explicit JSON export/import rather than automatic cross-context data sharing. Export important data regularly: clearing browser profile/site data or uninstalling the extension may remove local records.

## Repository docs

- `docs/IMPLEMENTATION_PLAN.md` — architecture and build plan
- `docs/QA_CHECKLIST.md` — manual verification checklist

## Status

MVP source code has been added. Automated Node tests cover timer utilities and backup validation. Run the complete typecheck and production build locally after installing dependencies; npm registry access was unavailable in the original build environment, so the full Vite build has not yet been verified there.
