import { useState, useEffect } from "react";
import { Gavel, Search, ShoppingBag, Store, User } from "lucide-react";
import { api, type Session } from "../lib/api";
import { formatBrl } from "../lib/format";
import { Panel } from "./ui/Panel";
import { CollectionItemCard } from "./collection/CollectionItemCard";

type Props = {
  session: Session;
  onSession: (session: Session) => void;
  onUnauthorized: () => Promise<Session | null>;
  onNavigate: (route: { view: any; publicCollection?: string; auction?: string }) => void;
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
          <h1 className="text-3xl font-black text-ink dark:text-white">Comprar Cartas</h1>
          <p className="section-copy mt-1">Busque cartas à venda ou em leilão na comunidade.</p>
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            className="premium-input w-full pl-12 h-14 text-lg"
            placeholder="Buscar por nome ou número da carta..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
      </Panel>

      {loading && (
        <div className="py-20 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
          <p className="mt-4 text-sm font-bold text-slate-500">Buscando no mercado...</p>
        </div>
      )}

      {results && (
        <div className="grid gap-8">
          {/* Auctions Section */}
          <section>
            <div className="mb-4 flex items-center gap-2 px-1">
              <Gavel size={20} className="text-amber-500" />
              <h2 className="text-xl font-black text-ink dark:text-white">Leilões Ativos</h2>
              <span className="ml-2 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-xs font-black text-amber-700 dark:text-amber-400">
                {results.auctions.length}
              </span>
            </div>

            {results.auctions.length === 0 ? (
              <p className="py-8 text-center text-sm font-bold text-slate-400 rounded-2xl border border-dashed border-line/60">
                Nenhum leilão encontrado para "{query}"
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {results.auctions.map((auction) => (
                  <div
                    key={auction.id}
                    onClick={() => onNavigate({ view: "home", auction: auction.shareToken })}
                    className="group relative cursor-pointer overflow-hidden rounded-3xl border border-white/5 bg-white/5 shadow-sm transition-all hover:-translate-y-1 hover:border-amber-500/30"
                  >
                    <div className="aspect-[3/4] overflow-hidden">
                      <img
                        src={auction.card.imageSmall || ""}
                        alt={auction.card.name}
                        className="h-full w-full object-cover transition-transform group-hover:scale-110"
                      />
                    </div>
                    <div className="p-4 bg-gradient-to-b from-transparent to-black/60">
                      <p className="truncate text-sm font-black text-white">{auction.card.name}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-sm font-black text-amber-400">
                          {formatBrl(auction.currentBid || auction.minBid)}
                        </span>
                        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-300">
                           <User size={10} /> {auction.sellerName}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Store Items Section */}
          <section>
            <div className="mb-4 flex items-center gap-2 px-1">
              <Store size={20} className="text-cyan-500" />
              <h2 className="text-xl font-black text-ink dark:text-white">Disponíveis em Lojas</h2>
              <span className="ml-2 rounded-full bg-cyan-100 dark:bg-cyan-900/30 px-2 py-0.5 text-xs font-black text-cyan-700 dark:text-cyan-400">
                {results.items.length}
              </span>
            </div>

            {results.items.length === 0 ? (
              <p className="py-8 text-center text-sm font-bold text-slate-400 rounded-2xl border border-dashed border-line/60">
                Nenhuma carta à venda encontrada para "{query}"
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {results.items.map((item) => (
                  <div key={item.id} className="group relative">
                    <CollectionItemCard
                      item={item}
                      price={item.price}
                      onOpen={() => onNavigate({ view: "home", publicCollection: item.shareToken })}
                    >
                      <div className="mt-2 flex flex-col gap-1">
                        <div className="flex items-center gap-1 text-[10px] font-black text-slate-500 uppercase">
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
        <p className="text-center text-sm font-bold text-slate-400">Continue digitando para buscar...</p>
      )}

      {!results && !loading && query.length === 0 && (
        <div className="py-20 text-center opacity-40">
           <ShoppingBag size={64} className="mx-auto text-slate-300 mb-4" />
           <p className="text-lg font-black text-slate-500">O que você está procurando hoje?</p>
        </div>
      )}
    </div>
  );
}
