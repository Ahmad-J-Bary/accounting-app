import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Plus, Search, AlertTriangle, Banknote, PackageOpen, Settings2 } from "lucide-react";
import { formatDateTime } from '@shared/lib/format';
import { damagedService } from '@modules/inventory/api/inventoryService';
import { materialService } from '@modules/inventory/api/materialService';
import type { DamagedItem, CreateDamagedItemRequest, MaterialDto } from "@erp/shared-types";
import { toast } from "sonner";
import { cn } from "@shared/lib/utils";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem } from "@shared/ui/dropdown-menu";

// Refactored Components & Hooks
import { DataTable, Column } from '@widgets/table-shell/DataTable';
import { useDataTable, useColumnPreferences } from '@shared/hooks';
import { DamagedForm } from '@modules/inventory/components/DamagedForm';
import { useCurrencyContext } from "@app/providers/CurrencyContext";

export default function Damaged() {
  const { formatAmount, currencies, baseCurrency, formatMonetaryAmount } = useCurrencyContext();
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

  const availableColumns = useMemo(() => {
    const cols = [
      { id: "product_name", label: "المنتج" },
      { id: "reason", label: "السبب" },
      { id: "damage_date", label: "التاريخ" },
      { id: "quantity", label: "الكمية" },
    ];

    currencies.forEach(curr => {
      const s = curr.symbol || curr.code;
      cols.push({ id: `cost_${curr.code}`, label: `خسارة التكلفة (${s})` });
    });

    return cols;
  }, [currencies]);

  const defaultVisibleColumns = useMemo(() => {
    const base = ["product_name", "damage_date", "quantity"];
    if (baseCurrency) {
      base.push(`cost_${baseCurrency.code}`);
    }
    return base;
  }, [baseCurrency]);

  const { visibleColumns, toggleColumn, isVisible } = useColumnPreferences("damaged_items", defaultVisibleColumns);

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

  const columns = useMemo<Column<DamagedItem>[]>(() => {
    const cols: Column<DamagedItem>[] = [
      { 
        id: "product_name",
        header: "المنتج / الصنف", 
        accessor: (i: DamagedItem) => i.product_name ?? i.product_id, 
        className: "font-black text-slate-900" 
      },
      { 
        id: "reason",
        header: "السبب", 
        accessor: "reason", 
        className: "text-slate-500 text-xs font-medium italic" 
      },
      { 
        id: "damage_date",
        header: "التاريخ", 
        accessor: (i: DamagedItem) => formatDateTime(i.damage_date),
        className: "tabular-nums text-slate-500 font-medium"
      },
      { 
        id: "quantity",
        header: "الكمية", 
        accessor: (i: DamagedItem) => parseFloat(i.quantity).toFixed(2), 
        align: "left", 
        className: "tabular-nums font-bold text-amber-600" 
      },
    ];

    // Multi-currency cost columns
    currencies.forEach(curr => {
      cols.push({
        id: `cost_${curr.code}`,
        header: `الخسارة (${curr.symbol || curr.code})`,
        accessor: (i) => {
          const val = parseFloat(i.cost_impact);
          return formatAmount(val, { currencyCode: curr.code });
        },
        align: "left",
        className: "tabular-nums font-black text-rose-600 text-[11px]"
      });
    });

    return cols;
  }, [formatAmount, currencies]);

  const filteredColumns = useMemo(() => {
    return columns.filter(col => {
      if (!col.id) return true;
      return visibleColumns.includes(col.id);
    });
  }, [columns, visibleColumns]);

  const isLoading = itemsLoading || refreshing || loadingProducts;

  const stats = useMemo(() => [
    { label: "إجمالي السجلات", value: items.length, icon: AlertTriangle, color: "text-amber-500" },
    { label: "إجمالي الكميات", value: totalQty.toFixed(2), icon: PackageOpen, color: "text-amber-600" },
    { label: "خسائر التكلفة", value: formatMonetaryAmount(totalCost.toString(), "base"), icon: Banknote, color: "text-rose-600" },
  ], [items, totalQty, totalCost, formatMonetaryAmount]);

  return (
    <OperationalTableTemplate
      title="إدارة المواد التالفة"
      toolbar={
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setShowDialog(true)} className="bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-100">
            <Plus className="w-4 h-4 ml-2" />تسجيل تالف
          </Button>
        </div>
      }
      filterBar={
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="بحث بالمنتج أو السبب..."
              className="pr-10 h-11 border-slate-200 focus:ring-2 focus:ring-blue-500 transition-all"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-11 w-11 bg-white border-slate-200">
                <Settings2 className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[220px] max-h-[450px] overflow-y-auto shadow-xl">
              <DropdownMenuLabel className="text-right text-xs font-black uppercase text-slate-400 tracking-widest">تخصيص الأعمدة</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {availableColumns.map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={isVisible(col.id)}
                  onCheckedChange={() => toggleColumn(col.id)}
                  className="text-right flex-row-reverse gap-2 text-xs font-bold py-2"
                >
                  {col.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center gap-6 mr-auto pl-2">
            {stats.map((s, i) => (
              <div key={i} className="flex flex-col items-start gap-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{s.label}</span>
                <div className="flex items-center gap-2">
                   <s.icon className={cn("w-4 h-4", s.color)} />
                   <span className={cn("text-lg font-black tabular-nums", s.color)}>{s.value}</span>
                </div>
              </div>
            ))}
          </div>

        </div>
      }
      tableContent={
        <DataTable
          data={items}
          columns={filteredColumns}
          loading={isLoading}
          emptyMessage={search ? "لا توجد نتائج للبحث" : "لا توجد سجلات تالف"}
        />
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