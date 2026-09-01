import { Pencil, Trash2 } from "lucide-react";
import type { DamagedItem, MaterialDto } from "@erp/shared-types";
import { formatWithLocale, useCurrencyContext } from "@app/providers/CurrencyContext";
import { formatDateTime, formatNumber, toLocalString } from "@shared/lib/format";
import {
  SidebarShell,
  SidebarHeader,
  SidebarActionBar,
  SidebarBody,
  SidebarDetailGrid,
  type SidebarAction,
} from "@widgets/sidebar-shell";

interface DamagedDetailPanelProps {
  item: DamagedItem;
  materials: MaterialDto[];
  onClose: () => void;
  onEdit: (item: DamagedItem) => void;
  onDelete: (id: string) => void;
}

export function DamagedDetailPanel({
  item,
  materials: _materials,
  onClose,
  onEdit,
  onDelete,
}: DamagedDetailPanelProps) {
  const { currencies, baseCurrency, formatAmount } = useCurrencyContext();

  const itemCurrency = currencies.find((c) => c.code === item.currency_code) || null;
  const costOriginal = parseFloat(item.cost_impact || "0");
  const costBase = parseFloat(item.cost_impact_base || "0");
  const lossOriginal = parseFloat(item.loss || item.cost_impact || "0");
  const lossBase = parseFloat(item.loss_base || item.cost_impact_base || "0");
  const displayCost = `${formatWithLocale(costOriginal, itemCurrency?.decimals ?? 2)} ${itemCurrency?.symbol || item.currency_code || ""}`.trim();
  const displayLoss = `${formatWithLocale(lossOriginal, itemCurrency?.decimals ?? 2)} ${itemCurrency?.symbol || item.currency_code || ""}`.trim();
  const baseCostLabel = `تأثير التكلفة (${baseCurrency?.symbol || baseCurrency?.code || ""})`;
  const baseLossLabel = `الخسارة (${baseCurrency?.symbol || baseCurrency?.code || ""})`;

  const actionItems: SidebarAction[] = [
    {
      label: "تعديل",
      icon: <Pencil className="w-4 h-4" />,
      variant: "warning",
      onClick: () => onEdit(item),
    },
    {
      label: "حذف",
      icon: <Trash2 className="w-4 h-4" />,
      variant: "danger",
      onClick: () => {
        if (confirm("هل أنت متأكد من حذف سجل التالف هذا؟ سيتم حذف حركة المخزون المرتبطة به.")) {
          onDelete(item.id);
        }
      },
    },
  ];

  return (
    <SidebarShell isOpen={true} onClose={onClose}>
      <SidebarHeader title="تفاصيل التالف" onClose={onClose} />
      <SidebarActionBar actions={actionItems} />
      <SidebarBody>
        <div className="space-y-4 text-right">
          <SidebarDetailGrid
            columns={2}
            fields={[
              { label: "المادة", value: item.material_name || item.material_id },
              { label: "تاريخ التسجيل", value: formatDateTime(item.damage_date) },
            ]}
          />
          <div className="p-4 border border-rose-100 rounded-2xl bg-rose-50/40">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-white rounded-xl border border-rose-100">
                <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">
                  تأثير التكلفة (الأصلية)
                </div>
                <div className="text-base font-black text-rose-600 tabular-nums">
                  {displayCost}
                </div>
              </div>
              <div className="p-3 bg-white rounded-xl border border-rose-100">
                <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">
                  {baseCostLabel}
                </div>
                <div className="text-base font-black text-rose-600 tabular-nums">
                  {costBase > 0
                    ? formatAmount(costBase, { currencyCode: baseCurrency?.code || "" })
                    : "—"}
                </div>
              </div>
              <div className="p-3 bg-white rounded-xl border border-rose-100">
                <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">
                  الخسارة (الأصلية)
                </div>
                <div className="text-base font-black text-rose-600 tabular-nums">
                  {displayLoss}
                </div>
              </div>
              <div className="p-3 bg-white rounded-xl border border-rose-100">
                <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">
                  {baseLossLabel}
                </div>
                <div className="text-base font-black text-rose-600 tabular-nums">
                  {lossBase > 0
                    ? formatAmount(lossBase, { currencyCode: baseCurrency?.code || "" })
                    : "—"}
                </div>
              </div>
            </div>
            <div className="mt-3 text-[11px] text-rose-400 font-bold">
              الكمية التالفة: {toLocalString(Math.round(parseFloat(item.quantity || "0")))}
            </div>
          </div>
          <SidebarDetailGrid
            columns={2}
            fields={[
              { label: "سبب التلف", value: item.reason || "—" },
              { label: "تاريخ التلف", value: formatDateTime(item.damage_date) },
            ]}
          />
          <SidebarDetailGrid
            title="معلومات إضافية"
            fields={[
              { label: "المرجع", value: item.reference ? formatNumber(parseInt(item.reference) || 0) : "—" },
              ...(item.notes ? [{ label: "ملاحظات", value: item.notes }] : []),
              { label: "تاريخ الإنشاء", value: formatDateTime(item.created_at) },
            ]}
          />
        </div>
      </SidebarBody>
    </SidebarShell>
  );
}
