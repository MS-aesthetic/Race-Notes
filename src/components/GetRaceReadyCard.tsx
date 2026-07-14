import { useEffect, useRef, useState } from 'react';

// [1] First-run "Get race-ready" card — steps auto-check from REAL data
// (no fake progress). Dismissal is device-local and permanent.
const DISMISS_KEY = 'race_notes_onboarding_dismissed';

export interface GetRaceReadyCardProps {
  carCount: number;
  weekendCount: number;
  setupCount: number;
  sessionCount: number;
  onAddCar: () => void;
  onStartWeekend: () => void;
  onEnterSetup: () => void;
  onLogRun: () => void;
}

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function writeDismissed() {
  try {
    window.localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    // ignore quota / privacy-mode errors
  }
}

export default function GetRaceReadyCard({
  carCount,
  weekendCount,
  setupCount,
  sessionCount,
  onAddCar,
  onStartWeekend,
  onEnterSetup,
  onLogRun,
}: GetRaceReadyCardProps) {
  const [dismissed, setDismissed] = useState(readDismissed);

  const steps = [
    { key: 'car', label: 'Add your car', done: carCount > 0, icon: 'directions_car', onGo: onAddCar },
    { key: 'weekend', label: 'Start a race weekend', done: weekendCount > 0, icon: 'calendar_today', onGo: onStartWeekend },
    { key: 'setup', label: 'Enter your starting setup', done: setupCount > 0, icon: 'tune', onGo: onEnterSetup },
    { key: 'run', label: 'Log your first run', done: sessionCount > 0, icon: 'timer', onGo: onLogRun },
  ];
  const allDone = steps.every(s => s.done);
  const doneCount = steps.filter(s => s.done).length;

  // Already race-ready when this first mounts (returning user with data):
  // dismiss silently — no celebratory flash on every app open.
  const mountedAllDoneRef = useRef(allDone);
  useEffect(() => {
    if (mountedAllDoneRef.current) {
      writeDismissed();
      setDismissed(true);
    }
  }, []);

  // Completed the last step while mounted → show "race-ready" then auto-dismiss.
  useEffect(() => {
    if (dismissed || !allDone || mountedAllDoneRef.current) return;
    const t = setTimeout(() => {
      writeDismissed();
      setDismissed(true);
    }, 2800);
    return () => clearTimeout(t);
  }, [allDone, dismissed]);

  if (dismissed) return null;

  const dismiss = () => {
    writeDismissed();
    setDismissed(true);
  };

  return (
    <section
      id="section-get-race-ready"
      className="overflow-hidden rounded-2xl border border-primary/40 bg-surface-container"
    >
      <div className="flex items-center gap-2 pl-4 pr-1 pt-1">
        <span className="material-symbols-outlined text-primary" aria-hidden="true">sports_score</span>
        <div className="min-w-0 flex-1 py-3">
          <h2 className="font-display font-bold uppercase tracking-wide text-on-surface leading-tight">
            {allDone ? 'You’re race-ready \u{1F3C1}' : 'Get race-ready'}
          </h2>
          {!allDone && (
            <p className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant">
              {doneCount}/{steps.length} done
            </p>
          )}
        </div>
        <button
          type="button"
          aria-label="Dismiss checklist"
          onClick={dismiss}
          className="tap-target text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      {allDone ? (
        <p className="px-4 pb-4 text-sm text-on-surface-variant">
          Car, weekend, setup and first run all logged. Go be fast.
        </p>
      ) : (
        <div className="px-2 pb-2">
          {steps.map(step =>
            step.done ? (
              <div key={step.key} className="flex min-h-12 items-center gap-3 px-2 text-on-surface-variant/70">
                <span
                  className="material-symbols-outlined text-primary"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                  aria-hidden="true"
                >check_circle</span>
                <span className="text-sm line-through decoration-on-surface-variant/40">{step.label}</span>
              </div>
            ) : (
              <button
                key={step.key}
                type="button"
                onClick={step.onGo}
                className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2 text-left transition-colors hover:bg-surface-container-high"
              >
                <span className="material-symbols-outlined text-on-surface-variant" aria-hidden="true">{step.icon}</span>
                <span className="flex-1 text-sm font-semibold text-on-surface">{step.label}</span>
                <span className="material-symbols-outlined text-primary" aria-hidden="true">chevron_right</span>
              </button>
            ),
          )}
        </div>
      )}
    </section>
  );
}
