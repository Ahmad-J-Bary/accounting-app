import { invoke } from '@tauri-apps/api/core';
import type {
  CompanySettings,
  UpdateSettingsRequest,
} from '@erp/shared-types';

export const settingsService = {
  async getSettings(): Promise<CompanySettings> {
    return await invoke<CompanySettings>('get_settings');
  },

  async updateSettings(request: UpdateSettingsRequest): Promise<CompanySettings> {
    return await invoke<CompanySettings>('update_settings', { request });
  },
};
