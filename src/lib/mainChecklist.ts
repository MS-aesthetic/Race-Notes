import { Todo, TodoItem } from '../types';

export const MAIN_CHECKLIST_TITLE = 'Main Checklist';

/** Stable selection without deleting or mutating hidden legacy lists. */
export function getMainChecklist(todos: Todo[]): Todo | undefined {
  const normal = todos.filter(todo => !todo.is_template);
  const titled = normal
    .filter(todo => todo.title.trim().toLowerCase() === MAIN_CHECKLIST_TITLE.toLowerCase())
    .sort((a, b) => a.id.localeCompare(b.id))[0];
  return titled ?? [...normal].sort((a, b) => a.id.localeCompare(b.id))[0];
}

const sameItem = (a: TodoItem, b: TodoItem): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * Materialize one canonical Main Checklist without deleting legacy rows.
 * Repeated calls are idempotent. Conflicting legacy item IDs receive stable IDs.
 */
export function materializeMainChecklist(todos: Todo[]): Todo[] {
  const normal = todos.filter(todo => !todo.is_template).sort((a, b) => a.id.localeCompare(b.id));
  if (normal.length === 0) return todos;

  const canonical = getMainChecklist(todos)!;
  const merged: TodoItem[] = [];
  const byId = new Map<string, TodoItem>();

  for (const list of normal) {
    for (const source of list.items ?? []) {
      let item = { ...source };
      const existing = byId.get(item.id);
      if (existing && sameItem(existing, item)) continue;
      if (existing) {
        const stableId = `${item.id}__${list.id}`;
        const stableExisting = byId.get(stableId);
        const stableItem = { ...item, id: stableId };
        if (stableExisting && sameItem(stableExisting, stableItem)) continue;
        item = stableItem;
      }
      byId.set(item.id, item);
      merged.push(item);
    }
  }

  const sourceIds = new Set(normal.filter(todo => todo.id !== canonical.id).map(todo => todo.id));
  const changed = sourceIds.size > 0
    || canonical.title !== MAIN_CHECKLIST_TITLE
    || canonical.weekendId !== undefined
    || canonical.weekendName !== undefined
    || JSON.stringify(canonical.items) !== JSON.stringify(merged);
  if (!changed) return todos;

  const migratedAt = new Date().toISOString();
  return todos.map(todo => {
    if (todo.id === canonical.id) {
      return {
        ...todo,
        title: MAIN_CHECKLIST_TITLE,
        weekendId: undefined,
        weekendName: undefined,
        items: merged,
        updated_at: migratedAt,
      };
    }
    // Old Todo-template storage is retired; flag merged source rows there so
    // they remain recoverable but never re-enter Main Checklist materialization.
    if (sourceIds.has(todo.id)) return { ...todo, is_template: true, updated_at: migratedAt };
    return todo;
  });
}
