import React, { useState } from 'react';
import { Setup, CornerSetup } from '../types';

interface SetupViewProps {
  savedSetups: Setup[];
  activeSetupId: string;
  onSaveSetups: (setups: Setup[], activeId?: string) => void;
}

export default function SetupView({
  savedSetups,
  activeSetupId,
  onSaveSetups
}: SetupViewProps) {
  const [setups, setSetups] = useState<Setup[]>(savedSetups);
  const [activeId, setActiveId] = useState<string>(activeSetupId);
  const [expandedId, setExpandedId] = useState<string | null>(activeSetupId);
  const [newSetupName, setNewSetupName] = useState('');

  // Sync local state when parent props update externally
  React.useEffect(() => {
    setSetups(savedSetups);
  }, [savedSetups]);

  // Unified auto-save function
  const updateAndSaveSetups = (updatedList: Setup[], nextActiveId: string) => {
    setSetups(updatedList);
    onSaveSetups(updatedList, nextActiveId);
  };

  // Field change dispatchers
  const handleCornerChange = (
    setupId: string,
    corner: 'lf' | 'rf' | 'lr' | 'rr',
    field: keyof CornerSetup,
    value: string
  ) => {
    const updated = setups.map((s) => {
      if (s.id !== setupId) return s;
      return {
        ...s,
        [corner]: {
          ...s[corner],
          [field]: value
        }
      };
    });
    updateAndSaveSetups(updated, activeId);
  };

  const handleMetadataChange = (setupId: string, field: keyof Setup, value: string) => {
    const updated = setups.map((s) => {
      if (s.id !== setupId) return s;
      return {
        ...s,
        [field]: value
      };
    });
    updateAndSaveSetups(updated, activeId);
  };

  const handleAddNewSetup = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newSetupName.trim() || `Setup #${setups.length + 1}`;
    // Find active setup to clone from, or fallback to first
    const activeSetup = setups.find((s) => s.id === activeId) || setups[0];
    
    const newSetup: Setup = {
      ...JSON.parse(JSON.stringify(activeSetup)),
      id: `setup-rec-${Date.now()}`,
      chassis: name,
      date: new Date().toLocaleDateString([], { month: 'short', day: '2-digit', year: 'numeric' }),
    };

    const updated = [newSetup, ...setups]; // Prepend at the TOP!
    setExpandedId(newSetup.id);
    setNewSetupName('');
    updateAndSaveSetups(updated, activeId);
  };

  const handleDeleteSetup = (setupId: string) => {
    if (setups.length <= 1) {
      alert("You must keep at least one setup configuration.");
      return;
    }
    const confirmDelete = window.confirm("Are you sure you want to delete this setup?");
    if (!confirmDelete) return;

    const filtered = setups.filter((s) => s.id !== setupId);
    let nextActiveId = activeId;
    
    // If deleted setup was active, switch active ID to first remaining
    if (activeId === setupId) {
      nextActiveId = filtered[0].id;
      setActiveId(nextActiveId);
    }
    // If deleted setup was expanded, collapse
    if (expandedId === setupId) {
      setExpandedId(filtered[0].id);
    }
    updateAndSaveSetups(filtered, nextActiveId);
  };

  const handleCloneSetup = (setupId: string) => {
    const target = setups.find((s) => s.id === setupId);
    if (!target) return;

    const cloned: Setup = {
      ...JSON.parse(JSON.stringify(target)),
      id: `setup-rec-${Date.now()}`,
      chassis: `${target.chassis} (Copy)`
    };

    const updated = [cloned, ...setups]; // Prepend at the TOP!
    setExpandedId(cloned.id);
    updateAndSaveSetups(updated, activeId);
  };

  return (
    <div className="space-y-6" id="setup-view-root">
      
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-outline-variant pb-4">
        <div>
          <h2 className="font-display font-bold tracking-tight text-2xl uppercase text-on-surface">
            Setups Database
          </h2>
          <p className="font-label-sm text-xs text-on-surface-variant font-mono mt-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
            Autosaver Active — Changes saved automatically live trackside
          </p>
        </div>
      </div>

      {/* CREATE NEW SETUP QUICK-BAR */}
      <form onSubmit={handleAddNewSetup} className="bg-surface-container border border-outline-variant rounded-lg p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="flex-grow">
          <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1 font-mono">
            Create Custom Setup Clone
          </label>
          <input
            type="text"
            placeholder="e.g. Chassis #42 - Slick Track Soft"
            value={newSetupName}
            onChange={(e) => setNewSetupName(e.target.value)}
            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface text-sm px-3 py-2 outline-none rounded"
          />
        </div>
        <button
          type="submit"
          className="self-end sm:self-auto h-10 px-4 bg-surface-bright border border-outline text-primary hover:bg-primary/10 hover:border-primary uppercase font-mono text-xs font-bold transition-all flex items-center gap-2 rounded"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          New Setup
        </button>
      </form>

      {/* EXPANDABLE ACCORDION LIST OF SAVED SETUPS */}
      <div className="space-y-4" id="setups-accordion">
        {setups.map((setupItem) => {
          const isExpanded = expandedId === setupItem.id;
          const isActive = activeId === setupItem.id;

          return (
            <div
              key={setupItem.id}
              className={`bg-surface-container border rounded-lg overflow-hidden transition-all duration-200 ${
                isActive ? 'border-primary shadow-[0_0_12px_rgba(211,47,47,0.1)]' : 'border-outline-variant/60'
              }`}
              id={`setup-card-${setupItem.id}`}
            >
              {/* Card Header row */}
              <div
                onClick={() => setExpandedId(isExpanded ? null : setupItem.id)}
                className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-surface-container-low hover:bg-surface-container-high transition-all cursor-pointer select-none"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    {isActive ? (
                      <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                        stars
                      </span>
                    ) : (
                      <span className="material-symbols-outlined text-on-surface-variant/50">
                        settings_input_component
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-display text-base font-bold text-on-surface uppercase tracking-wide">
                        {setupItem.chassis}
                      </h3>
                      {isActive && (
                        <span className="bg-primary/15 text-primary border border-primary/30 text-[9px] uppercase font-bold px-1.5 py-0.5 rounded tracking-wide">
                          Active trackside
                        </span>
                      )}
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
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveId(setupItem.id);
                        updateAndSaveSetups(setups, setupItem.id);
                      }}
                      className="px-3 py-1 bg-primary text-on-primary font-mono text-[10px] font-bold uppercase rounded hover:opacity-90 transition-all shadow"
                    >
                      Use Setup
                    </button>
                  )}
                  <div className="flex items-center gap-1 border-l border-outline-variant/60 pl-2">
                    <button
                      type="button"
                      title="Clone this configuration"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCloneSetup(setupItem.id);
                      }}
                      className="p-1 hover:text-primary text-on-surface-variant/70 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">content_copy</span>
                    </button>
                    <button
                      type="button"
                      title="Delete configuration"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSetup(setupItem.id);
                      }}
                      className="p-1 hover:text-error text-on-surface-variant/70 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                    <span className="material-symbols-outlined text-on-surface-variant/70 text-[20px] transition-transform duration-200 ml-1" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }}>
                      expand_more
                    </span>
                  </div>
                </div>
              </div>

              {/* Expansible Configuration View & Detailed Forms */}
              {isExpanded && (
                <div className="p-4 border-t border-outline-variant/50 bg-background/40 space-y-6 animate-fade-in">
                                   {/* SETUP METADATA ROW */}
                  <div className="flex flex-col gap-4 bg-surface-container/30 p-4 rounded border border-outline-variant/30">
                    <div>
                      <label className="block text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-1">Rename Setup Name</label>
                      <input
                        type="text"
                        value={setupItem.chassis}
                        onChange={(e) => handleMetadataChange(setupItem.id, 'chassis', e.target.value)}
                        className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface text-xs font-mono font-semibold px-3 py-1.5 outline-none rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-1">Track</label>
                      <input
                        type="text"
                        value={setupItem.track || ''}
                        onChange={(e) => handleMetadataChange(setupItem.id, 'track', e.target.value)}
                        className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface text-xs font-mono font-semibold px-3 py-1.5 outline-none rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-1">Car Class</label>
                      <input
                        type="text"
                        value={setupItem.carType || ''}
                        onChange={(e) => handleMetadataChange(setupItem.id, 'carType', e.target.value)}
                        className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface text-xs font-mono font-semibold px-3 py-1.5 outline-none rounded"
                      />
                    </div>
                  </div>

                  {/* CAR SETUP baseline INFO */}
                  <div className="bg-surface-container/50 border border-outline-variant/60 rounded-lg p-4 space-y-3.5" id={`car-setup-baseline-${setupItem.id}`}>
                    <div className="flex items-center gap-2 border-b border-outline-variant/40 pb-2">
                      <span className="material-symbols-outlined text-primary text-[18px]">tune</span>
                      <h4 className="font-label-sm text-xs font-bold uppercase text-on-surface tracking-wider">
                        Car Setup Info Baseline
                      </h4>
                    </div>
                    <div className="flex flex-col gap-4">
                      <div>
                        <label className="block text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-1">Gear</label>
                        <input
                          type="text"
                          placeholder="e.g. 6.14"
                          value={setupItem.gear || ''}
                          onChange={(e) => handleMetadataChange(setupItem.id, 'gear', e.target.value)}
                          className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface text-xs font-mono font-semibold px-3 py-1.5 outline-none rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-1">Front Stagger</label>
                        <input
                          type="text"
                          placeholder='e.g. 1.50"'
                          value={setupItem.frontStagger || ''}
                          onChange={(e) => handleMetadataChange(setupItem.id, 'frontStagger', e.target.value)}
                          className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface text-xs font-mono font-semibold px-3 py-1.5 outline-none rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-1">Rear Stagger</label>
                        <input
                          type="text"
                          placeholder='e.g. 3.25"'
                          value={setupItem.rearStagger || ''}
                          onChange={(e) => handleMetadataChange(setupItem.id, 'rearStagger', e.target.value)}
                          className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface text-xs font-mono font-semibold px-3 py-1.5 outline-none rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-1">Pull Bar Frame Hole</label>
                        <input
                          type="text"
                          placeholder="e.g. Top"
                          value={setupItem.pullBarFrameHole || ''}
                          onChange={(e) => handleMetadataChange(setupItem.id, 'pullBarFrameHole', e.target.value)}
                          className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface text-xs font-mono font-semibold px-3 py-1.5 outline-none rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-1">Pull Bar Rear Hole</label>
                        <input
                          type="text"
                          placeholder="e.g. Middle"
                          value={setupItem.pullBarRearHole || ''}
                          onChange={(e) => handleMetadataChange(setupItem.id, 'pullBarRearHole', e.target.value)}
                          className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface text-xs font-mono font-semibold px-3 py-1.5 outline-none rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-1">Pull Bar Angle</label>
                        <input
                          type="text"
                          placeholder="e.g. 12.5°"
                          value={setupItem.pullBarAngle || ''}
                          onChange={(e) => handleMetadataChange(setupItem.id, 'pullBarAngle', e.target.value)}
                          className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface text-xs font-mono font-semibold px-3 py-1.5 outline-none rounded"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 4 CODES OF CORNERS */}
                  <div className="flex flex-col gap-6">
                    
                    {/* LEFT FRONT CORNER */}
                    <div className="bg-surface-container border border-outline-variant flex flex-col rounded overflow-hidden" id={`lf-form-${setupItem.id}`}>
                      <div className="border-b border-outline-variant px-4 py-2 flex items-center gap-2 bg-surface-container-low">
                        <span className="material-symbols-outlined text-primary text-[18px]">directions_car</span>
                        <h4 className="font-label-sm text-xs uppercase text-on-surface font-bold tracking-widest">
                          Left Front Corner
                        </h4>
                      </div>
                      <div className="p-4 flex flex-col gap-4">
                        <div>
                          <label className="text-[10px] uppercase font-mono font-semibold text-on-surface-variant block mb-1">Spring</label>
                          <input
                            type="text"
                            value={setupItem.lf.spring || ''}
                            onChange={(e) => handleCornerChange(setupItem.id, 'lf', 'spring', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-1.5 outline-none rounded"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-mono font-semibold text-on-surface-variant block mb-1">Shock</label>
                          <input
                            type="text"
                            value={setupItem.lf.shock || ''}
                            onChange={(e) => handleCornerChange(setupItem.id, 'lf', 'shock', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-1.5 outline-none rounded"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-mono font-semibold text-on-surface-variant block mb-1">Load Weight (lb)</label>
                          <input
                            type="text"
                            value={setupItem.lf.loadWeight || ''}
                            onChange={(e) => handleCornerChange(setupItem.id, 'lf', 'loadWeight', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-1.5 outline-none rounded"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-mono font-semibold text-on-surface-variant block mb-1">C-to-C (in)</label>
                          <input
                            type="text"
                            value={setupItem.lf.loadCtoC || ''}
                            onChange={(e) => handleCornerChange(setupItem.id, 'lf', 'loadCtoC', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-1.5 outline-none rounded"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-mono font-semibold text-on-surface-variant block mb-1">Caster (deg)</label>
                          <input
                            type="text"
                            value={setupItem.lf.caster || ''}
                            onChange={(e) => handleCornerChange(setupItem.id, 'lf', 'caster', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-1.5 outline-none rounded"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-mono font-semibold text-on-surface-variant block mb-1">Camber (deg)</label>
                          <input
                            type="text"
                            value={setupItem.lf.camber || ''}
                            onChange={(e) => handleCornerChange(setupItem.id, 'lf', 'camber', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-1.5 outline-none rounded"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-mono font-semibold text-on-surface-variant block mb-1">Tire Compound</label>
                          <input
                            type="text"
                            value={setupItem.lf.tireComp || ''}
                            onChange={(e) => handleCornerChange(setupItem.id, 'lf', 'tireComp', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-1.5 outline-none rounded"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-mono font-semibold text-on-surface-variant block mb-1">Tire Size</label>
                          <input
                            type="text"
                            value={setupItem.lf.tireSize || ''}
                            onChange={(e) => handleCornerChange(setupItem.id, 'lf', 'tireSize', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-1.5 outline-none rounded"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-mono font-semibold text-on-surface-variant block mb-1">Pressure (psi)</label>
                          <input
                            type="text"
                            value={setupItem.lf.tirePress || ''}
                            onChange={(e) => handleCornerChange(setupItem.id, 'lf', 'tirePress', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-1.5 outline-none rounded animate-pulse-once"
                          />
                        </div>
                      </div>
                    </div>

                    {/* RIGHT FRONT CORNER */}
                    <div className="bg-surface-container border border-outline-variant flex flex-col rounded overflow-hidden" id={`rf-form-${setupItem.id}`}>
                      <div className="border-b border-outline-variant px-4 py-2 flex items-center gap-2 bg-surface-container-low">
                        <span className="material-symbols-outlined text-primary text-[18px]">directions_car</span>
                        <h4 className="font-label-sm text-xs uppercase text-on-surface font-bold tracking-widest">
                          Right Front Corner
                        </h4>
                      </div>
                      <div className="p-4 flex flex-col gap-4">
                        <div>
                          <label className="text-[10px] uppercase font-mono font-semibold text-on-surface-variant block mb-1">Spring</label>
                          <input
                            type="text"
                            value={setupItem.rf.spring || ''}
                            onChange={(e) => handleCornerChange(setupItem.id, 'rf', 'spring', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-1.5 outline-none rounded"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-mono font-semibold text-on-surface-variant block mb-1">Shock</label>
                          <input
                            type="text"
                            value={setupItem.rf.shock || ''}
                            onChange={(e) => handleCornerChange(setupItem.id, 'rf', 'shock', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-1.5 outline-none rounded"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-mono font-semibold text-on-surface-variant block mb-1">Load Weight (lb)</label>
                          <input
                            type="text"
                            value={setupItem.rf.loadWeight || ''}
                            onChange={(e) => handleCornerChange(setupItem.id, 'rf', 'loadWeight', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-1.5 outline-none rounded"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-mono font-semibold text-on-surface-variant block mb-1">C-to-C (in)</label>
                          <input
                            type="text"
                            value={setupItem.rf.loadCtoC || ''}
                            onChange={(e) => handleCornerChange(setupItem.id, 'rf', 'loadCtoC', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-1.5 outline-none rounded"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-mono font-semibold text-on-surface-variant block mb-1">Caster (deg)</label>
                          <input
                            type="text"
                            value={setupItem.rf.caster || ''}
                            onChange={(e) => handleCornerChange(setupItem.id, 'rf', 'caster', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-1.5 outline-none rounded"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-mono font-semibold text-on-surface-variant block mb-1">Camber (deg)</label>
                          <input
                            type="text"
                            value={setupItem.rf.camber || ''}
                            onChange={(e) => handleCornerChange(setupItem.id, 'rf', 'camber', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-1.5 outline-none rounded"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-mono font-semibold text-on-surface-variant block mb-1">Tire Compound</label>
                          <input
                            type="text"
                            value={setupItem.rf.tireComp || ''}
                            onChange={(e) => handleCornerChange(setupItem.id, 'rf', 'tireComp', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-1.5 outline-none rounded"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-mono font-semibold text-on-surface-variant block mb-1">Tire Size</label>
                          <input
                            type="text"
                            value={setupItem.rf.tireSize || ''}
                            onChange={(e) => handleCornerChange(setupItem.id, 'rf', 'tireSize', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-1.5 outline-none rounded"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-mono font-semibold text-on-surface-variant block mb-1">Pressure (psi)</label>
                          <input
                            type="text"
                            value={setupItem.rf.tirePress || ''}
                            onChange={(e) => handleCornerChange(setupItem.id, 'rf', 'tirePress', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-1.5 outline-none rounded"
                          />
                        </div>
                      </div>
                    </div>

                    {/* LEFT REAR CORNER */}
                    <div className="bg-surface-container border border-outline-variant flex flex-col rounded overflow-hidden" id={`lr-form-${setupItem.id}`}>
                      <div className="border-b border-outline-variant px-4 py-2 flex items-center gap-2 bg-surface-container-low">
                        <span className="material-symbols-outlined text-primary text-[18px]">directions_car</span>
                        <h4 className="font-label-sm text-xs uppercase text-on-surface font-bold tracking-widest">
                          Left Rear Corner
                        </h4>
                      </div>
                      <div className="p-4 flex flex-col gap-4">
                        <div>
                          <label className="text-[10px] uppercase font-mono font-semibold text-on-surface-variant block mb-1">Spring</label>
                          <input
                            type="text"
                            placeholder="e.g. 200"
                            value={setupItem.lr.spring || ''}
                            onChange={(e) => handleCornerChange(setupItem.id, 'lr', 'spring', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-1.5 outline-none rounded"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-mono font-semibold text-on-surface-variant block mb-1">Spring Height</label>
                          <input
                            type="text"
                            placeholder="e.g. 12"
                            value={setupItem.lr.springHeight || ''}
                            onChange={(e) => handleCornerChange(setupItem.id, 'lr', 'springHeight', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-1.5 outline-none rounded"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-mono font-semibold text-on-surface-variant block mb-1">Shock</label>
                          <input
                            type="text"
                            value={setupItem.lr.shock || ''}
                            onChange={(e) => handleCornerChange(setupItem.id, 'lr', 'shock', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-1.5 outline-none rounded"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-mono font-semibold text-on-surface-variant block mb-1">Load Scale (lb)</label>
                          <input
                            type="text"
                            placeholder="e.g. 600"
                            value={setupItem.lr.load || ''}
                            onChange={(e) => handleCornerChange(setupItem.id, 'lr', 'load', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-1.5 outline-none rounded"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-mono font-semibold text-on-surface-variant block mb-1">C-to-C (in)</label>
                          <input
                            type="text"
                            placeholder="e.g. 15.0"
                            value={setupItem.lr.loadCtoC || ''}
                            onChange={(e) => handleCornerChange(setupItem.id, 'lr', 'loadCtoC', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-1.5 outline-none rounded"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-mono font-semibold text-on-surface-variant block mb-1">Birdcage Hole (Frame)</label>
                          <input
                            type="text"
                            placeholder="e.g. Frame Hole"
                            value={setupItem.lr.botBarHFrame || ''}
                            onChange={(e) => handleCornerChange(setupItem.id, 'lr', 'botBarHFrame', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-1.5 outline-none rounded"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-mono font-semibold text-on-surface-variant block mb-1">Birdcage Hole (Birdcage)</label>
                          <input
                            type="text"
                            placeholder="e.g. Birdcage Hole"
                            value={setupItem.lr.botBarHBird || ''}
                            onChange={(e) => handleCornerChange(setupItem.id, 'lr', 'botBarHBird', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-1.5 outline-none rounded"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-mono font-semibold text-on-surface-variant block mb-1">Bottom Bar Angle</label>
                          <input
                            type="text"
                            placeholder="e.g. 10°"
                            value={setupItem.lr.bottomBarAngle || ''}
                            onChange={(e) => handleCornerChange(setupItem.id, 'lr', 'bottomBarAngle', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-1.5 outline-none rounded"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-mono font-semibold text-on-surface-variant block mb-1">Droop (in)</label>
                          <input
                            type="text"
                            placeholder="e.g. 2.50"
                            value={setupItem.lr.droop || ''}
                            onChange={(e) => handleCornerChange(setupItem.id, 'lr', 'droop', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-1.5 outline-none rounded"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-mono font-semibold text-on-surface-variant block mb-1">Rear Gear Ratio</label>
                          <input
                            type="text"
                            value={setupItem.lr.rearGear || ''}
                            onChange={(e) => handleCornerChange(setupItem.id, 'lr', 'rearGear', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-1.5 outline-none rounded"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-mono font-semibold text-on-surface-variant block mb-1">Rear Pullbar Hole</label>
                          <input
                            type="text"
                            placeholder="e.g. Hole"
                            value={setupItem.lr.pullBarHole || ''}
                            onChange={(e) => handleCornerChange(setupItem.id, 'lr', 'pullBarHole', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-1.5 outline-none rounded"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-mono font-semibold text-on-surface-variant block mb-1">Rear Pullbar Angle</label>
                          <input
                            type="text"
                            placeholder="e.g. Angle"
                            value={setupItem.lr.pullBarAngle || ''}
                            onChange={(e) => handleCornerChange(setupItem.id, 'lr', 'pullBarAngle', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-1.5 outline-none rounded"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-mono font-semibold text-on-surface-variant block mb-1">Tire Compound</label>
                          <input
                            type="text"
                            placeholder="e.g. Comp"
                            value={setupItem.lr.tireComp || ''}
                            onChange={(e) => handleCornerChange(setupItem.id, 'lr', 'tireComp', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-1.5 outline-none rounded"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-mono font-semibold text-on-surface-variant block mb-1">Tire Pressure (psi)</label>
                          <input
                            type="text"
                            placeholder="e.g. Press"
                            value={setupItem.lr.tirePress || ''}
                            onChange={(e) => handleCornerChange(setupItem.id, 'lr', 'tirePress', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-1.5 outline-none rounded"
                          />
                        </div>
                      </div>
                    </div>

                    {/* RIGHT REAR CORNER */}
                    <div className="bg-surface-container border border-outline-variant flex flex-col rounded overflow-hidden" id={`rr-form-${setupItem.id}`}>
                      <div className="border-b border-outline-variant px-4 py-2 flex items-center gap-2 bg-surface-container-low">
                        <span className="material-symbols-outlined text-primary text-[18px]">directions_car</span>
                        <h4 className="font-label-sm text-xs uppercase text-on-surface font-bold tracking-widest">
                          Right Rear Corner
                        </h4>
                      </div>
                      <div className="p-4 flex flex-col gap-4">
                        <div>
                          <label className="text-[10px] uppercase font-mono font-semibold text-on-surface-variant block mb-1">Spring</label>
                          <input
                            type="text"
                            placeholder="e.g. Spring"
                            value={setupItem.rr.spring || ''}
                            onChange={(e) => handleCornerChange(setupItem.id, 'rr', 'spring', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-1.5 outline-none rounded"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-mono font-semibold text-on-surface-variant block mb-1">Spring Height</label>
                          <input
                            type="text"
                            placeholder="e.g. Height"
                            value={setupItem.rr.springHeight || ''}
                            onChange={(e) => handleCornerChange(setupItem.id, 'rr', 'springHeight', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-1.5 outline-none rounded"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-mono font-semibold text-on-surface-variant block mb-1">Shock</label>
                          <input
                            type="text"
                            value={setupItem.rr.shock || ''}
                            onChange={(e) => handleCornerChange(setupItem.id, 'rr', 'shock', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-1.5 outline-none rounded"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-mono font-semibold text-on-surface-variant block mb-1">Load Scale (lb)</label>
                          <input
                            type="text"
                            placeholder="e.g. lb"
                            value={setupItem.rr.load || ''}
                            onChange={(e) => handleCornerChange(setupItem.id, 'rr', 'load', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-1.5 outline-none rounded"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-mono font-semibold text-on-surface-variant block mb-1">C-to-C (in)</label>
                          <input
                            type="text"
                            placeholder="e.g. in"
                            value={setupItem.rr.loadCtoC || ''}
                            onChange={(e) => handleCornerChange(setupItem.id, 'rr', 'loadCtoC', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-1.5 outline-none rounded"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-mono font-semibold text-on-surface-variant block mb-1">Birdcage Hole (Frame)</label>
                          <input
                            type="text"
                            placeholder="e.g. Frame"
                            value={setupItem.rr.botBarHFrame || ''}
                            onChange={(e) => handleCornerChange(setupItem.id, 'rr', 'botBarHFrame', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-1.5 outline-none rounded"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-mono font-semibold text-on-surface-variant block mb-1">Birdcage Hole (Birdcage)</label>
                          <input
                            type="text"
                            placeholder="e.g. Birdcage"
                            value={setupItem.rr.botBarHBird || ''}
                            onChange={(e) => handleCornerChange(setupItem.id, 'rr', 'botBarHBird', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-1.5 outline-none rounded"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-mono font-semibold text-on-surface-variant block mb-1">Bottom Bar Angle</label>
                          <input
                            type="text"
                            placeholder="e.g. Angle"
                            value={setupItem.rr.bottomBarAngle || ''}
                            onChange={(e) => handleCornerChange(setupItem.id, 'rr', 'bottomBarAngle', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-1.5 outline-none rounded"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-mono font-semibold text-on-surface-variant block mb-1">Droop</label>
                          <input
                            type="text"
                            placeholder="e.g. Droop"
                            value={setupItem.rr.droop || ''}
                            onChange={(e) => handleCornerChange(setupItem.id, 'rr', 'droop', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-1.5 outline-none rounded"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-mono font-semibold text-on-surface-variant block mb-1">Rear Gear Ratio</label>
                          <input
                            type="text"
                            value={setupItem.rr.rearGear || ''}
                            onChange={(e) => handleCornerChange(setupItem.id, 'rr', 'rearGear', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-1.5 outline-none rounded"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-mono font-semibold text-on-surface-variant block mb-1">Rear Pullbar Hole</label>
                          <input
                            type="text"
                            placeholder="e.g. Hole"
                            value={setupItem.rr.pullBarHole || ''}
                            onChange={(e) => handleCornerChange(setupItem.id, 'rr', 'pullBarHole', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-1.5 outline-none rounded"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-mono font-semibold text-on-surface-variant block mb-1">Rear Pullbar Angle</label>
                          <input
                            type="text"
                            placeholder="e.g. Angle"
                            value={setupItem.rr.pullBarAngle || ''}
                            onChange={(e) => handleCornerChange(setupItem.id, 'rr', 'pullBarAngle', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-1.5 outline-none rounded"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-mono font-semibold text-on-surface-variant block mb-1">Tire Compound</label>
                          <input
                            type="text"
                            placeholder="e.g. Comp"
                            value={setupItem.rr.tireComp || ''}
                            onChange={(e) => handleCornerChange(setupItem.id, 'rr', 'tireComp', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-1.5 outline-none rounded"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-mono font-semibold text-on-surface-variant block mb-1">Tire Pressure (psi)</label>
                          <input
                            type="text"
                            placeholder="e.g. Press"
                            value={setupItem.rr.tirePress || ''}
                            onChange={(e) => handleCornerChange(setupItem.id, 'rr', 'tirePress', e.target.value)}
                            className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-1.5 outline-none rounded"
                          />
                        </div>
                      </div>
                    </div>

                  </div>

                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
