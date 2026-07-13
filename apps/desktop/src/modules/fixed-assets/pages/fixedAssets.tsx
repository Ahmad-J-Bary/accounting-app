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
import { useBaseCurrencyColumns } from "@shared/hooks";
import type { UnifiedColumn } from "@widgets/table-shell/UnifiedTable";
import { TableActions } from "@widgets/table-shell/TableActions";
import { WarehouseSelector } from "@modules/inventory/components/WarehouseSelector";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shared/ui/select";

export default function FixedAssetsPage() {
  const { currencies, formatAmount } = useCurrencyContext();
  const { isBaseCurrency } = useBaseCurrencyColumns();

  const {
    filtered: allAssets,
    loading,
    search,
    setSearch,
    refresh,
  } = useDataTable<FixedAssetDto>({
    queryKey: ["fixed-assets"],
    fetchData: () => fixedAssetService.list(),
    searchFields: ["code", "name", "location", "notes"],
  });

  const [categories, setCategories] = useState<AssetCategoryDto[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseDto[]>([]);
  const [assetTypeFilter, setAssetTypeFilter] = useState<"all" | "buildings_land" | "equipment" | "furniture">("all");
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [editingAsset, setEditingAsset] = useState<FixedAssetDto | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<FixedAssetDto | null>(null);
  const [movements, setMovements] = useState<AssetMovement[]>([]);

  useEffect(() => {
    Promise.all([
      fixedAssetService.listCategories("Fixed"),
      warehouseService.list(),
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

  const handleRowClick = useCallback(
    (asset: FixedAssetDto) => {
      setSelectedAsset(asset);
      setEditingAsset(null);
      loadMovements(asset.id);
      setShowForm(false);
    },
    [loadMovements]
  );

  const handleEdit = useCallback((asset: FixedAssetDto) => {
    setEditingAsset(asset);
    setSelectedAsset(null);
    setShowForm(true);
  }, []);

  const handleDelete = useCallback(async (asset: FixedAssetDto) => {
    if (!confirm(`هل أنت متأكد من حذف الأصل "${asset.name}"؟\nهذه العملية لا يمكن التراجع عنها.`)) return;
    try {
      await fixedAssetService.delete(asset.id);
      toast.success("تم حذف الأصل بنجاح");
      if (selectedAsset?.id === asset.id) setSelectedAsset(null);
      refresh(true);
    } catch (e) {
      toast.error("فشل حذف الأصل: " + e);
    }
  }, [refresh, selectedAsset]);

  const allColumns: UnifiedColumn<FixedAssetDto>[] = useMemo(
    () => {
      const cols: UnifiedColumn<FixedAssetDto>[] = [
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
      ];

      currencies.forEach((curr) => {
        const symbol = curr.symbol || curr.code;
        cols.push({
          id: `purchase_cost_${curr.code}`,
          header: `التكلفة (${symbol})`,
          label: `التكلفة (${symbol})`,
          accessor: (r: FixedAssetDto) => {
            const val = parseFloat(r.purchase_cost.amount);
            if (Math.abs(val) === 0) return "";
            if (curr.code === r.purchase_cost.currency.code) {
              return formatAmount(val, { currencyCode: curr.code });
            }
            const rate = parseFloat(r.fx_rate) || 1;
            const base = val / rate;
            return formatAmount(base, { currencyCode: curr.code });
          },
          className: "tabular-nums font-black text-slate-900",
        });
      });
      currencies.forEach((curr) => {
        const symbol = curr.symbol || curr.code;
        cols.push({
          id: `accumulated_depreciation_${curr.code}`,
          header: `مجمع الإهلاك (${symbol})`,
          label: `مجمع الإهلاك (${symbol})`,
          accessor: (r: FixedAssetDto) => {
            const val = parseFloat(r.accumulated_depreciation.amount);
            if (val === 0 && r.useful_life_months === 0)
              return <span className="text-slate-400 text-xs">لا ينطبق</span>;
            if (Math.abs(val) === 0) return "";
            if (curr.code === r.accumulated_depreciation.currency.code) {
              return formatAmount(val, { currencyCode: curr.code });
            }
            const rate = parseFloat(r.fx_rate) || 1;
            const base = val / rate;
            return formatAmount(base, { currencyCode: curr.code });
          },
          className: "tabular-nums font-black text-slate-900",
        });
      });
      currencies.forEach((curr) => {
        const symbol = curr.symbol || curr.code;
        cols.push({
          id: `net_book_value_${curr.code}`,
          header: `صافي القيمة (${symbol})`,
          label: `صافي القيمة (${symbol})`,
          accessor: (r: FixedAssetDto) => {
            const nbv =
              parseFloat(r.purchase_cost.amount) -
              parseFloat(r.accumulated_depreciation.amount);
            if (Math.abs(nbv) === 0) return "";
            if (curr.code === r.purchase_cost.currency.code) {
              return formatAmount(nbv, { currencyCode: curr.code });
            }
            const rate = parseFloat(r.fx_rate) || 1;
            const base = nbv / rate;
            return formatAmount(base, { currencyCode: curr.code });
          },
          className: "tabular-nums font-black text-slate-900",
        });
      });

      cols.push(
        {
          id: "notes",
          header: "التوصيف",
          accessor: (r: FixedAssetDto) => r.notes || "—",
          className: "max-w-[200px] truncate text-xs",
        },
        {
          id: "created_at",
          header: "التاريخ",
          accessor: (r: FixedAssetDto) =>
            new Date(r.created_at).toLocaleString("ar-SA"),
          className: "w-36 text-center text-xs",
        },
        {
          id: "actions",
          header: "إجراءات",
          accessor: (r: FixedAssetDto) => (
            <TableActions
              onView={() => handleRowClick(r)}
              onEdit={() => handleEdit(r)}
              onDelete={() => handleDelete(r)}
            />
          ),
          className: "w-24",
        }
      );

      return cols;
    },
    [warehouseMap, categoryMap, handleRowClick, handleEdit, handleDelete, currencies, formatAmount]
  );

  const columns = useMemo(() => {
    if (assetTypeFilter === "buildings_land") {
      return allColumns.filter(
        (c) => c.id !== "warehouse" && !c.id.startsWith("accumulated_depreciation_")
      );
    }
    return allColumns;
  }, [allColumns, assetTypeFilter]);

  const handleRunRotation = useCallback(async () => {
    if (!confirm("هل تريد تدوير الحسابات وترحيل إهلاك الأصول لهذا العام؟")) return;
    try {
      const results = await fixedAssetService.runYearlyRotation(new Date().toISOString());
      toast.success(`تم ترحيل إهلاك ${results.length} أصل بنجاح`);
      refresh(true);
    } catch (e) {
      toast.error("فشل تدوير الحسابات: " + e);
    }
  }, [refresh]);

  const defaultVisible = useMemo(() => {
    const ids: string[] = ["code", "name", "category"];
    if (!(assetTypeFilter === "buildings_land")) {
      ids.push("warehouse");
    }
    currencies.forEach((curr) => {
      if (isBaseCurrency(curr.code)) {
        ids.push(`purchase_cost_${curr.code}`);
        if (!(assetTypeFilter === "buildings_land")) {
          ids.push(`accumulated_depreciation_${curr.code}`);
        }
        ids.push(`net_book_value_${curr.code}`);
      }
    });
    ids.push("notes", "created_at", "actions");
    return ids;
  }, [currencies, isBaseCurrency, assetTypeFilter]);

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
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            onClick={handleRunRotation}
          >
            تدوير الحسابات
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setSelectedAsset(null);
              setEditingAsset(null);
              setShowForm(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 font-bold"
          >
            <Plus className="w-4 h-4 ml-2" /> أصل جديد
          </Button>
        </div>
      }
      tableContent={
        <SharedTable
          columns={columns}
          data={assets}
          loading={loading}
          search={search}
          onSearchChange={setSearch}
          tableId="fixed-assets"
          defaultVisible={defaultVisible}
          selectedId={selectedAsset?.id}
          onRowClick={handleRowClick}
          filterBar={
            <div className="flex items-center gap-2">
              <Select
                dir="rtl"
                value={assetTypeFilter}
                onValueChange={(v: "all" | "buildings_land" | "equipment" | "furniture") => {
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
            asset={editingAsset ?? undefined}
            initialCategoryId={selectedCategoryId}
            onClose={() => { setShowForm(false); setEditingAsset(null); }}
            onSaved={() => {
              setShowForm(false);
              setEditingAsset(null);
              refresh(true);
            }}
          />
        ) : selectedAsset ? (
          <FixedAssetDetailPanel
            asset={selectedAsset}
            movements={movements}
            onClose={() => setSelectedAsset(null)}
            onEdit={() => handleEdit(selectedAsset)}
            onDelete={() => handleDelete(selectedAsset)}
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
