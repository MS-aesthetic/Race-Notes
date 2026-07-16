import { Todo, TodoItem } from '../types';
import { getMainChecklist } from './mainChecklist';

export interface AssignmentChange {
  itemId: string;
  todoId: string;
  assignedTo: string;
  taskText: string;
  taskDesc?: string;
}

const changeFor = (todoId: string, item: TodoItem): AssignmentChange => ({
  itemId: item.id,
  todoId,
  assignedTo: item.assignedTo!,
  taskText: item.text,
  taskDesc: item.desc,
});

/**
 * Finds local Main Checklist assignment changes. Caller owns identity and
 * membership filtering because only App has signed-in user/team context.
 */
export function detectAssignmentChanges(prev: Todo[], next: Todo[]): AssignmentChange[] {
  const previousMain = getMainChecklist(prev);
  const nextMain = getMainChecklist(next);
  if (!nextMain) return [];

  const previousById = new Map((previousMain?.items ?? []).map(item => [item.id, item]));
  return (nextMain.items ?? []).flatMap(item => {
    if (!item.assignedTo || item.done || item.archivedAt) return [];

    const previous = previousById.get(item.id);
    if (previous) {
      return previous.assignedTo === item.assignedTo ? [] : [changeFor(nextMain.id, item)];
    }

    // Checklist resets/templates/maintenance can mint new occurrence IDs while
    // retaining item shape. Only a newly-created manual task is an assignment.
    return item.sourceType === 'manual' ? [changeFor(nextMain.id, item)] : [];
  });
}
