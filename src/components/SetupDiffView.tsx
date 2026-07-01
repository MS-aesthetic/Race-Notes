import React, { useState } from 'react';
import { Setup } from '../types';
import { diffSetups, groupDiffRows, SetupDiffRow } from '../lib/setupDiff';

interface SetupDiffViewProps {
  setups: Setup[];
  onClose: () => void;
}

export default function SetupDiffView({ setups, onClose }: SetupDiffViewProps) {
  const [setupAId, setSetupAId] = useState<string>(setups[0]?.id || '');
  const [setupBId, setSetupBId] = useState<string>(setups[1]?.id || setups[0]?.id || '');
  const [onlyChanges, setOnlyChanges] = useState(true);

  const setupA = setups.find(s => s.id === setupAId);
  const setupB = setups.find(s => s.id === setupBId);

  const rows = setupA && setupB ? diffSetups(setupA, setupB) : [];
  const grouped = groupDiffRows(rows);
  const filteredGroups = new Map<string, SetupDiffRow[]>();
  for (const [group, groupRows] of grouped) {
    const filtered = onlyChanges ? groupRows.filter(r => r.changed) : groupRows;
    if (filtered.length > 0) filteredGroups.set(group, filtered);
  }

  const hasChanges = rows.some(r => r.changed);

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface border-2 border-outline rounded-xl p-5 w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-base font-bold uppercase tracking-wide text-on-surface">Compare Setups</h3>
          <button onClick={onClose} className="text-on-surface-variant hover:text-primary">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Pickers */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-[10px] font-mono uppercase text-on-surface-variant mb-1">Setup A (before)</label>
            <select value={setupAId} onChange={e => setSetupAId(e.target.value)}
              className="w-full bg-surface-container text-xs text-on-surface p-2 border border-outline-variant rounded font-mono">
              {setups.map(s => (
                <option key={s.id} value={s.id}>{s.chassis} — {s.track} {s.date}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase text-on-surface-variant mb-1">Setup B (after)</label>
            <select value={setupBId} onChange={e => setSetupBId(e.target.value)}
              className="w-full bg-surface-container text-xs text-on-surface p-2 border border-outline-variant rounded font-mono">
              {setups.map(s => (
                <option key={s.id} value={s.id}>{s.chassis} — {s.track} {s.date}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Toggle */}
        <label className="flex items-center gap-2 mb-3 cursor-pointer text-xs font-mono text-on-surface-variant">
          <input type="checkbox" checked={onlyChanges} onChange={e => setOnlyChanges(e.target.checked)} className="accent-primary" />
          Only show changes
        </label>

        {/* No changes summary */}
        {!hasChanges && setupA && setupB && (
          <p className="text-center text-xs font-mono text-on-surface-variant py-6">These setups are identical.</p>
        )}

        {/* Diff table */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {[...filteredGroups.entries()].map(([group, groupRows]) => (
            <div key={group}>
              <p className="text-[10px] font-mono uppercase font-bold text-primary tracking-wider mb-1.5">{group}</p>
              <div className="space-y-0.5">
                {groupRows.map(r => (
                  <div key={r.path}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded text-[11px] font-mono ${
                      r.changed ? 'bg-primary/5 border-l-2 border-primary' : 'bg-surface-container'
                    }`}
                  >
                    <span className="text-on-surface-variant/70 w-24 shrink-0 truncate">{r.label}</span>
                    <span className={`text-on-surface-variant/50 ${r.changed ? 'line-through' : ''}`}>{r.aValue}</span>
                    {r.changed && (
                      <>
                        <span className="text-primary font-bold">→</span>
                        <span className="text-on-surface font-bold">{r.bValue}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
