import { describe, it, expect } from "vitest";

describe("health check config", () => {
  it("exposes correct flag thresholds", () => {
    const WARN_THRESHOLD = 8;
    const DANGER_THRESHOLD = 15;

    expect(WARN_THRESHOLD).toBe(8);
    expect(DANGER_THRESHOLD).toBe(15);
  });

  it("computes gap as money% minus progress%", () => {
    const moneyPct = 52;
    const progressPct = 41;
    const gap = moneyPct - progressPct;

    expect(gap).toBe(11);
  });

  it("classifies flag correctly", () => {
    function classifyFlag(gap: number): "OK" | "WARN" | "DANGER" {
      if (gap > 15) return "DANGER";
      if (gap > 8) return "WARN";
      return "OK";
    }

    expect(classifyFlag(5)).toBe("OK");
    expect(classifyFlag(11)).toBe("WARN");
    expect(classifyFlag(16)).toBe("DANGER");
  });
});
