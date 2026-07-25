import type { SummaryColumn } from "@widgets/table-shell";

export function createSummarySpacer(colId: string, id?: string): SummaryColumn {
  return { id: id ?? `${colId}_spacer`, columnId: colId, label: "", value: "" };
}
