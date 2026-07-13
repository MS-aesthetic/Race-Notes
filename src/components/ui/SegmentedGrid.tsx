import { Fragment } from 'react';

export interface SegmentedGridRow {
  id: string;
  label: string;
}

export interface SegmentedGridCol {
  id: string;
  label: string;
  tone?: 'warn' | 'neutral' | 'info';
}

export interface SegmentedGridProps {
  rows: SegmentedGridRow[];
  cols: SegmentedGridCol[];
  /** rowId -> selected colId (or null for no selection yet) */
  value: Record<string, string | null>;
  onChange: (rowId: string, colId: string) => void;
}

function toneText(tone?: 'warn' | 'neutral' | 'info'): string {
  if (tone === 'warn') return 'text-error';
  if (tone === 'info') return 'text-tertiary';
  return 'text-primary';
}

export default function SegmentedGrid({ rows, cols, value, onChange }: SegmentedGridProps) {
  return (
    <div
      className="grid gap-1.5"
      style={{
        gridTemplateColumns: `minmax(0, 1.1fr) repeat(${cols.length}, minmax(0, 1fr))`,
      }}
    >
      {rows.map((row) => (
        <Fragment key={row.id}>
          <div className="flex min-h-12 min-w-0 items-center pr-2 text-sm text-on-surface">
            <span className="truncate">{row.label}</span>
          </div>
          {cols.map((col) => {
            const selected = value[row.id] === col.id;
            return (
              <button
                key={col.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange(row.id, col.id)}
                className={
                  selected
                    ? `flex min-h-12 items-center justify-center rounded-lg border-2 border-outline bg-surface-container-highest px-1 text-sm font-bold ${toneText(col.tone)}`
                    : 'flex min-h-12 items-center justify-center rounded-lg border border-outline-variant bg-surface-container px-1 text-sm text-on-surface-variant'
                }
              >
                <span className="truncate">{col.label}</span>
              </button>
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}
