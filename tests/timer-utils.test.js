import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCountdown, remainingMilliseconds, nextModeAfterSession } from '../src/timer-utils.js';

test('formats countdown and never shows negative time', () => {
  assert.equal(formatCountdown(1500), '00:02');
  assert.equal(formatCountdown(60_000), '01:00');
  assert.equal(formatCountdown(-100), '00:00');
});
test('calculates running time from deadline rather than interval ticks', () => {
  assert.equal(remainingMilliseconds({ status: 'running', endsAt: 55_000, remainingMs: 9_000 }, 50_000), 5_000);
  assert.equal(remainingMilliseconds({ status: 'running', endsAt: 50_000 }, 60_000), 0);
});
test('uses stored duration while paused or idle', () => {
  assert.equal(remainingMilliseconds({ status: 'paused', remainingMs: 2500 }, 50_000), 2500);
  assert.equal(remainingMilliseconds({ status: 'idle', remainingMs: -1 }, 50_000), 0);
});
test('cycles focus sessions into short/long breaks and breaks back to focus', () => {
  assert.equal(nextModeAfterSession('focus', 1, 4), 'shortBreak');
  assert.equal(nextModeAfterSession('focus', 4, 4), 'longBreak');
  assert.equal(nextModeAfterSession('shortBreak', 4, 4), 'focus');
  assert.equal(nextModeAfterSession('longBreak', 4, 4), 'focus');
});
