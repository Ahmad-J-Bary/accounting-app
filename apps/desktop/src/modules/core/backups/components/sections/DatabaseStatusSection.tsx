import { Database, HardDrive, CalendarClock, ShieldCheck, Layers, UserRound, CheckCircle2, AlertTriangle } from "lucide-react";
import pkg from "../../../../../../package.json";
import type { BackupFileInfo, BackupConfig, DatabaseInfo } from "../../../api/backupService";
import { formatSize, formatTimestamp, formatDayToken } from "../../lib/backupFormat";

interface Props {
  dbInfo: DatabaseInfo | null;
  backups: BackupFileInfo[];
  config: BackupConfig | null;
  health: "checking" | "ok" | "error";
  healthMsg: string;
  loading: boolean;
}

function Row({ icon: Icon, label, children }: { icon: typeof Database; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
      <div className="p-2 rounded-lg bg-white border border-slate-200 text-blue-600 shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold text-slate-400">{label}</p>
        <div className="text-sm font-bold text-slate-700 mt-0.5">{children}</div>
      </div>
    </div>
  );
}

export function DatabaseStatusSection({ dbInfo, backups, config, health, healthMsg, loading }: Props) {
  if (loading || !dbInfo) {
    return (
      <p className="text-sm text-slate-400 font-bold py-8 text-center">
        جاري تحميل معلومات قاعدة البيانات...
      </p>
    );
  }

  const latest = [...backups].sort((a, b) => b.timestamp - a.timestamp)[0] ?? null;
  const rollbacked = dbInfo.last_restore_status === "rolled_back";
  const restoreApplied = dbInfo.last_restore_status === "applied";

  return (
    <div className="space-y-3">
      {health === "error" ? (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-red-200 bg-red-50 text-red-700">
          <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-bold">انتباه: فشل فحص سلامة قاعدة البيانات</p>
            <p className="text-sm mt-1">{healthMsg || "يرجى إنشاء نسخة احتياطية فورًا والاتصال بالدعم."}</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800">
          <ShieldCheck className="w-6 h-6 shrink-0" />
          <div>
            <p className="font-black">قاعدة البيانات سليمة</p>
            <p className="text-xs mt-0.5">بياناتك محفوظة بشكل آمن ومتسق — لا إجراء مطلوب.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Row icon={HardDrive} label="حجم قاعدة البيانات">
          {formatSize(dbInfo.db_size_bytes)}
          <span className="block text-xs font-medium text-slate-400 mt-1">
            {dbInfo.journal_entry_count.toLocaleString("ar-EG")} قيد • {dbInfo.account_count.toLocaleString("ar-EG")} حساب
          </span>
        </Row>
        <Row icon={Layers} label="إصدار قاعدة البيانات">
          <span dir="ltr" className="font-mono text-xs">{dbInfo.schema_version}</span>
        </Row>
        <Row icon={UserRound} label="الشركة الحالية">
          {dbInfo.company_name ?? "—"}
        </Row>
        <Row icon={CalendarClock} label="آخر نسخة احتياطية">
          {latest ? formatTimestamp(latest.timestamp) : "لا توجد نسخ احتياطية بعد"}
        </Row>
        <div className="md:col-span-2">
          <Row icon={ShieldCheck} label="حالة النسخ الاحتياطي">
            <span className={dbInfo.auto_backup_enabled ? "text-emerald-600" : "text-slate-500"}>
              {dbInfo.auto_backup_enabled ? "مفعّل" : "معطّل"} (تلقائي)
            </span>
            {dbInfo.last_auto_backup ? (
              <span className="block text-xs font-medium text-slate-400 mt-1">
                آخر نسخة يومية: {formatDayToken(dbInfo.last_auto_backup)}
              </span>
            ) : null}
            {rollbacked ? (
              <span className="block text-xs font-bold text-rose-600 mt-1">⚠️ تم التراجع عن استعادة سابقة</span>
            ) : restoreApplied ? (
              <span className="block text-xs font-bold text-emerald-600 mt-1">
                <CheckCircle2 className="w-3.5 h-3.5 inline ml-1" /> اكتملت استعادة سابقة
              </span>
            ) : null}
          </Row>
        </div>
      </div>

      <p className="text-xs text-slate-400 flex items-center gap-1.5 flex-wrap">
        <Database className="w-3.5 h-3.5" />
        المسار: <span dir="ltr" className="font-mono">{dbInfo.db_path}</span>
        <span className="text-slate-300">•</span>
        إصدار التطبيق <span dir="ltr" className="font-mono">{pkg.version}</span>
      </p>
    </div>
  );
}