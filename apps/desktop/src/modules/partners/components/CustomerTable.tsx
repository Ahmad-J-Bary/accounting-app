import { useMemo, useState, useCallback } from "react";
import { DataTable, Column } from '@widgets/table-shell/DataTable';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import type { CustomerDto } from "@erp/shared-types";
import { ArrowUpDown } from "lucide-react";

interface CustomerTableProps {
  customers: CustomerDto[];
  loading: boolean;
  search: string;
  visibleColumns: string[];
  onView: (c: CustomerDto) => void;
  selectedId?: string | null;
}

type SortField = "code" | "name" | "debit" | "credit";

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
      onClick={() => onSort(field)}
      className="flex items-center gap-1 hover:text-slate-700 transition-colors"
    >
      {label}
      {getSortIcon(field)}
    </button>
  );
};

export function CustomerTable({ customers, loading, search, visibleColumns, onView, selectedId }: CustomerTableProps) {
  const { currencies, convertFromBase, formatAmount, baseCurrency } = useCurrencyContext();
  const [sortField, setSortField] = useState<SortField>("code");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const handleSort = useCallback((field: SortField) => {
    setSortDirection(prev => {
      if (sortField === field) {
        return prev === "asc" ? "desc" : "asc";
      }
      return "asc";
    });
    setSortField(field);
  }, [sortField]);

  const sortedCustomers = useMemo(() => {
    const sorted = [...customers].sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case "code":
          comparison = (parseInt(a.code || "0", 10) || 0) - (parseInt(b.code || "0", 10) || 0);
          break;
        case "name":
          comparison = (a.name || "").localeCompare(b.name || "", "ar");
          break;
        case "debit":
          comparison = (Number(a.debit) || 0) - (Number(b.debit) || 0);
          break;
        case "credit":
          comparison = (Number(a.credit) || 0) - (Number(b.credit) || 0);
          break;
      }
      
      return sortDirection === "asc" ? comparison : -comparison;
    });
    
    return sorted;
  }, [customers, sortField, sortDirection]);

  const columns = useMemo<Column<CustomerDto>[]>(() => {
    const cols: Column<CustomerDto>[] = [
      { 
        id: "#",
        header: <SortableHeader field="code" label="#" currentField={sortField} direction={sortDirection} onSort={handleSort} />, 
        accessor: (c) => c.code || "—",
        className: "text-center font-black text-slate-500 w-14 cursor-pointer hover:bg-slate-50"
      },
      { 
        id: "name",
        header: <SortableHeader field="name" label="اسم العميل" currentField={sortField} direction={sortDirection} onSort={handleSort} />, 
        accessor: "name", 
        className: "font-bold text-slate-800 cursor-pointer hover:bg-slate-50" 
      },
      { 
        id: "phone",
        header: "رقم الهاتف", 
        accessor: (c) => c.phone || "—", 
        className: "tabular-nums text-slate-500" 
      },
    ];

    // 1. Debits
    currencies.forEach(curr => {
      const symbol = curr.code === 'USD' ? '$' : curr.code === 'SYP' ? 'ل.س' : (curr.symbol || curr.code);
      cols.push({
        id: `debit_${curr.code}`,
        header: <SortableHeader field="debit" label={`مدين (${symbol})`} currentField={sortField} direction={sortDirection} onSort={handleSort} />,
        accessor: (c) => {
          const val = convertFromBase(Number(c.debit || 0), curr.code);
          return val > 0 ? formatAmount(Number(c.debit || 0), { currencyCode: curr.code }) : "—";
        },
        align: "left",
        className: "text-red-600 tabular-nums font-medium text-[11px] cursor-pointer hover:bg-slate-50"
      });
    });

    // 2. Credits
    currencies.forEach(curr => {
      const symbol = curr.code === 'USD' ? '$' : curr.code === 'SYP' ? 'ل.س' : (curr.symbol || curr.code);
      cols.push({
        id: `credit_${curr.code}`,
        header: <SortableHeader field="credit" label={`دائن (${symbol})`} currentField={sortField} direction={sortDirection} onSort={handleSort} />,
        accessor: (c) => {
          const val = convertFromBase(Number(c.credit || 0), curr.code);
          return val > 0 ? formatAmount(Number(c.credit || 0), { currencyCode: curr.code }) : "—";
        },
        align: "left",
        className: "text-green-600 tabular-nums font-medium text-[11px] cursor-pointer hover:bg-slate-50"
      });
    });

    return cols;
  }, [currencies, convertFromBase, formatAmount, sortField, sortDirection, handleSort]);

  const filteredColumns = useMemo(() => {
    return columns.filter(col => {
      if (!col.id || col.id === "actions") return true;
      return visibleColumns.includes(col.id);
    });
  }, [columns, visibleColumns]);

  return (
    <DataTable
      data={sortedCustomers}
      columns={filteredColumns}
      loading={loading}
      onRowClick={onView}
      selectedId={selectedId}
      emptyMessage={search ? "لا توجد نتائج بحث تطابق استعلامك" : "لا يوجد عملاء مسجلون في النظام حالياً"}
    />
  );
}