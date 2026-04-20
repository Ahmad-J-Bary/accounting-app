import { useState, useEffect } from "react";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, RefreshCw, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { paymentService } from "@/services/paymentService";
import type { Payment, CreatePaymentRequest } from "@erp/shared-types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  Receipt: "قبض من عميل",
  SupplierPayment: "دفع لمورد",
  CashIn: "إيداع نقدي",
  CashOut: "سحب نقدي",
  Other: "أخرى",
};

export default function Payments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState<Partial<CreatePaymentRequest>>({
    payment_type: "Receipt",
    amount: 0,
    payment_date: new Date().toISOString(),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setPayments(await paymentService.listPayments());
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = payments.filter(p => {
    const matchType = typeFilter === "all" || p.payment_type === typeFilter;
    const matchSearch =
      (p.customer_name ?? "").includes(search) ||
      (p.supplier_name ?? "").includes(search) ||
      (p.reference ?? "").includes(search);
    return matchType && matchSearch;
  });

  const totalIn = payments
    .filter(p => ["Receipt", "CashIn"].includes(p.payment_type))
    .reduce((s, p) => s + parseFloat(p.amount), 0);
  const totalOut = payments
    .filter(p => ["SupplierPayment", "CashOut"].includes(p.payment_type))
    .reduce((s, p) => s + parseFloat(p.amount), 0);

  const handleCreate = async () => {
    if (!form.payment_type || !form.amount || !form.payment_date) return;
    setSaving(true);
    try {
      await paymentService.createPayment(form as CreatePaymentRequest);
      setShowDialog(false);
      await load();
    } catch (e) { setError(String(e)); }
    finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader
        title="المدفوعات والمقبوضات"
        subtitle="إدارة حركات الصندوق والبنك"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "المدفوعات" }]}
        actions={
          <>
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ml-2 ${loading ? "animate-spin" : ""}`} />تحديث
            </Button>
            <Button onClick={() => setShowDialog(true)}>
              <Plus className="w-4 h-4 ml-2" />حركة جديدة
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
          <div className="text-sm text-muted-foreground">إجمالي الحركات</div>
          <div className="text-2xl font-bold tabular-nums mt-1">{payments.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground flex items-center gap-1">
            <ArrowDownCircle className="w-4 h-4 text-green-500" /> إجمالي المقبوضات
          </div>
          <div className="text-2xl font-bold text-green-600 tabular-nums mt-1">{formatCurrency(totalIn)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground flex items-center gap-1">
            <ArrowUpCircle className="w-4 h-4 text-red-500" /> إجمالي المدفوعات
          </div>
          <div className="text-2xl font-bold text-red-600 tabular-nums mt-1">{formatCurrency(totalOut)}</div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="بحث..." className="pr-10" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الأنواع</SelectItem>
              {Object.entries(PAYMENT_TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">لا توجد حركات</div>
        ) : (
          <div className="border border-border rounded-md overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  <th className="text-right px-4 py-3 font-medium">التاريخ</th>
                  <th className="text-right px-4 py-3 font-medium">النوع</th>
                  <th className="text-right px-4 py-3 font-medium">الطرف</th>
                  <th className="text-right px-4 py-3 font-medium">المرجع</th>
                  <th className="text-left px-4 py-3 font-medium">المبلغ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const isIn = ["Receipt", "CashIn"].includes(p.payment_type);
                  return (
                    <tr key={p.id} className="border-b border-border last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-3">{formatDate(p.payment_date)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${isIn ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {isIn ? <ArrowDownCircle className="w-3 h-3" /> : <ArrowUpCircle className="w-3 h-3" />}
                          {PAYMENT_TYPE_LABELS[p.payment_type]}
                        </span>
                      </td>
                      <td className="px-4 py-3">{p.customer_name ?? p.supplier_name ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{p.reference ?? "—"}</td>
                      <td className={`px-4 py-3 text-left tabular-nums font-medium ${isIn ? "text-green-600" : "text-red-600"}`}>
                        {isIn ? "+" : "-"}{formatCurrency(parseFloat(p.amount))}
                      </td>
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
          <DialogHeader><DialogTitle>إضافة حركة نقدية</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>نوع الحركة</Label>
              <Select value={form.payment_type} onValueChange={v => setForm(p => ({ ...p, payment_type: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>المبلغ *</Label>
              <Input type="number" min="0" step="0.01"
                value={form.amount ?? ""}
                onChange={e => setForm(p => ({ ...p, amount: parseFloat(e.target.value) }))} />
            </div>
            <div className="space-y-1">
              <Label>التاريخ</Label>
              <Input type="date"
                value={form.payment_date?.slice(0, 10) ?? ""}
                onChange={e => setForm(p => ({ ...p, payment_date: new Date(e.target.value).toISOString() }))} />
            </div>
            <div className="space-y-1">
              <Label>المرجع</Label>
              <Input value={form.reference ?? ""} onChange={e => setForm(p => ({ ...p, reference: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>إلغاء</Button>
            <Button onClick={handleCreate} disabled={saving || !form.amount}>
              {saving ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}