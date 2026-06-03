import { describe, expect, it } from "vitest";
import type { PriceLookupKey } from "@poke-organizer/shared";
import { Prisma, PriceProvider } from "../prisma/client";
import { PriceService } from "./price.service";

const baseKey: PriceLookupKey = {
  itemId: "item-1",
  card: {
    externalId: "me2pt5-46",
    name: "Snorunt",
    number: "46",
    printedTotal: 217,
    setCode: "ASC",
    setName: "Ascended Heroes"
  },
  variant: "normal",
  language: "en",
  condition: "NM"
};

describe("PriceService", () => {
  it("creates the current card price without history on first sync", async () => {
    const prisma = createFakePrisma();
    const service = new PriceService(prisma as never);

    await service.upsertCurrentPrice({
      number: "046",
      printedTotal: 217,
      name: "Snorunt",
      setCode: "ASC",
      amountBrl: 0.69,
      label: "LigaPokemon"
    });

    expect(prisma.prices).toHaveLength(1);
    expect(prisma.histories).toHaveLength(0);
    expect(prisma.prices[0].number).toBe("46");
  });

  it("does not create history when the synced value is unchanged", async () => {
    const prisma = createFakePrisma();
    const service = new PriceService(prisma as never);

    await service.upsertCurrentPrice({ setCode: "ASC", number: "46", printedTotal: 217, amountBrl: 0.69, label: "LigaPokemon" });
    await service.upsertCurrentPrice({ setCode: "ASC", number: "46", printedTotal: 217, amountBrl: 0.69, label: "LigaPokemon" });

    expect(prisma.prices).toHaveLength(1);
    expect(prisma.histories).toHaveLength(0);
  });

  it("moves the previous value to history when the value changes", async () => {
    const prisma = createFakePrisma();
    const service = new PriceService(prisma as never);

    await service.upsertCurrentPrice({ setCode: "ASC", number: "46", printedTotal: 217, amountBrl: 0.69, label: "LigaPokemon" });
    await service.upsertCurrentPrice({ setCode: "ASC", number: "46", printedTotal: 217, amountBrl: 0.75, label: "LigaPokemon" });

    expect(prisma.prices).toHaveLength(1);
    expect(Number(prisma.prices[0].amountBrl)).toBe(0.75);
    expect(prisma.histories).toHaveLength(1);
    expect(Number(prisma.histories[0].previousAmountBrl)).toBe(0.69);
    expect(Number(prisma.histories[0].newAmountBrl)).toBe(0.75);
  });

  it("keeps current prices separated by set code", async () => {
    const prisma = createFakePrisma();
    const service = new PriceService(prisma as never);

    await service.upsertCurrentPrice({ setCode: "WHT", number: "12", printedTotal: 86, amountBrl: 25, label: "LigaPokemon" });
    await service.upsertCurrentPrice({ setCode: "BLK", number: "12", printedTotal: 86, amountBrl: 8, label: "LigaPokemon" });

    const whiteFlarePrice = await service.currentPriceByNumber({ setCode: "WHT", number: "12", printedTotal: 86 });
    const blackBoltPrice = await service.currentPriceByNumber({ setCode: "BLK", number: "12", printedTotal: 86 });

    expect(whiteFlarePrice?.amount).toBe(25);
    expect(blackBoltPrice?.amount).toBe(8);
  });

  it("returns batch job prices by set code, card number and printed total", async () => {
    const prisma = createFakePrisma();
    const service = new PriceService(prisma as never);
    await service.upsertCurrentPrice({ setCode: "ASC", number: "46", printedTotal: 217, amountBrl: 0.69, label: "LigaPokemon" });

    const summary = await service.createJob([baseKey]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const completed = service.getJob(summary.jobId);

    expect(completed?.status).toBe("completed");
    expect(completed?.results[0].status).toBe("updated");
    expect(completed?.results[0].price?.amount).toBe(0.69);
  });
});

function createFakePrisma() {
  const prices: Array<Record<string, unknown>> = [];
  const histories: Array<Record<string, unknown>> = [];

  const prisma = {
    prices,
    histories,
    cardPrice: {
      async findUnique(args: { where: { setCode_number_printedTotal_provider: { setCode: string; number: string; printedTotal: number; provider: PriceProvider } } }) {
        const where = args.where.setCode_number_printedTotal_provider;
        return (
          prices.find(
            (price) =>
              price.setCode === where.setCode &&
              price.number === where.number &&
              price.printedTotal === where.printedTotal &&
              price.provider === where.provider
          ) ?? null
        );
      },
      async findFirst(args: { where: { setCode: string; number: string; printedTotal: number } }) {
        return (
          prices.find(
            (price) =>
              price.setCode === args.where.setCode &&
              price.number === args.where.number &&
              price.printedTotal === args.where.printedTotal
          ) ?? null
        );
      },
      async findMany() {
        return prices;
      },
      async create(args: { data: Record<string, unknown> }) {
        const price = {
          id: `price-${prices.length + 1}`,
          provider: PriceProvider.LIGAPOKEMON,
          firstSeenAt: new Date(),
          updatedAt: new Date(),
          ...args.data,
          amountBrl: args.data.amountBrl as Prisma.Decimal,
          lastCheckedAt: args.data.lastCheckedAt as Date
        };
        prices.push(price);
        return price;
      },
      async update(args: { where: { id: string }; data: Record<string, unknown> }) {
        const price = prices.find((entry) => entry.id === args.where.id);
        if (!price) throw new Error("Price not found");
        Object.assign(price, args.data, { updatedAt: new Date() });
        return price;
      }
    },
    cardPriceHistory: {
      async create(args: { data: Record<string, unknown> }) {
        histories.push({ id: `history-${histories.length + 1}`, ...args.data, changedAt: new Date() });
        return histories.at(-1);
      }
    },
    async $transaction<T>(callback: (tx: typeof prisma) => Promise<T>) {
      return callback(prisma);
    }
  };

  return prisma;
}
