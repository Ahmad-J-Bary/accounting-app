import { useState, useMemo, useCallback } from "react";
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { TableShell } from '@widgets/table-shell/TableShell';
import type { SummaryColumn } from '@widgets/table-shell/TableSummary';
import { useUnifiedColumns } from "@shared/hooks";
import { SortableHeader } from "@shared/ui/sortable-header";
import { formatDate } from "@shared/lib/format";
import { PAYMENT_TYPE_LABELS } from "@modules/payments/lib/constants";
import { ArrowDownCircle, ArrowUpCircle, MoreHorizontal, Eye, Edit, Trash2 } from "lucide-react";
import { Button } from "@shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@shared/ui/dropdown-menu";
import type { Payment, AccountDto } from "@erp/shared-types";

type SortField = "journal_entry_number" | "amount" | "payment_date" | "payment_type" | "credit_account" | "debit_account";

interface PaymentsTableProps {
  payments: Payment[];
  accounts: AccountDto[];
  currencies: { code: string; symbol?: string }[];
  baseCurrency?: { code: string };
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
  const [sortField, setSortField] = useState<SortField>("payment_date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const handleSort = useCallback(
    (field: SortField) => {
      setSortDirection((prev) => {
        if (sortField === field) {
          return prev === "asc" ? "desc" : "asc";
        }
        return "asc";
      });
      setSortField(field);
    },
    [sortField],
  );

  const sortedCurrencies = useMemo(() => {
    if (!baseCurrency) return currencies;
    return [baseCurrency, ...currencies.filter(c => c.code !== baseCurrency.code)];
  }, [currencies, baseCurrency]);

  const sortedFiltered = useMemo(() => {
    const sorted = [...payments].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "journal_entry_number":
          comparison =
            (parseInt(a.journal_entry_number || "0", 10) || 0) -
            (parseInt(b.journal_entry_number || "0", 10) || 0);
          break;
        case "amount": {
          const aAmt = parseFloat(a.amount) || 0;
          const bAmt = parseFloat(b.amount) || 0;
          comparison = aAmt - bAmt;
          break;
        }
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
      return sortDirection === "asc" ? comparison : -comparison;
    });
    return sorted;
  }, [payments, sortField, sortDirection, accounts]);

  const filtered = useMemo(() => {
    return sortedFiltered.filter(
      (p) => typeFilter === "all" || p.payment_type === typeFilter,
    );
  }, [sortedFiltered, typeFilter]);

  const allColumns = useMemo<UnifiedColumn<Payment>[]>(
    () => {
      const cols: UnifiedColumn<Payment>[] = [
      {
        id: "journal_entry_number",
        header: (
          <SortableHeader
            field="journal_entry_number"
            label="رقم القيد"
            currentField={sortField}
            direction={sortDirection}
            onSort={handleSort}
          />
        ),
        label: "رقم القيد",
        accessor: (p) => p.journal_entry_number ?? "—",
        className: "font-black text-indigo-700 tabular-nums w-24",
        align: "center",
      },
      {
        id: "payment_type",
        header: (
          <SortableHeader
            field="payment_type"
            label="النوع"
            currentField={sortField}
            direction={sortDirection}
            onSort={handleSort}
          />
        ),
        label: "النوع",
        accessor: (p) => (
          <div className="flex items-center gap-2">
            {["Receipt", "CashIn"].includes(p.payment_type) ? (
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
        className: "w-32",
      },...sortedCurrencies.map(curr => {
        const symbol = curr.symbol || curr.code;
        return {
          id: `amount_${curr.code}`,
          header: (
            <SortableHeader
              field="amount"
              label={`المبلغ (${symbol})`}
              currentField={sortField}
              direction={sortDirection}
              onSort={handleSort}
            />
          ),
          label: `المبلغ (${symbol})`,
          accessor: (p: Payment) => {
            const amount = parseFloat(p.amount) || 0;
            if (amount === 0) return "—";
            const baseAmount = toBase(amount, p.currency_code);
            return formatAmount(baseAmount, { currencyCode: curr.code });
          },
          align: "left" as const,
          className: "tabular-nums font-black text-slate-900 w-32",
        };
      }),
      {
        id: "notes",
        header: "البيان",
        label: "البيان",
        accessor: (p) => p.notes || "—",
        className: "min-w-[200px] text-slate-500 italic",
      },
      {
        id: "credit_account",
        header: (
          <SortableHeader
            field="credit_account"
            label="الحساب الدائن / المصدر"
            currentField={sortField}
            direction={sortDirection}
            onSort={handleSort}
          />
        ),
        label: "الحساب الدائن / المصدر",
        accessor: (p) => {
          if (p.credit_account_id) {
            return (
              accounts.find((a) => a.id === p.credit_account_id)?.name_ar || "—"
            );
          }
          return "—";
        },
        className: "font-medium text-slate-800 text-sm",
      },
      {
        id: "debit_account",
        header: (
          <SortableHeader
            field="debit_account"
            label="الحساب المدين / الوجهة"
            currentField={sortField}
            direction={sortDirection}
            onSort={handleSort}
          />
        ),
        label: "الحساب المدين / الوجهة",
        accessor: (p) => {
          if (p.debit_account_id) {
            return (
              accounts.find((a) => a.id === p.debit_account_id)?.name_ar || "—"
            );
          }
          return "—";
        },
        className: "font-medium text-slate-800 text-sm",
      },
      {
        id: "payment_date",
        header: (
          <SortableHeader
            field="payment_date"
            label="التاريخ"
            currentField={sortField}
            direction={sortDirection}
            onSort={handleSort}
          />
        ),
        label: "التاريخ",
        accessor: (p) => formatDate(p.payment_date),
        className: "w-28 tabular-nums text-slate-400",
      },
      {
        id: "actions",
        header: "إجراءات",
        label: "إجراءات",
        accessor: (p) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-400 hover:text-slate-600"
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              <DropdownMenuItem
                onClick={() => onRowClick(p)}
                className="flex-row-reverse gap-2"
              >
                <Eye className="w-4 h-4" /> عرض التفاصيل
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onEdit(p)}
                className="flex-row-reverse gap-2 text-blue-600 focus:text-blue-600"
              >
                <Edit className="w-4 h-4" /> تعديل
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(p.id)}
                className="flex-row-reverse gap-2 text-rose-600 focus:text-rose-600"
              >
                <Trash2 className="w-4 h-4" /> حذف السند
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        align: "center",
        className: "w-[80px]",
      },
    ];
    return cols;
    },
    [
      sortField,
      sortDirection,
      handleSort,
      sortedCurrencies,
      formatAmount,
      toBase,
    ],
  );

  const { enrichedColumns, toolbarColumns, toggleColumn } = useUnifiedColumns({
    tableId: "payments-unified",
    columns: allColumns,
    defaultVisible: allColumns.map((c) => c.id),
  });

  const summaryColumns = useMemo<SummaryColumn[]>(() => {
    const baseTotal = filtered.reduce((sum, p) => {
      const amt = parseFloat(p.amount) || 0;
      if (amt === 0) return sum;
      return sum + toBase(amt, p.currency_code);
    }, 0);

    const colIds = enrichedColumns.map((c) => c.id);
    return colIds.map((id) => {
      if (id === "journal_entry_number") {
        return {
          id: "count",
          columnId: "journal_entry_number",
          label: "",
          value: `${filtered.length} سند`,
          className: "text-slate-500 font-medium",
        };
      }
      const amountMatch = id.match(/^amount_(.+)$/);
      if (amountMatch) {
        const currCode = amountMatch[1];
        return {
          id: `${id}_summary`,
          columnId: id,
          label: "الإجمالي",
          value: baseTotal > 0
            ? formatAmount(baseTotal, { currencyCode: currCode })
            : "—",
          align: "left" as const,
          className: "text-slate-900 font-black",
        };
      }
      return { id: `${id}_spacer`, columnId: id, label: "", value: "" };
    });
  }, [filtered, enrichedColumns, sortedCurrencies, formatAmount, toBase]);

  return (
    <TableShell
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="بحث بالمستخدم، الحساب، البيان..."
      columns={toolbarColumns}
      onColumnToggle={toggleColumn}
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant={typeFilter === "all" ? "default" : "outline"}
            size="sm"
            className="h-9"
            onClick={() => onTypeFilterChange("all")}
          >
            الكل
          </Button>
          <Button
            variant={typeFilter === "Receipt" ? "default" : "outline"}
            size="sm"
            className="h-9 text-emerald-600"
            onClick={() => onTypeFilterChange("Receipt")}
          >
            قبض
          </Button>
          <Button
            variant={
              typeFilter === "SupplierPayment" ? "default" : "outline"
            }
            size="sm"
            className="h-9 text-rose-600"
            onClick={() => onTypeFilterChange("SupplierPayment")}
          >
            دفع
          </Button>
        </div>
      }
    >
      <UnifiedTable
        data={filtered}
        columns={enrichedColumns}
        loading={loading}
        onRowClick={(p) => onRowClick(p)}
        selectedId={selectedId}
        emptyMessage="لا توجد سندات مالية مسجلة"
        summary={summaryColumns}
      />
    </TableShell>
  );
}
