import { Mic, MicOff, Search } from "lucide-react";

type MicState = "closed" | "listening" | "processing";

type MicVisualizerProps = {
  state: MicState;
};

export function MicVisualizer({ state }: MicVisualizerProps) {
  const active = state === "listening";
  const processing = state === "processing";
  const Icon = active ? Mic : processing ? Search : MicOff;
  const label = active ? "Microfone Ouvindo" : processing ? "Buscando" : "Microfone Fechado";

  return (
    <div className="grid place-items-center py-3">
      <div
        className={`mic-visualizer__orb relative grid h-36 w-36 place-items-center rounded-full border border-card-border/60 shadow-card ${
          active
            ? "mic-visualizer__orb--active animate-mic-pulse bg-gradient-to-br from-aqua/80 to-leaf/70 text-white"
            : processing
              ? "mic-visualizer__orb--processing bg-gradient-to-br from-lilac/75 to-aqua/70 text-white"
              : "mic-visualizer__orb--closed bg-slate-600 dark: text-muted-foreground"
        }`}
      >
        {active && <span className="absolute inset-3 rounded-full border border-white/45" />}
        <Icon size={42} />
      </div>
      <span
        className={`mic-visualizer__label mt-4 rounded-full px-4 py-2 text-sm font-black ${
          active ? "bg-aqua/70 dark:bg-aqua/15 text-white dark:text-cyan-800" : processing ? "bg-lilac/50 text-white dark:text-white" : "bg-slate-200 dark:bg-muted/40a/15 text-muted-foreground/60 dark:text-black/50"
        }`}
      >
        {label.toLowerCase()}
      </span>
    </div>
  );
}
