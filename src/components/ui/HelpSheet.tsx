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
    <BottomSheet open={open} onClose={onClose} title="Tuning Guide">
      <div data-help-section={section} className="space-y-3">
        <div className="rounded-lg border border-primary/50 bg-primary/10 p-3">
          <p className="font-display text-base font-bold uppercase text-on-surface">Tuning Guide</p>
          <p className="mt-1 font-mono text-xs text-on-surface-variant">Modified and Dirt Late Model baseline references. Keep vehicle class, tire-maker, chassis-builder, shock-builder, and track rules in view.</p>
        </div>
        {children ?? (
          <p className="py-4 text-sm text-on-surface-variant">
            Help content coming soon.
          </p>
        )}
      </div>
    </BottomSheet>
  );
}
