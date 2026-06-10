import type { ReactNode } from "react";
import { User, Gavel, Sparkles } from "lucide-react";
import { formatBrl } from "../../lib/format";

type Props = {
  name: string;
  image: string;
  price?: number;
  sellerName?: string;
  condition?: string;
  variant?: string;
  onClick: () => void;
  className?: string;
  collectionCode?: string | null;
  collectionName?: string | null;
  number: string;
};

export function MarketAuctionCard({ 
  name, 
  image, 
  price, 
  sellerName, 
  condition, 
  variant, 
  onClick, 
  className = "",
  collectionCode,
  collectionName,
  number
}: Props) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex flex-col gap-3 rounded-[26px] border-2 border-card-border bg-card/60 p-1 text-left transition-all duration-300 hover:-translate-y-1 hover:border-amber/40 hover:shadow-xl ${className}`}
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-muted/20">
        <img
          src={image}
          alt={name}
          className="h-full w-full object-contain transition group-hover:scale-105"
        />
        
        {/* Badges - Top Layer */}
        <div className="absolute left-2 top-2 z-10 flex flex-col gap-1.5">
           {condition && (
             <span className="rounded-lg w-fit bg-card/80 px-2 py-0.5 text-[9px] font-black text-muted-foreground uppercase backdrop-blur-md border border-card-border/40 shadow-sm">
               {condition}
             </span>
           )}
           {variant && variant !== "normal" && (
             <span className="rounded-lg w-fit bg-card/80 border border-amber/20 px-2 py-0.5 text-[9px] font-black text-muted-foreground uppercase backdrop-blur-md shadow-sm">
               {variant}
             </span>
           )}
           {number && (
             <span className="rounded-lg w-fit bg-card/80 border border-amber/20 px-2 py-0.5 text-[9px] font-black text-muted-foreground uppercase backdrop-blur-md shadow-sm">
               {number}
             </span>
           )}
        </div>
      </div>

      <div className="flex flex-1 flex-col px-1 pb-1">
        <div className="flex items-center justify-start gap-2">
           <h3 className="truncate text-sm font-black text-foreground">{name}</h3>
           {price !== undefined && (
             <span className="shrink-0 rounded-lg bg-amber/10 px-1.5 py-0.5 text-[10px] font-black text-amber">
               LEILÃO
             </span>
           )}
        </div>

        <h3 className="truncate text-sm font-black text-slate-500">{collectionCode??collectionName}</h3>

        <div className="mt-3 flex items-center justify-between gap-3">
          {price !== undefined && (
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground leading-none mb-1">Lance Atual</p>
              <p className="text-sm font-black text-amber leading-none">{formatBrl(price)}</p>
            </div>
          )}
          
          {sellerName && (
            <div className="ml-auto text-right">
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground leading-none mb-1">Vendedor</p>
              <div className="flex items-center justify-end gap-1 text-[10px] font-bold text-foreground leading-none">
                <User size={10} className="text-brand" /> {sellerName}
              </div>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
