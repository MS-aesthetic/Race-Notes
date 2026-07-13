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

type StarterTemplate = (typeof STARTER_TEMPLATES)[number];
type FingerprintTemplate = Pick<ChecklistTemplate, 'name' | 'category'> & {
  items: Array<ChecklistTemplate['items'][number] | string>;
};

function templateItemTexts(template: Pick<FingerprintTemplate, 'items'>): string[] {
  return (template.items as unknown[]).map(item => typeof item === 'string'
    ? item
    : ((item as Partial<ChecklistTemplate['items'][number]> | null)?.text ?? ''));
}

/** Exact semantic identity for an untouched starter. No trim, case-fold, sort, or ID. */
export function untouchedStarterFingerprint(template: FingerprintTemplate): string {
  return JSON.stringify({ name: template.name ?? '', category: template.category ?? 'Custom', items: templateItemTexts(template) });
}

const starterFingerprints = new Set(STARTER_TEMPLATES.map(starter => untouchedStarterFingerprint({ name: starter.name, category: starter.category, items: starter.items })));

export function isUntouchedStarterTemplate(template: ChecklistTemplate): boolean {
  return starterFingerprints.has(untouchedStarterFingerprint(template));
}

export interface StarterReconciliation {
  templates: ChecklistTemplate[];
  seeded: ChecklistTemplate[];
  discardedIds: string[];
}

/** Keeps one exact untouched copy per canonical starter; custom/same-name rows pass through. */
export function reconcileStarterTemplates(
  templates: ChecklistTemplate[],
  materialize: (starter: StarterTemplate) => ChecklistTemplate = materializeStarterTemplate,
): StarterReconciliation {
  const byFingerprint = new Map<string, ChecklistTemplate[]>();
  for (const template of templates) {
    const fingerprint = untouchedStarterFingerprint(template);
    if (!starterFingerprints.has(fingerprint)) continue;
    const matches = byFingerprint.get(fingerprint) ?? [];
    matches.push(template);
    byFingerprint.set(fingerprint, matches);
  }
  const discardedIds = [...byFingerprint.values()]
    .flatMap(matches => [...matches].sort((a, b) => (a.updatedAt ?? '').localeCompare(b.updatedAt ?? '') || a.id.localeCompare(b.id)).slice(1).map(template => template.id))
    .sort();
  const discarded = new Set(discardedIds);
  const seeded = STARTER_TEMPLATES
    .filter(starter => !byFingerprint.has(untouchedStarterFingerprint({ name: starter.name, category: starter.category, items: starter.items })))
    .map(starter => materialize(starter));
  return { templates: [...templates.filter(template => !discarded.has(template.id)), ...seeded], seeded, discardedIds };
}

const uid = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/** Turn a starter-template definition into a real, user-owned ChecklistTemplate
 *  (unique id + item ids) so it can be offered, saved, and later edited/instantiated. */
export function materializeStarterTemplate(
  starter: (typeof STARTER_TEMPLATES)[number],
): ChecklistTemplate {
  return {
    id: uid('tmpl'),
    name: starter.name,
    category: starter.category,
    items: starter.items.map(text => ({ id: uid('tmpli'), text })),
    updatedAt: new Date().toISOString(),
  };
}

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
