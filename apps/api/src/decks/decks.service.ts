import { BadGatewayException, BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  DeckCardSource as PrismaDeckCardSource,
  DeckFormat as PrismaDeckFormat,
  DeckGenerationMode as PrismaDeckGenerationMode,
  Prisma
} from "@prisma/client";
import {
  DeckArchetypeSummary,
  DeckAiAnalysis,
  DeckCard,
  DeckDetail,
  DeckFormat,
  DeckGenerationMode,
  DeckSuggestion,
  DeckSuggestionMissingCard,
  DeckSummary,
  DeckValidationIssue,
  DeckValidationSnapshot,
  normalizeSearchText
} from "@poke-organizer/shared";
import { PrismaService } from "../prisma/prisma.service";
import { toCardSummary } from "../common/mappers";
import { CreateDeckDto, GenerateBestDeckDto, MetagameSyncDto, UpdateDeckDto } from "./dto";

const DECK_SIZE = 60;
const MAX_COPIES_BY_NAME = 4;
const STANDARD_LEGAL_MARKS = new Set(["H", "I", "J"]);

const BASIC_ENERGY_NAMES = new Set([
  "basic grass energy",
  "basic fire energy",
  "basic water energy",
  "basic lightning energy",
  "basic psychic energy",
  "basic fighting energy",
  "basic darkness energy",
  "basic metal energy",
  "grass energy",
  "fire energy",
  "water energy",
  "lightning energy",
  "psychic energy",
  "fighting energy",
  "darkness energy",
  "metal energy"
]);

type DeckWithRelations = Prisma.DeckGetPayload<{
  include: {
    archetype: true;
    cards: { include: { card: true } };
    validations: true;
  };
}>;

type ArchetypeWithCards = Prisma.DeckArchetypeGetPayload<{
  include: { cards: { include: { card: true } } };
}>;

type InventoryItem = Prisma.CollectionItemGetPayload<{ include: { card: true } }>;

type CandidateCard = {
  card: InventoryItem["card"];
  available: number;
};

const CURATED_ARCHETYPES = [
  {
    slug: "charizard-ex",
    name: "Charizard ex",
    strategy: "Evoluir rapidamente para Charizard ex, acelerar energia e pressionar com alto dano.",
    cards: [
      ["Charizard ex", 3, "main", true, 100],
      ["Charmander", 4, "main", true, 95],
      ["Charmeleon", 1, "main", false, 70],
      ["Pidgeot ex", 2, "support", true, 85],
      ["Pidgey", 2, "support", false, 75],
      ["Rare Candy", 4, "trainer", true, 90],
      ["Ultra Ball", 4, "trainer", true, 85],
      ["Nest Ball", 4, "trainer", false, 80],
      ["Boss's Orders", 2, "trainer", false, 65],
      ["Fire Energy", 8, "energy", false, 50]
    ]
  },
  {
    slug: "gardevoir-ex",
    name: "Gardevoir ex",
    strategy: "Usar Gardevoir ex para reciclar energias psiquicas e manter atacantes eficientes.",
    cards: [
      ["Gardevoir ex", 2, "main", true, 100],
      ["Kirlia", 4, "main", true, 88],
      ["Ralts", 4, "main", true, 88],
      ["Drifloon", 2, "support", false, 70],
      ["Super Rod", 2, "trainer", false, 70],
      ["Ultra Ball", 4, "trainer", true, 85],
      ["Rare Candy", 2, "trainer", false, 70],
      ["Boss's Orders", 2, "trainer", false, 65],
      ["Psychic Energy", 8, "energy", false, 50]
    ]
  },
  {
    slug: "dragapult-ex",
    name: "Dragapult ex",
    strategy: "Montar Dragapult ex com consistencia e espalhar dano para controlar o campo.",
    cards: [
      ["Dragapult ex", 3, "main", true, 100],
      ["Drakloak", 3, "main", true, 85],
      ["Dreepy", 4, "main", true, 85],
      ["Rare Candy", 3, "trainer", true, 80],
      ["Ultra Ball", 4, "trainer", true, 85],
      ["Nest Ball", 4, "trainer", false, 80],
      ["Boss's Orders", 2, "trainer", false, 65],
      ["Psychic Energy", 5, "energy", false, 50],
      ["Fire Energy", 4, "energy", false, 45]
    ]
  }
] as const;

const deckAiAnalysisSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "strategy", "strengths", "weaknesses", "improvements", "suggestedChanges", "playTips"],
  properties: {
    summary: { type: "string" },
    strategy: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 5 },
    strengths: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 5 },
    weaknesses: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 5 },
    improvements: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 6 },
    suggestedChanges: {
      type: "array",
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["action", "cardName", "cardId", "quantity", "reason", "owned"],
        properties: {
          action: { type: "string", enum: ["add", "remove", "increase", "decrease"] },
          cardName: { type: "string" },
          cardId: { type: ["string", "null"] },
          quantity: { type: "integer", minimum: 1, maximum: 4 },
          reason: { type: "string" },
          owned: { type: "boolean" }
        }
      }
    },
    playTips: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 5 }
  }
};

type OpenAiResponsePayload = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

@Injectable()
export class DecksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  async list(userId: string): Promise<DeckSummary[]> {
    const decks = await this.prisma.deck.findMany({
      where: { userId },
      include: {
        archetype: true,
        cards: { include: { card: true } },
        validations: { orderBy: { createdAt: "desc" }, take: 1 }
      },
      orderBy: { updatedAt: "desc" }
    });
    return decks.map((deck) => this.toDeckSummary(deck));
  }

  async create(userId: string, dto: CreateDeckDto): Promise<DeckDetail> {
    const deck = await this.prisma.deck.create({
      data: {
        userId,
        name: dto.name.trim() || "Novo deck",
        format: toPrismaDeckFormat(dto.format ?? "standard"),
        generationMode: toPrismaGenerationMode(dto.generationMode ?? "owned-only"),
        archetypeId: dto.archetypeId || null
      }
    });

    if (dto.cards?.length) {
      await this.replaceDeckCards(userId, deck.id, dto.cards);
    }

    await this.validate(userId, deck.id);
    return this.get(userId, deck.id);
  }

  async get(userId: string, id: string): Promise<DeckDetail> {
    const deck = await this.findDeck(userId, id);
    return this.toDeckDetail(deck);
  }

  async update(userId: string, id: string, dto: UpdateDeckDto): Promise<DeckDetail> {
    await this.findDeck(userId, id);
    await this.prisma.deck.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() || "Deck sem nome" } : {}),
        ...(dto.format !== undefined ? { format: toPrismaDeckFormat(dto.format) } : {}),
        ...(dto.generationMode !== undefined ? { generationMode: toPrismaGenerationMode(dto.generationMode) } : {}),
        ...(dto.archetypeId !== undefined ? { archetypeId: dto.archetypeId || null } : {})
      }
    });

    if (dto.cards) {
      await this.replaceDeckCards(userId, id, dto.cards);
    }

    await this.validate(userId, id);
    return this.get(userId, id);
  }

  async remove(userId: string, id: string): Promise<{ ok: true }> {
    await this.findDeck(userId, id);
    await this.prisma.deck.delete({ where: { id } });
    return { ok: true };
  }

  async validate(userId: string, id: string): Promise<DeckValidationSnapshot> {
    const deck = await this.findDeck(userId, id);
    const snapshot = this.validateCards(deck.cards.map((entry) => ({
      card: entry.card,
      quantity: entry.quantity,
      source: fromPrismaDeckCardSource(entry.source)
    })), fromPrismaDeckFormat(deck.format));

    const saved = await this.prisma.deckValidationResult.create({
      data: {
        deckId: id,
        isValid: snapshot.isValid,
        totalCards: snapshot.totalCards,
        issues: snapshot.issues as unknown as Prisma.InputJsonValue
      }
    });
    await this.prisma.deck.update({
      where: { id },
      data: { validationStatus: snapshot.isValid ? "valid" : "issues" }
    });

    return { ...snapshot, id: saved.id, createdAt: saved.createdAt.toISOString() };
  }

  async analyzeWithAi(userId: string, id: string): Promise<DeckAiAnalysis> {
    const apiKey = this.config.get<string>("OPENAI_API_KEY");
    if (!apiKey) {
      throw new ServiceUnavailableException("Configure OPENAI_API_KEY para usar a analise com IA.");
    }

    const deck = await this.findDeck(userId, id);
    const validation = this.validateCards(deck.cards.map((entry) => ({
      card: entry.card,
      quantity: entry.quantity,
      source: fromPrismaDeckCardSource(entry.source)
    })), fromPrismaDeckFormat(deck.format));
    const inventory = await this.loadInventory(userId);
    const model = this.config.get<string>("OPENAI_MODEL") ?? "gpt-5.5";
    const baseUrl = this.config.get<string>("OPENAI_BASE_URL") ?? "https://api.openai.com/v1";

    const response = await fetch(`${baseUrl}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        reasoning: { effort: "medium" },
        max_output_tokens: 2200,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: [
                  "Voce e um especialista em Pokemon TCG competitivo.",
                  "Analise decks com rigor, mas nao invente cartas fora dos dados recebidos.",
                  "Se sugerir carta que o usuario nao possui, marque owned=false e explique como carta faltante.",
                  "A resposta deve ser em portugues do Brasil, objetiva e util para um jogador montar o deck."
                ].join(" ")
              }
            ]
          },
          {
            role: "user",
            content: [{ type: "input_text", text: JSON.stringify(buildAiDeckContext(deck, validation, inventory)) }]
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "deck_ai_analysis",
            strict: true,
            schema: deckAiAnalysisSchema
          }
        }
      })
    });

    if (!response.ok) {
      const message = await response.text().catch(() => response.statusText);
      throw new BadGatewayException(`A IA nao conseguiu analisar o deck agora. ${message.slice(0, 240)}`);
    }

    const payload = await response.json() as OpenAiResponsePayload;
    const text = extractOpenAiText(payload);
    if (!text) {
      throw new BadGatewayException("A IA retornou uma resposta vazia.");
    }

    try {
      const parsed = JSON.parse(text) as Omit<DeckAiAnalysis, "model" | "generatedAt">;
      return {
        model,
        generatedAt: new Date().toISOString(),
        summary: parsed.summary,
        strategy: parsed.strategy,
        strengths: parsed.strengths,
        weaknesses: parsed.weaknesses,
        improvements: parsed.improvements,
        suggestedChanges: parsed.suggestedChanges,
        playTips: parsed.playTips
      };
    } catch (err) {
      throw new BadGatewayException(err instanceof Error ? `Falha ao interpretar resposta da IA: ${err.message}` : "Falha ao interpretar resposta da IA.");
    }
  }

  async listArchetypes(): Promise<DeckArchetypeSummary[]> {
    await this.ensureCuratedArchetypes();
    const archetypes = await this.prisma.deckArchetype.findMany({
      orderBy: [{ source: "asc" }, { confidence: "desc" }, { name: "asc" }]
    });
    return archetypes.map(toArchetypeSummary);
  }

  async syncMetagame(dto: MetagameSyncDto = {}) {
    const job = await this.prisma.metagameSyncJob.create({
      data: { source: dto.includeLimitless ? "curated+limitless" : "curated", status: "running" }
    });

    try {
      const count = await this.ensureCuratedArchetypes();
      const message = dto.includeLimitless
        ? "Base curada atualizada. Limitless fica registrado como fonte externa para evolucao do sync automatico."
        : "Base curada atualizada.";
      const updated = await this.prisma.metagameSyncJob.update({
        where: { id: job.id },
        data: { status: "completed", totalArchetypes: count, message, finishedAt: new Date() }
      });
      return updated;
    } catch (err) {
      const updated = await this.prisma.metagameSyncJob.update({
        where: { id: job.id },
        data: {
          status: "failed",
          message: err instanceof Error ? err.message : "Falha ao sincronizar metagame",
          finishedAt: new Date()
        }
      });
      return updated;
    }
  }

  async generateBest(userId: string, dto: GenerateBestDeckDto): Promise<DeckSuggestion[]> {
    await this.ensureCuratedArchetypes();
    const format = dto.format ?? "standard";
    const mode = dto.mode ?? "owned-only";
    const maxSuggestions = dto.maxSuggestions ?? 3;
    const inventory = await this.loadInventory(userId);
    const archetypes = await this.prisma.deckArchetype.findMany({
      where: { format: toPrismaDeckFormat(format) },
      include: { cards: { include: { card: true } } },
      orderBy: [{ confidence: "desc" }, { name: "asc" }]
    });

    return archetypes
      .map((archetype) => this.buildSuggestion(archetype, inventory, format, mode, dto.preferredTypes ?? []))
      .sort((a, b) => b.compatibility - a.compatibility)
      .slice(0, maxSuggestions);
  }

  private async findDeck(userId: string, id: string): Promise<DeckWithRelations> {
    const deck = await this.prisma.deck.findFirst({
      where: { id, userId },
      include: {
        archetype: true,
        cards: { include: { card: true }, orderBy: { createdAt: "asc" } },
        validations: { orderBy: { createdAt: "desc" }, take: 1 }
      }
    });
    if (!deck) {
      throw new NotFoundException("Deck not found");
    }
    return deck;
  }

  private async replaceDeckCards(userId: string, deckId: string, cards: NonNullable<CreateDeckDto["cards"]>) {
    const inventory = await this.loadInventory(userId);
    const ownedByCardId = new Map<string, number>();
    inventory.forEach((item) => ownedByCardId.set(item.cardId, (ownedByCardId.get(item.cardId) ?? 0) + item.quantity));

    const grouped = new Map<string, { cardId: string; quantity: number; source: "owned" | "missing" }>();
    cards.forEach((item) => {
      const source = item.source ?? "owned";
      const key = `${item.cardId}:${source}`;
      const current = grouped.get(key);
      grouped.set(key, {
        cardId: item.cardId,
        quantity: (current?.quantity ?? 0) + item.quantity,
        source
      });
    });

    for (const item of grouped.values()) {
      if (item.source === "owned" && item.quantity > (ownedByCardId.get(item.cardId) ?? 0)) {
        throw new BadRequestException("Deck uses more owned copies than available in inventory");
      }
    }

    await this.prisma.$transaction([
      this.prisma.deckCard.deleteMany({ where: { deckId } }),
      ...Array.from(grouped.values()).map((item) =>
        this.prisma.deckCard.create({
          data: {
            deckId,
            cardId: item.cardId,
            quantity: item.quantity,
            source: toPrismaDeckCardSource(item.source)
          }
        })
      )
    ]);
  }

  private async loadInventory(userId: string): Promise<InventoryItem[]> {
    return this.prisma.collectionItem.findMany({
      where: { userId },
      include: { card: true },
      orderBy: { updatedAt: "desc" }
    });
  }

  private buildSuggestion(
    archetype: ArchetypeWithCards,
    inventory: InventoryItem[],
    format: DeckFormat,
    mode: DeckGenerationMode,
    preferredTypes: string[]
  ): DeckSuggestion {
    const ownedByName = new Map<string, CandidateCard[]>();
    inventory.forEach((item) => {
      if (format === "standard" && !isStandardLegal(item.card)) return;
      const key = normalizeSearchText(item.card.name);
      const current = ownedByName.get(key) ?? [];
      current.push({ card: item.card, available: item.quantity });
      ownedByName.set(key, current);
    });

    const selected = new Map<string, { card: InventoryItem["card"]; quantity: number; source: "owned" | "missing"; role: string }>();
    const missingCards: DeckSuggestionMissingCard[] = [];
    let weightedTotal = 0;
    let weightedOwned = 0;

    const sortedCards = [...archetype.cards].sort((a, b) => Number(b.required) - Number(a.required) || b.priority - a.priority);
    for (const archetypeCard of sortedCards) {
      const key = normalizeSearchText(archetypeCard.cardName);
      const weight = Math.max(1, archetypeCard.priority || 1) * archetypeCard.quantity;
      weightedTotal += weight;
      const ownedCandidates = ownedByName.get(key) ?? [];
      const owned = ownedCandidates[0];
      const ownedQuantity = owned ? Math.min(archetypeCard.quantity, owned.available) : 0;
      if (owned && ownedQuantity > 0) {
        weightedOwned += weight * (ownedQuantity / archetypeCard.quantity);
        addSelected(selected, owned.card, ownedQuantity, "owned", archetypeCard.role);
      }

      const missingQuantity = archetypeCard.quantity - ownedQuantity;
      if (missingQuantity > 0 && mode === "allow-missing") {
        const card = archetypeCard.card ?? owned?.card ?? null;
        if (card) {
          addSelected(selected, card, missingQuantity, "missing", archetypeCard.role);
        }
        missingCards.push({ cardName: archetypeCard.cardName, quantity: missingQuantity, role: archetypeCard.role });
      }
    }

    this.fillDeckFromInventory(selected, inventory, format);
    if (mode === "allow-missing" && totalSelectedCards(selected) < DECK_SIZE) {
      const remaining = DECK_SIZE - totalSelectedCards(selected);
      missingCards.push({ cardName: "Cartas de consistencia compativeis com o arquetipo", quantity: remaining, role: "filler" });
    }

    const cards = Array.from(selected.values()).slice(0, 80).map((item) => ({
      card: toCardSummary(item.card),
      quantity: item.quantity,
      source: item.source,
      role: item.role
    }));
    const validation = this.validateCards(Array.from(selected.values()), format);
    const preferredBonus = preferredTypes.length && cards.some((item) => item.card.types.some((type) => preferredTypes.includes(type))) ? 5 : 0;
    const compatibility = Math.min(100, Math.round(((weightedOwned / Math.max(1, weightedTotal)) * 100) + preferredBonus));
    const missingTotal = missingCards.reduce((sum, item) => sum + item.quantity, 0);
    const explanation = mode === "owned-only" && validation.totalCards < DECK_SIZE
      ? `Sugestao baseada em ${archetype.name}. Encontrei ${validation.totalCards} cartas validas no seu inventario para este formato, entao a lista ainda nao fecha 60 cartas.`
      : missingTotal > 0
        ? `Sugestao baseada em ${archetype.name}. A lista fecha ${validation.totalCards} cartas e marca ${missingTotal} carta(s) que ainda nao estao no seu inventario.`
        : `Sugestao baseada em ${archetype.name}. A lista fecha ${validation.totalCards} cartas usando apenas cartas disponiveis no seu inventario.`;

    return {
      archetype: toArchetypeSummary(archetype),
      compatibility,
      format,
      mode,
      cards,
      missingCards,
      validation,
      explanation
    };
  }

  private fillDeckFromInventory(
    selected: Map<string, { card: InventoryItem["card"]; quantity: number; source: "owned" | "missing"; role: string }>,
    inventory: InventoryItem[],
    format: DeckFormat
  ) {
    const selectedByCard = new Map<string, number>();
    selected.forEach((item) => selectedByCard.set(item.card.id, item.quantity));
    const sortedInventory = [...inventory].sort((a, b) => scoreFillerCard(b.card) - scoreFillerCard(a.card));

    for (const item of sortedInventory) {
      if (totalSelectedCards(selected) >= DECK_SIZE) return;
      if (format === "standard" && !isStandardLegal(item.card)) continue;
      const used = selectedByCard.get(item.cardId) ?? 0;
      const copyLimitRemaining = isBasicEnergy(item.card)
        ? DECK_SIZE
        : Math.max(0, MAX_COPIES_BY_NAME - totalSelectedByName(selected, item.card.name));
      const quantity = Math.min(item.quantity - used, copyLimitRemaining, DECK_SIZE - totalSelectedCards(selected));
      if (quantity <= 0) continue;
      addSelected(selected, item.card, quantity, "owned", "filler");
      selectedByCard.set(item.cardId, used + quantity);
    }
  }

  private validateCards(
    cards: Array<{ card: InventoryItem["card"]; quantity: number; source: "owned" | "missing" }>,
    format: DeckFormat
  ): DeckValidationSnapshot {
    const issues: DeckValidationIssue[] = [];
    const totalCards = cards.reduce((sum, item) => sum + item.quantity, 0);

    if (totalCards === 0) {
      issues.push({ severity: "error", code: "empty-deck", message: "O deck ainda nao tem cartas." });
    }
    if (totalCards !== DECK_SIZE) {
      issues.push({ severity: "error", code: "deck-size", message: `O deck precisa ter exatamente ${DECK_SIZE} cartas. Atualmente tem ${totalCards}.` });
    }

    const byName = new Map<string, { name: string; quantity: number; card: InventoryItem["card"] }>();
    for (const item of cards) {
      if (item.source === "missing") {
        issues.push({ severity: "warning", code: "missing-card", message: `${item.quantity} copia(s) de ${item.card.name} ainda nao estao no inventario.`, cardName: item.card.name });
      }
      const key = normalizeSearchText(item.card.name);
      const current = byName.get(key) ?? { name: item.card.name, quantity: 0, card: item.card };
      current.quantity += item.quantity;
      byName.set(key, current);

      if (format === "standard" && !isStandardLegal(item.card)) {
        issues.push({ severity: "error", code: "standard-legality", message: `${item.card.name} nao parece legal no Standard atual.`, cardName: item.card.name });
      }
      if (format === "casual" && !isStandardLegal(item.card)) {
        issues.push({ severity: "warning", code: "standard-legality", message: `${item.card.name} nao parece legal no Standard atual.`, cardName: item.card.name });
      }
    }

    byName.forEach((entry) => {
      if (!isBasicEnergy(entry.card) && entry.quantity > MAX_COPIES_BY_NAME) {
        issues.push({ severity: "error", code: "copy-limit", message: `${entry.name} ultrapassa o limite de ${MAX_COPIES_BY_NAME} copias.`, cardName: entry.name });
      }
    });

    return {
      isValid: issues.every((issue) => issue.severity !== "error"),
      totalCards,
      issues
    };
  }

  private toDeckSummary(deck: DeckWithRelations): DeckSummary {
    const totalCards = deck.cards.reduce((sum, item) => sum + item.quantity, 0);
    const missingCards = deck.cards.filter((item) => item.source === PrismaDeckCardSource.MISSING).reduce((sum, item) => sum + item.quantity, 0);
    return {
      id: deck.id,
      name: deck.name,
      format: fromPrismaDeckFormat(deck.format),
      generationMode: fromPrismaGenerationMode(deck.generationMode),
      archetypeName: deck.archetype?.name ?? null,
      validationStatus: deck.validationStatus,
      totalCards,
      missingCards,
      createdAt: deck.createdAt.toISOString(),
      updatedAt: deck.updatedAt.toISOString()
    };
  }

  private toDeckDetail(deck: DeckWithRelations): DeckDetail {
    return {
      ...this.toDeckSummary(deck),
      cards: deck.cards.map(toDeckCard),
      validation: deck.validations[0] ? toValidationSnapshot(deck.validations[0]) : null
    };
  }

  private async ensureCuratedArchetypes(): Promise<number> {
    for (const archetype of CURATED_ARCHETYPES) {
      const saved = await this.prisma.deckArchetype.upsert({
        where: { slug: archetype.slug },
        create: {
          slug: archetype.slug,
          name: archetype.name,
          format: PrismaDeckFormat.STANDARD,
          strategy: archetype.strategy,
          source: "curated",
          confidence: 80
        },
        update: {
          name: archetype.name,
          strategy: archetype.strategy,
          source: "curated",
          confidence: 80
        }
      });

      await this.prisma.deckArchetypeCard.deleteMany({ where: { archetypeId: saved.id } });
      for (const [cardName, quantity, role, required, priority] of archetype.cards) {
        const card = await this.prisma.card.findFirst({
          where: { normalizedName: normalizeSearchText(cardName) },
          orderBy: { updatedAt: "desc" }
        });
        await this.prisma.deckArchetypeCard.create({
          data: {
            archetypeId: saved.id,
            cardId: card?.id ?? null,
            cardName,
            quantity,
            role,
            required,
            priority
          }
        });
      }
    }
    return CURATED_ARCHETYPES.length;
  }
}

function toDeckCard(item: DeckWithRelations["cards"][number]): DeckCard {
  return {
    id: item.id,
    card: toCardSummary(item.card),
    quantity: item.quantity,
    source: fromPrismaDeckCardSource(item.source)
  };
}

function toValidationSnapshot(validation: DeckWithRelations["validations"][number]): DeckValidationSnapshot {
  const issues = Array.isArray(validation.issues) ? validation.issues as DeckValidationIssue[] : [];
  return {
    id: validation.id,
    isValid: validation.isValid,
    totalCards: validation.totalCards,
    issues,
    createdAt: validation.createdAt.toISOString()
  };
}

function toArchetypeSummary(archetype: { id: string; slug: string; name: string; format: PrismaDeckFormat; strategy: string | null; source: string; confidence: number }): DeckArchetypeSummary {
  return {
    id: archetype.id,
    slug: archetype.slug,
    name: archetype.name,
    format: fromPrismaDeckFormat(archetype.format),
    strategy: archetype.strategy,
    source: archetype.source,
    confidence: archetype.confidence
  };
}

function buildAiDeckContext(deck: DeckWithRelations, validation: DeckValidationSnapshot, inventory: InventoryItem[]) {
  const inventoryByCardId = new Map<string, number>();
  inventory.forEach((item) => inventoryByCardId.set(item.cardId, (inventoryByCardId.get(item.cardId) ?? 0) + item.quantity));
  const inventoryCards = inventory.slice(0, 180).map((item) => ({
    cardId: item.cardId,
    name: item.card.name,
    quantity: item.quantity,
    number: item.card.number,
    setName: item.card.setName,
    supertype: item.card.supertype,
    subtypes: item.card.subtypes,
    types: item.card.types,
    regulationMark: item.card.regulationMark,
    abilities: item.card.abilities,
    attacks: item.card.attacks,
    rules: item.card.rules
  }));

  return {
    instructions: [
      "Explique a estrategia do deck atual.",
      "Sugira melhorias concretas de lista, respeitando 60 cartas, limite de 4 copias por nome e cartas legais do formato.",
      "Priorize cartas que o usuario possui. Para cartas fora do inventario, use owned=false.",
      "Nao use cardId para cartas que nao aparecem no inventario ou no deck."
    ],
    rules: {
      deckSize: DECK_SIZE,
      maxCopiesByName: MAX_COPIES_BY_NAME,
      standardLegalMarks: Array.from(STANDARD_LEGAL_MARKS),
      format: fromPrismaDeckFormat(deck.format),
      basicEnergyException: true
    },
    deck: {
      id: deck.id,
      name: deck.name,
      format: fromPrismaDeckFormat(deck.format),
      generationMode: fromPrismaGenerationMode(deck.generationMode),
      archetype: deck.archetype?.name ?? null,
      validation,
      cards: deck.cards.map((entry) => ({
        cardId: entry.cardId,
        name: entry.card.name,
        quantity: entry.quantity,
        source: fromPrismaDeckCardSource(entry.source),
        ownedQuantity: inventoryByCardId.get(entry.cardId) ?? 0,
        number: entry.card.number,
        setName: entry.card.setName,
        supertype: entry.card.supertype,
        subtypes: entry.card.subtypes,
        types: entry.card.types,
        regulationMark: entry.card.regulationMark,
        abilities: entry.card.abilities,
        attacks: entry.card.attacks,
        rules: entry.card.rules
      }))
    },
    inventory: inventoryCards
  };
}

function extractOpenAiText(payload: OpenAiResponsePayload): string | null {
  if (payload.output_text) return payload.output_text;
  for (const output of payload.output ?? []) {
    for (const content of output.content ?? []) {
      if (typeof content.text === "string") return content.text;
    }
  }
  return null;
}

function addSelected(
  selected: Map<string, { card: InventoryItem["card"]; quantity: number; source: "owned" | "missing"; role: string }>,
  card: InventoryItem["card"],
  quantity: number,
  source: "owned" | "missing",
  role: string
) {
  const key = `${card.id}:${source}`;
  const current = selected.get(key);
  selected.set(key, {
    card,
    quantity: (current?.quantity ?? 0) + quantity,
    source,
    role: current?.role ?? role
  });
}

function totalSelectedCards(selected: Map<string, { quantity: number }>): number {
  return Array.from(selected.values()).reduce((sum, item) => sum + item.quantity, 0);
}

function totalSelectedByName(selected: Map<string, { card: InventoryItem["card"]; quantity: number }>, name: string): number {
  const normalized = normalizeSearchText(name);
  return Array.from(selected.values())
    .filter((item) => normalizeSearchText(item.card.name) === normalized)
    .reduce((sum, item) => sum + item.quantity, 0);
}

function scoreFillerCard(card: InventoryItem["card"]): number {
  const supertype = card.supertype?.toLowerCase() ?? "";
  const subtypes = card.subtypes.map((subtype) => subtype.toLowerCase());
  const name = normalizeSearchText(card.name);
  let score = 0;

  if (supertype === "trainer") score += 40;
  if (supertype === "energy") score += 25;
  if (supertype === "pokémon" || supertype === "pokemon") score += 10;
  if (subtypes.includes("basic")) score += 8;
  if (subtypes.includes("item")) score += 10;
  if (subtypes.includes("supporter")) score += 8;
  if (name.includes("ball")) score += 6;
  if (name.includes("energy")) score += 4;

  return score;
}

function isBasicEnergy(card: InventoryItem["card"]): boolean {
  const normalized = normalizeSearchText(card.name);
  return (
    BASIC_ENERGY_NAMES.has(normalized) ||
    (card.supertype?.toLowerCase() === "energy" && card.subtypes.some((subtype) => subtype.toLowerCase() === "basic"))
  );
}

function isStandardLegal(card: InventoryItem["card"]): boolean {
  if (isBasicEnergy(card)) return true;
  return Boolean(card.regulationMark && STANDARD_LEGAL_MARKS.has(card.regulationMark.toUpperCase()));
}

function toPrismaDeckFormat(format: DeckFormat): PrismaDeckFormat {
  return format === "casual" ? PrismaDeckFormat.CASUAL : PrismaDeckFormat.STANDARD;
}

function fromPrismaDeckFormat(format: PrismaDeckFormat): DeckFormat {
  return format === PrismaDeckFormat.CASUAL ? "casual" : "standard";
}

function toPrismaGenerationMode(mode: DeckGenerationMode): PrismaDeckGenerationMode {
  return mode === "allow-missing" ? PrismaDeckGenerationMode.ALLOW_MISSING : PrismaDeckGenerationMode.OWNED_ONLY;
}

function fromPrismaGenerationMode(mode: PrismaDeckGenerationMode): DeckGenerationMode {
  return mode === PrismaDeckGenerationMode.ALLOW_MISSING ? "allow-missing" : "owned-only";
}

function toPrismaDeckCardSource(source: "owned" | "missing"): PrismaDeckCardSource {
  return source === "missing" ? PrismaDeckCardSource.MISSING : PrismaDeckCardSource.OWNED;
}

function fromPrismaDeckCardSource(source: PrismaDeckCardSource): "owned" | "missing" {
  return source === PrismaDeckCardSource.MISSING ? "missing" : "owned";
}
