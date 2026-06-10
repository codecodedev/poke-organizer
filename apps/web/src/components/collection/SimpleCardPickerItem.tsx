import { Check } from "lucide-react";
import {
  type CollectionItem,
  formatCardNumber,
} from "@poke-organizer/shared";
import { formatBrl } from "../../lib/format";
import { CardVariantImage } from "./CardVariantImage";

type Props = {
  item: CollectionItem;
  selected?: boolean;
  onToggleSelection: (itemId: string) => void;
};

export function SimpleCardPickerItem({
  item,
  selected,
  onToggleSelection,
}: Props) {
  const displayPrice = item.price?.amount ?? 0;
  const fullNumber = formatCardNumber(item.card.number, item.card.printedTotal);

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
