import {
  Database, HardDrive, ListChecks, Users, Layers, Building2,
  CalendarClock, ShieldCheck, AlertTriangle, CheckCircle2, XCircle, Loader2,
} from "lucide-react";
import pkg from "../../../../../../package.json";
import type { BackupFileInfo, BackupConfig, DatabaseInfo } from "../../../api/backupService";
import {
  formatSize, formatTimestamp, formatDayToken, backupStatus,
} from "../../lib/backupFormat";

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

  const latest =
    [...backups].sort((a, b) => b.timestamp - a.timestamp)[0] ?? null;
  const latestStatus = latest ? backupStatus(latest) : null;
  const rollbacked = dbInfo.last_restore_status === "rolled_back";
  const restoreApplied = dbInfo.last_restore_status === "applied";

  return (
    <div className="space-y-3">
      {/* Hero status card */}
      {health === "error" ? (
        <div className="rounded-2xl border border-red-200 bg-gradient-to-br from-red-50 to-rose-50/60 p-6 flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-red-500 text-white flex items-center justify-center shrink-0">
            <AlertTriangle className="w-9 h-9" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-500">قاعدة البيانات</p>
            <p className="text-2xl font-black text-red-700">يتطلب انتباهًا</p>
            <p className="text-xs font-medium text-red-600 mt-0.5">
              {healthMsg || "فشل فحص السلامة — يرجى إنشاء نسخة احتياطية فورًا والاتصال بالدعم."}
            </p>
          </div>
        </div>
      ) : health === "checking" ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-200 text-slate-500 flex items-center justify-center shrink-0">
            <Loader2 className="w-9 h-9 animate-spin" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-500">قاعدة البيانات</p>
            <p className="text-2xl font-black text-slate-600">جاري الفحص...</p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50/60 p-6 flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
            <ShieldCheck className="w-9 h-9" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-500">قاعدة البيانات</p>
            <p className="text-2xl font-black text-emerald-700">✓ سليمة</p>
            <p className="text-xs font-medium text-emerald-700/80 mt-0.5">
              بياناتك محفوظة بشكل آمن ومتسق — لا إجراء مطلوب.
            </p>
          </div>
        </div>
      )}

      {/* State strip: auto backup + last restore flags */}
      <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500 px-1">
        <span className={dbInfo.auto_backup_enabled ? "text-emerald-600" : "text-slate-400"}>
          {dbInfo.auto_backup_enabled ? "النسخ التلقائي مفعّل" : "النسخ التلقائي معطّل"}
        </span>
        {dbInfo.last_auto_backup ? (
          <span className="text-slate-400">
            • آخر نسخة يومية: {formatDayToken(dbInfo.last_auto_backup)}
          </span>
        ) : null}
        {rollbacked ? (
          <span className="text-rose-600">
            • ⚠ تم التراجع عن استعادة سابقة
          </span>
        ) : restoreApplied ? (
          <span className="text-emerald-600">
            • <CheckCircle2 className="w-3.5 h-3.5 inline ml-0.5" /> اكتملت استعادة سابقة
          </span>
        ) : null}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Row icon={HardDrive} label="حجم قاعدة البيانات">
          {formatSize(dbInfo.db_size_bytes)}
        </Row>
        <Row icon={Layers} label="إصدار قاعدة البيانات">
          <span dir="ltr" className="font-mono text-xs">{dbInfo.schema_version}</span>
        </Row>
        <Row icon={ListChecks} label="عدد القيود">
          {dbInfo.journal_entry_count.toLocaleString("ar-EG")}
        </Row>
        <Row icon={Users} label="عدد الحسابات">
          {dbInfo.account_count.toLocaleString("ar-EG")}
        </Row>
        <Row icon={Building2} label="الشركة الحالية">
          {dbInfo.company_name ?? "—"}
        </Row>
        <Row icon={CalendarClock} label="آخر نسخة احتياطية">
          {latest ? (
            <>
              {formatTimestamp(latest.timestamp)}
              {latestStatus && (
                <span
                  className={`inline-flex items-center gap-1 mt-1 rounded-full px-2 py-0.5 ring-1 ring-inset text-[10px] font-bold ${
                    latestStatus.tone === "emerald"
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-200 border border-emerald-200"
                      : latestStatus.tone === "rose"
                        ? "bg-rose-50 text-rose-700 ring-rose-200 border border-rose-200"
                        : "bg-amber-50 text-amber-700 ring-amber-200 border border-amber-200"
                  }`}
                >
                  {latestStatus.tone === "emerald" ? (
                    <CheckCircle2 className="w-3 h-3" />
                  ) : latestStatus.tone === "rose" ? (
                    <XCircle className="w-3 h-3" />
                  ) : (
                    <AlertTriangle className="w-3 h-3" />
                  )}
                  {latestStatus.label}
                </span>
              )}
            </>
          ) : (
            "لا توجد نسخ احتياطية بعد"
          )}
        </Row>
      </div>

      {/* Advanced details — technical info tucked away */}
      <details className="rounded-xl border border-slate-100 bg-white p-3 group">
        <summary className="cursor-pointer text-xs font-bold text-slate-500 flex items-center gap-1.5 select-none">
          <Database className="w-3.5 h-3.5" />
          تفاصيل متقدمة
          <span className="text-slate-300 transition-transform group-open:rotate-90">◂</span>
        </summary>
        <div className="mt-2 space-y-1 text-[11px] font-mono text-slate-400" dir="ltr">
          <p>المسار: {dbInfo.db_path}</p>
          <p>إصدار التطبيق: {pkg.version}</p>
        </div>
      </details>
    </div>
  );
}