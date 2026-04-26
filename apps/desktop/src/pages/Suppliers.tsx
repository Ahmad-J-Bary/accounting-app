import { useState, useEffect } from "react";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Download, Search, MoreHorizontal, Eye, Edit, Trash2, Phone, MapPin, Printer, RefreshCw } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { supplierService } from "@/services/supplierService";
import { accountingService } from "@/services/accountingService";
import type { AccountDto } from "@erp/shared-types";
import { invoiceService } from "@/services/invoiceService";
import { paymentService } from "@/services/paymentService";
import type { SupplierDto, InvoiceDto, Payment, CreateSupplierRequest, UpdateSupplierRequest } from "@erp/shared-types";

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  
  // Linked data for selected supplier
  const [supplierInvoices, setSupplierInvoices] = useState<InvoiceDto[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<Payment[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [showDialog, setShowDialog] = useState(false);
  const [editSupplier, setEditSupplier] = useState<SupplierDto | null>(null);
  const [form, setForm] = useState({ code: "", name: "", phone: "", address: "", notes: "" });
  // New accounting-related fields
  const [linkedAccountId, setLinkedAccountId] = useState<string>("null");
  const [openingBalance, setOpeningBalance] = useState<string>("0");
  const [debit, setDebit] = useState<string>("0");
  const [credit, setCredit] = useState<string>("0");
  const [currency, setCurrency] = useState<string>("USD");
  const [accountsForLink, setAccountsForLink] = useState<AccountDto[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAccountsForLink = async () => {
    try {
      const accounts = await accountingService.getChartOfAccounts();
      // Filter for Liabilities accounts (payables) starting with 223 (المستوى 3 والمستوى 4)
      const filtered = accounts.filter((a) => a.account_type === "Liabilities" && (a.code === "223" || a.code.startsWith("223")));
      setAccountsForLink(filtered);
      // Auto-select the "223" parent account for new suppliers
      const parent223 = accounts.find((a) => a.code === "223");
      if (parent223) {
        setLinkedAccountId(parent223.id);
      }
    } catch {
      // ignore
    }
  };

  const loadSuppliers = async () => {
    setLoading(true);
    try {
      const data = await supplierService.listSuppliers();
      setSuppliers(data);
    } catch (e) {
      setError(String(e));
      toast.error("فشل تحميل الموردين");
    } finally {
      setLoading(false);
    }
    await loadAccountsForLink();
  };

  const fetchSupplierDetails = async (id: string) => {
    setLoadingDetails(true);
    try {
      const [invoices, payments] = await Promise.all([
        invoiceService.listInvoicesByType("Purchase").then(list => list.filter(inv => inv.supplier_id === id)),
        paymentService.listPayments(undefined, id) // Pass as supplier_id
      ]);
      setSupplierInvoices(invoices);
      setSupplierPayments(payments);
    } catch (error) {
      console.error("Failed to load supplier details:", error);
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => { 
    void loadSuppliers(); 

    const handleOpenNew = () => {
      setEditSupplier(null);
      setForm({ code: "", name: "", phone: "", address: "", notes: "" });
      setLinkedAccountId("null");
      setOpeningBalance("0");
      setDebit("0");
      setCredit("0");
      setCurrency("SYP");
      setShowDialog(true);
    };

    window.addEventListener("erp:open-new-supplier", handleOpenNew);
    return () => window.removeEventListener("erp:open-new-supplier", handleOpenNew);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedId) {
      fetchSupplierDetails(selectedId);
    }
  }, [selectedId]);

  const current = suppliers.find(s => s.id === selectedId);

  const filtered = suppliers.filter(s => {
    const q = (search || "").toLowerCase();
    const nameMatch = (s.name || "").toLowerCase().includes(q);
    const phoneMatch = (s.phone || "").toLowerCase().includes(q);
    return nameMatch || phoneMatch;
  });

  const totalBalance = suppliers.reduce((sum, s) => sum + parseFloat(s.balance || "0"), 0);
  const activeCount = suppliers.filter(s => s.is_active).length;

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      if (editSupplier) {
        const updatePayload: UpdateSupplierRequest = {
          id: editSupplier.id,
          code: form.code,
          name: form.name,
          phone: form.phone || null,
          address: form.address || null,
          notes: form.notes || null,
          account_id: linkedAccountId === "null" ? null : linkedAccountId,
          opening_balance: openingBalance,
          debit,
          credit,
          currency,
          is_active: editSupplier.is_active,
        };
        await supplierService.updateSupplier(updatePayload);
        toast.success("تم تحديث بيانات المورد بنجاح");
      } else {
        const createPayload: CreateSupplierRequest = {
          code: form.code,
          name: form.name,
          phone: form.phone || null,
          address: form.address || null,
          notes: form.notes || null,
          account_id: linkedAccountId === "null" ? null : linkedAccountId,
          opening_balance: openingBalance,
          debit,
          credit,
          currency,
          is_active: true,
        };
        await supplierService.createSupplier(createPayload);
        toast.success("تم إضافة المورد بنجاح");
      }
      setShowDialog(false);
      setForm({ code: "", name: "", phone: "", address: "", notes: "" });
      setLinkedAccountId("null");
      setOpeningBalance("0");
      setDebit("0");
      setCredit("0");
      setCurrency("SYP");
      setEditSupplier(null);
      await loadSuppliers();
    } catch (e) {
      setError(String(e));
      toast.error("خطأ في العملية");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف المورد ${name}؟`)) return;
    try {
      await supplierService.deleteSupplier(id);
      toast.success("تم حذف المورد بنجاح");
      loadSuppliers();
    } catch (e) {
      toast.error("خطأ في الحذف: " + e);
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
              <RefreshCw className={`w-4 h-4 ml-2 ${loading ? "animate-spin" : ""}`} />تحديث
            </Button>
            <Button onClick={() => {
              setEditSupplier(null);
              setForm({ code: "", name: "", phone: "", address: "", notes: "" });
              setLinkedAccountId("null");
              setOpeningBalance("0");
              setDebit("0");
              setCredit("0");
              setCurrency("SYP");
              setShowDialog(true);
            }}>
              <Plus className="w-4 h-4 ml-2" />مورد جديد
            </Button>
          </>
        }
      />

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
                  <th className="text-left px-4 py-3 font-medium">المدين</th>
                  <th className="text-left px-4 py-3 font-medium">الدائن</th>
                  <th className="text-left px-4 py-3 font-medium">الرصيد</th>
                  <th className="text-left px-4 py-3 font-medium">الحالة</th>
                  <th className="text-left px-4 py-3 font-medium w-12"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0 hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedId(s.id)}>
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3 tabular-nums">{s.phone || "—"}</td>
                    <td className="px-4 py-3 text-left tabular-nums text-red-600">{formatCurrency(parseFloat(s.debit || "0"))}</td>
                    <td className="px-4 py-3 text-left tabular-nums text-green-600">{formatCurrency(parseFloat(s.credit || "0"))}</td>
                    <td className="px-4 py-3 text-left tabular-nums font-medium">
                      {formatCurrency(parseFloat(s.balance))}
                    </td>
                    <td className="px-4 py-3 text-left">
                      <StatusBadge status={s.is_active ? "active" : "inactive"} />
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSelectedId(s.id)}><Eye className="w-4 h-4 ml-2" />عرض الملف</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setEditSupplier(s);
                            setForm({ 
                              code: s.code,
                              name: s.name, 
                              phone: s.phone || "", 
                              address: s.address || "",
                              notes: s.notes || ""
                            });
                            setLinkedAccountId(s.account_id || "null");
                            setOpeningBalance(s.opening_balance || "0");
                            setDebit(s.debit || "0");
                            setCredit(s.credit || "0");
                            setCurrency(s.currency || "SYP");
                            setShowDialog(true);
                          }}><Edit className="w-4 h-4 ml-2" />تعديل</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(s.id, s.name)} className="text-red-600">
                            <Trash2 className="w-4 h-4 ml-2" />حذف
                          </DropdownMenuItem>
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

      <Sheet open={!!selectedId} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto" dir="rtl">
          {current && (
            <>
              <SheetHeader className="text-right">
                <SheetTitle>ملف المورد - {current.name}</SheetTitle>
              </SheetHeader>

              <div className="mt-6 grid grid-cols-2 gap-3 text-right">
                <div className="p-3 border border-border rounded-md">
                  <div className="text-xs text-muted-foreground">الرصيد الحالي المستحق له</div>
                  <div className="font-bold tabular-nums text-red-600">{formatCurrency(parseFloat(current.balance || "0"))}</div>
                </div>
                <div className="p-3 border border-border rounded-md">
                  <div className="text-xs text-muted-foreground">الحالة</div>
                  <div className="font-bold"><StatusBadge status={current.is_active ? "active" : "inactive"} /></div>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-right">
                <div className="flex items-center gap-2 text-sm justify-start"><Phone className="w-4 h-4 text-muted-foreground" />{current.phone || "لا يوجد هاتف"}</div>
                <div className="flex items-center gap-2 text-sm justify-start"><MapPin className="w-4 h-4 text-muted-foreground" />{current.address || "لا يوجد عنوان"}</div>
              </div>

              <Tabs defaultValue="invoices" className="mt-6">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="invoices">فواتير الشراء</TabsTrigger>
                  <TabsTrigger value="payments">المدفوعات</TabsTrigger>
                </TabsList>
                
                <TabsContent value="invoices">
                  {loadingDetails ? <div className="text-center py-10">جاري التحميل...</div> :
                    supplierInvoices.length === 0 ? <div className="text-center py-10 text-muted-foreground">لا توجد فواتير</div> :
                    <div className="border rounded-md overflow-hidden text-xs">
                      <table className="w-full">
                        <thead className="bg-slate-50 border-b">
                          <tr>
                            <th className="text-right p-2">الرقم</th>
                            <th className="text-right p-2">التاريخ</th>
                            <th className="text-left p-2">الإجمالي</th>
                          </tr>
                        </thead>
                        <tbody>
                          {supplierInvoices.map(inv => (
                            <tr key={inv.id} className="border-b last:border-0">
                              <td className="p-2 font-medium">{inv.invoice_number}</td>
                              <td className="p-2">{formatDate(inv.issued_at)}</td>
                              <td className="p-2 text-left tabular-nums">{formatCurrency(parseFloat(inv.total_amount))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  }
                </TabsContent>
                
                <TabsContent value="payments">
                  {loadingDetails ? <div className="text-center py-10">جاري التحميل...</div> :
                    supplierPayments.length === 0 ? <div className="text-center py-10 text-muted-foreground">لا توجد مدفوعات</div> :
                    <div className="border rounded-md overflow-hidden text-xs">
                      <table className="w-full">
                        <thead className="bg-slate-50 border-b">
                          <tr>
                            <th className="text-right p-2">التاريخ</th>
                            <th className="text-right p-2">المرجع</th>
                            <th className="text-left p-2">المبلغ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {supplierPayments.map(p => (
                            <tr key={p.id} className="border-b last:border-0">
                              <td className="p-2">{formatDate(p.payment_date)}</td>
                              <td className="p-2 text-muted-foreground">{p.reference || "-"}</td>
                              <td className="p-2 text-left tabular-nums text-red-600">-{formatCurrency(parseFloat(p.amount))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  }
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>

  <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editSupplier ? "تعديل بيانات المورد" : "إضافة مورد جديد"}</DialogTitle>
            <DialogDescription>
              {editSupplier ? "تعديل تفاصيل الاتصال والموقع للمورد المختار." : "إضافة بيانات مورد جديد إلى النظام لبدء التعامل معه."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 text-right">
            <div className="space-y-1">
              <Label>اسم المورد *</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="أدخل اسم المورد" />
            </div>
            <div className="space-y-1">
              <Label>رقم الهاتف</Label>
              <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="05xxxxxxxx" />
            </div>
            <div className="space-y-1">
              <Label>العنوان</Label>
              <Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="عنوان المورد" />
            </div>
            <div className="space-y-1">
              <Label>ملاحظات</Label>
              <Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="ملاحظات إضافية" />
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="hidden">
                <Label>الحساب المحاسبي المرتبط</Label>
                <Select value={linkedAccountId} onValueChange={setLinkedAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر حساب محاسبي" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={"null"}>— بدون حساب محاسبي —</SelectItem>
                    {accountsForLink.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.code} - {a.name_ar}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>الرصيد الافتتاحي</Label>
                <Input value={openingBalance} onChange={e => setOpeningBalance(e.target.value)} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <Label>مدين</Label>
                <Input value={debit} onChange={e => setDebit(e.target.value)} placeholder="0" />
              </div>
              <div>
                <Label>دائن</Label>
                <Input value={credit} onChange={e => setCredit(e.target.value)} placeholder="0" />
              </div>
            </div>
            <div className="pt-2">
              <Label>العملة</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر عملة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SYP">SYP - ليرة سورية</SelectItem>
                  <SelectItem value="USD">USD - دولار أمريكي</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={saving || !form.name}>
              {saving ? "جاري الحفظ..." : "حفظ المورد"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
