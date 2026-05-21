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
import { toJournalRow } from "../lib/journal-view";

interface JournalTableProps {
  entries: JournalEntryDto[];
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
  filters?: JournalFilters;
}

type SortField = "entry_number" | "entry_date" | "debit_usd" | "debit_syp" | "credit_usd" | "credit_syp" | "journal_type" | "credit_account" | "debit_account";

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
  const { formatAmount } = useCurrencyContext();
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
        case "debit_usd":
          comparison = (Number(a.debit_usd) || 0) - (Number(b.debit_usd) || 0);
          break;
        case "debit_syp":
          comparison = (Number(a.debit_syp) || 0) - (Number(b.debit_syp) || 0);
          break;
        case "credit_usd":
          comparison = (Number(a.credit_usd) || 0) - (Number(b.credit_usd) || 0);
          break;
        case "credit_syp":
          comparison = (Number(a.credit_syp) || 0) - (Number(b.credit_syp) || 0);
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

  const allColumns = useMemo<UnifiedColumn<typeof tableData[0]>[]>(() => [
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
    { 
      id: "total_debit_usd",  
      header: <SortableHeader field="debit_usd" label="عليه / مدين ($)" currentField={sortField} direction={sortDirection} onSort={handleSort} />,      
      label: "عليه / مدين ($)",      
      accessor: (e) => e.active_side === 'debit' ? (e.debit_usd > 0 ? formatWithLocale(e.debit_usd, 2) + " $" : "—") : "",    
      align: "left", 
      className: "tabular-nums font-black text-blue-700" 
    },
    { 
      id: "total_debit_syp",  
      header: <SortableHeader field="debit_syp" label="عليه / مدين (ل.س)" currentField={sortField} direction={sortDirection} onSort={handleSort} />,      
      label: "عليه / مدين (ل.س)",      
      accessor: (e) => e.active_side === 'debit' ? (e.debit_syp > 0 ? formatWithLocale(e.debit_syp, 0) + " ل.س" : "—") : "",    
      align: "left", 
      className: "tabular-nums font-bold text-blue-600" 
    },
    { 
      id: "total_credit_usd", 
      header: <SortableHeader field="credit_usd" label="له / دائن ($)" currentField={sortField} direction={sortDirection} onSort={handleSort} />,        
      label: "له / دائن ($)",        
      accessor: (e) => e.active_side === 'credit' ? (e.credit_usd > 0 ? formatWithLocale(e.credit_usd, 2) + " $" : "—") : "",  
      align: "left", 
      className: "tabular-nums font-black text-emerald-700" 
    },
    { 
      id: "total_credit_syp", 
      header: <SortableHeader field="credit_syp" label="له / دائن (ل.س)" currentField={sortField} direction={sortDirection} onSort={handleSort} />,        
      label: "له / دائن (ل.س)",        
      accessor: (e) => e.active_side === 'credit' ? (e.credit_syp > 0 ? formatWithLocale(e.credit_syp, 0) + " ل.س" : "—") : "",  
      align: "left", 
      className: "tabular-nums font-bold text-emerald-600" 
    },
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
  ], [formatAmount, sortField, sortDirection, handleSort]);

  const { enrichedColumns, toolbarColumns, toggleColumn } = useUnifiedColumns({
    tableId: "journal-unified",
    columns: allColumns,
    defaultVisible: ["entry_number", "journal_type", "total_debit_usd", "total_credit_usd", "description", "entry_date"],
  });

  const summaryColumns = useMemo<SummaryColumn[]>(() => {
    const { totalDebitUSD, totalCreditUSD, totalDebitSYP, totalCreditSYP } = sortedData.reduce(
      (acc, row) => ({
        totalDebitUSD: acc.totalDebitUSD + (Number(row.debit_usd) || 0),
        totalCreditUSD: acc.totalCreditUSD + (Number(row.credit_usd) || 0),
        totalDebitSYP: acc.totalDebitSYP + (Number(row.debit_syp) || 0),
        totalCreditSYP: acc.totalCreditSYP + (Number(row.credit_syp) || 0),
      }),
      { totalDebitUSD: 0, totalCreditUSD: 0, totalDebitSYP: 0, totalCreditSYP: 0 }
    );

    const balanceUSD = totalDebitUSD - totalCreditUSD;
    const balanceSYP = totalDebitSYP - totalCreditSYP;

    const colIds = enrichedColumns.map(c => c.id);
    return colIds.map(id => {
      switch (id) {
        case 'entry_number':
          return { id: 'count', label: '', value: `${sortedData.length} قيد`, className: 'text-slate-500 font-medium' };
        case 'journal_type':
          return { id: 'journal_type_summary', label: '', value: 'المجموع', className: 'text-slate-600 font-bold', align: 'center' as const };
        case 'total_debit_usd':
          return { id: 'debit_usd_total', label: 'إجمالي', value: totalDebitUSD > 0 ? formatAmount(totalDebitUSD, { currencyCode: "USD" }) : "—", align: 'left' as const, className: 'text-blue-700 font-black' };
        case 'total_debit_syp':
          return { id: 'debit_syp_total', label: 'إجمالي', value: totalDebitSYP > 0 ? formatWithLocale(totalDebitSYP, 0) + " ل.س" : "—", align: 'left' as const, className: 'text-blue-600 font-bold' };
        case 'total_credit_usd':
          return { id: 'credit_usd_total', label: 'إجمالي', value: totalCreditUSD > 0 ? formatAmount(totalCreditUSD, { currencyCode: "USD" }) : "—", align: 'left' as const, className: 'text-emerald-700 font-black' };
        case 'total_credit_syp':
          return { id: 'credit_syp_total', label: 'إجمالي', value: totalCreditSYP > 0 ? formatWithLocale(totalCreditSYP, 0) + " ل.س" : "—", align: 'left' as const, className: 'text-emerald-600 font-bold' };
        case 'description':
          return { id: 'balance_summary', label: 'الرصيد', value: `${formatAmount(balanceUSD, { currencyCode: "USD" })} / ${formatWithLocale(balanceSYP, 0)} ل.س`, className: balanceUSD >= 0 ? 'text-slate-900 font-black' : 'text-rose-600 font-black' };
        default:
          return { id: `${id}_spacer`, label: '', value: '' };
      }
    });
  }, [sortedData, formatAmount, enrichedColumns]);

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
