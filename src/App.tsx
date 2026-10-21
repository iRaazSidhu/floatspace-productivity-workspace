import type * as React from 'react';
import { Activity, Bookmark, Check, CheckCircle2, Clock3, Download, FileText, LayoutDashboard, ListTodo, Moon, Pause, PictureInPicture2, Play, Plus, Settings2, ShieldCheck, SkipForward, Sun, TimerReset, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { db, DEFAULT_DATA, type BookmarkRecord, type ExportPayload, type Note, type Task, type TimerMode } from './db';
import { validateExportPayload } from './backup-validation.js';
import { formatCountdown, nextModeAfterSession, remainingMilliseconds } from './timer-utils.js';
import './styles.css';

type View = 'overview' | 'focus' | 'tasks' | 'notes' | 'links' | 'history' | 'settings';
const nav: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard }, { id: 'focus', label: 'Focus timer', icon: Clock3 },
  { id: 'tasks', label: 'Tasks', icon: ListTodo }, { id: 'notes', label: 'Quick notes', icon: FileText },
  { id: 'links', label: 'Quick links', icon: Bookmark }, { id: 'history', label: 'Focus history', icon: Activity },
];
const uid = () => crypto.randomUUID();
const duration = (mode: TimerMode, d: ExportPayload) => (mode === 'focus' ? d.preferences.focusMinutes : mode === 'shortBreak' ? d.preferences.shortBreakMinutes : d.preferences.longBreakMinutes) * 60_000;

export default function App({ extensionMode = false }: { extensionMode?: boolean }) {
  const [data, setData] = useState<ExportPayload>(DEFAULT_DATA);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<View>('overview');
  const [taskDraft, setTaskDraft] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [bookmarkTitle, setBookmarkTitle] = useState('');
  const [bookmarkUrl, setBookmarkUrl] = useState('');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [now, setNow] = useState(Date.now());
  const [pipOpen, setPipOpen] = useState(false);
  const pipRef = useRef<Window | null>(null);
  const endedRef = useRef<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { db.load().then((saved) => { setData(saved); setLoaded(true); }).catch(() => { setLoaded(true); setNotice('Local storage could not be opened.'); }); }, []);
  useEffect(() => { if (loaded) void db.save(data).catch(() => setNotice('Could not save locally. Export a backup and check browser storage.')); }, [data, loaded]);
  useEffect(() => {
    const interval = window.setInterval(() => {
      const tick = Date.now(); setNow(tick);
      setData((current) => {
        const timer = current.timer;
        if (timer.status !== 'running' || !Number.isFinite(timer.endsAt)) return current;
        const left = remainingMilliseconds(timer, tick);
        if (left > 0 || endedRef.current === timer.endsAt) return current;
        endedRef.current = timer.endsAt!;
        const completedFocus = current.sessions.filter((s) => s.mode === 'focus').length + (timer.mode === 'focus' ? 1 : 0);
        const nextMode = nextModeAfterSession(timer.mode, completedFocus, current.preferences.sessionsBeforeLongBreak);
        const session = { id: uid(), mode: timer.mode, startedAt: timer.startedAt ?? tick, durationSeconds: Math.max(0, Math.round((timer.endsAt! - (timer.startedAt ?? tick)) / 1000)), completedAt: tick };
        return { ...current, sessions: [session, ...current.sessions], timer: { mode: nextMode, status: 'idle', startedAt: null, endsAt: null, remainingMs: duration(nextMode, current) } };
      });
    }, 400);
    return () => window.clearInterval(interval);
  }, []);

  const remaining = remainingMilliseconds(data.timer, now);
  const openTasks = data.tasks.filter((task) => !task.completed);
  const filteredTasks = useMemo(() => data.tasks.filter((task) => task.title.toLowerCase().includes(search.toLowerCase())), [data.tasks, search]);
  const todaySessions = data.sessions.filter((s) => new Date(s.completedAt).toDateString() === new Date().toDateString());
  const focusMinutes = todaySessions.filter((s) => s.mode === 'focus').reduce((sum, s) => sum + s.durationSeconds / 60, 0);
  const patch = (fn: (old: ExportPayload) => ExportPayload) => setData((old) => fn(old));
  const setNoticeFor = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(''), 3000); };

  function addTask(event?: React.FormEvent) {
    event?.preventDefault(); const title = taskDraft.trim(); if (!title) return;
    const task: Task = { id: uid(), title, priority: 'medium', completed: false, createdAt: Date.now() };
    patch((old) => ({ ...old, tasks: [task, ...old.tasks] })); setTaskDraft(''); setNoticeFor('Task saved locally');
  }
  function toggleTask(task: Task) {
    patch((old) => ({ ...old, tasks: old.tasks.map((item) => item.id === task.id ? { ...item, completed: !item.completed, completedAt: !item.completed ? Date.now() : undefined } : item) }));
  }
  function addNote(event?: React.FormEvent) {
    event?.preventDefault(); const content = noteDraft.trim(); if (!content) return;
    const note: Note = { id: uid(), title: content.split('\n')[0].slice(0, 52) || 'Quick note', content, pinned: false, updatedAt: Date.now() };
    patch((old) => ({ ...old, notes: [note, ...old.notes] })); setNoteDraft(''); setNoticeFor('Note saved locally');
  }
  function addBookmark(event?: React.FormEvent) {
    event?.preventDefault(); const title = bookmarkTitle.trim(); let url: URL;
    try { url = new URL(bookmarkUrl.trim()); } catch { setNoticeFor('Enter a valid website URL'); return; }
    if (!['http:', 'https:'].includes(url.protocol)) { setNoticeFor('Only HTTP and HTTPS links are allowed'); return; }
    const record: BookmarkRecord = { id: uid(), title: title || url.hostname, url: url.href, folder: 'General', createdAt: Date.now() };
    patch((old) => ({ ...old, bookmarks: [record, ...old.bookmarks] })); setBookmarkTitle(''); setBookmarkUrl(''); setNoticeFor('Link saved locally');
  }
  function updateTimer(next: ExportPayload['timer']) { patch((old) => ({ ...old, timer: next })); }
  function startTimer() {
    const left = data.timer.status === 'paused' ? data.timer.remainingMs : (data.timer.remainingMs > 0 && data.timer.status === 'idle' ? data.timer.remainingMs : duration(data.timer.mode, data));
    const start = Date.now();
    updateTimer({ ...data.timer, status: 'running', startedAt: start, endsAt: start + left, remainingMs: left });
    endedRef.current = null;
  }
  function pauseTimer() {
    const left = remainingMilliseconds(data.timer, Date.now());
    updateTimer({ ...data.timer, status: 'paused', startedAt: null, endsAt: null, remainingMs: left });
  }
  function resetTimer(mode: TimerMode = data.timer.mode) {
    updateTimer({ mode, status: 'idle', startedAt: null, endsAt: null, remainingMs: duration(mode, data) });
    endedRef.current = null;
  }
  function skipTimer() { resetTimer(data.timer.mode === 'focus' ? 'shortBreak' : 'focus'); }
  async function openPiP() {
    const api = (window as Window & { documentPictureInPicture?: { requestWindow: (options?: { width?: number; height?: number }) => Promise<Window> } }).documentPictureInPicture;
    if (!api) { setNoticeFor('Floating PiP is not supported in this browser. Use the Chrome side panel instead.'); return; }
    try {
      const win = await api.requestWindow({ width: 340, height: 240 }); pipRef.current = win; setPipOpen(true);
      win.document.title = 'Floatspace Focus';
      win.document.head.innerHTML = '<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:20px;background:#0b0d12;color:#f1f3f7;font-family:Inter,system-ui,sans-serif}main{display:grid;gap:13px}.label{font-size:11px;letter-spacing:1.5px;color:#a0a7b4;text-transform:uppercase}.time{font-size:56px;font-weight:750;letter-spacing:-3px}.row{display:flex;gap:8px}button{border:0;border-radius:10px;padding:10px 13px;background:#c5f477;color:#1c260e;font-weight:700;cursor:pointer}button.alt{background:#222733;color:#eef0f6}</style>';
      win.document.body.innerHTML = '<main><div class="label" id="pip-mode">FOCUS SESSION</div><div class="time" id="pip-time">25:00</div><div class="row"><button id="pip-toggle">Start</button><button class="alt" id="pip-reset">Reset</button><button class="alt" id="pip-close">Close</button></div><div class="label">Your data stays on this device</div></main>';
      win.document.getElementById('pip-toggle')?.addEventListener('click', () => {
        if (data.timer.status === 'running') pauseTimer(); else startTimer();
      });
      win.document.getElementById('pip-reset')?.addEventListener('click', () => resetTimer());
      win.document.getElementById('pip-close')?.addEventListener('click', () => win.close());
      win.addEventListener('pagehide', () => { pipRef.current = null; setPipOpen(false); });
    } catch { setNoticeFor('Could not open floating window. Try clicking again from the page.'); }
  }
  useEffect(() => {
    const win = pipRef.current; if (!win || win.closed) return;
    const mode = win.document.getElementById('pip-mode'); const time = win.document.getElementById('pip-time'); const toggle = win.document.getElementById('pip-toggle');
    if (mode) mode.textContent = data.timer.mode === 'focus' ? 'FOCUS SESSION' : data.timer.mode === 'shortBreak' ? 'SHORT BREAK' : 'LONG BREAK';
    if (time) time.textContent = formatCountdown(remaining);
    if (toggle) toggle.textContent = data.timer.status === 'running' ? 'Pause' : 'Start / Resume';
  }, [data.timer, remaining]);

  function exportData() {
    const blob = new Blob([JSON.stringify({ ...data, app: 'floatspace', schemaVersion: 1, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'floatspace-backup.json'; a.click(); URL.revokeObjectURL(url); setNoticeFor('Backup exported');
  }
  async function importData(file?: File) {
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('Backup must be smaller than 10 MB');
      const incoming = JSON.parse(await file.text()) as ExportPayload;
      if (!validateExportPayload(incoming)) throw new Error('This is not a valid Floatspace backup');
      const replace = window.confirm('OK = replace current workspace. Cancel = merge records by ID.');
      patch((old) => {
        if (replace) return { ...incoming, app: 'floatspace', schemaVersion: 1, exportedAt: new Date().toISOString() };
        const mergeById = <T extends { id: string }>(a: T[], b: T[]) => [...b, ...a.filter((item) => !b.some((x) => x.id === item.id))];
        return { ...old, tasks: mergeById(old.tasks, incoming.tasks), notes: mergeById(old.notes, incoming.notes), bookmarks: mergeById(old.bookmarks, incoming.bookmarks), sessions: mergeById(old.sessions, incoming.sessions) };
      });
      setNoticeFor('Backup imported');
    } catch (error) { setNoticeFor(error instanceof Error ? error.message : 'Could not import backup'); }
    finally { if (fileRef.current) fileRef.current.value = ''; }
  }

  if (!loaded) return <div className="boot-screen"><div className="brand-mark">F</div><p>Opening your local workspace…</p></div>;
  const activeTask = openTasks[0];
  return <div className={`app-shell ${data.preferences.theme === 'light' ? 'theme-light' : ''} ${data.preferences.compactMode ? 'compact-mode' : ''} ${extensionMode ? 'extension-mode' : ''}`}>
    {!extensionMode && <aside className="sidebar">
      <div className="brand-lockup"><div className="brand-mark">F</div><div className="brand-copy"><strong>floatspace</strong><small>FOCUS WITHOUT FRICTION</small></div></div>
      <p className="nav-label">WORKSPACE</p><nav className="primary-nav">{nav.map((item) => <button className={`nav-item ${view === item.id ? 'active' : ''}`} key={item.id} onClick={() => setView(item.id)}><item.icon size={17}/><span>{item.label}</span>{item.id === 'tasks' && <span className="nav-count">{openTasks.length}</span>}</button>)}</nav>
      <div className="sidebar-spacer"/>
      <div className="privacy-card"><div className="privacy-icon"><ShieldCheck size={17}/></div><strong>Private by design</strong><p>Your tasks, notes and focus history stay in this browser profile.</p><button onClick={() => setView('settings')}>Data & privacy ↗</button></div>
      <div className="sidebar-footer"><span className="status-dot"/> Local storage active <span className="version-tag">v0.1.0</span></div>
    </aside>}
    <main className="main-column">
      <header className="topbar"><div><div className="eyebrow">{view === 'overview' ? 'YOUR PERSONAL WORKSPACE' : view.toUpperCase()}</div><h1>{nav.find((n) => n.id === view)?.label ?? 'Settings'}</h1></div><div className="top-actions"><div className="saved-indicator"><span/> Saved locally</div><button className="icon-button" title="Toggle theme" onClick={() => patch((old) => ({ ...old, preferences: { ...old.preferences, theme: old.preferences.theme === 'dark' ? 'light' : 'dark' } }))}>{data.preferences.theme === 'dark' ? <Sun size={17}/> : <Moon size={17}/>}</button><button className="icon-button" title="Open floating window" onClick={() => void openPiP()}><PictureInPicture2 size={17}/></button></div></header>
      <div className="content">
        {notice && <div className="toast" role="status">{notice}</div>}
        {view === 'overview' && <><section className="welcome-row"><div><div className="eyebrow">A LITTLE PROGRESS, EVERY DAY</div><h2>Make room for deep work.</h2><p>Your workday, with fewer distractions.</p></div><button className="primary-button" onClick={() => setView('focus')}><Play size={15} fill="currentColor"/> Start focusing</button></section>
          <div className="stat-grid"><Stat label="Focus today" value={focusMinutes >= 60 ? `${Math.floor(focusMinutes / 60)}h ${Math.round(focusMinutes % 60)}m` : `${Math.round(focusMinutes)}m`} hint="Completed focus sessions" icon={<Clock3/>}/><Stat label="Tasks remaining" value={String(openTasks.length).padStart(2, '0')} hint="One thing at a time" icon={<ListTodo/>}/><Stat label="Sessions today" value={String(todaySessions.length).padStart(2, '0')} hint="Every session counts" icon={<CheckCircle2/>}/></div>
          <div className="dashboard-grid"><section className="panel timer-panel"><PanelHead title="FOCUS TIMER" action="Open full timer" onAction={() => setView('focus')}/><div className="timer-face"><div className="timer-ring"><div><span>{formatCountdown(remaining)}</span><small>{data.timer.status === 'running' ? 'IN SESSION' : 'READY WHEN YOU ARE'}</small></div></div></div><div className="timer-mode">{modeLabel(data.timer.mode)}</div><div className="center-actions"><button className="primary-button" onClick={data.timer.status === 'running' ? pauseTimer : startTimer}>{data.timer.status === 'running' ? <Pause size={15}/> : <Play size={15} fill="currentColor"/>}{data.timer.status === 'running' ? 'Pause' : 'Start focus'}</button><button className="icon-button" onClick={() => resetTimer()} title="Reset timer"><TimerReset size={16}/></button></div></section>
            <section className="panel"><PanelHead title="YOUR NEXT STEPS" action="All tasks" onAction={() => setView('tasks')}/><form className="quick-add" onSubmit={addTask}><input value={taskDraft} onChange={(e) => setTaskDraft(e.target.value)} placeholder="Add a task to focus on…"/><button aria-label="Add task"><Plus size={18}/></button></form><TaskList tasks={openTasks.slice(0, 5)} onToggle={toggleTask} onDelete={(id) => patch((old) => ({ ...old, tasks: old.tasks.filter((t) => t.id !== id) }))}/></section>
          </div>
          <section className="panel links-panel"><PanelHead title="QUICK ACCESS" action="Manage links" onAction={() => setView('links')}/><div className="quick-link-grid">{data.bookmarks.slice(0, 5).map((b) => <a className="quick-link" href={b.url} target="_blank" rel="noreferrer" key={b.id}><span className="link-favicon">{b.title.charAt(0).toUpperCase()}</span><span>{b.title}</span></a>)}{data.bookmarks.length === 0 && <Empty text="Your favourite sites will show up here."/>}</div></section>
        </>}
        {view === 'focus' && <section className="panel focus-view"><div className="eyebrow">PROTECT YOUR ATTENTION</div><h2>One thing at a time.</h2><div className="large-time">{formatCountdown(remaining)}</div><div className="timer-mode">{modeLabel(data.timer.mode)}</div><div className="mode-picker">{(['focus', 'shortBreak', 'longBreak'] as TimerMode[]).map((mode) => <button className={data.timer.mode === mode ? 'selected' : ''} key={mode} onClick={() => resetTimer(mode)}>{mode === 'focus' ? 'Focus' : mode === 'shortBreak' ? 'Short break' : 'Long break'}</button>)}</div><div className="center-actions"><button className="primary-button" onClick={data.timer.status === 'running' ? pauseTimer : startTimer}>{data.timer.status === 'running' ? <Pause size={16}/> : <Play size={16}/>} {data.timer.status === 'running' ? 'Pause' : data.timer.status === 'paused' ? 'Resume' : 'Start session'}</button><button className="secondary-button" onClick={() => resetTimer()}><TimerReset size={16}/> Reset</button><button className="secondary-button" onClick={skipTimer}><SkipForward size={16}/> Skip</button></div><p className="muted centered">{activeTask ? `Current priority: ${activeTask.title}` : 'Add a task to make this session count.'}</p><div className="settings-inline"><label>Focus minutes <input type="number" min="1" max="180" value={data.preferences.focusMinutes} onChange={(e) => patch((old) => ({ ...old, preferences: { ...old.preferences, focusMinutes: Math.max(1, Math.min(180, Number(e.target.value) || 25)) }, timer: old.timer.status === 'idle' && old.timer.mode === 'focus' ? { ...old.timer, remainingMs: Math.max(1, Math.min(180, Number(e.target.value) || 25)) * 60_000 } : old.timer }))}/></label><label>Short break <input type="number" min="1" max="60" value={data.preferences.shortBreakMinutes} onChange={(e) => patch((old) => ({ ...old, preferences: { ...old.preferences, shortBreakMinutes: Math.max(1, Math.min(60, Number(e.target.value) || 5)) } }))}/></label><label>Long break <input type="number" min="1" max="90" value={data.preferences.longBreakMinutes} onChange={(e) => patch((old) => ({ ...old, preferences: { ...old.preferences, longBreakMinutes: Math.max(1, Math.min(90, Number(e.target.value) || 15)) } }))}/></label></div><button className="secondary-button pip-button" onClick={() => void openPiP()}><PictureInPicture2 size={16}/> Open floating window</button></section>}
        {view === 'tasks' && <section className="panel page-panel"><PanelHead title="TASKS" action={`${openTasks.length} remaining`}/><form className="quick-add" onSubmit={addTask}><input autoFocus value={taskDraft} onChange={(e) => setTaskDraft(e.target.value)} placeholder="What needs doing?"/><button aria-label="Add task"><Plus size={18}/></button></form><input className="search-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks…"/><TaskList tasks={filteredTasks} onToggle={toggleTask} onDelete={(id) => patch((old) => ({ ...old, tasks: old.tasks.filter((t) => t.id !== id) }))}/></section>}
        {view === 'notes' && <section className="panel page-panel"><PanelHead title="QUICK NOTES" action="Autosaved locally"/><form onSubmit={addNote} className="note-create"><textarea rows={3} value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Capture an idea before it slips away…"/><button className="primary-button"><Plus size={15}/> Save note</button></form><div className="notes-grid">{data.notes.map((note) => <article className="note-card" key={note.id}><div className="note-card-head"><strong>{note.title}</strong><button className="icon-button" aria-label="Delete note" onClick={() => patch((old) => ({ ...old, notes: old.notes.filter((n) => n.id !== note.id) }))}><Trash2 size={14}/></button></div><textarea value={note.content} onChange={(e) => patch((old) => ({ ...old, notes: old.notes.map((n) => n.id === note.id ? { ...n, content: e.target.value, updatedAt: Date.now() } : n) }))}/><small>Updated {new Date(note.updatedAt).toLocaleString()}</small></article>)}{data.notes.length === 0 && <Empty text="Your first note can be a rough idea, a reminder or a line of copy."/>}</div></section>}
        {view === 'links' && <section className="panel page-panel"><PanelHead title="QUICK LINKS" action="Saved on this device"/><form className="bookmark-form" onSubmit={addBookmark}><input value={bookmarkTitle} onChange={(e) => setBookmarkTitle(e.target.value)} placeholder="Link name"/><input type="url" value={bookmarkUrl} onChange={(e) => setBookmarkUrl(e.target.value)} placeholder="https://example.com" required/><button className="primary-button"><Plus size={15}/> Add link</button></form><div className="bookmark-list">{data.bookmarks.map((b) => <div className="bookmark-row" key={b.id}><div className="link-favicon">{b.title.charAt(0).toUpperCase()}</div><div className="bookmark-info"><strong>{b.title}</strong><small>{b.url}</small></div><a className="icon-button" href={b.url} target="_blank" rel="noreferrer" aria-label="Open link">↗</a><button className="icon-button" onClick={() => patch((old) => ({ ...old, bookmarks: old.bookmarks.filter((x) => x.id !== b.id) }))} aria-label="Delete link"><Trash2 size={15}/></button></div>)}{data.bookmarks.length === 0 && <Empty text="Save the sites you reach for every day."/>}</div></section>}
        {view === 'history' && <section className="panel page-panel"><PanelHead title="FOCUS HISTORY" action={`${data.sessions.length} sessions`}/><div className="history-summary"><strong>{Math.round(data.sessions.filter((s) => s.mode === 'focus').reduce((sum, s) => sum + s.durationSeconds, 0) / 60)} min</strong><span>Total completed focus time</span></div><div className="session-list">{data.sessions.slice(0, 40).map((s) => <div className="session-row" key={s.id}><span className="session-mark"><Check size={15}/></span><span><strong>{s.mode === 'focus' ? 'Focus session' : s.mode === 'shortBreak' ? 'Short break' : 'Long break'}</strong><small>{new Date(s.completedAt).toLocaleString()}</small></span><b>{Math.round(s.durationSeconds / 60)} min</b></div>)}{data.sessions.length === 0 && <Empty text="Completed sessions will be recorded here."/>}</div></section>}
        {view === 'settings' && <section className="panel page-panel"><PanelHead title="SETTINGS & PRIVACY" action="Local-first"/><div className="setting-row"><div><strong>Compact workspace</strong><p>Reduce spacing across the dashboard.</p></div><input type="checkbox" checked={data.preferences.compactMode} onChange={(e) => patch((old) => ({ ...old, preferences: { ...old.preferences, compactMode: e.target.checked } }))}/></div><div className="setting-row"><div><strong>Session completion sound</strong><p>Sound cues are best-effort and may be blocked by browser settings.</p></div><input type="checkbox" checked={data.preferences.soundEnabled} onChange={(e) => patch((old) => ({ ...old, preferences: { ...old.preferences, soundEnabled: e.target.checked } }))}/></div><div className="setting-row"><div><strong>Long break after</strong><p>Number of focus sessions before a long break.</p></div><select value={data.preferences.sessionsBeforeLongBreak} onChange={(e) => patch((old) => ({ ...old, preferences: { ...old.preferences, sessionsBeforeLongBreak: Number(e.target.value) } }))}><option value={2}>2 sessions</option><option value={3}>3 sessions</option><option value={4}>4 sessions</option><option value={5}>5 sessions</option><option value={6}>6 sessions</option><option value={8}>8 sessions</option></select></div><div className="privacy-detail"><ShieldCheck size={20}/><div><strong>Your data is stored locally</strong><p>No login, remote database, tracking SDK or automatic cloud sync. Website and extension browser storage are separate; use backup files to transfer data.</p></div></div><div className="backup-actions"><button className="primary-button" onClick={exportData}><Download size={15}/> Export backup</button><button className="secondary-button" onClick={() => fileRef.current?.click()}><Upload size={15}/> Import backup</button><input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => void importData(e.target.files?.[0])}/><button className="danger-button" onClick={() => { if (window.confirm('Delete all Floatspace data from this browser? Export a backup first if needed.')) { void db.clear().then(() => setData(DEFAULT_DATA)); setNoticeFor('Local workspace cleared'); } }}><Trash2 size={15}/> Clear data</button></div></section>}
      </div>
      <footer className="app-footer"><span><ShieldCheck size={13}/> Local-first. No cloud sync.</span><span>Made for focused work <span className="footer-star">✳</span></span></footer>
    </main>
  </div>;
}

function Stat({ label, value, hint, icon }: { label: string; value: string; hint: string; icon: React.ReactNode }) { return <article className="stat-card"><div className="stat-heading">{label}<span>{icon}</span></div><strong>{value}</strong><small>{hint}</small></article>; }
function PanelHead({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) { return <div className="panel-head"><span>{title}</span>{action && <button disabled={!onAction} onClick={onAction}>{action}{onAction && ' ↗'}</button>}</div>; }
function TaskList({ tasks, onToggle, onDelete }: { tasks: Task[]; onToggle: (task: Task) => void; onDelete: (id: string) => void }) { return <div className="task-list">{tasks.map((task) => <div className={`task-row ${task.completed ? 'task-completed' : ''}`} key={task.id}><button className="task-check" aria-label={task.completed ? 'Mark incomplete' : 'Complete task'} onClick={() => onToggle(task)}>{task.completed && <Check size={13}/>}</button><span className="task-title">{task.title}</span><span className={`priority priority-${task.priority}`}>{task.priority}</span><button className="icon-button row-delete" aria-label="Delete task" onClick={() => onDelete(task.id)}><X size={14}/></button></div>)}{tasks.length === 0 && <Empty text="Nothing on your list. Add a small next step."/>}</div>; }
function Empty({ text }: { text: string }) { return <div className="empty-state"><CheckCircle2 size={23}/><p>{text}</p></div>; }
function modeLabel(mode: TimerMode) { return mode === 'focus' ? 'Focus session' : mode === 'shortBreak' ? 'Short break' : 'Long break'; }
