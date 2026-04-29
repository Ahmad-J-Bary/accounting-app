import { useMemo } from "react";
import { DataTable, Column } from "@/components/erp/shared/DataTable";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Eye, Edit, Trash2 } from "lucide-react";
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
    { header: "الاسم", accessor: "name", className: "font-semibold" },
    { header: "الهاتف", accessor: (c) => c.phone || "—", className: "tabular-nums" },
    { header: "المدين", accessor: (c) => formatCurrency(Number(c.debit || 0)), align: "left", className: "text-red-600 tabular-nums" },
    { header: "الدائن", accessor: (c) => formatCurrency(Number(c.credit || 0)), align: "left", className: "text-green-600 tabular-nums" },
    { header: "الرصيد", accessor: (c) => formatCurrency(Number(c.balance || 0)), align: "left", className: "font-bold tabular-nums" },
    { header: "الحالة", accessor: (c) => <StatusBadge status={c.is_active ? "active" : "inactive"} />, align: "left" },
    {
      header: "",
      accessor: (c) => (
        <div onClick={e => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-right">
              <DropdownMenuItem onClick={() => onView(c.id)}><Eye className="w-4 h-4 ml-2" />عرض الملف</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(c)}><Edit className="w-4 h-4 ml-2" />تعديل</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete(c.id, c.name)} className="text-red-600"><Trash2 className="w-4 h-4 ml-2" />حذف</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
      className: "w-12"
    }
  ], [onView, onEdit, onDelete]);

  return (
    <DataTable
      data={customers}
      columns={columns}
      loading={loading}
      onRowClick={(c) => onView(c.id)}
      emptyMessage={search ? "لا توجد نتائج" : "لا يوجد عملاء مضافون"}
    />
  );
}
