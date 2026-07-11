import { useState, useEffect } from 'react';
import { Setup, ActiveSession, RaceWeekend, AccountingEntry, ShoppingItem, Todo, TireInventoryItem } from '../types';
import { User } from '@supabase/supabase-js';
import { pullSharedData } from '../lib/sync';

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
  shopping?: ShoppingItem[];
  tireInventory?: TireInventoryItem[];
}

type TrackerKind = 'all' | 'tasks' | 'accounting' | 'shopping';

const REPORT_CSS = `
  body{font-family:'Inter',sans-serif;color:#111;padding:32px;max-width:900px;margin:0 auto;line-height:1.5}
  .header{border-bottom:3px solid #ba1a20;padding-bottom:16px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:flex-start}
  .logo{font-size:20px;font-weight:900;color:#ba1a20;text-transform:uppercase;letter-spacing:-1px}
  .sub{font-size:12px;color:#555;margin-top:4px}
  .meta{text-align:right;font-size:12px;color:#555}
  h1{color:#ba1a20;text-transform:uppercase;font-size:22px;margin:24px 0 4px}
  h2{text-transform:uppercase;font-size:14px;color:#444;border-bottom:1px solid #ddd;padding-bottom:6px;margin:24px 0 12px}
  table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:12px}
  th{background:#f0f0f0;text-align:left;padding:6px 10px;font-size:12px;text-transform:uppercase}
  td{padding:5px 10px;border-bottom:1px solid #eee;vertical-align:top}
  .total-row td{font-weight:bold;background:#fafafa;border-top:2px solid #ddd}
  .session-card{border:1px solid #ddd;padding:12px 16px;margin-bottom:12px;border-left:4px solid #ba1a20}
  .session-header{display:flex;justify-content:space-between;margin-bottom:8px;font-size:14px;font-weight:bold;text-transform:uppercase}
  ul{list-style:none;padding:0;margin:0}
  li{padding:4px 0;border-bottom:1px solid #eee;font-size:13px}
  li.done{color:#888;text-decoration:line-through}
  .empty{color:#999;font-size:13px;font-style:italic}
  small{color:#777}
  @media print{body{padding:16px}}
`;

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
  shopping = [],
  tireInventory = [],
}: ExportViewProps) {
  const [cloudSync, setCloudSync] = useState(true);
  const [sharedSetups, setSharedSetups] = useState<Setup[]>([]);
  const [sharedWeekends, setSharedWeekends] = useState<RaceWeekend[]>([]);
  const [loadingShared, setLoadingShared] = useState(false);

  // The active setup is always selectable, plus any saved setups (deduped).
  const setupOptions: Setup[] = [setup, ...savedSetups.filter((s) => s.id !== setup.id)];
  const [selectedSetupId, setSelectedSetupId] = useState<string>(setup.id);
  const [selectedWeekendId, setSelectedWeekendId] = useState<string>(weekends[0]?.id || '');
  const [selectedTracker, setSelectedTracker] = useState<TrackerKind>('all');

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

  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  // ── Shared print shell ──────────────────────────────────────────────────
  const printReport = (title: string, subtitle: string, bodyHtml: string) => {
    const pw = window.open('', '_blank');
    if (!pw) {
      alert('Allow popups to export the report.');
      return;
    }
    pw.document.write(
      `<!DOCTYPE html><html><head><title>${title}</title><style>${REPORT_CSS}</style></head><body>` +
        `<div class="header"><div><div class="logo">CREW CHIEF — ${title}</div>` +
        `<div class="sub">${subtitle}</div></div>` +
        `<div class="meta">Generated ${new Date().toLocaleString()}</div></div>` +
        bodyHtml +
        `<script>window.onload=function(){window.print()}</script></body></html>`,
    );
    pw.document.close();
  };

  // ── Section builders (return HTML strings) ───────────────────────────────
  const setupSection = (s: Setup): string => {
    const adj = activeSession.adjustments
      .map(
        (a) =>
          `<tr><td style="font-family:monospace">[${a.icon?.toUpperCase() || 'SET'}] ${a.label}</td><td style="text-align:right;font-weight:bold">${a.value}</td></tr>`,
      )
      .join('');
    return `
      <h1>${s.chassis || 'Unspecified Chassis'}</h1>
      <p style="color:#555;font-size:14px">${s.carType || 'No class'} · Track base: ${s.track || '—'}</p>
      <h2>Chassis Corner Metrics</h2>
      <table><thead><tr><th>Corner</th><th>Spring</th><th>Shock</th><th>Tire Press</th></tr></thead><tbody>
        <tr><td>Left Front</td><td>${s.lf.spring} lb</td><td>${s.lf.shock}</td><td>${s.lf.tirePress} psi</td></tr>
        <tr><td>Right Front</td><td>${s.rf.spring} lb</td><td>${s.rf.shock}</td><td>${s.rf.tirePress} psi</td></tr>
        <tr><td>Left Rear</td><td>${s.lr.spring} lb</td><td>${s.lr.shock}</td><td>${s.lr.tirePress} psi</td></tr>
        <tr><td>Right Rear</td><td>${s.rr.spring} lb</td><td>${s.rr.shock}</td><td>${s.rr.tirePress} psi</td></tr>
      </tbody></table>
      <h2>Active Session — ${activeSession.name || 'Unnamed'}</h2>
      <table><tbody>
        <tr><td>Finish</td><td><strong>${activeSession.finishPos || '—'}</strong> (${activeSession.gap || '—'})</td><td>Best Lap</td><td><strong>${activeSession.bestLap || '—'}s</strong></td></tr>
        <tr><td>Avg Lap</td><td>${activeSession.avgLap || '—'}s</td><td>Max RPM</td><td>${activeSession.maxRpm || '—'}</td></tr>
        <tr><td>Conditions</td><td colspan="3">${activeSession.condition || '—'}</td></tr>
      </tbody></table>
      <h2>Setup Adjustments (${activeSession.adjustments.length})</h2>
      ${adj ? `<table><tbody>${adj}</tbody></table>` : '<p class="empty">No adjustments recorded.</p>'}
      <h2>Competition Notes</h2>
      <p style="font-size:13px;white-space:pre-wrap;font-style:italic;color:#333">${activeSession.competitionNotes || 'No notes.'}</p>
    `;
  };

  const weekendSection = (w: RaceWeekend): string => {
    const linkedTasks = todos.flatMap((t) => t.items.filter((i) => i.weekendId === w.id));
    const linkedAcct = accounting.filter((e) => e.weekendId === w.id);
    const linkedShop = shopping.filter((s) => s.weekendId === w.id);
    const totalIncome = linkedAcct.filter((e) => e.type === 'income').reduce((s, e) => s + e.amount, 0);
    const totalExpense = linkedAcct.filter((e) => e.type === 'expense').reduce((s, e) => s + e.amount, 0);

    const sessions = w.sessions
      .map(
        (s) => `<div class="session-card"><div class="session-header"><strong>${s.name}</strong><span>${s.type}</span></div>
        <table><tbody>
          <tr><td>Best Lap</td><td><strong>${s.bestLap || '—'}</strong></td><td>Finish</td><td><strong>${s.finishPos || '—'}</strong></td></tr>
          <tr><td>Conditions</td><td colspan="3">${s.condition || '—'}</td></tr>
          ${s.competitionNotes ? `<tr><td valign="top">Notes</td><td colspan="3">${s.competitionNotes}</td></tr>` : ''}
        </tbody></table></div>`,
      )
      .join('');

    const acctHtml = linkedAcct.length
      ? `<table><thead><tr><th>Name</th><th>Type</th><th>Amount</th></tr></thead><tbody>
          ${linkedAcct.map((e) => `<tr><td>${e.name}</td><td>${e.type}</td><td>${e.type === 'income' ? '+' : '−'}${fmt(e.amount)}</td></tr>`).join('')}
          <tr class="total-row"><td><strong>Net</strong></td><td colspan="2"><strong>${fmt(totalIncome - totalExpense)}</strong></td></tr>
        </tbody></table>`
      : '<p class="empty">No accounting linked.</p>';

    const shopHtml = linkedShop.length
      ? `<table><thead><tr><th>Item</th><th>Cost</th><th>Status</th></tr></thead><tbody>
          ${linkedShop.map((i) => `<tr><td>${i.name}</td><td>${i.cost != null ? fmt(i.cost) : '—'}</td><td>${i.purchased ? '✓ Purchased' : 'Needed'}</td></tr>`).join('')}
        </tbody></table>`
      : '<p class="empty">No shopping linked.</p>';

    const tasksHtml = linkedTasks.length
      ? `<ul>${linkedTasks.map((t) => `<li class="${t.done ? 'done' : ''}">${t.done ? '✓' : '○'} ${t.text}</li>`).join('')}</ul>`
      : '<p class="empty">No tasks linked.</p>';

    return `
      <h1>${w.name}</h1>
      <p style="color:#555;font-size:14px">${w.track} · ${w.date}</p>
      ${w.notes ? `<div style="background:#f9f9f9;border-left:3px solid #ba1a20;padding:10px 14px;margin:12px 0;font-size:13px">${w.notes}</div>` : ''}
      <h2>Sessions (${w.sessions.length})</h2>
      ${w.sessions.length ? sessions : '<p class="empty">No sessions recorded.</p>'}
      <h2>Tasks</h2>${tasksHtml}
      <h2>Accounting</h2>${acctHtml}
      <h2>Shopping</h2>${shopHtml}
    `;
  };

  const trackersSection = (kind: TrackerKind): string => {
    const allTasks = todos.flatMap((t) => t.items);
    const tasksHtml =
      kind === 'all' || kind === 'tasks'
        ? `<h2>Tasks (${allTasks.length})</h2>${
            allTasks.length
              ? `<ul>${allTasks.map((t) => `<li class="${t.done ? 'done' : ''}">${t.done ? '✓' : '○'} ${t.text}${t.weekendName ? ` <small>(${t.weekendName})</small>` : ''}</li>`).join('')}</ul>`
              : '<p class="empty">No tasks.</p>'
          }`
        : '';
    const income = accounting.filter((e) => e.type === 'income').reduce((s, e) => s + e.amount, 0);
    const expense = accounting.filter((e) => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
    const acctHtml =
      kind === 'all' || kind === 'accounting'
        ? `<h2>Accounting (${accounting.length})</h2>${
            accounting.length
              ? `<table><thead><tr><th>Date</th><th>Name</th><th>Type</th><th>Amount</th></tr></thead><tbody>
                  ${accounting.map((e) => `<tr><td>${e.date}</td><td>${e.name}</td><td>${e.type}</td><td>${e.type === 'income' ? '+' : '−'}${fmt(e.amount)}</td></tr>`).join('')}
                  <tr class="total-row"><td colspan="3"><strong>Net</strong></td><td><strong>${fmt(income - expense)}</strong></td></tr>
                </tbody></table>`
              : '<p class="empty">No accounting entries.</p>'
          }`
        : '';
    const shopTotal = shopping.reduce((s, i) => s + (i.cost ?? 0), 0);
    const shopHtml =
      kind === 'all' || kind === 'shopping'
        ? `<h2>Shopping (${shopping.length})</h2>${
            shopping.length
              ? `<table><thead><tr><th>Item</th><th>Cost</th><th>Status</th></tr></thead><tbody>
                  ${shopping.map((i) => `<tr><td>${i.name}</td><td>${i.cost != null ? fmt(i.cost) : '—'}</td><td>${i.purchased ? '✓ Purchased' : 'Needed'}</td></tr>`).join('')}
                  <tr class="total-row"><td><strong>Estimated Total</strong></td><td><strong>${fmt(shopTotal)}</strong></td><td></td></tr>
                </tbody></table>`
              : '<p class="empty">No shopping items.</p>'
          }`
        : '';
    return tasksHtml + acctHtml + shopHtml || '<p class="empty">Nothing to export.</p>';
  };

  // ── Export actions ───────────────────────────────────────────────────────
  const selectedSetup = setupOptions.find((s) => s.id === selectedSetupId) ?? setup;

  const exportSetup = () =>
    printReport('Setup Report', `${selectedSetup.chassis || 'Setup'} · ${selectedSetup.carType || ''}`, setupSection(selectedSetup));

  const exportWeekend = () => {
    const w = weekends.find((x) => x.id === selectedWeekendId);
    if (!w) {
      alert('Select a race weekend first.');
      return;
    }
    printReport('Weekend Report', `${w.name} · ${w.track}`, weekendSection(w));
  };

  const trackerLabel: Record<TrackerKind, string> = {
    all: 'All Trackers',
    tasks: 'Tasks',
    accounting: 'Accounting',
    shopping: 'Shopping',
  };
  const exportTrackers = () => printReport('Trackers Report', trackerLabel[selectedTracker], trackersSection(selectedTracker));

  const exportAll = () => {
    const body =
      setupSection(selectedSetup) +
      (weekends.length
        ? `<h1 style="page-break-before:always">Weekends (${weekends.length})</h1>` + weekends.map(weekendSection).join('')
        : '') +
      `<h1 style="page-break-before:always">Trackers</h1>` +
      trackersSection('all');
    printReport('Master Report', 'Full team export — setup, weekends & trackers', body);
  };

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
                  {weekends.map((w) => (
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
            <p className="font-mono text-xs text-on-surface-variant italic">No race weekends yet.</p>
          )}
        </div>

        {/* Export Trackers */}
        <div className="bg-surface-container border border-outline-variant rounded p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[18px]">checklist</span>
            <span className="font-mono text-xs uppercase font-bold text-on-surface tracking-wide">Export Trackers</span>
          </div>
          <div className="relative">
            <select value={selectedTracker} onChange={(e) => setSelectedTracker(e.target.value as TrackerKind)} className={selectClass}>
              <option value="all">All Trackers</option>
              <option value="tasks">Tasks</option>
              <option value="accounting">Accounting</option>
              <option value="shopping">Shopping</option>
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
                    <p className="font-mono text-[10px] text-on-surface-variant mt-0.5">{w.track} • {w.sessions?.length || 0} Sessions</p>
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
