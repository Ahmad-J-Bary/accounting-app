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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <SectionCard
        title="إنشاء نسخة احتياطية الآن"
        icon={<Plus className="w-4 h-4 text-blue-600" />}
        description="لقطة أمان محلية ومتسقة تُتحقق من سلامتها قبل الاعتراف بالنجاح."
      >
        <ManualBackupPanel operating={operating} onDone={onDone} />
      </SectionCard>

      <SectionCard
        title="استعادة نسخة"
        icon={<RotateCcw className="w-4 h-4 text-amber-600" />}
        description="استعادة بياناتك من نسخة احتياطية سابقة أو ملف — تُستبدل القاعدة الحالية بعد فحص الملف."
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
        description="استبدال القاعدة الحالية بملف خارجي بعد فحص سلامتِه وعلاقاتِه."
      >
        <InspectFileFlow mode="import" operating={operating} onDone={onDone} />
      </SectionCard>

      <SectionCard
        title="تصدير قاعدة البيانات"
        icon={<Download className="w-4 h-4 text-emerald-600" />}
        description="ملف قاعدة بيانات مستقلّ كامل يمكن نقله إلى أي جهاز."
      >
        <ExportPanel onDone={onDone} />
      </SectionCard>
    </div>
  );
}