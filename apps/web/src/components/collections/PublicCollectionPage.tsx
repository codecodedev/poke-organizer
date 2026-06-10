import { useEffect, useMemo, useState } from "react";
import { FolderOpen, Gavel, Lock, Plus, Search, ShoppingBag, X, CheckSquare, SlidersHorizontal } from "lucide-react";
import { ProposalCart } from "../ProposalCart";
import type {
  CollectionFolderSort,
  CollectionItem,
  PublicCollectionDetail,
  CollectionCartOffer,
} from "@poke-organizer/shared";
import { api, type Session } from "../../lib/api";
import { type AppRoute } from "../../pages/App";
import { withAuthRetry } from "../../lib/authRetry";
import { formatBrl } from "../../lib/format";
import { CollectionItemCard } from "../collection/CollectionItemCard";
import { CardDetailModal } from "../CardDetailModal";
import { PaginationControls } from "../ui/PaginationControls";
import { Panel } from "../ui/Panel";
import { Button } from "../ui/Button";
import { ThemeToggle } from "../ui/ThemeToggle";
import { FilterContainer, FilterSelect } from "../ui/Filters";
import { SEO } from "../SEO";

const PUBLIC_COLLECTION_PAGE_SIZE = 24;

type Props = {
  shareToken: string;
  session: Session | null;
  onSession: (session: Session) => void;
  onUnauthorized: () => Promise<Session | null>;
  onNavigate: (route: AppRoute) => void;
  hideHeader?: boolean;
  theme?: "light" | "dark";
  onToggleTheme?: () => void;
};

export function PublicCollectionPage({ shareToken, session, onSession, onUnauthorized, onNavigate, hideHeader, theme, onToggleTheme }: Props) {
  const [collection, setCollection] = useState<PublicCollectionDetail | null>(
    null,
  );
  const [selectedItem, setSelectedItem] = useState<CollectionItem | null>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState(() => localStorage.getItem("pc_typeFilter") ?? "");
  const [rarityFilter, setRarityFilter] = useState(() => localStorage.getItem("pc_rarityFilter") ?? "");
  const [variantFilter, setVariantFilter] = useState(() => localStorage.getItem("pc_variantFilter") ?? "");
  const [sort, setSort] = useState<CollectionFolderSort>(() => (localStorage.getItem("pc_sort") as CollectionFolderSort) ?? "newest");
  const [showSold, setShowSold] = useState(() => localStorage.getItem("pc_showSold") === "true");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<string, { item: CollectionItem; amount: string; quantity: number }>>(() => {
    try {
      const saved = localStorage.getItem(`cart_${shareToken}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [isGlobalMode, setIsGlobalMode] = useState(() => {
    return localStorage.getItem(`cart_global_mode_${shareToken}`) === "true";
  });
  const [globalTotal, setGlobalTotal] = useState(() => {
    return localStorage.getItem(`cart_global_total_${shareToken}`) || "";
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMyProposalsModal, setShowMyProposalsModal] = useState(false);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [myProposals, setMyProposals] = useState<CollectionCartOffer[]>([]);

  useEffect(() => {
    localStorage.setItem(`cart_${shareToken}`, JSON.stringify(cart));
  }, [cart, shareToken]);

  useEffect(() => {
    localStorage.setItem(`cart_global_mode_${shareToken}`, String(isGlobalMode));
  }, [isGlobalMode, shareToken]);

  useEffect(() => {
    localStorage.setItem(`cart_global_total_${shareToken}`, globalTotal);
  }, [globalTotal, shareToken]);

  useEffect(() => {
    localStorage.setItem("pc_typeFilter", typeFilter);
    localStorage.setItem("pc_rarityFilter", rarityFilter);
    localStorage.setItem("pc_variantFilter", variantFilter);
    localStorage.setItem("pc_sort", sort);
    localStorage.setItem("pc_showSold", String(showSold));
  }, [typeFilter, rarityFilter, variantFilter, sort, showSold]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const detail = await api.getPublicCollection(shareToken, {}, session?.accessToken);
        if (!cancelled) {
          setCollection(detail);

          if (session) {
            try {
              const allMyProposals = await withAuthRetry(session, onSession, onUnauthorized, (token) =>
                api.listMyProposals(token),
              );
              setMyProposals(allMyProposals.filter((p) => p.folderId === detail.id));
            } catch (err) {
              console.error("Failed to load user proposals", err);
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Colecao indisponivel");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [shareToken, session, onSession, onUnauthorized]);

  const items = collection?.items ?? [];
  const unsoldItems = useMemo(() => items.filter((i) => !i.store?.isSold), [items]);
  const totalValue = useMemo(() => unsoldItems.reduce(
    (sum, item) => sum + (item.store?.effectivePrice ?? item.customPrice ?? item.price?.amount ?? 0) * item.quantity,
    0,
  ), [unsoldItems]);
  const typeOptions = useMemo(
    () => unique(items.flatMap((item) => item.card.types)),
    [items],
  );
  const rarityOptions = useMemo(
    () =>
      unique(items.map((item) => item.card.rarity).filter(Boolean) as string[]),
    [items],
  );
  const variantOptions = useMemo(
    () => unique(items.map((item) => item.variant)),
    [items],
  );
  const visibleItems = useMemo(() => {
    const normalizedQuery = normalizeText(query);
    const filtered = items.filter((item) => {
      // Se for vitrine (NAO for loja), nao mostra vendidos pro publico
      if (!collection?.isStore && item.store?.isSold) return false;

      // Se for loja, respeita o filtro de vendidos
      if (collection?.isStore && item.store?.isSold && !showSold) return false;

      if (typeFilter && !item.card.types.includes(typeFilter)) return false;
      if (rarityFilter && item.card.rarity !== rarityFilter) return false;
      if (variantFilter && item.variant !== variantFilter) return false;
      if (!normalizedQuery) return true;

      const searchable = normalizeText(
        [
          item.card.name,
          item.card.number,
          item.card.printedTotal,
          item.card.setName,
          item.variant,
          item.condition,
          item.language,
        ].join(" "),
      );

      return searchable.includes(normalizedQuery);
    });

    return sortItems(filtered, sort);
  }, [items, query, rarityFilter, sort, typeFilter, variantFilter, collection?.isStore, showSold]);

  useEffect(() => {
    setPage(1);
  }, [query, rarityFilter, sort, typeFilter, variantFilter, showSold]);

  useEffect(() => {
    const totalPages = Math.max(
      1,
      Math.ceil(visibleItems.length / PUBLIC_COLLECTION_PAGE_SIZE),
    );
    setPage((current) => Math.min(current, totalPages));
  }, [visibleItems.length]);

  const paginatedItems = visibleItems.slice(
    (page - 1) * PUBLIC_COLLECTION_PAGE_SIZE,
    page * PUBLIC_COLLECTION_PAGE_SIZE,
  );

  async function reloadCollection() {
    const detail = await api.getPublicCollection(shareToken);
    setCollection(detail);
  }

  async function submitProposal(proposalItems: { folderItemId: string; amount: number; quantity: number }[], proposalMessage: string, totalOffer?: number, isGlobalOffer?: boolean) {
    if (!session) {
      setMessage("Faca login no site para enviar uma proposta.");
      return;
    }

    if (!session.user.whatsapp) {
      setMessage("Você precisa cadastrar seu WhatsApp no seu perfil para enviar propostas.");
      return;
    }

    setIsSubmitting(true);
    try {
      await withAuthRetry(session, onSession, onUnauthorized, (token) =>
        api.createPublicCollectionOffer(token, shareToken, { 
          items: proposalItems, 
          message: proposalMessage || undefined,
          totalOffer,
          isGlobalOffer
        }),
      );
      setMessage("Proposta enviada para o dono da colecao.");
      await reloadCollection();
      
      // Clear saved cart
      localStorage.removeItem(`cart_${shareToken}`);
      localStorage.removeItem(`cart_global_mode_${shareToken}`);
      localStorage.removeItem(`cart_global_total_${shareToken}`);
      setCart({});
      setIsGlobalMode(false);
      setGlobalTotal("");
      
      // Refresh user proposals
      const allMyProposals = await withAuthRetry(session, onSession, onUnauthorized, (token) =>
        api.listMyProposals(token),
      );
      setMyProposals(allMyProposals.filter((p) => p.folderId === collection?.id));
    } finally {
      setIsSubmitting(false);
    }
  }

  function addToCart(item: CollectionItem) {
    setCart(prev => ({
      ...prev,
      [item.id]: {
        item,
        amount: String(item.store?.effectivePrice ?? item.price?.amount ?? 0),
        quantity: 1
      }
    }));
  }

  return (
    <main className={hideHeader ? "" : "app-shell"}>
      {collection && (
        <SEO 
          title={collection.name} 
          description={`Confira a coleção "${collection.name}" de ${collection.ownerName} no Coleciona cards. Veja cartas, valores e envie propostas.`}
          image={collection.bannerUrl || undefined}
          url={`/p/${shareToken}`}
        />
      )}
      {!hideHeader && (
        <header className="sticky top-0 z-30 border-b border-card-border bg-card/75 backdrop-blur-xl">
          <div className="mx-auto flex h-20 max-w-7xl items-center px-5 py-4">
            {/* Left: Spacer (to center logo) */}
            <div className="hidden sm:flex w-1/4" />
            
            {/* Center: Logo */}
            <div className="flex flex-1 items-center justify-center gap-3">
              <div className="grid h-10 w-10 sm:h-12 sm:w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand via-magenta to-amber font-black text-white shadow-glow">
                CC
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-lg sm:text-xl font-black text-foreground">
                  Coleciona cards
                </h1>
                <p className="truncate text-[10px] sm:text-sm font-medium text-muted-foreground">
                  Coleção compartilhada
                </p>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex w-1/4 items-center justify-end gap-2 sm:gap-3">
              {theme && onToggleTheme && (
                <ThemeToggle theme={theme} onToggle={onToggleTheme} />
              )}
              {!session && (
                <Button
                  variant="brand"
                  className="hidden sm:flex"
                  onClick={() => window.location.href = "/"}
                >
                  Entrar
                </Button>
              )}
            </div>
          </div>
        </header>
      )}

      <div className={hideHeader ? "grid gap-5" : "mx-auto grid max-w-7xl gap-5 px-5 py-6"}>
        {loading && (
          <Panel>
            <p className="section-copy">Carregando colecao...</p>
          </Panel>
        )}

        {!loading && error && (
          <Panel>
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent text-muted-foreground">
                <Lock size={20} />
              </span>
              <div>
                <h2 className="section-title">Coleção indisponível</h2>
                <p className="section-copy mt-1">
                  {error.includes("permissão") || error.includes("privada") || error.includes("Unauthorized")
                    ? "Esta coleção é privada. Se você recebeu permissão para vê-la, certifique-se de estar logado."
                    : "Este link não está público ou não existe mais."}
                </p>
                {!session && (error.includes("permissão") || error.includes("privada") || error.includes("Unauthorized")) && (
                  <Button
                    variant="brand"
                    className="mt-5"
                    onClick={() => window.location.href = "/"}
                  >
                    Entrar para acessar
                  </Button>
                )}
              </div>
            </div>
          </Panel>
        )}

        {!loading && collection && (
          <>
            {collection.bannerUrl && (
              <div className="overflow-hidden rounded-[32px] border border-card-border bg-card/70 shadow-sm">
                <div className="relative aspect-[21/9] w-full overflow-hidden bg-slate-950 sm:aspect-[4/1]">
                  <img 
                    src={collection.bannerUrl} 
                    alt="Banner da Coleção" 
                    className="h-full w-full object-cover opacity-90 transition-opacity hover:opacity-100" 
                    onError={(e) => (e.currentTarget.parentElement!.style.display = 'none')}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent" />
                  <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between gap-4">
                     <div>
                       <h1 className="text-2xl font-black text-white drop-shadow-md sm:text-4xl">{collection.name}</h1>
                       <p className="mt-1 text-sm font-bold text-slate-200 drop-shadow-sm">Por {collection.ownerName} - {unsoldItems.length} cartas - {formatBrl(totalValue)}</p>
                     </div>
                  </div>
                </div>
              </div>
            )}

            <Panel>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                    {collection.isStore ? "Pasta para vender" : "Pasta para visualizar"}
                  </p>
                  {!collection.bannerUrl && <h2 className="section-title truncate">{collection.name}</h2>}
                  {!collection.bannerUrl && (
                    <p className="section-copy mt-1">
                      Por {collection.ownerName} - {unsoldItems.length} cartas -{" "}
                      {formatBrl(totalValue)}
                    </p>
                  )}
                  {collection.bannerUrl && <h2 className="section-title truncate">Informações</h2>}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {myProposals.length > 0 && (
                    <Button
                      variant="primary"
                      className="border-brand/40 bg-brand/5 text-brand"
                      icon={<ShoppingBag size={18} />}
                      onClick={() => setShowMyProposalsModal(true)}
                    >
                      Minhas propostas
                    </Button>
                  )}
                  <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black ${
                    collection.isPublic 
                      ? "border-leaf/25 bg-leaf/10 text-leaf" 
                      : "border-amber/20 bg-amber/10 text-amber"
                  }`}>
                    {collection.isPublic ? <FolderOpen size={14} /> : <Lock size={14} />}
                    {collection.isPublic ? "Publica" : "Privada (Acesso Autorizado)"}
                  </span>
                </div>
              </div>
              {message && (
                <div className={`mt-4 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  message.includes("enviada") ? "bg-leaf/10 text-leaf" : "bg-magenta/10 text-magenta"
                }`}>
                  <p className="text-sm font-bold">{message}</p>
                  {message.includes("WhatsApp") && (
                    <Button
                      variant="outline"
                      className="h-10 px-6 border-magenta/20 text-magenta hover:bg-magenta/10"
                      onClick={() => onNavigate({ view: "profile" })}
                    >
                      Ir para o Perfil
                    </Button>
                  )}
                </div>
              )}
            </Panel>

            <Panel>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                    size={18}
                  />
                  <input
                    className="premium-input w-full pl-11 pr-11"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Nome, número, coleção..."
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
                <Button
                  variant="primary"
                  className="gap-2 sm:px-6"
                  icon={<SlidersHorizontal size={18} />}
                  onClick={() => setShowFiltersModal(true)}
                >
                  Filtros e Ordenação
                </Button>
              </div>

              <div className="mt-6 rounded-2xl border border-lilac/25 bg-lilac/10 px-4 py-3 text-sm font-black text-lilac">
                {visibleItems.length} de {items.length} cartas visíveis
              </div>

              {visibleItems.length ? (
                <>
                  <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                    {paginatedItems.map((item) => (
                      <CollectionItemCard
                        key={item.id}
                        item={item}
                        price={item.price ?? undefined}
                        onOpen={setSelectedItem}
                      >
                        {collection.isStore && !item.store?.isSold && (
                          <Button
                            variant="ghost"
                            className={`w-full h-10 gap-2 text-xs font-black uppercase transition-all ${
                                cart[item.id] 
                                    ? "!bg-emerald-500 !text-white !border-emerald-500 shadow-glow shadow-emerald-500/20" 
                                    : "bg-accent/40 border-card-border text-muted-foreground hover:text-foreground hover:border-brand/40 hover:bg-brand/10"
                            }`}
                            icon={cart[item.id] ? <CheckSquare size={16} /> : <Plus size={16} />}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (cart[item.id]) {
                                    setCart(prev => {
                                        const next = { ...prev };
                                        delete next[item.id];
                                        return next;
                                    });
                                } else {
                                    addToCart(item);
                                }
                            }}
                          >
                            {cart[item.id] ? "No carrinho" : "Adicionar"}
                          </Button>
                        )}
                      </CollectionItemCard>
                    ))}
                  </div>
                  <PaginationControls
                    page={page}
                    pageSize={PUBLIC_COLLECTION_PAGE_SIZE}
                    totalItems={visibleItems.length}
                    onPageChange={setPage}
                    itemLabel="cartas"
                  />
                </>
              ) : (
                <div className="mt-5 rounded-[24px] border border-card-border bg-card/70 p-5 text-sm font-bold text-muted-foreground shadow-sm">
                  Nenhuma carta aparece com os filtros atuais.
                </div>
              )}
            </Panel>
          </>
        )}
      </div>

      <CardDetailModal
        card={selectedItem?.card ?? null}
        collectionItem={selectedItem}
        collectionPrice={selectedItem?.price ?? null}
        onClose={() => setSelectedItem(null)}
      />

      {collection?.isStore && (
        <ProposalCart
          cart={cart}
          setCart={setCart}
          isGlobalMode={isGlobalMode}
          setIsGlobalMode={setIsGlobalMode}
          globalTotal={globalTotal}
          setGlobalTotal={setGlobalTotal}
          onSubmit={submitProposal}
          isSubmitting={isSubmitting}
          folderName={collection.name}
          session={session}
          theme={theme}
        />
      )}

      {showMyProposalsModal && (
        <MyProposalsModal
          proposals={myProposals}
          onClose={() => setShowMyProposalsModal(false)}
        />
      )}

      {showFiltersModal && (
        <div 
          className="fixed inset-0 z-[60] flex items-end justify-center bg-background/60 backdrop-blur-sm sm:items-center p-0 sm:p-4"
          onMouseDown={() => setShowFiltersModal(false)}
        >
          <div 
            className="animate-in slide-in-from-bottom-full sm:animate-soft-pop flex w-full max-w-lg flex-col overflow-hidden rounded-t-[32px] sm:rounded-[32px] border border-card-border bg-card shadow-2xl h-[80vh] sm:h-auto"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-card-border px-6 py-5 shrink-0">
              <div>
                <h2 className="text-xl font-black text-foreground">Filtros e Ordenação</h2>
                <p className="text-sm font-semibold text-muted-foreground">Refine os resultados da coleção.</p>
              </div>
              <button
                onClick={() => setShowFiltersModal(false)}
                className="grid h-10 w-10 place-items-center rounded-xl border border-card-border bg-card text-foreground transition hover:bg-accent"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid gap-6">
                <FilterSelect
                  label="Tipo"
                  value={typeFilter}
                  onChange={setTypeFilter}
                  options={typeOptions}
                  emptyLabel="Todos"
                />
                <FilterSelect
                  label="Raridade"
                  value={rarityFilter}
                  onChange={setRarityFilter}
                  options={rarityOptions}
                  emptyLabel="Todas"
                />
                <FilterSelect
                  label="Variante"
                  value={variantFilter}
                  onChange={setVariantFilter}
                  options={variantOptions}
                  emptyLabel="Todas"
                />
                <label className="grid gap-2">
                  <span className="px-1 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                    Ordenação
                  </span>
                  <select
                    className="premium-select w-full"
                    value={sort}
                    onChange={(event) =>
                      setSort(event.target.value as CollectionFolderSort)
                    }
                  >
                    <option value="newest">Última adicionada</option>
                    <option value="oldest">Mais antiga</option>
                    <option value="value-desc">Maior valor</option>
                    <option value="value-asc">Menor valor</option>
                    <option value="price-change-desc">Maior alta</option>
                    <option value="price-change-asc">Maior queda</option>
                  </select>
                </label>
                {collection?.isStore && (
                  <label className="flex items-center justify-between gap-4 rounded-2xl border border-card-border p-4">
                    <div>
                      <span className="block text-sm font-black text-foreground">
                        Ver vendidas
                      </span>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        Exibir itens já negociados
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={showSold}
                      onChange={(e) => setShowSold(e.target.checked)}
                      className="h-6 w-6 rounded-lg border-card-border text-brand focus:ring-brand/30"
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="border-t border-card-border p-6 shrink-0">
              <Button 
                variant="brand" 
                className="w-full h-12"
                onClick={() => setShowFiltersModal(false)}
              >
                Ver {visibleItems.length} resultados
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function MyProposalsModal({
  proposals,
  onClose,
}: {
  proposals: CollectionCartOffer[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-background/60 px-4 py-6 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className="animate-soft-pop flex h-full max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-[26px] border border-card-border bg-card shadow-card"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-card-border px-6 py-5">
          <div>
            <h2 className="text-xl font-black text-foreground">Minhas Propostas</h2>
            <p className="text-sm font-semibold text-muted-foreground">Histórico de propostas nesta coleção.</p>
          </div>
          <button
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-xl border border-card-border bg-card text-foreground transition hover:bg-accent"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div className="grid gap-3">
            {proposals.map((offer) => (
              <div
                key={offer.id}
                className="rounded-2xl border border-card-border bg-accent/30 p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">
                      Enviada em {new Date(offer.createdAt).toLocaleDateString()}
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="font-black text-foreground">Total: {formatBrl(offer.totalOffer)}</p>
                      {offer.isGlobalOffer && (
                        <span className="rounded-lg bg-brand px-2 py-0.5 text-[10px] font-black text-white uppercase tracking-tighter">
                          Proposta Global
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {offer.items.map((item) => (
                        <span key={item.id} className="rounded-lg bg-card px-2 py-0.5 text-[10px] font-bold text-muted-foreground border border-card-border">
                          {item.quantity}x {item.item.card.name} {offer.isGlobalOffer ? "" : `(${formatBrl(item.amount)})`}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider ${
                      offer.status === "accepted"
                        ? "bg-leaf text-white"
                        : offer.status === "rejected"
                          ? "bg-magenta text-white"
                          : "bg-amber/20 text-amber"
                    }`}
                  >
                    {offer.status === "accepted"
                      ? "Aceita"
                      : offer.status === "rejected"
                        ? "Recusada"
                        : "Pendente"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) =>
    left.localeCompare(right),
  );
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function sortItems(
  items: CollectionItem[],
  sort: CollectionFolderSort,
): CollectionItem[] {
  if (sort === "value-desc")
    return [...items].sort(
      (left, right) =>
        (right.customPrice ?? right.price?.amount ?? 0) -
        (left.customPrice ?? left.price?.amount ?? 0),
    );
  if (sort === "value-asc")
    return [...items].sort(
      (left, right) =>
        (left.customPrice ?? left.price?.amount ?? 0) -
        (right.customPrice ?? right.price?.amount ?? 0),
    );
  if (sort === "price-change-desc")
    return [...items].sort(
      (left, right) => latestPriceChange(right) - latestPriceChange(left),
    );
  if (sort === "price-change-asc")
    return [...items].sort(
      (left, right) => latestPriceChange(left) - latestPriceChange(right),
    );
  if (sort === "oldest")
    return [...items].sort(
      (left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt),
    );
  return [...items].sort(
    (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
  );
}

function latestPriceChange(item: CollectionItem): number {
  if (item.customPrice !== null && item.customPrice !== undefined) {
    return 0;
  }
  const history = item.price?.history ?? [];
  const latest = history[history.length - 1];
  return latest ? latest.amount - latest.previousAmount : 0;
}
