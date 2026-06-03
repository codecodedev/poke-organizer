import type { PriceLookupKey } from "@poke-organizer/shared";
import type { PriceProviderAdapter, ProviderPriceResult } from "../types";

type FetchLike = typeof fetch;

export class LigaPokemonProvider implements PriceProviderAdapter {
  readonly source = "ligapokemon" as const;

  constructor(private readonly fetchImpl: FetchLike = fetch) {}

  async findLowestListing(key: PriceLookupKey): Promise<ProviderPriceResult | null> {
    const url = buildLigaPokemonCardUrl(key);
    const response = await this.fetchImpl(url, {
      headers: {
        "User-Agent": "PokeOrganizer/0.1 (+https://localhost)",
        Accept: "text/html,application/xhtml+xml"
      }
    });

    const html = await response.text();
    if (!response.ok || isCloudflareChallenge(response, html)) {
      return null;
    }

    const price = parseLigaPokemonMarketplacePrice(html, key.variant);
    if (!price) {
      return null;
    }

    return {
      source: this.source,
      amountBrl: price.amountBrl,
      label: `LigaPokemon menor preco medio de venda (${price.variantLabel})`,
      raw: {
        url,
        variant: price.variantLabel,
        amountBrl: price.amountBrl
      }
    };
  }
}

export function buildLigaPokemonCardUrl(key: PriceLookupKey): string {
  const url = new URL("https://www.ligapokemon.com.br/");
  const number = formatLigaPokemonCardNumber(key.card.number, key.card.printedTotal);
  url.searchParams.set("view", "cards/card");
  url.searchParams.set("tipo", "1");
  url.searchParams.set("card", `${key.card.name} (${number})`);
  return url.toString();
}

export function parseLigaPokemonMarketplacePrice(
  html: string,
  variant: string
): { variantLabel: string; amountBrl: number } | null {
  const desiredLabel = normalizeText(mapVariantLabel(variant));
  const rows = extractTableRows(html);

  for (const row of rows) {
    const text = stripTags(row);
    if (!normalizeText(text).includes(desiredLabel)) {
      continue;
    }

    const values = Array.from(text.matchAll(/R\$\s*([\d.]+,\d{2})/g)).map((match) => parseBrl(match[1]));
    const amountBrl = values.find((value): value is number => typeof value === "number");
    if (amountBrl !== undefined) {
      return {
        variantLabel: mapVariantLabel(variant),
        amountBrl
      };
    }
  }

  return null;
}

function extractTableRows(html: string): string[] {
  const scopedHtml = html;
  const rows = Array.from(scopedHtml.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)).map((match) => match[0]);
  if (rows.length) {
    return rows;
  }

  return scopedHtml
    .split(/<br\b[^>]*>|<\/div>|<\/li>/gi)
    .filter((chunk) => /R\$\s*[\d.]+,\d{2}/.test(chunk));
}

function isCloudflareChallenge(response: Response, html: string): boolean {
  return (
    response.headers.get("cf-mitigated") === "challenge" ||
    /Just a moment/i.test(html) ||
    /challenge-platform/i.test(html) ||
    /__cf_chl_/i.test(html)
  );
}

function formatLigaPokemonCardNumber(number: string, printedTotal?: number | null): string {
  const localNumber = /^\d+$/.test(number) ? number.padStart(3, "0") : number;
  return printedTotal ? `${localNumber}/${printedTotal}` : localNumber;
}

function mapVariantLabel(variant: string): string {
  const labels: Record<string, string> = {
    normal: "Normal",
    foil: "Foil",
    holofoil: "Holo Foil",
    reverseHolofoil: "Reverse Foil"
  };
  return labels[variant] ?? variant;
}

function parseBrl(value: string): number | null {
  const parsed = Number.parseFloat(value.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function stripTags(value: string): string {
  return value
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(value: string): string {
  return stripTags(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}
