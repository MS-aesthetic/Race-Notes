import { useState, useEffect } from 'react';
import { Setup, ActiveSession, RaceWeekend, AccountingEntry, ShoppingItem, Todo, TireInventoryItem } from '../types';
import { User } from '@supabase/supabase-js';
import { pullSharedData } from '../lib/sync';

interface ExportViewProps {
  user?: User | null;
  setup: Setup;
  activeSession: ActiveSession;
  onImportSetup?: (setup: Setup) => void;
  onImportWeekend?: (weekend: RaceWeekend) => void;
  weekends?: RaceWeekend[];
  todos?: Todo[];
  accounting?: AccountingEntry[];
  shopping?: ShoppingItem[];
  tireInventory?: TireInventoryItem[];
}

export default function ExportView({ user = null, setup, activeSession, onImportSetup, onImportWeekend, weekends = [], todos = [], accounting = [], shopping = [], tireInventory = [] }: ExportViewProps) {
  const [cloudSync, setCloudSync] = useState(true);
  const [sharedSetups, setSharedSetups] = useState<Setup[]>([]);
  const [sharedWeekends, setSharedWeekends] = useState<RaceWeekend[]>([]);
  const [loadingShared, setLoadingShared] = useState(false);

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

  // Selection checklist state
  const [items, setItems] = useState([
    { id: '1', title: activeSession.name ? `Active Session (${activeSession.name})` : 'Active Session', subtitle: `${activeSession.name || 'Not Named'} - ${setup.carType || 'No Class Specified'}`, checked: true, icon: 'timer' },
    { id: '2', title: setup.chassis ? `Setup Spec: ${setup.chassis}` : 'Setup Spec', subtitle: `Tire Pressure: LF ${setup.lf.tirePress || '0'} / RF ${setup.rf.tirePress || '0'} psi`, checked: true, icon: 'settings_input_component' },
    { id: '3', title: 'Session Diagnostics', subtitle: activeSession.weather ? `Track Conditions - Temp ${activeSession.weather}` : 'Track Conditions & Weather', checked: false, icon: 'timer' },
    { id: '4', title: 'Telemetry Log & Diagnostics', subtitle: `${activeSession.adjustments.length} Setup Adjustments Recorded`, checked: true, icon: 'speed' },
  ]);

  const toggleItem = (id: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, checked: !it.checked } : it))
    );
  };

  const selectedCount = items.filter((it) => it.checked).length;

  // Weekend Report state
  const [selectedWeekendId, setSelectedWeekendId] = useState<string>(weekends[0]?.id || '');

  const handleWeekendReport = () => {
    const weekend = weekends.find(w => w.id === selectedWeekendId);
    if (!weekend) { alert('Select a race weekend first.'); return; }

    const linkedTasks = todos.flatMap(t => t.items.filter(i => i.weekendId === weekend.id));
    const linkedAccounting = accounting.filter(e => e.weekendId === weekend.id);
    const linkedShopping = shopping.filter(s => s.weekendId === weekend.id);

    const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    const totalIncome = linkedAccounting.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
    const totalExpense = linkedAccounting.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
    const shoppingTotal = linkedShopping.reduce((s, i) => s + (i.cost ?? 0), 0);

    const sessionsHtml = weekend.sessions.map(s => `
      <div class="session-card">
        <div class="session-header">
          <strong>${s.name}</strong>
          <span>${s.type}</span>
        </div>
        <table><tbody>
          <tr><td>Best Lap</td><td><strong>${s.bestLap || '—'}</strong></td><td>Finish</td><td><strong>${s.finishPos || '—'}</strong></td></tr>
          <tr><td>Conditions</td><td colspan="3">${s.condition || '—'}</td></tr>
          <tr><td>Weather</td><td colspan="3">${s.weather || '—'}</td></tr>
          <tr><td>Setup</td><td colspan="3">${s.setupUsed || '—'}</td></tr>
          ${s.adjustments?.length ? `<tr><td valign="top">Adjustments</td><td colspan="3">${s.adjustments.map(a => `${a.label} ${a.value}`).join(' · ')}</td></tr>` : ''}
          ${s.diagnostics ? `<tr><td valign="top">Driver Feedback</td><td colspan="3">Entry: ${s.diagnostics.cornerEntry} · Apex: ${s.diagnostics.centerApex} · Exit: ${s.diagnostics.cornerExit}</td></tr>` : ''}
          ${s.competitionNotes ? `<tr><td valign="top">Notes</td><td colspan="3">${s.competitionNotes}</td></tr>` : ''}
        </tbody></table>
      </div>
    `).join('');

    const accountingHtml = linkedAccounting.length ? `
      <table><thead><tr><th>Name</th><th>Type</th><th>Amount</th><th>Payer</th><th>Payee</th></tr></thead><tbody>
        ${linkedAccounting.map(e => `<tr><td>${e.name}</td><td>${e.type}</td><td>${e.type === 'income' ? '+' : '−'}${fmt(e.amount)}</td><td>${e.payer || '—'}</td><td>${e.payee || '—'}</td></tr>`).join('')}
        <tr class="total-row"><td colspan="2"><strong>Net</strong></td><td><strong>${fmt(totalIncome - totalExpense)}</strong></td><td colspan="2">Income: ${fmt(totalIncome)} · Expenses: ${fmt(totalExpense)}</td></tr>
      </tbody></table>` : '<p class="empty">No accounting entries linked to this weekend.</p>';

    const shoppingHtml = linkedShopping.length ? `
      <table><thead><tr><th>Item</th><th>Cost</th><th>Status</th></tr></thead><tbody>
        ${linkedShopping.map(i => `<tr><td>${i.name}${i.description ? `<br><small>${i.description}</small>` : ''}</td><td>${i.cost != null ? fmt(i.cost) : '—'}</td><td>${i.purchased ? '✓ Purchased' : 'Needed'}</td></tr>`).join('')}
        <tr class="total-row"><td colspan="1"><strong>Estimated Total</strong></td><td><strong>${fmt(shoppingTotal)}</strong></td><td></td></tr>
      </tbody></table>` : '<p class="empty">No shopping items linked to this weekend.</p>';

    const tasksHtml = linkedTasks.length ? `<ul>${linkedTasks.map(t => `<li class="${t.done ? 'done' : ''}">${t.done ? '✓' : '○'} ${t.text}${t.completionNote ? ` — <em>${t.completionNote}</em>` : ''}</li>`).join('')}</ul>` : '<p class="empty">No tasks linked to this weekend.</p>';

    const weatherHtml = weekend.weather ? `
      <table><tbody>
        <tr><td>Location</td><td><strong>${weekend.weather.location}</strong></td></tr>
        <tr><td>Temperature</td><td>${weekend.weather.temp}°F</td></tr>
        <tr><td>Conditions</td><td>${weekend.weather.condition}</td></tr>
        <tr><td>Humidity</td><td>${weekend.weather.humidity}%</td></tr>
        <tr><td>Wind</td><td>${weekend.weather.windSpeed} mph</td></tr>
        <tr><td>Fetched</td><td>${new Date(weekend.weather.fetchedAt).toLocaleString()}</td></tr>
      </tbody></table>` : '<p class="empty">No weather data saved for this weekend.</p>';

    const pw = window.open('', '_blank');
    if (!pw) { alert('Allow popups to export the report.'); return; }
    pw.document.write(`<!DOCTYPE html><html><head><title>Weekend Report — ${weekend.name}</title><style>
      body{font-family:sans-serif;color:#111;padding:32px;max-width:900px;margin:0 auto;line-height:1.5}
      .header{border-bottom:3px solid #ba1a20;padding-bottom:16px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:flex-start}
      .logo{font-size:20px;font-weight:900;color:#ba1a20;text-transform:uppercase;letter-spacing:-1px}
      h1{color:#ba1a20;text-transform:uppercase;font-size:22px;margin:0 0 4px}
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
    </style></head><body>
      <div class="header">
        <div>
          <div class="logo">CREW CHIEF — Weekend Report</div>
          <div style="font-size:12px;color:#555;margin-top:4px">Generated ${new Date().toLocaleString()}</div>
        </div>
        <div style="text-align:right;font-size:12px;color:#555">
          <div>${weekend.sessions.length} Session${weekend.sessions.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      <h1>${weekend.name}</h1>
      <p style="color:#555;font-size:14px">${weekend.track} · ${weekend.date}</p>
      ${weekend.notes ? `<div style="background:#f9f9f9;border-left:3px solid #ba1a20;padding:10px 14px;margin:12px 0;font-size:13px">${weekend.notes}</div>` : ''}

      <h2>Weather & Location</h2>
      ${weatherHtml}

      <h2>Sessions (${weekend.sessions.length})</h2>
      ${weekend.sessions.length ? sessionsHtml : '<p class="empty">No sessions recorded.</p>'}

      <h2>Tasks Linked to This Weekend</h2>
      ${tasksHtml}

      <h2>Accounting</h2>
      ${accountingHtml}

      <h2>Shopping List</h2>
      ${shoppingHtml}

      <script>window.onload=()=>{window.print()}</script>
    </body></html>`);
    pw.document.close();
  };

  const handlePrint = () => {
    // Dynamically trigger print for the report layout
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Allow popups in your browser to download the report.');
      return;
    }

    const compiledAdjustments = activeSession.adjustments
      .map(adj => `<tr><td style="padding:8px; border-bottom:1px solid #ddd; font-family: monospace;">[${adj.icon.toUpperCase()}] ${adj.label}</td><td style="padding:8px; border-bottom:1px solid #ddd; text-align:right; font-weight:bold;">${adj.value}</td></tr>`)
      .join('');

    const htmlContent = `
      <html>
        <head>
          <title>Race Notes - Setup Report</title>
          <style>
            body { font-family: 'Inter', sans-serif; color: #111; padding: 40px; margin: 0; line-height: 1.5; }
            .header { border-bottom: 3px solid #ba1a20; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
            .logo { font-size: 24px; font-weight: bold; color: #ba1a20; text-transform: uppercase; letter-spacing:-1px; }
            .meta { text-align: right; font-size: 12px; color: #555; }
            h1, h2, h3 { text-transform: uppercase; margin-top: 0; letter-spacing: -0.5px; }
            h1 { color: #ba1a20; margin-bottom: 5px; }
            .grid { display: flex; flex-direction: column; gap: 20px; margin-bottom: 30px; }
            .card { border: 1px solid #ddd; padding: 20px; background: #fafafa; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { text-align: left; background: #eee; padding: 8px; font-size: 13px; text-transform: uppercase; }
            td { padding: 6px; font-size: 13px; }
            .highlight { font-weight: bold; color: #ba1a20; }
            .pressure-strip { padding: 10px; background: #f0f0f0; border-left: 4px solid #ba1a20; font-family: monospace; font-size: 12px; margin-bottom:10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="logo">RACE NOTES REPORT</div>
              <div style="font-size:14px; font-weight:500;">MASTER TELEMETRY & CHASSIS SPEC SHEET</div>
            </div>
            <div class="meta">
              <div>Export date: ${new Date().toLocaleDateString()}</div>
              <div>Vehicle type: ${setup.carType}</div>
              <div>Cloud Sync: Race Notes</div>
            </div>
          </div>

          <h1>Active Chassis Build: ${setup.chassis || 'Unspecified Chassis'}</h1>
          <p style="font-size: 14px; color: #444; margin-bottom: 30px;">Track base: ${setup.track || 'Unspecified Track'} | Logged Session: ${activeSession.name || 'Unspecified Session'} (${activeSession.condition || 'No conditions recorded'})</p>

          <div class="grid">
            <div class="card">
              <h2>Chassis Corner Metrics</h2>
              <table>
                <thead>
                  <tr><th>Corner</th><th>Spring</th><th>Shock</th><th>Press Baseline</th></tr>
                </thead>
                <tbody>
                  <tr><td>Left Front</td><td>${setup.lf.spring} lb</td><td>${setup.lf.shock}</td><td>${setup.lf.tirePress} psi</td></tr>
                  <tr><td>Right Front</td><td>${setup.rf.spring} lb</td><td>${setup.rf.shock}</td><td>${setup.rf.tirePress} psi</td></tr>
                  <tr><td>Left Rear</td><td>${setup.lr.spring} lb</td><td>${setup.lr.shock}</td><td>${setup.lr.tirePress} psi</td></tr>
                  <tr><td>Right Rear</td><td>${setup.rr.spring} lb</td><td>${setup.rr.shock}</td><td>${setup.rr.tirePress} psi</td></tr>
                </tbody>
              </table>
            </div>

            <div class="card">
              <h2>Active Session Telemetry & Tires</h2>
              <table style="margin-bottom:15px; font-size:11px; width:100%; border-collapse:collapse;">
                <thead>
                  <tr style="background:#eee; text-transform:uppercase;">
                    <th style="padding:4px; font-size:11px;">Corner</th>
                    <th style="padding:4px; font-size:11px;">Tire ID</th>
                    <th style="padding:4px; font-size:11px;">Compound</th>
                    <th style="padding:4px; font-size:11px;">Size</th>
                    <th style="padding:4px; font-size:11px;">Air Press.</th>
                  </tr>
                </thead>
                <tbody>
                  ${(['lf', 'rf', 'lr', 'rr'] as const).map(k => {
                    const t = (activeSession.tires?.[k]) || {
                      compound: '-',
                      size: '-',
                      airPressure: activeSession.pressures?.[k] || '-',
                    };
                    const label = k === 'lf' ? 'Left Front' : k === 'rf' ? 'Right Front' : k === 'lr' ? 'Left Rear' : 'Right Rear';
                    return `
                      <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding:4px; font-weight:bold;">${label} (${k.toUpperCase()})</td>
                        <td style="padding:4px;">${t.compound || '-'}</td>
                        <td style="padding:4px;">${t.size || '-'}</td>
                        <td style="padding:4px; font-weight:bold; color:#ba1a20;">${t.airPressure || '-'}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
              <p style="margin-top:20px; font-size: 13px;">
                <strong>Performance KPIs:</strong><br/>
                Finish Position: <span class="highlight">${activeSession.finishPos}</span> (${activeSession.gap})<br/>
                Best Lap recorded: <span class="highlight">${activeSession.bestLap}s</span><br/>
                Average Lap time: ${activeSession.avgLap}s<br/>
                Max Engine Speed: ${activeSession.maxRpm} Peak RPM
              </p>
            </div>
          </div>

          <div class="card" style="margin-bottom:30px;">
            <h2>Session Setup Adjustments (${activeSession.adjustments.length})</h2>
            ${compiledAdjustments ? `
              <table style="margin-top:10px;">
                <thead>
                  <tr><th>Adjustment Factor Details</th><th style="text-align:right;">Shift Magnitude</th></tr>
                </thead>
                <tbody>
                  ${compiledAdjustments}
                </tbody>
              </table>
            ` : '<p style="font-size:13px; color:#555;">No adjustments requested or applied during this feature sequence.</p>'}
          </div>

          <div class="card">
            <h2>Competition Engineering Notes</h2>
            <p style="font-size:13px; font-style:italic; white-space: pre-wrap; line-height:1.6; color:#333;">${activeSession.competitionNotes || 'No notes added for this feature sequence.'}</p>
          </div>

          <div style="margin-top: 50px; border-top:1px solid #ccc; padding-top:10px; font-size: 11px; text-align: center; color: #777;">
            Race Notes Telemetry Suite &trade; System Report - Designed for professional track operations. All credentials valid.
          </div>

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6" id="export-report-view">
      <header className="mb-6 flex flex-col gap-1">
        <h1 className="font-display-lg text-2xl sm:text-3xl uppercase text-on-surface font-bold tracking-tight">
          Data Export
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Select telemetry and setup notes to compile into a master PDF report.
        </p>
      </header>

      <div className="flex flex-col gap-6">
        
        {/* Column 1: Configuration & Selection */}
        <div className="flex flex-col gap-6">
          
          {/* Cloud Sync Card */}
          <div className="bg-surface border border-outline-variant p-5 flex flex-col gap-4 rounded">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-on-surface-variant">cloud_upload</span>
                <span className="font-label-md text-label-sm uppercase text-on-surface font-bold tracking-wide">
                  Sync to Cloud
                </span>
              </div>
              {/* Custom IOS-style Toggle */}
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={cloudSync}
                  onChange={(e) => setCloudSync(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-surface-container-highest border border-outline-variant rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-on-surface after:h-4 after:w-4 after:rounded-full after:transition-all peer-checked:bg-primary-container peer-checked:after:bg-on-primary-container"></div>
              </label>
            </div>
            
            {cloudSync ? (
              <div className="flex items-center gap-2 bg-surface-container p-3 border border-outline-variant animate-fade-in">
                <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse status-glow-green"></span>
                <span className="font-label-sm text-xs uppercase text-on-surface-variant font-mono tracking-wider">
                  Cloud Sync Active
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-surface-container p-3 border border-outline-variant animate-fade-in text-on-surface-variant/70">
                <span className="w-2 h-2 rounded-full bg-error-container status-glow-red"></span>
                <span className="font-label-sm text-xs uppercase text-on-surface-variant/80 font-mono tracking-wider">
                  Sync Disabled: Offline mode active
                </span>
              </div>
            )}
          </div>

          {/* Selection List */}
          <div className="flex flex-col rounded overflow-hidden">
            <div className="bg-surface-container-high px-4 py-3 border border-b-0 border-outline-variant flex justify-between items-center">
              <span className="font-label-md text-label-sm uppercase text-on-surface font-bold tracking-wider">
                Include in Report
              </span>
              <span className="font-label-sm text-xs text-on-surface-variant font-mono font-bold">
                {selectedCount} Selected
              </span>
            </div>
            
            <div className="bg-surface border border-outline-variant flex flex-col divide-y divide-outline-variant/30">
              {items.map((it) => (
                <label
                  key={it.id}
                  id={`export-item-${it.id}`}
                  className="flex items-center gap-4 p-4 min-h-[56px] cursor-pointer hover:bg-surface-container-highest transition-colors group select-none"
                >
                  <input
                    type="checkbox"
                    checked={it.checked}
                    onChange={() => toggleItem(it.id)}
                    className="w-5 h-5 accent-primary border border-outline-variant bg-surface-dim focus:ring-0 cursor-pointer"
                  />
                  <div className="flex-1 flex flex-col min-w-0 pr-1">
                    <span className="font-label-sm text-xs uppercase text-on-surface group-hover:text-primary transition-colors block truncate font-bold">
                      {it.title}
                    </span>
                    <span className="font-label-sm text-[11px] text-on-surface-variant block truncate">
                      {it.subtitle}
                    </span>
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors text-[20px]">
                    {it.icon}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Column 2: Preview & CTA */}
        <div className="flex flex-col gap-6">
          {/* PDF Preview Container */}
          <div className="bg-surface border border-outline-variant p-4 flex flex-col items-center justify-center relative overflow-hidden h-[400px] sm:h-[460px] rounded">
            
            {/* Background Pattern for Industrial Feel */}
            <div className="absolute inset-0 opacity-[0.06] bg-[radial-gradient(#5b403d_1px,transparent_1px)] [background-size:16px_16px]"></div>
            <span className="absolute top-4 left-4 font-label-sm text-xs uppercase text-on-surface-variant font-mono tracking-wider font-bold">
              Preview Layout
            </span>
            
            {/* Mock Paper */}
            <div className="bg-on-surface text-surface w-[240px] sm:w-[280px] aspect-[1/1.414] shadow-2xl relative flex flex-col p-4 z-10 border border-outline-variant hover:scale-[1.02] transition-transform duration-200">
              {/* Scanner Effect */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="w-full h-full scanline"></div>
              </div>
              
              {/* Mock Content */}
              <div className="flex items-center justify-between border-b border-surface-variant pb-2 mb-3">
                <span className="material-symbols-outlined text-surface text-base">
                  precision_manufacturing
                </span>
                <div className="h-1.5 w-16 bg-surface-variant"></div>
              </div>
              
              <div className="h-3 w-3/4 bg-surface-dim mb-3"></div>
              <div className="flex flex-col gap-1.5 flex-1 select-none">
                <div className="h-1.5 w-full bg-surface-variant/40"></div>
                <div className="h-1.5 w-full bg-surface-variant/40"></div>
                <div className="h-1.5 w-5/6 bg-surface-variant/40"></div>
                
                <div className="mt-4 flex flex-col gap-1.5">
                  <div className="relative border border-outline-variant/50 p-1 bg-surface-variant/10 text-[6px] font-mono leading-none">
                    <p className="font-bold border-b pb-0.5 mb-1 text-[5px]">BUILD DETAILS</p>
                    <p>SP: {setup.lf.spring}/{setup.rf.spring}</p>
                    <p>SH: {setup.lf.shock}/{setup.rf.shock}</p>
                  </div>
                  <div className="relative border border-outline-variant/50 p-1 bg-surface-variant/10 text-[6px] font-mono leading-none">
                    <p className="font-bold border-b pb-0.5 mb-1 text-[5px]">HOT PRESSURES</p>
                    <p>LF: {activeSession.pressures.lf}</p>
                    <p>RF: {activeSession.pressures.rf}</p>
                  </div>
                </div>
              </div>
              
              <div className="mt-auto border-t border-outline-variant pb-1 pt-1.5 flex justify-between items-center text-[5px] font-mono opacity-50">
                <span>RACE NOTES TELEMETRY</span>
                <span>PAGE 1 OF 1</span>
              </div>
            </div>
          </div>

          {/* Main Action */}
          <button
            onClick={handlePrint}
            id="btn-export-to-pdf"
            className="w-full bg-primary hover:bg-primary-fixed-dim text-on-primary font-label-md text-label-md uppercase font-bold min-h-[56px] flex justify-center items-center gap-2.5 transition-colors active:scale-[0.99] cursor-pointer shadow-lg rounded tracking-wider"
          >
            <span className="material-symbols-outlined text-[20px]">picture_as_pdf</span>
            Export to PDF Report
          </button>
        </div>
      </div>

      {/* Weekend Report Section */}
      {weekends.length > 0 && (
        <div className="pt-6 border-t border-outline-variant space-y-4">
          <div>
            <h2 className="font-display text-xl uppercase font-bold text-on-surface">Weekend Report</h2>
            <p className="text-on-surface-variant font-mono text-xs mt-1">Export a full weekend summary — sessions, weather, notes, tasks, accounting, and shopping all in one PDF.</p>
          </div>

          <div className="bg-surface-container border border-outline-variant rounded-lg p-4 space-y-3">
            <label className="font-mono text-[10px] uppercase font-bold text-on-surface-variant tracking-wider block">Select Weekend</label>
            <div className="relative">
              <select
                value={selectedWeekendId}
                onChange={e => setSelectedWeekendId(e.target.value)}
                className="w-full bg-surface-container border border-outline-variant focus:border-primary text-on-surface font-mono text-sm px-3 py-3 rounded-lg outline-none appearance-none cursor-pointer pr-8"
              >
                {weekends.map(w => (
                  <option key={w.id} value={w.id}>{w.name} — {w.track} ({w.date})</option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none text-[18px]">expand_more</span>
            </div>

            {selectedWeekendId && (() => {
              const w = weekends.find(x => x.id === selectedWeekendId);
              if (!w) return null;
              const linkedTasks = todos.flatMap(t => t.items.filter(i => i.weekendId === w.id));
              const linkedAcct = accounting.filter(e => e.weekendId === w.id);
              const linkedShop = shopping.filter(s => s.weekendId === w.id);
              return (
                <div className="grid grid-cols-2 gap-2 text-center">
                  {[
                    { label: 'Sessions', value: w.sessions.length, icon: 'timer' },
                    { label: 'Tasks', value: linkedTasks.length, icon: 'checklist' },
                    { label: 'Expenses', value: linkedAcct.length, icon: 'account_balance' },
                    { label: 'Shopping', value: linkedShop.length, icon: 'shopping_cart' },
                  ].map(({ label, value, icon }) => (
                    <div key={label} className="bg-surface border border-outline-variant/50 rounded p-2">
                      <span className="material-symbols-outlined text-primary text-[14px] block">{icon}</span>
                      <p className="font-mono text-lg font-bold text-on-surface">{value}</p>
                      <p className="font-mono text-[9px] text-on-surface-variant uppercase">{label}</p>
                    </div>
                  ))}
                </div>
              );
            })()}

            <button
              onClick={handleWeekendReport}
              className="w-full py-3 bg-primary text-on-primary font-mono text-xs uppercase font-bold rounded-lg tracking-wider active:opacity-80 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
              Export Weekend Report
            </button>
          </div>
        </div>
      )}

      {/* Shared With Me Section */}
      <div className="mt-8 pt-8 border-t border-outline-variant">
        <h2 className="font-display text-xl uppercase font-bold text-on-surface mb-4">
          Shared With Me
        </h2>
        {loadingShared ? (
          <p className="text-on-surface-variant font-mono text-sm">Loading shared items...</p>
        ) : (!user ? (
          <p className="text-on-surface-variant font-mono text-sm">Log in to see items shared with you.</p>
        ) : (sharedSetups.length === 0 && sharedWeekends.length === 0) ? (
          <p className="text-on-surface-variant font-mono text-sm">No shared items found.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Shared Setups */}
            <div className="flex flex-col gap-3">
              <h3 className="font-label-md text-sm font-bold uppercase tracking-wider text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-base">settings_input_component</span>
                Setups
              </h3>
              {sharedSetups.length === 0 && (
                <div className="p-4 border border-outline-variant/30 rounded bg-surface-container/20 text-xs text-on-surface-variant italic">
                  No setups shared with you yet.
                </div>
              )}
              {sharedSetups.map(s => (
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

            {/* Shared Weekends */}
            <div className="flex flex-col gap-3">
              <h3 className="font-label-md text-sm font-bold uppercase tracking-wider text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-base">calendar_today</span>
                Race Weekends
              </h3>
              {sharedWeekends.length === 0 && (
                <div className="p-4 border border-outline-variant/30 rounded bg-surface-container/20 text-xs text-on-surface-variant italic">
                  No race weekends shared with you yet.
                </div>
              )}
              {sharedWeekends.map(w => (
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
        ))}
      </div>

      {/* Quick Exports */}
      <div className="mt-8 pt-8 border-t border-outline-variant space-y-4">
        <h2 className="font-display text-xl uppercase font-bold text-on-surface">Quick Exports</h2>
        <p className="text-on-surface-variant font-mono text-xs">Download data as CSV files.</p>

        <div className="grid grid-cols-2 gap-3">
          {/* Tire CSV export */}
          <button
            onClick={() => {
              const header = 'Tire #,Size,Compound,BS,Duro,PSI,Heat Cycles,Est Laps,Age (days)';
              const rows = (tireInventory || []).map(t => {
                const age = t.dateAdded
                  ? Math.floor((Date.now() - new Date(t.dateAdded).getTime()) / 86400000) + (t.initialAgeDays ?? 0)
                  : (t.initialAgeDays ?? 0);
                return [t.tireNumber, t.size, t.compound, t.wheelBackspacing, t.durometer, t.airPressure || '', t.heatCycles ?? 0, 0, age].join(',');
              });
              const csv = [header, ...rows].join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = `CrewChief_Tires_${new Date().toISOString().slice(0, 10)}.csv`;
              a.click(); URL.revokeObjectURL(url);
            }}
            className="py-3 px-3 bg-surface-container border border-outline-variant rounded-lg font-mono text-xs uppercase font-bold text-on-surface hover:bg-surface-container-high transition-colors flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[16px]">table</span>
            Tires CSV
          </button>

          {/* Accounting CSV export */}
          <button
            onClick={() => {
              const header = 'Date,Name,Description,Amount,Type,Payer,Payee,Weekend';
              const rows = accounting.map(e =>
                [e.date, e.name, e.description || '', String(e.amount), e.type, e.payer || '', e.payee || '', e.weekendName || '']
                  .map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
              );
              const csv = [header, ...rows].join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = `CrewChief_Accounting_${new Date().toISOString().slice(0, 10)}.csv`;
              a.click(); URL.revokeObjectURL(url);
            }}
            className="py-3 px-3 bg-surface-container border border-outline-variant rounded-lg font-mono text-xs uppercase font-bold text-on-surface hover:bg-surface-container-high transition-colors flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[16px]">table</span>
            Accounting CSV
          </button>
        </div>
      </div>
    </div>
  );
}
