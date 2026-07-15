export type RaceDayCreationAction = 'new-session' | 'new-weekend';

export interface RaceDayCreationTarget {
  tab: 'settings' | 'raceweekend';
  initialAction: RaceDayCreationAction | null;
}

/** Creation needs a selected car. Missing-car actions go straight to Garage. */
export function resolveRaceDayCreationTarget(
  activeCarId: string | null | undefined,
  action: RaceDayCreationAction,
): RaceDayCreationTarget {
  if (!activeCarId) return { tab: 'settings', initialAction: null };
  return { tab: 'raceweekend', initialAction: action };
}
