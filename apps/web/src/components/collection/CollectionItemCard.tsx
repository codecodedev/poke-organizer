import { type ReactNode } from "react";
import {
  CheckSquare,
  Gavel,
  Square,
  TrendingDown,
  TrendingUp,
  Trash2,
  Sparkles,
  Flame,
  MessageSquare,
  MessageCircle,
  BadgeInfo,
  Users,
  ContactRound,
  Handshake,
  BadgeDollarSign,
  FileText,
} from "lucide-react";
import {
  type CollectionItem,
  type PriceEstimate,
} from "@poke-organizer/shared";
import { formatBrl } from "../../lib/format";
import { CardVariantImage, variantKind } from "./CardVariantImage";

type Props = {
  item: CollectionItem;
  price?: PriceEstimate;
  selected?: boolean;
  onOpen: (item: CollectionItem) => void;
  onToggleSelection?: (itemId: string) => void;
  onPriceChange?: (amount: number | null) => void;
  onRemove?: (item: CollectionItem) => void;
  removeLabel?: string;
  className?: string;
  children?: ReactNode;
};

export function CollectionItemCard({
  item,
  price,
  selected,
  onOpen,
  onToggleSelection,
  onPriceChange,
  onRemove,
  removeLabel = "Remover carta",
  className = "",
  children,
}: Props) {
  const isSold = Boolean(item.store?.isSold);
  const soldPrice = item.store?.soldPrice ?? 0;
  const manualPrice = item.store?.manualPrice;
  const customPrice = item.customPrice;
  const marketPrice = price?.amount ?? 0;

  const displayPrice = isSold
    ? soldPrice
    : manualPrice ?? customPrice ?? marketPrice;

  const kind = variantKind(item.variant);
  const latestChange = latestPriceChange(price);

  // So mostra variacao se for o preco de mercado puro
  const showPriceChange =
    latestChange !== 0 && !isSold && manualPrice === null && (customPrice === null || customPrice === undefined);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen(item)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(item);
        }
      }}
      title={`${item.card.name} - ${formatBrl(displayPrice)}`}
      className={`collection-item-card w-full collection-item-card--${kind} group relative cursor-pointer rounded-[24px] border p-2 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-cyan/5 ${
        selected
          ? "border-cyan/50 bg-cyan/10 shadow-[0_0_20px_rgba(var(--color-cyan)/0.1)]"
          : "border-slate-800/20 dark:border-slate-600 bg-card/40 backdrop-blur-md"
      } ${isSold ? "opacity-90" : ""} ${className}`}
    >
      {onToggleSelection && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleSelection(item.id);
          }}
          className="absolute right-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-2xl border border-card-border bg-card/80 text-muted-foreground shadow-sm backdrop-blur transition hover:border-cyan/40 hover:text-foreground"
          aria-label={
            selected
              ? "Remover da atualizacao de valores"
              : "Selecionar para atualizar valores"
          }
        >
          {selected ? <CheckSquare size={18} /> : <Square size={18} />}
        </button>
      )}

      {item.quantity > 1 && (
        <span
          className={`absolute right-4 z-30 rounded-full border border-card-border/50 bg-card/90 px-2.5 py-1 text-xs font-black text-foreground shadow-sm backdrop-blur ${onToggleSelection ? "top-14" : "top-4"}`}
        >
          x{item.quantity}
        </span>
      )}

      {(item.store?.proposalsCount ?? 0) > 0 && (
        <span
          className={`absolute right-4 z-30 flex items-center gap-1 rounded-full border border-orange-500/40 bg-red-500 px-2 py-1 text-xs font-black text-white shadow-sm backdrop-blur ${
            item.quantity > 1
              ? (onToggleSelection ? "top-24" : "top-14")
              : (onToggleSelection ? "top-14" : "top-4")
          }`}
          title={`${item.store?.proposalsCount} pessoas interessadas na carta`}
        >
          <Handshake size={12} className="stroke-white" />
          {item.store?.proposalsCount}
        </span>
      )}

      <div className={`absolute z-30 flex flex-col gap-2 left-5 top-5`}>
        {item.variant !== "normal" && (
          <span
            className="grid h-7 sm:h-8 w-7 sm:w-8 place-items-center rounded-xl border border-card-border/50 bg-card/80 text-sm shadow-sm backdrop-blur text-amber"
            title={`Variante: ${item.variant}`}
          >
            <Sparkles size={16} fill="currentColor" />
          </span>
        )}
      </div>

      <div className={`absolute z-30 flex flex-col gap-2 ${item.variant === "normal"? "left-4 top-4":"left-5 top-14"}`}>
        <span
          className="grid h-7 sm:h-8 w-7 sm:w-8 place-items-center rounded-xl border border-card-border/50 bg-card/80 text-lg shadow-sm backdrop-blur"
          title={`Idioma: ${item.language}`}
        >
          {getLanguageFlag(item.language)}
        </span>
      </div>

      <div className="relative">
        <CardVariantImage
          src={item.card.imageSmall}
          alt={item.card.name}
          variant={item.variant}
          effect="frame"
          className="aspect-[5/7] rounded-[20px] shadow-lg"
          imageClassName={`object-cover transition duration-300 group-hover:scale-[1.03] ${isSold ? "grayscale-[0.4]" : ""}`}
        />
        {showPriceChange && (
          <span
            className={`absolute z-30 bottom-10 left-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black ${
              latestChange > 0
                ? "border-leaf/30 bg-emerald-800/70 text-white"
                : "border-magenta/30 bg-magenta/80 text-white/90"
            }`}
            title={latestChange > 0 ? "Valor subiu" : "Valor caiu"}
          >
            {latestChange > 0 ? (
              <TrendingUp size={12} />
            ) : (
              <TrendingDown size={12} />
            )}
            {formatBrl(Math.abs(latestChange))}
          </span>
        )}
        <div className={`absolute z-30 flex flex-col gap-2 bottom-2 left-2`}>
          <span
            className="grid h-7 px-2 place-items-center rounded-xl border border-card-border/50 bg-card/80 text-xs shadow-sm backdrop-blur"
            title={`Numero: ${item.card.number}/${item.card.printedTotal}`}
          >
            {item.card.number}/{item.card.printedTotal}
          </span>
        </div>
        {isSold && (
          <div className="absolute inset-0 z-10 grid place-items-center rounded-[20px] bg-background/60 backdrop-blur-[1px]">
            <span className="rounded-full bg-card/90 border border-card-border/50 px-4 py-2 text-xs font-black uppercase tracking-widest text-foreground shadow-xl">
              Vendido
            </span>
          </div>
        )}
        {onRemove && (
          <div className="absolute bottom-2 right-2 z-30 transition duration-200 group-hover:opacity-100">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onRemove(item);
              }}
              className="grid h-9 w-9 place-items-center rounded-2xl border border-magenta/20 bg-white/80 text-magenta shadow-xl backdrop-blur transition hover:-translate-y-0.5 hover:bg-magenta/20"
              aria-label={removeLabel}
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-1 px-1 py-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {onPriceChange && !isSold ? (
            <div className="flex flex-1 items-center" onClick={(e) => e.stopPropagation()}>
              <span className="text-sm font-black text-muted-foreground mr-1">R$</span>
              <input
                className="tour-card-price-input w-full bg-input border border-card-border/50 p-1.5 pl-3 rounded-xl text-sm font-black text-foreground outline-none focus:ring-1 focus:ring-cyan/50 transition"
                type="number"
                min={0}
                step="0.01"
                defaultValue={manualPrice ?? marketPrice}
                onChange={(e) => {
                  const val = e.target.value;
                  onPriceChange(val === "" ? null : Number(val));
                }}
              />
            </div>
          ) : (
            <p className={`truncate text-sm font-black ${isSold ? "text-leaf" : "text-foreground"}`}>
              {formatBrl(displayPrice)}
            </p>
          )}

          {isSold && typeof manualPrice === "number" && manualPrice > 0 && manualPrice !== soldPrice && (
            <p className="text-[10px] font-bold text-muted-foreground line-through">
              {formatBrl(manualPrice)}
            </p>
          )}

        </div>
        <div className="flex items-center justify-between gap-2 overflow-auto">
          <div className="flex flex-row gap-1 truncate items-center text-muted-foreground justify-center">
            <p className="truncate text-xs font-semibold">
              {item.card.name}
            </p>
            -
            <p title={item.card.setCode??item.card.setName??'sem codigo cadastrado'} className="truncate text-xs font-semibold">
              {item.card.setCode??item.card.setName}
            </p>
          </div>
          {isSold && (
            <span className="shrink-0 text-[10px] font-black uppercase text-muted-foreground">
              Negociada
            </span>
          )}
        </div>
      </div>

      {children && (
        <div className="mt-1 border-t border-card-border/30 pt-2" onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
      )}
    </article>
  );
}

function latestPriceChange(price?: PriceEstimate): number {
  const history = price?.history ?? [];
  const latest = history[history.length - 1];
  return latest ? latest.amount - latest.previousAmount : 0;
}

function getLanguageFlag(language: string): string {
  switch (language) {
    case "pt-BR":
      return "🇧🇷";
    case "en":
      return "🇺🇸";
    case "ja":
      return "🇯🇵";
    default:
      return "🏳️";
  }
}
