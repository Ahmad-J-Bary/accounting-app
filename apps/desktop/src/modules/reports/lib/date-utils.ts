export function startOfDay(dateValue: string) {
  return new Date(`${dateValue}T00:00:00`).getTime();
}

export function endOfDay(dateValue: string) {
  return new Date(`${dateValue}T23:59:59.999`).getTime();
}

export function isWithinRange(isoDate: string, fromTs: number, toTs: number) {
  const timestamp = new Date(isoDate).getTime();
  return Number.isFinite(timestamp) && timestamp >= fromTs && timestamp <= toTs;
}

export function filterByDateRange<T>(
  items: T[],
  getDate: (item: T) => string,
  from: string,
  to: string,
): T[] {
  if (!from || !to) return items;
  return items.filter((item) => {
    const d = new Date(getDate(item)).toISOString().split("T")[0];
    return d >= from && d <= to;
  });
}
