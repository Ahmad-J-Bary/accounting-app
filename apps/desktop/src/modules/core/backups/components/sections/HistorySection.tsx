import { SettingsSection } from "@widgets/templates/SettingsLayout";
import { BackupListPanel } from "../panels/BackupListPanel";
import type { BackupFileInfo, PendingRestoreInfo } from "../../../api/backupService";
import { useLocalization } from "@app/providers/LocalizationProvider";

interface Props {
  backups: BackupFileInfo[];
  pending: PendingRestoreInfo | null;
  operating: boolean;
  onRestore: (b: BackupFileInfo) => Promise<void>;
  onDone: () => Promise<void>;
}

export function HistorySection({ backups, pending, operating, onRestore, onDone }: Props) {
  const { t } = useLocalization();
  return (
    <SettingsSection title={t("settings.backups.title", { namespace: "settings", fallback: "النسخ الاحتياطية" })}>
      <BackupListPanel backups={backups} pending={pending} operating={operating} onRestore={onRestore} onDone={onDone} />
    </SettingsSection>
  );
}
