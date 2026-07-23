import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@shared/ui/button";
import { Plus, Layers, ShoppingCart, TrendingUp, AlertTriangle, Undo2, ArrowRightLeft, Scale, Download } from "lucide-react";
import { materialService } from '@modules/inventory/api/materialService';
import { categoryService } from '@modules/inventory/api/categoryService';
import { damagedService } from '@modules/inventory/api/damagedService';
import { transferService } from '@modules/inventory/api/transferService';
import { adjustmentService } from '@modules/inventory/api/adjustmentService';
import { stockMovementService } from '@modules/inventory/api/stockMovementService';
import { warehouseService } from '@modules/inventory/api/warehouseService';
import type { MaterialDto, CategoryDto, CreateMaterialRequest, UpdateMaterialRequest, CreateDamagedItemRequest, CreateStockAdjustmentRequest, WarehouseDto, CreateTransferRequest, StockMovement } from "@erp/shared-types";
import { toast } from 'sonner';

// Refactored Components & Hooks
import { useEntityList } from '@shared/hooks/useEntityList';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useExcelExport, useBaseCurrencyColumns } from "@shared/hooks";
import { useExportSettings } from "@shared/hooks/useExportSettings";
import { buildCurrencyRatesSheetOptions } from '@shared/lib/excel';
import { currencyAmountCols } from "@shared/lib/excel/column-helpers";
import type { ExcelExportColumn, ExcelExportOptions } from '@shared/lib/excel';
import { MaterialForm } from '@modules/inventory/components/MaterialForm';
import { MaterialTable } from '@modules/inventory/components/MaterialTable';
import { MaterialUnitsManager } from '@modules/inventory/components/MaterialUnitsManager';
import { OperationalTableTemplate } from '@widgets/templates/OperationalTableTemplate';
import { MaterialDetailPanel } from '@modules/inventory/components/MaterialDetailPanel';
import { DamagedForm } from '@modules/inventory/components/DamagedForm';
import { TransferForm } from '@modules/inventory/components/TransferForm';
import { ReturnFromMaterialPanel } from '@modules/inventory/components/ReturnFromMaterialPanel';
import { AdjustmentForm } from '@modules/inventory/components/AdjustmentForm';
import { useTabs } from "@app/providers/TabContext";
import { buildStockByWarehouse } from '@modules/inventory/lib/stockUtils';
import { QUERY_KEYS, queryClient, invalidateAccountingMutationQueries } from "@shared/hooks/queryClient";

export default function Materials() {
  const { openTab } = useTabs();
  const { baseCurrency, rateMap, currencies, formatAmount } = useCurrencyContext();
  const { hasSecondaryCurrencies, currencySuffix: cs } = useBaseCurrencyColumns();
  const { currencyMode } = useExportSettings();
  const {
    filtered: materials,
    loading,
    search,
    setSearch,
    refresh,
    refreshing,
    selectedId,
    setSelectedId,
    selectedItem: selectedMaterial,
    editItem: editMaterial,
    isFormOpen,
    setIsFormOpen,
    saving,
    handleOpenAdd,
    handleOpenEdit,
    handleSave,
    handleDelete,
  } = useEntityList<MaterialDto, CreateMaterialRequest | UpdateMaterialRequest>({
    queryKey: [...QUERY_KEYS.materials],
    fetchData: () => materialService.list(),
    saveData: async (payload) => {
      if ((payload as UpdateMaterialRequest).id) return materialService.update(payload as UpdateMaterialRequest);
      return materialService.create(payload as CreateMaterialRequest);
    },
    deleteData: (id) => materialService.delete(id),
    searchFields: ["name", "code", "barcode"],
  });

  const isLoading = loading || refreshing;

  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [managingUnitsMaterial, setManagingUnitsMaterial] = useState<MaterialDto | null>(null);
  const [, setShowUnitsPanel] = useState(false);
  const [showDamagedPanel, setShowDamagedPanel] = useState(false);
  const [savingDamaged, setSavingDamaged] = useState(false);
  const [isReturnOpen, setIsReturnOpen] = useState(false);
  const [transferFormOpen, setTransferFormOpen] = useState(false);
  const [savingTransfer, setSavingTransfer] = useState(false);
  const [transferPreset, setTransferPreset] = useState<{ sourceWarehouseId?: string } | null>(null);
  const [showAdjustmentPanel, setShowAdjustmentPanel] = useState(false);
  const [savingAdjustment, setSavingAdjustment] = useState(false);
  const [warehouses, setWarehouses] = useState<WarehouseDto[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [lotsPanelActive, setLotsPanelActive] = useState(false);
  const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>([]);

  const stockByWarehouse = useMemo(() => buildStockByWarehouse(movements), [movements]);

  const materialStockTotal = useMemo(() => {
    const map = new Map<string, number>();
    for (const [mid, whMap] of stockByWarehouse) {
      const total = [...whMap.values()].reduce((s, q) => s + q, 0);
      map.set(mid, total);
    }
    return map;
  }, [stockByWarehouse]);

  const loadCategories = useCallback(async () => {
    try {
      const cats = await categoryService.list();
      setCategories(cats);
    } catch (e) { console.error(e); }
  }, []);

  const loadInventoryData = useCallback(async () => {
    try {
      const [whs, mvs] = await Promise.all([
        warehouseService.list(),
        stockMovementService.list(),
      ]);
      setWarehouses(whs);
      setMovements(mvs);
    } catch (e) { console.error(e); }
  }, []);

  const handleSaveMaterial = useCallback(async (payload: CreateMaterialRequest | UpdateMaterialRequest) => {
    await handleSave(payload);
    loadCategories();
    loadInventoryData();
  }, [handleSave, loadCategories, loadInventoryData]);

  const handleDeleteMaterial = useCallback(async (id: string) => {
    await handleDelete(id);
    loadCategories();
    loadInventoryData();
  }, [handleDelete, loadCategories, loadInventoryData]);

  const handleCreateTransfer = useCallback(async (req: CreateTransferRequest) => {
    setSavingTransfer(true);
    try {
      await transferService.create(req);
      toast.success('تم إنشاء التحويل بنجاح');
      setTransferFormOpen(false);
      setTransferPreset(null);
      loadCategories();
      loadInventoryData();
      invalidateAccountingMutationQueries(queryClient);
      refresh();
    } catch (e) {
      toast.error('فشل التحويل: ' + e);
    } finally {
      setSavingTransfer(false);
    }
  }, [loadCategories, loadInventoryData, refresh]);

  const handleOpenTransfer = useCallback((opts: { sourceWarehouseId?: string }) => {
    setTransferPreset(opts);
    setTransferFormOpen(true);
    setIsFormOpen(false);
    setShowDamagedPanel(false);
    setManagingUnitsMaterial(null);
    setIsReturnOpen(false);
  }, [setIsFormOpen]);

  const handleCreateDamaged = useCallback(async (payload: CreateDamagedItemRequest) => {
    setSavingDamaged(true);
    try {
      await damagedService.create(payload);
      setShowDamagedPanel(false);
      loadCategories();
      loadInventoryData();
      invalidateAccountingMutationQueries(queryClient);
      refresh();
      toast.success(`تم تسجيل التالف للمادة بنجاح`);
    } catch (e: unknown) {
      toast.error("فشل تسجيل التالف: " + e);
    } finally {
      setSavingDamaged(false);
    }
  }, [loadCategories, loadInventoryData, refresh]);

  const handleCreateAdjustment = useCallback(async (payload: CreateStockAdjustmentRequest) => {
    setSavingAdjustment(true);
    try {
      await adjustmentService.create(payload);
      setShowAdjustmentPanel(false);
      loadCategories();
      loadInventoryData();
      invalidateAccountingMutationQueries(queryClient);
      refresh();
      toast.success('تم إنشاء التسوية بنجاح');
    } catch (e: unknown) {
      toast.error("فشل إنشاء التسوية: " + e);
    } finally {
      setSavingAdjustment(false);
    }
  }, [loadCategories, loadInventoryData, refresh]);

  useEffect(() => { loadCategories(); }, [loadCategories]);
  useEffect(() => { loadInventoryData(); }, [loadInventoryData]);

  useEffect(() => {
    const handler = () => handleOpenAdd();
    window.addEventListener("erp:open-new-product", handler);
    return () => window.removeEventListener("erp:open-new-product", handler);
  }, [handleOpenAdd]);

  useEffect(() => {
    if (selectedId) {
      setIsFormOpen(false);
    }
  }, [selectedId, setIsFormOpen]);

  // ── Helper computation functions (duplicated from MaterialTable for export) ──

  const unitCostBase = useCallback((m: MaterialDto) => {
    if (m.costing_method === "FIFO") return parseFloat(m.last_purchase_price_base || "0");
    const avgCost = parseFloat(m.average_cost_base || "0");
    const totalRecv = parseFloat(m.total_received || "0");
    const totalStock = materialStockTotal.get(m.id) ?? totalRecv;
    if (totalRecv > 0 && totalStock > 0 && totalStock !== totalRecv) {
      return avgCost * totalRecv / totalStock;
    }
    return avgCost;
  }, [materialStockTotal]);

  const rawPriceBase = useCallback((m: MaterialDto): number => {
    const avgRaw = parseFloat(m.average_raw_price_base || "0");
    const totalRecv = parseFloat(m.total_received || "0");
    const totalStock = materialStockTotal.get(m.id) ?? totalRecv;
    if (totalRecv > 0 && totalStock > 0 && totalStock !== totalRecv) {
      return avgRaw * totalRecv / totalStock;
    }
    return avgRaw;
  }, [materialStockTotal]);

  const extraCostBase = useCallback((m: MaterialDto) => {
    const raw = rawPriceBase(m);
    const total = unitCostBase(m);
    if (total > 0 && raw > 0 && total > raw) return total - raw;
    return 0;
  }, [rawPriceBase, unitCostBase]);

  const totalReceived = useCallback((m: MaterialDto) => materialStockTotal.get(m.id) ?? parseFloat(m.total_received || "0"), [materialStockTotal]);

  // ── Handle Excel Export ──

  const { exportData } = useExcelExport();

  const handleExport = useCallback(async () => {
    const summary: Record<string, 'sum' | 'subtotal' | 'average' | null> = {
      total_received: 'subtotal',
      total_sold: 'subtotal',
      total_damaged: 'subtotal',
      total_available: 'subtotal',
      minimum_stock: 'subtotal',
    };
    const colDefs: ExcelExportColumn[] = [
      {
        id: 'image', label: 'صورة', width: 8,
        hidden: !visibleColumnIds.includes('image'),
        accessor: () => '',
        imageDataUrl: (row) => (row as unknown as MaterialDto).image_path || null,
        imageWidth: 80,
        imageHeight: 80,
      },
      { id: 'code', label: 'الكود', width: 10, hidden: !visibleColumnIds.includes('code'), accessor: (row) => String(row.code ?? '') },
      { id: 'barcode', label: 'الباركود', width: 15, hidden: !visibleColumnIds.includes('barcode'), accessor: (row) => String(row.barcode ?? '') },
      { id: 'name', label: 'اسم المادة', width: 25, hidden: !visibleColumnIds.includes('name'), accessor: (row) => String(row.name ?? '') },
      { id: 'name_en', label: 'الاسم (EN)', width: 20, hidden: !visibleColumnIds.includes('name_en'), accessor: (row) => String(row.name_en ?? '') },
      {
        id: 'categories', label: 'التصنيف', width: 20, hidden: !visibleColumnIds.includes('categories'),
        accessor: (row) => {
          const ids = (row as unknown as MaterialDto).category_ids || [];
          return ids.map(id => categories.find(c => c.id === id)?.name).filter(Boolean).join(', ');
        },
      },
      ...currencyAmountCols("unit_price", "السعر الإفرادي", (row) => rawPriceBase(row as unknown as MaterialDto), currencies, formatAmount, "", hasSecondaryCurrencies, hasSecondaryCurrencies, currencyMode, baseCurrency?.code, rateMap).map(c => { summary[c.id] = 'subtotal'; return c; }),
      ...currencyAmountCols("extra_costs", "تكاليف إضافية", (row) => extraCostBase(row as unknown as MaterialDto), currencies, formatAmount, "", hasSecondaryCurrencies, hasSecondaryCurrencies, currencyMode, baseCurrency?.code, rateMap).map(c => { summary[c.id] = 'subtotal'; return c; }),
      ...currencyAmountCols("average_cost", "تكلفة الوحدة", (row) => unitCostBase(row as unknown as MaterialDto), currencies, formatAmount, "", hasSecondaryCurrencies, hasSecondaryCurrencies, currencyMode, baseCurrency?.code, rateMap).map(c => { summary[c.id] = 'subtotal'; return c; }),
      ...currencies.map(curr => {
        const totalValId = `total_value_${curr.code}`;
        summary[totalValId] = 'subtotal';
        return {
          id: totalValId,
          label: `المجموع${cs(curr.symbol || curr.code)}`,
          formula: `{col('total_received')}{row}*{col('average_cost_${curr.code}')}{row}`,
          numeric: true,
          decimalPlaces: 2,
        };
      }),
      { id: 'total_received', label: 'الكمية الكلية', width: 12, hidden: !visibleColumnIds.includes('total_received'), accessor: (row) => totalReceived(row as unknown as MaterialDto), numeric: true, decimalPlaces: 2 },
      { id: 'total_sold', label: 'الكمية المباعة', width: 12, hidden: !visibleColumnIds.includes('total_sold'), accessor: (row) => parseFloat(String((row as unknown as MaterialDto).total_sold || '0')), numeric: true, decimalPlaces: 2 },
      { id: 'total_damaged', label: 'الكمية التالفة', width: 12, hidden: !visibleColumnIds.includes('total_damaged'), accessor: (row) => parseFloat(String((row as unknown as MaterialDto).total_damaged || '0')), numeric: true, decimalPlaces: 2 },
      { id: 'total_available', label: 'الكمية المتوفرة', width: 12, hidden: !visibleColumnIds.includes('total_available'), accessor: (row) => parseFloat(String((row as unknown as MaterialDto).total_available || '0')), numeric: true, decimalPlaces: 2 },
      ...currencies.map(curr => {
        const availValId = `available_value_${curr.code}`;
        summary[availValId] = 'subtotal';
        return {
          id: availValId,
          label: `المجموع للمتوفر${cs(curr.symbol || curr.code)}`,
          formula: `{col('total_available')}{row}*{col('average_cost_${curr.code}')}{row}`,
          numeric: true,
          decimalPlaces: 2,
        };
      }),
    ];

    const TIERS = [
      { id: 'retail', label: 'مفرق' },
      { id: 'semi_wholesale', label: 'نصف جملة' },
      { id: 'wholesale', label: 'جملة' },
    ];
    currencies.forEach(curr => {
      const sym = curr.symbol || curr.code;
      TIERS.forEach(tier => {
        const colId = `sale_price_${tier.id}_${curr.code}`;
        summary[colId] = 'subtotal';
        colDefs.push({
          id: colId, label: `${tier.label} (${sym})`, width: 15,
          hidden: !visibleColumnIds.includes(colId),
          accessor: (row) => {
            const m = row as unknown as MaterialDto;
            const salePrice = m.sale_prices?.find(p => p.unit_id === m.default_sale_unit_id && p.tier === tier.id);
            return salePrice ? parseFloat(salePrice.price_base || '0') : 0;
          },
          numeric: true, decimalPlaces: 2,
        });
      });
    });

    colDefs.push(
      {
        id: 'units', label: 'الوحدات', width: 20, hidden: !visibleColumnIds.includes('units'),
        accessor: (row) => (row as unknown as MaterialDto).units?.map(u => u.name).join(', ') || '',
      },
      {
        id: 'minimum_stock', label: 'حد الطلب', width: 10, hidden: !visibleColumnIds.includes('minimum_stock'),
        accessor: (row) => parseFloat(String((row as unknown as MaterialDto).minimum_stock || '0')),
        numeric: true, decimalPlaces: 2,
      },
      {
        id: 'costing_method', label: 'طريقة التكلفة', width: 12, hidden: !visibleColumnIds.includes('costing_method'),
        accessor: (row) => (row as unknown as MaterialDto).costing_method === 'FIFO' ? 'FIFO' : 'متوسط',
      },
      {
        id: 'default_purchase_unit', label: 'وحدة الشراء', width: 12, hidden: !visibleColumnIds.includes('default_purchase_unit'),
        accessor: (row) => { const m = row as unknown as MaterialDto; return m.units?.find(u => u.id === m.default_purchase_unit_id)?.name || ''; },
      },
      {
        id: 'default_sale_unit', label: 'وحدة المبيع', width: 12, hidden: !visibleColumnIds.includes('default_sale_unit'),
        accessor: (row) => { const m = row as unknown as MaterialDto; return m.units?.find(u => u.id === m.default_sale_unit_id)?.name || ''; },
      },
      {
        id: 'default_warehouse', label: 'المستودع الافتراضي', width: 15, hidden: !visibleColumnIds.includes('default_warehouse'),
        accessor: (row) => String((row as unknown as MaterialDto).default_warehouse_id || ''),
      },
      {
        id: 'default_purchase_currency', label: 'عملة الشراء', width: 12, hidden: !visibleColumnIds.includes('default_purchase_currency'),
        accessor: (row) => String((row as unknown as MaterialDto).default_purchase_currency || ''),
      },
      {
        id: 'default_sale_currency', label: 'عملة البيع', width: 12, hidden: !visibleColumnIds.includes('default_sale_currency'),
        accessor: (row) => String((row as unknown as MaterialDto).default_sale_currency || ''),
      },
      {
        id: 'has_expiry', label: 'صلاحية', width: 12, hidden: !visibleColumnIds.includes('has_expiry'),
        accessor: (row) => (row as unknown as MaterialDto).has_expiry ? 'له صلاحية' : 'بدون صلاحية',
      },
      {
        id: 'expiry_alert_before_days', label: 'التنبيه (أيام)', width: 10, hidden: !visibleColumnIds.includes('expiry_alert_before_days'),
        accessor: (row) => { const m = row as unknown as MaterialDto; return m.has_expiry ? m.expiry_alert_before_days : ''; },
      },
      {
        id: 'notes', label: 'ملاحظة', width: 20, hidden: !visibleColumnIds.includes('notes'),
        accessor: (row) => String((row as unknown as MaterialDto).notes ?? ''),
      },
    );

    const currencyRatesSheet = buildCurrencyRatesSheetOptions(baseCurrency, currencies, rateMap, currencyMode).currencyRatesSheet;

    const exportOptions: ExcelExportOptions = {
      sheetName: 'بطاقات المواد',
      autoFilter: true,
      sortBy: {
        columnId: 'code',
        direction: 'asc',
        compare: (a, b) => String(a.code ?? '').localeCompare(String(b.code ?? ''), 'ar'),
      },
      summary,
      summaryLabel: "المجموع",
      ...(currencyRatesSheet ? { currencyRatesSheet } : {}),
    };

    await exportData(
      materials as unknown as Record<string, unknown>[],
      colDefs,
      'بطاقات المواد',
      exportOptions,
    );
  }, [materials, currencies, currencyMode, baseCurrency, rateMap, categories, formatAmount, visibleColumnIds, unitCostBase, rawPriceBase, extraCostBase, totalReceived, exportData, hasSecondaryCurrencies, cs]);

  const handleOpenReturn = () => {
    if (!selectedMaterial) return;
    setIsReturnOpen(true);
    setIsFormOpen(false);
    setShowDamagedPanel(false);
    setManagingUnitsMaterial(null);
    setTransferFormOpen(false);
    setShowUnitsPanel(false);
  };

  return (
    <>
      <OperationalTableTemplate
        title="بطاقات المواد"
        toolbar={
          <>
            <Button size="sm" onClick={handleOpenAdd} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100">
              <Plus className="w-4 h-4 ml-2" /> مادة جديدة
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              disabled={!selectedId}
              onClick={() => {
                if (selectedId) {
                  setLotsPanelActive(true);
                  setIsFormOpen(false);
                  setShowDamagedPanel(false);
                  setManagingUnitsMaterial(null);
                  setTransferFormOpen(false);
                  setIsReturnOpen(false);
                  setShowUnitsPanel(false);
                  setShowAdjustmentPanel(false);
                }
              }}
            >
              <Layers className="w-4 h-4 ml-2 text-indigo-600" />
              الدفعات
            </Button>

            <div className="h-6 w-px bg-slate-200 mx-1" />

            <Button
              size="sm"
              variant="outline"
              className="bg-white border-amber-200 text-amber-700 hover:bg-amber-50"
              disabled={!selectedId}
              onClick={() => handleOpenTransfer({})}
            >
              <ArrowRightLeft className="w-4 h-4 ml-2 text-amber-600" />
              تحويل مخزني
            </Button>

            <div className="h-6 w-px bg-slate-200 mx-1" />

            <Button
              size="sm"
              variant="outline"
              className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              disabled={!selectedId}
              onClick={() => selectedMaterial && openTab({
                id: `purchases-${selectedId}`,
                title: `مشتريات: ${selectedMaterial.name}`,
                path: `/inventory/purchases/${selectedId}`,
                closable: true,
              })}
            >
              <ShoppingCart className="w-4 h-4 ml-2 text-emerald-600" />
              مشتريات المادة
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              disabled={!selectedId}
              onClick={() => selectedMaterial && openTab({
                id: `sales-${selectedId}`,
                title: `مبيعات: ${selectedMaterial.name}`,
                path: `/inventory/sales/${selectedId}`,
                closable: true,
              })}
            >
              <TrendingUp className="w-4 h-4 ml-2 text-blue-600" />
              مبيعات المادة
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              disabled={!selectedId}
              onClick={handleOpenReturn}
            >
              <Undo2 className="w-4 h-4 ml-2 text-amber-500" />
              مرتجع
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              disabled={!selectedId}
              onClick={() => {
                setManagingUnitsMaterial(selectedMaterial);
                setShowUnitsPanel(true);
              }}
            >
              <Layers className="w-4 h-4 ml-2 text-purple-600" />
              الوحدات
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="bg-white border-rose-200 text-rose-700 hover:bg-rose-50"
              disabled={!selectedId}
              onClick={() => {
                setShowDamagedPanel(true);
                setIsFormOpen(false);
                setManagingUnitsMaterial(null);
              }}
            >
              <AlertTriangle className="w-4 h-4 ml-2 text-rose-600" />
              تسجيل تالف
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="bg-white border-teal-200 text-teal-700 hover:bg-teal-50"
              disabled={!selectedId}
              onClick={() => {
                setShowAdjustmentPanel(true);
                setIsFormOpen(false);
                setManagingUnitsMaterial(null);
                setTransferFormOpen(false);
                setIsReturnOpen(false);
                setShowDamagedPanel(false);
                setShowUnitsPanel(false);
              }}
            >
              <Scale className="w-4 h-4 ml-2 text-teal-600" />
              تسوية
            </Button>

            <div className="h-6 w-px bg-slate-200 mx-1" />

            <Button
              size="sm"
              variant="outline"
              className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              onClick={handleExport}
            >
              <Download className="w-4 h-4 ml-2 text-slate-500" /> تصدير إكسل
            </Button>
          </>
        }

        tableContent={
          <MaterialTable 
            materials={materials}
            categories={categories}
            loading={isLoading}
            search={search}
            onSearchChange={setSearch}
            onEdit={handleOpenEdit}
            onDelete={handleDeleteMaterial}
            onManageUnits={(m) => {
              setManagingUnitsMaterial(m);
              setShowUnitsPanel(true);
            }}
            selectedId={selectedId}
            onRowClick={(m) => setSelectedId(m.id)}
            stockTotal={materialStockTotal}
            onVisibleColumnsChange={setVisibleColumnIds}
          />
        }
        sidePanel={
          isFormOpen ? (
            <MaterialForm
              open={isFormOpen}
              onClose={() => setIsFormOpen(false)}
              material={editMaterial}
              categories={categories}
              warehouses={warehouses}
              onSave={handleSaveMaterial}
              saving={saving}
              onCategoryCreated={(cat) => setCategories((prev) => prev.some((c) => c.id === cat.id) ? prev : [...prev, cat])}
            />
          ) : transferFormOpen ? (
            <TransferForm
              open={transferFormOpen}
              onClose={() => { setTransferFormOpen(false); setTransferPreset(null); }}
              warehouses={warehouses}
              products={materials}
              onSave={handleCreateTransfer}
              saving={savingTransfer}
              stockByWarehouse={stockByWarehouse}
              initialMaterialId={selectedId ?? undefined}
              initialSourceWarehouseId={transferPreset?.sourceWarehouseId}
              lockMaterial={true}
            />
          ) : managingUnitsMaterial ? (
            <MaterialUnitsManager 
              material={managingUnitsMaterial}
              onClose={() => setManagingUnitsMaterial(null)}
              onUnitsUpdated={refresh}
            />
          ) : isReturnOpen && selectedMaterial ? (
            <ReturnFromMaterialPanel
              onClose={() => setIsReturnOpen(false)}
              onSaved={refresh}
              materials={materials}
              initialMaterialId={selectedMaterial.id}
            />
          ) : showDamagedPanel ? (
            <DamagedForm
              onClose={() => setShowDamagedPanel(false)}
              products={materials}
              onSave={handleCreateDamaged}
              saving={savingDamaged}
              initialMaterialId={selectedId ?? undefined}
            />
          ) : showAdjustmentPanel ? (
            <AdjustmentForm
              onClose={() => setShowAdjustmentPanel(false)}
              products={materials}
              onSave={handleCreateAdjustment}
              saving={savingAdjustment}
              initialMaterialId={selectedId ?? undefined}
            />
          ) : (
            <MaterialDetailPanel 
              key={`${selectedId}-${lotsPanelActive ? "lots" : "default"}`}
              material={selectedMaterial}
              onClose={() => { setSelectedId(null); setLotsPanelActive(false); }}
              onEdit={handleOpenEdit}
              onDelete={handleDeleteMaterial}
              onOpenTransfer={handleOpenTransfer}
              initialTab={lotsPanelActive ? "lots" : "units"}
            />
          )
        }
        isPanelOpen={isFormOpen || transferFormOpen || isReturnOpen || !!selectedId || !!managingUnitsMaterial || showDamagedPanel || showAdjustmentPanel || lotsPanelActive}
      />
    </>
  );
}
