import { useState, useEffect } from "react";

import { auditService } from '@modules/audit/api/auditService';
import type { AuditLog } from "@erp/shared-types";
import { AuditTable } from '@modules/audit/components/AuditTable';
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { useLocalization } from "@app/providers/LocalizationProvider";

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { t } = useLocalization();

  const load = async () => {
    setLoading(true);
    try { setLogs(await auditService.listAuditLogs(500)); }
    catch { /* errors handled silently */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <OperationalTableTemplate
      title={t("nav.audit-log", { namespace: "shell" })}
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
