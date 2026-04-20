import { PageHeader } from "@/components/erp/PageHeader";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRight, Edit, Trash2, Phone, Mail, MapPin, Building2, FileText, Receipt, TrendingUp } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";

export default function CustomerDetail() {
  const customerInfo = {
    name: "شركة الأفق",
    code: "CUST-001",
    type: "شركة",
    status: "active",
    phone: "+966 11 234 5678",
    email: "info@alofuq.com",
    address: "رياض، حي الملقا، شارع الملك فهد",
    creditLimit: 500000,
    balance: 75000,
    totalPurchases: 1250000,
    invoiceCount: 45,
    lastPurchase: "2026-04-15",
  };

  const invoices = [
    { number: "INV-2026-0235", date: "2026-04-20", total: 15000, status: "paid" },
    { number: "INV-2026-0230", date: "2026-04-15", total: 25000, status: "pending" },
    { number: "INV-2026-0225", date: "2026-04-10", total: 35000, status: "overdue" },
    { number: "INV-2026-0220", date: "2026-04-05", total: 20000, status: "paid" },
    { number: "INV-2026-0215", date: "2026-03-28", total: 30000, status: "paid" },
  ];

  const payments = [
    { number: "R-2026-0089", date: "2026-04-19", amount: 10000, type: "receipt" },
    { number: "R-2026-0085", date: "2026-04-12", amount: 15000, type: "receipt" },
    { number: "R-2026-0080", date: "2026-04-05", amount: 20000, type: "receipt" },
  ];

  return (
    <>
      <PageHeader
        title={customerInfo.name}
        subtitle={`كود العميل: ${customerInfo.code}`}
        breadcrumbs={[
          { label: "المبيعات والمشتريات" },
          { label: "العملاء", to: "/customers" },
          { label: "تفاصيل العميل" },
        ]}
        actions={
          <>
            <Button variant="outline" size="sm">
              <Edit className="w-4 h-4 ml-2" />
              تعديل
            </Button>
            <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
              <Trash2 className="w-4 h-4 ml-2" />
              حذف
            </Button>
          </>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">إجمالي المشتريات</div>
              <div className="font-semibold">{formatCurrency(customerInfo.totalPurchases)}</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">عدد الفواتير</div>
              <div className="font-semibold">{customerInfo.invoiceCount}</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">الرصيد الحالي</div>
              <div className="font-semibold">{formatCurrency(customerInfo.balance)}</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 text-green-600 rounded flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">حد الائتمان</div>
              <div className="font-semibold">{formatCurrency(customerInfo.creditLimit)}</div>
            </div>
          </div>
        </Card>
      </div>

      <Tabs defaultValue="info" className="space-y-4">
        <TabsList>
          <TabsTrigger value="info">معلومات العميل</TabsTrigger>
          <TabsTrigger value="invoices">الفواتير</TabsTrigger>
          <TabsTrigger value="payments">المقبوضات</TabsTrigger>
          <TabsTrigger value="history">سجل النشاط</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-4">
          <Card className="p-5">
            <h3 className="font-semibold mb-4">معلومات الاتصال</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">نوع العميل</div>
                  <div className="font-medium">{customerInfo.type}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded flex items-center justify-center">
                  <StatusBadge status={customerInfo.status} />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">الحالة</div>
                  <div className="font-medium">نشط</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded flex items-center justify-center">
                  <Phone className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">الهاتف</div>
                  <div className="font-medium">{customerInfo.phone}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded flex items-center justify-center">
                  <Mail className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">البريد الإلكتروني</div>
                  <div className="font-medium">{customerInfo.email}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 md:col-span-2">
                <div className="w-10 h-10 bg-slate-100 rounded flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">العنوان</div>
                  <div className="font-medium">{customerInfo.address}</div>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">فواتير العميل</h3>
              <Button variant="outline" size="sm">عرض الكل</Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">رقم الفاتورة</TableHead>
                  <TableHead className="text-right">التاريخ</TableHead>
                  <TableHead className="text-left">المبلغ</TableHead>
                  <TableHead className="text-left">الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.number} className="hover:bg-slate-50 cursor-pointer">
                    <TableCell className="font-medium text-primary">{invoice.number}</TableCell>
                    <TableCell>{formatDate(invoice.date)}</TableCell>
                    <TableCell className="text-left tabular-nums">{formatCurrency(invoice.total)}</TableCell>
                    <TableCell className="text-left"><StatusBadge status={invoice.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">سندات القبض</h3>
              <Button variant="outline" size="sm">عرض الكل</Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">رقم السند</TableHead>
                  <TableHead className="text-right">التاريخ</TableHead>
                  <TableHead className="text-left">المبلغ</TableHead>
                  <TableHead className="text-left">النوع</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.number} className="hover:bg-slate-50 cursor-pointer">
                    <TableCell className="font-medium text-primary">{payment.number}</TableCell>
                    <TableCell>{formatDate(payment.date)}</TableCell>
                    <TableCell className="text-left tabular-nums">{formatCurrency(payment.amount)}</TableCell>
                    <TableCell className="text-left"><StatusBadge status={payment.type} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card className="p-5">
            <h3 className="font-semibold mb-4">سجل النشاط</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">التاريخ</TableHead>
                  <TableHead className="text-right">المستخدم</TableHead>
                  <TableHead className="text-right">الإجراء</TableHead>
                  <TableHead className="text-right">التفاصيل</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>2026-04-20 10:30</TableCell>
                  <TableCell>أحمد محمد</TableCell>
                  <TableCell>إنشاء فاتورة</TableCell>
                  <TableCell>INV-2026-0235</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>2026-04-19 14:20</TableCell>
                  <TableCell>أحمد محمد</TableCell>
                  <TableCell>تسجيل قبض</TableCell>
                  <TableCell>R-2026-0089 - 10,000 ر.س</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>2026-04-15 09:15</TableCell>
                  <TableCell>أحمد محمد</TableCell>
                  <TableCell>تعديل العميل</TableCell>
                  <TableCell>تحديث معلومات الاتصال</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
