import { FolderOpen, Trash2 } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { Button } from "@shared/ui/button";
import { Switch } from "@shared/ui/switch";
import { Input } from "@shared/ui/input";
import { cn } from "@shared/lib/utils";
import { toast } from "sonner";
import { backupService, type BackupConfig } from "../../../api/backupService";

interface Props {
  config: BackupConfig;
  operating: boolean;
  onConfigChange: (patch: Partial<BackupConfig>) => Promise<void>;
  onApplyRetention: () => Promise<void>;
}

export function BackupSettingsPanel({ config, operating, onConfigChange, onApplyRetention }: Props) {
  const custom = !config.use_same_location;

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-bold text-slate-600 text-sm">نسخ احتياطي تلقائي عند بدء التشغيل</p>
          <p className="text-xs text-slate-400">تُنشأ نسخة يومية تلقائية عند فتح التطبيق (لقطة أمان محلية).</p>
        </div>
        <Switch
          checked={config.auto_backup_enabled}
          disabled={operating}
          onCheckedChange={(v) => void onConfigChange({ auto_backup_enabled: v })}
        />
      </div>

      <div className="border-t border-slate-100 pt-5 space-y-3">
        <p className="font-bold text-slate-600 text-sm">الاحتفاظ بالنسخ التلقائية</p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">يومي</label>
            <Input
              type="number"
              min={0}
              disabled={operating}
              value={config.keep_daily}
              onChange={(e) => void onConfigChange({ keep_daily: Math.max(0, Number(e.target.value)) })}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">أسبوعي</label>
            <Input
              type="number"
              min={0}
              disabled={operating}
              value={config.keep_weekly}
              onChange={(e) => void onConfigChange({ keep_weekly: Math.max(0, Number(e.target.value)) })}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">شهري</label>
            <Input
              type="number"
              min={0}
              disabled={operating}
              value={config.keep_monthly}
              onChange={(e) => void onConfigChange({ keep_monthly: Math.max(0, Number(e.target.value)) })}
            />
          </div>
        </div>
        <p className="text-xs text-slate-400">0 في أي حقل = لا حد. ينطبق التحكم على النسخ التلقائية فقط.</p>
      </div>

      <div className="space-y-2 pt-2 border-t border-slate-100">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          موقع النسخ الاحتياطي
        </label>

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
            <div className="text-sm font-bold text-slate-700">النسخ بجانب قاعدة البيانات</div>
            <div className="text-[10px] text-slate-400">حفظ النسخ الاحتياطية بجانب ملف قاعدة البيانات الأصلي</div>
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
            <div className="text-sm font-bold text-slate-700">موقع مخصص</div>
            <div className="text-[10px] text-slate-400">اختيار مجلد محدد للنسخ الاحتياطية</div>
          </div>
        </label>

        {custom && (
          <div className="flex items-center gap-2 pr-8">
            <div className="flex-1 px-3 py-2 rounded-xl bg-white/40 border border-slate-200 text-xs text-slate-500 truncate" dir="ltr">
              {config.custom_path || "لم يتم اختيار مجلد بعد"}
            </div>
            <Button variant="outline" size="sm" disabled={operating} onClick={() => void pickCustomFolder()} className="shrink-0 h-9 rounded-xl">
              <FolderOpen className="h-4 w-4 mr-1" /> تصفح...
            </Button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between pt-2">
          <p className="text-xs text-slate-400">
            مجلد النسخ الحالي: <span dir="ltr" className="font-mono">{config.backup_dir}</span>
          </p>
          <Button size="sm" variant="outline" disabled={operating} onClick={() => void handleOpenFolder()}>
            <FolderOpen className="h-4 w-4 mr-1" /> فتح مجلد النسخ
          </Button>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="text-rose-600 hover:text-rose-700 border-rose-200 hover:border-rose-300 hover:bg-rose-50"
            disabled={operating}
            onClick={() => void onApplyRetention()}
          >
            <Trash2 className="h-4 w-4 mr-1" /> تنظيف النسخ القديمة
          </Button>
        </div>
      </div>
    </div>
  );
}