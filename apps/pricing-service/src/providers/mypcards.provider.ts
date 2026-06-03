import type { PriceLookupKey } from "@poke-organizer/shared";
import type { PriceProviderAdapter, ProviderPriceResult } from "../types";

export class MyPCardsProvider implements PriceProviderAdapter {
  readonly source = "mypcards" as const;

  async findLowestListing(_key: PriceLookupKey): Promise<ProviderPriceResult | null> {
    // Conservative MVP: integration discovery still needs a stable public endpoint.
    // Do not add Cloudflare, CAPTCHA, login automation or bypass-dependent scraping here.
    return null;
  }
}
