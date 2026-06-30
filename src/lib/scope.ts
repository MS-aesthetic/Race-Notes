/**
 * Filter helper for Option A (carId tagging).
 * Apply at the point of DISPLAY — never mutate the master arrays.
 * When carId is null (no active car) returns all items.
 */
export const byActiveCar = <T extends { carId?: string }>(
  items: T[],
  carId: string | null,
): T[] => (carId ? items.filter(i => i.carId === carId) : items);
