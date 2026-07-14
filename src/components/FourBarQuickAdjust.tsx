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

interface FieldSpec {
  field: NumericCornerField;
  label: string;
}

interface BarSpec {
  label: string;
  measurements: FieldSpec[];
  angles: FieldSpec[];
}

const BAR_SPECS: BarSpec[] = [
  {
    label: 'Top Bar',
    measurements: [
      { field: 'topBarHFrame', label: 'Frame Hole' },
      { field: 'topBarLength', label: 'Bar Length' },
      { field: 'topBarHBird', label: 'Birdcage Hole' },
    ],
    angles: [
      { field: 'topBarAngRH', label: 'Angle at Ride Height' },
      { field: 'topBarAngFD', label: 'Angle at Full Droop' },
    ],
  },
  {
    label: 'Bottom Bar',
    measurements: [
      { field: 'botBarHFrame', label: 'Frame Hole' },
      { field: 'bottomBarLength', label: 'Bar Length' },
      { field: 'botBarHBird', label: 'Birdcage Hole' },
    ],
    angles: [
      { field: 'bottomBarAngRH', label: 'Angle at Ride Height' },
      { field: 'bottomBarAngFD', label: 'Angle at Full Droop' },
    ],
  },
];

function FourBarField({ corner, data, spec, barLabel, onFieldChange }: {
  key?: string;
  corner: 'lr' | 'rr';
  data: CornerSetup;
  spec: FieldSpec;
  barLabel: string;
  onFieldChange: FourBarQuickAdjustProps['onFieldChange'];
}) {
  const raw = String(data[spec.field] ?? '');
  const step = SETUP_STEPS[spec.field];
  const legacy = legacyValueNote(raw);
  return (
    <div className="min-w-0 space-y-1 [&_[role=group]]:flex-wrap [&_[role=group]]:overflow-visible [&_[role=group]>button]:basis-full [&_[role=group]>button]:w-full [&_[role=group]>div]:basis-full [&_[role=group]>div]:border-x-0 [&_[role=group]>div]:border-y">
      <p className="font-mono text-xs uppercase text-on-surface-variant">{spec.label}</p>
      <NumberStepper
        value={parseStoredNumber(raw)}
        onChange={value => onFieldChange(corner, spec.field, formatStoredNumber(value, step), raw)}
        step={step.step}
        min={step.min}
        decimals={step.decimals}
        unit={step.unit}
        ariaLabel={`${corner.toUpperCase()} ${barLabel} ${spec.label}`}
      />
      {legacy && <p className="font-mono text-xs text-on-surface-variant">Legacy: {legacy}</p>}
    </div>
  );
}

function BarSection({ corner, data, bar, onFieldChange }: {
  key?: string;
  corner: 'lr' | 'rr';
  data: CornerSetup;
  bar: BarSpec;
  onFieldChange: FourBarQuickAdjustProps['onFieldChange'];
}) {
  return (
    <section className="space-y-3 rounded-xl border border-outline-variant bg-surface-container p-3">
      <h5 className="font-display text-sm font-bold uppercase text-on-surface">{bar.label}</h5>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {bar.measurements.map(spec => <FourBarField key={spec.field} corner={corner} data={data} spec={spec} barLabel={bar.label} onFieldChange={onFieldChange} />)}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {bar.angles.map(spec => <FourBarField key={spec.field} corner={corner} data={data} spec={spec} barLabel={bar.label} onFieldChange={onFieldChange} />)}
      </div>
    </section>
  );
}

export default function FourBarQuickAdjust({ setup, onFieldChange, compact = false, disabledReason }: FourBarQuickAdjustProps) {
  if (!setup) {
    return <div className="rounded-xl border border-dashed border-outline-variant bg-surface-container p-4 font-mono text-sm text-on-surface-variant">{disabledReason ?? 'Select a setup for this car to adjust four-bar.'}</div>;
  }
  return (
    <div className={compact ? 'space-y-4' : 'space-y-4 rounded-xl border-2 border-primary/60 bg-surface-container-high p-4'}>
      {!compact && <div><h3 className="font-display text-lg font-bold uppercase tracking-wide text-on-surface">FOUR-BAR / BIRDCAGE</h3><p className="font-mono text-xs text-on-surface-variant">Both rear corners. Top and bottom bars. Change one item, then log result.</p></div>}
      {(['lr', 'rr'] as const).map(corner => (
        <section key={corner} className="space-y-3 rounded-xl border border-outline-variant bg-surface-container-low p-3">
          <h4 className="font-display text-base font-bold uppercase text-primary">{corner === 'lr' ? 'Left Rear' : 'Right Rear'}</h4>
          {BAR_SPECS.map(bar => <BarSection key={bar.label} corner={corner} data={setup[corner]} bar={bar} onFieldChange={onFieldChange} />)}
          {setup[corner].bottomBarAngle && !setup[corner].bottomBarAngRH && !setup[corner].bottomBarAngFD && (
            <p className="rounded border border-outline-variant bg-surface px-3 py-2 font-mono text-xs text-on-surface-variant">Legacy bottom angle: {setup[corner].bottomBarAngle}. Measurement position was not recorded; enter Ride Height or Full Droop above when known.</p>
          )}
        </section>
      ))}
    </div>
  );
}
