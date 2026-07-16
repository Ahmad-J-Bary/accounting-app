import { useState, useEffect } from "react";

import { auditService } from '@modules/audit/api/auditService';
import type { AuditLog } from "@erp/shared-types";
import { AuditTable } from '@modules/audit/components/AuditTable';
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");


  const load = async () => {
    setLoading(true);
    try { setLogs(await auditService.listAuditLogs(500)); }
    catch { /* errors handled silently */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <OperationalTableTemplate
      title="??? ?????? ??????"
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
