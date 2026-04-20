import { useState } from "react";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Download, Search, MoreHorizontal, Eye, Edit, Printer, Mail, Phone, MapPin } from "lucide-react";
import { customers, salesInvoices, payments } from "@/lib/mockData";
import { formatCurrency, formatDate } from "@/lib/format";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export default function Customers() {
  const [selected, setSelected] = useState<string | null>(null);
  const current = customers.find((c) => c.id === selected);

  return (
    <>
      <PageHeader
        title="العملاء"
        subtitle="إدارة قاعدة بيانات العملاء والأرصدة"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "العملاء" }]}
        actions={
          <>
            <Button variant="outline"><Download className="w-4 h-4 ml-2" />تصدير</Button>
            <Button><Plus className="w-4 h-4 ml-2" />عميل جديد</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">إجمالي العملاء</div>
          <div className="text-2xl font-bold tabular-nums mt-1">{customers.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">العملاء النشطون</div>
          <div className="text-2xl font-bold text-green-600 tabular-nums mt-1">{customers.filter(c => c.status === "active").length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">إجمالي الذمم</div>
          <div className="text-2xl font-bold text-primary tabular-nums mt-1">{formatCurrency(customers.reduce((s, c) => s + c.balance, 0))}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">عملاء بأرصدة صفرية</div>
          <div className="text-2xl font-bold tabular-nums mt-1">{customers.filter(c => c.balance === 0).length}</div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="بحث بالاسم، الكود، الهاتف..." className="pr-10" />
          </div>
          <Button variant="outline">جميع المدن</Button>
          <Button variant="outline">الحالة</Button>
        </div>

        <div className="border border-border rounded-md overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-slate-50 border-b border-border">
              <tr>
                <th className="text-right px-4 py-3 font-medium">الكود</th>
                <th className="text-right px-4 py-3 font-medium">اسم العميل</th>
                <th className="text-right px-4 py-3 font-medium">الهاتف</th>
                <th className="text-right px-4 py-3 font-medium">المدينة</th>
                <th className="text-left px-4 py-3 font-medium">الرصيد</th>
                <th className="text-left px-4 py-3 font-medium">الحالة</th>
                <th className="text-left px-4 py-3 font-medium w-12"></th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-slate-50 cursor-pointer" onClick={() => setSelected(c.id)}>
                  <td className="px-4 py-3 font-medium text-primary">{c.code}</td>
                  <td className="px-4 py-3">{c.name}</td>
                  <td className="px-4 py-3 tabular-nums">{c.phone}</td>
                  <td className="px-4 py-3">{c.city}</td>
                  <td className="px-4 py-3 text-left tabular-nums font-medium">{formatCurrency(c.balance)}</td>
                  <td className="px-4 py-3 text-left"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSelected(c.id)}><Eye className="w-4 h-4 ml-2" />عرض الملف</DropdownMenuItem>
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
      </Card>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="left" className="w-full sm:max-w-2xl overflow-y-auto">
          {current && (
            <>
              <SheetHeader>
                <SheetTitle>ملف العميل - {current.name}</SheetTitle>
              </SheetHeader>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="p-3 border border-border rounded-md">
                  <div className="text-xs text-muted-foreground">الكود</div>
                  <div className="font-bold">{current.code}</div>
                </div>
                <div className="p-3 border border-border rounded-md">
                  <div className="text-xs text-muted-foreground">الرصيد الحالي</div>
                  <div className="font-bold tabular-nums text-primary">{formatCurrency(current.balance)}</div>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-sm"><Phone className="w-4 h-4 text-muted-foreground" />{current.phone}</div>
                <div className="flex items-center gap-2 text-sm"><Mail className="w-4 h-4 text-muted-foreground" />{current.email}</div>
                <div className="flex items-center gap-2 text-sm"><MapPin className="w-4 h-4 text-muted-foreground" />{current.city}</div>
              </div>

              <Tabs defaultValue="invoices" className="mt-6">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="invoices">الفواتير</TabsTrigger>
                  <TabsTrigger value="payments">المقبوضات</TabsTrigger>
                  <TabsTrigger value="statement">كشف الحساب</TabsTrigger>
                </TabsList>
                <TabsContent value="invoices" className="mt-4">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-border">
                      <tr>
                        <th className="text-right px-3 py-2 font-medium">رقم</th>
                        <th className="text-right px-3 py-2 font-medium">التاريخ</th>
                        <th className="text-left px-3 py-2 font-medium">المبلغ</th>
                        <th className="text-left px-3 py-2 font-medium">الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesInvoices.slice(0, 4).map((inv) => (
                        <tr key={inv.id} className="border-b border-border">
                          <td className="px-3 py-2 text-primary">{inv.number}</td>
                          <td className="px-3 py-2">{formatDate(inv.date)}</td>
                          <td className="px-3 py-2 text-left tabular-nums">{formatCurrency(inv.total)}</td>
                          <td className="px-3 py-2 text-left"><StatusBadge status={inv.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TabsContent>
                <TabsContent value="payments" className="mt-4">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-border">
                      <tr>
                        <th className="text-right px-3 py-2 font-medium">رقم السند</th>
                        <th className="text-right px-3 py-2 font-medium">التاريخ</th>
                        <th className="text-left px-3 py-2 font-medium">المبلغ</th>
                        <th className="text-left px-3 py-2 font-medium">الطريقة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.filter(p => p.type === "receipt").slice(0, 3).map((p) => (
                        <tr key={p.id} className="border-b border-border">
                          <td className="px-3 py-2 text-primary">{p.number}</td>
                          <td className="px-3 py-2">{formatDate(p.date)}</td>
                          <td className="px-3 py-2 text-left tabular-nums">{formatCurrency(p.amount)}</td>
                          <td className="px-3 py-2 text-left"><StatusBadge status={p.method} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TabsContent>
                <TabsContent value="statement" className="mt-4">
                  <Button variant="outline" className="w-full"><Printer className="w-4 h-4 ml-2" />طباعة كشف الحساب الكامل</Button>
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}