import { FolderOpen, Trash2, X } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { Button } from "@shared/ui/button";
import { Switch } from "@shared/ui/switch";
import { Input } from "@shared/ui/input";
import type { BackupConfig } from "../../../api/backupService";

interface Props {
  config: BackupConfig;
  operating: boolean;
  onConfigChange: (patch: Partial<BackupConfig>) => Promise<void>;
  onApplyRetention: () => Promise<void>;
}

export function BackupSettingsPanel({ config, operating, onConfigChange, onApplyRetention }: Props) {
  const custom = !config.use_same_location;

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
        <p className="font-bold text-slate-600 text-sm">موقع النسخ الاحتياطي</p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={!custom ? "default" : "outline"}
            className={!custom ? "bg-blue-600 hover:bg-blue-700" : ""}
            disabled={operating}
            onClick={() => void onConfigChange({ use_same_location: true })}
          >
            افتراضي (مجلد قاعدة البيانات)
          </Button>
          <Button
            size="sm"
            variant={custom ? "default" : "outline"}
            className={custom ? "bg-blue-600 hover:bg-blue-700" : ""}
            disabled={operating}
            onClick={() => void onConfigChange({ use_same_location: false })}
          >
            مجلد مخصص
          </Button>
        </div>

        {custom && (
          <div className="flex gap-2">
            <Input
              value={config.custom_path ?? ""}
              readOnly
              placeholder="اختر مجلدًا لنسخ البيانات الاحتياطية"
              className="flex-1"
            />
            <Button
              size="sm"
              variant="outline"
              type="button"
              disabled={operating}
              onClick={async () => {
                const dir = await open({ directory: true, multiple: false });
                if (dir && typeof dir === "string") {
                  await onConfigChange({ custom_path: dir });
                }
              }}
            >
              <FolderOpen className="w-4 h-4 ml-1" /> اختيار
            </Button>
            {config.custom_path ? (
              <Button
                size="sm"
                variant="ghost"
                type="button"
                disabled={operating}
                onClick={() => void onConfigChange({ custom_path: "" })}
              >
                <X className="w-4 h-4 ml-1" /> مسح
              </Button>
            ) : null}
          </div>
        )}

        <p className="text-xs text-slate-400">
          مجلد النسخ الحالي: <span dir="ltr" className="font-mono">{config.backup_dir}</span>
        </p>
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
        <Button size="sm" variant="outline" disabled={operating} onClick={() => void onApplyRetention()}>
          <Trash2 className="w-4 h-4 ml-1" /> تنظيف النسخ القديمة
        </Button>
      </div>
    </div>
  );
}