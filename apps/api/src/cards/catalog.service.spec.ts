import { describe, expect, it } from "vitest";
import {
  DEFAULT_CARD_VARIANT,
  HOLOFOIL_CARD_VARIANT,
  REVERSE_HOLO_CARD_VARIANT
} from "@poke-organizer/shared";
import { CatalogService } from "./catalog.service";

type VariantExtractor = {
  extractPokemonTcgVariants(card: Record<string, unknown>): string[];
};

describe("CatalogService", () => {
  const service = new CatalogService({} as never, {} as never) as unknown as VariantExtractor;

  it("infers reverse holo for regular cards with TCGPlayer pages but no price variants", () => {
    expect(
      service.extractPokemonTcgVariants({
        rarity: "Common",
        subtypes: ["Basic"],
        tcgplayer: { url: "https://prices.pokemontcg.io/tcgplayer/me2pt5-46" }
      })
    ).toEqual([DEFAULT_CARD_VARIANT, REVERSE_HOLO_CARD_VARIANT]);
  });

  it("keeps explicit TCGPlayer price variants when they are available", () => {
    expect(
      service.extractPokemonTcgVariants({
        rarity: "Common",
        tcgplayer: {
          prices: {
            normal: {},
            reverseHolofoil: {}
          }
        }
      })
    ).toEqual([DEFAULT_CARD_VARIANT, REVERSE_HOLO_CARD_VARIANT]);
  });

  it("infers holo and reverse holo for regular rare cards", () => {
    expect(
      service.extractPokemonTcgVariants({
        rarity: "Rare",
        subtypes: ["Basic"],
        tcgplayer: { url: "https://prices.pokemontcg.io/tcgplayer/example" }
      })
    ).toEqual([DEFAULT_CARD_VARIANT, HOLOFOIL_CARD_VARIANT, REVERSE_HOLO_CARD_VARIANT]);
  });
});
