import { Tabs, TabsList, TabsTrigger, TabsContent } from "@shared/ui/tabs";
import { formatCurrency } from '@shared/lib/format';
import { Hash, X, Package, Box, RefreshCw, TrendingUp, Boxes, Layers, Edit, Trash2, Scale, DollarSign, ListCollapse } from "lucide-react";
import type { MaterialDto } from "@erp/shared-types";
import { DetailPanel, ActionButton } from "@widgets/sidebar";
import { SidebarSection } from "@widgets/sidebar/SidebarSection";
import { useCurrencyContext } from "@app/providers/CurrencyContext";

interface MaterialDetailPanelProps {
  material: MaterialDto | null;
  onClose: () => void;
  onEdit?: (m: MaterialDto) => void;
  onDelete?: (id: string, name: string) => void;
  loadingDetails?: boolean;
}

export function MaterialDetailPanel({
  material,
  onClose,
  onEdit,
  onDelete,
}: MaterialDetailPanelProps) {
  const { baseCurrency, currencies } = useCurrencyContext();
  const foreignCurrency = currencies.find(c => c.code !== baseCurrency?.code);
  const foreignSym = foreignCurrency?.symbol || foreignCurrency?.code || "";
  const baseSym = baseCurrency?.symbol || baseCurrency?.code || "";

  if (!material) return null;

  const actions = (
    <div className="flex items-center gap-1.5">
      {onEdit && (
        <ActionButton icon={<Edit className="w-3 h-3" />} label="تعديل" color="amber" onClick={() => onEdit(material)} />
      )}
      {onDelete && (
        <ActionButton icon={<Trash2 className="w-3 h-3" />} label="حذف" color="red" onClick={() => {
          if (confirm(`هل أنت متأكد من حذف "${material.name}"؟`)) {
            onDelete(material.id, material.name);
          }
        }} />
      )}
    </div>
  );

  return (
    <DetailPanel
      title={material.name}
      subtitle={material.name_en || undefined}
      icon={
        material.image_path ? (
          <div className="w-10 h-10 rounded-xl border border-slate-100 bg-white overflow-hidden shadow-sm flex-shrink-0 flex items-center justify-center">
            <img src={material.image_path} alt={material.name} className="w-full h-full object-contain" />
          </div>
        ) : (
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-inner">
            <Package className="w-5 h-5" />
          </div>
        )
      }
      actions={actions}
      onClose={onClose}
    >
      {/* 1. Quick Stats Grid */}
      <div className="grid grid-cols-2 gap-3 text-right">
        <div className="p-4 border border-emerald-100 rounded-2xl bg-emerald-50/20 shadow-[0_2px_8px_rgba(16,185,129,0.02)] transition-all hover:bg-emerald-50/40">
          <div className="flex justify-between items-start mb-1">
            <span className="text-[10px] font-black text-emerald-600/80 uppercase tracking-wider">الكمية المتوفرة</span>
            <Boxes className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="font-bold tabular-nums text-lg text-emerald-600 leading-none mt-1">
            {parseFloat(material.total_available).toLocaleString()}
          </div>
        </div>
        <div className="p-4 border border-blue-100 rounded-2xl bg-blue-50/20 shadow-[0_2px_8px_rgba(59,130,246,0.02)] transition-all hover:bg-blue-50/40">
          <div className="flex justify-between items-start mb-1">
            <span className="text-[10px] font-black text-blue-600/80 uppercase tracking-wider">متوسط التكلفة</span>
            <Scale className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="font-bold tabular-nums text-lg text-blue-600 leading-none mt-1">
            {formatCurrency(parseFloat(material.average_cost), baseSym || undefined)}
          </div>
        </div>
      </div>

      {/* 2. Basic Information Accordion Section */}
      <SidebarSection title="بيانات المادة" defaultOpen={true}>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-bold block">الباركود العام</span>
            <div className="text-xs font-semibold text-slate-700 font-mono bg-slate-50 p-2 rounded-lg border border-slate-100">
              {material.barcode || "—"}
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-bold block">حد الطلب</span>
            <div className="text-xs font-semibold text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100">
              {material.minimum_stock || "0"}
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-bold block">وحدة الشراء الافتراضية</span>
            <div className="text-xs font-semibold text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100">
              {material.units.find(u => u.id === material.default_purchase_unit_id)?.name || "—"}
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-bold block">وحدة البيع الافتراضية</span>
            <div className="text-xs font-semibold text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100">
              {material.units.find(u => u.id === material.default_sale_unit_id)?.name || "—"}
            </div>
          </div>
        </div>
        {material.notes && (
          <div className="space-y-1 mt-2">
            <span className="text-[10px] text-slate-400 font-bold block">ملاحظات</span>
            <div className="text-xs text-slate-600 leading-relaxed bg-amber-50/20 p-2.5 rounded-lg border border-amber-100/60 italic">
              {material.notes}
            </div>
          </div>
        )}
      </SidebarSection>

      {/* 3. Detailed Tabs Section */}
      <Tabs defaultValue="units" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-10 p-1 bg-slate-100/80 rounded-lg">
          <TabsTrigger value="units" className="flex items-center gap-1.5 text-xs rounded-md font-bold">
            <Package className="w-3.5 h-3.5" /> الوحدات
          </TabsTrigger>
          <TabsTrigger value="prices" className="flex items-center gap-1.5 text-xs rounded-md font-bold">
            <TrendingUp className="w-3.5 h-3.5" /> قائمة الأسعار
          </TabsTrigger>
          <TabsTrigger value="movement" className="flex items-center gap-1.5 text-xs rounded-md font-bold">
            <RefreshCw className="w-3.5 h-3.5" /> حركة المادة
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="units" className="mt-4 focus-visible:outline-none">
          <div className="border border-slate-200/80 rounded-xl overflow-hidden shadow-sm bg-white">
            <table className="w-full text-xs text-right">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="p-3 font-bold text-slate-500">الوحدة</th>
                  <th className="p-3 font-bold text-slate-500 text-center">التعادل</th>
                  <th className="p-3 font-bold text-slate-500">الباركود</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {material.units?.map((u, i) => (
                  <tr key={i} className="hover:bg-slate-50/40 transition-colors">
                    <td className="p-3 font-bold text-slate-700">
                      {u.name} {u.is_base && <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md mr-1.5 border border-blue-100">أساسية</span>}
                    </td>
                    <td className="p-3 text-center tabular-nums font-semibold text-slate-600">{u.conversion_factor}</td>
                    <td className="p-3 text-slate-400 font-mono">{u.barcode || "—"}</td>
                  </tr>
                ))}
                {(!material.units || material.units.length === 0) && (
                  <tr>
                    <td colSpan={3} className="p-6 text-center text-slate-400 italic">لا توجد وحدات معرفة</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="prices" className="mt-4 focus-visible:outline-none">
          <div className="space-y-4">
            {material.units.map((unit, uIdx) => (
              <div key={uIdx} className="border border-slate-200/80 rounded-xl overflow-hidden shadow-sm bg-white">
                <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 font-bold text-xs text-slate-700 flex justify-between items-center">
                  <span>أسعار مبيع: <span className="text-blue-600 font-black">{unit.name}</span></span>
                  <span className="text-[9px] text-slate-400 font-normal italic">التعادل: {unit.conversion_factor} من الوحدة الأساسية</span>
                </div>
                <div className="grid grid-cols-2 gap-px bg-slate-100">
                  {[
                    { id: 'consumer', label: 'مستهلك' },
                    { id: 'retail', label: 'مفرق' },
                    { id: 'wholesale', label: 'جملة' },
                    { id: 'semi_wholesale', label: 'نصف جملة' },
                    { id: 'special', label: 'خاص' }
                  ].map(tier => {
                    const price = material.sale_prices.find(p => p.unit_id === unit.id && p.tier === tier.id);
                    return (
                      <div key={tier.id} className="bg-white p-3 flex justify-between items-center hover:bg-slate-50/30 transition-colors">
                        <span className="text-[11px] font-bold text-slate-500">{tier.label}</span>
                        <div className="flex flex-col items-end">
                          <span className="text-xs font-bold text-emerald-600 tabular-nums">{foreignSym} {price?.price || "0"}</span>
                          <span className="text-[10px] font-medium text-slate-400 tabular-nums">
                            {formatCurrency(parseFloat(price?.price_base || "0"), baseSym || undefined)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="movement" className="mt-4 focus-visible:outline-none">
          <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl text-slate-400 bg-slate-50/40">
            <Box className="w-8 h-8 mx-auto mb-2 text-slate-300 stroke-[1.5]" />
            <span className="text-xs font-bold">سجل حركة المادة سيتم إضافته قريباً</span>
          </div>
        </TabsContent>
      </Tabs>
    </DetailPanel>
  );
}
