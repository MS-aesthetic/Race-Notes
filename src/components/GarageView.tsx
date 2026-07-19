import React, { useRef, useState } from 'react';
import { Car, CAR_TYPES } from '../types';
import EmptyState from './ui/EmptyState';
import ConfirmSheet from './ui/ConfirmSheet';

interface GarageViewProps {
  cars: Car[];
  activeCarId: string | null;
  onSelectCar: (carId: string) => void;
  onSaveCars: (updated: Car[]) => void;
  onDeleteCar: (carId: string) => void;
  setupCount: (carId: string) => number;
  tireCount: (carId: string) => number;
  shockCount: (carId: string) => number;
  maintenanceComponentCount: (carId: string) => number;
  maintenanceLogCount: (carId: string) => number;
}

const EMPTY_FORM = { carType: CAR_TYPES[0] as string, chassis: '', division: '', name: '' };

export default function GarageView({
  cars,
  activeCarId,
  onSelectCar,
  onSaveCars,
  onDeleteCar: commitDeleteCar,
  setupCount,
  tireCount,
  shockCount,
  maintenanceComponentCount,
  maintenanceLogCount,
}: GarageViewProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const addCarInputRef = useRef<HTMLInputElement>(null);
  const deleteSubmittingRef = useRef(false);
  const [pendingDeleteCarId, setPendingDeleteCarId] = useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const onDeleteCar = (carId: string) => setPendingDeleteCarId(carId);

  const genId = () => `car-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const focusAddCarForm = () => {
    setShowAddForm(true);
    window.setTimeout(() => addCarInputRef.current?.focus(), 0);
  };

  const handleAdd = () => {
    if (!form.chassis.trim()) return;
    const now = new Date().toISOString();
    const newCar: Car = {
      id: genId(),
      userId: 'local',
      teamId: null,
      carType: form.carType,
      chassis: form.chassis.trim(),
      division: form.division.trim(),
      name: form.name.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };
    onSaveCars([...cars, newCar]);
    if (cars.length === 0) onSelectCar(newCar.id);
    setForm(EMPTY_FORM);
    setShowAddForm(false);
  };

  const handleSaveEdit = (carId: string) => {
    if (!editForm.chassis.trim()) return;
    const updated = cars.map(c =>
      c.id === carId
        ? { ...c, carType: editForm.carType, chassis: editForm.chassis.trim(), division: editForm.division.trim(), name: editForm.name.trim() || undefined, updatedAt: new Date().toISOString() }
        : c
    );
    onSaveCars(updated);
    setEditingId(null);
  };

  const startEdit = (car: Car) => {
    setEditForm({ carType: car.carType, chassis: car.chassis, division: car.division, name: car.name || '' });
    setEditingId(car.id);
  };

  const pendingDeleteCar = cars.find(car => car.id === pendingDeleteCarId) ?? null;
  const pendingDeleteCounts = pendingDeleteCar ? [
    { label: 'setup', count: setupCount(pendingDeleteCar.id) },
    { label: 'tire', count: tireCount(pendingDeleteCar.id) },
    { label: 'shock record', count: shockCount(pendingDeleteCar.id) },
    { label: 'maintenance component', count: maintenanceComponentCount(pendingDeleteCar.id) },
    { label: 'maintenance log', count: maintenanceLogCount(pendingDeleteCar.id) },
  ].filter(item => item.count > 0) : [];
  const cancelDelete = () => {
    if (deleteSubmittingRef.current) return;
    setPendingDeleteCarId(null);
  };

  // D3 always routes delete through confirmation; scoped records never disable it.
  const totalData = (_carId: string) => 0;
  const confirmDelete = async () => {
    if (!pendingDeleteCar || deleteSubmittingRef.current) return;
    deleteSubmittingRef.current = true;
    setDeleteSubmitting(true);
    try {
      await Promise.resolve(commitDeleteCar(pendingDeleteCar.id));
      setPendingDeleteCarId(null);
    } finally {
      deleteSubmittingRef.current = false;
      setDeleteSubmitting(false);
    }
  };

  return (
    <div className="space-y-3 pb-8">
      {/* Header */}
      <div className="bg-surface-container border border-outline-variant rounded-lg p-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="material-symbols-outlined text-primary text-lg">garage</span>
          <h3 className="font-display font-bold uppercase text-sm text-on-surface tracking-wide">Garage</h3>
        </div>
        <p className="text-[11px] text-on-surface-variant font-mono">Select your active car. Setups, tires, and load sessions stay tied to it.</p>
      </div>

      {/* Car list */}
      {cars.length === 0 ? (
        <EmptyState icon="directions_car" title="No cars yet" cta={{ label: 'Add Car', onClick: focusAddCarForm, icon: 'add' }} />
      ) : (
        <div className="space-y-2">
          {cars.map(car => {
            const isActive = car.id === activeCarId;
            const isEditing = editingId === car.id;
            const sc = setupCount(car.id);
            const tc = tireCount(car.id);
            const shc = shockCount(car.id);
            const displayName = car.name || `${car.chassis} · ${car.carType}`;

            return (
              <div
                key={car.id}
                className={`bg-surface-container border rounded-lg transition-all ${
                  isActive ? 'border-primary bg-primary/5' : 'border-outline-variant'
                }`}
              >
                {isEditing ? (
                  <div className="p-3 space-y-2">
                    <label className="text-[10px] font-mono uppercase font-bold text-on-surface-variant tracking-wider">Car Type</label>
                    <select
                      value={editForm.carType}
                      onChange={e => setEditForm(f => ({ ...f, carType: e.target.value }))}
                      className="w-full bg-surface border border-outline-variant rounded px-3 py-2 text-sm font-mono text-on-surface focus:outline-none focus:border-primary"
                    >
                      {CAR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <input
                      placeholder="Chassis *"
                      value={editForm.chassis}
                      onChange={e => setEditForm(f => ({ ...f, chassis: e.target.value }))}
                      className="w-full bg-surface border border-outline-variant rounded px-3 py-2 text-sm font-mono text-on-surface focus:outline-none focus:border-primary"
                    />
                    <input
                      placeholder="Division"
                      value={editForm.division}
                      onChange={e => setEditForm(f => ({ ...f, division: e.target.value }))}
                      className="w-full bg-surface border border-outline-variant rounded px-3 py-2 text-sm font-mono text-on-surface focus:outline-none focus:border-primary"
                    />
                    <input
                      placeholder="Name (optional)"
                      value={editForm.name}
                      onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full bg-surface border border-outline-variant rounded px-3 py-2 text-sm font-mono text-on-surface focus:outline-none focus:border-primary"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveEdit(car.id)}
                        className="flex-1 py-2 bg-primary text-on-primary font-mono text-xs uppercase rounded font-bold"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="flex-1 py-2 border border-outline-variant text-on-surface-variant font-mono text-xs uppercase rounded"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => onSelectCar(car.id)}
                    className="w-full text-left p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {isActive && (
                            <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                          )}
                          <span className={`font-mono font-bold text-sm uppercase truncate ${isActive ? 'text-primary' : 'text-on-surface'}`}>
                            {displayName}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          {car.division && (
                            <span className="text-[10px] font-mono text-on-surface-variant uppercase">{car.division}</span>
                          )}
                          <span className="text-[10px] font-mono text-on-surface-muted uppercase">
                            {sc} setup{sc !== 1 ? 's' : ''} · {tc} tire{tc !== 1 ? 's' : ''} · {shc} shock{shc !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => startEdit(car)}
                          className="tap-target p-1.5 text-on-surface-muted hover:text-on-surface rounded transition-colors"
                          title="Edit"
                        >
                          <span className="material-symbols-outlined text-base">edit</span>
                        </button>
                        <button
                          onClick={() => onDeleteCar(car.id)}
                          disabled={totalData(car.id) > 0}
                          className={`tap-target p-1.5 rounded transition-colors ${
                            pendingDeleteCarId === car.id
                              ? 'text-on-surface-muted text-red-400'
                              : 'text-on-surface-muted hover:text-red-400'
                          }`}
                          title="Delete car and linked records"
                          aria-label={`Delete ${displayName} and linked records`}
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      </div>
                    </div>
                    {isActive && (
                      <div className="mt-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/15 border border-primary/30 text-primary text-[9px] font-mono font-bold uppercase tracking-wider">
                          <span className="w-1 h-1 rounded-full bg-primary" />
                          Active
                        </span>
                      </div>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmSheet
        open={!!pendingDeleteCar}
        title="Delete car and linked records?"
        body={pendingDeleteCar ? (
          <div className="space-y-3">
            <p><strong className="text-on-surface">{pendingDeleteCar.name || `${pendingDeleteCar.chassis} · ${pendingDeleteCar.carType}`}</strong> and these linked records will be permanently removed from this account/device:</p>
            {pendingDeleteCounts.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5 font-mono text-sm">
                {pendingDeleteCounts.map(item => (
                  <li key={item.label}>{item.count} {item.label}{item.count === 1 ? '' : 's'}</li>
                ))}
              </ul>
            ) : <p className="font-mono text-sm">No linked records.</p>}
            <p>Historical Race Day session snapshots remain in history.</p>
            {deleteSubmitting && <p role="status" className="font-mono text-sm">Preparing deletion…</p>}
          </div>
        ) : null}
        confirmLabel={deleteSubmitting ? 'Preparing…' : 'Delete permanently'}
        cancelLabel="Cancel"
        destructive
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />

      {/* Add car form */}
      {showAddForm ? (
        <div className="bg-surface-container border border-outline-variant rounded-lg p-3 space-y-2">
          <h4 className="text-[10px] font-mono uppercase font-bold text-on-surface-variant tracking-wider">Add Car</h4>
          <div>
            <label className="text-[10px] font-mono uppercase text-on-surface-variant mb-1 block">Car Type</label>
            <select
              value={form.carType}
              onChange={e => setForm(f => ({ ...f, carType: e.target.value }))}
              className="w-full bg-surface border border-outline-variant rounded px-3 py-2 text-sm font-mono text-on-surface focus:outline-none focus:border-primary"
            >
              {CAR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <input
            ref={addCarInputRef}
            placeholder="Chassis *"
            value={form.chassis}
            onChange={e => setForm(f => ({ ...f, chassis: e.target.value }))}
            className="w-full bg-surface border border-outline-variant rounded px-3 py-2 text-sm font-mono text-on-surface focus:outline-none focus:border-primary"
          />
          <input
            placeholder="Division"
            value={form.division}
            onChange={e => setForm(f => ({ ...f, division: e.target.value }))}
            className="w-full bg-surface border border-outline-variant rounded px-3 py-2 text-sm font-mono text-on-surface focus:outline-none focus:border-primary"
          />
          <input
            placeholder="Name (optional label)"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full bg-surface border border-outline-variant rounded px-3 py-2 text-sm font-mono text-on-surface focus:outline-none focus:border-primary"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={!form.chassis.trim()}
              className="flex-1 py-2 bg-primary text-on-primary font-mono text-xs uppercase rounded font-bold disabled:opacity-40"
            >
              Add Car
            </button>
            <button
              onClick={() => { setShowAddForm(false); setForm(EMPTY_FORM); }}
              className="flex-1 py-2 border border-outline-variant text-on-surface-variant font-mono text-xs uppercase rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={focusAddCarForm}
          className="w-full py-3 border border-dashed border-outline-variant/60 text-on-surface-muted font-mono text-xs uppercase rounded-lg hover:border-primary/60 hover:text-primary transition-colors flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-base">add</span>
          Add Car
        </button>
      )}
    </div>
  );
}
