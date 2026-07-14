import type { ChecklistTemplate, MaintenanceComponent, RaceWeekend, Setup, Todo, TodoItem } from '../types';
import { getComponentStatus } from './maintenance';
import { getMainChecklist, MAIN_CHECKLIST_TITLE } from './mainChecklist';

export const KEEP_ADDED_ITEMS_KEY = 'race_notes_keep_added_items';
export const MAINTENANCE_CHECKLIST_THRESHOLD = 0.9;

export function todoItemKind(item: TodoItem): 'core' | 'adhoc' {
  return item.kind === 'adhoc' ? 'adhoc' : 'core';
}

const templateSourceId = (templateId: string, itemId: string): string => `template:${templateId}:${itemId}`;

export function resetChecklistItems(
  items: TodoItem[],
  keepAddedItems: boolean,
  templates: ChecklistTemplate[] = [],
): TodoItem[] {
  const importedTemplateIds = new Set(items
    .filter(item => item.sourceType === 'template' && item.sourceId?.startsWith('template:'))
    .map(item => item.sourceId!.split(':')[1]));
  const templateDefinitions = new Map<string, string>();
  for (const template of templates) {
    if (!importedTemplateIds.has(template.id)) continue;
    for (const item of template.items) templateDefinitions.set(templateSourceId(template.id, item.id), item.text);
  }

  const reset: TodoItem[] = items
    .filter(item => keepAddedItems || todoItemKind(item) === 'core')
    .flatMap(item => {
      if (item.sourceType === 'template' && item.sourceId && !templateDefinitions.has(item.sourceId)) {
        return item.done
          ? [{ ...item, removedUntilReset: undefined }]
          : [{ ...item, removedUntilReset: true }];
      }
      if (item.sourceType === 'maintenance' && item.done) return [{ ...item, removedUntilReset: undefined }];
      return [{
        ...item,
        text: item.sourceType === 'template' && item.sourceId
          ? (templateDefinitions.get(item.sourceId) || item.text)
          : item.text,
        done: false,
        completionNote: undefined,
        completedAt: undefined,
        removedUntilReset: undefined,
      }];
    });

  for (const [sourceId, text] of templateDefinitions) {
    if (reset.some(item => item.sourceId === sourceId)) continue;
    reset.push({
      id: `todo-${sourceId.replace(/[^a-zA-Z0-9_-]/g, '-')}`,
      text,
      done: false,
      kind: 'core',
      sourceType: 'template',
      sourceId,
    });
  }

  const completedMaintenance = reset.filter(item => item.sourceType === 'maintenance' && item.done);
  for (const item of completedMaintenance) {
    const hasOpen = reset.some(candidate => candidate.sourceType === 'maintenance'
      && !candidate.done && candidate.sourceId === item.sourceId && candidate.sourceCycle === item.sourceCycle);
    if (hasOpen) continue;
    const occurrence = completedMaintenance.filter(candidate => candidate.sourceId === item.sourceId
      && candidate.sourceCycle === item.sourceCycle).length;
    reset.push({
      ...item,
      id: `${item.id}-active-${occurrence}`,
      done: false,
      completionNote: undefined,
      completedAt: undefined,
      removedUntilReset: undefined,
    });
  }
  return reset;
}

export function resetMainChecklist(
  todos: Todo[],
  keepAddedItems: boolean,
  now = new Date().toISOString(),
  templates: ChecklistTemplate[] = [],
): Todo[] {
  const main = getMainChecklist(todos);
  if (!main) return todos;
  const items = resetChecklistItems(main.items ?? [], keepAddedItems, templates);
  return todos.map(todo => todo.id === main.id
    ? { ...todo, title: MAIN_CHECKLIST_TITLE, items, updated_at: now }
    : todo);
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

function cycleId(component: MaintenanceComponent): string {
  return `${component.id}:${component.lastServicedAt || 'legacy'}`;
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
      const exists = items.some(item => item.sourceType === 'maintenance'
        && item.sourceId === sourceId && item.sourceCycle === currentCycle);
      if (!exists) items.push(automaticTask(component, status.used, status.limit));
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
