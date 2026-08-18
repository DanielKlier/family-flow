import { describe, expect, it } from "vitest";

import {
  toLocalCalendarDate,
  toLocalCalendarMonth,
} from "../../src/adapters/clock/local-calendar-date.js";

describe("local calendar clock projection", () => {
  it("uses the local date and month at the start-of-month boundary", () => {
    const instant = new Date(2026, 2, 1, 0, 30, 0);

    expect(toLocalCalendarDate(instant)).toBe("2026-03-01");
    expect(toLocalCalendarMonth(instant)).toBe("2026-03");
  });

  it("pads local calendar components without depending on their UTC representation", () => {
    const instant = new Date(2026, 0, 9, 23, 30, 0);

    expect(toLocalCalendarDate(instant)).toBe("2026-01-09");
    expect(toLocalCalendarMonth(instant)).toBe("2026-01");
  });
});
