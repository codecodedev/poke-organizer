import { describe, expect, it } from "vitest";
import {
  formatCardNumber,
  normalizeCardNumberForSearch,
  normalizeSearchText,
  parseCardNumberParts,
  parseOcrCardNumber,
  parseOcrNameHint
} from "./index";

describe("shared card parsing", () => {
  it("normalizes accented search text", () => {
    expect(normalizeSearchText("Blastoise Radiante")).toBe("blastoise radiante");
  });

  it("extracts pokemon card numbers from OCR text", () => {
    expect(parseOcrCardNumber("Mega Gengar ex\n269 / 217")).toBe("269/217");
  });

  it("uses the printed card number without set total for search", () => {
    expect(normalizeCardNumberForSearch("150/217")).toBe("150");
    expect(normalizeCardNumberForSearch("046/217")).toBe("46");
  });

  it("parses a complete card number into number and printed total", () => {
    expect(parseCardNumberParts("150/217")).toEqual({ number: "150", printedTotal: 217 });
    expect(parseCardNumberParts("046/217")).toEqual({ number: "46", printedTotal: 217 });
  });

  it("formats a complete card number when printed total is available", () => {
    expect(formatCardNumber("150", 217)).toBe("150/217");
  });

  it("extracts a likely name hint", () => {
    expect(parseOcrNameHint("115/086\nZebstrika\nStage 1")).toBe("Zebstrika");
  });
});
