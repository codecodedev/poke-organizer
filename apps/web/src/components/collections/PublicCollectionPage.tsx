import { useEffect, useMemo, useState } from "react";
import { FolderOpen, Lock, Search } from "lucide-react";
import type {
  CollectionFolderSort,
  CollectionItem,
  PublicCollectionDetail,
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
  const [typeFilter, setTypeFilter] = useState("");
  const [rarityFilter, setRarityFilter] = useState("");
  const [variantFilter, setVariantFilter] = useState("");
  const [sort, setSort] = useState<CollectionFolderSort>("newest");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [bidAmounts, setBidAmounts] = useState<Record<string, string>>({});
  const [cartAmounts, setCartAmounts] = useState<Record<string, string>>({});
  const [cartMessage, setCartMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const detail = await api.getPublicCollection(shareToken);
        if (!cancelled) {
          setCollection(detail);
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
  }, [shareToken]);

  const items = collection?.items ?? [];
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
  }, [items, query, rarityFilter, sort, typeFilter, variantFilter]);

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

  async function submitBid(item: CollectionItem) {
    if (!item.folderItemId) return;
    if (!session) {
      setMessage("Faca login no site para dar lances nesta colecao.");
      return;
    }
    const amount = Number(bidAmounts[item.folderItemId]);
    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage("Informe um valor de lance maior que zero.");
      return;
    }
    const detail = await withAuthRetry(session, onSession, onUnauthorized, (token) =>
      api.createPublicCollectionBid(token, shareToken, item.folderItemId!, amount),
    );
    setCollection(detail);
    setBidAmounts((current) => ({ ...current, [item.folderItemId!]: "" }));
    setMessage("Lance enviado.");
  }

  async function submitCartOffer() {
    if (!session) {
      setMessage("Faca login no site para enviar uma proposta de carrinho.");
      return;
    }
    const offerItems = Object.entries(cartAmounts)
      .map(([folderItemId, amount]) => ({ folderItemId, amount: Number(amount), quantity: 1 }))
      .filter((item) => Number.isFinite(item.amount) && item.amount > 0);
    if (!offerItems.length) {
      setMessage("Adicione pelo menos uma carta com valor de proposta.");
      return;
    }
    await withAuthRetry(session, onSession, onUnauthorized, (token) =>
      api.createPublicCollectionOffer(token, shareToken, { items: offerItems, message: cartMessage || undefined }),
    );
    setCartAmounts({});
    setCartMessage("");
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
                    Por {collection.ownerName} - {items.length} cartas -{" "}
                    {formatBrl(totalValue)}
                  </p>
                  {collection.isStore && (
                    <p className="section-copy mt-1">
                      Loja ativa: envie lances por carta ou monte uma proposta de carrinho.
                    </p>
                  )}
                </div>
                <span className="inline-flex items-center gap-2 rounded-full border border-leaf/25 bg-leaf/10 px-3 py-1.5 text-xs font-black text-emerald-800">
                  <FolderOpen size={14} />
                  Publica
                </span>
              </div>
            </Panel>

            {collection.isStore && (
              <Panel title="Negociacao" description="Os lances e propostas ficam pendentes ate o dono da colecao aprovar.">
                {!session && (
                  <p className="warning-note">
                    Para dar lance ou enviar proposta, faca login no site e volte para este link.
                  </p>
                )}
                {message && <p className="success-note">{message}</p>}
                <div className="mt-4 grid gap-3 rounded-[24px] border border-line/70 bg-field/45 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                  <label className="grid gap-2">
                    <span className="px-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                      Mensagem da proposta
                    </span>
                    <input
                      className="premium-input"
                      value={cartMessage}
                      onChange={(event) => setCartMessage(event.target.value)}
                      placeholder="Ex: consigo pagar hoje pelo pix"
                    />
                  </label>
                  <Button type="button" variant="primary" onClick={() => void submitCartOffer()}>
                    Enviar proposta
                  </Button>
                </div>
              </Panel>
            )}

            <Panel>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(360px,1.45fr)_repeat(4,minmax(150px,1fr))]">
                <label className="grid gap-2 md:col-span-2 xl:col-span-1">
                  <span className="px-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Busca
                  </span>
                  <span className="relative block">
                    <Search
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                      size={18}
                    />
                    <input
                      className="premium-input w-full pl-11"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Buscar por nome, numero, colecao..."
                    />
                  </span>
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
                    Ordenacao
                  </span>
                  <select
                    className="premium-select"
                    value={sort}
                    onChange={(event) =>
                      setSort(event.target.value as CollectionFolderSort)
                    }
                  >
                    <option value="newest">Ultima adicionada</option>
                    <option value="oldest">Mais antiga</option>
                    <option value="value-desc">Maior valor</option>
                    <option value="value-asc">Menor valor</option>
                    <option value="price-change-desc">Maior alta</option>
                    <option value="price-change-asc">Maior queda</option>
                  </select>
                </label>
              </div>

              <div className="mt-5 rounded-2xl border border-lilac/25 bg-lilac/10 px-4 py-3 text-sm font-black text-violet-900">
                {visibleItems.length} de {items.length} cartas visiveis
              </div>

              {visibleItems.length ? (
                <>
                  <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                    {paginatedItems.map((item) => (
                      <div key={item.id} className="grid gap-2">
                        <CollectionItemCard
                          item={item}
                          price={item.price ?? undefined}
                          onOpen={setSelectedItem}
                        />
                        {collection.isStore && item.folderItemId && (
                          <div className="rounded-2xl border border-line/70 bg-field/55 p-3">
                            <p className="text-sm font-black text-ink">
                              {item.store?.isSold
                                ? `Vendida por ${formatBrl(item.store.soldPrice ?? 0)}`
                                : `Preco: ${formatBrl(item.store?.effectivePrice ?? item.price?.amount ?? 0)}`}
                            </p>
                            <p className="section-copy text-xs">
                              Maior lance: {item.store?.highestBid ? formatBrl(item.store.highestBid.amount) : "nenhum"}
                            </p>
                            {!item.store?.isSold && (
                              <div className="mt-2 grid gap-2">
                                <input
                                  className="premium-input"
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={bidAmounts[item.folderItemId] ?? ""}
                                  placeholder="Seu lance"
                                  onChange={(event) =>
                                    setBidAmounts((current) => ({ ...current, [item.folderItemId!]: event.target.value }))
                                  }
                                />
                                <Button type="button" onClick={() => void submitBid(item)}>Dar lance</Button>
                                <input
                                  className="premium-input"
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={cartAmounts[item.folderItemId] ?? ""}
                                  placeholder="Valor no carrinho"
                                  onChange={(event) =>
                                    setCartAmounts((current) => ({ ...current, [item.folderItemId!]: event.target.value }))
                                  }
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
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
    </main>
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
