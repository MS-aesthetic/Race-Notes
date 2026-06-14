import { useState } from 'react';
import { Setup, ActiveSession } from '../types';

interface ExportViewProps {
  setup: Setup;
  activeSession: ActiveSession;
}

export default function ExportView({ setup, activeSession }: ExportViewProps) {
  const [cloudSync, setCloudSync] = useState(true);
  
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
              <div>Team Drive: connected [Team_Drive_01]</div>
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
                    <th style="padding:4px; font-size:11px;">Durom.</th>
                    <th style="padding:4px; font-size:11px;">Air Press.</th>
                    <th style="padding:4px; font-size:11px;">Back Sp.</th>
                  </tr>
                </thead>
                <tbody>
                  ${(['lf', 'rf', 'lr', 'rr'] as const).map(k => {
                    const t = (activeSession.tires?.[k]) || {
                      tireId: '-',
                      compound: '-',
                      size: '-',
                      durometer: '-',
                      airPressure: activeSession.pressures?.[k] || '-',
                      backSpacing: '-',
                    };
                    const label = k === 'lf' ? 'Left Front' : k === 'rf' ? 'Right Front' : k === 'lr' ? 'Left Rear' : 'Right Rear';
                    return `
                      <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding:4px; font-weight:bold;">${label} (${k.toUpperCase()})</td>
                        <td style="padding:4px;">${t.tireId || '-'}</td>
                        <td style="padding:4px;">${t.compound || '-'}</td>
                        <td style="padding:4px;">${t.size || '-'}</td>
                        <td style="padding:4px;">${t.durometer || '-'}</td>
                        <td style="padding:4px; font-weight:bold; color:#ba1a20;">${t.airPressure || '-'}</td>
                        <td style="padding:4px;">${t.backSpacing || '-'}</td>
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
                  Connected: Team_Drive_01
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
    </div>
  );
}
