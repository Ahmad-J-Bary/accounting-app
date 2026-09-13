import {
  SidebarShell,
  SidebarHeader,
  SidebarActionBar,
  SidebarBody,
  SidebarDetailGrid,
  type SidebarAction,
} from "@widgets/sidebar-shell";
import type { FixedAssetDto, AssetMovement } from "@erp/shared-types";
import { Pencil, Trash2 } from "lucide-react";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useLocalization } from "@app/providers/LocalizationProvider";

interface FixedAssetDetailPanelProps {
  asset: FixedAssetDto;
  movements: AssetMovement[];
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  categoryName?: string;
  warehouseName?: string;
}

const FIXED_ASSET_MOVEMENT_TYPES = new Set([
  "Acquisition", "Depreciation", "Disposal", "Sale", "Adjustment", "Damage", "Revaluation",
]);

const movementLabels: Record<string, string> = {
  Acquisition: "شراء",
  Depreciation: "إهلاك",
  Disposal: "استبعاد",
  Sale: "بيع",
  Adjustment: "تسوية",
  Damage: "تلف",
  Revaluation: "إعادة تقييم",
};

export function FixedAssetDetailPanel({ asset, movements, onClose, onEdit, onDelete, categoryName, warehouseName }: FixedAssetDetailPanelProps) {
  const { formatAmount, baseCurrency } = useCurrencyContext();
  const { t } = useLocalization();
  const baseCode = baseCurrency?.code;

  const assetRate = parseFloat(asset.fx_rate) || 1;
  const originalCode = asset.purchase_cost.currency.code;
  const netBookValue = parseFloat(asset.purchase_cost.amount) - parseFloat(asset.accumulated_depreciation.amount);
  const canDepreciate = asset.useful_life_months > 0;

  const fixedMovements = movements.filter(m => FIXED_ASSET_MOVEMENT_TYPES.has(m.movement_type));

  function formatInBase(m: { amount: string; currency: { code: string } } | undefined | null): string {
    if (!m) return "-";
    if (m.currency.code !== baseCode) {
      const base = parseFloat(m.amount) / assetRate;
      return `${formatAmount(parseFloat(m.amount), { currencyCode: m.currency.code })} ${t("detail.equivalentLabel", { namespace: "fixedAssets", fallback: "(ما يعادل {{amount}}", vars: { amount: formatAmount(base, { currencyCode: baseCode }) } })}`;
    }
    return formatAmount(parseFloat(m.amount), { currencyCode: baseCode });
  }

  const infoFields = [
    { label: t("detail.category", { namespace: "fixedAssets", fallback: "التصنيف" }), value: categoryName || asset.category_id },
    { label: t("detail.purchaseDate", { namespace: "fixedAssets", fallback: "تاريخ الشراء" }), value: new Date(asset.purchase_date).toLocaleDateString("ar-SA") },
    { label: t("detail.purchaseCost", { namespace: "fixedAssets", fallback: "تكلفة الشراء" }), value: formatInBase(asset.purchase_cost) },
  ];

  if (warehouseName) {
    infoFields.push({ label: t("detail.warehouse", { namespace: "fixedAssets", fallback: "المستودع" }), value: warehouseName });
  }
  if (asset.salvage_value) {
    infoFields.push({ label: t("detail.salvageValue", { namespace: "fixedAssets", fallback: "قيمة الخردة" }), value: formatInBase(asset.salvage_value) });
  }
  if (asset.location) {
    infoFields.push({ label: t("detail.location", { namespace: "fixedAssets", fallback: "الموقع" }), value: asset.location });
  }
  infoFields.push({ label: t("detail.notes", { namespace: "fixedAssets", fallback: "الملاحظات" }), value: asset.notes || "-" });

  const actions: SidebarAction[] = [];
  if (onEdit) {
    actions.push({ label: t("detail.edit", { namespace: "fixedAssets", fallback: "تعديل" }), icon: <Pencil className="w-4 h-4" />, onClick: onEdit, variant: "warning" });
  }
  if (onDelete) {
    actions.push({
      label: t("detail.delete", { namespace: "fixedAssets", fallback: "حذف" }),
      icon: <Trash2 className="w-4 h-4" />,
      variant: "danger",
      onClick: () => {
        if (confirm(t("detail.confirmDelete", { namespace: "fixedAssets", fallback: 'هل أنت متأكد من حذف "{{name}}"؟', vars: { name: asset.name } }))) {
          onDelete();
        }
      },
    });
  }

  return (
    <SidebarShell onClose={onClose}>
      <SidebarHeader title={asset.name} subtitle={t("detail.subtitleCode", { namespace: "fixedAssets", fallback: "الكود: {{code}}", vars: { code: asset.code } })} onClose={onClose} />
      <SidebarActionBar actions={actions} />
      <SidebarBody>
        <SidebarDetailGrid title={t("detail.infoTitle", { namespace: "fixedAssets", fallback: "معلومات الأصل" })} fields={infoFields} columns={2} className="p-3" />

        {canDepreciate && (
          <SidebarDetailGrid
            title={t("detail.depreciationTitle", { namespace: "fixedAssets", fallback: "الإهلاك" })}
            fields={[
              { label: t("detail.accumulatedDepreciation", { namespace: "fixedAssets", fallback: "مجمع الإهلاك" }), value: formatInBase(asset.accumulated_depreciation) },
              { label: t("detail.netBookValue", { namespace: "fixedAssets", fallback: "صافي القيمة الدفترية" }), value: originalCode !== baseCode ? `${formatAmount(netBookValue, { currencyCode: originalCode })} ${t("detail.equivalentLabelFull", { namespace: "fixedAssets", fallback: "(ما يعادل {{amount}})", vars: { amount: formatAmount(netBookValue / assetRate, { currencyCode: baseCode }) } })}` : formatAmount(netBookValue, { currencyCode: baseCode }) },
            ]}
            className="p-3"
          />
        )}

        {fixedMovements.length > 0 && (
          <SidebarDetailGrid
            title={t("detail.movementsTitle", { namespace: "fixedAssets", fallback: "الحركات (آخر 5)" })}
            fields={fixedMovements.slice(-5).reverse().map(m => ({
              label: `${t("movementTypes." + m.movement_type, { namespace: "fixedAssets", fallback: movementLabels[m.movement_type] || m.movement_type })} - ${new Date(m.date).toLocaleDateString("ar-SA")}`,
              value: formatInBase(m.amount),
            }))}
            className="p-3"
          />
        )}
      </SidebarBody>
    </SidebarShell>
  );
}
