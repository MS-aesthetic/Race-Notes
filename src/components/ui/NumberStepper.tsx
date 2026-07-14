import { useEffect, useRef, useState } from 'react';

export interface NumberStepperProps {
  value: number | '';
  onChange: (v: number | '') => void;
  step?: number;
  /** Larger increment used after ~1s of held auto-repeat. */
  bigStep?: number;
  min?: number;
  max?: number;
  unit?: string;
  decimals?: number;
  label?: string;
  ariaLabel?: string;
}

const REPEAT_DELAY_MS = 350;
const REPEAT_INTERVAL_MS = 100;
const BIG_STEP_AFTER_TICKS = 10;

export default function NumberStepper({
  value,
  onChange,
  step = 1,
  bigStep,
  min,
  max,
  unit,
  decimals = 0,
  label,
  ariaLabel,
}: NumberStepperProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const cancelRef = useRef(false);

  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const timeoutRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const tickCountRef = useRef(0);

  const clampRound = (n: number): number => {
    let r = n;
    if (min !== undefined) r = Math.max(min, r);
    if (max !== undefined) r = Math.min(max, r);
    const f = Math.pow(10, decimals);
    return Math.round(r * f) / f;
  };

  const applyStep = (dir: 1 | -1, s: number) => {
    const cur = valueRef.current;
    const base = typeof cur === 'number' ? cur : (min ?? 0);
    const next = clampRound(base + dir * s);
    valueRef.current = next;
    onChangeRef.current(next);
  };

  const stopPress = () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const startPress = (dir: 1 | -1) => {
    stopPress();
    applyStep(dir, step);
    tickCountRef.current = 0;
    timeoutRef.current = window.setTimeout(() => {
      intervalRef.current = window.setInterval(() => {
        tickCountRef.current += 1;
        const s =
          bigStep !== undefined && tickCountRef.current > BIG_STEP_AFTER_TICKS
            ? bigStep
            : step;
        applyStep(dir, s);
      }, REPEAT_INTERVAL_MS);
    }, REPEAT_DELAY_MS);
  };

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    };
  }, []);

  const display =
    value === '' ? '' : decimals > 0 ? value.toFixed(decimals) : String(value);

  const beginEdit = () => {
    stopPress();
    cancelRef.current = false;
    setDraft(display);
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    if (cancelRef.current) {
      cancelRef.current = false;
      return;
    }
    const t = draft.trim().replace(',', '.');
    if (t === '') {
      valueRef.current = '';
      onChangeRef.current('');
      return;
    }
    const n = Number(t);
    if (Number.isNaN(n)) return; // keep previous value on garbage input
    const next = clampRound(n);
    valueRef.current = next;
    onChangeRef.current(next);
  };

  const atMin = typeof value === 'number' && min !== undefined && value <= min;
  const atMax = typeof value === 'number' && max !== undefined && value >= max;
  const groupLabel = ariaLabel ?? label ?? 'Number stepper';

  const btnClass =
    'tap-target shrink-0 select-none touch-none text-on-surface active:bg-surface-container-highest';

  return (
    <div className="w-full">
      {label && (
        <div className="mb-1 text-sm text-on-surface-variant">{label}</div>
      )}
      <div
        role="group"
        aria-label={groupLabel}
        className="flex items-stretch overflow-hidden rounded-xl border border-outline-variant bg-surface-container"
      >
        <button
          type="button"
          aria-label={`Decrease ${groupLabel}`}
          className={`${btnClass} ${atMin ? 'opacity-40' : ''}`}
          onPointerDown={() => startPress(-1)}
          onPointerUp={stopPress}
          onPointerLeave={stopPress}
          onPointerCancel={stopPress}
          onBlur={stopPress}
          onClick={(e) => { if (e.detail === 0) applyStep(-1, step); }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <span className="material-symbols-outlined">remove</span>
        </button>

        <div className="min-w-0 flex-1 border-x border-outline-variant">
          {editing ? (
            <input
              autoFocus
              type="text"
              inputMode="decimal"
              aria-label={groupLabel}
              className="min-h-12 w-full bg-transparent text-center font-mono text-lg text-on-surface outline-none"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur();
                } else if (e.key === 'Escape') {
                  cancelRef.current = true;
                  e.currentTarget.blur();
                }
              }}
            />
          ) : (
            <button
              type="button"
              aria-label={`Edit ${groupLabel}`}
              className="tap-target w-full font-mono text-lg text-on-surface"
              onClick={beginEdit}
            >
              {display === '' ? (
                <span className="text-on-surface-variant">--</span>
              ) : (
                display
              )}
              {unit && (
                <span className="ml-1 font-sans text-sm text-on-surface-variant">
                  {unit}
                </span>
              )}
            </button>
          )}
        </div>

        <button
          type="button"
          aria-label={`Increase ${groupLabel}`}
          className={`${btnClass} ${atMax ? 'opacity-40' : ''}`}
          onPointerDown={() => startPress(1)}
          onPointerUp={stopPress}
          onPointerLeave={stopPress}
          onPointerCancel={stopPress}
          onBlur={stopPress}
          onClick={(e) => { if (e.detail === 0) applyStep(1, step); }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <span className="material-symbols-outlined">add</span>
        </button>
      </div>
    </div>
  );
}
