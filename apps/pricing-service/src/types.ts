import type { PriceEstimate, PriceJobItemResult, PriceJobStatus, PriceLookupKey } from "@poke-organizer/shared";

export const PRICE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export type ProviderName = "ligapokemon" | "mypcards";

export type ProviderPriceResult = {
  source: ProviderName;
  amountBrl: number;
  label: string;
  raw?: unknown;
};

export type PriceProviderAdapter = {
  source: ProviderName;
  findLowestListing(key: PriceLookupKey): Promise<ProviderPriceResult | null>;
};

export type PriceJob = {
  jobId: string;
  status: PriceJobStatus;
  total: number;
  completed: number;
  results: PriceJobItemResult[];
  createdAt: string;
  updatedAt: string;
};

export type CurrentPriceResult = {
  status: NonNullable<PriceEstimate["status"]>;
  price: PriceEstimate | null;
};
