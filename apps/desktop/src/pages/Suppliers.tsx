import { useState, useEffect } from "react";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { Plus, Download, Search, MoreHorizontal, Eye, Edit, Printer, RefreshCw } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supplierService } from "@/services/supplierService";
import type { Supplier } from "@erp/shared-types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSuppliers = async () => {
    setLoading(true);
    try {
      const data = await supplierService.listSuppliers();
      setSuppliers(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSuppliers(); }, []);

  const filtered = suppliers.filter(s =>
    s.name.includes(search) || s.phone.includes(search) || (s.email ?? "").includes(search)
  );

  const totalBalance = suppliers.reduce((sum, s) => sum + parseFloat(s.balance || "0"), 0);
  const activeCount = suppliers.filter(s => s.is_active).length;

  const handleCreate = async () => {
    if (!form.name || !form.phone) return;
    setSaving(true);
    try {
      await supplierService.createSupplier({
        name: form.name,
        phone: form.phone,
        email: form.email || undefined,
        address: form.address || undefined,
      });
      setShowDialog(false);
      setForm({ name: "", phone: "", email: "", address: "" });
      await loadSuppliers();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="الموردون"
        subtitle="إدارة قاعدة بيانات الموردين وأرصدتهم"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "الموردون" }]}
        actions={
          <>
            <Button variant="outline" onClick={loadSuppliers} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ml-2 ${loading ? "animate-spin" : ""}`} />
              تحديث
            </Button>
            <Button onClick={() => setShowDialog(true)}>
              <Plus className="w-4 h-4 ml-2" />مورد جديد
            </Button>
          </>
        }
      />

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          {error}
          <button className="mr-2 underline" onClick={() => setError(null)}>إغلاق</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">إجمالي الموردين</div>
          <div className="text-2xl font-bold tabular-nums mt-1">{suppliers.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">الموردون النشطون</div>
          <div className="text-2xl font-bold text-green-600 tabular-nums mt-1">{activeCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">إجمالي الذمم الدائنة</div>
          <div className="text-2xl font-bold text-red-600 tabular-nums mt-1">{formatCurrency(totalBalance)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">موردون بأرصدة</div>
          <div className="text-2xl font-bold tabular-nums mt-1">
            {suppliers.filter(s => parseFloat(s.balance) > 0).length}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="بحث بالاسم أو الهاتف..."
              className="pr-10"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {search ? "لا توجد نتائج للبحث" : "لا يوجد موردون — أضف مورداً جديداً"}
          </div>
        ) : (
          <div className="border border-border rounded-md overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  <th className="text-right px-4 py-3 font-medium">اسم المورد</th>
                  <th className="text-right px-4 py-3 font-medium">الهاتف</th>
                  <th className="text-right px-4 py-3 font-medium">البريد</th>
                  <th className="text-right px-4 py-3 font-medium">العنوان</th>
                  <th className="text-left px-4 py-3 font-medium">الرصيد</th>
                  <th className="text-left px-4 py-3 font-medium">الحالة</th>
                  <th className="text-left px-4 py-3 font-medium w-12"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3 tabular-nums">{s.phone}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{s.email ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{s.address ?? "—"}</td>
                    <td className="px-4 py-3 text-left tabular-nums font-medium">
                      {formatCurrency(parseFloat(s.balance))}
                    </td>
                    <td className="px-4 py-3 text-left">
                      <StatusBadge status={s.is_active ? "active" : "inactive"} />
                    </td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem><Eye className="w-4 h-4 ml-2" />عرض</DropdownMenuItem>
                          <DropdownMenuItem><Edit className="w-4 h-4 ml-2" />تعديل</DropdownMenuItem>
                          <DropdownMenuItem><Printer className="w-4 h-4 ml-2" />كشف حساب</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create Supplier Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة مورد جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>اسم المورد *</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="أدخل اسم المورد" />
            </div>
            <div className="space-y-1">
              <Label>رقم الهاتف *</Label>
              <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="05xxxxxxxx" />
            </div>
            <div className="space-y-1">
              <Label>البريد الإلكتروني</Label>
              <Input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="example@email.com" type="email" />
            </div>
            <div className="space-y-1">
              <Label>العنوان</Label>
              <Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="عنوان المورد" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>إلغاء</Button>
            <Button onClick={handleCreate} disabled={saving || !form.name || !form.phone}>
              {saving ? "جاري الحفظ..." : "حفظ المورد"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}