import { Mic, MicOff, Search } from "lucide-react";

type MicState = "closed" | "listening" | "processing";

type MicVisualizerProps = {
  state: MicState;
};

export function MicVisualizer({ state }: MicVisualizerProps) {
  const active = state === "listening";
  const processing = state === "processing";
  const Icon = active ? Mic : processing ? Search : MicOff;
  const label = active ? "Ouvindo" : processing ? "Buscando" : "Fechado";

  return (
    <div className="grid place-items-center py-3">
      <div
        className={`relative grid h-36 w-36 place-items-center rounded-full border border-white/80 shadow-card ${
          active
            ? "animate-mic-pulse bg-gradient-to-br from-aqua/80 to-leaf/70 text-white"
            : processing
              ? "bg-gradient-to-br from-lilac/75 to-aqua/70 text-white"
              : "bg-gradient-to-br from-slate-100 to-white text-slate-500"
        }`}
      >
        {active && <span className="absolute inset-3 rounded-full border border-white/45" />}
        <Icon size={42} />
      </div>
      <span
        className={`mt-4 rounded-full px-4 py-2 text-sm font-black ${
          active ? "bg-aqua/15 text-cyan-800" : processing ? "bg-lilac/15 text-violet-800" : "bg-slate-100 text-slate-500"
        }`}
      >
        Microfone {label.toLowerCase()}
      </span>
    </div>
  );
}
