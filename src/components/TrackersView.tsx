import React, { useState } from 'react';
import { Todo, AccountingEntry, ShoppingItem, RaceWeekend } from '../types';
import { AppUser } from '../lib/supabase';
import ToDoView from './ToDoView';

// ── Props ────────────────────────────────────────────────────────────────────

interface TrackersViewProps {
  todos: Todo[];
  onSaveTodos: (t: Todo[]) => void;
  weekends?: RaceWeekend[];
  teamMembers?: AppUser[];
  currentUserId?: string | null;
  accounting: AccountingEntry[];
  onSaveAccounting: (a: AccountingEntry[]) => void;
  shopping: ShoppingItem[];
  onSaveShopping: (s: ShoppingItem[]) => void;
}

// ── Image compression ─────────────────────────────────────────────────────────

function compressImage(file: File, maxPx = 1024, quality = 0.75): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > height) { if (width > maxPx) { height *= maxPx / width; width = maxPx; } }
        else { if (height > maxPx) { width *= maxPx / height; height = maxPx; } }
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// ── Weekend picker shared ─────────────────────────────────────────────────────

function WeekendPicker({ weekends, value, onChange }: { weekends: RaceWeekend[]; value: string; onChange: (id: string, name: string) => void }) {
  if (!weekends.length) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="material-symbols-outlined text-on-surface-variant text-[15px] shrink-0">calendar_today</span>
      <select
        value={value}
        onChange={e => {
          const w = weekends.find(w => w.id === e.target.value);
          onChange(e.target.value, w?.name || '');
        }}
        className="flex-1 p-2 bg-[#0e0e0e] border border-outline-variant/50 focus:border-primary text-xs font-mono rounded outline-none"
      >
        <option value="">No Weekend (general)</option>
        {weekends.map(w => <option key={w.id} value={w.id}>{w.name} — {w.track}</option>)}
      </select>
    </div>
  );
}

// ── Weekend filter bar ────────────────────────────────────────────────────────

function WeekendFilter({ weekends, value, onChange }: { weekends: RaceWeekend[]; value: string; onChange: (v: string) => void }) {
  if (!weekends.length) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="material-symbols-outlined text-primary text-[16px] shrink-0">filter_list</span>
      <div className="relative flex-1">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full bg-surface-container border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-2 rounded-lg outline-none appearance-none cursor-pointer pr-7"
        >
          <option value="">All Weekends</option>
          {weekends.map(w => <option key={w.id} value={w.id}>{w.name} — {w.track}</option>)}
        </select>
        <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none text-[15px]">expand_more</span>
      </div>
      {value && (
        <button onClick={() => onChange('')} className="w-8 h-8 flex items-center justify-center rounded border border-outline-variant text-on-surface-variant hover:text-primary shrink-0">
          <span className="material-symbols-outlined text-[15px]">close</span>
        </button>
      )}
    </div>
  );
}

// ── Accounting Tab ────────────────────────────────────────────────────────────

function AccountingTab({ entries, onSave, weekends }: { entries: AccountingEntry[]; onSave: (a: AccountingEntry[]) => void; weekends: RaceWeekend[] }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [payer, setPayer] = useState('');
  const [payee, setPayee] = useState('');
  const [weekendId, setWeekendId] = useState('');
  const [weekendName, setWeekendName] = useState('');
  const [receiptPhoto, setReceiptPhoto] = useState<string | undefined>();
  const [weekendFilter, setWeekendFilter] = useState('');

  const filtered = weekendFilter ? entries.filter(e => e.weekendId === weekendFilter) : entries;
  const totalIncome  = filtered.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
  const totalExpense = filtered.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
  const net          = totalIncome - totalExpense;

  const sorted = [...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleAdd = (ev: React.FormEvent) => {
    ev.preventDefault();
    const parsed = parseFloat(amount);
    if (!name.trim() || isNaN(parsed) || parsed <= 0) return;
    const entry: AccountingEntry = {
      id: `acct-${Date.now()}`,
      name: name.trim(),
      description: desc.trim() || undefined,
      amount: parsed,
      type,
      payer: payer.trim() || undefined,
      payee: payee.trim() || undefined,
      date: new Date().toISOString(),
      weekendId: weekendId || undefined,
      weekendName: weekendName || undefined,
      receiptPhoto,
    };
    onSave([entry, ...entries]);
    setName(''); setDesc(''); setAmount(''); setPayer(''); setPayee('');
    setWeekendId(''); setWeekendName(''); setReceiptPhoto(undefined);
    setType('expense'); setShowForm(false);
  };

  const handleReceiptPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file, 800, 0.7);
    setReceiptPhoto(compressed);
    e.target.value = '';
  };

  const del = (id: string) => {
    if (!window.confirm('Delete this entry?')) return;
    onSave(entries.filter(e => e.id !== id));
  };

  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  return (
    <div className="flex flex-col gap-4">

      {/* Weekend filter */}
      <WeekendFilter weekends={weekends} value={weekendFilter} onChange={setWeekendFilter} />

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Income',   value: totalIncome,  color: 'text-green-400' },
          { label: 'Expenses', value: totalExpense,  color: 'text-red-400'  },
          { label: 'Net',      value: net,           color: net >= 0 ? 'text-green-400' : 'text-red-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-surface-container border border-outline-variant rounded-lg p-3 text-center">
            <p className="font-mono text-[10px] uppercase text-on-surface-variant tracking-wider mb-1">{label}</p>
            <p className={`font-mono text-sm font-bold ${color}`}>{fmt(value)}</p>
          </div>
        ))}
      </div>

      {/* Add button */}
      <button
        onClick={() => setShowForm(v => !v)}
        className="flex items-center justify-center gap-2 w-full py-2.5 bg-primary text-on-primary font-mono text-xs uppercase font-bold rounded-lg tracking-wider active:opacity-80"
      >
        <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
          {showForm ? 'expand_less' : 'add'}
        </span>
        {showForm ? 'Cancel' : 'Add Entry'}
      </button>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleAdd} className="bg-surface-container border border-outline-variant rounded-lg p-4 space-y-3">

          {/* Income / Expense toggle */}
          <div className="grid grid-cols-2 gap-2">
            {(['income', 'expense'] as const).map(t => (
              <button key={t} type="button" onClick={() => setType(t)}
                className={`py-2.5 rounded-lg border-2 font-mono text-xs uppercase font-bold transition-all ${
                  type === t
                    ? t === 'income' ? 'border-green-500 bg-green-500/10 text-green-400' : 'border-red-400 bg-red-400/10 text-red-400'
                    : 'border-outline-variant text-on-surface-variant'
                }`}
              >{t === 'income' ? '+ Income' : '− Expense'}</button>
            ))}
          </div>

          {/* Name + Amount */}
          <div className="flex gap-2">
            <input required placeholder="Name *" value={name} onChange={e => setName(e.target.value)}
              className="flex-1 p-2.5 bg-[#0e0e0e] border border-outline-variant focus:border-primary rounded font-mono text-sm outline-none" />
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-on-surface-variant text-sm">$</span>
              <input required type="number" min="0.01" step="0.01" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)}
                className="w-28 pl-6 pr-2 py-2.5 bg-[#0e0e0e] border border-outline-variant focus:border-primary rounded font-mono text-sm outline-none" />
            </div>
          </div>

          {/* Description */}
          <textarea placeholder="Description (optional)" rows={2} value={desc} onChange={e => setDesc(e.target.value)}
            className="w-full p-2.5 bg-[#0e0e0e] border border-outline-variant focus:border-primary rounded font-mono text-sm outline-none resize-none" />

          {/* Payer / Payee */}
          <div className="grid grid-cols-2 gap-2">
            <input placeholder={type === 'income' ? 'From (payer)' : 'Paid by (payer)'} value={payer} onChange={e => setPayer(e.target.value)}
              className="p-2.5 bg-[#0e0e0e] border border-outline-variant focus:border-primary rounded font-mono text-sm outline-none" />
            <input placeholder={type === 'income' ? 'To (payee)' : 'Paid to (payee)'} value={payee} onChange={e => setPayee(e.target.value)}
              className="p-2.5 bg-[#0e0e0e] border border-outline-variant focus:border-primary rounded font-mono text-sm outline-none" />
          </div>

          {/* Weekend link */}
          <WeekendPicker weekends={weekends} value={weekendId} onChange={(id, name) => { setWeekendId(id); setWeekendName(name); }} />

          {/* Receipt photo */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase text-on-surface-variant border border-outline-variant px-3 py-2 rounded cursor-pointer hover:border-primary hover:text-primary transition-colors">
              <span className="material-symbols-outlined text-[15px]">receipt_long</span>
              {receiptPhoto ? 'Change Receipt' : 'Attach Receipt'}
              <input type="file" accept="image/*" className="hidden" onChange={handleReceiptPhoto} />
            </label>
            {receiptPhoto && (
              <div className="relative">
                <img src={receiptPhoto} alt="receipt" className="h-12 rounded border border-outline-variant object-cover" />
                <button type="button" onClick={() => setReceiptPhoto(undefined)} className="absolute -top-1 -right-1 bg-black/70 rounded-full w-4 h-4 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[10px] text-white">close</span>
                </button>
              </div>
            )}
          </div>

          <button type="submit" className="w-full py-2.5 bg-primary text-on-primary font-mono text-xs uppercase font-bold rounded-lg tracking-wider active:opacity-80">
            Save Entry
          </button>
        </form>
      )}

      {/* Entries list */}
      {sorted.length === 0 ? (
        <div className="text-center py-10 text-on-surface-variant/40 font-mono text-xs">
          No entries yet. Add your first income or expense above.
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map(e => (
            <div
              key={e.id}
              className={`relative bg-surface-container border rounded-lg p-3 flex items-start gap-3 ${
                e.type === 'income' ? 'border-green-800/40' : 'border-red-900/40'
              }`}
            >
              {/* Color stripe */}
              <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg ${e.type === 'income' ? 'bg-green-500' : 'bg-red-500'}`} />

              <div className="flex-1 min-w-0 pl-1 space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm font-bold text-on-surface">{e.name}</span>
                  <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                    e.type === 'income' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
                  }`}>
                    {e.type === 'income' ? '+' : '−'}{fmt(e.amount)}
                  </span>
                  {e.weekendName && (
                    <span className="font-mono text-[9px] bg-primary/10 text-primary border border-primary/30 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-[10px]">calendar_today</span>
                      {e.weekendName}
                    </span>
                  )}
                </div>
                {e.description && <p className="font-mono text-xs text-on-surface-variant/70 italic">{e.description}</p>}
                {(e.payer || e.payee) && (
                  <p className="font-mono text-[10px] text-on-surface-variant/50">
                    {e.payer && <span>From: <span className="text-on-surface-variant">{e.payer}</span></span>}
                    {e.payer && e.payee && <span className="mx-1">·</span>}
                    {e.payee && <span>To: <span className="text-on-surface-variant">{e.payee}</span></span>}
                  </p>
                )}
                <p className="font-mono text-[10px] text-on-surface-variant/40">
                  {new Date(e.date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              {e.receiptPhoto && (
                <img src={e.receiptPhoto} alt="receipt" className="h-12 w-12 rounded border border-outline-variant object-cover shrink-0 cursor-pointer" onClick={() => window.open(e.receiptPhoto, '_blank')} title="View receipt" />
              )}

              <button
                onClick={() => del(e.id)}
                className="material-symbols-outlined text-[16px] text-on-surface-variant/30 hover:text-red-400 shrink-0"
              >
                close
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Shopping Tab ──────────────────────────────────────────────────────────────

function ShoppingTab({ items, onSave, weekends }: { items: ShoppingItem[]; onSave: (s: ShoppingItem[]) => void; weekends: RaceWeekend[] }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [cost, setCost] = useState('');
  const [showDesc, setShowDesc] = useState(false);
  const [weekendId, setWeekendId] = useState('');
  const [weekendName, setWeekendName] = useState('');
  const [weekendFilter, setWeekendFilter] = useState('');

  const filteredItems = weekendFilter ? items.filter(i => i.weekendId === weekendFilter) : items;
  const totalEstimated  = filteredItems.reduce((s, i) => s + (i.cost ?? 0), 0);
  const totalPending    = filteredItems.filter(i => !i.purchased).reduce((s, i) => s + (i.cost ?? 0), 0);
  const pendingCount    = filteredItems.filter(i => !i.purchased).length;

  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  const handleAdd = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!name.trim()) return;
    const item: ShoppingItem = {
      id: `shop-${Date.now()}`,
      name: name.trim(),
      description: desc.trim() || undefined,
      cost: cost ? parseFloat(cost) : undefined,
      purchased: false,
      weekendId: weekendId || undefined,
      weekendName: weekendName || undefined,
    };
    onSave([...items, item]);
    setName(''); setDesc(''); setCost(''); setShowDesc(false);
    setWeekendId(''); setWeekendName('');
  };

  const toggle = (id: string) => {
    onSave(items.map(i =>
      i.id === id
        ? { ...i, purchased: !i.purchased, purchasedAt: !i.purchased ? new Date().toISOString() : undefined }
        : i
    ));
  };

  const del = (id: string) => {
    onSave(items.filter(i => i.id !== id));
  };

  const open   = filteredItems.filter(i => !i.purchased);
  const bought = filteredItems.filter(i => i.purchased);

  return (
    <div className="flex flex-col gap-4">

      {/* Weekend filter */}
      <WeekendFilter weekends={weekends} value={weekendFilter} onChange={setWeekendFilter} />

      {/* Summary */}
      {filteredItems.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Items Left', value: pendingCount.toString(), color: 'text-primary' },
            { label: 'Est. Remaining', value: fmt(totalPending), color: 'text-amber-400' },
            { label: 'Est. Total', value: fmt(totalEstimated), color: 'text-on-surface-variant' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-surface-container border border-outline-variant rounded-lg p-3 text-center">
              <p className="font-mono text-[10px] uppercase text-on-surface-variant tracking-wider mb-1">{label}</p>
              <p className={`font-mono text-sm font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      <form onSubmit={handleAdd} className="bg-surface-container border border-outline-variant rounded-lg p-3 space-y-2">
        <div className="flex gap-2">
          <input
            required
            placeholder="Item name *"
            value={name}
            onChange={e => setName(e.target.value)}
            className="flex-1 p-2.5 bg-[#0e0e0e] border border-outline-variant focus:border-primary rounded font-mono text-sm outline-none"
          />
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-on-surface-variant text-sm">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Cost"
              value={cost}
              onChange={e => setCost(e.target.value)}
              className="w-24 pl-6 pr-2 py-2.5 bg-[#0e0e0e] border border-outline-variant focus:border-primary rounded font-mono text-sm outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowDesc(v => !v)}
            className={`p-2.5 rounded border transition-colors shrink-0 ${showDesc ? 'bg-primary/10 border-primary text-primary' : 'border-outline-variant text-on-surface-variant'}`}
            title="Add notes"
          >
            <span className="material-symbols-outlined text-[18px]">sticky_note_2</span>
          </button>
          <button type="submit" className="bg-primary text-on-primary px-4 font-bold rounded text-xl leading-none shrink-0">+</button>
        </div>
        {showDesc && (
          <textarea
            placeholder="Notes (optional)"
            rows={2}
            value={desc}
            onChange={e => setDesc(e.target.value)}
            className="w-full p-2.5 bg-[#0e0e0e] border border-outline-variant focus:border-primary rounded font-mono text-sm outline-none resize-none"
          />
        )}
        <WeekendPicker weekends={weekends} value={weekendId} onChange={(id, name) => { setWeekendId(id); setWeekendName(name); }} />
      </form>

      {/* Items */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-10 text-on-surface-variant/40 font-mono text-xs">
          {weekendFilter ? 'No items for this weekend.' : 'List is empty. Add items above.'}
        </div>
      ) : (
        <div className="space-y-2">

          {/* Pending */}
          {open.map(item => (
            <div key={item.id} className="flex items-start gap-3 p-3 bg-surface-container border border-outline-variant rounded-lg">
              <input type="checkbox" checked={false} onChange={() => toggle(item.id)} className="w-5 h-5 accent-primary cursor-pointer shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm text-on-surface">{item.name}</span>
                  {item.cost != null && <span className="font-mono text-[10px] font-bold bg-amber-400/10 text-amber-400 px-1.5 py-0.5 rounded">{fmt(item.cost)}</span>}
                  {item.weekendName && (
                    <span className="font-mono text-[9px] bg-primary/10 text-primary border border-primary/30 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-[10px]">calendar_today</span>
                      {item.weekendName}
                    </span>
                  )}
                </div>
                {item.description && <p className="font-mono text-xs text-on-surface-variant/60 italic">{item.description}</p>}
              </div>
              <button onClick={() => del(item.id)} className="material-symbols-outlined text-[16px] text-on-surface-variant/30 hover:text-red-400 shrink-0">close</button>
            </div>
          ))}

          {/* Divider */}
          {open.length > 0 && bought.length > 0 && (
            <div className="flex items-center gap-2 py-1">
              <div className="flex-1 border-t border-outline-variant/30" />
              <span className="font-mono text-[10px] text-on-surface-variant/50 uppercase tracking-wider whitespace-nowrap">{bought.length} Purchased</span>
              <div className="flex-1 border-t border-outline-variant/30" />
            </div>
          )}

          {/* Purchased */}
          {bought.map(item => (
            <div key={item.id} className="flex items-start gap-3 p-3 bg-[#0e0e0e]/40 border border-outline-variant/20 rounded-lg">
              <input
                type="checkbox"
                checked={true}
                onChange={() => toggle(item.id)}
                className="w-5 h-5 accent-primary cursor-pointer shrink-0 mt-0.5"
              />
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm text-on-surface-variant/40 line-through">{item.name}</span>
                  {item.cost != null && (
                    <span className="font-mono text-[10px] text-on-surface-variant/25 line-through">{fmt(item.cost)}</span>
                  )}
                </div>
                {item.description && (
                  <p className="font-mono text-xs text-on-surface-variant/30 italic line-through">{item.description}</p>
                )}
                {item.purchasedAt && (
                  <p className="font-mono text-[10px] text-on-surface-variant/30">
                    Got it {new Date(item.purchasedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </p>
                )}
              </div>
              <button onClick={() => del(item.id)} className="material-symbols-outlined text-[16px] text-on-surface-variant/20 hover:text-red-400 shrink-0">close</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── TrackersView ──────────────────────────────────────────────────────────────

type SubTab = 'tasks' | 'accounting' | 'shopping';

const SUB_TABS: { id: SubTab; label: string; icon: string }[] = [
  { id: 'tasks',      label: 'Tasks',      icon: 'checklist'        },
  { id: 'accounting', label: 'Accounting', icon: 'account_balance'  },
  { id: 'shopping',   label: 'Shopping',   icon: 'shopping_cart'    },
];

export default function TrackersView({
  todos, onSaveTodos, teamMembers, currentUserId,
  weekends = [],
  accounting, onSaveAccounting,
  shopping, onSaveShopping,
}: TrackersViewProps) {
  const [subTab, setSubTab] = useState<SubTab>('tasks');

  return (
    <div className="flex flex-col gap-4 h-full">

      {/* Sub-tab bar */}
      <div className="flex bg-surface rounded-lg p-0.5 border border-outline-variant/30 text-xs font-mono uppercase tracking-wider">
        {SUB_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-md transition-all ${
              subTab === t.id ? 'bg-primary/10 text-primary font-bold' : 'text-on-surface-variant/60 hover:text-on-surface'
            }`}
          >
            <span
              className="material-symbols-outlined text-[15px]"
              style={{ fontVariationSettings: subTab === t.id ? "'FILL' 1" : "'FILL' 0" }}
            >
              {t.icon}
            </span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {subTab === 'tasks' && (
          <ToDoView
            todos={todos}
            onSaveTodos={onSaveTodos}
            teamMembers={teamMembers}
            currentUserId={currentUserId}
          />
        )}
        {subTab === 'accounting' && (
          <AccountingTab entries={accounting} onSave={onSaveAccounting} weekends={weekends} />
        )}
        {subTab === 'shopping' && (
          <ShoppingTab items={shopping} onSave={onSaveShopping} weekends={weekends} />
        )}
      </div>
    </div>
  );
}
