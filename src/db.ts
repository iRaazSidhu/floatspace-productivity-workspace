import { validateExportPayload } from './backup-validation.js';

export type TaskPriority = 'low' | 'medium' | 'high';
export type Task = { id: string; title: string; priority: TaskPriority; dueDate?: string; completed: boolean; createdAt: number; completedAt?: number };
export type Note = { id: string; title: string; content: string; pinned: boolean; updatedAt: number };
export type BookmarkRecord = { id: string; title: string; url: string; folder: string; createdAt: number; pinned?: boolean };
export type TimerMode = 'focus' | 'shortBreak' | 'longBreak';
export type TimerState = { mode: TimerMode; status: 'idle' | 'running' | 'paused' | 'completed'; startedAt: number | null; endsAt: number | null; remainingMs: number };
export type Session = { id: string; mode: TimerMode; startedAt: number; durationSeconds: number; completedAt: number };
export type Preferences = { theme: 'dark' | 'light'; focusMinutes: number; shortBreakMinutes: number; longBreakMinutes: number; sessionsBeforeLongBreak: number; soundEnabled: boolean; breakReminderEnabled: boolean; notificationsEnabled: boolean; compactMode: boolean };
export type ExportPayload = { app: 'floatspace'; schemaVersion: 1; exportedAt: string; currentTaskId?: string | null; tasks: Task[]; notes: Note[]; bookmarks: BookmarkRecord[]; sessions: Session[]; preferences: Preferences; timer: TimerState };

export const DEFAULT_PREFERENCES: Preferences = { theme: 'dark', focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, sessionsBeforeLongBreak: 4, soundEnabled: true, breakReminderEnabled: true, notificationsEnabled: false, compactMode: false };
export const DEFAULT_TIMER: TimerState = { mode: 'focus', status: 'idle', startedAt: null, endsAt: null, remainingMs: 25 * 60_000 };
export const DEFAULT_DATA: ExportPayload = { app: 'floatspace', schemaVersion: 1, exportedAt: new Date().toISOString(), currentTaskId: null, tasks: [], notes: [], bookmarks: [], sessions: [], preferences: DEFAULT_PREFERENCES, timer: DEFAULT_TIMER };

const DB_NAME = 'floatspace-local';
const STORE = 'workspace';
const KEY = 'main';
let database: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB is not available in this browser context.'));
  if (!database) database = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open local workspace database.'));
  });
  return database;
}

export const db = {
  async load(): Promise<ExportPayload> {
    const idb = await openDb();
    return new Promise((resolve, reject) => {
      const request = idb.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
      request.onsuccess = () => {
        const value = request.result as unknown;
        if (!value) { resolve(DEFAULT_DATA); return; }
        if (validateExportPayload(value)) resolve({ ...DEFAULT_DATA, ...value, preferences: { ...DEFAULT_PREFERENCES, ...value.preferences } });
        else reject(new Error('Saved workspace data is invalid. Export any available backup before clearing local data.'));
      };
      request.onerror = () => reject(request.error ?? new Error('Could not load workspace.'));
    });
  },
  async save(value: ExportPayload): Promise<void> {
    const idb = await openDb();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, KEY);
      tx.oncomplete = () => {
        // In an extension context, mirror only timer metadata to the service worker
        // so Chrome Alarms can still fire after the side panel closes. No app data
        // is sent to a remote server.
        const extension = (globalThis as typeof globalThis & { chrome?: { runtime?: { sendMessage?: (message: unknown) => unknown } } }).chrome;
        try {
          if (extension?.runtime?.sendMessage) extension.runtime.sendMessage({ type: 'TIMER_UPDATED', timer: value.timer });
        } catch { /* The website context has no extension runtime; local save succeeded. */ }
        resolve();
      };
      tx.onerror = () => reject(tx.error ?? new Error('Could not save workspace.'));
      tx.onabort = () => reject(tx.error ?? new Error('Workspace save was interrupted.'));
    });
  },
  async clear(): Promise<void> {
    const idb = await openDb();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Could not clear workspace.'));
    });
  },
};
