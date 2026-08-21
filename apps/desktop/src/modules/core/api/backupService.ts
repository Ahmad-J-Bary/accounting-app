import { invoke } from '@shared/lib/invoke';
import { listen } from '@tauri-apps/api/event';

export interface BackupFileInfo {
  name: string;
  path: string;
  size: number;
  label: string;
  timestamp: number;
  backup_type: string;
  sha256: string | null;
  schema_version: number | null;
  app_version: string | null;
  company_scope: string | null;
  status: string | null;
  verified: boolean;
}

export interface BackupConfig {
  use_same_location: boolean;
  custom_path: string | null;
  backup_dir: string;
  keep_daily: number;
  keep_weekly: number;
  keep_monthly: number;
  auto_backup_enabled: boolean;
  last_auto_backup: string | null;
  last_restore_status: string | null;
}

export interface DatabaseInfo {
  db_path: string;
  db_size_bytes: number;
  schema_version: number;
  company_name: string | null;
  journal_entry_count: number;
  account_count: number;
  last_auto_backup: string | null;
  last_restore_status: string | null;
  auto_backup_enabled: boolean;
}

export interface DatabaseInspection {
  schema_version: number;
  supported_version: number;
  newer_than_supported: boolean;
  tables_present: boolean;
  missing_tables: string[];
  integrity_ok: boolean;
  company_scope: string | null;
  size_bytes: number;
  journal_entry_count: number;
  account_count: number;
  created_at: number | null;
  modified_at: number | null;
}

export interface ValidationReport {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface PendingRestoreInfo {
  pending: string;
  source_label: string;
  created_at: string;
}

export type BackupType = 'manual' | 'auto' | 'pre_import';

export type BackupProgressPhase =
  | 'creating'
  | 'verifying'
  | 'exporting'
  | 'snapshotting_original'
  | 'validating'
  | 'copying'
  | 'staged'
  | 'completed'
  | 'failed';

export interface BackupProgressEvent {
  phase: BackupProgressPhase;
}

export interface StartupBlockInfo {
  reason: string;
  found_version: number;
  supported_version: number;
}

export const backupService = {
  async backupNow(): Promise<BackupFileInfo> {
    return await invoke<BackupFileInfo>('backup_database_now');
  },
  async listBackups(): Promise<BackupFileInfo[]> {
    return await invoke<BackupFileInfo[]>('list_backups');
  },
  async getConfig(): Promise<BackupConfig> {
    return await invoke<BackupConfig>('get_backup_config');
  },
  async getDatabaseInfo(): Promise<DatabaseInfo> {
    return await invoke<DatabaseInfo>('get_database_info');
  },
  async setConfig(partial: {
    use_same_location?: boolean;
    custom_path?: string;
    keep_daily?: number;
    keep_weekly?: number;
    keep_monthly?: number;
    auto_backup_enabled?: boolean;
  }): Promise<BackupConfig> {
    return await invoke<BackupConfig>('set_backup_config', {
      useSameLocation: partial.use_same_location,
      customPath: partial.custom_path,
      keepDaily: partial.keep_daily,
      keepWeekly: partial.keep_weekly,
      keepMonthly: partial.keep_monthly,
      autoBackupEnabled: partial.auto_backup_enabled,
    });
  },
  async applyRetention(): Promise<{ removed: string[] }> {
    return await invoke<{ removed: string[] }>('apply_backup_retention');
  },
  async inspectBackupFile(sourcePath: string): Promise<DatabaseInspection> {
    return await invoke<DatabaseInspection>('inspect_database_file', { sourcePath });
  },
  async exportToBytes(): Promise<number[]> {
    return await invoke<number[]>('export_database_to_bytes');
  },
  async exportToFile(destPath: string): Promise<void> {
    return await invoke<void>('export_database', { destPath });
  },
  async importFromFile(sourcePath: string): Promise<{ pending: string; auto_backup: string; report?: ValidationReport }> {
    return await invoke<{ pending: string; auto_backup: string; report?: ValidationReport }>('import_database', {
      sourcePath,
    });
  },
  async deleteFileBackup(fileName: string): Promise<void> {
    return await invoke<void>('delete_backup_file', { fileName });
  },
  async copyFileBackup(fileName: string, destPath: string): Promise<void> {
    return await invoke<void>('copy_backup_file', { fileName, destPath });
  },
  async openBackupLocation(path: string): Promise<void> {
    return await invoke<void>('open_backup_location', { path });
  },
  async getPendingRestore(): Promise<PendingRestoreInfo | null> {
    return await invoke<PendingRestoreInfo | null>('pending_restore_status');
  },
  async cancelPendingRestore(): Promise<void> {
    return await invoke<void>('cancel_pending_restore');
  },
  async requestRestart(): Promise<{ restarting: boolean }> {
    return await invoke<{ restarting: boolean }>('request_app_restart');
  },
  async getHealth(): Promise<{ status: 'ok' | 'error'; message?: string }> {
    return await invoke<{ status: 'ok' | 'error'; message?: string }>('get_database_health');
  },
  async listenBackupProgress(cb: (e: BackupProgressEvent) => void): Promise<() => void> {
    return await listen<BackupProgressEvent>('backup-progress', (event) => cb(event.payload));
  },
  async listenRestoreRejected(cb: (message: string) => void): Promise<() => void> {
    return await listen<{ message?: string }>('restore-rejected', (event) => {
      const p = event.payload as unknown;
      if (typeof p === "string") cb(p);
      else cb((p as { message?: string })?.message ?? "");
    });
  },
  async getStartupBlock(): Promise<StartupBlockInfo | null> {
    return await invoke<StartupBlockInfo | null>('get_startup_block');
  },
};