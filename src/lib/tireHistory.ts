import { RaceWeekend, SessionRecord, SessionType, SESSION_TYPE_LAPS, TireInventoryItem } from '../types';

// ─── Legacy session-type inference ────────────────────────────────────────────
// Sessions logged before `sessionType` existed only have a `name`/`type`
// string like "Heat 2", "Qual", "Feat. 1", "HL". Best-effort map that back
// onto a SessionType so old data still shows up in tire history/reports.

const LEGACY_NAME_PATTERNS: [RegExp, SessionType][] = [
  [/^heat/i, 'Heat Race'],
  [/^feat/i, 'Feature'],
  [/^a-?main/i, 'Feature'],
  [/^qual/i, 'Qualifying'],
  [/^hl/i, 'Hot Laps'],
  [/^hot ?laps/i, 'Hot Laps'],
  [/^test/i, 'Test'],
];

export function inferSessionType(session: Pick<SessionRecord, 'sessionType' | 'name' | 'type'>): SessionType {
  if (session.sessionType) return session.sessionType;
  const candidates = [session.name, session.type].filter(Boolean) as string[];
  for (const candidate of candidates) {
    for (const [pattern, type] of LEGACY_NAME_PATTERNS) {
      if (pattern.test(candidate.trim())) return type;
    }
  }
  return 'Test';
}

export function estimatedLapsFor(session: Pick<SessionRecord, 'sessionType' | 'name' | 'type'>): number {
  return SESSION_TYPE_LAPS[inferSessionType(session)];
}

// ─── Tire usage derivation ────────────────────────────────────────────────────

export type TireCorner = 'lf' | 'rf' | 'lr' | 'rr';

export interface TireUsageRecord {
  tireId: string;
  weekendId: string;
  weekendName: string;
  sessionId: string;
  sessionName: string;
  track: string;
  date: string;
  corner: TireCorner;
  sessionType: SessionType;
  /** True when sessionType had to be inferred from the session name (older data). */
  sessionTypeInferred: boolean;
  estimatedLaps: number;
}

const CORNERS: TireCorner[] = ['lf', 'rf', 'lr', 'rr'];

/** Scan every weekend/session/corner and collect every time this tire was mounted. */
export function getTireUsageHistory(tireId: string, weekends: RaceWeekend[]): TireUsageRecord[] {
  const rows: TireUsageRecord[] = [];
  for (const weekend of weekends) {
    for (const session of weekend.sessions) {
      if (!session.tires) continue;
      for (const corner of CORNERS) {
        if (session.tires[corner]?.tireId === tireId) {
          const sessionType = inferSessionType(session);
          rows.push({
            tireId,
            weekendId: weekend.id,
            weekendName: weekend.name,
            sessionId: session.id,
            sessionName: session.name,
            track: session.track || weekend.track,
            date: weekend.date,
            corner,
            sessionType,
            sessionTypeInferred: !session.sessionType,
            estimatedLaps: SESSION_TYPE_LAPS[sessionType],
          });
        }
      }
    }
  }
  // Newest first
  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

export function getTireTotalLaps(usage: TireUsageRecord[]): number {
  return usage.reduce((sum, r) => sum + r.estimatedLaps, 0);
}

/** Derive and stamp lifecycle fields onto tire inventory from weekend/session data.
 *  Call this after any session is saved or updated so heatCycles/usageDates stay in sync. */
export function syncTireLifecycle(tires: TireInventoryItem[], weekends: RaceWeekend[]): TireInventoryItem[] {
  return tires.map(tire => {
    const usage = getTireUsageHistory(tire.id, weekends);
    const usageDates = [...new Set(usage.map(u => u.date))].sort();
    return {
      ...tire,
      usageDates,
      heatCycles: usageDates.length,
    };
  });
}

/** All usage rows for every tire, keyed by tireId — one pass over weekends. */
export function getAllTireUsage(tires: TireInventoryItem[], weekends: RaceWeekend[]): Map<string, TireUsageRecord[]> {
  const map = new Map<string, TireUsageRecord[]>();
  for (const tire of tires) {
    map.set(tire.id, getTireUsageHistory(tire.id, weekends));
  }
  return map;
}

// ─── CSV export ────────────────────────────────────────────────────────────────

const csvEscape = (val: string | number): string => {
  const s = String(val ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function buildTireUsageCsv(tires: TireInventoryItem[], weekends: RaceWeekend[]): string {
  const header = ['Tire #', 'Size', 'Compound', 'Weekend', 'Track', 'Date', 'Session', 'Session Type', 'Corner', 'Est. Laps'];
  const lines = [header.join(',')];

  for (const tire of tires) {
    const usage = getTireUsageHistory(tire.id, weekends);
    if (usage.length === 0) {
      lines.push([tire.tireNumber, tire.size, tire.compound, '', '', '', '', '', '', 0].map(csvEscape).join(','));
      continue;
    }
    for (const row of usage) {
      lines.push([
        tire.tireNumber, tire.size, tire.compound,
        row.weekendName, row.track, row.date, row.sessionName,
        row.sessionType, row.corner.toUpperCase(), row.estimatedLaps,
      ].map(csvEscape).join(','));
    }
  }
  return lines.join('\n');
}

export function downloadTireUsageCsv(tires: TireInventoryItem[], weekends: RaceWeekend[]) {
  const csv = buildTireUsageCsv(tires, weekends);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tire-usage-report-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Printable report ─────────────────────────────────────────────────────────

export function buildTireUsageReportHtml(tires: TireInventoryItem[], weekends: RaceWeekend[]): string {
  const tireSections = tires.map(tire => {
    const usage = getTireUsageHistory(tire.id, weekends);
    const totalLaps = getTireTotalLaps(usage);
    const rowsHtml = usage.length === 0
      ? `<tr><td colspan="6" class="empty">No sessions logged for this tire yet.</td></tr>`
      : usage.map(r => `
        <tr>
          <td>${r.date}</td>
          <td>${r.weekendName}</td>
          <td>${r.track}</td>
          <td>${r.sessionName}</td>
          <td>${r.sessionType}${r.sessionTypeInferred ? ' *' : ''}</td>
          <td>${r.corner.toUpperCase()}</td>
          <td>${r.estimatedLaps}</td>
        </tr>`).join('');

    return `
      <div class="tire-block">
        <h2>Tire #${tire.tireNumber} <span class="meta">${tire.size} · ${tire.compound} · BS ${tire.wheelBackspacing}"${tire.durometer ? ` · Duro ${tire.durometer}` : ''}</span></h2>
        <p class="total">Total estimated laps: <strong>${totalLaps}</strong> across ${usage.length} session${usage.length !== 1 ? 's' : ''}</p>
        <table>
          <thead><tr><th>Date</th><th>Weekend</th><th>Track</th><th>Session</th><th>Type</th><th>Corner</th><th>Laps</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>`;
  }).join('');

  return `
    <html>
      <head>
        <title>Tire Usage Report</title>
        <style>
          body { font-family: -apple-system, Arial, sans-serif; color: #1a1a1a; padding: 24px; }
          h1 { font-size: 20px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
          .subtitle { color: #666; font-size: 12px; margin-bottom: 24px; }
          .tire-block { margin-bottom: 28px; page-break-inside: avoid; }
          h2 { font-size: 15px; margin: 0 0 4px 0; }
          .meta { color: #666; font-weight: normal; font-size: 12px; }
          .total { font-size: 12px; color: #333; margin: 0 0 8px 0; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th, td { border: 1px solid #ccc; padding: 4px 8px; text-align: left; }
          th { background: #f0f0f0; text-transform: uppercase; font-size: 10px; }
          .empty { color: #999; font-style: italic; text-align: center; }
          .footnote { font-size: 10px; color: #999; margin-top: 24px; }
        </style>
      </head>
      <body>
        <h1>CREW CHIEF — Tire Usage Report</h1>
        <p class="subtitle">Generated ${new Date().toLocaleString()}</p>
        ${tireSections}
        <p class="footnote">* Session type inferred from session name (logged before session-type tracking was added). Lap counts are estimates: Test/Hot Laps 5, Qualifying 3, Heat Race 10, Feature 30.</p>
        <script>window.onload = () => window.print();</script>
      </body>
    </html>`;
}

export function printTireUsageReport(tires: TireInventoryItem[], weekends: RaceWeekend[]) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Allow popups in your browser to view the report.');
    return;
  }
  printWindow.document.write(buildTireUsageReportHtml(tires, weekends));
  printWindow.document.close();
}
