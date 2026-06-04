import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  CardLanguage,
  CardSetSummary,
  CardSummary,
  DEFAULT_CARD_VARIANT,
  HOLOFOIL_CARD_VARIANT,
  REVERSE_HOLO_CARD_VARIANT,
  normalizeCardNumberForSearch,
  normalizeSearchText,
  parseCardNumberParts
} from "@poke-organizer/shared";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { normalizeCardNameForDb, toCardSummary, toPrismaLanguage } from "../common/mappers";
import { SearchCardsDto } from "./dto";

type PokemonTcgCard = {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  artist?: string;
  subtypes?: string[];
  nationalPokedexNumbers?: number[];
  types?: string[];
  regulationMark?: string;
  set?: { id?: string; ptcgoCode?: string; name?: string; printedTotal?: number; total?: number; releaseDate?: string };
  images?: { small?: string; large?: string };
  tcgplayer?: { url?: string; updatedAt?: string; prices?: Record<string, { market?: number; mid?: number; low?: number }> };
  cardmarket?: { updatedAt?: string; prices?: { trendPrice?: number; averageSellPrice?: number; lowPrice?: number } };
};

type TcgDexCard = {
  id: string;
  localId: string;
  name: string;
  image?: string;
};

type PokemonTcgSet = {
  id: string;
  ptcgoCode?: string;
  name: string;
  printedTotal?: number;
  total?: number;
  releaseDate?: string;
};

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  async search(dto: SearchCardsDto): Promise<CardSummary[]> {
    const local = await this.searchLocal(dto);
    if (local.length >= 12) {
      return local;
    }

    const remote = await this.searchRemote(dto);
    return this.mergeCards(remote, local).slice(0, 24);
  }

  async findOne(id: string): Promise<CardSummary> {
    const card = await this.prisma.card.findFirst({
      where: { OR: [{ id }, { externalId: id }] }
    });
    if (!card) {
      throw new NotFoundException("Card not found");
    }
    return toCardSummary(card);
  }

  async listSets(): Promise<CardSetSummary[]> {
    const localSets = await this.listLocalSets();
    const url = new URL("https://api.pokemontcg.io/v2/sets");
    url.searchParams.set("orderBy", "-releaseDate");

    const response = await fetch(url, {
      headers: this.config.get<string>("POKEMON_TCG_API_KEY")
        ? { "X-Api-Key": this.config.get<string>("POKEMON_TCG_API_KEY") ?? "" }
        : {}
    });

    if (response.ok) {
      const payload = (await response.json()) as { data?: PokemonTcgSet[] };
      const remoteSets = (payload.data ?? [])
        .filter((set): set is PokemonTcgSet & { printedTotal: number } => typeof set.printedTotal === "number")
        .map((set) => ({
          id: set.id,
          code: set.ptcgoCode ?? null,
          name: set.name,
          printedTotal: set.printedTotal,
          total: set.total ?? null,
          releaseDate: set.releaseDate ?? null
        }));
      return mergeCardSets(localSets, remoteSets);
    }

    return localSets;
  }

  async ensureCardByExternalId(externalId: string): Promise<CardSummary> {
    const cached = await this.prisma.card.findUnique({ where: { externalId } });
    if (cached) {
      return toCardSummary(cached);
    }

    const remote = await this.fetchPokemonTcgCard(externalId);
    return this.upsertPokemonTcgCard(remote);
  }

  private async listLocalSets(): Promise<CardSetSummary[]> {
    const sets = await this.prisma.card.findMany({
      where: {
        setId: { not: null },
        setName: { not: null },
        printedTotal: { not: null }
      },
      distinct: ["setId"],
      orderBy: [{ releaseDate: "desc" }, { setName: "asc" }],
      select: {
        setId: true,
        setCode: true,
        setName: true,
        printedTotal: true,
        setTotal: true,
        releaseDate: true
      }
    });

    return sets
      .filter((set): set is typeof set & { setId: string; setName: string; printedTotal: number } =>
        Boolean(set.setId && set.setName && set.printedTotal)
      )
      .map((set) => ({
        id: set.setId,
        code: set.setCode,
        name: set.setName,
        printedTotal: set.printedTotal,
        total: set.setTotal,
        releaseDate: set.releaseDate
      }));
  }

  private async searchLocal(dto: SearchCardsDto): Promise<CardSummary[]> {
    const normalizedQuery = dto.query ? normalizeSearchText(dto.query) : undefined;
    const numberParts = dto.number ? parseCardNumberParts(dto.number) : undefined;

    const cards = await this.prisma.card.findMany({
      where: {
        ...(normalizedQuery ? { normalizedName: { contains: normalizedQuery } } : {}),
        ...(numberParts ? { number: { equals: numberParts.number, mode: "insensitive" } } : {}),
        ...(numberParts?.printedTotal ? { printedTotal: numberParts.printedTotal } : {}),
        ...(dto.set
          ? {
              OR: [
                { setId: dto.set },
                { setCode: { equals: dto.set, mode: "insensitive" } },
                { setName: { contains: dto.set, mode: "insensitive" } }
              ]
            }
          : {})
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 24
    });

    return cards.map(toCardSummary);
  }

  private async searchRemote(dto: SearchCardsDto): Promise<CardSummary[]> {
    const [pokemonTcgCards, tcgDexCards] = await Promise.all([
      this.searchPokemonTcg(dto).catch(() => []),
      this.searchTcgDex(dto).catch(() => [])
    ]);

    const saved = await Promise.all([
      ...pokemonTcgCards.map((card) => this.upsertPokemonTcgCard(card)),
      ...tcgDexCards.map((card) => this.upsertTcgDexCard(card, dto.language))
    ]);

    return saved;
  }

  private async searchPokemonTcg(dto: SearchCardsDto): Promise<PokemonTcgCard[]> {
    const numberParts = dto.number ? parseCardNumberParts(dto.number) : undefined;
    const q: string[] = [];
    if (dto.query) {
      q.push(`name:*${this.escapePokemonTcgQuery(dto.query)}*`);
    }
    if (numberParts?.number) {
      q.push(`number:${this.escapePokemonTcgQuery(numberParts.number)}`);
    }
    if (numberParts?.printedTotal) {
      q.push(`set.printedTotal:${numberParts.printedTotal}`);
    }
    if (dto.set) {
      q.push(`set.id:${this.escapePokemonTcgQuery(dto.set)}`);
    }

    const url = new URL("https://api.pokemontcg.io/v2/cards");
    if (q.length) {
      url.searchParams.set("q", q.join(" "));
    }
    url.searchParams.set("pageSize", "20");
    url.searchParams.set("orderBy", "name");

    const response = await fetch(url, {
      headers: this.config.get<string>("POKEMON_TCG_API_KEY")
        ? { "X-Api-Key": this.config.get<string>("POKEMON_TCG_API_KEY") ?? "" }
        : {}
    });
    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as { data?: PokemonTcgCard[] };
    const cards = payload.data ?? [];

    if (cards.length === 0 && dto.query && numberParts?.number) {
      return this.searchPokemonTcg({ ...dto, query: undefined });
    }

    return cards;
  }

  private async fetchPokemonTcgCard(externalId: string): Promise<PokemonTcgCard> {
    const response = await fetch(`https://api.pokemontcg.io/v2/cards/${encodeURIComponent(externalId)}`, {
      headers: this.config.get<string>("POKEMON_TCG_API_KEY")
        ? { "X-Api-Key": this.config.get<string>("POKEMON_TCG_API_KEY") ?? "" }
        : {}
    });
    if (!response.ok) {
      throw new NotFoundException("Card not found in Pokemon TCG API");
    }

    const payload = (await response.json()) as { data: PokemonTcgCard };
    return payload.data;
  }

  private async searchTcgDex(dto: SearchCardsDto): Promise<TcgDexCard[]> {
    if (dto.number && parseCardNumberParts(dto.number).printedTotal) {
      return [];
    }

    if (!dto.query) {
      return [];
    }

    const language = dto.language === "pt-BR" ? "pt" : dto.language === "ja" ? "jp" : "en";
    const url = new URL(`https://api.tcgdex.net/v2/${language}/cards`);
    url.searchParams.set("name", dto.query);
    url.searchParams.set("pagination:page", "1");
    url.searchParams.set("pagination:itemsPerPage", "12");

    const response = await fetch(url);
    if (!response.ok) {
      return [];
    }

    return ((await response.json()) as TcgDexCard[]).filter((card) => {
      if (!dto.number) return true;
      return normalizeCardNumberForSearch(card.localId) === normalizeCardNumberForSearch(dto.number);
    });
  }

  private async upsertPokemonTcgCard(card: PokemonTcgCard): Promise<CardSummary> {
    const saved = await this.prisma.card.upsert({
      where: { externalId: card.id },
      create: {
        externalId: card.id,
        provider: "pokemon-tcg-api",
        name: card.name,
        normalizedName: normalizeCardNameForDb(card.name),
        number: card.number,
        printedTotal: card.set?.printedTotal ?? null,
        setTotal: card.set?.total ?? null,
        setId: card.set?.id ?? null,
        setCode: card.set?.ptcgoCode ?? null,
        setName: card.set?.name ?? null,
        rarity: card.rarity ?? null,
        artist: card.artist ?? null,
        releaseDate: card.set?.releaseDate ?? null,
        nationalPokedexNumbers: card.nationalPokedexNumbers ?? [],
        types: card.types ?? [],
        regulationMark: card.regulationMark ?? null,
        variants: this.extractPokemonTcgVariants(card),
        language: toPrismaLanguage("en"),
        imageSmall: card.images?.small ?? null,
        imageLarge: card.images?.large ?? null,
        raw: this.toJson(card)
      },
      update: {
        name: card.name,
        normalizedName: normalizeCardNameForDb(card.name),
        number: card.number,
        printedTotal: card.set?.printedTotal ?? null,
        setTotal: card.set?.total ?? null,
        setId: card.set?.id ?? null,
        setCode: card.set?.ptcgoCode ?? null,
        setName: card.set?.name ?? null,
        rarity: card.rarity ?? null,
        artist: card.artist ?? null,
        releaseDate: card.set?.releaseDate ?? null,
        nationalPokedexNumbers: card.nationalPokedexNumbers ?? [],
        types: card.types ?? [],
        regulationMark: card.regulationMark ?? null,
        variants: this.extractPokemonTcgVariants(card),
        imageSmall: card.images?.small ?? null,
        imageLarge: card.images?.large ?? null,
        raw: this.toJson(card)
      }
    });

    return toCardSummary(saved);
  }

  private async upsertTcgDexCard(card: TcgDexCard, language?: string): Promise<CardSummary> {
    const mappedLanguage: CardLanguage = language === "pt-BR" ? "pt-BR" : language === "ja" ? "ja" : "en";
    const saved = await this.prisma.card.upsert({
      where: { externalId: `tcgdex:${card.id}` },
      create: {
        externalId: `tcgdex:${card.id}`,
        provider: "tcgdex",
        name: card.name,
        normalizedName: normalizeCardNameForDb(card.name),
        number: card.localId,
        printedTotal: null,
        setTotal: null,
        nationalPokedexNumbers: [],
        types: [],
        variants: [DEFAULT_CARD_VARIANT],
        language: toPrismaLanguage(mappedLanguage),
        imageSmall: card.image ? `${card.image}/low.webp` : null,
        imageLarge: card.image ? `${card.image}/high.webp` : null,
        raw: this.toJson(card)
      },
      update: {
        name: card.name,
        normalizedName: normalizeCardNameForDb(card.name),
        number: card.localId,
        printedTotal: null,
        setTotal: null,
        nationalPokedexNumbers: [],
        types: [],
        variants: [DEFAULT_CARD_VARIANT],
        language: toPrismaLanguage(mappedLanguage),
        imageSmall: card.image ? `${card.image}/low.webp` : null,
        imageLarge: card.image ? `${card.image}/high.webp` : null,
        raw: this.toJson(card)
      }
    });

    return toCardSummary(saved);
  }

  private mergeCards(local: CardSummary[], remote: CardSummary[]): CardSummary[] {
    const seen = new Set<string>();
    return [...local, ...remote].filter((card) => {
      if (seen.has(card.externalId)) return false;
      seen.add(card.externalId);
      return true;
    });
  }

  private escapePokemonTcgQuery(value: string): string {
    return value.trim().replace(/([+\-!(){}\[\]^"~*?:\\/])/g, "\\$1");
  }

  private extractPokemonTcgVariants(card: PokemonTcgCard): string[] {
    const variants = Object.keys(card.tcgplayer?.prices ?? {});
    if (variants.length) {
      return variants;
    }

    const inferredVariants = [DEFAULT_CARD_VARIANT];
    if (this.shouldOfferHolofoilFallback(card)) {
      inferredVariants.push(HOLOFOIL_CARD_VARIANT);
    }
    if (this.shouldOfferReverseHoloFallback(card)) {
      inferredVariants.push(REVERSE_HOLO_CARD_VARIANT);
    }

    return inferredVariants;
  }

  private shouldOfferHolofoilFallback(card: PokemonTcgCard): boolean {
    const rarity = card.rarity?.toLowerCase() ?? "";
    const subtypes = card.subtypes?.map((subtype) => subtype.toLowerCase()) ?? [];

    return (
      subtypes.includes("ex") ||
      subtypes.includes("mega") ||
      rarity.includes("rare")
    );
  }

  private shouldOfferReverseHoloFallback(card: PokemonTcgCard): boolean {
    const rarity = card.rarity?.toLowerCase() ?? "";
    const subtypes = card.subtypes?.map((subtype) => subtype.toLowerCase()) ?? [];
    const specialRarityTerms = ["illustration", "ultra", "secret", "hyper", "special", "promo"];

    return (
      Boolean(card.tcgplayer?.url) &&
      !subtypes.includes("ex") &&
      !subtypes.includes("mega") &&
      !specialRarityTerms.some((term) => rarity.includes(term))
    );
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}

function mergeCardSets(
  localSets: CardSetSummary[],
  remoteSets: CardSetSummary[],
): CardSetSummary[] {
  const byKey = new Map<string, CardSetSummary>();
  for (const set of [...localSets, ...remoteSets]) {
    const key = set.code || set.id || `${set.name}:${set.printedTotal}`;
    if (!byKey.has(key)) {
      byKey.set(key, set);
    }
  }

  return Array.from(byKey.values()).sort((left, right) => {
    const leftDate = Date.parse(left.releaseDate ?? "");
    const rightDate = Date.parse(right.releaseDate ?? "");
    if (Number.isFinite(leftDate) && Number.isFinite(rightDate) && leftDate !== rightDate) {
      return rightDate - leftDate;
    }
    return left.name.localeCompare(right.name, "pt-BR");
  });
}
