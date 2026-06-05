import { useMemo } from "react";
import { UnifiedTable, type UnifiedColumn } from "@widgets/table-shell/UnifiedTable";
import { TableShell } from "@widgets/table-shell/TableShell";
import type { SummaryColumn } from "@widgets/table-shell/TableSummary";
import { formatDateTime } from "@shared/lib/format";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useUnifiedColumns, useSortable } from "@shared/hooks";

import type { JournalEntryDto } from "@erp/shared-types";
import type { JournalFilters } from "../api/journalEntryService";
import { toJournalRow } from "../lib/journal-view";

interface JournalTableProps {
  entries: JournalEntryDto[];
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
  filters?: JournalFilters;
}

type SortField = "entry_number" | "entry_date" | "journal_type" | "credit_account" | "debit_account";

export function JournalTable({ entries, loading, search, onSearchChange, filters }: JournalTableProps) {
  const { currencies, baseCurrency, formatAmount } = useCurrencyContext();

  const sortedCurrencies = useMemo(() => {
    if (!baseCurrency) return currencies;
    return [baseCurrency, ...currencies.filter(c => c.code !== baseCurrency.code)];
  }, [currencies, baseCurrency]);

  const tableData = useMemo(
    () => entries.map(e => toJournalRow(e, filters?.journal_type)),
    [entries, filters?.journal_type]
  );

  const { sortedData, sortField, sortDirection, handleSort } = useSortable({
    data: tableData,
    defaultField: "entry_date" as SortField,
    defaultDirection: "desc",
    sortFn: (a, b, field, direction) => {
      let comparison = 0;
      switch (field) {
        case "entry_number":
          comparison = (parseInt(a.entry_number || "0", 10) || 0) - (parseInt(b.entry_number || "0", 10) || 0);
          break;
        case "entry_date":
          comparison = new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime();
          break;
        case "journal_type":
          comparison = (a.journal_type_display || "").localeCompare(b.journal_type_display || "", "ar");
          break;
        case "credit_account":
          comparison = (a.credit_account || "").localeCompare(b.credit_account || "", "ar");
          break;
        case "debit_account":
          comparison = (a.debit_account || "").localeCompare(b.debit_account || "", "ar");
          break;
      }
      return direction === "asc" ? comparison : -comparison;
    }
  });

  const allColumns = useMemo<UnifiedColumn<typeof tableData[0]>[]>(() => {
    const cols: UnifiedColumn<typeof tableData[0]>[] = [
      {
        id: "entry_number",
        header: "رقم القيد",
        label: "رقم القيد",
        accessor: (e) => e.entry_number,
        className: "font-black text-slate-900 text-center"
      },
      {
        id: "journal_type",
        header: "نوع الحركة",
        label: "نوع الحركة",
        accessor: (e) => <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black bg-slate-100 text-slate-600 uppercase tracking-tighter">{e.journal_type_display}</span>,
      },
    ];

    sortedCurrencies.forEach(curr => {
      const symbol = curr.symbol || curr.code;
      cols.push({
        id: `debit_${curr.code}`,
        header: `عليه / مدين (${symbol})`,
        label: `عليه / مدين (${symbol})`,
        accessor: (e) => {
          if (e.active_side !== "debit") return "";
          return e.debit_base > 0 ? formatAmount(e.debit_base, { currencyCode: curr.code }) : "";
        },
        className: "tabular-nums font-black text-blue-700"
      });
    });

    sortedCurrencies.forEach(curr => {
      const symbol = curr.symbol || curr.code;
      cols.push({
        id: `credit_${curr.code}`,
        header: `له / دائن (${symbol})`,
        label: `له / دائن (${symbol})`,
        accessor: (e) => {
          if (e.active_side !== "credit") return "";
          return e.credit_base > 0 ? formatAmount(e.credit_base, { currencyCode: curr.code }) : "";
        },
        className: "tabular-nums font-black text-emerald-700"
      });
    });

    cols.push(
      {
        id: "description",
        header: "البيان",
        label: "البيان",
        accessor: (e) => e.description,
        className: "text-slate-700 font-bold"
      },
      {
        id: "credit_account",
        header: "الحساب الدائن / المصدر",
        label: "الحساب الدائن / المصدر",
        accessor: (e) => e.credit_account,
        className: "text-emerald-600 font-bold"
      },
      {
        id: "debit_account",
        header: "الحساب المدين / الوجهة",
        label: "الحساب المدين / الوجهة",
        accessor: (e) => e.debit_account,
        className: "text-blue-600 font-bold"
      },
      {
        id: "entry_date",
        header: "التاريخ",
        label: "التاريخ",
        accessor: (e) => formatDateTime(e.entry_date),
        className: "text-slate-500 tabular-nums"
      },
    );
    return cols;
  }, [sortedCurrencies, formatAmount]);

  const defaultVisible = useMemo(() => {
    const def = ["entry_number", "journal_type"];
    sortedCurrencies.forEach(curr => {
      def.push(`debit_${curr.code}`);
    });
    sortedCurrencies.forEach(curr => {
      def.push(`credit_${curr.code}`);
    });
    def.push("description", "entry_date");
    return def;
  }, [sortedCurrencies]);

  const { enrichedColumns, toolbarColumns, toggleColumn } = useUnifiedColumns({
    tableId: "journal-unified",
    columns: allColumns,
    defaultVisible,
  });

  const summaryColumns = useMemo<SummaryColumn[]>(() => {
    const baseDebitTotal = tableData.reduce((s, e) => s + e.debit_base, 0);
    const baseCreditTotal = tableData.reduce((s, e) => s + e.credit_base, 0);

    return enrichedColumns.map((col) => {
      const id = col.id;
      if (id === "entry_number") {
        return { id: "count", columnId: "entry_number", label: "", value: `${sortedData.length} قيد`, className: "text-slate-500 font-medium" };
      }
      if (id === "journal_type" || id === "description") {
        return { id: `${id}_spacer`, columnId: id, label: "", value: "" };
      }
      const debitMatch = id.match(/^debit_(.+)$/);
      if (debitMatch) {
        const currCode = debitMatch[1];
        return {
          id: `${id}_total`,
          columnId: id,
          label: "إجمالي",
          value: baseDebitTotal > 0 ? formatAmount(baseDebitTotal, { currencyCode: currCode }) : "—",
          className: "text-blue-700 font-black"
        };
      }
      const creditMatch = id.match(/^credit_(.+)$/);
      if (creditMatch) {
        const currCode = creditMatch[1];
        return {
          id: `${id}_total`,
          columnId: id,
          label: "إجمالي",
          value: baseCreditTotal > 0 ? formatAmount(baseCreditTotal, { currencyCode: currCode }) : "—",
          className: "text-emerald-700 font-black"
        };
      }
      return { id: `${id}_spacer`, columnId: id, label: "", value: "" };
    });
  }, [tableData, sortedData, formatAmount, enrichedColumns, sortedCurrencies]);

  return (
    <TableShell
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="بحث برقم القيد أو البيان..."
      columns={toolbarColumns}
      onColumnToggle={toggleColumn}
      showToolbar={true}
    >
      <UnifiedTable
        data={sortedData}
        columns={enrichedColumns}
        loading={loading}
        enableResize
        tableId="journal"
        sortField={sortField}
        sortDirection={sortDirection}
        onHeaderClick={(col) => {
          if (col.id === "entry_number" || col.id === "journal_type" || col.id === "credit_account" || col.id === "debit_account" || col.id === "entry_date") {
            handleSort(col.id as SortField);
          }
        }}
        emptyMessage="لا توجد قيود يومية مسجلة"
        summary={summaryColumns}
      />
    </TableShell>
  );
}