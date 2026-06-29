import { useState, useEffect } from "react";

import { auditService } from '@modules/core/api/auditService';
import type { AuditLog } from "@erp/shared-types";
import { AuditTable } from '@modules/core/components/AuditTable';
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

  return (
    <OperationalTableTemplate
      title="سجل مراقبة النظام"
      tableContent={
        <AuditTable
          data={logs}
          loading={loading}
          search={search}
          onSearchChange={setSearch}
        />
      }
    />
  );
}
