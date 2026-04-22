import { useState, useEffect } from "react";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Download, Search, MoreHorizontal, Edit, Eye, AlertTriangle, Trash2, RefreshCw } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/format";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

import { productService } from "@/services/productService";
import type { ProductDto } from "@erp/shared-types";

export default function Products() {
  const [productsList, setProductsList] = useState<ProductDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Create/Edit state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<ProductDto | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    barcode: "",
    code: "",
    purchase_price: "0",
    retail_price: "0",
    wholesale_price: "0",
    semi_wholesale_price: "0",
    initial_stock: "0",
    minimum_stock: "0"
  });

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await productService.listProducts();
      setProductsList(data);
    } catch (error) {
      toast.error("فشل جلب المنتجات: " + error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleSave = async () => {
    try {
      if (editProduct) {
        await productService.updateProduct({
          id: editProduct.id,
          name: formData.name,
          barcode: formData.barcode || null,
          code: formData.code,
          purchase_price: formData.purchase_price,
          retail_price: formData.retail_price,
          wholesale_price: formData.wholesale_price,
          semi_wholesale_price: formData.semi_wholesale_price,
          stock_quantity: formData.initial_stock,
          minimum_stock: formData.minimum_stock,
          is_active: editProduct.is_active
        });
        toast.success("تم تحديث المنتج بنجاح");
      } else {
        await productService.createProduct({
          ...formData,
          barcode: formData.barcode || null
        });
        toast.success("تم إضافة المنتج بنجاح");
      }
      setIsDialogOpen(false);
      fetchProducts();
    } catch (error) {
      toast.error("خطأ في العملية: " + error);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف المنتج ${name}؟`)) return;
    try {
      await productService.deleteProduct(id);
      toast.success("تم حذف المنتج بنجاح");
      fetchProducts();
    } catch (error) {
      toast.error("خطأ في الحذف: " + error);
    }
  };

  const filteredProducts = productsList.filter(p => {
    const q = (search || "").toLowerCase();
    const nameMatch = (p.name || "").toLowerCase().includes(q);
    const codeMatch = (p.code || "").toLowerCase().includes(q);
    const barcodeMatch = (p.barcode || "").toLowerCase().includes(q);
    return nameMatch || codeMatch || barcodeMatch;
  });

  return (
    <>
      <PageHeader
        title="المنتجات والأصناف"
        subtitle="إدارة كتالوج المنتجات والمخزون"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "المنتجات" }]}
        actions={
          <>
            <Button variant="outline" onClick={fetchProducts} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ml-2 ${loading ? "animate-spin" : ""}`} />تحديث
            </Button>
            <Button variant="outline"><Download className="w-4 h-4 ml-2" />تصدير</Button>
            <Button onClick={() => {
              setEditProduct(null);
              setFormData({ 
                name: "", 
                barcode: "", 
                code: "", 
                purchase_price: "0", 
                retail_price: "0", 
                wholesale_price: "0", 
                semi_wholesale_price: "0", 
                initial_stock: "0", 
                minimum_stock: "0" 
              });
              setIsDialogOpen(true);
            }}>
              <Plus className="w-4 h-4 ml-2" />منتج جديد
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">إجمالي المنتجات</div>
          <div className="text-2xl font-bold tabular-nums mt-1">{productsList.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">قيمة المخزون</div>
          <div className="text-xl font-bold text-primary tabular-nums mt-1">
            {formatCurrency(productsList.reduce((s, p) => s + Number(p.stock_quantity || 0) * Number(p.purchase_price || 0), 0))}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">منتجات منخفضة</div>
          <div className="text-2xl font-bold text-red-600 tabular-nums mt-1">
            {productsList.filter(p => Number(p.stock_quantity || 0) < Number(p.minimum_stock || 0)).length}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">المنتجات النشطة</div>
          <div className="text-2xl font-bold tabular-nums mt-1">{productsList.filter(p => p.is_active).length}</div>
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
          <div className="border border-border rounded-md overflow-x-auto">
            <table className="w-full text-sm min-w-[1000px]">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  <th className="text-right px-4 py-3 font-medium">الباركود/الكود</th>
                  <th className="text-right px-4 py-3 font-medium">اسم المنتج</th>
                  <th className="text-left px-4 py-3 font-medium">التكلفة</th>
                  <th className="text-left px-4 py-3 font-medium">مفرق</th>
                  <th className="text-left px-4 py-3 font-medium">جملة</th>
                  <th className="text-left px-4 py-3 font-medium">المخزون</th>
                  <th className="text-left px-4 py-3 font-medium">الحالة</th>
                  <th className="text-left px-4 py-3 font-medium w-12"></th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-muted-foreground">لا توجد منتجات حالياً</td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => {
                    const low = Number(p.stock_quantity || 0) < Number(p.minimum_stock || 0);
                    return (
                      <tr key={p.id} className="border-b border-border last:border-0 hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-primary">
                          <div className="flex flex-col">
                            <span>{p.barcode || "---"}</span>
                            <span className="text-xs text-muted-foreground">{p.code}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">{p.name}</td>
                        <td className="px-4 py-3 text-left tabular-nums">{formatCurrency(Number(p.purchase_price || 0))}</td>
                        <td className="px-4 py-3 text-left tabular-nums font-medium text-green-600">{formatCurrency(Number(p.retail_price || 0))}</td>
                        <td className="px-4 py-3 text-left tabular-nums">{formatCurrency(Number(p.wholesale_price || 0))}</td>
                        <td className="px-4 py-3 text-left">
                          <div className="flex items-center justify-end gap-1.5">
                            {low && <AlertTriangle className="w-4 h-4 text-red-500" />}
                            <span className={cn("tabular-nums font-medium", low && "text-red-600")}>
                              {formatNumber(Number(p.stock_quantity || 0))} / {formatNumber(Number(p.minimum_stock || 0))}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-left"><StatusBadge status={p.is_active ? "active" : "inactive"} /></td>
                        <td className="px-4 py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => {
                                setEditProduct(p);
                                setFormData({
                                  name: p.name,
                                  barcode: p.barcode || "",
                                  code: p.code,
                                  purchase_price: p.purchase_price || "0",
                                  retail_price: p.retail_price || "0",
                                  wholesale_price: p.wholesale_price || "0",
                                  semi_wholesale_price: p.semi_wholesale_price || "0",
                                  initial_stock: p.stock_quantity,
                                  minimum_stock: p.minimum_stock
                                });
                                setIsDialogOpen(true);
                              }}><Edit className="w-4 h-4 ml-2" />تعديل</DropdownMenuItem>
                              <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(p.id, p.name)}>
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
            <DialogTitle>{editProduct ? "تعديل منتج" : "إضافة منتج جديد"}</DialogTitle>
            <DialogDescription>
              {editProduct ? "قم بتعديل بيانات الصنف والمخزون أدناه." : "أدخل تفاصيل التكويد والأسعار لإضافة المنتج الجديد."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 text-right" dir="rtl">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2 col-span-2">
                <Label htmlFor="prod_name">اسم المنتج *</Label>
                <Input id="prod_name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="prod_barcode">الباركود</Label>
                <Input id="prod_barcode" value={formData.barcode} onChange={(e) => setFormData({...formData, barcode: e.target.value})} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="prod_code">كود المادة *</Label>
                <Input id="prod_code" value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value})} />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 border-t pt-4">
              <div className="grid gap-2">
                <Label htmlFor="prod_purchase_price">سعر الشراء</Label>
                <Input id="prod_purchase_price" type="number" value={formData.purchase_price} onChange={(e) => setFormData({...formData, purchase_price: e.target.value})} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="prod_retail_price">سعر المبيع (مفرق)</Label>
                <Input id="prod_retail_price" type="number" value={formData.retail_price} onChange={(e) => setFormData({...formData, retail_price: e.target.value})} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="prod_wholesale_price">سعر المبيع (جملة)</Label>
                <Input id="prod_wholesale_price" type="number" value={formData.wholesale_price} onChange={(e) => setFormData({...formData, wholesale_price: e.target.value})} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="prod_semi_wholesale">سعر (نصف جملة)</Label>
                <Input id="prod_semi_wholesale" type="number" value={formData.semi_wholesale_price} onChange={(e) => setFormData({...formData, semi_wholesale_price: e.target.value})} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t pt-4">
              <div className="grid gap-2">
                <Label htmlFor="prod_initial_stock">{editProduct ? "الكمية الحالية" : "رصيد أول المدة"}</Label>
                <Input id="prod_initial_stock" type="number" value={formData.initial_stock} onChange={(e) => setFormData({...formData, initial_stock: e.target.value})} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="prod_minimum_stock">الحد الأدنى</Label>
                <Input id="prod_minimum_stock" type="number" value={formData.minimum_stock} onChange={(e) => setFormData({...formData, minimum_stock: e.target.value})} />
              </div>
            </div>
          </div>
          <DialogFooter className="flex-row-reverse gap-2">
            <Button onClick={handleSave} disabled={!formData.name || !formData.code}>حفظ</Button>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}