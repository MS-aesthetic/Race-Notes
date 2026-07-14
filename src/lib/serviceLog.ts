// ============================================================================
// [25] Quick service log + auto-accounting (Chunk 4)
// Pure record builders — App/Dashboard perform the actual state writes.
// Cross-record rule: a service log with cost > 0 also creates a matching
// accounting expense; UNDO must remove BOTH (App's undo handler does).
// ============================================================================

import type {
  AccountingEntry,
  MaintenanceComponent,
  MaintenanceLog,
  MaintenanceStatus,
  RaceWeekend,
  Setup,
} from '../types';
import { applyServiceLog, getComponentStatus } from './maintenance';

export interface QuickServiceRequest {
  componentId: string;
  /** "What was done" free text. */
  notes: string;
  /** Optional cost — > 0 creates a matching accounting expense. */
  cost?: number;
  /** ISO date of the service; defaults to now. */
  dateISO?: string;
}

export interface QuickServiceResult {
  log: MaintenanceLog;
  updatedComponent: MaintenanceComponent;
  /** Present only when cost > 0. */
  accountingEntry: AccountingEntry | null;
}

/** What App returns to the Dashboard so the UNDO toast can reverse everything. */
export interface QuickServiceOutcome {
  result: QuickServiceResult;
  prevComponent: MaintenanceComponent;
}

const rid = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/**
 * Build the (up to) three records a quick service log produces:
 * the MaintenanceLog, the counter-reset component, and — when cost > 0 —
 * a matching accounting expense linked via `accountingEntryId`.
 */
export function buildQuickServiceRecords(
  component: MaintenanceComponent,
  request: QuickServiceRequest,
  weekends: RaceWeekend[],
  savedSetups: Setup[],
  activeWeekend: Pick<RaceWeekend, 'id' | 'name'> | null,
): QuickServiceResult {
  const nowIso = new Date().toISOString();
  const date = request.dateISO || nowIso;
  const status = getComponentStatus(component, weekends, savedSetups);
  const cost =
    typeof request.cost === 'number' && request.cost > 0 ? request.cost : undefined;

  const accountingEntry: AccountingEntry | null = cost
    ? {
        id: rid('acct'),
        name: 'Maintenance',
        description: `${component.name}${request.notes ? ` — ${request.notes}` : ''}`,
        category: 'Maintenance',
        amount: cost,
        type: 'expense',
        date,
        weekendId: activeWeekend?.id,
        weekendName: activeWeekend?.name,
      }
    : null;

  const log: MaintenanceLog = {
    id: rid('mlog'),
    componentId: component.id,
    date,
    type: 'service',
    notes: request.notes || undefined,
    cost,
    accountingEntryId: accountingEntry?.id,
    usedAtService: status.used,
  };

  return { log, updatedComponent: applyServiceLog(component, log), accountingEntry };
}

/** Worst (highest usage fraction) non-ok component — drives the Dashboard chip. */
export function pickWorstComponent(
  maintenance: MaintenanceComponent[],
  weekends: RaceWeekend[],
  savedSetups: Setup[],
): { component: MaintenanceComponent; status: MaintenanceStatus } | null {
  let worst: { component: MaintenanceComponent; status: MaintenanceStatus } | null = null;
  for (const component of maintenance) {
    const status = getComponentStatus(component, weekends, savedSetups);
    if (status.state === 'ok') continue;
    if (!worst || status.pct > worst.status.pct) worst = { component, status };
  }
  return worst;
}

const UNIT_LABEL: Record<MaintenanceComponent['intervalType'], [string, string]> = {
  laps: ['lap', 'laps'],
  sessions: ['session', 'sessions'],
  races: ['race', 'races'],
  days: ['night', 'nights'],
};

/** Chip copy: "2 nights over" (overdue) or "240/250 laps" (due). */
export function describeServiceStatus(
  component: MaintenanceComponent,
  status: MaintenanceStatus,
): string {
  const [one, many] = UNIT_LABEL[component.intervalType] ?? ['unit', 'units'];
  if (status.state === 'overdue') {
    const over = Math.max(1, status.used - status.limit);
    return `Used ${status.used} of ${status.limit} ${many}; ${over} ${over === 1 ? one : many} over the limit`;
  }
  const remaining = Math.max(0, status.limit - status.used);
  return `Used ${status.used} of ${status.limit} ${many}; ${remaining} left`;
}
