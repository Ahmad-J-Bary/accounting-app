import { PageHeader } from "@/components/erp/PageHeader";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRight, Edit, Trash2, Package, TrendingUp, AlertTriangle, ShoppingCart, Warehouse } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";

export default function ProductDetail() {
  const productInfo = {
    name: "لابتوب Dell XPS 15",
    code: "PRD-001",
    sku: "DELL-XPS-15-9520",
    category: "إلكترونيات",
    brand: "Dell",
    status: "active",
    unit: "قطعة",
    costPrice: 6500,
    sellingPrice: 7500,
    stock: 50,
    minStock: 10,
    maxStock: 100,
    warehouse: "المستودع الرئيسي",
    description: "لابتوب Dell XPS 15 مع شاشة 15.6 بوصة، معالج Intel Core i7، 16GB RAM، 512GB SSD",
    totalSold: 150,
    totalValue: 375000,
    lastSale: "2026-04-18",
  };

  const stockMovements = [
    { date: "2026-04-20", type: "in", quantity: 20, reference: "شراء من المورد", balance: 50 },
    { date: "2026-04-15", type: "out", quantity: 15, reference: "فاتورة INV-2026-0230", balance: 30 },
    { date: "2026-04-10", type: "in", quantity: 25, reference: "شراء من المورد", balance: 45 },
    { date: "2026-04-05", type: "out", quantity: 10, reference: "فاتورة INV-2026-0225", balance: 20 },
    { date: "2026-03-28", type: "in", quantity: 30, reference: "شراء من المورد", balance: 30 },
  ];

  const salesHistory = [
    { date: "2026-04-18", invoice: "INV-2026-0233", quantity: 5, total: 37500, customer: "شركة الأفق" },
    { date: "2026-04-15", invoice: "INV-2026-0230", quantity: 15, total: 112500, customer: "شركة النور" },
    { date: "2026-04-10", invoice: "INV-2026-0227", quantity: 8, total: 60000, customer: "مؤسسة الأمانة" },
    { date: "2026-04-05", invoice: "INV-2026-0225", quantity: 10, total: 75000, customer: "شركة المستقبل" },
  ];

  const getMovementType = (type: string) => {
    return type === 'in' 
      ? { label: 'وارد', className: 'bg-green-100 text-green-700' }
      : { label: 'صادر', className: 'bg-red-100 text-red-700' };
  };

  return (
    <>
      <PageHeader
        title={productInfo.name}
        subtitle={`كود المنتج: ${productInfo.code} | SKU: ${productInfo.sku}`}
        breadcrumbs={[
          { label: "المخزون" },
          { label: "المنتجات", to: "/products" },
          { label: "تفاصيل المنتج" },
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
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">الرصيد الحالي</div>
              <div className="font-semibold">{productInfo.stock} وحدة</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 text-green-600 rounded flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">إجمالي المبيعات</div>
              <div className="font-semibold">{productInfo.totalSold} وحدة</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded flex items-center justify-center">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">قيمة المخزون</div>
              <div className="font-semibold">{formatCurrency(productInfo.totalValue)}</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">الحد الأدنى</div>
              <div className="font-semibold">{productInfo.minStock} وحدة</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-100 text-teal-600 rounded flex items-center justify-center">
              <Warehouse className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">المستودع</div>
              <div className="font-semibold text-sm">{productInfo.warehouse}</div>
            </div>
          </div>
        </Card>
      </div>

      <Tabs defaultValue="info" className="space-y-4">
        <TabsList>
          <TabsTrigger value="info">معلومات المنتج</TabsTrigger>
          <TabsTrigger value="stock">حركات المخزون</TabsTrigger>
          <TabsTrigger value="sales">سجل المبيعات</TabsTrigger>
          <TabsTrigger value="pricing">التسعير</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-4">
          <Card className="p-5">
            <h3 className="font-semibold mb-4">معلومات المنتج</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground mb-1">التصنيف</div>
                <div className="font-medium">{productInfo.category}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">العلامة التجارية</div>
                <div className="font-medium">{productInfo.brand}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">وحدة القياس</div>
                <div className="font-medium">{productInfo.unit}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">الحالة</div>
                <div className="font-medium"><StatusBadge status={productInfo.status} /></div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">سعر التكلفة</div>
                <div className="font-medium">{formatCurrency(productInfo.costPrice)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">سعر البيع</div>
                <div className="font-medium">{formatCurrency(productInfo.sellingPrice)}</div>
              </div>
              <div className="md:col-span-2">
                <div className="text-sm text-muted-foreground mb-1">الوصف</div>
                <div className="font-medium">{productInfo.description}</div>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="stock" className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">حركات المخزون</h3>
              <Button variant="outline" size="sm">عرض الكل</Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">التاريخ</TableHead>
                  <TableHead className="text-right">النوع</TableHead>
                  <TableHead className="text-right">الكمية</TableHead>
                  <TableHead className="text-right">المرجع</TableHead>
                  <TableHead className="text-left">الرصيد</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockMovements.map((movement) => {
                  const typeConfig = getMovementType(movement.type);
                  return (
                    <TableRow key={movement.date} className="hover:bg-slate-50">
                      <TableCell>{formatDate(movement.date)}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${typeConfig.className}`}>
                          {typeConfig.label}
                        </span>
                      </TableCell>
                      <TableCell className={movement.type === 'in' ? 'text-green-600' : 'text-red-600'}>
                        {movement.type === 'in' ? '+' : '-'}{movement.quantity}
                      </TableCell>
                      <TableCell>{movement.reference}</TableCell>
                      <TableCell className="text-left font-medium">{movement.balance}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="sales" className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">سجل المبيعات</h3>
              <Button variant="outline" size="sm">عرض الكل</Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">التاريخ</TableHead>
                  <TableHead className="text-right">رقم الفاتورة</TableHead>
                  <TableHead className="text-right">الكمية</TableHead>
                  <TableHead className="text-right">العميل</TableHead>
                  <TableHead className="text-left">الإجمالي</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salesHistory.map((sale) => (
                  <TableRow key={sale.invoice} className="hover:bg-slate-50 cursor-pointer">
                    <TableCell>{formatDate(sale.date)}</TableCell>
                    <TableCell className="font-medium text-primary">{sale.invoice}</TableCell>
                    <TableCell>{sale.quantity}</TableCell>
                    <TableCell>{sale.customer}</TableCell>
                    <TableCell className="text-left tabular-nums font-medium">{formatCurrency(sale.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="pricing" className="space-y-4">
          <Card className="p-5">
            <h3 className="font-semibold mb-4">معلومات التسعير</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">سعر التكلفة</div>
                <div className="text-2xl font-bold">{formatCurrency(productInfo.costPrice)}</div>
                <div className="text-xs text-muted-foreground mt-1">السعر الذي تم الشراء به</div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">سعر البيع</div>
                <div className="text-2xl font-bold text-primary">{formatCurrency(productInfo.sellingPrice)}</div>
                <div className="text-xs text-muted-foreground mt-1">السعر الافتراضي للبيع</div>
              </div>
              <div className="p-4 border rounded-lg md:col-span-2">
                <div className="text-sm text-muted-foreground mb-1">هامش الربح</div>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(productInfo.sellingPrice - productInfo.costPrice)} 
                  <span className="text-base text-muted-foreground mr-2">
                    ({((productInfo.sellingPrice - productInfo.costPrice) / productInfo.sellingPrice * 100).toFixed(1)}%)
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">الربح لكل وحدة</div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
