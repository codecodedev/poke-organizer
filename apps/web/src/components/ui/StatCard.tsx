import type { ReactNode } from "react";

type StatCardProps = {
  label: string;
  value: string;
  icon?: ReactNode;
  tone?: "aqua" | "brand" | "leaf" | "lilac";
};

const tones: Record<NonNullable<StatCardProps["tone"]>, string> = {
  aqua: "from-aqua/30 to-white",
  brand: "from-brand/20 to-white",
  leaf: "from-leaf/25 to-white",
  lilac: "from-lilac/25 to-white"
};

export function StatCard({ label, value, icon, tone = "lilac" }: StatCardProps) {
  return (
    <div className={`stat-card stat-card--${tone} rounded-[20px] border border-white/80 bg-gradient-to-br ${tones[tone]} p-4 shadow-sm`}>
      <div className="mb-3 flex items-center justify-between gap-3 text-slate-500">
        <span className="text-xs font-black uppercase tracking-[0.14em]">{label}</span>
        {icon}
      </div>
      <p className="text-2xl font-black text-ink">{value}</p>
    </div>
  );
}
