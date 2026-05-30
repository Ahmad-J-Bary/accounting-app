import { Tabs, TabsList, TabsTrigger, TabsContent } from "@shared/ui/tabs";
import { formatCurrency } from '@shared/lib/format';
import { Package, TrendingUp, RefreshCw, Box, Pencil, Trash2, Barcode, Hash } from "lucide-react";
import type { MaterialDto } from "@erp/shared-types";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import {
  SidebarShell,
  SidebarHeader,
  SidebarActionBar,
  SidebarBody,
  SidebarDetailField,
  SidebarDetailGrid,
  type SidebarAction,
} from "@widgets/sidebar-shell";

interface MaterialDetailPanelProps {
  material: MaterialDto | null;
  onClose: () => void;
  onEdit?: (m: MaterialDto) => void;
  onDelete?: (id: string, name: string) => void;
  loadingDetails?: boolean;
}

const statCard =
  "p-4 border border-border rounded-xl bg-slate-50/50 shadow-sm text-right";
const statLabel = "text-[10px] uppercase font-bold text-slate-500 mb-1";
const statValue = "font-bold tabular-nums text-xl";
const sectionCard =
  "p-5 border border-slate-100 rounded-xl bg-white shadow-sm text-right space-y-4";

export function MaterialDetailPanel({
  material,
  onClose,
  onEdit,
  onDelete,
  loadingDetails = false,
}: MaterialDetailPanelProps) {
  const { baseCurrency, currencies } = useCurrencyContext();
  const foreignCurrency = currencies.find(c => c.code !== baseCurrency?.code);
  const foreignSym = foreignCurrency?.symbol || foreignCurrency?.code || "";
  const baseSym = baseCurrency?.symbol || baseCurrency?.code || "";

  if (!material) return null;

  const actions: SidebarAction[] = [
    ...(onEdit
      ? [
          {
            label: "تعديل",
            icon: <Pencil className="w-4 h-4" />,
            variant: "warning" as const,
            onClick: () => onEdit(material),
          },
        ]
      : []),
    ...(onDelete
      ? [
          {
            label: "حذف",
            icon: <Trash2 className="w-4 h-4" />,
            variant: "danger" as const,
            onClick: () => {
              if (confirm(`هل أنت متأكد من حذف "${material.name}"؟`)) {
                onDelete(material.id, material.name);
              }
            },
          },
        ]
      : []),
  ];

  const defaultPurchaseUnit = material.units?.find(
    (u) => u.id === material.default_purchase_unit_id
  );
  const defaultSaleUnit = material.units?.find(
    (u) => u.id === material.default_sale_unit_id
  );

  return (
    <SidebarShell isOpen={true} onClose={onClose}>
      <SidebarHeader title={material.name} onClose={onClose} />
      <SidebarActionBar actions={actions} />
      <SidebarBody>
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className={statCard}>
              <div className={statLabel}>الكمية المتوفرة</div>
              <div className={statValue + " text-emerald-600"}>
                {parseFloat(material.total_available).toLocaleString()}
              </div>
            </div>
            <div className={statCard}>
              <div className={statLabel}>متوسط التكلفة</div>
              <div className={statValue + " text-blue-600"}>
                {formatCurrency(
                  parseFloat(material.average_cost),
                  baseSym || undefined
                )}
              </div>
            </div>
          </div>

          {/* Basic Info */}
          <div className={sectionCard}>
            <SidebarDetailGrid
              fields={[
                {
                  label: "الكود",
                  value: (
                    <span className="flex items-center gap-1">
                      <Hash className="w-3 h-3 text-slate-400" />
                      {material.code}
                    </span>
                  ),
                },
                ...(material.name_en
                  ? [{ label: "الاسم (إنجليزي)" as const, value: material.name_en }]
                  : []),
                {
                  label: "الباركود العام",
                  value: (
                    <span className="flex items-center gap-1">
                      <Barcode className="w-3 h-3 text-slate-400" />
                      {material.barcode || "—"}
                    </span>
                  ),
                },
                {
                  label: "حد الطلب",
                  value: material.minimum_stock || "0",
                },
                {
                  label: "وحدة الشراء الافتراضية",
                  value: defaultPurchaseUnit?.name || "—",
                },
                {
                  label: "وحدة البيع الافتراضية",
                  value: defaultSaleUnit?.name || "—",
                },
              ]}
            />
            {material.notes && (
              <div className="mt-4 pt-3 border-t border-slate-50">
                <SidebarDetailField label="ملاحظات" value={material.notes} />
              </div>
            )}
          </div>

          {/* Tabs */}
          <Tabs defaultValue="units">
            <TabsList className="grid w-full grid-cols-3 h-10 p-1 bg-slate-100/80 rounded-lg">
              <TabsTrigger
                value="units"
                className="flex items-center gap-2 text-xs rounded-md"
              >
                <Package className="w-3.5 h-3.5" /> الوحدات
              </TabsTrigger>
              <TabsTrigger
                value="prices"
                className="flex items-center gap-2 text-xs rounded-md"
              >
                <TrendingUp className="w-3.5 h-3.5" /> قائمة الأسعار
              </TabsTrigger>
              <TabsTrigger
                value="movement"
                className="flex items-center gap-2 text-xs rounded-md"
              >
                <RefreshCw className="w-3.5 h-3.5" /> حركة المادة
              </TabsTrigger>
            </TabsList>

            <TabsContent value="units" className="mt-4 focus-visible:outline-none">
              <div className="border rounded-xl overflow-hidden shadow-sm bg-white">
                <table className="w-full text-xs text-right">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="p-3 font-bold text-slate-500">الوحدة</th>
                      <th className="p-3 font-bold text-slate-500 text-center">
                        التعادل
                      </th>
                      <th className="p-3 font-bold text-slate-500">الباركود</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {material.units?.map((u, i) => (
                      <tr
                        key={i}
                        className="hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="p-3 font-bold text-slate-700">
                          {u.name}{" "}
                          {u.is_base && (
                            <span className="text-[9px] text-blue-500 bg-blue-50 px-1 rounded mr-1">
                              أساسية
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center tabular-nums">
                          {u.conversion_factor}
                        </td>
                        <td className="p-3 text-slate-500 font-mono">
                          {u.barcode || "—"}
                        </td>
                      </tr>
                    ))}
                    {(!material.units || material.units.length === 0) && (
                      <tr>
                        <td
                          colSpan={3}
                          className="p-6 text-center text-slate-400"
                        >
                          لا توجد وحدات
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="prices" className="mt-4 focus-visible:outline-none">
              <div className="space-y-4">
                {material.units.map((unit, uIdx) => (
                  <div
                    key={uIdx}
                    className="border rounded-xl overflow-hidden shadow-sm bg-white"
                  >
                    <div className="bg-slate-50 px-4 py-2 border-b font-bold text-xs text-slate-700 flex justify-between">
                      <span>أسعار مبيع: {unit.name}</span>
                      <span className="text-[10px] text-slate-400 font-normal italic">
                        تعادل: {unit.conversion_factor} من الوحدة الأساسية
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-px bg-slate-100">
                      {[
                        { id: "retail", label: "مفرق" },
                        { id: "wholesale", label: "جملة" },
                        { id: "semi_wholesale", label: "نصف جملة" },
                      ].map((tier) => {
                        const price = material.sale_prices.find(
                          (p) =>
                            p.unit_id === unit.id && p.tier === tier.id
                        );
                        return (
                          <div
                            key={tier.id}
                            className="bg-white p-3 flex justify-between items-center"
                          >
                            <span className="text-[11px] font-bold text-slate-500">
                              {tier.label}
                            </span>
                            <div className="flex flex-col items-end">
                              <span className="text-[11px] font-bold text-emerald-600">
                                {foreignSym}
                                {price?.price || "0"}
                              </span>
                              <span className="text-[10px] text-blue-600">
                                {formatCurrency(
                                  parseFloat(price?.price_base || "0"),
                                  baseSym || undefined
                                )}
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

            <TabsContent
              value="movement"
              className="mt-4 focus-visible:outline-none"
            >
              <div className="text-center py-10 border-2 border-dashed rounded-xl text-muted-foreground bg-slate-50/50">
                <Box className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <span className="text-xs">سجل الحركة سيتم إضافته قريباً</span>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </SidebarBody>
    </SidebarShell>
  );
}