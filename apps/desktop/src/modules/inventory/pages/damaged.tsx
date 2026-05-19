import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@shared/ui/button";
import { Plus, AlertTriangle, Banknote, PackageOpen } from "lucide-react";
import { formatDateTime } from '@shared/lib/format';
import { damagedService } from '@modules/inventory/api/inventoryService';
import { materialService } from '@modules/inventory/api/materialService';
import type { DamagedItem, CreateDamagedItemRequest, MaterialDto } from "@erp/shared-types";
import { toast } from "sonner";
import { cn } from "@shared/lib/utils";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";

// Refactored Components & Hooks
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { TableShell } from '@widgets/table-shell/TableShell';
import { useDataTable, useColumnPreferences } from '@shared/hooks';
import { DamagedForm } from '@modules/inventory/components/DamagedForm';
import { useCurrencyContext } from "@app/providers/CurrencyContext";

export default function DamagedPage() {
  const { formatAmount, currencies, formatMonetaryAmount } = useCurrencyContext();
  const {
    filtered: items,
    loading: itemsLoading,
    refreshing,
    search,
    setSearch,
    refresh,
  } = useDataTable<DamagedItem>({
    fetchData: () => damagedService.listDamagedItems(),
    searchFields: ["product_name", "product_id", "reason"],
  });

  const [products, setProducts] = useState<MaterialDto[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadProducts = useCallback(async () => {
    try {
      setLoadingProducts(true);
      const pData = await materialService.listMaterials();
      setProducts(pData);
    } catch (e: unknown) {
      toast.error("فشل تحميل المنتجات");
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const allColumns = useMemo<UnifiedColumn<DamagedItem>[]>(() => {
    const cols: UnifiedColumn<DamagedItem>[] = [
      { 
        id: "product_name",
        header: "المنتج / الصنف", 
        label: "اسم المنتج", 
        accessor: (i) => i.product_name ?? i.product_id, 
        className: "font-black text-slate-900 min-w-[180px]" 
      },
      { 
        id: "reason",
        header: "السبب", 
        label: "سبب التلف", 
        accessor: (i) => i.reason || "—", 
        className: "text-slate-500 text-xs font-medium italic min-w-[150px]" 
      },
      { 
        id: "damage_date",
        header: "التاريخ", 
        label: "تاريخ التسجيل", 
        accessor: (i) => formatDateTime(i.damage_date),
        className: "tabular-nums text-slate-500 font-medium w-32"
      },
      { 
        id: "quantity",
        header: "الكمية", 
        label: "الكمية التالفة", 
        accessor: (i) => parseFloat(i.quantity).toFixed(2), 
        align: "left", 
        className: "tabular-nums font-bold text-amber-600 w-24" 
      },
    ];

    // Multi-currency cost columns
    currencies.forEach(curr => {
      cols.push({
        id: `cost_${curr.code}`,
        header: `الخسارة (${curr.symbol || curr.code})`,
        label: `مبلغ الخسارة (${curr.symbol || curr.code})`,
        accessor: (i) => {
          const val = parseFloat(i.cost_impact || "0");
          return formatAmount(val, { currencyCode: curr.code });
        },
        align: "left",
        className: "tabular-nums font-black text-rose-600 text-[11px]"
      });
    });

    return cols;
  }, [formatAmount, currencies]);

  const { visibleColumns, toggleColumn } = useColumnPreferences("damaged-items-unified", ["product_name", "damage_date", "quantity"]);

  const enrichedColumns = useMemo(() => {
    return allColumns.map(col => ({
      ...col,
      visible: visibleColumns.includes(col.id)
    }));
  }, [allColumns, visibleColumns]);

  const toolbarColumns = useMemo(() => {
    return allColumns.map(c => ({
      id: c.id,
      label: c.label || (typeof c.header === 'string' ? c.header : c.id),
      visible: visibleColumns.includes(c.id)
    }));
  }, [allColumns, visibleColumns]);

  const totalCost = useMemo(() => items.reduce((s: number, i: DamagedItem) => s + parseFloat(i.cost_impact || "0"), 0), [items]);
  const totalQty = useMemo(() => items.reduce((s: number, i: DamagedItem) => s + parseFloat(i.quantity || "0"), 0), [items]);

  const handleCreate = async (payload: CreateDamagedItemRequest) => {
    setSaving(true);
    try {
      await damagedService.createDamagedItem(payload);
      setShowDialog(false);
      refresh(true);
      toast.success("تم تسجيل التالف بنجاح");
    } catch (e: unknown) {
      toast.error("فشل الحفظ: " + e);
    } finally {
      setSaving(false);
    }
  };

  const isLoading = itemsLoading || refreshing || loadingProducts;

  const stats = useMemo(() => [
    { label: "إجمالي السجلات", value: items.length, icon: AlertTriangle, color: "text-amber-500" },
    { label: "إجمالي الكميات", value: totalQty.toFixed(2), icon: PackageOpen, color: "text-amber-600" },
    { label: "خسائر التكلفة", value: formatMonetaryAmount(totalCost, "base"), icon: Banknote, color: "text-rose-600" },
  ], [items.length, totalQty, totalCost, formatMonetaryAmount]);

  return (
    <OperationalTableTemplate
      title="إدارة المواد التالفة"
      stats={stats}
      toolbar={
        <Button size="sm" onClick={() => setShowDialog(true)} className="bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-100 font-bold">
          <Plus className="w-4 h-4 ml-2" /> تسجيل تالف
        </Button>
      }
      tableContent={
        <TableShell
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="بحث بالمنتج أو السبب..."
          columns={toolbarColumns}
          onColumnToggle={toggleColumn}
        >
          <UnifiedTable
            data={items}
            columns={enrichedColumns}
            loading={isLoading}
            emptyMessage={search ? "لا توجد نتائج للبحث" : "لا توجد سجلات تالف"}
          />
        </TableShell>
      }
    >
      <DamagedForm
        open={showDialog}
        onClose={() => setShowDialog(false)}
        products={products}
        onSave={handleCreate}
        saving={saving}
      />
    </OperationalTableTemplate>
  );
}
