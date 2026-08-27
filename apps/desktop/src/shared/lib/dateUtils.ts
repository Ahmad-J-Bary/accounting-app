/**
 * Normalizes any date input to a valid RFC-3339 UTC ISO string.
 *
 * Handles:
 *   - YYYY-MM-DD (date-only) → appends time based on endOfDay flag
 *   - YYYY-MM-DDTHH:mm:ssZ (already datetime) → returned as-is
 *   - YYYY-MM-DDTHH:mm:ss.SSSZ (already datetime with ms) → returned as-is
 *
 * IMPORTANT: Never appends time to a string that already contains 'T'.
 * This prevents malformed dates like "2026-01-01T00:00:00ZT23:59:59Z".
 */
export function normalizeToUtcIso(input: string, endOfDay = false): string {
  if (!input) return input;
  if (input.includes("T")) return input;
  const time = endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z";
  return `${input}${time}`;
}

/**
 * Builds a period window from date-only inputs.
 * start → T00:00:00.000Z, end → T23:59:59.999Z
 */
export function periodWindow(start: string, end: string): { start_date: string; end_date: string } {
  return {
    start_date: normalizeToUtcIso(start, false),
    end_date: normalizeToUtcIso(end, true),
  };
}
