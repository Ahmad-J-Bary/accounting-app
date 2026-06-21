import type { UpdateManifest, UpdateState, UpdateChannel } from './types';
import { UPDATE_MANIFEST_URL, STORAGE_KEYS } from './constants';
import pkg from '../../../../package.json';

export class UpdateService {
  private static instance: UpdateService;

  private constructor() {}

  static getInstance(): UpdateService {
    if (!UpdateService.instance) {
      UpdateService.instance = new UpdateService();
    }
    return UpdateService.instance;
  }

  async fetchManifest(channel: UpdateChannel = 'stable'): Promise<UpdateManifest | null> {
    if (!UPDATE_MANIFEST_URL) return null;
    try {
      const response = await fetch(UPDATE_MANIFEST_URL);
      if (!response.ok) return null;
      const manifest = await response.json();
      return manifest as UpdateManifest;
    } catch {
      return null;
    }
  }

  getCurrentVersion(): string {
    return pkg.version;
  }

  shouldUpdate(manifest: UpdateManifest, currentVersion: string): boolean {
    return manifest.latestVersion !== currentVersion;
  }

  getBestUpdatePath(manifest: UpdateManifest, currentVersion: string): {
    type: 'full' | 'delta';
    url: string;
    sha256: string;
    size: number;
  } {
    const availablePatch = manifest.patches.find(
      (patch) => patch.from === currentVersion && patch.to === manifest.latestVersion
    );

    if (availablePatch) {
      return {
        type: 'delta',
        url: availablePatch.url,
        sha256: availablePatch.sha256,
        size: availablePatch.size
      };
    }

    return {
      type: 'full',
      url: manifest.fullPackage.url,
      sha256: manifest.fullPackage.sha256,
      size: manifest.fullPackage.size
    };
  }

  isVersionDismissed(version: string): boolean {
    const dismissed = localStorage.getItem(STORAGE_KEYS.DISMISSED_VERSION);
    return dismissed === version || dismissed === '__all__';
  }

  dismissVersion(version: string) {
    localStorage.setItem(STORAGE_KEYS.DISMISSED_VERSION, version);
  }

  saveLastKnownGoodVersion(version: string) {
    localStorage.setItem(STORAGE_KEYS.LAST_KNOWN_GOOD_VERSION, version);
  }

  getLastKnownGoodVersion(): string | null {
    return localStorage.getItem(STORAGE_KEYS.LAST_KNOWN_GOOD_VERSION);
  }

  clearDismissed() {
    localStorage.removeItem(STORAGE_KEYS.DISMISSED_VERSION);
  }
}
