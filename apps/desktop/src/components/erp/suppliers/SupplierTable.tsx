import { useMemo } from "react";
import { DataTable, Column } from "@/components/erp/shared/DataTable";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Eye, Edit, Trash2 } from "lucide-react";
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
    { header: "اسم المورد", accessor: "name", className: "font-medium" },
    { header: "الهاتف", accessor: (s) => s.phone || "—", className: "tabular-nums" },
    { header: "المدين", accessor: (s) => formatCurrency(parseFloat(s.debit || "0")), align: "left", className: "tabular-nums text-red-600" },
    { header: "الدائن", accessor: (s) => formatCurrency(parseFloat(s.credit || "0")), align: "left", className: "tabular-nums text-green-600" },
    { header: "الرصيد", accessor: (s) => formatCurrency(parseFloat(s.balance || "0")), align: "left", className: "tabular-nums font-bold" },
    { header: "الحالة", accessor: (s) => <StatusBadge status={s.is_active ? "active" : "inactive"} />, align: "left" },
    {
      header: "",
      accessor: (s) => (
        <div onClick={e => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-right">
              <DropdownMenuItem onClick={() => onView(s)}><Eye className="w-4 h-4 ml-2" />عرض الملف</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(s)}><Edit className="w-4 h-4 ml-2" />تعديل</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete(s.id, s.name)} className="text-red-600"><Trash2 className="w-4 h-4 ml-2" />حذف</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
      className: "w-12"
    }
  ], [onView, onEdit, onDelete]);

  return (
    <DataTable
      data={suppliers}
      columns={columns}
      loading={loading}
      onRowClick={onView}
      emptyMessage={search ? "لا توجد نتائج للبحث" : "لا يوجد موردون — أضف مورداً جديداً"}
    />
  );
}
