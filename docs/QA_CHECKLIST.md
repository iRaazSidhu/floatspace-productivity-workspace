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


## Balanced floating workspace
- [ ] Open PiP from an explicit user click; unsupported browsers show the fallback notice.
- [ ] Default requested PiP size is balanced, and the window does not attempt to dictate screen position.
- [ ] Timer, current task and two next tasks remain visible together.
- [ ] Complete the current task in PiP; current selection advances to the next incomplete task.
- [ ] Promote a next task to the current focus task.
- [ ] Pin one note; its preview appears in the always-visible area; unpinning shows the empty state.
- [ ] Pin/unpin quick links; at most three pinned links appear in the floating view.
- [ ] Quick-add a task and create a note from within the floating window.
- [ ] Tasks, notes, pinned links, timer and settings changes are reflected between main UI and PiP.
- [ ] Today's focus stats count only sessions completed today.
- [ ] Sound can be toggled independently from in-app break reminders.
- [ ] System notifications are opt-in and handle denied/unsupported browser permission.
- [ ] Close/reopen PiP and verify the stored timer state remains.
- [ ] Confirm no task/note/bookmark content is sent to a remote server.
