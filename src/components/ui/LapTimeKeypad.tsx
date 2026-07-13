// [13] Lap-time keypad — bottom-sheet numeric pad that formats digits
// right-to-left into "ss.sss", rolling into "m:ss.sss" once minutes appear.
// Typing 1,5,8,3,2 → "15.832"; typing 1,1,5,8,3,2 → "1:15.832".
// Output is a plain string for the existing `bestLap` string field.
import { useEffect, useState } from 'react';
import BottomSheet from './BottomSheet';

/** Format a raw digit string (right-to-left, millis first) into a lap time. */
export function formatLapDigits(digits: string): string {
  const d = digits.replace(/\D/g, '').replace(/^0+/, '').slice(0, 6);
  if (!d) return '';
  const padded = d.padStart(4, '0'); // guarantees at least s.sss
  const frac = padded.slice(-3);
  const secPart = padded.slice(0, -3);
  if (secPart.length <= 2) return `${parseInt(secPart, 10)}.${frac}`;
  const mins = secPart.slice(0, secPart.length - 2);
  const secs = secPart.slice(-2);
  return `${parseInt(mins, 10)}:${secs}.${frac}`;
}

export interface LapTimeKeypadProps {
  open: boolean;
  title?: string;
  /** Existing lap-time string to seed the pad (digits are extracted). */
  initialValue?: string;
  onCommit: (formatted: string) => void;
  onClose: () => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

export default function LapTimeKeypad({
  open,
  title = 'Lap time',
  initialValue = '',
  onCommit,
  onClose,
}: LapTimeKeypadProps) {
  const [digits, setDigits] = useState('');

  // Re-seed from the current value every time the sheet opens.
  useEffect(() => {
    if (open) setDigits(initialValue.replace(/\D/g, '').replace(/^0+/, '').slice(0, 6));
  }, [open, initialValue]);

  const display = formatLapDigits(digits);

  const pushDigit = (k: string) => {
    setDigits(prev => (prev + k).replace(/^0+/, '').slice(0, 6));
  };
  const backspace = () => setDigits(prev => prev.slice(0, -1));
  const done = () => {
    onCommit(display);
    onClose();
  };

  const keyClass =
    'flex min-h-14 items-center justify-center rounded-xl border border-outline-variant ' +
    'bg-surface-container font-mono text-xl text-on-surface active:bg-surface-container-highest';

  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <div className="pb-2">
        {/* Live preview */}
        <div className="mb-3 flex min-h-14 items-center justify-center rounded-xl border border-outline-variant bg-surface px-4">
          <span className={`font-mono text-3xl ${display ? 'text-on-surface' : 'text-on-surface-variant'}`}>
            {display || '--.---'}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {KEYS.map(k => (
            <button key={k} type="button" className={keyClass} onClick={() => pushDigit(k)}>
              {k}
            </button>
          ))}
          <button
            type="button"
            aria-label="Backspace"
            className={keyClass}
            onClick={backspace}
          >
            <span className="material-symbols-outlined">backspace</span>
          </button>
          <button type="button" className={keyClass} onClick={() => pushDigit('0')}>
            0
          </button>
          <button
            type="button"
            aria-label="Done"
            className="flex min-h-14 items-center justify-center rounded-xl bg-primary font-display font-bold text-on-primary active:opacity-90"
            onClick={done}
          >
            <span className="material-symbols-outlined">check</span>
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
