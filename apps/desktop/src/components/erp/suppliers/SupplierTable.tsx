import { useMemo } from "react";
import { DataTable, Column } from "@/components/erp/shared/DataTable";
import { TableActions } from "@/components/erp/shared/TableActions";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { formatCurrency } from "@/lib/format";
import type { SupplierDto } from "@erp/shared-types";

interface SupplierTableProps {
  suppliers: SupplierDto[];
  loading: boolean;
  search: string;
  onView: (s: SupplierDto) => void;
  onEdit: (s: SupplierDto) => void;
  onDelete: (id: string, name: string) => void;
}

export function SupplierTable({ suppliers, loading, search, onView, onEdit, onDelete }: SupplierTableProps) {
  const columns = useMemo<Column<SupplierDto>[]>(() => [
    { 
      header: "اسم المورد", 
      accessor: "name", 
      className: "font-bold text-slate-800" 
    },
    { 
      header: "رقم الهاتف", 
      accessor: (s) => s.phone || "—", 
      className: "tabular-nums text-slate-500" 
    },
    { 
      header: "المدين (عليه)", 
      accessor: (s) => parseFloat(s.debit || "0") > 0 ? formatCurrency(parseFloat(s.debit || "0")) : "—", 
      align: "left", 
      className: "tabular-nums text-red-600 font-medium" 
    },
    { 
      header: "الدائن (له)", 
      accessor: (s) => parseFloat(s.credit || "0") > 0 ? formatCurrency(parseFloat(s.credit || "0")) : "—", 
      align: "left", 
      className: "tabular-nums text-green-600 font-medium" 
    },
    { 
      header: "الرصيد النهائي", 
      accessor: (s) => formatCurrency(parseFloat(s.balance || "0")), 
      align: "left", 
      className: "tabular-nums font-bold text-slate-900" 
    },
    { 
      header: "الحالة", 
      accessor: (s) => <StatusBadge status={s.is_active ? "active" : "inactive"} />, 
      align: "center",
      className: "w-[100px]"
    },
    {
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
    }
  ], [onView, onEdit, onDelete]);

  return (
    <DataTable
      data={suppliers}
      columns={columns}
      loading={loading}
      onRowClick={onView}
      emptyMessage={search ? "لا توجد نتائج بحث تطابق استعلامك" : "قائمة الموردين فارغة حالياً"}
    />
  );
}
