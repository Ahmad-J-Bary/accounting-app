import { useState, useEffect } from "react";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, RefreshCw, AlertTriangle } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { damagedService } from "@/services/inventoryService";
import { productService } from "@/services/productService";
import type { DamagedItem, CreateDamagedItemRequest, Product } from "@erp/shared-types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function Damaged() {
  const [items, setItems] = useState<DamagedItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState<Partial<CreateDamagedItemRequest>>({
    damage_date: new Date().toISOString(),
    quantity: 0,
    cost_impact: 0,
    reason: "",
    product_id: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [damagedData, productsData] = await Promise.all([
        damagedService.listDamagedItems(),
        productService.listProducts()
      ]);
      setItems(damagedData);
      setProducts(productsData);
    }
    catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = items.filter(i =>
    (i.product_name ?? i.product_id).includes(search) || i.reason.includes(search)
  );

  const totalCost = items.reduce((s, i) => s + parseFloat(i.cost_impact || "0"), 0);
  const totalQty = items.reduce((s, i) => s + parseFloat(i.quantity || "0"), 0);

  const handleCreate = async () => {
    if (!form.product_id || !form.reason || !form.quantity) return;
    setSaving(true);
    try {
      await damagedService.createDamagedItem(form as CreateDamagedItemRequest);
      setShowDialog(false);
      setForm({ damage_date: new Date().toISOString(), quantity: 0, cost_impact: 0, reason: "", product_id: "" });
      await load();
    } catch (e) { setError(String(e)); }
    finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader
        title="المواد التالفة"
        subtitle="تسجيل ومتابعة المواد والمنتجات التالفة"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "المخزون" }, { label: "التالف" }]}
        actions={
          <>
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ml-2 ${loading ? "animate-spin" : ""}`} />تحديث
            </Button>
            <Button onClick={() => setShowDialog(true)}>
              <Plus className="w-4 h-4 ml-2" />تسجيل تالف
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
          <div className="text-sm text-muted-foreground flex items-center gap-1">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> إجمالي السجلات
          </div>
          <div className="text-2xl font-bold tabular-nums mt-1">{items.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">إجمالي الكميات التالفة</div>
          <div className="text-2xl font-bold text-amber-600 tabular-nums mt-1">{totalQty.toFixed(2)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">إجمالي تأثير التكلفة</div>
          <div className="text-2xl font-bold text-red-600 tabular-nums mt-1">{formatCurrency(totalCost)}</div>
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
          <div className="text-center py-12 text-muted-foreground">لا توجد سجلات تالف</div>
        ) : (
          <div className="border border-border rounded-md overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  <th className="text-right px-4 py-3 font-medium">المنتج</th>
                  <th className="text-right px-4 py-3 font-medium">السبب</th>
                  <th className="text-right px-4 py-3 font-medium">التاريخ</th>
                  <th className="text-left px-4 py-3 font-medium">الكمية</th>
                  <th className="text-left px-4 py-3 font-medium">التكلفة</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(i => (
                  <tr key={i.id} className="border-b border-border last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{i.product_name ?? i.product_id}</td>
                    <td className="px-4 py-3 text-muted-foreground">{i.reason}</td>
                    <td className="px-4 py-3">{formatDate(i.damage_date)}</td>
                    <td className="px-4 py-3 text-left tabular-nums text-amber-600">{parseFloat(i.quantity).toFixed(2)}</td>
                    <td className="px-4 py-3 text-left tabular-nums text-red-600">{formatCurrency(parseFloat(i.cost_impact))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>تسجيل مواد تالفة</DialogTitle>
            <DialogDescription>إضافة تقرير عن أصناف تالفة لخصمها من المخزون وتسجيل الخسائر.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>المنتج *</Label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={form.product_id ?? ""} 
                onChange={e => {
                  const pid = e.target.value;
                  const prod = products.find(p => p.id === pid);
                  setForm(p => ({ 
                    ...p, 
                    product_id: pid,
                    cost_impact: prod ? parseFloat(prod.purchase_price || "0") * (p.quantity || 1) : p.cost_impact
                  }));
                }}
              >
                <option value="">اختر المنتج...</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>الكمية *</Label>
              <Input type="number" min="1" step="1"
                value={form.quantity ?? ""}
                onChange={e => {
                  const qty = parseFloat(e.target.value) || 0;
                  const prod = products.find(p => p.id === form.product_id);
                  setForm(p => ({ 
                    ...p, 
                    quantity: qty,
                    cost_impact: prod ? parseFloat(prod.purchase_price || "0") * qty : p.cost_impact
                  }));
                }} />
            </div>
            <div className="space-y-1">
              <Label>سبب التلف *</Label>
              <Input value={form.reason ?? ""} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} placeholder="استهلاك، كسر، انتهاء صلاحية..." />
            </div>
            <div className="space-y-1">
              <Label>تأثير التكلفة</Label>
              <Input type="number" min="0" step="0.01"
                value={form.cost_impact ?? ""}
                onChange={e => setForm(p => ({ ...p, cost_impact: parseFloat(e.target.value) }))} />
            </div>
            <div className="space-y-1">
              <Label>تاريخ التلف</Label>
              <Input type="date"
                value={form.damage_date?.slice(0, 10) ?? ""}
                onChange={e => setForm(p => ({ ...p, damage_date: new Date(e.target.value).toISOString() }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>إلغاء</Button>
            <Button onClick={handleCreate} disabled={saving || !form.product_id || !form.reason || !form.quantity}>
              {saving ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}