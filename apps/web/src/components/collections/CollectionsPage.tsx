import { FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  Eye,
  EyeClosed,
  Filter,
  FolderPlus,
  Gavel,
  Layers3,
  Lock,
  Pencil,
  Plus,
  Save,
  Search,
  Share2,
  ShoppingBag,
  Trash2,
  Unlock,
  Upload,
  X,
  HelpCircle,
} from "lucide-react";
import {
  formatCardVariant,
  formatCardNumber,
  type CollectionCartOffer,
  type CollectionFolderDetail,
  type CollectionFolderSort,
  type CollectionFolderSummary,
  type CollectionItem,
} from "@poke-organizer/shared";
import { api, apiFeedback, type Session } from "../../lib/api";
import { withAuthRetry } from "../../lib/authRetry";
import { formatBrl } from "../../lib/format";
import { Button } from "../ui/Button";
import { Panel } from "../ui/Panel";
import { CollectionItemCard } from "../collection/CollectionItemCard";
import { SimpleCardPickerItem } from "../collection/SimpleCardPickerItem";
import { SEO } from "../SEO";
import { CardDetailModal, type UpdateCardDetails } from "../CardDetailModal";
import { PaginationControls } from "../ui/PaginationControls";
import { Modal } from "../ui/Modal";
import { useTour } from "../../lib/TourContext";
import { ConfirmationModal } from "../ui/ConfirmationModal";
import { CollapsibleSection } from "../ui/CollapsibleSection";
import { FilterField, FilterGroup } from "../ui/Filters";
import { COLLECTIONS_LIST_TOUR, COLLECTION_DETAIL_TOUR, COLLECTION_CREATE_TOUR } from "./CollectionsTour";
import { lazy, Suspense } from "react";

const AppTour = lazy(() => import("../ui/AppTour").then(module => ({ default: module.AppTour })));

type Props = {
  session: Session;
  onSession: (session: Session) => void;
  onUnauthorized: () => Promise<Session | null>;
  collectionRoute: string | null;
  onCollectionRouteChange: (collectionId: string | null) => void;
  onUnsavedChanges?: (hasChanges: boolean) => void;
  blockedNavigationAt?: number;
};

type Screen = "list" | "create" | "detail";

const FOLDERS_PAGE_SIZE = 12;
const COLLECTION_DETAIL_PAGE_SIZE = 24;
const PICKER_PAGE_SIZE = 21;

export function CollectionsPage({
  session,
  onSession,
  onUnauthorized,
  collectionRoute,
  onCollectionRouteChange,
  onUnsavedChanges,
  blockedNavigationAt,
}: Props) {
  const { restartTour } = useTour();
  const [screen, setScreen] = useState<Screen>("list");
  const [folders, setFolders] = useState<CollectionFolderSummary[]>([]);
  const [activeFolder, setActiveFolder] =
    useState<CollectionFolderDetail | null>(null);
  const [inventory, setInventory] = useState<CollectionItem[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [tempSelectedItemIds, setTempSelectedItemIds] = useState<Set<string>>(new Set());
  const [selectedItem, setSelectedItem] = useState<CollectionItem | null>(null);
  const [newName, setNewName] = useState("");
  const [newIsStore, setNewIsStore] = useState(false);
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
  const [showFolderRemoveConfirm, setShowFolderRemoveConfirm] = useState(false);
  const [showPickerModal, setShowPickerModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [undoingItem, setUndoingItem] = useState<CollectionItem | null>(null);
  const [permissions, setPermissions] = useState<Array<{ id: string; user: { email: string; name: string | null } }>>([]);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [pendingBannerFile, setPendingBannerFile] = useState<File | null>(null);
  const [pendingBannerRemoval, setPendingBannerRemoval] = useState(false);

  const hasChanges = useMemo(() => {
    if (!activeFolder) return false;
    return (
      activeName !== activeFolder.name ||
      pendingBannerFile !== null ||
      pendingBannerRemoval
    );
  }, [activeName, activeFolder, pendingBannerFile, pendingBannerRemoval]);

  useEffect(() => {
    onUnsavedChanges?.(hasChanges);
  }, [hasChanges, onUnsavedChanges]);

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
      setPendingBannerFile(null);
      setPendingBannerRemoval(false);
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
    setNewIsStore(false);
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

  function handleTogglePicker(open: boolean) {
    if (open) {
      setTempSelectedItemIds(new Set(selectedItemIds));
    }
    setShowPickerModal(open);
  }

  async function undoFolderItemSale(folderItemId: string, quantity?: number) {
    if (!activeFolder) return;
    const detail = await withAuthRetry(session, onSession, onUnauthorized, (token) =>
      api.undoCollectionItemSale(token, activeFolder.id, folderItemId, quantity),
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

  async function addFolderItemInstant(itemId: string) {
    if (!activeFolder) return;
    const detail = await withAuthRetry(session, onSession, onUnauthorized, (token) =>
      api.updateCollectionFolder(token, activeFolder.id, {
        itemIds: [...activeFolder.items.map(i => i.id), itemId]
      }),
    );
    setActiveFolder(detail);
    setActiveName(detail.name);
    setSelectedItemIds(new Set(detail.items.map((item) => item.id)));
    setMessage("Carta adicionada a colecao.");
  }

  async function toggleFolderItemInstant(itemId: string) {
    if (!activeFolder) return;
    const isPresent = selectedItemIds.has(itemId);
    if (isPresent) {
      const item = activeFolder.items.find(i => i.id === itemId);
      if (item?.folderItemId) {
        await removeFolderItemInstant(item.folderItemId);
      }
    } else {
      await addFolderItemInstant(itemId);
    }
  }

  async function addSelectedCardsToFolder() {
    if (!activeFolder) return;
    try {
      const detail = await withAuthRetry(session, onSession, onUnauthorized, (token) =>
        api.updateCollectionFolder(token, activeFolder.id, {
          itemIds: Array.from(tempSelectedItemIds)
        }),
      );
      setActiveFolder(detail);
      setActiveName(detail.name);
      const nextIds = new Set(detail.items.map((item) => item.id));
      setSelectedItemIds(nextIds);
      setTempSelectedItemIds(new Set(nextIds));
      setShowPickerModal(false);
      setMessage("Cartas adicionadas a colecao.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao adicionar cartas");
    }
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
          const created = await api.createCollectionFolder(token, name, newIsStore);
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
    setBannerUploading(true);
    try {
      let detail = activeFolder;
      
      detail = await withAuthRetry(
        session,
        onSession,
        onUnauthorized,
        (token) =>
          api.updateCollectionFolder(token, activeFolder.id, {
            name: activeName.trim(),
            itemIds: Array.from(selectedItemIds),
          }),
      );

      if (pendingBannerRemoval) {
        detail = await withAuthRetry(session, onSession, onUnauthorized, (token) =>
          api.updateCollectionFolderSharing(token, activeFolder.id, { bannerUrl: null })
        );
      } else if (pendingBannerFile) {
        detail = await withAuthRetry(session, onSession, onUnauthorized, (token) =>
          api.uploadCollectionBanner(token, activeFolder.id, pendingBannerFile)
        );
      }

      setActiveFolder(detail);
      setActiveName(detail.name);
      setSelectedItemIds(new Set(detail.items.map((item) => item.id)));
      setPendingBannerFile(null);
      setPendingBannerRemoval(false);
      await refreshFolders();
      apiFeedback.success("Coleção salva com sucesso.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar colecao");
    } finally {
      setBannerUploading(false);
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

  async function updateFolderSharing(payload: { isPublic?: boolean; bannerUrl?: string | null }) {
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
            ...payload,
            ensureToken: payload.isPublic ?? activeFolder.isPublic,
          }),
      );
      setActiveFolder(detail);
      setActiveName(detail.name);
      setSelectedItemIds(new Set(detail.items.map((item) => item.id)));
      await refreshFolders();
      setMessage("Compartilhamento atualizado.");
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
      setMessage(isStore ? "Objetivo alterado para vender." : "Objetivo alterado para visualizar.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao atualizar objetivo");
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

  function toggleTempItem(itemId: string) {
    setTempSelectedItemIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }

  function confirmSelection() {
    setSelectedItemIds(new Set(tempSelectedItemIds));
    setShowPickerModal(false);
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
  const unsoldCount = useMemo(
    () =>
      selectedItems.reduce(
        (sum, item) => sum + (item.quantity - (item.store?.soldQuantity ?? 0)),
        0,
      ),
    [selectedItems],
  );
  const selectedTotalValue = useMemo(
    () =>
      selectedItems.reduce(
        (sum, item) =>
          sum +
          (item.customPrice ?? item.price?.amount ?? 0) *
            (item.quantity - (item.store?.soldQuantity ?? 0)),
        0,
      ),
    [selectedItems],
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
      void loadFolder(collectionRoute).then(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get("openProposals") === "true") {
          setShowOffersModal(true);
        }
      });
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

  const detailTourSteps = useMemo(() => {
    const pageItems = visibleItems.slice(
      (detailPage - 1) * COLLECTION_DETAIL_PAGE_SIZE,
      detailPage * COLLECTION_DETAIL_PAGE_SIZE,
    );
    const hasPriceInput =
      activeFolder?.isStore &&
      pageItems.some((item) => item.folderItemId && !item.store?.isSold);

    if (hasPriceInput) return COLLECTION_DETAIL_TOUR;

    return COLLECTION_DETAIL_TOUR.filter(
      (step) => step.target !== ".tour-card-price-input",
    );
  }, [activeFolder?.isStore, detailPage, visibleItems]);

  return (
    <div className="grid gap-5">
      <Suspense fallback={null}>
        {screen === "list" && <AppTour tourId="collections_list" steps={COLLECTIONS_LIST_TOUR} />}
        {screen === "create" && <AppTour tourId="collections_create" steps={COLLECTION_CREATE_TOUR} />}
        {screen === "detail" && <AppTour tourId="collections_detail_v2" steps={detailTourSteps} />}
      </Suspense>

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
          restartTour={restartTour}
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
          tempSelectedItemIds={tempSelectedItemIds}
          selectedItems={selectedItems}
          isStore={newIsStore}
          onBack={backToList}
          onNameChange={setNewName}
          onIsStoreChange={setNewIsStore}
          onQueryChange={setPickerQuery}
          onPickerTypeFilter={setPickerTypeFilter}
          onPickerRarityFilter={setPickerRarityFilter}
          onPickerVariantFilter={setPickerVariantFilter}
          onPickerSort={setPickerSort}
          onShowAllChange={setShowAllPickerItems}
          onPickerPageChange={setPickerPage}
          onToggleItem={toggleItem}
          onToggleTempItem={toggleTempItem}
          onConfirmPicker={confirmSelection}
          onOpenCard={setSelectedItem}
          onSubmit={createFolder}
          showPickerModal={showPickerModal}
          onTogglePickerModal={handleTogglePicker}
        />
      )}

      {screen === "detail" && activeFolder && (
        <CollectionDetailScreen
          activeName={activeName}
          hasChanges={
            activeName !== activeFolder.name ||
            pendingBannerFile !== null ||
            (pendingBannerRemoval && activeFolder.bannerUrl !== null)
          }
          selectedItems={selectedItems}
          unsoldCount={unsoldCount}
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
          bannerUrl={pendingBannerRemoval ? null : (pendingBannerFile ? URL.createObjectURL(pendingBannerFile) : activeFolder.bannerUrl ?? null)}
          onBack={backToList}
          onNameChange={setActiveName}
          onSave={() => void saveFolder()}
          onRemoveFolder={() => setShowFolderRemoveConfirm(true)}
          onToggleSharing={(payload) => void updateFolderSharing(payload)}
          onRemoveBanner={() => { setPendingBannerRemoval(true); setPendingBannerFile(null); }}
          onUploadBanner={(file) => { setPendingBannerFile(file); setPendingBannerRemoval(false); }}
          bannerUploading={bannerUploading}
          onToggleStore={(isStore) => void updateFolderStore(isStore)}
          onUpdateSale={(folderItemId, payload) => void updateFolderItemSale(folderItemId, payload)}
          onUndoSale={setUndoingItem}
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
          onRemoveCollectionItem={(itemId) => {
            const item = activeFolder.items.find((i) => i.id === itemId);
            if (item) setItemToRemove(item);
          }}
          onToggleItem={toggleItem}
          onToggleTempItem={toggleTempItem}
          onConfirmPicker={() => void addSelectedCardsToFolder()}
          onOpenCard={setSelectedItem}
          showPickerModal={showPickerModal}
          onTogglePickerModal={handleTogglePicker}
          tempSelectedItemIds={tempSelectedItemIds}
          setSellingItem={setSellingItem}
          onManagePermissions={() => setShowPermissionsModal(true)}
          blockedNavigationAt={blockedNavigationAt}
          restartTour={restartTour}
        />
      )}

      {itemToRemove && (
        <ConfirmationModal
          title="Remover carta da coleção"
          description={`Tem certeza que deseja remover a carta "${itemToRemove.card.name}" desta coleção?`}
          confirmLabel="Remover"
          onConfirm={() => {
            if (itemToRemove.folderItemId) {
              void removeFolderItemInstant(itemToRemove.folderItemId);
            }
          }}
          onCancel={() => setItemToRemove(null)}
        />
      )}

      {showFolderRemoveConfirm && (
        <ConfirmationModal
          title="Excluir coleção"
          description={`Tem certeza que deseja excluir a coleção "${activeFolder?.name}"? Esta ação não pode ser desfeita.`}
          confirmLabel="Excluir coleção"
          onConfirm={() => {
            void removeFolder();
            setShowFolderRemoveConfirm(false);
          }}
          onCancel={() => setShowFolderRemoveConfirm(false)}
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

      {showOffersModal && activeFolder && (
        <OffersModal
          offers={offers}
          onClose={() => setShowOffersModal(false)}
          onDecide={decideOffer}
          onRefresh={refreshOffers}
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

      {undoingItem && activeFolder && (
        <UndoSaleModal
          item={undoingItem}
          onClose={() => setUndoingItem(null)}
          onConfirm={async (quantity) => {
            await undoFolderItemSale(undoingItem.folderItemId!, quantity);
            setUndoingItem(null);
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
        className="animate-soft-pop w-full max-w-md overflow-auto rounded-[26px] border border-card-border bg-card shadow-card"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-card-border/50 px-5 py-4">
          <div>
            <h2 className="text-xl font-black text-foreground">Acessos Privados</h2>
            <p className="text-sm font-semibold text-muted-foreground">Autorize outros usuários a verem esta coleção.</p>
          </div>
          <button
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-xl border border-card-border/40 bg-card text-foreground/80 transition hover:bg-muted/30"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          <form onSubmit={submit} className="grid gap-4">
            <label className="grid gap-2">
              <span className="px-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">E-mail do usuário</span>
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
            <h3 className="text-sm font-black text-foreground">Usuários com acesso</h3>
            {permissions.length === 0 ? (
              <p className="py-4 text-center text-xs font-bold text-muted-foreground">Apenas você tem acesso a esta coleção privada.</p>
            ) : (
              <div className="grid gap-2">
                {permissions.map((perm) => (
                  <div key={perm.id} className="flex items-center justify-between rounded-xl bg-muted/30 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-black text-foreground">{perm.user.name || "Sem nome"}</p>
                      <p className="truncate text-[10px] font-semibold text-muted-foreground">{perm.user.email}</p>
                    </div>
                    <button
                      onClick={() => onRemove(perm.id)}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-500 transition"
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

function UndoSaleModal({
  item,
  onClose,
  onConfirm,
}: {
  item: CollectionItem;
  onClose: () => void;
  onConfirm: (quantity: number) => Promise<void>;
}) {
  const soldQuantity = item.store?.soldQuantity ?? 0;
  const [quantity, setQuantity] = useState(soldQuantity);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      await onConfirm(quantity);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-night/55 px-4 py-6 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className="animate-soft-pop w-full max-w-sm overflow-auto rounded-[26px] border border-card-border bg-card shadow-card"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-card-border/50 px-5 py-4">
          <div>
            <h2 className="text-lg font-black text-foreground">Desfazer venda</h2>
            <p className="text-xs font-semibold text-muted-foreground">{item.card.name}</p>
          </div>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-xl border border-card-border/40 bg-card text-foreground/80 transition hover:bg-muted/30"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5">
          <div className="grid gap-4">
            <p className="text-xs font-bold text-muted-foreground">
              Você tem {soldQuantity} unidades marcadas como vendidas. Quantas deseja retornar ao inventário?
            </p>
            <label className="grid gap-2">
              <span className="px-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Quantidade a devolver</span>
              <input
                className="premium-input w-full"
                type="number"
                min={1}
                max={soldQuantity}
                value={quantity}
                onChange={(e) => setQuantity(Math.min(soldQuantity, Math.max(1, Number(e.target.value))))}
              />
            </label>
            <Button
              type="button"
              variant="primary"
              className="mt-2 w-full bg-red-500 hover:bg-red-600"
              disabled={submitting || quantity < 1}
              onClick={submit}
            >
              Confirmar cancelamento
            </Button>
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
        className="animate-soft-pop w-full max-w-sm overflow-auto rounded-[26px] border border-card-border bg-card shadow-card"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-card-border/50 px-5 py-4">
          <div>
            <h2 className="text-lg font-black text-foreground">Confirmar venda</h2>
            <p className="text-xs font-semibold text-muted-foreground">{item.card.name}</p>
          </div>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-xl border border-card-border/40 bg-card text-foreground/80 transition hover:bg-muted/30"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5">
          <div className="grid gap-4">
            <div className="grid grid-cols-[1fr_80px] gap-3">
              <label className="grid gap-2">
                <span className="px-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Preço unitário</span>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-muted-foreground">R$</span>
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
                <span className="px-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Qtd</span>
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

            <div className="rounded-xl bg-muted/30 p-3 text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total da venda</p>
              <p className="text-xl font-black text-foreground">{formatBrl(Number(price || 0) * quantity)}</p>
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
        className="animate-soft-pop max-h-[80vh] w-full max-w-2xl overflow-auto rounded-[26px] border border-card-border bg-card shadow-card"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-card-border/50 px-5 py-4">
          <div>
            <h2 className="text-xl font-black text-foreground">Propostas de Negociação</h2>
            <p className="text-sm font-semibold text-muted-foreground">Analise e decida sobre as propostas recebidas.</p>
          </div>
          <button
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-xl border border-card-border/40 bg-card text-foreground/80 transition hover:bg-muted/30"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex gap-2 rounded-2xl bg-muted/30 p-1">
              <button
                className={`rounded-xl px-4 py-2 text-xs font-black transition ${filter === "pending" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                onClick={() => setFilter("pending")}
              >
                Pendentes
              </button>
              <button
                className={`rounded-xl px-4 py-2 text-xs font-black transition ${filter === "resolved" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                onClick={() => setFilter("resolved")}
              >
                Resolvidas
              </button>
            </div>
            <Button type="button" onClick={onRefresh} className="h-9 text-xs">Atualizar</Button>
          </div>

          <div className="mt-5 grid gap-4">
            {filteredOffers.length === 0 && (
              <p className="py-10 text-center text-sm font-bold text-muted-foreground">Nenhuma proposta encontrada.</p>
            )}
            {filteredOffers.map((offer) => (
              <div key={offer.id} className="rounded-2xl border border-card-border/50 bg-muted/30 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-muted-foreground text-xs tracking-wider uppercase mb-1">De: {offer.buyerName}</p>
                    <div className="flex items-center gap-3">
                      <p className="text-2xl font-black text-foreground">{formatBrl(offer.totalOffer)}</p>
                      {offer.isGlobalOffer && (
                        <span className="rounded-lg bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/30 dark:border-amber-500/30 dark:text-amber-300 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest shadow-sm">
                          Valor Fechado
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs font-bold text-muted-foreground">
                      {offer.items.length} carta(s) • {formatOfferStatus(offer.status)}
                    </p>
                    {offer.message && (
                      <p className="mt-3 rounded-xl bg-card/70 p-3 text-sm italic text-muted-foreground border border-card-border/30">
                        "{offer.message}"
                      </p>
                    )}
                  </div>
                  {offer.status === "pending" && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        className="h-9 bg-leaf text-white hover:bg-emerald-600 shadow-sm"
                        onClick={() => onDecide(offer.id, "accepted")}
                      >
                        Aceitar
                      </Button>
                      <Button
                        type="button"
                        className="h-9 bg-red-50 text-red-600 border-red-100 hover:bg-red-100 dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/50"
                        onClick={() => onDecide(offer.id, "rejected")}
                      >
                        Rejeitar
                      </Button>
                    </div>
                  )}
                </div>
                <div className="mt-4 space-y-2 border-t border-card-border/30 pt-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Itens da proposta</p>
                  {offer.items.map((entry) => (
                    <div key={entry.item.id} className="flex items-center justify-between text-xs font-bold p-2 rounded-lg">
                      <div className="flex flex-col gap-1">
                        <span className="text-muted-foreground">
                          {entry.quantity}x {entry.item.card.name} - {entry.item.card.setCode}
                        </span>
                        <span className="text-[10px] font-semibold text-muted-foreground">
                          {entry.item.condition} • {getLanguageFlag(entry.item.language)} {entry.item.language} • {formatCardVariant(entry.item.variant)}
                        </span>
                      </div>
                      <span className="text-foreground shrink-0">{offer.isGlobalOffer ? "-" : formatBrl(entry.amount)}</span>
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
  restartTour,
}: {
  folders: CollectionFolderSummary[];
  inventoryCount: number;
  page: number;
  loading: boolean;
  onCreate: () => void;
  onPageChange: (page: number) => void;
  onOpen: (folderId: string) => void;
  restartTour: (tourId: string) => void;
}) {
  const paginatedFolders = useMemo(
    () =>
      folders.slice((page - 1) * FOLDERS_PAGE_SIZE, page * FOLDERS_PAGE_SIZE),
    [folders, page],
  );

  return (
    <>
      <SEO title="Minhas Coleções" />
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="section-title">Colecoes</h2>
              <button
                type="button"
                onClick={() => restartTour("collections_list")}
                className="hidden md:flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-brand/10 hover:text-brand transition-colors dark:bg-white/10"
                title="Ver tutorial novamente"
              >
                <HelpCircle size={14} />
              </button>
            </div>
            <p className="section-copy mt-1">
              Organize seu inventario em pastas separadas.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <InfoPill label="Colecoes" value={folders.length.toString()} />
              <InfoPill label="Inventario" value={`${inventoryCount} cartas`} className="tour-inventory-info" />
            </div>
          </div>
          <Button
            type="button"
            variant="brand"
            icon={<FolderPlus size={16} />}
            onClick={onCreate}
            className="tour-create-collection"
          >
            Nova coleção
          </Button>
        </div>
      </Panel>

      <Panel
        title="Minhas colecoes"
        description="Clique em uma colecao para abrir detalhes, editar cartas e ajustar o nome."
      >
        {folders.length ? (
          <>
            <hr className="mb-4 border-slate-300 dark:border-slate-700"/>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {paginatedFolders.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => onOpen(folder.id)}
                  className="group bg-slate-200 dark:bg-slate-800 rounded-[26px] border border-ink/30 p-5 text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:border-brand/40 hover:shadow-soft"
                >
                  <div className="flex flex-1 items-center gap-4">
                    <span className={`grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br transition ${
                      folder.isStore 
                        ? "bg-aqua dark:bg-slate-700 text-white" 
                        : "bg-aqua dark:bg-slate-700 text-white"
                    }`}>
                      {folder.isStore ? <ShoppingBag size={20} /> : <Layers3 size={20} />}
                    </span>

                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-xl font-black text-foreground">
                        {folder.name}
                      </span>
                      <span className="block text-sm font-semibold text-muted-foreground">
                        {folder.itemCount} cartas - {formatBrl(folder.totalValue)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black ${
                        folder.isStore
                          ? "border-aqua/25 bg-aqua/10 text-aqua"
                          : "border-brand/25 bg-brand/10 text-brand"
                      }`}
                    >
                      {folder.isStore ? <ShoppingBag size={14} /> : <Layers3 size={14} />}
                      {folder.isStore ? "Vender" : "Visualizar"}
                    </span>
                    <span
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black ${
                        folder.isPublic
                          ? "border-leaf/25 bg-leaf/10 text-leaf"
                          : "border-card-border/40 bg-card/60 text-muted-foreground"
                      }`}
                    >
                      {folder.isPublic ? <Eye size={14} /> : <Lock size={14} />}
                      {folder.isPublic ? "Publica" : "Privada"}
                    </span>
                  </div>
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
  tempSelectedItemIds,
  selectedItems,
  isStore,
  onBack,
  onNameChange,
  onIsStoreChange,
  onQueryChange,
  onPickerTypeFilter,
  onPickerRarityFilter,
  onPickerVariantFilter,
  onPickerSort,
  onShowAllChange,
  onPickerPageChange,
  onToggleItem,
  onToggleTempItem,
  onConfirmPicker,
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
  tempSelectedItemIds: Set<string>;
  selectedItems: CollectionItem[];
  isStore: boolean;
  onBack: () => void;
  onNameChange: (value: string) => void;
  onIsStoreChange: (value: boolean) => void;
  onQueryChange: (value: string) => void;
  onPickerTypeFilter: (value: string) => void;
  onPickerRarityFilter: (value: string) => void;
  onPickerVariantFilter: (value: string) => void;
  onPickerSort: (value: CollectionFolderSort) => void;
  onShowAllChange: (value: boolean) => void;
  onPickerPageChange: (page: number) => void;
  onToggleItem: (itemId: string) => void;
  onToggleTempItem: (itemId: string) => void;
  onConfirmPicker: () => void;
  onOpenCard: (item: CollectionItem) => void;
  onSubmit: (event: FormEvent) => void;
  showPickerModal: boolean;
  onTogglePickerModal: (open: boolean) => void;
}) {
  const canCreate = name.trim().length > 0 && selectedCount > 0;

  return (
    <>
      <SEO title="Criar Nova Coleção" />
      <Panel className="pb-32">
        <form onSubmit={onSubmit} className="grid gap-5">
          <ScreenHeader
            eyebrow={isStore ? "Nova Venda" : "Nova Pasta"}
            title={isStore ? "Criar para vender" : "Criar para visualizar"}
            description={isStore 
              ? "Defina um nome, escolha as cartas que deseja vender e comece a receber propostas."
              : "Defina um nome, organize suas cartas e compartilhe sua coleção."
            }
            onBack={onBack}
            action={
              <Button
                type="submit"
                variant={canCreate ? "brand" : "primary"}
                className={canCreate ? "shadow-glow" : ""}
                icon={<Save size={16} />}
                disabled={!canCreate}
              >
                Criar colecao
              </Button>
            }
          />

          <div className="grid gap-6 rounded-[26px] border border-card-border/40 bg-card/60 p-5 shadow-sm lg:grid-cols-[1fr_auto] lg:items-end">
            <label className="grid gap-2">
              <span className="px-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                Nome da pasta
              </span>
              <input
                className="tour-create-name premium-input"
                value={name}
                onChange={(event) => onNameChange(event.target.value)}
                placeholder="Ex: Binder principal"
              />
            </label>
            <div className="grid gap-2">
              <span className="px-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                Modo
              </span>
              <div className="tour-create-mode flex h-auto sm:h-[46px] sm:flex-row items-stretch sm:items-center gap-2 rounded-2xl border border-card-border bg-card p-2">
                <button
                  type="button"
                  onClick={() => onIsStoreChange(false)}
                  className={`flex h-9 sm:h-8 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-xs font-black transition ${
                    !isStore
                      ? "bg-brand text-white shadow-sm"
                      : "text-slate-500 hover:bg-field"
                  }`}
                >
                  <Eye size={14} />
                  Exposição
                </button>
                <button
                  type="button"
                  onClick={() => onIsStoreChange(true)}
                  className={`flex h-9 sm:h-8 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-xs font-black transition ${
                    isStore
                      ? "bg-aqua text-white shadow-sm"
                      : "text-slate-500 hover:bg-field"
                  }`}
                >
                  <ShoppingBag size={14} />
                  Venda
                </button>
              </div>
            </div>
          </div>

          <div className="mt-8 w-full">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-line/50 pb-3">
              <div className="flex items-center gap-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">
                  Preview da seleção
                </h3>
                <div className="flex items-center gap-2 rounded-full border border-lilac/25 bg-lilac/10 px-3 py-1 text-[11px] font-black dark:text-slate-200">
                  <span className="opacity-60">{selectedCount} cartas</span>
                  <span className="h-1 w-1 rounded-full bg-violet-300" />
                  <span>{formatBrl(selectedTotalValue)}</span>
                </div>
              </div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                {selectedItems.length} selecionadas
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">

              <button
              type="button"
              onClick={() =>onTogglePickerModal(true)}
              className={`tour-create-add-cards h-full w-full ${selectedItems.length === 0 ? "min-h-80" : ""} p-4 sm:p-0 flex flex-col items-center justify-center gap-3 rounded-[24px] border border-dashed border-slate-500 dark:border-slate-600 border-line/60 bg-black/6 dark:bg-white/6 text-muted-foreground transition-all hover:border-brand/40 hover:bg-brand/5 hover:text-brand group`}
              >
                <div className="grid h-12 w-12 place-items-center rounded-2xl group-hover:bg-brand/10 transition-colors shadow-sm">
                  <Plus size={30} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest">Adicionar</span>
              </button>

              {selectedItems.map((item) => (
                <CollectionItemCard
                  key={item.id}
                  item={item}
                  price={item.price ?? undefined}
                  onOpen={onOpenCard}
                  onRemove={(it) => onToggleItem(it.id)}
                  removeLabel="Desmarcar"
                />
              ))}
            </div>
          </div>
        </form>
      </Panel>

      {showPickerModal && (
        <Modal 
          title="Selecionar cartas" 
          onClose={() => onTogglePickerModal(false)} 
          maxWidthClass="max-w-6xl"
          footer={tempSelectedItemIds.size > 0 && (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="brand"
                className="px-12 py-3 shadow-glow"
                icon={<Plus size={20} />}
                onClick={onConfirmPicker}
              >
                Adicionar
              </Button>
            </div>
          )}
        >
          <CardPickerPanel
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
            selectedItemIds={tempSelectedItemIds}
            onQueryChange={onQueryChange}
            onPickerTypeFilter={onPickerTypeFilter}
            onPickerRarityFilter={onPickerRarityFilter}
            onPickerVariantFilter={onPickerVariantFilter}
            onPickerSort={onPickerSort}
            onShowAllChange={onShowAllChange}
            onPickerPageChange={onPickerPageChange}
            onToggleItem={onToggleTempItem}
          />
        </Modal>
      )}
    </>
  );
}

function CollectionDetailScreen({
  activeName,
  hasChanges,
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
  tempSelectedItemIds,
  isPublic,
  isStore,
  shareUrl,
  bannerUrl,
  onBack,
  onNameChange,
  onSave,
  onRemoveFolder,
  onToggleSharing,
  onRemoveBanner,
  onUploadBanner,
  bannerUploading,
  onToggleStore,
  onUpdateSale,
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
  onRemoveCollectionItem,
  onToggleItem,
  onToggleTempItem,
  onConfirmPicker,
  onOpenCard,
  showPickerModal,
  onTogglePickerModal,
  setSellingItem,
  onUndoSale,
  onManagePermissions,
  blockedNavigationAt,
  restartTour,
}: {
  activeName: string;
  hasChanges: boolean;
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
  tempSelectedItemIds: Set<string>;
  isPublic: boolean;
  isStore: boolean;
  shareUrl: string | null;
  bannerUrl: string | null;
  onBack: () => void;
  onNameChange: (value: string) => void;
  onSave: () => void;
  onRemoveFolder: () => void;
  onToggleSharing: (payload: { isPublic?: boolean; bannerUrl?: string | null }) => void;
  onRemoveBanner: () => void;
  onUploadBanner: (file: File) => void;
  bannerUploading: boolean;
  onToggleStore: (isStore: boolean) => void;
  onUpdateSale: (folderItemId: string, payload: { manualPrice?: number | null; isSold?: boolean; soldPrice?: number | null }) => void;
  onCopyShareLink: () => void;
  onUndoSale: (item: CollectionItem) => void;
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
  onRemoveCollectionItem: (itemId: string) => void;
  onToggleItem: (itemId: string) => void;
  onToggleTempItem: (itemId: string) => void;
  onConfirmPicker: () => void;
  onOpenCard: (item: CollectionItem) => void;
  showPickerModal: boolean;
  onTogglePickerModal: (open: boolean) => void;
  setSellingItem: (item: CollectionItem | null) => void;
  onManagePermissions: () => void;
  blockedNavigationAt?: number;
  restartTour: (tourId: string) => void;
}) {
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shouldShake, setShouldShake] = useState(false);

  useEffect(() => {
    if (blockedNavigationAt && blockedNavigationAt > 0) {
      setShouldShake(true);
      const timer = setTimeout(() => setShouldShake(false), 800);
      return () => clearTimeout(timer);
    }
  }, [blockedNavigationAt]);

  const handleCopy = () => {
    if (!shareUrl) return;
    onCopyShareLink();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
      <SEO 
        title={activeName} 
        description={`${unsoldCount} cartas - Valor total: ${formatBrl(selectedTotalValue)}`}
        image={bannerUrl || undefined}
      />
        <div className="mb-0 overflow-hidden rounded-[32px] border border-line/80 bg-white/70 shadow-sm w-full">
          <div className={`relative w-full overflow-hidden bg-field dark:bg-slate-900 ${bannerUrl ? "aspect-[21/9] sm:aspect-[4/1]": "min-h-32"}`}>
            {bannerUrl && (
               <img 
                src={bannerUrl} 
                alt="Banner da Coleção" 
                className="h-full w-full object-cover opacity-80 transition-opacity hover:opacity-100" 
                onError={(e) => (e.currentTarget.parentElement!.style.display = 'none')}
              /> 
            )}
            
            <label className="tour-banner-upload absolute right-6 bottom-6 cursor-pointer text-[10px] font-black text-slate-600 dark:text-white bg-slate-300 dark:bg-black/40 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20 hover:bg-black/60 transition uppercase tracking-wider">
              {bannerUploading ? "Enviando..." : (bannerUrl ? <>Alterar Banner<Pencil size={12} className="ml-1 inline" /></> : <>Adicionar Banner<Plus className="text-brand ml-1 inline" size={16} /></>)} 
              <input
                type="file"
                className="hidden"
                accept="image/*"
                disabled={bannerUploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onUploadBanner(file);
                  e.target.value = "";
                }}
              />
            </label>
            
            {bannerUrl && (
              <div className="absolute right-6 top-6">
                <button
                  type="button"
                  className="grid h-10 w-10 place-items-center rounded-xl border border-white/20 bg-red-500/40 text-white backdrop-blur-md transition hover:bg-red-500 hover:border-red-500 shadow-lg"
                  onClick={() => onRemoveBanner()}
                  title="Remover Banner"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            )}
          </div>
        </div>

      <Panel>
        <div className="grid gap-8">
          <div className="flex flex-col gap-4">
            <button 
              type="button"
              onClick={onBack}
              className="flex flex-col sm:flex-row items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-brand transition w-fit"
            >
              <div className="flex flex-row gap-2">
                <ArrowLeft size={14} />
                Voltar para coleções
              </div>

              <div className="flex flex-wrap items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); restartTour("collections_detail_v2"); }}
                  className="hidden md:flex items-center gap-2 rounded-full border border-lilac/25 bg-lilac/10 px-3 py-1.5 text-xs font-black text-muted-foreground hover:bg-brand/10 hover:text-brand transition-colors"
                  title="Ver tutorial novamente"
                >
                  <HelpCircle size={14} />
                </button>
                <div className="flex items-center gap-2 rounded-full border border-lilac/25 bg-lilac/10 px-4 py-1.5 text-xs font-black text-violet-900 dark:text-white/60">
                  <span>{unsoldCount} cartas</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-300" />
                  <span>{formatBrl(selectedTotalValue)}</span>
                </div>
                {/* {pendingOffersCount > 0 && (
                  <div className="flex items-center gap-2 rounded-full border border-aqua/25 bg-aqua/10 px-4 py-1.5 text-xs font-black text-sky-700">
                    <ShoppingBag size={14} />
                    {pendingOffersCount} propostas pendentes
                  </div>
                )} */}
              </div>
            </button>
            

            <div className="flex flex-wrap justify-start items-start lg:justify-between flex-col md:flex-row gap-6">
               <div className="flex-1 min-w-0">
                 {isEditingName ? (
                   <div className="flex items-center gap-2 max-w-[80%] md:max-w-[70%]">
                     <input
                       autoFocus
                       className="premium-input text-2xl sm:text-4xl font-black py-2"
                       value={activeName}
                       onChange={(e) => onNameChange(e.target.value)}
                       onKeyDown={(e) => {
                         if (e.key === 'Enter') setIsEditingName(false);
                         if (e.key === 'Escape') setIsEditingName(false);
                       }}
                       onBlur={() => setIsEditingName(false)}
                     />
                     <button 
                       onClick={() => setIsEditingName(false)}
                       className="p-2 bg-leaf rounded-2xl text-white shadow-lg shrink-0 transition hover:scale-50"
                     >
                       <Check size={20} />
                     </button>
                   </div>
                 ) : (
                   <div className="flex items-center justify-start gap-4 group">
                     <div 
                       className="tour-edit-name text-2xl font-black text-ink dark:text-white sm:text-5xl cursor-pointer hover:text-brand transition"
                       onClick={() => setIsEditingName(true)}
                     >
                       {activeName}
                     </div>
                     <button 
                        onClick={() => setIsEditingName(true)}
                        className="grid border h-10 w-10 place-items-center rounded-xl text-muted-foreground group-hover:opacity-100 transition"
                     >
                        <Pencil className="text-black dark:text-white" size={18} />
                     </button>
                   </div>
                   )}
                   </div>

                   <div className="flex flex-wrap gap-2 flex-col items-end sm:flex-row absolute top-4 right-4">
                   <Button
                    type="button"
                    variant="light"
                    className={`tour-save-folder w-16 md:w-auto md:px-6 p-0 gap-0 lg:gap-2 ${hasChanges ? "shadow-glow" : " pointer-events-none"}`}
                    icon={<Save strokeWidth={2} size={20} />}
                    onClick={onSave}
                    disabled={!hasChanges}
                    shake={shouldShake}
                   >
                   <p className="hidden lg:flex">
                     Salvar alterações
                   </p>
                   </Button>
                   <Button
                    type="button"
                    variant="ghost"
                    className="tour-delete-folder w-16 p-0 gap-0 text-white hover:text-red-500 hover:bg-red-50 bg-red-500/80"
                    icon={<Trash2 size={20} />}
                    onClick={onRemoveFolder}
                   >
                   </Button>
                   </div>

            </div>
          </div>



          <CollapsibleSection
            title="Compartilhar"
            className="tour-share-collection"
            defaultExpanded={false}

            action={
              <label className="inline-flex w-full flex-row justify-end cursor-pointer items-center gap-3 text-sm font-black text-slate-700 dark:text-slate-200" onClick={(e) => e.stopPropagation()}>
                {/* <span className="hidden sm:inline"> <Lock size={14} /></span> */}
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={isPublic}
                  onChange={(event) => onToggleSharing({ isPublic: event.target.checked })}
                />
                <span className="relative h-7 w-12 rounded-full bg-slate-300 transition after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition peer-checked:bg-leaf peer-checked:after:translate-x-5" />
                {/* <span className="hidden sm:inline"><Unlock size={14} /></span> */}
              </label>
            }
          >
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black ${
                      isPublic
                        ? "border-leaf/25 bg-leaf/10 text-emerald-800 dark:text-emerald-500"
                        : "border-line/70 dark:border-slate-300 bg-white/70 dark:bg-slate-800 text-slate-500 dark:text-slate-300"
                    }`}
                  >
                    {isPublic ? <Eye size={14} /> : <Lock size={14} />}
                    {isPublic ? "Publica" : "Privada"}
                  </span>
                </div>

                {isPublic && (
                  <div className="mt-4 grid gap-5 border-t border-line/40 pt-4">
                    <div className="grid gap-1.5 min-w-0">
                      <span className="px-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                        Link de compartilhamento (WhatsApp)
                      </span>
                      <div className="relative flex items-center min-w-0 w-full">
                        <p className="flex-1 truncate rounded-xl bg-slate-50 dark:bg-slate-800 py-3 pl-3 pr-10 text-sm font-semibold text-muted-foreground border border-line/40">
                          {shareUrl ?? "Nenhum link gerado"}
                        </p>
                        <button
                          type="button"
                          onClick={handleCopy}
                          className={`absolute right-2 p-2 rounded-lg transition-colors ${
                            copied ? "text-emerald-600 bg-emerald-50" : "text-muted-foreground hover:text-ink hover:bg-slate-100"
                          }`}
                          title="Copiar link"
                        >
                          {copied ? <Check size={18} /> : <Copy size={18} />}
                        </button>
                        {copied && (
                          <span className="absolute -top-6 right-0 text-[10px] font-bold text-emerald-600 animate-fade-up">
                            Copiado!
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 self-start lg:mt-1">
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
                {isPublic && !shareUrl && (
                  <Button
                    type="button"
                    icon={<Share2 size={16} />}
                    onClick={onCopyShareLink}
                  >
                    Gerar link
                  </Button>
                )}
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection 
            title="Vender" 
            className="tour-visibility-settings"
            defaultExpanded={isStore?false:false}
            action={
              <label className={`${pendingOffersCount > 0 ? "justify-between" : "justify-end"} inline-flex w-full cursor-pointer items-center  gap-3 text-sm font-black  dark:text-slate-400`} onClick={(e) => e.stopPropagation()}>
                {/* <span className="hidden sm:inline">Visualizar</span> */}
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={isStore}
                  onChange={(event) => onToggleStore(event.target.checked)}
                />
                {pendingOffersCount > 0 && (
                  <span className="ml-2 rounded-full bg-red-500 px-2 py-0.5 text-[10px] text-white">
                    {pendingOffersCount}
                  </span>
                )}
                <span className="relative h-7 w-12 rounded-full bg-slate-300 transition after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition peer-checked:bg-leaf peer-checked:after:translate-x-5" />
                {/* <span className="hidden sm:inline">Vender</span> */}
              </label>
            }
          >
            <div className="grid gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="section-copy mt-1">
                    Mude para permitir preços manuais, lances e propostas se desejar vender as cartas.
                  </p>
                </div>
              </div>

              {isStore && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-aqua/20 bg-aqua/5 p-4">
                  <div>
                    <h4 className="font-black text-ink dark:text-slate-400">Propostas e Negociações</h4>
                  <p className="text-sm font-semibold text-slate-500">
                    Gerencie as ofertas e negociações desta coleção.
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
          </CollapsibleSection>

          <div className="tour-collection-filters flex flex-col items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowFiltersModal(true)}
                icon={<Filter size={18} />}
                className={(typeFilter || rarityFilter || variantFilter) ? "border-brand/40 text-brand w-full bg-slate-200/80 dark:bg-slate-800" : "bg-slate-200/80 dark:bg-slate-800 w-full"}
              >
                Filtros e Ordenação
              </Button>
            </div>
          </div >

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
                      <option value="proposals-desc">Mais propostas</option>
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

          <div className="rounded-2xl border border-lilac/25 bg-lilac/10 px-4 py-3 text-sm font-black text-slate-600 dark:text-slate-400">
            {visibleItems.length} de {unsoldCount} cartas visiveis
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 mt-6">
            <button
              type="button"
              onClick={() => onTogglePickerModal(true)}
              className={`tour-add-cards h-full w-full ${paginatedVisibleItems.length === 0 ? "min-h-96" : ""} p-4 sm:p-0 flex flex-col items-center justify-center gap-3 rounded-[24px] border border-dashed border-slate-500 dark:border-slate-600 border-line/60 bg-black/6 dark:bg-white/6 text-muted-foreground transition-all hover:border-brand/40 hover:bg-brand/5 hover:text-brand group`}
            >
              <div className="grid h-12 w-12 place-items-center rounded-2xl group-hover:bg-brand/10 transition-colors shadow-sm">
                <Plus size={30} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest">Adicionar</span>
            </button>

            {paginatedVisibleItems.map((item, index) => (
              <CollectionItemCard
                key={item.id}
                item={item}
                className={index === 0 ? "tour-card-item" : ""}
                price={item.price ?? undefined}

                onOpen={onOpenCard}
                onPriceChange={
                  isStore && item.folderItemId
                    ? (amount) => debouncedUpdates(item.folderItemId!, amount)
                    : undefined
                }
                onRemove={(nextItem) => onRemoveCollectionItem(nextItem.id)}
                removeLabel="Remover da colecao"
              >
                {isStore && item.folderItemId && (
                  <div className="flex items-center justify-center">
                    {!item.store?.isSold && (
                      <Button
                        type="button"
                        variant="primary"
                        className="h-9 w-full text-[11px] text-white dark: bg-emerald-600/70 dark:bg-emerald-900/60 hover:bg-emerald-600"
                        onClick={() => setSellingItem(item)}
                      >
                        Vender
                      </Button>
                    )}
                    {(item.store?.isSold || (item.store?.soldQuantity ?? 0) > 0) && (
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 w-full text-[10px] text-slate-500 hover:text-red-500"
                        onClick={() => onUndoSale(item)}
                      >
                        Desfazer venda
                      </Button>
                    )}
                  </div>
                )}
              </CollectionItemCard>
            ))}
          </div>

          {visibleItems.length === 0 && (
            <div className="mt-8">
              <EmptyState>
                Nenhuma carta aparece com os filtros atuais.
              </EmptyState>
            </div>
          )}

          {visibleItems.length > 0 && (
            <PaginationControls
              page={detailPage}
              pageSize={COLLECTION_DETAIL_PAGE_SIZE}
              totalItems={visibleItems.length}
              onPageChange={onDetailPageChange}
              itemLabel="cartas"
            />
          )}

          {/* <div className="mt-8 flex justify-center">
            <Button
              type="button"
              variant="primary"
              className="px-8 shadow-glow"
              icon={<Plus size={20} />}
              onClick={() => onTogglePickerModal(true)}
            >
              Adicionar carta
            </Button>
          </div> */}
        </div>
      </Panel>

      {showPickerModal && (
        <Modal 
          title="Adicionar cartas" 
          onClose={() => onTogglePickerModal(false)} 
          maxWidthClass="max-w-6xl"
          footer={tempSelectedItemIds.size > 0 && (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="brand"
                className="px-12 py-3 shadow-glow"
                icon={<Plus size={20} />}
                onClick={onConfirmPicker}
              >
                Adicionar
              </Button>
            </div>
          )}
        >
          <CardPickerPanel
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
            selectedItemIds={tempSelectedItemIds}
            onQueryChange={onQueryChange}
            onPickerTypeFilter={onPickerTypeFilter}
            onPickerRarityFilter={onPickerRarityFilter}
            onPickerVariantFilter={onPickerVariantFilter}
            onPickerSort={onPickerSort}
            onShowAllChange={onShowAllChange}
            onPickerPageChange={onPickerPageChange}
            onToggleItem={onToggleTempItem}
          />
        </Modal>
      )}
    </>
  );
}

function CardPickerPanel({
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
  onPickerTypeFilter,
  onPickerRarityFilter,
  onPickerVariantFilter,
  onPickerSort,
}: {
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
}) {
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const paginatedPickerItems = useMemo(
    () =>
      pickerItems.slice(
        (pickerPage - 1) * PICKER_PAGE_SIZE,
        pickerPage * PICKER_PAGE_SIZE,
      ),
    [pickerItems, pickerPage],
  );

  return (
    <div className="relative p-5">
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
          {selectedItemIds.size} selecionadas
        </div>
      </div>

      <div className="relative flex gap-2 flex-col md:flex-row">
        <label className="relative block w-full">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
            size={18}
          />
          <input
            className="premium-input w-full pl-11 pr-20"
            value={pickerQuery}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Buscar por nome, numero, colecao..."
          />
          {pickerQuery && (
            <button
              type="button"
              onClick={() => onQueryChange("")}
              className="absolute right-10 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={18} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowFiltersModal(true)}
            className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-colors ${
              (pickerTypeFilter || pickerRarityFilter || pickerVariantFilter) 
                ? "text-brand bg-brand/10" 
                : "text-muted-foreground hover:text-white hover:bg-white/5"
            }`}
            title="Filtros e Ordenação"
          >
            <Filter size={20} />
          </button>
        </label>

        <Button
          type="button"
          variant="ghost"
          className="text-slate-700 dark:text-slate-300 border-slate-500 hover:text-slate-700 text-sm justify-start "
          icon={showAllPickerItems ? <X size={14} /> : <Plus size={14} />}
          onClick={() => onShowAllChange(!showAllPickerItems)}
        >
          {showAllPickerItems ? "Ocultar lista" : "Mostrar todas as cartas"}
        </Button>
      </div>

      {showFiltersModal && (
        <Modal title="Filtros e Ordenação" onClose={() => setShowFiltersModal(false)} maxWidthClass="max-w-xl" zIndexClass="z-[110]">
          <div className="grid gap-5 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
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
                  <option value="proposals-desc">Mais propostas</option>
                </select>
              </FilterField>
            </div>
            
            <div className="flex gap-3 pt-2">
              <Button 
                type="button" 
                className="flex-1"
                variant="ghost"
                onClick={() => {
                  onPickerTypeFilter("");
                  onPickerRarityFilter("");
                  onPickerVariantFilter("");
                  onPickerSort("newest");
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

      {pickerItems.length ? (
        <>
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-7">
            {paginatedPickerItems.map((item) => (
              <SimpleCardPickerItem
                key={item.id}
                item={item}
                selected={selectedItemIds.has(item.id)}
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
    </div>
  );
}

function ScreenHeader({
  eyebrow,
  title,
  description,
  onBack,
  action,
  notification,
  tourId,
}: {
  eyebrow: string;
  title: string;
  description: string;
  onBack: () => void;
  action?: ReactNode;
  notification?: boolean;
  tourId?: string;
}) {
  const { restartTour } = useTour();
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-line/80 bg-white/80 text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/35 dark:bg-night dark:text-white"
          aria-label="Voltar"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
              {eyebrow}
            </p>
            {tourId && (
              <button
                onClick={() => restartTour(tourId)}
                className="hidden md:flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-brand/10 hover:text-brand transition-colors"
                title="Ver tutorial novamente"
              >
                <HelpCircle size={14} />
              </button>
            )}
          </div>
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
  if (sort === "proposals-desc") {
    return [...items].sort(
      (left, right) => (right.store?.proposalsCount ?? 0) - (left.store?.proposalsCount ?? 0),
    );
  }
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

function formatOfferStatus(status: string): string {
  if (status === "accepted") return "aceita";
  if (status === "rejected") return "rejeitada";
  return "pendente";
}

function getLanguageFlag(language: string): string {
  switch (language) {
    case "pt-BR":
      return "🇧🇷";
    case "en":
      return "🇺🇸";
    case "ja":
      return "🇯🇵";
    default:
      return "🏳️";
  }
}

function publicCollectionUrl(shareToken: string): string {
  // Use o domínio atual para links profissionais e curtos
  const baseUrl = window.location.origin;
  return `${baseUrl}/p/${encodeURIComponent(shareToken)}`;
}

function InfoPill({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <span className={`rounded-full border border-line/70 bg-white/70 dark:bg-slate-900 px-4 py-2 text-sm font-black text-slate-500 shadow-sm ${className}`}>
      <span className="text-muted-foreground">{label}: </span>
      {value}
    </span>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="mt-5 rounded-[24px] border border-line/80 bg-white/70 dark:bg-slate-900 p-5 text-sm font-bold text-slate-500 shadow-sm">
      {children}
    </div>
  );
}
