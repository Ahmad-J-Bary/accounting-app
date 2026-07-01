import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@shared/ui/button";
import { Plus } from "lucide-react";
import { fixedAssetService } from "@modules/fixed-assets/api/fixedAssetService";
import { warehouseService } from "@modules/inventory/api/warehouseService";
import type {
  FixedAssetDto,
  AssetMovement,
  WarehouseDto,
  AssetCategoryDto,
} from "@erp/shared-types";
import { toast } from "sonner";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { SharedTable } from "@widgets/table-shell/SharedTable";
import { useDataTable } from "@shared/hooks";
import { FixedAssetForm } from "@modules/fixed-assets/components/FixedAssetForm";
import { FixedAssetDetailPanel } from "@modules/fixed-assets/components/FixedAssetDetailPanel";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import type { UnifiedColumn } from "@widgets/table-shell/UnifiedTable";
import { WarehouseSelector } from "@modules/inventory/components/WarehouseSelector";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shared/ui/select";

const STATUS_LABELS: Record<string, string> = {
  Active: "نشط",
  Disposed: "مستبعد",
  Sold: "مباع",
  Damaged: "تالف",
};

const STATUS_CLASSES: Record<string, string> = {
  Active: "bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full text-xs font-medium",
  Disposed: "bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full text-xs font-medium",
  Sold: "bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full text-xs font-medium",
  Damaged: "bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded-full text-xs font-medium",
};

export default function FixedAssetsPage() {
  const { currencies } = useCurrencyContext();

  const {
    filtered: allAssets,
    loading,
    search,
    setSearch,
    refresh,
  } = useDataTable<FixedAssetDto>({
    fetchData: () => fixedAssetService.list(),
    searchFields: ["code", "name", "location", "notes"],
  });

  const [categories, setCategories] = useState<AssetCategoryDto[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseDto[]>([]);
  const [assetTypeFilter, setAssetTypeFilter] = useState<"all" | "buildings_land" | "equipment" | "furniture">("all");
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<FixedAssetDto | null>(null);
  const [movements, setMovements] = useState<AssetMovement[]>([]);

  useEffect(() => {
    Promise.all([
      fixedAssetService.listCategories("Fixed"),
      warehouseService.listWarehouses(),
    ])
      .then(([cats, whs]) => {
        setCategories(cats);
        setWarehouses(whs);
      })
      .catch(() => {});
  }, []);

  const categoryMap = useMemo(() => {
    const m = new Map<string, string>();
    categories.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [categories]);

  const activeWarehouses = useMemo(
    () => warehouses.filter((w) => w.is_active),
    [warehouses]
  );

  const warehouseMap = useMemo(() => {
    const m = new Map<string, string>();
    warehouses.forEach((w) => m.set(w.id, w.name));
    return m;
  }, [warehouses]);

  // Determine if warehouse filter is applicable (only for equipment and furniture)
  const isWarehouseApplicable = assetTypeFilter === "equipment" || assetTypeFilter === "furniture";

  // Only show warehouse filter when applicable AND there are multiple active warehouses
  const showWarehouseFilter = isWarehouseApplicable && activeWarehouses.length > 1;

  const assets = useMemo(() => {
    let filtered = allAssets;

    // 1. Filter by Asset Type
    if (assetTypeFilter !== "all") {
      filtered = filtered.filter((a) => {
        const categoryName = categoryMap.get(a.category_id)?.toLowerCase() || "";
        if (assetTypeFilter === "buildings_land") {
          return (
            categoryName.includes("أبنية") ||
            categoryName.includes("أراضي") ||
            categoryName.includes("land") ||
            categoryName.includes("building")
          );
        }
        if (assetTypeFilter === "equipment") {
          return (
            categoryName.includes("معدات") ||
            categoryName.includes("تجهيزات") ||
            categoryName.includes("equipment")
          );
        }
        if (assetTypeFilter === "furniture") {
          return (
            categoryName.includes("أثاث") ||
            categoryName.includes("مفروشات") ||
            categoryName.includes("furniture")
          );
        }
        return true;
      });
    }

    // 2. Filter by Warehouse (only if applicable)
    if (isWarehouseApplicable && warehouseFilter !== "all") {
      filtered = filtered.filter((a) => a.warehouse_id === warehouseFilter);
    }

    return filtered;
  }, [allAssets, assetTypeFilter, warehouseFilter, categoryMap, isWarehouseApplicable]);

  const loadMovements = useCallback(async (assetId: string) => {
    try {
      const data = await fixedAssetService.listMovements(assetId);
      setMovements(data);
    } catch {
      setMovements([]);
    }
  }, []);

  const allColumns: UnifiedColumn<FixedAssetDto>[] = useMemo(
    () => [
      {
        id: "code",
        header: "الكود",
        accessor: "code",
        className: "font-mono w-24",
      },
      { id: "name", header: "الاسم", accessor: "name" },
      {
        id: "category",
        header: "التصنيف",
        accessor: (r: FixedAssetDto) => categoryMap.get(r.category_id) || "-",
        className: "w-32 text-center",
      },
      {
        id: "warehouse",
        header: "المستودع",
        accessor: (r: FixedAssetDto) =>
          r.warehouse_id ? warehouseMap.get(r.warehouse_id) || "-" : "-",
        className: "w-28 text-center",
      },
      {
        id: "purchase_date",
        header: "تاريخ الشراء",
        accessor: (r: FixedAssetDto) =>
          new Date(r.purchase_date).toLocaleDateString("ar-SA"),
        className: "w-28 text-center",
      },
      {
        id: "purchase_cost",
        header: "التكلفة",
        accessor: (r: FixedAssetDto) =>
          `${parseFloat(r.purchase_cost.amount).toLocaleString()} ${r.purchase_cost.currency.code}`,
        className: "w-32 text-left",
      },
      {
        id: "accumulated_depreciation",
        header: "مجمع الإهلاك",
        accessor: (r: FixedAssetDto) => {
          const amt = parseFloat(r.accumulated_depreciation.amount);
          if (amt === 0 && r.useful_life_months === 0)
            return <span className="text-slate-400 text-xs">لا ينطبق</span>;
          return `${amt.toLocaleString()} ${r.accumulated_depreciation.currency.code}`;
        },
        className: "w-32 text-left",
      },
      {
        id: "net_book_value",
        header: "صافي القيمة",
        accessor: (r: FixedAssetDto) => {
          const nbv =
            parseFloat(r.purchase_cost.amount) -
            parseFloat(r.accumulated_depreciation.amount);
          return `${nbv.toLocaleString()} ${r.purchase_cost.currency.code}`;
        },
        className: "w-32 text-left font-bold",
      },
      {
        id: "status",
        header: "الحالة",
        accessor: (r: FixedAssetDto) => (
          <span className={STATUS_CLASSES[r.status] || ""}>
            {STATUS_LABELS[r.status] || r.status}
          </span>
        ),
        className: "w-24 text-center",
      },
    ],
    [warehouseMap, categoryMap]
  );

  const columns = useMemo(() => {
    if (assetTypeFilter === "buildings_land") {
      return allColumns.filter(
        (c) => c.id !== "warehouse" && c.id !== "accumulated_depreciation"
      );
    }
    return allColumns;
  }, [allColumns, assetTypeFilter]);

  const handleRowClick = useCallback(
    (asset: FixedAssetDto) => {
      setSelectedAsset(asset);
      loadMovements(asset.id);
      setShowForm(false);
    },
    [loadMovements]
  );

  const handlePostDepreciation = useCallback(
    async (assetId: string) => {
      if (!confirm("هل تريد ترحيل قيد إهلاك لهذا الشهر؟")) return;
      try {
        await fixedAssetService.postDepreciation(assetId, new Date().toISOString());
        toast.success("تم ترحيل الإهلاك بنجاح");
        refresh(true);
        if (selectedAsset?.id === assetId) loadMovements(assetId);
      } catch (e) {
        toast.error("فشل ترحيل الإهلاك: " + e);
      }
    },
    [refresh, selectedAsset, loadMovements]
  );

  // Determine the default category ID to pass to Form if filtering by type
  const selectedCategoryId = useMemo(() => {
    if (assetTypeFilter === "all") return undefined;
    const cat = categories.find((c) => {
      const lower = c.name.toLowerCase();
      if (assetTypeFilter === "buildings_land") {
        return lower.includes("أبنية") || lower.includes("أراضي") || lower.includes("land") || lower.includes("building");
      }
      if (assetTypeFilter === "equipment") {
        return lower.includes("معدات") || lower.includes("تجهيزات") || lower.includes("equipment");
      }
      if (assetTypeFilter === "furniture") {
        return lower.includes("أثاث") || lower.includes("مفروشات") || lower.includes("furniture");
      }
      return false;
    });
    return cat?.id;
  }, [assetTypeFilter, categories]);

  return (
    <OperationalTableTemplate
      title="الأصول الثابتة"
      toolbar={
        <Button
          size="sm"
          onClick={() => {
            setSelectedAsset(null);
            setShowForm(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 font-bold"
        >
          <Plus className="w-4 h-4 ml-2" /> أصل جديد
        </Button>
      }
      tableContent={
        <SharedTable
          columns={columns}
          data={assets}
          loading={loading}
          search={search}
          onSearchChange={setSearch}
          tableId="fixed-assets"
          selectedId={selectedAsset?.id}
          onRowClick={handleRowClick}
          filterBar={
            <div className="flex items-center gap-2">
              <Select
                dir="rtl"
                value={assetTypeFilter}
                onValueChange={(v: any) => {
                  setAssetTypeFilter(v);
                  setWarehouseFilter("all");
                }}
              >
                <SelectTrigger className="w-[180px] bg-white border-slate-200 h-8 text-xs font-bold text-slate-700">
                  <SelectValue placeholder="نوع الأصل" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">كل الأصول</SelectItem>
                  <SelectItem value="buildings_land" className="text-xs">أبنية وأراضي</SelectItem>
                  <SelectItem value="equipment" className="text-xs">معدات وتجهيزات</SelectItem>
                  <SelectItem value="furniture" className="text-xs">أثاث ومفروشات</SelectItem>
                </SelectContent>
              </Select>

              {showWarehouseFilter && (
                <WarehouseSelector
                  warehouses={activeWarehouses}
                  value={warehouseFilter}
                  onValueChange={(v) => setWarehouseFilter(v)}
                  includeAll
                  placeholder="جميع المستودعات"
                  className="w-[150px] h-8 text-xs"
                />
              )}
            </div>
          }
        />
      }
      sidePanel={
        showForm ? (
          <FixedAssetForm
            currencies={currencies}
            initialCategoryId={selectedCategoryId}
            onClose={() => setShowForm(false)}
            onSaved={() => {
              setShowForm(false);
              refresh(true);
            }}
          />
        ) : selectedAsset ? (
          <FixedAssetDetailPanel
            asset={selectedAsset}
            movements={movements}
            onClose={() => setSelectedAsset(null)}
            onDepreciation={handlePostDepreciation}
            categoryName={categoryMap.get(selectedAsset.category_id)}
            warehouseName={
              selectedAsset.warehouse_id
                ? warehouseMap.get(selectedAsset.warehouse_id)
                : undefined
            }
          />
        ) : null
      }
      isPanelOpen={!!showForm || !!selectedAsset}
    />
  );
}
