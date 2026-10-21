# Floatspace MVP implementation plan

## Scope
Local-first productivity workspace delivered as a web app, Chrome Extension Manifest V3 side panel, and compact Document Picture-in-Picture window where supported.

### MVP
- Pomodoro: focus, short/long break, pause/resume/reset/skip and timestamp-based countdown
- Task list, completion, priority and quick-add
- Quick notes with local autosave
- User-created HTTP(S) bookmarks and quick links
- Focus history and small productivity summary
- Dark/light theme and compact mode
- Floating PiP timer controls with browser support fallback
- IndexedDB persistence
- JSON export/import and clear-data action
- Chrome side panel and background alarm foundation
- Keyboard accessible controls and responsive layout

### Deferred
- Automatic browser history collection
- Automatic cross-origin website/extension data bridge
- Cloud sync, accounts, teams, billing, AI and native desktop overlay

## Architecture
- React + TypeScript + Vite
- IndexedDB stores one versioned workspace payload in this initial MVP
- Timer derives remaining time from `endsAt`, not interval tick counts
- Document PiP is feature-detected and opened after user interaction
- MV3 side panel and service worker alarms provide browser UI/background reminder support
- JSON backup files are the manual transfer path between web-origin and extension-origin storage

## Local data
The workspace payload contains tasks, notes, bookmarks, focus sessions, preferences and timer state. There are no remote API endpoints, authentication, cloud database or analytics SDK. Browser storage may be deleted with the profile; users should export backups.

## Build milestones
1. App shell and design system
2. IndexedDB storage and timer
3. Tasks / notes / links / preferences
4. PiP and side panel
5. Import/export, privacy controls
6. Automated tests and browser QA


## Balanced floating workspace refinement

The floating Document PiP view is a compact mini-workspace, not a timer-only player.

### Always-visible content
- Header: Floatspace identity, local-only indicator and close control.
- Timer: current mode and countdown, progress ring, start/pause, reset and skip.
- Task area: selected current task plus up to two next pending tasks, with in-place completion and task promotion.
- Pinned note: one pinned note preview, clamped to two lines.
- Pinned links: up to three user-pinned links.
- Dock: Focus, Tasks, Notes, Links, Stats and More; plus quick task capture.

### Drawer interactions
- Tasks: view the pending queue, select the current focus task and quickly add a task.
- Notes: create a quick note and pin/unpin the note shown in the always-visible preview.
- Links: open saved links and pin/unpin links shown in the mini workspace.
- Stats: today's completed focus time, focus-session count, tasks completed today and tasks remaining.
- More: current reminder/sound settings summary.

### Reminder preferences
- Sound cue is local and best-effort when a focus/break session completes.
- In-app reminder can be toggled independently.
- System notifications are opt-in and request browser permission explicitly.
- Breaks do not auto-start; the next mode is prepared and the user chooses when to begin.

### Storage compatibility
- `currentTaskId`, bookmark `pinned`, and reminder booleans are added as local fields.
- Older local records and older backups remain accepted; defaults fill new preference values on load/restore.
- No cloud database or analytics endpoints were introduced.
