import { useState, type FormEvent } from 'react';
import type { RaceWeekend, Setup, TireInventoryItem } from '../types';
import { byActiveCar } from '../lib/scope';
import { compareTireSize, parseTireSize } from '../lib/tireSize';
import { formatPsiValue, resolveLinkedTireSizes } from '../lib/setupSteps';
import { downloadTireUsageCsv, getRecentPressureHistory, getTireTotalLaps, getTireUsageHistory, printTireUsageReport } from '../lib/tireHistory';
import EmptyState from './ui/EmptyState';
import ConfirmSheet from './ui/ConfirmSheet';
import { InfoToast } from './ui/UndoToast';

interface TiresSubViewProps {
  tires: TireInventoryItem[];
  activeCarId: string | null | undefined;
  activeSetup: Setup | null;
  setups: Setup[];
  weekends: RaceWeekend[];
  onSaveTires: (tires: TireInventoryItem[]) => void;
  onDeleteTireFromCloud?: (tireId: string) => void;
  onGoToGarage?: () => void;
}

const CORNERS = ['lf', 'rf', 'lr', 'rr'] as const;
const normalizeSize = (value: string) => {
  const trimmed = value.trim();
  return trimmed && !trimmed.endsWith('"') ? `${trimmed}"` : trimmed;
};
const stagger = (right: string, left: string): string => {
  const r = parseTireSize(right);
  const l = parseTireSize(left);
  return Number.isNaN(r) || Number.isNaN(l) ? '—' : `${(r - l).toFixed(2)} in`;
};

export default function TiresSubView({
  tires, activeCarId, activeSetup, setups, weekends, onSaveTires, onDeleteTireFromCloud, onGoToGarage,
}: TiresSubViewProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<TireInventoryItem>>({ wheelBackspacing: '2' });
  const [sort, setSort] = useState<'newest' | 'oldest' | 'size-asc' | 'size-desc'>('newest');
  const [compoundFilter, setCompoundFilter] = useState('all');
  const [expandedTireId, setExpandedTireId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [infoToast, setInfoToast] = useState<string | null>(null);
  const noCar = !activeCarId;
  const displayedTires = activeCarId ? byActiveCar<TireInventoryItem>(tires, activeCarId) : [];
  const resolvedSizes = activeSetup ? resolveLinkedTireSizes(activeSetup, displayedTires) : null;
  const linkedTireIds = activeSetup ? Object.fromEntries(CORNERS.map(corner => [corner, activeSetup[corner].tireInventoryId || ''])) : undefined;
  const history = getRecentPressureHistory(weekends, setups, tires, activeCarId, 1, linkedTireIds);
  const compounds = Array.from(new Set(displayedTires.map(tire => tire.compound.trim()).filter(Boolean))).sort();
  const filtered = compoundFilter === 'all' ? displayedTires : displayedTires.filter(tire => tire.compound === compoundFilter);
  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'oldest') return (a.createdAt || a.id).localeCompare(b.createdAt || b.id);
    if (sort === 'size-asc') return compareTireSize(a.size, b.size);
    if (sort === 'size-desc') return compareTireSize(b.size, a.size);
    return (b.createdAt || b.id).localeCompare(a.createdAt || a.id);
  });

  const closeForm = () => { setShowForm(false); setEditingId(null); setDraft({ wheelBackspacing: '2' }); };
  const openAdd = () => { setEditingId(null); setDraft({ wheelBackspacing: '2' }); setShowForm(true); };
  const openEdit = (tire: TireInventoryItem) => { setEditingId(tire.id); setDraft({ ...tire }); setShowForm(true); };
  const saveTires = (next: TireInventoryItem[]) => onSaveTires(next);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!activeCarId) return;
    const now = new Date().toISOString();
    const existing = editingId ? tires.find(tire => tire.id === editingId && tire.carId === activeCarId) : null;
    if (editingId && !existing) return;
    const next: TireInventoryItem = {
      ...(existing ?? {}),
      id: existing?.id ?? `tire-${Date.now()}`,
      carId: activeCarId,
      tireNumber: draft.tireNumber?.trim() || '',
      size: normalizeSize(draft.size || ''),
      compound: draft.compound?.trim() || '',
      wheelBackspacing: (draft.wheelBackspacing as '2' | '3' | '4') || '2',
      durometer: draft.durometer || '',
      airPressure: draft.airPressure?.trim() || '',
      createdAt: existing?.createdAt ?? now,
      dateAdded: existing?.dateAdded ?? now,
      initialAgeDays: Number(draft.initialAgeDays) || 0,
      usageDates: existing?.usageDates ?? [],
      heatCycles: existing?.heatCycles ?? 0,
    };
    saveTires(existing ? tires.map(tire => tire.id === existing.id ? next : tire) : [next, ...tires]);
    closeForm();
  };

  const handleDelete = (id: string) => {
    setPendingDeleteId(id);
  };
  const confirmDelete = () => {
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    if (!id || !activeCarId || !tires.some(tire => tire.id === id && tire.carId === activeCarId)) return;
    saveTires(tires.filter(tire => tire.id !== id));
    onDeleteTireFromCloud?.(id);
  };
  const handlePrintReport = () => {
    if (!printTireUsageReport(displayedTires, weekends)) {
      setInfoToast('Allow popups in your browser to view the report.');
    }
  };
  const findTire = (id: string | undefined) => displayedTires.find(tire => tire.id === id);

  return <div className="space-y-3">
    <section className="space-y-2 rounded-xl border border-outline-variant bg-surface-container p-3">
      <div><h3 className="font-display text-lg font-bold uppercase text-on-surface">Current tire set</h3><p className="font-mono text-xs text-on-surface-variant">Latest logged pressure, heat cycles, and estimated laps.</p></div>
      {!noCar && activeSetup ? <>
        <div className="grid grid-cols-2 gap-2">
          {CORNERS.map(corner => {
            const setupCorner = activeSetup[corner];
            const tire = findTire(setupCorner.tireInventoryId);
            const usage = tire ? getTireUsageHistory(tire.id, weekends) : [];
            const lastPressure = history[corner][0]?.pressure;
            return <div key={corner} className="min-w-0 rounded border border-outline-variant bg-surface-container-low p-2">
              <p className="font-mono text-xs font-bold text-primary uppercase">{corner}</p>
              <p className="min-w-0 break-words font-mono text-sm text-on-surface">#{tire?.tireNumber || '—'} · {resolvedSizes?.[corner] || '—'}</p>
              <p className="min-w-0 break-words font-mono text-sm text-on-surface-variant">{tire?.compound || setupCorner.tireComp || 'No compound'}</p>
              <p className="mt-1 font-mono text-sm text-on-surface-variant">Last pressure <span className="font-bold text-on-surface">{formatPsiValue(lastPressure) || '—'}</span></p>
              <p className="font-mono text-sm text-on-surface-variant">Cycles <span className="font-bold text-on-surface">{tire ? tire.heatCycles ?? 0 : '—'}</span> · Est. laps <span className="font-bold text-on-surface">{tire ? getTireTotalLaps(usage) : '—'}</span></p>
            </div>;
          })}
        </div>
        <div className="grid grid-cols-2 gap-2 font-mono text-sm"><div className="min-w-0 break-words rounded bg-surface-container-low p-2 text-on-surface-variant">Front stagger <span className="text-primary">{stagger(resolvedSizes?.rf || '', resolvedSizes?.lf || '')}</span></div><div className="min-w-0 break-words rounded bg-surface-container-low p-2 text-on-surface-variant">Rear stagger <span className="text-primary">{stagger(resolvedSizes?.rr || '', resolvedSizes?.lr || '')}</span></div></div>
      </> : <p className="font-mono text-xs text-on-surface-variant">{noCar ? 'Select or add a car to view its tire set.' : 'Select a setup for this car to view linked tires.'}</p>}
    </section>

    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-display text-lg font-bold uppercase text-on-surface">Tire Inventory</h3><p className="font-mono text-xs text-on-surface-variant">{displayedTires.length} tire{displayedTires.length === 1 ? '' : 's'} logged</p></div><div className="flex flex-wrap items-center gap-2">{displayedTires.length > 0 && <><button onClick={() => downloadTireUsageCsv(displayedTires, weekends)} className="h-9 px-3 border border-outline-variant font-mono text-xs font-bold uppercase text-on-surface-variant rounded">CSV</button><button onClick={handlePrintReport} className="h-9 px-3 border border-outline-variant font-mono text-xs font-bold uppercase text-on-surface-variant rounded">Report</button></>}<button onClick={() => noCar ? onGoToGarage?.() : openAdd()} className="h-9 px-3 rounded bg-primary font-mono text-xs font-bold uppercase text-on-primary">{noCar ? 'Go to Garage' : 'Add Tire'}</button></div></div>

    {displayedTires.length === 0 ? <EmptyState icon="tire_repair" title={noCar ? 'Add a car before adding tires' : 'No tires in inventory'} body={noCar ? 'Tires stay tied to one car so setup links never cross cars.' : 'Add tires to assign them to setup corners and track their usage.'} cta={{ label: noCar ? 'Go to Garage' : 'Add First Tire', onClick: () => noCar ? onGoToGarage?.() : openAdd() }} /> : <>
      <div className="flex flex-wrap gap-2"><select value={sort} onChange={event => setSort(event.target.value as typeof sort)} className="min-w-0 flex-1 rounded border border-outline-variant bg-surface-container px-2 py-1.5 font-mono text-xs text-on-surface"><option value="newest">Sort: Newest</option><option value="oldest">Sort: Oldest</option><option value="size-asc">Sort: Size ↑</option><option value="size-desc">Sort: Size ↓</option></select><select value={compoundFilter} onChange={event => setCompoundFilter(event.target.value)} className="min-w-0 flex-1 rounded border border-outline-variant bg-surface-container px-2 py-1.5 font-mono text-xs text-on-surface"><option value="all">Compound: All</option>{compounds.map(compound => <option key={compound} value={compound}>{compound}</option>)}</select></div>
      <div className="space-y-2">{sorted.map(tire => {
        const expanded = expandedTireId === tire.id;
        const usage = expanded ? getTireUsageHistory(tire.id, weekends) : [];
        const ageDays = tire.dateAdded ? Math.floor((Date.now() - new Date(tire.dateAdded).getTime()) / 86400000) + (tire.initialAgeDays ?? 0) : (tire.initialAgeDays ?? 0);
        const aging = (tire.heatCycles ?? 0) >= 8 || ageDays >= 90;
        return <div key={tire.id} className="overflow-hidden rounded-lg border border-outline-variant bg-surface-container"><div onClick={() => setExpandedTireId(expanded ? null : tire.id)} className="flex cursor-pointer items-center justify-between gap-2 px-4 py-2.5"><div className="min-w-0 flex-1"><p className="break-words font-mono text-xs text-on-surface"><span className="font-bold text-primary">#{tire.tireNumber}</span> · {tire.size}{tire.size && !tire.size.includes('"') ? '"' : ''} · BS {tire.wheelBackspacing}&quot; · {tire.compound} · Duro {tire.durometer || '—'}{formatPsiValue(tire.airPressure) ? ` · ${formatPsiValue(tire.airPressure)}` : ''}</p><p className="mt-1 font-mono text-xs text-on-surface-variant">Cycles {tire.heatCycles ?? 0} · Laps {getTireTotalLaps(getTireUsageHistory(tire.id, weekends))} · Age {ageDays}d {aging && <span className="ml-1 rounded bg-primary/15 px-1 py-0.5 font-bold uppercase text-primary">Aging</span>}</p></div><button type="button" onClick={event => { event.stopPropagation(); openEdit(tire); }} className="tap-target shrink-0 text-on-surface-variant" title="Edit tire"><span className="material-symbols-outlined">edit</span></button><button type="button" onClick={event => { event.stopPropagation(); handleDelete(tire.id); }} className="tap-target shrink-0 text-error" title="Delete tire"><span className="material-symbols-outlined">delete</span></button></div>{expanded && <div className="space-y-1.5 border-t border-outline-variant bg-surface-container-low px-4 py-3"><p className="font-mono text-xs uppercase text-on-surface-variant">Usage History — <span className="font-bold text-primary">{getTireTotalLaps(usage)} est. laps</span> across {usage.length} run{usage.length === 1 ? '' : 's'}</p>{usage.length ? usage.map((row, index) => <div key={`${row.sessionId}-${index}`} className="flex min-w-0 flex-wrap items-start gap-1 rounded border border-outline-variant/30 bg-surface px-2 py-1.5 font-mono text-xs"><span className="min-w-0 basis-full break-words">{row.date} · {row.track} · {row.sessionName}</span><span className="min-w-0 basis-full break-words text-primary">{row.corner.toUpperCase()} · {row.sessionType}{row.sessionTypeInferred ? '*' : ''} · {row.estimatedLaps} laps</span></div>) : <p className="font-mono text-xs text-on-surface-variant">Not used in any logged run yet.</p>}</div>}</div>;
      })}</div>
    </>}

    {showForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"><div className="relative max-h-[calc(100dvh-2rem)] w-full min-w-0 max-w-sm space-y-3 overflow-y-auto rounded-lg border-2 border-outline bg-surface p-5 text-on-surface"><button type="button" onClick={closeForm} className="absolute right-3 top-3 text-on-surface-variant"><span className="material-symbols-outlined">close</span></button><h3 className="pr-10 font-display text-base font-bold uppercase">{editingId ? 'Edit Tire' : 'Add Tire to Inventory'}</h3><form onSubmit={handleSubmit} className="min-w-0 space-y-3"><div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2"><label className="min-w-0 font-mono text-xs uppercase text-on-surface-variant">Tire #<input required value={draft.tireNumber || ''} onChange={event => setDraft(current => ({ ...current, tireNumber: event.target.value }))} className="mt-1 w-full min-w-0 rounded border border-outline-variant bg-surface-container p-2 font-mono text-on-surface" /></label><label className="min-w-0 font-mono text-xs uppercase text-on-surface-variant">Size<input required value={draft.size || ''} onChange={event => setDraft(current => ({ ...current, size: event.target.value }))} onBlur={event => setDraft(current => ({ ...current, size: normalizeSize(event.target.value) }))} className="mt-1 w-full min-w-0 rounded border border-outline-variant bg-surface-container p-2 font-mono text-on-surface" /></label></div><label className="block min-w-0 font-mono text-xs uppercase text-on-surface-variant">Compound<div className="my-2 flex min-w-0 flex-wrap gap-1">{compounds.map(compound => <button key={compound} type="button" onClick={() => setDraft(current => ({ ...current, compound }))} className="max-w-full break-words rounded border border-outline-variant px-2 py-1 font-mono text-xs text-on-surface-variant">{compound}</button>)}</div><input required value={draft.compound || ''} onChange={event => setDraft(current => ({ ...current, compound: event.target.value }))} className="w-full min-w-0 rounded border border-outline-variant bg-surface-container p-2 text-on-surface" /></label><div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2"><label className="min-w-0 font-mono text-xs uppercase text-on-surface-variant">Backspacing<select value={draft.wheelBackspacing || '2'} onChange={event => setDraft(current => ({ ...current, wheelBackspacing: event.target.value as '2' | '3' | '4' }))} className="mt-1 w-full min-w-0 rounded border border-outline-variant bg-surface-container p-2 text-on-surface"><option value="2">2&quot;</option><option value="3">3&quot;</option><option value="4">4&quot;</option></select></label><label className="min-w-0 font-mono text-xs uppercase text-on-surface-variant">Durometer<input value={draft.durometer || ''} onChange={event => setDraft(current => ({ ...current, durometer: event.target.value }))} className="mt-1 w-full min-w-0 rounded border border-outline-variant bg-surface-container p-2 text-on-surface" /></label><label className="min-w-0 font-mono text-xs uppercase text-on-surface-variant">Air pressure<input value={draft.airPressure || ''} onChange={event => setDraft(current => ({ ...current, airPressure: event.target.value }))} className="mt-1 w-full min-w-0 rounded border border-outline-variant bg-surface-container p-2 text-on-surface" /></label><label className="min-w-0 font-mono text-xs uppercase text-on-surface-variant">Age days<input type="number" min="0" value={draft.initialAgeDays ?? ''} onChange={event => setDraft(current => ({ ...current, initialAgeDays: Number(event.target.value) || 0 }))} className="mt-1 w-full min-w-0 rounded border border-outline-variant bg-surface-container p-2 text-on-surface" /></label></div><div className="flex min-w-0 flex-wrap justify-end gap-2"><button type="button" onClick={closeForm} className="rounded border border-outline-variant px-3 py-2 font-mono text-xs uppercase">Cancel</button><button type="submit" className="rounded bg-primary px-3 py-2 font-mono text-xs font-bold uppercase text-on-primary">{editingId ? 'Save Tire' : 'Add Tire'}</button></div></form></div></div>}
    <ConfirmSheet open={!!pendingDeleteId} title="Delete tire?" body="Delete this tire from inventory?" confirmLabel="Delete" cancelLabel="Keep" destructive onConfirm={confirmDelete} onCancel={() => setPendingDeleteId(null)} />
    <InfoToast open={!!infoToast} title={infoToast ?? ''} onClose={() => setInfoToast(null)} />
  </div>;
}
