import { SettingsSection } from "@widgets/templates/SettingsLayout";
import { ManualBackupPanel } from "../panels/ManualBackupPanel";
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
    <SettingsSection title="إجراءات البيانات">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ManualBackupPanel operating={operating} onDone={onDone} />
        <InspectFileFlow
          mode="restore"
          operating={operating}
          preset={preset}
          onPresetConsumed={onPresetConsumed}
          onDone={onDone}
        />
      </div>
    </SettingsSection>
  );
}
