import { useState, useEffect } from "react";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, RefreshCw, Factory, CheckCircle } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { productionService } from "@/services/inventoryService";
import type { ProductionOrder } from "@erp/shared-types";

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  Draft: { label: "مسودة", cls: "bg-slate-100 text-slate-700" },
  InProgress: { label: "جاري", cls: "bg-blue-100 text-blue-700" },
  Completed: { label: "مكتمل", cls: "bg-green-100 text-green-700" },
  Cancelled: { label: "ملغي", cls: "bg-red-100 text-red-700" },
};

export default function Production() {
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try { setOrders(await productionService.listProductionOrders()); }
    catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = orders.filter(o => o.order_number.includes(search));
  const completed = orders.filter(o => o.status === "Completed").length;
  const inProgress = orders.filter(o => o.status === "InProgress").length;
  const totalCost = orders.reduce((s, o) => s + parseFloat(o.total_cost || "0"), 0);

  return (
    <>
      <PageHeader
        title="أوامر الإنتاج"
        subtitle="إدارة عمليات الإنتاج واستهلاك المواد الخام"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "الإنتاج" }]}
        actions={
          <>
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ml-2 ${loading ? "animate-spin" : ""}`} />تحديث
            </Button>
            <Button>
              <Plus className="w-4 h-4 ml-2" />أمر إنتاج جديد
            </Button>
          </>
        }
      />

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          {error} <button className="mr-2 underline" onClick={() => setError(null)}>إغلاق</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground flex items-center gap-1">
            <Factory className="w-4 h-4" /> إجمالي الأوامر
          </div>
          <div className="text-2xl font-bold tabular-nums mt-1">{orders.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">جاري التنفيذ</div>
          <div className="text-2xl font-bold text-blue-600 tabular-nums mt-1">{inProgress}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground flex items-center gap-1">
            <CheckCircle className="w-4 h-4 text-green-500" /> مكتملة
          </div>
          <div className="text-2xl font-bold text-green-600 tabular-nums mt-1">{completed}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">إجمالي تكاليف الإنتاج</div>
          <div className="text-xl font-bold text-primary tabular-nums mt-1">{formatCurrency(totalCost)}</div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="بحث برقم الأمر..." className="pr-10"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">لا توجد أوامر إنتاج</div>
        ) : (
          <div className="border border-border rounded-md overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  <th className="text-right px-4 py-3 font-medium">رقم الأمر</th>
                  <th className="text-right px-4 py-3 font-medium">التاريخ</th>
                  <th className="text-left px-4 py-3 font-medium">المواد</th>
                  <th className="text-left px-4 py-3 font-medium">المنتجات</th>
                  <th className="text-left px-4 py-3 font-medium">إجمالي التكلفة</th>
                  <th className="text-left px-4 py-3 font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => {
                  const st = STATUS_MAP[o.status] ?? { label: o.status, cls: "bg-slate-100 text-slate-700" };
                  return (
                    <tr key={o.id} className="border-b border-border last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-primary">{o.order_number}</td>
                      <td className="px-4 py-3">{formatDate(o.production_date)}</td>
                      <td className="px-4 py-3 text-left tabular-nums">{o.materials.length}</td>
                      <td className="px-4 py-3 text-left tabular-nums">{o.outputs.length}</td>
                      <td className="px-4 py-3 text-left tabular-nums font-medium">{formatCurrency(parseFloat(o.total_cost))}</td>
                      <td className="px-4 py-3 text-left">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}