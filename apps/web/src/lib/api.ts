import type {
  CardCondition,
  CardLanguage,
  CardSetSummary,
  CardSummary,
  CollectionAddResult,
  CollectionFolderDetail,
  CollectionFolderSort,
  CollectionFolderSummary,
  CollectionItem,
  PriceEstimate,
  RecognitionCandidate
} from "@poke-organizer/shared";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3333";

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
    readonly status: number
  ) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit & { token?: string } = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...options.headers
    }
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => ({ message: response.statusText }))) as ApiError;
    throw new HttpError(Array.isArray(error.message) ? error.message.join(", ") : error.message, response.status);
  }

  return response.json() as Promise<T>;
}

export const api = {
  login(email: string, password: string) {
    return request<Session>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
  },
  register(email: string, password: string, name?: string) {
    return request<Session>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name })
    });
  },
  refresh(refreshToken: string) {
    return request<Session>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken })
    });
  },
  searchCards(params: { query?: string; number?: string; set?: string; language?: string }) {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) search.set(key, value);
    });
    return request<CardSummary[]>(`/cards/search?${search.toString()}`);
  },
  listCardSets() {
    return request<CardSetSummary[]>("/cards/sets");
  },
  getPrice(cardId: string, params: { variant?: string; language?: CardLanguage; condition?: CardCondition } = {}) {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) search.set(key, value);
    });
    const suffix = search.toString() ? `?${search.toString()}` : "";
    return request<PriceEstimate>(`/prices/${encodeURIComponent(cardId)}${suffix}`);
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
      body: JSON.stringify(payload)
    });
  },
  updateCollection(token: string, id: string, payload: Record<string, unknown>) {
    return request<CollectionItem>(`/collection/${id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify(payload)
    });
  },
  deleteCollection(token: string, id: string) {
    return request<{ ok: true }>(`/collection/${id}`, {
      method: "DELETE",
      token
    });
  },
  listCollectionFolders(token: string) {
    return request<CollectionFolderSummary[]>("/collection/folders", { token });
  },
  createCollectionFolder(token: string, name: string) {
    return request<CollectionFolderDetail>("/collection/folders", {
      method: "POST",
      token,
      body: JSON.stringify({ name })
    });
  },
  getCollectionFolder(
    token: string,
    id: string,
    params: { type?: string; rarity?: string; variant?: string; sort?: CollectionFolderSort } = {}
  ) {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) search.set(key, value);
    });
    const suffix = search.toString() ? `?${search.toString()}` : "";
    return request<CollectionFolderDetail>(`/collection/folders/${encodeURIComponent(id)}${suffix}`, { token });
  },
  updateCollectionFolder(token: string, id: string, payload: { name?: string; itemIds?: string[] }) {
    return request<CollectionFolderDetail>(`/collection/folders/${encodeURIComponent(id)}`, {
      method: "PATCH",
      token,
      body: JSON.stringify(payload)
    });
  },
  deleteCollectionFolder(token: string, id: string) {
    return request<{ ok: true }>(`/collection/folders/${encodeURIComponent(id)}`, {
      method: "DELETE",
      token
    });
  },
  recognitionCandidates(payload: { text: string; nameHint?: string; numberHint?: string }) {
    return request<RecognitionCandidate[]>("/recognition/candidates", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }
};
