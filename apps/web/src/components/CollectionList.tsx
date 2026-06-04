import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Coins, Layers3, RefreshCw, Search } from "lucide-react";
import {
  formatCardNumber,
  normalizeSearchText,
  type CollectionItem,
  type CollectionFolderSort
} from "@poke-organizer/shared";
import { api, type Session } from "../lib/api";
import { withAuthRetry } from "../lib/authRetry";
import { formatBrl } from "../lib/format";
import { CardDetailModal, type UpdateCardDetails } from "./CardDetailModal";
import { Button } from "./ui/Button";
import { Panel } from "./ui/Panel";
import { StatCard } from "./ui/StatCard";
import { CollectionItemCard } from "./collection/CollectionItemCard";
import { PaginationControls } from "./ui/PaginationControls";

type Props = {
  session: Session;
  onSession: (session: Session) => void;
  onUnauthorized: () => Promise<Session | null>;
  refreshKey: number;
  limit?: number;
  title?: string;
  description?: string;
  modalItemId?: string | null;
  onModalItemChange?: (itemId: string | null) => void;
  showCounts?: boolean;
};

const INVENTORY_PAGE_SIZE = 24;

export function CollectionList({
  session,
  onSession,
  onUnauthorized,
  refreshKey,
  limit,
  title = "Minha colecao",
  description = "Inventario das cartas que voce possui.",
  modalItemId,
  onModalItemChange,
  showCounts = true
}: Props) {
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<CollectionItem | null>(null);
  const [typeFilter, setTypeFilter] = useState("");
  const [rarityFilter, setRarityFilter] = useState("");
  const [variantFilter, setVariantFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sort, setSort] = useState<CollectionFolderSort>("newest");
  const [page, setPage] = useState(1);

  const showFilters = !limit;
  const typeOptions = useMemo(() => unique(items.flatMap((item) => item.card.types)), [items]);
  const rarityOptions = useMemo(() => unique(items.map((item) => item.card.rarity).filter(Boolean) as string[]), [items]);
  const variantOptions = useMemo(() => unique(items.map((item) => item.variant)), [items]);
  const visibleItems = useMemo(() => {
    const filtered = items.filter((item) => {
      if (!matchesInventorySearch(item, searchTerm)) return false;
      if (typeFilter && !item.card.types.includes(typeFilter)) return false;
      if (rarityFilter && item.card.rarity !== rarityFilter) return false;
      if (variantFilter && item.variant !== variantFilter) return false;
      return true;
    });

    return sortItems(filtered, sort);
  }, [items, rarityFilter, searchTerm, sort, typeFilter, variantFilter]);
  const totalCards = useMemo(() => visibleItems.reduce((sum, item) => sum + item.quantity, 0), [visibleItems]);
  const totalValue = useMemo(
    () =>
      visibleItems.reduce((sum, item) => {
        const price = item.price?.amount ?? 0;
        return sum + price * item.quantity;
      }, 0),
    [visibleItems]
  );
  const displayedCount = limit ? visibleItems.length : totalCards;
  const pageSize = limit ?? INVENTORY_PAGE_SIZE;
  const paginatedItems = useMemo(
    () => (limit ? visibleItems : visibleItems.slice((page - 1) * pageSize, page * pageSize)),
    [limit, page, pageSize, visibleItems]
  );

  async function load() {
    setLoading(true);
    try {
      const nextItems = await withAuthRetry(session, onSession, onUnauthorized, (token) => api.listCollection(token, { limit }));
      setItems(nextItems);
    } finally {
      setLoading(false);
    }
  }

  async function remove(item: CollectionItem) {
    await withAuthRetry(session, onSession, onUnauthorized, (token) => api.deleteCollection(token, item.id));
    setItems((current) => current.filter((entry) => entry.id !== item.id));
  }

  async function updateItemDetails(itemId: string, details: UpdateCardDetails) {
    const updated = await withAuthRetry(session, onSession, onUnauthorized, (token) =>
      api.updateCollection(token, itemId, details)
    );
    setItems((current) => current.map((entry) => (entry.id === itemId ? updated : entry)));
    setSelectedItem(updated);
  }

  function openItem(item: CollectionItem) {
    setSelectedItem(item);
    onModalItemChange?.(item.id);
  }

  function closeItem() {
    setSelectedItem(null);
    onModalItemChange?.(null);
  }

  useEffect(() => {
    void load();
  }, [refreshKey]);

  useEffect(() => {
    if (!modalItemId) return;
    const item = items.find((entry) => entry.id === modalItemId);
    if (item) {
      setSelectedItem(item);
    }
  }, [items, modalItemId]);

  useEffect(() => {
    setPage(1);
  }, [rarityFilter, searchTerm, sort, typeFilter, variantFilter]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(visibleItems.length / pageSize));
    setPage((current) => Math.min(current, totalPages));
  }, [pageSize, visibleItems.length]);

  return (
    <Panel>
      <div className="mb-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
        <div>
          <h2 className="section-title">{title}</h2>
          <p className="section-copy mt-1">{description}</p>
          {
            showCounts && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <StatCard label={limit ? "Itens exibidos" : "Cartas totais"} value={String(displayedCount)} tone="aqua" icon={<Layers3 size={18} />} />
                <StatCard label={limit ? "Valor exibido" : "Valor total"} value={formatBrl(totalValue)} tone="leaf" icon={<Coins size={18} />} />
              </div>
            )
          }
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <Button
            type="button"
            onClick={() => void load()}
            icon={<RefreshCw size={16} />}
          >
            Recarregar
          </Button>
        </div>
      </div>

      {showFilters && items.length > 0 && (
        <div className="mb-5 grid gap-3 rounded-[24px] border border-line/70 bg-field/45 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <FilterField label="Busca">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
              <input
                className="premium-input w-full pl-11"
                value={searchTerm}
                placeholder="Nome ou numero"
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
          </FilterField>
          <FilterField label="Tipo">
            <select className="premium-select" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="">Todos os tipos</option>
              {typeOptions.map((value) => <option key={value}>{value}</option>)}
            </select>
          </FilterField>
          <FilterField label="Raridade">
            <select className="premium-select" value={rarityFilter} onChange={(event) => setRarityFilter(event.target.value)}>
              <option value="">Todas as raridades</option>
              {rarityOptions.map((value) => <option key={value}>{value}</option>)}
            </select>
          </FilterField>
          <FilterField label="Variante">
            <select className="premium-select" value={variantFilter} onChange={(event) => setVariantFilter(event.target.value)}>
              <option value="">Todas as variantes</option>
              {variantOptions.map((value) => <option key={value}>{value}</option>)}
            </select>
          </FilterField>
          <FilterField label="Ordenacao">
            <select className="premium-select" value={sort} onChange={(event) => setSort(event.target.value as CollectionFolderSort)}>
              <option value="newest">Ultima adicionada</option>
              <option value="oldest">Mais antiga</option>
              <option value="value-desc">Maior valor</option>
              <option value="value-asc">Menor valor</option>
            </select>
          </FilterField>
        </div>
      )}

      {loading ? (
        <p className="rounded-2xl border border-line/80 bg-white/60 p-4 text-sm font-semibold text-slate-600">Carregando colecao</p>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-line/80 bg-white/60 p-4 text-sm font-semibold text-slate-600">Nenhuma carta cadastrada.</p>
      ) : visibleItems.length === 0 ? (
        <p className="rounded-2xl border border-line/80 bg-white/60 p-4 text-sm font-semibold text-slate-600">Nenhuma carta aparece com a busca ou filtros atuais.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {paginatedItems.map((item) => {
              return (
                <CollectionItemCard
                  key={item.id}
                  item={item}
                  price={item.price ?? undefined}
                  onOpen={openItem}
                  onRemove={(nextItem) => void remove(nextItem)}
                />
              );
            })}
          </div>
          {!limit && (
            <PaginationControls
              page={page}
              pageSize={pageSize}
              totalItems={visibleItems.length}
              onPageChange={setPage}
              itemLabel="cartas"
            />
          )}
        </>
      )}

      <CardDetailModal
        card={selectedItem?.card ?? null}
        collectionItem={selectedItem}
        collectionPrice={selectedItem?.price ?? null}
        onClose={closeItem}
        onUpdate={updateItemDetails}
      />
    </Panel>
  );
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function sortItems(items: CollectionItem[], sort: CollectionFolderSort): CollectionItem[] {
  if (sort === "value-desc") return [...items].sort((left, right) => (right.price?.amount ?? 0) - (left.price?.amount ?? 0));
  if (sort === "value-asc") return [...items].sort((left, right) => (left.price?.amount ?? 0) - (right.price?.amount ?? 0));
  if (sort === "oldest") return [...items].sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
  return [...items].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

function matchesInventorySearch(item: CollectionItem, term: string): boolean {
  const normalizedTerm = normalizeSearchText(term);
  if (!normalizedTerm) return true;

  const cardNumber = formatCardNumber(item.card.number, item.card.printedTotal);
  const numericCardNumber = Number.parseInt(item.card.number, 10);
  const normalizedNumericCardNumber = Number.isFinite(numericCardNumber) && item.card.printedTotal
    ? `${numericCardNumber}/${item.card.printedTotal}`
    : "";
  const searchableText = normalizeSearchText(
    [
      item.card.name,
      item.card.number,
      cardNumber,
      normalizedNumericCardNumber,
      item.card.setName ?? "",
      item.card.setCode ?? ""
    ].join(" ")
  );
  const compactSearchableText = searchableText.replace(/\s+/g, "");
  const compactTerm = normalizedTerm.replace(/\s+/g, "");
  const compactTermWithoutLeadingZeros = compactTerm.replace(/^0+(?=\d)/, "");

  return (
    searchableText.includes(normalizedTerm) ||
    compactSearchableText.includes(compactTerm) ||
    compactSearchableText.includes(compactTermWithoutLeadingZeros)
  );
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="px-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}
