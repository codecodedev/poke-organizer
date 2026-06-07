import type { ReactNode } from "react";

type StatCardProps = {
  label: string;
  value: string;
  icon?: ReactNode;
  tone?: "aqua" | "brand" | "leaf" | "lilac";
};

const tones: Record<NonNullable<StatCardProps["tone"]>, string> = {
  aqua: "from-cyan/20 to-cyan/5",
  brand: "from-magenta/20 to-magenta/5",
  leaf: "from-emerald-500/20 to-emerald-500/5",
  lilac: "from-cyan/20 to-magenta/20"
};

export function StatCard({ label, value, icon, tone = "lilac" }: StatCardProps) {
  return (
    <div className={`stat-card rounded-[24px] border border-white/10 bg-gradient-to-br ${tones[tone]} p-5 shadow-2xl backdrop-blur-xl`}>
      <div className="mb-4 flex items-center justify-between gap-3 text-slate-400">
        <span className="text-[10px] font-black uppercase tracking-[0.16em]">{label}</span>
        {icon}
      </div>
      <p className="text-3xl font-black text-white">{value}</p>
    </div>
  );
}
