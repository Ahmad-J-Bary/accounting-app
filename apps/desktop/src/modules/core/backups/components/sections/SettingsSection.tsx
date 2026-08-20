import { Settings2 } from "lucide-react";
import { SectionCard } from "@shared/ui/section-card";
import { BackupSettingsPanel } from "../panels/BackupSettingsPanel";
import type { BackupConfig } from "../../../api/backupService";

interface Props {
  config: BackupConfig;
  operating: boolean;
  onConfigChange: (patch: Partial<BackupConfig>) => Promise<void>;
  onApplyRetention: () => Promise<void>;
}

export function SettingsSection({ config, operating, onConfigChange, onApplyRetention }: Props) {
  return (
    <SectionCard
      title="إعدادات النسخ الاحتياطي"
      icon={<Settings2 className="w-4 h-4 text-slate-600" />}
      description="النسخ التلقائي، موقع التخزين، وسياسات الاحتفاظ بالنسخ."
    >
      <BackupSettingsPanel
        config={config}
        operating={operating}
        onConfigChange={onConfigChange}
        onApplyRetention={onApplyRetention}
      />
    </SectionCard>
  );
}