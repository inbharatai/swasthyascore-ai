import type { ReactNode } from "react";

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number";
  inputMode?: "text" | "numeric" | "decimal";
  unit?: string;
  helper?: string;
  error?: string;
  optional?: string;
  placeholder?: string;
}

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  helper?: string;
  error?: string;
  placeholder: string;
}

export function TextField({
  label,
  value,
  onChange,
  type = "text",
  inputMode,
  unit,
  helper,
  error,
  optional,
  placeholder,
}: TextFieldProps) {
  return (
    <label className="block">
      <span className="flex items-center justify-between gap-3 text-sm font-semibold text-[var(--slate-800)]">
        <span>{label}</span>
        {optional ? (
          <span className="text-xs font-medium text-[var(--slate-500)]">
            {optional}
          </span>
        ) : null}
      </span>
      <span className="mt-2 flex min-h-14 items-center rounded-[22px] border border-[var(--border-soft)] bg-white px-4 shadow-sm transition focus-within:border-[var(--brand-700)] focus-within:ring-4 focus-within:ring-teal-100">
        <input
          type={type}
          inputMode={inputMode}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          className="min-w-0 flex-1 scroll-mb-40 bg-transparent py-3 text-base font-semibold text-[var(--slate-950)] outline-none placeholder:text-[var(--slate-500)]"
        />
        {unit ? (
          <span className="ml-3 rounded-full bg-[var(--surface-muted)] px-3 py-1 text-xs font-semibold text-[var(--slate-600)]">
            {unit}
          </span>
        ) : null}
      </span>
      {helper ? (
        <span className="mt-2 block text-xs leading-5 text-[var(--slate-600)]">
          {helper}
        </span>
      ) : null}
      {error ? (
        <span className="mt-2 block text-xs font-semibold text-rose-700">
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  helper,
  error,
  placeholder,
}: SelectFieldProps) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-[var(--slate-800)]">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        className="mt-2 h-14 w-full scroll-mb-40 rounded-[22px] border border-[var(--border-soft)] bg-white px-4 text-base font-semibold text-[var(--slate-950)] shadow-sm outline-none transition focus:border-[var(--brand-700)] focus:ring-4 focus:ring-teal-100"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {helper ? (
        <span className="mt-2 block text-xs leading-5 text-[var(--slate-600)]">
          {helper}
        </span>
      ) : null}
      {error ? (
        <span className="mt-2 block text-xs font-semibold text-rose-700">
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function WizardCard({
  children,
  eyebrow,
  title,
  description,
}: {
  children: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="rounded-[34px] border border-white/70 bg-white/95 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand-700)]">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--slate-950)]">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--slate-600)]">
        {description}
      </p>
      <div className="mt-6">{children}</div>
    </section>
  );
}
