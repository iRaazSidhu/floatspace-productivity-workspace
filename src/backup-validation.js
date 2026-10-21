export function validateExportPayload(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const p = value;
  const record = (item) => !!item && typeof item === 'object' && !Array.isArray(item);
  const hasString = (item, key) => typeof item[key] === 'string';
  const hasNumber = (item, key) => typeof item[key] === 'number' && Number.isFinite(item[key]);

  if (p.app !== 'floatspace' || p.schemaVersion !== 1 || !Array.isArray(p.tasks) || !Array.isArray(p.notes) || !Array.isArray(p.bookmarks) || !Array.isArray(p.sessions) || !record(p.preferences) || !record(p.timer)) return false;
  if (p.currentTaskId !== undefined && p.currentTaskId !== null && typeof p.currentTaskId !== 'string') return false;
  if (!p.tasks.every((raw) => record(raw) && hasString(raw, 'id') && hasString(raw, 'title') && typeof raw.completed === 'boolean' && hasNumber(raw, 'createdAt') && ['low', 'medium', 'high'].includes(String(raw.priority)))) return false;
  if (!p.notes.every((raw) => record(raw) && hasString(raw, 'id') && hasString(raw, 'title') && hasString(raw, 'content') && typeof raw.pinned === 'boolean' && hasNumber(raw, 'updatedAt'))) return false;
  if (!p.bookmarks.every((raw) => {
    if (!record(raw) || !hasString(raw, 'id') || !hasString(raw, 'title') || !hasString(raw, 'url') || !hasString(raw, 'folder') || !hasNumber(raw, 'createdAt')) return false;
    if (raw.pinned !== undefined && typeof raw.pinned !== 'boolean') return false;
    try { return ['http:', 'https:'].includes(new URL(String(raw.url)).protocol); } catch { return false; }
  })) return false;
  if (!p.sessions.every((raw) => record(raw) && hasString(raw, 'id') && ['focus', 'shortBreak', 'longBreak'].includes(String(raw.mode)) && hasNumber(raw, 'startedAt') && hasNumber(raw, 'durationSeconds') && hasNumber(raw, 'completedAt'))) return false;
  const pref = p.preferences;
  for (const key of ['soundEnabled', 'breakReminderEnabled', 'notificationsEnabled', 'compactMode']) if (pref[key] !== undefined && typeof pref[key] !== 'boolean') return false;
  if (!['dark', 'light'].includes(String(pref.theme)) || !hasNumber(pref, 'focusMinutes') || Number(pref.focusMinutes) < 1 || Number(pref.focusMinutes) > 180 || !hasNumber(pref, 'shortBreakMinutes') || Number(pref.shortBreakMinutes) < 1 || Number(pref.shortBreakMinutes) > 60 || !hasNumber(pref, 'longBreakMinutes') || Number(pref.longBreakMinutes) < 1 || Number(pref.longBreakMinutes) > 90 || !hasNumber(pref, 'sessionsBeforeLongBreak') || Number(pref.sessionsBeforeLongBreak) < 2 || Number(pref.sessionsBeforeLongBreak) > 8) return false;
  const timer = p.timer;
  if (!['focus', 'shortBreak', 'longBreak'].includes(String(timer.mode)) || !['idle', 'running', 'paused', 'completed'].includes(String(timer.status)) || !hasNumber(timer, 'remainingMs')) return false;
  return true;
}
