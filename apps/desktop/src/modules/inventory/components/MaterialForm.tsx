import { useState, useEffect, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@shared/ui/tabs";
import { Textarea } from "@shared/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@shared/ui/select";
import { Input } from "@shared/ui/input";
import { Button } from "@shared/ui/button";
import { FormPanel } from "@widgets/form-shell/FormPanel";
import { SidebarSection } from "@widgets/sidebar/SidebarSection";
import { FieldLabel } from "@widgets/sidebar/FieldLabel";
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
  purchase_prices: [] as { unit_id: string; price: string; price_base: string; currency: string }[],
  sale_prices: [] as { unit_id: string; tier: string; price: string; price_base: string; min_price: string; min_price_base: string; currency: string }[],
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
            price: p.price,
            price_base: p.price_base,
            currency: p.currency
          })),
          sale_prices: material.sale_prices.map(p => ({
            unit_id: p.unit_id,
            tier: p.tier,
            price: p.price,
            price_base: p.price_base,
            min_price: p.min_price,
            min_price_base: p.min_price_base,
            currency: p.currency
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
        nextPrices.push({ unit_id: unitId, price: "0", price_base: "0", currency: "", [field]: value });
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
          price: "0", 
          price_base: "0", 
          min_price: "0", 
          min_price_base: "0",
          currency: "",
          [field]: value 
        });
      }
      return { ...prev, sale_prices: nextPrices };
    });
  };

  const getPurchasePrice = (unitIdx: number, field: 'price' | 'price_base') => {
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
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full animate-in fade-in duration-200" dir="rtl">
        <TabsList className="grid w-full grid-cols-4 mb-5 p-1 bg-slate-100/80 rounded-xl">
          <TabsTrigger value="basic" className="gap-1.5 text-xs font-bold"><Package className="w-4 h-4" /> الأساسيات</TabsTrigger>
          <TabsTrigger value="units" className="gap-1.5 text-xs font-bold"><Scale className="w-4 h-4" /> الوحدات</TabsTrigger>
          <TabsTrigger value="prices" className="gap-1.5 text-xs font-bold"><DollarSign className="w-4 h-4" /> الأسعار</TabsTrigger>
          <TabsTrigger value="extra" className="gap-1.5 text-xs font-bold"><FileText className="w-4 h-4" /> إضافي</TabsTrigger>
        </TabsList>

        {/* Tab 1: الأساسيات */}
        <TabsContent value="basic" className="space-y-4">
          <SidebarSection title="البيانات الأساسية" defaultOpen={true}>
            <div className="space-y-4 text-right">
              {/* اسم المادة عربي */}
              <div className="space-y-2">
                <FieldLabel required>اسم المادة (عربي)</FieldLabel>
                <Input 
                  value={formData.name} 
                  onChange={e => setFormData({ ...formData, name: e.target.value })} 
                  placeholder="مثال: سكر ناعم" 
                  className="bg-white border-slate-200" 
                />
              </div>

              {/* الاسم إنجليزي */}
              <div className="space-y-2">
                <FieldLabel className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 text-slate-400" /> الاسم (English)</FieldLabel>
                <Input 
                  value={formData.name_en} 
                  onChange={e => setFormData({ ...formData, name_en: e.target.value })} 
                  placeholder="Example: Fine Sugar" 
                  className="bg-white border-slate-200" 
                  dir="ltr" 
                />
              </div>

              {/* الكود والباركود */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <FieldLabel className="flex items-center gap-1.5"><Hash className="w-3.5 h-3.5 text-slate-400" /> الكود</FieldLabel>
                  <div className="relative group">
                    <Input 
                      value={formData.code} 
                      onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })} 
                      className="font-mono text-xs pr-10 bg-white border-slate-200" 
                      placeholder="الكود" 
                      dir="ltr" 
                    />
                    <Button 
                      type="button"
                      size="icon" 
                      variant="ghost" 
                      onClick={handleGenerateAutoCode} 
                      disabled={isGeneratingCode || formData.selectedCategoryIds.length === 0} 
                      className="absolute right-1 top-1 h-8 w-8 text-blue-500"
                    >
                      <Wand2 className={cn("w-4 h-4", isGeneratingCode && "animate-spin")} />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <FieldLabel className="flex items-center gap-1.5"><Barcode className="w-3.5 h-3.5 text-slate-400" /> الباركود العام</FieldLabel>
                  <Input 
                    value={formData.barcode} 
                    onChange={e => setFormData({ ...formData, barcode: e.target.value })} 
                    className="font-mono text-xs bg-white border-slate-200" 
                    placeholder="الباركود" 
                    dir="ltr" 
                  />
                </div>
              </div>
              
              {/* حد الطلب والحالة */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <FieldLabel className="flex items-center gap-1.5"><Package className="w-3.5 h-3.5 text-slate-400" /> حد الطلب</FieldLabel>
                  <Input 
                    type="number" 
                    value={formData.minimum_stock} 
                    onChange={e => setFormData({ ...formData, minimum_stock: e.target.value })} 
                    className="bg-white border-slate-200" 
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-slate-400" /> الحالة</FieldLabel>
                  <div className="flex items-center gap-2 h-10 px-3 bg-slate-50 rounded-lg border border-slate-200">
                    <input 
                      type="checkbox" 
                      checked={formData.is_active} 
                      onChange={e => setFormData({ ...formData, is_active: e.target.checked })} 
                      className="w-4 h-4 accent-blue-600 cursor-pointer" 
                    />
                    <span className="text-xs font-bold text-slate-600">نشط</span>
                  </div>
                </div>
              </div>
            </div>
          </SidebarSection>

          {/* تصنيف المادة */}
          <SidebarSection title="تصنيف المادة" defaultOpen={false}>
            <div className="border border-slate-200/70 rounded-2xl overflow-hidden bg-white shadow-sm">
              <div className="bg-slate-50 px-4 py-2.5 border-b text-[10px] font-black text-slate-400 grid grid-cols-2 gap-4">
                <div>التصنيف الرئيسي</div>
                <div>التصنيفات الفرعية</div>
              </div>
              <div className="divide-y divide-slate-100 max-h-[260px] overflow-y-auto custom-scrollbar text-right">
                {uncategorizedCat && (
                  <div className="grid grid-cols-2 items-center min-h-[44px] hover:bg-slate-50/50">
                    <div className="px-4 py-2 font-black text-blue-600 text-xs italic">غير مصنف</div>
                    <div className="px-4 py-2">
                      <div 
                        onClick={() => handleCategoryToggle(uncategorizedCat.id, true)} 
                        className={cn("flex items-center justify-center gap-2 px-3 py-1.5 rounded-xl border cursor-pointer text-[10px] transition-all", 
                          formData.selectedCategoryIds.includes(uncategorizedCat.id) 
                            ? "bg-blue-50 border-blue-200 text-blue-700 font-bold" 
                            : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                        )}
                      >
                        افتراضي
                      </div>
                    </div>
                  </div>
                )}
                {mainCategories.map(main => (
                  <div key={main.id} className="grid grid-cols-2 items-center min-h-[44px] hover:bg-slate-50/50">
                    <div className="px-4 py-2 font-bold text-slate-700 text-xs">{main.name}</div>
                    <div className="px-4 py-2 flex flex-wrap gap-1.5">
                      {categories.filter(c => c.parent_id === main.id).map(sub => (
                        <div 
                          key={sub.id} 
                          onClick={() => handleCategoryToggle(sub.id, false, main.id)} 
                          className={cn("flex items-center gap-2 px-2.5 py-1 rounded-xl border cursor-pointer text-[9px] transition-all", 
                            formData.selectedCategoryIds.includes(sub.id) 
                              ? "bg-emerald-50 border-emerald-200 text-emerald-700 font-bold" 
                              : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                          )}
                        >
                          <div className={cn("w-2.5 h-2.5 rounded border flex items-center justify-center transition-colors", 
                            formData.selectedCategoryIds.includes(sub.id) 
                              ? "bg-emerald-600 border-emerald-600" 
                              : "border-slate-300 bg-white"
                          )}>
                            {formData.selectedCategoryIds.includes(sub.id) && <Check className="w-2 h-2 text-white" />}
                          </div>
                          {sub.name}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </SidebarSection>
        </TabsContent>

        {/* Tab 2: الوحدات */}
        <TabsContent value="units" className="space-y-4">
          {/* الوحدات الافتراضية */}
          <SidebarSection title="البيانات الافتراضية للوحدات" defaultOpen={true}>
            <div className="grid grid-cols-2 gap-4 text-right">
              <div className="space-y-2">
                <FieldLabel>وحدة الشراء الافتراضية</FieldLabel>
                <Select value={formData.default_purchase_unit_id} onValueChange={v => setFormData({ ...formData, default_purchase_unit_id: v })}>
                  <SelectTrigger className="w-full bg-white border-slate-200"><SelectValue placeholder="اختر وحدة" /></SelectTrigger>
                  <SelectContent>
                    {formData.units.map((u, i) => (
                      <SelectItem key={i} value={material ? (material.units[i]?.id || u.name) : u.name}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <FieldLabel>وحدة البيع الافتراضية</FieldLabel>
                <Select value={formData.default_sale_unit_id} onValueChange={v => setFormData({ ...formData, default_sale_unit_id: v })}>
                  <SelectTrigger className="w-full bg-white border-slate-200"><SelectValue placeholder="اختر وحدة" /></SelectTrigger>
                  <SelectContent>
                    {formData.units.map((u, i) => (
                      <SelectItem key={i} value={material ? (material.units[i]?.id || u.name) : u.name}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </SidebarSection>

          {/* إدارة الوحدات */}
          <div className="flex items-center justify-between border-b pb-2 pt-2">
            <div className="space-y-0.5 text-right">
              <h3 className="text-sm font-bold text-slate-800">إدارة الوحدات</h3>
              <p className="text-[10px] text-slate-400 italic">عرّف وحدات البيع والشراء لهذه المادة.</p>
            </div>
            {!material && (
              <Button type="button" size="sm" onClick={addUnit} className="bg-blue-600 hover:bg-blue-700 gap-1.5 h-8 text-xs font-bold rounded-lg shadow-sm"><Plus className="w-3.5 h-3.5" /> إضافة وحدة</Button>
            )}
          </div>

          <div className="space-y-3">
            {formData.units.map((unit, idx) => (
              <div key={idx} className={cn(
                "p-4 rounded-2xl border relative transition-all shadow-sm space-y-3 text-right bg-white",
                idx === 0 ? "border-blue-200 bg-blue-50/20" : "border-slate-200/80"
              )}>
                {idx > 0 && !material && (
                  <Button 
                    type="button"
                    variant="ghost" 
                    size="icon" 
                    onClick={() => removeUnit(idx)}
                    className="absolute -left-2 -top-2 h-7 w-7 rounded-full bg-red-50 text-red-500 hover:bg-red-100 border border-red-100 shadow-sm z-10"
                  >
                    <Plus className="w-3.5 h-3.5 rotate-45" />
                  </Button>
                )}
                
                <div className="flex items-center gap-3">
                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", idx === 0 ? "bg-blue-600 text-white shadow-md shadow-blue-200" : "bg-slate-100 text-slate-500")}>
                    {idx === 0 ? <Package className="w-4 h-4" /> : <Boxes className="w-4 h-4" />}
                  </div>
                  <div className="flex-1">
                    <FieldLabel className="text-[10px] font-bold text-slate-500 block mb-1">اسم الوحدة {idx === 0 && <span className="text-blue-600 font-bold">(أساسية)</span>}</FieldLabel>
                    <Input value={unit.name} onChange={e => updateUnit(idx, "name", e.target.value)} className="h-8 font-bold bg-white" placeholder="مثلاً: قطعة" disabled={!!material} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <FieldLabel>معامل التعبئة</FieldLabel>
                    <Input type="number" value={unit.conversion_factor} onChange={e => updateUnit(idx, "conversion_factor", e.target.value)} className="h-8 font-mono bg-white" disabled={idx === 0 || !!material} min="0" step="any" />
                    {idx === 0 && <p className="text-[8px] text-blue-500 font-bold mt-0.5">دائماً 1 للوحدة الأساسية</p>}
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel>باركود الوحدة</FieldLabel>
                    <Input value={unit.barcode} onChange={e => updateUnit(idx, "barcode", e.target.value)} className="h-8 font-mono text-xs bg-white" placeholder="اختياري" dir="ltr" disabled={!!material} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-amber-50/55 border border-amber-100 p-3.5 rounded-2xl flex gap-3 text-right">
            <Shuffle className="w-4.5 h-4.5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-800 leading-relaxed font-semibold">
              <strong>تنبيه:</strong> الوحدة الأولى تعتبر <strong>الوحدة الأساسية</strong> للمستودعات. الوحدات الإضافية تُحسب كمعادلات تعادل كمية من الوحدة الأساسية (مثلاً: صندوق = 12 قطعة).
            </p>
          </div>
        </TabsContent>

        {/* Tab 3: الأسعار */}
        <TabsContent value="prices" className="space-y-4">
          {/* أسعار الشراء */}
          <SidebarSection title="أسعار الشراء حسب العملة" defaultOpen={true}>
            <div className="space-y-3">
              {formData.units.map((unit, uIdx) => (
                <div key={uIdx} className="p-3 border border-slate-200/80 rounded-2xl bg-white shadow-sm space-y-2 text-right">
                  <div className="border-b pb-1.5 flex justify-between items-center">
                    <span className="font-bold text-[11px] text-slate-700">شراء: <span className="text-blue-600">{unit.name || `وحدة ${uIdx+1}`}</span></span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {activeCurrencies.map(c => {
                      const field = c.is_base ? 'price' : 'price_base';
                      const sym = c.symbol || c.code;
                      return (
                        <div key={c.code} className="space-y-1">
                          <span className="text-[9px] font-bold text-slate-400 block">سعر الشراء ({sym})</span>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-500">{sym}</span>
                            <Input
                              type="number"
                              value={getPurchasePrice(uIdx, field as 'price' | 'price_base')}
                              onChange={e => updatePurchasePrice(uIdx, field, e.target.value)}
                              className="h-8 pl-6 font-bold text-center bg-white border-slate-200"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </SidebarSection>

          {/* أسعار المبيع */}
          <div className="flex items-center gap-2 pt-2 border-b pb-1.5 text-right">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-xs text-slate-800">أسعار المبيع ومستويات التسعير</h3>
          </div>

          <div className="space-y-3">
            {formData.units.map((unit, uIdx) => (
              <SidebarSection key={uIdx} title={`تسعير المبيع: ${unit.name || `وحدة ${uIdx+1}`}`} defaultOpen={uIdx === 0}>
                <div className="space-y-3">
                  {SALE_TIERS.map(tier => (
                    <div key={tier.id} className="p-3 border border-slate-100/60 rounded-xl bg-slate-50/50 space-y-2 text-right">
                      <div className="flex justify-between items-center border-b border-slate-200/40 pb-1">
                        <span className="font-black text-[10px] text-slate-700 bg-slate-200/50 px-2 py-0.5 rounded-md">{tier.label}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {/* سعر المبيع */}
                        <div className="space-y-1">
                          <span className="text-[8px] font-black text-slate-400 block uppercase">سعر المبيع</span>
                          <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${activeCurrencies.length}, 1fr)` }}>
                            {activeCurrencies.map(c => {
                              const field = c.is_base ? 'price' : 'price_base';
                              const sym = c.symbol || c.code;
                              return (
                                <div key={c.code} className="relative">
                                  <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[8px] font-bold text-slate-400">{sym}</span>
                                  <Input
                                    type="number"
                                    value={getSalePrice(uIdx, tier.id, field as 'price' | 'price_base')}
                                    onChange={e => updateSalePrice(uIdx, tier.id, field, e.target.value)}
                                    className="h-8 pl-4 text-xs font-bold text-center bg-white border-slate-200"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        {/* الحد الأدنى */}
                        <div className="space-y-1">
                          <span className="text-[8px] font-black text-amber-500 block uppercase">الحد الأدنى</span>
                          <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${activeCurrencies.length}, 1fr)` }}>
                            {activeCurrencies.map(c => {
                              const field = c.is_base ? 'min_price' : 'min_price_base';
                              const sym = c.symbol || c.code;
                              return (
                                <div key={c.code} className="relative">
                                  <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[8px] font-bold text-slate-400">{sym}</span>
                                  <Input
                                    type="number"
                                    value={getSalePrice(uIdx, tier.id, field as 'min_price' | 'min_price_base')}
                                    onChange={e => updateSalePrice(uIdx, tier.id, field, e.target.value)}
                                    className="h-8 pl-4 text-xs font-bold text-center bg-amber-50/15 border-amber-100 text-amber-800"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </SidebarSection>
            ))}
          </div>
        </TabsContent>

        {/* Tab 4: إضافي */}
        <TabsContent value="extra" className="space-y-4">
          <SidebarSection title="ملاحظات وتفاصيل أخرى" defaultOpen={true}>
            <div className="space-y-4 text-right">
              {/* ملاحظات */}
              <div className="space-y-2">
                <FieldLabel className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-slate-400" /> ملاحظات إضافية</FieldLabel>
                <Textarea 
                  value={formData.notes} 
                  onChange={e => setFormData({ ...formData, notes: e.target.value })} 
                  placeholder="أي تفاصيل أو مواصفات أخرى حول هذه المادة..." 
                  className="min-h-[100px] resize-none bg-white border-slate-200" 
                />
              </div>

              {/* الصورة */}
              <div className="space-y-2">
                <FieldLabel className="flex items-center gap-1.5"><ImageIcon className="w-3.5 h-3.5 text-slate-400" /> صورة المادة التعريفية</FieldLabel>
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="flex-1 h-9 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50/50 gap-2 text-xs font-bold"
                    onClick={() => document.getElementById('material-image-upload')?.click()}
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-blue-500" />
                    تحميل من الجهاز
                  </Button>
                  {formData.image_path && (
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="icon" 
                      className="h-9 w-9 text-red-500 hover:bg-red-50 border-red-200"
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
                <p className="text-[9px] text-slate-400 italic">رفع صورة يساعد الموظفين في تمييز الصنف بالعين أثناء عمليات البيع أو الجرد.</p>
              </div>

              {/* معاينة الصورة */}
              <div className="border border-dashed border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center text-center bg-slate-50/30 gap-2.5">
                <div className="w-24 h-24 rounded-2xl bg-white border border-slate-100 shadow-inner flex items-center justify-center overflow-hidden">
                  {formData.image_path ? (
                    <img src={formData.image_path} alt="Preview" className="w-full h-full object-contain animate-in zoom-in-75 duration-200" />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-slate-200" />
                  )}
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold text-slate-500">معاينة الصورة المرفقة</p>
                </div>
              </div>
            </div>
          </SidebarSection>
        </TabsContent>
      </Tabs>
    </FormPanel>
  );
}
