import type { PriceEstimate, PriceJobItemResult, PriceJobSummary, PriceLookupKey } from "@poke-organizer/shared";
import { randomUUID } from "node:crypto";
import { CardPrice, Prisma, PrismaClient, PriceProvider } from "../prisma/client";
import { PriceJob } from "./types";

type CardNumberLookup = {
  setCode: string;
  number: string;
  printedTotal: number;
};

type UpsertCardPriceInput = CardNumberLookup & {
  name?: string | null;
  setName?: string | null;
  amountBrl: number;
  label: string;
  sourceUrl?: string | null;
  provider?: PriceProvider;
};

export class PriceService {
  private readonly jobs = new Map<string, PriceJob>();

  constructor(private readonly prisma: PrismaClient) {}

  async createJob(keys: PriceLookupKey[]): Promise<PriceJobSummary> {
    const jobId = randomUUID();
    const now = new Date().toISOString();
    const job: PriceJob = {
      jobId,
      status: "queued",
      total: keys.length,
      completed: 0,
      results: keys.map((key) => ({
        itemId: key.itemId,
        key,
        status: "queued",
        price: null,
        message: null
      })),
      createdAt: now,
      updatedAt: now
    };

    this.jobs.set(jobId, job);
    void this.processJob(jobId);
    return this.toSummary(job);
  }

  getJob(jobId: string): PriceJobSummary | null {
    const job = this.jobs.get(jobId);
    return job ? this.toSummary(job) : null;
  }

  async currentPrice(key: PriceLookupKey): Promise<PriceEstimate | null> {
    const lookup = lookupFromKey(key);
    return lookup ? this.currentPriceByNumber(lookup) : null;
  }

  async currentPriceByNumber(lookup: CardNumberLookup): Promise<PriceEstimate | null> {
    const price = await this.findCurrentPrice(lookup);
    return price ? this.cardPriceToEstimate(price) : null;
  }

  async listPrices(): Promise<CardPrice[]> {
    return this.prisma.cardPrice.findMany({
      orderBy: [{ setCode: "asc" }, { printedTotal: "asc" }, { number: "asc" }, { provider: "asc" }]
    });
  }

  async upsertCurrentPrice(input: UpsertCardPriceInput): Promise<{ changed: boolean; price: CardPrice }> {
    const setCode = normalizeSetCode(input.setCode);
    const number = normalizeCardNumber(input.number);
    const amount = new Prisma.Decimal(input.amountBrl);
    const provider = input.provider ?? PriceProvider.LIGAPOKEMON;
    const existing = await this.prisma.cardPrice.findUnique({
      where: {
        setCode_number_printedTotal_provider: {
          setCode,
          number,
          printedTotal: input.printedTotal,
          provider
        }
      }
    });

    if (!existing) {
      const price = await this.prisma.cardPrice.create({
        data: {
          setCode,
          number,
          printedTotal: input.printedTotal,
          name: input.name ?? null,
          setName: input.setName ?? null,
          provider,
          amountBrl: amount,
          label: input.label,
          sourceUrl: input.sourceUrl ?? null,
          lastCheckedAt: new Date()
        }
      });
      await this.linkCollectionItemsToPrice(price);
      return { changed: true, price };
    }

    const changed = !existing.amountBrl.equals(amount);
    const price = await this.prisma.$transaction(async (tx) => {
      if (changed) {
        await tx.cardPriceHistory.create({
          data: {
            cardPriceId: existing.id,
            previousAmountBrl: existing.amountBrl,
            newAmountBrl: amount
          }
        });
      }

      return tx.cardPrice.update({
        where: { id: existing.id },
        data: {
          name: input.name ?? existing.name,
          setCode,
          setName: input.setName ?? existing.setName,
          amountBrl: amount,
          label: input.label,
          sourceUrl: input.sourceUrl ?? existing.sourceUrl,
          lastCheckedAt: new Date()
        }
      });
    });

    await this.linkCollectionItemsToPrice(price);
    return { changed, price };
  }

  private async processJob(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job) {
      return;
    }

    job.status = "running";
    this.touch(job);

    for (let index = 0; index < job.results.length; index += 1) {
      const queued = job.results[index];
      job.results[index] = { ...queued, status: "fetching" };
      this.touch(job);

      try {
        const price = await this.currentPrice(queued.key);
        job.results[index] = {
          itemId: queued.itemId,
          key: queued.key,
          status: price ? "updated" : "no-price",
          price,
          message: price ? "Preco encontrado na base nacional" : "Preco nacional ainda nao sincronizado"
        };
      } catch (err) {
        job.results[index] = {
          ...queued,
          status: "failed",
          price: null,
          message: err instanceof Error ? err.message : "Falha ao buscar preco"
        };
      } finally {
        job.completed += 1;
        this.touch(job);
      }
    }

    job.status = job.results.some((result) => result.status === "failed") ? "failed" : "completed";
    this.touch(job);
  }

  private async findCurrentPrice(lookup: CardNumberLookup): Promise<CardPrice | null> {
    return this.prisma.cardPrice.findFirst({
      where: {
        setCode: normalizeSetCode(lookup.setCode),
        number: normalizeCardNumber(lookup.number),
        printedTotal: lookup.printedTotal
      },
      orderBy: [{ provider: "asc" }, { lastCheckedAt: "desc" }]
    });
  }

  private cardPriceToEstimate(price: CardPrice): PriceEstimate {
    return {
      source: price.provider === PriceProvider.LIGAPOKEMON ? "ligapokemon" : "mypcards",
      currency: "BRL",
      amount: Number(price.amountBrl),
      label: price.label,
      updatedAt: price.lastCheckedAt.toISOString(),
      isFallback: false,
      status: "fresh"
    };
  }

  private async linkCollectionItemsToPrice(price: CardPrice) {
    if (!price.setCode) return;
    if (typeof this.prisma.$executeRaw !== "function") return;

    await this.prisma.$executeRaw`
      UPDATE public."CollectionItem" AS item
      SET "cardPriceId" = ${price.id}
      FROM public."Card" AS card
      WHERE item."cardId" = card."id"
        AND item."cardPriceId" IS DISTINCT FROM ${price.id}
        AND UPPER(COALESCE(card."setCode", card."raw" #>> '{set,ptcgoCode}')) = ${price.setCode}
        AND regexp_replace(card."number", '^0+', '') = ${price.number}
        AND card."printedTotal" = ${price.printedTotal}
    `;
  }

  private touch(job: PriceJob) {
    job.updatedAt = new Date().toISOString();
  }

  private toSummary(job: PriceJob): PriceJobSummary {
    return {
      jobId: job.jobId,
      status: job.status,
      total: job.total,
      completed: job.completed,
      results: job.results
    };
  }
}

export function lookupFromKey(key: PriceLookupKey): CardNumberLookup | null {
  const printedTotal = key.card.printedTotal;
  const setCode = key.card.setCode;
  if (!printedTotal || !setCode) {
    return null;
  }

  return {
    setCode: normalizeSetCode(setCode),
    number: normalizeCardNumber(key.card.number),
    printedTotal
  };
}

export function parseCardNumberLookup(input: {
  setCode?: string | null;
  number?: string;
  printedTotal?: string | number | null;
  cardNumber?: string;
}): CardNumberLookup | null {
  const cardNumber = input.cardNumber?.trim();
  const slashMatch = cardNumber?.match(/^(.+?)\s*\/\s*(\d+)(?:\s*-\s*([A-Za-z0-9]+))?$/);
  const number = slashMatch?.[1] ?? input.number;
  const total = slashMatch?.[2] ?? input.printedTotal;
  const setCode = slashMatch?.[3] ?? input.setCode;
  const printedTotal = typeof total === "number" ? total : Number.parseInt(String(total ?? ""), 10);

  if (!setCode || !number || !Number.isFinite(printedTotal)) {
    return null;
  }

  return {
    setCode: normalizeSetCode(setCode),
    number: normalizeCardNumber(number),
    printedTotal
  };
}

function normalizeSetCode(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeCardNumber(value: string): string {
  return /^0*\d+$/.test(value.trim()) ? String(Number.parseInt(value, 10)) : value.trim().toUpperCase();
}
