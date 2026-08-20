import { Archive } from "lucide-react";
import { SectionCard } from "@shared/ui/section-card";
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
    <SectionCard
      title="سجل النسخ الاحتياطية"
      icon={<Archive className="w-4 h-4 text-slate-600" />}
      description="استعادة نسخة تستبدل القاعدة الحالية بالنسخة المختارة — تُنشأ نسخة احتياطية تلقائية قبل المتابعة."
    >
      <BackupListPanel backups={backups} pending={pending} operating={operating} onRestore={onRestore} onDone={onDone} />
    </SectionCard>
  );
}