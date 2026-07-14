import type { ReactNode } from "react";
import type { UnifiedColumn } from "@widgets/table-shell/UnifiedTable";

export function getHeaderText<T>(col: UnifiedColumn<T>): string {
  if (typeof col.header === "string") return col.header;
  if (typeof col.label === "string") return col.label;
  return col.id;
}

export function getPrimitiveCellValue(value: ReactNode): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  return "";
}

/** Default column ids that should be shared (merged) across grouped rows. */
export const SHARED_COLUMN_IDS = new Set(["entry_number", "journal_type", "description", "entry_date", "date", "balance"]);
