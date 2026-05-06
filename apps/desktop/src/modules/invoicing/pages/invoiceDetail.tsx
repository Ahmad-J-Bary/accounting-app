import { PageHeader } from '@widgets/page-header/PageHeader';
import { DocumentPreview } from "@widgets/document-shell/DocumentPreview";
import { Button } from "@shared/ui/button";
import { ArrowRight, Printer, Download, Edit, Trash2, Send } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@shared/ui/tabs";
import { Card } from "@shared/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@shared/ui/table";

export default function InvoiceDetail() {
  const invoiceItems = [
    { description: "لابتوب Dell XPS 15", quantity: 2, unitPrice: 7500, total: 15000 },
    { description: "ماوس لاسلكي Logitech", quantity: 5, unitPrice: 150, total: 750 },
    { description: "لوحة مفاتيح ميكانيكية", quantity: 3, unitPrice: 350, total: 1050 },
  ];

  const subtotal = invoiceItems.reduce((sum, item) => sum + item.total, 0);
  const taxAmount = subtotal * 0.15;
  const total = subtotal + taxAmount;

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    console.log("Downloading PDF...");
  };

  const handleEmail = () => {
    console.log("Sending email...");
  };

  return (
    <>
      <PageHeader
        title="فاتورة مبيعات INV-2026-0235"
        subtitle="تفاصيل فاتورة المبيعات"
        breadcrumbs={[
          { label: "المبيعات والمشتريات" },
          { label: "فواتير المبيعات", to: "/sales-invoices" },
          { label: "تفاصيل الفاتورة" },
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

      <Tabs defaultValue="preview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="preview">معاينة الفاتورة</TabsTrigger>
          <TabsTrigger value="history">سجل التغييرات</TabsTrigger>
          <TabsTrigger value="related">المستندات المرتبطة</TabsTrigger>
        </TabsList>

        <TabsContent value="preview" className="space-y-4">
          <DocumentPreview
            type="sales"
            documentNumber="INV-2026-0235"
            date="2026-04-20"
            partyName="شركة الأفق"
            partyType="customer"
            status="paid"
            items={invoiceItems}
            subtotal={subtotal}
            taxAmount={taxAmount}
            total={total}
            notes="شكراً لتعاملكم معنا. الدفع مستحق خلال 30 يوم."
            onPrint={handlePrint}
            onDownload={handleDownload}
            onEmail={handleEmail}
          />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card className="p-5">
            <h3 className="font-semibold mb-4">سجل التغييرات</h3>
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
                  <TableCell>إنشاء</TableCell>
                  <TableCell>إنشاء الفاتورة</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>2026-04-20 10:35</TableCell>
                  <TableCell>أحمد محمد</TableCell>
                  <TableCell>تعديل</TableCell>
                  <TableCell>إضافة عنصر: لابتوب Dell XPS 15</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>2026-04-20 10:40</TableCell>
                  <TableCell>أحمد محمد</TableCell>
                  <TableCell>ترحيل</TableCell>
                  <TableCell>ترحيل الفاتورة إلى دفتر الأستاذ</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="related" className="space-y-4">
          <Card className="p-5">
            <h3 className="font-semibold mb-4">المستندات المرتبطة</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 text-green-600 rounded flex items-center justify-center">
                    <Send className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-medium">سند قبض R-2026-0089</div>
                    <div className="text-sm text-muted-foreground">2026-04-20 - 10,000 ر.س</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded flex items-center justify-center">
                    <Printer className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-medium">قيد يومية JE-2026-0234</div>
                    <div className="text-sm text-muted-foreground">2026-04-20 - مبيعات نقدية</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
