import type * as React from 'react';
import { createPortal } from 'react-dom';
import FloatingWorkspace from './FloatingWorkspace';
import { Activity, AlarmClock, Bell, BellOff, Bookmark, Check, CheckCircle2, Clock3, Download, FileText, LayoutDashboard, ListTodo, Moon, Pause, Pin, PinOff, PictureInPicture2, Play, Plus, ShieldCheck, SkipForward, Sun, TimerReset, Trash2, Upload, Volume2, VolumeX, X } from 'lucide-react';
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
  const [storageReady, setStorageReady] = useState(false);
  const [view, setView] = useState<View>('overview');
  const [taskDraft, setTaskDraft] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [bookmarkTitle, setBookmarkTitle] = useState('');
  const [bookmarkUrl, setBookmarkUrl] = useState('');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [now, setNow] = useState(Date.now());
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const endedRef = useRef<number | null>(null);
  const lastSessionCountRef = useRef<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { db.load().then((saved) => { setData(saved); setStorageReady(true); setLoaded(true); }).catch(() => { setLoaded(true); setNotice('Local storage could not be opened or the saved data is invalid. Import a backup or clear site data to recover.'); }); }, []);
  useEffect(() => { if (loaded && storageReady) void db.save(data).catch(() => setNotice('Could not save locally. Export a backup and check browser storage.')); }, [data, loaded, storageReady]);
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

  useEffect(() => {
    if (!loaded || !storageReady) return;
    const currentCount = data.sessions.length;
    if (lastSessionCountRef.current === null) { lastSessionCountRef.current = currentCount; return; }
    if (currentCount > lastSessionCountRef.current) {
      const latest = data.sessions[0];
      if (data.preferences.soundEnabled) {
        try {
          const AudioContextClass = window.AudioContext;
          if (AudioContextClass) {
            const context = new AudioContextClass();
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(latest?.mode === 'focus' ? 880 : 660, context.currentTime);
            gain.gain.setValueAtTime(0.07, context.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.22);
            oscillator.connect(gain); gain.connect(context.destination);
            oscillator.start(); oscillator.stop(context.currentTime + 0.22);
            window.setTimeout(() => { void context.close().catch(() => {}); }, 300);
          }
        } catch { /* Sound is best-effort; timer state is already saved locally. */ }
      }
      const message = latest?.mode === 'focus' ? 'Focus session complete — take a short break.' : 'Break complete — ready for another focus session?';
      if (data.preferences.breakReminderEnabled) setNoticeFor(message);
      if (data.preferences.notificationsEnabled && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try { new Notification('Floatspace', { body: message, icon: '/favicon.ico' }); } catch { /* User/OS notification settings may block alerts. */ }
      }
    }
    lastSessionCountRef.current = currentCount;
  }, [data.sessions, data.preferences.soundEnabled, data.preferences.breakReminderEnabled, data.preferences.notificationsEnabled, loaded, storageReady]);

  const remaining = remainingMilliseconds(data.timer, now);
  const incompleteTasks = data.tasks.filter((task) => !task.completed);
  const selectedCurrentTask = incompleteTasks.find((task) => task.id === data.currentTaskId);
  const openTasks = selectedCurrentTask ? [selectedCurrentTask, ...incompleteTasks.filter((task) => task.id !== selectedCurrentTask.id)] : incompleteTasks;
  const filteredTasks = useMemo(() => data.tasks.filter((task) => task.title.toLowerCase().includes(search.toLowerCase())), [data.tasks, search]);
  const todaySessions = data.sessions.filter((s) => new Date(s.completedAt).toDateString() === new Date().toDateString());
  const focusMinutes = todaySessions.filter((s) => s.mode === 'focus').reduce((sum, s) => sum + s.durationSeconds / 60, 0);
  const patch = (fn: (old: ExportPayload) => ExportPayload) => setData((old) => fn(old));
  const setNoticeFor = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(''), 3000); };

  function addTaskByTitle(rawTitle: string) {
    const title = rawTitle.trim(); if (!title) return;
    const task: Task = { id: uid(), title, priority: 'medium', completed: false, createdAt: Date.now() };
    patch((old) => {
      const activeCurrent = old.tasks.some((item) => item.id === old.currentTaskId && !item.completed);
      return { ...old, tasks: [task, ...old.tasks], currentTaskId: activeCurrent ? old.currentTaskId : task.id };
    });
    setNoticeFor('Task saved locally');
  }
  function addTask(event?: React.FormEvent) {
    event?.preventDefault();
    if (!taskDraft.trim()) return;
    addTaskByTitle(taskDraft);
    setTaskDraft('');
  }
  function selectCurrentTask(id: string) {
    patch((old) => ({ ...old, currentTaskId: id }));
  }
  function toggleTask(task: Task) {
    patch((old) => {
      const completed = !task.completed;
      const tasks = old.tasks.map((item) => item.id === task.id ? { ...item, completed, completedAt: completed ? Date.now() : undefined } : item);
      const firstIncomplete = tasks.find((item) => !item.completed);
      const wasCurrent = old.currentTaskId === task.id || (!old.currentTaskId && old.tasks.find((item) => !item.completed)?.id === task.id);
      const currentTaskId = completed && wasCurrent ? firstIncomplete?.id ?? null : (!old.currentTaskId || !tasks.some((item) => item.id === old.currentTaskId && !item.completed)) ? firstIncomplete?.id ?? null : old.currentTaskId;
      return { ...old, tasks, currentTaskId };
    });
  }
  function addNoteContent(rawContent: string) {
    const content = rawContent.trim(); if (!content) return;
    const note: Note = { id: uid(), title: content.split('\\n')[0].slice(0, 52) || 'Quick note', content, pinned: false, updatedAt: Date.now() };
    patch((old) => ({ ...old, notes: [note, ...old.notes] }));
    setNoticeFor('Note saved locally');
  }
  function addNote(event?: React.FormEvent) {
    event?.preventDefault();
    if (!noteDraft.trim()) return;
    addNoteContent(noteDraft);
    setNoteDraft('');
  }
  function toggleNotePin(id: string) {
    patch((old) => {
      const selected = old.notes.find((note) => note.id === id);
      const shouldPin = !selected?.pinned;
      return { ...old, notes: old.notes.map((note) => ({ ...note, pinned: shouldPin && note.id === id })) };
    });
  }
  function toggleBookmarkPin(id: string) {
    patch((old) => {
      const current = old.bookmarks.find((bookmark) => bookmark.id === id);
      return { ...old, bookmarks: old.bookmarks.map((bookmark) => bookmark.id === id ? { ...bookmark, pinned: !current?.pinned } : bookmark) };
    });
  }
  async function enableNotifications() {
    if (typeof Notification === 'undefined') { setNoticeFor('System notifications are not supported here. Sound and in-app reminders are still available.'); return; }
    try {
      const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
      if (permission === 'granted') {
        patch((old) => ({ ...old, preferences: { ...old.preferences, notificationsEnabled: true } }));
        setNoticeFor('Session notifications enabled');
      } else {
        patch((old) => ({ ...old, preferences: { ...old.preferences, notificationsEnabled: false } }));
        setNoticeFor('Notifications were not enabled in browser settings');
      }
    } catch { setNoticeFor('Could not enable notifications in this browser'); }
  }
    function addBookmark(event?: React.FormEvent) {
    event?.preventDefault(); const title = bookmarkTitle.trim(); let url: URL;
    try { url = new URL(bookmarkUrl.trim()); } catch { setNoticeFor('Enter a valid website URL'); return; }
    if (!['http:', 'https:'].includes(url.protocol)) { setNoticeFor('Only HTTP and HTTPS links are allowed'); return; }
    const record: BookmarkRecord = { id: uid(), title: title || url.hostname, url: url.href, folder: 'General', createdAt: Date.now(), pinned: false };
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
    if (pipWindow && !pipWindow.closed) { pipWindow.focus(); return; }
    const api = (window as Window & { documentPictureInPicture?: { requestWindow: (options?: { width?: number; height?: number; preferInitialWindowPlacement?: boolean }) => Promise<Window> } }).documentPictureInPicture;
    if (!api) { setNoticeFor('Floating PiP is not supported in this browser. Use the Chrome side panel instead.'); return; }
    try {
      const win = await api.requestWindow({ width: 390, height: 590 });
      win.document.title = 'Floatspace — Focus Workspace';
      win.document.documentElement.className = 'floatspace-pip-document';
      win.document.body.className = 'floatspace-pip-body';
      // A PiP window has its own document. Mirror local stylesheets, then render
      // the same React component into it so all tools share the page's state.
      document.querySelectorAll('link[rel="stylesheet"]').forEach((node) => win.document.head.appendChild(node.cloneNode(true)));
      document.querySelectorAll('style').forEach((node) => win.document.head.appendChild(node.cloneNode(true)));
      win.addEventListener('pagehide', () => setPipWindow((current) => current === win ? null : current), { once: true });
      setPipWindow(win);
    } catch {
      setNoticeFor('Could not open floating window. Try again from the page using a click.');
    }
  }

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
      setStorageReady(true);
      lastSessionCountRef.current = null;
      patch((old) => {
        if (replace) return { ...DEFAULT_DATA, ...incoming, currentTaskId: incoming.currentTaskId ?? null, preferences: { ...DEFAULT_DATA.preferences, ...incoming.preferences }, app: 'floatspace', schemaVersion: 1, exportedAt: new Date().toISOString() };
        const mergeById = <T extends { id: string }>(a: T[], b: T[]) => [...b, ...a.filter((item) => !b.some((x) => x.id === item.id))];
        return { ...old, tasks: mergeById(old.tasks, incoming.tasks), notes: mergeById(old.notes, incoming.notes), bookmarks: mergeById(old.bookmarks, incoming.bookmarks), sessions: mergeById(old.sessions, incoming.sessions), preferences: { ...old.preferences, ...incoming.preferences }, currentTaskId: incoming.currentTaskId ?? old.currentTaskId ?? null };
      });
      setNoticeFor('Backup imported');
    } catch (error) { setNoticeFor(error instanceof Error ? error.message : 'Could not import backup'); }
    finally { if (fileRef.current) fileRef.current.value = ''; }
  }

  if (!loaded) return <div className="boot-screen"><div className="brand-mark">F</div><p>Opening your local workspace…</p></div>;
  const activeTask = openTasks[0];
  return <><div className={`app-shell ${data.preferences.theme === 'light' ? 'theme-light' : ''} ${data.preferences.compactMode ? 'compact-mode' : ''} ${extensionMode ? 'extension-mode' : ''}`}>
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
          <section className="panel links-panel"><PanelHead title="QUICK ACCESS" action="Manage links" onAction={() => setView('links')}/><div className="quick-link-grid">{[...data.bookmarks.filter((b) => b.pinned), ...data.bookmarks.filter((b) => !b.pinned)].slice(0, 5).map((b) => <a className="quick-link" href={b.url} target="_blank" rel="noreferrer" key={b.id}><span className="link-favicon">{b.title.charAt(0).toUpperCase()}</span><span>{b.title}</span></a>)}{data.bookmarks.length === 0 && <Empty text="Your favourite sites will show up here."/>}</div></section>
        </>}
        {view === 'focus' && <section className="panel focus-view"><div className="eyebrow">PROTECT YOUR ATTENTION</div><h2>One thing at a time.</h2><div className="large-time">{formatCountdown(remaining)}</div><div className="timer-mode">{modeLabel(data.timer.mode)}</div><div className="mode-picker">{(['focus', 'shortBreak', 'longBreak'] as TimerMode[]).map((mode) => <button className={data.timer.mode === mode ? 'selected' : ''} key={mode} onClick={() => resetTimer(mode)}>{mode === 'focus' ? 'Focus' : mode === 'shortBreak' ? 'Short break' : 'Long break'}</button>)}</div><div className="center-actions"><button className="primary-button" onClick={data.timer.status === 'running' ? pauseTimer : startTimer}>{data.timer.status === 'running' ? <Pause size={16}/> : <Play size={16}/>} {data.timer.status === 'running' ? 'Pause' : data.timer.status === 'paused' ? 'Resume' : 'Start session'}</button><button className="secondary-button" onClick={() => resetTimer()}><TimerReset size={16}/> Reset</button><button className="secondary-button" onClick={skipTimer}><SkipForward size={16}/> Skip</button></div><p className="muted centered">{activeTask ? `Current priority: ${activeTask.title}` : 'Add a task to make this session count.'}</p><div className="settings-inline"><label>Focus minutes <input type="number" min="1" max="180" value={data.preferences.focusMinutes} onChange={(e) => patch((old) => ({ ...old, preferences: { ...old.preferences, focusMinutes: Math.max(1, Math.min(180, Number(e.target.value) || 25)) }, timer: old.timer.status === 'idle' && old.timer.mode === 'focus' ? { ...old.timer, remainingMs: Math.max(1, Math.min(180, Number(e.target.value) || 25)) * 60_000 } : old.timer }))}/></label><label>Short break <input type="number" min="1" max="60" value={data.preferences.shortBreakMinutes} onChange={(e) => patch((old) => ({ ...old, preferences: { ...old.preferences, shortBreakMinutes: Math.max(1, Math.min(60, Number(e.target.value) || 5)) } }))}/></label><label>Long break <input type="number" min="1" max="90" value={data.preferences.longBreakMinutes} onChange={(e) => patch((old) => ({ ...old, preferences: { ...old.preferences, longBreakMinutes: Math.max(1, Math.min(90, Number(e.target.value) || 15)) } }))}/></label></div><button className="secondary-button pip-button" onClick={() => void openPiP()}><PictureInPicture2 size={16}/> Open floating window</button></section>}
        {view === 'tasks' && <section className="panel page-panel"><PanelHead title="TASKS" action={`${openTasks.length} remaining`}/><form className="quick-add" onSubmit={addTask}><input autoFocus value={taskDraft} onChange={(e) => setTaskDraft(e.target.value)} placeholder="What needs doing?"/><button aria-label="Add task"><Plus size={18}/></button></form><input className="search-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks…"/><TaskList tasks={filteredTasks} onToggle={toggleTask} onDelete={(id) => patch((old) => ({ ...old, tasks: old.tasks.filter((t) => t.id !== id) }))}/></section>}
        {view === 'notes' && <section className="panel page-panel"><PanelHead title="QUICK NOTES" action="Autosaved locally"/><form onSubmit={addNote} className="note-create"><textarea rows={3} value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Capture an idea before it slips away…"/><button className="primary-button"><Plus size={15}/> Save note</button></form><div className="notes-grid">{data.notes.map((note) => <article className="note-card" key={note.id}><div className="note-card-head"><strong>{note.pinned && <Pin size={12}/>} {note.title}</strong><div className="note-card-actions"><button className="icon-button" title={note.pinned ? 'Unpin note' : 'Pin note'} aria-label={note.pinned ? 'Unpin note' : 'Pin note'} onClick={() => toggleNotePin(note.id)}>{note.pinned ? <Pin size={14} fill="currentColor"/> : <PinOff size={14}/>}</button><button className="icon-button" aria-label="Delete note" onClick={() => patch((old) => ({ ...old, notes: old.notes.filter((n) => n.id !== note.id) }))}><Trash2 size={14}/></button></div></div><textarea value={note.content} onChange={(e) => patch((old) => ({ ...old, notes: old.notes.map((n) => n.id === note.id ? { ...n, content: e.target.value, updatedAt: Date.now() } : n) }))}/><small>Updated {new Date(note.updatedAt).toLocaleString()}</small></article>)}{data.notes.length === 0 && <Empty text="Your first note can be a rough idea, a reminder or a line of copy."/>}</div></section>}
        {view === 'links' && <section className="panel page-panel"><PanelHead title="QUICK LINKS" action="Saved on this device"/><form className="bookmark-form" onSubmit={addBookmark}><input value={bookmarkTitle} onChange={(e) => setBookmarkTitle(e.target.value)} placeholder="Link name"/><input type="url" value={bookmarkUrl} onChange={(e) => setBookmarkUrl(e.target.value)} placeholder="https://example.com" required/><button className="primary-button"><Plus size={15}/> Add link</button></form><div className="bookmark-list">{data.bookmarks.map((b) => <div className="bookmark-row" key={b.id}><div className="link-favicon">{b.title.charAt(0).toUpperCase()}</div><div className="bookmark-info"><strong>{b.title}</strong><small>{b.url}</small></div><button className="icon-button" title={b.pinned ? 'Unpin link' : 'Pin link'} aria-label={b.pinned ? 'Unpin link' : 'Pin link'} onClick={() => toggleBookmarkPin(b.id)}>{b.pinned ? <Pin size={14} fill="currentColor"/> : <PinOff size={14}/>}</button><a className="icon-button" href={b.url} target="_blank" rel="noreferrer" aria-label="Open link">↗</a><button className="icon-button" onClick={() => patch((old) => ({ ...old, bookmarks: old.bookmarks.filter((x) => x.id !== b.id) }))} aria-label="Delete link"><Trash2 size={15}/></button></div>)}{data.bookmarks.length === 0 && <Empty text="Save the sites you reach for every day."/>}</div></section>}
        {view === 'history' && <section className="panel page-panel"><PanelHead title="FOCUS HISTORY" action={`${data.sessions.length} sessions`}/><div className="history-summary"><strong>{Math.round(data.sessions.filter((s) => s.mode === 'focus').reduce((sum, s) => sum + s.durationSeconds, 0) / 60)} min</strong><span>Total completed focus time</span></div><div className="session-list">{data.sessions.slice(0, 40).map((s) => <div className="session-row" key={s.id}><span className="session-mark"><Check size={15}/></span><span><strong>{s.mode === 'focus' ? 'Focus session' : s.mode === 'shortBreak' ? 'Short break' : 'Long break'}</strong><small>{new Date(s.completedAt).toLocaleString()}</small></span><b>{Math.round(s.durationSeconds / 60)} min</b></div>)}{data.sessions.length === 0 && <Empty text="Completed sessions will be recorded here."/>}</div></section>}
        {view === 'settings' && <section className="panel page-panel"><PanelHead title="SETTINGS & PRIVACY" action="Local-first"/><div className="setting-row"><div><strong>Compact workspace</strong><p>Reduce spacing across the dashboard.</p></div><input type="checkbox" checked={data.preferences.compactMode} onChange={(e) => patch((old) => ({ ...old, preferences: { ...old.preferences, compactMode: e.target.checked } }))}/></div><div className="setting-row"><div><strong>Session completion sound</strong><p>Play a short local sound when a focus or break session completes.</p></div><button className="icon-button" title={data.preferences.soundEnabled ? "Turn sound off" : "Turn sound on"} aria-label={data.preferences.soundEnabled ? "Turn sound off" : "Turn sound on"} onClick={() => patch((old) => ({ ...old, preferences: { ...old.preferences, soundEnabled: !old.preferences.soundEnabled } }))}>{data.preferences.soundEnabled ? <Volume2 size={16}/> : <VolumeX size={16}/>}</button></div><div className="setting-row"><div><strong>Break reminders</strong><p>Show an in-app reminder at the end of each focus or break session.</p></div><button className="icon-button" title={data.preferences.breakReminderEnabled ? "Turn break reminders off" : "Turn break reminders on"} aria-label={data.preferences.breakReminderEnabled ? "Turn break reminders off" : "Turn break reminders on"} onClick={() => patch((old) => ({ ...old, preferences: { ...old.preferences, breakReminderEnabled: !old.preferences.breakReminderEnabled } }))}>{data.preferences.breakReminderEnabled ? <AlarmClock size={16}/> : <BellOff size={16}/>}</button></div><div className="setting-row"><div><strong>System notifications</strong><p>Optional browser notifications when sessions finish. Browser permission is required.</p></div><button className="secondary-button" onClick={() => data.preferences.notificationsEnabled ? patch((old) => ({ ...old, preferences: { ...old.preferences, notificationsEnabled: false } })) : void enableNotifications()}>{data.preferences.notificationsEnabled ? <Bell size={14}/> : <BellOff size={14}/>} {data.preferences.notificationsEnabled ? "Disable" : "Enable"}</button></div><div className="setting-row"><div><strong>Long break after</strong><p>Number of focus sessions before a long break.</p></div><select value={data.preferences.sessionsBeforeLongBreak} onChange={(e) => patch((old) => ({ ...old, preferences: { ...old.preferences, sessionsBeforeLongBreak: Number(e.target.value) } }))}><option value={2}>2 sessions</option><option value={3}>3 sessions</option><option value={4}>4 sessions</option><option value={5}>5 sessions</option><option value={6}>6 sessions</option><option value={8}>8 sessions</option></select></div><div className="privacy-detail"><ShieldCheck size={20}/><div><strong>Your data is stored locally</strong><p>No login, remote database, tracking SDK or automatic cloud sync. Website and extension browser storage are separate; use backup files to transfer data.</p></div></div><div className="backup-actions"><button className="primary-button" onClick={exportData}><Download size={15}/> Export backup</button><button className="secondary-button" onClick={() => fileRef.current?.click()}><Upload size={15}/> Import backup</button><input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => void importData(e.target.files?.[0])}/><button className="danger-button" onClick={() => { if (window.confirm('Delete all Floatspace data from this browser? Export a backup first if needed.')) { lastSessionCountRef.current = null; void db.clear().then(() => { setData(DEFAULT_DATA); setStorageReady(true); }); setNoticeFor('Local workspace cleared'); } }}><Trash2 size={15}/> Clear data</button></div></section>}
      </div>
      <footer className="app-footer"><span><ShieldCheck size={13}/> Local-first. No cloud sync.</span><span>Made for focused work <span className="footer-star">✳</span></span></footer>
    </main>
  </div>{pipWindow && !pipWindow.closed ? createPortal(<FloatingWorkspace
    data={data}
    remainingMs={remaining}
    onToggleTimer={() => data.timer.status === 'running' ? pauseTimer() : startTimer()}
    onResetTimer={() => resetTimer()}
    onSkipTimer={skipTimer}
    onToggleTask={toggleTask}
    onDeleteTask={(id) => patch((old) => ({ ...old, tasks: old.tasks.filter((task) => task.id !== id) }))}
    onSelectTask={selectCurrentTask}
    onAddTask={addTaskByTitle}
    onAddNote={addNoteContent}
    onToggleNotePin={toggleNotePin}
    onToggleBookmarkPin={toggleBookmarkPin}
    onClose={() => { pipWindow.close(); setPipWindow(null); }}
  />, pipWindow.document.body) : null}</>;
}

function Stat({ label, value, hint, icon }: { label: string; value: string; hint: string; icon: React.ReactNode }) { return <article className="stat-card"><div className="stat-heading">{label}<span>{icon}</span></div><strong>{value}</strong><small>{hint}</small></article>; }
function PanelHead({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) { return <div className="panel-head"><span>{title}</span>{action && <button disabled={!onAction} onClick={onAction}>{action}{onAction && ' ↗'}</button>}</div>; }
function TaskList({ tasks, onToggle, onDelete }: { tasks: Task[]; onToggle: (task: Task) => void; onDelete: (id: string) => void }) { return <div className="task-list">{tasks.map((task) => <div className={`task-row ${task.completed ? 'task-completed' : ''}`} key={task.id}><button className="task-check" aria-label={task.completed ? 'Mark incomplete' : 'Complete task'} onClick={() => onToggle(task)}>{task.completed && <Check size={13}/>}</button><span className="task-title">{task.title}</span><span className={`priority priority-${task.priority}`}>{task.priority}</span><button className="icon-button row-delete" aria-label="Delete task" onClick={() => onDelete(task.id)}><X size={14}/></button></div>)}{tasks.length === 0 && <Empty text="Nothing on your list. Add a small next step."/>}</div>; }
function Empty({ text }: { text: string }) { return <div className="empty-state"><CheckCircle2 size={23}/><p>{text}</p></div>; }
function modeLabel(mode: TimerMode) { return mode === 'focus' ? 'Focus session' : mode === 'shortBreak' ? 'Short break' : 'Long break'; }
