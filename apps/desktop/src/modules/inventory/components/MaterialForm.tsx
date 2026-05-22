import { useState, useEffect, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@shared/ui/tabs";
import { Textarea } from "@shared/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@shared/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@shared/ui/table";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { Button } from "@shared/ui/button";
import { FormPanel } from "@widgets/form-shell/FormPanel";
import { toast } from "sonner";
import { cn } from "@shared/lib/utils";
import { Plus, Edit, Wand2, Hash, Barcode, Package, Layers, Shuffle, Check, Scale, Boxes, Package2, FileText, Globe, Image as ImageIcon, DollarSign, Tag, ShoppingCart, TrendingUp } from "lucide-react";
import type { MaterialDto, CategoryDto, CreateMaterialRequest, UpdateMaterialRequest } from "@erp/shared-types";
import { materialCodeService } from "@modules/inventory/api/materialCodeService";
import { categoryService } from "@modules/inventory/api/categoryService";
import { useCurrencyContext } from "@app/providers/CurrencyContext";

const DEFAULT_CATEGORY_NAME = "غير مصنف";

const SALE_TIERS = [
  { id: 'consumer', label: 'مستهلك' },
  { id: 'retail', label: 'مفرق' },
  { id: 'wholesale', label: 'جملة' },
  { id: 'semi_wholesale', label: 'نصف جملة' },
  { id: 'special', label: 'خاص' },
];

interface MaterialFormProps {
  open: boolean;
  onClose: () => void;
  material: MaterialDto | null;
  categories: CategoryDto[];
  onSave: (data: CreateMaterialRequest | UpdateMaterialRequest) => Promise<void>;
  saving: boolean;
}

const EMPTY_FORM = {
  name: "",
  name_en: "",
  barcode: "",
  code: "",
  minimum_stock: "0",
  is_active: true,
  notes: "",
  image_path: "",
  default_purchase_unit_id: "",
  default_sale_unit_id: "",
  units: [
    { name: "قطعة", conversion_factor: "1", barcode: "" }
  ],
  selectedCategoryIds: [] as string[],
  purchase_prices: [] as { unit_id: string; price_usd: string; price_syp: string }[],
  sale_prices: [] as { unit_id: string; tier: string; price_usd: string; price_syp: string; min_price_usd: string; min_price_syp: string }[],
};

export function MaterialForm({ open, onClose, material, categories, onSave, saving }: MaterialFormProps) {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [activeTab, setActiveTab] = useState("basic");
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);

  const { currencies, baseCurrency } = useCurrencyContext();
  const activeCurrencies = useMemo(() => currencies.filter(c => c.is_active), [currencies]);
  const uncategorizedCat = useMemo(() => categories.find(c => c.name === DEFAULT_CATEGORY_NAME && !c.parent_id), [categories]);
  const mainCategories = useMemo(() => categories.filter(c => !c.parent_id && c.name !== DEFAULT_CATEGORY_NAME && !c.is_hybrid), [categories]);

  useEffect(() => {
    if (open) {
      if (material) {
        setFormData({
          name: material.name,
          name_en: material.name_en || "",
          barcode: material.barcode || "",
          code: material.code || "",
          minimum_stock: material.minimum_stock,
          is_active: material.is_active,
          notes: material.notes || "",
          image_path: material.image_path || "",
          default_purchase_unit_id: material.default_purchase_unit_id || "",
          default_sale_unit_id: material.default_sale_unit_id || "",
          units: material.units.map(u => ({
            name: u.name,
            conversion_factor: u.conversion_factor,
            barcode: u.barcode || ""
          })),
          selectedCategoryIds: material.category_ids,
          purchase_prices: material.purchase_prices.map(p => ({
            unit_id: p.unit_id,
            price_usd: p.price_usd,
            price_syp: p.price_syp
          })),
          sale_prices: material.sale_prices.map(p => ({
            unit_id: p.unit_id,
            tier: p.tier,
            price_usd: p.price_usd,
            price_syp: p.price_syp,
            min_price_usd: p.min_price_usd,
            min_price_syp: p.min_price_syp
          })),
        });
      } else {
        setFormData({
          ...EMPTY_FORM,
          selectedCategoryIds: uncategorizedCat ? [uncategorizedCat.id] : [],
        });
      }
      setActiveTab("basic");
    }
  }, [open, material, uncategorizedCat]);

  // Sync default unit selections if units change
  useEffect(() => {
    if (!material && formData.units.length > 0) {
      // For new materials, if default units are empty, pick the first one
      setFormData(prev => ({
        ...prev,
        default_purchase_unit_id: prev.default_purchase_unit_id || prev.units[0].name,
        default_sale_unit_id: prev.default_sale_unit_id || prev.units[0].name
      }));
    }
  }, [formData.units, material]);

  const handleCategoryToggle = (id: string, isUncategorized: boolean, mainId?: string) => {
    setFormData(prev => {
      let nextIds = [...prev.selectedCategoryIds];
      if (isUncategorized) return { ...prev, selectedCategoryIds: [id] };
      
      nextIds = nextIds.filter(cid => cid !== uncategorizedCat?.id);

      if (mainId) {
        const existingInRow = nextIds.find(cid => {
          const cat = categories.find(c => c.id === cid);
          return cat?.parent_id === mainId;
        });
        
        if (existingInRow === id) {
          nextIds = nextIds.filter(cid => cid !== id);
        } else {
          nextIds = nextIds.filter(cid => categories.find(c => c.id === cid)?.parent_id !== mainId);
          nextIds.push(id);
        }
      } else {
        if (nextIds.includes(id)) nextIds = nextIds.filter(cid => cid !== id);
        else nextIds.push(id);
      }

      if (nextIds.length === 0 && uncategorizedCat) nextIds = [uncategorizedCat.id];
      return { ...prev, selectedCategoryIds: nextIds };
    });
  };

  const handleGenerateAutoCode = async () => {
    if (formData.selectedCategoryIds.length === 0) return;
    try {
      setIsGeneratingCode(true);
      if (formData.selectedCategoryIds.length > 1) {
        const prefixes = categories.filter(c => formData.selectedCategoryIds.includes(c.id)).map(c => c.code_prefix).filter(Boolean) as string[];
        if (prefixes.length === 0) { toast.error("التصنيفات المختارة لا تملك بادئات كود."); return; }
        const hybridCat = await categoryService.getOrCreateHybridCategory(prefixes);
        const code = await materialCodeService.generateCode(hybridCat.id);
        setFormData(prev => ({ ...prev, code }));
      } else {
        const code = await materialCodeService.generateCode(formData.selectedCategoryIds[0]);
        setFormData(prev => ({ ...prev, code }));
      }
      toast.success("تم توليد الكود بنجاح");
    } catch (error) { toast.error("فشل توليد الكود: " + error); }
    finally { setIsGeneratingCode(false); }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) { toast.error("اسم المادة مطلوب"); return; }
    
    await onSave({
      ...formData,
      id: material?.id,
      category_ids: formData.selectedCategoryIds,
    });
  };

  const addUnit = () => {
    setFormData(prev => ({
      ...prev,
      units: [...prev.units, { name: "", conversion_factor: "", barcode: "" }]
    }));
  };

  const removeUnit = (index: number) => {
    if (formData.units.length <= 1) return;
    setFormData(prev => ({
      ...prev,
      units: prev.units.filter((_, i) => i !== index)
    }));
  };

  const updateUnit = (index: number, field: string, value: string) => {
    setFormData(prev => {
      const nextUnits = [...prev.units];
      nextUnits[index] = { ...nextUnits[index], [field]: value };
      return { ...prev, units: nextUnits };
    });
  };

  const updatePurchasePrice = (unitIdx: number, field: string, value: string) => {
    setFormData(prev => {
        const unit = prev.units[unitIdx];
        const unitId = material ? material.units[unitIdx]?.id : unit.name;
        const nextPrices = [...prev.purchase_prices];
        const idx = nextPrices.findIndex(p => p.unit_id === unitId);
        
        if (idx >= 0) {
            nextPrices[idx] = { ...nextPrices[idx], [field]: value };
        } else {
            nextPrices.push({ unit_id: unitId, price_usd: "0", price_syp: "0", [field]: value });
        }
        return { ...prev, purchase_prices: nextPrices };
    });
  };

  const updateSalePrice = (unitIdx: number, tier: string, field: string, value: string) => {
    setFormData(prev => {
        const unit = prev.units[unitIdx];
        const unitId = material ? material.units[unitIdx]?.id : unit.name;
        const nextPrices = [...prev.sale_prices];
        const idx = nextPrices.findIndex(p => p.unit_id === unitId && p.tier === tier);
        
        if (idx >= 0) {
            nextPrices[idx] = { ...nextPrices[idx], [field]: value };
        } else {
            nextPrices.push({ 
                unit_id: unitId, 
                tier, 
                price_usd: "0", 
                price_syp: "0", 
                min_price_usd: "0", 
                min_price_syp: "0",
                [field]: value 
            });
        }
        return { ...prev, sale_prices: nextPrices };
    });
  };

  const getPurchasePrice = (unitIdx: number, field: 'price_usd' | 'price_syp') => {
      const unitId = material ? material.units[unitIdx]?.id : formData.units[unitIdx].name;
      return formData.purchase_prices.find(p => p.unit_id === unitId)?.[field] || "0";
  };

  const getSalePrice = (unitIdx: number, tier: string, field: string) => {
      const unitId = material ? material.units[unitIdx]?.id : formData.units[unitIdx].name;
      const price = formData.sale_prices.find(p => p.unit_id === unitId && p.tier === tier);
      return (price as Record<string, string>)?.[field] || "0";
  };

  if (!open) return null;

  return (
    <FormPanel 
      title={material ? "تعديل بطاقة المادة" : "إضافة مادة جديدة"}
      icon={material ? <Edit className="w-5 h-5 text-blue-600" /> : <Package2 className="w-5 h-5 text-emerald-600" />}
      onClose={onClose}
      onSave={handleSave}
      isSaving={saving}
      saveDisabled={!formData.name.trim() || formData.selectedCategoryIds.length === 0}
      saveLabel={material ? "حفظ التعديلات" : "إضافة المادة"}
      className="max-w-4xl"
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full" dir="rtl">
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="basic" className="gap-2"><Package className="w-4 h-4" /> الأساسيات</TabsTrigger>
          <TabsTrigger value="units" className="gap-2"><Scale className="w-4 h-4" /> الوحدات</TabsTrigger>
          <TabsTrigger value="prices" className="gap-2"><DollarSign className="w-4 h-4" /> الأسعار</TabsTrigger>
          <TabsTrigger value="extra" className="gap-2"><FileText className="w-4 h-4" /> إضافي</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="font-bold text-slate-700">اسم المادة (عربي) <span className="text-red-500">*</span></Label>
                <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="مثال: سكر ناعم" className="h-11 border-slate-200" />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-slate-700 flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 text-slate-400" /> الاسم (English)</Label>
                <Input value={formData.name_en} onChange={e => setFormData({ ...formData, name_en: e.target.value })} placeholder="Example: Fine Sugar" className="h-11 border-slate-200" dir="ltr" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="font-bold text-slate-700 flex items-center gap-1.5"><Hash className="w-3.5 h-3.5 text-slate-400" /> الكود</Label>
                  <div className="relative group">
                    <Input value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })} className="h-10 font-mono text-xs pr-10" placeholder="الكود" dir="ltr" />
                    <Button size="icon" variant="ghost" onClick={handleGenerateAutoCode} disabled={isGeneratingCode || formData.selectedCategoryIds.length === 0} className="absolute right-1 top-1 h-8 w-8 text-blue-500"><Wand2 className={cn("w-4 h-4", isGeneratingCode && "animate-spin")} /></Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-slate-700 flex items-center gap-1.5"><Barcode className="w-3.5 h-3.5 text-slate-400" /> الباركود العام</Label>
                  <Input value={formData.barcode} onChange={e => setFormData({ ...formData, barcode: e.target.value })} className="h-10 font-mono text-xs" placeholder="الباركود" dir="ltr" />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="font-bold text-slate-700 flex items-center gap-1.5"><Package className="w-3.5 h-3.5 text-slate-400" /> حد الطلب</Label>
                  <Input type="number" value={formData.minimum_stock} onChange={e => setFormData({ ...formData, minimum_stock: e.target.value })} className="h-10" />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-slate-700 flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-slate-400" /> الحالة</Label>
                  <div className="flex items-center gap-2 h-10 px-3 bg-slate-50 rounded-md border border-slate-200">
                    <input type="checkbox" checked={formData.is_active} onChange={e => setFormData({ ...formData, is_active: e.target.checked })} className="w-4 h-4 accent-blue-600" />
                    <span className="text-sm font-medium text-slate-600">نشط</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Label className="font-bold text-slate-700 flex items-center gap-2"><Layers className="w-4 h-4 text-emerald-600" /> تصنيف المادة</Label>
              <div className="border rounded-lg overflow-hidden bg-white max-h-[300px] overflow-y-auto shadow-sm">
                <div className="bg-slate-50 px-4 py-2 border-b text-[10px] font-bold text-slate-400 grid grid-cols-2 gap-4"><div>التصنيف الرئيسي</div><div>التصنيفات الفرعية</div></div>
                <div className="divide-y divide-slate-100">
                  {uncategorizedCat && (
                    <div className="grid grid-cols-2 items-center min-h-[44px] hover:bg-slate-50/50">
                      <div className="px-4 py-2 font-medium text-blue-600 text-xs italic">غير مصنف</div>
                      <div className="px-4 py-2"><div onClick={() => handleCategoryToggle(uncategorizedCat.id, true)} className={cn("flex items-center gap-2 px-3 py-1 rounded-md border cursor-pointer text-[10px]", formData.selectedCategoryIds.includes(uncategorizedCat.id) ? "bg-blue-50 border-blue-200 text-blue-700 font-bold" : "bg-white border-slate-200 text-slate-500")}>افتراضي</div></div>
                    </div>
                  )}
                  {mainCategories.map(main => (
                    <div key={main.id} className="grid grid-cols-2 items-center min-h-[44px] hover:bg-slate-50/50">
                      <div className="px-4 py-2 font-bold text-slate-700 text-xs">{main.name}</div>
                      <div className="px-4 py-2 flex flex-wrap gap-2">
                        {categories.filter(c => c.parent_id === main.id).map(sub => (
                          <div key={sub.id} onClick={() => handleCategoryToggle(sub.id, false, main.id)} className={cn("flex items-center gap-2 px-2 py-0.5 rounded-md border cursor-pointer text-[9px]", formData.selectedCategoryIds.includes(sub.id) ? "bg-emerald-50 border-emerald-200 text-emerald-700 font-bold" : "bg-white border-slate-200 text-slate-500")}>
                            <div className={cn("w-2.5 h-2.5 rounded-sm border flex items-center justify-center", formData.selectedCategoryIds.includes(sub.id) ? "bg-emerald-600 border-emerald-600" : "border-slate-300")}>{formData.selectedCategoryIds.includes(sub.id) && <Check className="w-2 h-2 text-white" />}</div>
                            {sub.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="units" className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-800">إدارة الوحدات</h3>
              <p className="text-xs text-slate-500 italic">عرّف الوحدات المختلفة التي يتم بها بيع أو شراء هذه المادة.</p>
            </div>
            {!material && (
              <Button type="button" size="sm" onClick={addUnit} className="bg-blue-600 hover:bg-blue-700 gap-1.5"><Plus className="w-4 h-4" /> إضافة وحدة جديدة</Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {formData.units.map((unit, idx) => (
              <div key={idx} className={cn(
                "p-5 rounded-2xl border bg-white space-y-4 relative transition-all shadow-sm",
                idx === 0 ? "border-blue-200 bg-blue-50/30" : "border-slate-200"
              )}>
                {idx > 0 && !material && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => removeUnit(idx)}
                    className="absolute -left-2 -top-2 h-7 w-7 rounded-full bg-red-50 text-red-500 hover:bg-red-100 border border-red-100 shadow-sm z-10"
                  >
                    <Plus className="w-4 h-4 rotate-45" />
                  </Button>
                )}
                
                <div className="flex items-center gap-3">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", idx === 0 ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "bg-slate-100 text-slate-500")}>
                    {idx === 0 ? <Package className="w-5 h-5" /> : <Boxes className="w-5 h-5" />}
                  </div>
                  <div className="flex-1">
                    <Label className="text-[10px] font-bold text-slate-500 block mb-1">اسم الوحدة {idx === 0 && <span className="text-blue-600">(أساسية)</span>}</Label>
                    <Input value={unit.name} onChange={e => updateUnit(idx, "name", e.target.value)} className="h-9 font-bold" placeholder="مثلاً: قطعة" disabled={!!material} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-slate-500">معامل التعبئة</Label>
                    <Input type="number" value={unit.conversion_factor} onChange={e => updateUnit(idx, "conversion_factor", e.target.value)} className="h-9 font-mono" disabled={idx === 0 || !!material} min="0" step="any" />
                    {idx === 0 && <p className="text-[8px] text-blue-500 font-bold">دائماً 1 للوحدة الأساسية</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-slate-500">باركود خاص بالوحدة</Label>
                    <Input value={unit.barcode} onChange={e => updateUnit(idx, "barcode", e.target.value)} className="h-9 font-mono text-xs" placeholder="اختياري" dir="ltr" disabled={!!material} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex gap-3">
            <Shuffle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <p className="text-xs text-amber-700 leading-relaxed">
              <strong>هام:</strong> الوحدة الأولى هي <strong>الوحدة الأساسية</strong> التي يتم تخزين الكميات بها في المستودع. الوحدات الأخرى يتم حسابها بناءً على معامل التعبئة (مثلاً: صندوق = 12 قطعة).
            </p>
          </div>
        </TabsContent>

        <TabsContent value="prices" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Label className="font-bold text-slate-800 flex items-center gap-2"><Scale className="w-4 h-4 text-blue-600" /> الوحدات الافتراضية</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-500">وحدة الشراء الافتراضية</Label>
                  <Select value={formData.default_purchase_unit_id} onValueChange={v => setFormData({ ...formData, default_purchase_unit_id: v })}>
                    <SelectTrigger className="h-10 bg-white"><SelectValue placeholder="اختر وحدة" /></SelectTrigger>
                    <SelectContent>
                      {formData.units.map((u, i) => (
                        <SelectItem key={i} value={material ? (material.units[i]?.id || u.name) : u.name}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-500">وحدة البيع الافتراضية</Label>
                  <Select value={formData.default_sale_unit_id} onValueChange={v => setFormData({ ...formData, default_sale_unit_id: v })}>
                    <SelectTrigger className="h-10 bg-white"><SelectValue placeholder="اختر وحدة" /></SelectTrigger>
                    <SelectContent>
                      {formData.units.map((u, i) => (
                        <SelectItem key={i} value={material ? (material.units[i]?.id || u.name) : u.name}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Purchase Prices Section */}
            <div className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                    <ShoppingCart className="w-5 h-5 text-blue-600" />
                    <h3 className="font-bold text-slate-800">أسعار الشراء (حسب الوحدة)</h3>
                </div>
                <div className="border rounded-2xl overflow-hidden bg-white shadow-sm">
                    <Table>
                        <TableHeader className="bg-slate-50/80">
                            <TableRow className="border-b-slate-200">
                                <TableHead className="w-48 font-bold text-slate-700">الوحدة</TableHead>
                                {activeCurrencies.map(c => (
                                  <TableHead key={c.code} className="text-center font-bold text-slate-700">سعر الشراء ({c.symbol || c.code})</TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {formData.units.map((unit, uIdx) => (
                                <TableRow key={uIdx} className="hover:bg-slate-50/30">
                                    <TableCell className="font-bold text-slate-600 bg-slate-50/30">{unit.name || `وحدة ${uIdx+1}`}</TableCell>
                                    {activeCurrencies.map(c => {
                                      const field = c.is_base ? 'price_usd' : 'price_syp';
                                      const sym = c.symbol || c.code;
                                      return (
                                        <TableCell key={c.code} className="p-2">
                                          <div className="relative">
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500">{sym}</span>
                                            <Input
                                              type="number"
                                              value={getPurchasePrice(uIdx, field as 'price_usd' | 'price_syp')}
                                              onChange={e => updatePurchasePrice(uIdx, field, e.target.value)}
                                              className="h-9 pl-6 font-bold text-center border-slate-200 focus:border-blue-500"
                                            />
                                          </div>
                                        </TableCell>
                                      );
                                    })}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Sale Prices Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-800">أسعار المبيع (حسب المستويات)</h3>
              </div>
              
              <div className="border rounded-2xl overflow-x-auto bg-white shadow-sm">
                <Table className="min-w-[800px]">
                  <TableHeader className="bg-slate-50/80">
                    <TableRow className="border-b-slate-200">
                      <TableHead className="w-32 font-bold text-slate-700 sticky right-0 bg-slate-50 z-10">الوحدة</TableHead>
                      {SALE_TIERS.map(tier => (
                        <TableHead key={tier.id} className="text-center font-bold text-slate-700 min-w-[180px] border-r border-slate-100">{tier.label}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formData.units.map((unit, uIdx) => (
                      <TableRow key={uIdx} className="hover:bg-slate-50/30">
                        <TableCell className="font-bold text-slate-600 bg-slate-50/30 sticky right-0 z-10">{unit.name || `وحدة ${uIdx+1}`}</TableCell>
                        {SALE_TIERS.map(tier => (
                          <TableCell key={tier.id} className="p-2 border-r border-slate-50">
                            <div className="space-y-2">
                              <div className="space-y-1">
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">سعر المبيع</span>
                                <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${activeCurrencies.length}, 1fr)` }}>
                                  {activeCurrencies.map(c => {
                                    const field = c.is_base ? 'price_usd' : 'price_syp';
                                    const sym = c.symbol || c.code;
                                    return (
                                      <div key={c.code} className="relative">
                                        <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[8px] font-bold text-slate-500">{sym}</span>
                                        <Input
                                          type="number"
                                          value={getSalePrice(uIdx, tier.id, field as 'price_usd' | 'price_syp')}
                                          onChange={e => updateSalePrice(uIdx, tier.id, field, e.target.value)}
                                          className="h-7 pl-4 text-[10px] font-bold text-center border-slate-100 bg-slate-50/20"
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                              <div className="space-y-1 pt-1 border-t border-slate-50">
                                <span className="text-[8px] font-black text-amber-500 uppercase tracking-tighter">الحد الأدنى</span>
                                <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${activeCurrencies.length}, 1fr)` }}>
                                  {activeCurrencies.map(c => {
                                    const field = c.is_base ? 'min_price_usd' : 'min_price_syp';
                                    const sym = c.symbol || c.code;
                                    return (
                                      <div key={c.code} className="relative">
                                        <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[8px] font-bold text-slate-500">{sym}</span>
                                        <Input
                                          type="number"
                                          value={getSalePrice(uIdx, tier.id, field as 'min_price_usd' | 'min_price_syp')}
                                          onChange={e => updateSalePrice(uIdx, tier.id, field, e.target.value)}
                                          className="h-7 pl-4 text-[10px] font-medium text-center border-amber-100 bg-amber-50/20"
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="extra" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="font-bold text-slate-700 flex items-center gap-1.5"><ImageIcon className="w-3.5 h-3.5 text-slate-400" /> صورة المادة</Label>
                <div className="flex gap-2">
                    <Button 
                        type="button" 
                        variant="outline" 
                        className="flex-1 h-10 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50/50 gap-2"
                        onClick={() => document.getElementById('material-image-upload')?.click()}
                    >
                        <ImageIcon className="w-4 h-4 text-blue-500" />
                        <span className="text-xs">تحميل من الجهاز</span>
                    </Button>
                    {formData.image_path && (
                        <Button 
                            type="button" 
                            variant="outline" 
                            size="icon" 
                            className="h-10 w-10 text-red-500 hover:bg-red-50"
                            onClick={() => setFormData({ ...formData, image_path: "" })}
                        >
                            <Plus className="w-4 h-4 rotate-45" />
                        </Button>
                    )}
                </div>
                <input 
                    id="material-image-upload"
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            setFormData({ ...formData, image_path: reader.result as string });
                        };
                        reader.readAsDataURL(file);
                    }}
                />
                <p className="text-[9px] text-slate-400 italic">اختر صورة للمادة من جهازك لتسهيل التعرف عليها بصرياً.</p>
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-slate-700 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-slate-400" /> ملاحظات إضافية</Label>
                <Textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="أي تفاصيل أخرى حول هذه المادة..." className="min-h-[120px] resize-none border-slate-200" />
              </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-32 h-32 rounded-2xl bg-white border border-slate-100 shadow-inner flex items-center justify-center overflow-hidden">
                {formData.image_path ? (
                  <img src={formData.image_path} alt="Preview" className="w-full h-full object-contain" />
                ) : (
                  <ImageIcon className="w-12 h-12 text-slate-200" />
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-600">معاينة الصورة</p>
                <p className="text-[10px] text-slate-400 max-w-[200px]">ستظهر هذه الصورة في متصفح المواد وعند اختيار المادة في الفاتورة.</p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </FormPanel>
  );
}
