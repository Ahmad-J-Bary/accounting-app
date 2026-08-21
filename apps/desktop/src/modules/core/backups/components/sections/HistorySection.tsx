import { SettingsSection } from "@widgets/templates/SettingsLayout";
import { BackupListPanel } from "../panels/BackupListPanel";
import type { BackupFileInfo, PendingRestoreInfo } from "../../../api/backupService";

interface Props {
  backups: BackupFileInfo[];
  pending: PendingRestoreInfo | null;
  operating: boolean;
  onRestore: (b: BackupFileInfo) => Promise<void>;
  onDone: () => Promise<void>;
}

export function HistorySection({ backups, pending, operating, onRestore, onDone }: Props) {
  return (
    <SettingsSection title="النسخ الاحتياطية">
      <BackupListPanel backups={backups} pending={pending} operating={operating} onRestore={onRestore} onDone={onDone} />
    </SettingsSection>
  );
}
