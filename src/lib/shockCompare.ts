import { ShockSession } from '../types';

// ─── Linear interpolation of load-at-height for a single session ─────────────

interface ParsedPoint { h: number; l: number; }

function parsedPoints(session: ShockSession): ParsedPoint[] {
  return session.points
    .map(p => ({ h: parseFloat(p.height), l: parseFloat(p.load) }))
    .filter(p => !isNaN(p.h) && !isNaN(p.l))
    .sort((a, b) => a.h - b.h);
}

/**
 * Linearly interpolate this session's load at a given shock height.
 * Returns null if the session has no data, or the height falls outside the
 * session's own measured range (we don't extrapolate beyond real readings).
 */
export function interpolateLoadAtHeight(session: ShockSession, height: number): number | null {
  const pts = parsedPoints(session);
  if (pts.length === 0) return null;
  if (height < pts[0].h || height > pts[pts.length - 1].h) return null;

  const exact = pts.find(p => Math.abs(p.h - height) < 1e-9);
  if (exact) return exact.l;

  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    if (height >= a.h && height <= b.h) {
      if (b.h === a.h) return a.l;
      const t = (height - a.h) / (b.h - a.h);
      return a.l + t * (b.l - a.l);
    }
  }
  return null;
}

export interface ComparisonRow {
  height: number;
  /** One value per session, in the same order as the `sessions` array passed in. */
  values: (number | null)[];
}

/**
 * Build a comparison table: rows are every distinct height value that
 * appears in ANY of the selected sessions (so nothing gets rounded onto an
 * arbitrary grid), and each session's load at that height is interpolated
 * between its own two nearest real datapoints.
 */
export function buildComparisonRows(sessions: ShockSession[]): ComparisonRow[] {
  const heightSet = new Set<number>();
  for (const s of sessions) {
    for (const p of s.points) {
      const h = parseFloat(p.height);
      if (!isNaN(h)) heightSet.add(Math.round(h * 100) / 100);
    }
  }
  const heights = Array.from(heightSet).sort((a, b) => a - b);
  return heights.map(height => ({
    height,
    values: sessions.map(s => interpolateLoadAtHeight(s, height)),
  }));
}

export function buildComparisonCsv(sessions: ShockSession[]): string {
  const rows = buildComparisonRows(sessions);
  const esc = (v: string | number): string => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ['Height (in)', ...sessions.map(s => `${s.corner} ${s.label || s.shock}${s.springRate ? ` (${s.springRate} lb/in)` : ''}`)];
  const lines = [header.map(esc).join(',')];
  for (const row of rows) {
    lines.push([row.height, ...row.values.map(v => v === null ? '' : v.toFixed(1))].map(esc).join(','));
  }
  return lines.join('\n');
}

export function downloadComparisonCsv(sessions: ShockSession[]) {
  const csv = buildComparisonCsv(sessions);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `shock-compare-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
