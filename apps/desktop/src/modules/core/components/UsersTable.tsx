import { useMemo } from "react";
import { formatDateTime } from '@shared/lib/format';
import { StatusBadge } from '@widgets/stats/StatusBadge';
import { toast } from "sonner";
import type { User, Role } from "@erp/shared-types";
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { TableShell } from '@widgets/table-shell/TableShell';
import { TableActions } from '@widgets/table-shell/TableActions';
import { useUnifiedColumns } from '@shared/hooks';

interface UsersTableProps {
  data: User[];
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
  roles: Role[];
}

export function UsersTable({ data, loading, search, onSearchChange, roles }: UsersTableProps) {
  const columns = useMemo<UnifiedColumn<User>[]>(() => [
    {
      id: "full_name",
      header: "الاسم الكامل",
      label: "الاسم الكامل",
      accessor: "full_name",
      className: "font-bold text-slate-800 min-w-[180px]"
    },
    {
      id: "username",
      header: "اسم المستخدم",
      label: "اسم المستخدم",
      accessor: "username",
      className: "text-slate-500 font-mono text-xs w-32"
    },
    {
      id: "role",
      header: "الصلاحية",
      label: "الدور/الصلاحية",
      accessor: (u) => {
        const role = roles.find(r => r.id === u.role_id);
        return (
          <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
            {role?.name ?? u.role_name ?? "غير محدد"}
          </span>
        );
      },
      className: "w-32"
    },
    {
      id: "last_login",
      header: "آخر ظهور",
      label: "تاريخ آخر دخول",
      accessor: (u) => u.last_login ? formatDateTime(u.last_login) : "—",
      className: "text-xs text-slate-400 tabular-nums w-44"
    },
    {
      id: "status",
      header: "الحالة",
      label: "حالة الحساب",
      accessor: (u) => <StatusBadge status={u.is_active ? "active" : "inactive"} />,
      className: "w-28"
    },
    {
      id: "actions",
      header: "إجراءات",
      label: "إجراءات",
      accessor: (u) => (
        <TableActions
          onEdit={() => toast.info("تعديل المستخدم قيد التطوير")}
          onDelete={() => toast.warning("حذف المستخدم قيد التطوير")}
        />
      ),
      className: "w-[80px]"
    }
  ], [roles]);

  const { enrichedColumns, toolbarColumns, toggleColumn } = useUnifiedColumns({
    tableId: "users-unified",
    columns,
    defaultVisible: columns.map(c => c.id),
  });

  return (
    <TableShell
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="بحث بالاسم أو اسم المستخدم..."
      columns={toolbarColumns}
      onColumnToggle={toggleColumn}
      showToolbar={true}
    >
      <UnifiedTable
        data={data}
        columns={enrichedColumns}
        loading={loading}
        enableResize
        tableId="users"
        emptyMessage={search ? "لا توجد نتائج للبحث" : "لا يوجد مستخدمين مضافين"}
      />
    </TableShell>
  );
}
