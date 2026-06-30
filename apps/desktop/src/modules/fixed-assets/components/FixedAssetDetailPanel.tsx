import { Button } from "@shared/ui/button";
import { DetailPanel } from "@widgets/sidebar-shell/DetailPanel";
import { SidebarDetailGrid } from "@widgets/sidebar-shell/SidebarDetailGrid";
import type { FixedAssetDto, AssetMovement } from "@erp/shared-types";

interface FixedAssetDetailPanelProps {
  asset: FixedAssetDto;
  movements: AssetMovement[];
  onClose: () => void;
  onDepreciation?: (assetId: string) => void;
  categoryName?: string;
  warehouseName?: string;
}

function formatMoney(m: { amount: string; currency: { code: string } } | undefined | null): string {
  if (!m) return "-";
  return `${parseFloat(m.amount).toLocaleString()} ${m.currency.code}`;
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

export function FixedAssetDetailPanel({ asset, movements, onClose, onDepreciation, categoryName, warehouseName }: FixedAssetDetailPanelProps) {
  const canDepreciate = asset.useful_life_months > 0;
  const netBookValue = (parseFloat(asset.purchase_cost.amount) - parseFloat(asset.accumulated_depreciation.amount)).toLocaleString();

  const fixedMovements = movements.filter(m => FIXED_ASSET_MOVEMENT_TYPES.has(m.movement_type));
  const lastDepreciationDate = fixedMovements
    .filter(m => m.movement_type === "Depreciation")
    .slice(-1)[0]?.date;

  const infoFields = [
    { label: "التصنيف", value: categoryName || asset.category_id },
    { label: "تاريخ الشراء", value: new Date(asset.purchase_date).toLocaleDateString("ar-SA") },
    { label: "تكلفة الشراء", value: formatMoney(asset.purchase_cost) },
  ];

  if (warehouseName) {
    infoFields.push({ label: "المستودع", value: warehouseName });
  }
  if (asset.salvage_value) {
    infoFields.push({ label: "قيمة الخردة", value: formatMoney(asset.salvage_value) });
  }
  if (canDepreciate) {
    infoFields.push({ label: "العمر الإنتاجي", value: `${asset.useful_life_months} شهر` });
  }
  if (asset.location) {
    infoFields.push({ label: "الموقع", value: asset.location });
  }

  return (
    <DetailPanel title={asset.name} subtitle={`الكود: ${asset.code}`} onClose={onClose}>
      {onDepreciation && canDepreciate && (
        <div className="px-4 pt-2">
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

      <SidebarDetailGrid title="معلومات الأصل" fields={infoFields} />

      {canDepreciate && (
        <SidebarDetailGrid
          title="الإهلاك"
          fields={[
            { label: "مجمع الإهلاك", value: formatMoney(asset.accumulated_depreciation) },
            { label: "صافي القيمة الدفترية", value: `${netBookValue} ${asset.purchase_cost.currency.code}` },
          ]}
        />
      )}

      <SidebarDetailGrid
        title="الحالة"
        fields={[
          { label: "الحالة", value: statusLabels[asset.status] || asset.status },
          { label: "الملاحظات", value: asset.notes || "-" },
        ]}
      />

      {fixedMovements.length > 0 && (
        <SidebarDetailGrid
          title="الحركات (آخر 5)"
          fields={fixedMovements.slice(-5).reverse().map(m => ({
            label: `${movementLabels[m.movement_type] || m.movement_type} - ${new Date(m.date).toLocaleDateString("ar-SA")}`,
            value: formatMoney(m.amount),
          }))}
        />
      )}
    </DetailPanel>
  );
}
