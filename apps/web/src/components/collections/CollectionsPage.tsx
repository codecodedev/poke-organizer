import { FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Copy,
  Eye,
  Filter,
  FolderPlus,
  Gavel,
  Layers3,
  Lock,
  Plus,
  Save,
  Search,
  Share2,
  Trash2,
  X,
} from "lucide-react";
import type {
  CollectionCartOffer,
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
import { Modal } from "../ui/Modal";
import { FilterField, FilterGroup } from "../ui/Filters";

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
  const [typeFilter, setTypeFilter] = useState(() => localStorage.getItem("cp_typeFilter") ?? "");
  const [rarityFilter, setRarityFilter] = useState(() => localStorage.getItem("cp_rarityFilter") ?? "");
  const [variantFilter, setVariantFilter] = useState(() => localStorage.getItem("cp_variantFilter") ?? "");
  const [sort, setSort] = useState<CollectionFolderSort>(() => (localStorage.getItem("cp_sort") as CollectionFolderSort) ?? "newest");
  const [showSold, setShowSold] = useState(() => localStorage.getItem("cp_showSold") === "true");
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
  const [offers, setOffers] = useState<CollectionCartOffer[]>([]);
  const [showOffersModal, setShowOffersModal] = useState(false);
  const [selectedAuctionItem, setSelectedAuctionItem] = useState<CollectionItem | null>(null);
  const [sellingItem, setSellingItem] = useState<CollectionItem | null>(null);
  const [itemToRemove, setItemToRemove] = useState<CollectionItem | null>(null);
  const [showPickerModal, setShowPickerModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [permissions, setPermissions] = useState<Array<{ id: string; user: { email: string; name: string | null } }>>([]);

  useEffect(() => {
    localStorage.setItem("cp_typeFilter", typeFilter);
    localStorage.setItem("cp_rarityFilter", rarityFilter);
    localStorage.setItem("cp_variantFilter", variantFilter);
    localStorage.setItem("cp_sort", sort);
    localStorage.setItem("cp_showSold", String(showSold));
  }, [typeFilter, rarityFilter, variantFilter, sort, showSold]);

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
      if (detail.isStore) {
        await refreshOffers(detail.id);
      } else {
        setOffers([]);
      }
      await refreshPermissions(detail.id);
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

  async function undoFolderItemSale(folderItemId: string) {
    if (!activeFolder) return;
    const detail = await withAuthRetry(session, onSession, onUnauthorized, (token) =>
      api.undoCollectionItemSale(token, activeFolder.id, folderItemId),
    );
    setActiveFolder(detail);
    setActiveName(detail.name);
    setMessage("Venda cancelada.");
  }

  async function removeFolderItemInstant(folderItemId: string) {
    if (!activeFolder) return;
    const detail = await withAuthRetry(session, onSession, onUnauthorized, (token) =>
      api.removeCollectionFolderItem(token, activeFolder.id, folderItemId),
    );
    setActiveFolder(detail);
    setActiveName(detail.name);
    setSelectedItemIds(new Set(detail.items.map((item) => item.id)));
    setItemToRemove(null);
    setMessage("Carta removida da colecao.");
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

  async function updateFolderStore(isStore: boolean) {
    if (!activeFolder) return;
    setError(null);
    setMessage(null);
    try {
      const detail = await withAuthRetry(session, onSession, onUnauthorized, (token) =>
        api.updateCollectionFolderStore(token, activeFolder.id, { isStore }),
      );
      setActiveFolder(detail);
      setActiveName(detail.name);
      await refreshFolders();
      if (detail.isStore) await refreshOffers(detail.id);
      setMessage(isStore ? "Modo loja ativado." : "Modo loja desativado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao atualizar modo loja");
    }
  }

  async function updateFolderItemSale(
    folderItemId: string,
    payload: {
      manualPrice?: number | null;
      isSold?: boolean;
      soldPrice?: number | null;
      quantity?: number;
    },
  ) {
    if (!activeFolder) return;
    const detail = await withAuthRetry(session, onSession, onUnauthorized, (token) =>
      api.updateCollectionFolderItemSale(token, activeFolder.id, folderItemId, payload),
    );
    setActiveFolder(detail);
    setActiveName(detail.name);
    setMessage("Dados de venda atualizados.");
  }

  async function finishAuction(folderItemId: string) {
    if (!activeFolder) return;
    const detail = await withAuthRetry(session, onSession, onUnauthorized, (token) =>
      api.finishCollectionItemAuction(token, activeFolder.id, folderItemId),
    );
    setActiveFolder(detail);
    setActiveName(detail.name);
    setMessage("Leilao finalizado.");
  }

  async function invalidateBid(folderItemId: string, bidId: string) {
    if (!activeFolder) return;
    const detail = await withAuthRetry(session, onSession, onUnauthorized, (token) =>
      api.invalidateCollectionBid(token, activeFolder.id, folderItemId, bidId),
    );
    setActiveFolder(detail);
    setActiveName(detail.name);
    
    // Atualiza o item selecionado para refletir a remocao do lance no modal aberto
    const updatedItem = detail.items.find(i => i.folderItemId === folderItemId);
    if (updatedItem) {
      setSelectedAuctionItem(updatedItem);
    }
    
    setMessage("Lance invalidado.");
  }

  async function refreshOffers(folderId = activeFolder?.id) {
    if (!folderId) return;
    const nextOffers = await withAuthRetry(session, onSession, onUnauthorized, (token) =>
      api.listCollectionOffers(token, folderId),
    );
    setOffers(nextOffers);
  }

  async function decideOffer(offerId: string, status: "accepted" | "rejected") {
    if (!activeFolder) return;
    await withAuthRetry(session, onSession, onUnauthorized, (token) =>
      api.decideCollectionOffer(token, activeFolder.id, offerId, status),
    );
    const detail = await withAuthRetry(session, onSession, onUnauthorized, (token) =>
      api.getCollectionFolder(token, activeFolder.id),
    );
    setActiveFolder(detail);
    setActiveName(detail.name);
    await refreshOffers(activeFolder.id);
    setMessage(status === "accepted" ? "Proposta aceita e cartas marcadas como vendidas." : "Proposta rejeitada.");
  }

  async function refreshPermissions(folderId = activeFolder?.id) {
    if (!folderId) return;
    const nextPermissions = await withAuthRetry(session, onSession, onUnauthorized, (token) =>
      api.getCollectionFolderPermissions(token, folderId),
    );
    setPermissions(nextPermissions);
  }

  async function addPermission(email: string) {
    if (!activeFolder) return;
    await withAuthRetry(session, onSession, onUnauthorized, (token) =>
      api.addCollectionFolderPermission(token, activeFolder.id, email),
    );
    await refreshPermissions(activeFolder.id);
    setMessage("Permissao adicionada.");
  }

  async function removePermission(permissionId: string) {
    if (!activeFolder) return;
    await withAuthRetry(session, onSession, onUnauthorized, (token) =>
      api.removeCollectionFolderPermission(token, activeFolder.id, permissionId),
    );
    await refreshPermissions(activeFolder.id);
    setMessage("Permissao removida.");
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
    localStorage.removeItem("cp_typeFilter");
    localStorage.removeItem("cp_rarityFilter");
    localStorage.removeItem("cp_variantFilter");
    localStorage.removeItem("cp_sort");
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
    () =>
      screen === "detail" && activeFolder
        ? activeFolder.items.filter((item) => selectedItemIds.has(item.id))
        : inventory.filter((item) => selectedItemIds.has(item.id)),
    [activeFolder, inventory, screen, selectedItemIds],
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
      if (activeFolder?.isStore && item.store?.isSold && !showSold) return false;
      if (typeFilter && !item.card.types.includes(typeFilter)) return false;
      if (rarityFilter && item.card.rarity !== rarityFilter) return false;
      if (variantFilter && item.variant !== variantFilter) return false;
      return true;
    });

    return sortItems(filtered, sort);
  }, [rarityFilter, selectedItems, sort, typeFilter, variantFilter, activeFolder?.isStore, showSold]);
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
  const unsoldItems = useMemo(
    () => selectedItems.filter((item) => !item.store?.isSold),
    [selectedItems],
  );
  const selectedTotalValue = unsoldItems.reduce(
    (sum, item) => sum + (item.price?.amount ?? 0) * item.quantity,
    0,
  );
  const pendingOffersCount = useMemo(
    () => offers.filter((o) => o.status === "pending").length,
    [offers],
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
  }, [rarityFilter, sort, typeFilter, variantFilter, showSold]);

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
          showPickerModal={showPickerModal}
          onTogglePickerModal={setShowPickerModal}
        />
      )}

      {screen === "detail" && activeFolder && (
        <CollectionDetailScreen
          activeName={activeName}
          selectedItems={selectedItems}
          unsoldCount={unsoldItems.length}
          visibleItems={visibleItems}
          detailPage={detailPage}
          selectedTotalValue={selectedTotalValue}
          pendingOffersCount={pendingOffersCount}
          onViewOffers={() => setShowOffersModal(true)}
          typeOptions={typeOptions}
          rarityOptions={rarityOptions}
          variantOptions={variantOptions}
          typeFilter={typeFilter}
          rarityFilter={rarityFilter}
          variantFilter={variantFilter}
          sort={sort}
          showSold={showSold}
          onShowSoldChange={setShowSold}
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
          isStore={activeFolder.isStore}
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
          onToggleStore={(isStore) => void updateFolderStore(isStore)}
          onUpdateSale={(folderItemId, payload) => void updateFolderItemSale(folderItemId, payload)}
          onFinishAuction={(folderItemId) => void finishAuction(folderItemId)}
          onUndoSale={(folderItemId: string) => void undoFolderItemSale(folderItemId)}
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
          onToggleItem={(itemId) => {
            const item = activeFolder.items.find((i) => i.id === itemId);
            if (item) setItemToRemove(item);
          }}
          onOpenCard={setSelectedItem}
          showPickerModal={showPickerModal}
          onTogglePickerModal={setShowPickerModal}
          setSelectedAuctionItem={setSelectedAuctionItem}
          setSellingItem={setSellingItem}
          onManagePermissions={() => setShowPermissionsModal(true)}
        />
      )}

      {itemToRemove && (
        <Modal
          title="Remover carta da coleção"
          onClose={() => setItemToRemove(null)}
          maxWidthClass="max-w-md"
        >
          <div className="grid gap-4 p-5">
            <p className="section-copy">
              Tem certeza que deseja remover a carta <span className="font-bold text-ink">"{itemToRemove.card.name}"</span> desta coleção?
            </p>
            <div className="flex gap-3">
              <Button type="button" className="flex-1" onClick={() => setItemToRemove(null)}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="primary"
                className="flex-1 bg-red-600 hover:bg-red-700"
                onClick={() => {
                  if (itemToRemove.folderItemId) {
                    void removeFolderItemInstant(itemToRemove.folderItemId);
                  }
                }}
              >
                Remover
              </Button>
            </div>
          </div>
        </Modal>
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

      {showOffersModal && activeFolder && (
        <OffersModal
          offers={offers}
          onClose={() => setShowOffersModal(false)}
          onDecide={decideOffer}
          onRefresh={refreshOffers}
        />
      )}

      {selectedAuctionItem && activeFolder && (
        <BidsModal
          item={selectedAuctionItem}
          onClose={() => setSelectedAuctionItem(null)}
          onAcceptBid={async (bidAmount) => {
            await finishAuction(selectedAuctionItem.folderItemId!);
            setSelectedAuctionItem(null);
          }}
          onInvalidateBid={(bidId) => invalidateBid(selectedAuctionItem.folderItemId!, bidId)}
          isOwner={true}
        />
      )}

      {sellingItem && activeFolder && (
        <SellModal
          item={sellingItem}
          onClose={() => setSellingItem(null)}
          onConfirm={async (soldPrice, soldQuantity) => {
            await updateFolderItemSale(sellingItem.folderItemId!, {
              isSold: true,
              soldPrice,
              quantity: soldQuantity,
            });
            setSellingItem(null);
          }}
        />
      )}

      {showPermissionsModal && activeFolder && (
        <PermissionsModal
          permissions={permissions}
          onClose={() => setShowPermissionsModal(false)}
          onAdd={addPermission}
          onRemove={removePermission}
        />
      )}
    </div>
  );
}

function PermissionsModal({
  permissions,
  onClose,
  onAdd,
  onRemove,
}: {
  permissions: Array<{ id: string; user: { email: string; name: string | null } }>;
  onClose: () => void;
  onAdd: (email: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await onAdd(email.trim());
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao adicionar permissao");
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
            <h2 className="text-xl font-black text-ink">Acessos Privados</h2>
            <p className="text-sm font-semibold text-slate-500">Autorize outros usuários a verem esta coleção.</p>
          </div>
          <button
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-white text-slate-700 transition hover:bg-field"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          <form onSubmit={submit} className="grid gap-4">
            <label className="grid gap-2">
              <span className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-500">E-mail do usuário</span>
              <div className="flex gap-2">
                <input
                  className="premium-input flex-1"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemplo@email.com"
                  required
                />
                <Button type="submit" variant="primary" disabled={submitting || !email.trim()}>
                  Adicionar
                </Button>
              </div>
            </label>
            {error && <p className="text-xs font-bold text-red-500">{error}</p>}
          </form>

          <div className="mt-6 space-y-3">
            <h3 className="text-sm font-black text-ink">Usuários com acesso</h3>
            {permissions.length === 0 ? (
              <p className="py-4 text-center text-xs font-bold text-slate-400">Apenas você tem acesso a esta coleção privada.</p>
            ) : (
              <div className="grid gap-2">
                {permissions.map((perm) => (
                  <div key={perm.id} className="flex items-center justify-between rounded-xl bg-field p-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-black text-ink">{perm.user.name || "Sem nome"}</p>
                      <p className="truncate text-[10px] font-semibold text-slate-500">{perm.user.email}</p>
                    </div>
                    <button
                      onClick={() => onRemove(perm.id)}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition"
                      title="Remover acesso"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SellModal({
  item,
  onClose,
  onConfirm,
}: {
  item: CollectionItem;
  onClose: () => void;
  onConfirm: (price: number, quantity: number) => Promise<void>;
}) {
  const initialPrice = item.store?.manualPrice ?? item.price?.amount ?? 0;
  const [price, setPrice] = useState(initialPrice.toString());
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      await onConfirm(Number(price), quantity);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-night/55 px-4 py-6 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className="animate-soft-pop w-full max-w-sm overflow-auto rounded-[26px] border border-white/80 bg-white shadow-card"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line/70 px-5 py-4">
          <div>
            <h2 className="text-lg font-black text-ink">Confirmar venda</h2>
            <p className="text-xs font-semibold text-slate-500">{item.card.name}</p>
          </div>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-white text-slate-700 transition hover:bg-field"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5">
          <div className="grid gap-4">
            <div className="grid grid-cols-[1fr_80px] gap-3">
              <label className="grid gap-2">
                <span className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-500">Preço unitário</span>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">R$</span>
                  <input
                    className="premium-input w-full pl-10"
                    type="number"
                    min={0}
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    autoFocus
                  />
                </div>
              </label>

              <label className="grid gap-2">
                <span className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-500">Qtd</span>
                <input
                  className="premium-input w-full text-center"
                  type="number"
                  min={1}
                  max={item.quantity}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.min(item.quantity, Math.max(1, Number(e.target.value))))}
                />
              </label>
            </div>

            <div className="rounded-xl bg-field p-3 text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total da venda</p>
              <p className="text-xl font-black text-ink">{formatBrl(Number(price || 0) * quantity)}</p>
            </div>

            <div className="flex gap-3">
              <Button type="button" className="flex-1" onClick={onClose}>Cancelar</Button>
              <Button
                type="button"
                variant="primary"
                className="flex-1"
                disabled={submitting || !price}
                onClick={submit}
              >
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BidsModal({
  item,
  onClose,
  onBid,
  onAcceptBid,
  onInvalidateBid,
  isOwner,
}: {
  item: CollectionItem;
  onClose: () => void;
  onBid?: (amount: number, quantity: number) => Promise<void>;
  onAcceptBid?: (amount: number) => Promise<void>;
  onInvalidateBid?: (bidId: string) => Promise<void>;
  isOwner?: boolean;
}) {
  const [amount, setAmount] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const bids = useMemo(() => {
    return item.store?.highestBid ? [item.store.highestBid] : [];
  }, [item.store?.highestBid]);

  async function submit() {
    if (!onBid || !amount) return;
    setSubmitting(true);
    try {
      await onBid(Number(amount), quantity);
      setAmount("");
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
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-black text-ink">{formatBrl(bid.amount)}</span>
                        {isOwner && (
                          <div className="flex gap-2">
                            {onInvalidateBid && (
                              <button
                                onClick={() => onInvalidateBid(bid.id)}
                                className="grid h-8 w-8 place-items-center rounded-lg border border-red-100 bg-white text-red-500 hover:bg-red-50 transition"
                                title="Invalidar lance"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                            {onAcceptBid && (
                              <button
                                onClick={() => onAcceptBid(bid.amount)}
                                className="rounded-lg bg-aqua px-3 py-1.5 text-[10px] font-black text-white hover:bg-cyan-600 transition"
                              >
                                Aceitar
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {!isOwner && onBid && (
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

function OffersModal({
  offers,
  onClose,
  onDecide,
  onRefresh,
}: {
  offers: CollectionCartOffer[];
  onClose: () => void;
  onDecide: (offerId: string, status: "accepted" | "rejected") => void;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState<"pending" | "resolved">("pending");

  const filteredOffers = useMemo(
    () => offers.filter((o) => (filter === "pending" ? o.status === "pending" : o.status !== "pending")),
    [filter, offers],
  );

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-night/55 px-4 py-6 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className="animate-soft-pop max-h-[80vh] w-full max-w-2xl overflow-auto rounded-[26px] border border-white/80 bg-white shadow-card"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line/70 px-5 py-4">
          <div>
            <h2 className="text-xl font-black text-ink">Propostas de Negociação</h2>
            <p className="text-sm font-semibold text-slate-500">Analise e decida sobre as propostas recebidas.</p>
          </div>
          <button
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-white text-slate-700 transition hover:bg-field"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex gap-2 rounded-2xl bg-field p-1">
              <button
                className={`rounded-xl px-4 py-2 text-xs font-black transition ${filter === "pending" ? "bg-white text-ink shadow-sm" : "text-slate-500 hover:text-ink"}`}
                onClick={() => setFilter("pending")}
              >
                Pendentes
              </button>
              <button
                className={`rounded-xl px-4 py-2 text-xs font-black transition ${filter === "resolved" ? "bg-white text-ink shadow-sm" : "text-slate-500 hover:text-ink"}`}
                onClick={() => setFilter("resolved")}
              >
                Resolvidas
              </button>
            </div>
            <Button type="button" onClick={onRefresh} className="h-9 text-xs">Atualizar</Button>
          </div>

          <div className="mt-5 grid gap-4">
            {filteredOffers.length === 0 && (
              <p className="py-10 text-center text-sm font-bold text-slate-400">Nenhuma proposta encontrada.</p>
            )}
            {filteredOffers.map((offer) => (
              <div key={offer.id} className="rounded-2xl border border-line/70 bg-field/45 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-ink">{offer.buyerName}</p>
                    <p className="text-xs font-semibold text-slate-500">
                      {offer.items.length} carta(s) • {formatBrl(offer.totalOffer)} • {formatOfferStatus(offer.status)}
                    </p>
                    {offer.message && (
                      <p className="mt-2 rounded-xl bg-white/60 p-3 text-sm italic text-slate-600 border border-line/40">
                        "{offer.message}"
                      </p>
                    )}
                  </div>
                  {offer.status === "pending" && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        className="h-9 bg-leaf text-white hover:bg-emerald-600"
                        onClick={() => onDecide(offer.id, "accepted")}
                      >
                        Aceitar
                      </Button>
                      <Button
                        type="button"
                        className="h-9 bg-red-50 text-red-600 border-red-100 hover:bg-red-100"
                        onClick={() => onDecide(offer.id, "rejected")}
                      >
                        Rejeitar
                      </Button>
                    </div>
                  )}
                </div>
                <div className="mt-4 space-y-2 border-t border-line/40 pt-3">
                  {offer.items.map((entry) => (
                    <div key={entry.item.id} className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-600">{entry.quantity}x {entry.item.card.name}</span>
                      <span className="text-ink">{formatBrl(entry.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
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
  showPickerModal,
  onTogglePickerModal,
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
  showPickerModal: boolean;
  onTogglePickerModal: (open: boolean) => void;
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

            <div className="mt-4 flex justify-center">
              <Button
                type="button"
                variant="primary"
                className="px-8 shadow-glow"
                icon={<Plus size={20} />}
                onClick={() => onTogglePickerModal(true)}
              >
                Selecionar cartas
              </Button>
            </div>
            </form>
            </Panel>

            {showPickerModal && (
            <Modal title="Selecionar cartas" onClose={() => onTogglePickerModal(false)}>
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
            action={
              <Button
                type="button"
                variant="primary"
                icon={<Plus size={16} />}
                onClick={() => onTogglePickerModal(false)}
              >
                Adicionar a colecao
              </Button>
            }
            />
            </Modal>
            )}
            </>
            );
            }

function CollectionDetailScreen({
  activeName,
  selectedItems,
  unsoldCount,
  visibleItems,
  detailPage,
  selectedTotalValue,
  pendingOffersCount,
  onViewOffers,
  typeOptions,
  rarityOptions,
  variantOptions,
  typeFilter,
  rarityFilter,
  variantFilter,
  sort,
  showSold,
  onShowSoldChange,
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
  isStore,
  shareUrl,
  onBack,
  onNameChange,
  onSave,
  onRemove,
  onToggleSharing,
  onToggleStore,
  onUpdateSale,
  onFinishAuction,
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
  showPickerModal,
  onTogglePickerModal,
  setSelectedAuctionItem,
  setSellingItem,
  onUndoSale,
}: {
  activeName: string;
  selectedItems: CollectionItem[];
  unsoldCount: number;
  visibleItems: CollectionItem[];
  detailPage: number;
  selectedTotalValue: number;
  pendingOffersCount: number;
  onViewOffers: () => void;
  typeOptions: string[];
  rarityOptions: string[];
  variantOptions: string[];
  typeFilter: string;
  rarityFilter: string;
  variantFilter: string;
  sort: CollectionFolderSort;
  showSold: boolean;
  onShowSoldChange: (value: boolean) => void;
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
  isStore: boolean;
  shareUrl: string | null;
  onBack: () => void;
  onNameChange: (value: string) => void;
  onSave: () => void;
  onRemove: () => void;
  onToggleSharing: (isPublic: boolean) => void;
  onToggleStore: (isStore: boolean) => void;
  onUpdateSale: (folderItemId: string, payload: { manualPrice?: number | null; isSold?: boolean; soldPrice?: number | null }) => void;
  onFinishAuction: (folderItemId: string) => void;
  onCopyShareLink: () => void;
  onUndoSale: (folderItemId: string) => void;
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
  showPickerModal: boolean;
  onTogglePickerModal: (open: boolean) => void;
  setSelectedAuctionItem: (item: CollectionItem | null) => void;
  setSellingItem: (item: CollectionItem | null) => void;
  onManagePermissions: () => void;
}) {
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const paginatedVisibleItems = useMemo(
    () =>
      visibleItems.slice(
        (detailPage - 1) * COLLECTION_DETAIL_PAGE_SIZE,
        detailPage * COLLECTION_DETAIL_PAGE_SIZE,
      ),
    [detailPage, visibleItems],
  );

  const debouncedUpdates = useMemo(() => {
    const timers: Record<string, any> = {};
    return (folderItemId: string, amount: number | null) => {
      if (timers[folderItemId]) clearTimeout(timers[folderItemId]);
      timers[folderItemId] = setTimeout(() => {
        onUpdateSale(folderItemId, { manualPrice: amount });
        delete timers[folderItemId];
      }, 2000);
    };
  }, [onUpdateSale]);

  return (
    <>
      <Panel>
        <div className="grid gap-5">
          <ScreenHeader
            eyebrow="Detalhes"
            title={activeName || "Colecao"}
            description={`${unsoldCount} cartas - ${formatBrl(selectedTotalValue)}`}
            onBack={onBack}
            notification={pendingOffersCount > 0}
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

            <div className="flex gap-2">
              {!isPublic && (
                <Button
                  type="button"
                  variant="ghost"
                  icon={<Plus size={16} />}
                  onClick={onManagePermissions}
                >
                  Autorizar usuários
                </Button>
              )}
              <Button
                type="button"
                icon={shareUrl ? <Copy size={16} /> : <Share2 size={16} />}
                onClick={onCopyShareLink}
              >
                {shareUrl ? "Copiar link" : "Gerar link"}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 rounded-[26px] border border-line/80 bg-white/72 p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-black text-ink">Modo loja</h3>
                <p className="section-copy mt-1">
                  Ative para permitir precos manuais, lances e propostas de carrinho nesta colecao.
                </p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-3 text-sm font-black text-slate-700">
                <span>Vitrine</span>
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={isStore}
                  onChange={(event) => onToggleStore(event.target.checked)}
                />
                <span className="relative h-7 w-12 rounded-full bg-slate-300 transition after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition peer-checked:bg-aqua peer-checked:after:translate-x-5" />
                <span>Loja</span>
              </label>
            </div>

            {isStore && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-aqua/20 bg-aqua/5 p-4">
                <div>
                  <h4 className="font-black text-ink">Propostas e Lances</h4>
                  <p className="text-sm font-semibold text-slate-500">
                    Gerencie as ofertas recebidas e acompanhe os leilões ativos.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="primary"
                  icon={<Layers3 size={16} />}
                  onClick={onViewOffers}
                >
                  Ver propostas
                  {pendingOffersCount > 0 && (
                    <span className="ml-2 rounded-full bg-red-500 px-2 py-0.5 text-[10px] text-white">
                      {pendingOffersCount}
                    </span>
                  )}
                </Button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
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

          {showFiltersModal && (
            <Modal title="Filtros e Ordenação" onClose={() => setShowFiltersModal(false)} maxWidthClass="max-w-xl">
              <div className="grid gap-5 p-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FilterField label="Tipo">
                    <select
                      className="premium-select w-full"
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
                      className="premium-select w-full"
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
                      className="premium-select w-full"
                      value={variantFilter}
                      onChange={(event) => onVariantFilter(event.target.value)}
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
                        onSort(event.target.value as CollectionFolderSort)
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
                  {isStore && (
                    <FilterField label="Ver vendidas">
                      <div className="flex h-[46px] items-center">
                        <input
                          type="checkbox"
                          checked={showSold}
                          onChange={(e) => onShowSoldChange(e.target.checked)}
                          className="h-6 w-6 rounded-lg border-line text-brand focus:ring-brand/30"
                        />
                      </div>
                    </FilterField>
                  )}
                </div>
                
                <div className="flex gap-3 pt-2">
                  <Button 
                    type="button" 
                    className="flex-1"
                    variant="ghost"
                    onClick={() => {
                      onTypeFilter("");
                      onRarityFilter("");
                      onVariantFilter("");
                      onSort("newest");
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

          <div className="rounded-2xl border border-lilac/25 bg-lilac/10 px-4 py-3 text-sm font-black text-violet-900">
            {visibleItems.length} de {unsoldCount} cartas visiveis
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
                    onPriceChange={
                      isStore && item.folderItemId
                        ? (amount) => debouncedUpdates(item.folderItemId!, amount)
                        : undefined
                    }
                    onRemove={(nextItem) => onToggleItem(nextItem.id)}
                    removeLabel="Remover da colecao"
                  >
                    {isStore && item.folderItemId && (
                      <div className="grid gap-2 p-1">
                        {!item.store?.isSold && !item.store?.highestBid && (
                          <Button
                            type="button"
                            variant="primary"
                            className="h-9 w-full text-[11px] bg-leaf hover:bg-emerald-600"
                            onClick={() => setSellingItem(item)}
                          >
                            Marcar vendido
                          </Button>
                        )}
                        {item.store?.isSold && (
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-8 w-full text-[10px] text-slate-500 hover:text-red-500"
                            onClick={() => onUndoSale(item.folderItemId!)}
                          >
                            Desfazer venda
                          </Button>
                        )}
                        {item.store?.highestBid && !item.store?.isSold && (
                          <Button
                            type="button"
                            className="h-8 w-full text-[10px]"
                            onClick={() => setSelectedAuctionItem(item)}
                          >
                            Ver lances
                          </Button>
                        )}
                      </div>
                    )}
                  </CollectionItemCard>
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

          <div className="mt-8 flex justify-center">
            <Button
              type="button"
              variant="primary"
              className="px-8 shadow-glow"
              icon={<Plus size={20} />}
              onClick={() => onTogglePickerModal(true)}
            >
              Adicionar carta
            </Button>
          </div>
        </div>
      </Panel>

      {showPickerModal && (
        <Modal title="Adicionar cartas" onClose={() => onTogglePickerModal(false)}>
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
                onClick={() => {
                  onSave();
                  onTogglePickerModal(false);
                }}
              >
                Adicionar selecionadas
              </Button>
            }
          />
        </Modal>
      )}
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

      <FilterGroup className="mt-3">
        <FilterField label="Tipo">
          <select
            className="premium-select w-full"
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
            className="premium-select w-full"
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
            className="premium-select w-full"
            value={pickerVariantFilter}
            onChange={(event) => onPickerVariantFilter(event.target.value)}
          >
            <option value="">Todas as variantes</option>
            {pickerVariantOptions.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Ordenação">
          <select
            className="premium-select w-full"
            value={pickerSort}
            onChange={(event) =>
              onPickerSort(event.target.value as CollectionFolderSort)
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
      </FilterGroup>

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
  notification,
}: {
  eyebrow: string;
  title: string;
  description: string;
  onBack: () => void;
  action?: ReactNode;
  notification?: boolean;
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
          <div className="relative flex items-center gap-2">
            <h2 className="section-title truncate">{title}</h2>
            {notification && (
              <span className="flex h-3 w-3 shrink-0 animate-pulse rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
            )}
          </div>
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

function formatOfferStatus(status: CollectionCartOffer["status"]): string {
  if (status === "accepted") return "aceita";
  if (status === "rejected") return "rejeitada";
  return "pendente";
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

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="mt-5 rounded-[24px] border border-line/80 bg-white/70 p-5 text-sm font-bold text-slate-500 shadow-sm">
      {children}
    </div>
  );
}
