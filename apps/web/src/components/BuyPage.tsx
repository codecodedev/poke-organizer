import { useState, useEffect } from "react";
import { Gavel, Search, ShoppingBag, Store, User, X } from "lucide-react";
import { api, type Session } from "../lib/api";
import { formatBrl } from "../lib/format";
import { Panel } from "./ui/Panel";
import { CollectionItemCard } from "./collection/CollectionItemCard";
import { MarketAuctionCard } from "./collection/MarketAuctionCard";

type Props = {
  session: Session;
  onSession: (session: Session) => void;
  onUnauthorized: () => Promise<Session | null>;
  onNavigate: (route: { view: any; publicCollection?: string; auction?: string; q?: string }) => void;
};

export function BuyPage({ session, onNavigate }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ items: any[]; auctions: any[] } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.length < 2) {
      setResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.searchMarket(query, session.accessToken);
        setResults(data);
      } catch (err) {
        console.error("Search failed", err);
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [query, session.accessToken]);

  return (
    <div className="flex flex-col gap-6">
      <Panel>
        <div className="mb-6">
          <h1 className="text-3xl font-black text-foreground">Comprar Cartas</h1>
          <p className="section-copy mt-1">Busque cartas à venda ou em negociação por lances na comunidade.</p>
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
          <input
            className="premium-input w-full pl-12 pr-12 h-14 text-lg"
            placeholder="Buscar por nome ou número da carta..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </Panel>

      {loading && (
        <div className="py-20 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
          <p className="mt-4 text-sm font-bold text-muted-foreground">Buscando no mercado...</p>
        </div>
      )}

      {results && (
        <div className="grid gap-8">
          {/* Auctions Section */}
          <section>
            <div className="mb-4 flex items-center gap-2 px-1">
              <Gavel size={20} className="text-amber" />
              <h2 className="text-xl font-black text-foreground">Ofertas abertas</h2>
              <span className="ml-2 rounded-full bg-amber/10 border border-amber/20 px-2 py-0.5 text-xs font-black text-amber">
                {results.auctions.length}
              </span>
            </div>

            {results.auctions.length === 0 ? (
              <p className="py-8 text-center text-sm font-bold text-muted-foreground rounded-2xl border border-dashed border-card-border/60">
                Nenhuma oferta aberta encontrada para "{query}"
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {results.auctions.map((auction) => (
                  <MarketAuctionCard
                    key={auction.id}
                    name={auction.card.name}
                    image={auction.card.imageSmall || ""}
                    price={auction.currentBid || auction.minBid}
                    sellerName={auction.sellerName}
                    number={auction.card.number}
                    onClick={() => onNavigate({ 
                      view: "home", 
                      auction: auction.shareToken,
                      q: auction.card.printedTotal ? `${auction.card.number}/${auction.card.printedTotal}` : auction.card.number
                    })}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Store Items Section */}
          <section>
            <div className="mb-4 flex items-center gap-2 px-1">
              <Store size={20} className="text-cyan" />
              <h2 className="text-xl font-black text-foreground">Disponíveis em Lojas</h2>
              <span className="ml-2 rounded-full bg-cyan/10 border border-cyan/20 px-2 py-0.5 text-xs font-black text-cyan">
                {results.items.length}
              </span>
            </div>

            {results.items.length === 0 ? (
              <p className="py-8 text-center text-sm font-bold text-muted-foreground rounded-2xl border border-dashed border-card-border/60">
                Nenhuma carta à venda encontrada para "{query}"
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {results.items.map((item) => (
                  <div key={item.id} className="group relative">
                    <CollectionItemCard
                      item={item}
                      price={item.price}
                      onOpen={() => onNavigate({ 
                        view: "home", 
                        publicCollection: item.shareToken,
                        q: item.card.printedTotal ? `${item.card.number}/${item.card.printedTotal}` : item.card.number
                      })}
                    >
                      <div className="mt-2 flex flex-col p-2 gap-1">
                        <div className="flex items-center gap-1 text-[10px] font-black text-muted-foreground uppercase">
                          <Store size={10} /> {item.folderName}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] font-bold text-brand">
                          <User size={10} /> {item.sellerName}
                        </div>
                      </div>
                    </CollectionItemCard>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {!results && !loading && query.length > 0 && query.length < 2 && (
        <p className="text-center text-sm font-bold text-muted-foreground">Continue digitando para buscar...</p>
      )}

      {!results && !loading && query.length === 0 && (
        <div className="py-20 text-center opacity-40">
           <ShoppingBag size={64} className="mx-auto text-muted-foreground mb-4" />
           <p className="text-lg font-black text-muted-foreground">O que você está procurando hoje?</p>
        </div>
      )}
    </div>
  );
}
