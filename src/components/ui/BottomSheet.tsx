import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

const DRAG_CLOSE_THRESHOLD_PX = 80;

export default function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const startYRef = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);

  // Escape closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Reset drag state whenever visibility flips
  useEffect(() => {
    if (!open) {
      startYRef.current = null;
      setDragY(0);
    }
  }, [open]);

  if (!open) return null;

  const onHandleDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    startYRef.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onHandleMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (startYRef.current === null) return;
    const dy = e.clientY - startYRef.current;
    setDragY(dy > 0 ? dy : 0);
  };
  const onHandleUp = () => {
    const shouldClose = dragY > DRAG_CLOSE_THRESHOLD_PX;
    startYRef.current = null;
    setDragY(0);
    if (shouldClose) onClose();
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="sheet-scrim" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title ?? 'Sheet'}
        className="sheet-enter absolute inset-x-0 bottom-0 flex flex-col rounded-t-2xl border-t border-outline-variant bg-surface-container-high"
        style={{
          maxHeight: '85vh',
          paddingBottom: 'env(safe-area-inset-bottom)',
          transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
        }}
      >
        <button
          type="button"
          aria-label="Close"
          className="flex min-h-12 w-full shrink-0 touch-none items-center justify-center"
          onClick={onClose}
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
        >
          <span className="block h-1.5 w-10 rounded-full bg-outline-variant" />
        </button>
        {title && (
          <div className="shrink-0 px-4 pb-2 font-display text-lg font-semibold text-on-surface">
            {title}
          </div>
        )}
        <div className="min-h-0 grow overflow-y-auto px-4 pb-4">{children}</div>
      </div>
    </div>
  );
}
