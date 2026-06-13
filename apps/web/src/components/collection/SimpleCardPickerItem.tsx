import { Check, Minus, Plus } from "lucide-react";
import {
  type CollectionItem,
  formatCardNumber,
} from "@poke-organizer/shared";
import { formatBrl } from "../../lib/format";
import { CardVariantImage } from "./CardVariantImage";

type Props = {
  item: CollectionItem;
  selected?: boolean;
  selectedQuantity?: number;
  maxQuantity?: number;
  onToggleSelection: (itemId: string) => void;
  onQuantityChange?: (itemId: string, quantity: number) => void;
};

export function SimpleCardPickerItem({
  item,
  selected,
  selectedQuantity,
  maxQuantity,
  onToggleSelection,
  onQuantityChange,
}: Props) {
  const displayPrice = item.price?.amount ?? 0;
  const fullNumber = formatCardNumber(item.card.number, item.card.printedTotal);
  const quantity = selectedQuantity ?? item.quantity;
  const max = maxQuantity ?? item.quantity;

  return (
    <article
      onClick={() => onToggleSelection(item.id)}
      className={`group relative cursor-pointer rounded-2xl border p-2 transition-all ${
        selected
          ? "border-brand bg-brand/10 shadow-glow"
          : "border-card-border/40 bg-card/40 hover:border-card-border/60"
      }`}
    >
      <div className="relative">
        <CardVariantImage
          src={item.card.imageSmall}
          alt={item.card.name}
          variant={item.variant}
          className="aspect-[5/7] rounded-xl overflow-hidden"
          imageClassName={`object-cover transition duration-300 group-hover:scale-[1.03] ${selected ? 'brightness-50' : ''}`}
        />
        
        {selected && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <div className="rounded-full bg-brand p-2 text-white shadow-xl ring-4 ring-brand/20">
              <Check size={24} strokeWidth={4} />
            </div>
          </div>
        )}

        <div className="absolute left-2 top-2 z-20">
          <span className="grid h-7 w-7 place-items-center rounded-lg border border-card-border/50 bg-card/80 text-lg shadow-sm backdrop-blur" title={`Idioma: ${item.language}`}>
            {getLanguageFlag(item.language)}
          </span>
        </div>
      </div>

      <div className="mt-2 px-1">
        <p className="text-sm font-black text-foreground">
          {formatBrl(displayPrice)}
        </p>
        <div className="flex items-center justify-between gap-1 text-[10px] font-bold text-muted-foreground">
          <span className="truncate uppercase">{item.card.setCode}</span>
          <span className="shrink-0">{fullNumber}</span>
        </div>
        {selected && onQuantityChange && (
          <div
            className="mt-2 flex items-center justify-between rounded-xl border border-card-border/50 bg-background/50 p-1"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted/40"
              onClick={() => onQuantityChange(item.id, quantity - 1)}
              disabled={quantity <= 1}
            >
              <Minus size={14} />
            </button>
            <span className="text-xs font-black text-foreground">{quantity}/{max}</span>
            <button
              type="button"
              className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted/40"
              onClick={() => onQuantityChange(item.id, quantity + 1)}
              disabled={quantity >= max}
            >
              <Plus size={14} />
            </button>
          </div>
        )}
      </div>
    </article>
  );
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
