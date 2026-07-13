import { useState } from 'react';
import type { Car, RaceWeekend } from '../types';
import BottomSheet from './ui/BottomSheet';
import { sortWeekends } from '../lib/scope';

export interface ContextStripProps {
  cars: Car[];
  activeCarId: string | null;
  weekends: RaceWeekend[];
  activeWeekendId: string | null;
  onSelectCar: (id: string) => void;
  onSelectWeekend: (id: string) => void;
  onNewWeekend: () => void;
}

const carLabel = (car: Car) => car.name || `${car.chassis} · ${car.carType}`;

/**
 * [6] Persistent context strip under the header: which car + which weekend
 * everything is scoped to. Car chip only appears with 2+ cars ([37]).
 */
export default function ContextStrip({
  cars,
  activeCarId,
  weekends,
  activeWeekendId,
  onSelectCar,
  onSelectWeekend,
  onNewWeekend,
}: ContextStripProps) {
  const [carPickerOpen, setCarPickerOpen] = useState(false);
  const [weekendPickerOpen, setWeekendPickerOpen] = useState(false);

  const activeCar = cars.find(c => c.id === activeCarId) ?? null;
  const activeWeekend = weekends.find(w => w.id === activeWeekendId) ?? null;

  // [10] Canonical ordering shared with RaceWeekendView/Dashboard.
  const sortedWeekends = sortWeekends(weekends, activeWeekendId);

  return (
    <div className="w-full border-b border-outline-variant bg-surface-container/60 px-4 md:px-6">
      <div className="flex items-center gap-2 overflow-x-auto py-1">
        {/* Car chip — hidden entirely for single-car users ([37]) */}
        {cars.length > 1 && (
          <button
            type="button"
            onClick={() => setCarPickerOpen(true)}
            aria-label="Switch car"
            className="flex min-h-12 shrink-0 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 font-mono text-[11px] font-bold uppercase tracking-wider text-primary transition-colors hover:bg-primary/20"
          >
            <span className="material-symbols-outlined text-[14px]">directions_car</span>
            <span className="max-w-[110px] truncate">
              {activeCar ? carLabel(activeCar) : 'Pick car'}
            </span>
            <span className="material-symbols-outlined text-[14px]">expand_more</span>
          </button>
        )}

        {/* Weekend chip */}
        {activeWeekend ? (
          <button
            type="button"
            onClick={() => setWeekendPickerOpen(true)}
            aria-label="Switch race weekend"
            className="flex min-h-12 min-w-0 items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-high px-3 font-mono text-[11px] font-bold uppercase tracking-wider text-on-surface transition-colors hover:border-primary/50"
          >
            <span className="material-symbols-outlined text-[14px] text-primary">flag</span>
            <span className="min-w-0 truncate">
              {activeWeekend.track} · {activeWeekend.date}
            </span>
            <span className="material-symbols-outlined text-[14px] text-on-surface-variant">expand_more</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => (weekends.length === 0 ? onNewWeekend() : setWeekendPickerOpen(true))}
            className="flex min-h-12 min-w-0 items-center gap-1.5 rounded-full border border-dashed border-outline-variant px-3 font-mono text-[11px] font-bold uppercase tracking-wider text-on-surface-variant transition-colors hover:border-primary/50 hover:text-primary"
          >
            <span className="material-symbols-outlined text-[14px]">add_circle</span>
            <span className="min-w-0 truncate">No active weekend — tap to create</span>
          </button>
        )}
      </div>

      {/* Car picker */}
      <BottomSheet open={carPickerOpen} onClose={() => setCarPickerOpen(false)} title="Switch car">
        <div className="flex flex-col gap-1 pb-2">
          {cars.map(car => {
            const isActive = car.id === activeCarId;
            return (
              <button
                key={car.id}
                type="button"
                onClick={() => { onSelectCar(car.id); setCarPickerOpen(false); }}
                className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-left transition-colors ${
                  isActive ? 'bg-primary/10 text-primary' : 'text-on-surface hover:bg-surface-container'
                }`}
              >
                <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>
                  directions_car
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display font-semibold">{carLabel(car)}</span>
                  {car.division && (
                    <span className="block truncate text-xs text-on-surface-variant">{car.division}</span>
                  )}
                </span>
                {isActive && <span className="material-symbols-outlined text-primary">check</span>}
              </button>
            );
          })}
        </div>
      </BottomSheet>

      {/* Weekend picker */}
      <BottomSheet open={weekendPickerOpen} onClose={() => setWeekendPickerOpen(false)} title="Race weekends">
        <div className="flex flex-col gap-1 pb-2">
          {sortedWeekends.map(w => {
            const isActive = w.id === activeWeekendId;
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => { onSelectWeekend(w.id); setWeekendPickerOpen(false); }}
                className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-left transition-colors ${
                  isActive ? 'bg-primary/10 text-primary' : 'text-on-surface hover:bg-surface-container'
                }`}
              >
                <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>
                  flag
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display font-semibold">{w.name}</span>
                  <span className="block truncate text-xs text-on-surface-variant">
                    {w.track} · {w.date}
                  </span>
                </span>
                {isActive && (
                  <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-wider text-primary">
                    Active
                  </span>
                )}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => { setWeekendPickerOpen(false); onNewWeekend(); }}
            className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-left font-display font-semibold text-primary transition-colors hover:bg-surface-container"
          >
            <span className="material-symbols-outlined">add_circle</span>
            New weekend
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
