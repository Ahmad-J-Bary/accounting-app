import { queryClient, SETTINGS_MUTATION_KEYS, invalidateKeys } from "@shared/hooks/queryClient";

/**
 * Broadcast a settings change: refresh React Query consumers of settings /
 * currency context AND notify legacy `window` listeners (TopBar) that keep a
 * local copy. Call after any settings save (company, localization, warehouses,
 * currencies, backup location).
 */
export function publishSettingsUpdated() {
  void invalidateKeys(queryClient, SETTINGS_MUTATION_KEYS);
  window.dispatchEvent(new CustomEvent("erp:settings-updated"));
}