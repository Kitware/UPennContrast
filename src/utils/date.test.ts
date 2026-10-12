import { describe, it, expect } from "vitest";
import { formatDateNumber, formatDayShort, formatTimeOfDay } from "./date";

describe("date formatting of stored timestamps", () => {
  const helpers = { formatDateNumber, formatDayShort, formatTimeOfDay };

  for (const [name, fn] of Object.entries(helpers)) {
    it(`${name} returns "" for a missing or invalid timestamp`, () => {
      expect(fn(undefined)).toBe("");
      expect(fn(null)).toBe("");
      expect(fn(NaN)).toBe("");
    });
  }

  it("formats a valid timestamp", () => {
    const ts = new Date(2023, 10, 14, 17, 13).getTime();
    expect(formatDateNumber(ts)).toBe("Nov 14, 2023 5:13 PM");
    expect(formatDayShort(ts)).toBe("Nov 14, 2023");
    expect(formatTimeOfDay(ts)).toBe("5:13 PM");
  });
});
