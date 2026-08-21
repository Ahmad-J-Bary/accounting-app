import { SettingsSection as LayoutSection } from "@widgets/templates/SettingsLayout";
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
    <LayoutSection title="إعدادات النسخ الاحتياطي">
      <BackupSettingsPanel
        config={config}
        operating={operating}
        onConfigChange={onConfigChange}
        onApplyRetention={onApplyRetention}
      />
    </LayoutSection>
  );
}
