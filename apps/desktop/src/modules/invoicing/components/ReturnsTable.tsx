import { useMemo, useCallback } from "react";
import { UnifiedTable, type UnifiedColumn } from "@widgets/table-shell/UnifiedTable";
import { TableShell } from "@widgets/table-shell/TableShell";
import type { SummaryColumn } from "@widgets/table-shell/TableSummary";
import { useExportSetup, useUnifiedColumns, useSortable, useBaseCurrencyColumns } from "@shared/hooks";
import { executeExport, dateCol, currencyAmountCols } from "@shared/lib/excel";
import type { ExcelExportColumn } from "@shared/lib/excel";
import { Button } from "@shared/ui/button";
import { useLocalization } from "@app/providers/LocalizationProvider";
import { formatDateTime, formatNumber } from "@shared/lib/format";

import type { SalesReturnDto, PurchaseReturnDto } from "@erp/shared-types";
import { TableActions } from "@widgets/table-shell/TableActions";
import { Download } from "lucide-react";

interface ReturnsTableProps {
  items: (SalesReturnDto | PurchaseReturnDto)[];
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
  partnerLabel: string;
  emptyMessage?: string;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onView?: (ret: SalesReturnDto | PurchaseReturnDto) => void;
  onEdit?: (ret: SalesReturnDto | PurchaseReturnDto) => void;
  onDelete?: (id: string) => Promise<void>;
  onExportRow?: (ret: SalesReturnDto | PurchaseReturnDto) => void;
  toolbarTitle?: string;
}

export function ReturnsTable({
  items,
  loading,
  search,
  onSearchChange,
  partnerLabel,
  emptyMessage,
  selectedId,
  onSelect,
  onView,
  onEdit,
  onDelete,
  onExportRow,
}: ReturnsTableProps) {
  const { t } = useLocalization();
  const { isBaseCurrency, currencySuffix: cs } = useBaseCurrencyColumns();
  const { exportData, baseCurrency, currencies, formatAmount, rateMap, baseCode, currencyMode, ratesSheet } = useExportSetup();

  // Type guards
  const isSalesReturn = (ret: SalesReturnDto | PurchaseReturnDto): ret is SalesReturnDto => {
    return 'customer_id' in ret;
  };
  const isPurchaseReturn = (ret: SalesReturnDto | PurchaseReturnDto): ret is PurchaseReturnDto => {
    return 'supplier_id' in ret;
  };

  const allColumns = useMemo<UnifiedColumn<SalesReturnDto | PurchaseReturnDto>[]>(() => {
    const cols: UnifiedColumn<SalesReturnDto | PurchaseReturnDto>[] = [
      {
        id: "return_number",
        header: t("return.colNumber", { namespace: "invoicing",  }),
        label: t("return.labelNumber", { namespace: "invoicing",  }),
        accessor: (ret) => formatNumber(parseInt(ret.return_number) || 0),
        className: "font-black text-slate-900 text-center"
      },
      {
        id: "partner_name",
        header: partnerLabel,
        label: partnerLabel,
        accessor: (ret) => {
          if (isSalesReturn(ret)) return ret.customer_name || "";
          if (isPurchaseReturn(ret)) return ret.supplier_name || "";
          return "";
        },
        className: "font-bold text-foreground"
      },
      ...currencies.map(curr => {
        const isBase = isBaseCurrency(curr.code);
        return {
          id: `total_amount_${curr.code}`,
          header: `${t("return.totalBase", { namespace: "invoicing",  })}${cs(curr.symbol || curr.code)}`,
          label: `${t("return.totalBase", { namespace: "invoicing",  })}${cs(curr.symbol || curr.code)}`,
          accessor: (ret: SalesReturnDto | PurchaseReturnDto) => {
            const val = parseFloat(ret.total_amount || "0");
            if (val === 0) return "";
            return formatAmount(val, { currencyCode: curr.code });
          },
          className: isBase
            ? "tabular-nums font-black text-slate-900"
            : "tabular-nums font-medium text-muted-foreground"
        };
      }),
      {
        id: "notes",
        header: t("return.colDescription", { namespace: "invoicing",  }),
        label: t("return.colDescription", { namespace: "invoicing",  }),
        accessor: (ret) => ret.notes || "",
        className: "text-muted-foreground italic"
      },
      {
        id: "return_date",
        header: t("return.colDate", { namespace: "invoicing",  }),
        label: t("return.colDate", { namespace: "invoicing",  }),
        accessor: (ret) => formatDateTime(ret.return_date),
        className: "text-muted-foreground tabular-nums"
      },
      ...((onView || onEdit || onDelete) ? [{
        id: "actions",
        header: t("return.colActions", { namespace: "invoicing",  }),
        label: t("return.colActions", { namespace: "invoicing",  }),
        accessor: (ret: SalesReturnDto | PurchaseReturnDto) => {
          return (
            <TableActions
              onView={onView ? () => onView(ret) : undefined}
              onEdit={onEdit ? () => onEdit(ret) : undefined}
              onDelete={onDelete ? () => {
                if (window.confirm(t("return.confirmDelete", { namespace: "invoicing",  }))) {
                  onDelete(ret.id);
                }
              } : undefined}
              onExportRow={onExportRow ? () => onExportRow(ret) : undefined}
              align="start"
            />
          );
        }
      }] : []),
    ];
    return cols;
  }, [currencies, formatAmount, partnerLabel, onView, onEdit, onDelete, onExportRow, isBaseCurrency, cs, t]);

  // Default visible: only base currency's total column shown
  const defaultVisible = useMemo(() => {
    const baseCode = baseCurrency?.code;
    const ids = [
      "return_number",
      "notes",
      "partner_name",
      ...(baseCode ? [`total_amount_${baseCode}`] : []),
      "return_date",
    ];
    if (onView || onEdit || onDelete) ids.push("actions");
    return ids;
  }, [baseCurrency, onView, onEdit, onDelete]);

  type SortField = "return_number" | "notes" | "partner_name" | "total_amount" | "return_date";

  const { sortedData, sortField, sortDirection, handleSort } = useSortable({
    data: items,
    defaultField: "return_date" as SortField,
    defaultDirection: "desc",
    sortFn: (a, b, field, direction) => {
      let comparison = 0;
      switch (field) {
        case "return_number":
          comparison = (a.return_number || "").localeCompare(b.return_number || "", "ar", { numeric: true });
          break;
        case "notes":
          comparison = (a.notes || "").localeCompare(b.notes || "", "ar");
          break;
        case "partner_name": {
          const aName = isSalesReturn(a) ? a.customer_name || "" : isPurchaseReturn(a) ? a.supplier_name || "" : "";
          const bName = isSalesReturn(b) ? b.customer_name || "" : isPurchaseReturn(b) ? b.supplier_name || "" : "";
          comparison = aName.localeCompare(bName, "ar");
          break;
        }
        case "total_amount": {
          comparison = parseFloat(a.total_amount || "0") - parseFloat(b.total_amount || "0");
          break;
        }
        case "return_date":
          comparison = new Date(a.return_date).getTime() - new Date(b.return_date).getTime();
          break;
      }
      return direction === "asc" ? comparison : -comparison;
    }
  });

  const { enrichedColumns, toolbarColumns, toggleColumn, resetToDefault, isModified } = useUnifiedColumns({
    tableId: "returns-unified",
    columns: allColumns,
    defaultVisible,
  });

  const handleExport = useCallback(async () => {
    const summary: Record<string, 'sum' | 'subtotal' | 'average' | null> = {};

    const currCols = currencyAmountCols("total_amount", t("return.totalBase", { namespace: "invoicing",  }), (row) => parseFloat((row as unknown as (SalesReturnDto | PurchaseReturnDto)).total_amount || "0") || 0, currencies, formatAmount, "", true, currencies.length > 1, currencyMode, baseCode, rateMap);
    const currColMap = new Map(currCols.map(c => [c.id, c]));

    const exportColumns: ExcelExportColumn[] = enrichedColumns
      .filter((col) => col.id !== "actions")
      .map((col) => {
        const isTotal = col.id.startsWith("total_amount_");

        if (isTotal) {
          summary[col.id] = "subtotal";
        }

        const headerText = typeof col.header === "string" && col.header ? col.header : String(col.label || col.id);

        if (col.id === "return_date") {
          return {
            ...dateCol("return_date", headerText, (row) => {
              const ret = row as unknown as (SalesReturnDto | PurchaseReturnDto);
              return ret.return_date;
            }),
            hidden: col.visible === false,
          };
        }

        if (isTotal) {
          const exportCol = currColMap.get(col.id);
          return {
            ...exportCol,
            label: headerText,
            hidden: col.visible === false,
          };
        }

        return {
          id: col.id,
          label: headerText,
          hidden: col.visible === false,
          width: 15,
          accessor: (row) => {
            const ret = row as unknown as (SalesReturnDto | PurchaseReturnDto);
            if (col.id === "return_number") return parseInt(ret.return_number ?? "0", 10) || 0;
            if (col.id === "partner_name") {
              if (isSalesReturn(ret)) return ret.customer_name || "";
              if (isPurchaseReturn(ret)) return ret.supplier_name || "";
              return "";
            }
            if (col.id === "notes") return ret.notes || "";
            return "";
          },
        };
      });

    const exportTitle = partnerLabel.includes("مورد") ? t("return.exportListPurchase", { namespace: "invoicing",  }) : t("return.exportListSales", { namespace: "invoicing",  });

    await executeExport(exportData, {
      sheetName: exportTitle,
      filename: exportTitle,
      data: sortedData as unknown as Record<string, unknown>[],
      columns: exportColumns,
      summary: Object.keys(summary).length > 0 ? summary : undefined,
      summaryLabel: t("document.summaryLabel", { namespace: "invoicing",  }),
      currencyRatesSheet: ratesSheet,
    });
  }, [enrichedColumns, partnerLabel, sortedData, exportData, ratesSheet, currencies, formatAmount, currencyMode, baseCode, rateMap, t]);

  const baseTotal = useMemo(() =>
    items.reduce((s, ret) => s + (parseFloat(ret.total_amount || "0") || 0), 0),
    [items]);

  const summaryColumns = useMemo<SummaryColumn[]>(() => {
    const colIds = enrichedColumns.map(c => c.id);
    return colIds.map(id => {
      if (id === "return_number") {
        return { id: "count", columnId: "return_number", label: "", value: t("return.countReturns", { namespace: "invoicing", vars: { count: sortedData.length },  }), className: "text-muted-foreground font-medium" };
      }
      const match = id.match(/^total_amount_(.+)$/);
      if (match) {
        const currCode = match[1];
        const isBase = isBaseCurrency(currCode);
        return {
          id: `${id}_summary`,
          columnId: id,
          label: `${t("return.totalBase", { namespace: "invoicing",  })}${cs(currCode)}`,
          value: baseTotal > 0 ? formatAmount(baseTotal, { currencyCode: currCode }) : "—",
          className: isBase
            ? "font-black text-slate-900"
            : "font-extrabold text-muted-foreground"
        };
      }
      return { id: `${id}_spacer`, columnId: id, label: "", value: "" };
    });
  }, [enrichedColumns, baseTotal, formatAmount, sortedData, isBaseCurrency, cs, t]);

  return (
    <TableShell
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder={t("return.searchPlaceholderDefault", { namespace: "invoicing",  })}
      columns={toolbarColumns}
      onColumnToggle={toggleColumn}
      onColumnsReset={resetToDefault}
      columnsModified={isModified}
      showToolbar={true}
      actions={(
        <Button
          size="sm"
          variant="outline"
          className="h-8 border-muted bg-white text-foreground hover:bg-muted/50"
          onClick={handleExport}
        >
          <Download className="w-3.5 h-3.5 ml-1.5 text-success" />
          {t("actions.exportExcel", { namespace: "invoicing",  })}
        </Button>
      )}
    >
      <UnifiedTable
        data={sortedData}
        columns={enrichedColumns}
        loading={loading}
        enableResize
        tableId="returns"
        sortField={sortField}
        sortDirection={sortDirection}
        onHeaderClick={(col) => {
          if (col.id === "return_number") handleSort("return_number");
          else if (col.id === "return_date") handleSort("return_date");
          else if (col.id === "notes") handleSort("notes");
          else if (col.id === "partner_name") handleSort("partner_name");
          else if (col.id.startsWith("total_amount_")) handleSort("total_amount");
        }}
        onRowClick={(ret) => onSelect?.(ret.id)}
        selectedId={selectedId}
        summary={summaryColumns}
        emptyMessage={emptyMessage ?? t("return.emptyDefault", { namespace: "invoicing",  })}
      />
    </TableShell>
  );
}

export type ReturnLineRow = {
  return_id?: string;
  return_number: string;
  material_name?: string;
  material_id?: string;
  partner_name?: string;
  unit_id?: string;
  quantity: string;
  unit_price: string;
  line_total: string;
  return_date: string;
  notes?: string;
};
