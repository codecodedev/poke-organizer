import { describe, expect, it } from "vitest";
import type { DeckValidationIssue } from "@poke-organizer/shared";
import { DecksService } from "./decks.service";

describe("DecksService rules", () => {
  const service = new DecksService({} as never);

  it("requires exactly 60 cards", () => {
    const card = makeCard({ name: "Pikachu ex" });

    const shortDeck = validate([{ card, quantity: 59, source: "owned" }]);
    const longDeck = validate([{ card, quantity: 61, source: "owned" }]);

    expect(shortDeck.issues.some((issue: DeckValidationIssue) => issue.code === "deck-size")).toBe(true);
    expect(longDeck.issues.some((issue: DeckValidationIssue) => issue.code === "deck-size")).toBe(true);
  });

  it("limits non-energy cards to 4 copies by name", () => {
    const card = makeCard({ name: "Ultra Ball", supertype: "Trainer" });
    const result = validate([
      { card, quantity: 5, source: "owned" },
      { card: makeCard({ name: "Fire Energy", supertype: "Energy", subtypes: ["Basic"] }), quantity: 55, source: "owned" },
    ]);

    expect(result.issues.some((issue: DeckValidationIssue) => issue.code === "copy-limit")).toBe(true);
  });

  it("allows more than 4 basic energy cards", () => {
    const result = validate([
      { card: makeCard({ name: "Fire Energy", supertype: "Energy", subtypes: ["Basic"] }), quantity: 60, source: "owned" },
    ]);

    expect(result.issues.some((issue: DeckValidationIssue) => issue.code === "copy-limit")).toBe(false);
    expect(result.isValid).toBe(true);
  });

  it("blocks non-standard cards in Standard and only warns in Casual", () => {
    const oldCard = makeCard({ name: "Old Supporter", supertype: "Trainer", regulationMark: "G" });
    const energy = makeCard({ name: "Fire Energy", supertype: "Energy", subtypes: ["Basic"], regulationMark: null });

    const standard = validate([
      { card: oldCard, quantity: 4, source: "owned" },
      { card: energy, quantity: 56, source: "owned" },
    ], "standard");
    const casual = validate([
      { card: oldCard, quantity: 4, source: "owned" },
      { card: energy, quantity: 56, source: "owned" },
    ], "casual");

    expect(standard.isValid).toBe(false);
    expect(standard.issues.some((issue: DeckValidationIssue) => issue.code === "standard-legality" && issue.severity === "error")).toBe(true);
    expect(casual.isValid).toBe(true);
    expect(casual.issues.some((issue: DeckValidationIssue) => issue.code === "standard-legality" && issue.severity === "warning")).toBe(true);
  });

  it("does not exceed owned inventory in owned-only suggestions", () => {
    const card = makeCard({ id: "charizard", name: "Charizard ex" });
    const suggestion = (service as never as { buildSuggestion: Function }).buildSuggestion(
      makeArchetype("Charizard ex", 3),
      [{ id: "item-1", userId: "u", cardId: card.id, quantity: 1, condition: "NM", variant: "normal", foil: false, language: "EN", notes: null, cardPriceId: null, createdAt: new Date(), updatedAt: new Date(), card }],
      "standard",
      "owned-only",
      [],
    );

    expect(suggestion.cards.find((item: { card: { id: string }; quantity: number }) => item.card.id === card.id)?.quantity).toBe(1);
  });

  it("lists missing cards in allow-missing suggestions", () => {
    const card = makeCard({ id: "charizard", name: "Charizard ex" });
    const suggestion = (service as never as { buildSuggestion: Function }).buildSuggestion(
      makeArchetype("Charizard ex", 3, card),
      [{ id: "item-1", userId: "u", cardId: card.id, quantity: 1, condition: "NM", variant: "normal", foil: false, language: "EN", notes: null, cardPriceId: null, createdAt: new Date(), updatedAt: new Date(), card }],
      "standard",
      "allow-missing",
      [],
    );

    expect(suggestion.missingCards.some((item: { cardName: string; quantity: number }) => item.cardName === "Charizard ex" && item.quantity === 2)).toBe(true);
  });

  function validate(cards: Array<{ card: ReturnType<typeof makeCard>; quantity: number; source: "owned" | "missing" }>, format: "standard" | "casual" = "standard") {
    return (service as never as { validateCards: Function }).validateCards(cards, format);
  }
});

function makeCard(overrides: Record<string, unknown> = {}) {
  return {
    id: "card-1",
    externalId: "external-1",
    provider: "pokemon-tcg-api",
    name: "Test Card",
    normalizedName: "test card",
    number: "1",
    printedTotal: 100,
    setTotal: 100,
    setId: "set",
    setCode: "SET",
    setName: "Set",
    rarity: null,
    artist: null,
    releaseDate: null,
    nationalPokedexNumbers: [],
    supertype: "Pokemon",
    subtypes: [],
    types: [],
    regulationMark: "H",
    rules: [],
    abilities: null,
    attacks: null,
    retreatCost: [],
    convertedRetreatCost: null,
    variants: ["normal"],
    language: "EN",
    imageSmall: null,
    imageLarge: null,
    raw: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeArchetype(cardName: string, quantity: number, card: ReturnType<typeof makeCard> | null = null) {
  return {
    id: "arch-1",
    slug: "arch",
    name: "Archetype",
    format: "STANDARD",
    strategy: "Test",
    source: "curated",
    sourceUrl: null,
    confidence: 80,
    createdAt: new Date(),
    updatedAt: new Date(),
    cards: [
      {
        id: "arch-card-1",
        archetypeId: "arch-1",
        cardId: card?.id ?? null,
        cardName,
        quantity,
        role: "main",
        required: true,
        priority: 100,
        card,
      },
    ],
  };
}
