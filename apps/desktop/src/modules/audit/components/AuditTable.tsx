import { useMemo } from "react";
import { formatDateTime } from '@shared/lib/format';
import type { AuditLog } from "@erp/shared-types";
import { UnifiedTable, type UnifiedColumn } from "@widgets/table-shell/UnifiedTable";
import { TableShell } from "@widgets/table-shell/TableShell";
import { useUnifiedColumns, useSortable } from "@shared/hooks";

interface AuditTableProps {
  data: AuditLog[];
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
}

export function AuditTable({ data, loading, search, onSearchChange }: AuditTableProps) {
  const allColumns = useMemo<UnifiedColumn<AuditLog>[]>(() => [
    {
      id: "created_at",
      header: "التاريخ والوقت",
      label: "تاريخ ووقت العملية",
      accessor: (l) => formatDateTime(l.created_at),
      className: "tabular-nums text-slate-500"
    },
    {
      id: "username",
      header: "المستخدم",
      label: "اسم المستخدم",
      accessor: (l) => (
        <span className="font-bold text-slate-700">{l.username}</span>
      ),
    },
    {
      id: "action",
      header: "العملية",
      label: "نوع العملية",
      accessor: (l) => (
        <span className="px-2 py-1 rounded bg-blue-50 text-blue-700 font-bold text-[10px] uppercase">
          {l.action}
        </span>
      ),
    },
    {
      id: "entity_type",
      header: "نوع الكيان",
      label: "نوع الكيان المتأثر",
      accessor: "entity_type",
      className: "text-slate-600"
    },
    {
      id: "entity_id",
      header: "معرف الكيان",
      label: "المعرف الفريد للكيان",
      accessor: (l) => l.entity_id || "",
      className: "font-mono text-slate-500"
    },
    {
      id: "ip_address",
      header: "IP Address",
      label: "عنوان IP",
      accessor: (l) => l.ip_address || "",
      className: "font-mono text-slate-500"
    }
  ], []);

  type SortField = "created_at" | "username" | "action" | "entity_type" | "entity_id" | "ip_address";

  const { enrichedColumns, toolbarColumns, toggleColumn, resetToDefault, isModified } = useUnifiedColumns({
    tableId: "audit-log-unified",
    columns: allColumns,
    defaultVisible: allColumns.map(c => c.id),
  });

  const filtered = useMemo(() =>
    data.filter(l =>
      l.username.toLowerCase().includes(search.toLowerCase()) ||
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.entity_type.toLowerCase().includes(search.toLowerCase()) ||
      (l.entity_id ?? "").toLowerCase().includes(search.toLowerCase())
    ),
    [data, search]
  );

  const { sortedData, sortField, sortDirection, handleSort } = useSortable({
    data: filtered,
    defaultField: "created_at" as SortField,
    defaultDirection: "desc",
    sortFn: (a, b, field, direction) => {
      let comparison = 0;
      switch (field) {
        case "created_at":
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case "username":
          comparison = (a.username || "").localeCompare(b.username || "", "ar");
          break;
        case "action":
          comparison = (a.action || "").localeCompare(b.action || "", "ar");
          break;
        case "entity_type":
          comparison = (a.entity_type || "").localeCompare(b.entity_type || "", "ar");
          break;
        case "entity_id":
          comparison = (a.entity_id || "").localeCompare(b.entity_id || "", "ar");
          break;
        case "ip_address":
          comparison = (a.ip_address || "").localeCompare(b.ip_address || "", "ar");
          break;
      }
      return direction === "asc" ? comparison : -comparison;
    }
  });

  return (
    <TableShell
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="بحث بالمستخدم، العملية، الكيان..."
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
        tableId="audit-log"
        sortField={sortField}
        sortDirection={sortDirection}
        onHeaderClick={(col) => {
          const sortableFields: SortField[] = ["created_at", "username", "action", "entity_type", "entity_id", "ip_address"];
          if (sortableFields.includes(col.id as SortField)) {
            handleSort(col.id as SortField);
          }
        }}
        emptyMessage="لا توجد سجلات مراقبة حالياً"
      />
    </TableShell>
  );
}
