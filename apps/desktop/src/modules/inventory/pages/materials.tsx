import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@shared/ui/button";
import { Plus, RefreshCw, Package, Layers, Barcode, ShoppingCart, TrendingUp, AlertTriangle, Undo2 } from "lucide-react";
import { materialService } from '@modules/inventory/api/materialService';
import { categoryService } from '@modules/inventory/api/categoryService';
import { damagedService } from '@modules/inventory/api/inventoryService';
import type { MaterialDto, CategoryDto, CreateMaterialRequest, UpdateMaterialRequest, CreateDamagedItemRequest } from "@erp/shared-types";
import { cn } from '@shared/lib/utils';
import { toast } from 'sonner';

// Refactored Components & Hooks
import { useEntityList } from '@shared/hooks/useEntityList';
import { MaterialForm } from '@modules/inventory/components/MaterialForm';
import { MaterialTable } from '@modules/inventory/components/MaterialTable';
import { MaterialUnitsManager } from '@modules/inventory/components/MaterialUnitsManager';
import { OperationalTableTemplate } from '@widgets/templates/OperationalTableTemplate';
import { MaterialDetailPanel } from '@modules/inventory/components/MaterialDetailPanel';
import { DamagedForm } from '@modules/inventory/components/DamagedForm';
import { ReturnsForm, type ReturnsFormState } from '@modules/invoicing/components/ReturnsForm';
import { customerService } from '@modules/partners/api/customerService';
import { supplierService } from '@modules/partners/api/supplierService';
import { invoiceService } from '@modules/invoicing/api/invoiceService';
import { returnService } from '@modules/invoicing/api/returnService';
import type { CustomerDto, SupplierDto, InvoiceDto, CreatePurchaseReturnRequest } from "@erp/shared-types";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useTabs } from "@app/providers/TabContext";

export default function Materials() {
  const { currencies, baseCurrency } = useCurrencyContext();
  const { openTab } = useTabs();
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
    fetchData: () => materialService.listMaterials(),
    saveData: async (payload) => {
      if ((payload as UpdateMaterialRequest).id) return materialService.updateMaterial(payload as UpdateMaterialRequest);
      return materialService.createMaterial(payload as CreateMaterialRequest);
    },
    deleteData: (id) => materialService.deleteMaterial(id),
    searchFields: ["name", "code", "barcode"],
  });

  const isLoading = loading || refreshing;

  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [managingUnitsMaterial, setManagingUnitsMaterial] = useState<MaterialDto | null>(null);
  const [showUnitsPanel, setShowUnitsPanel] = useState(false);
  const [showDamagedPanel, setShowDamagedPanel] = useState(false);
  const [savingDamaged, setSavingDamaged] = useState(false);
  const [isReturnOpen, setIsReturnOpen] = useState(false);
  const [returnSaving, setReturnSaving] = useState(false);
  const [returnForm, setReturnForm] = useState<ReturnsFormState>({
    customer_id: "", supplier_id: "", return_date: new Date().toISOString().slice(0, 10),
    notes: "", purchase_invoice_id: "", lines: [],
  });
  const [returnCustomers, setReturnCustomers] = useState<CustomerDto[]>([]);
  const [returnSuppliers, setReturnSuppliers] = useState<SupplierDto[]>([]);
  const [returnInvoices, setReturnInvoices] = useState<InvoiceDto[]>([]);

  const loadCategories = useCallback(async () => {
    try {
      const cats = await categoryService.listCategories();
      setCategories(cats);
    } catch (e) { console.error(e); }
  }, []);

  const handleCreateDamaged = useCallback(async (payload: CreateDamagedItemRequest) => {
    setSavingDamaged(true);
    try {
      await damagedService.createDamagedItem(payload);
      setShowDamagedPanel(false);
      refresh();
      toast.success(`تم تسجيل التالف للمادة بنجاح`);
    } catch (e: unknown) {
      toast.error("فشل تسجيل التالف: " + e);
    } finally {
      setSavingDamaged(false);
    }
  }, [refresh]);

  useEffect(() => { loadCategories(); }, [loadCategories]);

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

  useEffect(() => {
    if (isReturnOpen) {
      customerService.listCustomers().then(setReturnCustomers).catch(() => {});
      supplierService.listSuppliers().then(setReturnSuppliers).catch(() => {});
      invoiceService.listInvoicesByType("Purchase").then(setReturnInvoices).catch(() => {});
    }
  }, [isReturnOpen]);

  const handleSaveReturn = async (lines: ReturnsFormState["lines"]) => {
    if (!selectedMaterial || !returnForm.supplier_id) {
      toast.error("الرجاء اختيار المورد");
      return;
    }
    setReturnSaving(true);
    try {
      const supplier = returnSuppliers.find(s => s.id === returnForm.supplier_id);
      const payload: CreatePurchaseReturnRequest = {
        return_number: "",
        supplier_id: returnForm.supplier_id,
        supplier_name: supplier?.name,
        return_date: returnForm.return_date || new Date().toISOString().slice(0, 10),
        lines: lines.map(l => ({
          id: "",
          material_id: l.material_id,
          quantity: l.quantity,
          unit_price: l.unit_price,
          unit_id: l.unit_id,
          line_total: l.line_total,
          notes: l.notes,
        })),
        notes: returnForm.notes || undefined,
      };
      await returnService.createPurchaseReturn(payload);
      await refresh();
      toast.success("تم تسجيل المرتجع بنجاح");
      setIsReturnOpen(false);
    } catch (err) {
      toast.error("فشل تسجيل المرتجع: " + err);
    } finally {
      setReturnSaving(false);
    }
  };

  const handleOpenReturn = () => {
    if (!selectedMaterial) return;
    setReturnForm(f => ({
      ...f,
      supplier_id: "",
      lines: [{
        material_id: selectedMaterial.id,
        quantity: "1",
        unit_price: "0",
        unit_id: selectedMaterial.units.find(u => u.is_base)?.id || selectedMaterial.units[0]?.id || "",
        notes: "",
        line_total: "0",
      }],
    }));
    setIsReturnOpen(true);
    setIsFormOpen(false);
    setShowDamagedPanel(false);
    setManagingUnitsMaterial(null);
  };

  const stats = useMemo(() => [
    { label: "إجمالي المواد", value: materials.length, icon: Package, color: "text-slate-900" },
    { label: "التصنيفات", value: categories.length, icon: Layers, color: "text-blue-600" },
    { label: "مواد بباركود", value: materials.filter(m => m.barcode).length, icon: Barcode, color: "text-emerald-600" },
  ], [materials, categories]);

  return (
    <>
      <OperationalTableTemplate
        title="بطاقات المواد"
        stats={stats}
        toolbar={
          <>
            <Button size="sm" onClick={handleOpenAdd} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100">
              <Plus className="w-4 h-4 ml-2" /> مادة جديدة
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
            onDelete={handleDelete}
            onManageUnits={(m) => {
              setManagingUnitsMaterial(m);
              setShowUnitsPanel(true);
            }}
            selectedId={selectedId}
            onRowClick={(m) => setSelectedId(m.id)}
          />
        }
        sidePanel={
          isFormOpen ? (
            <MaterialForm
              open={isFormOpen}
              onClose={() => setIsFormOpen(false)}
              material={editMaterial}
              categories={categories}
              onSave={handleSave}
              saving={saving}
              onCategoryCreated={(cat) => setCategories((prev) => prev.some((c) => c.id === cat.id) ? prev : [...prev, cat])}
            />
          ) : managingUnitsMaterial ? (
            <MaterialUnitsManager 
              material={managingUnitsMaterial}
              onClose={() => setManagingUnitsMaterial(null)}
              onUnitsUpdated={refresh}
            />
          ) : isReturnOpen && selectedMaterial ? (
            <ReturnsForm
              type="purchase"
              onClose={() => setIsReturnOpen(false)}
              onSave={handleSaveReturn}
              saving={returnSaving}
              customers={returnCustomers}
              suppliers={returnSuppliers}
              invoices={returnInvoices}
              materials={materials}
              form={returnForm}
              setForm={setReturnForm}
            />
          ) : showDamagedPanel ? (
            <DamagedForm
              onClose={() => setShowDamagedPanel(false)}
              products={materials}
              onSave={handleCreateDamaged}
              saving={savingDamaged}
              initialMaterialId={selectedId ?? undefined}
            />
          ) : (
            <MaterialDetailPanel 
              material={selectedMaterial}
              onClose={() => setSelectedId(null)}
              onEdit={handleOpenEdit}
              onDelete={handleDelete}
            />
          )
        }
        isPanelOpen={isFormOpen || isReturnOpen || !!selectedId || !!managingUnitsMaterial || showDamagedPanel}
      />
    </>
  );
}
