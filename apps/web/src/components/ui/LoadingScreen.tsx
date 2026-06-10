import { Loader2 } from "lucide-react";

type Props = {
  message?: string;
  fullScreen?: boolean;
};

export function LoadingScreen({ message = "Carregando...", fullScreen = true }: Props) {
  return (
    <div className={`flex flex-col items-center justify-center gap-6 ${fullScreen ? 'fixed inset-0 z-50 bg-night/80 backdrop-blur-xl' : 'py-20 w-full'}`}>
      <div className="relative h-24 w-24">
        {/* Holographic background glow */}
        <div className="absolute inset-0 animate-pulse rounded-full bg-cyan/20 blur-2xl" />
        <div className="absolute inset-0 animate-pulse delay-700 rounded-full bg-magenta/20 blur-2xl" />
        
        {/* Main spinning loader */}
        <div className="relative flex h-full w-full items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-cyan" strokeWidth={3} />
          
          {/* Branded decorative rings */}
          <div className="absolute inset-0 animate-[spin_3s_linear_infinite] rounded-full border-2 border-t-magenta/40 border-r-transparent border-b-cyan/40 border-l-transparent" />
          <div className="absolute inset-4 animate-[spin_2s_linear_infinite_reverse] rounded-full border-2 border-t-cyan/30 border-r-transparent border-b-magenta/30 border-l-transparent" />
        </div>
      </div>
      
      <div className="flex flex-col items-center gap-2">
        <p className="animate-pulse text-sm font-black uppercase tracking-[0.3em] text-foreground/80">
          {message}
        </p>
        <div className="h-1 w-48 overflow-hidden rounded-full bg-white/5">
          <div className="holo-strip h-full w-full animate-shimmer" />
        </div>
      </div>
    </div>
  );
}
