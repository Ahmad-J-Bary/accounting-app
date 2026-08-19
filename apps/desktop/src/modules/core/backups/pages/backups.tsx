import { useState, useEffect, useCallback } from 'react';
import {
  Download, Upload, Plus, Database, RefreshCw, Trash2, AlertTriangle,
  FolderOpen, ShieldCheck, Power, X,
} from 'lucide-react';
import { open, save } from '@tauri-apps/plugin-dialog';
import { Button } from '@shared/ui/button';
import { Switch } from '@shared/ui/switch';
import { Input } from '@shared/ui/input';
import { Badge } from '@shared/ui/badge';
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
} from '@shared/ui/alert-dialog';
import { toast } from 'sonner';
import {
  backupService,
  type BackupFileInfo,
  type BackupConfig,
  type PendingRestoreInfo,
} from '../../api/backupService';

type Health = 'checking' | 'ok' | 'error';

function formatSize(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatLabel(label: string): string {
  // accounting_backup_20260819_093000 -> 2026/08/19 09:30:00
  const m = label.replace(/^(erp_backup_|accounting_backup_|erp_pre_restore_)/, '').match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})$/);
  if (!m) return label;
  return `${m[1]}/${m[2]}/${m[3]} ${m[4]}:${m[5]}:${m[6]}`;
}

function typeBadge(b: BackupFileInfo) {
  if (!b.backup_type) return null;
  const label =
    b.backup_type === 'manual' ? 'يدوية' :
    b.backup_type === 'pre_import' ? 'قبل الاستيراد' : 'تلقائية';
  const cls =
    b.backup_type === 'manual' ? 'bg-blue-50 text-blue-700' :
    b.backup_type === 'pre_import' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600';
  return <Badge variant="outline" className={`${cls} text-[10px]`}>{label}</Badge>;
}

export default function BackupsPage() {
  const [backups, setBackups] = useState<BackupFileInfo[]>([]);
  const [config, setConfig] = useState<BackupConfig | null>(null);
  const [pending, setPending] = useState<PendingRestoreInfo | null>(null);
  const [health, setHealth] = useState<Health>('checking');
  const [healthMsg, setHealthMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [operating, setOperating] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [b, c, p, h] = await Promise.all([
        backupService.listBackups(),
        backupService.getConfig(),
        backupService.getPendingRestore(),
        backupService.getHealth(),
      ]);
      setBackups(b);
      setConfig(c);
      setPending(p);
      if (h.status === 'ok') { setHealth('ok'); setHealthMsg(''); }
      else { setHealth('error'); setHealthMsg(h.message ?? ''); }
    } catch (e) {
      console.error(e);
      toast.error('فشل تحميل بيانات النسخ الاحتياطي');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleBackupNow = async () => {
    setOperating(true);
    try {
      const info = await backupService.backupNow();
      toast.success(`تم إنشاء نسخة احتياطية (${formatLabel(info.label)})`);
      await load(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setOperating(false);
    }
  };

  const handleExport = async () => {
    setOperating(true);
    try {
      const path = await save({
        defaultPath: `erp_backup_${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}.sqlite`,
        filters: [{ name: 'قاعدة بيانات SQLite', extensions: ['sqlite', 'db'] }],
      });
      if (!path) return;
      await backupService.exportToFile(path);
      toast.success('تم تصدير قاعدة البيانات بنجاح');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setOperating(false);
    }
  };

  const handleImport = async () => {
    setOperating(true);
    try {
      const path = await open({
        multiple: false,
        filters: [{ name: 'قاعدة بيانات SQLite', extensions: ['sqlite', 'db'] }],
      });
      if (!path || typeof path !== 'string') return;
      await backupService.importFromFile(path);
      toast.success('تم تجهيز الاستعادة — سيتم إعادة تشغيل التطبيق لتطبيقها');
      const p = await backupService.getPendingRestore();
      setPending(p);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setOperating(false);
    }
  };

  const handleRestoreFromList = async (path: string) => {
    setOperating(true);
    try {
      await backupService.importFromFile(path);
      toast.success('تم تجهيز الاستعادة — سيتم إعادة تشغيل التطبيق لتطبيقها');
      const p = await backupService.getPendingRestore();
      setPending(p);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setOperating(false);
    }
  };

  const handleCancelRestore = async () => {
    try {
      await backupService.cancelPendingRestore();
      setPending(null);
      toast.info('تم إلغاء الاستعادة المعلقة');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const handleRestart = async () => {
    try {
      await backupService.requestRestart();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const handleDeleteBackup = async (name: string) => {
    try {
      await backupService.deleteFileBackup(name);
      toast.success('تم حذف النسخة الاحتياطية');
      await load(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const handleConfigChange = async (patch: Partial<BackupConfig>) => {
    try {
      const saved = await backupService.setConfig({
        use_same_location: patch.use_same_location,
        custom_path: patch.custom_path,
        keep_daily: patch.keep_daily,
        keep_weekly: patch.keep_weekly,
        keep_monthly: patch.keep_monthly,
        auto_backup_enabled: patch.auto_backup_enabled,
      });
      setConfig(saved);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] space-y-4">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="font-black text-slate-400">جاري تحميل النسخ الاحتياطية...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800">النسخ الاحتياطي والاستعادة</h1>
            <p className="text-sm text-slate-500">حماية بياناتك المالية — إنشاء واستعادة نسخ احتياطية لقاعدة البيانات</p>
          </div>
        </div>
        <Button onClick={() => void load()} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 ml-1" /> تحديث
        </Button>
      </div>

      {/* Health banner */}
      {health === 'error' && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-red-200 bg-red-50 text-red-700">
          <AlertTriangle className="w-5 h-5 mt-0.5" />
          <div>
            <p className="font-bold">تحذير: فشل فحص سلامة قاعدة البيانات</p>
            <p className="text-sm mt-1">{healthMsg || 'يرجى إنشاء نسخة احتياطية فورًا والاتصال بالدعم.'}</p>
          </div>
        </div>
      )}

      {/* Pending restore banner */}
      {pending && (
        <div className="flex items-center justify-between gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-800">
          <div className="flex items-center gap-2">
            <Power className="w-5 h-5" />
            <span className="font-bold">استعادة معلقة من «{pending.source_label}»</span>
            <span className="text-sm">— أعد تشغيل التطبيق لإتمام الاستعادة</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleRestart} disabled={operating}>
              إعادة التشغيل الآن
            </Button>
            <Button size="sm" variant="outline" onClick={handleCancelRestore} disabled={operating}>
              <X className="w-4 h-4 ml-1" /> إلغاء
            </Button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <Database className="w-6 h-6 text-blue-600 mb-2" />
          <p className="font-bold text-slate-700">نسخة احتياطية الآن</p>
          <p className="text-xs text-slate-400 mt-1">لقطة آمنة ومتسقة للقاعدة الحالية</p>
          <Button size="sm" className="mt-3" onClick={handleBackupNow} disabled={operating}>
            <Plus className="w-4 h-4 ml-1" /> إنشاء نسخة
          </Button>
        </div>
        <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <Download className="w-6 h-6 text-emerald-600 mb-2" />
          <p className="font-bold text-slate-700">تصدير القاعدة</p>
          <p className="text-xs text-slate-400 mt-1">حفظ نسخة خارجية كاملة من البيانات</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={handleExport} disabled={operating}>
            <Download className="w-4 h-4 ml-1" /> تصدير
          </Button>
        </div>
        <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <Upload className="w-6 h-6 text-purple-600 mb-2" />
          <p className="font-bold text-slate-700">استيراد قاعدة</p>
          <p className="text-xs text-slate-400 mt-1">الاستعادة من ملف خارجي (يتم نسخ احتياطي تلقائيًا قبلها)</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={handleImport} disabled={operating}>
            <FolderOpen className="w-4 h-4 ml-1" /> اختيار ملف
          </Button>
        </div>
        <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <ShieldCheck className="w-6 h-6 text-amber-600 mb-2" />
          <p className="font-bold text-slate-700">سلامة القاعدة</p>
          <p className="text-xs text-slate-400 mt-1">{health === 'ok' ? 'القاعدة سليمة' : 'توجد مشكلة'}</p>
          {health === 'ok' && <Badge variant="default" className="mt-3 bg-emerald-600">سليمة ✓</Badge>}
        </div>
      </div>

      {/* Settings */}
      {config && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-black text-slate-700 mb-4">إعدادات النسخ الاحتياطي</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-bold text-slate-600 text-sm">نسخ احتياطي تلقائي عند بدء التشغيل</p>
                <p className="text-xs text-slate-400">نسخة يومية عند فتح التطبيق</p>
              </div>
              <Switch
                checked={config.auto_backup_enabled}
                onCheckedChange={(v) => void handleConfigChange({ auto_backup_enabled: v })}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-bold text-slate-600 text-sm">نفس مجلد قاعدة البيانات</p>
                <p className="text-xs text-slate-400">ضع النسخ في مجلد القاعدة نفسها</p>
              </div>
              <Switch
                checked={config.use_same_location}
                onCheckedChange={(v) => void handleConfigChange({ use_same_location: v })}
              />
            </div>
            {!config.use_same_location && (
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-500 block mb-1">مجلد مخصص للنسخ</label>
                <div className="flex gap-2">
                  <Input
                    value={config.custom_path ?? ''}
                    readOnly
                    placeholder="فريق دفعة أو اتركه فارغًا للافتراضي"
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    onClick={async () => {
                      const dir = await open({ directory: true, multiple: false });
                      if (dir && typeof dir === 'string') {
                        await handleConfigChange({ custom_path: dir });
                      }
                    }}
                  >
                    <FolderOpen className="w-4 h-4 ml-1" /> اختيار
                  </Button>
                  {config.custom_path && (
                    <Button
                      size="sm"
                      variant="ghost"
                      type="button"
                      onClick={() => void handleConfigChange({ custom_path: '' })}
                    >
                      مسح
                    </Button>
                  )}
                </div>
              </div>
            )}
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">احتفاظ يومي (نسخ تلقائية)</label>
              <Input
                type="number"
                min={0}
                value={config.keep_daily}
                onChange={(e) => void handleConfigChange({ keep_daily: Math.max(0, Number(e.target.value)) })}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">احتفاظ أسبوعي</label>
              <Input
                type="number"
                min={0}
                value={config.keep_weekly}
                onChange={(e) => void handleConfigChange({ keep_weekly: Math.max(0, Number(e.target.value)) })}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">احتفاظ شهري</label>
              <Input
                type="number"
                min={0}
                value={config.keep_monthly}
                onChange={(e) => void handleConfigChange({ keep_monthly: Math.max(0, Number(e.target.value)) })}
              />
            </div>
            <div className="flex items-end md:col-span-2">
              <p className="text-xs text-slate-400">
                مجلد النسخ الحالي: <span dir="ltr" className="font-mono">{config.backup_dir}</span>
              </p>
            </div>
          </div>
          <div className="mt-4 border-t border-slate-100 pt-4 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              0 في أي حقل = لا حد (أبقِ كل النسخ تلقائية). التحكم ينطبق على النسخ التلقائية فقط، أما اليدوية وقبل الاستيراد فتُحفظ حتى حذفها يدويًا.
            </p>
            <Button
              size="sm"
              variant="outline"
              disabled={operating}
              onClick={async () => {
                setOperating(true);
                try {
                  const res = await backupService.applyRetention();
                  toast.success(res.removed.length > 0
                    ? `تمت إزالة ${res.removed.length} نسخة قديمة`
                    : 'لا توجد نسخ قديمة لإزالتها');
                  await load(true);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : String(e));
                } finally {
                  setOperating(false);
                }
              }}
            >
              <Trash2 className="w-4 h-4 ml-1" /> تنظيف النسخ القديمة
            </Button>
          </div>
        </div>
      )}

      {/* Backups list */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-black text-slate-700">النسخ الاحتياطية</h2>
            <p className="text-xs text-slate-400 mt-1">{backups.length} نسخة متاحة</p>
          </div>
        </div>
        {backups.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            <Database className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p>لا توجد نسخ احتياطية بعد</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {backups.map((b) => (
              <div key={b.name} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Database className="w-4 h-4 text-slate-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm text-slate-700 truncate" dir="ltr">{b.name}</p>
                      {typeBadge(b)}
                      {b.verified && (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 text-[10px]">
                          موثقة ✓
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatLabel(b.label)} • {formatSize(b.size)}
                      {b.company_scope ? ` • ${b.company_scope}` : ''}
                      {b.schema_version ? ` • إصدار القاعدة ${b.schema_version}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleRestoreFromList(b.path)}
                    disabled={operating || !!pending}
                  >
                    استعادة
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>حذف النسخة الاحتياطية</AlertDialogTitle>
                        <AlertDialogDescription>
                          هل تريد حذف «{b.name}» نهائيًا؟ لا يمكن التراجع عن هذا الإجراء.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-red-600 hover:bg-red-700"
                          onClick={() => void handleDeleteBackup(b.name)}
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
      </div>
    </div>
  );
}