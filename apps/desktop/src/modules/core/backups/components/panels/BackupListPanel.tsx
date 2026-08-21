import { Database, Trash2, Save, ShieldCheck, Lock, FolderOpen } from "lucide-react";
import { save } from "@tauri-apps/plugin-dialog";
import { Button } from "@shared/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@shared/ui/alert-dialog";
import { toast } from "sonner";
import { backupService, type BackupFileInfo, type PendingRestoreInfo } from "../../../api/backupService";
import {
  formatTimestamp, typeBadge, formatDate, formatTime,
} from "../../lib/backupFormat";
import { friendlyBackupError } from "../../lib/backupErrors";
import { BackupStatusBadge } from "../BackupStatusBadge";

interface Props {
  backups: BackupFileInfo[];
  pending: PendingRestoreInfo | null;
  operating: boolean;
  onRestore: (b: BackupFileInfo) => Promise<void>;
  onDone: () => Promise<void>;
}

export function BackupListPanel({ backups, pending, operating, onRestore, onDone }: Props) {
  const disabled = operating || !!pending;

  const handleCopy = async (b: BackupFileInfo) => {
    const dest = await save({
      defaultPath: b.name,
      filters: [{ name: "قاعدة بيانات SQLite", extensions: ["sqlite", "db"] }],
    });
    if (!dest) return;
    try {
      await backupService.copyFileBackup(b.name, dest);
      toast.success("تم نسخ النسخة الاحتياطية إلى الوجهة المختارة");
    } catch (e) {
      toast.error(friendlyBackupError(e).friendly);
    }
  };

  const handleOpen = async (b: BackupFileInfo) => {
    try {
      await backupService.openBackupLocation(b.path);
    } catch (e) {
      toast.error(friendlyBackupError(e).friendly);
    }
  };

  const handleDelete = async (b: BackupFileInfo) => {
    try {
      await backupService.deleteFileBackup(b.name);
      toast.success("تم حذف النسخة الاحتياطية");
      await onDone();
    } catch (e) {
      toast.error(friendlyBackupError(e).friendly);
    }
  };

  const ConfirmDelete = ({ b }: { b: BackupFileInfo }) => (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600" disabled={disabled} aria-label="حذف النسخة الاحتياطية">
          <Trash2 className="w-4 h-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>حذف النسخة الاحتياطية</AlertDialogTitle>
          <AlertDialogDescription>
            هل تريد حذف هذه النسخة الاحتياطية نهائيًا؟ لا يمكن التراجع عن هذا الإجراء.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>إلغاء</AlertDialogCancel>
          <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => void handleDelete(b)}>
            حذف نهائيًا
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (backups.length === 0) {
    return (
      <div className="py-12 text-center">
        <Database className="w-12 h-12 mx-auto mb-3 text-slate-300" />
        <p className="font-bold text-slate-400">لا توجد نسخ احتياطية بعد</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {pending && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
          <Lock className="w-4 h-4" />
          توجد استعادة معلقة — أكملها من الشريط أعلاه.
        </div>
      )}

      {/* Desktop: responsive table */}
      <div className="hidden md:block rounded-xl border border-slate-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs font-bold text-slate-400">
              <th className="text-right px-4 py-2.5">التاريخ</th>
              <th className="text-right px-4 py-2.5">النوع</th>
              <th className="text-right px-4 py-2.5">الحالة</th>
              <th className="text-right px-4 py-2.5">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {backups.map((b) => (
              <tr key={b.name} className="align-middle">
                <td className="px-4 py-2.5">
                  <p className="font-bold text-slate-700">{formatDate(b.timestamp)}</p>
                  <p className="text-xs text-slate-400">{formatTime(b.timestamp)}</p>
                </td>
                <td className="px-4 py-2.5">{typeBadge(b.backup_type)}</td>
                <td className="px-4 py-2.5"><BackupStatusBadge backup={b} /></td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline" disabled={disabled} onClick={() => void onRestore(b)}>
                      استعادة
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={disabled}
                      aria-label="نسخ النسخة إلى مكان آخر"
                      onClick={() => void handleCopy(b)}
                    >
                      <Save className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={disabled}
                      aria-label="فتح موقع النسخة"
                      onClick={() => void handleOpen(b)}
                    >
                      <FolderOpen className="w-4 h-4" />
                    </Button>
                    <ConfirmDelete b={b} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards */}
      <div className="md:hidden space-y-2">
        {backups.map((b) => (
          <div key={b.name} className="rounded-xl border border-slate-100 bg-white p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold text-sm text-slate-700">
                {formatTimestamp(b.timestamp)}
              </p>
              <BackupStatusBadge backup={b} />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {typeBadge(b.backup_type)}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Button size="sm" variant="outline" disabled={disabled} onClick={() => void onRestore(b)}>
                استعادة
              </Button>
              <Button size="sm" variant="outline" disabled={disabled} onClick={() => void handleCopy(b)}>
                <Save className="w-3.5 h-3.5 ml-1" /> نسخ
              </Button>
              <Button size="sm" variant="outline" disabled={disabled} onClick={() => void handleOpen(b)}>
                <FolderOpen className="w-3.5 h-3.5 ml-1" /> فتح الموقع
              </Button>
              <ConfirmDelete b={b} />
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-400 flex items-center gap-1.5 pt-2">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
        لا يمكن حذف قاعدة البيانات الحالية (النسخ الاحتياطية فقط).
      </p>
    </div>
  );
}
