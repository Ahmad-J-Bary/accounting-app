import { useMemo } from "react";
import { formatDateTime } from '@shared/lib/format';
import { StatusBadge } from '@widgets/stats/StatusBadge';
import { toast } from "sonner";
import type { User, Role } from "@erp/shared-types";
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { TableShell } from '@widgets/table-shell/TableShell';
import { TableActions } from '@widgets/table-shell/TableActions';
import { useUnifiedColumns, useSortable } from '@shared/hooks';
import { useLocalization } from '@app/providers/LocalizationProvider';

interface UsersTableProps {
  data: User[];
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
  roles: Role[];
}

export function UsersTable({ data, loading, search, onSearchChange, roles }: UsersTableProps) {
  const { t } = useLocalization();
  const columns = useMemo<UnifiedColumn<User>[]>(() => [
    {
      id: "full_name",
      header: t("columns.fullName", { namespace: "users",  }),
      label: t("columns.fullName", { namespace: "users",  }),
      accessor: "full_name",
      className: "font-bold text-slate-800"
    },
    {
      id: "username",
      header: t("columns.username", { namespace: "users",  }),
      label: t("columns.username", { namespace: "users",  }),
      accessor: "username",
      className: "font-mono font-medium text-slate-500"
    },
    {
      id: "role",
      header: t("columns.role", { namespace: "users",  }),
      label: t("columns.roleLabel", { namespace: "users",  }),
      accessor: (u) => {
        const role = roles.find(r => r.id === u.role_id);
        return (
          <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
            {role?.name ?? u.role_name ?? t("columns.unspecified", { namespace: "users",  })}
          </span>
        );
      },
    },
    {
      id: "last_login",
      header: t("columns.lastSeen", { namespace: "users",  }),
      label: t("columns.lastSeenLabel", { namespace: "users",  }),
      accessor: (u) => u.last_login ? formatDateTime(u.last_login) : "",
      className: "text-slate-500 tabular-nums"
    },
    {
      id: "status",
      header: t("columns.status", { namespace: "users",  }),
      label: t("columns.statusLabel", { namespace: "users",  }),
      accessor: (u) => <StatusBadge status={u.is_active ? "active" : "inactive"} />,
    },
    {
      id: "actions",
      header: t("columns.actions", { namespace: "users",  }),
      label: t("columns.actions", { namespace: "users",  }),
      accessor: () => (
        <TableActions
          onEdit={() => toast.info(t("toasts.editDevelopment", { namespace: "users",  }))}
          onDelete={() => toast.warning(t("toasts.deleteDevelopment", { namespace: "users",  }))}
        />
      ),
    }
  ], [roles, t]);

  type SortField = "full_name" | "username" | "role" | "last_login" | "status";

  const { sortedData, sortField, sortDirection, handleSort } = useSortable({
    data,
    defaultField: "full_name" as SortField,
    sortFn: (a, b, field, direction) => {
      let comparison = 0;
      switch (field) {
        case "full_name":
          comparison = (a.full_name || "").localeCompare(b.full_name || "", "ar");
          break;
        case "username":
          comparison = (a.username || "").localeCompare(b.username || "", "ar");
          break;
        case "role": {
          const roleA = roles.find(r => r.id === a.role_id)?.name ?? a.role_name ?? "";
          const roleB = roles.find(r => r.id === b.role_id)?.name ?? b.role_name ?? "";
          comparison = roleA.localeCompare(roleB, "ar");
          break;
        }
        case "last_login": {
          const timeA = a.last_login ? new Date(a.last_login).getTime() : 0;
          const timeB = b.last_login ? new Date(b.last_login).getTime() : 0;
          comparison = timeA - timeB;
          break;
        }
        case "status":
          comparison = (a.is_active ? 1 : 0) - (b.is_active ? 1 : 0);
          break;
      }
      return direction === "asc" ? comparison : -comparison;
    }
  });

  const { enrichedColumns, toolbarColumns, toggleColumn, resetToDefault, isModified } = useUnifiedColumns({
    tableId: "users-unified",
    columns,
    defaultVisible: columns.map(c => c.id),
  });

  return (
    <TableShell
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder={t("searchPlaceholder", { namespace: "users",  })}
      columns={toolbarColumns}
      onColumnToggle={toggleColumn}
      onColumnsReset={resetToDefault}
      columnsModified={isModified}
      showToolbar={true}
    >
      <UnifiedTable
        data={sortedData}
        columns={enrichedColumns}
        loading={loading}
        enableResize
        tableId="users"
        sortField={sortField}
        sortDirection={sortDirection}
        onHeaderClick={(col) => {
          const sortableFields: SortField[] = ["full_name", "username", "role", "last_login", "status"];
          if (sortableFields.includes(col.id as SortField)) {
            handleSort(col.id as SortField);
          }
        }}
        emptyMessage={search ? t("empty.searchResults", { namespace: "users",  }) : t("empty.noUsers", { namespace: "users",  })}
      />
    </TableShell>
  );
}
