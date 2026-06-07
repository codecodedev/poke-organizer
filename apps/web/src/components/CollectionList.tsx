import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  Coins,
  Download,
  Filter,
  Layers3,
  RefreshCw,
  Search,
  Settings,
  Trash2,
  Upload,
} from "lucide-react";
import {
  formatCardNumber,
  normalizeSearchText,
  type CollectionItem,
  type CollectionFolderSort,
} from "@poke-organizer/shared";
import { api, type Session } from "../lib/api";
import { withAuthRetry } from "../lib/authRetry";
import { formatBrl } from "../lib/format";
import { CardDetailModal, type UpdateCardDetails } from "./CardDetailModal";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";
import { Panel } from "./ui/Panel";
import { StatCard } from "./ui/StatCard";
import { CollectionItemCard } from "./collection/CollectionItemCard";
import { PaginationControls } from "./ui/PaginationControls";

import { FilterField, FilterGroup } from "./ui/Filters";

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
const COLLECTION_BACKUP_HEADERS = [
  "externalId",
  "cardName",
  "cardNumber",
  "printedTotal",
  "setId",
  "setCode",
  "setName",
  "quantity",
  "condition",
  "variant",
  "foil",
  "language",
  "notes",
] as const;

type CollectionBackupRow = {
  externalId: string;
  cardName: string;
  cardNumber: string;
  printedTotal: string;
  setId: string;
  setCode: string;
  setName: string;
  quantity: number;
  condition: string;
  variant: string;
  foil: boolean;
  language: string;
  notes: string;
};

type ImportMode = "ignore" | "increment" | "replace";

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
  showCounts = true,
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
  const [backupRows, setBackupRows] = useState<CollectionBackupRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearPassword, setClearPassword] = useState("");
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const settingsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const showFilters = !limit;
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
    const filtered = items.filter((item) => {
      if (!matchesInventorySearch(item, searchTerm)) return false;
      if (typeFilter && !item.card.types.includes(typeFilter)) return false;
      if (rarityFilter && item.card.rarity !== rarityFilter) return false;
      if (variantFilter && item.variant !== variantFilter) return false;
      return true;
    });

    return sortItems(filtered, sort);
  }, [items, rarityFilter, searchTerm, sort, typeFilter, variantFilter]);
  const totalCards = useMemo(
    () => visibleItems.reduce((sum, item) => sum + item.quantity, 0),
    [visibleItems],
  );
  const uniqueCards = useMemo(
    () => new Set(visibleItems.map((item) => item.card.id)).size,
    [visibleItems],
  );
  const totalValue = useMemo(
    () =>
      visibleItems.reduce((sum, item) => {
        const price = item.price?.amount ?? 0;
        return sum + price * item.quantity;
      }, 0),
    [visibleItems],
  );
  const displayedCount = limit ? visibleItems.length : totalCards;
  const pageSize = limit ?? INVENTORY_PAGE_SIZE;
  const paginatedItems = useMemo(
    () =>
      limit
        ? visibleItems
        : visibleItems.slice((page - 1) * pageSize, page * pageSize),
    [limit, page, pageSize, visibleItems],
  );

  async function load() {
    setLoading(true);
    try {
      const nextItems = await withAuthRetry(
        session,
        onSession,
        onUnauthorized,
        (token) => api.listCollection(token, { limit }),
      );
      setItems(nextItems);
    } finally {
      setLoading(false);
    }
  }

  async function clearCollection() {
    if (!clearPassword) return;
    setClearing(true);
    try {
      await withAuthRetry(session, onSession, onUnauthorized, (token) =>
        api.clearCollection(token, { password: clearPassword }),
      );
      setItems([]);
      setIsClearModalOpen(false);
      setClearPassword("");
    } catch (err) {
      // API feedback will show the error
    } finally {
      setClearing(false);
    }
  }

  async function remove(item: CollectionItem) {
    await withAuthRetry(session, onSession, onUnauthorized, (token) =>
      api.deleteCollection(token, item.id),
    );
    setItems((current) => current.filter((entry) => entry.id !== item.id));
  }

  async function updateItemDetails(itemId: string, details: UpdateCardDetails) {
    const updated = await withAuthRetry(
      session,
      onSession,
      onUnauthorized,
      (token) => api.updateCollection(token, itemId, details),
    );
    setItems((current) =>
      current.map((entry) => (entry.id === itemId ? updated : entry)),
    );
    setSelectedItem(updated);
  }

  function exportCsv() {
    const csv = toCsv([
      [...COLLECTION_BACKUP_HEADERS],
      ...items.map((item) => [
        item.card.externalId,
        item.card.name,
        item.card.number,
        item.card.printedTotal ?? "",
        item.card.setId ?? "",
        item.card.setCode ?? "",
        item.card.setName ?? "",
        item.quantity,
        item.condition,
        item.variant,
        item.foil ? "true" : "false",
        item.language,
        item.notes ?? "",
      ]),
    ]);
    downloadTextFile(
      `poke-organizer-cartas-${new Date().toISOString().slice(0, 10)}.csv`,
      csv,
      "text/csv;charset=utf-8",
    );
  }

  async function handleBackupFile(file: File | null) {
    if (!file) return;

    const text = await file.text();
    const rows = parseCollectionBackupCsv(text);
    setBackupRows(rows);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function importBackup(mode: ImportMode) {
    if (!backupRows.length) return;

    setImporting(true);
    try {
      await withAuthRetry(session, onSession, onUnauthorized, async (token) => {
        if (mode === "replace") {
          await Promise.all(items.map((item) => api.deleteCollection(token, item.id)));
        }

        const existing = new Set(
          (mode === "replace" ? [] : items).map(collectionIdentityKey),
        );

        for (const row of backupRows) {
          const key = backupRowIdentityKey(row);
          if (mode === "ignore" && existing.has(key)) {
            continue;
          }

          await api.addCollection(token, {
            cardId: row.externalId,
            quantity: mode === "increment" && existing.has(key) ? 1 : row.quantity,
            condition: row.condition,
            variant: row.variant,
            foil: row.foil,
            language: row.language,
            notes: row.notes || undefined,
          });
          existing.add(key);
        }
      });
      setBackupRows([]);
      await load();
    } finally {
      setImporting(false);
    }
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
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="section-title">{title}</h2>
          <p className="section-copy mt-1">{description}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => void load()}
            title="Recarregar"
            className="h-10 w-10 p-0 flex items-center justify-center rounded-xl"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </Button>

          {!limit && (
            <div className="relative" ref={settingsRef}>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowSettings(!showSettings)}
                title="Configurações da coleção"
                className="h-10 w-10 p-0 flex items-center justify-center rounded-xl"
              >
                <Settings size={18} />
              </Button>

              {showSettings && (
                <div className="absolute right-0 top-full z-40 mt-2 w-48 animate-soft-pop overflow-hidden rounded-2xl border border-line bg-white shadow-card backdrop-blur-md">
                  <button
                    type="button"
                    onClick={() => {
                      exportCsv();
                      setShowSettings(false);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold text-slate-700 hover:bg-field/50"
                  >
                    <Download size={16} />
                    Baixar CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      fileInputRef.current?.click();
                      setShowSettings(false);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold text-slate-700 hover:bg-field/50"
                  >
                    <Upload size={16} />
                    Restaurar CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsClearModalOpen(true);
                      setShowSettings(false);
                    }}
                    className="flex w-full items-center gap-3 border-t border-line/40 px-4 py-3 text-left text-sm font-bold text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={16} />
                    Apagar tudo
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(event) => void handleBackupFile(event.target.files?.[0] ?? null)}
      />

      {showCounts && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            label={limit ? "Itens exibidos" : "Cartas totais"}
            value={String(displayedCount)}
            tone="aqua"
            icon={<Layers3 size={18} />}
          />
          <StatCard
            label="Cartas unicas"
            value={String(uniqueCards)}
            tone="lilac"
            icon={<Layers3 size={18} />}
          />
          <StatCard
            label={limit ? "Valor exibido" : "Valor total"}
            value={formatBrl(totalValue)}
            tone="leaf"
            icon={<Coins size={18} />}
          />
        </div>
      )}

      {showFilters && items.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              size={17}
            />
            <input
              className="premium-input w-full pl-11"
              value={searchTerm}
              placeholder="Busca rapida por nome ou numero..."
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setShowFiltersModal(true)}
            icon={<Filter size={18} />}
            className={(typeFilter || rarityFilter || variantFilter) ? "border-brand/40 bg-brand/5 text-brand" : ""}
          >
            Filtros e Ordenação
          </Button>
        </div>
      )}

      {showFiltersModal && (
        <Modal title="Filtros e Ordenação" onClose={() => setShowFiltersModal(false)} maxWidthClass="max-w-xl">
          <div className="grid gap-5 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <FilterField label="Tipo">
                <select
                  className="premium-select w-full"
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value)}
                >
                  <option value="">Todos os tipos</option>
                  {typeOptions.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </FilterField>
              <FilterField label="Raridade">
                <select
                  className="premium-select w-full"
                  value={rarityFilter}
                  onChange={(event) => setRarityFilter(event.target.value)}
                >
                  <option value="">Todas as raridades</option>
                  {rarityOptions.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </FilterField>
              <FilterField label="Variante">
                <select
                  className="premium-select w-full"
                  value={variantFilter}
                  onChange={(event) => setVariantFilter(event.target.value)}
                >
                  <option value="">Todas as variantes</option>
                  {variantOptions.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </FilterField>
              <FilterField label="Ordenação">
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
              </FilterField>
            </div>
            
            <div className="flex gap-3 pt-2">
              <Button 
                type="button" 
                className="flex-1"
                variant="ghost"
                onClick={() => {
                  setTypeFilter("");
                  setRarityFilter("");
                  setVariantFilter("");
                  setSort("newest");
                }}
              >
                Limpar filtros
              </Button>
              <Button 
                type="button" 
                variant="brand" 
                className="flex-1"
                onClick={() => setShowFiltersModal(false)}
              >
                Aplicar filtros
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {loading ? (
        <p className="rounded-2xl border border-line/80 bg-white/60 p-4 text-sm font-semibold text-slate-600">
          Carregando colecao
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-line/80 bg-white/60 p-4 text-sm font-semibold text-slate-600">
          Nenhuma carta cadastrada.
        </p>
      ) : visibleItems.length === 0 ? (
        <p className="rounded-2xl border border-line/80 bg-white/60 p-4 text-sm font-semibold text-slate-600">
          Nenhuma carta aparece com a busca ou filtros atuais.
        </p>
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

      {backupRows.length > 0 && (
        <Modal title="Restaurar backup de cartas" onClose={() => setBackupRows([])}>
          <div className="grid gap-4 p-5">
            <p className="section-copy">
              O arquivo tem {backupRows.length} cartas. Escolha como tratar cartas que ja existem no seu inventario.
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              <ImportChoice
                title="Ignorar iguais"
                description="Mantem as cartas atuais e importa somente as que ainda nao existem."
                disabled={importing}
                onClick={() => void importBackup("ignore")}
              />
              <ImportChoice
                title="Somar 1"
                description="Quando uma carta igual existir, adiciona 1 na quantidade dela."
                disabled={importing}
                onClick={() => void importBackup("increment")}
              />
              <ImportChoice
                title="Substituir tudo"
                description="Remove seu inventario atual e recria as cartas usando este backup."
                disabled={importing}
                danger
                onClick={() => void importBackup("replace")}
              />
            </div>
            {importing && <p className="section-copy">Restaurando backup...</p>}
          </div>
        </Modal>
      )}
      {isClearModalOpen && (
        <Modal
          title="Apagar todas as cartas"
          subtitle="Essa acao e irreversivel e removera permanentemente todas as cartas da sua colecao."
          onClose={() => setIsClearModalOpen(false)}
          maxWidthClass="max-w-md"
        >
          <div className="grid gap-4 p-5">
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
              Atenção: todas as cartas serão deletadas de forma definitiva.
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-slate-700">Confirme sua senha</label>
              <input
                type="password"
                className="premium-input w-full"
                placeholder="Sua senha da conta"
                value={clearPassword}
                onChange={(e) => setClearPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !clearing && clearPassword) {
                    void clearCollection();
                  }
                }}
              />
            </div>
            <div className="flex gap-3">
              <Button
                type="button"
                className="flex-1"
                onClick={() => setIsClearModalOpen(false)}
                disabled={clearing}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="brand"
                className="flex-1 bg-red-600 !from-red-600 !to-red-500"
                onClick={() => void clearCollection()}
                disabled={clearing || !clearPassword}
              >
                {clearing ? "Apagando..." : "Confirmar e apagar"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </Panel>
  );
}

function ImportChoice({
  title,
  description,
  disabled,
  danger,
  onClick,
}: {
  title: string;
  description: string;
  disabled: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-[22px] border p-4 text-left shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 ${
        danger
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-line/80 bg-white/80 text-ink hover:border-brand/35"
      }`}
    >
      <span className="block text-base font-black">{title}</span>
      <span className="mt-2 block text-sm font-semibold leading-6 text-slate-600">
        {description}
      </span>
    </button>
  );
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) =>
    left.localeCompare(right),
  );
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

function matchesInventorySearch(item: CollectionItem, term: string): boolean {
  const normalizedTerm = normalizeSearchText(term);
  if (!normalizedTerm) return true;

  const cardNumber = formatCardNumber(item.card.number, item.card.printedTotal);
  const numericCardNumber = Number.parseInt(item.card.number, 10);
  const normalizedNumericCardNumber =
    Number.isFinite(numericCardNumber) && item.card.printedTotal
      ? `${numericCardNumber}/${item.card.printedTotal}`
      : "";
  const searchableText = normalizeSearchText(
    [
      item.card.name,
      item.card.number,
      cardNumber,
      normalizedNumericCardNumber,
      item.card.setName ?? "",
      item.card.setCode ?? "",
    ].join(" "),
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

function collectionIdentityKey(item: CollectionItem): string {
  return [
    item.card.externalId,
    item.condition,
    item.variant,
    item.foil ? "true" : "false",
    item.language,
  ].join("|");
}

function backupRowIdentityKey(row: CollectionBackupRow): string {
  return [
    row.externalId,
    row.condition,
    row.variant,
    row.foil ? "true" : "false",
    row.language,
  ].join("|");
}

function parseCollectionBackupCsv(text: string): CollectionBackupRow[] {
  const rows = parseCsv(text);
  const [headers, ...records] = rows;
  if (!headers?.length) {
    throw new Error("CSV vazio");
  }

  const headerIndex = new Map(headers.map((header, index) => [header, index]));
  for (const header of COLLECTION_BACKUP_HEADERS) {
    if (!headerIndex.has(header)) {
      throw new Error(`CSV sem coluna obrigatoria: ${header}`);
    }
  }

  return records
    .filter((record) => record.some((value) => value.trim()))
    .map((record) => ({
      externalId: cell(record, headerIndex, "externalId"),
      cardName: cell(record, headerIndex, "cardName"),
      cardNumber: cell(record, headerIndex, "cardNumber"),
      printedTotal: cell(record, headerIndex, "printedTotal"),
      setId: cell(record, headerIndex, "setId"),
      setCode: cell(record, headerIndex, "setCode"),
      setName: cell(record, headerIndex, "setName"),
      quantity: Math.max(1, Number.parseInt(cell(record, headerIndex, "quantity") || "1", 10) || 1),
      condition: cell(record, headerIndex, "condition") || "NM",
      variant: cell(record, headerIndex, "variant") || "normal",
      foil: cell(record, headerIndex, "foil") === "true",
      language: cell(record, headerIndex, "language") || "unknown",
      notes: cell(record, headerIndex, "notes"),
    }))
    .filter((row) => row.externalId);
}

function cell(
  record: string[],
  headerIndex: Map<string, number>,
  header: (typeof COLLECTION_BACKUP_HEADERS)[number],
): string {
  return record[headerIndex.get(header) ?? -1]?.trim() ?? "";
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cellValue = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cellValue += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      row.push(cellValue);
      cellValue = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cellValue);
      rows.push(row);
      row = [];
      cellValue = "";
      continue;
    }

    cellValue += char;
  }

  row.push(cellValue);
  rows.push(row);
  return rows;
}

function toCsv(rows: Array<Array<string | number | boolean | null | undefined>>): string {
  return rows
    .map((row) =>
      row
        .map((value) => {
          const text = String(value ?? "");
          return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        })
        .join(","),
    )
    .join("\n");
}

function downloadTextFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}


