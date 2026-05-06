import { invoke } from '@/lib/invoke';
import type { AuditLog } from '@erp/shared-types';

export const auditService = {
  async listAuditLogs(limit?: number): Promise<AuditLog[]> {
    return await invoke<AuditLog[]>('list_audit_logs', { limit });
  },
};
