import { useMemo } from "react";
import { DataTable, Column } from '@widgets/table-shell/DataTable';
import { TableActions } from '@widgets/table-shell/TableActions';
import { StatusBadge } from '@widgets/stats/StatusBadge';
import { useCurrencyContext } from "@app/providers/CurrencyProvider";
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
  const { formatAmount } = useCurrencyContext();
  const columns = useMemo<Column<SupplierDto>[]>(() => [
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
    { 
      id: "debit",
      header: "المدين (عليه)", 
      accessor: (s) => parseFloat(s.debit || "0") > 0 ? formatAmount(parseFloat(s.debit || "0")) : "—", 
      align: "left", 
      className: "tabular-nums text-red-600 font-medium" 
    },
    { 
      id: "credit",
      header: "الدائن (له)", 
      accessor: (s) => parseFloat(s.credit || "0") > 0 ? formatAmount(parseFloat(s.credit || "0")) : "—", 
      align: "left", 
      className: "tabular-nums text-green-600 font-medium" 
    },
    { 
      id: "balance",
      header: "الرصيد النهائي", 
      accessor: (s) => formatAmount(parseFloat(s.balance || "0")), 
      align: "left", 
      className: "tabular-nums font-bold text-slate-900" 
    },
    { 
      id: "status",
      header: "الحالة", 
      accessor: (s) => <StatusBadge status={s.is_active ? "active" : "inactive"} />, 
      align: "center",
      className: "w-[100px]"
    },
    {
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
      data={suppliers}
      columns={filteredColumns}
      loading={loading}
      onRowClick={onView}
      selectedId={selectedId}
      emptyMessage={search ? "لا توجد نتائج بحث تطابق استعلامك" : "قائمة الموردين فارغة حالياً"}
    />
  );
}
