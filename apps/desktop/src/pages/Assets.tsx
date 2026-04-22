import { useState, useEffect } from "react";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Download, Search, Filter, HardDrive, Package, TrendingUp, History, MapPin, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { assetService } from "@/services/assetService";
import type { FixedAssetDto, ConsumableDto } from "@erp/shared-types";

export default function Assets() {
  const [fixedAssets, setFixedAssets] = useState<FixedAssetDto[]>([]);
  const [consumables, setConsumables] = useState<ConsumableDto[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [fa, c] = await Promise.all([
        assetService.listFixedAssets(),
        assetService.listConsumables()
      ]);
      setFixedAssets(fa);
      setConsumables(c);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const totalFixedCost = fixedAssets.reduce((acc, a) => acc + parseFloat(a.purchase_cost.amount), 0);
  const totalDepreciation = fixedAssets.reduce((acc, a) => acc + parseFloat(a.accumulated_depreciation.amount), 0);
  const netBookValue = totalFixedCost - totalDepreciation;

  return (
    <div className="space-y-6">
      <PageHeader 
        title="إدارة الموجودات" 
        description="إدارة الأصول الثابتة والمستهلكات التشغيلية والاهلاك"
        actions={
          <div className="flex gap-2">
            <Button variant="outline"><Download className="w-4 h-4 ml-2" />تصدير</Button>
            <Button><Plus className="w-4 h-4 ml-2" />إضافة أصل</Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center gap-4 border-r-4 border-r-blue-500">
          <div className="p-3 bg-blue-50 rounded-lg">
            <TrendingUp className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <div className="text-sm text-muted-foreground">إجمالي قيمة الأصول</div>
            <div className="text-xl font-bold tabular-nums">{formatCurrency(totalFixedCost)}</div>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4 border-r-4 border-r-red-500">
          <div className="p-3 bg-red-50 rounded-lg">
            <History className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <div className="text-sm text-muted-foreground">مجمع الإهلاك</div>
            <div className="text-xl font-bold tabular-nums text-red-600">{formatCurrency(totalDepreciation)}</div>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4 border-r-4 border-r-green-500">
          <div className="p-3 bg-green-50 rounded-lg">
            <TrendingUp className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <div className="text-sm text-muted-foreground">صافي القيمة الدفترية</div>
            <div className="text-xl font-bold tabular-nums text-green-600">{formatCurrency(netBookValue)}</div>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4 border-r-4 border-r-amber-500">
          <div className="p-3 bg-amber-50 rounded-lg">
            <Package className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <div className="text-sm text-muted-foreground">عدد الأصول</div>
            <div className="text-xl font-bold tabular-nums">{fixedAssets.length}</div>
          </div>
        </Card>
      </div>

      <Tabs defaultValue="fixed" className="w-full" dir="rtl">
        <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
          <TabsTrigger value="fixed" className="flex gap-2">
            <HardDrive className="w-4 h-4" /> الموجودات الثابتة
          </TabsTrigger>
          <TabsTrigger value="consumables" className="flex gap-2">
            <Package className="w-4 h-4" /> المستهلكات
          </TabsTrigger>
          <TabsTrigger value="depreciation" className="flex gap-2">
            <TrendingUp className="w-4 h-4" /> الإهلاك
          </TabsTrigger>
          <TabsTrigger value="movements" className="flex gap-2">
            <History className="w-4 h-4" /> سجل الحركات
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fixed" className="mt-6">
          <Card className="p-0 overflow-hidden">
            <div className="p-4 border-b flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="بحث في الأصول..." className="pr-10" />
              </div>
              <Button variant="outline" size="icon"><Filter className="w-4 h-4" /></Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-right p-4 font-bold">الكود</th>
                    <th className="text-right p-4 font-bold">الاسم</th>
                    <th className="text-right p-4 font-bold">التصنيف</th>
                    <th className="text-right p-4 font-bold">تاريخ الشراء</th>
                    <th className="text-right p-4 font-bold">التكلفة</th>
                    <th className="text-right p-4 font-bold">صافي القيمة</th>
                    <th className="text-right p-4 font-bold">الموقع</th>
                    <th className="text-right p-4 font-bold">الحالة</th>
                    <th className="text-left p-4 font-bold">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {fixedAssets.map((asset) => (
                    <tr key={asset.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 tabular-nums font-medium">{asset.code}</td>
                      <td className="p-4">{asset.name}</td>
                      <td className="p-4">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs flex items-center gap-1 w-fit">
                          <Tag className="w-3 h-3" /> {asset.category_id}
                        </span>
                      </td>
                      <td className="p-4 tabular-nums">{formatDate(asset.purchase_date)}</td>
                      <td className="p-4 tabular-nums font-bold">{formatCurrency(parseFloat(asset.purchase_cost.amount))}</td>
                      <td className="p-4 tabular-nums text-green-600 font-bold">
                        {formatCurrency(parseFloat(asset.purchase_cost.amount) - parseFloat(asset.accumulated_depreciation.amount))}
                      </td>
                      <td className="p-4">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <MapPin className="w-3 h-3" /> {asset.location || "غير محدد"}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={cn(
                          "px-2 py-1 rounded-full text-[10px] font-bold",
                          asset.status === 'Active' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        )}>
                          {asset.status === 'Active' ? "نشط" : "مستبعد"}
                        </span>
                      </td>
                      <td className="p-4 text-left">
                        <Button variant="ghost" size="sm">تعديل</Button>
                      </td>
                    </tr>
                  ))}
                  {fixedAssets.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-10 text-center text-muted-foreground">
                        لا توجد أصول ثابتة مضافة
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="consumables">
           <Card className="p-0 overflow-hidden">
            <div className="p-4 border-b flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="بحث في المستهلكات..." className="pr-10" />
              </div>
              <Button variant="outline"><Plus className="w-4 h-4 ml-2" />إضافة صنف</Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-right p-4 font-bold">الكود</th>
                    <th className="text-right p-4 font-bold">الاسم</th>
                    <th className="text-right p-4 font-bold">الكمية المتوفرة</th>
                    <th className="text-right p-4 font-bold">سعر الوحدة</th>
                    <th className="text-right p-4 font-bold">إجمالي القيمة</th>
                    <th className="text-right p-4 font-bold">الحالة</th>
                    <th className="text-left p-4 font-bold">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {consumables.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 tabular-nums font-medium">{item.code}</td>
                      <td className="p-4">{item.name}</td>
                      <td className="p-4 tabular-nums font-bold text-blue-600">{item.quantity_on_hand}</td>
                      <td className="p-4 tabular-nums">{formatCurrency(parseFloat(item.unit_cost.amount))}</td>
                      <td className="p-4 tabular-nums font-bold">
                        {formatCurrency(parseFloat(item.unit_cost.amount) * parseFloat(item.quantity_on_hand))}
                      </td>
                      <td className="p-4">
                        <span className={cn(
                          "px-2 py-1 rounded-full text-[10px] font-bold",
                          item.status === 'InStock' ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                        )}>
                          {item.status === 'InStock' ? "متوفر" : "منتهي"}
                        </span>
                      </td>
                      <td className="p-4 text-left gap-2 flex">
                        <Button variant="outline" size="sm">صرف</Button>
                        <Button variant="ghost" size="sm">تعديل</Button>
                      </td>
                    </tr>
                  ))}
                   {consumables.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-10 text-center text-muted-foreground">
                        لا توجد مستهلكات مضافة
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
