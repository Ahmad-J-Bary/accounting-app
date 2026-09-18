import { useMemo, type ReactNode } from "react";
import { UnifiedTable, type UnifiedColumn } from "@widgets/table-shell/UnifiedTable";
import { TableShell } from "@widgets/table-shell/TableShell";
import type { SummaryColumn } from "@widgets/table-shell/TableSummary";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useUnifiedColumns, useSortable, useBaseCurrencyColumns } from "@shared/hooks";
import { toFixed } from "@shared/lib/format";
import type { PartnerDto } from "@erp/shared-types";
import type { PartnerWithRatios } from '@modules/partners/hooks/usePartnerRatios';
import { Eye, Edit, Trash2, NotebookText, Receipt, Users } from "lucide-react";
import { TableActions } from "@widgets/table-shell/TableActions";
import { useLocalization } from "@app/providers/LocalizationProvider";
import type { RowActionDescriptor } from "@shared/types/row-actions";

interface PartnerTableProps {
  partners: PartnerWithRatios[];
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
  onExportExcel?: () => void;
  onView: (p: PartnerDto) => void;
  onEdit: (p: PartnerDto) => void;
  onDelete: (id: string) => void;
  onJournal: (p: PartnerDto) => void;
  onDocument: (p: PartnerDto) => void;
  selectedId?: string | null;
  onRowClick?: (p: PartnerDto) => void;
  filterBar?: ReactNode;
}

type SortField = string;

export function PartnerTable({
  partners,
  loading,
  search,
  onSearchChange,
  onExportExcel,
  onView,
  onEdit,
  onDelete,
  onJournal,
  onDocument,
  selectedId,
  onRowClick,
  filterBar
}: PartnerTableProps) {
  const { currencies, formatAmount } = useCurrencyContext();
  const { isBaseCurrency, currencySuffix: cs } = useBaseCurrencyColumns();
  const { t } = useLocalization();

  // Shared row actions registry for partners table
  const rowActions = useMemo<RowActionDescriptor<PartnerWithRatios>[]>(() => {
    return [
      {
        id: "view",
        label: t("labels.viewDetails", { namespace: "common" }),
        icon: Eye,
        priority: "primary",
        onClick: (p) => onView(p),
      },
      {
        id: "edit",
        label: t("labels.editData", { namespace: "common" }),
        icon: Edit,
        priority: "primary",
        onClick: (p) => onEdit(p),
      },
      {
        id: "journal",
        label: t("actions.journal", { namespace: "partners" }),
        icon: NotebookText,
        priority: "secondary",
        onClick: (p) => onJournal(p),
      },
      {
        id: "drawingsVoucher",
        label: t("actions.drawingsVoucher", { namespace: "partners" }),
        icon: Receipt,
        priority: "secondary",
        onClick: (p) => onDocument(p),
      },
      {
        id: "delete",
        label: t("labels.deleteRecord", { namespace: "common" }),
        icon: Trash2,
        priority: "overflow",
        variant: "destructive",
        destructive: true,
        onClick: (p) => onDelete(p.id),
      },
    ];
  }, [onView, onEdit, onJournal, onDocument, onDelete, t]);

  const { sortedData: sortedPartners, sortField, sortDirection, handleSort } = useSortable({
    data: partners,
    defaultField: "name" as SortField,
    sortFn: (a, b, field, direction) => {
      let comparison = 0;
      switch (field) {
        case "name": comparison = (a.name || "").localeCompare(b.name || "", "ar"); break;
        case "capital_ratio": comparison = a.calculatedCapitalRatio - b.calculatedCapitalRatio; break;
        case "ratio": comparison = a.calculatedRatio - b.calculatedRatio; break;
        default: {
          comparison = a.displayAmountBase - b.displayAmountBase;
        }
      }
      return direction === "asc" ? comparison : -comparison;
    }
  });

  const allColumns = useMemo<UnifiedColumn<PartnerWithRatios>[]>(() => {
    const cols: UnifiedColumn<PartnerWithRatios>[] = [
      {
        id: "name",
        header: t("columns.partnerName", { namespace: "partners",  }),
        label: t("columns.partnerName", { namespace: "partners",  }),
        align: "left",
        accessor: (p: PartnerWithRatios) => (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <span className="font-bold text-foreground">{p.name}</span>
          </div>
        )
      },
    ];

    currencies.forEach(curr => {
      const symbol = curr.symbol || curr.code;
      const isBase = isBaseCurrency(curr.code);
      cols.push({
        id: `amount_${curr.code}`,
        header: t("columns.capital", { namespace: "partners", vars: { currency: cs(symbol) },  }),
        label: t("columns.capital", { namespace: "partners", vars: { currency: cs(symbol) },  }),
        align: "right",
        accessor: (p: PartnerWithRatios) => {
          if (p.displayAmountBase === 0) return "";
          return formatAmount(p.displayAmountBase, { currencyCode: curr.code });
        },
        className: isBase
          ? "tabular-nums font-black text-foreground"
          : "tabular-nums font-medium text-muted-foreground"
      });
    });

    cols.push(
      {
        id: "capital_ratio",
        header: t("columns.capitalRatio", { namespace: "partners",  }),
        label: t("columns.capitalRatioFull", { namespace: "partners",  }),
        align: "right",
        accessor: (p: PartnerWithRatios) => (
          <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-black tabular-nums">
            {toFixed(p.calculatedCapitalRatio, 2)}%
          </span>
        ),
      },
      {
        id: "ratio",
        header: t("columns.profitRatio", { namespace: "partners",  }),
        label: t("columns.profitRatioFull", { namespace: "partners",  }),
        align: "right",
        accessor: (p: PartnerWithRatios) => (
          <span className="px-2 py-0.5 rounded-full bg-success/10 text-success text-[10px] font-black tabular-nums">
            {toFixed(p.calculatedRatio, 2)}%
          </span>
        ),
      },
      {
        id: "actions",
        header: t("columns.actions", { namespace: "partners",  }),
        label: t("columns.actions", { namespace: "partners",  }),
        align: "center",
        accessor: (p: PartnerWithRatios) => (
          <TableActions
            actions={rowActions}
            row={p}
          />
        )
      }
    );

    return cols;
  }, [currencies, formatAmount, rowActions, isBaseCurrency, cs, t]);

  // Default visible: only base currency's amount column is shown; secondary amounts are hidden.
  const defaultVisible = useMemo(() => {
    const ids: string[] = ["name"];
    currencies.forEach(curr => {
      if (isBaseCurrency(curr.code)) {
        ids.push(`amount_${curr.code}`);
      }
    });
    ids.push("capital_ratio", "ratio", "actions");
    return ids;
  }, [currencies, isBaseCurrency]);

  const { enrichedColumns, toolbarColumns, toggleColumn, resetToDefault, isModified } = useUnifiedColumns({
    tableId: "partners-unified",
    columns: allColumns,
    defaultVisible,
  });

  const summaryColumns = useMemo<SummaryColumn[]>(() => {
    const totalCapitalRatio = sortedPartners.reduce((s, p) => s + p.calculatedCapitalRatio, 0);
    const totalRatio = sortedPartners.reduce((s, p) => s + p.calculatedRatio, 0);
    const baseTotal = sortedPartners.reduce((sum, p) => sum + p.displayAmountBase, 0);

    return enrichedColumns.map((col) => {
      const id = col.id;
      switch (id) {
        case "name":
          return { id: "count", columnId: "name", label: "", value: t("summary.count", { namespace: "partners", vars: { count: sortedPartners.length },  }), className: "text-muted-foreground font-medium" };
        case "capital_ratio":
          return { id: "total_capital_ratio", columnId: "capital_ratio", label: t("summary.total", { namespace: "partners",  }), value: `${toFixed(totalCapitalRatio, 2)}%`, className: "text-primary font-black" };
        case "ratio":
          return { id: "total_ratio", columnId: "ratio", label: t("summary.total", { namespace: "partners",  }), value: `${toFixed(totalRatio, 2)}%`, className: "text-success font-black" };
        default: {
          const match = id.match(/^amount_(.+)$/);
          if (match) {
            const currCode = match[1];
            const isBase = isBaseCurrency(currCode);
            return {
              id: `total_${id}`,
              columnId: id,
              label: t("summary.grandTotal", { namespace: "partners",  }),
              value: baseTotal > 0 ? formatAmount(baseTotal, { currencyCode: currCode }) : "—",
              className: isBase
                ? "text-foreground font-black"
                : "text-muted-foreground font-extrabold"
            };
          }
          return { id: `${id}_spacer`, columnId: id, label: "", value: "" };
        }
      }
    });
  }, [sortedPartners, formatAmount, enrichedColumns, isBaseCurrency, t]);

  return (
    <TableShell
      title={t("table.title", { namespace: "partners",  })}
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder={t("table.searchPlaceholder", { namespace: "partners",  })}
      columns={toolbarColumns}
      onColumnToggle={toggleColumn}
      onColumnsReset={resetToDefault}
      columnsModified={isModified}
      showToolbar={true}
      filterBar={filterBar}
      onExportExcel={onExportExcel}
    >
      <UnifiedTable<PartnerWithRatios>
        data={sortedPartners}
        columns={enrichedColumns}
        loading={loading}
        enableResize
        tableId="partners"
        sortField={sortField}
        sortDirection={sortDirection}
        onHeaderClick={(col) => {
          if (col.id === "name" || col.id === "capital_ratio" || col.id === "ratio" || col.id?.startsWith("amount_")) {
            handleSort(col.id);
          }
        }}
        onRowClick={onRowClick}
        selectedId={selectedId}
        rowActions={rowActions}
        emptyMessage={search ? t("table.emptySearch", { namespace: "partners",  }) : t("table.empty", { namespace: "partners",  })}
        summary={summaryColumns}
      />
    </TableShell>
  );
}