import type { CornerSetup, Setup } from '../types';
import NumberStepper from './ui/NumberStepper';
import {
  NumericCornerField,
  SETUP_STEPS,
  formatStoredNumber,
  legacyValueNote,
  parseStoredNumber,
} from '../lib/setupSteps';

interface FourBarQuickAdjustProps {
  setup: Setup | null;
  onFieldChange: (
    corner: 'lr' | 'rr',
    field: NumericCornerField,
    value: string,
    previous: string,
  ) => void;
  compact?: boolean;
  disabledReason?: string;
}

interface RowSpec {
  field: NumericCornerField;
  label: string;
}

const TOP_ROWS: RowSpec[] = [
  { field: 'topBarLength', label: 'Top length' },
  { field: 'topBarHFrame', label: 'Top frame hole' },
  { field: 'topBarHBird', label: 'Top birdcage hole' },
];

const BOTTOM_ROWS: RowSpec[] = [
  { field: 'bottomBarLength', label: 'Bottom length' },
  { field: 'botBarHFrame', label: 'Bottom frame hole' },
  { field: 'botBarHBird', label: 'Bottom birdcage hole' },
  { field: 'bottomBarAngle', label: 'Bottom angle' },
];

function FourBarRow({ corner, data, row, onFieldChange }: {
  corner: 'lr' | 'rr';
  data: CornerSetup;
  row: RowSpec;
  onFieldChange: FourBarQuickAdjustProps['onFieldChange'];
}) {
  const field = row.field;
  const raw = String(data[field] ?? '');
  const step = SETUP_STEPS[field];
  const legacy = legacyValueNote(raw);
  return (
    <div className="min-w-0 space-y-1 [&_[role=group]]:flex-wrap [&_[role=group]]:overflow-visible [&_[role=group]>button]:basis-full [&_[role=group]>button]:w-full [&_[role=group]>div]:basis-full [&_[role=group]>div]:border-x-0 [&_[role=group]>div]:border-y">
      <p className="font-mono text-xs uppercase text-on-surface-variant">{row.label}</p>
      <NumberStepper
        value={parseStoredNumber(raw)}
        onChange={(value) => onFieldChange(corner, field, formatStoredNumber(value, step), raw)}
        step={step.step}
        min={step.min}
        decimals={step.decimals}
        unit={step.unit}
        ariaLabel={`${corner.toUpperCase()} ${row.label}`}
      />
      {legacy && <p className="font-mono text-xs text-on-surface-variant">Legacy: {legacy}</p>}
    </div>
  );
}

function PairedRow({ row, setup, onFieldChange }: {
  key?: string;
  row: RowSpec | 'top-angle';
  setup: Setup;
  onFieldChange: FourBarQuickAdjustProps['onFieldChange'];
}) {
  const label = row === 'top-angle' ? 'Top angle' : row.label;
  const lrRow: RowSpec = row === 'top-angle' ? { field: 'topBarAngFD', label } : row;
  const rrRow: RowSpec = row === 'top-angle' ? { field: 'topBarAngRH', label } : row;
  return (
    <section className="rounded-xl border border-outline-variant bg-surface-container p-2 space-y-2">
      <p className="font-mono text-xs uppercase text-on-surface-variant">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        <FourBarRow corner="lr" data={setup.lr} row={lrRow} onFieldChange={onFieldChange} />
        <FourBarRow corner="rr" data={setup.rr} row={rrRow} onFieldChange={onFieldChange} />
      </div>
    </section>
  );
}

export default function FourBarQuickAdjust({ setup, onFieldChange, compact = false, disabledReason }: FourBarQuickAdjustProps) {
  if (!setup) {
    return (
      <div className="rounded-xl border border-dashed border-outline-variant bg-surface-container p-4 font-mono text-sm text-on-surface-variant">
        {disabledReason ?? 'Select a setup for this car to adjust four-bar.'}
      </div>
    );
  }
  return (
    <div className={compact ? 'space-y-3' : 'rounded-xl border-2 border-primary/60 bg-surface-container-high p-4 space-y-3'}>
      {!compact && (
        <div>
          <h3 className="font-display text-lg font-bold uppercase tracking-wide text-on-surface">FOUR-BAR / BIRDCAGE</h3>
          <p className="font-mono text-xs text-on-surface-variant">Live setup values. Change one item, log result.</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 rounded-xl border border-outline-variant bg-surface-container-low p-2">
        <div className="min-w-0"><h4 className="font-display text-base font-bold uppercase text-on-surface">LR</h4><p className="font-mono text-xs text-on-surface-variant">Full Droop</p></div>
        <div className="min-w-0"><h4 className="font-display text-base font-bold uppercase text-on-surface">RR</h4><p className="font-mono text-xs text-on-surface-variant">Ride Height</p></div>
      </div>
      <div className="space-y-2">
        {TOP_ROWS.map(row => <PairedRow key={row.field} row={row} setup={setup} onFieldChange={onFieldChange} />)}
        <PairedRow row="top-angle" setup={setup} onFieldChange={onFieldChange} />
        {BOTTOM_ROWS.map(row => <PairedRow key={row.field} row={row} setup={setup} onFieldChange={onFieldChange} />)}
      </div>
    </div>
  );
}
