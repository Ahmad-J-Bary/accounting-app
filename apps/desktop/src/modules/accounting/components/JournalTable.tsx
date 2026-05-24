import { useMemo, useState, useCallback } from "react";
import { ArrowUpDown } from "lucide-react";
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { TableShell } from '@widgets/table-shell/TableShell';
import type { SummaryColumn } from '@widgets/table-shell/TableSummary';
import { formatDateTime } from '@shared/lib/format';
import { useCurrencyContext, formatWithLocale } from "@app/providers/CurrencyContext";
import { useUnifiedColumns } from "@shared/hooks";
import type { JournalEntryDto } from "@erp/shared-types";
import type { JournalFilters } from "../api/journalEntryService";
import { toJournalRow, aggregateEntryTotals } from "../lib/journal-view";

interface JournalTableProps {
  entries: JournalEntryDto[];
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
  filters?: JournalFilters;
}

type SortField = "entry_number" | "entry_date" | "journal_type" | "credit_account" | "debit_account";

interface SortableHeaderProps {
  field: SortField;
  label: string;
  currentField: SortField;
  direction: "asc" | "desc";
  onSort: (field: SortField) => void;
}

const SortableHeader = ({ field, label, currentField, direction, onSort }: SortableHeaderProps) => {
  const getSortIcon = (f: SortField) => {
    if (currentField !== f) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return direction === "asc"
      ? <ArrowUpDown className="w-3 h-3 rotate-180" />
      : <ArrowUpDown className="w-3 h-3" />;
  };

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onSort(field); }}
      className="flex items-center gap-1 hover:text-slate-900 transition-colors"
    >
      {label}
      {getSortIcon(field)}
    </button>
  );
};

export function JournalTable({ entries, loading, search, onSearchChange, filters }: JournalTableProps) {
  const { currencies, baseCurrency, formatAmount } = useCurrencyContext();
  const [sortField, setSortField] = useState<SortField>("entry_date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const handleSort = useCallback((field: SortField) => {
    setSortDirection(prev => {
      if (sortField === field) {
        return prev === "asc" ? "desc" : "asc";
      }
      return "asc";
    });
    setSortField(field);
  }, [sortField]);

  const sortedCurrencies = useMemo(() => {
    if (!baseCurrency) return currencies;
    return [baseCurrency, ...currencies.filter(c => c.code !== baseCurrency.code)];
  }, [currencies, baseCurrency]);

  const tableData = useMemo(
    () => entries.map(e => toJournalRow(e, filters?.journal_type)),
    [entries, filters?.journal_type]
  );

  const sortedData = useMemo(() => {
    const sorted = [...tableData].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
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
      return sortDirection === "asc" ? comparison : -comparison;
    });
    return sorted;
  }, [tableData, sortField, sortDirection]);

  const fieldForCurrency = useCallback((currCode: string): "debit_base" | "debit_original" => {
    if (baseCurrency && currCode === baseCurrency.code) return "debit_base";
    return "debit_original";
  }, [baseCurrency]);

  const creditFieldForCurrency = useCallback((currCode: string): "credit_base" | "credit_original" => {
    if (baseCurrency && currCode === baseCurrency.code) return "credit_base";
    return "credit_original";
  }, [baseCurrency]);

  const allColumns = useMemo<UnifiedColumn<typeof tableData[0]>[]>(() => {
    const cols: UnifiedColumn<typeof tableData[0]>[] = [
      { 
        id: "entry_number",    
        header: <SortableHeader field="entry_number" label="رقم القيد" currentField={sortField} direction={sortDirection} onSort={handleSort} />,            
        label: "رقم القيد",            
        accessor: (e) => e.entry_number,            
        className: "font-black text-slate-900 text-center w-20" 
      },
      { 
        id: "journal_type",    
        header: <SortableHeader field="journal_type" label="نوع الحركة" currentField={sortField} direction={sortDirection} onSort={handleSort} />,           
        label: "نوع الحركة",           
        accessor: (e) => <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black bg-slate-100 text-slate-600 uppercase tracking-tighter">{e.journal_type_display}</span>,
        className: "w-32"
      },
    ];

    sortedCurrencies.forEach(curr => {
      const symbol = curr.symbol || curr.code;
      const dField = fieldForCurrency(curr.code);
      cols.push({
        id: `debit_${curr.code}`,
        header: <SortableHeader field="entry_number" label={`عليه / مدين (${symbol})`} currentField={sortField} direction={sortDirection} onSort={handleSort} />,
        label: `عليه / مدين (${symbol})`,
        accessor: (e) => {
          const val = e.active_side === 'debit' ? e[dField] : 0;
          return val > 0 ? formatWithLocale(val, curr.code === baseCurrency?.code ? 2 : 0) + ` ${symbol}` : "";
        },
        align: "left",
        className: `tabular-nums font-black ${curr.code === baseCurrency?.code ? 'text-blue-700' : 'text-blue-600'}`
      });
    });

    sortedCurrencies.forEach(curr => {
      const symbol = curr.symbol || curr.code;
      const cField = creditFieldForCurrency(curr.code);
      cols.push({
        id: `credit_${curr.code}`,
        header: <SortableHeader field="entry_number" label={`له / دائن (${symbol})`} currentField={sortField} direction={sortDirection} onSort={handleSort} />,
        label: `له / دائن (${symbol})`,
        accessor: (e) => {
          const val = e.active_side === 'credit' ? e[cField] : 0;
          return val > 0 ? formatWithLocale(val, curr.code === baseCurrency?.code ? 2 : 0) + ` ${symbol}` : "";
        },
        align: "left",
        className: `tabular-nums font-black ${curr.code === baseCurrency?.code ? 'text-emerald-700' : 'text-emerald-600'}`
      });
    });

    cols.push(
      { 
        id: "description",     
        header: "البيان",               
        label: "البيان",               
        accessor: (e) => e.description,              
        className: "max-w-[200px] truncate font-bold text-slate-700" 
      },
      { 
        id: "credit_account",  
        header: <SortableHeader field="credit_account" label="الحساب الدائن / المصدر" currentField={sortField} direction={sortDirection} onSort={handleSort} />, 
        label: "الحساب الدائن / المصدر", 
        accessor: (e) => e.credit_account,          
        className: "text-emerald-600 font-bold" 
      },
      { 
        id: "debit_account",   
        header: <SortableHeader field="debit_account" label="الحساب المدين / الوجهة" currentField={sortField} direction={sortDirection} onSort={handleSort} />, 
        label: "الحساب المدين / الوجهة", 
        accessor: (e) => e.debit_account,           
        className: "text-blue-600 font-bold" 
      },
      { 
        id: "entry_date",      
        header: <SortableHeader field="entry_date" label="التاريخ" currentField={sortField} direction={sortDirection} onSort={handleSort} />,              
        label: "التاريخ",              
        accessor: (e) => formatDateTime(e.entry_date), 
        className: "text-slate-500 tabular-nums w-32" 
      },
    );
    return cols;
  }, [sortField, sortDirection, handleSort, sortedCurrencies, baseCurrency, fieldForCurrency, creditFieldForCurrency]);

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
    const rawTotals = aggregateEntryTotals(entries);
    const totals: Record<string, { debit: number; credit: number }> = {};
    sortedCurrencies.forEach(curr => {
      totals[curr.code] = {
        debit: curr.code === baseCurrency?.code ? rawTotals.debitBase : rawTotals.debitOriginal,
        credit: curr.code === baseCurrency?.code ? rawTotals.creditBase : rawTotals.creditOriginal,
      };
    });

    const colIds = enrichedColumns.map(c => c.id);
    return colIds.map(id => {
      if (id === 'entry_number') {
        return { id: 'count', label: '', value: `${sortedData.length} قيد`, className: 'text-slate-500 font-medium' };
      }
      if (id === 'journal_type') {
        return { id: 'journal_type_summary', label: '', value: 'المجموع', className: 'text-slate-600 font-bold', align: 'center' as const };
      }
      if (id === 'description') {
        const balanceParts: string[] = [];
        sortedCurrencies.forEach(curr => {
          const t = totals[curr.code];
          if (t) {
            const bal = t.debit - t.credit;
            balanceParts.push(formatAmount(bal, { currencyCode: curr.code }));
          } else {
            balanceParts.push(formatAmount(0, { currencyCode: curr.code }));
          }
        });
        return {
          id: 'balance_summary', label: 'الرصيد',
          value: balanceParts.join(' / '),
          className: 'text-slate-900 font-black'
        };
      }
      const debitMatch = id.match(/^debit_(.+)$/);
      if (debitMatch) {
        const currCode = debitMatch[1];
        const t = totals[currCode];
        return {
          id: `${id}_total`, label: 'إجمالي',
          value: t && t.debit > 0 ? formatAmount(t.debit, { currencyCode: currCode }) : "—",
          align: 'left' as const,
          className: 'text-blue-700 font-black'
        };
      }
      const creditMatch = id.match(/^credit_(.+)$/);
      if (creditMatch) {
        const currCode = creditMatch[1];
        const t = totals[currCode];
        return {
          id: `${id}_total`, label: 'إجمالي',
          value: t && t.credit > 0 ? formatAmount(t.credit, { currencyCode: currCode }) : "—",
          align: 'left' as const,
          className: 'text-emerald-700 font-black'
        };
      }
      return { id: `${id}_spacer`, label: '', value: '' };
    });
  }, [sortedData, entries, formatAmount, enrichedColumns, sortedCurrencies, baseCurrency]);

  return (
    <TableShell
      search={search}
      onSearchChange={onSearchChange}
      columns={toolbarColumns}
      onColumnToggle={toggleColumn}
      showToolbar={true}
    >
      <UnifiedTable
        data={sortedData}
        columns={enrichedColumns}
        loading={loading}
        emptyMessage="لا توجد قيود يومية مسجلة"
        summary={summaryColumns}
      />
    </TableShell>
  );
}
