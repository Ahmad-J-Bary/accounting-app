import type { ComponentType } from "react";

export type FormatValue = (value: number) => string;

export function zeroToDash(value: number, formatter: (v: number) => string): string {
  if (value === 0) return "—";
  return formatter(value);
}

export interface SummaryCardConfig {
  label: string;
  key: string;
  icon: ComponentType<{ className?: string }>;
  cardBg: string;
  iconBg: string;
  labelColor: string;
  valueColor: string;
}
