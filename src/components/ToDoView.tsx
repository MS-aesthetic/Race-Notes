import React, { useState } from 'react';
import { ChecklistTemplate, Todo, TodoItem } from '../types';
import { AppUser } from '../lib/supabase';
import { getMainChecklist, MAIN_CHECKLIST_TITLE } from '../lib/mainChecklist';
import { editChecklistItem, KEEP_ADDED_ITEMS_KEY, resetMainChecklist, todoItemKind } from '../lib/checklistMaintenance';

// ── Completion confirmation modal ─────────────────────────────────────────

interface CompletionModalProps {
  item: TodoItem;
  onConfirm: (note: string) => void;
  onCancel: () => void;
}

function CompletionModal({ item, onConfirm, onCancel }: CompletionModalProps) {
  const [note, setNote] = useState('');

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface border-2 border-outline rounded-lg p-5 max-w-sm w-full shadow-2xl space-y-4">
        <div className="flex items-center gap-2 border-b border-outline-variant/60 pb-3">
          <span
            className="material-symbols-outlined text-green-400 text-xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            check_circle
          </span>
          <h3 className="font-display font-bold uppercase text-sm text-on-surface tracking-wide">
            Mark Task Complete
          </h3>
        </div>

        <div>
          <p className="font-mono text-xs text-primary uppercase font-bold mb-1 leading-snug">
            {item.text}
          </p>
          {item.desc && (
            <p className="text-[11px] text-on-surface-variant font-mono italic leading-relaxed">
              "{item.desc}"
            </p>
          )}
          {item.assignedToName && (
            <p className="text-[10px] text-on-surface-variant/60 font-mono mt-1">
              Assigned to: {item.assignedToName}
            </p>
          )}
        </div>

        <div>
          <label className="block text-[10px] font-mono uppercase text-on-surface-variant mb-1.5 tracking-wider">
            Completion Note <span className="text-on-surface-variant/40 normal-case">(optional)</span>
          </label>
          <textarea
            autoFocus
            placeholder="e.g. Installed 250lb spring. Torqued to 80 ft-lbs. Will re-check after heat race."
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            className="w-full bg-surface-container border border-outline-variant focus:border-primary text-sm text-on-surface font-mono p-2.5 rounded outline-none resize-none"
          />
        </div>

        <div className="flex gap-2 justify-end text-xs font-mono">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2 border border-outline-variant text-on-surface-variant uppercase rounded hover:bg-surface-container transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(note.trim())}
            className="px-4 py-2 bg-green-700 hover:bg-green-600 text-white font-bold uppercase rounded transition-colors"
          >
            Mark Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main ToDoView ─────────────────────────────────────────────────────────

interface ToDoViewProps {
  todos: Todo[];
  onSaveTodos: (t: Todo[]) => void;
  teamMembers?: AppUser[];
  currentUserId?: string | null;
  templates?: ChecklistTemplate[];
  onManageTemplates?: () => void;
}

export default function ToDoView({
  todos,
  onSaveTodos,
  teamMembers = [],
  currentUserId = null,
  templates = [],
  onManageTemplates,
}: ToDoViewProps) {
  const activeTodo = getMainChecklist(todos);
  const [newItemText, setNewItemText]           = useState('');
  const [newItemDesc, setNewItemDesc]           = useState('');
  const [showDescInput, setShowDescInput]       = useState(false);
  const [newItemAssignee, setNewItemAssignee]   = useState<string>('');
  const [showAssignPicker, setShowAssignPicker] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [pendingComplete, setPendingComplete]   = useState<{ todoId: string; item: TodoItem } | null>(null);
  const [showMyTasks, setShowMyTasks]           = useState(false);
  const [editingItem, setEditingItem] = useState<TodoItem | null>(null);
  const [editText, setEditText] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editAssignee, setEditAssignee] = useState('');
  const [keepAddedItems, setKeepAddedItems] = useState(() => localStorage.getItem(KEEP_ADDED_ITEMS_KEY) !== 'false');

  const saveMainItems = (items: TodoItem[]) => {
    const now = new Date().toISOString();
    if (activeTodo) {
      onSaveTodos(todos.map(todo => todo.id === activeTodo.id
        ? { ...todo, title: MAIN_CHECKLIST_TITLE, weekendId: undefined, weekendName: undefined, items, updated_at: now }
        : todo));
      return;
    }
    onSaveTodos([{
      id: `todo-main-${Date.now()}`,
      user_id: '',
      title: MAIN_CHECKLIST_TITLE,
      items,
      updated_at: now,
    }, ...todos]);
  };

  const importTemplate = () => {
    const template = templates.find(item => item.id === selectedTemplateId);
    if (!template) return;
    if (activeTodo?.items.length && !window.confirm(`Add ${template.items.length} jobs from ${template.name} to Main Checklist?`)) return;
    const stamp = Date.now();
    const imported: TodoItem[] = template.items.map((item, index) => ({
      id: `item-${stamp}-${index}-${Math.random().toString(36).slice(2, 7)}`,
      text: item.text,
      done: false,
      kind: 'core',
      sourceType: 'template',
      sourceId: `template:${template.id}:${item.id}`,
    }));
    saveMainItems([...(activeTodo?.items ?? []), ...imported]);
    setSelectedTemplateId('');
  };

  // ── Item management ────────────────────────────────────────────────────

  const addItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemText.trim()) return;
    const assignee = teamMembers.find(m => m.id === newItemAssignee);
    const newItem: TodoItem = {
      id: `item-${Date.now()}`,
      text: newItemText.trim(),
      desc: newItemDesc.trim() || undefined,
      done: false,
      kind: 'adhoc',
      sourceType: 'manual',
      assignedTo: assignee?.id || undefined,
      assignedToName: assignee
        ? (assignee.displayName || assignee.email || 'Team Member')
        : undefined,
    };
    saveMainItems([...(activeTodo?.items ?? []), newItem]);
    setNewItemText('');
    setNewItemDesc('');
    setNewItemAssignee('');
    setShowDescInput(false);
    setShowAssignPicker(false);
  };

  const handleCheckboxClick = (todoId: string, item: TodoItem) => {
    if (item.done) {
      saveMainItems((activeTodo?.items ?? []).map(i =>
        i.id === item.id ? { ...i, done: false, completionNote: undefined, completedAt: undefined } : i
      ));
    } else {
      setPendingComplete({ todoId, item });
    }
  };

  const handleConfirmComplete = (note: string) => {
    if (!pendingComplete) return;
    const { item } = pendingComplete;
    saveMainItems((activeTodo?.items ?? []).map(i =>
      i.id === item.id
        ? { ...i, done: true, completionNote: note || undefined, completedAt: new Date().toISOString() }
        : i
    ));
    setPendingComplete(null);
  };

  const deleteItem = (_todoId: string, itemId: string) => {
    saveMainItems((activeTodo?.items ?? []).flatMap(item => {
      if (item.id !== itemId) return [item];
      return todoItemKind(item) === 'core' ? [{ ...item, removedUntilReset: true }] : [];
    }));
  };

  const openEdit = (item: TodoItem) => {
    setEditingItem(item);
    setEditText(item.text);
    setEditDesc(item.desc || '');
    setEditAssignee(item.assignedTo || '');
  };

  const saveEdit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingItem || !editText.trim()) return;
    const assignee = teamMembers.find(member => member.id === editAssignee);
    const assignedTo = editAssignee === '' ? undefined : (assignee?.id || editingItem.assignedTo);
    const assignedToName = editAssignee === ''
      ? undefined
      : (assignee ? (assignee.displayName || assignee.email || 'Team Member') : editingItem.assignedToName);
    saveMainItems((activeTodo?.items ?? []).map(item => item.id === editingItem.id
      ? editChecklistItem(item, {
          text: editText,
          notes: editDesc,
          assignedTo,
          assignedToName,
        })
      : item));
    setEditingItem(null);
  };

  const setKeepPreference = (value: boolean) => {
    setKeepAddedItems(value);
    localStorage.setItem(KEEP_ADDED_ITEMS_KEY, String(value));
  };

  const resetForWeekend = () => {
    if (!window.confirm('Reset Main Checklist for a new weekend? Completed marks and completion notes will be cleared.')) return;
    onSaveTodos(resetMainChecklist(todos, keepAddedItems, new Date().toISOString(), templates));
  };

  // ── Derived ────────────────────────────────────────────────────────────

  const visibleItems = activeTodo?.items.filter(item => !item.removedUntilReset) ?? [];
  const allOpen    = visibleItems.filter(i => !i.done);
  const allDone    = visibleItems.filter(i => i.done);
  const activeTodoId = activeTodo?.id ?? '';

  const myTaskCount  = allOpen.filter(i => i.assignedTo === currentUserId).length;
  const displayOpen  = showMyTasks && currentUserId ? allOpen.filter(i => i.assignedTo === currentUserId) : allOpen;
  const displayDone  = showMyTasks && currentUserId ? allDone.filter(i => i.assignedTo === currentUserId) : allDone;

  // ── Assignee badge helper ──────────────────────────────────────────────

  const AssigneeBadge = ({ item }: { item: TodoItem }) => {
    if (!item.assignedToName) return null;
    const isMe = item.assignedTo === currentUserId;
    return (
      <span className={`inline-flex items-center gap-0.5 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full border ${
        isMe
          ? 'bg-primary/20 text-primary border-primary/40'
          : 'bg-surface-container-high text-on-surface-variant border-outline-variant/50'
      }`}>
        <span className="material-symbols-outlined text-[10px]" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
        {isMe ? 'YOU' : item.assignedToName}
      </span>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 h-full text-on-surface">

      {pendingComplete && (
        <CompletionModal
          item={pendingComplete.item}
          onConfirm={handleConfirmComplete}
          onCancel={() => setPendingComplete(null)}
        />
      )}

      {editingItem && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={saveEdit} className="bg-surface border-2 border-outline rounded-lg p-5 max-w-sm w-full shadow-2xl space-y-4">
            <h3 className="font-display font-bold uppercase text-sm text-on-surface">Edit Task</h3>
            <div>
              <label className="block text-[10px] font-mono uppercase text-on-surface-variant mb-1">Task</label>
              <input autoFocus value={editText} onChange={event => setEditText(event.target.value)} className="w-full p-2.5 bg-surface-container border border-outline-variant focus:border-primary rounded font-mono text-sm outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase text-on-surface-variant mb-1">Notes</label>
              <textarea value={editDesc} onChange={event => setEditDesc(event.target.value)} rows={3} className="w-full p-2.5 bg-surface-container border border-outline-variant focus:border-primary rounded font-mono text-sm outline-none resize-none" />
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase text-on-surface-variant mb-1">Assigned To</label>
              <select value={editAssignee} onChange={event => setEditAssignee(event.target.value)} className="w-full p-2.5 bg-surface-container border border-outline-variant focus:border-primary rounded font-mono text-sm outline-none">
                <option value="">Unassigned</option>
                {teamMembers.map(member => <option key={member.id} value={member.id}>{member.displayName || member.email || member.id}</option>)}
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setEditingItem(null)} className="px-3 py-2 border border-outline-variant rounded font-mono text-xs uppercase">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-primary text-on-primary rounded font-mono text-xs font-bold uppercase">Save Task</button>
            </div>
          </form>
        </div>
      )}

      {/* ── One global Main Checklist ─────────────────────────────── */}
      <div className="flex flex-col gap-3 bg-surface p-3 rounded-lg border border-outline-variant/50">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display font-bold uppercase text-primary text-sm tracking-wide">Main Checklist</h3>
            <p className="font-mono text-[10px] text-on-surface-variant/60 mt-1">One active team list. Add jobs or bring them in from a saved list.</p>
          </div>
          {onManageTemplates && (
            <button type="button" onClick={onManageTemplates} className="shrink-0 min-h-11 px-3 border border-outline-variant rounded font-mono text-[10px] font-bold uppercase text-on-surface-variant hover:text-primary hover:border-primary">
              Edit List
            </button>
          )}
        </div>
        {templates.length > 0 && (
          <div className="flex gap-2">
            <select
              className="flex-1 min-w-0 p-2 bg-surface-container border border-outline-variant rounded text-xs font-mono"
              value={selectedTemplateId}
              onChange={e => setSelectedTemplateId(e.target.value)}
            >
              <option value="">Select template…</option>
              {templates.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}
            </select>
            <button
              type="button"
              disabled={!selectedTemplateId}
              onClick={importTemplate}
              className="px-3 py-2 bg-primary text-on-primary font-mono text-[10px] font-bold uppercase rounded disabled:opacity-40"
            >
              Import
            </button>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-outline-variant/40">
          <label className="flex items-center gap-2 min-h-11 cursor-pointer font-mono text-[10px] uppercase text-on-surface-variant">
            <input type="checkbox" checked={keepAddedItems} onChange={event => setKeepPreference(event.target.checked)} className="w-5 h-5 accent-primary" />
            Keep added jobs on reset
          </label>
          <button type="button" onClick={resetForWeekend} className="min-h-11 px-3 border border-outline-variant rounded font-mono text-[10px] uppercase font-bold text-on-surface-variant hover:text-primary hover:border-primary">
            Reset for New Weekend
          </button>
        </div>
      </div>

      {/* ── Active list ──────────────────────────────────────────────── */}
      <div className="bg-surface-container border border-outline-variant rounded-lg p-4 flex-1 flex flex-col overflow-hidden">

          {/* List header */}
          <div className="flex justify-between items-center mb-3 gap-2 flex-wrap">
            <span className="font-mono text-[10px] uppercase text-on-surface-variant font-bold">{allOpen.length} open · {allDone.length} completed</span>
            <div className="flex gap-2 items-center">
              {/* My tasks toggle — only when signed in with a team */}
              {currentUserId && teamMembers.length > 0 && (
                <button
                  onClick={() => setShowMyTasks(v => !v)}
                  title={showMyTasks ? 'Show all tasks' : 'Show only my tasks'}
                  className={`relative flex items-center gap-1 text-[9px] font-mono font-bold px-2 py-1 rounded-full border transition-all ${
                    showMyTasks
                      ? 'bg-primary/20 border-primary text-primary'
                      : 'border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary'
                  }`}
                >
                  <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
                  MY TASKS
                  {myTaskCount > 0 && !showMyTasks && (
                    <span className="bg-primary text-on-primary rounded-full text-[8px] px-1.5 py-0.5 font-black ml-0.5 leading-none">
                      {myTaskCount}
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* ── Add item form ─────────────────────────────────────────── */}
          <form onSubmit={addItem} className="mb-4 space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="What needs to be done?"
                className="flex-1 p-2 bg-surface-container border border-outline-variant/50 focus:border-primary text-sm font-mono rounded outline-none"
                value={newItemText}
                onChange={e => setNewItemText(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowDescInput(v => !v)}
                title={showDescInput ? 'Hide notes' : 'Add notes'}
                className={`p-2 rounded border transition-colors shrink-0 ${
                  showDescInput ? 'bg-primary/10 border-primary text-primary' : 'border-outline-variant text-on-surface-variant hover:text-primary hover:border-primary'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">sticky_note_2</span>
              </button>
              {teamMembers.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAssignPicker(v => !v)}
                  title={showAssignPicker ? 'Hide assignee' : 'Assign to team member'}
                  className={`p-2 rounded border transition-colors shrink-0 ${
                    newItemAssignee || showAssignPicker
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'border-outline-variant text-on-surface-variant hover:text-primary hover:border-primary'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">person_add</span>
                </button>
              )}
              <button type="submit" className="bg-primary text-[#0e0e0e] px-4 font-bold rounded text-xl leading-none shrink-0">+</button>
            </div>

            {showDescInput && (
              <textarea
                placeholder="Optional task notes..."
                rows={2}
                className="w-full p-2 bg-surface-container border border-outline-variant/50 focus:border-primary text-xs font-mono rounded outline-none resize-none text-on-surface-variant"
                value={newItemDesc}
                onChange={e => setNewItemDesc(e.target.value)}
              />
            )}

            {showAssignPicker && teamMembers.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-on-surface-variant text-[15px] shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
                <select
                  value={newItemAssignee}
                  onChange={e => setNewItemAssignee(e.target.value)}
                  className="flex-1 p-2 bg-surface-container border border-outline-variant/50 focus:border-primary text-xs font-mono rounded outline-none"
                >
                  <option value="">Unassigned</option>
                  {teamMembers.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.displayName || m.email || m.id}
                      {m.id === currentUserId ? ' (You)' : ''}
                    </option>
                  ))}
                </select>
                {newItemAssignee && (
                  <button
                    type="button"
                    onClick={() => setNewItemAssignee('')}
                    className="material-symbols-outlined text-on-surface-variant/60 hover:text-red-400 text-[15px]"
                  >
                    close
                  </button>
                )}
              </div>
            )}
          </form>

          {/* ── Items list ───────────────────────────────────────────── */}
          <div className="flex flex-col gap-3 overflow-y-auto flex-1 custom-scrollbar pr-1">

            {/* Open tasks */}
            {displayOpen.length > 0 && (
              <div className="space-y-2">
                {displayOpen.map(item => {
                  const isAssignedToMe = item.assignedTo === currentUserId;
                  return (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleCheckboxClick(activeTodoId, item)}
                      onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); handleCheckboxClick(activeTodoId, item); } }}
                      className={`relative min-h-14 flex items-start gap-3 p-3 rounded border transition-colors cursor-pointer ${
                        isAssignedToMe
                          ? 'bg-primary/5 border-primary/40 hover:border-primary/70'
                          : 'bg-surface-container border-outline-variant/30 hover:border-primary/30'
                      }`}
                    >
                      {/* Left accent stripe for my tasks */}
                      {isAssignedToMe && (
                        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary rounded-l-sm" />
                      )}
                      <input
                        type="checkbox"
                        checked={false}
                        onClick={event => event.stopPropagation()}
                        onChange={() => handleCheckboxClick(activeTodoId, item)}
                        className="w-5 h-5 accent-primary cursor-pointer shrink-0 mt-0.5"
                      />
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm text-on-surface leading-snug">{item.text}</span>
                          <AssigneeBadge item={item} />
                        </div>
                        {item.desc && (
                          <span className="font-mono text-[11px] text-on-surface-variant/70 italic block leading-relaxed">
                            {item.desc}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={event => { event.stopPropagation(); openEdit(item); }}
                        aria-label={`Edit ${item.text}`}
                        className="shrink-0 material-symbols-outlined text-[18px] text-on-surface-variant/50 hover:text-primary mt-0.5"
                      >edit</button>
                      <button
                        type="button"
                        onClick={event => { event.stopPropagation(); deleteItem(activeTodoId, item.id); }}
                        className="shrink-0 material-symbols-outlined text-[16px] text-on-surface-variant/40 hover:text-red-400 mt-0.5"
                      >
                        close
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Empty my-tasks state */}
            {showMyTasks && displayOpen.length === 0 && displayDone.length === 0 && (
              <div className="text-center py-8 space-y-2">
                <span className="material-symbols-outlined text-on-surface-variant/30 text-4xl">task_alt</span>
                <p className="font-mono text-xs text-on-surface-variant/50">No tasks assigned to you in this list.</p>
              </div>
            )}

            {/* Divider */}
            {displayOpen.length > 0 && displayDone.length > 0 && (
              <div className="flex items-center gap-2 py-1">
                <div className="flex-1 border-t border-outline-variant/30" />
                <span className="font-mono text-[10px] text-on-surface-variant/50 uppercase tracking-wider whitespace-nowrap">
                  {displayDone.length} Completed
                </span>
                <div className="flex-1 border-t border-outline-variant/30" />
              </div>
            )}

            {/* Completed tasks */}
            {displayDone.length > 0 && (
              <div className="space-y-2">
                {displayDone.map(item => (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleCheckboxClick(activeTodoId, item)}
                    onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); handleCheckboxClick(activeTodoId, item); } }}
                    className="min-h-14 flex items-start gap-3 p-3 bg-surface-container/50 rounded border border-outline-variant/20 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={true}
                      onClick={event => event.stopPropagation()}
                      onChange={() => handleCheckboxClick(activeTodoId, item)}
                      className="w-5 h-5 accent-primary cursor-pointer shrink-0 mt-0.5"
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm line-through text-on-surface-variant/40 leading-snug">
                          {item.text}
                        </span>
                        {item.assignedToName && (
                          <span className="text-[9px] font-mono text-on-surface-variant/30 border border-outline-variant/20 px-1.5 py-0.5 rounded-full">
                            {item.assignedTo === currentUserId ? 'YOU' : item.assignedToName}
                          </span>
                        )}
                      </div>
                      {item.desc && (
                        <span className="font-mono text-[11px] line-through text-on-surface-variant/25 italic block leading-relaxed">
                          {item.desc}
                        </span>
                      )}
                      {item.completionNote && (
                        <div className="flex items-start gap-1.5 mt-1.5 bg-green-950/40 border border-green-800/30 rounded-md p-2">
                          <span
                            className="material-symbols-outlined text-green-500/80 text-[13px] mt-0.5 shrink-0"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            check_circle
                          </span>
                          <span className="font-mono text-[11px] text-green-400/80 leading-relaxed">
                            {item.completionNote}
                          </span>
                        </div>
                      )}
                      {item.completedAt && (
                        <span className="font-mono text-[10px] text-on-surface-variant/30 block">
                          Completed {new Date(item.completedAt).toLocaleString([], {
                            month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={event => { event.stopPropagation(); openEdit(item); }}
                      aria-label={`Edit ${item.text}`}
                      className="shrink-0 material-symbols-outlined text-[18px] text-on-surface-variant/40 hover:text-primary mt-0.5"
                    >edit</button>
                    <button
                      type="button"
                      onClick={event => { event.stopPropagation(); deleteItem(activeTodoId, item.id); }}
                      className="shrink-0 material-symbols-outlined text-[16px] text-on-surface-variant/25 hover:text-red-400 mt-0.5"
                    >
                      close
                    </button>
                  </div>
                ))}
              </div>
            )}

            {visibleItems.length === 0 && (
              <p className="text-center text-on-surface-variant/50 font-mono text-xs mt-6">
                List is empty. Add your first task above.
              </p>
            )}
          </div>
        </div>
    </div>
  );
}
