import React, { useState } from 'react';
import { Setup, CornerSetup, TireInventoryItem, Car, ShockSession, RaceWeekend } from '../types';
import { INITIAL_SETUP } from '../data';
import { User } from '@supabase/supabase-js';
import { uploadAttachment, deleteAttachment } from '../lib/sync';
import SmasherLoadsView from './SmasherLoadsView';
import { byActiveCar } from '../lib/scope';
import { getTireUsageHistory, getTireTotalLaps, downloadTireUsageCsv, printTireUsageReport } from '../lib/tireHistory';
import { compareTireSize, sortBySize } from '../lib/tireSize';

interface SetupViewProps {
  savedSetups: Setup[];
  activeSetupId: string;
  onSaveSetups: (setups: Setup[], activeId?: string) => void;
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
  /** Deep-link into a specific sub-tab (e.g. from Dashboard Tires panel). */
  initialSubTab?: 'setups' | 'smasherloads' | 'tires';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const parseTireSize = (s: string): number => {
  const n = parseFloat((s || '').replace(/[^0-9.]/g, ''));
  return isNaN(n) ? 0 : n;
};

const parseWeight = (val: string | undefined): number | null => {
  if (!val) return null;
  const n = parseFloat(val.replace(/[^0-9.]/g, ''));
  return isNaN(n) ? null : n;
};

const computeWeightPct = (num: number, total: number): string =>
  total > 0 ? (num / total * 100).toFixed(1) + '%' : '—';

const computeStagger = (rightSize: string, leftSize: string): string => {
  const r = parseTireSize(rightSize);
  const l = parseTireSize(leftSize);
  if (r === 0 && l === 0) return '';
  return `${(r - l).toFixed(2)}"`;
};

const INP = 'w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-1.5 outline-none rounded';
const LBL = 'text-[10px] uppercase font-mono font-semibold text-on-surface-variant block mb-1';

// ─── Corner Form Sub-component ────────────────────────────────────────────────

interface CornerFormProps {
  cornerLabel: string;
  data: CornerSetup;
  isRear: boolean;
  tireInventory: TireInventoryItem[];
  usedTireIds?: string[];
  onFieldChange: (field: keyof CornerSetup, value: string) => void;
  onBatchChange: (updates: Partial<CornerSetup>) => void;
}

function CornerForm({ cornerLabel, data, isRear, tireInventory, usedTireIds = [], onFieldChange, onBatchChange }: CornerFormProps) {
  return (
    <div className="bg-surface-container border border-outline-variant flex flex-col rounded overflow-hidden">
      <div className="border-b border-outline-variant px-4 py-2 flex items-center gap-2 bg-surface-container-low">
        <span className="material-symbols-outlined text-primary text-[18px]">directions_car</span>
        <h4 className="font-label-sm text-xs uppercase text-on-surface font-bold tracking-widest">{cornerLabel}</h4>
      </div>
      <div className="p-4 grid grid-cols-2 gap-4">

        {/* Tire from Inventory picker */}
        <div className="col-span-2 bg-surface-container p-2 rounded border border-outline-variant/30 flex items-center justify-between gap-2">
          <label className="text-[10px] uppercase font-mono font-semibold text-on-surface-variant flex-shrink-0">Tire from Inventory</label>
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
            className="bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-2 py-1 outline-none rounded min-w-[160px]"
          >
            <option value="">-- Select from Inventory --</option>
            {sortBySize(tireInventory.filter(t => !usedTireIds.includes(t.id) || t.id === (data.tireInventoryId || ''))).map(t => (
              <option key={t.id} value={t.id}>#{t.tireNumber} — {t.size} {t.compound}</option>
            ))}
          </select>
        </div>

        {/* Bound Smasher Graph */}
        <div className="col-span-2 bg-surface-container p-2 rounded border border-outline-variant/30 flex items-center justify-between">
          <label className="text-[10px] uppercase font-mono font-semibold text-on-surface-variant">Bound Smasher Graph</label>
          <select value={data.boundGraphId || ''} onChange={(e) => onFieldChange('boundGraphId', e.target.value)}
            className="bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-2 py-1 outline-none rounded min-w-[120px]">
            <option value="">-- None --</option>
            <option value="graph-demo">Sample Dyno Run</option>
          </select>
        </div>

        {/* Spring */}
        <div>
          <label className={LBL}>Spring</label>
          <input type="text" value={data.spring || ''} onChange={e => onFieldChange('spring', e.target.value)} className={INP} />
        </div>

        {/* Spring Height (rear only) */}
        {isRear && (
          <div>
            <label className={LBL}>Spring Height</label>
            <input type="text" placeholder="e.g. 12" value={data.springHeight || ''} onChange={e => onFieldChange('springHeight', e.target.value)} className={INP} />
          </div>
        )}

        {/* Shock */}
        <div>
          <label className={LBL}>Shock</label>
          <input type="text" value={data.shock || ''} onChange={e => onFieldChange('shock', e.target.value)} className={INP} />
        </div>

        {/* Front-specific fields */}
        {!isRear && (
          <>
            <div>
              <label className={LBL}>Scale Weight (lb)</label>
              <input type="text" value={data.loadWeight || ''} onChange={e => onFieldChange('loadWeight', e.target.value)} className={INP} />
            </div>
            <div>
              <label className={LBL}>C-to-C (in)</label>
              <input type="text" value={data.loadCtoC || ''} onChange={e => onFieldChange('loadCtoC', e.target.value)} className={INP} />
            </div>
            <div>
              <label className={LBL}>Caster (deg)</label>
              <input type="text" value={data.caster || ''} onChange={e => onFieldChange('caster', e.target.value)} className={INP} />
            </div>
            <div>
              <label className={LBL}>Camber (deg)</label>
              <input type="text" value={data.camber || ''} onChange={e => onFieldChange('camber', e.target.value)} className={INP} />
            </div>
          </>
        )}

        {/* Rear-specific fields */}
        {isRear && (
          <>
            <div>
              <label className={LBL}>Load Scale (lb)</label>
              <input type="text" placeholder="e.g. 600" value={data.load || ''} onChange={e => onFieldChange('load', e.target.value)} className={INP} />
            </div>
            <div>
              <label className={LBL}>C-to-C (in)</label>
              <input type="text" placeholder="e.g. 15.0" value={data.loadCtoC || ''} onChange={e => onFieldChange('loadCtoC', e.target.value)} className={INP} />
            </div>
            <div>
              <label className={LBL}>Top Bar Length</label>
              <input type="text" placeholder='e.g. 12.0"' value={data.topBarLength || ''} onChange={e => onFieldChange('topBarLength', e.target.value)} className={INP} />
            </div>
            <div>
              <label className={LBL}>Bottom Bar Length</label>
              <input type="text" placeholder='e.g. 9.5"' value={data.bottomBarLength || ''} onChange={e => onFieldChange('bottomBarLength', e.target.value)} className={INP} />
            </div>
            <div>
              <label className={LBL}>Birdcage Hole (Frame)</label>
              <input type="text" placeholder="e.g. Frame Hole" value={data.botBarHFrame || ''} onChange={e => onFieldChange('botBarHFrame', e.target.value)} className={INP} />
            </div>
            <div>
              <label className={LBL}>Birdcage Hole (Birdcage)</label>
              <input type="text" placeholder="e.g. Birdcage Hole" value={data.botBarHBird || ''} onChange={e => onFieldChange('botBarHBird', e.target.value)} className={INP} />
            </div>
            <div>
              <label className={LBL}>Bottom Bar Angle</label>
              <input type="text" placeholder="e.g. 10°" value={data.bottomBarAngle || ''} onChange={e => onFieldChange('bottomBarAngle', e.target.value)} className={INP} />
            </div>
            <div>
              <label className={LBL}>Droop (in)</label>
              <input type="text" placeholder="e.g. 2.50" value={data.droop || ''} onChange={e => onFieldChange('droop', e.target.value)} className={INP} />
            </div>
            <div>
              <label className={LBL}>Preload (in)</label>
              <input type="text" placeholder="e.g. 0.50" value={data.preload || ''} onChange={e => onFieldChange('preload', e.target.value)} className={INP} />
            </div>
          </>
        )}

        {/* Tire fields (all corners) */}
        <div>
          <label className={LBL}>Tire Compound</label>
          <input type="text" value={data.tireComp || ''} onChange={e => onFieldChange('tireComp', e.target.value)} className={INP} />
        </div>
        <div>
          <label className={LBL}>Tire Size</label>
          <input type="text" value={data.tireSize || ''} onChange={e => onFieldChange('tireSize', e.target.value)} className={INP} />
        </div>
        <div>
          <label className={LBL}>Pressure (psi)</label>
          <input type="text" value={data.tirePress || ''} onChange={e => onFieldChange('tirePress', e.target.value)} className={INP} />
        </div>
        <div>
          <label className={LBL}>Backspacing (in)</label>
          <input type="text" placeholder='e.g. 2"' value={data.backspacing || ''} onChange={e => onFieldChange('backspacing', e.target.value)} className={INP} />
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function SetupView({
  savedSetups, activeSetupId, onSaveSetups, user, tireInventory, onSaveTires, onDeleteTireFromCloud,
  activeCarId = null, activeCar = null, shockSessions = [], onSaveShockSessions, weekends = [],
  initialSubTab,
}: SetupViewProps) {
  const [subTab, setSubTab] = useState<'setups' | 'smasherloads' | 'tires'>(initialSubTab ?? 'setups');
  const [setups, setSetups] = useState<Setup[]>(savedSetups);
  const [activeId, setActiveId] = useState<string>(activeSetupId);
  const [expandedId, setExpandedId] = useState<string | null>(activeSetupId);
  const [newSetupName, setNewSetupName] = useState('');
  const [uploadingSetupId, setUploadingSetupId] = useState<string | null>(null);

  // Tire inventory local state
  const [tires, setTires] = useState<TireInventoryItem[]>(tireInventory);
  const [showAddTireForm, setShowAddTireForm] = useState(false);
  const [newTire, setNewTire] = useState<Partial<TireInventoryItem>>({ wheelBackspacing: '2' });
  const [tireSort, setTireSort] = useState<'newest' | 'oldest' | 'size-asc' | 'size-desc'>('newest');
  const [tireCompoundFilter, setTireCompoundFilter] = useState<string>('all');
  const [expandedTireId, setExpandedTireId] = useState<string | null>(null);

  React.useEffect(() => { setSetups(savedSetups); }, [savedSetups]);
  React.useEffect(() => { setTires(tireInventory); }, [tireInventory]);

  // ── Setup CRUD ────────────────────────────────────────────────────────────────

  const updateAndSaveSetups = (updatedList: Setup[], nextActiveId: string) => {
    setSetups(updatedList);
    onSaveSetups(updatedList, nextActiveId);
  };

  const handleCornerChange = (setupId: string, corner: 'lf' | 'rf' | 'lr' | 'rr', field: keyof CornerSetup, value: string) => {
    const updated = setups.map((s) => {
      if (s.id !== setupId) return s;
      const updatedCorner = { ...s[corner], [field]: value };
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
      const updatedCorner = { ...s[corner], ...updates };
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

  const handleAddNewSetup = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newSetupName.trim() || `Setup #${setups.length + 1}`;
    const activeSetup = setups.find((s) => s.id === activeId) || setups[0] || INITIAL_SETUP;
    const newSetup: Setup = {
      ...JSON.parse(JSON.stringify(activeSetup)),
      id: `setup-rec-${Date.now()}`,
      chassis: name,
      date: new Date().toLocaleDateString([], { month: 'short', day: '2-digit', year: 'numeric' }),
      carType: activeCar?.carType ?? activeSetup.carType,
      carId: activeCarId ?? undefined,
    };
    const updatedList = [newSetup, ...setups];
    setExpandedId(newSetup.id);
    setNewSetupName('');
    updateAndSaveSetups(updatedList, setups.length === 0 ? newSetup.id : activeId);
  };

  const handleDeleteSetup = (setupId: string) => {
    if (setups.length <= 1) { alert('You must keep at least one setup configuration.'); return; }
    if (!window.confirm('Are you sure you want to delete this setup?')) return;
    const filtered = setups.filter((s) => s.id !== setupId);
    let nextActiveId = activeId;
    if (activeId === setupId) { nextActiveId = filtered[0].id; setActiveId(nextActiveId); }
    if (expandedId === setupId) setExpandedId(filtered[0].id);
    updateAndSaveSetups(filtered, nextActiveId);
  };

  const handleCloneSetup = (setupId: string) => {
    const target = setups.find((s) => s.id === setupId);
    if (!target) return;
    const cloned: Setup = { ...JSON.parse(JSON.stringify(target)), id: `setup-rec-${Date.now()}`, chassis: `${target.chassis} (Copy)`, carId: activeCarId ?? target.carId };
    setExpandedId(cloned.id);
    updateAndSaveSetups([cloned, ...setups], activeId);
  };

  const handleUploadAttachment = async (setupId: string, file: File) => {
    if (!user) { alert('Please sign in to attach files.'); return; }
    setUploadingSetupId(setupId);
    try {
      const url = await uploadAttachment(file, user.id, 'setups', setupId);
      const updated = setups.map(s => s.id === setupId ? { ...s, screenshots: [...(s.screenshots || []), url] } : s);
      updateAndSaveSetups(updated, activeId);
    } catch { alert('Upload failed.'); } finally { setUploadingSetupId(null); }
  };

  const handleDeleteSetupAttachment = async (setupId: string, url: string) => {
    if (user) await deleteAttachment(url);
    const updated = setups.map(s => s.id === setupId ? { ...s, screenshots: (s.screenshots || []).filter(u => u !== url) } : s);
    updateAndSaveSetups(updated, activeId);
  };

  // ── Tire CRUD ─────────────────────────────────────────────────────────────────

  const saveTires = (updated: TireInventoryItem[]) => { setTires(updated); onSaveTires(updated); };

  const handleAddTire = (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();
    const tire: TireInventoryItem = {
      id: `tire-${Date.now()}`,
      tireNumber: newTire.tireNumber || '',
      size: newTire.size || '',
      compound: newTire.compound || '',
      wheelBackspacing: (newTire.wheelBackspacing as '2' | '3' | '4') || '2',
      durometer: newTire.durometer || '',
      airPressure: newTire.airPressure || '',
      createdAt: now,
      carId: activeCarId ?? undefined,
      dateAdded: now,
      initialAgeDays: Number(newTire.initialAgeDays) || 0,
      usageDates: [],
      heatCycles: 0,
    };
    saveTires([tire, ...tires]);
    setNewTire({ wheelBackspacing: '2' });
    setShowAddTireForm(false);
  };

  const handleDeleteTire = (id: string) => {
    if (!window.confirm('Delete this tire from inventory?')) return;
    saveTires(tires.filter(t => t.id !== id));
    onDeleteTireFromCloud?.(id);
  };

  // ── Sub-tab button helper ─────────────────────────────────────────────────────

  const SubTabBtn = ({ tab, label, icon }: { tab: typeof subTab; label: string; icon: string }) => (
    <button
      onClick={() => setSubTab(tab)}
      className={`flex-1 flex flex-col items-center justify-center gap-1 px-2 py-3 rounded-lg font-mono text-[11px] uppercase font-bold border-2 transition-all min-h-[60px] ${
        subTab === tab ? 'bg-primary/15 text-primary border-primary/50' : 'border-outline-variant/50 text-on-surface-variant/70 hover:border-outline-variant'
      }`}
    >
      <span className="material-symbols-outlined text-[26px] leading-none" style={{ fontVariationSettings: subTab === tab ? "'FILL' 1" : "'FILL' 0" }}>{icon}</span>
      <span className="leading-none text-center">{label}</span>
    </button>
  );

  // Filter at display time only — never mutate the master arrays.
  const displayedSetups = byActiveCar<Setup>(setups, activeCarId);
  const displayedTires = byActiveCar<TireInventoryItem>(tires, activeCarId);
  const noCar = !activeCarId;

  return (
    <div className="space-y-4" id="setup-view-root">

      {/* Page Header & sub-tab nav */}
      <div className="flex flex-col gap-3 border-b border-outline-variant pb-4">
        <div>
          <h2 className="font-display font-bold tracking-tight text-2xl uppercase text-on-surface">Setups</h2>
          <p className="font-label-sm text-xs text-on-surface-variant font-mono mt-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
            Autosaver Active — Changes saved automatically live trackside
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <SubTabBtn tab="setups" label="Setups" icon="settings_input_component" />
          <SubTabBtn tab="smasherloads" label="Loads" icon="show_chart" />
          <SubTabBtn tab="tires" label="Tires" icon="tire_repair" />
        </div>
      </div>

      {/* ══ SETUPS TAB ══════════════════════════════════════════════════════════ */}
      {subTab === 'setups' && (
        <div className="space-y-6">

          {/* Create New Setup */}
          {noCar ? (
            <div className="bg-surface-container border border-outline-variant rounded-lg p-4 flex items-center gap-3 text-on-surface-variant">
              <span className="material-symbols-outlined text-[22px] flex-shrink-0">directions_car</span>
              <span className="font-mono text-xs">Add a car in <strong className="text-on-surface">Settings → Garage</strong> to start.</span>
            </div>
          ) : (
            <form onSubmit={handleAddNewSetup} className="bg-surface-container border border-outline-variant rounded-lg p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              <div className="flex-grow">
                <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1 font-mono">Create New Setup</label>
                <input type="text" placeholder="e.g. Chassis #42 - Slick Track Soft" value={newSetupName}
                  onChange={(e) => setNewSetupName(e.target.value)}
                  className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface text-sm px-3 py-2 outline-none rounded" />
              </div>
              <button type="submit"
                className="self-end sm:self-auto h-10 px-4 bg-surface-bright border border-outline text-primary hover:bg-primary/10 hover:border-primary uppercase font-mono text-xs font-bold transition-all flex items-center gap-2 rounded">
                <span className="material-symbols-outlined text-[16px]">add</span>New Setup
              </button>
            </form>
          )}

          {/* Accordion list — filtered to active car */}
          <div className="space-y-4" id="setups-accordion">
            {displayedSetups.map((setupItem) => {
              const isExpanded = expandedId === setupItem.id;
              const isActive = activeId === setupItem.id;
              return (
                <div key={setupItem.id}
                  className={`bg-surface-container border rounded-lg overflow-hidden transition-all duration-200 ${isActive ? 'border-primary shadow-[0_0_12px_rgba(211,47,47,0.1)]' : 'border-outline-variant/60'}`}
                  id={`setup-card-${setupItem.id}`}>

                  {/* Card header */}
                  <div onClick={() => setExpandedId(isExpanded ? null : setupItem.id)}
                    className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-surface-container-low hover:bg-surface-container-high transition-all cursor-pointer select-none">
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        {isActive
                          ? <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>stars</span>
                          : <span className="material-symbols-outlined text-on-surface-variant/50">settings_input_component</span>}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-display text-base font-bold text-on-surface uppercase tracking-wide">{setupItem.chassis}</h3>
                          {isActive && <span className="bg-primary/15 text-primary border border-primary/30 text-[9px] uppercase font-bold px-1.5 py-0.5 rounded tracking-wide">Active trackside</span>}
                        </div>
                        <div className="text-xs text-on-surface-variant font-mono mt-0.5 flex flex-wrap gap-x-3 gap-y-1">
                          <span>Track: <strong>{setupItem.track || 'Not Specified'}</strong></span>
                          <span>Class: <strong>{setupItem.carType || 'Dirt Late Model'}</strong></span>
                          {setupItem.date && <span>Date: <strong>{setupItem.date}</strong></span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {!isActive && isExpanded && (
                        <button type="button" onClick={(e) => { e.stopPropagation(); setActiveId(setupItem.id); updateAndSaveSetups(setups, setupItem.id); }}
                          className="px-3 py-1 bg-primary text-on-primary font-mono text-[10px] font-bold uppercase rounded hover:opacity-90 transition-all shadow">
                          Use Setup
                        </button>
                      )}
                      <div className="flex items-center gap-1 border-l border-outline-variant/60 pl-2">
                        <button type="button" title="Share with Team" onClick={(e) => { e.stopPropagation(); alert('Data is instantly shared and synced with your Team. Manage your team in the Settings tab.'); }}
                          className="p-1.5 text-on-surface-variant hover:text-primary transition-colors rounded">
                          <span className="material-symbols-outlined text-[18px]">group</span>
                        </button>
                        <button type="button" title="Clone setup" onClick={(e) => { e.stopPropagation(); handleCloneSetup(setupItem.id); }}
                          className="p-1.5 text-on-surface-variant hover:text-primary transition-colors rounded">
                          <span className="material-symbols-outlined text-[18px]">content_copy</span>
                        </button>
                        <button type="button" title="Delete setup permanently" onClick={(e) => { e.stopPropagation(); handleDeleteSetup(setupItem.id); }}
                          className="p-1.5 text-on-surface-variant hover:text-red-400 transition-colors rounded">
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Collapsible content */}
                  {isExpanded && (
                    <div className="p-4 border-t border-outline-variant/50 bg-[#0a0a0a] space-y-6">

                      {/* Metadata grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-1">Chassis</label>
                          <input type="text" value={setupItem.chassis} onChange={(e) => handleMetadataChange(setupItem.id, 'chassis', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface text-xs font-mono font-semibold px-3 py-1.5 outline-none rounded" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-1">Track</label>
                          <input type="text" placeholder="e.g. Eldora Speedway" value={setupItem.track} onChange={(e) => handleMetadataChange(setupItem.id, 'track', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface text-xs font-mono font-semibold px-3 py-1.5 outline-none rounded" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-1">Last Updated</label>
                          <input type="text" value={setupItem.date} onChange={(e) => handleMetadataChange(setupItem.id, 'date', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface text-xs font-mono font-semibold px-3 py-1.5 outline-none rounded" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-1">Car Class / Series</label>
                          <input type="text" placeholder="e.g. USMTS Late Model" value={setupItem.carType} onChange={(e) => handleMetadataChange(setupItem.id, 'carType', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface text-xs font-mono font-semibold px-3 py-1.5 outline-none rounded" />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-1">Toe</label>
                          <input type="text" placeholder='e.g. 1/8" Total Toe-Out' value={setupItem.toe || ''} onChange={(e) => handleMetadataChange(setupItem.id, 'toe', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface text-xs font-mono font-semibold px-3 py-1.5 outline-none rounded" />
                        </div>
                      </div>

                      {/* Notes */}
                      <div>
                        <label className="block text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-1">Additional Notes</label>
                        <textarea placeholder="Enter setup notes..." value={setupItem.notes || ''} onChange={(e) => handleMetadataChange(setupItem.id, 'notes', e.target.value)}
                          className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface text-xs font-mono font-semibold px-3 py-1.5 outline-none rounded min-h-[60px] resize-y" />
                      </div>

                      {/* Car Setup Info Baseline */}
                      <div className="bg-surface-container/50 border border-outline-variant/60 rounded-lg p-4 space-y-4">
                        <div className="flex items-center gap-2 border-b border-outline-variant/40 pb-2">
                          <span className="material-symbols-outlined text-primary text-[18px]">tune</span>
                          <h4 className="font-label-sm text-xs font-bold uppercase text-on-surface tracking-wider">Car Setup Info Baseline</h4>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-1">Gear</label>
                            <input type="text" placeholder="e.g. 6.14" value={setupItem.gear || ''} onChange={(e) => handleMetadataChange(setupItem.id, 'gear', e.target.value)}
                              className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface text-xs font-mono font-semibold px-3 py-1.5 outline-none rounded" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-1">JBar Length</label>
                            <input type="text" placeholder="e.g. #3" value={setupItem.jbar || ''} onChange={(e) => handleMetadataChange(setupItem.id, 'jbar', e.target.value)}
                              className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface text-xs font-mono font-semibold px-3 py-1.5 outline-none rounded" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-1">J-Bar Frame Height</label>
                            <input type="text" placeholder='e.g. 9.5"' value={setupItem.jbarFrameHeight || ''} onChange={(e) => handleMetadataChange(setupItem.id, 'jbarFrameHeight', e.target.value)}
                              className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface text-xs font-mono font-semibold px-3 py-1.5 outline-none rounded" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-1">J-Bar Pinion Height</label>
                            <input type="text" placeholder='e.g. 8.0"' value={setupItem.jbarPinionHeight || ''} onChange={(e) => handleMetadataChange(setupItem.id, 'jbarPinionHeight', e.target.value)}
                              className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface text-xs font-mono font-semibold px-3 py-1.5 outline-none rounded" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-1">Pull Bar Frame Hole</label>
                            <input type="text" placeholder="e.g. Top" value={setupItem.pullBarFrameHole || ''} onChange={(e) => handleMetadataChange(setupItem.id, 'pullBarFrameHole', e.target.value)}
                              className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface text-xs font-mono font-semibold px-3 py-1.5 outline-none rounded" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-1">Pull Bar Rear Hole</label>
                            <input type="text" placeholder="e.g. Middle" value={setupItem.pullBarRearHole || ''} onChange={(e) => handleMetadataChange(setupItem.id, 'pullBarRearHole', e.target.value)}
                              className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface text-xs font-mono font-semibold px-3 py-1.5 outline-none rounded" />
                          </div>
                        </div>

                        {/* Computed stagger display */}
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { label: 'Front Stagger (RF − LF)', value: setupItem.frontStagger || computeStagger(setupItem.rf.tireSize, setupItem.lf.tireSize) },
                            { label: 'Rear Stagger (RR − LR)', value: setupItem.rearStagger || computeStagger(setupItem.rr.tireSize, setupItem.lr.tireSize) },
                          ].map(({ label, value }) => (
                            <div key={label} className="bg-surface-container border border-outline-variant/40 rounded p-2.5">
                              <span className="text-[9px] font-mono uppercase font-bold text-on-surface-variant/70 block">{label}</span>
                              <span className="font-mono text-lg font-black text-primary tracking-tight">{value || <span className="text-on-surface-variant/40 text-xs font-normal">— enter tire sizes</span>}</span>
                            </div>
                          ))}
                        </div>

                        {/* Computed weight percentages */}
                        {(() => {
                          const lfW = parseWeight(setupItem.lf.loadWeight);
                          const rfW = parseWeight(setupItem.rf.loadWeight);
                          const lrW = parseWeight(setupItem.lr.loadWeight);
                          const rrW = parseWeight(setupItem.rr.loadWeight);
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
                                <span className="text-[9px] font-mono uppercase font-bold text-on-surface-variant/70 tracking-wider">Weight Calculations</span>
                                {!hasAll && <span className="text-[9px] font-mono text-on-surface-variant/30 italic">— enter all 4 scale weights</span>}
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {[
                                  { label: 'Nose %', value: noseP, hint: '(LF+RF) / Total' },
                                  { label: 'Left %', value: leftP, hint: '(LF+LR) / Total' },
                                  { label: 'Cross %', value: crossP, hint: '(LR+RF) / Total' },
                                  { label: 'LR Split', value: lrSplit, hint: 'LR − RR' },
                                ].map(({ label, value, hint }) => (
                                  <div key={label} className="bg-surface-container border border-outline-variant/40 rounded p-2.5">
                                    <span className="text-[9px] font-mono uppercase font-bold text-on-surface-variant/70 block">{label}</span>
                                    <span className="font-mono text-lg font-black text-primary tracking-tight">{value}</span>
                                    <span className="text-[8px] font-mono text-on-surface-variant/30 block mt-0.5">{hint}</span>
                                  </div>
                                ))}
                              </div>
                              {hasAll && (
                                <div className="mt-2 bg-surface-container border border-outline-variant/30 rounded px-3 py-1.5 flex items-center justify-between">
                                  <span className="text-[9px] font-mono uppercase text-on-surface-variant/60">Total Scale Weight</span>
                                  <span className="font-mono text-sm font-black text-on-surface">{total.toFixed(0)} lb</span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>

                      {/* 4 Corner forms */}
                      <div className="flex flex-col gap-6">
                        {(['lf', 'rf', 'lr', 'rr'] as const).map((corner, _, all) => {
                          const usedTireIds = all
                            .filter(c => c !== corner)
                            .map(c => setupItem[c].tireInventoryId)
                            .filter(Boolean) as string[];
                          const labels: Record<string, string> = { lf: 'Left Front Corner', rf: 'Right Front Corner', lr: 'Left Rear Corner', rr: 'Right Rear Corner' };
                          return (
                            <CornerForm
                              key={corner}
                              cornerLabel={labels[corner]}
                              data={setupItem[corner]}
                              isRear={corner === 'lr' || corner === 'rr'}
                              tireInventory={displayedTires}
                              usedTireIds={usedTireIds}
                              onFieldChange={(f, v) => handleCornerChange(setupItem.id, corner, f, v)}
                              onBatchChange={(u) => handleCornerBatchChange(setupItem.id, corner, u)}
                            />
                          );
                        })}
                      </div>

                      {/* Attachments */}
                      <div className="bg-surface-container/50 border border-outline-variant/60 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary text-[18px]">photo_library</span>
                            <h4 className="font-label-sm text-xs font-bold uppercase text-on-surface tracking-wider">Attachments / Photos</h4>
                          </div>
                          <label className={`text-[10px] uppercase font-mono font-bold transition-colors ${user && uploadingSetupId !== setupItem.id ? 'text-primary hover:underline cursor-pointer' : 'text-on-surface-variant/40 cursor-not-allowed'}`}>
                            {uploadingSetupId === setupItem.id
                              ? <span className="flex items-center gap-1 text-on-surface-variant/60"><span className="material-symbols-outlined text-[14px]">sync</span>Uploading...</span>
                              : <>+ Add File<input type="file" multiple accept="image/*,application/pdf" className="hidden"
                                  disabled={!user || uploadingSetupId === setupItem.id}
                                  onChange={e => { if (!e.target.files) return; (Array.from(e.target.files) as File[]).forEach(f => handleUploadAttachment(setupItem.id, f)); e.target.value = ''; }} /></>}
                          </label>
                        </div>
                        {!user && <p className="text-[10px] text-on-surface-variant/50 font-mono italic mb-2">Sign in to attach files.</p>}
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
                          <p className="text-[10px] text-on-surface-variant/30 font-mono italic">No attachments yet. Add photos, data sheets, or time slips.</p>
                        ) : null}
                      </div>
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
        />
      )}

      {/* ══ TIRES TAB ═══════════════════════════════════════════════════════════ */}
      {subTab === 'tires' && (
        <div className="space-y-5">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-display font-bold text-lg uppercase text-on-surface tracking-tight">Tire Inventory</h3>
              <p className="text-[10px] font-mono text-on-surface-variant mt-0.5">{displayedTires.length} tire{displayedTires.length !== 1 ? 's' : ''} logged</p>
            </div>
            <div className="flex items-center gap-2">
              {displayedTires.length > 0 && (
                <>
                  <button onClick={() => downloadTireUsageCsv(displayedTires, weekends)}
                    title="Download CSV of every tire's usage history"
                    className="h-9 px-3 border border-outline-variant text-on-surface-variant hover:text-on-surface hover:border-outline font-mono text-[10px] font-bold uppercase rounded transition-all flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px]">download</span>CSV
                  </button>
                  <button onClick={() => printTireUsageReport(displayedTires, weekends)}
                    title="Open a printable tire usage report"
                    className="h-9 px-3 border border-outline-variant text-on-surface-variant hover:text-on-surface hover:border-outline font-mono text-[10px] font-bold uppercase rounded transition-all flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px]">print</span>Report
                  </button>
                </>
              )}
              <button onClick={() => !noCar && setShowAddTireForm(true)}
                disabled={noCar}
                title={noCar ? 'Add a car in Settings → Garage to start.' : undefined}
                className={`h-9 px-3 bg-primary text-on-primary font-mono text-[10px] font-bold uppercase rounded transition-all flex items-center gap-1.5 ${noCar ? 'opacity-40 cursor-not-allowed' : 'hover:opacity-90'}`}>
                <span className="material-symbols-outlined text-[15px]">add</span>Add Tire
              </button>
            </div>
          </div>

          {displayedTires.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
              <span className="material-symbols-outlined text-5xl text-on-surface-variant/30">tire_repair</span>
              <p className="text-on-surface-variant text-sm font-mono uppercase">No tires in inventory</p>
              <p className="text-on-surface-variant/60 text-xs max-w-[260px]">Add tires to quickly assign them to setup corners and auto-populate size, compound, and backspacing.</p>
              {noCar ? (
                <p className="mt-2 font-mono text-xs text-on-surface-variant">Add a car in <strong className="text-on-surface">Settings → Garage</strong> to start.</p>
              ) : (
                <button onClick={() => setShowAddTireForm(true)} className="mt-2 px-4 py-2 bg-primary text-on-primary font-mono text-xs font-bold uppercase rounded hover:opacity-90">
                  + Add First Tire
                </button>
              )}
            </div>
          )}

          {displayedTires.length > 0 && (() => {
            // Unique compounds for filter
            const compounds = Array.from(new Set(displayedTires.map(t => t.compound).filter(Boolean))).sort();
            // Filter
            const filtered = tireCompoundFilter === 'all'
              ? displayedTires
              : displayedTires.filter(t => t.compound === tireCompoundFilter);
            // Sort — size sorts handle both decimals ("86.5") and fractions ("86 1/2")
            const sorted = [...filtered].sort((a, b) => {
              if (tireSort === 'oldest') {
                return (a.createdAt || a.id).localeCompare(b.createdAt || b.id);
              }
              if (tireSort === 'size-asc') return compareTireSize(a.size, b.size);
              if (tireSort === 'size-desc') return compareTireSize(b.size, a.size);
              // newest (default): most recent first
              return (b.createdAt || b.id).localeCompare(a.createdAt || a.id);
            });
            return (
              <>
                {/* Sort + Filter controls */}
                <div className="flex flex-wrap gap-2 items-center">
                  <div className="relative flex-1 min-w-[140px]">
                    <select
                      value={tireSort}
                      onChange={e => setTireSort(e.target.value as typeof tireSort)}
                      className="w-full bg-surface-container border border-outline-variant focus:border-primary text-on-surface font-mono text-[10px] px-2 py-1.5 rounded outline-none appearance-none pr-6"
                    >
                      <option value="newest">Sort: Newest</option>
                      <option value="oldest">Sort: Oldest</option>
                      <option value="size-asc">Sort: Size ↑</option>
                      <option value="size-desc">Sort: Size ↓</option>
                    </select>
                    <span className="material-symbols-outlined absolute right-1.5 top-1/2 -translate-y-1/2 text-[12px] text-on-surface-variant pointer-events-none">expand_more</span>
                  </div>
                  <div className="relative flex-1 min-w-[140px]">
                    <select
                      value={tireCompoundFilter}
                      onChange={e => setTireCompoundFilter(e.target.value)}
                      className="w-full bg-surface-container border border-outline-variant focus:border-primary text-on-surface font-mono text-[10px] px-2 py-1.5 rounded outline-none appearance-none pr-6"
                    >
                      <option value="all">Compound: All</option>
                      {compounds.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <span className="material-symbols-outlined absolute right-1.5 top-1/2 -translate-y-1/2 text-[12px] text-on-surface-variant pointer-events-none">expand_more</span>
                  </div>
                  {tireCompoundFilter !== 'all' && (
                    <button onClick={() => setTireCompoundFilter('all')} className="flex items-center justify-center w-7 h-7 rounded border border-outline-variant bg-surface-container text-on-surface-variant hover:text-on-surface shrink-0">
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {sorted.length === 0 && (
                    <p className="text-center text-xs font-mono text-on-surface-variant/40 py-4">No tires match the current filter.</p>
                  )}
                  {sorted.map(tire => {
                    const isTireExpanded = expandedTireId === tire.id;
                    const usage = isTireExpanded ? getTireUsageHistory(tire.id, weekends) : [];
                    const totalLaps = isTireExpanded ? getTireTotalLaps(usage) : 0;
                    // Lifecycle data for collapsed row
                    const tireAgeDays = tire.dateAdded
                      ? Math.floor((Date.now() - new Date(tire.dateAdded).getTime()) / 86400000) + (tire.initialAgeDays ?? 0)
                      : (tire.initialAgeDays ?? 0);
                    const isAging = (tire.heatCycles ?? 0) >= 8 || tireAgeDays >= 90;
                    return (
                      <div key={tire.id} className="bg-surface-container border border-outline-variant rounded-lg overflow-hidden">
                        <div
                          onClick={() => setExpandedTireId(isTireExpanded ? null : tire.id)}
                          className="px-4 py-2.5 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-surface-container-high transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-3 flex-wrap">
                              <span className="font-mono text-xs font-bold text-primary shrink-0">#{tire.tireNumber}</span>
                              <span className="font-mono text-[11px] text-on-surface">
                                {tire.size}{tire.size && !tire.size.includes('"') ? '"' : ''} <span className="text-outline-variant mx-1">|</span> BS {tire.wheelBackspacing}" <span className="text-outline-variant mx-1">|</span> {tire.compound} <span className="text-outline-variant mx-1">|</span> Duro {tire.durometer || '—'}{tire.airPressure ? <><span className="text-outline-variant mx-1">|</span> {tire.airPressure} psi</> : null}
                              </span>
                            </div>
                            {/* Lifecycle data compact row */}
                            <div className="flex items-center gap-2 mt-1 text-[10px] font-mono text-on-surface-variant/60">
                              <span>🔥 {tire.heatCycles ?? 0} cycles</span>
                              <span className="text-outline-variant/40">|</span>
                              <span>🏁 {getTireTotalLaps(getTireUsageHistory(tire.id, weekends))} laps</span>
                              <span className="text-outline-variant/40">|</span>
                              <span>📅 {tireAgeDays}d</span>
                              {isAging && (
                                <span className="ml-1 px-1 py-0.5 rounded text-[9px] font-bold uppercase bg-yellow-900/40 text-yellow-400">Aging</span>
                              )}
                            </div>
                          </div>
                          <span className="material-symbols-outlined text-on-surface-variant/50 text-[18px] flex-shrink-0">
                            {isTireExpanded ? 'expand_less' : 'expand_more'}
                          </span>
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteTire(tire.id); }} className="p-1.5 text-on-surface-variant/50 hover:text-error transition-colors flex-shrink-0" title="Delete tire">
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>

                        {isTireExpanded && (
                          <div className="border-t border-outline-variant/60 bg-surface-container-low px-4 py-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="font-mono text-[10px] uppercase text-on-surface-variant tracking-wider">
                                Usage History — <span className="text-primary font-bold">{totalLaps} est. laps</span> across {usage.length} session{usage.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                            {usage.length === 0 ? (
                              <p className="text-[11px] font-mono text-on-surface-variant/50 py-2">Not used in any logged session yet.</p>
                            ) : (
                              <div className="space-y-1.5">
                                {usage.map((row, i) => (
                                  <div key={`${row.sessionId}-${row.corner}-${i}`} className="flex items-center justify-between gap-2 text-[11px] font-mono bg-surface rounded px-2.5 py-1.5 border border-outline-variant/30">
                                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                                      <span className="text-on-surface-variant/70 shrink-0">{row.date}</span>
                                      <span className="text-on-surface truncate">{row.track}</span>
                                      <span className="text-outline-variant">|</span>
                                      <span className="text-on-surface-variant/70">{row.sessionName}</span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold uppercase">{row.corner.toUpperCase()}</span>
                                      <span className="text-on-surface-variant/70">{row.sessionType}{row.sessionTypeInferred ? '*' : ''}</span>
                                      <span className="text-on-surface font-bold">{row.estimatedLaps} laps</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}

          {/* Add Tire Modal */}
          {showAddTireForm && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-surface border-2 border-outline rounded-lg p-6 max-w-sm w-full space-y-4 shadow-2xl relative text-on-surface">
                <button onClick={() => setShowAddTireForm(false)} className="absolute top-4 right-4 text-on-surface-variant hover:text-primary transition-colors">
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
                <div className="flex items-center gap-2 border-b border-outline-variant/60 pb-2">
                  <span className="material-symbols-outlined text-primary">tire_repair</span>
                  <h3 className="font-display text-base font-bold uppercase tracking-wide">Add Tire to Inventory</h3>
                </div>
                <form onSubmit={handleAddTire} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-mono uppercase text-on-surface-variant mb-1">Tire #</label>
                      <input type="text" placeholder="e.g. 42" required value={newTire.tireNumber || ''}
                        onChange={e => setNewTire(p => ({ ...p, tireNumber: e.target.value }))}
                        className="w-full bg-surface-container text-xs text-on-surface p-2.5 outline-none border border-outline-variant focus:border-primary rounded font-mono" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-mono uppercase text-on-surface-variant mb-1">Size</label>
                      <input type="text" placeholder='e.g. 84.0"' required value={newTire.size || ''}
                        onChange={e => setNewTire(p => ({ ...p, size: e.target.value }))}
                        onBlur={e => {
                          const v = e.target.value.trim();
                          if (v && !v.endsWith('"')) setNewTire(p => ({ ...p, size: v + '"' }));
                        }}
                        className="w-full bg-surface-container text-xs text-on-surface p-2.5 outline-none border border-outline-variant focus:border-primary rounded font-mono" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono uppercase text-on-surface-variant mb-1">Compound</label>
                    {/* Quick-pick: tap a compound you've used before, or type a new one below. */}
                    {(() => {
                      const knownCompounds = Array.from(
                        new Set<string>(tires.map(t => (t.compound || '').trim()).filter(Boolean))
                      ).sort((a, b) => a.localeCompare(b));
                      if (knownCompounds.length === 0) return null;
                      return (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {knownCompounds.map(c => {
                            const active = (newTire.compound || '').trim().toLowerCase() === c.toLowerCase();
                            return (
                              <button
                                key={c}
                                type="button"
                                onClick={() => setNewTire(p => ({ ...p, compound: c }))}
                                className={`px-3 py-1.5 rounded-full text-[11px] font-mono font-bold border transition-colors min-h-[32px] ${
                                  active
                                    ? 'bg-primary/15 border-primary text-primary'
                                    : 'bg-surface-container border-outline-variant text-on-surface-variant hover:border-outline'
                                }`}
                              >
                                {c}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}
                    <input type="text" placeholder="Tap above or type a new compound" required value={newTire.compound || ''}
                      onChange={e => setNewTire(p => ({ ...p, compound: e.target.value }))}
                      className="w-full bg-surface-container text-xs text-on-surface p-2.5 outline-none border border-outline-variant focus:border-primary rounded" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-mono uppercase text-on-surface-variant mb-1">Wheel Backspacing</label>
                      <select value={newTire.wheelBackspacing || '2'}
                        onChange={e => setNewTire(p => ({ ...p, wheelBackspacing: e.target.value as '2' | '3' | '4' }))}
                        className="w-full bg-surface-container text-xs text-on-surface p-2.5 outline-none border border-outline-variant focus:border-primary rounded font-mono">
                        <option value="2">2"</option>
                        <option value="3">3"</option>
                        <option value="4">4"</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-mono uppercase text-on-surface-variant mb-1">Durometer</label>
                      <input type="text" placeholder="e.g. 55" value={newTire.durometer || ''}
                        onChange={e => setNewTire(p => ({ ...p, durometer: e.target.value }))}
                        className="w-full bg-surface-container text-xs text-on-surface p-2.5 outline-none border border-outline-variant focus:border-primary rounded font-mono" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono uppercase text-on-surface-variant mb-1">Air Pressure (psi)</label>
                    <input type="text" placeholder="e.g. 10" value={newTire.airPressure || ''}
                      onChange={e => setNewTire(p => ({ ...p, airPressure: e.target.value }))}
                      className="w-full bg-surface-container text-xs text-on-surface p-2.5 outline-none border border-outline-variant focus:border-primary rounded font-mono" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono uppercase text-on-surface-variant mb-1">Age (days, for used tires)</label>
                    <input type="number" min="0" placeholder="0" value={newTire.initialAgeDays ?? ''}
                      onChange={e => setNewTire(p => ({ ...p, initialAgeDays: Number(e.target.value) || 0 }))}
                      className="w-full bg-surface-container text-xs text-on-surface p-2.5 outline-none border border-outline-variant focus:border-primary rounded font-mono" />
                  </div>
                  <div className="flex gap-2 pt-1 justify-end font-mono text-xs">
                    <button type="button" onClick={() => setShowAddTireForm(false)}
                      className="px-3 py-2 border border-outline-variant hover:bg-surface-container text-on-surface-variant uppercase rounded">Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-primary text-on-primary font-bold uppercase rounded hover:opacity-90">Add Tire</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
