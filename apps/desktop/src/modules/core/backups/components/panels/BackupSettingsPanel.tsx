import { FolderOpen, Trash2 } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { Button } from "@shared/ui/button";
import { Switch } from "@shared/ui/switch";
import { cn } from "@shared/lib/utils";
import { toast } from "sonner";
import { backupService, type BackupConfig } from "../../../api/backupService";
import { useLocalization } from "@app/providers/LocalizationProvider";

const RETENTION_KEYS: { key: string; value: string; daily: number; weekly: number; monthly: number }[] = [
  { key: "last1d", value: "1d", daily: 1, weekly: 0, monthly: 0 },
  { key: "last3d", value: "3d", daily: 3, weekly: 0, monthly: 0 },
  { key: "last7d", value: "7d", daily: 7, weekly: 0, monthly: 0 },
  { key: "last14d", value: "14d", daily: 14, weekly: 0, monthly: 0 },
  { key: "last30d", value: "30d", daily: 0, weekly: 4, monthly: 1 },
  { key: "last60d", value: "60d", daily: 0, weekly: 8, monthly: 2 },
  { key: "last90d", value: "90d", daily: 0, weekly: 12, monthly: 3 },
  { key: "last6m", value: "6m", daily: 0, weekly: 0, monthly: 6 },
  { key: "last1y", value: "1y", daily: 0, weekly: 0, monthly: 12 },
  { key: "none", value: "none", daily: 0, weekly: 0, monthly: 0 },
];

function findRetentionPreset(daily: number, weekly: number, monthly: number): string {
  // Find matching preset
  for (const p of RETENTION_KEYS) {
    if (p.daily === daily && p.weekly === weekly && p.monthly === monthly) {
      return p.value;
    }
  }
  // Default to "last 7 days" if no match
  return "7d";
}

interface Props {
  config: BackupConfig;
  operating: boolean;
  onConfigChange: (patch: Partial<BackupConfig>) => Promise<void>;
  onApplyRetention: () => Promise<void>;
}

export function BackupSettingsPanel({ config, operating, onConfigChange, onApplyRetention }: Props) {
  const { t } = useLocalization();

  const RETENTION_PRESETS = RETENTION_KEYS.map(p => ({
    ...p,
    label: t(`settings.backups.retentionPresets.${p.key}`, { namespace: "settings", fallback: p.key }),
  }));
  const custom = !config.use_same_location;
  const currentPreset = findRetentionPreset(config.keep_daily, config.keep_weekly, config.keep_monthly);

  const handleOpenFolder = async () => {
    try {
      await backupService.openBackupLocation(config.backup_dir);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const pickCustomFolder = async () => {
    try {
      const dir = await open({ directory: true, multiple: false });
      if (dir && typeof dir === "string") {
        await onConfigChange({ use_same_location: false, custom_path: dir });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const handleRetentionChange = async (value: string) => {
    const preset = RETENTION_PRESETS.find((p) => p.value === value);
    if (preset) {
      await onConfigChange({
        keep_daily: preset.daily,
        keep_weekly: preset.weekly,
        keep_monthly: preset.monthly,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Auto backup toggle */}
      <div>
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p className="font-bold text-slate-800 text-sm">{t("settings.backups.autoBackup", { namespace: "settings", fallback: "النسخ الاحتياطي التلقائي" })}</p>
            <p className="text-xs text-slate-400">{t("settings.backups.autoBackupDesc", { namespace: "settings", fallback: "إنشاء نسخة احتياطية تلقائية عند بدء تشغيل التطبيق." })}</p>
          </div>
          <Switch
            checked={config.auto_backup_enabled}
            disabled={operating}
            onCheckedChange={(v) => void onConfigChange({ auto_backup_enabled: v })}
          />
        </div>
      </div>

      {/* Retention */}
      <div className="border-t border-slate-100 pt-5">
        <label className="font-bold text-slate-800 text-sm block mb-1">{t("settings.backups.retention", { namespace: "settings", fallback: "الاحتفاظ بالنسخ الاحتياطية" })}</label>
        <p className="text-xs text-slate-400 mb-3">{t("settings.backups.retentionDesc", { namespace: "settings", fallback: "ينطبق على النسخ الاحتياطية التلقائية فقط." })}</p>
        <select
          value={currentPreset}
          disabled={operating}
          onChange={(e) => void handleRetentionChange(e.target.value)}
          className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 focus:ring-blue-500 focus:border-blue-500 w-full md:w-auto"
        >
          {RETENTION_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {/* Backup location */}
      <div className="border-t border-slate-100 pt-5 space-y-3">
        <label className="font-bold text-slate-800 text-sm block">{t("settings.backups.location", { namespace: "settings", fallback: "مكان النسخ الاحتياطية" })}</label>

        <label
          className={cn(
            "flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all duration-200",
            !custom
              ? "bg-blue-50 border-blue-500/30 shadow-inner"
              : "bg-white/40 border-slate-200 hover:border-blue-500/20",
          )}
        >
          <input
            type="radio"
            name="backupLocation"
            checked={!custom}
            disabled={operating}
            onChange={() => void onConfigChange({ use_same_location: true, custom_path: "" })}
            className="h-4 w-4 accent-blue-600"
          />
          <div className="space-y-0.5">
            <div className="text-sm font-bold text-slate-700">{t("settings.backups.nextToProgram", { namespace: "settings", fallback: "بجانب بيانات البرنامج" })}</div>
            <div className="text-[10px] text-slate-400">{t("settings.backups.nextToProgramDesc", { namespace: "settings", fallback: "حفظ النسخ الاحتياطية بجانب ملف قاعدة البيانات الأصلي" })}</div>
          </div>
        </label>

        <label
          className={cn(
            "flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all duration-200",
            custom
              ? "bg-blue-50 border-blue-500/30 shadow-inner"
              : "bg-white/40 border-slate-200 hover:border-blue-500/20",
          )}
        >
          <input
            type="radio"
            name="backupLocation"
            checked={custom}
            disabled={operating}
            onChange={() => void onConfigChange({ use_same_location: false })}
            className="h-4 w-4 accent-blue-600"
          />
          <div className="space-y-0.5 flex-1">
            <div className="text-sm font-bold text-slate-700">{t("settings.backups.customFolder", { namespace: "settings", fallback: "مجلد مخصص" })}</div>
            <div className="text-[10px] text-slate-400">{t("settings.backups.customFolderDesc", { namespace: "settings", fallback: "اختيار مجلد محدد للنسخ الاحتياطية" })}</div>
          </div>
        </label>

        {custom && (
          <div className="flex items-center gap-2 pr-8">
            <div className="flex-1 px-3 py-2 rounded-xl bg-white/40 border border-slate-200 text-xs text-slate-500 truncate" dir="ltr">
              {config.custom_path || t("settings.backups.noFolderSelected", { namespace: "settings", fallback: "لم يتم اختيار مجلد بعد" })}
            </div>
            <Button variant="outline" size="sm" disabled={operating} onClick={() => void pickCustomFolder()} className="shrink-0 h-9 rounded-xl">
              <FolderOpen className="h-4 w-4 mr-1" /> {t("settings.backups.selectFolder", { namespace: "settings", fallback: "اختيار المجلد" })}
            </Button>
          </div>
        )}

        <div className="flex items-center gap-2 pt-2">
          <Button size="sm" variant="outline" disabled={operating} onClick={() => void handleOpenFolder()}>
            <FolderOpen className="h-4 w-4 mr-1" /> {t("settings.backups.openFolder", { namespace: "settings", fallback: "فتح المجلد" })}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-rose-600 hover:text-rose-700 border-rose-200 hover:border-rose-300 hover:bg-rose-50"
            disabled={operating}
            onClick={() => void onApplyRetention()}
          >
            <Trash2 className="h-4 w-4 mr-1" /> {t("settings.backups.cleanOld", { namespace: "settings", fallback: "تنظيف النسخ القديمة" })}
          </Button>
        </div>
      </div>
    </div>
  );
}
