export function formatCountdown(milliseconds: number): string;
export function remainingMilliseconds(timer: { status?: string; endsAt?: number | null; remainingMs?: number }, now?: number): number;
export type TimerMode = 'focus' | 'shortBreak' | 'longBreak';
export function nextModeAfterSession(mode: TimerMode, completedFocusSessions: number, sessionsBeforeLongBreak?: number): TimerMode;
