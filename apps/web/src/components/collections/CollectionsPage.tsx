import { FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Copy,
  Eye,
  FolderPlus,
  Layers3,
  Lock,
  Plus,
  Save,
  Search,
  Share2,
  Trash2,
} from "lucide-react";
import type {
  CollectionFolderDetail,
  CollectionFolderSort,
  CollectionFolderSummary,
  CollectionItem,
} from "@poke-organizer/shared";
import { api, type Session } from "../../lib/api";
import { withAuthRetry } from "../../lib/authRetry";
import { formatBrl } from "../../lib/format";
import { Button } from "../ui/Button";
import { Panel } from "../ui/Panel";
import { CollectionItemCard } from "../collection/CollectionItemCard";
import { CardDetailModal, type UpdateCardDetails } from "../CardDetailModal";
import { PaginationControls } from "../ui/PaginationControls";

type Props = {
  session: Session;
  onSession: (session: Session) => void;
  onUnauthorized: () => Promise<Session | null>;
  collectionRoute?: string | null;
  onCollectionRouteChange?: (route: string | null) => void;
};

type Screen = "list" | "create" | "detail";

const FOLDERS_PAGE_SIZE = 12;
const COLLECTION_DETAIL_PAGE_SIZE = 24;
const PICKER_PAGE_SIZE = 21;

export function CollectionsPage({
  session,
  onSession,
  onUnauthorized,
  collectionRoute = null,
  onCollectionRouteChange,
}: Props) {
  const [screen, setScreen] = useState<Screen>("list");
  const [folders, setFolders] = useState<CollectionFolderSummary[]>([]);
  const [activeFolder, setActiveFolder] =
    useState<CollectionFolderDetail | null>(null);
  const [inventory, setInventory] = useState<CollectionItem[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedItem, setSelectedItem] = useState<CollectionItem | null>(null);
  const [newName, setNewName] = useState("");
  const [activeName, setActiveName] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [rarityFilter, setRarityFilter] = useState("");
  const [variantFilter, setVariantFilter] = useState("");
  const [sort, setSort] = useState<CollectionFolderSort>("newest");
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerTypeFilter, setPickerTypeFilter] = useState("");
  const [pickerRarityFilter, setPickerRarityFilter] = useState("");
  const [pickerVariantFilter, setPickerVariantFilter] = useState("");
  const [pickerSort, setPickerSort] = useState<CollectionFolderSort>("newest");
  const [showAllPickerItems, setShowAllPickerItems] = useState(false);
  const [foldersPage, setFoldersPage] = useState(1);
  const [detailPage, setDetailPage] = useState(1);
  const [pickerPage, setPickerPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [nextInventory, nextFolders] = await withAuthRetry(
        session,
        onSession,
        onUnauthorized,
        async (token) => {
          const [items, folderList] = await Promise.all([
            api.listCollection(token),
            api.listCollectionFolders(token),
          ]);
          return [items, folderList] as const;
        },
      );
      setInventory(nextInventory);
      setFolders(nextFolders);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Falha ao carregar colecoes",
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadFolder(folderId: string) {
    try {
      const detail = await withAuthRetry(
        session,
        onSession,
        onUnauthorized,
        (token) => api.getCollectionFolder(token, folderId),
      );
      setActiveFolder(detail);
      setActiveName(detail.name);
      setSelectedItemIds(new Set(detail.items.map((item) => item.id)));
      resetFilters();
      resetPicker();
      setScreen("detail");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Falha ao carregar colecao",
      );
      showList();
    }
  }

  function startCreate() {
    if (onCollectionRouteChange) {
      onCollectionRouteChange("new");
      return;
    }
    showCreate();
  }

  function showCreate() {
    setNewName("");
    setActiveFolder(null);
    setSelectedItemIds(new Set());
    resetPicker();
    setMessage(null);
    setError(null);
    setScreen("create");
  }

  function backToList() {
    if (onCollectionRouteChange) {
      onCollectionRouteChange(null);
      return;
    }
    showList();
  }

  function showList() {
    setScreen("list");
    setActiveFolder(null);
    setActiveName("");
    setSelectedItemIds(new Set());
    resetFilters();
    resetPicker();
  }

  async function createFolder(event: FormEvent) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;

    setError(null);
    setMessage(null);
    try {
      const folder = await withAuthRetry(
        session,
        onSession,
        onUnauthorized,
        async (token) => {
          const created = await api.createCollectionFolder(token, name);
          if (selectedItemIds.size === 0) return created;
          return api.updateCollectionFolder(token, created.id, {
            name,
            itemIds: Array.from(selectedItemIds),
          });
        },
      );
      setActiveFolder(folder);
      setActiveName(folder.name);
      setSelectedItemIds(new Set(folder.items.map((item) => item.id)));
      setNewName("");
      await refreshFolders();
      if (onCollectionRouteChange) {
        onCollectionRouteChange(folder.id);
      } else {
        setScreen("detail");
      }
      setMessage("Colecao criada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar colecao");
    }
  }

  async function saveFolder() {
    if (!activeFolder) return;
    setError(null);
    setMessage(null);
    try {
      const detail = await withAuthRetry(
        session,
        onSession,
        onUnauthorized,
        (token) =>
          api.updateCollectionFolder(token, activeFolder.id, {
            name: activeName.trim(),
            itemIds: Array.from(selectedItemIds),
          }),
      );
      setActiveFolder(detail);
      setActiveName(detail.name);
      setSelectedItemIds(new Set(detail.items.map((item) => item.id)));
      await refreshFolders();
      setMessage("Colecao salva.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar colecao");
    }
  }

  async function removeFolder() {
    if (!activeFolder) return;
    setError(null);
    setMessage(null);
    try {
      await withAuthRetry(session, onSession, onUnauthorized, (token) =>
        api.deleteCollectionFolder(token, activeFolder.id),
      );
      await refreshFolders();
      showList();
      onCollectionRouteChange?.(null);
      setMessage("Colecao excluida.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao excluir colecao");
    }
  }

  async function updateFolderSharing(isPublic: boolean) {
    if (!activeFolder) return;
    setError(null);
    setMessage(null);
    try {
      const detail = await withAuthRetry(
        session,
        onSession,
        onUnauthorized,
        (token) =>
          api.updateCollectionFolderSharing(token, activeFolder.id, {
            isPublic,
            ensureToken: isPublic,
          }),
      );
      setActiveFolder(detail);
      setActiveName(detail.name);
      setSelectedItemIds(new Set(detail.items.map((item) => item.id)));
      await refreshFolders();
      setMessage(isPublic ? "Colecao publica." : "Colecao privada.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Falha ao atualizar compartilhamento",
      );
    }
  }

  async function copyShareLink() {
    if (!activeFolder) return;
    setError(null);
    setMessage(null);

    try {
      const detail = activeFolder.shareToken
        ? activeFolder
        : await withAuthRetry(session, onSession, onUnauthorized, (token) =>
            api.updateCollectionFolderSharing(token, activeFolder.id, {
              ensureToken: true,
            }),
          );

      setActiveFolder(detail);
      setActiveName(detail.name);
      setSelectedItemIds(new Set(detail.items.map((item) => item.id)));
      await refreshFolders();

      if (!detail.shareToken) {
        throw new Error("Link publico nao foi gerado");
      }

      const url = publicCollectionUrl(detail.shareToken);
      try {
        if (!navigator.clipboard?.writeText) {
          throw new Error("Clipboard unavailable");
        }
        await navigator.clipboard.writeText(url);
        setMessage(
          detail.isPublic
            ? "Link copiado."
            : "Link copiado. A colecao ainda esta privada.",
        );
      } catch {
        setMessage(
          detail.isPublic
            ? `Link gerado: ${url}`
            : `Link gerado: ${url}. A colecao ainda esta privada.`,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao copiar link");
    }
  }

  async function refreshFolders() {
    const nextFolders = await withAuthRetry(
      session,
      onSession,
      onUnauthorized,
      (token) => api.listCollectionFolders(token),
    );
    setFolders(nextFolders);
  }

  async function updateItemDetails(itemId: string, details: UpdateCardDetails) {
    const updated = await withAuthRetry(
      session,
      onSession,
      onUnauthorized,
      (token) => api.updateCollection(token, itemId, details),
    );
    setInventory((current) =>
      current.map((item) => (item.id === itemId ? updated : item)),
    );
    setSelectedItem(updated);
  }

  function resetFilters() {
    setTypeFilter("");
    setRarityFilter("");
    setVariantFilter("");
    setSort("newest");
    setDetailPage(1);
  }

  function resetPicker() {
    setPickerQuery("");
    setPickerTypeFilter("");
    setPickerRarityFilter("");
    setPickerVariantFilter("");
    setPickerSort("newest");
    setShowAllPickerItems(false);
    setPickerPage(1);
  }

  function toggleItem(itemId: string) {
    setSelectedItemIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }

  const selectedItems = useMemo(
    () => inventory.filter((item) => selectedItemIds.has(item.id)),
    [inventory, selectedItemIds],
  );
  const typeOptions = useMemo(
    () => unique(selectedItems.flatMap((item) => item.card.types)),
    [selectedItems],
  );
  const rarityOptions = useMemo(
    () =>
      unique(
        selectedItems
          .map((item) => item.card.rarity)
          .filter(Boolean) as string[],
      ),
    [selectedItems],
  );
  const variantOptions = useMemo(
    () => unique(selectedItems.map((item) => item.variant)),
    [selectedItems],
  );
  const pickerTypeOptions = useMemo(
    () => unique(inventory.flatMap((item) => item.card.types)),
    [inventory],
  );
  const pickerRarityOptions = useMemo(
    () =>
      unique(
        inventory.map((item) => item.card.rarity).filter(Boolean) as string[],
      ),
    [inventory],
  );
  const pickerVariantOptions = useMemo(
    () => unique(inventory.map((item) => item.variant)),
    [inventory],
  );
  const visibleItems = useMemo(() => {
    const filtered = selectedItems.filter((item) => {
      if (typeFilter && !item.card.types.includes(typeFilter)) return false;
      if (rarityFilter && item.card.rarity !== rarityFilter) return false;
      if (variantFilter && item.variant !== variantFilter) return false;
      return true;
    });

    return sortItems(filtered, sort);
  }, [rarityFilter, selectedItems, sort, typeFilter, variantFilter]);
  const pickerItems = useMemo(() => {
    const query = normalizeText(pickerQuery);
    const hasPickerFilter = Boolean(
      pickerTypeFilter || pickerRarityFilter || pickerVariantFilter,
    );
    if (!query && !showAllPickerItems && !hasPickerFilter) return [];

    const filtered = inventory.filter((item) => {
      if (pickerTypeFilter && !item.card.types.includes(pickerTypeFilter)) {
        return false;
      }
      if (pickerRarityFilter && item.card.rarity !== pickerRarityFilter) {
        return false;
      }
      if (pickerVariantFilter && item.variant !== pickerVariantFilter) {
        return false;
      }
      if (!query) return true;
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
      return searchable.includes(query);
    });

    return sortItems(filtered, pickerSort);
  }, [
    inventory,
    pickerQuery,
    pickerRarityFilter,
    pickerSort,
    pickerTypeFilter,
    pickerVariantFilter,
    showAllPickerItems,
  ]);
  const selectedTotalValue = selectedItems.reduce(
    (sum, item) => sum + (item.price?.amount ?? 0) * item.quantity,
    0,
  );

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (loading) return;
    if (collectionRoute === "new") {
      showCreate();
      return;
    }
    if (collectionRoute) {
      void loadFolder(collectionRoute);
      return;
    }
    showList();
  }, [collectionRoute, loading]);

  useEffect(() => {
    const totalPages = Math.max(
      1,
      Math.ceil(folders.length / FOLDERS_PAGE_SIZE),
    );
    setFoldersPage((current) => Math.min(current, totalPages));
  }, [folders.length]);

  useEffect(() => {
    setDetailPage(1);
  }, [rarityFilter, sort, typeFilter, variantFilter]);

  useEffect(() => {
    const totalPages = Math.max(
      1,
      Math.ceil(visibleItems.length / COLLECTION_DETAIL_PAGE_SIZE),
    );
    setDetailPage((current) => Math.min(current, totalPages));
  }, [visibleItems.length]);

  useEffect(() => {
    setPickerPage(1);
  }, [
    pickerQuery,
    pickerRarityFilter,
    pickerSort,
    pickerTypeFilter,
    pickerVariantFilter,
    showAllPickerItems,
    screen,
  ]);

  useEffect(() => {
    const totalPages = Math.max(
      1,
      Math.ceil(pickerItems.length / PICKER_PAGE_SIZE),
    );
    setPickerPage((current) => Math.min(current, totalPages));
  }, [pickerItems.length]);

  return (
    <div className="grid gap-5">
      {screen === "list" && (
        <CollectionsListScreen
          folders={folders}
          inventoryCount={inventory.length}
          page={foldersPage}
          loading={loading}
          onCreate={startCreate}
          onPageChange={setFoldersPage}
          onOpen={(folderId) => {
            if (onCollectionRouteChange) {
              onCollectionRouteChange(folderId);
            } else {
              void loadFolder(folderId);
            }
          }}
        />
      )}

      {screen === "create" && (
        <CollectionCreateScreen
          name={newName}
          selectedCount={selectedItemIds.size}
          selectedTotalValue={selectedTotalValue}
          pickerQuery={pickerQuery}
          pickerTypeOptions={pickerTypeOptions}
          pickerRarityOptions={pickerRarityOptions}
          pickerVariantOptions={pickerVariantOptions}
          pickerTypeFilter={pickerTypeFilter}
          pickerRarityFilter={pickerRarityFilter}
          pickerVariantFilter={pickerVariantFilter}
          pickerSort={pickerSort}
          showAllPickerItems={showAllPickerItems}
          pickerItems={pickerItems}
          pickerPage={pickerPage}
          selectedItemIds={selectedItemIds}
          onBack={backToList}
          onNameChange={setNewName}
          onQueryChange={setPickerQuery}
          onPickerTypeFilter={setPickerTypeFilter}
          onPickerRarityFilter={setPickerRarityFilter}
          onPickerVariantFilter={setPickerVariantFilter}
          onPickerSort={setPickerSort}
          onShowAllChange={setShowAllPickerItems}
          onPickerPageChange={setPickerPage}
          onToggleItem={toggleItem}
          onOpenCard={setSelectedItem}
          onSubmit={createFolder}
        />
      )}

      {screen === "detail" && activeFolder && (
        <CollectionDetailScreen
          activeName={activeName}
          selectedItems={selectedItems}
          visibleItems={visibleItems}
          detailPage={detailPage}
          selectedTotalValue={selectedTotalValue}
          typeOptions={typeOptions}
          rarityOptions={rarityOptions}
          variantOptions={variantOptions}
          typeFilter={typeFilter}
          rarityFilter={rarityFilter}
          variantFilter={variantFilter}
          sort={sort}
          pickerQuery={pickerQuery}
          pickerTypeOptions={pickerTypeOptions}
          pickerRarityOptions={pickerRarityOptions}
          pickerVariantOptions={pickerVariantOptions}
          pickerTypeFilter={pickerTypeFilter}
          pickerRarityFilter={pickerRarityFilter}
          pickerVariantFilter={pickerVariantFilter}
          pickerSort={pickerSort}
          showAllPickerItems={showAllPickerItems}
          pickerItems={pickerItems}
          pickerPage={pickerPage}
          selectedItemIds={selectedItemIds}
          isPublic={activeFolder.isPublic}
          shareUrl={
            activeFolder.shareToken
              ? publicCollectionUrl(activeFolder.shareToken)
              : null
          }
          onBack={backToList}
          onNameChange={setActiveName}
          onSave={() => void saveFolder()}
          onRemove={() => void removeFolder()}
          onToggleSharing={(isPublic) => void updateFolderSharing(isPublic)}
          onCopyShareLink={() => void copyShareLink()}
          onTypeFilter={setTypeFilter}
          onRarityFilter={setRarityFilter}
          onVariantFilter={setVariantFilter}
          onSort={setSort}
          onDetailPageChange={setDetailPage}
          onQueryChange={setPickerQuery}
          onPickerTypeFilter={setPickerTypeFilter}
          onPickerRarityFilter={setPickerRarityFilter}
          onPickerVariantFilter={setPickerVariantFilter}
          onPickerSort={setPickerSort}
          onShowAllChange={setShowAllPickerItems}
          onPickerPageChange={setPickerPage}
          onToggleItem={toggleItem}
          onOpenCard={setSelectedItem}
        />
      )}

      {message && <p className="success-note">{message}</p>}
      {error && <p className="danger-note">{error}</p>}

      <CardDetailModal
        card={selectedItem?.card ?? null}
        collectionItem={selectedItem}
        collectionPrice={selectedItem?.price ?? null}
        onClose={() => setSelectedItem(null)}
        onUpdate={updateItemDetails}
      />
    </div>
  );
}

function CollectionsListScreen({
  folders,
  inventoryCount,
  page,
  loading,
  onCreate,
  onPageChange,
  onOpen,
}: {
  folders: CollectionFolderSummary[];
  inventoryCount: number;
  page: number;
  loading: boolean;
  onCreate: () => void;
  onPageChange: (page: number) => void;
  onOpen: (folderId: string) => void;
}) {
  const paginatedFolders = useMemo(
    () =>
      folders.slice((page - 1) * FOLDERS_PAGE_SIZE, page * FOLDERS_PAGE_SIZE),
    [folders, page],
  );

  return (
    <>
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="section-title">Colecoes</h2>
            <p className="section-copy mt-1">
              Organize seu inventario em pastas separadas.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <InfoPill label="Colecoes" value={folders.length.toString()} />
              <InfoPill label="Inventario" value={`${inventoryCount} cartas`} />
            </div>
          </div>
          <Button
            type="button"
            variant="brand"
            icon={<FolderPlus size={16} />}
            onClick={onCreate}
          >
            Nova colecao
          </Button>
        </div>
      </Panel>

      <Panel
        title="Minhas colecoes"
        description="Clique em uma colecao para abrir detalhes, editar cartas e ajustar o nome."
      >
        {folders.length ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {paginatedFolders.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => onOpen(folder.id)}
                  className="group rounded-[26px] border border-line/80 bg-white/76 p-5 text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:border-brand/40 hover:shadow-soft"
                >
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-lilac/20 to-aqua/20 text-violet-800">
                    <Layers3 size={20} />
                  </span>
                  <span className="mt-5 block truncate text-xl font-black text-ink">
                    {folder.name}
                  </span>
                  <span className="mt-1 block text-sm font-semibold text-slate-500">
                    {folder.itemCount} cartas - {formatBrl(folder.totalValue)}
                  </span>
                  <span
                    className={`mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black ${
                      folder.isPublic
                        ? "border-leaf/25 bg-leaf/10 text-emerald-800"
                        : "border-line/70 bg-white/70 text-slate-500"
                    }`}
                  >
                    {folder.isPublic ? <Eye size={14} /> : <Lock size={14} />}
                    {folder.isPublic ? "Publica" : "Privada"}
                  </span>
                </button>
              ))}
            </div>
            <PaginationControls
              page={page}
              pageSize={FOLDERS_PAGE_SIZE}
              totalItems={folders.length}
              onPageChange={onPageChange}
              itemLabel="colecoes"
            />
          </>
        ) : (
          !loading && (
            <EmptyState>
              Nenhuma colecao criada ainda. Use o botao Nova colecao para
              comecar.
            </EmptyState>
          )
        )}
      </Panel>
    </>
  );
}

function CollectionCreateScreen({
  name,
  selectedCount,
  selectedTotalValue,
  pickerQuery,
  pickerTypeOptions,
  pickerRarityOptions,
  pickerVariantOptions,
  pickerTypeFilter,
  pickerRarityFilter,
  pickerVariantFilter,
  pickerSort,
  showAllPickerItems,
  pickerItems,
  pickerPage,
  selectedItemIds,
  onBack,
  onNameChange,
  onQueryChange,
  onPickerTypeFilter,
  onPickerRarityFilter,
  onPickerVariantFilter,
  onPickerSort,
  onShowAllChange,
  onPickerPageChange,
  onToggleItem,
  onOpenCard,
  onSubmit,
}: {
  name: string;
  selectedCount: number;
  selectedTotalValue: number;
  pickerQuery: string;
  pickerTypeOptions: string[];
  pickerRarityOptions: string[];
  pickerVariantOptions: string[];
  pickerTypeFilter: string;
  pickerRarityFilter: string;
  pickerVariantFilter: string;
  pickerSort: CollectionFolderSort;
  showAllPickerItems: boolean;
  pickerItems: CollectionItem[];
  pickerPage: number;
  selectedItemIds: Set<string>;
  onBack: () => void;
  onNameChange: (value: string) => void;
  onQueryChange: (value: string) => void;
  onPickerTypeFilter: (value: string) => void;
  onPickerRarityFilter: (value: string) => void;
  onPickerVariantFilter: (value: string) => void;
  onPickerSort: (value: CollectionFolderSort) => void;
  onShowAllChange: (value: boolean) => void;
  onPickerPageChange: (page: number) => void;
  onToggleItem: (itemId: string) => void;
  onOpenCard: (item: CollectionItem) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <>
      <Panel>
        <form onSubmit={onSubmit} className="grid gap-5">
          <ScreenHeader
            eyebrow="Nova colecao"
            title="Criar colecao"
            description="Defina um nome, busque cartas do inventario e salve a nova pasta."
            onBack={onBack}
            action={
              <Button
                type="submit"
                variant="primary"
                icon={<Save size={16} />}
                disabled={!name.trim()}
              >
                Criar colecao
              </Button>
            }
          />

          <div className="grid gap-4 rounded-[26px] border border-line/80 bg-white/72 p-4 shadow-sm lg:grid-cols-[minmax(0,1fr)_260px] lg:items-end">
            <label className="grid gap-2">
              <span className="px-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                Nome da colecao
              </span>
              <input
                className="premium-input"
                value={name}
                onChange={(event) => onNameChange(event.target.value)}
                placeholder="Ex: Binder principal"
              />
            </label>
            <div className="rounded-2xl border border-lilac/25 bg-lilac/10 px-4 py-3 text-sm font-black text-violet-900">
              {selectedCount} cartas - {formatBrl(selectedTotalValue)}
            </div>
          </div>
        </form>
      </Panel>

      <CardPickerPanel
        title="Selecionar cartas"
        description="Busque por nome, numero ou colecao. Se preferir, mostre todas as cartas do inventario."
        pickerQuery={pickerQuery}
        pickerTypeOptions={pickerTypeOptions}
        pickerRarityOptions={pickerRarityOptions}
        pickerVariantOptions={pickerVariantOptions}
        pickerTypeFilter={pickerTypeFilter}
        pickerRarityFilter={pickerRarityFilter}
        pickerVariantFilter={pickerVariantFilter}
        pickerSort={pickerSort}
        showAllPickerItems={showAllPickerItems}
        pickerItems={pickerItems}
        pickerPage={pickerPage}
        selectedItemIds={selectedItemIds}
        onQueryChange={onQueryChange}
        onPickerTypeFilter={onPickerTypeFilter}
        onPickerRarityFilter={onPickerRarityFilter}
        onPickerVariantFilter={onPickerVariantFilter}
        onPickerSort={onPickerSort}
        onShowAllChange={onShowAllChange}
        onPickerPageChange={onPickerPageChange}
        onToggleItem={onToggleItem}
        onOpenCard={onOpenCard}
      />
    </>
  );
}

function CollectionDetailScreen({
  activeName,
  selectedItems,
  visibleItems,
  detailPage,
  selectedTotalValue,
  typeOptions,
  rarityOptions,
  variantOptions,
  typeFilter,
  rarityFilter,
  variantFilter,
  sort,
  pickerQuery,
  pickerTypeOptions,
  pickerRarityOptions,
  pickerVariantOptions,
  pickerTypeFilter,
  pickerRarityFilter,
  pickerVariantFilter,
  pickerSort,
  showAllPickerItems,
  pickerItems,
  pickerPage,
  selectedItemIds,
  isPublic,
  shareUrl,
  onBack,
  onNameChange,
  onSave,
  onRemove,
  onToggleSharing,
  onCopyShareLink,
  onTypeFilter,
  onRarityFilter,
  onVariantFilter,
  onSort,
  onDetailPageChange,
  onQueryChange,
  onPickerTypeFilter,
  onPickerRarityFilter,
  onPickerVariantFilter,
  onPickerSort,
  onShowAllChange,
  onPickerPageChange,
  onToggleItem,
  onOpenCard,
}: {
  activeName: string;
  selectedItems: CollectionItem[];
  visibleItems: CollectionItem[];
  detailPage: number;
  selectedTotalValue: number;
  typeOptions: string[];
  rarityOptions: string[];
  variantOptions: string[];
  typeFilter: string;
  rarityFilter: string;
  variantFilter: string;
  sort: CollectionFolderSort;
  pickerQuery: string;
  pickerTypeOptions: string[];
  pickerRarityOptions: string[];
  pickerVariantOptions: string[];
  pickerTypeFilter: string;
  pickerRarityFilter: string;
  pickerVariantFilter: string;
  pickerSort: CollectionFolderSort;
  showAllPickerItems: boolean;
  pickerItems: CollectionItem[];
  pickerPage: number;
  selectedItemIds: Set<string>;
  isPublic: boolean;
  shareUrl: string | null;
  onBack: () => void;
  onNameChange: (value: string) => void;
  onSave: () => void;
  onRemove: () => void;
  onToggleSharing: (isPublic: boolean) => void;
  onCopyShareLink: () => void;
  onTypeFilter: (value: string) => void;
  onRarityFilter: (value: string) => void;
  onVariantFilter: (value: string) => void;
  onSort: (value: CollectionFolderSort) => void;
  onDetailPageChange: (page: number) => void;
  onQueryChange: (value: string) => void;
  onPickerTypeFilter: (value: string) => void;
  onPickerRarityFilter: (value: string) => void;
  onPickerVariantFilter: (value: string) => void;
  onPickerSort: (value: CollectionFolderSort) => void;
  onShowAllChange: (value: boolean) => void;
  onPickerPageChange: (page: number) => void;
  onToggleItem: (itemId: string) => void;
  onOpenCard: (item: CollectionItem) => void;
}) {
  const paginatedVisibleItems = useMemo(
    () =>
      visibleItems.slice(
        (detailPage - 1) * COLLECTION_DETAIL_PAGE_SIZE,
        detailPage * COLLECTION_DETAIL_PAGE_SIZE,
      ),
    [detailPage, visibleItems],
  );

  return (
    <>
      <Panel>
        <div className="grid gap-5">
          <ScreenHeader
            eyebrow="Detalhes"
            title={activeName || "Colecao"}
            description={`${selectedItems.length} cartas - ${formatBrl(selectedTotalValue)}`}
            onBack={onBack}
            action={
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="primary"
                  icon={<Save size={16} />}
                  onClick={onSave}
                >
                  Salvar alteracoes
                </Button>
                <Button
                  type="button"
                  icon={<Trash2 size={16} />}
                  onClick={onRemove}
                >
                  Excluir
                </Button>
              </div>
            }
          />

          <label className="grid gap-2 rounded-[26px] border border-line/80 bg-white/72 p-4 shadow-sm">
            <span className="px-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Nome da colecao
            </span>
            <input
              className="w-full rounded-none border-0 bg-transparent p-0 text-3xl font-black text-ink outline-none placeholder:text-slate-300"
              value={activeName}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="Nome da colecao"
            />
          </label>

          <div className="grid gap-4 rounded-[26px] border border-line/80 bg-white/72 p-4 shadow-sm lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black ${
                    isPublic
                      ? "border-leaf/25 bg-leaf/10 text-emerald-800"
                      : "border-line/70 bg-white/70 text-slate-500"
                  }`}
                >
                  {isPublic ? <Eye size={14} /> : <Lock size={14} />}
                  {isPublic ? "Publica" : "Privada"}
                </span>
                <label className="inline-flex cursor-pointer items-center gap-3 text-sm font-black text-slate-700">
                  <span>Privada</span>
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={isPublic}
                    onChange={(event) => onToggleSharing(event.target.checked)}
                  />
                  <span className="relative h-7 w-12 rounded-full bg-slate-300 transition after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition peer-checked:bg-leaf peer-checked:after:translate-x-5" />
                  <span>Publica</span>
                </label>
              </div>
              <p className="mt-3 truncate text-sm font-semibold text-slate-500">
                {shareUrl ?? "Nenhum link gerado"}
              </p>
            </div>

            <Button
              type="button"
              icon={shareUrl ? <Copy size={16} /> : <Share2 size={16} />}
              onClick={onCopyShareLink}
            >
              {shareUrl ? "Copiar link" : "Gerar link"}
            </Button>
          </div>

          <div className="grid gap-3 rounded-[24px] border border-line/70 bg-field/45 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <FilterField label="Tipo">
              <select
                className="premium-select"
                value={typeFilter}
                onChange={(event) => onTypeFilter(event.target.value)}
              >
                <option value="">Todos os tipos</option>
                {typeOptions.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </FilterField>
            <FilterField label="Raridade">
              <select
                className="premium-select"
                value={rarityFilter}
                onChange={(event) => onRarityFilter(event.target.value)}
              >
                <option value="">Todas as raridades</option>
                {rarityOptions.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </FilterField>
            <FilterField label="Variante">
              <select
                className="premium-select"
                value={variantFilter}
                onChange={(event) => onVariantFilter(event.target.value)}
              >
                <option value="">Todas as variantes</option>
                {variantOptions.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </FilterField>
            <FilterField label="Ordenacao">
              <select
                className="premium-select"
                value={sort}
                onChange={(event) =>
                  onSort(event.target.value as CollectionFolderSort)
                }
              >
                <option value="newest">Ultima adicionada</option>
                <option value="oldest">Mais antiga</option>
                <option value="value-desc">Maior valor</option>
                <option value="value-asc">Menor valor</option>
                <option value="price-change-desc">Maior alta</option>
                <option value="price-change-asc">Maior queda</option>
              </select>
            </FilterField>
          </div>

          <div className="rounded-2xl border border-lilac/25 bg-lilac/10 px-4 py-3 text-sm font-black text-violet-900">
            {visibleItems.length} de {selectedItems.length} cartas visiveis
          </div>

          {visibleItems.length ? (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                {paginatedVisibleItems.map((item) => (
                  <CollectionItemCard
                    key={item.id}
                    item={item}
                    price={item.price ?? undefined}
                    onOpen={onOpenCard}
                    onRemove={(nextItem) => onToggleItem(nextItem.id)}
                    removeLabel="Remover da colecao"
                  />
                ))}
              </div>
              <PaginationControls
                page={detailPage}
                pageSize={COLLECTION_DETAIL_PAGE_SIZE}
                totalItems={visibleItems.length}
                onPageChange={onDetailPageChange}
                itemLabel="cartas"
              />
            </>
          ) : (
            <EmptyState>
              Nenhuma carta aparece com os filtros atuais.
            </EmptyState>
          )}
        </div>
      </Panel>

      <CardPickerPanel
        title="Adicionar cartas"
        description="Busque cartas do inventario, marque novas entradas e salve as alteracoes."
        pickerQuery={pickerQuery}
        pickerTypeOptions={pickerTypeOptions}
        pickerRarityOptions={pickerRarityOptions}
        pickerVariantOptions={pickerVariantOptions}
        pickerTypeFilter={pickerTypeFilter}
        pickerRarityFilter={pickerRarityFilter}
        pickerVariantFilter={pickerVariantFilter}
        pickerSort={pickerSort}
        showAllPickerItems={showAllPickerItems}
        pickerItems={pickerItems}
        pickerPage={pickerPage}
        selectedItemIds={selectedItemIds}
        onQueryChange={onQueryChange}
        onPickerTypeFilter={onPickerTypeFilter}
        onPickerRarityFilter={onPickerRarityFilter}
        onPickerVariantFilter={onPickerVariantFilter}
        onPickerSort={onPickerSort}
        onShowAllChange={onShowAllChange}
        onPickerPageChange={onPickerPageChange}
        onToggleItem={onToggleItem}
        onOpenCard={onOpenCard}
        action={
          <Button
            type="button"
            variant="primary"
            icon={<Save size={16} />}
            onClick={onSave}
          >
            Salvar selecao
          </Button>
        }
      />
    </>
  );
}

function CardPickerPanel({
  title,
  description,
  pickerQuery,
  pickerTypeOptions,
  pickerRarityOptions,
  pickerVariantOptions,
  pickerTypeFilter,
  pickerRarityFilter,
  pickerVariantFilter,
  pickerSort,
  showAllPickerItems,
  pickerItems,
  pickerPage,
  selectedItemIds,
  onQueryChange,
  onShowAllChange,
  onPickerPageChange,
  onToggleItem,
  onOpenCard,
  action,
  onPickerTypeFilter,
  onPickerRarityFilter,
  onPickerVariantFilter,
  onPickerSort,
}: {
  title: string;
  description: string;
  pickerQuery: string;
  pickerTypeOptions: string[];
  pickerRarityOptions: string[];
  pickerVariantOptions: string[];
  pickerTypeFilter: string;
  pickerRarityFilter: string;
  pickerVariantFilter: string;
  pickerSort: CollectionFolderSort;
  showAllPickerItems: boolean;
  pickerItems: CollectionItem[];
  pickerPage: number;
  selectedItemIds: Set<string>;
  onQueryChange: (value: string) => void;
  onPickerTypeFilter: (value: string) => void;
  onPickerRarityFilter: (value: string) => void;
  onPickerVariantFilter: (value: string) => void;
  onPickerSort: (value: CollectionFolderSort) => void;
  onShowAllChange: (value: boolean) => void;
  onPickerPageChange: (page: number) => void;
  onToggleItem: (itemId: string) => void;
  onOpenCard: (item: CollectionItem) => void;
  action?: ReactNode;
}) {
  const paginatedPickerItems = useMemo(
    () =>
      pickerItems.slice(
        (pickerPage - 1) * PICKER_PAGE_SIZE,
        pickerPage * PICKER_PAGE_SIZE,
      ),
    [pickerItems, pickerPage],
  );

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="section-title">{title}</h3>
          <p className="section-copy mt-1">{description}</p>
        </div>
        {action}
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center">
        <label className="relative block">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            size={18}
          />
          <input
            className="premium-input w-full pl-11"
            value={pickerQuery}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Buscar por nome, numero, colecao..."
          />
        </label>
        <Button
          type="button"
          icon={<Plus size={16} />}
          onClick={() => onShowAllChange(!showAllPickerItems)}
        >
          {showAllPickerItems ? "Ocultar lista" : "Mostrar todas"}
        </Button>
        <div className="rounded-2xl border border-line/70 bg-white/70 px-4 py-3 text-sm font-black text-slate-600">
          {selectedItemIds.size} selecionadas
        </div>
      </div>

      <div className="mt-3 grid gap-3 rounded-[24px] border border-line/70 bg-field/45 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <FilterField label="Tipo">
          <select
            className="premium-select"
            value={pickerTypeFilter}
            onChange={(event) => onPickerTypeFilter(event.target.value)}
          >
            <option value="">Todos os tipos</option>
            {pickerTypeOptions.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Raridade">
          <select
            className="premium-select"
            value={pickerRarityFilter}
            onChange={(event) => onPickerRarityFilter(event.target.value)}
          >
            <option value="">Todas as raridades</option>
            {pickerRarityOptions.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Variante">
          <select
            className="premium-select"
            value={pickerVariantFilter}
            onChange={(event) => onPickerVariantFilter(event.target.value)}
          >
            <option value="">Todas as variantes</option>
            {pickerVariantOptions.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Ordenacao">
          <select
            className="premium-select"
            value={pickerSort}
            onChange={(event) =>
              onPickerSort(event.target.value as CollectionFolderSort)
            }
          >
            <option value="newest">Ultima adicionada</option>
            <option value="oldest">Mais antiga</option>
            <option value="value-desc">Maior valor</option>
            <option value="value-asc">Menor valor</option>
            <option value="price-change-desc">Maior alta</option>
            <option value="price-change-asc">Maior queda</option>
          </select>
        </FilterField>
      </div>

      {pickerItems.length ? (
        <>
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-7">
            {paginatedPickerItems.map((item) => (
              <CollectionItemCard
                key={item.id}
                item={item}
                price={item.price ?? undefined}
                selected={selectedItemIds.has(item.id)}
                onOpen={onOpenCard}
                onToggleSelection={onToggleItem}
              />
            ))}
          </div>
          <PaginationControls
            page={pickerPage}
            pageSize={PICKER_PAGE_SIZE}
            totalItems={pickerItems.length}
            onPageChange={onPickerPageChange}
            itemLabel="cartas"
          />
        </>
      ) : (
        <EmptyState>
          Digite na busca ou use Mostrar todas para ver o inventario.
        </EmptyState>
      )}
    </Panel>
  );
}

function ScreenHeader({
  eyebrow,
  title,
  description,
  onBack,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  onBack: () => void;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-line/80 bg-white/80 text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/35"
          aria-label="Voltar"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            {eyebrow}
          </p>
          <h2 className="section-title truncate">{title}</h2>
          <p className="section-copy mt-1">{description}</p>
        </div>
      </div>
      {action}
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

function publicCollectionUrl(shareToken: string): string {
  return `${window.location.origin}/public/collections/${encodeURIComponent(shareToken)}`;
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full border border-line/70 bg-white/70 px-4 py-2 text-sm font-black text-slate-600 shadow-sm">
      <span className="text-slate-400">{label}: </span>
      {value}
    </span>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <span className="px-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="mt-5 rounded-[24px] border border-line/80 bg-white/70 p-5 text-sm font-bold text-slate-500 shadow-sm">
      {children}
    </div>
  );
}
