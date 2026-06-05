import type {
  CardCondition,
  CardLanguage,
  CardSetSummary,
  CardSummary,
  CollectionAddResult,
  CollectionCartOffer,
  CollectionFolderDetail,
  CollectionFolderSort,
  CollectionFolderSummary,
  CollectionItem,
  DeckArchetypeSummary,
  DeckAiAnalysis,
  DeckDetail,
  DeckFormat,
  DeckGenerationMode,
  DeckSuggestion,
  DeckSummary,
  DeckValidationSnapshot,
  PriceEstimate,
  PublicCollectionDetail,
  RecognitionCandidate,
} from "@poke-organizer/shared";

const API_URL =
  import.meta.env.VITE_API_URL ?? "https://poke-organizer-api.onrender.com";

export type Session = {
  user: { id: string; email: string; name?: string | null };
  accessToken: string;
  refreshToken: string;
};

export type ApiError = {
  message: string;
};

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type ApiFeedbackListener = (event: ApiFeedbackEvent) => void;
type ApiFeedbackEvent =
  | { type: "pending"; pending: number }
  | { type: "error"; id: number; message: string };

let pendingRequests = 0;
let feedbackEventId = 0;
const feedbackListeners = new Set<ApiFeedbackListener>();

export const apiFeedback = {
  subscribe(listener: ApiFeedbackListener) {
    feedbackListeners.add(listener);
    listener({ type: "pending", pending: pendingRequests });
    return () => {
      feedbackListeners.delete(listener);
    };
  },
  getPendingCount() {
    return pendingRequests;
  },
};

type RequestOptions = RequestInit & {
  token?: string;
  silentError?: boolean;
};

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { token, silentError, ...fetchOptions } = options;
  startRequest();

  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...fetchOptions,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...fetchOptions.headers,
      },
    });

    if (!response.ok) {
      const error = (await response
        .json()
        .catch(() => ({ message: response.statusText }))) as ApiError;
      throw new HttpError(
        Array.isArray(error.message) ? error.message.join(", ") : error.message,
        response.status,
      );
    }

    return response.json() as Promise<T>;
  } catch (err) {
    if (!silentError && shouldNotifyError(err)) {
      emitFeedback({
        type: "error",
        id: ++feedbackEventId,
        message: friendlyErrorMessage(err),
      });
    }
    throw err;
  } finally {
    finishRequest();
  }
}

function startRequest() {
  pendingRequests += 1;
  emitFeedback({ type: "pending", pending: pendingRequests });
}

function finishRequest() {
  pendingRequests = Math.max(0, pendingRequests - 1);
  emitFeedback({ type: "pending", pending: pendingRequests });
}

function emitFeedback(event: ApiFeedbackEvent) {
  feedbackListeners.forEach((listener) => listener(event));
}

function shouldNotifyError(err: unknown): boolean {
  return !(err instanceof HttpError && err.status === 401);
}

function friendlyErrorMessage(err: unknown): string {
  if (err instanceof HttpError) {
    if (err.status >= 500) {
      return "A API encontrou um problema. Tente novamente em instantes.";
    }
    if (err.status === 403) {
      return "Voce nao tem permissao para fazer essa acao.";
    }
    if (err.status === 404) {
      return "Nao encontramos essas informacoes. Confira se o link ou item ainda existe.";
    }
    return err.message || "Nao foi possivel concluir a acao.";
  }

  if (err instanceof TypeError) {
    return "A API demorou ou nao respondeu. Tente novamente em instantes.";
  }

  return err instanceof Error
    ? err.message
    : "Nao foi possivel concluir a acao.";
}

export const api = {
  login(email: string, password: string) {
    return request<Session>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },
  register(email: string, password: string, name?: string) {
    return request<Session>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    });
  },
  refresh(refreshToken: string) {
    return request<Session>("/auth/refresh", {
      method: "POST",
      silentError: true,
      body: JSON.stringify({ refreshToken }),
    });
  },
  searchCards(params: {
    query?: string;
    number?: string;
    set?: string;
    language?: string;
  }) {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) search.set(key, value);
    });
    return request<CardSummary[]>(`/cards/search?${search.toString()}`);
  },
  listCardSets() {
    return request<CardSetSummary[]>("/cards/sets");
  },
  getPrice(
    cardId: string,
    params: {
      variant?: string;
      language?: CardLanguage;
      condition?: CardCondition;
    } = {},
  ) {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) search.set(key, value);
    });
    const suffix = search.toString() ? `?${search.toString()}` : "";
    return request<PriceEstimate>(
      `/prices/${encodeURIComponent(cardId)}${suffix}`,
      { silentError: true },
    );
  },
  listCollection(token: string, params: { limit?: number } = {}) {
    const search = new URLSearchParams();
    if (params.limit) search.set("limit", String(params.limit));
    const suffix = search.toString() ? `?${search.toString()}` : "";
    return request<CollectionItem[]>(`/collection${suffix}`, { token });
  },
  addCollection(token: string, payload: Record<string, unknown>) {
    return request<CollectionAddResult>("/collection", {
      method: "POST",
      token,
      body: JSON.stringify(payload),
    });
  },
  updateCollection(
    token: string,
    id: string,
    payload: Record<string, unknown>,
  ) {
    return request<CollectionItem>(`/collection/${id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify(payload),
    });
  },
  deleteCollection(token: string, id: string) {
    return request<{ ok: true }>(`/collection/${id}`, {
      method: "DELETE",
      token,
    });
  },
  listCollectionFolders(token: string) {
    return request<CollectionFolderSummary[]>("/collection/folders", { token });
  },
  createCollectionFolder(token: string, name: string) {
    return request<CollectionFolderDetail>("/collection/folders", {
      method: "POST",
      token,
      body: JSON.stringify({ name }),
    });
  },
  getCollectionFolder(
    token: string,
    id: string,
    params: {
      type?: string;
      rarity?: string;
      variant?: string;
      sort?: CollectionFolderSort;
    } = {},
  ) {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) search.set(key, value);
    });
    const suffix = search.toString() ? `?${search.toString()}` : "";
    return request<CollectionFolderDetail>(
      `/collection/folders/${encodeURIComponent(id)}${suffix}`,
      { token },
    );
  },
  updateCollectionFolder(
    token: string,
    id: string,
    payload: { name?: string; itemIds?: string[] },
  ) {
    return request<CollectionFolderDetail>(
      `/collection/folders/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        token,
        body: JSON.stringify(payload),
      },
    );
  },
  updateCollectionFolderSharing(
    token: string,
    id: string,
    payload: { isPublic?: boolean; ensureToken?: boolean },
  ) {
    return request<CollectionFolderDetail>(
      `/collection/folders/${encodeURIComponent(id)}/sharing`,
      {
        method: "PATCH",
        token,
        body: JSON.stringify(payload),
      },
    );
  },
  updateCollectionFolderStore(
    token: string,
    id: string,
    payload: { isStore?: boolean },
  ) {
    return request<CollectionFolderDetail>(
      `/collection/folders/${encodeURIComponent(id)}/store`,
      {
        method: "PATCH",
        token,
        body: JSON.stringify(payload),
      },
    );
  },
  updateCollectionFolderItemSale(
    token: string,
    folderId: string,
    folderItemId: string,
    payload: { manualPrice?: number | null; isSold?: boolean; soldPrice?: number | null },
  ) {
    return request<CollectionFolderDetail>(
      `/collection/folders/${encodeURIComponent(folderId)}/items/${encodeURIComponent(folderItemId)}/sale`,
      {
        method: "PATCH",
        token,
        body: JSON.stringify(payload),
      },
    );
  },
  finishCollectionItemAuction(token: string, folderId: string, folderItemId: string) {
    return request<CollectionFolderDetail>(
      `/collection/folders/${encodeURIComponent(folderId)}/items/${encodeURIComponent(folderItemId)}/finish-auction`,
      {
        method: "POST",
        token,
      },
    );
  },
  listCollectionOffers(token: string, folderId: string) {
    return request<CollectionCartOffer[]>(
      `/collection/folders/${encodeURIComponent(folderId)}/offers`,
      { token },
    );
  },
  decideCollectionOffer(
    token: string,
    folderId: string,
    offerId: string,
    status: "accepted" | "rejected",
  ) {
    return request<CollectionCartOffer>(
      `/collection/folders/${encodeURIComponent(folderId)}/offers/${encodeURIComponent(offerId)}`,
      {
        method: "PATCH",
        token,
        body: JSON.stringify({ status }),
      },
    );
  },
  deleteCollectionFolder(token: string, id: string) {
    return request<{ ok: true }>(
      `/collection/folders/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        token,
      },
    );
  },
  getPublicCollection(
    shareToken: string,
    params: {
      type?: string;
      rarity?: string;
      variant?: string;
      sort?: CollectionFolderSort;
    } = {},
  ) {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) search.set(key, value);
    });
    const suffix = search.toString() ? `?${search.toString()}` : "";
    return request<PublicCollectionDetail>(
      `/public/collections/${encodeURIComponent(shareToken)}${suffix}`,
    );
  },
  createPublicCollectionBid(
    token: string,
    shareToken: string,
    folderItemId: string,
    amount: number,
  ) {
    return request<PublicCollectionDetail>(
      `/public/collections/${encodeURIComponent(shareToken)}/items/${encodeURIComponent(folderItemId)}/bids`,
      {
        method: "POST",
        token,
        body: JSON.stringify({ amount }),
      },
    );
  },
  createPublicCollectionOffer(
    token: string,
    shareToken: string,
    payload: {
      message?: string;
      items: Array<{ folderItemId: string; quantity?: number; amount: number }>;
    },
  ) {
    return request<CollectionCartOffer>(
      `/public/collections/${encodeURIComponent(shareToken)}/offers`,
      {
        method: "POST",
        token,
        body: JSON.stringify(payload),
      },
    );
  },
  recognitionCandidates(payload: {
    text: string;
    nameHint?: string;
    numberHint?: string;
  }) {
    return request<RecognitionCandidate[]>("/recognition/candidates", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  listDecks(token: string) {
    return request<DeckSummary[]>("/decks", { token });
  },
  createDeck(
    token: string,
    payload: {
      name: string;
      format?: DeckFormat;
      generationMode?: DeckGenerationMode;
      archetypeId?: string | null;
      cards?: Array<{ cardId: string; quantity: number; source?: "owned" | "missing" }>;
    },
  ) {
    return request<DeckDetail>("/decks", {
      method: "POST",
      token,
      body: JSON.stringify(payload),
    });
  },
  getDeck(token: string, id: string) {
    return request<DeckDetail>(`/decks/${encodeURIComponent(id)}`, { token });
  },
  updateDeck(
    token: string,
    id: string,
    payload: {
      name?: string;
      format?: DeckFormat;
      generationMode?: DeckGenerationMode;
      archetypeId?: string | null;
      cards?: Array<{ cardId: string; quantity: number; source?: "owned" | "missing" }>;
    },
  ) {
    return request<DeckDetail>(`/decks/${encodeURIComponent(id)}`, {
      method: "PATCH",
      token,
      body: JSON.stringify(payload),
    });
  },
  deleteDeck(token: string, id: string) {
    return request<{ ok: true }>(`/decks/${encodeURIComponent(id)}`, {
      method: "DELETE",
      token,
    });
  },
  validateDeck(token: string, id: string) {
    return request<DeckValidationSnapshot>(
      `/decks/${encodeURIComponent(id)}/validate`,
      {
        method: "POST",
        token,
      },
    );
  },
  analyzeDeckWithAi(token: string, id: string) {
    return request<DeckAiAnalysis>(
      `/decks/${encodeURIComponent(id)}/ai-analysis`,
      {
        method: "POST",
        token,
      },
    );
  },
  generateBestDeck(
    token: string,
    payload: {
      format?: DeckFormat;
      mode?: DeckGenerationMode;
      preferredTypes?: string[];
      maxSuggestions?: number;
    },
  ) {
    return request<DeckSuggestion[]>("/decks/generate-best", {
      method: "POST",
      token,
      body: JSON.stringify(payload),
    });
  },
  listDeckArchetypes(token: string) {
    return request<DeckArchetypeSummary[]>("/deck-archetypes", { token });
  },
  syncMetagame(token: string, payload: { includeLimitless?: boolean } = {}) {
    return request<{
      id: string;
      source: string;
      status: string;
      message?: string | null;
      totalArchetypes: number;
      createdAt: string;
      finishedAt?: string | null;
    }>("/metagame/sync", {
      method: "POST",
      token,
      body: JSON.stringify(payload),
    });
  },
};
