import type { AccountingEntry, ActiveSession, RaceWeekend, Setup, Todo } from '../types';
import { getMainChecklist } from './mainChecklist';
import { displayVersionLabel } from './setupLifecycle';

export type TrackerReportKind = 'all' | 'checklist' | 'accounting';

export interface ReportDocument {
  title: string;
  subtitle: string;
  filename: string;
  bodyHtml: string;
  textLines: string[];
}

export const REPORT_CSS = `
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

const html = (value: unknown): string => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const money = (value: number): string => value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

function dateToken(value?: string, fallback = new Date()): string {
  const calendarDate = value?.match(/^(\d{4}-\d{2}-\d{2})(?:$|T)/)?.[1];
  if (calendarDate) return calendarDate;
  const parsed = value ? new Date(value) : fallback;
  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return fallback.toISOString().slice(0, 10);
}

export function reportFilename(label: string, date?: string): string {
  const slug = label.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'race-report';
  return `crewchief-${slug}-${dateToken(date)}.pdf`;
}

function setupSection(setup: Setup, activeSession?: ActiveSession): { html: string; lines: string[] } {
  const adjustments = activeSession?.adjustments ?? [];
  const adjustmentRows = adjustments.map(item =>
    `<tr><td style="font-family:monospace">[${html(item.icon?.toUpperCase() || 'SET')}] ${html(item.label)}</td><td style="text-align:right;font-weight:bold">${html(item.value)}</td></tr>`,
  ).join('');
  const activeRunHtml = activeSession ? `
      <h2>Current Run — ${html(activeSession.name || 'Unnamed')}</h2>
      <table><tbody>
        <tr><td>Finish</td><td><strong>${html(activeSession.finishPos || '—')}</strong> (${html(activeSession.gap || '—')})</td><td>Best Lap</td><td><strong>${html(activeSession.bestLap || '—')}s</strong></td></tr>
        <tr><td>Avg Lap</td><td>${html(activeSession.avgLap || '—')}s</td><td>Max RPM</td><td>${html(activeSession.maxRpm || '—')}</td></tr>
        <tr><td>Conditions</td><td colspan="3">${html(activeSession.condition || '—')}</td></tr>
      </tbody></table>
      <h2>Setup Changes (${adjustments.length})</h2>
      ${adjustmentRows ? `<table><tbody>${adjustmentRows}</tbody></table>` : '<p class="empty">No changes recorded.</p>'}
      <h2>CREW CHIEF</h2>
      <p style="font-size:13px;white-space:pre-wrap;font-style:italic;color:#333">${html(activeSession.competitionNotes || 'No notes.')}</p>` : '';
  const lines = [
    displayVersionLabel(setup) || setup.chassis || 'Setup',
    `Car: ${setup.chassis || 'Not named'}`,
    `Class: ${setup.carType || 'Not set'}`,
    `Track: ${setup.track || 'Not set'}`,
    'Corner | Spring | Shock | Tire Pressure',
    `LF | ${setup.lf.spring || '-'} | ${setup.lf.shock || '-'} | ${setup.lf.tirePress || '-'}`,
    `RF | ${setup.rf.spring || '-'} | ${setup.rf.shock || '-'} | ${setup.rf.tirePress || '-'}`,
    `LR | ${setup.lr.spring || '-'} | ${setup.lr.shock || '-'} | ${setup.lr.tirePress || '-'}`,
    `RR | ${setup.rr.spring || '-'} | ${setup.rr.shock || '-'} | ${setup.rr.tirePress || '-'}`,
  ];
  if (activeSession) {
    lines.push('', `Current Run: ${activeSession.name || 'Unnamed'}`,
      `Finish: ${activeSession.finishPos || '-'}  Best Lap: ${activeSession.bestLap || '-'}  Conditions: ${activeSession.condition || '-'}`,
      ...adjustments.map(item => `Change: ${item.label} ${item.value}`),
      `Notes: ${activeSession.competitionNotes || 'None'}`);
  }
  return {
    html: `
      <h1>${html(setup.chassis || 'Unnamed Car')}</h1>
      <p style="color:#555;font-size:14px">${html(setup.carType || 'No class')} · Track: ${html(setup.track || '—')}</p>
      <h2>Corner Setup</h2>
      <table><thead><tr><th>Corner</th><th>Spring</th><th>Shock</th><th>Tire Press</th></tr></thead><tbody>
        <tr><td>Left Front</td><td>${html(setup.lf.spring)} lb</td><td>${html(setup.lf.shock)}</td><td>${html(setup.lf.tirePress)} psi</td></tr>
        <tr><td>Right Front</td><td>${html(setup.rf.spring)} lb</td><td>${html(setup.rf.shock)}</td><td>${html(setup.rf.tirePress)} psi</td></tr>
        <tr><td>Left Rear</td><td>${html(setup.lr.spring)} lb</td><td>${html(setup.lr.shock)}</td><td>${html(setup.lr.tirePress)} psi</td></tr>
        <tr><td>Right Rear</td><td>${html(setup.rr.spring)} lb</td><td>${html(setup.rr.shock)}</td><td>${html(setup.rr.tirePress)} psi</td></tr>
      </tbody></table>${activeRunHtml}`,
    lines,
  };
}

function weekendSection(weekend: RaceWeekend, accounting: AccountingEntry[]): { html: string; lines: string[] } {
  const linked = accounting.filter(entry => entry.weekendId === weekend.id);
  const income = linked.filter(entry => entry.type === 'income').reduce((sum, entry) => sum + entry.amount, 0);
  const expense = linked.filter(entry => entry.type === 'expense').reduce((sum, entry) => sum + entry.amount, 0);
  const runsHtml = weekend.sessions.map(run => `<div class="session-card"><div class="session-header"><strong>${html(run.name)}</strong><span>${html(run.type)}</span></div>
        <table><tbody>
          <tr><td>Best Lap</td><td><strong>${html(run.bestLap || '—')}</strong></td><td>Finish</td><td><strong>${html(run.finishPos || '—')}</strong></td></tr>
          <tr><td>Conditions</td><td colspan="3">${html(run.condition || '—')}</td></tr>
          ${run.competitionNotes ? `<tr><td valign="top">Notes</td><td colspan="3">${html(run.competitionNotes)}</td></tr>` : ''}
        </tbody></table></div>`).join('');
  const accountingHtml = linked.length
    ? `<table><thead><tr><th>Name</th><th>Type</th><th>Amount</th></tr></thead><tbody>
          ${linked.map(entry => `<tr><td>${html(entry.name)}</td><td>${html(entry.type)}</td><td>${entry.type === 'income' ? '+' : '−'}${html(money(entry.amount))}</td></tr>`).join('')}
          <tr class="total-row"><td><strong>Net</strong></td><td colspan="2"><strong>${html(money(income - expense))}</strong></td></tr>
        </tbody></table>`
    : '<p class="empty">No accounting linked.</p>';
  return {
    html: `
      <h1>${html(weekend.name)}</h1>
      <p style="color:#555;font-size:14px">${html(weekend.track)} · ${html(weekend.date)}</p>
      ${weekend.notes ? `<div style="background:#f9f9f9;border-left:3px solid #ba1a20;padding:10px 14px;margin:12px 0;font-size:13px">${html(weekend.notes)}</div>` : ''}
      <h2>Runs (${weekend.sessions.length})</h2>
      ${weekend.sessions.length ? runsHtml : '<p class="empty">No runs logged.</p>'}
      <h2>Accounting</h2>${accountingHtml}`,
    lines: [
      weekend.name,
      `${weekend.track} | ${weekend.date}`,
      weekend.notes ? `Race Day notes: ${weekend.notes}` : '',
      `Runs: ${weekend.sessions.length}`,
      ...weekend.sessions.flatMap(run => [
        `${run.name} (${run.type})`,
        `Best Lap: ${run.bestLap || '-'}  Finish: ${run.finishPos || '-'}  Conditions: ${run.condition || '-'}`,
        run.competitionNotes ? `Notes: ${run.competitionNotes}` : '',
      ]),
      '', `Accounting entries: ${linked.length}`, `Net: ${money(income - expense)}`,
    ].filter(Boolean),
  };
}

function trackersSection(kind: TrackerReportKind, todos: Todo[], accounting: AccountingEntry[]): { html: string; lines: string[] } {
  const jobs = getMainChecklist(todos)?.items.filter(item => !item.removedUntilReset) ?? [];
  const jobsHtml = kind === 'all' || kind === 'checklist'
    ? `<h2>Main Checklist (${jobs.length})</h2>${jobs.length
      ? `<ul>${jobs.map(job => `<li class="${job.done ? 'done' : ''}">${job.done ? '✓' : '○'} ${html(job.text)}</li>`).join('')}</ul>`
      : '<p class="empty">Main Checklist empty.</p>'}` : '';
  const income = accounting.filter(entry => entry.type === 'income').reduce((sum, entry) => sum + entry.amount, 0);
  const expense = accounting.filter(entry => entry.type === 'expense').reduce((sum, entry) => sum + entry.amount, 0);
  const accountingHtml = kind === 'all' || kind === 'accounting'
    ? `<h2>Accounting (${accounting.length})</h2>${accounting.length
      ? `<table><thead><tr><th>Date</th><th>Name</th><th>Type</th><th>Amount</th></tr></thead><tbody>
          ${accounting.map(entry => `<tr><td>${html(entry.date)}</td><td>${html(entry.name)}</td><td>${html(entry.type)}</td><td>${entry.type === 'income' ? '+' : '−'}${html(money(entry.amount))}</td></tr>`).join('')}
          <tr class="total-row"><td colspan="3"><strong>Net</strong></td><td><strong>${html(money(income - expense))}</strong></td></tr>
        </tbody></table>` : '<p class="empty">No accounting entries.</p>'}` : '';
  const lines: string[] = [];
  if (kind === 'all' || kind === 'checklist') lines.push(`Main Checklist (${jobs.length})`, ...jobs.map(job => `${job.done ? '[x]' : '[ ]'} ${job.text}`), '');
  if (kind === 'all' || kind === 'accounting') lines.push(`Accounting (${accounting.length})`, ...accounting.map(entry => `${entry.date} | ${entry.name} | ${entry.type} | ${money(entry.amount)}`), `Net: ${money(income - expense)}`);
  return { html: jobsHtml + accountingHtml || '<p class="empty">Nothing to export.</p>', lines };
}

export function buildSetupReport(setup: Setup, activeSession?: ActiveSession): ReportDocument {
  const section = setupSection(setup, activeSession);
  return {
    title: 'Setup Report',
    subtitle: `${setup.chassis || 'Setup'} · ${setup.carType || ''}`,
    filename: reportFilename(setup.track || setup.chassis || 'setup', setup.date),
    bodyHtml: section.html,
    textLines: section.lines,
  };
}

export function buildWeekendReport(weekend: RaceWeekend, accounting: AccountingEntry[] = []): ReportDocument {
  const section = weekendSection(weekend, accounting);
  return {
    title: 'Race Day Report',
    subtitle: `${weekend.name} · ${weekend.track}`,
    filename: reportFilename(weekend.track || weekend.name || 'race-day', weekend.date),
    bodyHtml: section.html,
    textLines: section.lines,
  };
}

export function buildTrackersReport(kind: TrackerReportKind, todos: Todo[], accounting: AccountingEntry[]): ReportDocument {
  const labels: Record<TrackerReportKind, string> = { all: 'All Trackers', checklist: 'Main Checklist', accounting: 'Accounting' };
  const section = trackersSection(kind, todos, accounting);
  return {
    title: 'Trackers Report', subtitle: labels[kind], filename: reportFilename('trackers'),
    bodyHtml: section.html, textLines: section.lines,
  };
}

export function buildMasterReport(setup: Setup, activeSession: ActiveSession, weekends: RaceWeekend[], todos: Todo[], accounting: AccountingEntry[]): ReportDocument {
  const setupPart = setupSection(setup, activeSession);
  const weekendParts = weekends.map(weekend => weekendSection(weekend, accounting));
  const trackersPart = trackersSection('all', todos, accounting);
  return {
    title: 'Master Report', subtitle: 'Full race-team report — setup, Race Days and trackers',
    filename: reportFilename('full-report'),
    bodyHtml: setupPart.html
      + (weekendParts.length ? `<h1 style="page-break-before:always">Race Days (${weekendParts.length})</h1>${weekendParts.map(part => part.html).join('')}` : '')
      + `<h1 style="page-break-before:always">Trackers</h1>${trackersPart.html}`,
    textLines: [...setupPart.lines, '', ...weekendParts.flatMap(part => [...part.lines, '']), ...trackersPart.lines],
  };
}

export function renderReportHtml(report: ReportDocument, generatedAt = new Date()): string {
  return `<!DOCTYPE html><html><head><title>${html(report.title)}</title><style>${REPORT_CSS}</style></head><body>`
    + `<div class="header"><div><div class="logo">CREW CHIEF — ${html(report.title)}</div>`
    + `<div class="sub">${html(report.subtitle)}</div></div>`
    + `<div class="meta">Generated ${html(generatedAt.toLocaleString())}</div></div>`
    + report.bodyHtml + '<script>window.onload=function(){window.print()}</script></body></html>';
}

export function openPrintReport(report: ReportDocument): boolean {
  const popup = window.open('', '_blank');
  if (!popup) return false;
  popup.document.write(renderReportHtml(report));
  popup.document.close();
  return true;
}

function ascii(value: string): string {
  return value.normalize('NFKD')
    .replace(/[—–]/g, '-')
    .replace(/✓/g, '[x]')
    .replace(/○/g, '[ ]')
    .replace(/[^ -~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wrap(value: string, max = 92): string[] {
  if (!value) return [''];
  const words = ascii(value).split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (!current) current = word;
    else if (`${current} ${word}`.length <= max) current += ` ${word}`;
    else { lines.push(current); current = word; }
  }
  if (current) lines.push(current);
  return lines;
}

const pdfString = (value: string): string => value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

/** Small dependency-free PDF writer used for real file sharing. */
export function createPdfBytes(report: ReportDocument, generatedAt = new Date()): Uint8Array {
  const sourceLines = [
    `CREW CHIEF - ${report.title}`,
    report.subtitle,
    `Generated ${generatedAt.toLocaleString()}`,
    '',
    ...report.textLines,
  ];
  const lines = sourceLines.flatMap(line => wrap(line));
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += 50) pages.push(lines.slice(index, index + 50));
  if (pages.length === 0) pages.push(['No report data.']);

  const fontId = 3 + pages.length * 2;
  const objects: string[] = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  const pageIds = pages.map((_, index) => 3 + index * 2);
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  pages.forEach((pageLines, index) => {
    const pageId = pageIds[index];
    const contentId = pageId + 1;
    const content = `BT\n/F1 10 Tf\n50 752 Td\n13 TL\n${pageLines.map(line => `(${pdfString(ascii(line))}) Tj\nT*`).join('\n')}\nET`;
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  });
  objects[fontId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

  let output = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (let id = 1; id <= fontId; id += 1) {
    offsets[id] = output.length;
    output += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = output.length;
  output += `xref\n0 ${fontId + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= fontId; id += 1) output += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  output += `trailer\n<< /Size ${fontId + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(output);
}

export function createPdfFile(report: ReportDocument, generatedAt = new Date()): File {
  return new File([createPdfBytes(report, generatedAt)], report.filename, { type: 'application/pdf', lastModified: generatedAt.getTime() });
}
