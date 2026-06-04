import {
  CheckSquare,
  Square,
  TrendingDown,
  TrendingUp,
  Trash2,
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
  onRemove?: (item: CollectionItem) => void;
  removeLabel?: string;
};

export function CollectionItemCard({
  item,
  price,
  selected,
  onOpen,
  onToggleSelection,
  onRemove,
  removeLabel = "Remover carta",
}: Props) {
  const priceText = price?.amount ? formatBrl(price.amount) : "Sem preco";
  const kind = variantKind(item.variant);
  const latestChange = latestPriceChange(price);
  const hasPriceChange = latestChange !== 0;

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
      title={`${item.card.name} - ${priceText}`}
      className={`collection-item-card collection-item-card--${kind} group relative cursor-pointer rounded-[22px] border bg-white/72 p-2 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-soft ${
        selected
          ? "border-brand/50 bg-brand/10 shadow-soft"
          : "border-line/80 bg-white/70"
      }`}
    >
      {onToggleSelection && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleSelection(item.id);
          }}
          className="absolute right-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-2xl border border-white/80 bg-white/90 text-slate-700 shadow-sm backdrop-blur transition hover:border-brand/40"
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
          className={`absolute right-4 z-30 rounded-full border border-white/85 bg-night/88 px-2.5 py-1 text-xs font-black text-white shadow-sm backdrop-blur ${onToggleSelection ? "top-14" : "top-4"}`}
        >
          x{item.quantity}
        </span>
      )}

      <CardVariantImage
        src={item.card.imageSmall}
        alt={item.card.name}
        variant={item.variant}
        effect="frame"
        className="aspect-[5/7] rounded-[18px] shadow-sm"
        imageClassName="object-cover transition duration-300 group-hover:scale-[1.03]"
      />

      <div className="grid min-h-[72px] gap-1 px-1 py-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <p className="truncate text-sm font-black text-ink">{priceText}</p>
          {hasPriceChange && (
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-black ${
                latestChange > 0
                  ? "border-leaf/25 bg-leaf/10 text-emerald-800"
                  : "border-red-200 bg-red-50 text-red-700"
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
        </div>
        <p className="truncate text-xs font-semibold text-slate-500">
          {item.card.name}
        </p>
      </div>

      {onRemove && (
        <div className="absolute bottom-[70px] right-3 opacity-0 transition duration-200 group-hover:opacity-100">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onRemove(item);
            }}
            className="grid h-9 w-9 place-items-center rounded-2xl border border-red-100 bg-white/95 text-red-600 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-red-50"
            aria-label={removeLabel}
          >
            <Trash2 size={16} />
          </button>
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
