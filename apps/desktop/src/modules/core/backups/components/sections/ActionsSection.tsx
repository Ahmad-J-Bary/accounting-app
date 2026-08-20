import { Plus, RotateCcw, Upload, Download } from "lucide-react";
import { SectionCard } from "@shared/ui/section-card";
import { ManualBackupPanel } from "../panels/ManualBackupPanel";
import { ExportPanel } from "../panels/ExportPanel";
import { InspectFileFlow } from "../InspectFileFlow";
import type { BackupFileInfo } from "../../../api/backupService";

interface Props {
  operating: boolean;
  onDone: () => Promise<void>;
  preset?: BackupFileInfo | null;
  onPresetConsumed?: () => void;
}

export function ActionsSection({ operating, onDone, preset = null, onPresetConsumed }: Props) {
  return (
    <div className="space-y-3">
      <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
        إجراءات النسخ والاستعادة
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <SectionCard
          title="إنشاء نسخة احتياطية الآن"
          icon={<Plus className="w-4 h-4 text-blue-600" />}
          description="حفظ نسخة آمنة من قاعدة بياناتك الحالية."
        >
          <ManualBackupPanel operating={operating} onDone={onDone} />
        </SectionCard>

        <SectionCard
          title="استعادة نسخة"
          icon={<RotateCcw className="w-4 h-4 text-amber-600" />}
          description="العودة إلى نسخة محفوظة سابقًا."
        >
          <InspectFileFlow
            mode="restore"
            operating={operating}
            preset={preset}
            onPresetConsumed={onPresetConsumed}
            onDone={onDone}
          />
        </SectionCard>

        <SectionCard
          title="استيراد قاعدة بيانات"
          icon={<Upload className="w-4 h-4 text-purple-600" />}
          description="استبدال قاعدة البيانات الحالية بقاعدة خارجية (بعد فحصها)."
        >
          <InspectFileFlow mode="import" operating={operating} onDone={onDone} />
        </SectionCard>

        <SectionCard
          title="تصدير قاعدة البيانات"
          icon={<Download className="w-4 h-4 text-emerald-600" />}
          description="حفظ نسخة من قاعدة البيانات في مكان تختاره."
        >
          <ExportPanel onDone={onDone} />
        </SectionCard>
      </div>
    </div>
  );
}