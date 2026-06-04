import { useMemo } from "react";
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import type { Role } from "@erp/shared-types";
import { Shield, ShieldAlert, MoreHorizontal, Edit, Trash2 } from "lucide-react";
import { Button } from "@shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@shared/ui/dropdown-menu";

interface RoleTableProps {
  roles: Role[];
  loading: boolean;
  onEdit?: (role: Role) => void;
  onDelete?: (id: string) => void;
}

export function RoleTable({ roles, loading, onEdit, onDelete }: RoleTableProps) {
  const columns = useMemo<UnifiedColumn<Role>[]>(() => [
    { 
      id: "name",
      header: "اسم الصلاحية", 
      label: "اسم الصلاحية/الدور", 
      accessor: "name", 
      className: "font-bold text-slate-800" 
    },
    { 
      id: "description",
      header: "الوصف", 
      label: "الوصف", 
      accessor: (r) => r.description || "—",
      className: "text-slate-500 text-sm max-w-[250px] truncate" 
    },
    { 
      id: "permissions_count",
      header: "عدد الأذونات", 
      label: "عدد الصلاحيات الممنوحة", 
      accessor: (r) => (
        <div className="flex items-center gap-2">
          <Shield className="w-3 h-3 text-blue-600" />
          <span className="font-bold tabular-nums text-blue-600">{r.permissions.length}</span>
        </div>
      ),
      align: "center",
      className: ""
    },
    { 
      id: "is_system_role",
      header: "نوع النظام", 
      label: "نوع الدور (نظامي/مخصص)", 
      accessor: (r) => r.is_system_role ? (
        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-bold ring-1 ring-amber-100">
          <ShieldAlert className="w-3 h-3" /> نظامي
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 bg-slate-50 text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-medium ring-1 ring-slate-100">
           مخصص
        </span>
      ),
      align: "center",
      className: ""
    },
    {
      id: "actions",
      header: "إجراءات",
      label: "إجراءات",
      accessor: (r) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            <DropdownMenuItem onClick={() => onEdit?.(r)} className="flex-row-reverse gap-2 text-blue-600 focus:text-blue-600">
              <Edit className="w-4 h-4" /> تعديل
            </DropdownMenuItem>
            {!r.is_system_role && (
              <DropdownMenuItem onClick={() => onDelete?.(r.id)} className="flex-row-reverse gap-2 text-rose-600 focus:text-rose-600">
                <Trash2 className="w-4 h-4" /> حذف
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      align: "center",
      className: "w-[80px]"
    }
  ], [onEdit, onDelete]);

  return (
    <UnifiedTable
      data={roles}
      columns={columns}
      loading={loading}
      enableResize
      tableId="roles"
      emptyMessage="لا توجد أدوار مضافة"
    />
  );
}
