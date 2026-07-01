/**
 * Tire size parsing + comparison.
 *
 * Racers enter tire sizes inconsistently — decimals ("86.5"), whole-plus-fraction
 * ("86 1/2", "86-1/2"), bare fractions ("1/2"), and often a trailing inch mark
 * ("86.5\""). This module normalizes any of those into a single numeric value so
 * tires can be sorted reliably by size regardless of how they were typed.
 *
 * Examples:
 *   parseTireSize('86.5')    -> 86.5
 *   parseTireSize('86 1/2')  -> 86.5
 *   parseTireSize('86-1/2"') -> 86.5
 *   parseTireSize('86 1/2 ') -> 86.5
 *   parseTireSize('1/2')     -> 0.5
 *   parseTireSize('86')      -> 86
 *   parseTireSize('')        -> NaN  (unparseable / empty)
 */
export function parseTireSize(raw: string | null | undefined): number {
  if (raw == null) return NaN;

  // Strip inch marks and any other non-essential characters, keep digits,
  // dot, slash, spaces and hyphen (hyphen may join whole + fraction).
  let s = String(raw)
    .replace(/["'”’]/g, ' ') // inch / foot marks
    .replace(/[^0-9./\-\s]/g, ' ')
    .trim();

  if (!s) return NaN;

  // Normalize "86-1/2" (hyphen between whole and fraction) into "86 1/2".
  // Only treat a hyphen as a separator when it sits between a number and a
  // fraction, so we don't mangle anything unexpected.
  s = s.replace(/(\d)\s*-\s*(\d+\s*\/\s*\d+)/, '$1 $2');

  // Case 1: whole number + fraction  ("86 1/2")
  const mixed = s.match(/^(\d+(?:\.\d+)?)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) {
    const whole = parseFloat(mixed[1]);
    const num = parseFloat(mixed[2]);
    const den = parseFloat(mixed[3]);
    if (den !== 0) return whole + num / den;
    return whole;
  }

  // Case 2: bare fraction ("1/2")
  const frac = s.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) {
    const num = parseFloat(frac[1]);
    const den = parseFloat(frac[2]);
    if (den !== 0) return num / den;
    return NaN;
  }

  // Case 3: plain decimal / integer — grab the first number present.
  const dec = s.match(/\d+(?:\.\d+)?/);
  if (dec) return parseFloat(dec[0]);

  return NaN;
}

/**
 * Comparator for ascending sort by tire size. Unparseable sizes sort to the
 * end so real sizes always lead the list.
 */
export function compareTireSize(a: string | null | undefined, b: string | null | undefined): number {
  const na = parseTireSize(a);
  const nb = parseTireSize(b);
  const aBad = Number.isNaN(na);
  const bBad = Number.isNaN(nb);
  if (aBad && bBad) return 0;
  if (aBad) return 1;
  if (bBad) return -1;
  return na - nb;
}

/** Sort a copy of tire-like items ascending by their `size` field. */
export function sortBySize<T extends { size?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => compareTireSize(a.size, b.size));
}
