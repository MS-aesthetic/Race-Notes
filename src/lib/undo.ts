import { useCallback, useEffect, useRef, useState } from 'react';

export interface UndoableDeleteOptions<T = unknown> {
  id: string;
  label: string;
  /** Optional payload carried through to `pending` for the toast/host. */
  item?: T;
  /** Local-only removal (state + localStorage). NO cloud call here. */
  removeFromState: () => void;
  /** Local-only restore. NO cloud call here. */
  restoreToState: () => void;
  /**
   * The irreversible side effect (e.g. delete*FromCloud(id)).
   * Runs ONLY on timeout, explicit dismiss, forced commit by a newer
   * delete, or host unmount — never before.
   */
  commit: () => void;
}

export interface PendingUndo<T = unknown> {
  id: string;
  label: string;
  item?: T;
}

export interface UndoableDeleteApi<T = unknown> {
  requestDelete: (opts: UndoableDeleteOptions<T>) => void;
  /** Restore the pending item locally. No cloud call. */
  undo: () => void;
  /** Commit the pending delete immediately (toast dismissed). */
  dismiss: () => void;
  pending: PendingUndo<T> | null;
}

const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Optimistic delete with a single-slot undo window.
 * Only one delete can be pending at a time: a new requestDelete
 * force-commits the previous one first.
 */
export function useUndoableDelete<T = unknown>(
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): UndoableDeleteApi<T> {
  const [pending, setPending] = useState<PendingUndo<T> | null>(null);
  const optsRef = useRef<UndoableDeleteOptions<T> | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const dismiss = useCallback(() => {
    clearTimer();
    const p = optsRef.current;
    optsRef.current = null;
    setPending(null);
    if (p) p.commit(); // the ONLY place the cloud delete fires
  }, []);

  const requestDelete = useCallback(
    (opts: UndoableDeleteOptions<T>) => {
      // Force-commit any previous pending delete (single-slot).
      if (optsRef.current) dismiss();
      opts.removeFromState(); // optimistic local removal only
      optsRef.current = opts;
      setPending({ id: opts.id, label: opts.label, item: opts.item });
      timerRef.current = window.setTimeout(dismiss, timeoutMs);
    },
    [dismiss, timeoutMs],
  );

  const undo = useCallback(() => {
    clearTimer();
    const p = optsRef.current;
    optsRef.current = null;
    setPending(null);
    if (p) p.restoreToState(); // local restore; commit() never runs
  }, []);

  // If the host unmounts — OR the page is hidden/killed (tab close, PWA
  // swipe-away) — with a delete still pending, commit it so the cloud never
  // silently diverges from local state (avoids a "deleted then resurrected"
  // item on next pull).
  useEffect(() => {
    const commitPending = () => {
      clearTimer();
      const p = optsRef.current;
      optsRef.current = null;
      if (p) p.commit();
    };
    window.addEventListener('pagehide', commitPending);
    return () => {
      window.removeEventListener('pagehide', commitPending);
      commitPending();
    };
  }, []);

  return { requestDelete, undo, dismiss, pending };
}
