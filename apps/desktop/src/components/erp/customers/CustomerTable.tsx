import { useMemo } from "react";
import { DataTable, Column } from "@/components/erp/shared/DataTable";
import { TableActions } from "@/components/erp/shared/TableActions";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { formatCurrency } from "@/lib/format";
import type { CustomerDto } from "@erp/shared-types";

interface CustomerTableProps {
  customers: CustomerDto[];
  loading: boolean;
  search: string;
  onView: (id: string) => void;
  onEdit: (c: CustomerDto) => void;
  onDelete: (id: string, name: string) => void;
}

export function CustomerTable({ customers, loading, search, onView, onEdit, onDelete }: CustomerTableProps) {
  const columns = useMemo<Column<CustomerDto>[]>(() => [
    { 
      header: "اسم العميل", 
      accessor: "name", 
      className: "font-bold text-slate-800" 
    },
    { 
      header: "رقم الهاتف", 
      accessor: (c) => c.phone || "—", 
      className: "tabular-nums text-slate-500" 
    },
    { 
      header: "المدين", 
      accessor: (c) => formatCurrency(Number(c.debit || 0)), 
      align: "left", 
      className: "text-red-600 tabular-nums font-medium" 
    },
    { 
      header: "الدائن", 
      accessor: (c) => formatCurrency(Number(c.credit || 0)), 
      align: "left", 
      className: "text-green-600 tabular-nums font-medium" 
    },
    { 
      header: "الرصيد النهائي", 
      accessor: (c) => formatCurrency(Number(c.balance || 0)), 
      align: "left", 
      className: "font-bold tabular-nums text-slate-900" 
    },
    { 
      header: "الحالة", 
      accessor: (c) => <StatusBadge status={c.is_active ? "active" : "inactive"} />, 
      align: "center",
      className: "w-[100px]"
    },
    {
      header: "إجراءات",
      accessor: (c) => (
        <TableActions 
          onView={() => onView(c.id)}
          onEdit={() => onEdit(c)}
          onDelete={() => onDelete(c.id, c.name)}
        />
      ),
      align: "left",
      className: "w-16"
    }
  ], [onView, onEdit, onDelete]);

  return (
    <DataTable
      data={customers}
      columns={columns}
      loading={loading}
      onRowClick={(c) => onView(c.id)}
      emptyMessage={search ? "لا توجد نتائج بحث تطابق استعلامك" : "لا يوجد عملاء مسجلون في النظام حالياً"}
    />
  );
}
