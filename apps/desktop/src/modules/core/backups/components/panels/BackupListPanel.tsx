import { Database, Trash2, Save, ShieldCheck, Lock } from "lucide-react";
import { save } from "@tauri-apps/plugin-dialog";
import { Button } from "@shared/ui/button";
import { Badge } from "@shared/ui/badge";
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
import { formatSize, formatTimestamp, typeBadge, formatLabel } from "../../lib/backupFormat";

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
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

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
        <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl">
          {backups.map((b) => (
            <div key={b.name} className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <Database className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-sm text-slate-700 truncate" dir="ltr">{b.name}</p>
                    {typeBadge(b.backup_type)}
                    {b.verified && (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 text-[10px]">
                        موثقة ✓
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {formatTimestamp(b.timestamp)} • {formatSize(b.size)}
                    {b.schema_version ? ` • إصدار القاعدة ${b.schema_version}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={disabled}
                  onClick={() => void onRestore(b)}
                >
                  استعادة
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={disabled}
                  onClick={() => void handleCopy(b)}
                >
                  <Save className="w-3.5 h-3.5 ml-1" /> نسخ
                </Button>
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
                      <AlertDialogAction
                        className="bg-red-600 hover:bg-red-700"
                        onClick={async () => {
                          try {
                            await backupService.deleteFileBackup(b.name);
                            toast.success("تم حذف النسخة الاحتياطية");
                            await onDone();
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : String(e));
                          }
                        }}
                      >
                        حذف نهائيًا
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-400 flex items-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
        لا يمكن حذف قاعدة البيانات الحالية (النسخ الاحتياطية فقط).
      </p>
    </div>
  );
}