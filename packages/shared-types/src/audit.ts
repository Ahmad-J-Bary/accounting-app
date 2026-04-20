export interface AuditLog {
  id: string;
  user_id?: string;
  username: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  changes?: string;
  ip_address?: string;
  created_at: string;
}
