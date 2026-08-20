import { AlertTriangle, RefreshCw } from "lucide-react";
import type { StartupBlockInfo } from "@modules/core/api/backupService";

interface Props {
  block: StartupBlockInfo;
}

/**
 * Full-screen gate shown when the database schema is newer than the running app
 * build. The app deliberately refuses to open or migrate such a database to
 * protect its migration ledger; the user must update the application.
 */
export default function UpdateRequiredScreen({ block }: Props) {
  return (
    <div dir="rtl" className="min-h-screen w-full flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white shadow-sm p-8 text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mb-4">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-black text-slate-800 mb-2">قاعدة البيانات من إصدار أحدث</h1>
        <p className="text-sm text-slate-500 leading-relaxed mb-6">
          نسخة قاعدة البيانات هذه أُعدّت بإصدار أحدث من التطبيق، ولا يمكن فتحها أو ترقيتها
          من هذه النسخة حفاظًا على سلامة بياناتك وقيودك المحاسبية.
        </p>
        <div className="flex items-center justify-center gap-4 rounded-xl bg-slate-50 border border-slate-100 p-4 mb-6 text-sm font-bold text-slate-700">
          <span>
            إصدار القاعدة: <span dir="ltr" className="font-mono">{block.found_version}</span>
          </span>
          <span className="text-slate-300">|</span>
          <span>
            الإصدار المتاح لديك: <span dir="ltr" className="font-mono">{block.supported_version}</span>
          </span>
        </div>
        <div className="flex items-center gap-2 justify-center text-xs text-slate-400 font-bold">
          <RefreshCw className="w-4 h-4" />
          يُرجى تحديث التطبيق إلى أحدث إصدار ثم إعادة المحاولة.
        </div>
      </div>
    </div>
  );
}