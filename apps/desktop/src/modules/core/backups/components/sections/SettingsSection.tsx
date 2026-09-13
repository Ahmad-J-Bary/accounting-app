import { SettingsSection as LayoutSection } from "@widgets/templates/SettingsLayout";
import { BackupSettingsPanel } from "../panels/BackupSettingsPanel";
import type { BackupConfig } from "../../../api/backupService";
import { useLocalization } from "@app/providers/LocalizationProvider";

interface Props {
  config: BackupConfig;
  operating: boolean;
  onConfigChange: (patch: Partial<BackupConfig>) => Promise<void>;
  onApplyRetention: () => Promise<void>;
}

export function SettingsSection({ config, operating, onConfigChange, onApplyRetention }: Props) {
  const { t } = useLocalization();
  return (
    <LayoutSection title={t("backups.settingsTitle", { namespace: "settings",  })}>
      <BackupSettingsPanel
        config={config}
        operating={operating}
        onConfigChange={onConfigChange}
        onApplyRetention={onApplyRetention}
      />
    </LayoutSection>
  );
}
