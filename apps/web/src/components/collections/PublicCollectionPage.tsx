import { useEffect, useMemo, useState } from "react";
import { FolderOpen, Gavel, Lock, Plus, Search, ShoppingBag, X } from "lucide-react";
import type {
  CollectionFolderSort,
  CollectionItem,
  PublicCollectionDetail,
  CollectionCartOffer,
} from "@poke-organizer/shared";
import { api, type Session } from "../../lib/api";
import { withAuthRetry } from "../../lib/authRetry";
import { formatBrl } from "../../lib/format";
import { CollectionItemCard } from "../collection/CollectionItemCard";
import { CardDetailModal } from "../CardDetailModal";
import { PaginationControls } from "../ui/PaginationControls";
import { Panel } from "../ui/Panel";
import { Button } from "../ui/Button";

const PUBLIC_COLLECTION_PAGE_SIZE = 24;

type Props = {
  shareToken: string;
  session: Session | null;
  onSession: (session: Session) => void;
  onUnauthorized: () => Promise<Session | null>;
};

export function PublicCollectionPage({ shareToken, session, onSession, onUnauthorized }: Props) {
  const [collection, setCollection] = useState<PublicCollectionDetail | null>(
    null,
  );
  const [selectedItem, setSelectedItem] = useState<CollectionItem | null>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState(() => localStorage.getItem("pc_typeFilter") ?? "");
  const [rarityFilter, setRarityFilter] = useState(() => localStorage.getItem("pc_rarityFilter") ?? "");
  const [variantFilter, setVariantFilter] = useState(() => localStorage.getItem("pc_variantFilter") ?? "");
  const [sort, setSort] = useState<CollectionFolderSort>(() => (localStorage.getItem("pc_sort") as CollectionFolderSort) ?? "newest");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedAuctionItem, setSelectedAuctionItem] = useState<CollectionItem | null>(null);
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [myProposals, setMyProposals] = useState<CollectionCartOffer[]>([]);

  useEffect(() => {
    localStorage.setItem("pc_typeFilter", typeFilter);
    localStorage.setItem("pc_rarityFilter", rarityFilter);
    localStorage.setItem("pc_variantFilter", variantFilter);
    localStorage.setItem("pc_sort", sort);
  }, [typeFilter, rarityFilter, variantFilter, sort]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const detail = await api.getPublicCollection(shareToken);
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
  }, [items, query, rarityFilter, sort, typeFilter, variantFilter, collection?.isStore]);

  useEffect(() => {
    setPage(1);
  }, [query, rarityFilter, sort, typeFilter, variantFilter]);

  useEffect(() => {
    const totalPages = Math.max(
      1,
      Math.ceil(visibleItems.length / PUBLIC_COLLECTION_PAGE_SIZE),
    );
    setPage((current) => Math.min(current, totalPages));
  }, [visibleItems.length]);

  const totalValue = items.reduce(
    (sum, item) => sum + (item.price?.amount ?? 0) * item.quantity,
    0,
  );
  const paginatedItems = visibleItems.slice(
    (page - 1) * PUBLIC_COLLECTION_PAGE_SIZE,
    page * PUBLIC_COLLECTION_PAGE_SIZE,
  );

  async function reloadCollection() {
    const detail = await api.getPublicCollection(shareToken);
    setCollection(detail);
  }

  async function submitBid(amount: number) {
    if (!selectedAuctionItem?.folderItemId) return;
    if (!session) {
      setMessage("Faca login no site para dar lances nesta colecao.");
      return;
    }
    const detail = await withAuthRetry(session, onSession, onUnauthorized, (token) =>
      api.createPublicCollectionBid(token, shareToken, selectedAuctionItem.folderItemId!, amount),
    );
    setCollection(detail);
    
    const updatedItem = detail.items.find(i => i.id === selectedAuctionItem.id);
    if (updatedItem) {
      setSelectedAuctionItem(updatedItem);
    }
    
    setMessage("Lance enviado.");
  }

  async function submitProposal(proposalItems: { folderItemId: string; amount: number; quantity: number }[], proposalMessage: string) {
    if (!session) {
      setMessage("Faca login no site para enviar uma proposta.");
      return;
    }
    await withAuthRetry(session, onSession, onUnauthorized, (token) =>
      api.createPublicCollectionOffer(token, shareToken, { items: proposalItems, message: proposalMessage || undefined }),
    );
    setMessage("Proposta enviada para o dono da colecao.");
    await reloadCollection();
  }

  return (
    <main className="app-shell">
      <header className="border-b border-white/70 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-5 py-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand via-coral to-amber font-black text-white shadow-glow">
            CC
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-black text-ink">
              Coleciona cards
            </h1>
            <p className="truncate text-sm font-medium text-slate-600">
              Colecao compartilhada
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-5 py-6">
        {loading && (
          <Panel>
            <p className="section-copy">Carregando colecao...</p>
          </Panel>
        )}

        {!loading && error && (
          <Panel>
            <div className="flex items-start gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-600">
                <Lock size={20} />
              </span>
              <div>
                <h2 className="section-title">Colecao indisponivel</h2>
                <p className="section-copy mt-1">
                  Este link nao esta publico ou nao existe mais.
                </p>
              </div>
            </div>
          </Panel>
        )}

        {!loading && collection && (
          <>
            <Panel>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    Visualizacao publica
                  </p>
                  <h2 className="section-title truncate">{collection.name}</h2>
                  <p className="section-copy mt-1">
                    Por {collection.ownerName} - {unsoldItems.length} cartas -{" "}
                    {formatBrl(totalValue)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {collection.isStore && (
                    <Button
                      variant="primary"
                      icon={<ShoppingBag size={18} />}
                      onClick={() => setShowProposalModal(true)}
                    >
                      Fazer uma proposta
                    </Button>
                  )}
                  <span className="inline-flex items-center gap-2 rounded-full border border-leaf/25 bg-leaf/10 px-3 py-1.5 text-xs font-black text-emerald-800">
                    <FolderOpen size={14} />
                    Publica
                  </span>
                </div>
              </div>
              {message && <p className="success-note mt-4">{message}</p>}
            </Panel>

            {myProposals.length > 0 && (
              <div className="rounded-[28px] border border-brand/20 bg-brand/5 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <ShoppingBag size={18} className="text-brand" />
                  <h3 className="font-black text-ink">Minhas Propostas nesta coleção</h3>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {myProposals.map((offer) => (
                    <div
                      key={offer.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/60 bg-white/50 p-4"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">
                          Enviada em {new Date(offer.createdAt).toLocaleDateString()}
                        </p>
                        <p className="font-black text-ink">Total: {formatBrl(offer.totalOffer)}</p>
                        <p className="text-[10px] font-bold text-slate-400 mt-1">
                          {offer.items.length} carta(s) selecionada(s)
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
                          offer.status === "accepted"
                            ? "bg-leaf text-white"
                            : offer.status === "rejected"
                              ? "bg-red-500 text-white"
                              : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {offer.status === "accepted"
                          ? "Aceita"
                          : offer.status === "rejected"
                            ? "Recusada"
                            : "Pendente"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Panel>
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[1.5fr_1fr_1fr_1fr_1.2fr] p-1">
                <label className="grid gap-2 md:col-span-2 lg:col-span-1 xl:col-span-1">
                  <span className="px-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Busca
                  </span>
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                      size={18}
                    />
                    <input
                      className="premium-input w-full pl-11"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Nome, número, coleção..."
                    />
                  </div>
                </label>
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
                  <span className="px-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Ordenação
                  </span>
                  <select
                    className="premium-select"
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
              </div>

              <div className="mt-6 rounded-2xl border border-lilac/25 bg-lilac/10 px-4 py-3 text-sm font-black text-violet-900">
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
                        {collection.isStore && item.folderItemId && !item.store?.isSold && (
                          <div className="mt-1 space-y-2">
                            <Button
                              type="button"
                              variant="primary"
                              className="h-9 w-full text-xs"
                              icon={<Gavel size={14} />}
                              onClick={() => setSelectedAuctionItem(item)}
                            >
                              {item.store?.highestBid ? "Ver lances" : "Dar lance"}
                            </Button>
                          </div>
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
                <div className="mt-5 rounded-[24px] border border-line/80 bg-white/70 p-5 text-sm font-bold text-slate-500 shadow-sm">
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

      {selectedAuctionItem && (
        <BidsModal
          item={selectedAuctionItem}
          onClose={() => setSelectedAuctionItem(null)}
          onBid={submitBid}
          isOwner={false}
          session={session}
        />
      )}

      {showProposalModal && collection && (
        <ProposalModal
          items={unsoldItems}
          onClose={() => setShowProposalModal(false)}
          onSubmit={submitProposal}
          session={session}
        />
      )}
    </main>
  );
}

function LoginWarning({ message }: { message: string }) {
  const currentUrl = encodeURIComponent(window.location.href);
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-bold text-amber-800">{message}</p>
        <Button
          type="button"
          variant="brand"
          className="h-9 text-xs"
          onClick={() => (window.location.href = `/?redirect=${currentUrl}`)}
        >
          Fazer Login
        </Button>
      </div>
    </div>
  );
}

function BidsModal({
  item,
  onClose,
  onBid,
  isOwner,
  session,
}: {
  item: CollectionItem;
  onClose: () => void;
  onBid?: (amount: number, quantity: number) => Promise<void>;
  isOwner?: boolean;
  session?: Session | null;
}) {
  const [amount, setAmount] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const bids = useMemo(() => {
    return item.store?.highestBid ? [item.store.highestBid] : [];
  }, [item.store?.highestBid]);

  async function submit() {
    if (!onBid || !amount) return;
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      await onBid(Number(amount), quantity);
      setAmount("");
      setSuccess("Lance enviado com sucesso!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar lance");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-night/55 px-4 py-6 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className="animate-soft-pop w-full max-w-md overflow-auto rounded-[26px] border border-white/80 bg-white shadow-card"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line/70 px-5 py-4">
          <div>
            <h2 className="text-xl font-black text-ink">Lances: {item.card.name}</h2>
            <p className="text-sm font-semibold text-slate-500">Acompanhe e participe do leilão.</p>
          </div>
          <button
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-white text-slate-700 transition hover:bg-field"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          <div className="grid gap-4">
            {!session && !isOwner && (
              <LoginWarning message="Você precisa estar logado para dar um lance." />
            )}

            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
              <p className="text-xs font-black uppercase tracking-widest text-amber-600">Lance Atual</p>
              <div className="mt-1 flex items-baseline justify-between">
                <p className="text-2xl font-black text-amber-900">
                  {item.store?.highestBid ? formatBrl(item.store.highestBid.amount) : "Nenhum lance"}
                </p>
                {item.store?.highestBid && (
                  <p className="text-xs font-bold text-amber-700">por {item.store.highestBid.quantity} carta(s)</p>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-black text-ink">Histórico de Lances</h3>
              {bids.length === 0 ? (
                <p className="py-4 text-center text-xs font-bold text-slate-400">Aguardando primeiro lance...</p>
              ) : (
                <div className="grid gap-2">
                  {bids.map((bid, index) => (
                    <div key={index} className="flex items-center justify-between rounded-xl bg-field p-3">
                      <div className="flex items-center gap-3">
                        <div className="grid h-8 w-8 place-items-center rounded-lg bg-white font-black text-ink shadow-sm text-xs">
                          {index + 1}
                        </div>
                        <span className="text-xs font-bold text-ink">Lance por {bid.quantity} carta(s)</span>
                      </div>
                      <span className="text-sm font-black text-ink">{formatBrl(bid.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && <p className="danger-note text-xs">{error}</p>}
            {success && <p className="success-note text-xs">{success}</p>}

            {!isOwner && onBid && session && (
              <div className="mt-2 grid gap-4 border-t border-line/50 pt-5">
                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-2">
                    <span className="px-1 text-xs font-black uppercase tracking-widest text-slate-500">Valor Unitário</span>
                    <input
                      className="premium-input"
                      type="number"
                      min={0}
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="Em R$"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="px-1 text-xs font-black uppercase tracking-widest text-slate-500">Quantidade</span>
                    <input
                      className="premium-input"
                      type="number"
                      min={1}
                      max={item.quantity}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.min(item.quantity, Math.max(1, Number(e.target.value))))}
                    />
                  </label>
                </div>
                <Button
                  type="button"
                  variant="primary"
                  className="w-full"
                  disabled={submitting || !amount}
                  onClick={submit}
                >
                  Enviar Lance
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProposalModal({
  items,
  onClose,
  onSubmit,
  session,
}: {
  items: CollectionItem[];
  onClose: () => void;
  onSubmit: (proposalItems: { folderItemId: string; amount: number; quantity: number }[], message: string) => Promise<void>;
  session?: Session | null;
}) {
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<Record<string, { item: CollectionItem; amount: string; quantity: number }>>({});
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    const normalized = normalizeText(query);
    return items.filter((item) => {
      const searchable = normalizeText(item.card.name);
      return searchable.includes(normalized);
    }).slice(0, 5);
  }, [items, query]);

  const cartList = Object.values(cart);
  const totalValue = cartList.reduce((sum, entry) => sum + (Number(entry.amount) || 0) * entry.quantity, 0);

  async function submit() {
    const proposalItems = cartList.map((entry) => ({
      folderItemId: entry.item.folderItemId!,
      amount: Number(entry.amount),
      quantity: entry.quantity,
    })).filter(i => i.amount > 0);

    if (proposalItems.length === 0) return;

    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(proposalItems, message);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar proposta");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-night/55 px-4 py-6 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className="animate-soft-pop flex h-full max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-[26px] border border-white/80 bg-white shadow-card"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line/70 px-6 py-5">
          <div>
            <h2 className="text-xl font-black text-ink">Fazer uma proposta</h2>
            <p className="text-sm font-semibold text-slate-500">Selecione as cartas e sugira um valor total.</p>
          </div>
          <button
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-white text-slate-700 transition hover:bg-field"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div className="grid gap-6">
            {!session && (
              <LoginWarning message="Você precisa estar logado para enviar uma proposta." />
            )}

            <div className="relative">
              <label className="grid gap-2">
                <span className="px-1 text-xs font-black uppercase tracking-widest text-slate-500">Adicionar carta</span>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    className="premium-input w-full pl-11"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Pesquise cartas nesta coleção..."
                  />
                </div>
              </label>

              {searchResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
                  {searchResults.map((item) => (
                    <button
                      key={item.id}
                      className="flex w-full items-center gap-3 p-3 text-left transition hover:bg-field"
                      onClick={() => {
                        setCart(prev => ({
                          ...prev,
                          [item.id]: {
                            item,
                            amount: String(item.store?.effectivePrice ?? item.price?.amount ?? 0),
                            quantity: 1
                          }
                        }));
                        setQuery("");
                      }}
                    >
                      <img src={item.card.imageSmall ?? undefined} className="h-10 w-7 rounded object-cover" alt="" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-ink">{item.card.name}</p>
                        <p className="text-[10px] font-bold text-slate-500">{item.card.rarity} • {item.card.setName}</p>
                      </div>
                      <Plus size={16} className="text-aqua" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-black text-ink">Cartas selecionadas ({cartList.length})</h3>
              <div className="mt-3 space-y-3">
                {cartList.length === 0 && (
                  <p className="py-8 text-center text-xs font-bold text-slate-400">Nenhuma carta selecionada ainda.</p>
                )}
                {cartList.map((entry) => (
                  <div key={entry.item.id} className="grid gap-3 rounded-2xl border border-line/60 bg-field/30 p-3">
                    <div className="flex items-center gap-4">
                      <img src={entry.item.card.imageSmall ?? undefined} className="h-12 w-8 rounded object-cover shadow-sm" alt="" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-ink">{entry.item.card.name}</p>
                        <p className="text-[10px] font-bold text-slate-500">Ref: {formatBrl(entry.item.store?.effectivePrice ?? entry.item.price?.amount ?? 0)}</p>
                      </div>
                      <button
                        onClick={() => setCart(prev => {
                          const next = { ...prev };
                          delete next[entry.item.id];
                          return next;
                        })}
                        className="text-slate-400 hover:text-red-500"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-[1fr_120px] gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-slate-400">Unitário</span>
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">R$</span>
                          <input
                            className="premium-input h-9 w-full pl-8 text-sm"
                            type="number"
                            value={entry.amount}
                            onChange={(e) => setCart(prev => ({
                              ...prev,
                              [entry.item.id]: { ...prev[entry.item.id], amount: e.target.value }
                            }))}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-slate-400">Qtd</span>
                        <input
                          className="premium-input h-9 w-full text-center text-sm"
                          type="number"
                          min={1}
                          max={entry.item.quantity}
                          value={entry.quantity}
                          onChange={(e) => setCart(prev => ({
                            ...prev,
                            [entry.item.id]: { ...prev[entry.item.id], quantity: Math.min(entry.item.quantity, Math.max(1, Number(e.target.value))) }
                          }))}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {error && <p className="danger-note text-xs">{error}</p>}

            <label className="grid gap-2">
              <span className="px-1 text-xs font-black uppercase tracking-widest text-slate-500">Sua mensagem</span>
              <textarea
                className="premium-input min-h-[100px] py-3"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Explique sua proposta ou adicione detalhes para o vendedor..."
              />
            </label>
          </div>
        </div>

        <div className="border-t border-line/70 bg-field/30 p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-black text-slate-500 uppercase tracking-widest">Valor Total</span>
            <span className="text-2xl font-black text-ink">{formatBrl(totalValue)}</span>
          </div>
          <Button
            type="button"
            variant="primary"
            className="w-full h-12 text-base"
            disabled={submitting || cartList.length === 0 || !session}
            onClick={submit}
          >
            {session ? "Enviar Proposta" : "Login necessário"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  emptyLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  emptyLabel: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="px-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </span>
      <select
        className="premium-select"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{emptyLabel}</option>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
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
      (left, right) => (right.price?.amount ?? 0) - (left.price?.amount ?? 0),
    );
  if (sort === "value-asc")
    return [...items].sort(
      (left, right) => (left.price?.amount ?? 0) - (right.price?.amount ?? 0),
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
  const history = item.price?.history ?? [];
  const latest = history[history.length - 1];
  return latest ? latest.amount - latest.previousAmount : 0;
}
