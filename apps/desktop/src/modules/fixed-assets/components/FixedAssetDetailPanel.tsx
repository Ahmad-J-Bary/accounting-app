import { Button } from "@shared/ui/button";
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

interface FixedAssetDetailPanelProps {
  asset: FixedAssetDto;
  movements: AssetMovement[];
  onClose: () => void;
  onDepreciation?: (assetId: string) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  categoryName?: string;
  warehouseName?: string;
}

const statusLabels: Record<string, string> = {
  Active: "نشط",
  Disposed: "مستبعد",
  Sold: "مباع",
  Damaged: "تالف",
};

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

export function FixedAssetDetailPanel({ asset, movements, onClose, onDepreciation, onEdit, onDelete, categoryName, warehouseName }: FixedAssetDetailPanelProps) {
  const { formatAmount, toBase, baseCurrency } = useCurrencyContext();
  const baseCode = baseCurrency?.code;

  const netBookValue = parseFloat(asset.purchase_cost.amount) - parseFloat(asset.accumulated_depreciation.amount);
  const canDepreciate = asset.useful_life_months > 0;

  const fixedMovements = movements.filter(m => FIXED_ASSET_MOVEMENT_TYPES.has(m.movement_type));
  const lastDepreciationDate = fixedMovements
    .filter(m => m.movement_type === "Depreciation")
    .slice(-1)[0]?.date;

  function formatInBase(m: { amount: string; currency: { code: string } } | undefined | null): string {
    if (!m) return "-";
    const base = toBase(parseFloat(m.amount), m.currency.code);
    return formatAmount(base, { currencyCode: baseCode });
  }

  const infoFields = [
    { label: "التصنيف", value: categoryName || asset.category_id },
    { label: "تاريخ الشراء", value: new Date(asset.purchase_date).toLocaleDateString("ar-SA") },
    { label: "تكلفة الشراء", value: formatInBase(asset.purchase_cost) },
  ];

  if (warehouseName) {
    infoFields.push({ label: "المستودع", value: warehouseName });
  }
  if (asset.salvage_value) {
    infoFields.push({ label: "قيمة الخردة", value: formatInBase(asset.salvage_value) });
  }
  if (canDepreciate) {
    infoFields.push({ label: "العمر الإنتاجي", value: `${asset.useful_life_months} شهر` });
  }
  if (asset.location) {
    infoFields.push({ label: "الموقع", value: asset.location });
  }

  const actions: SidebarAction[] = [];
  if (onEdit) {
    actions.push({ label: "تعديل", icon: <Pencil className="w-4 h-4" />, onClick: onEdit, variant: "warning" });
  }
  if (onDelete) {
    actions.push({
      label: "حذف",
      icon: <Trash2 className="w-4 h-4" />,
      variant: "danger",
      onClick: () => {
        if (confirm(`هل أنت متأكد من حذف "${asset.name}"؟`)) {
          onDelete();
        }
      },
    });
  }

  return (
    <SidebarShell onClose={onClose}>
      <SidebarHeader title={asset.name} subtitle={`الكود: ${asset.code}`} onClose={onClose} />
      <SidebarActionBar actions={actions} />
      <SidebarBody>
        {onDepreciation && canDepreciate && (
          <div className="mb-3">
            <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => onDepreciation(asset.id)}>
              ترحيل قيد الإهلاك
            </Button>
            {lastDepreciationDate && (
              <p className="text-[10px] text-slate-400 mt-1 text-center">
                آخر إهلاك: {new Date(lastDepreciationDate).toLocaleDateString("ar-SA")}
              </p>
            )}
          </div>
        )}

        <SidebarDetailGrid title="معلومات الأصل" fields={infoFields} columns={2} className="p-3" />

        {canDepreciate && (
          <SidebarDetailGrid
            title="الإهلاك"
            fields={[
              { label: "مجمع الإهلاك", value: formatInBase(asset.accumulated_depreciation) },
              { label: "صافي القيمة الدفترية", value: formatAmount(toBase(netBookValue, asset.purchase_cost.currency.code), { currencyCode: baseCode }) },
            ]}
            className="p-3"
          />
        )}

        <SidebarDetailGrid
          title="الحالة"
          fields={[
            { label: "الحالة", value: statusLabels[asset.status] || asset.status },
            { label: "الملاحظات", value: asset.notes || "-" },
          ]}
          className="p-3"
        />

        {fixedMovements.length > 0 && (
          <SidebarDetailGrid
            title="الحركات (آخر 5)"
            fields={fixedMovements.slice(-5).reverse().map(m => ({
              label: `${movementLabels[m.movement_type] || m.movement_type} - ${new Date(m.date).toLocaleDateString("ar-SA")}`,
              value: formatInBase(m.amount),
            }))}
            className="p-3"
          />
        )}
      </SidebarBody>
    </SidebarShell>
  );
}
