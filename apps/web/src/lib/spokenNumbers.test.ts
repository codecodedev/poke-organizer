import { describe, expect, it } from "vitest";
import { parseGeneralSpokenCardNumber, parseSpecificSpokenNumber } from "./spokenNumbers";

describe("spoken number parsing", () => {
  it("parses a single spoken number for set-scoped audio search", () => {
    expect(parseSpecificSpokenNumber("cento e vinte e tres")).toBe(123);
    expect(parseSpecificSpokenNumber("4")).toBe(4);
    expect(parseSpecificSpokenNumber("vinte")).toBe(20);
  });

  it("parses a complete card number when the user says barra", () => {
    expect(parseGeneralSpokenCardNumber("cento e vinte e sete barra duzentos e dezessete")).toEqual({
      number: 127,
      printedTotal: 217
    });
  });

  it("accepts numeric speech transcripts", () => {
    expect(parseGeneralSpokenCardNumber("127 barra 217")).toEqual({ number: 127, printedTotal: 217 });
    expect(parseGeneralSpokenCardNumber("127/217")).toEqual({ number: 127, printedTotal: 217 });
  });

  it("returns null when there is no usable number", () => {
    expect(parseSpecificSpokenNumber("nao entendi")).toBeNull();
    expect(parseGeneralSpokenCardNumber("cento e vinte e sete")).toBeNull();
  });
});
