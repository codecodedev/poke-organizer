import { describe, expect, it } from "vitest";
import type { CatalogService } from "../cards/catalog.service";
import { RecognitionService } from "./recognition.service";

describe("RecognitionService", () => {
  it("ranks exact number matches first", async () => {
    const catalog = {
      search: async () => [
        {
          id: "1",
          externalId: "a",
          name: "Zebstrika",
          number: "115/086",
          nationalPokedexNumbers: [],
          types: [],
          variants: ["normal"],
          language: "en",
          imageSmall: null,
          imageLarge: null
        },
        {
          id: "2",
          externalId: "b",
          name: "Zebstrika",
          number: "114/086",
          nationalPokedexNumbers: [],
          types: [],
          variants: ["normal"],
          language: "en",
          imageSmall: null,
          imageLarge: null
        }
      ]
    } satisfies Pick<CatalogService, "search">;

    const service = new RecognitionService(catalog as unknown as CatalogService);

    const candidates = await service.findCandidates({ text: "Zebstrika 115/086" });
    expect(candidates[0].card.number).toBe("115/086");
    expect(candidates[0].score).toBeGreaterThan(candidates[1].score);
  });
});
