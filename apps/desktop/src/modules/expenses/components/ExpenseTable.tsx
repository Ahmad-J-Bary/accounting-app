import { useMemo, useEffect } from "react";
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { TableShell } from '@widgets/table-shell/TableShell';
import type { SummaryColumn } from '@widgets/table-shell/TableSummary';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useLocalization } from "@app/providers/LocalizationProvider";
import { useUnifiedColumns, useSortable, useTableColumns, useBaseCurrencyColumns } from "@shared/hooks";
import { formatNumber } from "@shared/lib/format";
import type { AccountDto } from "@erp/shared-types";
import { NotebookText, Receipt, Eye, Edit, Trash2 } from "lucide-react";
import { TableActions } from "@widgets/table-shell/TableActions";
import type { RowActionDescriptor } from "@shared/types/row-actions";


interface ExpenseTableProps {
  expenses: AccountDto[];
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
  onExportExcel?: () => void;
  onView: (e: AccountDto) => void;
  onEdit: (e: AccountDto) => void;
  onDelete?: (id: string) => void;
  onJournal?: (e: AccountDto) => void;
  onDocument?: (e: AccountDto) => void;
  selectedId?: string | null;
  parentCode?: string;
  onVisibleColumnsChange?: (ids: string[]) => void;
}

type SortField = "code" | "name" | "balance";

const codeSuffix = (code: string, prefix?: string) => {
  if (prefix && code.startsWith(prefix)) return code.substring(prefix.length);
  return code;
};

export function ExpenseTable({ expenses, loading, search, onSearchChange, onExportExcel, onView, onEdit, onDelete, onJournal, onDocument, selectedId, parentCode, onVisibleColumnsChange }: ExpenseTableProps) {
  const { t, language } = useLocalization();
  const { currencies, formatAmount, toBase } = useCurrencyContext();
  const { isBaseCurrency, currencySuffix: cs } = useBaseCurrencyColumns();
  const { getAccountStatusColumn } = useTableColumns();
  const rowActions = useMemo<RowActionDescriptor<AccountDto>[]>(() => {
    const actions: RowActionDescriptor<AccountDto>[] = [
      {
        id: "view",
        label: t("labels.viewDetails", { namespace: "common" }),
        icon: Eye,
        priority: "primary",
        onClick: (row) => onView(row),
      },
      {
        id: "edit",
        label: t("labels.editData", { namespace: "common" }),
        icon: Edit,
        priority: "primary",
        onClick: (row) => onEdit(row),
      },
    ];

    if (onJournal) {
      actions.push({
        id: "journal",
        label: t("expense.journal", { namespace: "invoicing" }),
        icon: NotebookText,
        priority: "secondary",
        onClick: (row) => onJournal(row),
      });
    }

    if (onDocument) {
      actions.push({
        id: "voucher",
        label: t("expense.voucher", { namespace: "invoicing" }),
        icon: Receipt,
        priority: "tertiary",
        onClick: (row) => onDocument(row),
      });
    }

    if (onDelete) {
      actions.push({
        id: "delete",
        label: t("labels.deleteRecord", { namespace: "common" }),
        icon: Trash2,
        priority: "overflow",
        variant: "destructive",
        destructive: true,
        onClick: (row) => onDelete(row.id),
      });
    }

    return actions;
  }, [onDelete, onDocument, onEdit, onJournal, onView, t]);

  const { sortedData: sortedExpenses, sortField, sortDirection, handleSort } = useSortable({
    data: expenses,
    defaultField: "code" as SortField,
    sortFn: (a, b, field, direction) => {
      let comparison = 0;
      switch (field) {
        case "code": comparison = (parseInt(codeSuffix(a.code || "0", parentCode), 10) || 0) - (parseInt(codeSuffix(b.code || "0", parentCode), 10) || 0); break;
        case "name": comparison = ((language === "ar" ? a.name_ar : a.name_en) || "").localeCompare((language === "ar" ? b.name_ar : b.name_en) || "", language === "ar" ? "ar" : "en"); break;
        case "balance": comparison = (Number(a.balance) || 0) - (Number(b.balance) || 0); break;
      }
      return direction === "asc" ? comparison : -comparison;
    }
  });

  const allColumns = useMemo<UnifiedColumn<AccountDto>[]>(() => {
    const cols: UnifiedColumn<AccountDto>[] = [
      {
        id: "code",
        header: "#",
        label: t("expense.accountCode", { namespace: "invoicing",  }),
        accessor: (c) => {
          const code = c.code || "";
          const suffix = parentCode && code.startsWith(parentCode)
            ? code.substring(parentCode.length)
            : code;
          return suffix ? formatNumber(parseInt(suffix) || 0) : "";
        },
        align: "center",
        className: "font-black text-foreground"
      },
      {
        id: "name",
        header: t("expense.itemName", { namespace: "invoicing",  }),
        label: t("expense.itemName", { namespace: "invoicing",  }),
        accessor: (c) => (
          <span className="font-bold text-foreground">
            {language === "ar" ? (c.name_ar || "") : (c.name_en || c.name_ar || "")}
          </span>
        ),
        align: "left",
      },
    ];

    cols.push(getAccountStatusColumn(t("expense.accountStatus", { namespace: "invoicing",  })));

    currencies.forEach(curr => {
      const symbol = curr.symbol || curr.code;
      const isBase = isBaseCurrency(curr.code);
      cols.push({
        id: `balance_${curr.code}`,
        header: t("expense.balanceColumn", { namespace: "invoicing", vars: { currency: cs(symbol) },  }),
        label: t("expense.balanceColumn", { namespace: "invoicing", vars: { currency: cs(symbol) },  }),
        accessor: (c) => {
          const absBal = Math.abs(Number(c.balance || 0));
          if (absBal === 0) return "";
          const baseAmount = toBase(absBal, c.currency || "");
          return formatAmount(baseAmount, { currencyCode: curr.code });
        },
        align: 'right',
        className: isBase
          ? "tabular-nums font-black text-foreground"
          : "tabular-nums font-medium text-muted-foreground"
      });
    });

    cols.push({
      id: "actions",
      header: t("labels.actions", { namespace: "common",  }),
      label: t("labels.actions", { namespace: "common",  }),
      accessor: (e) => (
        <TableActions
          actions={rowActions}
          row={e}
        />
      ),
      align: "center",
    });

    return cols;
  }, [currencies, formatAmount, toBase, parentCode, getAccountStatusColumn, isBaseCurrency, cs, t, language, rowActions]);

  // Default visible: only base currency's balance column is visible.
  // Secondary currency balances are hidden by default (user can toggle on).
  const defaultVisible = useMemo(() => {
    const def: string[] = ["code", "name", "status"];
    currencies.forEach(curr => {
      if (isBaseCurrency(curr.code)) {
        def.push(`balance_${curr.code}`);
      }
    });
    def.push("actions");
    return def;
  }, [currencies, isBaseCurrency]);

  const { enrichedColumns, visibleColumns, toolbarColumns, toggleColumn, resetToDefault, isModified } = useUnifiedColumns({
    tableId: "expenses-table",
    columns: allColumns,
    defaultVisible,
  });

  useEffect(() => {
    onVisibleColumnsChange?.(visibleColumns);
  }, [visibleColumns, onVisibleColumnsChange]);

  const summaryColumns = useMemo<SummaryColumn[]>(() => {
    const totalBal = sortedExpenses.reduce((sum, e) => sum + Number(e.balance || 0), 0);
    const overallColor = totalBal > 0 ? 'text-destructive' : totalBal < 0 ? 'text-success' : 'text-muted-foreground';

    const baseTotal = sortedExpenses.reduce((sum, e) => {
      const effBal = (e.debit !== undefined && e.credit !== undefined)
        ? Number(e.debit || 0) - Number(e.credit || 0)
        : Number(e.balance || 0);
      if (effBal === 0) return sum;
      return sum + toBase(effBal, e.currency || "");
    }, 0);

    return enrichedColumns.map((col) => {
      const id = col.id;
      if (id === 'name') {
        return { id: 'name_summary', columnId: 'name', label: '', value: t("expense.countItems", { namespace: "invoicing", vars: { count: sortedExpenses.length },  }), className: 'font-medium text-muted-foreground' };
      }
      if (id === 'code' || id === 'status' || id === 'actions') {
        return { id: `${id}_spacer`, columnId: id, label: '', value: '' };
      }
      const match = id.match(/^balance_(.+)$/);
      if (match) {
        const currCode = match[1];
        const isBase = isBaseCurrency(currCode);
        const statusLabel = totalBal > 0 ? t("expense.debitSide", { namespace: "invoicing",  }) : t("expense.creditSide", { namespace: "invoicing",  });
        return {
          id: `${id}_summary`,
          columnId: id,
          label: totalBal === 0 ? '—' : t("expense.balanceWithSide", { namespace: "invoicing", vars: { side: statusLabel },  }),
          value: baseTotal !== 0 ? formatAmount(baseTotal, { currencyCode: currCode }) : "—",
          className: isBase
            ? `${overallColor} font-black`
            : 'text-muted-foreground font-extrabold',
        };
      }
      return { id: `${id}_spacer`, columnId: id, label: '', value: '' };
    });
  }, [sortedExpenses, formatAmount, toBase, enrichedColumns, isBaseCurrency, t]);

  return (
    <TableShell
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder={t("expense.searchPlaceholder", { namespace: "invoicing",  })}
      columns={toolbarColumns}
      onColumnToggle={toggleColumn}
      onColumnsReset={resetToDefault}
      columnsModified={isModified}
      showToolbar={true}
      onExportExcel={onExportExcel}
    >
      <UnifiedTable
        data={sortedExpenses}
        columns={enrichedColumns}
        loading={loading}
        enableResize
        tableId="expenses"
        sortField={sortField}
        sortDirection={sortDirection}
        onRowClick={onView}
        selectedId={selectedId}
        onHeaderClick={(col) => {
          if (col.id === "code") handleSort("code");
          else if (col.id === "name") handleSort("name");
          else if (col.id === "status" || col.id?.startsWith("balance_")) handleSort("balance");
        }}
        emptyMessage={search ? t("expense.noSearchResults", { namespace: "invoicing",  }) : t("expense.empty", { namespace: "invoicing",  })}
        summary={summaryColumns}
      />
    </TableShell>
  );
}
