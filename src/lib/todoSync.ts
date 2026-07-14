import type { Todo } from '../types';

export function todoToCloudRow(todo: Todo, userId: string, updatedAt = new Date().toISOString()) {
  return {
    id: todo.id,
    user_id: userId,
    title: todo.title,
    items: todo.items,
    is_template: todo.is_template ?? false,
    weekend_id: todo.weekendId || null,
    weekend_name: todo.weekendName || null,
    updated_at: updatedAt,
  };
}

export function todoFromCloudRow(row: Record<string, unknown>, fallbackUpdatedAt = new Date().toISOString()): Todo {
  return {
    id: row.id as string,
    user_id: (row.user_id as string) || '',
    title: (row.title as string) || '',
    items: (row.items as Todo['items']) || [],
    is_template: (row.is_template as boolean) || false,
    weekendId: (row.weekend_id as string) || undefined,
    weekendName: (row.weekend_name as string) || undefined,
    updated_at: (row.updated_at as string) || fallbackUpdatedAt,
  };
}
