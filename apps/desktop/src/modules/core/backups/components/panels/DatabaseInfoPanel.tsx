import { Database, HardDrive, CalendarClock, ShieldCheck, Layers, AppWindow } from "lucide-react";
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

export function DatabaseInfoPanel({ dbInfo, backups, config, health, healthMsg, loading }: Props) {
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <Row icon={Database} label="موقع قاعدة البيانات">
        <span dir="ltr" className="font-mono text-xs break-all">{dbInfo.db_path}</span>
        {dbInfo.company_name ? (
          <span className="block text-xs font-medium text-slate-400 mt-1">الشركة: {dbInfo.company_name}</span>
        ) : null}
      </Row>
      <Row icon={HardDrive} label="حجم قاعدة البيانات">
        {formatSize(dbInfo.db_size_bytes)}
        <span className="block text-xs font-medium text-slate-400 mt-1">
          {dbInfo.journal_entry_count.toLocaleString("ar-EG")} قيد • {dbInfo.account_count.toLocaleString("ar-EG")} حساب
        </span>
      </Row>
      <Row icon={CalendarClock} label="آخر نسخة احتياطية">
        {latest ? formatTimestamp(latest.timestamp) : "لا توجد نسخ احتياطية بعد"}
      </Row>
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
          <span className="block text-xs font-bold text-emerald-600 mt-1">✓ اكتملت استعادة سابقة</span>
        ) : null}
      </Row>
      <Row icon={Layers} label="إصدار قاعدة البيانات">
        <span dir="ltr" className="font-mono text-xs">{dbInfo.schema_version}</span>
      </Row>
      <Row icon={AppWindow} label="إصدار التطبيق">
        <span dir="ltr" className="font-mono text-xs">{pkg.version}</span>
      </Row>
      {health === "error" ? (
        <div className="md:col-span-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
          فشل فحص سلامة قاعدة البيانات: {healthMsg || "يرجى إنشاء نسخة احتياطية فورًا والاتصال بالدعم."}
        </div>
      ) : null}
      {config?.last_restore_status === "rolled_back" ? (
        <div className="md:col-span-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
          تم التراجع عن الاستعادة تلقائيًا — رُفضت البيانات المستوردة بعد الفحص وتمت استعادة قاعدتك السابقة. بياناتك السابقة
          سليمة.
        </div>
      ) : null}
    </div>
  );
}