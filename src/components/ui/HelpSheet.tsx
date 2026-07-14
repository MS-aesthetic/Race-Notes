import { useEffect, useRef, type ReactNode } from 'react';
import BottomSheet from './BottomSheet';

export interface HelpSheetProps {
  open: boolean;
  onClose: () => void;
  section?: string;
  title?: string;
  children?: ReactNode;
}

/**
 * Thin help host. Callers pass their own content (e.g. <QuickReferenceView />)
 * as children to avoid coupling this primitive to screen components.
 */
export default function HelpSheet({ open, onClose, section, title = 'Tuning Guide', children }: HelpSheetProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open || !section) return;
    const frame = window.requestAnimationFrame(() => {
      contentRef.current?.querySelector<HTMLElement>(`[data-help-anchor="${section}"]`)?.scrollIntoView({ block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, section]);
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <div ref={contentRef} data-help-section={section} className="space-y-3">
        {children ?? (
          <p className="py-4 text-sm text-on-surface-variant">
            Help content coming soon.
          </p>
        )}
      </div>
    </BottomSheet>
  );
}
