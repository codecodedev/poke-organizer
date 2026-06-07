export const CARD_CONDITIONS = ["NM", "LP", "MP", "HP", "DMG"] as const;
export type CardCondition = (typeof CARD_CONDITIONS)[number];

export const CARD_LANGUAGES = ["pt-BR", "en", "ja", "unknown"] as const;
export type CardLanguage = (typeof CARD_LANGUAGES)[number];

export const DEFAULT_CARD_VARIANT = "normal";
export const FOIL_CARD_VARIANT = "foil";
export const HOLOFOIL_CARD_VARIANT = "holofoil";
export const REVERSE_HOLO_CARD_VARIANT = "reverseHolofoil";

export const PRICE_SOURCES = [
  "manual",
  "pokemon-tcg-api",
  "tcgdex",
  "ligapokemon",
  "mypcards",
  "converted-international",
] as const;
export type PriceSource = (typeof PRICE_SOURCES)[number];

export type CardSummary = {
  id: string;
  externalId: string;
  name: string;
  number: string;
  printedTotal?: number | null;
  setTotal?: number | null;
  setId?: string | null;
  setCode?: string | null;
  setName?: string | null;
  rarity?: string | null;
  artist?: string | null;
  releaseDate?: string | null;
  nationalPokedexNumbers: number[];
  supertype?: string | null;
  subtypes: string[];
  types: string[];
  regulationMark?: string | null;
  rules: string[];
  abilities?: CardAbility[] | null;
  attacks?: CardAttack[] | null;
  retreatCost: string[];
  convertedRetreatCost?: number | null;
  variants: string[];
  language: CardLanguage;
  imageSmall?: string | null;
  imageLarge?: string | null;
};

export type CardAbility = {
  name: string;
  text?: string;
  type?: string;
};

export type CardAttack = {
  name: string;
  cost?: string[];
  convertedEnergyCost?: number;
  damage?: string;
  text?: string;
};

export type CardSetSummary = {
  id: string;
  code?: string | null;
  name: string;
  printedTotal: number;
  total?: number | null;
  releaseDate?: string | null;
};

export type PriceEstimate = {
  source: PriceSource;
  currency: "BRL" | "USD" | "EUR";
  amount: number | null;
  label: string;
  history?: PriceHistoryPoint[];
  updatedAt?: string | null;
  isFallback: boolean;
  status?: "fresh" | "stale" | "pending" | "unavailable";
};

export type PriceHistoryPoint = {
  previousAmount: number;
  amount: number;
  changedAt: string;
};

export type CollectionItem = {
  id: string;
  folderItemId?: string;
  card: CardSummary;
  quantity: number;
  condition: CardCondition;
  variant: string;
  foil: boolean;
  language: CardLanguage;
  notes?: string | null;
  price?: PriceEstimate | null;
  store?: CollectionItemStore | null;
  createdAt: string;
  updatedAt: string;
};

export type CollectionItemBid = {
  id: string;
  bidderId: string;
  bidderName: string;
  amount: number;
  quantity: number;
  folderId?: string;
  createdAt: string;
};

export type CollectionItemStore = {
  manualPrice: number | null;
  effectivePrice: number | null;
  isSold: boolean;
  soldPrice: number | null;
  soldQuantity: number;
  soldAt: string | null;
  soldByAuction?: boolean;
  highestBid: CollectionItemBid | null;
  bids: CollectionItemBid[];
};

export type CollectionAddAction = "created" | "incremented";

export type CollectionAddResult = {
  item: CollectionItem;
  action: CollectionAddAction;
};

export type CollectionFolderSort =
  | "value-desc"
  | "value-asc"
  | "price-change-desc"
  | "price-change-asc"
  | "newest"
  | "oldest";

export type CollectionFolderSummary = {
  id: string;
  name: string;
  isPublic: boolean;
  isStore: boolean;
  shareToken?: string | null;
  viewCount: number;
  itemCount: number;
  totalValue: number;
  createdAt: string;
  updatedAt: string;
};

export type CollectionFolderDetail = CollectionFolderSummary & {
  items: CollectionItem[];
};

export type PublicCollectionDetail = CollectionFolderDetail & {
  isPublic: true;
  ownerName: string;
  viewCount: number;
};

export type HomeSummary = {
  recentItems: CollectionItem[];
  recentBids: CollectionItemBid[];
  recentProposals: CollectionCartOffer[];
  ranking: CollectionFolderSummary[];
};

export type CollectionOfferStatus = "pending" | "accepted" | "rejected";

export type CollectionCartOfferItem = {
  id: string;
  folderItemId: string;
  quantity: number;
  amount: number;
  item: CollectionItem;
};

export type CollectionCartOffer = {
  id: string;
  folderId: string;
  buyerId: string;
  buyerName: string;
  status: CollectionOfferStatus;
  message?: string | null;
  totalOffer: number;
  decidedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  items: CollectionCartOfferItem[];
};

export type PriceLookupCard = {
  externalId: string;
  name: string;
  number: string;
  printedTotal?: number | null;
  setCode?: string | null;
  setName?: string | null;
};

export type PriceLookupKey = {
  itemId?: string;
  card: PriceLookupCard;
  variant: string;
  language: CardLanguage;
  condition: CardCondition;
};

export type PriceJobStatus = "queued" | "running" | "completed" | "failed";
export type PriceJobItemStatus =
  | "queued"
  | "fetching"
  | "updated"
  | "no-price"
  | "failed";

export type PriceJobItemResult = {
  itemId?: string;
  key: PriceLookupKey;
  status: PriceJobItemStatus;
  price: PriceEstimate | null;
  message?: string | null;
};

export type PriceJobSummary = {
  jobId: string;
  status: PriceJobStatus;
  total: number;
  completed: number;
  results: PriceJobItemResult[];
};

export type RecognitionCandidate = {
  card: CardSummary;
  score: number;
  reason: string;
};

export const DECK_FORMATS = ["standard", "casual"] as const;
export type DeckFormat = (typeof DECK_FORMATS)[number];

export const DECK_GENERATION_MODES = ["owned-only", "allow-missing"] as const;
export type DeckGenerationMode = (typeof DECK_GENERATION_MODES)[number];

export type DeckCardSource = "owned" | "missing";
export type DeckValidationSeverity = "error" | "warning";
export type DeckValidationCode =
  | "deck-size"
  | "copy-limit"
  | "standard-legality"
  | "missing-card"
  | "empty-deck";

export type DeckCard = {
  id: string;
  card: CardSummary;
  quantity: number;
  source: DeckCardSource;
};

export type DeckValidationIssue = {
  severity: DeckValidationSeverity;
  code: DeckValidationCode;
  message: string;
  cardName?: string | null;
};

export type DeckValidationSnapshot = {
  id?: string;
  isValid: boolean;
  totalCards: number;
  issues: DeckValidationIssue[];
  createdAt?: string;
};

export type DeckSummary = {
  id: string;
  name: string;
  format: DeckFormat;
  generationMode: DeckGenerationMode;
  archetypeName?: string | null;
  validationStatus: string;
  totalCards: number;
  missingCards: number;
  createdAt: string;
  updatedAt: string;
};

export type DeckDetail = DeckSummary & {
  cards: DeckCard[];
  validation?: DeckValidationSnapshot | null;
};

export type DeckArchetypeSummary = {
  id: string;
  slug: string;
  name: string;
  format: DeckFormat;
  strategy?: string | null;
  source: string;
  confidence: number;
};

export type DeckSuggestionMissingCard = {
  cardName: string;
  quantity: number;
  role: string;
};

export type DeckSuggestion = {
  archetype: DeckArchetypeSummary;
  compatibility: number;
  format: DeckFormat;
  mode: DeckGenerationMode;
  cards: Array<{
    card: CardSummary;
    quantity: number;
    source: DeckCardSource;
    role: string;
  }>;
  missingCards: DeckSuggestionMissingCard[];
  validation: DeckValidationSnapshot;
  explanation: string;
};

export type DeckAiChangeAction = "add" | "remove" | "increase" | "decrease";

export type DeckAiSuggestedChange = {
  action: DeckAiChangeAction;
  cardName: string;
  cardId?: string | null;
  quantity: number;
  reason: string;
  owned: boolean;
};

export type DeckAiAnalysis = {
  provider: "gemini" | "openai" | "local";
  fallbackUsed: boolean;
  model: string;
  generatedAt: string;
  summary: string;
  strategy: string[];
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
  suggestedChanges: DeckAiSuggestedChange[];
  playTips: string[];
};

export function normalizeCardNumber(value: string): string {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

export function normalizeCardNumberForSearch(value: string): string {
  const compact = normalizeCardNumber(value);
  return normalizeNumericCardPart(compact.split("/")[0] || compact);
}

export function parseCardNumberParts(value: string): {
  number: string;
  printedTotal?: number;
} {
  const compact = normalizeCardNumber(value);
  const [number, total] = compact.split("/");
  const printedTotal = total ? Number.parseInt(total, 10) : undefined;

  return {
    number: normalizeNumericCardPart(number || compact),
    printedTotal: Number.isFinite(printedTotal) ? printedTotal : undefined,
  };
}

export function formatCardNumber(
  number: string,
  printedTotal?: number | null,
): string {
  return printedTotal ? `${number}/${printedTotal}` : number;
}

function normalizeNumericCardPart(value: string): string {
  return /^\d+$/.test(value) ? String(Number.parseInt(value, 10)) : value;
}

export function formatCardVariant(variant: string): string {
  const labels: Record<string, string> = {
    [DEFAULT_CARD_VARIANT]: "Normal",
    [FOIL_CARD_VARIANT]: "Foil",
    [HOLOFOIL_CARD_VARIANT]: "Holo",
    [REVERSE_HOLO_CARD_VARIANT]: "Reverse Holo",
    loveBallHolo: "Love Ball Holo",
    masterBallHolo: "Master Ball Holo",
    firstEditionHolofoil: "1st Edition Holo",
    firstEditionNormal: "1st Edition Normal",
    unlimitedHolofoil: "Unlimited Holo",
  };

  return (
    labels[variant] ??
    variant
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9/ -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseOcrCardNumber(text: string): string | null {
  const normalized = text.replace(/\s+/g, " ");
  const match = normalized.match(/\b(\d{1,3})\s*\/\s*(\d{1,3})\b/);
  if (!match) {
    return null;
  }

  return `${match[1]}/${match[2]}`;
}

export function parseOcrNameHint(text: string): string | null {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const candidate = lines.find(
    (line) =>
      /[A-Za-z\u00C0-\u00FF]{3,}/.test(line) && !/\d+\s*\/\s*\d+/.test(line),
  );
  return candidate ?? null;
}
