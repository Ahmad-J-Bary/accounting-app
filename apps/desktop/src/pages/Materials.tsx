import { useState, useEffect, useCallback, useMemo } from "react";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Plus, Search, MoreHorizontal, Edit, Trash2, RefreshCw,
  Wand2, Package, Barcode, Hash, Layers, Shuffle, Type, Check
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { materialService } from "@/services/materialService";
import { categoryService } from "@/services/categoryService";
import { materialCodeService } from "@/services/materialCodeService";
import type { MaterialDto, CategoryDto } from "@erp/shared-types";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { useSearchParams } from "react-router-dom";

const DEFAULT_CATEGORY_NAME = "غير مصنف";

const EMPTY_FORM = {
  name: "",
  barcode: "",
  code: "",
  minimum_stock: "0",
  selectedCategoryIds: [] as string[],
};

export default function Materials() {
  const [searchParams] = useSearchParams();
  const [materialsList, setMaterialsList] = useState<MaterialDto[]>([]);
  const [categoriesList, setCategoriesList] = useState<CategoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editMaterial, setEditMaterial] = useState<MaterialDto | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);

  // ── fetching ──────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [materials, categories] = await Promise.all([
        materialService.listMaterials(),
        categoryService.listCategories(),
      ]);
      setMaterialsList(materials);
      setCategoriesList(categories);
    } catch (error) {
      toast.error("فشل جلب البيانات: " + error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Handle category pre-selection from URL
  useEffect(() => {
    const catId = searchParams.get("categoryId");
    if (catId && categoriesList.length > 0) {
      setFormData(prev => ({ ...prev, selectedCategoryIds: [catId] }));
      setIsDialogOpen(true);
    }
  }, [searchParams, categoriesList]);

  // ── derived categories ────────────────────────────────────
  const uncategorizedCat = useMemo(() => categoriesList.find(c => c.name === DEFAULT_CATEGORY_NAME && !c.parent_id), [categoriesList]);
  const mainCategories = useMemo(() => categoriesList.filter(c => !c.parent_id && c.name !== DEFAULT_CATEGORY_NAME && !c.is_hybrid), [categoriesList]);
  
  const getSubCategories = (rootId: string) => {
    return categoriesList.filter(c => c.parent_id === rootId);
  };

  // ── selection logic ───────────────────────────────────────
  const handleCategoryToggle = (id: string, isUncategorized: boolean, mainId?: string) => {
    setFormData(prev => {
      let nextIds = [...prev.selectedCategoryIds];
      
      if (isUncategorized) {
        // If selecting uncategorized, clear others
        return { ...prev, selectedCategoryIds: [id] };
      }

      // If selecting a sub-category, remove uncategorized
      nextIds = nextIds.filter(cid => cid !== uncategorizedCat?.id);

      if (mainId) {
        // Exclusive selection within the same root row
        const existingInRow = nextIds.find(cid => {
          const cat = categoriesList.find(c => c.id === cid);
          return cat?.parent_id === mainId;
        });
        
        if (existingInRow === id) {
          nextIds = nextIds.filter(cid => cid !== id);
        } else {
          // Remove other sub-categories from the same root
          nextIds = nextIds.filter(cid => {
            const cat = categoriesList.find(c => c.id === cid);
            return cat?.parent_id !== mainId;
          });
          nextIds.push(id);
        }
      } else {
        // Fallback for unexpected cases
        if (nextIds.includes(id)) {
          nextIds = nextIds.filter(cid => cid !== id);
        } else {
          nextIds.push(id);
        }
      }

      // If nothing selected, default back to uncategorized
      if (nextIds.length === 0 && uncategorizedCat) {
        nextIds = [uncategorizedCat.id];
      }

      return { ...prev, selectedCategoryIds: nextIds };
    });
  };

  // ── hybrid code generation ────────────────────────────────
  const generateHybridPrefix = useCallback(() => {
    const selectedCats = categoriesList.filter(c => formData.selectedCategoryIds.includes(c.id));
    const prefixes = selectedCats.map(c => c.code_prefix).filter(Boolean) as string[];
    return prefixes.join(""); // Joining without dash for the prefix part, or with dash? 
    // User said: "تجمع الخانات مع بعضها + المحرف '-' بين اللاحقة والكود"
    // Example: A and B -> AB-001
  }, [formData.selectedCategoryIds, categoriesList]);

  const handleGenerateAutoCode = async () => {
    if (formData.selectedCategoryIds.length === 0) return;
    
    try {
      setIsGeneratingCode(true);
      
      if (formData.selectedCategoryIds.length > 1) {
        // Hybrid Logic
        const prefixes = categoriesList
          .filter(c => formData.selectedCategoryIds.includes(c.id))
          .map(c => c.code_prefix)
          .filter(Boolean) as string[];
        
        if (prefixes.length === 0) {
          toast.error("التصنيفات المختارة لا تملك بادئات كود.");
          return;
        }

        // Call a service that creates/gets a hybrid category and returns a code
        const hybridCat = await categoryService.getOrCreateHybridCategory(prefixes);
        const code = await materialCodeService.generateCode(hybridCat.id);
        setFormData(prev => ({ ...prev, code }));
      } else {
        // Normal Logic
        const code = await materialCodeService.generateCode(formData.selectedCategoryIds[0]);
        setFormData(prev => ({ ...prev, code }));
      }
      toast.success("تم توليد الكود بنجاح");
    } catch (error) {
      toast.error("فشل توليد الكود: " + error);
    } finally {
      setIsGeneratingCode(false);
    }
  };

  // ── dialog actions ────────────────────────────────────────
  const openAdd = () => {
    setEditMaterial(null);
    setFormData({
      ...EMPTY_FORM,
      selectedCategoryIds: uncategorizedCat ? [uncategorizedCat.id] : [],
    });
    setIsDialogOpen(true);
  };

  const openEdit = (m: MaterialDto) => {
    setEditMaterial(m);
    setFormData({
      name: m.name,
      barcode: m.barcode,
      code: m.code,
      minimum_stock: m.minimum_stock,
      selectedCategoryIds: m.category_ids,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("اسم المادة مطلوب");
      return;
    }

    try {
      if (editMaterial) {
        await materialService.updateMaterial({
          id: editMaterial.id,
          name: formData.name,
          barcode: formData.barcode,
          code: formData.code,
          minimum_stock: formData.minimum_stock,
          is_active: editMaterial.is_active,
          category_ids: formData.selectedCategoryIds,
        });
        toast.success("تم التحديث بنجاح");
      } else {
        await materialService.createMaterial({
          name: formData.name,
          barcode: formData.barcode,
          code: formData.code,
          minimum_stock: formData.minimum_stock,
          category_ids: formData.selectedCategoryIds,
        });
        toast.success("تمت الإضافة بنجاح");
      }
      setIsDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error("فشل الحفظ: " + error);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف المادة "${name}"؟`)) return;
    try {
      await materialService.deleteMaterial(id);
      toast.success("تم الحذف");
      fetchData();
    } catch (error) {
      toast.error("فشل الحذف: " + error);
    }
  };

  // ── filtering ─────────────────────────────────────────────
  const filteredMaterials = materialsList.filter(m => {
    const q = search.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      m.code.toLowerCase().includes(q) ||
      m.barcode.toLowerCase().includes(q)
    );
  });

  const getCategoryNames = (ids: string[]) =>
    categoriesList
      .filter(c => ids.includes(c.id))
      .map(c => c.name)
      .join("، ");

  // ── render ────────────────────────────────────────────────
  const CategoryGrid = () => (
    <div className="border rounded-lg overflow-hidden bg-white">
      <div className="bg-slate-50 px-4 py-2 border-b text-xs font-semibold text-slate-500 grid grid-cols-2 gap-4">
        <div>التصنيف الرئيسي</div>
        <div>التصنيفات الفرعية</div>
      </div>
      <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
        {/* Uncategorized Row */}
        {uncategorizedCat && (
          <div className="grid grid-cols-2 items-center min-h-[44px] hover:bg-slate-50/50 transition-colors">
            <div className="px-4 py-2 font-medium text-blue-600">غير مصنف</div>
            <div className="px-4 py-2 flex flex-wrap gap-2">
              <div 
                onClick={() => handleCategoryToggle(uncategorizedCat.id, true)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1 rounded-md border cursor-pointer transition-all select-none",
                  formData.selectedCategoryIds.includes(uncategorizedCat.id)
                    ? "bg-blue-50 border-blue-200 text-blue-700 font-semibold shadow-sm"
                    : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                )}
              >
                <div className={cn("w-3.5 h-3.5 rounded-sm border flex items-center justify-center", formData.selectedCategoryIds.includes(uncategorizedCat.id) ? "bg-blue-600 border-blue-600" : "border-slate-300")}>
                  {formData.selectedCategoryIds.includes(uncategorizedCat.id) && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                </div>
                غير مصنف
              </div>
            </div>
          </div>
        )}

        {/* Main Category Rows */}
        {mainCategories.map(main => {
          const subs = getSubCategories(main.id);
          return (
            <div key={main.id} className="grid grid-cols-2 items-center min-h-[44px] hover:bg-slate-50/50 transition-colors">
              <div className="px-4 py-2 font-medium text-slate-700">{main.name}</div>
              <div className="px-4 py-2 flex flex-wrap gap-2">
                {subs.map(sub => (
                  <div 
                    key={sub.id}
                    onClick={() => handleCategoryToggle(sub.id, false, main.id)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1 rounded-md border cursor-pointer transition-all select-none text-xs",
                      formData.selectedCategoryIds.includes(sub.id)
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700 font-semibold shadow-sm"
                        : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                    )}
                  >
                    <div className={cn("w-3.5 h-3.5 rounded-sm border flex items-center justify-center", formData.selectedCategoryIds.includes(sub.id) ? "bg-emerald-600 border-emerald-600" : "border-slate-300")}>
                      {formData.selectedCategoryIds.includes(sub.id) && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                    </div>
                    {sub.name}
                    {sub.code_prefix && <span className="text-[10px] opacity-60 font-mono">[{sub.code_prefix}]</span>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      <PageHeader
        title="بطاقات المواد"
        subtitle="تعريف هوية المواد وتصنيفاتها ومتابعة بياناتها"
        breadcrumbs={[
          { label: "الرئيسية", to: "/dashboard" },
          { label: "المخزون" },
          { label: "بطاقات المواد" },
        ]}
        actions={
          <>
            <Button variant="outline" onClick={fetchData} disabled={loading}>
              <RefreshCw className={cn("w-4 h-4 ml-2", loading && "animate-spin")} />
              تحديث
            </Button>
            <Button onClick={openAdd}>
              <Plus className="w-4 h-4 ml-2" /> مادة جديدة
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="p-4 flex items-center gap-4 bg-slate-50/50">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
            <Package className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <div className="text-2xl font-bold tabular-nums">{materialsList.length}</div>
            <div className="text-xs text-muted-foreground">إجمالي المواد</div>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4 bg-slate-50/50">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
            <Layers className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <div className="text-2xl font-bold tabular-nums text-emerald-600">{categoriesList.length}</div>
            <div className="text-xs text-muted-foreground">إجمالي التصنيفات</div>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4 bg-slate-50/50">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
            <Barcode className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <div className="text-2xl font-bold tabular-nums text-amber-600">{materialsList.filter(m => m.barcode).length}</div>
            <div className="text-xs text-muted-foreground">مواد بباركود</div>
          </div>
        </Card>
      </div>

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

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
            <RefreshCw className="w-10 h-10 animate-spin opacity-20" />
            <p className="animate-pulse">جاري تحميل البيانات...</p>
          </div>
        ) : (
          <div className="border border-slate-100 rounded-xl overflow-x-auto" dir="rtl">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-slate-50/80 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-4 font-semibold text-right text-slate-700 w-[120px]">الكود</th>
                  <th className="px-4 py-4 font-semibold text-right text-slate-700 w-[150px]">الباركود</th>
                  <th className="px-4 py-4 font-semibold text-right text-slate-700">اسم المادة</th>
                  <th className="px-4 py-4 font-semibold text-right text-slate-700">التصنيفات</th>
                  <th className="px-4 py-4 font-semibold text-center text-slate-700 w-[100px]">المخزون</th>
                  <th className="px-4 py-4 font-semibold text-right text-slate-700 w-[100px]">الحالة</th>
                  <th className="px-4 py-4 w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredMaterials.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-20 text-slate-400 bg-slate-50/20">
                      <div className="flex flex-col items-center gap-3">
                        <Package className="w-12 h-12 opacity-10" />
                        <p>{search ? "لا توجد نتائج للبحث" : "لا توجد مواد مسجلة حالياً"}</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredMaterials.map(m => (
                    <tr key={m.id} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-4">
                        <span className="font-mono text-[11px] bg-slate-100 text-slate-700 px-2 py-1 rounded-md font-bold">
                          {m.code || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-mono text-[11px] text-slate-500">{m.barcode || "—"}</td>
                      <td className="px-4 py-4 font-semibold text-slate-800">{m.name}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {m.category_ids.length > 0 ? (
                            m.category_ids.map(id => {
                              const cat = categoriesList.find(c => c.id === id);
                              if (!cat) return null;
                              return (
                                <Badge 
                                  key={id} 
                                  variant={cat.is_hybrid ? "outline" : "secondary"}
                                  className={cn(
                                    "text-[10px] font-medium px-2 py-0 border-slate-200",
                                    cat.is_hybrid && "border-purple-200 bg-purple-50 text-purple-700"
                                  )}
                                >
                                  {cat.is_hybrid && <Shuffle className="w-2.5 h-2.5 ml-1 inline" />}
                                  {cat.name}
                                </Badge>
                              );
                            })
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-100">غير مصنف</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center tabular-nums font-bold text-slate-700">
                        {m.stock_quantity.toLocaleString()}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={m.is_active ? "active" : "inactive"} />
                      </td>
                      <td className="px-4 py-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-[160px]">
                            <DropdownMenuItem onClick={() => openEdit(m)} className="gap-2">
                              <Edit className="w-4 h-4" /> تعديل المادة
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDelete(m.id, m.name)} className="gap-2 text-red-600 focus:text-red-700 focus:bg-red-50">
                              <Trash2 className="w-4 h-4" /> حذف البطاقة
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[92vh] overflow-y-auto" dir="rtl">
          <DialogHeader className="border-b pb-4 mb-4">
            <DialogTitle className="text-xl flex items-center gap-2 text-slate-800">
              {editMaterial ? <Edit className="w-5 h-5 text-blue-600" /> : <Plus className="w-5 h-5 text-emerald-600" />}
              {editMaterial ? "تعديل بطاقة المادة" : "إضافة مادة جديدة"}
            </DialogTitle>
            <DialogDescription>
              يرجى ملء البيانات التالية بدقة. الحقول المميزة بـ <span className="text-red-500">*</span> إجبارية.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2">
            <div className="space-y-5">
              {/* Name */}
              <div className="space-y-2">
                <Label className="font-bold text-slate-700">اسم المادة <span className="text-red-500">*</span></Label>
                <Input
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="مثال: ساعة سويسرية فاخرة"
                  className="h-11 border-slate-200 focus:border-blue-400 transition-all"
                />
              </div>

              {/* Code & Barcode */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-slate-400" /> الكود
                  </Label>
                  <div className="relative group">
                    <Input
                      value={formData.code}
                      onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      className="h-10 font-mono text-xs pr-10 border-slate-200"
                      placeholder="الكود"
                      dir="ltr"
                    />
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      onClick={handleGenerateAutoCode}
                      disabled={isGeneratingCode || formData.selectedCategoryIds.length === 0}
                      className="absolute right-1 top-1 h-8 w-8 text-blue-500 hover:bg-blue-50"
                      title="توليد تلقائي"
                    >
                      <Wand2 className={cn("w-4 h-4", isGeneratingCode && "animate-spin")} />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Barcode className="w-3.5 h-3.5 text-slate-400" /> الباركود
                  </Label>
                  <Input
                    value={formData.barcode}
                    onChange={e => setFormData({ ...formData, barcode: e.target.value })}
                    className="h-10 font-mono text-xs border-slate-200"
                    placeholder="الباركود"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Min Stock */}
              <div className="space-y-2">
                <Label className="font-bold text-slate-700">الحد الأدنى للمخزون</Label>
                <div className="relative">
                  <Package className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <Input
                    type="number"
                    value={formData.minimum_stock}
                    onChange={e => setFormData({ ...formData, minimum_stock: e.target.value })}
                    className="h-10 pr-10 border-slate-200"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Label className="font-bold text-slate-700 flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-600" />
                تصنيف المادة (اختيار من الشبكة)
              </Label>
              <CategoryGrid />
              
              {formData.selectedCategoryIds.length > 1 && (
                <div className="bg-purple-50 border border-purple-100 rounded-lg p-3 flex items-start gap-3">
                  <Shuffle className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[11px] font-bold text-purple-800">مادة هجينة (متعددة التصنيفات)</p>
                    <p className="text-[10px] text-purple-600 mt-0.5 leading-relaxed">
                      تم اختيار تصنيفات من أصول مختلفة. سيتم توليد بادئة كود مدمجة: <span className="font-mono font-bold">{generateHybridPrefix()}</span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="border-t pt-6 mt-2 gap-3 flex-row-reverse">
            <Button
              onClick={handleSave}
              disabled={!formData.name.trim() || formData.selectedCategoryIds.length === 0}
              className="h-11 px-8 bg-blue-600 hover:bg-blue-700 font-bold"
            >
              {editMaterial ? "حفظ التعديلات" : "إضافة المادة"}
            </Button>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="h-11">إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
