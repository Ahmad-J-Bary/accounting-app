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
import { useLocalization } from "@app/providers/LocalizationProvider";

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
  const { t } = useLocalization();
  const { currencies, baseCurrency, formatAmount } = useCurrencyContext();

  const itemCurrency = currencies.find((c) => c.code === item.currency_code) || null;
  const lossOriginal = parseFloat(item.loss || item.cost_impact || "0");
  const lossBase = parseFloat(item.loss_base || item.cost_impact_base || "0");
  const displayLoss = `${formatWithLocale(lossOriginal, itemCurrency?.decimals ?? 2)} ${itemCurrency?.symbol || item.currency_code || ""}`.trim();

  const actionItems: SidebarAction[] = [
    {
      label: t("labels.edit", { namespace: "inventory", fallback: "تعديل" }),
      icon: <Pencil className="w-4 h-4" />,
      variant: "warning",
      onClick: () => onEdit(item),
    },
    {
      label: t("labels.delete", { namespace: "inventory", fallback: "حذف" }),
      icon: <Trash2 className="w-4 h-4" />,
      variant: "danger",
      onClick: () => {
        if (confirm(t("damaged.deleteConfirm", { namespace: "inventory", fallback: "هل أنت متأكد من حذف سجل التالف هذا؟ سيتم حذف حركة المخزون المرتبطة به." }))) {
          onDelete(item.id);
        }
      },
    },
  ];

  return (
    <SidebarShell isOpen={true} onClose={onClose}>
      <SidebarHeader title={t("damaged.detailTitle", { namespace: "inventory", fallback: "تفاصيل التالف" })} onClose={onClose} />
      <SidebarActionBar actions={actionItems} />
      <SidebarBody>
        <div className="space-y-4 text-right">
          <SidebarDetailGrid
            columns={2}
            fields={[
              { label: t("labels.material", { namespace: "inventory", fallback: "المادة" }), value: item.material_name || item.material_id },
              { label: t("damaged.registerDate", { namespace: "inventory", fallback: "تاريخ التسجيل" }), value: formatDateTime(item.damage_date) },
            ]}
          />
          <div className="p-4 border border-rose-100 rounded-2xl bg-rose-50/40">
            <div className="p-3 bg-white rounded-xl border border-rose-100">
              <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">
                {t("damaged.loss", { namespace: "inventory", fallback: "الخسارة" })}
              </div>
              <div className="text-base font-black text-rose-600 tabular-nums">
                {lossBase > 0
                  ? formatAmount(lossBase, { currencyCode: baseCurrency?.code || "" })
                  : displayLoss}
              </div>
            </div>
            <div className="mt-3 text-[11px] text-rose-400 font-bold">
              {t("damaged.quantityLabel", { namespace: "inventory", fallback: "الكمية التالفة" })}: {toLocalString(Math.round(parseFloat(item.quantity || "0")))}
            </div>
          </div>
          <SidebarDetailGrid
            fields={[
              { label: t("damaged.reason", { namespace: "inventory", fallback: "سبب التلف" }), value: item.reason || "—" },
            ]}
          />
          <SidebarDetailGrid
            title={t("transfers.extraInfo", { namespace: "inventory", fallback: "معلومات إضافية" })}
            fields={[
              { label: t("labels.reference", { namespace: "inventory", fallback: "المرجع" }), value: item.reference ? formatNumber(parseInt(item.reference) || 0) : "—" },
              ...(item.notes ? [{ label: t("labels.notes", { namespace: "inventory", fallback: "ملاحظات" }), value: item.notes }] : []),
            ]}
          />
        </div>
      </SidebarBody>
    </SidebarShell>
  );
}
