export function formatCountdown(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function remainingMilliseconds(timer, now = Date.now()) {
  if (timer?.status === 'running' && Number.isFinite(timer.endsAt)) return Math.max(0, timer.endsAt - now);
  return Math.max(0, Number(timer?.remainingMs) || 0);
}

export function nextModeAfterSession(mode, completedFocusSessions, sessionsBeforeLongBreak = 4) {
  if (mode !== 'focus') return 'focus';
  const threshold = Math.max(2, Math.floor(Number(sessionsBeforeLongBreak) || 4));
  return completedFocusSessions > 0 && completedFocusSessions % threshold === 0 ? 'longBreak' : 'shortBreak';
}
