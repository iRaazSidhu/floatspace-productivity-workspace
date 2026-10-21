import test from 'node:test';
import assert from 'node:assert/strict';
import { validateExportPayload } from '../src/backup-validation.js';

const valid = () => ({
  app: 'floatspace', schemaVersion: 1, exportedAt: new Date().toISOString(),
  tasks: [{ id: 't1', title: 'Focus', priority: 'medium', completed: false, createdAt: 1 }],
  notes: [{ id: 'n1', title: 'Idea', content: 'draft', pinned: false, updatedAt: 1 }],
  bookmarks: [{ id: 'b1', title: 'Example', url: 'https://example.com', folder: 'General', createdAt: 1 }],
  sessions: [{ id: 's1', mode: 'focus', startedAt: 1, durationSeconds: 1500, completedAt: 1501 }],
  preferences: { theme: 'dark', focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, sessionsBeforeLongBreak: 4 },
  timer: { mode: 'focus', status: 'idle', remainingMs: 1500000 }
});
test('accepts a valid Floatspace backup', () => assert.equal(validateExportPayload(valid()), true));
test('rejects unknown app or schema versions', () => {
  const p = valid(); p.app = 'other'; assert.equal(validateExportPayload(p), false);
  const q = valid(); q.schemaVersion = 2; assert.equal(validateExportPayload(q), false);
});
test('rejects unsafe bookmark protocols', () => {
  const p = valid(); p.bookmarks[0].url = 'javascript:alert(1)'; assert.equal(validateExportPayload(p), false);
});
test('rejects unexpected priority and out-of-range timer preferences', () => {
  const p = valid(); p.tasks[0].priority = 'urgent'; assert.equal(validateExportPayload(p), false);
  const q = valid(); q.preferences.focusMinutes = 500; assert.equal(validateExportPayload(q), false);
});
test('rejects malformed records instead of arbitrary objects', () => {
  const p = valid(); p.notes = [null]; assert.equal(validateExportPayload(p), false);
});
