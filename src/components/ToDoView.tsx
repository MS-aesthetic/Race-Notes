import React, { useState } from 'react';
import { Todo, TodoItem } from '../types';
import { AppUser } from '../lib/supabase';

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
}

export default function ToDoView({
  todos,
  onSaveTodos,
  teamMembers = [],
  currentUserId = null,
}: ToDoViewProps) {
  const normalTodos = todos.filter(t => !t.is_template);
  const templates   = todos.filter(t => t.is_template);

  const [selectedId, setSelectedId]             = useState<string | null>(normalTodos[0]?.id || null);
  const [newTitle, setNewTitle]                 = useState('');
  const [newItemText, setNewItemText]           = useState('');
  const [newItemDesc, setNewItemDesc]           = useState('');
  const [showDescInput, setShowDescInput]       = useState(false);
  const [newItemAssignee, setNewItemAssignee]   = useState<string>('');
  const [showAssignPicker, setShowAssignPicker] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [pendingComplete, setPendingComplete]   = useState<{ todoId: string; item: TodoItem } | null>(null);
  const [showMyTasks, setShowMyTasks]           = useState(false);

  // ── List management ────────────────────────────────────────────────────

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    let items: TodoItem[] = [];
    if (selectedTemplateId) {
      const tpl = templates.find(t => t.id === selectedTemplateId);
      if (tpl) {
        items = tpl.items.map(i => ({
          ...i,
          id: `item-${Date.now()}-${Math.random()}`,
          done: false,
          completionNote: undefined,
          completedAt: undefined,
        }));
      }
    }
    const newTodo: Todo = {
      id: `todo-${Date.now()}`,
      user_id: '',
      title: newTitle,
      items,
      updated_at: new Date().toISOString(),
    };
    onSaveTodos([newTodo, ...todos]);
    setSelectedId(newTodo.id);
    setNewTitle('');
    setSelectedTemplateId('');
  };

  const saveAsTemplate = () => {
    const active = todos.find(t => t.id === selectedId);
    if (!active) return;
    const name = window.prompt('Enter template name:', `${active.title} Template`);
    if (!name) return;
    const newTemplate: Todo = {
      ...active,
      id: `todo-tpl-${Date.now()}`,
      title: name,
      is_template: true,
      items: active.items.map(i => ({ ...i, done: false, completionNote: undefined, completedAt: undefined })),
      updated_at: new Date().toISOString(),
    };
    onSaveTodos([newTemplate, ...todos]);
    alert('Saved as template!');
  };

  const deleteList = (todoId: string) => {
    if (!window.confirm('Delete this list entirely?')) return;
    const remaining = todos.filter(t => t.id !== todoId);
    onSaveTodos(remaining);
    const newNormals = remaining.filter(t => !t.is_template);
    if (selectedId === todoId) setSelectedId(newNormals[0]?.id || null);
  };

  // ── Item management ────────────────────────────────────────────────────

  const addItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemText.trim() || !selectedId) return;
    const assignee = teamMembers.find(m => m.id === newItemAssignee);
    const newItem: TodoItem = {
      id: `item-${Date.now()}`,
      text: newItemText.trim(),
      desc: newItemDesc.trim() || undefined,
      done: false,
      assignedTo: assignee?.id || undefined,
      assignedToName: assignee
        ? (assignee.displayName || assignee.email || 'Team Member')
        : undefined,
    };
    const updatedItems = [...(todos.find(t => t.id === selectedId)?.items || []), newItem];
    onSaveTodos(todos.map(t =>
      t.id === selectedId ? { ...t, items: updatedItems, updated_at: new Date().toISOString() } : t
    ));
    setNewItemText('');
    setNewItemDesc('');
    setNewItemAssignee('');
    setShowDescInput(false);
    setShowAssignPicker(false);
  };

  const handleCheckboxClick = (todoId: string, item: TodoItem) => {
    if (item.done) {
      onSaveTodos(todos.map(t =>
        t.id === todoId ? {
          ...t,
          updated_at: new Date().toISOString(),
          items: t.items.map(i =>
            i.id === item.id ? { ...i, done: false, completionNote: undefined, completedAt: undefined } : i
          ),
        } : t
      ));
    } else {
      setPendingComplete({ todoId, item });
    }
  };

  const handleConfirmComplete = (note: string) => {
    if (!pendingComplete) return;
    const { todoId, item } = pendingComplete;
    onSaveTodos(todos.map(t =>
      t.id === todoId ? {
        ...t,
        updated_at: new Date().toISOString(),
        items: t.items.map(i =>
          i.id === item.id
            ? { ...i, done: true, completionNote: note || undefined, completedAt: new Date().toISOString() }
            : i
        ),
      } : t
    ));
    setPendingComplete(null);
  };

  const deleteItem = (todoId: string, itemId: string) => {
    onSaveTodos(todos.map(t =>
      t.id === todoId ? {
        ...t,
        items: t.items.filter(i => i.id !== itemId),
        updated_at: new Date().toISOString(),
      } : t
    ));
  };

  // ── Derived ────────────────────────────────────────────────────────────

  const activeTodo = todos.find(t => t.id === selectedId);
  const allOpen    = activeTodo?.items.filter(i => !i.done) || [];
  const allDone    = activeTodo?.items.filter(i => i.done)  || [];

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

      {/* ── List selector + creator ─────────────────────────────────── */}
      <div className="flex flex-col gap-2 bg-surface p-3 rounded-lg border border-outline-variant/50">
        <label className="text-[10px] uppercase font-mono text-on-surface-variant font-bold">Select Active List</label>
        <select
          className="bg-surface-container border border-outline-variant p-2 rounded text-sm font-mono w-full"
          value={selectedId || ''}
          onChange={e => setSelectedId(e.target.value)}
        >
          {normalTodos.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>

        <div className="border-t border-outline-variant/30 pt-3 mt-1 flex flex-col gap-2">
          <label className="text-[10px] uppercase font-mono text-on-surface-variant font-bold">Create New List</label>
          <form onSubmit={handleCreate} className="flex gap-2 items-center flex-wrap">
            <input
              type="text"
              placeholder="Title"
              required
              className="flex-1 min-w-[120px] p-2 text-sm bg-surface-container border border-outline-variant rounded font-mono"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
            />
            {templates.length > 0 && (
              <select
                className="p-2 text-sm bg-surface-container border border-outline-variant rounded font-mono max-w-[140px]"
                value={selectedTemplateId}
                onChange={e => setSelectedTemplateId(e.target.value)}
              >
                <option value="">No Template</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            )}
            <button className="bg-primary text-[#0e0e0e] px-4 py-2 font-bold rounded uppercase text-xs font-mono tracking-wider whitespace-nowrap">
              Create
            </button>
          </form>
        </div>
      </div>

      {/* ── Active list ──────────────────────────────────────────────── */}
      {activeTodo && (
        <div className="bg-surface-container border border-outline-variant rounded-lg p-4 flex-1 flex flex-col overflow-hidden">

          {/* List header */}
          <div className="flex justify-between items-center mb-3 gap-2 flex-wrap">
            <h3 className="font-display font-bold uppercase text-primary text-sm tracking-wide">{activeTodo.title}</h3>
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
              <button title="Save as Template" onClick={saveAsTemplate} className="material-symbols-outlined text-on-surface-variant hover:text-primary text-[18px]">post_add</button>
              <button title="Delete List" onClick={() => deleteList(activeTodo.id)} className="material-symbols-outlined text-on-surface-variant hover:text-red-400 text-[18px]">delete</button>
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
                      className={`relative flex items-start gap-3 p-3 rounded border transition-colors ${
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
                        onChange={() => handleCheckboxClick(activeTodo.id, item)}
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
                        onClick={() => deleteItem(activeTodo.id, item.id)}
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
                    className="flex items-start gap-3 p-3 bg-surface-container/50 rounded border border-outline-variant/20"
                  >
                    <input
                      type="checkbox"
                      checked={true}
                      onChange={() => handleCheckboxClick(activeTodo.id, item)}
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
                      onClick={() => deleteItem(activeTodo.id, item.id)}
                      className="shrink-0 material-symbols-outlined text-[16px] text-on-surface-variant/25 hover:text-red-400 mt-0.5"
                    >
                      close
                    </button>
                  </div>
                ))}
              </div>
            )}

            {activeTodo.items.length === 0 && (
              <p className="text-center text-on-surface-variant/50 font-mono text-xs mt-6">
                List is empty. Add your first task above.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
