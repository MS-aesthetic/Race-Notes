import { useEffect, useState, type ReactNode } from 'react';

export interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  /** If provided, open/closed state persists to localStorage. */
  storageKey?: string;
  defaultOpen?: boolean;
  badge?: ReactNode;
  children: ReactNode;
  /** Rendered outside the toggle button (safe for nested interactives). */
  headerRight?: ReactNode;
}

function readStored(key: string | undefined, fallback: boolean): boolean {
  if (!key || typeof window === 'undefined') return fallback;
  try {
    const v = window.localStorage.getItem(key);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
}

export default function CollapsibleSection({
  title,
  subtitle,
  storageKey,
  defaultOpen = true,
  badge,
  children,
  headerRight,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(() => readStored(storageKey, defaultOpen));

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(storageKey, open ? '1' : '0');
    } catch {
      // ignore quota / privacy-mode errors
    }
  }, [open, storageKey]);

  return (
    <section className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container">
      <div className="flex items-center">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex min-h-12 flex-1 items-center gap-3 px-4 py-2 text-left"
        >
          <span
            aria-hidden="true"
            className={`material-symbols-outlined text-on-surface-variant transition-transform duration-200 ${
              open ? 'rotate-180' : ''
            }`}
          >
            expand_more
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-display font-semibold text-on-surface">
              {title}
            </span>
            {subtitle && (
              <span className="block truncate text-sm text-on-surface-variant">
                {subtitle}
              </span>
            )}
          </span>
          {badge}
        </button>
        {headerRight && <div className="shrink-0 pr-2">{headerRight}</div>}
      </div>
      {open && <div className="px-4 pb-4">{children}</div>}
    </section>
  );
}
