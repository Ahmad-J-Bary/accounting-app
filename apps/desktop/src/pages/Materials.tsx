import { useState, useEffect, useCallback, useMemo } from "react";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, RefreshCw, Settings2 } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { materialService } from "@/services/materialService";
import { categoryService } from "@/services/categoryService";
import type { MaterialDto, CategoryDto, CreateMaterialRequest, UpdateMaterialRequest } from "@erp/shared-types";
import { cn } from "@/lib/utils";

// Refactored Components & Hooks
import { useMasterData } from "@/hooks/useMasterData";
import { useColumnPreferences } from "@/hooks/useColumnPreferences";
import { MaterialForm } from "@/components/erp/materials/MaterialForm";
import { MaterialStats } from "@/components/erp/materials/MaterialStats";
import { MaterialTable } from "@/components/erp/materials/MaterialTable";
import { MaterialUnitsManager } from "@/components/erp/materials/MaterialUnitsManager";

export default function Materials() {
  const {
    filtered: materials,
    loading,
    search,
    setSearch,
    refresh,
    editItem: editMaterial,
    isFormOpen,
    setIsFormOpen,
    saving,
    handleOpenAdd,
    handleOpenEdit,
    handleSave,
    handleDelete,
  } = useMasterData<MaterialDto, CreateMaterialRequest | UpdateMaterialRequest>({
    fetchData: () => materialService.listMaterials(),
    saveData: async (payload) => {
      if ((payload as UpdateMaterialRequest).id) return materialService.updateMaterial(payload as UpdateMaterialRequest);
      return materialService.createMaterial(payload as CreateMaterialRequest);
    },
    deleteData: (id) => materialService.deleteMaterial(id),
    searchFields: ["name", "code", "barcode"],
    errorLabel: "فشل تحميل المواد",
    successLabel: "تم حفظ بيانات المادة بنجاح",
  });

  const availableColumns = [
    { id: "code", label: "الكود" },
    { id: "barcode", label: "الباركود" },
    { id: "name", label: "اسم المادة" },
    { id: "categories", label: "التصنيفات" },
    { id: "units", label: "الوحدة" },
    { id: "total_received", label: "الكمية الكلية" },
    { id: "total_sold", label: "الكمية المباعة" },
    { id: "total_available", label: "الكمية المتوفرة" },
    { id: "total_damaged", label: "التالف" },
    { id: "average_cost", label: "متوسط التكلفة" },
    { id: "last_purchase_price", label: "آخر شراء" },
    { id: "last_sale_price", label: "آخر مبيع" },
  ];

  const defaultVisibleColumns = ["code", "barcode", "name", "categories", "units", "total_available", "average_cost"];

  const { visibleColumns, toggleColumn, isVisible } = useColumnPreferences("materials", defaultVisibleColumns);

  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [managingUnitsMaterial, setManagingUnitsMaterial] = useState<MaterialDto | null>(null);

  const loadCategories = useCallback(async () => {
    try {
      const cats = await categoryService.listCategories();
      setCategories(cats);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  return (
    <>
      <PageHeader
        title="بطاقات المواد"
        subtitle="تعريف هوية المواد وتصنيفاتها ومتابعة بياناتها"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "المخزون" }, { label: "بطاقات المواد" }]}
        actions={
          <>
            <Button variant="outline" onClick={() => refresh()} disabled={loading}>
              <RefreshCw className={cn("w-4 h-4 ml-2", loading && "animate-spin")} />تحديث
            </Button>
            <Button onClick={handleOpenAdd}>
              <Plus className="w-4 h-4 ml-2" /> مادة جديدة
            </Button>
          </>
        }
      />

      <MaterialStats 
        totalMaterials={materials.length}
        totalCategories={categories.length}
        materialsWithBarcode={materials.filter(m => m.barcode).length}
      />

      <Card className="p-5 overflow-hidden">
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="بحث بالاسم أو الكود أو الباركود..."
              className="pr-10 bg-slate-50/50 border-slate-200"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0" title="إعدادات الأعمدة">
                <Settings2 className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px]">
              <DropdownMenuLabel>الأعمدة الظاهرة</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {availableColumns.map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={isVisible(col.id)}
                  onCheckedChange={() => toggleColumn(col.id)}
                >
                  {col.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <MaterialTable 
          materials={materials}
          categories={categories}
          loading={loading}
          search={search}
          onEdit={handleOpenEdit}
          onDelete={handleDelete}
          onManageUnits={setManagingUnitsMaterial}
          visibleColumns={visibleColumns}
        />
      </Card>

      <MaterialForm 
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        material={editMaterial}
        categories={categories}
        onSave={handleSave}
        saving={saving}
      />

      <MaterialUnitsManager 
        open={!!managingUnitsMaterial}
        onOpenChange={(open) => !open && setManagingUnitsMaterial(null)}
        material={managingUnitsMaterial}
        onUnitsUpdated={refresh}
      />
    </>
  );
}
