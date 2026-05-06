export const formatCurrency = (amount: number, currency = "ل.س"): string => {
  const formatted = new Intl.NumberFormat("ar-SY", {
    minimumFractionDigits: 0, // SYP usually doesn't use decimals
    maximumFractionDigits: 2,
  }).format(amount);
  return `${formatted} ${currency}`;
};

export const formatNumber = (n: number): string => {
  return new Intl.NumberFormat("ar-SY").format(n);
};

export const formatDate = (date: string | Date): string => {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("ar-SY", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
};

export const formatDateTime = (date: string | Date): string => {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("ar-SY", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
};