// [29] Back-button management.
// Sheets/modals push a history entry when they open so the Android hardware
// back (popstate) closes them instead of leaving the app. A tiny shared stack
// lets the App-level popstate handler know a sheet is open and stand down.
import { useEffect, useRef } from 'react';

type Entry = { close: () => void };
const stack: Entry[] = [];

let suppressUntil = 0;

/** Call right before a programmatic history.back() so popstate listeners ignore it. */
export function suppressNextPop(): void {
  suppressUntil = Date.now() + 300;
}

export function isPopSuppressed(): boolean {
  return Date.now() < suppressUntil;
}

/** True while any back-closable sheet is open. */
export function hasOpenSheets(): boolean {
  return stack.length > 0;
}

/**
 * Hook: while `isOpen` is true, a history entry is pushed so the hardware
 * back button closes the sheet (calls onClose) instead of navigating away.
 * Closing via UI consumes the pushed entry so back never needs a dead press.
 */
export function useBackClosable(isOpen: boolean, onClose: () => void): void {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;
    const entry: Entry = { close: () => closeRef.current() };
    window.history.pushState({ __sheet: true }, '');
    stack.push(entry);
    let poppedByHistory = false;

    const onPop = () => {
      if (isPopSuppressed()) return;
      if (stack[stack.length - 1] !== entry) return; // only the topmost sheet responds
      poppedByHistory = true;
      stack.pop();
      entry.close();
    };
    window.addEventListener('popstate', onPop);

    return () => {
      window.removeEventListener('popstate', onPop);
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
      if (!poppedByHistory) {
        // Closed via UI — consume the history entry we pushed.
        suppressNextPop();
        window.history.back();
      }
    };
  }, [isOpen]);
}
