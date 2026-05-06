import { useState, useEffect } from "react";
import { PageHeader } from '@widgets/page-header/PageHeader';
import { Card } from "@shared/ui/card";
import { Input } from "@shared/ui/input";
import { Search, RefreshCw, Activity, Shield } from "lucide-react";
import { formatDate } from '@shared/lib/format';
import { auditService } from '@modules/core/api/auditService';
import type { AuditLog } from "@erp/shared-types";
import { Button } from "@shared/ui/button";

export default function AuditLog() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try { setLogs(await auditService.listAuditLogs(500)); }
    catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = logs.filter(l =>
    l.username.includes(search) || 
    l.action.includes(search) || 
    l.entity_type.includes(search) ||
    (l.entity_id ?? "").includes(search)
  );

  return (
    <>
      <PageHeader
        title="سجل مراقبة النظام"
        subtitle="تتبع كافة الإجراءات والعمليات المنفذة في النظام"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "النظام" }, { label: "سجل العمليات" }]}
        actions={
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ml-2 ${loading ? "animate-spin" : ""}`} />تحديث
          </Button>
        }
      />

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          {error} <button className="mr-2 underline" onClick={() => setError(null)}>إغلاق</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground flex items-center gap-1">
            <Activity className="w-4 h-4 text-blue-500" /> إجمالي العمليات المسجلة
          </div>
          <div className="text-2xl font-bold tabular-nums mt-1">{logs.length} (آخر 500 عملية)</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground flex items-center gap-1">
            <Shield className="w-4 h-4 text-primary" /> مستوى الأمان
          </div>
          <div className="text-2xl font-bold text-green-600 mt-1 flex items-center">
            نشط <span className="text-sm text-muted-foreground mr-2 font-normal">(مراقبة شاملة)</span>
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="بحث بالمستخدم، نوع العملية، معرف الكيان..." className="pr-10"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">لا يوجد سجلات مطابقة للبحث</div>
        ) : (
          <div className="border border-border rounded-md overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  <th className="text-right px-4 py-3 font-medium">التاريخ والوقت</th>
                  <th className="text-right px-4 py-3 font-medium">المستخدم</th>
                  <th className="text-right px-4 py-3 font-medium">العملية</th>
                  <th className="text-right px-4 py-3 font-medium">نوع الكيان</th>
                  <th className="text-right px-4 py-3 font-medium">معرف الكيان</th>
                  <th className="text-left px-4 py-3 font-medium">IP Address</th>
                </tr>
              </thead>
              <tbody className="font-mono text-xs">
                {filtered.map(l => (
                  <tr key={l.id} className="border-b border-border last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3">{formatDate(l.created_at)}</td>
                    <td className="px-4 py-3">{l.username}</td>
                    <td className="px-4 py-3 text-blue-600 font-bold">{l.action}</td>
                    <td className="px-4 py-3">{l.entity_type}</td>
                    <td className="px-4 py-3 text-muted-foreground">{l.entity_id ?? "—"}</td>
                    <td className="px-4 py-3 text-left">{l.ip_address ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
