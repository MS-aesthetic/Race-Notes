import type { RaceWeekend } from '../types';

/**
 * Filter helper for Option A (carId tagging).
 * Apply at the point of DISPLAY — never mutate the master arrays.
 * When carId is null (no active car) returns all items.
 */
export const byActiveCar = <T extends { carId?: string }>(
  items: T[],
  carId: string | null,
): T[] => (carId ? items.filter(i => i.carId === carId) : items);

/** Tolerant parser for weekend date strings like "Jun 12, 2026" or "June 12-14, 2026". */
export const parseWeekendDate = (raw: string | undefined | null): Date | null => {
  if (!raw) return null;
  const direct = new Date(raw);
  if (!isNaN(direct.getTime())) return direct;
  // Collapse day ranges: "June 12-14, 2026" → "June 12, 2026"
  const collapsed = raw.replace(/(\d{1,2})\s*[-–—]\s*\d{1,2}/, '$1');
  const parsed = new Date(collapsed);
  return isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * [10] Canonical weekend ordering: active weekend first, then date descending
 * (unparseable dates sink to the end). Returns a new array — never mutates.
 */
export const sortWeekends = (
  weekends: RaceWeekend[],
  activeWeekendId: string | null,
): RaceWeekend[] =>
  [...weekends].sort((a, b) => {
    if (a.id === activeWeekendId) return -1;
    if (b.id === activeWeekendId) return 1;
    const ta = parseWeekendDate(a.date)?.getTime() ?? -Infinity;
    const tb = parseWeekendDate(b.date)?.getTime() ?? -Infinity;
    return tb - ta;
  });

/**
 * [5] Auto-activate: pick the weekend whose date is within ±3 days of today.
 * Prefers today/upcoming (closest first), else the most recent past.
 * Returns null when nothing is close or no dates parse.
 */
export const pickAutoWeekend = (
  weekends: RaceWeekend[],
  todayISO: string,
): RaceWeekend | null => {
  const today = new Date(todayISO);
  if (isNaN(today.getTime())) return null;
  const dayMs = 86_400_000;
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  let bestUpcoming: { w: RaceWeekend; diff: number } | null = null;
  let bestPast: { w: RaceWeekend; diff: number } | null = null;
  for (const w of weekends) {
    const d = parseWeekendDate(w.date);
    if (!d) continue;
    const diff = Math.round(
      (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - t0) / dayMs,
    );
    if (diff < -3 || diff > 3) continue;
    if (diff >= 0) {
      if (!bestUpcoming || diff < bestUpcoming.diff) bestUpcoming = { w, diff };
    } else if (!bestPast || diff > bestPast.diff) {
      bestPast = { w, diff };
    }
  }
  return bestUpcoming?.w ?? bestPast?.w ?? null;
};
