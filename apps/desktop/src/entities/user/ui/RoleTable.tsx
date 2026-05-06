import { useMemo } from "react";
import { DataTable, Column } from "@/components/erp/shared/DataTable";
import { TableActions } from "@/components/erp/shared/TableActions";
import type { Role } from "@erp/shared-types";
import { Shield, ShieldAlert, ShieldCheck } from "lucide-react";

interface RoleTableProps {
  roles: Role[];
  loading: boolean;
  onEdit?: (role: Role) => void;
  onDelete?: (id: string) => void;
}

export function RoleTable({ roles, loading, onEdit, onDelete }: RoleTableProps) {
  const columns = useMemo<Column<Role>[]>(() => [
    { 
      header: "اسم الصلاحية", 
      accessor: "name", 
      className: "font-bold text-slate-800" 
    },
    { 
      header: "الوصف", 
      accessor: (r) => r.description || "—",
      className: "text-slate-500 text-sm max-w-[250px] truncate" 
    },
    { 
      header: "عدد الأذونات", 
      accessor: (r) => (
        <div className="flex items-center gap-2">
          <Shield className="w-3 h-3 text-primary" />
          <span className="font-bold tabular-nums text-primary">{r.permissions.length}</span>
        </div>
      ),
      align: "center"
    },
    { 
      header: "نوع النظام", 
      accessor: (r) => r.is_system_role ? (
        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-bold ring-1 ring-amber-100">
          <ShieldAlert className="w-3 h-3" /> نظامي
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 bg-slate-50 text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-medium ring-1 ring-slate-100">
           مخصص
        </span>
      ),
      align: "center"
    },
    {
      header: "إجراءات",
      accessor: (r) => (
        <TableActions 
          onEdit={() => onEdit?.(r)}
          onDelete={r.is_system_role ? undefined : () => onDelete?.(r.id)}
        />
      ),
      align: "left",
      className: "w-16"
    }
  ], [onEdit, onDelete]);

  return (
    <DataTable
      data={roles}
      columns={columns}
      loading={loading}
      emptyMessage="لا توجد أدوار مضافة"
    />
  );
}
