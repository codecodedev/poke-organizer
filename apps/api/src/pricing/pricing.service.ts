import { Injectable, NotFoundException } from "@nestjs/common";
import {
  CardCondition,
  CardLanguage,
  DEFAULT_CARD_VARIANT,
  PriceEstimate,
  PriceLookupKey
} from "@poke-organizer/shared";
import { PriceSource, Prisma } from "@prisma/client";
import { fromPrismaLanguage } from "../common/mappers";
import { PrismaService } from "../prisma/prisma.service";
import { CatalogService } from "../cards/catalog.service";

// const BRAZILIAN_PRICE_SOURCES: PriceSource[] = [PriceSource.LIGAPOKEMON, PriceSource.MYPCARDS];
const BRAZILIAN_PRICE_SOURCES = ["LIGAPOKEMON", "MYPCARDS"] as PriceSource[];
type CardWithPrices = Prisma.CardGetPayload<{ include: { prices: { orderBy: { capturedAt: "desc" }; take: 5 } } }>;
type CardPriceLookup = { setCode: string; number: string; printedTotal: number };
type RawCardPrice = {
  setCode: string;
  number: string;
  printedTotal: number;
  provider: "LIGAPOKEMON" | "MYPCARDS";
  amountBrl: Prisma.Decimal | string | number;
  label: string;
  lastCheckedAt: Date | string;
};

@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
  ) {}

  async getEstimate(
    cardId: string,
    options: { variant?: string; language?: CardLanguage; condition?: CardCondition } = {}
  ): Promise<PriceEstimate> {
    let card = await this.prisma.card.findFirst({
      where: { OR: [{ id: cardId }, { externalId: cardId }] },
      include: { prices: { orderBy: { capturedAt: "desc" }, take: 5 } }
    });

    if (!card) {
      try {
        const ensured = await this.catalog.ensureCardByExternalId(cardId);
        card = await this.prisma.card.findUnique({
          where: { id: ensured.id },
          include: { prices: { orderBy: { capturedAt: "desc" }, take: 5 } }
        });
      } catch (err) {
        throw new NotFoundException("Card not found");
      }
    }

    if (!card) {
      throw new NotFoundException("Card not found");
    }

    const pricingServicePrice = await this.getCurrentBrazilianPrice({
      itemId: undefined,
      card: {
        externalId: card.externalId,
        name: card.name,
        number: card.number,
        printedTotal: card.printedTotal,
        setCode: this.cardSetCode(card)
      },
      variant: options.variant ?? card.variants[0] ?? DEFAULT_CARD_VARIANT,
      language: options.language ?? fromPrismaLanguage(card.language),
      condition: options.condition ?? "NM"
    });
    if (pricingServicePrice?.amount !== null && pricingServicePrice?.amount !== undefined) {
      return pricingServicePrice;
    }

    return this.fallbackEstimate(card);
  }

  private async getCurrentBrazilianPrice(key: PriceLookupKey): Promise<PriceEstimate | null> {
    const lookup = this.lookupFromKey(key);
    if (!lookup) return null;

    const prices = await this.findCurrentBrazilianPrices([lookup]);
    return prices.get(this.lookupKey(lookup)) ?? null;
  }

  private async findCurrentBrazilianPrices(lookups: Array<CardPriceLookup | null>): Promise<Map<string, PriceEstimate>> {
    const uniqueLookups = Array.from(
      new Map(
        lookups
          .filter((lookup): lookup is CardPriceLookup => Boolean(lookup))
          .map((lookup) => [this.lookupKey(lookup), lookup])
      ).values()
    );
    if (!uniqueLookups.length) return new Map();

    const conditions = Prisma.join(
      uniqueLookups.map(
        (lookup) =>
          Prisma.sql`(
            "number" = ${normalizeCardNumber(lookup.number)}
            AND "printedTotal" = ${lookup.printedTotal}
            AND UPPER("setCode") = ${lookup.setCode}
          )`
      ),
      " OR "
    );

    try {
      const rows = await this.prisma.$queryRaw<RawCardPrice[]>(Prisma.sql`
        SELECT DISTINCT ON ("setCode", "number", "printedTotal")
          "setCode",
          "number",
          "printedTotal",
          "provider"::text AS "provider",
          "amountBrl",
          "label",
          "lastCheckedAt"
        FROM pricing."CardPrice"
        WHERE ${conditions}
        ORDER BY
          "setCode",
          "number",
          "printedTotal",
          CASE "provider"
            WHEN 'LIGAPOKEMON' THEN 0
            WHEN 'MYPCARDS' THEN 1
            ELSE 2
          END,
          "lastCheckedAt" DESC
      `);

      return new Map(
        rows.map((row) => [this.lookupKey(row), this.rawCardPriceToEstimate(row)])
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (/schema "pricing" does not exist|relation "pricing"\."CardPrice" does not exist/i.test(message)) {
        return new Map();
      }
      throw err;
    }
  }

  private lookupFromCard(card: {
    number: string;
    printedTotal: number | null;
    setCode?: string | null;
    raw?: unknown;
  }): CardPriceLookup | null {
    const setCode = this.cardSetCode(card);
    if (!card.printedTotal || !setCode) return null;
    return {
      setCode,
      number: normalizeCardNumber(card.number),
      printedTotal: card.printedTotal
    };
  }

  private lookupFromKey(key: PriceLookupKey): CardPriceLookup | null {
    const setCode = key.card.setCode ? normalizeSetCode(key.card.setCode) : null;
    if (!key.card.printedTotal || !setCode) return null;
    return {
      setCode,
      number: normalizeCardNumber(key.card.number),
      printedTotal: key.card.printedTotal
    };
  }

  private lookupKey(lookup: CardPriceLookup): string {
    return `${lookup.setCode}:${normalizeCardNumber(lookup.number)}/${lookup.printedTotal}`;
  }

  private cardSetCode(card: { setCode?: string | null; raw?: unknown }): string | null {
    if (card.setCode) return normalizeSetCode(card.setCode);
    const raw = card.raw;
    if (!raw || typeof raw !== "object") return null;
    const set = (raw as { set?: { ptcgoCode?: unknown } }).set;
    return typeof set?.ptcgoCode === "string" ? normalizeSetCode(set.ptcgoCode) : null;
  }

  private rawCardPriceToEstimate(price: RawCardPrice): PriceEstimate {
    return {
      source: price.provider === "LIGAPOKEMON" ? "ligapokemon" : "mypcards",
      currency: "BRL",
      amount: Number(price.amountBrl),
      label: price.label,
      updatedAt: new Date(price.lastCheckedAt).toISOString(),
      isFallback: false,
      status: "fresh"
    };
  }

  private fallbackEstimate(card: CardWithPrices): PriceEstimate {
    const manualOrBrazilian = card.prices.find((price) => BRAZILIAN_PRICE_SOURCES.includes(price.source));
    if (manualOrBrazilian) {
      return {
        source: this.mapSource(manualOrBrazilian.source),
        currency: "BRL",
        amount: manualOrBrazilian.amount ? Number(manualOrBrazilian.amount) : null,
        label: manualOrBrazilian.label,
        updatedAt: manualOrBrazilian.capturedAt.toISOString(),
        isFallback: manualOrBrazilian.isFallback,
        status: "stale"
      };
    }

    const derived = this.deriveInternationalPrice(card.raw);
    if (derived.amount !== null) {
      void this.prisma.priceSnapshot.create({
        data: {
          cardId: card.id,
          // source: PriceSource.CONVERTED_INTERNATIONAL,
          source: "CONVERTED_INTERNATIONAL" as PriceSource,
          currency: "BRL",
          amount: derived.amount,
          label: derived.label,
          isFallback: true
        }
      });

      return {
        source: "converted-international",
        currency: "BRL",
        amount: derived.amount,
        label: derived.label,
        updatedAt: null,
        isFallback: true,
        status: "pending"
      };
    }

    return {
      source: "manual",
      currency: "BRL",
      amount: null,
      label: "Sem preco brasileiro encontrado; rode o sync de valores no pricing-service",
      updatedAt: null,
      isFallback: false,
      status: "unavailable"
    };
  }

  private deriveInternationalPrice(raw: unknown): { amount: number | null; label: string } {
    if (!raw || typeof raw !== "object") {
      return { amount: null, label: "Sem dados externos de preco" };
    }

    const card = raw as {
      tcgplayer?: { prices?: Record<string, { market?: number; mid?: number; low?: number }> };
      cardmarket?: { prices?: { trendPrice?: number; averageSellPrice?: number; lowPrice?: number } };
    };

    const usdPrice = Object.values(card.tcgplayer?.prices ?? {})
      .map((variant) => variant.market ?? variant.mid ?? variant.low)
      .find((value): value is number => typeof value === "number");
    if (usdPrice) {
      return {
        amount: Math.round(usdPrice * 5.2 * 100) / 100,
        label: "Estimativa convertida de TCGPlayer usando cambio fixo de MVP"
      };
    }

    const eurPrice =
      card.cardmarket?.prices?.trendPrice ??
      card.cardmarket?.prices?.averageSellPrice ??
      card.cardmarket?.prices?.lowPrice;
    if (eurPrice) {
      return {
        amount: Math.round(eurPrice * 5.7 * 100) / 100,
        label: "Estimativa convertida de CardMarket usando cambio fixo de MVP"
      };
    }

    return { amount: null, label: "Sem dados externos de preco" };
  }

  private mapSource(source: PriceSource): PriceEstimate["source"] {
    const map: Record<PriceSource, PriceEstimate["source"]> = {
      MANUAL: "manual",
      POKEMON_TCG_API: "pokemon-tcg-api",
      TCGDEX: "tcgdex",
      LIGAPOKEMON: "ligapokemon",
      MYPCARDS: "mypcards",
      CONVERTED_INTERNATIONAL: "converted-international"
    };
    return map[source];
  }
}

function normalizeCardNumber(value: string): string {
  return /^0*\d+$/.test(value.trim()) ? String(Number.parseInt(value, 10)) : value.trim().toUpperCase();
}

function normalizeSetCode(value: string): string {
  return value.trim().toUpperCase();
}
