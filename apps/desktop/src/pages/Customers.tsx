import { useState, useEffect } from "react";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Download, Search, MoreHorizontal, Eye, Edit, Trash2, Phone, MapPin, ArrowDownCircle } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { accountingService } from "@/services/accountingService";
import type { AccountDto } from "@erp/shared-types";

import { customerService } from "@/services/customerService";
import { invoiceService } from "@/services/invoiceService";
import { paymentService } from "@/services/paymentService";
import type { CustomerDto, InvoiceDto, Payment, CreateCustomerRequest, UpdateCustomerRequest } from "@erp/shared-types";

export default function Customers() {
  const [customersList, setCustomersList] = useState<CustomerDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  
  // Linked data for selected customer
  const [customerInvoices, setCustomerInvoices] = useState<InvoiceDto[]>([]);
  const [customerPayments, setCustomerPayments] = useState<Payment[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Create/Edit state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<CustomerDto | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    phone: "",
    address: "",
    notes: ""
  });
  // Accounting related fields
  const [linkedAccountId, setLinkedAccountId] = useState<string>("null");
  const [openingBalance, setOpeningBalance] = useState<string>("0");
  const [debit, setDebit] = useState<string>("0");
  const [credit, setCredit] = useState<string>("0");
  const [currency, setCurrency] = useState<string>("USD");
  const [accountsForLink, setAccountsForLink] = useState<AccountDto[]>([]);

  const loadAccountsForLink = async () => {
    try {
      const accounts = await accountingService.getChartOfAccounts();
      // Filter for Assets accounts (receivables) starting with 123 (المستوى 3 والمستوى 4)
      const filtered = accounts.filter((a) => a.account_type === "Assets" && (a.code === "123" || a.code.startsWith("123")));
      setAccountsForLink(filtered);
      // Auto-select the "123" parent account for new customers
      const parent123 = accounts.find((a) => a.code === "123");
      if (parent123) {
        setLinkedAccountId(parent123.id);
      }
    } catch {
      // ignore
    }
  };

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const data = await customerService.listCustomers();
      setCustomersList(data);
    } catch (error) {
      toast.error("فشل جلب العملاء: " + error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomerDetails = async (id: string) => {
    setLoadingDetails(true);
    try {
      const [invoices, payments] = await Promise.all([
        invoiceService.listInvoices(id),
        paymentService.listPayments(id)
      ]);
      setCustomerInvoices(invoices);
      setCustomerPayments(payments);
    } catch (error) {
      console.error("Failed to load customer details:", error);
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
    void loadAccountsForLink();

    const handleOpenNew = () => {
      setEditCustomer(null);
      setFormData({ code: "", name: "", phone: "", address: "", notes: "" });
      setLinkedAccountId("null");
      setOpeningBalance("0");
      setDebit("0");
      setCredit("0");
      setCurrency("SYP");
      setIsDialogOpen(true);
    };

    window.addEventListener("erp:open-new-customer", handleOpenNew);
    return () => window.removeEventListener("erp:open-new-customer", handleOpenNew);
  }, []);

  useEffect(() => {
    if (selectedId) {
      fetchCustomerDetails(selectedId);
    } else {
      setCustomerInvoices([]);
      setCustomerPayments([]);
    }
  }, [selectedId]);

  const current = customersList.find((c) => c.id === selectedId);

  const handleSave = async () => {
    try {
      if (editCustomer) {
        const updatePayload: UpdateCustomerRequest = {
          id: editCustomer.id,
          code: formData.code,
          name: formData.name,
          phone: formData.phone || null,
          address: formData.address || null,
          notes: formData.notes || null,
          account_id: linkedAccountId === "null" ? null : linkedAccountId,
          opening_balance: openingBalance,
          debit,
          credit,
          currency,
          is_active: editCustomer.is_active,
        };
        await customerService.updateCustomer(updatePayload);
        toast.success("تم تحديث بيانات العميل بنجاح");
      } else {
        const createPayload: CreateCustomerRequest = {
          code: formData.code,
          name: formData.name,
          phone: formData.phone || null,
          address: formData.address || null,
          notes: formData.notes || null,
          account_id: linkedAccountId === "null" ? null : linkedAccountId,
          opening_balance: openingBalance,
          debit,
          credit,
          currency,
          is_active: true,
        };
        await customerService.createCustomer(createPayload);
        toast.success("تم إضافة العميل بنجاح");
      }
      setIsDialogOpen(false);
      fetchCustomers();
    } catch (error) {
      toast.error("خطأ في العملية: " + error);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف العميل ${name}؟`)) return;
    try {
      await customerService.deleteCustomer(id);
      toast.success("تم حذف العميل بنجاح");
      fetchCustomers();
    } catch (error) {
      toast.error("خطأ في الحذف: " + error);
    }
  };

  const filteredCustomers = customersList.filter(c => {
    const searchLower = (search || "").toLowerCase();
    const nameMatch = (c.name || "").toLowerCase().includes(searchLower);
    const phoneMatch = (c.phone || "").toLowerCase().includes(searchLower);
    return nameMatch || phoneMatch;
  });

  return (
    <>
      <PageHeader
        title="العملاء"
        subtitle="إدارة قاعدة بيانات العملاء والأرصدة"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "العملاء" }]}
        actions={
          <>
            <Button variant="outline"><Download className="w-4 h-4 ml-2" />تصدير</Button>
            <Button onClick={() => {
              setEditCustomer(null);
              setFormData({ code: "", name: "", phone: "", address: "", notes: "" });
              setLinkedAccountId("null");
              setOpeningBalance("0");
              setDebit("0");
              setCredit("0");
              setCurrency("SYP");
              setIsDialogOpen(true);
            }}>
              <Plus className="w-4 h-4 ml-2" />عميل جديد
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">إجمالي العملاء</div>
          <div className="text-2xl font-bold tabular-nums mt-1">{customersList.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">العملاء النشطون</div>
          <div className="text-2xl font-bold text-green-600 tabular-nums mt-1">{customersList.filter(c => c.is_active).length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">إجمالي الذمم</div>
          <div className="text-2xl font-bold text-primary tabular-nums mt-1">{formatCurrency(Number(customersList.reduce((s, c) => s + Number(c.balance || 0), 0)))}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">عملاء بأرصدة صفرية</div>
          <div className="text-2xl font-bold tabular-nums mt-1">{customersList.filter(c => Number(c.balance || 0) === 0).length}</div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="بحث بالاسم، الكود، الهاتف..." 
              className="pr-10" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={fetchCustomers}>تحديث</Button>
        </div>

        {loading ? (
          <div className="text-center py-10">جاري التحميل...</div>
        ) : (
          <div className="border border-border rounded-md overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  <th className="text-right px-4 py-3 font-medium">الاسم</th>
                  <th className="text-right px-4 py-3 font-medium">الهاتف</th>
                  <th className="text-left px-4 py-3 font-medium">المدين</th>
                  <th className="text-left px-4 py-3 font-medium">الدائن</th>
                  <th className="text-left px-4 py-3 font-medium">الرصيد</th>
                  <th className="text-left px-4 py-3 font-medium">الحالة</th>
                  <th className="text-left px-4 py-3 font-medium w-12"></th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-muted-foreground">لا يوجد عملاء حالياً</td>
                  </tr>
                ) : (
                  filteredCustomers.map((c) => (
                    <tr key={c.id} className="border-b border-border last:border-0 hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedId(c.id)}>
                      <td className="px-4 py-3">{c.name}</td>
                      <td className="px-4 py-3 tabular-nums">{c.phone}</td>
                      <td className="px-4 py-3 text-left tabular-nums text-red-600">{formatCurrency(Number(c.debit || 0))}</td>
                      <td className="px-4 py-3 text-left tabular-nums text-green-600">{formatCurrency(Number(c.credit || 0))}</td>
                      <td className="px-4 py-3 text-left tabular-nums font-medium">{formatCurrency(Number(c.balance || 0))}</td>
                      <td className="px-4 py-3 text-left"><StatusBadge status={c.is_active ? "active" : "inactive"} /></td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSelectedId(c.id)}><Eye className="w-4 h-4 ml-2" />عرض الملف</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              setEditCustomer(c);
                              setFormData({
                                code: c.code,
                                name: c.name,
                                phone: c.phone || "",
                                address: c.address || "",
                                notes: c.notes || ""
                              });
                              setLinkedAccountId(c.account_id || "null");
                              setOpeningBalance(c.opening_balance || "0");
                              setDebit(c.debit || "0");
                              setCredit(c.credit || "0");
                              setCurrency(c.currency || "SYP");
                              setIsDialogOpen(true);
                            }}><Edit className="w-4 h-4 ml-2" />تعديل</DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(c.id, c.name)}>
                              <Trash2 className="w-4 h-4 ml-2" />حذف
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Sheet open={!!selectedId} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent side="left" className="w-full sm:max-w-2xl overflow-y-auto" dir="rtl">
          {current && (
            <>
              <SheetHeader className="text-right">
                <SheetTitle>ملف العميل - {current.name}</SheetTitle>
              </SheetHeader>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="p-3 border border-border rounded-md">
                  <div className="text-xs text-muted-foreground">الرصيد الحالي</div>
                  <div className="font-bold tabular-nums text-primary">{formatCurrency(Number(current.balance || 0))}</div>
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
                  <TabsTrigger value="invoices">الفواتير</TabsTrigger>
                  <TabsTrigger value="payments">المقبوضات</TabsTrigger>
                </TabsList>
                
                <TabsContent value="invoices">
                  {loadingDetails ? <div className="text-center py-10">جاري التحميل...</div> :
                    customerInvoices.length === 0 ? <div className="text-center py-10 text-muted-foreground">لا توجد فواتير</div> :
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
                          {customerInvoices.map(inv => (
                            <tr key={inv.id} className="border-b last:border-0">
                              <td className="p-2 font-medium">{inv.invoice_number}</td>
                              <td className="p-2">{formatDate(inv.issued_at)}</td>
                              <td className="p-2 text-left tabular-nums">{formatCurrency(parseFloat(inv.total))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  }
                </TabsContent>
                
                <TabsContent value="payments">
                  {loadingDetails ? <div className="text-center py-10">جاري التحميل...</div> :
                    customerPayments.length === 0 ? <div className="text-center py-10 text-muted-foreground">لا توجد مقبوضات</div> :
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
                          {customerPayments.map(p => (
                            <tr key={p.id} className="border-b last:border-0">
                              <td className="p-2">{formatDate(p.payment_date)}</td>
                              <td className="p-2 text-muted-foreground">{p.reference || "-"}</td>
                              <td className="p-2 text-left tabular-nums text-green-600">+{formatCurrency(parseFloat(p.amount))}</td>
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editCustomer ? "تعديل بيانات العميل" : "إضافة عميل جديد"}</DialogTitle>
            <DialogDescription>
              {editCustomer ? "قم بتعديل بيانات العميل أدناه." : "أدخل بيانات العميل الجديد لإضافته إلى النظام."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 text-right" dir="rtl">
            <div className="grid gap-2">
              <Label htmlFor="name">اسم العميل *</Label>
              <Input id="name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">رقم الهاتف</Label>
              <Input id="phone" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="address">العنوان</Label>
              <Input id="address" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">ملاحظات</Label>
              <Input id="notes" value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2" style={{direction:'rtl'}}>
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
            <div className="grid grid-cols-2 gap-4 pt-2" style={{direction:'rtl'}}>
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
          <DialogFooter className="flex-row-reverse gap-2">
            <Button onClick={handleSave} disabled={!formData.name}>حفظ</Button>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
