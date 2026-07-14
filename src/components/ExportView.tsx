import { useState, useEffect } from 'react';
import { Setup, ActiveSession, RaceWeekend, AccountingEntry, Todo, TireInventoryItem } from '../types';
import { User } from '@supabase/supabase-js';
import { pullSharedData } from '../lib/sync';
import { sortWeekends } from '../lib/scope';
import {
  buildMasterReport,
  buildSetupReport,
  buildTrackersReport,
  buildWeekendReport,
  openPrintReport,
  type TrackerReportKind,
} from '../lib/exportPdf';
import EmptyState from './ui/EmptyState';

interface ExportViewProps {
  user?: User | null;
  setup: Setup;
  savedSetups?: Setup[];
  activeSession: ActiveSession;
  onImportSetup?: (setup: Setup) => void;
  onImportWeekend?: (weekend: RaceWeekend) => void;
  weekends?: RaceWeekend[];
  todos?: Todo[];
  accounting?: AccountingEntry[];
  tireInventory?: TireInventoryItem[];
  onStartWeekend?: () => void;
}

export default function ExportView({
  user = null,
  setup,
  savedSetups = [],
  activeSession,
  onImportSetup,
  onImportWeekend,
  weekends = [],
  todos = [],
  accounting = [],
  tireInventory = [], onStartWeekend,
}: ExportViewProps) {
  const [cloudSync, setCloudSync] = useState(true);
  const [sharedSetups, setSharedSetups] = useState<Setup[]>([]);
  const [sharedWeekends, setSharedWeekends] = useState<RaceWeekend[]>([]);
  const [loadingShared, setLoadingShared] = useState(false);

  // The active setup is always selectable, plus any saved setups (deduped).
  const setupOptions: Setup[] = [setup, ...savedSetups.filter((s) => s.id !== setup.id)];
  const [selectedSetupId, setSelectedSetupId] = useState<string>(setup.id);
  // [10] Canonical weekend ordering (date descending; no active concept here).
  const sortedWeekendOptions = sortWeekends(weekends, null);
  const [selectedWeekendId, setSelectedWeekendId] = useState<string>(sortWeekends(weekends, null)[0]?.id || '');
  const [selectedTracker, setSelectedTracker] = useState<TrackerReportKind>('all');

  // Cloud/local hydration can populate weekends after first render.
  useEffect(() => {
    if (sortedWeekendOptions.length === 0) {
      if (selectedWeekendId) setSelectedWeekendId('');
      return;
    }
    if (!sortedWeekendOptions.some(w => w.id === selectedWeekendId)) {
      setSelectedWeekendId(sortedWeekendOptions[0].id);
    }
  }, [sortedWeekendOptions, selectedWeekendId]);

  useEffect(() => {
    if (user) {
      setLoadingShared(true);
      pullSharedData(user.id).then((res) => {
        setSharedSetups(res.sharedSetups);
        setSharedWeekends(res.sharedWeekends);
        setLoadingShared(false);
      });
    }
  }, [user]);

  // ── Export actions ───────────────────────────────────────────────────────
  const selectedSetup = setupOptions.find((s) => s.id === selectedSetupId) ?? setup;

  const print = (report: ReturnType<typeof buildSetupReport>) => {
    if (!openPrintReport(report)) alert('Allow popups to print the report.');
  };

  const exportSetup = () => print(buildSetupReport(selectedSetup, activeSession));

  const exportWeekend = () => {
    const w = weekends.find((x) => x.id === selectedWeekendId);
    if (!w) {
      alert('Select a race weekend first.');
      return;
    }
    print(buildWeekendReport(w, accounting));
  };
  const exportTrackers = () => print(buildTrackersReport(selectedTracker, todos, accounting));
  const exportAll = () => print(buildMasterReport(selectedSetup, activeSession, weekends, todos, accounting));

  const selectClass =
    'w-full bg-surface-container border border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-2.5 rounded outline-none appearance-none cursor-pointer pr-8';
  const actionBtnClass =
    'w-full py-3 bg-primary text-on-primary font-mono text-xs uppercase font-bold rounded tracking-wider active:opacity-80 flex items-center justify-center gap-2';

  return (
    <div className="space-y-6" id="export-report-view">
      <header className="mb-2 flex flex-col gap-1">
        <h1 className="font-display text-2xl sm:text-3xl uppercase text-on-surface font-bold tracking-tight">Data Export</h1>
        <p className="font-mono text-xs text-on-surface-variant">
          Compile setups, weekends and trackers into formatted PDF reports.
        </p>
      </header>

      {/* Cloud Sync Card */}
      <div className="bg-surface border border-outline-variant p-5 flex flex-col gap-4 rounded">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-on-surface-variant">cloud_upload</span>
            <span className="font-mono text-xs uppercase text-on-surface font-bold tracking-wide">Sync to Cloud</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={cloudSync} onChange={(e) => setCloudSync(e.target.checked)} className="sr-only peer" />
            <div className="w-11 h-6 bg-surface-container-highest border border-outline-variant rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-[22px] after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-on-surface after:h-4 after:w-4 after:rounded-full after:transition-all peer-checked:after:bg-on-primary"></div>
          </label>
        </div>
        {cloudSync ? (
          <div className="flex items-center gap-2 bg-surface-container p-3 border border-outline-variant rounded">
            <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse"></span>
            <span className="font-mono text-xs uppercase text-on-surface-variant tracking-wider">Cloud Sync Active</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-surface-container p-3 border border-outline-variant rounded text-on-surface-variant/70">
            <span className="w-2 h-2 rounded-full bg-error"></span>
            <span className="font-mono text-xs uppercase text-on-surface-variant/80 tracking-wider">Sync Disabled: Offline mode active</span>
          </div>
        )}
      </div>

      {/* ── Exports ── */}
      <div className="space-y-4">
        <h2 className="font-display text-xl uppercase font-bold text-on-surface">Exports</h2>

        {/* Export All */}
        <button onClick={exportAll} className={`${actionBtnClass} min-h-[56px] shadow-lg`}>
          <span className="material-symbols-outlined text-[20px]">picture_as_pdf</span>
          Export All
        </button>

        {/* Export Setup */}
        <div className="bg-surface-container border border-outline-variant rounded p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[18px]">settings_input_component</span>
            <span className="font-mono text-xs uppercase font-bold text-on-surface tracking-wide">Export Setup</span>
          </div>
          <div className="relative">
            <select value={selectedSetupId} onChange={(e) => setSelectedSetupId(e.target.value)} className={selectClass}>
              {setupOptions.map((s, i) => (
                <option key={s.id} value={s.id}>
                  {i === 0 ? 'Active — ' : ''}
                  {s.chassis || 'Unnamed'} · {s.carType || 'No class'}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none text-[18px]">expand_more</span>
          </div>
          <button onClick={exportSetup} className={actionBtnClass}>
            <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
            Export Setup
          </button>
        </div>

        {/* Export Weekend */}
        <div className="bg-surface-container border border-outline-variant rounded p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[18px]">calendar_today</span>
            <span className="font-mono text-xs uppercase font-bold text-on-surface tracking-wide">Export Weekend</span>
          </div>
          {weekends.length ? (
            <>
              <div className="relative">
                <select value={selectedWeekendId} onChange={(e) => setSelectedWeekendId(e.target.value)} className={selectClass}>
                  {sortedWeekendOptions.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} — {w.track} ({w.date})
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none text-[18px]">expand_more</span>
              </div>
              <button onClick={exportWeekend} className={actionBtnClass}>
                <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                Export Weekend
              </button>
            </>
          ) : (
            <EmptyState
              icon="calendar_today"
              title="No weekends to export"
              body="Log a race weekend and it'll be ready to print here."
              cta={onStartWeekend ? { label: 'Start race weekend', onClick: onStartWeekend } : undefined}
            />
          )}
        </div>

        {/* Export Trackers */}
        <div className="bg-surface-container border border-outline-variant rounded p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[18px]">checklist</span>
            <span className="font-mono text-xs uppercase font-bold text-on-surface tracking-wide">Export Trackers</span>
          </div>
          <div className="relative">
            <select value={selectedTracker} onChange={(e) => setSelectedTracker(e.target.value as TrackerReportKind)} className={selectClass}>
              <option value="all">All Trackers</option>
              <option value="checklist">Main Checklist</option>
              <option value="accounting">Accounting</option>
            </select>
            <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none text-[18px]">expand_more</span>
          </div>
          <button onClick={exportTrackers} className={actionBtnClass}>
            <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
            Export Trackers
          </button>
        </div>
      </div>

      {/* Quick CSV Exports */}
      <div className="pt-6 border-t border-outline-variant space-y-4">
        <div>
          <h2 className="font-display text-xl uppercase font-bold text-on-surface">Quick CSV Exports</h2>
          <p className="font-mono text-xs text-on-surface-variant mt-1">Download raw data as CSV files.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => {
              const header = 'Tire #,Size,Compound,BS,Duro,PSI,Heat Cycles,Age (days)';
              const rows = (tireInventory || []).map((t) => {
                const age = t.dateAdded
                  ? Math.floor((Date.now() - new Date(t.dateAdded).getTime()) / 86400000) + (t.initialAgeDays ?? 0)
                  : t.initialAgeDays ?? 0;
                return [t.tireNumber, t.size, t.compound, t.wheelBackspacing, t.durometer, t.airPressure || '', t.heatCycles ?? 0, age].join(',');
              });
              const csv = [header, ...rows].join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `CrewChief_Tires_${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="py-3 px-3 bg-surface-container border border-outline-variant rounded font-mono text-xs uppercase font-bold text-on-surface hover:bg-surface-container-high transition-colors flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[16px]">table</span>
            Tires CSV
          </button>
          <button
            onClick={() => {
              const header = 'Date,Name,Description,Amount,Type,Payer,Payee,Weekend';
              const rows = accounting.map((e) =>
                [e.date, e.name, e.description || '', String(e.amount), e.type, e.payer || '', e.payee || '', e.weekendName || '']
                  .map((v) => `"${String(v).replace(/"/g, '""')}"`)
                  .join(','),
              );
              const csv = [header, ...rows].join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `CrewChief_Accounting_${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="py-3 px-3 bg-surface-container border border-outline-variant rounded font-mono text-xs uppercase font-bold text-on-surface hover:bg-surface-container-high transition-colors flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[16px]">table</span>
            Accounting CSV
          </button>
        </div>
      </div>

      {/* Shared With Me */}
      <div className="pt-6 border-t border-outline-variant">
        <h2 className="font-display text-xl uppercase font-bold text-on-surface mb-4">Shared With Me</h2>
        {loadingShared ? (
          <p className="text-on-surface-variant font-mono text-sm">Loading shared items...</p>
        ) : !user ? (
          <p className="text-on-surface-variant font-mono text-sm">Log in to see items shared with you.</p>
        ) : sharedSetups.length === 0 && sharedWeekends.length === 0 ? (
          <p className="text-on-surface-variant font-mono text-sm">No shared items found.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-3">
              <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-base">settings_input_component</span>
                Setups
              </h3>
              {sharedSetups.length === 0 && (
                <div className="p-4 border border-outline-variant/30 rounded bg-surface-container/20 text-xs text-on-surface-variant italic">No setups shared with you yet.</div>
              )}
              {sharedSetups.map((s) => (
                <div key={s.id} className="p-4 border border-outline-variant bg-surface-container rounded flex justify-between items-center">
                  <div>
                    <p className="font-bold text-sm text-on-surface uppercase">{s.chassis}</p>
                    <p className="font-mono text-[10px] text-on-surface-variant mt-0.5">{s.carType} • {s.track}</p>
                  </div>
                  <button
                    onClick={() => onImportSetup?.(s)}
                    className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded font-mono text-[10px] font-bold uppercase transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">download</span>
                    Import
                  </button>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-3">
              <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-base">calendar_today</span>
                Race Weekends
              </h3>
              {sharedWeekends.length === 0 && (
                <div className="p-4 border border-outline-variant/30 rounded bg-surface-container/20 text-xs text-on-surface-variant italic">No race weekends shared with you yet.</div>
              )}
              {sharedWeekends.map((w) => (
                <div key={w.id} className="p-4 border border-outline-variant bg-surface-container rounded flex justify-between items-center">
                  <div>
                    <p className="font-bold text-sm text-on-surface uppercase">{w.name}</p>
                    <p className="font-mono text-[10px] text-on-surface-variant mt-0.5">{w.track} • {w.sessions?.length || 0} Runs</p>
                  </div>
                  <button
                    onClick={() => onImportWeekend?.(w)}
                    className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded font-mono text-[10px] font-bold uppercase transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">download</span>
                    Import
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
