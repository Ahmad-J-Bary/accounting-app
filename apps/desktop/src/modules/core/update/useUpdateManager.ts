import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { UpdateService } from './UpdateService';
import { UpdateVerification } from './UpdateVerification';
import type { UpdateState, UpdateChannel } from './types';
import { UPDATE_CHECK_INTERVAL_MS, STORAGE_KEYS } from './constants';
import pkg from '../../../../package.json';

const initialState: UpdateState = {
  phase: 'idle',
  manifest: null,
  currentVersion: pkg.version,
  targetVersion: '',
  progress: {
    percentage: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    speed: 0
  },
  error: null,
  updateType: null
};

export function useUpdateManager(channel: UpdateChannel = 'stable') {
  const [state, setState] = useState<UpdateState>(initialState);
  const service = useMemo(() => UpdateService.getInstance(), []);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const downloadStartRef = useRef<number | null>(null);

  const checkForUpdates = useCallback(async () => {
    setState(prev => ({ ...prev, phase: 'checking', error: null }));

    const manifest = await service.fetchManifest(channel);
    const currentVersion = service.getCurrentVersion();

    if (!manifest) {
      setState(prev => ({
        ...prev,
        phase: 'idle',
        error: null
      }));
      return;
    }

    if (service.shouldUpdate(manifest, currentVersion) && !service.isVersionDismissed(manifest.latestVersion)) {
      const updatePath = service.getBestUpdatePath(manifest, currentVersion);
      setState({
        phase: 'available',
        manifest,
        currentVersion,
        targetVersion: manifest.latestVersion,
        progress: {
          percentage: 0,
          downloadedBytes: 0,
          totalBytes: updatePath.size,
          speed: 0
        },
        error: null,
        updateType: updatePath.type
      });
    } else {
      setState(prev => ({ ...prev, phase: 'idle', manifest: null }));
    }
  }, [channel, service]);

  const startUpdate = useCallback(async () => {
    if (state.phase !== 'available' || !state.manifest || !state.updateType) return;

    const updatePath = service.getBestUpdatePath(state.manifest, state.currentVersion);

    setState(prev => ({
      ...prev,
      phase: 'downloading',
      progress: {
        ...prev.progress,
        totalBytes: updatePath.size,
        percentage: 0,
        downloadedBytes: 0
      }
    }));

    downloadStartRef.current = Date.now();
    let unlistenProgress: () => void = () => {};
    let unlistenReady: () => void = () => {};
    let unlistenFailed: () => void = () => {};

    try {
      unlistenProgress = await listen<{
        downloaded: number;
        total: number | null;
      }>('update-progress', (event) => {
        const downloaded = event.payload.downloaded;
        const total = event.payload.total || updatePath.size;
        const elapsed = (Date.now() - (downloadStartRef.current || Date.now())) / 1000;
        const speed = elapsed > 0 ? downloaded / elapsed : 0;

        setState(prev => ({
          ...prev,
          progress: {
            percentage: Math.round((downloaded / total) * 100),
            downloadedBytes: downloaded,
            totalBytes: total,
            speed
          }
        }));
      });

      unlistenReady = await listen('update-ready', () => {
        setState(prev => ({ ...prev, phase: 'ready' }));
      });

      unlistenFailed = await listen<string>('update-failed', (event) => {
        setState(prev => ({
          ...prev,
          phase: 'failed',
          error: event.payload || 'Update failed'
        }));
      });

      await invoke('download_and_prepare_update', {
        url: updatePath.url,
        expectedSha256: updatePath.sha256
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        phase: 'failed',
        error: typeof error === 'string' ? error : 'Update failed'
      }));
    } finally {
      unlistenProgress();
      unlistenReady();
      unlistenFailed();
    }
  }, [state, service]);

  const restartToUpdate = useCallback(async () => {
    if (state.phase !== 'ready') return;

    try {
      await invoke('apply_update_and_restart');
    } catch (error) {
      setState(prev => ({
        ...prev,
        phase: 'failed',
        error: typeof error === 'string' ? error : 'Failed to apply update'
      }));
    }
  }, [state.phase]);

  const dismissUpdate = useCallback(() => {
    if (state.manifest) {
      service.dismissVersion(state.manifest.latestVersion);
      setState(prev => ({ ...prev, phase: 'idle', manifest: null }));
    }
  }, [state.manifest, service]);

  const retry = useCallback(() => {
    if (state.phase === 'failed') {
      checkForUpdates();
    } else if (state.phase === 'ready') {
      restartToUpdate();
    }
  }, [checkForUpdates, state.phase, restartToUpdate]);

  useEffect(() => {
    checkForUpdates();
    intervalRef.current = setInterval(checkForUpdates, UPDATE_CHECK_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [checkForUpdates]);

  return {
    state,
    checkForUpdates,
    startUpdate,
    restartToUpdate,
    dismissUpdate,
    retry
  };
}
