import { useMemo, useState, useCallback } from "react";
import { ArrowUpDown } from "lucide-react";
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { TableShell } from '@widgets/table-shell/TableShell';
import { formatDateTime } from '@shared/lib/format';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useColumnPreferences } from "@shared/hooks/useColumnPreferences";
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

type SortField = "entry_number" | "entry_date";

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
      header: "نوع الحركة",           
      label: "نوع الحركة",           
      accessor: (e) => <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black bg-slate-100 text-slate-600 uppercase tracking-tighter">{e.journal_type_display}</span>,
      className: "w-24"
    },
    { 
      id: "total_debit_usd",  
      header: "عليه / مدين ($)",      
      label: "عليه / مدين ($)",      
      accessor: (e) => e.active_side === 'debit' ? formatAmount(e.debit_usd, { currencyCode: "USD" }) : "",    
      align: "left", 
      className: "tabular-nums font-black text-blue-700" 
    },
    { 
      id: "total_debit_syp",  
      header: "عليه / مدين (ل.س)",      
      label: "عليه / مدين (ل.س)",      
      accessor: (e) => e.active_side === 'debit' ? formatAmount(e.debit_syp, { currencyCode: "SYP" }) : "",    
      align: "left", 
      className: "tabular-nums font-bold text-blue-600" 
    },
    { 
      id: "total_credit_usd", 
      header: "له / دائن ($)",        
      label: "له / دائن ($)",        
      accessor: (e) => e.active_side === 'credit' ? formatAmount(e.credit_usd, { currencyCode: "USD" }) : "",  
      align: "left", 
      className: "tabular-nums font-black text-emerald-700" 
    },
    { 
      id: "total_credit_syp", 
      header: "له / دائن (ل.س)",        
      label: "له / دائن (ل.س)",        
      accessor: (e) => e.active_side === 'credit' ? formatAmount(e.credit_syp, { currencyCode: "SYP" }) : "",  
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
      header: <SortableHeader field="entry_date" label="التاريخ" currentField={sortField} direction={sortDirection} onSort={handleSort} />,              
      label: "التاريخ",              
      accessor: (e) => formatDateTime(e.entry_date), 
      className: "text-slate-500 tabular-nums w-32" 
    },
  ], [formatAmount, sortField, sortDirection, handleSort]);

  const defaultVisible = ["entry_number", "journal_type", "total_debit_usd", "total_credit_usd", "description", "entry_date"];
  const { visibleColumns, toggleColumn } = useColumnPreferences("journal-unified", defaultVisible);

  const enrichedColumns = useMemo(() => {
    return allColumns.map(col => ({
      ...col,
      visible: visibleColumns.includes(col.id)
    }));
  }, [allColumns, visibleColumns]);

  const toolbarColumns = useMemo(() => {
    return allColumns.map(c => ({
      id: c.id,
      label: c.label || (typeof c.header === 'string' ? c.header : c.id),
      visible: visibleColumns.includes(c.id)
    }));
  }, [allColumns, visibleColumns]);

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
      />
    </TableShell>
  );
}
