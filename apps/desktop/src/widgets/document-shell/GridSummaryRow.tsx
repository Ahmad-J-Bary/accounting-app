import { cn } from "@shared/lib/utils";
import { TableSummary, type SummaryColumn } from "@widgets/table-shell/TableSummary";
import type { DocumentColumn } from "./GenericDocumentGrid";
import type { GridLine } from "@modules/invoicing/lib/invoiceUtils";

interface GridSummaryRowProps {
  filteredColumns: DocumentColumn[];
  lines: GridLine[];
  cellBorderClass: string;
  columnWidths: Record<string, number>;
  formatRawAmount: (amount: number, currencyCode?: string) => string;
  docCurrency: string;
  baseCurrency: { code: string } | null;
}

export function GridSummaryRow({
  filteredColumns,
  lines,
  cellBorderClass,
  columnWidths,
  formatRawAmount,
  docCurrency,
  baseCurrency,
}: GridSummaryRowProps) {
  const totalQty = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);
  const totalAmount = lines.reduce((sum, line) => sum + (line.line_total ?? 0), 0);
  const formattedQty = String(totalQty).replace(/\.?0+$/, "");
  const formattedAmount = formatRawAmount(totalAmount, docCurrency || baseCurrency?.code);

  const summaryColumns: SummaryColumn[] = filteredColumns.map((col) => {
    if (col.key === "quantity") return { id: col.key, columnId: col.key, label: "إجمالي الكمية", value: formattedQty, align: col.align };
    if (col.key === "line_total") return { id: col.key, columnId: col.key, label: "المجموع", value: formattedAmount, align: col.align };
    return { id: col.key, columnId: col.key, label: "", value: "" };
  });

  return (
    <TableSummary
      columns={summaryColumns}
      columnWidths={columnWidths}

      className="border-t-2 border-slate-300 bg-slate-50/80"
      sticky
      beforeContent={<div className={cn("w-10 shrink-0 flex items-center justify-center bg-slate-100/30", cellBorderClass)} />}
      afterContent={<div className="w-12 shrink-0" />}
    />
  );
}
