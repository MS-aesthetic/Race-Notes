export interface EmptyStateProps {
  icon: string;
  title: string;
  body?: string;
  cta?: { label: string; onClick: () => void; icon?: string };
  secondaryCta?: { label: string; onClick: () => void };
}

export default function EmptyState({ icon, title, body, cta, secondaryCta }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <span
        className="material-symbols-outlined mb-4 text-5xl text-on-surface-variant"
        aria-hidden="true"
      >
        {icon}
      </span>
      <h3 className="font-display text-lg font-semibold text-on-surface">{title}</h3>
      {body && (
        <p className="mt-2 max-w-xs text-sm text-on-surface-variant">{body}</p>
      )}
      {cta && (
        <button
          type="button"
          onClick={cta.onClick}
          className="mt-6 flex min-h-12 w-full max-w-sm items-center justify-center gap-2 rounded-xl bg-primary px-4 font-display font-semibold text-on-primary active:opacity-90"
        >
          {cta.icon && (
            <span className="material-symbols-outlined" aria-hidden="true">
              {cta.icon}
            </span>
          )}
          {cta.label}
        </button>
      )}
      {secondaryCta && (
        <button
          type="button"
          onClick={secondaryCta.onClick}
          className="mt-2 flex min-h-12 w-full max-w-sm items-center justify-center rounded-xl px-4 font-display font-semibold text-primary"
        >
          {secondaryCta.label}
        </button>
      )}
    </div>
  );
}
