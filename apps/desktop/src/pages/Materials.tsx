import { useState, useEffect } from "react";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, MoreHorizontal, Edit, Trash2, RefreshCw, Layers } from "lucide-react";
import { formatNumber } from "@/lib/format";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { materialService } from "@/services/materialService";
import { categoryService } from "@/services/categoryService";
import type { MaterialDto, CategoryDto } from "@erp/shared-types";
import { Checkbox } from "@/components/ui/checkbox";

export default function Materials() {
  const [materialsList, setMaterialsList] = useState<MaterialDto[]>([]);
  const [categoriesList, setCategoriesList] = useState<CategoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editMaterial, setEditMaterial] = useState<MaterialDto | null>(null);
  const [formData, setFormData] = useState({ 
    name: "", barcode: "", code: "", minimum_stock: "0", category_ids: [] as string[] 
  });

  const fetchMaterials = async () => {
    try {
      setLoading(true);
      const [materials, categories] = await Promise.all([
        materialService.listMaterials(),
        categoryService.listCategories()
      ]);
      setMaterialsList(materials);
      setCategoriesList(categories);
    } catch (error) {
      toast.error("فشل جلب البيانات: " + error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, []);

  const handleSave = async () => {
    try {
      if (editMaterial) {
        await materialService.updateMaterial({
          id: editMaterial.id,
          ...formData,
          is_active: editMaterial.is_active
        });
        toast.success("تم تحديث المادة بنجاح");
      } else {
        await materialService.createMaterial(formData);
        toast.success("تم إضافة المادة بنجاح");
      }
      setIsDialogOpen(false);
      fetchMaterials();
    } catch (error) {
      toast.error("خطأ في العملية: " + error);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف المادة ${name}؟`)) return;
    try {
      await materialService.deleteMaterial(id);
      toast.success("تم حذف المادة بنجاح");
      fetchMaterials();
    } catch (error) {
      toast.error("خطأ في الحذف: " + error);
    }
  };

  const toggleCategory = (catId: string) => {
    setFormData(prev => ({
      ...prev,
      category_ids: prev.category_ids.includes(catId)
        ? prev.category_ids.filter(id => id !== catId)
        : [...prev.category_ids, catId]
    }));
  };

  const filteredMaterials = materialsList.filter(m => {
    const q = (search || "").toLowerCase();
    return m.name.toLowerCase().includes(q) || 
           m.code.toLowerCase().includes(q) || 
           m.barcode.toLowerCase().includes(q);
  });

  return (
    <>
      <PageHeader
        title="بطاقات المواد"
        subtitle="تعريف هوية المواد وتصنيفاتها"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "المواد" }]}
        actions={
          <>
            <Button variant="outline" onClick={fetchMaterials} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ml-2 ${loading ? "animate-spin" : ""}`} />تحديث
            </Button>
            <Button onClick={() => {
              setEditMaterial(null);
              setFormData({ 
                name: "", barcode: "", code: "", minimum_stock: "0", category_ids: [] 
              });
              setIsDialogOpen(true);
            }}>
              <Plus className="w-4 h-4 ml-2" />مادة جديدة
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">إجمالي المواد</div>
          <div className="text-2xl font-bold tabular-nums mt-1">{materialsList.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">التصنيفات</div>
          <div className="text-2xl font-bold tabular-nums mt-1">{categoriesList.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">نشط</div>
          <div className="text-2xl font-bold text-green-600 tabular-nums mt-1">
            {materialsList.filter(m => m.is_active).length}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="بحث بالاسم أو الكود أو الباركود..." 
              className="pr-10" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-10">جاري التحميل...</div>
        ) : (
          <div className="border border-border rounded-md overflow-x-auto text-right" dir="rtl">
            <table className="w-full text-sm min-w-[800px]">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  <th className="px-4 py-3 font-medium text-right">الرمز/الباركود</th>
                  <th className="px-4 py-3 font-medium text-right">اسم المادة</th>
                  <th className="px-4 py-3 font-medium text-right">التصنيف</th>
                  <th className="px-4 py-3 font-medium text-center">المخزون الحالي</th>
                  <th className="px-4 py-3 font-medium text-right">الحالة</th>
                  <th className="px-4 py-3 font-medium w-12 text-center"></th>
                </tr>
              </thead>
              <tbody>
                {filteredMaterials.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-muted-foreground">لا توجد مواد حالياً</td>
                  </tr>
                ) : (
                  filteredMaterials.map((m) => {
                    const cats = categoriesList.filter(c => m.category_ids.includes(c.id)).map(c => c.name).join(", ");
                    return (
                      <tr key={m.id} className="border-b border-border last:border-0 hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-primary">
                          <div className="flex flex-col">
                            <span>{m.code}</span>
                            <span className="text-xs text-muted-foreground">{m.barcode || "---"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium">{m.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{cats || "عام"}</td>
                        <td className="px-4 py-3 text-center tabular-nums font-bold">
                          {formatNumber(Number(m.stock_quantity || 0))}
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={m.is_active ? "active" : "inactive"} /></td>
                        <td className="px-4 py-3 text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                              <DropdownMenuItem onClick={() => {
                                setEditMaterial(m);
                                setFormData({
                                  name: m.name,
                                  barcode: m.barcode,
                                  code: m.code,
                                  minimum_stock: m.minimum_stock,
                                  category_ids: m.category_ids
                                });
                                setIsDialogOpen(true);
                              }}><Edit className="w-4 h-4 ml-2" />تعديل</DropdownMenuItem>
                              <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(m.id, m.name)}>
                                <Trash2 className="w-4 h-4 ml-2" />حذف
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editMaterial ? "تعديل مادة" : "إضافة مادة جديدة"}</DialogTitle>
            <DialogDescription>هوية المادة وتصنيفها الأساسي.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 text-right" dir="rtl">
            <div className="grid gap-2">
              <Label htmlFor="m_name">اسم المادة *</Label>
              <Input id="m_name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="مثال: إسمنت مقاوم" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="m_code">الكود (تلقائي إذا ترك فارغاً)</Label>
                <Input id="m_code" value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value})} placeholder="MAT001" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="m_barcode">الباركود</Label>
                <Input id="m_barcode" value={formData.barcode} onChange={(e) => setFormData({...formData, barcode: e.target.value})} placeholder="استخدم الماسح" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="m_min_stock">حد الطلب (الحد الأدنى للمخزون)</Label>
              <Input id="m_min_stock" type="number" value={formData.minimum_stock} onChange={(e) => setFormData({...formData, minimum_stock: e.target.value})} />
            </div>

            <div className="border-t pt-4">
              <Label className="mb-3 font-bold flex items-center gap-2"><Layers className="w-4 h-4" /> التصنيفات</Label>
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-md border max-h-[150px] overflow-y-auto">
                {categoriesList.map(cat => (
                  <div key={cat.id} className="flex items-center space-x-2 space-x-reverse">
                    <Checkbox 
                      id={`cat-${cat.id}`} 
                      checked={formData.category_ids.includes(cat.id)}
                      onCheckedChange={() => toggleCategory(cat.id)}
                    />
                    <label htmlFor={`cat-${cat.id}`} className="text-sm cursor-pointer">{cat.name}</label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="flex-row-reverse gap-2">
            <Button onClick={handleSave} disabled={!formData.name} className="min-w-[100px]">حفظ</Button>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
