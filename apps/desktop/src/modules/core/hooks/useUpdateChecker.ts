import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { updateService, type UpdateInfo } from "../api/updateService";
import pkg from "../../../../package.json";

const CHECK_INTERVAL_MS = 1000 * 60 * 60 * 6; // 6 hours
const STORAGE_KEY = "erp_update_dismissed_version";

export function useUpdateChecker() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState<{ downloaded: number; total: number } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const check = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const info = await updateService.checkForUpdates(pkg.version);
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (info.has_update && info.latest_version !== dismissed) {
        setUpdateInfo(info);
      } else {
        setUpdateInfo(null);
      }
    } catch (e) {
      setError(String(e));
      setUpdateInfo(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const installUpdate = useCallback(async () => {
    if (!updateInfo || !updateInfo.download_url) return;
    setIsUpdating(true);
    setUpdateProgress(null);
    setError(null);
    try {
      const unlisten = await listen<{ downloaded: number; total: number | null }>(
        "update-progress",
        (event) => {
          setUpdateProgress({
            downloaded: event.payload.downloaded,
            total: event.payload.total || 0,
          });
        }
      );

      await invoke("download_and_install_update", { url: updateInfo.download_url });
      
      unlisten();
    } catch (e) {
      setError(String(e));
      setIsUpdating(false);
    }
  }, [updateInfo]);

  const dismiss = useCallback(() => {
    if (updateInfo) {
      localStorage.setItem(STORAGE_KEY, updateInfo.latest_version);
      setUpdateInfo(null);
    }
  }, [updateInfo]);

  const dismissAll = useCallback(() => {
    if (updateInfo) {
      localStorage.setItem(STORAGE_KEY, "__all__");
      setUpdateInfo(null);
    }
  }, [updateInfo]);

  useEffect(() => {
    check();
    intervalRef.current = setInterval(check, CHECK_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [check]);

  return { updateInfo, loading, error, isUpdating, updateProgress, check, installUpdate, dismiss, dismissAll };
}
