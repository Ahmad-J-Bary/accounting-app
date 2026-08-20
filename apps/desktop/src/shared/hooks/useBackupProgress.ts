import { useEffect, useState } from "react";
import {
  backupService,
  type BackupProgressPhase,
} from "@modules/core/api/backupService";

/**
 * Shared, single-subscription `backup-progress` feed. Every panel (manual
 * backup, export, import staging) consumes the SAME Rust event stream through
 * one dedicated listener instead of opening N listeners — the listener is
 * attached once for the whole session and fan-out is pure client-side.
 */
const subscribers = new Set<(phase: BackupProgressPhase) => void>();
let started = false;
let lastPhase: BackupProgressPhase | null = null;

function ensureListener(): void {
  if (started) return;
  started = true;
  backupService
    .listenBackupProgress((e) => {
      lastPhase = e.phase;
      for (const cb of subscribers) cb(e.phase);
    })
    .catch(() => {
      // Backend on an older build may not emit yet — stay inert.
      started = false;
    });
}

export function useBackupProgress(): BackupProgressPhase | null {
  const [phase, setPhase] = useState<BackupProgressPhase | null>(lastPhase);

  useEffect(() => {
    const cb = (p: BackupProgressPhase) => setPhase(p);
    subscribers.add(cb);
    ensureListener();
    return () => {
      subscribers.delete(cb);
    };
  }, []);

  return phase;
}

export const BACKUP_PROGRESS_LABELS: Record<BackupProgressPhase, string> = {
  creating: "جارٍ إنشاء النسخة الاحتياطية...",
  verifying: "جارٍ التحقق من النسخة الاحتياطية...",
  exporting: "جارٍ تصدير قاعدة البيانات...",
  snapshotting_original: "جارٍ إنشاء نسخة أمان من القاعدة الحالية...",
  validating: "جارٍ فحص الملف المستورد...",
  copying: "جارٍ تجهيز الملف للاستعادة...",
  staged: "تجهيز الاستعادة اكتمل — أعد تشغيل التطبيق لإتمامها",
  completed: "اكتملت العملية بنجاح",
  failed: "فشلت العملية",
};

export function backupProgressValue(phase: BackupProgressPhase | null): number {
  switch (phase) {
    case "creating":
    case "snapshotting_original":
      return 40;
    case "verifying":
    case "exporting":
      return 75;
    case "validating":
      return 88;
    case "copying":
      return 95;
    case "staged":
    case "completed":
      return 100;
    case "failed":
      return 0;
    default:
      return 0;
  }
}