import { useState, useEffect, useCallback, useMemo } from "react";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { materialService } from "@/services/materialService";
import { categoryService } from "@/services/categoryService";
import type { MaterialDto, CategoryDto, CreateMaterialRequest, UpdateMaterialRequest } from "@erp/shared-types";
import { cn } from "@/lib/utils";

// Refactored Components & Hooks
import { useMasterData } from "@/hooks/useMasterData";
import { MaterialForm } from "@/components/erp/materials/MaterialForm";
import { MaterialStats } from "@/components/erp/materials/MaterialStats";
import { MaterialTable } from "@/components/erp/materials/MaterialTable";

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
      if (payload.id) return materialService.updateMaterial(payload);
      return materialService.createMaterial(payload);
    },
    deleteData: (id) => materialService.deleteMaterial(id),
    searchFields: ["name", "code", "barcode"],
    errorLabel: "فشل تحميل المواد",
    successLabel: "تم حفظ بيانات المادة بنجاح",
  });

  const [categories, setCategories] = useState<CategoryDto[]>([]);

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
        </div>

        <MaterialTable 
          materials={materials}
          categories={categories}
          loading={loading}
          search={search}
          onEdit={handleOpenEdit}
          onDelete={handleDelete}
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
    </>
  );
}
