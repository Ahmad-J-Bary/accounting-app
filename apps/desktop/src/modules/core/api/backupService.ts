import { invoke } from '@shared/lib/invoke';

export interface BackupFileInfo {
  name: string;
  path: string;
  size: number;
  label: string;
  timestamp: number;
}

export interface BackupConfig {
  use_same_location: boolean;
  custom_path: string | null;
  backup_dir: string;
  retention_days: number;
  auto_backup_enabled: boolean;
  last_auto_backup: string | null;
}

export interface PendingRestoreInfo {
  pending: string;
  source_label: string;
  created_at: string;
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
  async setConfig(partial: {
    use_same_location?: boolean;
    custom_path?: string;
    retention_days?: number;
    auto_backup_enabled?: boolean;
  }): Promise<BackupConfig> {
    return await invoke<BackupConfig>('set_backup_config', partial);
  },
  async exportToBytes(): Promise<number[]> {
    return await invoke<number[]>('export_database_to_bytes');
  },
  async exportToFile(destPath: string): Promise<void> {
    return await invoke<void>('export_database', { destPath });
  },
  async importFromFile(sourcePath: string): Promise<{ pending: string; auto_backup: string }> {
    return await invoke<{ pending: string; auto_backup: string }>('import_database', {
      sourcePath,
    });
  },
  async deleteFileBackup(fileName: string): Promise<void> {
    return await invoke<void>('delete_backup_file', { file_name: fileName });
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
};