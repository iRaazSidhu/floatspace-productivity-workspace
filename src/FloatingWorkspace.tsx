import type * as React from 'react';
import { useState } from 'react';
import { AlarmClock, BarChart3, Check, CheckCircle2, ChevronRight, Clock3, FileText, Link2, ListTodo, MoreHorizontal, Pause, Pin, PinOff, Play, Plus, RotateCcw, SkipForward, StickyNote, Target, Volume2, X } from 'lucide-react';
import './floating-workspace.css';
import { formatCountdown } from './timer-utils.js';
import type { BookmarkRecord, ExportPayload, Note, Task } from './db';

type Tool = 'none' | 'tasks' | 'notes' | 'links' | 'stats' | 'more';
type Props = {
  data: ExportPayload;
  remainingMs: number;
  onToggleTimer: () => void;
  onResetTimer: () => void;
  onSkipTimer: () => void;
  onToggleTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onSelectTask: (id: string) => void;
  onAddTask: (title: string) => void;
  onAddNote: (content: string) => void;
  onToggleNotePin: (id: string) => void;
  onToggleBookmarkPin: (id: string) => void;
  onClose: () => void;
};

const labelMode = (mode: ExportPayload['timer']['mode']) => mode === 'focus' ? 'FOCUS' : mode === 'shortBreak' ? 'SHORT BREAK' : 'LONG BREAK';

export default function FloatingWorkspace(props: Props) {
  const { data, remainingMs } = props;
  const [tool, setTool] = useState<Tool>('none');
  const [capture, setCapture] = useState<'task' | 'note' | null>(null);
  const [draft, setDraft] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const openTasks = data.tasks.filter((task) => !task.completed);
  const currentTask = openTasks.find((task) => task.id === data.currentTaskId) ?? openTasks[0];
  const upcoming = openTasks.filter((task) => task.id !== currentTask?.id).slice(0, 2);
  const pinnedNote = data.notes.find((note) => note.pinned);
  const pinnedLinks = data.bookmarks.filter((bookmark) => bookmark.pinned).slice(0, 3);
  const today = new Date().toDateString();
  const todaySessions = data.sessions.filter((session) => new Date(session.completedAt).toDateString() === today);
  const todayFocus = todaySessions.filter((session) => session.mode === 'focus');
  const focusMinutes = Math.round(todayFocus.reduce((sum, session) => sum + session.durationSeconds, 0) / 60);
  const ringDuration = (data.timer.mode === 'focus' ? data.preferences.focusMinutes : data.timer.mode === 'shortBreak' ? data.preferences.shortBreakMinutes : data.preferences.longBreakMinutes) * 60_000;
  const progress = ringDuration > 0 ? Math.min(1, Math.max(0, remainingMs / ringDuration)) : 0;

  function submitCapture(event: React.FormEvent) {
    event.preventDefault();
    const value = draft.trim();
    if (!value) return;
    if (capture === 'task') props.onAddTask(value);
    setDraft('');
    setCapture(null);
  }
  function saveQuickNote(event: React.FormEvent) {
    event.preventDefault();
    if (!noteDraft.trim()) return;
    props.onAddNote(noteDraft.trim());
    setNoteDraft('');
    setTool('notes');
  }
  function toggleTool(next: Tool) {
    setCapture(null);
    setTool((current) => current === next ? 'none' : next);
  }

  return <div className={`floating-workspace ${data.preferences.theme === 'light' ? 'floating-light' : ''}`}>
    <header className="float-head">
      <div className="float-brand"><span className="float-brand-mark">F</span><span><strong>floatspace</strong><small>FOCUS WORKSPACE</small></span></div>
      <div className="float-head-actions">
        <span className="local-pill"><i/>LOCAL</span>
        <button className="float-head-icon" title="Close floating workspace" aria-label="Close floating workspace" onClick={props.onClose}><X size={15}/></button>
      </div>
    </header>

    <section className="float-timer-card" aria-label="Focus timer">
      <div className="float-timer-copy">
        <div className="float-eyebrow">{labelMode(data.timer.mode)} <span className={data.timer.status === 'running' ? 'running-dot' : ''}/></div>
        <div className="float-time" aria-live="off">{formatCountdown(remainingMs)}</div>
        <div className="float-timer-foot">{data.timer.status === 'running' ? 'Session in progress' : data.timer.status === 'paused' ? 'Paused · pick up anytime' : 'Ready when you are'}</div>
      </div>
      <div className="float-timer-controls">
        <div className="float-progress-ring" style={{ background: `conic-gradient(var(--float-accent) ${progress * 360}deg, var(--float-track) 0deg)` }}><div><Clock3 size={18}/></div></div>
        <div className="float-control-row">
          <button className="float-primary-icon" title={data.timer.status === 'running' ? 'Pause timer' : 'Start or resume timer'} aria-label={data.timer.status === 'running' ? 'Pause timer' : 'Start or resume timer'} onClick={props.onToggleTimer}>{data.timer.status === 'running' ? <Pause size={15} fill="currentColor"/> : <Play size={15} fill="currentColor"/>}</button>
          <button className="float-secondary-icon" title="Reset timer" aria-label="Reset timer" onClick={props.onResetTimer}><RotateCcw size={14}/></button>
          <button className="float-secondary-icon" title="Skip to next session" aria-label="Skip to next session" onClick={props.onSkipTimer}><SkipForward size={14}/></button>
        </div>
      </div>
    </section>

    <section className="float-tasks-section">
      <div className="float-section-heading"><div><Target size={14}/><span>FOCUS TASK</span></div><button title="Manage tasks" onClick={() => toggleTool('tasks')}>{openTasks.length} left <ChevronRight size={13}/></button></div>
      {currentTask ? <div className="float-current-task">
        <button className={`float-check ${currentTask.completed ? 'checked' : ''}`} onClick={() => props.onToggleTask(currentTask)} aria-label="Complete current task">{currentTask.completed && <Check size={13}/>}</button>
        <button className="float-current-title" onClick={() => props.onSelectTask(currentTask.id)} title="Set as current focus task"><strong>{currentTask.title}</strong><small><span className={`float-priority priority-${currentTask.priority}`}>{currentTask.priority}</span><span>Current task</span></small></button>
        <button className="float-select-task" onClick={() => toggleTool('tasks')} title="View all tasks"><MoreHorizontal size={17}/></button>
      </div> : <div className="float-empty-task"><CheckCircle2 size={16}/><span>All clear. Add a task for your next focus session.</span></div>}
      {upcoming.length > 0 && <div className="float-next-tasks">{upcoming.map((task) => <div className="float-next-task" key={task.id}><button className="float-check" onClick={() => props.onToggleTask(task)} aria-label={`Complete ${task.title}`}/><button className="float-next-title" onClick={() => props.onSelectTask(task.id)} title="Set as current task">{task.title}</button><button className="float-promote" onClick={() => props.onSelectTask(task.id)} title="Make current task"><ChevronRight size={13}/></button></div>)}</div>}
      {openTasks.length === 0 && <button className="float-inline-add" onClick={() => { setCapture('task'); setTool('none'); }}><Plus size={14}/> Add a task</button>}
    </section>

    <section className="float-note-section">
      <div className="float-section-heading"><div><StickyNote size={14}/><span>PINNED NOTE</span></div><button title="Open notes" onClick={() => toggleTool('notes')}>Edit note <ChevronRight size={13}/></button></div>
      {pinnedNote ? <button className="float-pinned-note" onClick={() => toggleTool('notes')} title="Open pinned note">
        <span className="float-pin-mark"><Pin size={12} fill="currentColor"/></span><span className="float-note-text"><strong>{pinnedNote.title}</strong><span>{pinnedNote.content}</span></span><ChevronRight size={14}/>
      </button> : <button className="float-no-note" onClick={() => toggleTool('notes')}><Plus size={14}/> Pin a note to keep it in view</button>}
    </section>

    {pinnedLinks.length > 0 && <section className="float-links-row"><div className="float-section-heading"><div><Link2 size={13}/><span>PINNED LINKS</span></div><button onClick={() => toggleTool('links')}>Manage <ChevronRight size={13}/></button></div><div className="float-link-chips">{pinnedLinks.map((link) => <a href={link.url} target="_blank" rel="noreferrer" title={link.url} key={link.id}><span>{link.title.slice(0, 1).toUpperCase()}</span>{link.title}</a>)}</div></section>}

    {capture === 'task' && <form className="float-capture" onSubmit={submitCapture}><input autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Add a task…" maxLength={240}/><button className="float-primary-icon" type="submit" aria-label="Save task"><Check size={15}/></button><button className="float-secondary-icon" type="button" aria-label="Cancel" onClick={() => setCapture(null)}><X size={14}/></button></form>}

    {tool !== 'none' && <section className="float-tool-drawer">
      <div className="float-drawer-head"><strong>{tool === 'tasks' ? 'All tasks' : tool === 'notes' ? 'Quick notes' : tool === 'links' ? 'Quick links' : tool === 'stats' ? 'Today at a glance' : 'More tools'}</strong><button aria-label="Close tools panel" onClick={() => setTool('none')}><X size={14}/></button></div>
      {tool === 'tasks' && <div className="float-drawer-list">
        <form className="float-capture float-drawer-capture" onSubmit={(event) => { event.preventDefault(); if (draft.trim()) props.onAddTask(draft.trim()); setDraft(''); }}><input autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Quick add task…" maxLength={240}/><button className="float-primary-icon" type="submit" aria-label="Add task"><Plus size={15}/></button></form>
        {openTasks.map((task) => <div className="float-drawer-row" key={task.id}><button className="float-check" onClick={() => props.onToggleTask(task)} aria-label={`Complete ${task.title}`}/><button className="float-drawer-item" onClick={() => props.onSelectTask(task.id)}>{task.title}<small>{task.id === currentTask?.id ? 'Current focus task' : task.priority + ' priority'}</small></button></div>)}
        {openTasks.length === 0 && <p className="float-helper">No pending tasks. Take a breath.</p>}
      </div>}
      {tool === 'notes' && <div className="float-drawer-list">
        <form className="float-quick-note-form" onSubmit={saveQuickNote}><textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} rows={2} maxLength={2000} placeholder="Capture a thought…"/><button className="float-drawer-action" type="submit"><Plus size={13}/> Save note</button></form>
        {data.notes.map((note: Note) => <div className="float-drawer-note" key={note.id}><button className="float-drawer-item" onClick={() => props.onToggleNotePin(note.id)}><strong>{note.title}</strong><small>{note.content.slice(0, 90) || 'Empty note'}</small></button><button className={`float-pin-button ${note.pinned ? 'is-pinned' : ''}`} onClick={() => props.onToggleNotePin(note.id)} title={note.pinned ? 'Unpin note' : 'Pin note'} aria-label={note.pinned ? 'Unpin note' : 'Pin note'}>{note.pinned ? <Pin size={14} fill="currentColor"/> : <PinOff size={14}/>}</button></div>)}
        {data.notes.length === 0 && <p className="float-helper">No notes yet. Add one above to keep an idea nearby.</p>}
      </div>}
      {tool === 'links' && <div className="float-drawer-list">
        {data.bookmarks.map((link: BookmarkRecord) => <div className="float-drawer-note" key={link.id}><a className="float-drawer-item float-link-item" href={link.url} target="_blank" rel="noreferrer"><strong>{link.title}</strong><small>{link.url}</small></a><button className={`float-pin-button ${link.pinned ? 'is-pinned' : ''}`} onClick={() => props.onToggleBookmarkPin(link.id)} title={link.pinned ? 'Unpin link' : 'Pin link'} aria-label={link.pinned ? 'Unpin link' : 'Pin link'}>{link.pinned ? <Pin size={14} fill="currentColor"/> : <PinOff size={14}/>}</button></div>)}
        {data.bookmarks.length === 0 && <p className="float-helper">Save links from the main workspace, then pin the ones you use often.</p>}
      </div>}
      {tool === 'stats' && <div className="float-stats-grid"><div><strong>{focusMinutes}<small>m</small></strong><span>Focus time today</span></div><div><strong>{todayFocus.length}</strong><span>Focus sessions</span></div><div><strong>{data.tasks.filter((task) => task.completed && task.completedAt && new Date(task.completedAt).toDateString() === today).length}</strong><span>Tasks completed</span></div><div><strong>{openTasks.length}</strong><span>Tasks remaining</span></div></div>}
      {tool === 'more' && <div className="float-more-tools"><div><Volume2 size={15}/><span>Break reminder sounds</span><strong>{data.preferences.soundEnabled ? 'On' : 'Off'}</strong></div><div><AlarmClock size={15}/><span>Break reminders</span><strong>{data.preferences.breakReminderEnabled ? 'On' : 'Off'}</strong></div><p>Change reminders and sound preferences in Settings.</p></div>}
    </section>}

    <footer className="float-dock" aria-label="Workspace tools">
      <DockButton active={tool === 'none'} icon={<Clock3 size={16}/>} label="Focus" onClick={() => { setTool('none'); setCapture(null); }}/>
      <DockButton active={tool === 'tasks'} icon={<ListTodo size={16}/>} label="Tasks" badge={openTasks.length} onClick={() => toggleTool('tasks')}/>
      <DockButton active={tool === 'notes'} icon={<FileText size={16}/>} label="Notes" badge={data.notes.length || undefined} onClick={() => toggleTool('notes')}/>
      <DockButton active={tool === 'links'} icon={<Link2 size={16}/>} label="Links" onClick={() => toggleTool('links')}/>
      <DockButton active={tool === 'stats'} icon={<BarChart3 size={16}/>} label="Stats" onClick={() => toggleTool('stats')}/>
      <DockButton active={tool === 'more'} icon={<MoreHorizontal size={17}/>} label="More" onClick={() => toggleTool('more')}/>
      <button className="float-dock-add" title="Quick add task" aria-label="Quick add task" onClick={() => { setTool('none'); setCapture('task'); }}><Plus size={17}/></button>
    </footer>
    <div className="float-footnote"><span><span className="float-foot-dot"/> Saved on this device</span><span>{data.preferences.soundEnabled ? <Volume2 size={11}/> : <Volume2 size={11} opacity={0.4}/>} {data.preferences.breakReminderEnabled ? 'Break reminder on' : 'Reminders off'}</span></div>
  </div>;
}

function DockButton({ active, icon, label, badge, onClick }: { active: boolean; icon: React.ReactNode; label: string; badge?: number; onClick: () => void }) {
  return <button className={`float-dock-item ${active ? 'active' : ''}`} title={label} aria-label={label} aria-pressed={active} onClick={onClick}><span className="float-dock-icon">{icon}{badge !== undefined && badge > 0 && <i>{badge > 9 ? '9+' : badge}</i>}</span><small>{label}</small></button>;
}
