import { CircleDot, Gem, RotateCcw, Sparkles } from "lucide-react";
import { formatCardVariant } from "@poke-organizer/shared";

export type VariantKind = "normal" | "foil" | "holo" | "reverse";

type Props = {
  src?: string | null;
  alt: string;
  variant?: string | null;
  className?: string;
  imageClassName?: string;
  effect?: "none" | "frame";
  isLoading?: boolean;
  onLoad?: () => void;
  onError?: () => void;
};

export function CardVariantImage({
  src,
  alt,
  variant,
  className = "",
  imageClassName = "",
  effect = "none",
  isLoading = false,
  onLoad,
  onError,
}: Props) {
  const kind = variantKind(variant);
  
  const isHeavyHoloEnabled = import.meta.env.VITE_ENABLE_HEAVY_HOLO_EFFECT !== "false";
  
  const effectClass =
    kind !== "normal" && effect === "frame" && isHeavyHoloEnabled 
      ? "variant-card-image--effect-frame" 
      : "";

  return (
    <div
      className={`variant-card-image variant-card-image--${kind} ${effectClass} ${className} relative overflow-hidden bg-muted/20 aspect-[5/7]`}
    >
      {isLoading ? (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-card-border/20 via-card-border/40 to-card-border/20" />
      ) : src ? (
        <img
          className={`variant-card-image__img ${imageClassName} h-full w-full object-contain`}
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={onLoad}
          onError={onError}
        />
      ) : (
        <div className="relative z-10 flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-card-border/20 text-muted-foreground/40">
            <VariantIcon kind={kind} />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/60">{alt}</p>
            <p className="mt-1 text-[10px] font-bold text-muted-foreground/40 uppercase">Imagem não disponível</p>
          </div>
        </div>
      )}
      
      {/* Decorative inner glow for better depth */}
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_0_40px_rgba(0,0,0,0.1)]" />
    </div>
  );
}

function VariantIcon({ kind }: { kind: VariantKind }) {
  if (kind === "reverse") return <RotateCcw size={32} />;
  if (kind === "holo") return <Sparkles size={32} />;
  if (kind === "foil") return <Gem size={32} />;
  return <CircleDot size={32} />;
}

export function variantKind(variant?: string | null): VariantKind {
  const value = (variant ?? "").toLowerCase();
  if (value.includes("reverse")) return "reverse";
  if (value.includes("holo")) return "holo";
  if (value.includes("foil")) return "foil";
  return "normal";
}

function shortVariantLabel(kind: VariantKind, label: string): string {
  if (kind === "reverse") return "Reverse";
  if (kind === "holo") return "Holo";
  if (kind === "foil") return "Foil";
  return label;
}
