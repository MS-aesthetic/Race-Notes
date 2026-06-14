import React, { useState } from 'react';
import { ActiveSession, SetupAdjustment, TireDetails } from '../types';

interface SessionsViewProps {
  session: ActiveSession;
  onUpdateSession: (updatedSession: ActiveSession) => void;
}

export default function SessionsView({ session, onUpdateSession }: SessionsViewProps) {
  const [newAdjInput, setNewAdjInput] = useState('');
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          // Resize image on canvas to keep localStorage safe and responsive
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1024;
          const MAX_HEIGHT = 1024;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.82);
            const updatedScreenshots = [...(session.screenshots || []), compressedBase64];
            onUpdateSession({
              ...session,
              screenshots: updatedScreenshots,
            });
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDeleteScreenshot = (indexToRemove: number) => {
    const updatedScreenshots = (session.screenshots || []).filter((_, idx) => idx !== indexToRemove);
    onUpdateSession({
      ...session,
      screenshots: updatedScreenshots,
    });
  };

  const updateDiagnostics = (phase: 'cornerEntry' | 'centerApex' | 'cornerExit', value: 'TIGHT' | 'NEUTRAL' | 'LOOSE') => {
    onUpdateSession({
      ...session,
      diagnostics: {
        ...session.diagnostics,
        [phase]: value,
      },
    });
  };

  const handleAddAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdjInput.trim()) return;

    // Determine an appropriate icon based on the label text
    let icon = 'build';
    const text = newAdjInput.toLowerCase();
    if (text.includes('pressure') || text.includes('tire') || text.includes('psi')) {
      icon = 'air';
    } else if (text.includes('bar') || text.includes('height') || text.includes('panhard') || text.includes('track')) {
      icon = 'height';
    } else if (text.includes('gear') || text.includes('ratio')) {
      icon = 'speed';
    } else if (text.includes('shock') || text.includes('click') || text.includes('comp')) {
      icon = 'settings_input_component';
    }

    // Split entry into label and value if containing space or number
    let label = newAdjInput;
    let value = '';
    const match = newAdjInput.match(/([+-]?\d+(?:\.\d+)?\s*\w+["']?|up\s*\d+\/\d+"?|down\s*\d+\/\d+"?)\s+(.+)/i);
    if (match) {
      value = match[1];
      label = match[2].toUpperCase();
    } else {
      const parts = newAdjInput.split(/(?=[+-]\d)|\s(?=\d)/);
      if (parts.length > 1) {
        label = parts[0].trim().toUpperCase();
        value = parts.slice(1).join(' ').trim();
      }
    }

    const newAdjustment: SetupAdjustment = {
      id: `adj-${Date.now()}`,
      icon,
      label: label.substring(0, 30),
      value: value || '+1 Adj',
    };

    onUpdateSession({
      ...session,
      adjustments: [newAdjustment, ...session.adjustments],
    });
    setNewAdjInput('');
  };

  const handleDeleteAdjustment = (id: string) => {
    onUpdateSession({
      ...session,
      adjustments: session.adjustments.filter((adj) => adj.id !== id),
    });
  };

  const handleTireChange = (corner: 'lf' | 'rf' | 'lr' | 'rr', field: keyof TireDetails, val: string) => {
    const currentTires = session.tires || {
      lf: { tireId: '', compound: '', size: '', durometer: '', airPressure: session.pressures?.lf || '', backSpacing: '' },
      rf: { tireId: '', compound: '', size: '', durometer: '', airPressure: session.pressures?.rf || '', backSpacing: '' },
      lr: { tireId: '', compound: '', size: '', durometer: '', airPressure: session.pressures?.lr || '', backSpacing: '' },
      rr: { tireId: '', compound: '', size: '', durometer: '', airPressure: session.pressures?.rr || '', backSpacing: '' },
    };

    const updatedTires = {
      ...currentTires,
      [corner]: {
        ...currentTires[corner],
        [field]: val,
      },
    };

    const updatedPressures = {
      ...session.pressures,
      [corner]: field === 'airPressure' ? val : currentTires[corner].airPressure,
    };

    onUpdateSession({
      ...session,
      tires: updatedTires,
      pressures: updatedPressures,
    });
  };

  const handleNotesChange = (val: string) => {
    onUpdateSession({
      ...session,
      competitionNotes: val,
    });
  };

  return (
    <div className="space-y-6" id="sessions-view-root">
      {/* Session Header banner with background image and text shadows */}
      <section className="relative bg-surface-container rounded-lg border border-outline-variant overflow-hidden min-h-[220px] flex items-end">
        <div
          className="absolute inset-0 z-0 bg-center bg-cover opacity-35"
          style={{
            backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDacN7JqretQ8lKzTtI8OIUB6KC7xLE6M4X4skfmmpNXHniX_tIAFkhd_Fae41AQWX1x7T0Xt2y-3BnlpKFy2K3kRHzz3GikyA5SawlXelEUm3aSjsRUrw0rpNrXQQqyq9c5UroOiMWauvpq-KHOrTIRwvd8Lr-_lRH9MJHIMH1BLl2LOmFK7mFxviX1RflItjyp2Ph9IIp_xdShid9U-b31uW1xtNlQwDJDmOX1G_bOyJiOxh22rASwWwhGz2SVa3WsmG-Bnu1RXU')"
          }}
        ></div>
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent z-10"></div>
        
        <div className="relative z-20 w-full p-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <h2 className="font-display-lg text-3xl sm:text-4xl text-on-surface uppercase tracking-tight font-bold drop-shadow-lg">
              {session.name}
            </h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
              <p className="font-body-md text-on-surface-variant flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px]">location_on</span>
                {session.track}
              </p>
              <p className="font-label-md text-primary flex items-center gap-1.5 uppercase font-bold">
                <span className="material-symbols-outlined text-[18px]">settings_input_component</span>
                SETUP: {session.setupUsed}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 w-full md:w-auto">
            <div className="bg-surface/90 backdrop-blur-sm border border-outline-variant p-3 flex flex-col min-w-[110px] flex-grow md:flex-none">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase mb-1">Condition</span>
              <span className="font-mono text-sm text-secondary-fixed-dim font-bold tracking-tight">
                {session.condition}
              </span>
            </div>
            <div className="bg-surface/90 backdrop-blur-sm border border-outline-variant p-3 flex flex-col min-w-[110px] flex-grow md:flex-none">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase mb-1">Weather</span>
              <span className="font-sans text-sm text-on-surface font-semibold flex items-center justify-between gap-1">
                {session.weather}
                <span className="material-symbols-outlined text-[16px] text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>
                  wb_sunny
                </span>
              </span>
            </div>
            <div className="bg-surface/90 backdrop-blur-sm border border-outline-variant p-3 flex flex-col min-w-[110px] flex-grow md:flex-none">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase mb-1">Time</span>
              <span className="font-mono text-sm text-on-surface font-bold">
                {session.time}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Performance Metrics List - Single Elegant Container (Each item is its own row, stacked vertically) */}
      <section className="bg-surface-container border border-outline-variant rounded-lg overflow-hidden" id="section-performance-list-container">
        <div className="p-4 border-b border-outline-variant/60 flex items-center gap-3 bg-surface-container-low">
          <span className="material-symbols-outlined text-primary">analytics</span>
          <h3 className="font-display-lg text-lg text-on-surface uppercase font-bold tracking-wide">
            PERFORMANCE & TELEMETRY METRICS
          </h3>
        </div>
        
        <div className="divide-y divide-outline-variant/40 bg-surface/20">
          {/* Best Lap Row */}
          <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group hover:bg-surface-container-high/30 transition-colors">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-tertiary">speed</span>
              <span className="font-label-md text-sm text-on-surface uppercase font-bold tracking-wider">
                Best Lap
              </span>
            </div>
            <div className="w-full sm:w-64">
              <input
                type="text"
                id="input-telemetry-bestLap"
                className="w-full bg-surface-container border border-outline-variant focus:border-primary text-on-surface text-base font-mono font-bold px-3 py-2 outline-none rounded"
                value={session.bestLap}
                onChange={(e) => onUpdateSession({ ...session, bestLap: e.target.value })}
                placeholder="e.g. 14.12s"
              />
            </div>
          </div>

          {/* Avg Lap Row */}
          <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group hover:bg-surface-container-high/30 transition-colors">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-secondary">av_timer</span>
              <span className="font-label-md text-sm text-on-surface uppercase font-bold tracking-wider">
                Average Lap
              </span>
            </div>
            <div className="w-full sm:w-64">
              <input
                type="text"
                id="input-telemetry-avgLap"
                className="w-full bg-surface-container border border-outline-variant focus:border-primary text-on-surface text-base font-mono font-bold px-3 py-2 outline-none rounded"
                value={session.avgLap}
                onChange={(e) => onUpdateSession({ ...session, avgLap: e.target.value })}
                placeholder="e.g. 14.58s"
              />
            </div>
          </div>

          {/* Finish Position Row */}
          <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group hover:bg-surface-container-high/30 transition-colors">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-primary">flag</span>
              <span className="font-label-md text-sm text-on-surface uppercase font-bold tracking-wider">
                Finish Position
              </span>
            </div>
            <div className="w-full sm:w-64">
              <input
                type="text"
                id="input-telemetry-finishPos"
                className="w-full bg-surface-container border border-outline-variant focus:border-primary text-on-surface text-base font-mono font-bold px-3 py-2 outline-none rounded"
                value={session.finishPos}
                onChange={(e) => onUpdateSession({ ...session, finishPos: e.target.value })}
                placeholder="e.g. P2"
              />
            </div>
          </div>

          {/* Finish Gap Row */}
          <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group hover:bg-surface-container-high/30 transition-colors">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-primary">hourglass_empty</span>
              <span className="font-label-md text-sm text-on-surface uppercase font-bold tracking-wider">
                Finish Gap
              </span>
            </div>
            <div className="w-full sm:w-64">
              <input
                type="text"
                id="input-telemetry-gap"
                className="w-full bg-surface-container border border-outline-variant focus:border-primary text-on-surface text-base font-mono font-bold px-3 py-2 outline-none rounded"
                value={session.gap}
                onChange={(e) => onUpdateSession({ ...session, gap: e.target.value })}
                placeholder="e.g. +0.4s Gap"
              />
            </div>
          </div>

          {/* Max RPM Row */}
          <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group hover:bg-surface-container-high/30 transition-colors">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-secondary">adjust</span>
              <span className="font-label-md text-sm text-on-surface uppercase font-bold tracking-wider">
                Max RPM
              </span>
            </div>
            <div className="w-full sm:w-64">
              <input
                type="text"
                id="input-telemetry-maxRpm"
                className="w-full bg-surface-container border border-outline-variant focus:border-primary text-on-surface text-base font-mono font-bold px-3 py-2 outline-none rounded"
                value={session.maxRpm}
                onChange={(e) => onUpdateSession({ ...session, maxRpm: e.target.value })}
                placeholder="e.g. 9,200"
              />
            </div>
          </div>

          {/* Fast/Leader Lap Row */}
          <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group hover:bg-surface-container-high/30 transition-colors">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-surface-bright">leaderboard</span>
              <span className="font-label-md text-sm text-on-surface uppercase font-bold tracking-wider">
                Leader / Fast Lap
              </span>
            </div>
            <div className="w-full sm:w-64">
              <input
                type="text"
                id="input-telemetry-leaderLap"
                className="w-full bg-surface-container border border-outline-variant focus:border-primary text-on-surface text-base font-mono font-bold px-3 py-2 outline-none rounded"
                value={session.leaderLap}
                onChange={(e) => onUpdateSession({ ...session, leaderLap: e.target.value })}
                placeholder="e.g. 13.98"
              />
            </div>
          </div>

          {/* Leader Gap Row */}
          <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group hover:bg-surface-container-high/30 transition-colors">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-error">trending_down</span>
              <span className="font-label-md text-sm text-on-surface uppercase font-bold tracking-wider">
                Leader Gap
              </span>
            </div>
            <div className="w-full sm:w-64">
              <input
                type="text"
                id="input-telemetry-leaderGap"
                className="w-full bg-surface-container border border-outline-variant focus:border-primary text-on-surface text-base font-mono font-bold px-3 py-2 outline-none rounded"
                value={session.leaderGap}
                onChange={(e) => onUpdateSession({ ...session, leaderGap: e.target.value })}
                placeholder="e.g. -0.14"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Diagnostics and Changes Split */}
      <div className="flex flex-col gap-6">
        
        {/* Handling Diagnostics */}
        <section className="bg-surface-container border border-outline-variant flex flex-col rounded" id="handling-diagnostic-card">
          <div className="p-4 border-b border-outline-variant/60 flex items-center gap-3 bg-surface-container-low">
            <span className="material-symbols-outlined text-primary">tune</span>
            <h3 className="font-display-lg text-lg text-on-surface uppercase font-bold tracking-wide">
              HANDLING DIAGNOSTICS
            </h3>
          </div>
          <div className="p-6 space-y-6 flex-grow">
            
            {/* Corner Entry */}
            <div>
              <span className="font-label-md text-label-sm text-on-surface-variant block mb-2 uppercase tracking-wider font-bold">
                Corner Entry
              </span>
              <div className="flex gap-2 mb-2">
                {(['TIGHT', 'NEUTRAL', 'LOOSE'] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => updateDiagnostics('cornerEntry', opt)}
                    className={`flex-1 py-3 border font-label-md text-xs uppercase tracking-wider transition-all duration-150 cursor-pointer rounded-sm ${
                      session.diagnostics.cornerEntry === opt
                        ? 'border-primary text-primary font-bold bg-primary/10 shadow-[inset_0_0_8px_rgba(255,179,172,0.15)] bg-surface-bright'
                        : 'border-outline-variant text-on-surface-variant hover:bg-surface-bright hover:text-on-surface'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              <div>
                <input
                  type="text"
                  placeholder="Notes on Corner Entry handling..."
                  value={session.diagnostics.cornerEntryNotes || ''}
                  onChange={(e) => onUpdateSession({
                    ...session,
                    diagnostics: {
                      ...session.diagnostics,
                      cornerEntryNotes: e.target.value,
                    }
                  })}
                  className="w-full bg-surface-container-high border border-outline-variant focus:border-primary text-on-surface text-xs font-sans px-3 py-2 outline-none rounded placeholder:text-on-surface-variant/40"
                />
              </div>
            </div>

            {/* Center Apex */}
            <div>
              <span className="font-label-md text-label-sm text-on-surface-variant block mb-2 uppercase tracking-wider font-bold">
                Center Apex
              </span>
              <div className="flex gap-2 mb-2">
                {(['TIGHT', 'NEUTRAL', 'LOOSE'] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => updateDiagnostics('centerApex', opt)}
                    className={`flex-1 py-3 border font-label-md text-xs uppercase tracking-wider transition-all duration-150 cursor-pointer rounded-sm ${
                      session.diagnostics.centerApex === opt
                        ? 'border-primary text-primary font-bold bg-primary/10 shadow-[inset_0_0_8px_rgba(255,179,172,0.15)] bg-surface-bright'
                        : 'border-outline-variant text-on-surface-variant hover:bg-surface-bright hover:text-on-surface'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              <div className="mb-2">
                <input
                  type="text"
                  placeholder="Notes on Center Apex handling..."
                  value={session.diagnostics.centerApexNotes || ''}
                  onChange={(e) => onUpdateSession({
                    ...session,
                    diagnostics: {
                      ...session.diagnostics,
                      centerApexNotes: e.target.value,
                    }
                  })}
                  className="w-full bg-surface-container-high border border-outline-variant focus:border-primary text-on-surface text-xs font-sans px-3 py-2 outline-none rounded placeholder:text-on-surface-variant/40"
                />
              </div>
            </div>

            {/* Corner Exit */}
            <div>
              <span className="font-label-md text-label-sm text-on-surface-variant block mb-2 uppercase tracking-wider font-bold">
                Corner Exit
              </span>
              <div className="flex gap-2 mb-2">
                {(['TIGHT', 'NEUTRAL', 'LOOSE'] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => updateDiagnostics('cornerExit', opt)}
                    className={`flex-1 py-3 border font-label-md text-xs uppercase tracking-wider transition-all duration-150 cursor-pointer rounded-sm ${
                      session.diagnostics.cornerExit === opt
                        ? 'border-primary-container bg-primary-container text-on-primary-container font-bold'
                        : 'border-outline-variant text-on-surface-variant hover:bg-surface-bright hover:text-on-surface'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              <div className="mb-2">
                <input
                  type="text"
                  placeholder="Notes on Corner Exit handling..."
                  value={session.diagnostics.cornerExitNotes || ''}
                  onChange={(e) => onUpdateSession({
                    ...session,
                    diagnostics: {
                      ...session.diagnostics,
                      cornerExitNotes: e.target.value,
                    }
                  })}
                  className="w-full bg-surface-container-high border border-outline-variant focus:border-primary text-on-surface text-xs font-sans px-3 py-2 outline-none rounded placeholder:text-on-surface-variant/40"
                />
              </div>
            </div>
          </div>
        </section>

        {/* SETUP CHANGES LOG */}
        <section className="bg-surface-container border border-outline-variant flex flex-col h-[500px] rounded" id="setup-changes-log-card">
          <div className="p-4 border-b border-outline-variant/60 flex items-center justify-between bg-surface-container-low">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary">build</span>
              <h3 className="font-display-lg text-lg text-on-surface uppercase font-bold tracking-wide">
                SETUP CHANGES
              </h3>
            </div>
            <span className="font-mono text-xs text-on-surface-variant bg-surface px-1.5 py-0.5 rounded border border-outline-variant/40">
              {session.adjustments.length} logged
            </span>
          </div>

          {/* Quick Input Form */}
          <div className="p-4 border-b border-outline-variant/60 bg-surface/50">
            <form onSubmit={handleAddAdjustment} className="flex flex-col gap-1">
              <label className="font-label-sm text-label-sm text-on-surface-variant block uppercase tracking-wider mb-1">
                Log New Adjustment
              </label>
              <div className="flex border-b border-outline focus-within:border-primary">
                <input
                  className="flex-grow text-on-surface font-sans text-sm px-3 py-2.5 w-full bg-surface-container/65 focus:ring-0 focus:outline-none placeholder:text-surface-bright border-none"
                  placeholder='e.g., -0.5 LR Air Pressure, UP 1/4" Panhard Bar'
                  type="text"
                  value={newAdjInput}
                  onChange={(e) => setNewAdjInput(e.target.value)}
                />
                <button
                  type="submit"
                  className="bg-surface-variant text-on-surface hover:text-primary px-5 py-2.5 hover:bg-surface-bright transition-colors uppercase font-label-md text-xs font-bold border-l border-outline-variant"
                >
                  SAVE
                </button>
              </div>
            </form>
          </div>

          {/* Scrolling List */}
          <div className="overflow-y-auto custom-scrollbar flex-grow bg-surface/10 divide-y divide-outline-variant/30">
            {session.adjustments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-on-surface-variant p-6 text-center">
                <span className="material-symbols-outlined text-3xl opacity-35 mb-2">construction</span>
                <p className="text-xs uppercase font-mono">No telemetry changes recorded yet.</p>
                <p className="text-[11px] lowercase text-on-surface-variant/70 mt-1">use the quick input above to log mechanical shifts.</p>
              </div>
            ) : (
              session.adjustments.map((adj) => (
                <div
                  key={adj.id}
                  className="flex items-center px-4 py-3 min-h-[52px] hover:bg-surface-container-high transition-colors group cursor-pointer"
                >
                  <div className="w-8 flex-shrink-0 text-on-surface-variant">
                    <span className="material-symbols-outlined text-[18px]">
                      {adj.icon}
                    </span>
                  </div>
                  <div className="flex-grow min-w-0 pr-2">
                    <span className="font-label-sm text-xs text-on-surface font-mono block truncate tracking-wide">
                      {adj.label}
                    </span>
                  </div>
                  <div className="text-right flex items-center gap-3 flex-shrink-0">
                    <span className={`font-mono text-xs font-bold leading-none ${
                        adj.value.includes('-') || adj.value.toLowerCase().includes('down') ? 'text-primary' : 'text-tertiary'
                    }`}>
                      {adj.value}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteAdjustment(adj.id)}
                      className="text-on-surface-variant hover:text-primary p-1 bg-surface-container border border-outline-variant/30 opacity-0 group-hover:opacity-100 transition-all cursor-pointer rounded-sm"
                      title="Delete log"
                    >
                      <span className="material-symbols-outlined text-[16px] block">delete</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Tires Component */}
      <section className="bg-surface-container border border-outline-variant rounded flex flex-col overflow-hidden" id="session-tires-card">
        <div className="p-4 border-b border-outline-variant/60 flex items-center justify-between bg-surface-container-low">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary">tire_repair</span>
            <h3 className="font-display-lg text-lg text-on-surface uppercase font-bold tracking-wide">
              TIRES
            </h3>
          </div>
          <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 font-mono rounded font-semibold uppercase tracking-wider">
            Active Log
          </span>
        </div>
        <div className="p-4 md:p-6 bg-surface/20 flex flex-col gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {([
              { key: 'lf', label: 'Left Front (LF)', color: 'border-l-4 border-l-primary/80' },
              { key: 'rf', label: 'Right Front (RF)', color: 'border-r-4 border-r-primary/80' },
              { key: 'lr', label: 'Left Rear (LR)', color: 'border-l-4 border-l-secondary/80' },
              { key: 'rr', label: 'Right Rear (RR)', color: 'border-r-4 border-r-secondary/80' },
            ] as const).map((corner) => {
              const tire = (session.tires?.[corner.key]) || {
                tireId: '',
                compound: '',
                size: '',
                durometer: '',
                airPressure: session.pressures?.[corner.key] || '',
                backSpacing: '',
              };

              return (
                <div 
                  key={corner.key} 
                  className={`bg-surface-container-low/90 border border-outline-variant/50 rounded-lg p-4 flex flex-col gap-3 shadow-sm hover:border-outline transition-all duration-200 ${corner.color}`}
                >
                  <div className="flex justify-between items-center border-b border-outline-variant/40 pb-2">
                    <span className="font-mono text-xs font-bold text-on-surface uppercase tracking-wider">
                      {corner.label}
                    </span>
                    <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
                      swap_calls
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="font-mono text-[9px] text-on-surface-variant font-bold uppercase tracking-wider">Tire ID</label>
                      <input 
                        type="text"
                        placeholder="e.g. LF-10"
                        className="w-full bg-surface-container text-on-surface font-mono text-xs p-2 border-b border-outline-variant focus:border-primary outline-none transition-colors rounded-sm"
                        value={tire.tireId || ''}
                        onChange={(e) => handleTireChange(corner.key, 'tireId', e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="font-mono text-[9px] text-on-surface-variant font-bold uppercase tracking-wider">Compound</label>
                      <input 
                        type="text"
                        placeholder="e.g. D20"
                        className="w-full bg-surface-container text-on-surface font-mono text-xs p-2 border-b border-outline-variant focus:border-primary outline-none transition-colors rounded-sm"
                        value={tire.compound || ''}
                        onChange={(e) => handleTireChange(corner.key, 'compound', e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="font-mono text-[9px] text-on-surface-variant font-bold uppercase tracking-wider">Size</label>
                      <input 
                        type="text"
                        placeholder="e.g. 82.0&quot;"
                        className="w-full bg-surface-container text-on-surface font-mono text-xs p-2 border-b border-outline-variant focus:border-primary outline-none transition-colors rounded-sm"
                        value={tire.size || ''}
                        onChange={(e) => handleTireChange(corner.key, 'size', e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="font-mono text-[9px] text-on-surface-variant font-bold uppercase tracking-wider">Durometer</label>
                      <input 
                        type="text"
                        placeholder="e.g. 55"
                        className="w-full bg-surface-container text-on-surface font-mono text-xs p-2 border-b border-outline-variant focus:border-primary outline-none transition-colors rounded-sm"
                        value={tire.durometer || ''}
                        onChange={(e) => handleTireChange(corner.key, 'durometer', e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="font-mono text-[9px] text-on-surface-variant font-bold uppercase tracking-wider">Air Pressure</label>
                      <input 
                        type="text"
                        placeholder="e.g. 10.0 psi"
                        className="w-full bg-surface-container text-on-surface font-mono text-xs p-2 border-b border-outline-variant focus:border-primary outline-none transition-colors rounded-sm"
                        value={tire.airPressure || ''}
                        onChange={(e) => handleTireChange(corner.key, 'airPressure', e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="font-mono text-[9px] text-on-surface-variant font-bold uppercase tracking-wider">Back Spacing</label>
                      <input 
                        type="text"
                        placeholder="e.g. 3.0&quot;"
                        className="w-full bg-surface-container text-on-surface font-mono text-xs p-2 border-b border-outline-variant focus:border-primary outline-none transition-colors rounded-sm"
                        value={tire.backSpacing || ''}
                        onChange={(e) => handleTireChange(corner.key, 'backSpacing', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Competition Notes Area */}
      <section className="bg-surface-container border border-outline-variant rounded p-6 flex flex-col gap-3" id="competition-notes-card">
        <label className="font-label-md text-label-sm text-on-surface-variant uppercase flex items-center gap-2 font-bold tracking-wider">
          <span className="material-symbols-outlined text-[18px]">notes</span>
          COMPETITION NOTES
        </label>
        <textarea
          className="w-full bg-surface border-none border-b-2 border-outline-variant text-on-surface font-sans text-sm p-4 min-h-[120px] focus:ring-0 focus:border-primary focus:outline-none resize-none custom-scrollbar rounded-none font-medium leading-relaxed"
          placeholder="Enter driver feedback, track evolution notes, or incident reports here..."
          value={session.competitionNotes}
          onChange={(e) => handleNotesChange(e.target.value)}
        ></textarea>
      </section>

      {/* Reference Screenshots Area */}
      <section className="bg-surface-container border border-outline-variant rounded p-6 flex flex-col gap-4" id="reference-screenshots-card">
        <div className="flex justify-between items-center border-b border-outline-variant pb-2">
          <label className="font-label-md text-label-sm text-on-surface-variant uppercase flex items-center gap-2 font-bold tracking-wider">
            <span className="material-symbols-outlined text-[18px]">add_photo_alternate</span>
            SESSION SCREENSHOTS & GRAPHS
          </label>
          <span className="font-mono text-xs text-on-surface-variant bg-surface px-1.5 py-0.5 rounded border border-outline-variant/40">
            {(session.screenshots || []).length} attached
          </span>
        </div>

        {/* Upload Button Component */}
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-outline-variant hover:border-primary rounded-lg p-5 bg-[#141414] transition-all cursor-pointer relative group">
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageUpload}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
            title="Upload Screenshots"
          />
          <span className="material-symbols-outlined text-3xl text-on-surface-variant group-hover:text-primary transition-colors mb-2">
            cloud_upload
          </span>
          <p className="text-xs uppercase font-mono font-bold text-on-surface">Click to Upload timing app screenshots</p>
          <p className="text-[10px] text-on-surface-variant/70 mt-1">Images are compressed automatically to save local storage space</p>
        </div>

        {/* Screenshot Grid List */}
        {(session.screenshots || []).length > 0 && (
          <div className="flex flex-col gap-4 mt-2">
            {session.screenshots?.map((src, idx) => (
              <div
                key={idx}
                className="relative aspect-video bg-[#1a1a1a] rounded overflow-hidden border border-outline-variant flex items-center justify-center group w-full"
              >
                <img
                  src={src}
                  alt={`Screenshot ${idx + 1}`}
                  referrerPolicy="no-referrer"
                  className="object-cover w-full h-full cursor-pointer hover:scale-[1.01] transition-transform"
                  onClick={() => setLightboxImg(src)}
                />
                
                {/* Image Overlay Controls */}
                <div className="absolute top-3 right-3 flex gap-2 animate-fade-in opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => setLightboxImg(src)}
                    className="p-2.5 bg-black/85 hover:bg-black text-[#ffffff] border border-outline-variant cursor-pointer rounded shadow-lg"
                    title="View Fullsize"
                  >
                    <span className="material-symbols-outlined text-[18px] block">zoom_in</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteScreenshot(idx)}
                    className="p-2.5 bg-black/85 hover:bg-primary text-[#ffffff] border border-outline-variant cursor-pointer rounded shadow-lg"
                    title="Delete Screenshot"
                  >
                    <span className="material-symbols-outlined text-[18px] block">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Lightbox Modal overlay slider */}
      {lightboxImg && (
        <div className="fixed inset-0 bg-[#000000eb] backdrop-blur-sm z-50 flex flex-col justify-center items-center p-4 animate-fade-in">
          <button
            onClick={() => setLightboxImg(null)}
            className="absolute top-5 right-5 w-10 h-10 bg-surface border border-outline rounded-full flex items-center justify-center text-on-surface hover:text-primary transition-colors cursor-pointer z-50"
            title="Close Lightbox"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
          
          <div className="max-w-4xl max-h-[80vh] flex items-center justify-center pointer-events-none p-2 animate-zoom-in">
            <img
              src={lightboxImg}
              alt="Zoomed Reference Screenshot"
              className="object-contain max-w-full max-h-[80vh] shadow-2xl border border-outline pointer-events-auto rounded"
            />
          </div>
          <p className="mt-4 font-mono text-xs text-on-surface-variant font-medium tracking-wide">
            Trackside Reference Screenshot • Tap outside or press close to exit
          </p>
        </div>
      )}
    </div>
  );
}
