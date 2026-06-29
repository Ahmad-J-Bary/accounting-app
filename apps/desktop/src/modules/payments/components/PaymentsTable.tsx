import { useMemo, useCallback } from "react";
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { TableShell } from '@widgets/table-shell/TableShell';
import { TableActions } from '@widgets/table-shell/TableActions';
import type { SummaryColumn } from '@widgets/table-shell/TableSummary';
import { useUnifiedColumns, useSortable, useBaseCurrencyColumns } from "@shared/hooks";
import { formatDate } from "@shared/lib/format";
import { PAYMENT_TYPE_LABELS } from "@modules/payments/lib/constants";
import { ArrowDownCircle, ArrowUpCircle, Filter } from "lucide-react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@shared/ui/select";
import type { Payment, AccountDto } from "@erp/shared-types";

type SortField = "journal_entry_number" | "payment_date" | "payment_type" | "credit_account" | "debit_account";

interface PaymentsTableProps {
  payments: Payment[];
  accounts: AccountDto[];
  currencies: { code: string; symbol?: string }[];
  baseCurrency?: { code: string; symbol?: string };
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

  const { isBaseCurrency } = useBaseCurrencyColumns();
  const sortedCurrencies = useMemo(() => {
    if (!baseCurrency) return currencies;
    return [baseCurrency, ...currencies.filter(c => c.code !== baseCurrency.code)];
  }, [currencies, baseCurrency]);

  const filtered = useMemo(() => {
    return payments.filter(
      (p) => {
        if (typeFilter === "all") return true;
        if (typeFilter === "incoming") return ["Receipt", "CashIn", "SupplierReceipt"].includes(p.payment_type);
        if (typeFilter === "outgoing") return ["SupplierPayment", "CustomerPayment", "CashOut", "ExpenseVoucher", "DrawingsVoucher"].includes(p.payment_type);
        return p.payment_type === typeFilter;
      },
    );
  }, [payments, typeFilter]);

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
            PAYMENT_TYPE_LABELS[
              a.payment_type as keyof typeof PAYMENT_TYPE_LABELS
            ] || a.payment_type
          ).localeCompare(
            PAYMENT_TYPE_LABELS[
              b.payment_type as keyof typeof PAYMENT_TYPE_LABELS
            ] || b.payment_type,
            "ar",
          );
          break;
        case "credit_account":
          comparison = (
            accounts.find((acc) => acc.id === a.credit_account_id)?.name_ar ||
            ""
          ).localeCompare(
            accounts.find((acc) => acc.id === b.credit_account_id)?.name_ar ||
              "",
            "ar",
          );
          break;
        case "debit_account":
          comparison = (
            accounts.find((acc) => acc.id === a.debit_account_id)?.name_ar || ""
          ).localeCompare(
            accounts.find((acc) => acc.id === b.debit_account_id)?.name_ar ||
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
        header: "رقم القيد",
        label: "رقم القيد",
        accessor: (p) => p.journal_entry_number ?? "",
        className: "font-black text-indigo-700 tabular-nums",
      },
      {
        id: "payment_type",
        header: "النوع",
        label: "النوع",
        accessor: (p) => (
          <div className="flex items-center gap-2">
            {["Receipt", "CashIn", "SupplierReceipt"].includes(p.payment_type) ? (
              <ArrowDownCircle className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <ArrowUpCircle className="w-3.5 h-3.5 text-rose-500" />
            )}
            <span className="font-bold text-[11px]">
              {PAYMENT_TYPE_LABELS[
                p.payment_type as keyof typeof PAYMENT_TYPE_LABELS
              ] || p.payment_type}
            </span>
          </div>
        ),
      },
      ...sortedCurrencies.map(curr => {
        const symbol = curr.symbol || curr.code;
        const isBase = isBaseCurrency(curr.code);
        return {
          id: `amount_${curr.code}`,
          header: `المبلغ (${symbol})`,
          label: `المبلغ (${symbol})`,
          accessor: (p: Payment) => {
            const amount = parseFloat(p.amount) || 0;
            if (amount === 0) return "";
            const baseAmount = toBase(amount, p.currency_code);
            return formatAmount(baseAmount, { currencyCode: curr.code });
          },
          className: isBase
            ? "tabular-nums font-black text-slate-900"
            : "tabular-nums font-medium text-slate-400"
        };
      }),
      {
        id: "notes",
        header: "البيان",
        label: "البيان",
        accessor: (p) => p.notes || "",
        className: "text-slate-500 italic",
      },
      {
        id: "credit_account",
        header: "الحساب الدائن / المصدر",
        label: "الحساب الدائن / المصدر",
        accessor: (p) => {
          if (p.credit_account_id) {
            return (
              accounts.find((a) => a.id === p.credit_account_id)?.name_ar || ""
            );
          }
          return "";
        },
        className: "font-medium text-slate-800 text-sm",
      },
      {
        id: "debit_account",
        header: "الحساب المدين / الوجهة",
        label: "الحساب المدين / الوجهة",
        accessor: (p) => {
          if (p.debit_account_id) {
            return (
              accounts.find((a) => a.id === p.debit_account_id)?.name_ar || ""
            );
          }
          return "";
        },
        className: "font-medium text-slate-800 text-sm",
      },
      {
        id: "payment_date",
        header: "التاريخ",
        label: "التاريخ",
        accessor: (p) => formatDate(p.payment_date),
        className: "tabular-nums text-slate-500",
      },
      {
        id: "actions",
        header: "إجراءات",
        label: "إجراءات",
        accessor: (p) => (
          <TableActions
            onView={() => onRowClick(p)}
            onEdit={() => onEdit(p)}
            onDelete={() => onDelete(p.id)}
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
      onRowClick,
      onEdit,
      onDelete,
      isBaseCurrency,
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

  const summaryColumns = useMemo<SummaryColumn[]>(() => {
    const baseTotal = sortedData.reduce((sum, p) => {
      const amt = parseFloat(p.amount) || 0;
      if (amt === 0) return sum;
      return sum + toBase(amt, p.currency_code);
    }, 0);

    return enrichedColumns.map((col) => {
      const id = col.id;
      if (id === "journal_entry_number") {
        return {
          id: "count",
          columnId: "journal_entry_number",
          label: "",
          value: `${sortedData.length} سند`,
          className: "text-slate-500 font-medium",
        };
      }
      const amountMatch = id.match(/^amount_(.+)$/);
      if (amountMatch) {
        const currCode = amountMatch[1];
        const isBase = isBaseCurrency(currCode);
        return {
          id: `${id}_summary`,
          columnId: id,
          label: "الإجمالي",
          value: baseTotal > 0
            ? formatAmount(baseTotal, { currencyCode: currCode })
            : "—",
          className: isBase
            ? "text-slate-900 font-black"
            : "text-slate-500 font-extrabold",
        };
      }
      return { id: `${id}_spacer`, columnId: id, label: "", value: "" };
    });
  }, [sortedData, enrichedColumns, formatAmount, toBase, isBaseCurrency]);

  return (
    <TableShell
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="بحث بالمستخدم، الحساب، البيان..."
      columns={toolbarColumns}
      onColumnToggle={toggleColumn}
      onColumnsReset={resetToDefault}
      columnsModified={isModified}
      showToolbar={true}
      filterBar={
        <Select value={typeFilter} onValueChange={onTypeFilterChange}>
          <SelectTrigger className="w-[130px] h-8 bg-white font-bold shadow-sm border-slate-200 text-xs">
            <Filter className="w-3.5 h-3.5 ml-1.5 text-slate-400" />
            <SelectValue placeholder="نوع الدفعة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs font-bold">الكل</SelectItem>
            <SelectItem value="incoming" className="text-xs font-bold text-emerald-600">قبض</SelectItem>
            <SelectItem value="outgoing" className="text-xs font-bold text-rose-600">دفع</SelectItem>
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
        emptyMessage="لا توجد سندات مالية مسجلة"
        summary={summaryColumns}
      />
    </TableShell>
  );
}
