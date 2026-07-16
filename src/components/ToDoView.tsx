import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { ChecklistTemplate, MaintenanceComponent, RaceWeekend, Setup, Todo, TodoItem } from '../types';
import type { AppUser } from '../lib/supabase';
import {
  activeChecklistItems,
  checklistHistoryItems,
  completedChecklistItems,
  getMainChecklist,
  MAIN_CHECKLIST_TITLE,
} from '../lib/mainChecklist';
import {
  archiveCompletedMainChecklist,
  clearChecklistItems,
  clearMainChecklist,
  completeChecklistItem,
  editChecklistItem,
  importTemplateItems,
  KEEP_ADDED_ITEMS_KEY,
  resetMainChecklist,
  restoreChecklistItem,
  type ChecklistCompletionUndo,
} from '../lib/checklistMaintenance';
import BottomSheet from './ui/BottomSheet';
import ConfirmSheet from './ui/ConfirmSheet';
import CollapsibleSection from './ui/CollapsibleSection';
import EmptyState from './ui/EmptyState';
import { InfoToast } from './ui/UndoToast';

interface ToDoViewProps {
  todos: Todo[];
  onSaveTodos: (todos: Todo[]) => void;
  teamMembers?: AppUser[];
  currentUserId?: string | null;
  templates?: ChecklistTemplate[];
  onManageTemplates?: () => void;
  maintenance?: MaintenanceComponent[];
  weekends?: RaceWeekend[];
  savedSetups?: Setup[];
}

type PendingChecklistAction =
  | { kind: 'reset' }
  | { kind: 'clear-current' }
  | { kind: 'clear-completed' };

export default function ToDoView({
  todos,
  onSaveTodos,
  teamMembers = [],
  currentUserId = null,
  templates = [],
  onManageTemplates,
  maintenance = [],
  weekends = [],
  savedSetups = [],
}: ToDoViewProps) {
  const todosRef = useRef(todos);
  todosRef.current = todos;
  const addInputRef = useRef<HTMLInputElement>(null);

  const [newItemText, setNewItemText] = useState('');
  const [newItemDesc, setNewItemDesc] = useState('');
  const [showDescInput, setShowDescInput] = useState(false);
  const [newItemAssignee, setNewItemAssignee] = useState('');
  const [showAssignPicker, setShowAssignPicker] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [showMyTasks, setShowMyTasks] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [rowMenuItemId, setRowMenuItemId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editAssignee, setEditAssignee] = useState('');
  const [noteItemId, setNoteItemId] = useState<string | null>(null);
  const [completionNote, setCompletionNote] = useState('');
  const [completionUndo, setCompletionUndo] = useState<ChecklistCompletionUndo | null>(null);
  const [pendingChecklistAction, setPendingChecklistAction] = useState<PendingChecklistAction | null>(null);
  const [keepAddedItems, setKeepAddedItems] = useState(
    () => localStorage.getItem(KEEP_ADDED_ITEMS_KEY) !== 'false',
  );

  useEffect(() => {
    if (!completionUndo) return;
    const timer = window.setTimeout(() => setCompletionUndo(null), 6000);
    return () => window.clearTimeout(timer);
  }, [completionUndo]);

  const commitTodos = (updated: Todo[]) => {
    todosRef.current = updated;
    onSaveTodos(updated);
  };

  const updateMainItems = (updater: (items: TodoItem[], listId: string) => TodoItem[]) => {
    const currentTodos = todosRef.current;
    const currentMain = getMainChecklist(currentTodos);
    const listId = currentMain?.id ?? `todo-main-${Date.now()}`;
    const currentItems = currentMain?.items ?? [];
    const nextItems = updater(currentItems, listId);
    if (nextItems === currentItems) return false;
    const now = new Date().toISOString();
    const updated = currentMain
      ? currentTodos.map(todo => todo.id === currentMain.id
        ? { ...todo, title: MAIN_CHECKLIST_TITLE, weekendId: undefined, weekendName: undefined, items: nextItems, updated_at: now }
        : todo)
      : [{ id: listId, user_id: '', title: MAIN_CHECKLIST_TITLE, items: nextItems, updated_at: now }, ...currentTodos];
    commitTodos(updated);
    return true;
  };

  const currentMain = getMainChecklist(todos);
  const openItems = currentMain ? activeChecklistItems(currentMain) : [];
  const completedItems = currentMain ? completedChecklistItems(currentMain) : [];
  const historyItems = currentMain ? checklistHistoryItems(currentMain) : [];
  const myTaskCount = openItems.filter(item => item.assignedTo === currentUserId).length;
  const displayOpen = showMyTasks && currentUserId
    ? openItems.filter(item => item.assignedTo === currentUserId)
    : openItems;
  const displayCompleted = showMyTasks && currentUserId
    ? completedItems.filter(item => item.assignedTo === currentUserId)
    : completedItems;
  const rowMenuItem = currentMain?.items.find(item => item.id === rowMenuItemId) ?? null;
  const editingItem = currentMain?.items.find(item => item.id === editingItemId) ?? null;
  const noteItem = currentMain?.items.find(item => item.id === noteItemId) ?? null;

  const setKeepPreference = (value: boolean) => {
    setKeepAddedItems(value);
    localStorage.setItem(KEEP_ADDED_ITEMS_KEY, String(value));
  };

  const addItem = (event: FormEvent) => {
    event.preventDefault();
    if (!newItemText.trim()) return;
    const assignee = teamMembers.find(member => member.id === newItemAssignee);
    const item: TodoItem = {
      id: `item-${Date.now()}`,
      text: newItemText.trim(),
      desc: newItemDesc.trim() || undefined,
      done: false,
      kind: 'adhoc',
      sourceType: 'manual',
      assignedTo: assignee?.id || undefined,
      assignedToName: assignee ? (assignee.displayName || assignee.email || 'Team Member') : undefined,
    };
    updateMainItems(items => [...items, item]);
    setNewItemText('');
    setNewItemDesc('');
    setNewItemAssignee('');
    setShowDescInput(false);
    setShowAssignPicker(false);
  };

  const importSelectedTemplate = () => {
    const template = templates.find(candidate => candidate.id === selectedTemplateId);
    if (!template) return;
    updateMainItems(items => importTemplateItems(items, template));
    setSelectedTemplateId('');
  };

  const completeItem = (itemId: string) => {
    let undo: ChecklistCompletionUndo | null = null;
    const changed = updateMainItems(items => {
      const result = completeChecklistItem(items, itemId);
      undo = result.undo ?? null;
      return result.items;
    });
    if (changed && undo) setCompletionUndo(undo);
  };

  const undoCompletion = () => {
    if (!completionUndo) return;
    updateMainItems(items => restoreChecklistItem(items, completionUndo));
    setCompletionUndo(null);
  };

  const markOpen = (itemId: string) => {
    updateMainItems(items => items.map(item => item.id === itemId
      ? {
          ...item,
          done: false,
          completedAt: undefined,
          completionNote: undefined,
          archivedAt: undefined,
          removedUntilReset: undefined,
        }
      : item));
    setRowMenuItemId(null);
  };

  const removeItem = (itemId: string) => {
    updateMainItems((items, listId) => items.flatMap(item => {
      if (item.id !== itemId) return [item];
      return clearChecklistItems([item], listId, new Date().toISOString());
    }));
    setRowMenuItemId(null);
  };

  const openEdit = (item: TodoItem) => {
    setRowMenuItemId(null);
    setEditingItemId(item.id);
    setEditText(item.text);
    setEditDesc(item.desc || '');
    setEditAssignee(item.assignedTo || '');
  };

  const saveEdit = (event: FormEvent) => {
    event.preventDefault();
    if (!editingItem || !editText.trim()) return;
    const assignee = teamMembers.find(member => member.id === editAssignee);
    const assignedTo = editAssignee === '' ? undefined : (assignee?.id || editingItem.assignedTo);
    const assignedToName = editAssignee === ''
      ? undefined
      : (assignee ? (assignee.displayName || assignee.email || 'Team Member') : editingItem.assignedToName);
    updateMainItems(items => items.map(item => item.id === editingItem.id
      ? editChecklistItem(item, { text: editText, notes: editDesc, assignedTo, assignedToName })
      : item));
    setEditingItemId(null);
  };

  const openCompletionNote = (item: TodoItem) => {
    setRowMenuItemId(null);
    setNoteItemId(item.id);
    setCompletionNote(item.completionNote || '');
  };

  const saveCompletionNote = (event: FormEvent) => {
    event.preventDefault();
    if (!noteItem) return;
    updateMainItems(items => items.map(item => item.id === noteItem.id
      ? { ...item, completionNote: completionNote.trim() || undefined }
      : item));
    setNoteItemId(null);
  };

  const resetForWeekend = () => {
    setPendingChecklistAction({ kind: 'reset' });
  };

  const clearCurrentList = () => {
    setPendingChecklistAction({ kind: 'clear-current' });
  };

  const clearCompleted = () => {
    setPendingChecklistAction({ kind: 'clear-completed' });
  };

  const confirmChecklistAction = () => {
    const pending = pendingChecklistAction;
    setPendingChecklistAction(null);
    if (!pending) return;
    setCompletionUndo(null);
    if (pending.kind === 'reset') {
      commitTodos(resetMainChecklist(
        todosRef.current,
        keepAddedItems,
        new Date().toISOString(),
        templates,
        { components: maintenance, weekends, setups: savedSetups },
      ));
      window.setTimeout(() => setManageOpen(false), 0);
      return;
    }
    if (pending.kind === 'clear-current') {
      commitTodos(clearMainChecklist(todosRef.current));
      window.setTimeout(() => setManageOpen(false), 0);
      return;
    }
    commitTodos(archiveCompletedMainChecklist(todosRef.current));
  };

  const pendingChecklistCopy = pendingChecklistAction?.kind === 'reset'
    ? {
        title: 'Reset for a new Race Day?',
        body: 'Completed work moves to History. Eligible recurring jobs return. Unfinished added jobs follow your carry setting.',
        confirmLabel: 'Reset',
        destructive: false,
      }
    : pendingChecklistAction?.kind === 'clear-current'
      ? {
          title: 'Clear current checklist?',
          body: 'Completed work moves to History, recurring jobs stay hidden until reset, and unfinished added jobs are removed.',
          confirmLabel: 'Clear',
          destructive: true,
        }
      : {
          title: 'Move completed work to History?',
          body: 'Open jobs stay unchanged.',
          confirmLabel: 'Move',
          destructive: false,
        };

  const focusAddTask = () => {
    setManageOpen(false);
    window.setTimeout(() => addInputRef.current?.focus(), 0);
  };

  const groupedHistory = historyItems.reduce<Record<string, TodoItem[]>>((groups, item) => {
    const raw = item.completedAt || item.archivedAt;
    const parsed = raw ? new Date(raw) : null;
    const label = parsed && !Number.isNaN(parsed.getTime())
      ? parsed.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
      : 'Earlier';
    groups[label] = [...(groups[label] ?? []), item];
    return groups;
  }, {});

  const AssigneeBadge = ({ item }: { item: TodoItem }) => {
    if (!item.assignedToName) return null;
    const mine = item.assignedTo === currentUserId;
    return (
      <span className={`rounded-full border px-1.5 py-0.5 font-mono text-[9px] font-bold ${mine
        ? 'border-primary/40 bg-primary/20 text-primary'
        : 'border-outline-variant/40 text-on-surface-variant'}`}
      >
        {mine ? 'YOU' : item.assignedToName}
      </span>
    );
  };

  return (
    <div className="space-y-3 pb-6">
      <section className="rounded-2xl border border-outline-variant bg-surface-container p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold text-on-surface">Checklist</h2>
            <p className="font-mono text-[10px] uppercase text-on-surface-variant">
              {openItems.length} open{myTaskCount > 0 ? ` · ${myTaskCount} mine` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {currentUserId && teamMembers.length > 0 && (
              <button
                type="button"
                onClick={() => setShowMyTasks(value => !value)}
                aria-pressed={showMyTasks}
                className={`min-h-11 rounded-xl border px-3 font-mono text-[10px] font-bold uppercase ${showMyTasks
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-outline-variant text-on-surface-variant'}`}
              >
                My Tasks{myTaskCount > 0 ? ` ${myTaskCount}` : ''}
              </button>
            )}
            <button
              type="button"
              onClick={() => setManageOpen(true)}
              className="min-h-11 rounded-xl border border-outline-variant px-3 font-mono text-[10px] font-bold uppercase text-primary"
            >
              Manage
            </button>
          </div>
        </div>
      </section>

      <form onSubmit={addItem} className="space-y-2 rounded-2xl border border-outline-variant bg-surface-container p-3">
        <div className="flex gap-2">
          <input
            ref={addInputRef}
            value={newItemText}
            onChange={event => setNewItemText(event.target.value)}
            placeholder="What needs to be done?"
            className="min-h-12 min-w-0 flex-1 rounded-xl border border-outline-variant bg-surface px-3 font-mono text-sm text-on-surface outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={() => setShowDescInput(value => !value)}
            aria-label="Add task note"
            className={`min-h-12 min-w-12 rounded-xl border ${showDescInput ? 'border-primary text-primary' : 'border-outline-variant text-on-surface-variant'}`}
          >
            <span className="material-symbols-outlined">sticky_note_2</span>
          </button>
          {teamMembers.length > 0 && (
            <button
              type="button"
              onClick={() => setShowAssignPicker(value => !value)}
              aria-label="Assign task"
              className={`min-h-12 min-w-12 rounded-xl border ${showAssignPicker || newItemAssignee ? 'border-primary text-primary' : 'border-outline-variant text-on-surface-variant'}`}
            >
              <span className="material-symbols-outlined">person_add</span>
            </button>
          )}
          <button type="submit" className="min-h-12 min-w-12 rounded-xl bg-primary text-xl font-bold text-on-primary">+</button>
        </div>
        {showDescInput && (
          <textarea
            value={newItemDesc}
            onChange={event => setNewItemDesc(event.target.value)}
            rows={2}
            placeholder="Optional task note"
            className="w-full resize-none rounded-xl border border-outline-variant bg-surface p-3 font-mono text-xs text-on-surface outline-none focus:border-primary"
          />
        )}
        {showAssignPicker && teamMembers.length > 0 && (
          <select
            value={newItemAssignee}
            onChange={event => setNewItemAssignee(event.target.value)}
            className="min-h-12 w-full rounded-xl border border-outline-variant bg-surface px-3 font-mono text-xs text-on-surface"
          >
            <option value="">Unassigned</option>
            {teamMembers.map(member => (
              <option key={member.id} value={member.id}>
                {member.displayName || member.email || member.id}{member.id === currentUserId ? ' (You)' : ''}
              </option>
            ))}
          </select>
        )}
      </form>

      {displayOpen.length > 0 ? (
        <div className="space-y-2">
          {displayOpen.map(item => (
            <div
              key={item.id}
              role="button"
              tabIndex={0}
              onClick={() => completeItem(item.id)}
              onKeyDown={event => {
                if (event.currentTarget !== event.target) return;
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  completeItem(item.id);
                }
              }}
              className={`relative flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border p-3 ${item.assignedTo === currentUserId
                ? 'border-primary/40 bg-primary/5'
                : 'border-outline-variant bg-surface-container'}`}
            >
              <input
                type="checkbox"
                checked={false}
                onClick={event => event.stopPropagation()}
                onChange={() => completeItem(item.id)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm text-on-surface">{item.text}</span>
                  <AssigneeBadge item={item} />
                </div>
                {item.desc && <p className="font-mono text-[11px] text-on-surface-variant">{item.desc}</p>}
              </div>
              <button
                type="button"
                aria-label={`Actions for ${item.text}`}
                onClick={event => { event.stopPropagation(); setRowMenuItemId(item.id); }}
                className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl text-on-surface-variant hover:bg-surface-container-high hover:text-primary"
              >
                <span className="material-symbols-outlined">more_vert</span>
              </button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="task_alt"
          title={showMyTasks ? 'No tasks assigned to you' : 'Checklist clear'}
          cta={{ label: 'Add task', onClick: focusAddTask, icon: 'add' }}
          secondaryCta={{ label: 'Add from saved list', onClick: () => setManageOpen(true) }}
        />
      )}

      {displayCompleted.length > 0 && (
        <CollapsibleSection
          title="Completed since last reset"
          subtitle={`${displayCompleted.length} completed`}
          storageKey="race_notes_checklist_completed_open"
          defaultOpen={false}
        >
          <div className="space-y-2 pt-2">
            {displayCompleted.map(item => (
              <div key={item.id} className="flex min-h-14 items-start gap-3 rounded-xl border border-outline-variant/40 bg-surface p-3">
                <span className="material-symbols-outlined mt-0.5 text-green-500">check_circle</span>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm text-on-surface-variant line-through">{item.text}</span>
                    <AssigneeBadge item={item} />
                  </div>
                  {item.desc && <p className="font-mono text-[11px] text-on-surface-variant">{item.desc}</p>}
                  {item.completionNote && <p className="font-mono text-[11px] text-on-surface-variant">{item.completionNote}</p>}
                  {item.completedAt && (
                    <p className="font-mono text-[10px] text-on-surface-variant/70">
                      Completed {new Date(item.completedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  aria-label={`Actions for completed ${item.text}`}
                  onClick={() => setRowMenuItemId(item.id)}
                  className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-on-surface-variant hover:bg-surface-container-high hover:text-primary"
                >
                  <span className="material-symbols-outlined">more_vert</span>
                </button>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      <BottomSheet open={manageOpen} onClose={() => setManageOpen(false)} title="Manage checklist">
        <div className="space-y-4 pb-2">
          <section className="space-y-2">
            <h3 className="font-mono text-[10px] font-bold uppercase text-on-surface-variant">Add from saved list</h3>
            {templates.length > 0 ? (
              <div className="flex gap-2">
                <select
                  value={selectedTemplateId}
                  onChange={event => setSelectedTemplateId(event.target.value)}
                  className="min-h-12 min-w-0 flex-1 rounded-xl border border-outline-variant bg-surface px-3 font-mono text-xs text-on-surface"
                >
                  <option value="">Select saved list</option>
                  {templates.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}
                </select>
                <button
                  type="button"
                  disabled={!selectedTemplateId}
                  onClick={importSelectedTemplate}
                  className="min-h-12 rounded-xl bg-primary px-4 font-mono text-[10px] font-bold uppercase text-on-primary disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            ) : (
              <p className="font-mono text-xs text-on-surface-variant">No saved lists yet.</p>
            )}
            {onManageTemplates && (
              <button
                type="button"
                onClick={() => { setManageOpen(false); onManageTemplates(); }}
                className="min-h-12 w-full rounded-xl border border-outline-variant px-4 text-left font-mono text-xs font-bold text-primary"
              >
                Manage saved lists
              </button>
            )}
          </section>

          <label className="flex min-h-14 items-center gap-3 rounded-xl border border-outline-variant p-3 font-mono text-xs text-on-surface">
            <input
              type="checkbox"
              checked={keepAddedItems}
              onChange={event => setKeepPreference(event.target.checked)}
              className="h-5 w-5 accent-primary"
            />
            Carry unfinished added jobs to next Race Day
          </label>

          <div className="grid gap-2">
            <button type="button" onClick={resetForWeekend} className="min-h-12 rounded-xl border border-outline-variant px-4 text-left font-mono text-xs font-bold text-on-surface">Reset for new Race Day</button>
            <button type="button" onClick={clearCompleted} disabled={completedItems.length === 0} className="min-h-12 rounded-xl border border-outline-variant px-4 text-left font-mono text-xs font-bold text-on-surface disabled:opacity-40">Clear completed</button>
            <button type="button" onClick={clearCurrentList} className="min-h-12 rounded-xl border border-red-500/50 px-4 text-left font-mono text-xs font-bold text-red-400">Clear current list</button>
            <button type="button" onClick={() => setShowHistory(value => !value)} className="min-h-12 rounded-xl border border-outline-variant px-4 text-left font-mono text-xs font-bold text-primary">
              {showHistory ? 'Hide history' : `View history${historyItems.length ? ` (${historyItems.length})` : ''}`}
            </button>
          </div>

          {showHistory && (
            <section className="space-y-4 border-t border-outline-variant pt-4">
              {historyItems.length === 0 ? (
                <p className="py-4 text-center font-mono text-xs text-on-surface-variant">No completed history yet.</p>
              ) : Object.entries(groupedHistory).map(([date, items]) => (
                <div key={date} className="space-y-2">
                  <h4 className="font-mono text-[10px] font-bold uppercase text-on-surface-variant">{date}</h4>
                  {items.map(item => (
                    <div key={item.id} className="rounded-xl border border-outline-variant/40 bg-surface p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-on-surface">{item.text}</span>
                        <AssigneeBadge item={item} />
                      </div>
                      {item.completionNote && <p className="mt-1 font-mono text-[11px] text-on-surface-variant">{item.completionNote}</p>}
                    </div>
                  ))}
                </div>
              ))}
            </section>
          )}
        </div>
      </BottomSheet>

      <BottomSheet open={!!rowMenuItem} onClose={() => setRowMenuItemId(null)} title={rowMenuItem?.text ?? 'Task actions'}>
        {rowMenuItem && (
          <div className="space-y-2 pb-2">
            <button type="button" onClick={() => openEdit(rowMenuItem)} className="min-h-12 w-full rounded-xl px-3 text-left font-mono text-sm text-on-surface hover:bg-surface-container-high">Edit task</button>
            {rowMenuItem.done ? (
              <>
                <button type="button" onClick={() => markOpen(rowMenuItem.id)} className="min-h-12 w-full rounded-xl px-3 text-left font-mono text-sm text-on-surface hover:bg-surface-container-high">Mark open</button>
                <button type="button" onClick={() => openCompletionNote(rowMenuItem)} className="min-h-12 w-full rounded-xl px-3 text-left font-mono text-sm text-on-surface hover:bg-surface-container-high">{rowMenuItem.completionNote ? 'Edit completion note' : 'Add completion note'}</button>
              </>
            ) : (
              <button type="button" onClick={() => removeItem(rowMenuItem.id)} className="min-h-12 w-full rounded-xl px-3 text-left font-mono text-sm text-red-400 hover:bg-surface-container-high">Remove</button>
            )}
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={!!editingItem} onClose={() => setEditingItemId(null)} title="Edit task">
        {editingItem && (
          <form onSubmit={saveEdit} className="space-y-3 pb-2">
            <input value={editText} onChange={event => setEditText(event.target.value)} className="min-h-12 w-full rounded-xl border border-outline-variant bg-surface px-3 font-mono text-sm text-on-surface" />
            <textarea value={editDesc} onChange={event => setEditDesc(event.target.value)} rows={3} placeholder="Optional task note" className="w-full rounded-xl border border-outline-variant bg-surface p-3 font-mono text-sm text-on-surface" />
            {teamMembers.length > 0 && (
              <select value={editAssignee} onChange={event => setEditAssignee(event.target.value)} className="min-h-12 w-full rounded-xl border border-outline-variant bg-surface px-3 font-mono text-xs text-on-surface">
                <option value="">Unassigned</option>
                {teamMembers.map(member => <option key={member.id} value={member.id}>{member.displayName || member.email || member.id}</option>)}
              </select>
            )}
            <button type="submit" className="min-h-12 w-full rounded-xl bg-primary font-display font-bold text-on-primary">Save task</button>
          </form>
        )}
      </BottomSheet>

      <BottomSheet open={!!noteItem} onClose={() => setNoteItemId(null)} title="Completion note">
        {noteItem && (
          <form onSubmit={saveCompletionNote} className="space-y-3 pb-2">
            <textarea autoFocus value={completionNote} onChange={event => setCompletionNote(event.target.value)} rows={4} placeholder="Optional completion note" className="w-full rounded-xl border border-outline-variant bg-surface p-3 font-mono text-sm text-on-surface" />
            <button type="submit" className="min-h-12 w-full rounded-xl bg-primary font-display font-bold text-on-primary">Save note</button>
          </form>
        )}
      </BottomSheet>

      <ConfirmSheet
        open={!!pendingChecklistAction}
        title={pendingChecklistCopy.title}
        body={pendingChecklistCopy.body}
        confirmLabel={pendingChecklistCopy.confirmLabel}
        cancelLabel="Keep"
        destructive={pendingChecklistCopy.destructive}
        onConfirm={confirmChecklistAction}
        onCancel={() => setPendingChecklistAction(null)}
      />

      <InfoToast
        open={!!completionUndo}
        title={completionUndo ? `${completionUndo.item.text} completed` : ''}
        icon="check_circle"
        action={completionUndo ? { label: 'UNDO', onClick: undoCompletion } : undefined}
        onClose={() => setCompletionUndo(null)}
      />
    </div>
  );
}
