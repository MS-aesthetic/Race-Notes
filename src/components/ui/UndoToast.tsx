import type { PendingUndo } from '../../lib/undo';

export interface UndoToastProps {
  pending: PendingUndo | null;
  onUndo: () => void;
  /** Optional: tapping the toast body commits immediately. */
  onDismiss?: () => void;
}

/** Bottom offset clears the ~4rem bottom nav plus device safe area. */
const ABOVE_NAV_BOTTOM = 'calc(5rem + env(safe-area-inset-bottom))';

export default function UndoToast({ pending, onUndo, onDismiss }: UndoToastProps) {
  if (!pending) return null;
  return (
    <div
      className="fixed inset-x-3 z-50"
      style={{ bottom: ABOVE_NAV_BOTTOM }}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 rounded-2xl border border-outline-variant bg-surface-container-highest py-1 pl-4 pr-1 shadow-lg">
        <span className="material-symbols-outlined text-on-surface-variant">
          delete
        </span>
        <button
          type="button"
          className="min-h-12 min-w-0 flex-1 text-left text-on-surface"
          onClick={onDismiss}
          tabIndex={onDismiss ? 0 : -1}
        >
          <span className="block truncate">{pending.label} deleted</span>
        </button>
        <button
          type="button"
          className="tap-target rounded-xl px-4 font-display font-bold text-primary"
          onClick={onUndo}
        >
          UNDO
        </button>
      </div>
    </div>
  );
}

export interface InfoToastProps {
  open: boolean;
  title: string;
  icon?: string;
  action?: { label: string; onClick: () => void };
  onClose?: () => void;
}

/** Lightweight informational toast for later chunks (sync status, tips…). */
export function InfoToast({ open, title, icon = 'info', action, onClose }: InfoToastProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-x-3 z-50"
      style={{ bottom: ABOVE_NAV_BOTTOM }}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 rounded-2xl border border-outline-variant bg-surface-container-highest py-1 pl-4 pr-1 shadow-lg">
        <span className="material-symbols-outlined text-tertiary">{icon}</span>
        <span className="min-w-0 flex-1 truncate py-3 text-on-surface">{title}</span>
        {action && (
          <button
            type="button"
            className="tap-target rounded-xl px-4 font-display font-bold text-primary"
            onClick={action.onClick}
          >
            {action.label}
          </button>
        )}
        {onClose && (
          <button
            type="button"
            aria-label="Dismiss"
            className="tap-target text-on-surface-variant"
            onClick={onClose}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        )}
      </div>
    </div>
  );
}
