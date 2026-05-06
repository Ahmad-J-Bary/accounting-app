import { Tabs, TabsList, TabsTrigger, TabsContent } from "@shared/ui/tabs";
import { formatCurrency } from '@shared/lib/format';
import { Hash, X, Package, Box, RefreshCw } from "lucide-react";
import type { MaterialDto } from "@erp/shared-types";
import { Button } from "@shared/ui/button";

interface MaterialDetailPanelProps {
  material: MaterialDto | null;
  onClose: () => void;
  loadingDetails?: boolean;
}

export function MaterialDetailPanel({
  material,
  onClose,
  loadingDetails = false
}: MaterialDetailPanelProps) {
  if (!material) return null;

  return (
    <div className="flex flex-col h-full bg-white" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-slate-50/50 shrink-0">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            {material.name}
            <span className="text-xs font-normal text-muted-foreground bg-white border px-2 py-0.5 rounded flex items-center gap-1 shadow-sm">
              <Hash className="w-3 h-3" /> {material.code}
            </span>
          </h2>
          <span className="text-xs text-muted-foreground">بطاقة مادة</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full text-slate-400 hover:text-slate-600">
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3 text-right">
          <div className="p-4 border border-border rounded-xl bg-slate-50/50 shadow-sm">
            <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">الكمية المتوفرة</div>
            <div className="font-bold tabular-nums text-xl text-emerald-600">
              {parseFloat(material.total_available).toLocaleString()}
            </div>
          </div>
          <div className="p-4 border border-border rounded-xl bg-slate-50/50 shadow-sm">
            <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">متوسط التكلفة</div>
            <div className="font-bold tabular-nums text-xl text-blue-600">
              {formatCurrency(parseFloat(material.average_cost))}
            </div>
          </div>
        </div>

        {/* Basic Info */}
        <div className="mt-6 space-y-4 text-right p-5 border border-slate-100 rounded-xl bg-white shadow-sm">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b pb-2">معلومات المادة</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] text-muted-foreground font-medium">الباركود</div>
              <div className="font-medium text-slate-700 font-mono">{material.barcode || "—"}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground font-medium">حد الطلب</div>
              <div className="font-medium text-slate-700">{material.minimum_stock || "0"}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground font-medium">آخر سعر شراء</div>
              <div className="font-medium text-slate-700">{formatCurrency(parseFloat(material.last_purchase_price))}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground font-medium">آخر سعر مبيع</div>
              <div className="font-medium text-slate-700">{formatCurrency(parseFloat(material.last_sale_price))}</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="units" className="mt-8">
          <TabsList className="grid w-full grid-cols-2 h-10 p-1 bg-slate-100/80 rounded-lg">
            <TabsTrigger value="units" className="flex items-center gap-2 text-xs rounded-md">
              <Package className="w-3.5 h-3.5" /> الوحدات والأسعار
            </TabsTrigger>
            <TabsTrigger value="movement" className="flex items-center gap-2 text-xs rounded-md">
              <RefreshCw className="w-3.5 h-3.5" /> حركة المادة
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="units" className="mt-4 focus-visible:outline-none">
            <div className="border rounded-xl overflow-hidden shadow-sm bg-white">
              <table className="w-full text-xs text-right">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="p-3 font-bold text-slate-500">الوحدة</th>
                    <th className="p-3 font-bold text-slate-500 text-center">التعادل</th>
                    <th className="p-3 font-bold text-slate-500">الباركود</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {material.units?.map((u, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-3 font-bold text-slate-700">
                        {u.name} {u.is_base && <span className="text-[9px] text-blue-500 bg-blue-50 px-1 rounded mr-1">أساسية</span>}
                      </td>
                      <td className="p-3 text-center tabular-nums">{u.conversion_factor}</td>
                      <td className="p-3 text-slate-500 font-mono">{u.barcode || "—"}</td>
                    </tr>
                  ))}
                  {(!material.units || material.units.length === 0) && (
                    <tr>
                      <td colSpan={3} className="p-6 text-center text-slate-400">لا توجد وحدات</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>
          
          <TabsContent value="movement" className="mt-4 focus-visible:outline-none">
             <div className="text-center py-10 border-2 border-dashed rounded-xl text-muted-foreground bg-slate-50/50">
               <Box className="w-8 h-8 mx-auto mb-2 opacity-20" />
               <span className="text-xs">سجل الحركة سيتم إضافته قريباً</span>
             </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
