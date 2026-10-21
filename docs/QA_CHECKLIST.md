# Floatspace MVP QA checklist

## Automated
- [ ] `npm test` — countdown formatting, timestamp-based timer and focus/break cycle
- [ ] `npm run typecheck`
- [ ] `npm run build`

## Web app
- [ ] Workspace opens without login
- [ ] Tasks can be added/completed/deleted and persist after reload
- [ ] Notes can be created/edited/deleted and persist after reload
- [ ] Quick links accept only HTTP(S) URLs
- [ ] Timer pause/resume/reset/skip and custom durations work
- [ ] Session completion is recorded and long break is selected on schedule
- [ ] Theme and compact mode persist
- [ ] Export, import merge/replace and clear data behave safely

## PiP and extension
- [ ] PiP opens from user click on a supporting browser
- [ ] Unsupported browser shows a fallback message
- [ ] PiP timer controls update the main UI
- [ ] Closing PiP does not reset timer state
- [ ] Chrome toolbar click opens side panel
- [ ] Extension storage is treated as separate from the website's IndexedDB

## Privacy and quality
- [ ] No task/note content is uploaded to a server
- [ ] Invalid or oversized backups are rejected
- [ ] Clearing all data requires confirmation
- [ ] Responsive layout is usable at narrow widths
- [ ] Keyboard focus and reduced-motion preference are supported
