import { useMemo } from "react";
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import type { Role } from "@erp/shared-types";
import { Shield, ShieldAlert } from "lucide-react";
import { useUnifiedColumns, useSortable } from "@shared/hooks";
import { TableActions } from "@widgets/table-shell/TableActions";

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
      className: ""
    },
    {
      id: "actions",
      header: "إجراءات",
      label: "إجراءات",
      accessor: (r) => (
        <TableActions
          onEdit={onEdit ? () => onEdit(r) : undefined}
          onDelete={!r.is_system_role && onDelete ? () => onDelete(r.id) : undefined}
          align="start"
        />
      ),
      className: "w-[80px]"
    }
  ], [onEdit, onDelete]);

  type SortField = "name" | "permissions_count" | "is_system_role";

  const { sortedData, sortField, sortDirection, handleSort } = useSortable({
    data: roles,
    defaultField: "name" as SortField,
    sortFn: (a, b, field, direction) => {
      let comparison = 0;
      switch (field) {
        case "name":
          comparison = (a.name || "").localeCompare(b.name || "", "ar");
          break;
        case "permissions_count":
          comparison = a.permissions.length - b.permissions.length;
          break;
        case "is_system_role":
          comparison = (a.is_system_role ? 1 : 0) - (b.is_system_role ? 1 : 0);
          break;
      }
      return direction === "asc" ? comparison : -comparison;
    }
  });

  const { enrichedColumns } = useUnifiedColumns({
    tableId: "roles-unified",
    columns,
    defaultVisible: columns.map(c => c.id),
  });

  return (
    <UnifiedTable
      data={sortedData}
      columns={enrichedColumns}
      loading={loading}
      enableResize
      tableId="roles"
      sortField={sortField}
      sortDirection={sortDirection}
      onHeaderClick={(col) => {
        const sortableFields: SortField[] = ["name", "permissions_count", "is_system_role"];
        if (sortableFields.includes(col.id as SortField)) {
          handleSort(col.id as SortField);
        }
      }}
      emptyMessage="لا توجد أدوار مضافة"
    />
  );
}
