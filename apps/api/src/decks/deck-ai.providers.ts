import { ConfigService } from "@nestjs/config";
import { DeckAiAnalysis, DeckAiSuggestedChange } from "@poke-organizer/shared";

export type DeckAiProviderName = DeckAiAnalysis["provider"];

export type DeckAiContext = {
  instructions: string[];
  rules: {
    deckSize: number;
    maxCopiesByName: number;
    standardLegalMarks: string[];
    format: string;
    basicEnergyException: boolean;
  };
  deck: {
    id: string;
    name: string;
    format: string;
    generationMode: string;
    archetype: string | null;
    validation: {
      isValid: boolean;
      totalCards: number;
      issues: Array<{
        severity: string;
        code: string;
        message: string;
        cardName?: string | null;
      }>;
    };
    cards: DeckAiContextCard[];
  };
  inventory: DeckAiContextCard[];
};

type DeckAiContextCard = {
  cardId: string;
  name: string;
  quantity: number;
  source?: string;
  ownedQuantity?: number;
  number: string;
  setName?: string | null;
  supertype?: string | null;
  subtypes: string[];
  types: string[];
  regulationMark?: string | null;
  abilities?: unknown;
  attacks?: unknown;
  rules: string[];
};

export const deckAiAnalysisSchema = {
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
} as const;

type OpenAiResponsePayload = {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
};

type GeminiResponsePayload = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

export async function analyzeDeckWithProvider(
  config: ConfigService,
  context: DeckAiContext
): Promise<DeckAiAnalysis> {
  const provider = normalizeProvider(config.get<string>("DECK_AI_PROVIDER") ?? "gemini");
  const fallbackProvider = normalizeProvider(config.get<string>("DECK_AI_FALLBACK_PROVIDER") ?? "local");

  try {
    const analysis = await callProvider(provider, config, context, false);
    return analysis;
  } catch {
    if (provider === fallbackProvider) {
      return callLocalProvider(context, false);
    }
    return callProvider(fallbackProvider, config, context, true);
  }
}

async function callProvider(
  provider: DeckAiProviderName,
  config: ConfigService,
  context: DeckAiContext,
  fallbackUsed: boolean
): Promise<DeckAiAnalysis> {
  if (provider === "openai") {
    return callOpenAiProvider(config, context, fallbackUsed);
  }
  if (provider === "gemini") {
    return callGeminiProvider(config, context, fallbackUsed);
  }
  return callLocalProvider(context, fallbackUsed);
}

async function callGeminiProvider(
  config: ConfigService,
  context: DeckAiContext,
  fallbackUsed: boolean
): Promise<DeckAiAnalysis> {
  const apiKey = config.get<string>("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const model = config.get<string>("GEMINI_MODEL") ?? "gemini-2.5-flash-lite";
  const timeoutMs = getNumberConfig(config, "DECK_AI_TIMEOUT_MS", 12000);
  const maxOutputTokens = getNumberConfig(config, "DECK_AI_MAX_OUTPUT_TOKENS", 1600);
  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: buildProviderPrompt(context) }]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: deckAiAnalysisSchema,
          maxOutputTokens
        }
      })
    },
    timeoutMs
  );

  if (!response.ok) {
    throw new Error(`Gemini returned ${response.status}`);
  }

  const payload = await response.json() as GeminiResponsePayload;
  const text = payload.candidates?.flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text)
    .find((partText): partText is string => Boolean(partText));
  if (!text) {
    throw new Error("Gemini returned empty text");
  }

  return normalizeAnalysis(JSON.parse(text), "gemini", model, fallbackUsed);
}

async function callOpenAiProvider(
  config: ConfigService,
  context: DeckAiContext,
  fallbackUsed: boolean
): Promise<DeckAiAnalysis> {
  const apiKey = config.get<string>("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const model = config.get<string>("OPENAI_MODEL") ?? "gpt-5-nano";
  const baseUrl = config.get<string>("OPENAI_BASE_URL") ?? "https://api.openai.com/v1";
  const timeoutMs = getNumberConfig(config, "DECK_AI_TIMEOUT_MS", 12000);
  const maxOutputTokens = getNumberConfig(config, "DECK_AI_MAX_OUTPUT_TOKENS", 1600);
  const response = await fetchWithTimeout(
    `${baseUrl}/responses`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        reasoning: { effort: "medium" },
        max_output_tokens: maxOutputTokens,
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
            content: [{ type: "input_text", text: JSON.stringify(context) }]
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
    },
    timeoutMs
  );

  if (!response.ok) {
    throw new Error(`OpenAI returned ${response.status}`);
  }

  const payload = await response.json() as OpenAiResponsePayload;
  const text = extractOpenAiText(payload);
  if (!text) {
    throw new Error("OpenAI returned empty text");
  }

  return normalizeAnalysis(JSON.parse(text), "openai", model, fallbackUsed);
}

function callLocalProvider(context: DeckAiContext, fallbackUsed: boolean): DeckAiAnalysis {
  const deckCards = context.deck.cards;
  const inventoryByName = groupCardsByName(context.inventory);
  const deckByName = groupCardsByName(deckCards);
  const totalCards = context.deck.validation.totalCards;
  const missingCards = deckCards.filter((card) => card.source === "missing");
  const errors = context.deck.validation.issues.filter((issue) => issue.severity === "error");
  const warnings = context.deck.validation.issues.filter((issue) => issue.severity !== "error");
  const archetypeText = context.deck.archetype ? ` no arquetipo ${context.deck.archetype}` : "";
  const trainers = totalBySupertype(deckCards, "trainer");
  const energy = totalBySupertype(deckCards, "energy");
  const pokemon = totalBySupertype(deckCards, "pokemon");
  const suggestedChanges = buildLocalSuggestedChanges(context, inventoryByName, deckByName);

  const weaknesses = [
    ...errors.slice(0, 3).map((issue) => issue.message),
    ...(missingCards.length ? [`Existem ${sumQuantities(missingCards)} carta(s) marcadas como fora do inventario.`] : []),
    ...(trainers < 20 ? ["A lista parece ter poucos Trainers para consistencia de compra e busca."] : []),
    ...(totalCards < context.rules.deckSize ? [`Ainda faltam ${context.rules.deckSize - totalCards} carta(s) para fechar 60.`] : [])
  ].slice(0, 5);

  return {
    provider: "local",
    fallbackUsed,
    model: "local-rules-v1",
    generatedAt: new Date().toISOString(),
    summary: totalCards === context.rules.deckSize
      ? `Analise local do deck ${context.deck.name}${archetypeText}: a lista fecha 60 cartas e foi avaliada pelas regras cadastradas.`
      : `Analise local do deck ${context.deck.name}${archetypeText}: a lista tem ${totalCards}/60 cartas e precisa de ajustes antes de ficar pronta.`,
    strategy: [
      context.deck.archetype
        ? `Use a linha principal do arquetipo ${context.deck.archetype} como plano central e priorize cartas que buscam ou aceleram essa linha.`
        : "Defina uma linha principal de ataque e use o inventario para reforcar consistencia antes de adicionar cartas situacionais.",
      `Composicao atual: ${pokemon} Pokemon, ${trainers} Trainers e ${energy} Energias.`,
      "Priorize cartas ja possuidas para manter a lista executavel agora e marque faltantes apenas quando o ganho for claro."
    ],
    strengths: [
      ...(context.deck.validation.isValid ? ["A lista atual passa nas regras cadastradas do formato."] : []),
      ...(totalCards > 0 ? [`O deck ja tem ${totalCards} carta(s) selecionadas para evoluir a partir de uma base real.`] : []),
      ...(warnings.length === 0 ? ["Nao ha avisos adicionais alem das regras principais no momento."] : [])
    ].slice(0, 5),
    weaknesses: weaknesses.length ? weaknesses : ["A lista nao tem um problema estrutural evidente pela analise local, mas ainda vale revisar sinergia e consistencia."],
    improvements: [
      "Feche exatamente 60 cartas antes de tratar o deck como pronto para jogo.",
      "Reduza qualquer carta nao Energia Basica que passe de 4 copias pelo mesmo nome.",
      "Troque cartas fora do Standard por opcoes equivalentes legais no formato atual.",
      "Aumente a densidade de cartas de busca, compra e reciclagem quando o inventario permitir.",
      "Revise as cartas faltantes e separe o que e essencial do que e apenas melhoria."
    ],
    suggestedChanges,
    playTips: [
      "Nos primeiros turnos, priorize montar o atacante principal e acessar cartas de busca.",
      "Use recursos de compra antes de gastar cartas de troca ou energia quando precisar achar pecas especificas.",
      "Contra decks mais rapidos, preserve cartas defensivas e tente estabilizar o banco antes de perseguir nocautes."
    ]
  };
}

function buildProviderPrompt(context: DeckAiContext): string {
  return [
    "Voce e um especialista em Pokemon TCG competitivo.",
    "Analise somente os dados enviados. Nao invente cardId nem cartas que nao estejam no deck ou inventario.",
    "Sugira melhorias realistas e explique a estrategia em portugues do Brasil.",
    "Retorne apenas JSON valido seguindo o schema solicitado.",
    JSON.stringify(context)
  ].join("\n\n");
}

function buildLocalSuggestedChanges(
  context: DeckAiContext,
  inventoryByName: Map<string, DeckAiContextCard[]>,
  deckByName: Map<string, DeckAiContextCard[]>
): DeckAiSuggestedChange[] {
  const changes: DeckAiSuggestedChange[] = [];
  const seen = new Set<string>();

  for (const issue of context.deck.validation.issues) {
    if (issue.code === "copy-limit" && issue.cardName) {
      pushChange(changes, seen, {
        action: "decrease",
        cardName: issue.cardName,
        cardId: deckByName.get(normalizeName(issue.cardName))?.[0]?.cardId ?? null,
        quantity: 1,
        reason: "Esta carta ultrapassa o limite de copias por nome.",
        owned: true
      });
    }
    if (issue.code === "standard-legality" && issue.cardName) {
      pushChange(changes, seen, {
        action: "remove",
        cardName: issue.cardName,
        cardId: deckByName.get(normalizeName(issue.cardName))?.[0]?.cardId ?? null,
        quantity: 1,
        reason: "Ela nao parece legal no Standard atual.",
        owned: true
      });
    }
  }

  const usefulInventory = context.inventory
    .filter((card) => !deckByName.has(normalizeName(card.name)))
    .sort((a, b) => scoreLocalCard(b) - scoreLocalCard(a))
    .slice(0, 6);

  for (const card of usefulInventory) {
    pushChange(changes, seen, {
      action: "add",
      cardName: card.name,
      cardId: card.cardId,
      quantity: Math.min(2, card.quantity),
      reason: "Carta disponivel no inventario que pode melhorar consistencia ou preencher a lista.",
      owned: true
    });
  }

  for (const [name, cards] of inventoryByName) {
    const deckQuantity = sumQuantities(deckByName.get(name) ?? []);
    const inventoryQuantity = sumQuantities(cards);
    if (deckQuantity > 0 && deckQuantity < Math.min(4, inventoryQuantity) && scoreLocalCard(cards[0]) >= 20) {
      pushChange(changes, seen, {
        action: "increase",
        cardName: cards[0].name,
        cardId: cards[0].cardId,
        quantity: 1,
        reason: "Voce tem mais copias no inventario e a carta ajuda na consistencia do deck.",
        owned: true
      });
    }
  }

  return changes.slice(0, 10);
}

function pushChange(changes: DeckAiSuggestedChange[], seen: Set<string>, change: DeckAiSuggestedChange) {
  const key = `${change.action}:${normalizeName(change.cardName)}:${change.cardId ?? ""}`;
  if (seen.has(key)) return;
  seen.add(key);
  changes.push(change);
}

function normalizeAnalysis(
  value: Partial<DeckAiAnalysis>,
  provider: DeckAiProviderName,
  model: string,
  fallbackUsed: boolean
): DeckAiAnalysis {
  return {
    provider,
    fallbackUsed,
    model,
    generatedAt: new Date().toISOString(),
    summary: toText(value.summary, "Analise gerada para o deck."),
    strategy: toTextArray(value.strategy, ["Revise o plano de jogo com base nas cartas principais."]),
    strengths: toTextArray(value.strengths, ["Ha uma base de cartas para evoluir a lista."]),
    weaknesses: toTextArray(value.weaknesses, ["Revise consistencia, contagem de cartas e legalidade do formato."]),
    improvements: toTextArray(value.improvements, ["Ajuste a lista ate fechar 60 cartas validas."]),
    suggestedChanges: Array.isArray(value.suggestedChanges)
      ? value.suggestedChanges.filter(isSuggestedChange).slice(0, 10)
      : [],
    playTips: toTextArray(value.playTips, ["Priorize montar o plano principal nos primeiros turnos."])
  };
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
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

function normalizeProvider(value: string): DeckAiProviderName {
  if (value === "openai" || value === "gemini" || value === "local") return value;
  if (value === "mock") return "local";
  return "gemini";
}

function getNumberConfig(config: ConfigService, key: string, fallback: number): number {
  const value = Number(config.get<string>(key));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function isSuggestedChange(value: unknown): value is DeckAiSuggestedChange {
  if (!value || typeof value !== "object") return false;
  const change = value as DeckAiSuggestedChange;
  return (
    ["add", "remove", "increase", "decrease"].includes(change.action) &&
    typeof change.cardName === "string" &&
    typeof change.quantity === "number" &&
    typeof change.reason === "string" &&
    typeof change.owned === "boolean"
  );
}

function toText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function toTextArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const items = value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim());
  return items.length ? items : fallback;
}

function groupCardsByName(cards: DeckAiContextCard[]): Map<string, DeckAiContextCard[]> {
  const map = new Map<string, DeckAiContextCard[]>();
  cards.forEach((card) => {
    const key = normalizeName(card.name);
    map.set(key, [...(map.get(key) ?? []), card]);
  });
  return map;
}

function normalizeName(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function totalBySupertype(cards: DeckAiContextCard[], supertype: string): number {
  return cards
    .filter((card) => normalizeName(card.supertype ?? "") === supertype)
    .reduce((sum, card) => sum + card.quantity, 0);
}

function sumQuantities(cards: DeckAiContextCard[]): number {
  return cards.reduce((sum, card) => sum + card.quantity, 0);
}

function scoreLocalCard(card: DeckAiContextCard): number {
  const supertype = normalizeName(card.supertype ?? "");
  const name = normalizeName(card.name);
  const subtypes = card.subtypes.map(normalizeName);
  let score = 0;
  if (supertype === "trainer") score += 40;
  if (supertype === "energy") score += 20;
  if (subtypes.includes("item")) score += 12;
  if (subtypes.includes("supporter")) score += 10;
  if (name.includes("ball")) score += 10;
  if (name.includes("rare candy")) score += 10;
  if (name.includes("boss")) score += 8;
  if (name.includes("energy")) score += 5;
  if (Array.isArray(card.abilities) && card.abilities.length > 0) score += 6;
  if (Array.isArray(card.attacks) && card.attacks.length > 0) score += 4;
  return score;
}
