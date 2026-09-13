import { useMemo } from "react";
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import type { Role } from "@erp/shared-types";
import { Shield, ShieldAlert } from "lucide-react";
import { useUnifiedColumns, useSortable } from "@shared/hooks";
import { useLocalization } from '@app/providers/LocalizationProvider';
import { TableActions } from "@widgets/table-shell/TableActions";

interface RoleTableProps {
  roles: Role[];
  loading: boolean;
  onEdit?: (role: Role) => void;
  onDelete?: (id: string) => void;
}

export function RoleTable({ roles, loading, onEdit, onDelete }: RoleTableProps) {
  const { t } = useLocalization();
  const columns = useMemo<UnifiedColumn<Role>[]>(() => [
    {
      id: "name",
      header: t("users.columns.roleName", { namespace: "users",  }),
      label: t("users.columns.roleNameLabel", { namespace: "users",  }),
      accessor: "name",
      className: "font-bold text-slate-800"
    },
    {
      id: "description",
      header: t("users.columns.description", { namespace: "users",  }),
      label: t("users.columns.description", { namespace: "users",  }),
      accessor: (r) => r.description || "",
      className: "text-slate-500"
    },
    {
      id: "permissions_count",
      header: t("users.columns.permissionsCount", { namespace: "users",  }),
      label: t("users.columns.permissionsCountLabel", { namespace: "users",  }),
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
      header: t("users.columns.roleType", { namespace: "users",  }),
      label: t("users.columns.roleTypeLabel", { namespace: "users",  }),
      accessor: (r) => r.is_system_role ? (
        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-bold ring-1 ring-amber-100">
          <ShieldAlert className="w-3 h-3" /> {t("users.roleType.system", { namespace: "users",  })}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 bg-slate-50 text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-medium ring-1 ring-slate-100">
           {t("users.roleType.custom", { namespace: "users",  })}
        </span>
      ),
      className: ""
    },
    {
      id: "actions",
      header: t("users.columns.actions", { namespace: "users",  }),
      label: t("users.columns.actions", { namespace: "users",  }),
      accessor: (r) => (
        <TableActions
          onEdit={onEdit ? () => onEdit(r) : undefined}
          onDelete={!r.is_system_role && onDelete ? () => onDelete(r.id) : undefined}
          align="start"
        />
      ),
    }
  ], [onEdit, onDelete, t]);

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
      emptyMessage={t("users.empty.noRoles", { namespace: "users",  })}
    />
  );
}
