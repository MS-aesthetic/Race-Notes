import type { ReactNode } from 'react';
import BottomSheet from './BottomSheet';

export interface HelpSheetProps {
  open: boolean;
  onClose: () => void;
  /** Section anchor hint — wiring to QuickReferenceView anchors is a chunk-7 follow-up. */
  section?: string;
  children?: ReactNode;
}

/**
 * Thin help host. Callers pass their own content (e.g. <QuickReferenceView />)
 * as children to avoid coupling this primitive to screen components.
 */
export default function HelpSheet({ open, onClose, section, children }: HelpSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Help & Reference">
      <div data-help-section={section}>
        {children ?? (
          <p className="py-4 text-sm text-on-surface-variant">
            Help content coming soon.
          </p>
        )}
      </div>
    </BottomSheet>
  );
}
