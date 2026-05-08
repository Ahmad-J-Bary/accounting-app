import { useMemo } from "react";
import { DataTable, Column } from '@widgets/table-shell/DataTable';
import { TableActions } from '@widgets/table-shell/TableActions';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import type { CustomerDto } from "@erp/shared-types";

interface CustomerTableProps {
  customers: CustomerDto[];
  loading: boolean;
  search: string;
  visibleColumns: string[];
  onView: (c: CustomerDto) => void;
  onEdit: (c: CustomerDto) => void;
  onDelete: (id: string, name: string) => void;
  selectedId?: string | null;
}

export function CustomerTable({ customers, loading, search, visibleColumns, onView, onEdit, onDelete, selectedId }: CustomerTableProps) {
  const { currencies, convertFromBase, formatAmount } = useCurrencyContext();

  const columns = useMemo<Column<CustomerDto>[]>(() => {
    const cols: Column<CustomerDto>[] = [
      { 
        id: "name",
        header: "اسم العميل", 
        accessor: "name", 
        className: "font-bold text-slate-800" 
      },
      { 
        id: "phone",
        header: "رقم الهاتف", 
        accessor: (c) => c.phone || "—", 
        className: "tabular-nums text-slate-500" 
      },
    ];

    // Grouping by Type using symbols instead of codes
    
    // 1. Debits
    currencies.forEach(curr => {
      const symbol = curr.symbol || curr.code;
      cols.push({
        id: `debit_${curr.code}`,
        header: `مدين (${symbol})`,
        accessor: (c) => {
          const val = convertFromBase(Number(c.debit || 0), curr.code);
          return val > 0 ? formatAmount(Number(c.debit || 0), { currencyCode: curr.code }) : "—";
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
        accessor: (c) => {
          const val = convertFromBase(Number(c.credit || 0), curr.code);
          return val > 0 ? formatAmount(Number(c.credit || 0), { currencyCode: curr.code }) : "—";
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
        accessor: (c) => {
          return formatAmount(Number(c.balance || 0), { currencyCode: curr.code });
        },
        align: "left",
        className: "font-bold tabular-nums text-slate-900 text-[12px]"
      });
    });

    cols.push({
      id: "actions",
      header: "إجراءات",
      accessor: (c) => (
        <TableActions 
          onView={() => onView(c)}
          onEdit={() => onEdit(c)}
          onDelete={() => onDelete(c.id, c.name)}
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
      data={customers}
      columns={filteredColumns}
      loading={loading}
      onRowClick={onView}
      selectedId={selectedId}
      emptyMessage={search ? "لا توجد نتائج بحث تطابق استعلامك" : "لا يوجد عملاء مسجلون في النظام حالياً"}
    />
  );
}
