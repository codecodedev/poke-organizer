import Fastify from "fastify";
import type { PriceLookupKey } from "@poke-organizer/shared";
import { PrismaClient } from "../prisma/client";
import { renderLigaSyncPage } from "./liga-sync.page";
import { LigaSyncService, type LigaEdition } from "./liga-sync.service";
import { parseCardNumberLookup, PriceService } from "./price.service";

const prisma = new PrismaClient();
const priceService = new PriceService(prisma);
const ligaSyncService = new LigaSyncService(prisma);
const app = Fastify({ logger: true });

app.addContentTypeParser(["text/csv", "text/plain"], { parseAs: "string" }, (_request, body, done) => {
  done(null, body);
});

app.get("/health", async () => ({ ok: true }));

app.get("/liga-sync", async (_request, reply) => {
  return reply.type("text/html; charset=utf-8").send(renderLigaSyncPage());
});

app.get("/liga-sync/editions", async (request) => ({
  editions: await ligaSyncService.listEditions({
    refresh: (request.query as { refresh?: string }).refresh === "true"
  })
}));

app.get("/liga-sync/jobs", async () => ({
  jobs: await ligaSyncService.listJobs()
}));

app.post("/liga-sync/jobs", async (request, reply) => {
  const body = request.body as { editions?: LigaEdition[]; delayMs?: number };
  if (!Array.isArray(body.editions) || body.editions.length === 0) {
    return reply.status(400).send({ message: "editions must be a non-empty array" });
  }

  return ligaSyncService.createJob({
    editions: body.editions,
    delayMs: body.delayMs
  });
});

app.get("/liga-sync/jobs/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  const job = await ligaSyncService.getJob(id);
  if (!job) {
    return reply.status(404).send({ message: "Liga sync job not found" });
  }

  return job;
});

app.post("/price-jobs", async (request, reply) => {
  const body = request.body as { keys?: PriceLookupKey[] };
  if (!Array.isArray(body.keys) || body.keys.length === 0) {
    return reply.status(400).send({ message: "keys must be a non-empty array" });
  }

  return priceService.createJob(body.keys);
});

app.get("/price-jobs/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  const job = priceService.getJob(id);
  if (!job) {
    return reply.status(404).send({ message: "Price job not found" });
  }

  return job;
});

app.get("/prices/current", async (request, reply) => {
  const key = queryToPriceKey(request.query as Record<string, string | undefined>);
  if (!key) {
    return reply.status(400).send({
      message: "Missing card lookup. Use cardNumber=105/217-ASC or setCode=ASC&number=105&printedTotal=217"
    });
  }

  const price = await priceService.currentPriceByNumber(key);
  return {
    status: price?.status ?? "unavailable",
    price
  };
});

app.get("/prices", async (request, reply) => {
  const prices = await priceService.listPrices();
  return {
    prices
  };
});

app.get("/prices/backup.csv", async (_request, reply) => {
  const csv = await priceService.exportPricesCsv();
  return reply
    .header("Content-Disposition", `attachment; filename="poke-organizer-precos-${new Date().toISOString().slice(0, 10)}.csv"`)
    .type("text/csv; charset=utf-8")
    .send(csv);
});

app.post("/prices/backup.csv", async (request, reply) => {
  const body = typeof request.body === "string" ? request.body : "";
  if (!body.trim()) {
    return reply.status(400).send({ message: "Arquivo CSV vazio" });
  }

  return priceService.importPricesCsv(body);
});

const port = Number.parseInt(process.env.PRICING_SERVICE_PORT ?? "3344", 10);
const host = process.env.PRICING_SERVICE_HOST ?? "0.0.0.0";

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});

function queryToPriceKey(query: Record<string, string | undefined>) {
  return parseCardNumberLookup({
    setCode: query.setCode,
    cardNumber: query.cardNumber,
    number: query.number,
    printedTotal: query.printedTotal
  });
}
