import { useState, useEffect } from "react";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, RefreshCw } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { adjustmentService } from "@/services/inventoryService";
import { materialService } from "@/services/materialService";
import type { StockAdjustment, CreateStockAdjustmentRequest, MaterialDto } from "@erp/shared-types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function Adjustments() {
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [products, setProducts] = useState<MaterialDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState<Partial<CreateStockAdjustmentRequest>>({
    adjustment_date: new Date().toISOString(),
    actual_quantity: 0,
    product_id: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [adjData, productsData] = await Promise.all([
        adjustmentService.listStockAdjustments(),
        materialService.listMaterials()
      ]);
      setAdjustments(adjData);
      setProducts(productsData);
    }
    catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = adjustments.filter(a =>
    (a.product_name ?? a.product_id).includes(search) ||
    (a.reason ?? "").includes(search)
  );

  const surplusCount = adjustments.filter(a => parseFloat(a.difference) > 0).length;
  const shortageCount = adjustments.filter(a => parseFloat(a.difference) < 0).length;

  const handleCreate = async () => {
    if (!form.product_id || form.actual_quantity === undefined || !form.adjustment_date) return;
    setSaving(true);
    try {
      await adjustmentService.createStockAdjustment(form as CreateStockAdjustmentRequest);
      setShowDialog(false);
      setForm({ adjustment_date: new Date().toISOString(), actual_quantity: 0, product_id: "" });
      await load();
    } catch (e) { setError(String(e)); }
    finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader
        title="تسويات الجرد"
        subtitle="مطابقة المخزون الفعلي مع سجلات النظام"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "المخزون" }, { label: "التسويات" }]}
        actions={
          <>
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ml-2 ${loading ? "animate-spin" : ""}`} />تحديث
            </Button>
            <Button onClick={() => setShowDialog(true)}>
              <Plus className="w-4 h-4 ml-2" />تسوية جديدة
            </Button>
          </>
        }
      />

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          {error} <button className="mr-2 underline" onClick={() => setError(null)}>إغلاق</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">إجمالي التسويات</div>
          <div className="text-2xl font-bold tabular-nums mt-1">{adjustments.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">فائض مخزون</div>
          <div className="text-2xl font-bold text-green-600 tabular-nums mt-1">{surplusCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">عجز مخزون</div>
          <div className="text-2xl font-bold text-red-600 tabular-nums mt-1">{shortageCount}</div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="بحث بالمنتج أو السبب..." className="pr-10"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">لا توجد تسويات مسجّلة</div>
        ) : (
          <div className="border border-border rounded-md overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  <th className="text-right px-4 py-3 font-medium">المنتج</th>
                  <th className="text-right px-4 py-3 font-medium">التاريخ</th>
                  <th className="text-left px-4 py-3 font-medium">كمية النظام</th>
                  <th className="text-left px-4 py-3 font-medium">الكمية الفعلية</th>
                  <th className="text-left px-4 py-3 font-medium">الفارق</th>
                  <th className="text-right px-4 py-3 font-medium">السبب</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => {
                  const diff = parseFloat(a.difference);
                  return (
                    <tr key={a.id} className="border-b border-border last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium">{a.product_name ?? a.product_id}</td>
                      <td className="px-4 py-3">{formatDate(a.adjustment_date)}</td>
                      <td className="px-4 py-3 text-left tabular-nums">{parseFloat(a.system_quantity).toFixed(2)}</td>
                      <td className="px-4 py-3 text-left tabular-nums">{parseFloat(a.actual_quantity).toFixed(2)}</td>
                      <td className={`px-4 py-3 text-left tabular-nums font-bold ${diff > 0 ? "text-green-600" : diff < 0 ? "text-red-600" : ""}`}>
                        {diff > 0 ? "+" : ""}{diff.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{a.reason ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>تسوية جرد جديدة</DialogTitle>
            <DialogDescription>تحديث كمية المخزون الفعلي لتتناسب مع الكمية الموجودة في المستودع.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>المنتج *</Label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={form.product_id ?? ""} 
                onChange={e => setForm(p => ({ ...p, product_id: e.target.value }))}
              >
                <option value="">اختر المنتج...</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>الكمية الفعلية المعدودة *</Label>
              <Input type="number" min="0" step="1"
                value={form.actual_quantity ?? ""}
                onChange={e => setForm(p => ({ ...p, actual_quantity: parseFloat(e.target.value) }))} />
            </div>
            <div className="space-y-1">
              <Label>سبب التسوية</Label>
              <Input value={form.reason ?? ""} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} placeholder="جرد دوري، خطأ إدخال..." />
            </div>
            <div className="space-y-1">
              <Label>تاريخ التسوية</Label>
              <Input type="date"
                value={form.adjustment_date?.slice(0, 10) ?? ""}
                onChange={e => setForm(p => ({ ...p, adjustment_date: new Date(e.target.value).toISOString() }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>إلغاء</Button>
            <Button onClick={handleCreate} disabled={saving || !form.product_id || !form.actual_quantity}>
              {saving ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}