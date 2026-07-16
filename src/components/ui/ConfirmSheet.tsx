import type { ReactNode } from 'react';
import BottomSheet from './BottomSheet';

interface ConfirmSheetProps {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export default function ConfirmSheet({ open, title, body, confirmLabel, cancelLabel, destructive = false, onConfirm, onCancel }: ConfirmSheetProps) {
  return <BottomSheet open={open} onClose={onCancel} title={title}>
    <div className="space-y-5">
      <div className="text-sm text-on-surface-variant">{body}</div>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="min-h-12 flex-1 rounded border border-outline-variant bg-surface text-on-surface">{cancelLabel}</button>
        <button type="button" onClick={() => { void onConfirm(); }} className={`min-h-12 flex-1 rounded ${destructive ? 'bg-error text-on-error' : 'bg-primary text-on-primary'}`}>{confirmLabel}</button>
      </div>
    </div>
  </BottomSheet>;
}
