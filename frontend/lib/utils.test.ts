import { formatNumber, formatPercent, formatCurrency, getStatusColor } from "./utils";

describe("utils", () => {
  describe("formatNumber", () => {
    it("formats millions with M suffix", () => {
      expect(formatNumber(1234567, 0)).toBe("1M");
    });
    it("formats decimals", () => {
      expect(formatNumber(1234.5678, 2)).toBe("1.23K");
    });
  });

  describe("formatPercent", () => {
    it("converts tiny decimal fractions (<0.01) to percentage", () => {
      expect(formatPercent(0.006)).toBe("+0.60%");
    });
    it("passes through values >= 0.01 as percentage units", () => {
      expect(formatPercent(0.55)).toBe("+0.55%");
    });
    it("passes through values > 1 as-is", () => {
      expect(formatPercent(55)).toBe("+55.00%");
    });
    it("handles negative decimal fraction (<0.01)", () => {
      expect(formatPercent(-0.006)).toBe("-0.60%");
    });
    it("handles negative percentage units", () => {
      expect(formatPercent(-12.6)).toBe("-12.60%");
    });
    it("handles zero", () => {
      expect(formatPercent(0)).toBe("+0.00%");
    });
  });

  describe("formatCurrency", () => {
    it("formats large numbers with $ and K suffix", () => {
      expect(formatCurrency(1234)).toBe("$1.2K");
    });
    it("handles negative values", () => {
      expect(formatCurrency(-50000)).toBe("$-50.0K");
    });
  });

  describe("getStatusColor", () => {
    it("returns green for Live", () => {
      expect(getStatusColor("Live")).toBe("text-green");
    });
    it("returns accent for Paper", () => {
      expect(getStatusColor("Paper")).toBe("text-accent");
    });
    it("returns fallback for unknown status", () => {
      expect(getStatusColor("Unknown")).toBe("text-text-tertiary");
    });
  });
});
