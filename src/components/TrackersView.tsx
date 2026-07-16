import React, { useEffect, useRef, useState } from 'react';
import { Todo, AccountingEntry, RaceWeekend, MaintenanceComponent, MaintenanceLog, Setup, MaintenanceCategory, MAINTENANCE_CATEGORIES, MaintenanceIntervalType, ChecklistTemplate, CHECKLIST_CATEGORIES } from '../types';
import { AppUser } from '../lib/supabase';
import { getComponentStatus, applyServiceLog, DEFAULT_COMPONENTS } from '../lib/maintenance';
import { STARTER_TEMPLATES, isUntouchedStarterTemplate, materializeStarterTemplate } from '../lib/checklists';
import ToDoView from './ToDoView';
import EmptyState from './ui/EmptyState';
import { lastAccountingCategory, localDateValue, recentAccountingRepeats } from '../lib/accountingDefaults';
import { clearAccountingDraft, readAccountingDraft, writeAccountingDraft } from '../lib/accountingDraft';

// ── Sub-tab type (declared early; used in Props and component) ───────────────

type SubTab = 'checklist' | 'service' | 'templates' | 'accounting';

// ── Props ────────────────────────────────────────────────────────────────────

interface TrackersViewProps {
  todos: Todo[];
  onSaveTodos: (t: Todo[]) => void;
  weekends?: RaceWeekend[];
  teamMembers?: AppUser[];
  currentUserId?: string | null;
  accounting: AccountingEntry[];
  onSaveAccounting: (a: AccountingEntry[]) => void;
  maintenance: MaintenanceComponent[];
  onSaveMaintenance: (c: MaintenanceComponent[]) => void;
  onDeleteMaintenance: (id: string) => void;
  maintenanceLogs: MaintenanceLog[];
  onSaveMaintenanceLogs: (l: MaintenanceLog[]) => void;
  savedSetups: Setup[];
  activeCarId: string | null;
  checklistTemplates: ChecklistTemplate[];
  starterTemplatesReady: boolean;
  onSaveChecklistTemplates: (t: ChecklistTemplate[]) => void;
  onDeleteChecklistTemplate: (id: string) => void;
  initialSubTab?: SubTab;
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
        className="flex-1 p-2 bg-surface-container border border-outline-variant/50 focus:border-primary text-xs font-mono rounded outline-none"
      >
        <option value="">No Race Day (general)</option>
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
          <option value="">All Race Days</option>
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
  const [restoredDraft] = useState(() => readAccountingDraft());
  const [showForm, setShowForm] = useState(() => restoredDraft !== null);
  const [name, setName] = useState(() => restoredDraft?.name ?? '');
  const [desc, setDesc] = useState(() => restoredDraft?.desc ?? '');
  const [amount, setAmount] = useState(() => restoredDraft?.amount ?? '');
  const [type, setType] = useState<'income' | 'expense'>(() => restoredDraft?.type ?? 'expense');
  const [payer, setPayer] = useState(() => restoredDraft?.payer ?? '');
  const [payee, setPayee] = useState(() => restoredDraft?.payee ?? '');
  const [weekendId, setWeekendId] = useState(() => restoredDraft?.weekendId ?? '');
  const [weekendName, setWeekendName] = useState(() => restoredDraft?.weekendName ?? '');
  const [receiptPhoto, setReceiptPhoto] = useState<string | undefined>(() => restoredDraft?.receiptPhoto || undefined);
  const [weekendFilter, setWeekendFilter] = useState('');
  const [category, setCategory] = useState(() => restoredDraft?.category ?? lastAccountingCategory(entries));
  const [entryDate, setEntryDate] = useState(() => restoredDraft?.entryDate ?? localDateValue());
  const receiptRequestGenerationRef = useRef(0);

  const filtered = weekendFilter ? entries.filter(e => e.weekendId === weekendFilter) : entries;
  const totalIncome  = filtered.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
  const totalExpense = filtered.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
  const net          = totalIncome - totalExpense;

  const sorted = [...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const recentRepeats = recentAccountingRepeats(entries);

  const invalidateReceiptWork = () => {
    receiptRequestGenerationRef.current += 1;
  };

  const resetForm = () => {
    invalidateReceiptWork();
    setName(''); setDesc(''); setAmount(''); setPayer(''); setPayee('');
    setWeekendId(''); setWeekendName(''); setReceiptPhoto(undefined);
    setType('expense'); setCategory(lastAccountingCategory(entries)); setEntryDate(localDateValue());
  };

  const openForm = () => {
    setCategory(lastAccountingCategory(entries));
    setEntryDate(localDateValue());
    setShowForm(true);
  };

  const cancelForm = () => {
    clearAccountingDraft();
    resetForm();
    setShowForm(false);
  };

  useEffect(() => () => {
    invalidateReceiptWork();
  }, []);

  useEffect(() => {
    if (!showForm) return;
    writeAccountingDraft({
      name, desc, amount, type, payer, payee, weekendId, weekendName,
      receiptPhoto: receiptPhoto ?? '', category, entryDate,
    });
  }, [showForm, name, desc, amount, type, payer, payee, weekendId, weekendName, receiptPhoto, category, entryDate]);

  const handleAdd = (ev: React.FormEvent) => {
    ev.preventDefault();
    const parsed = parseFloat(amount);
    if (!name.trim() || !entryDate || isNaN(parsed) || parsed <= 0) return;
    const entry: AccountingEntry = {
      id: `acct-${Date.now()}`,
      name: name.trim(),
      description: desc.trim() || undefined,
      category: category.trim() || 'Other',
      amount: parsed,
      type,
      payer: payer.trim() || undefined,
      payee: payee.trim() || undefined,
      date: `${entryDate}T12:00:00.000Z`,
      weekendId: weekendId || undefined,
      weekendName: weekendName || undefined,
      receiptPhoto,
    };
    onSave([entry, ...entries]);
    clearAccountingDraft();
    resetForm();
    setShowForm(false);
  };

  const handleReceiptPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const requestGeneration = ++receiptRequestGenerationRef.current;
    try {
      const compressed = await compressImage(file, 800, 0.7);
      if (receiptRequestGenerationRef.current === requestGeneration) {
        setReceiptPhoto(compressed);
      }
    } catch {
      // Receipt photos are optional; failed or stale compression must not break the draft.
    }
  };

  const removeReceiptPhoto = () => {
    invalidateReceiptWork();
    setReceiptPhoto(undefined);
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
          { label: 'Income',   value: totalIncome,  color: 'text-success' },
          { label: 'Expenses', value: totalExpense,  color: 'text-error'  },
          { label: 'Net',      value: net,           color: net >= 0 ? 'text-success' : 'text-error' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-surface-container border border-outline-variant rounded-lg p-3 text-center">
            <p className="font-mono text-[10px] uppercase text-on-surface-variant tracking-wider mb-1">{label}</p>
            <p className={`font-mono text-sm font-bold ${color}`}>{fmt(value)}</p>
          </div>
        ))}
      </div>

      {/* Add button */}
      <button
        onClick={showForm ? cancelForm : openForm}
        className="flex items-center justify-center gap-2 w-full py-2.5 bg-primary text-on-primary font-mono text-xs uppercase font-bold rounded-lg tracking-wider active:opacity-80"
      >
        <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
          {showForm ? 'expand_less' : 'add'}
        </span>
        {showForm ? 'Cancel' : 'Log Money'}
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
                    ? t === 'income' ? 'border-success bg-success/10 text-success' : 'border-error bg-error/10 text-error'
                    : 'border-outline-variant text-on-surface-variant'
                }`}
              >{t === 'income' ? '+ Income' : '− Expense'}</button>
            ))}
          </div>

          {recentRepeats.length > 0 && (
            <div>
              <p className="font-mono text-[10px] uppercase text-on-surface-variant mb-1.5">Repeat a recent charge</p>
              <div className="flex flex-wrap gap-2">
                {recentRepeats.map(repeat => (
                  <button key={`${repeat.description}:${repeat.category}`} type="button"
                    onClick={() => { setDesc(repeat.description); setCategory(repeat.category); }}
                    className="min-h-11 px-3 rounded-full border border-outline-variant font-mono text-[10px] text-on-surface-variant hover:border-primary hover:text-primary"
                  >{repeat.description} · {repeat.category}</button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-mono text-[10px] uppercase text-on-surface-variant mb-1">Category</label>
              <input value={category} onChange={event => setCategory(event.target.value)} placeholder="Other"
                className="w-full p-2.5 bg-surface-container border border-outline-variant focus:border-primary rounded font-mono text-sm outline-none" />
            </div>
            <div>
              <label className="block font-mono text-[10px] uppercase text-on-surface-variant mb-1">Date</label>
              <input required type="date" value={entryDate} onChange={event => setEntryDate(event.target.value)}
                className="w-full p-2.5 bg-surface-container border border-outline-variant focus:border-primary rounded font-mono text-sm outline-none" />
            </div>
          </div>

          {/* Name + Amount */}
          <div className="flex gap-2">
            <input required placeholder="Name *" value={name} onChange={e => setName(e.target.value)}
              className="flex-1 p-2.5 bg-surface-container border border-outline-variant focus:border-primary rounded font-mono text-sm outline-none" />
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-on-surface-variant text-sm">$</span>
              <input required type="number" min="0.01" step="0.01" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)}
                className="w-28 pl-6 pr-2 py-2.5 bg-surface-container border border-outline-variant focus:border-primary rounded font-mono text-sm outline-none" />
            </div>
          </div>

          {/* Description */}
          <textarea placeholder="Description (optional)" rows={2} value={desc} onChange={e => setDesc(e.target.value)}
            className="w-full p-2.5 bg-surface-container border border-outline-variant focus:border-primary rounded font-mono text-sm outline-none resize-none" />

          {/* Payer / Payee */}
          <div className="grid grid-cols-2 gap-2">
            <input placeholder={type === 'income' ? 'From (payer)' : 'Paid by (payer)'} value={payer} onChange={e => setPayer(e.target.value)}
              className="p-2.5 bg-surface-container border border-outline-variant focus:border-primary rounded font-mono text-sm outline-none" />
            <input placeholder={type === 'income' ? 'To (payee)' : 'Paid to (payee)'} value={payee} onChange={e => setPayee(e.target.value)}
              className="p-2.5 bg-surface-container border border-outline-variant focus:border-primary rounded font-mono text-sm outline-none" />
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
                <button type="button" onClick={removeReceiptPhoto} className="absolute -top-1 -right-1 bg-black/70 rounded-full w-4 h-4 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[10px] text-white">close</span>
                </button>
              </div>
            )}
          </div>

          <button type="submit" className="w-full py-2.5 bg-primary text-on-primary font-mono text-xs uppercase font-bold rounded-lg tracking-wider active:opacity-80">
            Save to Accounting
          </button>
        </form>
      )}

      {/* Entries list */}
      {sorted.length === 0 ? (
        <EmptyState
          icon="account_balance"
          title="No money logged yet"
          body="Track race-night income and expenses from one ledger."
          cta={{ label: 'Log first charge', onClick: openForm }}
        />
      ) : (
        <div className="space-y-2">
          {sorted.map(e => (
            <div
              key={e.id}
              className={`relative bg-surface-container border rounded-lg p-3 flex items-start gap-3 ${
                e.type === 'income' ? 'border-success/40' : 'border-error/40'
              }`}
            >
              {/* Color stripe */}
              <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg ${e.type === 'income' ? 'bg-success' : 'bg-error'}`} />

              <div className="flex-1 min-w-0 pl-1 space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm font-bold text-on-surface">{e.name}</span>
                  {e.category && <span className="font-mono text-[9px] text-on-surface-variant border border-outline-variant px-1.5 py-0.5 rounded">{e.category}</span>}
                  <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                    e.type === 'income' ? 'bg-success/15 text-success' : 'bg-error/15 text-error'
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
                className="material-symbols-outlined text-[16px] text-on-surface-variant/30 hover:text-error shrink-0"
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


// ── Service Tab ──────────────────────────────────────────────────────────────

function ServiceTab({
  components, logs, onSaveComponents, onSaveLogs,
  onDeleteComponent,
  weekends, savedSetups, activeCarId,
  accounting, onSaveAccounting,
}: {
  components: MaintenanceComponent[];
  logs: MaintenanceLog[];
  onSaveComponents: (c: MaintenanceComponent[]) => void;
  onSaveLogs: (l: MaintenanceLog[]) => void;
  onDeleteComponent: (id: string) => void;
  weekends: RaceWeekend[];
  savedSetups: Setup[];
  activeCarId: string | null;
  accounting: AccountingEntry[];
  onSaveAccounting: (a: AccountingEntry[]) => void;
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [logModalComp, setLogModalComp] = useState<MaintenanceComponent | null>(null);

  // Add form state
  const [addName, setAddName] = useState('');
  const [addCategory, setAddCategory] = useState<MaintenanceCategory>('Other');
  const [addScope, setAddScope] = useState<'car' | 'rig'>('car');
  const [addIntervalType, setAddIntervalType] = useState<MaintenanceIntervalType>('races');
  const [addIntervalValue, setAddIntervalValue] = useState('');
  const [addStartingUsage, setAddStartingUsage] = useState('');

  // Log modal state
  const [logDate, setLogDate] = useState('');
  const [logType, setLogType] = useState<MaintenanceLog['type']>('service');
  const [logNotes, setLogNotes] = useState('');
  const [logCost, setLogCost] = useState('');

  const uid = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const carComps = components.filter(c => c.scope === 'car' && (!activeCarId || c.carId === activeCarId));
  const rigComps = components.filter(c => c.scope === 'rig');

  const addDefaults = () => {
    const now = new Date().toISOString();
    const newComps: MaintenanceComponent[] = DEFAULT_COMPONENTS.map(d => ({
      id: uid('maint'),
      scope: d.scope,
      carId: d.scope === 'car' ? (activeCarId ?? undefined) : undefined,
      name: d.name,
      category: d.category,
      intervalType: d.intervalType,
      intervalValue: d.intervalValue,
      startingUsage: 0,
      lastServicedAt: now,
      createdAt: now,
      updatedAt: now,
    }));
    onSaveComponents([...components, ...newComps]);
  };

  const deleteComp = (id: string) => {
    if (!window.confirm('Delete this item and all its maintenance logs?')) return;
    onDeleteComponent(id);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim() || !addIntervalValue) return;
    const startingUsage = addStartingUsage.trim() === '' ? 0 : Number(addStartingUsage);
    if (!Number.isFinite(startingUsage) || !Number.isInteger(startingUsage) || startingUsage < 0) return;
    const now = new Date().toISOString();
    const comp: MaintenanceComponent = {
      id: uid('maint'),
      scope: addScope,
      carId: addScope === 'car' ? (activeCarId ?? undefined) : undefined,
      name: addName.trim(),
      category: addCategory,
      intervalType: addIntervalType,
      intervalValue: parseFloat(addIntervalValue),
      startingUsage,
      lastServicedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    onSaveComponents([...components, comp]);
    setAddName(''); setAddCategory('Other'); setAddScope('car');
    setAddIntervalType('races'); setAddIntervalValue(''); setAddStartingUsage('');
    setShowAddForm(false);
  };

  const openLogModal = (c: MaintenanceComponent) => {
    setLogDate(localDateValue());
    setLogType('service'); setLogNotes(''); setLogCost('');
    setLogModalComp(c);
  };

  const handleLogSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!logModalComp) return;
    const now = new Date().toISOString();
    const log: MaintenanceLog = {
      id: uid('mlog'),
      componentId: logModalComp.id,
      date: logDate || now.slice(0, 10),
      type: logType,
      notes: logNotes.trim() || undefined,
      cost: logCost ? parseFloat(logCost) : undefined,
    };
    const updated = { ...applyServiceLog(logModalComp, log), updatedAt: now };
    onSaveComponents(components.map(c => c.id === logModalComp.id ? updated : c));
    onSaveLogs([log, ...logs]);
    if (log.cost && log.cost > 0) {
      const entry: AccountingEntry = {
        id: uid('acct'),
        name: logModalComp.name,
        description: log.notes,
        category: 'Maintenance',
        amount: log.cost,
        type: 'expense',
        date: now,
      };
      onSaveAccounting([entry, ...accounting]);
    }
    setLogModalComp(null);
  };

  const unitLabel = (c: MaintenanceComponent): string =>
    ({ races: 'races', days: 'days' }[c.intervalType]);

  const renderRow = (c: MaintenanceComponent) => {
    const status = getComponentStatus(c, weekends, savedSetups);
    const remaining = Math.max(0, status.limit - status.used);
    const barColor = status.state === 'overdue' ? 'bg-error' : status.state === 'due' ? 'bg-warning' : 'bg-success';
    const chipCls = {
      ok:      'bg-success/15 text-success border-success/30',
      due:     'bg-warning/15 text-warning border-warning/30',
      overdue: 'bg-error/15 text-error border-error/30',
    }[status.state];
    const chipLabel = { ok: 'OK', due: 'DUE', overdue: 'OVERDUE' }[status.state];
    return (
      <div key={c.id} className="flex items-center gap-3 p-3 bg-surface-container border border-outline-variant rounded-lg">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm text-on-surface font-semibold">{c.name}</span>
            <span className={`font-mono text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${chipCls}`}>{chipLabel}</span>
            <span className="font-mono text-[10px] text-on-surface-variant/50">{c.category}</span>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex-1 h-1.5 bg-surface-variant rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${barColor}`}
                style={{ width: `${Math.min(status.pct * 100, 100)}%` }} />
            </div>
            <span className="font-mono text-[10px] text-on-surface-variant shrink-0">
              {status.used}/{status.limit} {unitLabel(c)}
            </span>
          </div>
          <p className="font-mono text-[10px] text-on-surface-variant mt-1">
            Used {status.used} · Limit {status.limit} · Remaining {remaining} {unitLabel(c)}
          </p>
        </div>
        <button
          onClick={() => openLogModal(c)}
          className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded border border-primary/40 bg-primary/10 text-primary font-mono text-[10px] uppercase font-bold hover:bg-primary/20 transition-colors"
        >
          <span className="material-symbols-outlined text-[13px]">build</span>
          Log
        </button>
        <button
          onClick={() => deleteComp(c.id)}
          className="material-symbols-outlined text-[16px] text-on-surface-variant/30 hover:text-error shrink-0"
        >close</button>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setShowAddForm(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary font-mono text-[11px] uppercase font-bold transition-colors"
        >
          <span className="material-symbols-outlined text-[15px]">{showAddForm ? 'close' : 'add'}</span>
          {showAddForm ? 'Cancel' : 'Add Maintenance Job'}
        </button>
        {components.length === 0 && !showAddForm && (
          <button
            onClick={addDefaults}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 border border-primary/40 text-primary font-mono text-[11px] uppercase font-bold hover:bg-primary/20 transition-colors"
          >
            <span className="material-symbols-outlined text-[15px]">auto_awesome</span>
            Add Defaults
          </button>
        )}
      </div>

      {/* Add component form */}
      {showAddForm && (
        <form onSubmit={handleAddSubmit} className="bg-surface-container border border-outline-variant rounded-lg p-4 space-y-3">
          <input required placeholder="Maintenance item name *" value={addName} onChange={e => setAddName(e.target.value)}
            className="w-full p-2.5 bg-surface-container border border-outline-variant focus:border-primary rounded font-mono text-sm outline-none" />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-mono text-[10px] uppercase text-on-surface-variant mb-1">Category</label>
              <select value={addCategory} onChange={e => setAddCategory(e.target.value as MaintenanceCategory)}
                className="w-full p-2.5 bg-surface-container border border-outline-variant focus:border-primary rounded font-mono text-xs outline-none">
                {(MAINTENANCE_CATEGORIES as readonly string[]).map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-mono text-[10px] uppercase text-on-surface-variant mb-1">Scope</label>
              <select value={addScope} onChange={e => setAddScope(e.target.value as 'car' | 'rig')}
                className="w-full p-2.5 bg-surface-container border border-outline-variant focus:border-primary rounded font-mono text-xs outline-none">
                <option value="car">Car</option>
                <option value="rig">Rig (truck/trailer)</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-mono text-[10px] uppercase text-on-surface-variant mb-1">Measure by</label>
              <select value={addIntervalType} onChange={e => setAddIntervalType(e.target.value as MaintenanceIntervalType)}
                className="w-full p-2.5 bg-surface-container border border-outline-variant focus:border-primary rounded font-mono text-xs outline-none">
                <option value="races">Races</option>
                <option value="days">Days</option>
              </select>
            </div>
            <div>
              <label className="block font-mono text-[10px] uppercase text-on-surface-variant mb-1">Interval</label>
              <input required type="number" min="1" step="any" placeholder="e.g. 250" value={addIntervalValue} onChange={e => setAddIntervalValue(e.target.value)}
                className="w-full p-2.5 bg-surface-container border border-outline-variant focus:border-primary rounded font-mono text-sm outline-none" />
            </div>
          </div>
          <div>
            <label className="block font-mono text-[10px] uppercase text-on-surface-variant mb-1">
              {addIntervalType === 'races' ? 'Races already run' : 'Days already in service'} <span className="normal-case opacity-60">(optional)</span>
            </label>
            <input type="number" min="0" step="1" placeholder="0" value={addStartingUsage} onChange={e => setAddStartingUsage(e.target.value)}
              className="w-full p-2.5 bg-surface-container border border-outline-variant focus:border-primary rounded font-mono text-sm outline-none" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="flex-1 py-2.5 bg-primary text-on-primary font-mono text-xs uppercase font-bold rounded-lg tracking-wider active:opacity-80">Add Maintenance Job</button>
            <button type="button" onClick={() => setShowAddForm(false)} className="px-4 py-2.5 border border-outline-variant rounded-lg font-mono text-xs text-on-surface-variant">Cancel</button>
          </div>
        </form>
      )}

      {/* Empty state */}
      {components.length === 0 && !showAddForm && (
        <EmptyState
          icon="build_circle"
          title="No maintenance jobs yet"
          body="Add common race-car maintenance limits or build your own job."
          cta={{ label: 'Add common jobs', onClick: addDefaults }}
          secondaryCta={{ label: 'Create maintenance job', onClick: () => setShowAddForm(true) }}
        />
      )}

      {/* Car section */}
      {carComps.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 pt-1">
            <span className="material-symbols-outlined text-primary text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>directions_car</span>
            <span className="font-mono text-[11px] uppercase text-on-surface-variant tracking-wider font-bold">Car</span>
          </div>
          {carComps.map(renderRow)}
        </div>
      )}

      {/* Rig section */}
      {rigComps.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 pt-1">
            <span className="material-symbols-outlined text-primary text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>local_shipping</span>
            <span className="font-mono text-[11px] uppercase text-on-surface-variant tracking-wider font-bold">Rig</span>
          </div>
          {rigComps.map(renderRow)}
        </div>
      )}

      {/* Log service modal */}
      {logModalComp && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setLogModalComp(null)}>
          <form onSubmit={handleLogSubmit} onClick={e => e.stopPropagation()}
            className="w-full max-w-md bg-surface-container-high border border-outline-variant rounded-2xl p-6 space-y-4 shadow-2xl mb-2">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-base text-on-surface">Log Maintenance</h3>
              <button type="button" onClick={() => setLogModalComp(null)}
                className="material-symbols-outlined text-on-surface-variant text-[22px]">close</button>
            </div>
            <p className="font-mono text-xs text-on-surface-variant">{logModalComp.name} · {logModalComp.category}</p>
            <div className="grid grid-cols-3 gap-2">
              {(['service', 'replace', 'inspect'] as const).map(t => (
                <button key={t} type="button" onClick={() => setLogType(t)}
                  className={`py-2 rounded-lg border font-mono text-[10px] uppercase font-bold transition-all capitalize ${logType === t ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant text-on-surface-variant'}`}>
                  {t === 'service' ? 'maintenance' : t}
                </button>
              ))}
            </div>
            <div>
              <label className="block font-mono text-[10px] uppercase text-on-surface-variant mb-1">Date</label>
              <input type="date" value={logDate} onChange={e => setLogDate(e.target.value)}
                className="w-full p-2.5 bg-surface-container border border-outline-variant focus:border-primary rounded font-mono text-sm outline-none" />
            </div>
            <textarea placeholder="Notes (optional)" rows={2} value={logNotes} onChange={e => setLogNotes(e.target.value)}
              className="w-full p-2.5 bg-surface-container border border-outline-variant focus:border-primary rounded font-mono text-sm outline-none resize-none" />
            <div>
              <label className="block font-mono text-[10px] uppercase text-on-surface-variant mb-1">Cost (optional — auto-adds to Accounting)</label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-on-surface-variant text-sm">$</span>
                <input type="number" min="0" step="0.01" placeholder="0.00" value={logCost} onChange={e => setLogCost(e.target.value)}
                  className="w-full pl-6 pr-3 py-2.5 bg-surface-container border border-outline-variant focus:border-primary rounded font-mono text-sm outline-none" />
              </div>
            </div>
            <button type="submit" className="w-full py-3 bg-primary text-on-primary font-mono text-xs uppercase font-bold rounded-xl tracking-wider active:opacity-80">
              Save Maintenance &amp; Reset Counter
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// ── Templates Tab ────────────────────────────────────────────────────────────

function TemplatesTab({
  templates, starterTemplatesReady, onSaveTemplates, onDeleteTemplate,
}: {
  templates: ChecklistTemplate[];
  starterTemplatesReady: boolean;
  onSaveTemplates: (t: ChecklistTemplate[]) => void;
  onDeleteTemplate: (id: string) => void;
}) {
  const uid = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState('');
  const [addCategory, setAddCategory] = useState<string>('Custom');
  const [newItemText, setNewItemText] = useState<Record<string, string>>({});

  const addStarterTemplates = () => {
    if (!starterTemplatesReady) return;
    const materialized = STARTER_TEMPLATES
      .filter(starter => !templates.some(template => isUntouchedStarterTemplate(template)
        && template.name === starter.name && template.category === starter.category))
      .map(starter => materializeStarterTemplate(starter));
    if (materialized.length > 0) onSaveTemplates([...templates, ...materialized]);
  };

  const handleAddTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim()) return;
    const now = new Date().toISOString();
    const tmpl: ChecklistTemplate = {
      id: uid('tmpl'),
      name: addName.trim(),
      category: addCategory,
      items: [],
      updatedAt: now,
    };
    onSaveTemplates([...templates, tmpl]);
    setExpandedId(tmpl.id);
    setAddName(''); setAddCategory('Custom'); setShowAddForm(false);
  };

  const deleteTemplate = (id: string) => {
    if (!window.confirm('Delete this template?')) return;
    onDeleteTemplate(id);
    if (expandedId === id) setExpandedId(null);
  };

  const addItem = (templateId: string) => {
    const text = (newItemText[templateId] || '').trim();
    if (!text) return;
    onSaveTemplates(templates.map(t => t.id !== templateId ? t : {
      ...t,
      updatedAt: new Date().toISOString(),
      items: [...t.items, { id: uid('tmpli'), text }],
    }));
    setNewItemText(prev => ({ ...prev, [templateId]: '' }));
  };

  const removeItem = (templateId: string, itemId: string) => {
    onSaveTemplates(templates.map(t => t.id !== templateId ? t : {
      ...t,
      updatedAt: new Date().toISOString(),
      items: t.items.filter(i => i.id !== itemId),
    }));
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setShowAddForm(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary font-mono text-[11px] uppercase font-bold transition-colors"
        >
          <span className="material-symbols-outlined text-[15px]">{showAddForm ? 'close' : 'add'}</span>
          {showAddForm ? 'Cancel' : 'New Template'}
        </button>
        {templates.length === 0 && !showAddForm && starterTemplatesReady && (
          <button
            onClick={addStarterTemplates}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 border border-primary/40 text-primary font-mono text-[11px] uppercase font-bold hover:bg-primary/20 transition-colors"
          >
            <span className="material-symbols-outlined text-[15px]">auto_awesome</span>
            Use Starters
          </button>
        )}
      </div>

      {/* Add template form */}
      {showAddForm && (
        <form onSubmit={handleAddTemplate} className="bg-surface-container border border-outline-variant rounded-lg p-4 space-y-3">
          <input required placeholder="Template name *" value={addName} onChange={e => setAddName(e.target.value)}
            className="w-full p-2.5 bg-surface-container border border-outline-variant focus:border-primary rounded font-mono text-sm outline-none" />
          <div>
            <label className="block font-mono text-[10px] uppercase text-on-surface-variant mb-1">Category</label>
            <select value={addCategory} onChange={e => setAddCategory(e.target.value)}
              className="w-full p-2.5 bg-surface-container border border-outline-variant focus:border-primary rounded font-mono text-xs outline-none">
              {(CHECKLIST_CATEGORIES as readonly string[]).map(c => <option key={c} value={c}>{c}</option>)}
              <option value="Custom">Custom</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="flex-1 py-2.5 bg-primary text-on-primary font-mono text-xs uppercase font-bold rounded-lg tracking-wider active:opacity-80">Create Template</button>
            <button type="button" onClick={() => setShowAddForm(false)} className="px-4 py-2.5 border border-outline-variant rounded-lg font-mono text-xs text-on-surface-variant">Cancel</button>
          </div>
        </form>
      )}

      {/* Empty state */}
      {templates.length === 0 && !showAddForm && (
        <EmptyState
          icon="fact_check"
          title="No checklist templates yet"
          body={starterTemplatesReady ? 'Load race-ready starters or build your own checklist.' : 'Finishing initial template sync before starter lists are available.'}
          cta={starterTemplatesReady ? { label: 'Add starter templates', onClick: addStarterTemplates } : undefined}
          secondaryCta={{ label: 'Create template', onClick: () => setShowAddForm(true) }}
        />
      )}

      {/* Template list */}
      <div className="space-y-2">
        {templates.map(tmpl => {
          const isExpanded = expandedId === tmpl.id;
          return (
            <div key={tmpl.id} className="bg-surface-container border border-outline-variant rounded-lg overflow-hidden">
              <button
                onClick={() => setExpandedId(isExpanded ? null : tmpl.id)}
                className="w-full flex items-center gap-3 px-3 py-3 hover:bg-surface-container-high transition-colors text-left"
              >
                <span className="material-symbols-outlined text-primary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>fact_check</span>
                <div className="flex-1 min-w-0">
                  <span className="font-mono text-sm font-semibold text-on-surface block truncate">{tmpl.name}</span>
                  <span className="font-mono text-[10px] text-on-surface-variant/50">{tmpl.category} · {tmpl.items.length} jobs</span>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant/50 text-[16px] transition-transform duration-200"
                  style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }}>expand_more</span>
                <button
                  onClick={e => { e.stopPropagation(); deleteTemplate(tmpl.id); }}
                  className="material-symbols-outlined text-[16px] text-on-surface-variant/30 hover:text-error shrink-0"
                >close</button>
              </button>
              {isExpanded && (
                <div className="border-t border-outline-variant/40">
                  {/* Items list */}
                  <div className="divide-y divide-outline-variant/20">
                    {tmpl.items.length === 0 && (
                      <p className="px-4 py-2 font-mono text-[10px] text-on-surface-variant/40 italic">No jobs yet. Add one below.</p>
                    )}
                    {tmpl.items.map(item => (
                      <div key={item.id} className="flex items-center gap-2 px-4 py-2">
                        <span className="material-symbols-outlined text-outline-variant text-[15px]">drag_indicator</span>
                        <span className="flex-1 font-mono text-xs text-on-surface">{item.text}</span>
                        <button
                          onClick={() => removeItem(tmpl.id, item.id)}
                          className="material-symbols-outlined text-[14px] text-on-surface-variant/30 hover:text-error"
                        >close</button>
                      </div>
                    ))}
                  </div>
                  {/* Add item */}
                  <div className="flex items-center gap-2 p-3 border-t border-outline-variant/40">
                    <input
                      placeholder="Add job…"
                      value={newItemText[tmpl.id] || ''}
                      onChange={e => setNewItemText(prev => ({ ...prev, [tmpl.id]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem(tmpl.id); } }}
                      className="flex-1 p-2 bg-surface-container border border-outline-variant focus:border-primary rounded font-mono text-xs outline-none"
                    />
                    <button
                      onClick={() => addItem(tmpl.id)}
                      className="bg-primary text-on-primary px-3 py-2 rounded font-bold text-sm shrink-0"
                    >+</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── TrackersView ──────────────────────────────────────────────────────────────

const SUB_TABS: { id: SubTab; label: string; icon: string }[] = [
  { id: 'checklist',  label: 'Checklist',  icon: 'checklist'        },
  { id: 'service',    label: 'Maintenance Logs', icon: 'build'       },
  { id: 'accounting', label: 'Accounting', icon: 'account_balance'  },
];

export default function TrackersView({
  todos, onSaveTodos, teamMembers, currentUserId,
  weekends = [],
  accounting, onSaveAccounting,
  maintenance, onSaveMaintenance,
  onDeleteMaintenance,
  maintenanceLogs, onSaveMaintenanceLogs,
  savedSetups, activeCarId,
  initialSubTab,
  checklistTemplates, starterTemplatesReady, onSaveChecklistTemplates, onDeleteChecklistTemplate,
}: TrackersViewProps) {
  const [subTab, setSubTab] = useState<SubTab>(initialSubTab === 'templates' ? 'checklist' : (initialSubTab ?? 'checklist'));
  const [showTemplateManager, setShowTemplateManager] = useState(initialSubTab === 'templates');

  return (
    <div className="flex flex-col gap-4 h-full">

      {/* Sub-tab bar */}
      <div className="grid grid-cols-3 gap-1 bg-surface rounded-lg p-1 border border-outline-variant/30 text-xs font-mono uppercase tracking-wider">
        {SUB_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => { setSubTab(t.id); setShowTemplateManager(false); }}
            className={`min-h-11 flex items-center justify-center gap-1 py-2.5 px-1 rounded-md transition-all ${
              subTab === t.id ? 'bg-primary/10 text-primary font-bold' : 'text-on-surface-variant/60 hover:text-on-surface'
            }`}
          >
            <span
              className="material-symbols-outlined text-[15px]"
              style={{ fontVariationSettings: subTab === t.id ? "'FILL' 1" : "'FILL' 0" }}
            >
              {t.icon}
            </span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {subTab === 'checklist' && !showTemplateManager && (
          <ToDoView
            todos={todos}
            onSaveTodos={onSaveTodos}
            teamMembers={teamMembers}
            currentUserId={currentUserId}
            templates={checklistTemplates}
            onManageTemplates={() => setShowTemplateManager(true)}
            maintenance={maintenance}
            weekends={weekends}
            savedSetups={savedSetups}
          />
        )}
        {subTab === 'checklist' && showTemplateManager && (
          <div className="space-y-3">
            <button type="button" onClick={() => setShowTemplateManager(false)} className="min-h-11 flex items-center gap-2 px-3 border border-outline-variant rounded font-mono text-[10px] font-bold uppercase text-on-surface-variant hover:text-primary hover:border-primary">
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              Back to Checklist
            </button>
            <TemplatesTab
              templates={checklistTemplates}
              starterTemplatesReady={starterTemplatesReady}
              onSaveTemplates={onSaveChecklistTemplates}
              onDeleteTemplate={onDeleteChecklistTemplate}
            />
          </div>
        )}
        {subTab === 'accounting' && (
          <AccountingTab entries={accounting} onSave={onSaveAccounting} weekends={weekends} />
        )}
        {subTab === 'service' && (
          <ServiceTab
            components={maintenance}
            logs={maintenanceLogs}
            onSaveComponents={onSaveMaintenance}
            onSaveLogs={onSaveMaintenanceLogs}
            onDeleteComponent={onDeleteMaintenance}
            weekends={weekends}
            savedSetups={savedSetups}
            activeCarId={activeCarId}
            accounting={accounting}
            onSaveAccounting={onSaveAccounting}
          />
        )}
      </div>
    </div>
  );
}
