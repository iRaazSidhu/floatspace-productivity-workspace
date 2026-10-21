export function formatCountdown(milliseconds: number): string;
export function remainingMilliseconds(timer: { status?: string; endsAt?: number | null; remainingMs?: number }, now?: number): number;
export function nextModeAfterSession(mode: string, completedFocusSessions: number, sessionsBeforeLongBreak?: number): string;
