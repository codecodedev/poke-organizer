import type { ReactNode } from "react";

export function FilterField({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`grid gap-2 ${className}`}>
      <span className="px-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500 text-nowrap">
        {label}
      </span>
      {children}
    </label>
  );
}

export function FilterSelect({
  label,
  value,
  onChange,
  options,
  emptyLabel,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  emptyLabel: string;
  className?: string;
}) {
  return (
    <FilterField label={label} className={className}>
      <select
        className="premium-select w-full"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{emptyLabel}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </FilterField>
  );
}

export function FilterContainer({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 p-1 ${className}`}>
      {children}
    </div>
  );
}

export function FilterGroup({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`grid grid-cols-1 gap-4 rounded-[24px] border border-line/70 bg-field/45 p-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 ${className}`}>
      {children}
    </div>
  );
}
