import { useEffect, useMemo, useState } from 'react';
import type { Setup, ShockSession } from '../types';
import { filterLoadSessions, normalizeQuarterInch, normalizeSpringRate, type QuickAdjustCommand } from '../lib/quickAdjust';
import { parseStoredNumber, type SetupCorner } from '../lib/setupSteps';

interface QuickAdjustPanelProps {
  setup: Setup;
  loadSessions: ShockSession[];
  onCommit: (command: QuickAdjustCommand) => { ok: boolean; error?: string };
  onOpenFourBar: () => void;
}

const CORNERS: Array<{ id: SetupCorner; label: string }> = [
  { id: 'lf', label: 'LF' }, { id: 'rf', label: 'RF' },
  { id: 'lr', label: 'LR' }, { id: 'rr', label: 'RR' },
];

const inputClass = 'w-full rounded border border-outline-variant bg-surface px-3 py-2 font-mono text-sm text-on-surface outline-none focus:border-primary';
const actionClass = 'min-h-11 rounded border border-primary/60 bg-primary/10 px-3 font-mono text-xs font-bold uppercase text-primary active:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-40';

export default function QuickAdjustPanel({ setup, loadSessions, onCommit, onOpenFourBar }: QuickAdjustPanelProps) {
  const [corner, setCorner] = useState<SetupCorner>('lf');
  const [springDraft, setSpringDraft] = useState(setup.lf.spring || '');
  const [shockDraft, setShockDraft] = useState(setup.lf.shockNote || '');
  const [frameDraft, setFrameDraft] = useState(setup.jbarFrameHeight || '');
  const [pinionDraft, setPinionDraft] = useState(setup.jbarPinionHeight || '');
  const [gearDraft, setGearDraft] = useState(setup.gear || '');
  const [otherDraft, setOtherDraft] = useState('');
  const [error, setError] = useState('');

  useEffect(() => setSpringDraft(setup[corner].spring || ''), [corner, setup[corner].spring]);
  useEffect(() => setShockDraft(setup[corner].shockNote || ''), [corner, setup[corner].shockNote]);
  useEffect(() => setFrameDraft(setup.jbarFrameHeight || ''), [setup.jbarFrameHeight]);
  useEffect(() => setPinionDraft(setup.jbarPinionHeight || ''), [setup.jbarPinionHeight]);
  useEffect(() => setGearDraft(setup.gear || ''), [setup.gear]);

  const matchingLoads = useMemo(
    () => filterLoadSessions(loadSessions, setup, corner),
    [loadSessions, setup, corner],
  );
  const springCanStep = parseStoredNumber(setup[corner].spring) !== '';
  const frameCanStep = parseStoredNumber(setup.jbarFrameHeight) !== '';
  const pinionCanStep = parseStoredNumber(setup.jbarPinionHeight) !== '';

  const commit = (command: QuickAdjustCommand, clear?: () => void) => {
    const result = onCommit(command);
    if (!result.ok) {
      setError(result.error || 'Change could not be saved.');
      return;
    }
    setError('');
    clear?.();
  };

  return (
    <div className="space-y-4 rounded-xl border border-outline-variant bg-surface-container p-3">
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h4 className="font-mono text-xs font-bold uppercase text-on-surface">Quick Adjust</h4>
          <span className="font-mono text-xs text-on-surface-variant">Current run</span>
        </div>
        <div className="grid grid-cols-4 gap-2" aria-label="Quick Adjust corner">
          {CORNERS.map(item => (
            <button key={item.id} type="button" aria-pressed={corner === item.id} onClick={() => { setCorner(item.id); setError(''); }}
              className={`min-h-11 rounded border font-mono text-sm font-bold ${corner === item.id ? 'border-primary bg-primary/15 text-primary' : 'border-outline-variant bg-surface text-on-surface-variant'}`}>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <section className="space-y-2 border-t border-outline-variant/60 pt-3">
        <div className="flex items-center justify-between gap-2">
          <label className="font-mono text-xs font-bold uppercase text-on-surface-variant">{corner.toUpperCase()} Spring Rate</label>
          <span className="font-mono text-xs text-on-surface-variant">Stored: {setup[corner].spring || 'not entered'}</span>
        </div>
        <div className="grid grid-cols-[auto_1fr_auto] gap-2">
          <button type="button" disabled={!springCanStep} onClick={() => commit({ kind: 'spring-rate', corner, delta: -25 })} className={actionClass}>−25</button>
          <input value={springDraft} onChange={event => setSpringDraft(event.target.value)} className={inputClass} inputMode="decimal" aria-label={`${corner.toUpperCase()} spring rate`} />
          <button type="button" disabled={!springCanStep} onClick={() => commit({ kind: 'spring-rate', corner, delta: 25 })} className={actionClass}>+25</button>
        </div>
        {!springCanStep && <p className="font-mono text-xs text-on-surface-variant">Enter a spring rate, then tap Save Spring. Step buttons never guess a missing value.</p>}
        <button type="button" onClick={() => {
          const value = normalizeSpringRate(springDraft);
          if (!value) { setError('Enter a numeric spring rate.'); return; }
          commit({ kind: 'spring-rate', corner, value });
        }} className={actionClass}>Save Spring</button>
      </section>

      <section className="space-y-2 border-t border-outline-variant/60 pt-3">
        <div className="flex items-center justify-between gap-2">
          <label className="font-mono text-xs font-bold uppercase text-on-surface-variant">{corner.toUpperCase()} Spring Rounds</label>
          <span className="font-mono text-sm font-bold text-primary">{setup[corner].springRounds || '0.0'}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => commit({ kind: 'spring-rounds', corner, delta: -0.5 })} className={actionClass}>−0.5 Round</button>
          <button type="button" onClick={() => commit({ kind: 'spring-rounds', corner, delta: 0.5 })} className={actionClass}>+0.5 Round</button>
        </div>
        {setup[corner].rideHeightNeedsReview && (
          <p className="rounded border border-amber-500/50 bg-amber-500/10 p-2 font-mono text-xs text-on-surface">
            * Spring rounds changed. Recheck this corner's Ride Height C-to-C, then update that field in Setups.
          </p>
        )}
      </section>

      <section className="space-y-2 border-t border-outline-variant/60 pt-3">
        <label className="font-mono text-xs font-bold uppercase text-on-surface-variant">{corner.toUpperCase()} Shock</label>
        <div className="flex gap-2">
          <input value={shockDraft} onChange={event => setShockDraft(event.target.value)} className={inputClass} placeholder="Shock change or note" aria-label={`${corner.toUpperCase()} shock note`} />
          <button type="button" onClick={() => commit({ kind: 'shock-note', corner, value: shockDraft })} className={actionClass}>Save Note</button>
        </div>
        <select
          value={setup[corner].boundGraphId || ''}
          onChange={event => {
            const selected = matchingLoads.find(item => item.id === event.target.value);
            commit({ kind: 'shock-load', corner, loadSessionId: event.target.value, loadSessionLabel: selected?.label || selected?.shock || 'None' });
          }}
          className={inputClass}
          aria-label={`${corner.toUpperCase()} load session`}
        >
          <option value="">No Load Session</option>
          {matchingLoads.map(item => <option key={item.id} value={item.id}>{item.label || item.shock} · {item.date}</option>)}
        </select>
        {matchingLoads.length === 0 && <p className="font-mono text-xs text-on-surface-variant">No {corner.toUpperCase()} Load Sessions saved for this weekend's car.</p>}
      </section>

      <section className="grid gap-3 border-t border-outline-variant/60 pt-3 sm:grid-cols-2">
        {([
          { key: 'frame' as const, label: 'J-Bar Frame', value: setup.jbarFrameHeight, draft: frameDraft, setDraft: setFrameDraft, canStep: frameCanStep },
          { key: 'pinion' as const, label: 'J-Bar Pinion', value: setup.jbarPinionHeight, draft: pinionDraft, setDraft: setPinionDraft, canStep: pinionCanStep },
        ]).map(item => (
          <div key={item.key} className="space-y-2">
            <label className="font-mono text-xs font-bold uppercase text-on-surface-variant">{item.label}</label>
            <input value={item.draft} onChange={event => item.setDraft(event.target.value)} className={inputClass} inputMode="decimal" aria-label={`${item.label} height`} />
            <div className="grid grid-cols-3 gap-2">
              <button type="button" disabled={!item.canStep} onClick={() => commit({ kind: item.key === 'frame' ? 'jbar-frame' : 'jbar-pinion', delta: -0.25 })} className={actionClass}>−1/4</button>
              <button type="button" onClick={() => {
                const value = normalizeQuarterInch(item.draft);
                if (!value) { setError(`Enter a numeric ${item.label} height.`); return; }
                commit({ kind: item.key === 'frame' ? 'jbar-frame' : 'jbar-pinion', value });
              }} className={actionClass}>Save</button>
              <button type="button" disabled={!item.canStep} onClick={() => commit({ kind: item.key === 'frame' ? 'jbar-frame' : 'jbar-pinion', delta: 0.25 })} className={actionClass}>+1/4</button>
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-2 border-t border-outline-variant/60 pt-3">
        <label className="font-mono text-xs font-bold uppercase text-on-surface-variant">Gear</label>
        <div className="flex gap-2">
          <input value={gearDraft} onChange={event => setGearDraft(event.target.value)} className={inputClass} placeholder="Manual entry" aria-label="Gear" />
          <button type="button" onClick={() => commit({ kind: 'gear', value: gearDraft })} className={actionClass}>Save Gear</button>
        </div>
      </section>

      <section className="space-y-2 border-t border-outline-variant/60 pt-3">
        <label className="font-mono text-xs font-bold uppercase text-on-surface-variant">Other Change</label>
        <div className="flex gap-2">
          <input value={otherDraft} onChange={event => setOtherDraft(event.target.value)} className={inputClass} placeholder="Anything not listed above" aria-label="Other change" />
          <button type="button" onClick={() => commit({ kind: 'other', value: otherDraft }, () => setOtherDraft(''))} className={actionClass}>Add</button>
        </div>
      </section>

      <button type="button" onClick={onOpenFourBar} className={`${actionClass} w-full`}>
        Four-bar Quick Adjust
      </button>
      {error && <p role="alert" className="rounded border border-red-500/50 bg-red-500/10 p-2 font-mono text-xs text-on-surface">{error}</p>}
    </div>
  );
}
