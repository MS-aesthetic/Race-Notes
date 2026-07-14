import type { MaintenanceComponent } from '../types';
import { normalizeStartingUsage } from './maintenance';

export const maintenanceComponentToCloudRow = (
  component: MaintenanceComponent,
  userId: string,
  updatedAt = new Date().toISOString(),
): Record<string, unknown> => ({
  id: component.id,
  user_id: userId,
  scope: component.scope,
  car_id: component.carId ?? null,
  name: component.name,
  category: component.category,
  interval_type: component.intervalType,
  interval_value: component.intervalValue,
  last_serviced_at: component.lastServicedAt,
  manual_units: component.manualUnits ?? null,
  starting_usage: normalizeStartingUsage(component.startingUsage),
  notes: component.notes || '',
  created_at: component.createdAt,
  updated_at: updatedAt,
});

export const maintenanceComponentFromCloudRow = (
  row: Record<string, unknown>,
): MaintenanceComponent => ({
  id: row.id as string,
  scope: row.scope === 'rig' ? 'rig' : 'car',
  carId: (row.car_id as string) ?? undefined,
  name: (row.name as string) || '',
  category: (row.category as string) || 'Other',
  intervalType: row.interval_type === 'days' ? 'days' : 'races',
  intervalValue: (row.interval_value as number) ?? 1,
  lastServicedAt: (row.last_serviced_at as string) || new Date().toISOString(),
  manualUnits: typeof row.manual_units === 'number' ? row.manual_units : undefined,
  startingUsage: normalizeStartingUsage(row.starting_usage),
  notes: (row.notes as string) || undefined,
  createdAt: (row.created_at as string) || new Date().toISOString(),
  updatedAt: (row.updated_at as string) || new Date().toISOString(),
});
