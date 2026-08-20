import { useState } from "react";
import { Download, FileDown, CheckCircle2 } from "lucide-react";
import { save } from "@tauri-apps/plugin-dialog";
import { Button } from "@shared/ui/button";
import { toast } from "sonner";
import { backupService } from "../../../api/backupService";

export function ExportPanel({ onDone }: { onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const handleExport = async () => {
    setBusy(true);
    setDone(false);
    try {
      const path = await save({
        defaultPath: `erp_export_${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "")}.sqlite`,
        filters: [{ name: "قاعدة بيانات SQLite", extensions: ["sqlite", "db"] }],
      });
      if (!path) return;
      await backupService.exportToFile(path);
      setDone(true);
      toast.success("تم تصدير قاعدة البيانات بنجاح");
      await onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="font-bold text-slate-600 text-sm">تصدير قاعدة البيانات</p>
        <p className="text-xs text-slate-400 mt-1">
          تنشئ ملف قاعدة بيانات مستقلًا (SQLite) في المكان الذي تختاره — نسخة كاملة وقابلة للنقل لأي جهاز.
        </p>
      </div>

      <Button
        size="sm"
        variant="outline"
        className="h-10"
        disabled={busy}
        onClick={() => void handleExport()}
      >
        {busy ? <FileDown className="w-4 h-4 ml-1 animate-pulse" /> : <Download className="w-4 h-4 ml-1" />}
        {busy ? "جارٍ التصدير..." : "تصدير قاعدة البيانات"}
      </Button>

      {done && (
        <div className="flex items-center gap-2 text-xs font-bold text-emerald-600">
          <CheckCircle2 className="w-4 h-4" /> اكتمل التصدير بنجاح
        </div>
      )}
    </div>
  );
}