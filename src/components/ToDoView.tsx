import React, { useState } from 'react';
import { Todo, TodoItem } from '../types';

export default function ToDoView({ todos, onSaveTodos }: { todos: Todo[], onSaveTodos: (t: Todo[]) => void }) {
  const normalTodos = todos.filter(t => !t.is_template);
  const templates = todos.filter(t => t.is_template);

  const [selectedId, setSelectedId] = useState<string | null>(normalTodos[0]?.id || null);
  const [newTitle, setNewTitle] = useState('');
  const [newItemText, setNewItemText] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    let itemsForNew: TodoItem[] = [];
    if (selectedTemplateId) {
      const tpl = templates.find(t => t.id === selectedTemplateId);
      if (tpl) {
        // Clone items but set done to false, new IDs
        itemsForNew = tpl.items.map(i => ({ ...i, id: `item-${Date.now()}-${Math.random()}`, done: false }));
      }
    }

    const newTodo: Todo = { 
      id: `todo-${Date.now()}`, 
      user_id: '', 
      title: newTitle, 
      items: itemsForNew, 
      updated_at: new Date().toISOString() 
    };
    onSaveTodos([newTodo, ...todos]);
    setSelectedId(newTodo.id);
    setNewTitle('');
    setSelectedTemplateId('');
  };

  const saveAsTemplate = () => {
    const active = todos.find(t => t.id === selectedId);
    if (!active) return;
    const name = window.prompt("Enter template name:", `${active.title} Template`);
    if (!name) return;

    const newTemplate: Todo = {
      ...active,
      id: `todo-tpl-${Date.now()}`,
      title: name,
      is_template: true,
      items: active.items.map(i => ({ ...i, done: false })),
      updated_at: new Date().toISOString()
    };
    onSaveTodos([newTemplate, ...todos]);
    alert("Saved as template!");
  };

  const addItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemText.trim() || !selectedId) return;
    const items = [...(todos.find(t => t.id === selectedId)?.items || []), { id: `item-${Date.now()}`, text: newItemText, done: false }];
    onSaveTodos(todos.map(t => t.id === selectedId ? { ...t, items } : t));
    setNewItemText('');
  };

  const toggleItem = (todoId: string, itemId: string) => {
    onSaveTodos(todos.map(t => t.id === todoId ? {
      ...t, items: t.items.map(i => i.id === itemId ? { ...i, done: !i.done } : i)
    } : t));
  };

  const deleteItem = (todoId: string, itemId: string) => {
    onSaveTodos(todos.map(t => t.id === todoId ? {
      ...t, items: t.items.filter(i => i.id !== itemId)
    } : t));
  };

  const deleteList = (todoId: string) => {
    if(!window.confirm("Delete this list entirely?")) return;
    const remaining = todos.filter(t => t.id !== todoId);
    onSaveTodos(remaining);
    const newNormals = remaining.filter(t => !t.is_template);
    if (selectedId === todoId) {
      setSelectedId(newNormals[0]?.id || null);
    }
  };

  const activeTodo = todos.find(t => t.id === selectedId);

  return (
    <div className="flex flex-col gap-4 h-full text-on-surface">
      <div className="flex flex-col gap-2 bg-surface p-3 rounded-lg border border-outline-variant/50">
        <label className="text-[10px] uppercase font-mono text-on-surface-variant font-bold">Select Active List</label>
        <select className="bg-[#0e0e0e] border border-outline-variant p-2 rounded text-sm font-mono w-full"
          value={selectedId || ''} onChange={e => setSelectedId(e.target.value)}>
          {normalTodos.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
        
        <div className="border-t border-outline-variant/30 pt-3 mt-1 flex flex-col gap-2">
          <label className="text-[10px] uppercase font-mono text-on-surface-variant font-bold">Create New List</label>
          <form onSubmit={handleCreate} className="flex gap-2 items-center flex-wrap">
            <input type="text" placeholder="Title" required className="flex-1 min-w-[120px] p-2 text-sm bg-[#0e0e0e] border border-outline-variant rounded font-mono" value={newTitle} onChange={e=>setNewTitle(e.target.value)} />
            {templates.length > 0 && (
              <select className="p-2 text-sm bg-[#0e0e0e] border border-outline-variant rounded font-mono max-w-[140px]" value={selectedTemplateId} onChange={e=>setSelectedTemplateId(e.target.value)}>
                <option value="">No Template</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            )}
            <button className="bg-primary text-[#0e0e0e] px-4 py-2 font-bold rounded uppercase text-xs font-mono tracking-wider whitespace-nowrap">Create</button>
          </form>
        </div>
      </div>
      
      {activeTodo && (
        <div className="bg-surface-container border border-outline-variant rounded-lg p-4 flex-1 flex flex-col h-full overflow-hidden">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-display font-bold uppercase text-primary text-sm tracking-wide">{activeTodo.title}</h3>
            <div className="flex gap-2">
              <button title="Save as Template" onClick={saveAsTemplate} className="material-symbols-outlined text-on-surface-variant hover:text-primary text-[18px]">post_add</button>
              <button title="Delete List" onClick={() => deleteList(activeTodo.id)} className="material-symbols-outlined text-on-surface-variant hover:text-red-400 text-[18px]">delete</button>
            </div>
          </div>

          <form onSubmit={addItem} className="flex gap-2 mb-4">
            <input type="text" placeholder="What needs to be done?" className="flex-1 p-2 bg-[#0e0e0e] border border-outline-variant/50 focus:border-primary text-sm font-mono rounded outline-none" value={newItemText} onChange={e=>setNewItemText(e.target.value)} />
            <button className="bg-primary text-[#0e0e0e] px-4 font-bold rounded">+</button>
          </form>
          
          <div className="flex flex-col gap-2 overflow-y-auto flex-1 custom-scrollbar pr-1">
            {activeTodo.items.map(item => (
              <div key={item.id} className="flex items-center gap-3 p-3 bg-[#0e0e0e] rounded border border-outline-variant/30 hover:border-primary/30 transition-colors">
                <input type="checkbox" checked={item.done} onChange={() => toggleItem(activeTodo.id, item.id)} className="w-5 h-5 accent-primary cursor-pointer shrink-0" />
                <span className={`font-mono text-sm leading-relaxed flex-1 ${item.done ? 'line-through text-on-surface-variant/50' : 'text-on-surface'}`}>{item.text}</span>
                <button onClick={() => deleteItem(activeTodo.id, item.id)} className="shrink-0 material-symbols-outlined text-[16px] text-on-surface-variant/50 hover:text-red-400">close</button>
              </div>
            ))}
            {activeTodo.items.length === 0 && (
              <p className="text-center text-on-surface-variant/50 font-mono text-xs mt-4">List is empty.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}