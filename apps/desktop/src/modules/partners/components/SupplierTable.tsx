import { useMemo } from "react";
import { DataTable, Column } from '@widgets/table-shell/DataTable';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import type { SupplierDto } from "@erp/shared-types";

interface SupplierTableProps {
  suppliers: SupplierDto[];
  loading: boolean;
  search: string;
  visibleColumns: string[];
  onView: (s: SupplierDto) => void;
  selectedId?: string | null;
}

export function SupplierTable({ suppliers, loading, search, visibleColumns, onView, selectedId }: SupplierTableProps) {
  const { currencies, convertFromBase, formatAmount } = useCurrencyContext();

  const columns = useMemo<Column<SupplierDto>[]>(() => {
    const cols: Column<SupplierDto>[] = [
      { 
        id: "#",
        header: "#", 
        accessor: (s) => s.code || "—",
        className: "text-center font-black text-slate-500 w-14"
      },
      { 
        id: "name",
        header: "اسم المورد", 
        accessor: "name", 
        className: "font-bold text-slate-800" 
      },
      { 
        id: "phone",
        header: "رقم الهاتف", 
        accessor: (s) => s.phone || "—", 
        className: "tabular-nums text-slate-500" 
      },
    ];

    // Using symbols for column headers
    
    // 1. Debits
    currencies.forEach(curr => {
      const symbol = curr.symbol || curr.code;
      cols.push({
        id: `debit_${curr.code}`,
        header: `مدين (${symbol})`,
        accessor: (s) => {
          const val = convertFromBase(Number(s.debit || 0), curr.code);
          return val > 0 ? formatAmount(Number(s.debit || 0), { currencyCode: curr.code }) : "—";
        },
        align: "left",
        className: "text-red-600 tabular-nums font-medium text-[11px]"
      });
    });

    // 2. Credits
    currencies.forEach(curr => {
      const symbol = curr.symbol || curr.code;
      cols.push({
        id: `credit_${curr.code}`,
        header: `دائن (${symbol})`,
        accessor: (s) => {
          const val = convertFromBase(Number(s.credit || 0), curr.code);
          return val > 0 ? formatAmount(Number(s.credit || 0), { currencyCode: curr.code }) : "—";
        },
        align: "left",
        className: "text-green-600 tabular-nums font-medium text-[11px]"
      });
    });

    return cols;
  }, [currencies, convertFromBase, formatAmount]);

  const filteredColumns = useMemo(() => {
    return columns.filter(col => {
      if (!col.id || col.id === "actions") return true;
      return visibleColumns.includes(col.id);
    });
  }, [columns, visibleColumns]);

  return (
    <DataTable
      data={suppliers}
      columns={filteredColumns}
      loading={loading}
      onRowClick={onView}
      selectedId={selectedId}
      emptyMessage={search ? "لا توجد نتائج بحث تطابق استعلامك" : "قائمة الموردين فارغة حالياً"}
    />
  );
}
