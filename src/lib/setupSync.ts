import type { Setup } from '../types';
import { normalizeSetup } from './setupCompat';

export const setupToCloudRow = (raw: Setup, ownerUserId: string): Record<string, unknown> => {
  const s = normalizeSetup(raw);
  return {
    id: s.id, user_id: ownerUserId, chassis: s.chassis, track: s.track, date: s.date,
    car_type: s.carType, gear: s.gear || '', toe: s.toe || '', jbar: s.jbar || '',
    jbar_frame_height: s.jbarFrameHeight || '', jbar_pinion_height: s.jbarPinionHeight || '',
    front_stagger: s.frontStagger || '', rear_stagger: s.rearStagger || '',
    pull_bar_frame_hole: s.pullBarFrameHole || '', pull_bar_rear_hole: s.pullBarRearHole || '',
    pull_bar_angle: s.pullBarAngle || '', notes: s.notes || '', screenshots: s.screenshots || [],
    car_id: s.carId ?? null, version_label: s.versionLabel || '', lifecycle_role: s.lifecycleRole ?? null,
    source_setup_id: s.sourceSetupId ?? null, weekend_id: s.weekendId ?? null,
    locked_at: s.lockedAt ?? null, change_log: s.changeLog || [],
    lf: s.lf, rf: s.rf, lr: s.lr, rr: s.rr,
    updated_at: s.updatedAt || new Date().toISOString(),
  };
};

export const setupFromCloudRow = (r: Record<string, unknown>): Setup => normalizeSetup({
  id: r.id as string,
  chassis: (r.chassis as string) || '', track: (r.track as string) || '', date: (r.date as string) || '',
  carType: (r.car_type as string) || '', gear: (r.gear as string) || '', toe: (r.toe as string) || '',
  jbar: (r.jbar as string) || '', jbarFrameHeight: (r.jbar_frame_height as string) || '',
  jbarPinionHeight: (r.jbar_pinion_height as string) || '', frontStagger: (r.front_stagger as string) || '',
  rearStagger: (r.rear_stagger as string) || '', pullBarFrameHole: (r.pull_bar_frame_hole as string) || '',
  pullBarRearHole: (r.pull_bar_rear_hole as string) || '', pullBarAngle: (r.pull_bar_angle as string) || '',
  notes: (r.notes as string) || '', screenshots: (r.screenshots as string[]) || [],
  carId: (r.car_id as string) ?? undefined, versionLabel: (r.version_label as string) || undefined,
  lifecycleRole: (r.lifecycle_role as Setup['lifecycleRole']) || undefined,
  sourceSetupId: (r.source_setup_id as string) || undefined, weekendId: (r.weekend_id as string) || undefined,
  lockedAt: (r.locked_at as string) || undefined, changeLog: (r.change_log as Setup['changeLog']) || [],
  updatedAt: (r.updated_at as string) || undefined,
  lf: (r.lf as Setup['lf']) || { spring: '', shock: '', tireComp: '', tireSize: '', tirePress: '' },
  rf: (r.rf as Setup['rf']) || { spring: '', shock: '', tireComp: '', tireSize: '', tirePress: '' },
  lr: (r.lr as Setup['lr']) || { spring: '', shock: '', tireComp: '', tireSize: '', tirePress: '' },
  rr: (r.rr as Setup['rr']) || { spring: '', shock: '', tireComp: '', tireSize: '', tirePress: '' },
});
