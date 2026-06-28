import React, { useState } from 'react';
import { ActiveSession, TireDetails, RaceWeekend } from '../types';
import { User } from '@supabase/supabase-js';

interface RaceWeekendViewProps {
  user: User | null;
  session: ActiveSession;
  weekends: RaceWeekend[];
  onUpdateSession: (updatedSession: ActiveSession) => void;
  onSelectSession: (session: SessionRecord, weekendId?: string) => void;
}

export default function RaceWeekendView({ session, weekends, onUpdateSession, onSelectSession }: RaceWeekendViewProps) {
  const [newAdjInput, setNewAdjInput] = useState('');
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

  // Find the current weekend compassing the active session
  const currentWeekend = weekends.find(w => w.track === session.track) || weekends[0];
  const displaySessions = currentWeekend?.sessions || [];

  const updateDiagnostics = (phase: 'cornerEntry' | 'centerApex' | 'cornerExit', value: 'TIGHT' | 'NEUTRAL' | 'LOOSE') => {
    onUpdateSession({
      ...session,
      diagnostics: {
        ...session.diagnostics,
        [phase]: value,
      },
    });
  };

  const handleNotesChange = (phase: 'cornerEntryNotes' | 'centerApexNotes' | 'cornerExitNotes', value: string) => {
    onUpdateSession({
      ...session,
      diagnostics: {
        ...session.diagnostics,
        [phase]: value,
      },
    });
  };

  const handleGeneralNotesChange = (val: string) => {
    onUpdateSession({ ...session, competitionNotes: val });
  };

  const handleCreateScreenshot = (e: React.ChangeEvent<HTMLInputElement>) => {
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
            if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
          } else {
            if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.82);
            onUpdateSession({
              ...session,
              screenshots: [...(session.screenshots || []), compressedBase64],
            });
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDeleteScreenshot = (indexToRemove: number) => {
    onUpdateSession({
      ...session,
      screenshots: (session.screenshots || []).filter((_, idx) => idx !== indexToRemove),
    });
  };

  const handleAddAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdjInput.trim()) return;

    let icon = 'build';
    const text = newAdjInput.toLowerCase();
    if (text.includes('pressure') || text.includes('tire') || text.includes('psi')) icon = 'air';
    else if (text.includes('bar') || text.includes('height')) icon = 'height';
    else if (text.includes('shock') || text.includes('click')) icon = 'settings_input_component';

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

    onUpdateSession({
      ...session,
      adjustments: [{ id: `adj-${Date.now()}`, icon, label: label.substring(0, 30), value: value || '+1 Adj' }, ...(session.adjustments || [])],
    });
    setNewAdjInput('');
  };

  const handleTireChange = (corner: 'lf' | 'rf' | 'lr' | 'rr', field: keyof TireDetails, val: string) => {
    const currentTires = session.tires || {
      lf: { compound: '', size: '', airPressure: session.pressures?.lf || '' },
      rf: { compound: '', size: '', airPressure: session.pressures?.rf || '' },
      lr: { compound: '', size: '', airPressure: session.pressures?.lr || '' },
      rr: { compound: '', size: '', airPressure: session.pressures?.rr || '' },
    };

    const updatedTires = { ...currentTires, [corner]: { ...currentTires[corner], [field]: val } };
    const updatedPressures = { ...session.pressures, [corner]: field === 'airPressure' ? val : currentTires[corner].airPressure };

    onUpdateSession({ ...session, tires: updatedTires, pressures: updatedPressures });
  };

  return (
    <div className="space-y-6">
      <section className="bg-surface-container rounded-lg p-4 border border-outline-variant">
        <h2 className="text-primary font-display font-bold uppercase mb-4">Active Log: {session.name}</h2>
        
        {/* Active Session Core Inputs */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-mono text-on-surface-variant">Best Lap</span>
            <input type="text" className="bg-[#0e0e0e] border border-outline-variant rounded p-2 text-sm text-on-surface font-mono" value={session.bestLap} onChange={e => onUpdateSession({ ...session, bestLap: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-mono text-on-surface-variant">Quick Time</span>
            <input type="text" className="bg-[#0e0e0e] border border-outline-variant rounded p-2 text-sm text-on-surface font-mono" value={session.leaderLap || ''} onChange={e => onUpdateSession({ ...session, leaderLap: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-mono text-on-surface-variant">Finish Pos</span>
            <input type="text" className="bg-[#0e0e0e] border border-outline-variant rounded p-2 text-sm text-on-surface font-mono" value={session.finishPos} onChange={e => onUpdateSession({ ...session, finishPos: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-mono text-on-surface-variant">Max RPM</span>
            <input type="text" className="bg-[#0e0e0e] border border-outline-variant rounded p-2 text-sm text-on-surface font-mono" value={session.maxRpm || ''} onChange={e => onUpdateSession({ ...session, maxRpm: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-mono text-on-surface-variant">Condition</span>
            <input type="text" className="bg-[#0e0e0e] border border-outline-variant rounded p-2 text-sm text-on-surface font-mono" value={session.condition} onChange={e => onUpdateSession({ ...session, condition: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-mono text-on-surface-variant">Weather</span>
            <input type="text" className="bg-[#0e0e0e] border border-outline-variant rounded p-2 text-sm text-on-surface font-mono" value={session.weather} onChange={e => onUpdateSession({ ...session, weather: e.target.value })} />
          </label>
        </div>

        {/* Restore Diagnostics Corner Input */}
        <div className="space-y-4 mb-6 pt-4 border-t border-outline-variant/60">
          <h3 className="font-mono text-xs uppercase text-on-surface-variant mb-2">Driver Feedback Diagnostics</h3>
          
          {(['cornerEntry', 'centerApex', 'cornerExit'] as const).map(phase => {
            const val = session.diagnostics[phase];
            const notesField = `${phase}Notes` as const;
            const notesVal = session.diagnostics[notesField] || '';
            const labels = {
              cornerEntry: "Corner Entry",
              centerApex: "Center Apex",
              cornerExit: "Corner Exit"
            };

            return (
              <div key={phase} className="bg-[#0a0a0a] border border-outline-variant/50 rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs uppercase font-mono font-bold text-on-surface">{labels[phase]}</span>
                  <div className="flex rounded overflow-hidden border border-outline-variant/50">
                    <button 
                      onClick={() => updateDiagnostics(phase, 'LOOSE')}
                      className={`px-3 py-1 text-[10px] font-mono font-bold uppercase transition-colors ${val === 'LOOSE' ? 'bg-red-500/20 text-red-400' : 'bg-surface text-on-surface-variant hover:bg-surface-bright'}`}>
                      Loose
                    </button>
                    <button 
                      onClick={() => updateDiagnostics(phase, 'NEUTRAL')}
                      className={`px-3 py-1 text-[10px] font-mono font-bold uppercase border-x border-outline-variant/50 transition-colors ${val === 'NEUTRAL' ? 'bg-green-500/20 text-green-400' : 'bg-surface text-on-surface-variant hover:bg-surface-bright'}`}>
                      Neutral
                    </button>
                    <button 
                      onClick={() => updateDiagnostics(phase, 'TIGHT')}
                      className={`px-3 py-1 text-[10px] font-mono font-bold uppercase transition-colors ${val === 'TIGHT' ? 'bg-blue-500/20 text-blue-400' : 'bg-surface text-on-surface-variant hover:bg-surface-bright'}`}>
                      Tight
                    </button>
                  </div>
                </div>
                <input 
                  type="text" 
                  placeholder="Additional driver notes..." 
                  value={notesVal} 
                  onChange={e => handleNotesChange(notesField, e.target.value)}
                  className="w-full bg-surface border border-outline-variant/50 text-on-surface text-xs font-mono p-2 rounded"
                />
              </div>
            );
          })}
        </div>

        {/* Simplified Tires */}
        <div className="pt-4 border-t border-outline-variant/60 mb-6">
          <h3 className="font-mono text-xs uppercase text-on-surface-variant mb-2">Tire Readings</h3>
          <div className="grid grid-cols-2 gap-2">
            {(['lf', 'rf', 'lr', 'rr'] as const).map(corner => (
              <div key={corner} className="bg-[#0e0e0e] border border-outline-variant rounded p-2">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-bold text-primary uppercase">{corner.toUpperCase()}</span>
                  <input 
                    type="text" 
                    className="bg-transparent text-right w-16 font-mono text-xs text-on-surface border-b border-outline-variant focus:outline-none" 
                    value={session.tires?.[corner]?.airPressure || session.pressures[corner] || ''} 
                    placeholder="PSI" 
                    onChange={e => handleTireChange(corner, 'airPressure', e.target.value)} 
                  />
                </div>
                <div className="flex gap-2">
                  <input type="text" placeholder="Compound" className="bg-transparent text-xs text-on-surface-variant font-mono w-full border-b border-outline-variant/30" value={session.tires?.[corner]?.compound || ''} onChange={e => handleTireChange(corner, 'compound', e.target.value)} />
                  <input type="text" placeholder="Size" className="bg-transparent text-xs text-on-surface-variant font-mono w-full border-b border-outline-variant/30" value={session.tires?.[corner]?.size || ''} onChange={e => handleTireChange(corner, 'size', e.target.value)} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Adjustments */}
        <div className="pt-4 border-t border-outline-variant/60 mb-6">
          <h3 className="font-mono text-xs uppercase text-on-surface-variant mb-2">Setup Adjustments</h3>
          <form onSubmit={handleAddAdjustment} className="flex gap-2 mb-3">
            <input type="text" className="flex-1 bg-[#0e0e0e] border border-outline-variant rounded p-2 text-sm font-mono" placeholder="e.g. +1/2 inch track bar" value={newAdjInput} onChange={e => setNewAdjInput(e.target.value)} />
            <button type="submit" className="bg-primary text-[#0e0e0e] font-bold px-4 rounded">+</button>
          </form>
          <div className="flex flex-col gap-1">
            {session.adjustments?.map(adj => (
              <div key={adj.id} className="flex justify-between bg-surface p-2 rounded text-xs font-mono">
                <span className="text-on-surface-variant">{adj.label}</span>
                <span className="text-primary font-bold">{adj.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* General Competition Notes */}
        <div className="pt-4 border-t border-outline-variant/60 mb-6">
          <h3 className="font-mono text-xs uppercase text-on-surface-variant mb-2">Competition Notes</h3>
          <textarea 
            className="w-full bg-[#0e0e0e] border border-outline-variant rounded p-3 text-sm text-on-surface font-mono min-h-[80px]"
            placeholder="Log general session feedback..."
            value={session.competitionNotes || ''}
            onChange={e => handleGeneralNotesChange(e.target.value)}
          ></textarea>
        </div>

        {/* Screenshots */}
        <div className="pt-4 border-t border-outline-variant/60">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-mono text-xs uppercase text-on-surface-variant">Attachments / Time Slips</h3>
            <label className="text-[10px] uppercase font-mono text-primary font-bold cursor-pointer hover:underline">
              + Add Image
              <input type="file" multiple accept="image/*" className="hidden" onChange={handleCreateScreenshot} />
            </label>
          </div>
          
          {session.screenshots && session.screenshots.length > 0 && (
            <div className="flex overflow-x-auto gap-2 pb-2 custom-scrollbar">
              {session.screenshots.map((src, i) => (
                <div key={i} className="relative shrink-0">
                  <img src={src} alt="attachment" className="h-20 rounded border border-outline-variant object-cover" />
                  <button onClick={() => handleDeleteScreenshot(i)} className="absolute top-1 right-1 bg-black/60 rounded-full w-5 h-5 flex items-center justify-center text-white hover:bg-black/90">
                    <span className="material-symbols-outlined text-[12px]">close</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </section>

      {/* Accordion of other sessions in this weekend */}
      <h2 className="text-on-surface font-display font-bold uppercase mt-6 mb-2">Weekend: {currentWeekend?.name || 'Current'}</h2>
      <div className="flex flex-col gap-2">
        {displaySessions.map((sx) => (
          <div key={sx.id} className="bg-surface-container border border-outline-variant rounded-lg overflow-hidden">
            <button 
              className="w-full p-3 flex justify-between items-center text-left"
              onClick={() => setExpandedSessionId(expandedSessionId === sx.id ? null : sx.id)}
            >
              <div className="flex flex-col">
                <span className="font-mono text-xs text-primary font-bold">{sx.name}</span>
                <span className="font-mono text-[10px] text-on-surface-variant">Best: {sx.bestLap || '--'} | Finish: {sx.finishPos || '--'}</span>
              </div>
              <span className="material-symbols-outlined text-on-surface-variant">
                {expandedSessionId === sx.id ? 'expand_less' : 'expand_more'}
              </span>
            </button>
            {expandedSessionId === sx.id && (
              <div className="p-3 bg-[#0e0e0e] border-t border-outline-variant/30 text-xs font-mono text-on-surface-variant space-y-2">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] uppercase font-bold text-primary tracking-wider">Session Details</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectSession(sx, currentWeekend?.id);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1 bg-surface-bright hover:bg-surface-container-high border border-outline-variant rounded transition-colors text-[10px] font-bold uppercase font-mono text-on-surface cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px] text-primary">edit</span>
                    Load to Editor
                  </button>
                </div>
                <p><strong>Config Used:</strong> {sx.setupUsed}</p>
                <p><strong>Conditions:</strong> {sx.condition}</p>
                <p><strong>Notes:</strong> {sx.competitionNotes || 'None'}</p>
                {sx.adjustments && sx.adjustments.length > 0 && (
                  <div>
                    <strong>Adjustments:</strong>
                    <ul className="list-disc pl-4 mt-1">
                      {sx.adjustments.map((a: any) => <li key={a.id}>{a.label} {a.value}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}