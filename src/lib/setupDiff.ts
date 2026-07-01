import { Setup } from '../types';
import { parseTireSize } from './tireSize';

export interface SetupDiffRow {
  label: string;
  path: string;
  groupLabel: string;
  aValue: string;
  bValue: string;
  changed: boolean;
}

const EMPTY = '—';

function fmt(v: unknown): string {
  if (v === undefined || v === null || v === '') return EMPTY;
  return String(v);
}

function numDiff(a: string, b: string): boolean {
  if (a === b) return false;
  const na = parseTireSize(a);
  const nb = parseTireSize(b);
  if (!isNaN(na) && !isNaN(nb)) return na !== nb;
  return a.trim() !== b.trim();
}

function row(
  label: string,
  path: string,
  group: string,
  aVal: unknown,
  bVal: unknown,
): SetupDiffRow {
  const aStr = fmt(aVal);
  const bStr = fmt(bVal);
  return { label, path, groupLabel: group, aValue: aStr, bValue: bStr, changed: aStr !== bStr };
}

function cornerRow(
  corner: string,
  field: string,
  group: string,
  aVal: unknown,
  bVal: unknown,
): SetupDiffRow {
  return row(`${corner} ${field}`, `${corner}.${field}`, group, aVal, bVal);
}

const CORNERS = ['LF', 'RF', 'LR', 'RR'] as const;

/** Compare two setups and return a flat list of diff rows. */
export function diffSetups(a: Setup, b: Setup): SetupDiffRow[] {
  const rows: SetupDiffRow[] = [];

  // Top-level metadata
  rows.push(row('Chassis', 'chassis', 'Info', a.chassis, b.chassis));
  rows.push(row('Track', 'track', 'Info', a.track, b.track));
  rows.push(row('Date', 'date', 'Info', a.date, b.date));

  // Gear & bars
  rows.push(row('Gear', 'gear', 'Gear & Bars', a.gear, b.gear));
  rows.push(row('Toe', 'toe', 'Gear & Bars', a.toe, b.toe));
  rows.push(row('J-Bar', 'jbar', 'Gear & Bars', a.jbar, b.jbar));
  rows.push(row('J-Bar Frame Ht', 'jbarFrameHeight', 'Gear & Bars', a.jbarFrameHeight, b.jbarFrameHeight));
  rows.push(row('J-Bar Pinion Ht', 'jbarPinionHeight', 'Gear & Bars', a.jbarPinionHeight, b.jbarPinionHeight));
  rows.push(row('Pull Bar Frame Hole', 'pullBarFrameHole', 'Gear & Bars', a.pullBarFrameHole, b.pullBarFrameHole));
  rows.push(row('Pull Bar Rear Hole', 'pullBarRearHole', 'Gear & Bars', a.pullBarRearHole, b.pullBarRearHole));
  rows.push(row('Pull Bar Angle', 'pullBarAngle', 'Gear & Bars', a.pullBarAngle, b.pullBarAngle));

  // Stagger
  rows.push(row('Front Stagger', 'frontStagger', 'Stagger', a.frontStagger, b.frontStagger));
  rows.push(row('Rear Stagger', 'rearStagger', 'Stagger', a.rearStagger, b.rearStagger));

  // Per-corner fields
  const cornerFields: [string, string][] = [
    ['Spring', 'spring'],
    ['Shock', 'shock'],
    ['Tire Comp', 'tireComp'],
    ['Tire Size', 'tireSize'],
    ['Tire Press', 'tirePress'],
    ['Scale Weight', 'loadWeight'],
    ['C-to-C', 'loadCtoC'],
    ['Caster', 'caster'],
    ['Camber', 'camber'],
    ['Spring Height', 'springHeight'],
    ['Load', 'load'],
    ['Top Bar Len', 'topBarLength'],
    ['Bottom Bar Len', 'bottomBarLength'],
    ['Droop', 'droop'],
    ['Preload', 'preload'],
  ];

  for (const corner of CORNERS) {
    for (const [label, field] of cornerFields) {
      const aVal = (a[corner.toLowerCase() as 'lf'] as unknown as Record<string, unknown>)[field];
      const bVal = (b[corner.toLowerCase() as 'lf'] as unknown as Record<string, unknown>)[field];
      // Only include non-empty values to avoid noise
      if (!aVal && !bVal) continue;
      rows.push(cornerRow(corner, label, `Corner: ${corner}`, aVal, bVal));
    }
  }

  // Notes
  rows.push(row('Notes', 'notes', 'Info', a.notes, b.notes));

  return rows;
}

/** Group diff rows by their groupLabel. */
export function groupDiffRows(rows: SetupDiffRow[]): Map<string, SetupDiffRow[]> {
  const map = new Map<string, SetupDiffRow[]>();
  for (const r of rows) {
    const list = map.get(r.groupLabel) || [];
    list.push(r);
    map.set(r.groupLabel, list);
  }
  return map;
}
