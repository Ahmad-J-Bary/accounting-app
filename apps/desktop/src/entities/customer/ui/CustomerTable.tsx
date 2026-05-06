import { useMemo } from "react";
import { DataTable, Column } from "@/components/erp/shared/DataTable";
import { TableActions } from "@/components/erp/shared/TableActions";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { useCurrencyContext } from "@/context/CurrencyContext";
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
  const { formatAmount } = useCurrencyContext();
  const columns = useMemo<Column<CustomerDto>[]>(() => [
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
    { 
      id: "debit",
      header: "المدين (عليه)", 
      accessor: (c) => Number(c.debit) > 0 ? formatAmount(Number(c.debit)) : "—", 
      align: "left", 
      className: "text-red-600 tabular-nums font-medium" 
    },
    { 
      id: "credit",
      header: "الدائن (له)", 
      accessor: (c) => Number(c.credit) > 0 ? formatAmount(Number(c.credit)) : "—", 
      align: "left", 
      className: "text-green-600 tabular-nums font-medium" 
    },
    { 
      id: "balance",
      header: "الرصيد النهائي", 
      accessor: (c) => formatAmount(Number(c.balance || 0)), 
      align: "left", 
      className: "font-bold tabular-nums text-slate-900" 
    },
    { 
      id: "status",
      header: "الحالة", 
      accessor: (c) => <StatusBadge status={c.is_active ? "active" : "inactive"} />, 
      align: "center",
      className: "w-[100px]"
    },
    {
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
    }
  ], [onView, onEdit, onDelete, formatAmount]);

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
