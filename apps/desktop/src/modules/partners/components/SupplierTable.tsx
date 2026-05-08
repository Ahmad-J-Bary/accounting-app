import { useMemo } from "react";
import { DataTable, Column } from '@widgets/table-shell/DataTable';
import { TableActions } from '@widgets/table-shell/TableActions';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import type { SupplierDto } from "@erp/shared-types";

interface SupplierTableProps {
  suppliers: SupplierDto[];
  loading: boolean;
  search: string;
  visibleColumns: string[];
  onView: (s: SupplierDto) => void;
  onEdit: (s: SupplierDto) => void;
  onDelete: (id: string, name: string) => void;
  selectedId?: string | null;
}

export function SupplierTable({ suppliers, loading, search, visibleColumns, onView, onEdit, onDelete, selectedId }: SupplierTableProps) {
  const { currencies, convertFromBase, formatAmount } = useCurrencyContext();

  const columns = useMemo<Column<SupplierDto>[]>(() => {
    const cols: Column<SupplierDto>[] = [
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

    // 3. Balances
    currencies.forEach(curr => {
      const symbol = curr.symbol || curr.code;
      cols.push({
        id: `balance_${curr.code}`,
        header: `رصيد (${symbol})`,
        accessor: (s) => {
          return formatAmount(Number(s.balance || 0), { currencyCode: curr.code });
        },
        align: "left",
        className: "font-bold tabular-nums text-slate-900 text-[12px]"
      });
    });

    cols.push({
      id: "actions",
      header: "إجراءات",
      accessor: (s) => (
        <TableActions 
          onView={() => onView(s)}
          onEdit={() => onEdit(s)}
          onDelete={() => onDelete(s.id, s.name)}
        />
      ),
      align: "left",
      className: "w-16"
    });

    return cols;
  }, [currencies, convertFromBase, formatAmount, onView, onEdit, onDelete]);

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
