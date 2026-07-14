import type { ChecklistTemplate, MaintenanceComponent, RaceWeekend, Setup, Todo, TodoItem } from '../types';
import { getComponentStatus } from './maintenance';
import { getMainChecklist, MAIN_CHECKLIST_TITLE } from './mainChecklist';

export const KEEP_ADDED_ITEMS_KEY = 'race_notes_keep_added_items';
export const MAINTENANCE_CHECKLIST_THRESHOLD = 0.9;

export function todoItemKind(item: TodoItem): 'core' | 'adhoc' {
  return item.kind === 'adhoc' ? 'adhoc' : 'core';
}

export const templateSourceId = (templateId: string, itemId: string): string => `template:${templateId}:${itemId}`;

export interface ChecklistMaintenanceContext {
  components: MaintenanceComponent[];
  weekends: RaceWeekend[];
  setups: Setup[];
}

export interface ChecklistCompletionUndo {
  item: TodoItem;
  index: number;
}

export interface ChecklistCompletionResult {
  items: TodoItem[];
  undo?: ChecklistCompletionUndo;
}

interface ChecklistResetOptions {
  listId?: string;
  now?: string;
  maintenance?: ChecklistMaintenanceContext;
}

function cycleId(component: MaintenanceComponent): string {
  return `${component.id}:${component.lastServicedAt || 'legacy'}`;
}

function normalizeRecurringIdentity(item: TodoItem, listId: string): TodoItem {
  if (item.archivedAt || todoItemKind(item) === 'adhoc' || item.sourceId) return item;
  return { ...item, sourceId: `core:${listId}:${item.id}` };
}

function recurrenceKey(item: TodoItem): string | null {
  if (todoItemKind(item) === 'adhoc' || !item.sourceId) return null;
  return item.sourceType === 'maintenance'
    ? `${item.sourceId}|${item.sourceCycle || 'legacy'}`
    : item.sourceId;
}

function uniqueOccurrenceId(baseId: string, usedIds: Set<string>): string {
  let occurrence = 1;
  let candidate = `${baseId}-active-${occurrence}`;
  while (usedIds.has(candidate)) candidate = `${baseId}-active-${++occurrence}`;
  usedIds.add(candidate);
  return candidate;
}

function dueMaintenanceKeys(context?: ChecklistMaintenanceContext): Set<string> | null {
  if (!context) return null;
  return new Set(context.components.flatMap(component => {
    const status = getComponentStatus(component, context.weekends, context.setups);
    return status.pct >= MAINTENANCE_CHECKLIST_THRESHOLD
      ? [`maintenance:${component.id}|${cycleId(component)}`]
      : [];
  }));
}

export function archiveCompletedChecklistItems(
  items: TodoItem[],
  listId: string,
  now = new Date().toISOString(),
): TodoItem[] {
  return items.map(item => {
    if (!item.done || item.archivedAt || item.removedUntilReset) return item;
    return { ...normalizeRecurringIdentity(item, listId), archivedAt: now };
  });
}

export function clearChecklistItems(
  items: TodoItem[],
  listId: string,
  now = new Date().toISOString(),
): TodoItem[] {
  return items.flatMap(item => {
    if (item.archivedAt) return [item];
    const normalized = normalizeRecurringIdentity(item, listId);
    if (item.done) return [{ ...normalized, archivedAt: now }];
    if (todoItemKind(item) === 'adhoc') return [];
    return [{ ...normalized, removedUntilReset: true }];
  });
}

export function importTemplateItems(items: TodoItem[], template: ChecklistTemplate): TodoItem[] {
  const currentSources = new Set(items
    .filter(item => !item.archivedAt
      && item.sourceType === 'template'
      && item.sourceId
      && (!item.done || item.removedUntilReset))
    .map(item => item.sourceId!));
  const usedIds = new Set(items.map(item => item.id));
  const additions: TodoItem[] = [];

  for (const definition of template.items) {
    const sourceId = templateSourceId(template.id, definition.id);
    if (currentSources.has(sourceId)) continue;
    const baseId = `todo-${sourceId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
    let id = baseId;
    let occurrence = 1;
    while (usedIds.has(id)) id = `${baseId}-${++occurrence}`;
    usedIds.add(id);
    currentSources.add(sourceId);
    additions.push({
      id,
      text: definition.text,
      done: false,
      kind: 'core',
      sourceType: 'template',
      sourceId,
    });
  }
  return additions.length ? [...items, ...additions] : items;
}

export function completeChecklistItem(
  items: TodoItem[],
  itemId: string,
  completedAt = new Date().toISOString(),
): ChecklistCompletionResult {
  const index = items.findIndex(item => item.id === itemId);
  if (index < 0) return { items };
  const prior = items[index];
  if (prior.done || prior.archivedAt || prior.removedUntilReset) return { items };
  return {
    items: items.map((item, itemIndex) => itemIndex === index
      ? { ...item, done: true, completedAt }
      : item),
    undo: { item: prior, index },
  };
}

export function restoreChecklistItem(items: TodoItem[], undo: ChecklistCompletionUndo): TodoItem[] {
  const currentIndex = items.findIndex(item => item.id === undo.item.id);
  if (currentIndex >= 0) {
    if (items[currentIndex] === undo.item) return items;
    return items.map((item, index) => index === currentIndex ? undo.item : item);
  }
  const restored = [...items];
  restored.splice(Math.min(undo.index, restored.length), 0, undo.item);
  return restored;
}

export function resetChecklistItems(
  items: TodoItem[],
  keepAddedItems: boolean,
  templates: ChecklistTemplate[] = [],
  options: ChecklistResetOptions = {},
): TodoItem[] {
  const listId = options.listId ?? 'main';
  const now = options.now ?? new Date().toISOString();
  const importedTemplateIds = new Set(items
    .filter(item => item.sourceType === 'template' && item.sourceId?.startsWith('template:'))
    .map(item => item.sourceId!.split(':')[1]));
  const templateDefinitions = new Map<string, string>();
  for (const template of templates) {
    if (!importedTemplateIds.has(template.id)) continue;
    for (const item of template.items) templateDefinitions.set(templateSourceId(template.id, item.id), item.text);
  }

  const dueKeys = dueMaintenanceKeys(options.maintenance);
  const usedIds = new Set(items.map(item => item.id));
  const history = items.filter(item => !!item.archivedAt);
  const current = items.filter(item => !item.archivedAt).map(item => normalizeRecurringIdentity(item, listId));
  const archivedCurrent: TodoItem[] = [];
  const currentRows: TodoItem[] = [];
  const groups = new Map<string, TodoItem[]>();

  for (const item of current) {
    if (todoItemKind(item) === 'adhoc') {
      if (item.done) archivedCurrent.push({ ...item, archivedAt: now });
      else if (keepAddedItems) currentRows.push(item.removedUntilReset ? { ...item, removedUntilReset: undefined } : item);
      continue;
    }
    const key = recurrenceKey(item)!;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  for (const [key, group] of groups) {
    const completed = group.filter(item => item.done);
    const open = group.filter(item => !item.done);
    archivedCurrent.push(...completed.map(item => ({ ...item, archivedAt: now })));

    const sample = open[0] ?? completed[0];
    const templateText = sample.sourceType === 'template' && sample.sourceId
      ? templateDefinitions.get(sample.sourceId)
      : undefined;
    const eligible = sample.sourceType === 'template'
      ? templateText !== undefined
      : sample.sourceType === 'maintenance'
        ? (dueKeys === null || dueKeys.has(key))
        : true;

    if (!eligible) {
      if (sample.sourceType === 'template') {
        currentRows.push(...open.map(item => item.removedUntilReset ? item : { ...item, removedUntilReset: true }));
      }
      continue;
    }

    const selected = open.find(item => !item.removedUntilReset)
      ?? open[0]
      ?? { ...sample, id: uniqueOccurrenceId(sample.id, usedIds) };
    const selectedText = templateText ?? selected.text;
    const needsReset = selected.done
      || selected.text !== selectedText
      || selected.completionNote !== undefined
      || selected.completedAt !== undefined
      || selected.archivedAt !== undefined
      || selected.removedUntilReset !== undefined;
    currentRows.push(needsReset ? {
      ...selected,
      text: selectedText,
      done: false,
      completionNote: undefined,
      completedAt: undefined,
      archivedAt: undefined,
      removedUntilReset: undefined,
    } : selected);
    currentRows.push(...open
      .filter(item => item !== selected)
      .map(item => item.removedUntilReset ? item : { ...item, removedUntilReset: true }));
  }

  const reset = [...history, ...archivedCurrent, ...currentRows];
  for (const [sourceId, text] of templateDefinitions) {
    if (current.some(item => item.sourceId === sourceId)) continue;
    reset.push(...importTemplateItems(reset, {
      id: sourceId.split(':')[1],
      name: '',
      category: 'Car Prep',
      updatedAt: now,
      items: [{ id: sourceId.split(':').slice(2).join(':'), text }],
    }).slice(reset.length));
  }
  return reset;
}

export function resetMainChecklist(
  todos: Todo[],
  keepAddedItems: boolean,
  now = new Date().toISOString(),
  templates: ChecklistTemplate[] = [],
  maintenance?: ChecklistMaintenanceContext,
): Todo[] {
  const main = getMainChecklist(todos);
  if (!main) return todos;
  const items = resetChecklistItems(main.items ?? [], keepAddedItems, templates, {
    listId: main.id,
    now,
    maintenance,
  });
  return todos.map(todo => todo.id === main.id
    ? { ...todo, title: MAIN_CHECKLIST_TITLE, items, updated_at: now }
    : todo);
}

export function clearMainChecklist(todos: Todo[], now = new Date().toISOString()): Todo[] {
  const main = getMainChecklist(todos);
  if (!main) return todos;
  const items = clearChecklistItems(main.items ?? [], main.id, now);
  return todos.map(todo => todo.id === main.id ? { ...todo, items, updated_at: now } : todo);
}

export function archiveCompletedMainChecklist(todos: Todo[], now = new Date().toISOString()): Todo[] {
  const main = getMainChecklist(todos);
  if (!main) return todos;
  const items = archiveCompletedChecklistItems(main.items ?? [], main.id, now);
  return todos.map(todo => todo.id === main.id ? { ...todo, items, updated_at: now } : todo);
}

export function editChecklistItem(
  item: TodoItem,
  values: { text: string; notes?: string; assignedTo?: string; assignedToName?: string },
): TodoItem {
  return {
    ...item,
    text: values.text.trim(),
    desc: values.notes?.trim() || undefined,
    assignedTo: values.assignedTo || undefined,
    assignedToName: values.assignedToName || undefined,
  };
}

function automaticTask(component: MaintenanceComponent, used: number, limit: number): TodoItem {
  const sourceId = `maintenance:${component.id}`;
  const sourceCycle = cycleId(component);
  return {
    id: `todo-maintenance-${encodeURIComponent(sourceCycle)}`,
    text: `Maintenance: ${component.name}`,
    desc: `${used}/${limit} ${component.intervalType}`,
    done: false,
    kind: 'core',
    sourceType: 'maintenance',
    sourceId,
    sourceCycle,
  };
}

/** Reconcile automatic jobs into the existing Main Checklist JSON. */
export function reconcileMaintenanceChecklist(
  todos: Todo[],
  components: MaintenanceComponent[],
  weekends: RaceWeekend[],
  setups: Setup[],
  now = new Date().toISOString(),
): Todo[] {
  const main = getMainChecklist(todos);
  const original = main?.items ?? [];
  let items = [...original];

  for (const component of components) {
    const sourceId = `maintenance:${component.id}`;
    const currentCycle = cycleId(component);
    const status = getComponentStatus(component, weekends, setups);
    if (status.pct >= MAINTENANCE_CHECKLIST_THRESHOLD) {
      const exists = items.some(item => !item.archivedAt && item.sourceType === 'maintenance'
        && item.sourceId === sourceId && item.sourceCycle === currentCycle);
      if (!exists) {
        const automatic = automaticTask(component, status.used, status.limit);
        items.push({ ...automatic, id: uniqueOccurrenceId(automatic.id, new Set(items.map(item => item.id))) });
      }
    } else {
      items = items.filter(item => item.done
        || item.sourceType !== 'maintenance'
        || item.sourceId !== sourceId);
    }
  }

  const componentSources = new Set(components.map(component => `maintenance:${component.id}`));
  items = items.filter(item => item.done
    || item.sourceType !== 'maintenance'
    || !item.sourceId
    || componentSources.has(item.sourceId));

  if (JSON.stringify(items) === JSON.stringify(original)) return todos;
  if (main) {
    return todos.map(todo => todo.id === main.id
      ? { ...todo, title: MAIN_CHECKLIST_TITLE, items, updated_at: now }
      : todo);
  }
  if (items.length === 0) return todos;
  return [{
    id: 'todo-main-maintenance',
    user_id: '',
    title: MAIN_CHECKLIST_TITLE,
    items,
    updated_at: now,
  }, ...todos];
}
