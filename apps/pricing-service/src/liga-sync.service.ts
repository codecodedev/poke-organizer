import { setTimeout as delay } from "node:timers/promises";
import { readFile } from "node:fs/promises";
import { PrismaClient } from "../prisma/client";
import { PriceService } from "./price.service";

const LIGA_BASE_URL = "https://www.ligapokemon.com.br/";
const LIGA_EDITIONS_URL = `${LIGA_BASE_URL}?view=cards/edicoes`;
const DEFAULT_DELAY_MS = 15_000;
const DEFAULT_PROFILE_DIR = ".liga-browser-profile";

export type LigaEdition = {
  edid: string;
  code: string;
  name: string;
  year?: number | null;
  searchUrl: string;
};

type LigaCardListing = {
  externalId: string;
  name: string;
  number: string;
  printedTotal: number | null;
  amountBrl: number;
  prices: number[];
  href: string;
  rawText: string;
};

type SyncEditionResult = {
  cardsFound: number;
  pricesUpdated: number;
};

type BrowserContext = {
  newPage(): Promise<Page>;
};

type Browser = {
  contexts(): BrowserContext[];
  newContext(options?: Record<string, unknown>): Promise<BrowserContext>;
};

type Page = {
  goto(url: string, options?: Record<string, unknown>): Promise<unknown>;
  waitForLoadState(state: string, options?: Record<string, unknown>): Promise<unknown>;
  evaluate<T>(callback: () => T | Promise<T>): Promise<T>;
  evaluate<TArg, TResult>(callback: (arg: TArg) => TResult | Promise<TResult>, arg: TArg): Promise<TResult>;
  waitForTimeout(ms: number): Promise<unknown>;
  locator(selector: string): { innerText(options?: Record<string, unknown>): Promise<string> };
  title(): Promise<string>;
  close(): Promise<unknown>;
  setDefaultTimeout(ms: number): void;
};

type ChromiumLike = {
  launchPersistentContext(profileDir: string, options: Record<string, unknown>): Promise<BrowserContext>;
  connectOverCDP(endpointURL: string): Promise<Browser>;
};

export class LigaSyncBlockedError extends Error {
  constructor(message = "LigaPokemon exibiu uma validacao manual. Complete no navegador aberto e rode o job novamente.") {
    super(message);
    this.name = "LigaSyncBlockedError";
  }
}

export class LigaSyncService {
  private contextPromise: Promise<BrowserContext> | null = null;
  private runningJobId: string | null = null;
  private readonly priceService: PriceService;

  constructor(private readonly prisma: PrismaClient) {
    this.priceService = new PriceService(prisma);
  }

  async listEditions(): Promise<LigaEdition[]> {
    const page = await this.newPage();
    try {
      await page.goto(LIGA_EDITIONS_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
      await this.assertNotBlocked(page);

      const editions = await page.evaluate(() => {
        type ExtractedEdition = {
          edid: string;
          code: string;
          name: string;
          year?: number | null;
          searchUrl: string;
        };

        function parseHref(href: string): { edid: string | null; code: string | null } {
          try {
            const url = new URL(href, window.location.href);
            const cardQuery = url.searchParams.get("card") || "";
            const edid = url.searchParams.get("edid") || cardQuery.match(/(?:^|\s)edid=(\d+)/)?.[1] || null;
            const code = url.searchParams.get("ed") || cardQuery.match(/(?:^|\s)ed=([A-Za-z0-9]+)/)?.[1] || null;
            return { edid, code };
          } catch {
            return { edid: null, code: null };
          }
        }

        function nearestYear(element: Element): number | null {
          let node: Element | null = element;
          for (let depth = 0; node && depth < 8; depth += 1) {
            const text = node.textContent || "";
            const match = text.match(/\b(20\d{2}|19\d{2})\b/);
            if (match) return Number(match[1]);
            node = node.parentElement;
          }
          const documentText = document.body.textContent || "";
          const offset = Math.max(0, documentText.indexOf(element.textContent || "") - 400);
          const nearby = documentText.slice(offset, offset + 800);
          return Number(nearby.match(/\b(20\d{2}|19\d{2})\b/)?.[1] || "") || null;
        }

        const seen = new Set<string>();
        const result: ExtractedEdition[] = [];
        const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"));

        for (const link of links) {
          const href = link.href;
          const parsed = parseHref(href);
          if (!parsed.edid || !parsed.code) continue;

          const text = (link.textContent || "").replace(/\s+/g, " ").trim();
          const name = text.replace(new RegExp("\\\\b" + parsed.code + "\\\\b$"), "").trim() || parsed.code;
          const key = `${parsed.edid}:${parsed.code}`;
          if (seen.has(key)) continue;
          seen.add(key);

          result.push({
            edid: parsed.edid,
            code: parsed.code,
            name,
            year: nearestYear(link),
            searchUrl: new URL(href, window.location.href).toString()
          });
        }

        return result;
      });

      return editions.sort((left, right) => {
        const yearDiff = (right.year ?? 0) - (left.year ?? 0);
        if (yearDiff) return yearDiff;
        return left.name.localeCompare(right.name, "pt-BR");
      });
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  async createJob(input: { editions: LigaEdition[]; delayMs?: number }): Promise<unknown> {
    if (this.runningJobId) {
      throw new Error(`Ja existe um sync em andamento: ${this.runningJobId}`);
    }

    const editions = dedupeEditions(input.editions);
    if (!editions.length) {
      throw new Error("Selecione ao menos uma edicao para sincronizar");
    }

    const delayMs = sanitizeDelay(input.delayMs);
    const job = await this.prisma.ligaSyncJob.create({
      data: {
        status: "queued",
        delayMs,
        totalEditions: editions.length,
        completedEditions: 0,
        editions: {
          create: editions.map((edition) => ({
            edid: edition.edid,
            code: edition.code,
            name: edition.name,
            year: edition.year ?? null,
            status: "queued"
          }))
        }
      },
      include: { editions: { orderBy: { id: "asc" } } }
    });

    void this.runJob(job.id);
    return this.getJob(job.id);
  }

  async getJob(id: string): Promise<unknown> {
    return this.prisma.ligaSyncJob.findUnique({
      where: { id },
      include: { editions: { orderBy: { id: "asc" } } }
    });
  }

  async listJobs(): Promise<unknown[]> {
    return this.prisma.ligaSyncJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { editions: { orderBy: { id: "asc" } } }
    });
  }

  private async runJob(jobId: string) {
    this.runningJobId = jobId;
    await this.prisma.ligaSyncJob.update({
      where: { id: jobId },
      data: { status: "running", message: "Sync iniciado" }
    });

    try {
      const job = await this.prisma.ligaSyncJob.findUnique({
        where: { id: jobId },
        include: { editions: { orderBy: { id: "asc" } } }
      });
      if (!job) return;

      for (let index = 0; index < job.editions.length; index += 1) {
        const edition = job.editions[index];
        await this.prisma.ligaSyncJob.update({
          where: { id: jobId },
          data: {
            currentEdition: `${edition.name} (${edition.code})`,
            message: `Sincronizando ${edition.name}`
          }
        });

        try {
          await this.prisma.ligaSyncJobEdition.update({
            where: { id: edition.id },
            data: { status: "running", startedAt: new Date(), message: null }
          });
          const result = await this.syncEdition({
            edid: edition.edid,
            code: edition.code,
            name: edition.name,
            year: edition.year,
            searchUrl: buildEditionSearchUrl({ edid: edition.edid, code: edition.code })
          });
          await this.prisma.ligaSyncJobEdition.update({
            where: { id: edition.id },
            data: {
              status: "completed",
              cardsFound: result.cardsFound,
              pricesUpdated: result.pricesUpdated,
              finishedAt: new Date(),
              message: "Edicao sincronizada"
            }
          });
        } catch (err) {
          const blocked = err instanceof LigaSyncBlockedError;
          await this.prisma.ligaSyncJobEdition.update({
            where: { id: edition.id },
            data: {
              status: blocked ? "blocked" : "failed",
              finishedAt: new Date(),
              message: err instanceof Error ? err.message : "Falha ao sincronizar edicao"
            }
          });
          if (blocked) {
            throw err;
          }
        } finally {
          await this.prisma.ligaSyncJob.update({
            where: { id: jobId },
            data: { completedEditions: { increment: 1 } }
          });
        }

        if (index < job.editions.length - 1 && job.delayMs > 0) {
          await delay(job.delayMs);
        }
      }

      const failedCount = await this.prisma.ligaSyncJobEdition.count({
        where: { jobId, status: { in: ["failed", "blocked"] } }
      });
      await this.prisma.ligaSyncJob.update({
        where: { id: jobId },
        data: {
          status: failedCount > 0 ? "failed" : "completed",
          currentEdition: null,
          message: failedCount > 0 ? "Sync finalizado com falhas" : "Sync finalizado",
          finishedAt: new Date()
        }
      });
    } catch (err) {
      await this.prisma.ligaSyncJob.update({
        where: { id: jobId },
        data: {
          status: err instanceof LigaSyncBlockedError ? "blocked" : "failed",
          message: err instanceof Error ? err.message : "Falha ao rodar sync",
          finishedAt: new Date()
        }
      });
    } finally {
      this.runningJobId = null;
    }
  }

  private async syncEdition(edition: LigaEdition): Promise<SyncEditionResult> {
    const page = await this.newPage();
    try {
      await page.goto(edition.searchUrl || buildEditionSearchUrl(edition), {
        waitUntil: "domcontentloaded",
        timeout: 60_000
      });
      await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
      await this.assertNotBlocked(page);
      await scrollUntilStable(page);
      await this.assertNotBlocked(page);

      const listings = await extractListings(page, edition);
      let pricesUpdated = 0;

      for (const listing of listings) {
        if (!listing.printedTotal) {
          continue;
        }

        await this.priceService.upsertCurrentPrice({
          number: listing.number,
          printedTotal: listing.printedTotal,
          name: listing.name,
          setCode: edition.code,
          setName: edition.name,
          amountBrl: listing.amountBrl,
          label: "LigaPokemon menor preco na listagem da edicao",
          sourceUrl: listing.href
        });
        pricesUpdated += 1;
      }

      return {
        cardsFound: listings.length,
        pricesUpdated
      };
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  private async newPage(): Promise<Page> {
    const context = await this.getContext();
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);
    return page;
  }

  private async getContext(): Promise<BrowserContext> {
    if (!this.contextPromise) {
      const profileDir = process.env.LIGA_SYNC_USER_DATA_DIR || DEFAULT_PROFILE_DIR;
      const headless = process.env.LIGA_SYNC_HEADLESS === "true";
      const executablePath = process.env.LIGA_SYNC_EXECUTABLE_PATH || undefined;
      const cdpUrl = await getConfiguredCdpUrl();
      const channel = executablePath
        ? undefined
        : process.env.LIGA_SYNC_BROWSER_CHANNEL === "bundled"
          ? undefined
          : process.env.LIGA_SYNC_BROWSER_CHANNEL || "chrome";
      const chromium = await loadChromium();

      this.contextPromise = cdpUrl
        ? connectToExistingChrome(chromium, cdpUrl)
        : chromium.launchPersistentContext(profileDir, {
            headless,
            channel,
            executablePath,
            locale: "pt-BR",
            viewport: { width: 1440, height: 1000 },
            ...(process.env.LIGA_SYNC_USER_AGENT ? { userAgent: process.env.LIGA_SYNC_USER_AGENT } : {})
          });
    }

    try {
      return await this.contextPromise;
    } catch (err) {
      this.contextPromise = null;
      throw err;
    }
  }

  private async assertNotBlocked(page: Page) {
    if (await isChallengePage(page)) {
      throw new LigaSyncBlockedError();
    }
  }
}

async function connectToExistingChrome(chromium: ChromiumLike, cdpUrl: string): Promise<BrowserContext> {
  const browser = await chromium.connectOverCDP(await resolveCdpEndpoint(cdpUrl));
  const existingContext = browser.contexts()[0];
  if (existingContext) {
    return existingContext;
  }

  return browser.newContext({
    locale: "pt-BR",
    viewport: { width: 1440, height: 1000 }
  });
}

async function getConfiguredCdpUrl(): Promise<string | undefined> {
  const file = process.env.LIGA_SYNC_CDP_URL_FILE;
  if (file) {
    const value = await readFile(file, "utf8").catch(() => "");
    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return process.env.LIGA_SYNC_CDP_URL || undefined;
}

async function resolveCdpEndpoint(cdpUrl: string): Promise<string> {
  if (cdpUrl.startsWith("ws://") || cdpUrl.startsWith("wss://")) {
    return cdpUrl;
  }

  const baseUrl = new URL(cdpUrl);
  const versionUrl = new URL("/json/version", baseUrl);
  const response = await fetch(versionUrl, {
    headers: {
      Host: "127.0.0.1:9222"
    }
  });

  if (!response.ok) {
    throw new Error(`Chrome DevTools nao respondeu em ${versionUrl.toString()}: HTTP ${response.status}`);
  }

  const version = (await response.json()) as { webSocketDebuggerUrl?: string };
  if (!version.webSocketDebuggerUrl) {
    throw new Error("Chrome DevTools nao retornou webSocketDebuggerUrl");
  }

  const websocketUrl = new URL(version.webSocketDebuggerUrl);
  websocketUrl.hostname = baseUrl.hostname;
  websocketUrl.port = baseUrl.port;
  return websocketUrl.toString();
}

export function buildEditionSearchUrl(edition: Pick<LigaEdition, "edid" | "code">): string {
  const url = new URL(LIGA_BASE_URL);
  url.searchParams.set("view", "cards/search");
  url.searchParams.set("card", `edid=${edition.edid} ed=${edition.code}`);
  return url.toString();
}

async function scrollUntilStable(page: Page) {
  let stableRounds = 0;
  let previousHeight = 0;
  let previousCards = 0;

  for (let attempt = 0; attempt < 80 && stableRounds < 4; attempt += 1) {
    const state = await page.evaluate(() => ({
      height: document.documentElement.scrollHeight,
      cards: document.querySelectorAll("a.main-link-card").length
    }));

    if (state.height === previousHeight && state.cards === previousCards) {
      stableRounds += 1;
    } else {
      stableRounds = 0;
      previousHeight = state.height;
      previousCards = state.cards;
    }

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(1_200);
  }
}

async function extractListings(page: Page, edition: LigaEdition): Promise<LigaCardListing[]> {
  const listings = await page.evaluate((editionArg) => {
    type Listing = {
      externalId: string;
      name: string;
      number: string;
      printedTotal: number | null;
      amountBrl: number;
      prices: number[];
      href: string;
      rawText: string;
    };

    function parseBrl(value: string): number | null {
      const parsed = Number.parseFloat(value.replace(/\./g, "").replace(",", "."));
      return Number.isFinite(parsed) ? parsed : null;
    }

    function normalizeNumber(value: string): string {
      return /^0*\d+$/.test(value) ? String(Number.parseInt(value, 10)) : value.trim();
    }

    function listingContainer(anchor: HTMLAnchorElement): Element {
      return (
        anchor.closest(".card-item") ||
        anchor.closest("[class*='card-item']") ||
        anchor.closest("article") ||
        anchor.closest("li") ||
        anchor
      );
    }

    function extractPrices(container: Element): number[] {
      const priceRoot = container.querySelector(".card-prices") || container;
      const preferredPriceTexts = Array.from(
        priceRoot.querySelectorAll<HTMLElement>(".avgp-minpr, [class*='minpr']")
      ).map((element) => element.textContent || "");

      const priceTexts = preferredPriceTexts.length ? preferredPriceTexts : [priceRoot.textContent || ""];
      return priceTexts
        .flatMap((text) => Array.from(text.matchAll(/R\$\s*([\d.]+,\d{2})/g)))
        .map((match) => parseBrl(match[1]))
        .filter((value): value is number => typeof value === "number");
    }

    function parseCardIdentity(anchor: HTMLAnchorElement): {
      name: string;
      number: string | null;
      printedTotal: number | null;
    } {
      const url = new URL(anchor.href, window.location.href);
      const cardParam = url.searchParams.get("card") || "";
      const numberParam = url.searchParams.get("num");
      const match = cardParam.match(/^\s*(.*?)\s*\(([^)]+)\)/);
      const numberText = match?.[2] || numberParam || "";
      const numberMatch = numberText.match(/([A-Za-z0-9]+)\s*\/\s*(\d+)/);
      const imageAlt = anchor.querySelector("img")?.getAttribute("alt") || "";
      const fallbackName = anchor.getAttribute("title") || imageAlt || anchor.textContent || "";

      return {
        name: (match?.[1] || fallbackName).replace(/\s+/g, " ").trim(),
        number: numberMatch ? normalizeNumber(numberMatch[1]) : numberParam ? normalizeNumber(numberParam) : null,
        printedTotal: numberMatch ? Number(numberMatch[2]) : null
      };
    }

    const seen = new Set<string>();
    const result: Listing[] = [];
    const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>("a.main-link-card"));

    for (const anchor of anchors) {
      const identity = parseCardIdentity(anchor);
      if (!identity.name || !identity.number) continue;

      const container = listingContainer(anchor);
      const rawText = (container.textContent || "").replace(/\s+/g, " ").trim();
      const prices = extractPrices(container);
      if (!prices.length) continue;

      const key = `${editionArg.code}:${identity.number}:${identity.printedTotal || ""}:${identity.name}`;
      if (seen.has(key)) continue;
      seen.add(key);

      result.push({
        externalId: `ligapokemon:${editionArg.code}:${identity.number}`,
        name: identity.name,
        number: identity.number,
        printedTotal: identity.printedTotal,
        amountBrl: Math.min(...prices),
        prices,
        href: new URL(anchor.href, window.location.href).toString(),
        rawText
      });
    }

    return result;
  }, edition);

  return listings;
}

async function loadChromium(): Promise<ChromiumLike> {
  try {
    const importModule = new Function("specifier", "return import(specifier)") as (
      specifier: string
    ) => Promise<{ chromium: ChromiumLike }>;
    const module = await importModule("playwright");
    return module.chromium;
  } catch (err) {
    throw new Error(
      `Playwright nao esta instalado/disponivel neste ambiente. Rode pnpm install na raiz do monorepo; se estiver no Docker, recrie o volume do pricing-service. Detalhe: ${
        err instanceof Error ? err.message : "erro desconhecido"
      }`
    );
  }
}

async function isChallengePage(page: Page): Promise<boolean> {
  const title = await page.title().catch(() => "");
  const body = await page.locator("body").innerText({ timeout: 2_000 }).catch(() => "");
  return /just a moment|checking your browser|cf-challenge|cloudflare|turnstile/i.test(`${title}\n${body}`);
}

function dedupeEditions(editions: LigaEdition[]): LigaEdition[] {
  const seen = new Set<string>();
  const result: LigaEdition[] = [];
  for (const edition of editions) {
    if (!edition.edid || !edition.code) continue;
    const key = `${edition.edid}:${edition.code}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      edid: String(edition.edid),
      code: String(edition.code),
      name: String(edition.name || edition.code),
      year: edition.year ?? null,
      searchUrl: edition.searchUrl || buildEditionSearchUrl(edition)
    });
  }
  return result;
}

function sanitizeDelay(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_DELAY_MS;
  }

  return Math.max(0, Math.min(10 * 60 * 1000, Math.floor(value)));
}
