import { useEffect, useRef, useState, type PointerEvent } from 'react';

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
const STEPPER_POINTER_SLOP_PX = 8;

type StepperPress = {
  dir: 1 | -1;
  pointerId: number;
  startX: number;
  startY: number;
  moved: boolean;
  didRepeat: boolean;
};

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
  const pressRef = useRef<StepperPress | null>(null);

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

  const cancelPress = () => {
    stopPress();
    pressRef.current = null;
  };

  const applyRepeatStep = (press: StepperPress) => {
    tickCountRef.current += 1;
    const s =
      bigStep !== undefined && tickCountRef.current > BIG_STEP_AFTER_TICKS
        ? bigStep
        : step;
    applyStep(press.dir, s);
  };

  const startPress = (event: PointerEvent<HTMLButtonElement>, dir: 1 | -1) => {
    if (event.button !== 0) return;
    cancelPress();
    const press: StepperPress = {
      dir,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      didRepeat: false,
    };
    pressRef.current = press;
    tickCountRef.current = 0;
    timeoutRef.current = window.setTimeout(() => {
      if (pressRef.current !== press || press.moved) return;
      press.didRepeat = true;
      applyRepeatStep(press);
      intervalRef.current = window.setInterval(() => {
        if (pressRef.current === press && !press.moved) applyRepeatStep(press);
      }, REPEAT_INTERVAL_MS);
    }, REPEAT_DELAY_MS);
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const press = pressRef.current;
    if (!press || press.pointerId !== event.pointerId) return;
    if (Math.hypot(event.clientX - press.startX, event.clientY - press.startY) > STEPPER_POINTER_SLOP_PX) {
      press.moved = true;
      cancelPress();
    }
  };

  const finishPress = (event: PointerEvent<HTMLButtonElement>) => {
    const press = pressRef.current;
    if (!press || press.pointerId !== event.pointerId) return;
    stopPress();
    pressRef.current = null;
    const releasedOutsideSlop = Math.hypot(event.clientX - press.startX, event.clientY - press.startY) > STEPPER_POINTER_SLOP_PX;
    if (!press.moved && !releasedOutsideSlop && !press.didRepeat) applyStep(press.dir, step);
  };

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      cancelPress();
    };
  }, []);

  const display =
    value === '' ? '' : decimals > 0 ? value.toFixed(decimals) : String(value);

  const beginEdit = () => {
    cancelPress();
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
    'min-h-11 min-w-11 shrink-0 select-none touch-pan-y text-on-surface active:bg-surface-container-highest';

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
          onPointerDown={(e) => startPress(e, -1)}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPress}
          onPointerLeave={cancelPress}
          onPointerCancel={cancelPress}
          onBlur={cancelPress}
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
              className="tap-target flex min-w-0 w-full items-center justify-center gap-1 font-mono text-lg text-on-surface"
              onClick={beginEdit}
            >
              <span className="min-w-0 whitespace-nowrap tabular-nums">
                {display === '' ? (
                  <span className="text-on-surface-variant">--</span>
                ) : (
                  display
                )}
              </span>
              {unit && (
                <span className="shrink-0 font-sans text-sm text-on-surface-variant">
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
          onPointerDown={(e) => startPress(e, 1)}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPress}
          onPointerLeave={cancelPress}
          onPointerCancel={cancelPress}
          onBlur={cancelPress}
          onClick={(e) => { if (e.detail === 0) applyStep(1, step); }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <span className="material-symbols-outlined">add</span>
        </button>
      </div>
    </div>
  );
}
