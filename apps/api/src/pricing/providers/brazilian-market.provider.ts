import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type BrazilianPriceResult = {
  source: "ligapokemon" | "mypcards";
  amountBrl: number;
  label: string;
};

@Injectable()
export class BrazilianMarketProvider {
  constructor(private readonly config: ConfigService) {}

  async findPrice(): Promise<BrazilianPriceResult | null> {
    if (this.config.get<string>("ENABLE_BRAZILIAN_PRICE_PROVIDERS") !== "true") {
      return null;
    }

    // LigaPokemon and MYP Cards need a separate endpoint discovery/crawler pass.
    // Keep this provider isolated so the app never depends on Cloudflare bypasses.
    return null;
  }
}
