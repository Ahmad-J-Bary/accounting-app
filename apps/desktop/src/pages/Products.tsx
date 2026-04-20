import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Download, Search, MoreHorizontal, Edit, Eye, AlertTriangle } from "lucide-react";
import { products } from "@/lib/mockData";
import { formatCurrency, formatNumber } from "@/lib/format";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const CAT_COLORS: Record<string, string> = {
  "إلكترونيات": "bg-blue-50 text-blue-700 border-blue-200",
  "أثاث": "bg-amber-50 text-amber-700 border-amber-200",
  "مستلزمات مكتبية": "bg-green-50 text-green-700 border-green-200",
};

export default function Products() {
  return (
    <>
      <PageHeader
        title="المنتجات والأصناف"
        subtitle="إدارة كتالوج المنتجات والمخزون"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "المنتجات" }]}
        actions={
          <>
            <Button variant="outline"><Download className="w-4 h-4 ml-2" />تصدير</Button>
            <Button><Plus className="w-4 h-4 ml-2" />منتج جديد</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <Card className="p-4"><div className="text-sm text-muted-foreground">إجمالي المنتجات</div><div className="text-2xl font-bold tabular-nums mt-1">{products.length}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">قيمة المخزون</div><div className="text-xl font-bold text-primary tabular-nums mt-1">{formatCurrency(products.reduce((s, p) => s + p.stock * p.cost, 0))}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">منتجات منخفضة</div><div className="text-2xl font-bold text-red-600 tabular-nums mt-1">{products.filter(p => p.stock < p.minStock).length}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">الفئات</div><div className="text-2xl font-bold tabular-nums mt-1">{new Set(products.map(p => p.category)).size}</div></Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="بحث بالاسم أو الكود..." className="pr-10" />
          </div>
          <Button variant="outline">الفئة</Button>
          <Button variant="outline">الوحدة</Button>
        </div>

        <div className="border border-border rounded-md overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="bg-slate-50 border-b border-border">
              <tr>
                <th className="text-right px-4 py-3 font-medium">الكود</th>
                <th className="text-right px-4 py-3 font-medium">اسم المنتج</th>
                <th className="text-right px-4 py-3 font-medium">الفئة</th>
                <th className="text-right px-4 py-3 font-medium">الوحدة</th>
                <th className="text-left px-4 py-3 font-medium">التكلفة</th>
                <th className="text-left px-4 py-3 font-medium">السعر</th>
                <th className="text-left px-4 py-3 font-medium">المخزون</th>
                <th className="text-left px-4 py-3 font-medium w-12"></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const low = p.stock < p.minStock;
                return (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-primary">{p.code}</td>
                    <td className="px-4 py-3">{p.name}</td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full border", CAT_COLORS[p.category] || "bg-slate-50 text-slate-700 border-slate-200")}>
                        {p.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{p.unit}</td>
                    <td className="px-4 py-3 text-left tabular-nums">{formatCurrency(p.cost)}</td>
                    <td className="px-4 py-3 text-left tabular-nums font-medium">{formatCurrency(p.price)}</td>
                    <td className="px-4 py-3 text-left">
                      <div className="flex items-center justify-end gap-1.5">
                        {low && <AlertTriangle className="w-4 h-4 text-red-500" />}
                        <span className={cn("tabular-nums font-medium", low && "text-red-600")}>
                          {formatNumber(p.stock)} / {formatNumber(p.minStock)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem><Eye className="w-4 h-4 ml-2" />عرض</DropdownMenuItem>
                          <DropdownMenuItem><Edit className="w-4 h-4 ml-2" />تعديل</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}