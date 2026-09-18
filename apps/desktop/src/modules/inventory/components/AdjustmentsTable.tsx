import { useMemo, useEffect, useCallback } from "react";
import { ArrowUpCircle, ArrowDownCircle, Minus, Eye, Edit, Trash2 } from "lucide-react";
import { cn } from '@shared/lib/utils';
import type { StockAdjustment } from "@erp/shared-types";
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { TableShell } from '@widgets/table-shell/TableShell';
import { TableActions } from '@widgets/table-shell/TableActions';
import type { SummaryColumn } from '@widgets/table-shell/TableSummary';
import { useUnifiedColumns, useSortable } from "@shared/hooks";
import { formatDateTime, formatNumber, toFixed } from '@shared/lib/format';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useBaseCurrencyColumns } from "@shared/hooks";
import { useLocalization } from "@app/providers/LocalizationProvider";
import type { RowActionDescriptor } from "@shared/types/row-actions";

interface AdjustmentsTableProps {
  data: StockAdjustment[];
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
  onExportExcel?: () => void;
  selectedId?: string | null;
  onView?: (item: StockAdjustment) => void;
  onEdit?: (item: StockAdjustment) => void;
  onDelete?: (id: string) => void;
  onRowClick?: (item: StockAdjustment) => void;
  onVisibleColumnsChange?: (ids: string[]) => void;
}

export function AdjustmentsTable({ data, loading, search, onSearchChange, onExportExcel, selectedId, onView, onEdit, onDelete, onRowClick, onVisibleColumnsChange }: AdjustmentsTableProps) {
  const { currencies, formatAmount } = useCurrencyContext();
  const { isBaseCurrency, currencySuffix: cs } = useBaseCurrencyColumns();
  const { t } = useLocalization();
  type SortField = "material_name" | "system_quantity" | "actual_quantity" | "difference" | "total_cost" | "adjustment_date" | "notes";

  const { sortedData, sortField, sortDirection, handleSort } = useSortable({
    data,
    defaultField: "adjustment_date" as SortField,
    defaultDirection: "desc",
    sortFn: (a, b, field, direction) => {
      let comparison = 0;
      switch (field) {
        case "material_name": comparison = (a.material_name || "").localeCompare(b.material_name || "", "ar"); break;
        case "system_quantity": comparison = parseFloat(a.system_quantity) - parseFloat(b.system_quantity); break;
        case "actual_quantity": comparison = parseFloat(a.actual_quantity) - parseFloat(b.actual_quantity); break;
        case "difference": comparison = parseFloat(a.difference) - parseFloat(b.difference); break;
        case "total_cost": comparison = parseFloat(a.total_cost_base || "0") - parseFloat(b.total_cost_base || "0"); break;
        case "adjustment_date": comparison = new Date(a.adjustment_date).getTime() - new Date(b.adjustment_date).getTime(); break;
        case "notes": comparison = (a.notes || a.reason || "").localeCompare(b.notes || b.reason || "", "ar"); break;
      }
      return direction === "asc" ? comparison : -comparison;
    }
  });

  const getRowActions = useCallback((a: StockAdjustment): RowActionDescriptor<StockAdjustment>[] => {
    const actions: RowActionDescriptor<StockAdjustment>[] = [];
    if (onView) {
      actions.push({
        id: "view",
        label: t("actions.view", { namespace: "common" }),
        icon: Eye,
        priority: "primary",
        onClick: () => onView(a),
      });
    }
    if (onEdit) {
      actions.push({
        id: "edit",
        label: t("actions.edit", { namespace: "common" }),
        icon: Edit,
        priority: "secondary",
        onClick: () => onEdit(a),
      });
    }
    if (onDelete) {
      actions.push({
        id: "delete",
        label: t("actions.delete", { namespace: "common" }),
        icon: Trash2,
        priority: "overflow",
        destructive: true,
        separator: "before",
        onClick: () => onDelete(a.id),
      });
    }
    return actions;
  }, [onView, onEdit, onDelete, t]);

  const allColumns = useMemo<UnifiedColumn<StockAdjustment>[]>(() => {
    const cols: UnifiedColumn<StockAdjustment>[] = [
      {
        id: "id",
        header: t("labels.number", { namespace: "inventory",  }),
        label: t("labels.number", { namespace: "inventory",  }),
        accessor: (a, idx) => a.reference ? formatNumber(parseInt(a.reference) || 0) : (idx + 1).toString(),
        className: "font-black text-foreground text-center"
      },
      {
        id: "material_name",
        header: t("labels.material", { namespace: "inventory",  }),
        label: t("labels.material", { namespace: "inventory",  }),
        accessor: (a) => a.material_name ?? a.material_id,
        className: "font-bold text-foreground"
      },
      {
        id: "system_quantity",
        header: t("adjustments.systemQuantity", { namespace: "inventory",  }),
        label: t("adjustments.systemQuantity", { namespace: "inventory",  }),
        accessor: (a) => toFixed(parseFloat(a.system_quantity), 2),
        className: "tabular-nums text-foreground"
      },
      {
        id: "actual_quantity",
        header: t("adjustments.actualQuantity", { namespace: "inventory",  }),
        label: t("adjustments.actualQuantity", { namespace: "inventory",  }),
        accessor: (a) => toFixed(parseFloat(a.actual_quantity), 2),
        className: "tabular-nums font-bold text-foreground"
      },
      {
        id: "difference",
        header: t("adjustments.difference", { namespace: "inventory",  }),
        label: t("adjustments.difference", { namespace: "inventory",  }),
        accessor: (a) => {
          const diff = parseFloat(a.difference);
          return (
            <span className={cn(
              "inline-flex items-center gap-1.5 font-black tabular-nums",
              diff > 0 ? "text-success" : diff < 0 ? "text-destructive" : "text-muted-foreground"
            )}>
              {diff > 0 ? <ArrowUpCircle className="w-4 h-4" /> : diff < 0 ? <ArrowDownCircle className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
              {diff > 0 ? "+" : ""}{toFixed(diff, 2)}
            </span>
          );
        },
      },
      ...currencies.map((curr) => {
        const symbol = curr.symbol || curr.code;
        return {
          id: `total_cost_${curr.code}`,
          header: `${t("adjustments.cost", { namespace: "inventory",  })} ${cs(symbol)}`,
          label: `${t("adjustments.cost", { namespace: "inventory",  })} ${cs(symbol)}`,
          accessor: (a: StockAdjustment) => {
            const cost = parseFloat(a.total_cost_base || "0");
            return Math.abs(cost) > 0 ? (
              <span className="tabular-nums font-black text-foreground">{formatAmount(cost, { currencyCode: curr.code })}</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            );
          },
          className: "tabular-nums",
        } as UnifiedColumn<StockAdjustment>;
      }),
      {
        id: "notes",
        header: t("labels.note", { namespace: "inventory",  }),
        label: t("labels.note", { namespace: "inventory",  }),
        accessor: (a) => a.notes ?? a.reason ?? "",
        className: "text-muted-foreground"
      },
      {
        id: "adjustment_date",
        header: t("labels.date", { namespace: "inventory",  }),
        label: t("adjustments.dateLabel", { namespace: "inventory",  }),
        accessor: (a) => formatDateTime(a.adjustment_date),
        className: "tabular-nums text-muted-foreground"
      },
    ];

    if (onView || onEdit || onDelete) {
      cols.push({
        id: "actions",
        header: t("labels.actions", { namespace: "inventory",  }),
        label: t("labels.actions", { namespace: "inventory",  }),
        accessor: (a) => (
          <TableActions
            actions={getRowActions(a)}
          />
        ),
      });
    }

    return cols;
  }, [onView, onEdit, onDelete, formatAmount, currencies, cs, t, getRowActions]);

  const defaultVisible = useMemo(() => {
    const ids: string[] = ["id", "material_name", "system_quantity", "actual_quantity",
      "difference", "adjustment_date", "notes"];
    currencies.forEach((curr) => {
      if (isBaseCurrency(curr.code)) {
        ids.push(`total_cost_${curr.code}`);
      }
    });
    if (onView || onEdit || onDelete) ids.push("actions");
    return ids;
  }, [onView, onEdit, onDelete, currencies, isBaseCurrency]);

  const { enrichedColumns, visibleColumns, toolbarColumns, toggleColumn, resetToDefault, isModified } = useUnifiedColumns({
    tableId: "adjustments",
    columns: allColumns,
    defaultVisible,
  });

  useEffect(() => {
    onVisibleColumnsChange?.(visibleColumns);
  }, [visibleColumns, onVisibleColumnsChange]);

  const summaryColumns = useMemo<SummaryColumn[]>(() => {
    return enrichedColumns.map(col => {
      const id = col.id;
      if (id === "material_name") {
        return { id: "count", columnId: id, label: "", value: t("adjustments.countSummary", { namespace: "inventory", count: sortedData.length }), className: "text-muted-foreground font-medium" };
      }
      if (id.startsWith("total_cost_")) {
        const total = sortedData.reduce((s, a) => s + parseFloat(a.total_cost_base || "0"), 0);
        const totalCostId = id;
        return {
          id: `cost_summary_${totalCostId}`, columnId: id, label: t("labels.total", { namespace: "inventory",  }),
          value: total !== 0 ? formatAmount(total, { currencyCode: id.replace("total_cost_", "") }) : "—",
          className: "text-foreground font-black"
        };
      }
      return { id: `${id}_spacer`, columnId: id, label: "", value: "" };
    });
  }, [sortedData, enrichedColumns, formatAmount, t]);

  const sortableFields: SortField[] = [
    "material_name", "system_quantity", "actual_quantity",
    "difference", "total_cost", "adjustment_date", "notes"
  ];

  const filtered = useMemo(() =>
    sortedData.filter(a =>
      (a.reference?.toLowerCase() || "").includes(search.toLowerCase()) ||
      (a.material_name?.toLowerCase() || "").includes(search.toLowerCase()) ||
      (a.material_id?.toLowerCase() || "").includes(search.toLowerCase()) ||
      (a.notes?.toLowerCase() || "").includes(search.toLowerCase()) ||
      (a.reason?.toLowerCase() || "").includes(search.toLowerCase())
    ),
    [sortedData, search]
  );

  return (
    <TableShell
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder={t("adjustments.searchPlaceholder", { namespace: "inventory",  })}
      columns={toolbarColumns}
      onColumnToggle={toggleColumn}
      onColumnsReset={resetToDefault}
      columnsModified={isModified}
      showToolbar={true}
      onExportExcel={onExportExcel}
    >
      <UnifiedTable
        data={filtered}
        columns={enrichedColumns}
        loading={loading}
        enableResize
        tableId="adjustments"
        sortField={sortField}
        sortDirection={sortDirection}
        rowActions={getRowActions}
        onHeaderClick={(col) => {
          if (sortableFields.includes(col.id as SortField)) {
            handleSort(col.id as SortField);
          } else if (col.id.startsWith("total_cost_")) {
            handleSort("total_cost" as SortField);
          }
        }}
        selectedId={selectedId}
        onRowClick={onRowClick}
        emptyMessage={search ? t("labels.noResultsMatch", { namespace: "inventory",  }) : t("adjustments.empty", { namespace: "inventory",  })}
        summary={summaryColumns}
      />
    </TableShell>
  );
}