// [33] Save / offline status — single-user scope.
// navigator.onLine tracking plus a tiny pub-sub for save events.
// NOTE: sync.ts push helpers are NOT yet wired to reportSave() — the offline
// badge in App.tsx runs purely off useOnlineStatus(). Wiring
// reportSave('synced') into sync.ts is a cheap follow-up when needed.
import { useEffect, useState } from 'react';

export type SaveEvent = 'local' | 'synced';
type Listener = (e: SaveEvent) => void;

const listeners = new Set<Listener>();

/** Broadcast that a save happened ('local' write or cloud 'synced'). */
export function reportSave(e: SaveEvent): void {
  listeners.forEach(l => l(e));
}

/** Subscribe to save events. Returns an unsubscribe function. */
export function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

/** React hook: live navigator.onLine tracking via online/offline events. */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(isOnline());
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
}
