import { useMemo } from "react";
import { TableSummary, type SummaryColumn } from "@widgets/table-shell/TableSummary";
import type { DocumentColumn } from "./GenericDocumentGrid";
import type { GridLine } from "@modules/invoicing/lib/invoiceUtils";

interface GridSummaryRowProps {
  filteredColumns: DocumentColumn[];
  lines: GridLine[];
  cellBorderClass: string;
  formatRawAmount: (amount: number, currencyCode?: string) => string;
  docCurrency: string;
  baseCurrency: { code: string } | null;
  asPageFooter?: boolean;
  gridTemplate?: string;
}

export function GridSummaryRow({
  filteredColumns,
  lines,
  formatRawAmount,
  asPageFooter = false,
  gridTemplate,
}: GridSummaryRowProps) {
  const totalQty = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);
  const formattedQty = String(totalQty).replace(/\.?0+$/, "");

  const summaryColumns: SummaryColumn[] = useMemo(() => {
    const cols: SummaryColumn[] = [];

    // Prepend a spacer column for the row number/index column (48px prefix)
    cols.push({
      id: "row_index_prefix",
      columnId: "row_index_prefix",
      label: "",
      value: "",
    });

    // Add middle columns corresponding to filteredColumns
    filteredColumns.forEach((col) => {
      if (col.key === "quantity") {
        cols.push({
          id: col.key,
          columnId: col.key,
          label: "إجمالي الكمية",
          value: formattedQty,
          align: col.align,
          className: "tabular-nums font-bold",
        });
      } else {
        const totalMatch = col.key.match(/^line_total_(.+)$/);
        if (totalMatch) {
          const currCode = totalMatch[1];
          const total = lines.reduce((sum, line) => {
            const val = (line as unknown as Record<string, string | number>)[`line_total_${currCode}`];
            return sum + (typeof val === "number" ? val : parseFloat(String(val)) || 0);
          }, 0);
          cols.push({
            id: col.key,
            columnId: col.key,
            label: "المجموع",
            value: formatRawAmount(total, currCode),
            align: col.align,
            className: "tabular-nums font-black text-slate-900",
          });
        } else {
          cols.push({ id: col.key, columnId: col.key, label: "", value: "" });
        }
      }
    });

    // Append a spacer column for the actions/delete column (48px suffix)
    cols.push({
      id: "actions_suffix",
      columnId: "actions_suffix",
      label: "",
      value: "",
    });

    return cols;
  }, [filteredColumns, formattedQty, lines, formatRawAmount]);

  return (
    <TableSummary
      columns={summaryColumns}
      gridTemplate={gridTemplate}
      className={asPageFooter ? "" : "border-t-2 border-slate-300 bg-slate-50/80"}
      sticky={!asPageFooter}
      asPageFooter={asPageFooter}
    />
  );
}
