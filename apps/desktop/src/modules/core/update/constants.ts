import type { UpdateChannel } from './types';

export const UPDATE_MANIFEST_URL = '';
export const UPDATE_CHECK_INTERVAL_MS = 1000 * 60 * 60 * 6; // 6 hours
export const STORAGE_KEYS = {
  DISMISSED_VERSION: 'erp_update_dismissed_version',
  LAST_KNOWN_GOOD_VERSION: 'erp_last_known_good_version',
  SAVED_APP_STATE: 'erp_app_state_saved'
};
export const DEFAULT_CHANNEL: UpdateChannel = 'stable';
