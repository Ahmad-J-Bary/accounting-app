import { describe, it, expect, vi } from "vitest";
import { dashboardPeriodRange } from "./useDashboardMetrics";

describe("dashboardPeriodRange", () => {
  it("'this_year' starts at Jan 1 and ends now", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 20, 10, 30, 0, 0));
    const { fromTs, toTs } = dashboardPeriodRange("this_year");
    expect(new Date(fromTs).getFullYear()).toBe(2026);
    expect(new Date(fromTs).getMonth()).toBe(0);
    expect(new Date(fromTs).getDate()).toBe(1);
    expect(toTs).toBe(new Date(2026, 7, 20, 10, 30, 0, 0).getTime());
    vi.useRealTimers();
  });

  it("'this_month' starts at the 1st of the current month", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 20, 10, 30, 0, 0));
    const { fromTs } = dashboardPeriodRange("this_month");
    expect(new Date(fromTs).getMonth()).toBe(7);
    expect(new Date(fromTs).getDate()).toBe(1);
    vi.useRealTimers();
  });

  it("'today' starts at local midnight", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 20, 10, 30, 0, 0));
    const { fromTs } = dashboardPeriodRange("today");
    expect(new Date(fromTs).getHours()).toBe(0);
    expect(new Date(fromTs).getMinutes()).toBe(0);
    expect(new Date(fromTs).getDate()).toBe(20);
    vi.useRealTimers();
  });
});