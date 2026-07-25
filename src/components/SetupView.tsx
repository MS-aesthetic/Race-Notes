import React, { useState } from 'react';
import { Setup, CornerSetup, TireInventoryItem, Car, ShockSession, RaceWeekend } from '../types';
import { User } from '@supabase/supabase-js';
import { uploadAttachment, deleteAttachment } from '../lib/sync';
import SmasherLoadsView from './SmasherLoadsView';
import SetupDiffView from './SetupDiffView';
import CarRequiredPrompt from './CarRequiredPrompt';
import { byActiveCar } from '../lib/scope';
import { sortBySize } from '../lib/tireSize';
import EmptyState from './ui/EmptyState';
import NumberStepper from './ui/NumberStepper';
import FourBarQuickAdjust from './FourBarQuickAdjust';
import TiresSubView from './TiresSubView';
import { cloneSetup, makeBlankSetup, pickImmediatePriorSetupForCar, pickLatestSetupForCar } from '../lib/setupCompat';
import { calculateTireStagger, NumericCornerField, SETUP_STEPS, formatStoredNumber, legacyValueNote, parseStoredNumber } from '../lib/setupSteps';
import { displayLifecycleText, displayVersionLabel, getSetupEditability, lifecycleLabel } from '../lib/setupLifecycle';
import { applyExplicitCornerField } from '../lib/quickAdjust';
import { buildSetupReport, createPdfFile } from '../lib/exportPdf';
import { shareOrDownloadReport } from '../lib/reportShare';
import ConfirmSheet from './ui/ConfirmSheet';

interface SetupViewProps {
  savedSetups: Setup[];
  activeSetupId: string;
  onSaveSetups: (setups: Setup[], activeId?: string, preserveInfoToast?: boolean) => void;
  user?: User | null;
  tireInventory: TireInventoryItem[];
  onSaveTires: (tires: TireInventoryItem[]) => void;
  onDeleteTireFromCloud?: (tireId: string) => void;
  // Car scoping
  activeCarId?: string | null;
  activeCar?: Car | null;
  shockSessions?: ShockSession[];
  onSaveShockSessions?: (updated: ShockSession[]) => void;
  /** Needed to derive per-tire usage history (which sessions/tracks/corners used each tire). */
  weekends?: RaceWeekend[];
  /** Setup owned by the active Race Day, if one is in play. */
  activeEventSetupId?: string;
  /** Deep-link into a specific sub-tab (e.g. from Dashboard Tires panel). */
  initialSubTab?: 'setups' | 'smasherloads' | 'tires';
  onInfo?: (message: string) => void;
  onHelp?: (section: string) => void;
  onGoToGarage?: () => void;
}

export const SETUP_NOTICE_COPY = {
  historicalSetup: 'Starting and finished snapshots stay unchanged. Clone this setup to make a new editable Current Setup.',
  minimumSetups: 'You must keep at least one setup configuration.',
} as const;

const setupDeleteReason = (reason: ReturnType<typeof getSetupEditability>['reason']): string => {
  if (reason === 'historical-role') return 'Historical setup snapshots cannot be deleted individually.';
  if (reason === 'locked') return 'Locked setups cannot be deleted individually.';
  if (reason === 'finished-weekend') return 'Setups from finished Race Days cannot be deleted individually.';
  if (reason === 'in-play-elsewhere') return 'The active Race Day setup is managed from Race Day.';
  return 'This setup cannot be deleted individually.';
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const parseWeight = (val: string | undefined): number | null => {
  if (!val) return null;
  const n = parseFloat(val.replace(/[^0-9.]/g, ''));
  return isNaN(n) ? null : n;
};

const computeWeightPct = (num: number, total: number): string =>
  total > 0 ? (num / total * 100).toFixed(1) + '%' : '—';

const computeStagger = (rightSize: string, leftSize: string): string => {
  const value = calculateTireStagger(rightSize, leftSize);
  return value === null ? '' : `${value.toFixed(2)}"`;
};

const INP = 'w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-sm px-3 py-1.5 min-h-11 outline-none rounded';
const LBL = 'block min-h-4 truncate text-xs uppercase font-mono font-semibold text-on-surface-variant mb-1 leading-tight';
const STACKED_CORNER_FIELD_CLASS = 'min-w-0 min-[360px]:col-span-2 min-[768px]:col-span-1';
const FULL_WIDTH_CORNER_FIELD_CLASS = 'col-span-1 min-[360px]:col-span-2 min-w-0';

export function LegacySetupLog({ changes }: { changes: Setup['changeLog'] }) {
  const legacyChanges = (changes || []).filter(change => !change.runId);
  if (legacyChanges.length === 0) return null;
  return (
    <details className="mt-3 rounded-lg border border-outline-variant/60 bg-surface-container/50 p-3">
      <summary className="min-h-11 cursor-pointer font-display text-xs font-bold uppercase text-on-surface">Legacy log</summary>
      <div className="mt-2 space-y-2">
        {legacyChanges.map(change => (
          <div key={change.id} className="rounded border border-outline-variant/40 bg-surface p-2">
            <div className="flex items-start justify-between gap-2">
              <span className="font-mono text-xs font-bold text-on-surface">{change.label}</span>
              <time className="font-mono text-[9px] text-on-surface-variant">{new Date(change.timestamp).toLocaleString()}</time>
            </div>
            {(change.before || change.after) && <p className="mt-1 font-mono text-[10px] text-on-surface-variant">{change.before || '—'} → <span className="text-primary">{change.after || '—'}</span></p>}
          </div>
        ))}
      </div>
    </details>
  );
}

// ─── Corner Form Sub-component ────────────────────────────────────────────────

interface CornerFormProps {
  corner: 'lf' | 'rf' | 'lr' | 'rr';
  cornerLabel: string;
  data: CornerSetup;
  isRear: boolean;
  tireInventory: TireInventoryItem[];
  usedTireIds?: string[];
  loadSessions: ShockSession[];
  onFieldChange: (field: keyof CornerSetup, value: string) => void;
  onBatchChange: (updates: Partial<CornerSetup>) => void;
}

function NumericCornerFieldInput({ label, field, data, onFieldChange }: {
  label: string;
  field: NumericCornerField;
  data: CornerSetup;
  onFieldChange: CornerFormProps['onFieldChange'];
}) {
  const raw = String(data[field] ?? '');
  const spec = SETUP_STEPS[field];
  const legacy = legacyValueNote(raw);
  return (
    <div className={STACKED_CORNER_FIELD_CLASS}>
      <label className={LBL}>
        {label}{field === 'loadCtoC' && data.rideHeightNeedsReview ? ' *' : ''}
      </label>
      <NumberStepper
        value={parseStoredNumber(raw)}
        onChange={value => onFieldChange(field, formatStoredNumber(value, spec))}
        step={spec.step}
        min={spec.min}
        decimals={spec.decimals}
        unit={spec.unit}
        ariaLabel={label}
        layout="stacked"
      />
      {legacy && <p className="mt-1 font-mono text-xs text-on-surface-variant">Legacy: {legacy}</p>}
      {field === 'loadCtoC' && data.rideHeightNeedsReview && (
        <p className="mt-1 font-mono text-xs font-bold text-on-surface">* Spring rounds changed. Recheck and update this measurement.</p>
      )}
    </div>
  );
}

function CornerForm({ corner, cornerLabel, data, isRear, tireInventory, usedTireIds = [], loadSessions, onFieldChange, onBatchChange }: CornerFormProps) {
  return (
    <div className="min-w-0 bg-surface-container border border-outline-variant flex flex-col rounded overflow-hidden">
      <div className="min-w-0 border-b border-outline-variant px-1.5 sm:px-4 py-2 flex flex-wrap items-center gap-1 sm:gap-2 bg-surface-container-low">
        <span className="material-symbols-outlined shrink-0 text-primary text-[18px]">directions_car</span>
        <h4 className="min-w-0 break-words font-label-sm text-xs uppercase text-on-surface font-bold leading-tight tracking-normal sm:tracking-widest">{cornerLabel}</h4>
      </div>
      <div className="min-w-0 p-2 sm:p-3 grid grid-cols-1 min-[360px]:grid-cols-2 gap-2 items-start">

        {/* Tire from Inventory picker */}
        <div className="col-span-1 min-[360px]:col-span-2 min-w-0 bg-surface-container p-2 rounded border border-outline-variant/30 flex flex-wrap items-center justify-between gap-2">
          <label className="text-[10px] uppercase font-mono font-semibold text-on-surface-variant flex-shrink-0">Tire</label>
          <select
            value={data.tireInventoryId || ''}
            onChange={(e) => {
              const tireId = e.target.value;
              if (tireId) {
                const tire = tireInventory.find(t => t.id === tireId);
                if (tire) {
                  onBatchChange({ tireInventoryId: tireId, tireSize: tire.size, tireComp: tire.compound, backspacing: tire.wheelBackspacing });
                  return;
                }
              }
              onFieldChange('tireInventoryId', tireId);
            }}
            className="w-full min-w-0 min-h-11 bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-sm px-2 outline-none rounded"
          >
            <option value="">-- Select from Inventory --</option>
            {sortBySize(tireInventory.filter(t => !usedTireIds.includes(t.id) || t.id === (data.tireInventoryId || ''))).map(t => (
              <option key={t.id} value={t.id}>#{t.tireNumber} — {t.size} {t.compound}</option>
            ))}
          </select>
        </div>

        {/* Bound Load Graph */}
        <div className="col-span-1 min-[360px]:col-span-2 min-w-0 bg-surface-container p-2 rounded border border-outline-variant/30 flex flex-wrap items-center justify-between gap-2">
          <label className="text-[10px] uppercase font-mono font-semibold text-on-surface-variant">Bound Load Graph</label>
          <select value={data.boundGraphId || ''} onChange={(e) => onFieldChange('boundGraphId', e.target.value)}
            className="w-full min-w-0 min-h-11 bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-sm px-2 outline-none rounded">
            <option value="">-- None --</option>
            {data.boundGraphId && !loadSessions.some(session => session.id === data.boundGraphId) && (
              <option value={data.boundGraphId}>Saved Load Session (unavailable)</option>
            )}
            {loadSessions.map(session => (
              <option key={session.id} value={session.id}>{session.label || session.shock} · {session.date}</option>
            ))}
          </select>
        </div>

        {/* Spring */}
        <div className={FULL_WIDTH_CORNER_FIELD_CLASS}>
          <label className={LBL}>Spring</label>
          <input type="text" value={data.spring || ''} onChange={e => onFieldChange('spring', e.target.value)} className={INP} />
        </div>

        {/* Spring Height (rear only) */}
        {isRear && (
          <NumericCornerFieldInput label="Spring Height" field="springHeight" data={data} onFieldChange={onFieldChange} />
        )}

        {/* Shock */}
        <div className={FULL_WIDTH_CORNER_FIELD_CLASS}>
          <label className={LBL}>Shock</label>
          <input type="text" value={data.shock || ''} onChange={e => onFieldChange('shock', e.target.value)} className={INP} />
        </div>
        <div className={FULL_WIDTH_CORNER_FIELD_CLASS}>
          <label className={LBL}>Shock Note</label>
          <input type="text" value={data.shockNote || ''} onChange={e => onFieldChange('shockNote', e.target.value)} className={INP} />
        </div>

        {/* Front-specific fields */}
        {!isRear && (
          <>
            <NumericCornerFieldInput label="Scale Weight" field="loadWeight" data={data} onFieldChange={onFieldChange} />
            <NumericCornerFieldInput label="Ride Height C-to-C" field="loadCtoC" data={data} onFieldChange={onFieldChange} />
            <NumericCornerFieldInput label="Caster" field="caster" data={data} onFieldChange={onFieldChange} />
            <NumericCornerFieldInput label="Camber" field="camber" data={data} onFieldChange={onFieldChange} />
          </>
        )}

        {/* Rear-specific fields */}
        {isRear && (
          <>
            <NumericCornerFieldInput label="Scale Weight" field="loadWeight" data={data} onFieldChange={onFieldChange} />
            <NumericCornerFieldInput label="Ride Height C-to-C" field="loadCtoC" data={data} onFieldChange={onFieldChange} />
            <NumericCornerFieldInput label="Droop" field="droop" data={data} onFieldChange={onFieldChange} />
            <NumericCornerFieldInput label="Preload" field="preload" data={data} onFieldChange={onFieldChange} />
          </>
        )}

        {/* Tire fields (all corners) */}
        <div className="min-w-0">
          <label className={LBL}>Tire Compound</label>
          <input type="text" value={data.tireComp || ''} onChange={e => onFieldChange('tireComp', e.target.value)} className={INP} />
        </div>
        <div className="min-w-0">
          <label className={LBL}>Tire Size</label>
          <input type="text" value={data.tireSize || ''} onChange={e => onFieldChange('tireSize', e.target.value)} className={INP} />
        </div>
        <div className={STACKED_CORNER_FIELD_CLASS}>
          <NumericCornerFieldInput label="Pressure" field="tirePress" data={data} onFieldChange={onFieldChange} />
          {data.pressureSourceNote && <p className="mt-1 font-mono text-xs text-on-surface-variant">{displayLifecycleText(data.pressureSourceNote)}</p>}
        </div>
        <NumericCornerFieldInput label="Backspacing" field="backspacing" data={data} onFieldChange={onFieldChange} />
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function SetupView({
  savedSetups, activeSetupId, onSaveSetups, user, tireInventory, onSaveTires, onDeleteTireFromCloud,
  activeCarId = null, activeCar = null, shockSessions = [], onSaveShockSessions, weekends = [], activeEventSetupId,
  initialSubTab, onInfo, onHelp, onGoToGarage,
}: SetupViewProps) {
  const [subTab, setSubTab] = useState<'setups' | 'smasherloads' | 'tires'>(initialSubTab ?? 'setups');
  const [setups, setSetups] = useState<Setup[]>(savedSetups);
  const [activeId, setActiveId] = useState<string>(activeSetupId);
  const [expandedId, setExpandedId] = useState<string | null>(activeSetupId);
  const [newSetupName, setNewSetupName] = useState('');
  const [newSetupNameError, setNewSetupNameError] = useState(false);
  const [renameFocusSetupId, setRenameFocusSetupId] = useState<string | null>(null);
  const chassisInputRefs = React.useRef<Record<string, HTMLInputElement | null>>({});
  const [uploadingSetupId, setUploadingSetupId] = useState<string | null>(null);
  const [sharingSetupId, setSharingSetupId] = useState<string | null>(null);
  const [pendingDeleteSetupId, setPendingDeleteSetupId] = useState<string | null>(null);

  const [showCompare, setShowCompare] = useState(false);
  const [compareIds, setCompareIds] = useState<{ a?: string; b?: string }>({});

  React.useEffect(() => { setSetups(savedSetups); }, [savedSetups]);
  React.useEffect(() => { setActiveId(activeSetupId); }, [activeSetupId]);
  React.useEffect(() => {
    if (!renameFocusSetupId || expandedId !== renameFocusSetupId) return;
    chassisInputRefs.current[renameFocusSetupId]?.focus();
    setRenameFocusSetupId(null);
  }, [expandedId, renameFocusSetupId]);

  // ── Setup CRUD ────────────────────────────────────────────────────────────────

  const updateAndSaveSetups = (updatedList: Setup[], nextActiveId?: string, preserveInfoToast = false) => {
    setSetups(updatedList);
    onSaveSetups(updatedList, nextActiveId, preserveInfoToast);
  };

  const handleCornerChange = (setupId: string, corner: 'lf' | 'rf' | 'lr' | 'rr', field: keyof CornerSetup, value: string) => {
    const updated = setups.map((s) => {
      if (s.id !== setupId) return s;
      const updatedCorner = {
        ...applyExplicitCornerField(s[corner], field, value),
        ...(field === 'tirePress' ? { pressureSourceNote: value.trim() ? 'Adjusted in Setups' : undefined } : {}),
      };
      let updatedSetup: Setup = { ...s, [corner]: updatedCorner };
      if (field === 'tireSize') {
        const lfSize = corner === 'lf' ? value : s.lf.tireSize;
        const rfSize = corner === 'rf' ? value : s.rf.tireSize;
        const lrSize = corner === 'lr' ? value : s.lr.tireSize;
        const rrSize = corner === 'rr' ? value : s.rr.tireSize;
        updatedSetup = { ...updatedSetup, frontStagger: computeStagger(rfSize, lfSize), rearStagger: computeStagger(rrSize, lrSize) };
      }
      return updatedSetup;
    });
    updateAndSaveSetups(updated, activeId);
  };

  const handleCornerBatchChange = (setupId: string, corner: 'lf' | 'rf' | 'lr' | 'rr', updates: Partial<CornerSetup>) => {
    const updated = setups.map((s) => {
      if (s.id !== setupId) return s;
      const pressureChanged = 'tirePress' in updates && updates.tirePress !== s[corner].tirePress;
      const updatedCorner = {
        ...s[corner],
        ...updates,
        ...('loadCtoC' in updates ? { rideHeightNeedsReview: false } : {}),
        ...(pressureChanged
          ? { pressureSourceNote: updates.tirePress?.trim() ? 'Loaded from tire inventory' : undefined }
          : {}),
      };
      let updatedSetup: Setup = { ...s, [corner]: updatedCorner };
      if ('tireSize' in updates) {
        const lfSize = corner === 'lf' ? (updates.tireSize || '') : s.lf.tireSize;
        const rfSize = corner === 'rf' ? (updates.tireSize || '') : s.rf.tireSize;
        const lrSize = corner === 'lr' ? (updates.tireSize || '') : s.lr.tireSize;
        const rrSize = corner === 'rr' ? (updates.tireSize || '') : s.rr.tireSize;
        updatedSetup = { ...updatedSetup, frontStagger: computeStagger(rfSize, lfSize), rearStagger: computeStagger(rrSize, lrSize) };
      }
      return updatedSetup;
    });
    updateAndSaveSetups(updated, activeId);
  };

  const handleMetadataChange = (setupId: string, field: keyof Setup, value: string) => {
    const updated = setups.map((s) => s.id !== setupId ? s : { ...s, [field]: value });
    updateAndSaveSetups(updated, activeId);
  };

  const handleAddNewSetup = (e: { preventDefault: () => void }, mode: 'copy' | 'blank' = 'copy') => {
    e.preventDefault();
    const source = mode === 'copy' ? pickLatestSetupForCar(setups, activeCarId) : null;
    const trimmedName = newSetupName.trim();
    if (!source && !trimmedName) {
      setNewSetupNameError(true);
      return;
    }
    setNewSetupNameError(false);
    const today = new Date().toLocaleDateString([], { month: 'short', day: '2-digit', year: 'numeric' });
    const sourceName = source
      ? source.track.trim() || source.chassis.trim() || displayVersionLabel(source).trim() || 'Current setup'
      : '';
    const sourceDate = source?.date.trim() || '';
    const sourceLabel = source ? `${sourceName}${sourceDate ? ` ${sourceDate}` : ''}` : '';
    const name = trimmedName || `${sourceName} ${today} — from ${sourceLabel || sourceName}`;
    const overrides: Partial<Setup> = {
      id: `setup-rec-${Date.now()}`,
      chassis: name,
      date: today,
      carType: activeCar?.carType ?? source?.carType ?? '',
      carId: activeCarId ?? undefined,
      screenshots: [],
      versionLabel: source ? `${displayVersionLabel(source) || source.chassis} Copy` : lifecycleLabel('current'),
      lifecycleRole: 'current',
      sourceSetupId: source?.id,
      weekendId: undefined,
      lockedAt: undefined,
      changeLog: [],
      updatedAt: new Date().toISOString(),
    };
    const newSetup = source ? cloneSetup(source, overrides) : makeBlankSetup(overrides);
    if (source) {
      const note = `Copied from ${sourceLabel}`;
      for (const corner of ['lf', 'rf', 'lr', 'rr'] as const) {
        newSetup[corner] = { ...newSetup[corner], pressureSourceNote: note };
      }
      onInfo?.(note);
    }
    const updatedList = [newSetup, ...setups];
    setExpandedId(newSetup.id);
    setNewSetupName('');
    setActiveId(newSetup.id);
    updateAndSaveSetups(updatedList, newSetup.id, !!source);
  };

  const handleRenameSetup = (event: React.MouseEvent<HTMLButtonElement>, target: Setup) => {
    event.stopPropagation();
    if (!getSetupEditability(target, weekends, activeEventSetupId).editable) return;
    setExpandedId(target.id);
    setRenameFocusSetupId(target.id);
  };

  const handleDeleteSetup = (setupId: string) => {
    const target = setups.find((setupItem) => setupItem.id === setupId);
    if (!target) return;
    if (!getSetupEditability(target, weekends, activeEventSetupId).deletable) {
      return;
    }
    if (setups.length <= 1) { onInfo?.('minimumSetups'); return; }
    setPendingDeleteSetupId(setupId);
  };

  const confirmDeleteSetup = () => {
    const setupId = pendingDeleteSetupId;
    setPendingDeleteSetupId(null);
    if (!setupId) return;
    const target = setups.find((setupItem) => setupItem.id === setupId);
    if (!target) return;
    if (!activeCarId || target.carId !== activeCarId) return;
    if (!getSetupEditability(target, weekends, activeEventSetupId).deletable) {
      return;
    }
    if (setups.length <= 1) {
      onInfo?.('minimumSetups');
      return;
    }
    const filtered = setups.filter((s) => s.id !== setupId);
    let nextActiveId = activeId;
    if (activeId === setupId) {
      nextActiveId = pickLatestSetupForCar(filtered, activeCarId)?.id ?? '';
      setActiveId(nextActiveId);
    }
    if (expandedId === setupId) setExpandedId(nextActiveId || null);
    updateAndSaveSetups(filtered, nextActiveId);
  };

  const handleCloneSetup = (setupId: string) => {
    const target = setups.find((s) => s.id === setupId);
    if (!target) return;
    const today = new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    const cloned = cloneSetup(target, {
      id: `setup-rec-${Date.now()}`,
      chassis: `${target.chassis} (Copy)`,
      date: today,
      carId: activeCarId ?? target.carId,
      screenshots: [], // clear stale photos on clone
      versionLabel: `${displayVersionLabel(target) || target.chassis} Copy`,
      lifecycleRole: 'current',
      sourceSetupId: target.id,
      weekendId: undefined,
      lockedAt: undefined,
      changeLog: [],
      updatedAt: new Date().toISOString(),
    });
    setExpandedId(cloned.id);
    updateAndSaveSetups([cloned, ...setups], activeId);
  };

  const handleUploadAttachment = async (setupId: string, file: File) => {
    if (!user) { onInfo?.('Please sign in to attach files.'); return; }
    setUploadingSetupId(setupId);
    try {
      const url = await uploadAttachment(file, user.id, 'setups', setupId);
      const updated = setups.map(s => s.id === setupId ? { ...s, screenshots: [...(s.screenshots || []), url] } : s);
      updateAndSaveSetups(updated, activeId);
    } catch { onInfo?.('Upload failed.'); } finally { setUploadingSetupId(null); }
  };

  const handleDeleteSetupAttachment = async (setupId: string, url: string) => {
    if (user) await deleteAttachment(url);
    const updated = setups.map(s => s.id === setupId ? { ...s, screenshots: (s.screenshots || []).filter(u => u !== url) } : s);
    updateAndSaveSetups(updated, activeId);
  };

  // ── Sub-tab button helper ─────────────────────────────────────────────────────

  const SubTabBtn = ({ tab, label, icon }: { tab: typeof subTab; label: string; icon: string }) => (
    <button
      onClick={() => setSubTab(tab)}
      className={`min-w-0 flex flex-col items-center justify-center gap-1 px-1 sm:px-2 py-3 rounded-lg font-mono text-[11px] uppercase font-bold border-2 transition-all min-h-[60px] ${
        subTab === tab ? 'bg-primary/15 text-primary border-primary/50' : 'border-outline-variant/50 text-on-surface-muted hover:border-outline-variant'
      }`}
    >
      <span className="material-symbols-outlined text-[26px] leading-none" style={{ fontVariationSettings: subTab === tab ? "'FILL' 1" : "'FILL' 0" }}>{icon}</span>
      <span className="w-full min-w-0 break-words leading-tight text-center">{label}</span>
    </button>
  );

  // Filter at display time only — never mutate the master arrays.
  const displayedSetups = activeCarId ? byActiveCar<Setup>(setups, activeCarId) : [];
  const displayedTires = activeCarId ? byActiveCar<TireInventoryItem>(tireInventory, activeCarId) : [];
  const noCar = !activeCarId;
  const activeSetup = displayedSetups.find(s => s.id === activeId) ?? pickLatestSetupForCar(setups, activeCarId);
  const priorSetup = (target: Setup) => pickImmediatePriorSetupForCar(displayedSetups, target);
  const handleShareSetup = async (target: Setup) => {
    if (sharingSetupId) return;
    setSharingSetupId(target.id);
    try {
      // A saved setup card may belong to another car or weekend. Do not attach
      // the app's currently open run unless ownership is proven.
      const result = await shareOrDownloadReport(createPdfFile(buildSetupReport(target)), `Share ${displayVersionLabel(target) || target.chassis || 'setup'}`);
      if (result.status === 'shared') onInfo?.('Setup PDF shared.');
      else if (result.status === 'downloaded') onInfo?.('Setup PDF downloaded.');
      else if (result.status === 'failed') onInfo?.(result.error || 'Setup PDF could not be shared.');
    } catch (error) {
      onInfo?.(error instanceof Error ? error.message : 'Setup PDF could not be created.');
    } finally {
      setSharingSetupId(null);
    }
  };

  return (
    <div className="space-y-3" id="setup-view-root">

      {/* Page Header & sub-tab nav */}
      <div className="flex flex-col gap-2 border-b border-outline-variant pb-3">
        <h2 className="font-display font-bold tracking-tight text-2xl uppercase text-on-surface">Setups</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <SubTabBtn tab="setups" label="Setups" icon="settings_input_component" />
          <SubTabBtn tab="smasherloads" label="Loads" icon="show_chart" />
          <SubTabBtn tab="tires" label="Tires" icon="tire_repair" />
          <button
            onClick={() => setShowCompare(true)}
            disabled={displayedSetups.length < 2}
            className={`min-w-0 flex flex-col items-center justify-center gap-1 px-1 sm:px-2 py-3 rounded-lg font-mono text-[11px] uppercase font-bold border-2 transition-all min-h-[60px] ${
              displayedSetups.length < 2
                ? 'border-outline-variant/30 text-on-surface-muted opacity-30 cursor-not-allowed'
                : 'border-outline-variant/50 text-on-surface-muted hover:border-outline-variant'
            }`}
          >
            <span className="material-symbols-outlined text-[26px] leading-none">compare_arrows</span>
            <span className="w-full min-w-0 break-words leading-tight text-center">Compare</span>
          </button>
        </div>
      </div>

      {/* ══ SETUPS TAB ══════════════════════════════════════════════════════════ */}
      {subTab === 'setups' && (
        <div className="space-y-6">

          {/* Create New Setup */}
          {noCar ? (
            <CarRequiredPrompt onAddCar={() => onGoToGarage?.()} />
          ) : (
            <form onSubmit={handleAddNewSetup} className="bg-surface-container border border-outline-variant rounded-lg p-3 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
              <div className="flex-grow">
                <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1 font-mono">Create New Setup</label>
                <input id="new-setup-name" type="text" placeholder="e.g. Chassis #42 - Slick Track Soft" value={newSetupName}
                  required={!activeSetup}
                  aria-invalid={newSetupNameError || undefined}
                  aria-describedby={newSetupNameError ? 'new-setup-name-error' : undefined}
                  onChange={(e) => {
                    setNewSetupName(e.target.value);
                    if (e.target.value.trim()) setNewSetupNameError(false);
                  }}
                  className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface text-sm px-3 py-2 outline-none rounded" />
                {newSetupNameError && <p id="new-setup-name-error" role="alert" className="mt-1 text-xs font-mono text-primary">Name this setup</p>}
              </div>
              <button type="submit" disabled={!activeSetup && !newSetupName.trim()}
                className="self-end sm:self-auto min-h-11 px-4 bg-surface-bright border border-outline text-primary hover:bg-primary/10 hover:border-primary uppercase font-mono text-xs font-bold transition-all flex items-center gap-2 rounded disabled:cursor-not-allowed disabled:opacity-40">
                <span className="material-symbols-outlined text-[16px]">content_copy</span>{activeSetup ? 'Copy latest' : 'Create starting setup'}
              </button>
              {activeSetup && <button type="button" disabled={!newSetupName.trim()} onClick={(event) => handleAddNewSetup(event, 'blank')}
                className="self-end sm:self-auto min-h-11 px-4 border border-outline-variant text-on-surface-variant hover:text-on-surface uppercase font-mono text-xs font-bold transition-all rounded disabled:cursor-not-allowed disabled:opacity-40">
                Start blank
              </button>}
            </form>
          )}

          {/* Accordion list — filtered to active car */}
          <div className="space-y-3" id="setups-accordion">
            {!noCar && displayedSetups.length === 0 && (
              <EmptyState
                icon="tune"
                title="No setups for this car"
                body="Start with a saved setup, then tune from what the track tells you."
                cta={{ label: 'Create starting setup', onClick: () => document.getElementById('new-setup-name')?.focus() }}
              />
            )}
            {displayedSetups.map((setupItem) => {
              const isExpanded = expandedId === setupItem.id;
              const isActive = activeId === setupItem.id;
              const editability = getSetupEditability(setupItem, weekends, activeEventSetupId);
              const isReadOnly = !editability.editable;
              return (
                <div key={setupItem.id}
                  className={`bg-surface-container border rounded-lg overflow-hidden transition-all duration-200 ${isActive ? 'border-primary shadow-[0_0_12px_rgba(211,47,47,0.1)]' : 'border-outline-variant/60'}`}
                  id={`setup-card-${setupItem.id}`}>

                  {/* Card header */}
                  <div onClick={() => setExpandedId(isExpanded ? null : setupItem.id)}
                    className="p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-surface-container-low hover:bg-surface-container-high transition-all cursor-pointer select-none">
                    <div className="w-full min-w-0 sm:w-auto flex items-start gap-2 sm:gap-3">
                      <div className="mt-1 shrink-0">
                        {isActive
                          ? <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>stars</span>
                          : <span className="material-symbols-outlined text-on-surface-muted">settings_input_component</span>}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="min-w-0 break-words font-display text-base font-bold text-on-surface uppercase tracking-wide">{setupItem.chassis}</h3>
                          {!isReadOnly && <button type="button" title="Rename setup" aria-label="Rename setup" onClick={(event) => handleRenameSetup(event, setupItem)}
                            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded text-on-surface-variant transition-colors hover:text-primary">
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>}
                          {isActive && <span className="bg-primary/15 text-primary border border-primary/30 text-[9px] uppercase font-bold px-1.5 py-0.5 rounded tracking-wide">Active trackside</span>}
                          {isReadOnly && <span className="border border-outline-variant text-on-surface-variant text-[9px] uppercase font-bold px-1.5 py-0.5 rounded tracking-wide">View only</span>}
                        </div>
                        {setupItem.versionLabel && <p className="font-mono text-[11px] font-bold text-primary mt-1">{displayVersionLabel(setupItem)}</p>}
                        <div className="text-xs text-on-surface-variant font-mono mt-0.5 flex flex-wrap gap-x-3 gap-y-1">
                          <span>Track: <strong>{setupItem.track || 'Not Specified'}</strong></span>
                          <span>Class: <strong>{setupItem.carType || 'Dirt Late Model'}</strong></span>
                          {setupItem.date && <span>Date: <strong>{setupItem.date}</strong></span>}
                        </div>
                      </div>
                    </div>
                    <div className="w-full min-w-0 flex flex-wrap items-center justify-end gap-2 self-stretch sm:self-auto sm:w-auto">
                      {!isActive && isExpanded && !isReadOnly && (
                        <button type="button" onClick={(e) => { e.stopPropagation(); setActiveId(setupItem.id); updateAndSaveSetups(setups, setupItem.id); }}
                          className="min-w-0 px-3 py-1 bg-primary text-on-primary font-mono text-[10px] font-bold uppercase rounded hover:opacity-90 transition-all shadow">
                          Use Setup
                        </button>
                      )}
                      <div className="w-full min-w-0 flex flex-wrap items-center justify-end gap-1 border-t border-outline-variant/60 pt-2 sm:w-auto sm:border-t-0 sm:border-l sm:pt-0 sm:pl-2">
                        {!editability.deletable && <span id={`setup-delete-reason-${setupItem.id}`} className="sr-only">{setupDeleteReason(editability.reason)}</span>}
                        <button type="button" title="Share setup PDF" disabled={sharingSetupId === setupItem.id} onClick={(e) => { e.stopPropagation(); void handleShareSetup(setupItem); }}
                          className="flex min-h-11 min-w-11 items-center justify-center text-on-surface-variant hover:text-primary transition-colors rounded disabled:opacity-40">
                          <span className="material-symbols-outlined text-[18px]">{sharingSetupId === setupItem.id ? 'progress_activity' : 'share'}</span>
                        </button>
                        <button type="button" title="Clone setup" onClick={(e) => { e.stopPropagation(); handleCloneSetup(setupItem.id); }}
                          className="p-1.5 text-on-surface-variant hover:text-primary transition-colors rounded">
                          <span className="material-symbols-outlined text-[18px]">content_copy</span>
                        </button>
                        <button type="button" title="Compare setup" disabled={!priorSetup(setupItem)} onClick={(e) => {
                          e.stopPropagation();
                          const prior = priorSetup(setupItem);
                          if (!prior) return;
                          setCompareIds({ a: prior.id, b: setupItem.id });
                          setShowCompare(true);
                        }}
                          className={`p-1.5 rounded ${priorSetup(setupItem) ? 'text-on-surface-variant hover:text-primary' : 'text-on-surface-muted opacity-30 cursor-not-allowed'}`}>
                          <span className="material-symbols-outlined text-[18px]">compare_arrows</span>
                        </button>
                        <button type="button" title={editability.deletable ? 'Delete setup permanently' : setupDeleteReason(editability.reason)} aria-describedby={!editability.deletable ? `setup-delete-reason-${setupItem.id}` : undefined} disabled={!editability.deletable} onClick={(e) => { e.stopPropagation(); handleDeleteSetup(setupItem.id); }}
                          className="flex min-h-11 min-w-11 items-center justify-center text-on-surface-variant hover:text-red-400 transition-colors rounded disabled:text-on-surface-muted disabled:opacity-40">
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Collapsible content */}
                  {isExpanded && (
                    <div className="min-w-0 p-2 sm:p-3 border-t border-outline-variant/50 bg-surface-container-low">
                      {isReadOnly && (
                        <div className="mb-4 space-y-3 rounded-lg border border-outline-variant bg-surface-container p-3 font-mono text-xs text-on-surface-variant">
                          <p>{SETUP_NOTICE_COPY.historicalSetup}</p>
                          {!editability.deletable && (
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p>{setupDeleteReason(editability.reason)}</p>
                              <button type="button" onClick={() => onGoToGarage?.()} className="min-h-11 rounded border border-outline-variant px-3 text-xs font-bold uppercase text-on-surface hover:border-primary hover:text-primary">
                                Manage car in Garage
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      <fieldset disabled={isReadOnly} className="min-w-0 space-y-6 disabled:opacity-75">

                      {/* Metadata grid */}
                      <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-2">
                        <div>
                          <label htmlFor={`setup-chassis-${setupItem.id}`} className="block text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-1">Chassis</label>
                          <input id={`setup-chassis-${setupItem.id}`} ref={(node) => { chassisInputRefs.current[setupItem.id] = node; }} type="text" value={setupItem.chassis} onChange={(e) => handleMetadataChange(setupItem.id, 'chassis', e.target.value)}
                            className="w-full min-h-11 bg-surface border border-outline-variant focus:border-primary text-on-surface text-sm font-mono font-semibold px-3 py-1.5 outline-none rounded" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-1">Track</label>
                          <input type="text" placeholder="e.g. Eldora Speedway" value={setupItem.track} onChange={(e) => handleMetadataChange(setupItem.id, 'track', e.target.value)}
                            className="w-full min-h-11 bg-surface border border-outline-variant focus:border-primary text-on-surface text-sm font-mono font-semibold px-3 py-1.5 outline-none rounded" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-1">Last Updated</label>
                          <input type="text" value={setupItem.date} onChange={(e) => handleMetadataChange(setupItem.id, 'date', e.target.value)}
                            className="w-full min-h-11 bg-surface border border-outline-variant focus:border-primary text-on-surface text-sm font-mono font-semibold px-3 py-1.5 outline-none rounded" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-1">Car Class / Series</label>
                          <input type="text" placeholder="e.g. USMTS Late Model" value={setupItem.carType} onChange={(e) => handleMetadataChange(setupItem.id, 'carType', e.target.value)}
                            className="w-full min-h-11 bg-surface border border-outline-variant focus:border-primary text-on-surface text-sm font-mono font-semibold px-3 py-1.5 outline-none rounded" />
                        </div>
                        <div className="min-[360px]:col-span-2">
                          <label className="block text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-1">Toe</label>
                          <input type="text" placeholder='e.g. 1/8" Total Toe-Out' value={setupItem.toe || ''} onChange={(e) => handleMetadataChange(setupItem.id, 'toe', e.target.value)}
                            className="w-full min-h-11 bg-surface border border-outline-variant focus:border-primary text-on-surface text-sm font-mono font-semibold px-3 py-1.5 outline-none rounded" />
                        </div>
                      </div>

                      {/* Notes */}
                      <div>
                        <label className="block text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-1">Additional Notes</label>
                        <textarea placeholder="Enter setup notes..." value={setupItem.notes || ''} onChange={(e) => handleMetadataChange(setupItem.id, 'notes', e.target.value)}
                          className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface text-sm font-mono font-semibold px-3 py-1.5 outline-none rounded min-h-[60px] resize-y" />
                      </div>

                      {/* Car setup details */}
                      <div className="bg-surface-container/50 border border-outline-variant/60 rounded-lg p-3 space-y-3">
                        <div className="flex items-center gap-2 border-b border-outline-variant/40 pb-2">
                          <span className="material-symbols-outlined text-primary text-[18px]">tune</span>
                          <h4 className="font-label-sm text-xs font-bold uppercase text-on-surface tracking-wider">Car Setup Details</h4>
                        </div>

                        <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-1">Gear</label>
                            <input type="text" placeholder="e.g. 6.14" value={setupItem.gear || ''} onChange={(e) => handleMetadataChange(setupItem.id, 'gear', e.target.value)}
                              className="w-full min-h-11 bg-surface border border-outline-variant focus:border-primary text-on-surface text-sm font-mono font-semibold px-3 py-1.5 outline-none rounded" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-1">JBar Length</label>
                            <input type="text" placeholder="e.g. #3" value={setupItem.jbar || ''} onChange={(e) => handleMetadataChange(setupItem.id, 'jbar', e.target.value)}
                              className="w-full min-h-11 bg-surface border border-outline-variant focus:border-primary text-on-surface text-sm font-mono font-semibold px-3 py-1.5 outline-none rounded" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-1">J-Bar Frame Height</label>
                            <input type="text" placeholder='e.g. 9.5"' value={setupItem.jbarFrameHeight || ''} onChange={(e) => handleMetadataChange(setupItem.id, 'jbarFrameHeight', e.target.value)}
                              className="w-full min-h-11 bg-surface border border-outline-variant focus:border-primary text-on-surface text-sm font-mono font-semibold px-3 py-1.5 outline-none rounded" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-1">J-Bar Pinion Height</label>
                            <input type="text" placeholder='e.g. 8.0"' value={setupItem.jbarPinionHeight || ''} onChange={(e) => handleMetadataChange(setupItem.id, 'jbarPinionHeight', e.target.value)}
                              className="w-full min-h-11 bg-surface border border-outline-variant focus:border-primary text-on-surface text-sm font-mono font-semibold px-3 py-1.5 outline-none rounded" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-1">Pull Bar Frame Hole</label>
                            <input type="text" placeholder="e.g. Top" value={setupItem.pullBarFrameHole || ''} onChange={(e) => handleMetadataChange(setupItem.id, 'pullBarFrameHole', e.target.value)}
                              className="w-full min-h-11 bg-surface border border-outline-variant focus:border-primary text-on-surface text-sm font-mono font-semibold px-3 py-1.5 outline-none rounded" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-1">Pull Bar Rear Hole</label>
                            <input type="text" placeholder="e.g. Middle" value={setupItem.pullBarRearHole || ''} onChange={(e) => handleMetadataChange(setupItem.id, 'pullBarRearHole', e.target.value)}
                              className="w-full min-h-11 bg-surface border border-outline-variant focus:border-primary text-on-surface text-sm font-mono font-semibold px-3 py-1.5 outline-none rounded" />
                          </div>
                        </div>

                        {/* Computed stagger display */}
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { label: 'Front Stagger (RF − LF)', value: setupItem.frontStagger || computeStagger(setupItem.rf.tireSize, setupItem.lf.tireSize) },
                            { label: 'Rear Stagger (RR − LR)', value: setupItem.rearStagger || computeStagger(setupItem.rr.tireSize, setupItem.lr.tireSize) },
                          ].map(({ label, value }) => (
                            <div key={label} className="bg-surface-container border border-outline-variant/40 rounded p-2.5">
                              <span className="text-[9px] font-mono uppercase font-bold text-on-surface-muted block">{label}</span>
                              <span className="font-mono text-lg font-black text-primary tracking-tight">{value || <span className="text-on-surface-muted text-xs font-normal">— enter tire sizes</span>}</span>
                            </div>
                          ))}
                        </div>

                        {/* Computed weight percentages */}
                        {(() => {
                          const lfW = parseWeight(setupItem.lf.loadWeight);
                          const rfW = parseWeight(setupItem.rf.loadWeight);
                          const lrW = parseWeight(setupItem.lr.loadWeight ?? setupItem.lr.load);
                          const rrW = parseWeight(setupItem.rr.loadWeight ?? setupItem.rr.load);
                          const total = (lfW ?? 0) + (rfW ?? 0) + (lrW ?? 0) + (rrW ?? 0);
                          const hasAll = lfW !== null && rfW !== null && lrW !== null && rrW !== null;
                          const noseP  = hasAll ? computeWeightPct((lfW!) + (rfW!), total) : '—';
                          const leftP  = hasAll ? computeWeightPct((lfW!) + (lrW!), total) : '—';
                          const crossP = hasAll ? computeWeightPct((lrW!) + (rfW!), total) : '—';
                          const lrSplit = lrW !== null && rrW !== null ? ((lrW - rrW).toFixed(1) + ' lb') : '—';
                          return (
                            <div>
                              <div className="flex items-center gap-1.5 mb-2">
                                <span className="material-symbols-outlined text-primary text-[14px]">calculate</span>
                                <span className="text-[9px] font-mono uppercase font-bold text-on-surface-muted tracking-wider">Weight Calculations</span>
                                {!hasAll && <span className="text-[9px] font-mono text-on-surface-muted italic">— enter all 4 scale weights</span>}
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {[
                                  { label: 'Nose %', value: noseP, hint: '(LF+RF) / Total' },
                                  { label: 'Left %', value: leftP, hint: '(LF+LR) / Total' },
                                  { label: 'Cross %', value: crossP, hint: '(LR+RF) / Total' },
                                  { label: 'LR Split', value: lrSplit, hint: 'LR − RR' },
                                ].map(({ label, value, hint }) => (
                                  <div key={label} className="bg-surface-container border border-outline-variant/40 rounded p-2.5">
                                    <span className="text-[9px] font-mono uppercase font-bold text-on-surface-muted block">{label}</span>
                                    <span className="font-mono text-lg font-black text-primary tracking-tight">{value}</span>
                                    <span className="text-[8px] font-mono text-on-surface-muted block mt-0.5">{hint}</span>
                                  </div>
                                ))}
                              </div>
                              {hasAll && (
                                <div className="mt-2 bg-surface-container border border-outline-variant/30 rounded px-3 py-1.5 flex items-center justify-between">
                                  <span className="text-[9px] font-mono uppercase text-on-surface-muted">Total Scale Weight</span>
                                  <span className="font-mono text-sm font-black text-on-surface">{total.toFixed(0)} lb</span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>

                      {/* 4 Corner forms */}
                      <div className="min-w-0 grid grid-cols-1 min-[360px]:grid-cols-2 gap-1.5 min-[360px]:gap-2">
                        {(['lf', 'rf', 'lr', 'rr'] as const).map((corner, _, all) => {
                          const usedTireIds = all
                            .filter(c => c !== corner)
                            .map(c => setupItem[c].tireInventoryId)
                            .filter(Boolean) as string[];
                          const labels: Record<string, string> = { lf: 'Left Front Corner', rf: 'Right Front Corner', lr: 'Left Rear Corner', rr: 'Right Rear Corner' };
                          return (
                            <CornerForm
                              key={corner}
                              corner={corner}
                              cornerLabel={labels[corner]}
                              data={setupItem[corner]}
                              isRear={corner === 'lr' || corner === 'rr'}
                              tireInventory={displayedTires}
                              usedTireIds={usedTireIds}
                              loadSessions={shockSessions.filter(session => session.carId === setupItem.carId && session.corner === corner.toUpperCase())}
                              onFieldChange={(f, v) => handleCornerChange(setupItem.id, corner, f, v)}
                              onBatchChange={(u) => handleCornerBatchChange(setupItem.id, corner, u)}
                            />
                          );
                        })}
                      </div>

                      {/* Four-bar is part of this setup, after all four corner values. */}
                      <FourBarQuickAdjust
                        setup={setupItem}
                        compact
                        onHelp={onHelp}
                        onFieldChange={(corner, field, value) => handleCornerChange(setupItem.id, corner, field, value)}
                      />

                      {/* Attachments */}
                      <div className="bg-surface-container/50 border border-outline-variant/60 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary text-[18px]">photo_library</span>
                            <h4 className="font-label-sm text-xs font-bold uppercase text-on-surface tracking-wider">Attachments / Photos</h4>
                          </div>
                          <label className={`text-[10px] uppercase font-mono font-bold transition-colors ${user && uploadingSetupId !== setupItem.id ? 'text-primary hover:underline cursor-pointer' : 'text-on-surface-muted cursor-not-allowed'}`}>
                            {uploadingSetupId === setupItem.id
                              ? <span className="flex items-center gap-1 text-on-surface-muted"><span className="material-symbols-outlined text-[14px]">sync</span>Uploading...</span>
                              : <>+ Add File<input type="file" multiple accept="image/*,application/pdf" className="hidden"
                                  disabled={!user || uploadingSetupId === setupItem.id}
                                  onChange={e => { if (!e.target.files) return; (Array.from(e.target.files) as File[]).forEach(f => handleUploadAttachment(setupItem.id, f)); e.target.value = ''; }} /></>}
                          </label>
                        </div>
                        {!user && <p className="text-[10px] text-on-surface-muted font-mono italic mb-2">Sign in to attach files.</p>}
                        {setupItem.screenshots && setupItem.screenshots.length > 0 ? (
                          <div className="flex overflow-x-auto gap-2 pb-2 custom-scrollbar">
                            {setupItem.screenshots.map((src, i) => (
                              <div key={i} className="relative shrink-0">
                                {src.toLowerCase().includes('.pdf')
                                  ? <a href={src} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center h-20 w-20 rounded border border-outline-variant bg-surface text-on-surface-variant hover:text-primary transition-colors">
                                      <span className="material-symbols-outlined text-[28px]">picture_as_pdf</span>
                                      <span className="font-mono text-[9px] mt-1 uppercase">PDF</span>
                                    </a>
                                  : <a href={src} target="_blank" rel="noopener noreferrer">
                                      <img src={src} alt={`attachment ${i + 1}`} className="h-20 rounded border border-outline-variant object-cover hover:opacity-90 transition-opacity" />
                                    </a>}
                                <button onClick={() => handleDeleteSetupAttachment(setupItem.id, src)}
                                  className="absolute top-1 right-1 bg-black/70 rounded-full w-5 h-5 flex items-center justify-center text-white hover:bg-black/90">
                                  <span className="material-symbols-outlined text-[12px]">close</span>
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : user ? (
                          <p className="text-[10px] text-on-surface-muted font-mono italic">No attachments yet. Add photos, data sheets, or time slips.</p>
                        ) : null}
                      </div>
                      </fieldset>

                      <LegacySetupLog changes={setupItem.changeLog} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ SMASHER LOADS TAB ═══════════════════════════════════════════════════ */}
      {subTab === 'smasherloads' && (
        <SmasherLoadsView
          activeCarId={activeCarId}
          sessions={shockSessions}
          onSave={onSaveShockSessions}
          onGoToGarage={onGoToGarage}
          onHelp={onHelp}
        />
      )}

      {/* ══ TIRES TAB ═══════════════════════════════════════════════════════════ */}
      {subTab === 'tires' && (
        <TiresSubView
          tires={tireInventory}
          activeCarId={activeCarId}
          activeSetup={activeSetup}
          setups={setups}
          weekends={weekends}
          onSaveTires={onSaveTires}
          onDeleteTireFromCloud={onDeleteTireFromCloud}
          onGoToGarage={onGoToGarage}
        />
      )}

      {/* Setup Compare modal */}
      {showCompare && (
          <SetupDiffView
            setups={displayedSetups}
            initialAId={compareIds.a}
            initialBId={compareIds.b}
            onClose={() => setShowCompare(false)}
            onHelp={onHelp}
        />
      )}
      <ConfirmSheet
        open={!!pendingDeleteSetupId}
        title="Delete setup?"
        body="Are you sure you want to delete this setup?"
        confirmLabel="Delete"
        cancelLabel="Keep"
        destructive
        onConfirm={confirmDeleteSetup}
        onCancel={() => setPendingDeleteSetupId(null)}
      />
    </div>
  );
}
