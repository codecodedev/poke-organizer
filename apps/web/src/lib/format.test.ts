import { describe, expect, it } from "vitest";
import { formatBrl } from "./format";

describe("formatBrl", () => {
  it("formats Brazilian currency", () => {
    expect(formatBrl(12.5)).toContain("12,50");
  });
});
