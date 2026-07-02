// ============================================================================
// Pre-race checklist engine (plan-v2.md WS-Q) — SCAFFOLD
// ============================================================================

import { ChecklistTemplate, WeekendChecklist } from '../types';

/** Starter templates offered on first use (copied, then user-owned/editable). */
export const STARTER_TEMPLATES: Array<Pick<ChecklistTemplate, 'name' | 'category'> & { items: string[] }> = [
  {
    name: 'Race Supplies', category: 'Supplies',
    items: ['Fuel jugs filled', 'Race oil', 'Spare tires loaded', 'Tear-offs', 'Radio batteries charged', 'Coolers / water / ice', 'First aid kit', 'Cash for pit passes'],
  },
  {
    name: 'Trailer Loading', category: 'Trailer Loading',
    items: ['Car strapped down (4 points)', 'Spare springs / shocks', 'Tool boxes secured', 'Generator + fuel', 'Jack + jack stands', 'Spare wheels/tires', 'Pit cart', 'Awning poles', 'Door latched + hitch pinned'],
  },
  {
    name: 'Truck Loading', category: 'Truck Loading',
    items: ['Trailer brakes checked', 'Lights working (truck + trailer)', 'Hitch + safety chains', 'Tire pressures (truck + trailer)', 'Fuel topped off', 'Bearings greased (tow rig)'],
  },
  {
    name: 'Car Prep', category: 'Car Prep',
    items: ['Scale + set ride heights', 'Nut-and-bolt check', 'Tire pressures set', 'Fuel load', 'Transponder mounted + charged', 'Belts/window net checked', 'Gear + rear end oil level', 'Body panels tight'],
  },
];

const uid = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/** Snapshot-copy a template into a per-weekend instance.
 *  Later template edits must NOT mutate past weekends. */
export function instantiateTemplate(
  template: ChecklistTemplate,
  weekendId?: string,
  weekendName?: string,
): WeekendChecklist {
  return {
    id: uid('chk'),
    weekendId,
    weekendName,
    templateId: template.id,
    name: template.name,
    category: template.category,
    items: template.items.map(it => ({ id: uid('chki'), text: it.text, done: false })),
    updatedAt: new Date().toISOString(),
  };
}

/** Progress helper for UI rings/badges. */
export function checklistProgress(list: WeekendChecklist): { done: number; total: number; pct: number } {
  const total = list.items.length;
  const done = list.items.filter(i => i.done).length;
  return { done, total, pct: total ? done / total : 0 };
}
