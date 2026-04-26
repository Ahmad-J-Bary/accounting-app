import { useState, useEffect } from "react";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, MoreHorizontal, Edit, Trash2, RefreshCw, FolderTree, ChevronRight, ChevronDown, Package } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { categoryService } from "@/services/categoryService";
import type { CategoryDto } from "@erp/shared-types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CategoryTreeNode extends CategoryDto {
  children: CategoryTreeNode[];
  isExpanded?: boolean;
}

export default function Categories() {
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [tree, setTree] = useState<CategoryTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<CategoryDto | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    parent_id: "" as string | null
  });

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const data = await categoryService.listCategories();
      setCategories(data);
      buildTree(data);
    } catch (error) {
      toast.error("فشل جلب التصنيفات: " + error);
    } finally {
      setLoading(false);
    }
  };

  const buildTree = (cats: CategoryDto[]) => {
    const map = new Map<string, CategoryTreeNode>();
    const roots: CategoryTreeNode[] = [];

    cats.forEach(c => map.set(c.id, { ...c, children: [] }));
    cats.forEach(c => {
      const node = map.get(c.id)!;
      if (c.parent_id && map.has(c.parent_id)) {
        map.get(c.parent_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    });
    setTree(roots);
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleSave = async () => {
    try {
      if (editCategory) {
        await categoryService.updateCategory({
          id: editCategory.id,
          name: formData.name,
          parent_id: formData.parent_id === "root" ? null : formData.parent_id,
          is_active: editCategory.is_active
        });
        toast.success("تم التحديث بنجاح");
      } else {
        await categoryService.createCategory({
          name: formData.name,
          parent_id: formData.parent_id === "root" ? null : formData.parent_id
        });
        toast.success("تمت الإضافة بنجاح");
      }
      setIsDialogOpen(false);
      fetchCategories();
    } catch (error) {
      toast.error("خطأ: " + error);
    }
  };

  const handleDelete = async (cat: CategoryDto) => {
    if (cat.name === "عام") {
        toast.error("لا يمكن حذف التصنيف الافتراضي");
        return;
    }
    if (cat.material_count > 0) {
        toast.error("لا يمكن حذف تصنيف يحتوي على مواد");
        return;
    }
    if (!confirm(`هل أنت متأكد من حذف ${cat.name}؟`)) return;
    try {
      await categoryService.deleteCategory(cat.id);
      toast.success("تم الحذف بنجاح");
      fetchCategories();
    } catch (error) {
      toast.error("فشل الحذف: " + error);
    }
  };

  const toggleExpand = (id: string) => {
    const newSet = new Set(expandedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedIds(newSet);
  };

  const renderNode = (node: CategoryTreeNode, level: number = 0) => {
    const isExpanded = expandedIds.has(node.id);
    const hasChildren = node.children.length > 0;

    return (
      <div key={node.id} className="flex flex-col">
        <div 
          className={cn(
            "flex items-center gap-2 py-2 px-3 hover:bg-slate-50 border-b border-slate-100 group transition-colors",
            level > 0 && "mr-6 border-r-2 border-slate-200"
          )}
        >
          <div className="flex items-center gap-2 flex-1">
            {hasChildren ? (
              <button onClick={() => toggleExpand(node.id)} className="p-1 hover:bg-slate-200 rounded">
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            ) : (
              <div className="w-6" />
            )}
            <FolderTree className={cn("w-4 h-4", node.name === "عام" ? "text-blue-500" : "text-slate-400")} />
            <span className="font-medium text-slate-700">{node.name}</span>
            <Badge variant="outline" className="text-[10px] py-0 px-1 tabular-nums bg-slate-50">
              <Package className="w-3 h-3 ml-1 opacity-50" /> {node.material_count}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <StatusBadge status={node.is_active ? "active" : "inactive"} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="w-4 h-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => {
                  setEditCategory(node);
                  setFormData({ name: node.name, parent_id: node.parent_id || "root" });
                  setIsDialogOpen(true);
                }}><Edit className="w-4 h-4 ml-2" />تعديل</DropdownMenuItem>
                <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(node)}>
                  <Trash2 className="w-4 h-4 ml-2" />حذف
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {isExpanded && node.children.map(child => renderNode(child, level + 1))}
      </div>
    );
  };

  return (
    <>
      <PageHeader
        title="تصنيفات المواد"
        subtitle="تنظيم المواد في هيكل شجري (أب وأبناء)"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "المواد", to: "/materials" }, { label: "التصنيفات" }]}
        actions={
          <Button onClick={() => {
            setEditCategory(null);
            setFormData({ name: "", parent_id: "root" });
            setIsDialogOpen(true);
          }}>
            <Plus className="w-4 h-4 ml-2" />تصنيف جديد
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-right" dir="rtl">
        <Card className="lg:col-span-2 p-0 overflow-hidden">
          <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2"><FolderTree className="w-5 h-5 text-primary" /> شجرة التصنيفات</h3>
            <Button variant="ghost" size="sm" onClick={fetchCategories} disabled={loading}>
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            </Button>
          </div>
          <div className="min-h-[400px]">
            {loading ? (
              <div className="p-10 text-center text-muted-foreground">جاري التحميل...</div>
            ) : tree.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground">لا توجد تصنيفات معرفة</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {tree.map(node => renderNode(node))}
              </div>
            )}
          </div>
        </Card>

        <Card className="p-5 h-fit sticky top-6">
          <h3 className="font-bold mb-4 border-b pb-2">نصائح التنظيم</h3>
          <ul className="text-sm space-y-3 text-slate-600">
            <li>• استخدم التصنيفات لتجميع المواد المتشابهة (مثال: "مواد بناء"، "دهانات").</li>
            <li>• يمكنك إنشاء مستويات متعددة (أب وابنه) لتنظيم أدق.</li>
            <li>• لا يمكن حذف تصنيف يحتوي على مواد نشطة.</li>
            <li>• التصنيف "عام" هو التصنيف الافتراضي ولا يمكن حذفه.</li>
          </ul>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{editCategory ? "تعديل تصنيف" : "إضافة تصنيف جديد"}</DialogTitle>
            <DialogDescription>أدخل اسم التصنيف واختر التصنيف الأب (اختياري).</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 text-right" dir="rtl">
            <div className="grid gap-2">
              <Label htmlFor="cat_name">اسم التصنيف *</Label>
              <Input id="cat_name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cat_parent">التصنيف الأب</Label>
              <Select 
                value={formData.parent_id || "root"} 
                onValueChange={(val) => setFormData({...formData, parent_id: val})}
              >
                <SelectTrigger id="cat_parent">
                  <SelectValue placeholder="اختر الأب (اختياري)" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="root">-- بدون أب (تصنيف رئيسي) --</SelectItem>
                  {categories.filter(c => !editCategory || c.id !== editCategory.id).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex-row-reverse gap-2">
            <Button onClick={handleSave} disabled={!formData.name}>حفظ</Button>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
