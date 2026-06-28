import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { updateService, type UpdateInfo } from "../api/updateService";
import pkg from "../../../../package.json";

const CHECK_INTERVAL_MS = 1000 * 60 * 60 * 6; // 6 hours
const STORAGE_KEY = "erp_update_dismissed_version";

// Define all possible phases of the update process
export type UpdatePhase = "idle" | "available" | "downloading" | "preparing" | "ready" | "failed";

export function useUpdateChecker() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(() => {
    if (import.meta.env.DEV) {
      return {
        has_update: true,
        current_version: pkg.version,
        latest_version: "1.0.0-معاينة",
        release_name: "إصدار المعاينة التطويري",
        release_body: "• تحسينات عامة على واجهة التحديث بأسلوب IDE\n• دعم وضع التحديث غير المزعج وتكامل المكونات\n• دعم التنسيق RTL بالكامل للغة العربية\n• إصلاح مشكلة 403 لمستودع GitHub",
        release_url: "https://github.com/Ahmad-J-Bary/accounting-app",
        download_url: "https://github.com/Ahmad-J-Bary/accounting-app/releases/download/v0.9.2/Almowakeb_0.9.2_x64-setup.exe",
      };
    }
    return null;
  });

  const [phase, setPhase] = useState<UpdatePhase>(() => {
    if (import.meta.env.DEV) {
      return "available";
    }
    return "idle";
  });

  const [error, setError] = useState<string | null>(null);
  const [updateProgress, setUpdateProgress] = useState<{ downloaded: number; total: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const check = useCallback(async () => {
    if (import.meta.env.DEV) {
      // Use instant synchronous mock state in dev mode
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const info = await updateService.checkForUpdates(pkg.version);

      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (info.has_update && info.latest_version !== dismissed) {
        setUpdateInfo(info);
        setPhase("available");
      } else {
        setUpdateInfo(null);
        setPhase("idle");
      }
    } catch (e) {
      setError(String(e));
      setUpdateInfo(null);
      setPhase("idle");
    } finally {
      setLoading(false);
    }
  }, []);

  const startUpdate = useCallback(async () => {
    if (!updateInfo || !updateInfo.download_url) return;
    setPhase("downloading");
    setError(null);
    setUpdateProgress(null);

    if (import.meta.env.DEV) {
      // Simulate download progress in development mode (10MB total)
      let currentProgress = 0;
      const totalBytes = 10 * 1024 * 1024;
      const startTime = Date.now();
      
      const interval = setInterval(() => {
        // Increment between 300KB and 800KB
        const increment = Math.floor(Math.random() * 500 + 300) * 1024;
        currentProgress += increment;
        
        if (currentProgress >= totalBytes) {
          clearInterval(interval);
          setUpdateProgress({ downloaded: totalBytes, total: totalBytes });
          setPhase("preparing");
          
          // Simulate preparing phase for 2 seconds
          setTimeout(() => {
            setPhase("ready");
          }, 2000);
        } else {
          setUpdateProgress({ downloaded: currentProgress, total: totalBytes });
        }
      }, 250);
      return;
    }

    let unlistenProgress: () => void = () => {};
    let unlistenReady: () => void = () => {};
    let unlistenFailed: () => void = () => {};

    try {
      unlistenProgress = await listen<{ downloaded: number; total: number | null }>(
        "update-progress",
        (event) => {
          setUpdateProgress({
            downloaded: event.payload.downloaded,
            total: event.payload.total || 0,
          });
        }
      );

      unlistenReady = await listen<never>("update-ready", () => {
        setPhase("ready");
      });

      unlistenFailed = await listen<string>("update-failed", (event) => {
        setError(event.payload);
        setPhase("failed");
      });

      await invoke("download_and_prepare_update", { url: updateInfo.download_url });
      setPhase(prev => prev === 'ready' ? 'ready' : 'preparing');
    } catch (err) {
      setError(typeof err === "string" ? `فشل التحديث: ${err}` : "فشل التحديث: حدث خطأ غير معروف");
      setPhase(prev => prev === 'ready' ? 'ready' : 'failed');
    } finally {
      unlistenProgress();
      unlistenReady();
      unlistenFailed();
    }
  }, [updateInfo]);

  const restartToUpdate = useCallback(async () => {
    if (phase !== "ready") return;

    if (import.meta.env.DEV) {
      console.log("Simulating restart to update in DEV mode...");
      setPhase("idle");
      // Simulate app restart by reloading the browser window after a brief delay
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      return;
    }

    try {
      await invoke("apply_update_and_restart");
    } catch (err) {
      setError(typeof err === "string" ? `فشل تطبيق التحديث: ${err}` : "فشل تطبيق التحديث: حدث خطأ غير معروف");
      setPhase("failed");
    }
  }, [phase]);

  const dismiss = useCallback(() => {
    if (updateInfo) {
      localStorage.setItem(STORAGE_KEY, updateInfo.latest_version);
      setUpdateInfo(null);
      setPhase("idle");
    }
  }, [updateInfo]);

  const dismissAll = useCallback(() => {
    if (updateInfo) {
      localStorage.setItem(STORAGE_KEY, "__all__");
      setUpdateInfo(null);
      setPhase("idle");
    }
  }, [updateInfo]);

  const retry = useCallback(() => {
    if (updateInfo) {
      startUpdate();
    } else {
      check();
    }
  }, [updateInfo, startUpdate, check]);

  useEffect(() => {
    check();
    intervalRef.current = setInterval(check, CHECK_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [check]);

  const isUpdating = phase === "downloading" || phase === "preparing";
  const updateSuccess = phase === "ready";

  return { 
    updateInfo, 
    phase, 
    error, 
    updateProgress, 
    check, 
    startUpdate, 
    restartToUpdate, 
    dismiss, 
    dismissAll, 
    retry,
    loading,
    isUpdating,
    updateSuccess,
    installUpdate: startUpdate
  };
}
