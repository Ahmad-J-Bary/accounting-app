import { useMemo, useCallback } from "react";
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { TableShell } from '@widgets/table-shell/TableShell';
import { TableActions } from '@widgets/table-shell/TableActions';
import type { SummaryColumn } from '@widgets/table-shell/TableSummary';
import { useUnifiedColumns, useSortable, useBaseCurrencyColumns, useExportSetup } from "@shared/hooks";
import { formatDateTime, formatNumber } from "@shared/lib/format";
import type { ExcelExportColumn } from "@shared/lib/excel";
import { executeExport, dateCol, buildCurrencySummary, currencyAmountCols } from "@shared/lib/excel";
import { isIncomingPayment, signedBaseAmount, OUTGOING_PAYMENT_TYPES } from "@modules/payments/lib/payment-utils";
import { ArrowDownCircle, ArrowUpCircle, Filter, Eye, Edit, Trash2 } from "lucide-react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@shared/ui/select";
import type { Payment, AccountDto } from "@erp/shared-types";
import { useLocalization } from "@app/providers/LocalizationProvider";
import { resolveAccountName } from "@shared/lib/system-labels";
import type { RowActionDescriptor } from "@shared/types/row-actions";

type SortField = "journal_entry_number" | "payment_date" | "payment_type" | "credit_account" | "debit_account";

interface PaymentsTableProps {
  payments: Payment[];
  accounts: AccountDto[];
  currencies: { code: string; name_ar: string; symbol: string }[];
  baseCurrency?: { code: string; name_ar: string; symbol: string };
  rateMap: Map<string, number>;
  formatAmount: (amount: number, opts: { currencyCode: string }) => string;
  toBase: (amount: number, from: string) => number;
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
  typeFilter: string;
  onTypeFilterChange: (val: string) => void;
  selectedId?: string | null;
  onRowClick: (p: Payment) => void;
  onEdit: (p: Payment) => void;
  onDelete: (id: string) => void;
}

export function PaymentsTable({
  payments,
  accounts,
  currencies,
  baseCurrency,
  rateMap,
  formatAmount,
  toBase,
  loading,
  search,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  selectedId,
  onRowClick,
  onEdit,
  onDelete,
}: PaymentsTableProps) {

  const { t, language } = useLocalization();
  const { isBaseCurrency, currencySuffix: cs, hasSecondaryCurrencies } = useBaseCurrencyColumns();
  const { exportData, currencyMode, ratesSheet, baseCode } = useExportSetup();
  const sortedCurrencies = useMemo(() => {
    if (!baseCurrency) return currencies;
    return [baseCurrency, ...currencies.filter(c => c.code !== baseCurrency.code)];
  }, [currencies, baseCurrency]);

  const filtered = useMemo(() => {
    return payments.filter(
      (p) => {
        if (typeFilter === "all") return true;
        if (typeFilter === "incoming") return isIncomingPayment(p.payment_type);
        if (typeFilter === "outgoing") return (OUTGOING_PAYMENT_TYPES as readonly string[]).includes(p.payment_type);
        return p.payment_type === typeFilter;
      },
    );
  }, [payments, typeFilter]);

  const rowActions = useMemo<RowActionDescriptor<Payment>[]>(() => [
    {
      id: "view",
      label: t("labels.viewDetails", { namespace: "common" }),
      icon: Eye,
      priority: "primary",
      onClick: (row) => onRowClick(row),
    },
    {
      id: "edit",
      label: t("labels.editData", { namespace: "common" }),
      icon: Edit,
      priority: "primary",
      onClick: (row) => onEdit(row),
    },
    {
      id: "delete",
      label: t("labels.deleteRecord", { namespace: "common" }),
      icon: Trash2,
      priority: "overflow",
      variant: "destructive",
      destructive: true,
      separator: "before",
      onClick: (row) => onDelete(row.id),
    },
  ], [onDelete, onEdit, onRowClick, t]);

  const { sortedData, sortField, sortDirection, handleSort } = useSortable({
    data: filtered,
    defaultField: "payment_date" as SortField,
    defaultDirection: "desc",
    sortFn: (a, b, field, direction) => {
      let comparison = 0;
      switch (field) {
        case "journal_entry_number":
          comparison =
            (parseInt(a.journal_entry_number || "0", 10) || 0) -
            (parseInt(b.journal_entry_number || "0", 10) || 0);
          break;
        case "payment_date":
          comparison =
            new Date(a.payment_date).getTime() -
            new Date(b.payment_date).getTime();
          break;
        case "payment_type":
          comparison = (
            t(`paymentTypeLabel.${a.payment_type as string}`, { namespace: "invoicing"})
          ).localeCompare(
            t(`paymentTypeLabel.${b.payment_type as string}`, { namespace: "invoicing"}),
            "ar",
          );
          break;
        case "credit_account":
          comparison = (
            resolveAccountName(accounts.find((acc) => acc.id === a.credit_account_id) ?? ({} as AccountDto), language) ||
            ""
          ).localeCompare(
            resolveAccountName(accounts.find((acc) => acc.id === b.credit_account_id) ?? ({} as AccountDto), language) ||
              "",
            "ar",
          );
          break;
        case "debit_account":
          comparison = (
            resolveAccountName(accounts.find((acc) => acc.id === a.debit_account_id) ?? ({} as AccountDto), language) || ""
          ).localeCompare(
            resolveAccountName(accounts.find((acc) => acc.id === b.debit_account_id) ?? ({} as AccountDto), language) ||
              "",
            "ar",
          );
          break;
      }
      return direction === "asc" ? comparison : -comparison;
    },
  });

  const allColumns = useMemo<UnifiedColumn<Payment>[]>(
    () => {
      const cols: UnifiedColumn<Payment>[] = [
      {
        id: "journal_entry_number",
        header: t("payment.journalEntryNo", { namespace: "invoicing",  }),
        label: t("payment.journalEntryNo", { namespace: "invoicing",  }),
        accessor: (p) => formatNumber(parseInt(p.journal_entry_number) || 0),
        align: "center",
        className: "font-black text-primary tabular-nums",
      },
      {
        id: "payment_type",
        header: t("payment.type", { namespace: "invoicing",  }),
        label: t("payment.type", { namespace: "invoicing",  }),
        accessor: (p) => (
          <div className="flex items-center gap-2">
            {isIncomingPayment(p.payment_type) ? (
              <ArrowDownCircle className="w-3.5 h-3.5 text-success" />
            ) : (
              <ArrowUpCircle className="w-3.5 h-3.5 text-destructive" />
            )}
            <span className="font-bold text-[11px]">
              {t(`paymentTypeLabel.${p.payment_type as string}`, {
                namespace: "invoicing"
              })}
            </span>
          </div>
        ),
      },
      ...sortedCurrencies.map(curr => {
        const symbol = curr.symbol || curr.code;
        const isBase = isBaseCurrency(curr.code);
        return {
          id: `amount_${curr.code}`,
          header: t("payment.amountColumn", { namespace: "invoicing", vars: { currency: cs(symbol) },  }),
          label: t("payment.amountColumn", { namespace: "invoicing", vars: { currency: cs(symbol) },  }),
          accessor: (p: Payment) => {
            const amount = parseFloat(p.amount) || 0;
            if (amount === 0) return "";
            const baseAmount = toBase(amount, p.currency_code);
            const signed = signedBaseAmount(baseAmount, p.payment_type);
            return formatAmount(signed, { currencyCode: curr.code });
          },
          align: 'right' as const,
          className: isBase
            ? "tabular-nums font-black text-foreground"
            : "tabular-nums font-medium text-muted-foreground"
        };
      }),
      {
        id: "notes",
        header: t("payment.statement", { namespace: "invoicing",  }),
        label: t("payment.statement", { namespace: "invoicing",  }),
        accessor: (p) => p.notes || "",
        align: "left",
        className: "text-muted-foreground italic",
      },
      {
        id: "credit_account",
        header: t("payment.creditAccount", { namespace: "invoicing",  }),
        label: t("payment.creditAccount", { namespace: "invoicing",  }),
        accessor: (p) => {
          if (p.credit_account_id) {
            const acc = accounts.find((a) => a.id === p.credit_account_id);
            return acc ? resolveAccountName(acc, language) : "";
          }
          return "";
        },
        align: "left",
        className: "font-medium text-foreground text-sm",
      },
      {
        id: "debit_account",
        header: t("payment.debitAccount", { namespace: "invoicing",  }),
        label: t("payment.debitAccount", { namespace: "invoicing",  }),
        accessor: (p) => {
          if (p.debit_account_id) {
            const acc = accounts.find((a) => a.id === p.debit_account_id);
            return acc ? resolveAccountName(acc, language) : "";
          }
          return "";
        },
        align: "left",
        className: "font-medium text-foreground text-sm",
      },
      {
        id: "payment_date",
        header: t("labels.date", { namespace: "common",  }),
        label: t("labels.date", { namespace: "common",  }),
        accessor: (p) => formatDateTime(p.payment_date),
        align: "right",
        className: "tabular-nums text-muted-foreground",
      },
      {
        id: "actions",
        header: t("labels.actions", { namespace: "common",  }),
        label: t("labels.actions", { namespace: "common",  }),
        accessor: (p) => (
          <TableActions
            actions={rowActions}
            row={p}
          />
        ),
      },
    ];
    return cols;
    },
    [
      sortedCurrencies,
      formatAmount,
      toBase,
      accounts,
      rowActions,
      isBaseCurrency,
      cs,
      t,
      language,
    ],
  );

  // Default visible: only base currency's amount column is shown.
  const defaultVisible = useMemo(() => {
    const def: string[] = ["journal_entry_number", "payment_type"];
    sortedCurrencies.forEach(curr => {
      if (isBaseCurrency(curr.code)) {
        def.push(`amount_${curr.code}`);
      }
    });
    def.push("notes", "credit_account", "debit_account", "payment_date", "actions");
    return def;
  }, [sortedCurrencies, isBaseCurrency]);

  const { enrichedColumns, toolbarColumns, toggleColumn, resetToDefault, isModified } = useUnifiedColumns({
    tableId: "payments-unified",
    columns: allColumns,
    defaultVisible,
  });

  const handleExport = useCallback(async () => {
    const currCols = currencyAmountCols("amount", t("labels.amount", { namespace: "common",  }), (row) => {
      const p = row as unknown as Payment;
      const amount = parseFloat(p.amount) || 0;
      const baseAmount = toBase(amount, p.currency_code);
      return signedBaseAmount(baseAmount, p.payment_type);
    }, sortedCurrencies, formatAmount, "", hasSecondaryCurrencies, hasSecondaryCurrencies, currencyMode, baseCode, rateMap);

    const visibleIds = new Set(enrichedColumns.filter(c => c.visible !== false).map(c => c.id));
    currCols.forEach(col => {
      if (!visibleIds.has(col.id)) col.hidden = true;
    });

    const summary = buildCurrencySummary("amount", sortedCurrencies);

    const exportColumns: ExcelExportColumn[] = [
      { id: "journal_entry_number", label: t("payment.journalEntryNo", { namespace: "invoicing",  }), accessor: (row) => parseInt(String((row as Record<string, unknown>).journal_entry_number ?? "0"), 10) || 0 },
      { id: "payment_type", label: t("payment.type", { namespace: "invoicing",  }), accessor: (row) => {
        const p = row as unknown as Payment;
        return t(`paymentTypeLabel.${p.payment_type as string}`, { namespace: "invoicing"});
      }},
      ...currCols,
      { id: "notes", label: t("payment.statement", { namespace: "invoicing",  }), accessor: (row) => String((row as Record<string, unknown>).notes ?? "") },
      { id: "credit_account", label: t("payment.creditAccount", { namespace: "invoicing",  }), accessor: (row) => {
        const p = row as unknown as Payment;
        return p.credit_account_id ? resolveAccountName(accounts.find((a) => a.id === p.credit_account_id) ?? ({} as AccountDto), language) : "";
      }},
      { id: "debit_account", label: t("payment.debitAccount", { namespace: "invoicing",  }), accessor: (row) => {
        const p = row as unknown as Payment;
        return p.debit_account_id ? resolveAccountName(accounts.find((a) => a.id === p.debit_account_id) ?? ({} as AccountDto), language) : "";
      }},
      dateCol("payment_date", t("labels.date", { namespace: "common",  }), (row) => (row as unknown as Payment).payment_date),
    ];

    await executeExport(exportData, {
      sheetName: t("payment.title", { namespace: "invoicing",  }),
      filename: t("payment.title", { namespace: "invoicing",  }),
      data: sortedData as unknown as Record<string, unknown>[],
      columns: exportColumns,
      summary,
      summaryLabel: t("document.summaryLabel", { namespace: "invoicing",  }),
      currencyRatesSheet: ratesSheet,
    });
  }, [sortedData, sortedCurrencies, accounts, formatAmount, toBase, currencyMode, baseCode, rateMap, exportData, hasSecondaryCurrencies, enrichedColumns, ratesSheet, t, language]);

  const summaryColumns = useMemo<SummaryColumn[]>(() => {
    const baseTotal = sortedData.reduce((sum, p) => {
      const amt = parseFloat(p.amount) || 0;
      if (amt === 0) return sum;
      const baseAmount = toBase(amt, p.currency_code);
      return sum + signedBaseAmount(baseAmount, p.payment_type);
    }, 0);

    return enrichedColumns.map((col) => {
      const id = col.id;
      if (id === "journal_entry_number") {
        return {
          id: "count",
          columnId: "journal_entry_number",
          label: "",
          value: t("payment.countVouchers", { namespace: "invoicing", vars: { count: sortedData.length },  }),
          className: "text-muted-foreground font-medium",
        };
      }
      const amountMatch = id.match(/^amount_(.+)$/);
      if (amountMatch) {
        const currCode = amountMatch[1];
        const isBase = isBaseCurrency(currCode);
        return {
          id: `${id}_summary`,
          columnId: id,
          label: t("labels.total", { namespace: "common",  }),
          value: baseTotal !== 0
            ? formatAmount(baseTotal, { currencyCode: currCode })
            : "—",
          className: isBase
            ? "text-slate-900 font-black"
            : "text-muted-foreground font-extrabold",
        };
      }
      return { id: `${id}_spacer`, columnId: id, label: "", value: "" };
    });
  }, [sortedData, enrichedColumns, formatAmount, toBase, isBaseCurrency, t]);

  return (
    <TableShell
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder={t("payment.searchPlaceholder", { namespace: "invoicing",  })}
      columns={toolbarColumns}
      onColumnToggle={toggleColumn}
      onColumnsReset={resetToDefault}
      columnsModified={isModified}
      showToolbar={true}
      onExportExcel={handleExport}
      filterBar={
        <Select value={typeFilter} onValueChange={onTypeFilterChange}>
          <SelectTrigger className="w-[130px] h-8 bg-card font-bold shadow-sm border-border text-xs">
            <Filter className="w-3.5 h-3.5 ml-1.5 text-muted-foreground" />
            <SelectValue placeholder={t("payment.typeFilterPlaceholder", { namespace: "invoicing",  })} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs font-bold">{t("actions.all", { namespace: "common",  })}</SelectItem>
            <SelectItem value="incoming" className="text-xs font-bold text-success">{t("payment.filterReceipt", { namespace: "invoicing",  })}</SelectItem>
            <SelectItem value="outgoing" className="text-xs font-bold text-destructive">{t("payment.filterPayment", { namespace: "invoicing",  })}</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      <UnifiedTable
        data={sortedData}
        columns={enrichedColumns}
        loading={loading}
        enableResize
        tableId="payments"
        rowActions={rowActions}
        sortField={sortField}
        sortDirection={sortDirection}
        onHeaderClick={(col) => {
          if (
            col.id === "journal_entry_number" ||
            col.id === "payment_type" ||
            col.id === "credit_account" ||
            col.id === "debit_account" ||
            col.id === "payment_date"
          ) {
            handleSort(col.id as SortField);
          }
        }}
        onRowClick={(p) => onRowClick(p)}
        selectedId={selectedId}
        emptyMessage={t("payment.empty", { namespace: "invoicing",  })}
        summary={summaryColumns}
      />
    </TableShell>
  );
}
