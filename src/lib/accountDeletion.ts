export const DELETE_ACCOUNT_CONFIRMATION = 'DELETE';

export function isDeleteAccountConfirmed(value: string): boolean {
  return value.trim() === DELETE_ACCOUNT_CONFIRMATION;
}

export function clearCrewChiefLocalData(storage: Pick<Storage, 'key' | 'length' | 'removeItem'>): string[] {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith('race_notes_')) keys.push(key);
  }
  keys.forEach((key) => storage.removeItem(key));
  return keys;
}
