import { useState, useEffect, useMemo } from "react";
import { Card } from "@shared/ui/card";
import { Activity, Shield } from "lucide-react";
import { formatDateTime } from '@shared/lib/format';
import { auditService } from '@modules/core/api/auditService';
import type { AuditLog } from "@erp/shared-types";
import { UnifiedTable, type UnifiedColumn } from "@widgets/table-shell/UnifiedTable";
import { TableShell } from "@widgets/table-shell/TableShell";
import { useUnifiedColumns } from "@shared/hooks";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try { setLogs(await auditService.listAuditLogs(500)); }
    catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = logs.filter(l =>
    l.username.toLowerCase().includes(search.toLowerCase()) || 
    l.action.toLowerCase().includes(search.toLowerCase()) || 
    l.entity_type.toLowerCase().includes(search.toLowerCase()) ||
    (l.entity_id ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const allColumns = useMemo<UnifiedColumn<AuditLog>[]>(() => [
    {
      id: "created_at",
      header: "التاريخ والوقت",
      label: "تاريخ ووقت العملية",
      accessor: (l) => formatDateTime(l.created_at),
      className: "w-44 tabular-nums text-slate-500 text-xs"
    },
    {
      id: "username",
      header: "المستخدم",
      label: "اسم المستخدم",
      accessor: (l) => (
        <span className="font-bold text-slate-700">{l.username}</span>
      ),
      className: "w-32"
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
      className: "w-24"
    },
    {
      id: "entity_type",
      header: "نوع الكيان",
      label: "نوع الكيان المتأثر",
      accessor: "entity_type",
      className: "w-32 text-slate-600"
    },
    {
      id: "entity_id",
      header: "معرف الكيان",
      label: "المعرف الفريد للكيان",
      accessor: (l) => l.entity_id || "—",
      className: "font-mono text-[10px] text-slate-400"
    },
    {
      id: "ip_address",
      header: "IP Address",
      label: "عنوان IP",
      accessor: (l) => l.ip_address || "—",
      align: "left",
      className: "font-mono text-[10px] text-slate-400 w-32"
    }
  ], []);

  const { enrichedColumns, toolbarColumns, toggleColumn } = useUnifiedColumns({
    tableId: "audit-log-unified",
    columns: allColumns,
    defaultVisible: allColumns.map(c => c.id),
  });

  return (
    <OperationalTableTemplate
      title="سجل مراقبة النظام"
      stats={[
        { label: "إجمالي العمليات", value: logs.length, icon: Activity, color: "text-blue-600" },
        { label: "حالة الأمان", value: "نشط", icon: Shield, color: "text-emerald-600" }
      ]}
      tableContent={
        <TableShell
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="بحث بالمستخدم، العملية، الكيان..."
          columns={toolbarColumns}
          onColumnToggle={toggleColumn}
        >
          <UnifiedTable
            data={filtered}
            columns={enrichedColumns}
            loading={loading}
            emptyMessage="لا توجد سجلات مراقبة حالياً"
          />
        </TableShell>
      }
    />
  );
}
