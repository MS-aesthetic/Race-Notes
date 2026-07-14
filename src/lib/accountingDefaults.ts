import type { AccountingEntry } from '../types';

export interface AccountingRepeat {
  description: string;
  category: string;
}

export function localDateValue(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function accountingCategory(entry: AccountingEntry | undefined, fallback = 'Other'): string {
  return entry?.category?.trim() || fallback;
}

export function lastAccountingCategory(entries: AccountingEntry[], fallback = 'Other'): string {
  return accountingCategory(entries[0], fallback);
}

export function recentAccountingRepeats(entries: AccountingEntry[], limit = 5): AccountingRepeat[] {
  const seen = new Set<string>();
  const repeats: AccountingRepeat[] = [];
  for (const entry of [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())) {
    const description = (entry.description || entry.name).trim();
    const category = accountingCategory(entry);
    const key = `${description.toLocaleLowerCase()}\u0000${category.toLocaleLowerCase()}`;
    if (!description || seen.has(key)) continue;
    seen.add(key);
    repeats.push({ description, category });
    if (repeats.length >= limit) break;
  }
  return repeats;
}
