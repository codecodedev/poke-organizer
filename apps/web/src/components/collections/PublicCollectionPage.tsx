import { useEffect, useMemo, useState } from "react";
import { FolderOpen, Lock, Search } from "lucide-react";
import type { CollectionFolderSort, CollectionItem, PublicCollectionDetail } from "@poke-organizer/shared";
import { api } from "../../lib/api";
import { formatBrl } from "../../lib/format";
import { CollectionItemCard } from "../collection/CollectionItemCard";
import { CardDetailModal } from "../CardDetailModal";
import { PaginationControls } from "../ui/PaginationControls";
import { Panel } from "../ui/Panel";

const PUBLIC_COLLECTION_PAGE_SIZE = 24;

type Props = {
  shareToken: string;
};

export function PublicCollectionPage({ shareToken }: Props) {
  const [collection, setCollection] = useState<PublicCollectionDetail | null>(null);
  const [selectedItem, setSelectedItem] = useState<CollectionItem | null>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [rarityFilter, setRarityFilter] = useState("");
  const [variantFilter, setVariantFilter] = useState("");
  const [sort, setSort] = useState<CollectionFolderSort>("newest");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  const typeOptions = useMemo(() => unique(items.flatMap((item) => item.card.types)), [items]);
  const rarityOptions = useMemo(() => unique(items.map((item) => item.card.rarity).filter(Boolean) as string[]), [items]);
  const variantOptions = useMemo(() => unique(items.map((item) => item.variant)), [items]);
  const visibleItems = useMemo(() => {
    const normalizedQuery = normalizeText(query);
    const filtered = items.filter((item) => {
      if (typeFilter && !item.card.types.includes(typeFilter)) return false;
      if (rarityFilter && item.card.rarity !== rarityFilter) return false;
      if (variantFilter && item.variant !== variantFilter) return false;
      if (!normalizedQuery) return true;

      const searchable = normalizeText([
        item.card.name,
        item.card.number,
        item.card.printedTotal,
        item.card.setName,
        item.variant,
        item.condition,
        item.language
      ].join(" "));

      return searchable.includes(normalizedQuery);
    });

    return sortItems(filtered, sort);
  }, [items, query, rarityFilter, sort, typeFilter, variantFilter]);

  useEffect(() => {
    setPage(1);
  }, [query, rarityFilter, sort, typeFilter, variantFilter]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(visibleItems.length / PUBLIC_COLLECTION_PAGE_SIZE));
    setPage((current) => Math.min(current, totalPages));
  }, [visibleItems.length]);

  const totalValue = items.reduce((sum, item) => sum + (item.price?.amount ?? 0) * item.quantity, 0);
  const paginatedItems = visibleItems.slice((page - 1) * PUBLIC_COLLECTION_PAGE_SIZE, page * PUBLIC_COLLECTION_PAGE_SIZE);

  return (
    <main className="app-shell">
      <header className="border-b border-white/70 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-5 py-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand via-coral to-amber font-black text-white shadow-glow">
            CC
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-black text-ink">Coleciona cards</h1>
            <p className="truncate text-sm font-medium text-slate-600">Colecao compartilhada</p>
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
                <p className="section-copy mt-1">Este link nao esta publico ou nao existe mais.</p>
              </div>
            </div>
          </Panel>
        )}

        {!loading && collection && (
          <>
            <Panel>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Visualizacao publica</p>
                  <h2 className="section-title truncate">{collection.name}</h2>
                  <p className="section-copy mt-1">
                    {items.length} cartas - {formatBrl(totalValue)}
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full border border-leaf/25 bg-leaf/10 px-3 py-1.5 text-xs font-black text-emerald-800">
                  <FolderOpen size={14} />
                  Publica
                </span>
              </div>
            </Panel>

            <Panel>
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_repeat(4,minmax(160px,220px))]">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    className="premium-input w-full pl-11"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar por nome, numero, colecao..."
                  />
                </label>
                <FilterSelect label="Tipo" value={typeFilter} onChange={setTypeFilter} options={typeOptions} emptyLabel="Todos" />
                <FilterSelect label="Raridade" value={rarityFilter} onChange={setRarityFilter} options={rarityOptions} emptyLabel="Todas" />
                <FilterSelect label="Variante" value={variantFilter} onChange={setVariantFilter} options={variantOptions} emptyLabel="Todas" />
                <label className="grid gap-2">
                  <span className="px-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">Ordenacao</span>
                  <select className="premium-select" value={sort} onChange={(event) => setSort(event.target.value as CollectionFolderSort)}>
                    <option value="newest">Ultima adicionada</option>
                    <option value="oldest">Mais antiga</option>
                    <option value="value-desc">Maior valor</option>
                    <option value="value-asc">Menor valor</option>
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
                      <CollectionItemCard
                        key={item.id}
                        item={item}
                        price={item.price ?? undefined}
                        onOpen={setSelectedItem}
                      />
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
  emptyLabel
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  emptyLabel: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="px-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <select className="premium-select" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{emptyLabel}</option>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function sortItems(items: CollectionItem[], sort: CollectionFolderSort): CollectionItem[] {
  if (sort === "value-desc") return [...items].sort((left, right) => (right.price?.amount ?? 0) - (left.price?.amount ?? 0));
  if (sort === "value-asc") return [...items].sort((left, right) => (left.price?.amount ?? 0) - (right.price?.amount ?? 0));
  if (sort === "oldest") return [...items].sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
  return [...items].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}
