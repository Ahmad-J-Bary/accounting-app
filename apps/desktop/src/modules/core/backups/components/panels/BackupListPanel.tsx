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
  formatSize, formatTimestamp, typeBadge, formatLabel, formatDate, formatTime,
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
            هل تريد حذف «{formatLabel(b.label)}» نهائيًا؟ لا يمكن التراجع عن هذا الإجراء.
            تُحذف النسخ الاحتياطية فقط — قاعدة البيانات الحالية لا تتأثر أبدًا.
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

  return (
    <div className="space-y-3">
      {pending ? (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
          <Lock className="w-4 h-4" />
          توجد استعادة معلقة — أكملها من الشريط أعلاه قبل أي عملية استعادة/استيراد أخرى.
        </div>
      ) : null}

      {backups.length === 0 ? (
        <div className="p-10 text-center text-slate-400">
          <Database className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>لا توجد نسخ احتياطية بعد</p>
        </div>
      ) : (
        <>
          {/* Desktop: responsive table */}
          <div className="hidden md:block rounded-xl border border-slate-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs font-bold text-slate-400">
                  <th className="text-right px-4 py-2.5">النسخة</th>
                  <th className="text-right px-4 py-2.5">التاريخ</th>
                  <th className="text-right px-4 py-2.5">الحجم</th>
                  <th className="text-right px-4 py-2.5">الحالة</th>
                  <th className="text-right px-4 py-2.5">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {backups.map((b) => (
                  <tr key={b.name} className="align-middle">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2 min-w-0 max-w-xs">
                        <Database className="w-4 h-4 text-slate-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-bold text-slate-700 truncate" dir="ltr" title={b.label}>
                            {b.name}
                          </p>
                          <div className="flex items-center gap-1 flex-wrap mt-0.5">
                            {typeBadge(b.backup_type)}
                            {b.schema_version ? (
                              <span dir="ltr" className="text-[10px] text-slate-400 font-mono">
                                v{b.schema_version}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <p className="font-bold text-slate-600">{formatDate(b.timestamp)}</p>
                      <p className="text-xs text-slate-400">{formatTime(b.timestamp)}</p>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 font-bold">{formatSize(b.size)}</td>
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
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Database className="w-4 h-4 text-slate-400 shrink-0" />
                    <p className="font-bold text-sm text-slate-700 truncate max-w-[180px]" dir="ltr" title={b.label}>
                      {b.name}
                    </p>
                  </div>
                  <BackupStatusBadge backup={b} />
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {typeBadge(b.backup_type)}
                  {b.schema_version ? (
                    <span dir="ltr" className="text-[10px] text-slate-400 font-mono">
                      v{b.schema_version}
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-slate-400">
                  {formatTimestamp(b.timestamp)} • {formatSize(b.size)}
                </p>
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
        </>
      )}

      <p className="text-xs text-slate-400 flex items-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
        لا يمكن حذف قاعدة البيانات الحالية (النسخ الاحتياطية فقط).
      </p>
    </div>
  );
}