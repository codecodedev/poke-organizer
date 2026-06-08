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
};

export function CardVariantImage({ src, alt, variant, className = "", imageClassName = "", effect = "none" }: Props) {
  const kind = variantKind(variant);
  const label = formatCardVariant(variant || "normal");
  const effectClass = kind !== "normal" && effect === "frame" ? "variant-card-image--effect-frame" : "";

  return (
    <div className={`variant-card-image variant-card-image--${kind} ${effectClass} ${className}`}>
      {src ? (
        <img className={`variant-card-image__img ${imageClassName}`} src={src} alt={alt} />
      ) : (
        <div className="relative z-10 grid h-full place-items-center px-3 text-center text-xs font-black text-slate-400">{alt}</div>
      )}
    </div>
  );
}

function VariantIcon({ kind }: { kind: VariantKind }) {
  if (kind === "reverse") return <RotateCcw size={14} />;
  if (kind === "holo") return <Sparkles size={14} />;
  if (kind === "foil") return <Gem size={14} />;
  return <CircleDot size={14} />;
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
