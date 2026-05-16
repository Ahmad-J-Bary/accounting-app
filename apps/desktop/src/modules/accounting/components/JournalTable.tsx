import { useMemo } from "react";
import { DataTable, Column } from '@widgets/table-shell/DataTable';
import { formatDateTime } from '@shared/lib/format';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import type { JournalEntryDto } from "@erp/shared-types";
import type { JournalFilters } from "../api/journalEntryService";
import { toJournalRow } from "../lib/journal-view";

interface JournalTableProps {
  entries: JournalEntryDto[];
  loading: boolean;
  visibleColumns?: string[];
  filters?: JournalFilters;
}

export function JournalTable({ entries, loading, visibleColumns, filters }: JournalTableProps) {
  const { formatAmount } = useCurrencyContext();

  const tableData = useMemo(
    () => entries.map(e => toJournalRow(e, filters?.journal_type)),
    [entries, filters?.journal_type]
  );

  const allColumns = useMemo<Column<typeof tableData[0]>[]>(() => [
    { id: "entry_number",    header: "رقم القيد",            accessor: (e) => e.entry_number,            className: "font-black text-slate-900 text-[10px] text-center" },
    { id: "journal_type",    header: "نوع الحركة",           accessor: (e) => <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black bg-slate-100 text-slate-600 uppercase tracking-tighter">{e.journal_type_display}</span> },
    { id: "total_debit_usd",  header: "عليه / مدين ($)",      accessor: (e) => e.active_side === 'debit' ? formatAmount(e.debit_usd, { currencyCode: "USD" }) : "",    align: "left", className: "tabular-nums font-black text-blue-700 text-[11px]" },
    { id: "total_debit_syp",  header: "عليه / مدين (ل.س)",    accessor: (e) => e.active_side === 'debit' ? formatAmount(e.debit_usd, { currencyCode: "SYP" }) : "",    align: "left", className: "tabular-nums font-black text-blue-700 text-[11px]" },
    { id: "total_credit_usd", header: "له / دائن ($)",        accessor: (e) => e.active_side === 'credit' ? formatAmount(e.credit_usd, { currencyCode: "USD" }) : "",  align: "left", className: "tabular-nums font-black text-emerald-700 text-[11px]" },
    { id: "total_credit_syp", header: "له / دائن (ل.س)",      accessor: (e) => e.active_side === 'credit' ? formatAmount(e.credit_usd, { currencyCode: "SYP" }) : "",  align: "left", className: "tabular-nums font-black text-emerald-700 text-[11px]" },
    { id: "description",     header: "البيان",               accessor: (e) => e.description,              className: "max-w-[150px] truncate font-bold text-slate-700 text-[10px]" },
    { id: "credit_account",  header: "الحساب الدائن / المصدر", accessor: (e) => e.credit_account,          className: "text-emerald-600 font-bold text-[10px]" },
    { id: "debit_account",   header: "الحساب المدين / الوجهة", accessor: (e) => e.debit_account,           className: "text-blue-600 font-bold text-[10px]" },
    { id: "entry_date",      header: "التاريخ",              accessor: (e) => formatDateTime(e.entry_date), className: "text-slate-500 tabular-nums text-[10px]" },
  ], [formatAmount]);

  const columns = useMemo(() => {
    if (!visibleColumns) return allColumns;
    return allColumns.filter(col => !col.id || visibleColumns.includes(col.id));
  }, [allColumns, visibleColumns]);

  return (
    <DataTable
      data={tableData}
      columns={columns}
      loading={loading}
      emptyMessage="لا توجد قيود يومية مسجلة"
    />
  );
}
