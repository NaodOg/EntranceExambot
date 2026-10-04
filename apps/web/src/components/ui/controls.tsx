"use client";

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 border transition-colors duration-200 ${
        checked ? "border-accent bg-accent" : "border-line-strong bg-surface-2"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 bg-ink transition-transform duration-200 ${
          checked ? "translate-x-5 bg-accent-ink" : ""
        }`}
      />
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { id: T; label: string }[];
}) {
  return (
    <div className="grid auto-cols-fr grid-flow-col gap-1 border border-line bg-surface p-1">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={`min-h-10 px-3 font-mono text-xs font-semibold uppercase tracking-wider transition-colors duration-200 ${
            value === option.id ? "bg-accent text-accent-ink" : "text-muted"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2 text-sm text-muted">
      <span className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-ink">{label}</span>
      {children}
    </div>
  );
}
