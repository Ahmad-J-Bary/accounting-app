import { useState, useEffect } from "react";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Download, Search, MoreHorizontal, Edit, AlertTriangle, Trash2, RefreshCw, Package, Tag, Layers } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/format";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { materialService } from "@/services/materialService";
import { categoryService } from "@/services/categoryService";
import type { MaterialDto, CategoryDto } from "@erp/shared-types";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

export default function Materials() {
  const [materialsList, setMaterialsList] = useState<MaterialDto[]>([]);
  const [categoriesList, setCategoriesList] = useState<CategoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Create/Edit state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editMaterial, setEditMaterial] = useState<MaterialDto | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    barcode: "",
    code: "",
    purchase_price: "0",
    retail_price: "0",
    wholesale_price: "0",
    semi_wholesale_price: "0",
    minimum_stock: "0",
    notes: "",
    category_ids: [] as string[]
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
        subtitle="إدارة بيانات الأصناف والأسعار والمستودع"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "المواد" }]}
        actions={
          <>
            <Button variant="outline" onClick={fetchMaterials} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ml-2 ${loading ? "animate-spin" : ""}`} />تحديث
            </Button>
            <Button onClick={() => {
              setEditMaterial(null);
              setFormData({ 
                name: "", barcode: "", code: "", purchase_price: "0", 
                retail_price: "0", wholesale_price: "0", semi_wholesale_price: "0", 
                minimum_stock: "0", notes: "", category_ids: [] 
              });
              setIsDialogOpen(true);
            }}>
              <Plus className="w-4 h-4 ml-2" />مادة جديدة
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">إجمالي المواد</div>
          <div className="text-2xl font-bold tabular-nums mt-1">{materialsList.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">قيمة المخزون (تكلفة)</div>
          <div className="text-xl font-bold text-primary tabular-nums mt-1">
            {formatCurrency(materialsList.reduce((s, m) => s + Number(m.stock_quantity || 0) * Number(m.purchase_price || 0), 0))}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">تحت الحد الأدنى</div>
          <div className="text-2xl font-bold text-red-600 tabular-nums mt-1">
            {materialsList.filter(m => Number(m.stock_quantity || 0) < Number(m.minimum_stock || 0)).length}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">التصنيفات</div>
          <div className="text-2xl font-bold tabular-nums mt-1">{categoriesList.length}</div>
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
            <table className="w-full text-sm min-w-[1000px]">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  <th className="px-4 py-3 font-medium">الرمز/الباركود</th>
                  <th className="px-4 py-3 font-medium text-right">اسم المادة</th>
                  <th className="px-4 py-3 font-medium text-right">التصنيف</th>
                  <th className="px-4 py-3 font-medium text-left">التكلفة</th>
                  <th className="px-4 py-3 font-medium text-left">مفرق</th>
                  <th className="px-4 py-3 font-medium text-left">المخزون</th>
                  <th className="px-4 py-3 font-medium text-right">الحالة</th>
                  <th className="px-4 py-3 font-medium w-12 text-center"></th>
                </tr>
              </thead>
              <tbody>
                {filteredMaterials.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-muted-foreground">لا توجد مواد حالياً</td>
                  </tr>
                ) : (
                  filteredMaterials.map((m) => {
                    const low = Number(m.stock_quantity || 0) < Number(m.minimum_stock || 0);
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
                        <td className="px-4 py-3 text-muted-foreground max-w-[150px] truncate">{cats || "غير مصنف"}</td>
                        <td className="px-4 py-3 text-left tabular-nums">{formatCurrency(Number(m.purchase_price || 0))}</td>
                        <td className="px-4 py-3 text-left tabular-nums font-bold text-green-700">{formatCurrency(Number(m.retail_price || 0))}</td>
                        <td className="px-4 py-3 text-left">
                          <div className="flex items-center justify-start gap-1.5 tabular-nums">
                            <span className={cn("font-medium", low && "text-red-600")}>
                              {formatNumber(Number(m.stock_quantity || 0))}
                            </span>
                            <span className="text-xs text-muted-foreground">/ {formatNumber(Number(m.minimum_stock || 0))}</span>
                            {low && <AlertTriangle className="w-4 h-4 text-red-500" />}
                          </div>
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
                                  purchase_price: m.purchase_price || "0",
                                  retail_price: m.retail_price || "0",
                                  wholesale_price: m.wholesale_price || "0",
                                  semi_wholesale_price: m.semi_wholesale_price || "0",
                                  minimum_stock: m.minimum_stock,
                                  notes: m.notes || "",
                                  category_ids: m.category_ids
                                });
                                setIsDialogOpen(true);
                              }}><Edit className="w-4 h-4 ml-2" />تعديل البطاقة</DropdownMenuItem>
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
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editMaterial ? "تعديل بطاقة مادة" : "إضافة بطاقة مادة جديدة"}</DialogTitle>
            <DialogDescription>أدخل بيانات التكويد والأسعار والتصنيفات.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4 text-right" dir="rtl">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2 col-span-2">
                <Label htmlFor="m_name">اسم المادة *</Label>
                <Input id="m_name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="مثال: إسمنت مقاوم" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="m_code">كود المادة (تلقائي إذا ترك فارغاً)</Label>
                <Input id="m_code" value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value})} placeholder="مثال: MAT001" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="m_barcode">الباركود</Label>
                <Input id="m_barcode" value={formData.barcode} onChange={(e) => setFormData({...formData, barcode: e.target.value})} placeholder="أو استخدم الماسح" />
              </div>
            </div>

            <div className="border-t pt-4">
              <Label className="mb-3 block font-bold flex items-center gap-2"><Layers className="w-4 h-4" /> التصنيفات</Label>
              <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-md border">
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
                {categoriesList.length === 0 && <div className="text-xs text-muted-foreground col-span-3 text-center">لا توجد تصنيفات معرفة</div>}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 border-t pt-4">
              <div className="grid gap-2">
                <Label htmlFor="m_purchase">سعر الشراء (التكلفة)</Label>
                <Input id="m_purchase" type="number" value={formData.purchase_price} onChange={(e) => setFormData({...formData, purchase_price: e.target.value})} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="m_retail">سعر المبيع (مفرق)</Label>
                <Input id="m_retail" type="number" value={formData.retail_price} onChange={(e) => setFormData({...formData, retail_price: e.target.value})} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="m_wholesale">سعر المبيع (جملة)</Label>
                <Input id="m_wholesale" type="number" value={formData.wholesale_price} onChange={(e) => setFormData({...formData, wholesale_price: e.target.value})} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="m_semi">سعر (نصف جملة)</Label>
                <Input id="m_semi" type="number" value={formData.semi_wholesale_price} onChange={(e) => setFormData({...formData, semi_wholesale_price: e.target.value})} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t pt-4">
              <div className="grid gap-2">
                <Label htmlFor="m_min">حد الطلب (الحد الأدنى)</Label>
                <Input id="m_min" type="number" value={formData.minimum_stock} onChange={(e) => setFormData({...formData, minimum_stock: e.target.value})} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="m_notes">ملاحظات</Label>
                <Input id="m_notes" value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} />
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
