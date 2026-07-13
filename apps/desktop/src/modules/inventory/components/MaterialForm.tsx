import { useState, useEffect, useMemo, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@shared/ui/tabs";
import { Textarea } from "@shared/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@shared/ui/select";
import { Input } from "@shared/ui/input";
import { Button } from "@shared/ui/button";
import { FormPanel } from "@widgets/form-shell/FormPanel";
import { SidebarSection } from "@widgets/sidebar-shell/SidebarSection";
import { FieldLabel } from "@widgets/sidebar-shell/FieldLabel";
import { toast } from "sonner";
import { cn } from "@shared/lib/utils";
import { Plus, Edit, Hash, Barcode, Package, Layers, Shuffle, Check, Scale, Package2, FileText, Globe, Image as ImageIcon, DollarSign, Tag, TrendingUp, Search, ChevronDown, Warehouse } from "lucide-react";
import type { MaterialDto, CategoryDto, CreateMaterialRequest, UpdateMaterialRequest } from "@erp/shared-types";
import { materialCodeService } from "@modules/inventory/api/materialCodeService";
import { categoryService } from "@modules/inventory/api/categoryService";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { UnitCard } from './UnitCard';
import { AddUnitForm } from './AddUnitForm';

const DEFAULT_CATEGORY_NAME = "غير مصنف";

const SALE_TIERS = [
  { id: 'retail', label: 'مفرق' },
  { id: 'semi_wholesale', label: 'نصف جملة' },
  { id: 'wholesale', label: 'جملة' },
];

interface MaterialFormProps {
  open: boolean;
  onClose: () => void;
  material: MaterialDto | null;
  categories: CategoryDto[];
  onSave: (data: CreateMaterialRequest | UpdateMaterialRequest) => Promise<void>;
  saving: boolean;
  onCategoryCreated?: (category: CategoryDto) => void;
  warehouses?: { id: string; name: string }[];
}

type InlineCreateMode =
  | { type: "main" }
  | { type: "sub"; parentId: string; parentName: string }
  | null;

const EMPTY_FORM = {
  name: "",
  name_en: "",
  barcode: "",
  code: "",
  minimum_stock: "0",
  notes: "",
  image_path: "",
  default_purchase_unit_id: "قطعة",
  default_sale_unit_id: "قطعة",
  units: [
    { name: "قطعة", conversion_factor: "1", barcode: "" }
  ],
  selectedCategoryIds: [] as string[],
  purchase_prices: [] as { unit_id: string; price: string; price_base: string; currency: string }[],
  sale_prices: [] as { unit_id: string; tier: string; price: string; price_base: string; min_price: string; min_price_base: string; max_quantity: string; max_quantity_unit_id: string | null; currency: string }[],
  default_purchase_currency: "",
  default_sale_currency: "",
  default_warehouse_id: "",
  has_expiry: false,
  expiry_alert_before_days: 0,
};

export function MaterialForm({ open, onClose, material, categories, onSave, saving, onCategoryCreated, warehouses }: MaterialFormProps) {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [activeTab, setActiveTab] = useState("basic");
  const [inlineCreate, setInlineCreate] = useState<InlineCreateMode>(null);
  const [newCatName, setNewCatName] = useState("");
  const [newCatPrefix, setNewCatPrefix] = useState("");
  const [creatingSaving, setCreatingSaving] = useState(false);

  const [categorySearch, setCategorySearch] = useState("");
  const [expandedMains, setExpandedMains] = useState<Set<string>>(new Set());

  const [tierMaxQty, setTierMaxQty] = useState<Record<string, string>>({});
  const [tierMaxQtyUnit, setTierMaxQtyUnit] = useState<Record<string, string>>({});
  const [showUnitForm, setShowUnitForm] = useState(false);
  const [editingUnitIdx, setEditingUnitIdx] = useState<number | null>(null);
  const [editingUnitData, setEditingUnitData] = useState<{ name: string; conversion_factor: string; barcode: string } | null>(null);

  const { currencies, baseCurrency, rateMap } = useCurrencyContext();
  const activeCurrencies = useMemo(() => currencies.filter(c => c.is_active), [currencies]);
  const uncategorizedCat = useMemo(() => categories.find(c => c.name === DEFAULT_CATEGORY_NAME && !c.parent_id), [categories]);
  const mainCategories = useMemo(() => categories.filter(c => !c.parent_id && c.name !== DEFAULT_CATEGORY_NAME && !c.is_hybrid), [categories]);

  const suggestPrefix = useCallback(() => {
    const chars = "أبتثجحخدذرزسشصضطظعغفقكلمنهويABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const existingPrefixes = new Set(categories.map(c => c.code_prefix).filter(Boolean) as string[]);
    for (const ch of chars) {
      if (!existingPrefixes.has(ch)) return ch;
    }
    return "X";
  }, [categories]);

  const filteredMains = useMemo(() => {
    const q = categorySearch.trim().toLowerCase();
    if (!q) return mainCategories;
    return mainCategories.filter(main => {
      if (main.name.toLowerCase().includes(q)) return true;
      return categories.some(c => c.parent_id === main.id && c.name.toLowerCase().includes(q));
    });
  }, [categorySearch, mainCategories, categories]);

  const toggleMain = useCallback((id: string) => {
    setExpandedMains(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  useEffect(() => {
    if (filteredMains.length > 0) setExpandedMains(new Set(filteredMains.map(m => m.id)));
  }, [filteredMains]);

  const openInlineCreate = (mode: InlineCreateMode) => {
    setInlineCreate(mode);
    setNewCatName("");
    setNewCatPrefix(suggestPrefix());
  };

  const cancelInlineCreate = useCallback(() => {
    setInlineCreate(null);
    setNewCatName("");
    setNewCatPrefix("");
  }, []);

  const handleCreateMain = useCallback(async () => {
    if (!newCatName.trim()) { toast.error("اسم التصنيف مطلوب"); return; }
    const trimmed = newCatName.trim();
    if (categories.some(c => !c.parent_id && c.name === trimmed && c.name !== DEFAULT_CATEGORY_NAME)) {
      toast.error(`يوجد تصنيف أساسي بنفس الاسم «${trimmed}»`);
      return;
    }
    setCreatingSaving(true);
    try {
      const mainPrefix = newCatPrefix.trim().toUpperCase() || suggestPrefix();
      const main = await categoryService.createCategory({
        name: newCatName.trim(),
        parent_id: null,
        code_prefix: mainPrefix,
      });
      onCategoryCreated?.(main);

      // Pull the freshly-created sub from the backend (it was created server-side).
      const freshList = await categoryService.listCategories();
      const generalSub = freshList.find(
        (c) => c.parent_id === main.id && c.name === `${newCatName.trim()} عام`
      );

      if (generalSub) {
        onCategoryCreated?.(generalSub);
        setFormData((prev) => ({
          ...prev,
          selectedCategoryIds: [generalSub.id],
        }));
      }

      toast.success("تم إضافة التصنيف الرئيسي");
      cancelInlineCreate();
    } catch (e) {
      toast.error("فشل إنشاء التصنيف: " + e);
    } finally {
      setCreatingSaving(false);
    }
  }, [newCatName, newCatPrefix, suggestPrefix, onCategoryCreated, cancelInlineCreate, categories]);

  const handleCreateSub = useCallback(async (parentId: string) => {
    if (!newCatName.trim()) { toast.error("اسم التصنيف مطلوب"); return; }
    const trimmed = newCatName.trim();
    if (categories.some(c => c.parent_id === parentId && c.name === trimmed)) {
      toast.error(`يوجد تصنيف فرعي بنفس الاسم «${trimmed}» ضمن نفس التصنيف الأساسي`);
      return;
    }
    setCreatingSaving(true);
    try {
      const sub = await categoryService.createCategory({
        name: newCatName.trim(),
        parent_id: parentId,
        code_prefix: newCatPrefix.trim().toUpperCase() || null,
      });
      onCategoryCreated?.(sub);

      // Auto-select the new sub, replacing any existing sub in that parent's row.
      setFormData((prev) => {
        const next = prev.selectedCategoryIds.filter((id) => {
          const c = categories.find((cc) => cc.id === id);
          return c?.parent_id !== parentId;
        });
        return { ...prev, selectedCategoryIds: [...next, sub.id] };
      });

      toast.success("تم إضافة التصنيف الفرعي");
      cancelInlineCreate();
    } catch (e) {
      toast.error("فشل إنشاء التصنيف: " + e);
    } finally {
      setCreatingSaving(false);
    }
  }, [newCatName, newCatPrefix, categories, onCategoryCreated, cancelInlineCreate]);

  const submitInlineCreate = useCallback(() => {
    if (!inlineCreate) return;
    if (inlineCreate.type === "main") {
      void handleCreateMain();
    } else {
      void handleCreateSub(inlineCreate.parentId);
    }
  }, [inlineCreate, handleCreateMain, handleCreateSub]);

  useEffect(() => {
    if (open) {
      if (material) {
        setFormData({
          name: material.name,
          name_en: material.name_en || "",
          barcode: material.barcode || "",
          code: material.code || "",
          minimum_stock: material.minimum_stock,
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
            max_quantity: p.max_quantity || "0",
            max_quantity_unit_id: p.max_quantity_unit_id || null,
            currency: p.currency
          })),
          default_purchase_currency: material.default_purchase_currency || "",
          default_sale_currency: material.default_sale_currency || "",
          default_warehouse_id: material.default_warehouse_id || "",
          has_expiry: material.has_expiry ?? false,
          expiry_alert_before_days: material.expiry_alert_before_days ?? 0,
        });

        // Initialize tier max qty from existing data
        const baseUnit = material.units[0]?.name || 'قطعة';
        const newMaxQty: Record<string, string> = {};
        const newMaxUnit: Record<string, string> = {};
        for (const tier of ['retail', 'semi_wholesale']) {
          const sp = material.sale_prices.find(p => p.tier === tier);
          if (sp) {
            const baseVal = parseFloat(sp.max_quantity || "0") || 0;
            const unitName = sp.max_quantity_unit_id || baseUnit;
            const unit = material.units.find(u => u.name === unitName || u.id === unitName);
            const factor = unit ? parseFloat(unit.conversion_factor) : 1;
            newMaxQty[tier] = factor > 0 ? String(baseVal / factor) : String(baseVal);
            newMaxUnit[tier] = unitName;
          } else {
            newMaxQty[tier] = "0";
            newMaxUnit[tier] = baseUnit;
          }
        }
        setTierMaxQty(newMaxQty);
        setTierMaxQtyUnit(newMaxUnit);
      } else {
        setFormData({
          ...EMPTY_FORM,
          selectedCategoryIds: uncategorizedCat ? [uncategorizedCat.id] : [],
        });
        setTierMaxQty({ retail: "0", semi_wholesale: "0" });
        setTierMaxQtyUnit({ retail: "قطعة", semi_wholesale: "قطعة" });
      }
      setActiveTab("basic");
      cancelInlineCreate();
    }
  }, [open, material, uncategorizedCat, cancelInlineCreate]);

  // Sync default unit selections if units change
  useEffect(() => {
    if (!material && formData.units.length > 0) {
      setFormData(prev => ({
        ...prev,
        default_purchase_unit_id: prev.default_purchase_unit_id || prev.units[0].name || `وحدة 1`,
        default_sale_unit_id: prev.default_sale_unit_id || prev.units[0].name || `وحدة 1`,
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

  useEffect(() => {
    if (material) return;
    if (formData.selectedCategoryIds.length === 0) return;

    let cancelled = false;

    const preview = async () => {
      try {
        let code;
        if (formData.selectedCategoryIds.length > 1) {
          const prefixes = categories
            .filter(c => formData.selectedCategoryIds.includes(c.id))
            .map(c => c.code_prefix)
            .filter(Boolean) as string[];
          if (prefixes.length === 0) return;
          const hybridCat = await categoryService.getOrCreateHybridCategory(prefixes);
          code = await materialCodeService.previewCode(hybridCat.id);
        } else {
          code = await materialCodeService.previewCode(formData.selectedCategoryIds[0]);
        }
        if (!cancelled) setFormData(prev => ({ ...prev, code }));
      } catch { /* user can type manually */ }
    };

    preview();
    return () => { cancelled = true; };
  }, [formData.selectedCategoryIds, material, categories]);

  const handleSave = async () => {
    if (!formData.name.trim()) { toast.error("اسم المادة مطلوب"); return; }

    let finalCode = formData.code;

    // Reserve the sequence on save (preview didn't increment)
    if (!material && formData.selectedCategoryIds.length > 0) {
      try {
        if (formData.selectedCategoryIds.length > 1) {
          const prefixes = categories
            .filter(c => formData.selectedCategoryIds.includes(c.id))
            .map(c => c.code_prefix)
            .filter(Boolean) as string[];
          if (prefixes.length > 0) {
            const hybridCat = await categoryService.getOrCreateHybridCategory(prefixes);
            finalCode = await materialCodeService.generateCode(hybridCat.id);
          }
        } else {
          finalCode = await materialCodeService.generateCode(formData.selectedCategoryIds[0]);
        }
      } catch { /* save without code */ }
    }

    // Write tier max quantities into sale_prices (in base units)
    let finalSalePrices = [...formData.sale_prices];

    // Ensure at least one entry per tier carries the max_quantity
    for (const tier of ['retail', 'semi_wholesale']) {
      const hasEntry = finalSalePrices.some(p => p.tier === tier);
      if (!hasEntry && activeCurrencies.length > 0) {
        const firstUnitId = formData.units[0]?.name || 'قطعة';
        finalSalePrices.push({
          unit_id: firstUnitId,
          tier,
          currency: activeCurrencies[0].code,
          price: "0",
          price_base: "0",
          min_price: "0",
          min_price_base: "0",
          max_quantity: getTierBaseMaxQty(tier),
          max_quantity_unit_id: null,
        });
      }
    }

    // Convert to base units and clear unit reference
    finalSalePrices = finalSalePrices.map(p => {
      const baseMaxQty = ['retail', 'semi_wholesale'].includes(p.tier)
        ? getTierBaseMaxQty(p.tier)
        : "0";
      return {
        ...p,
        max_quantity: baseMaxQty,
        max_quantity_unit_id: null,
      };
    });

    await onSave({
      ...formData,
      sale_prices: finalSalePrices,
      code: finalCode,
      id: material?.id,
      category_ids: formData.selectedCategoryIds,
    });
  };

  const addUnit = (unit?: { name: string; conversion_factor: string; barcode: string }) => {
    setFormData(prev => ({
      ...prev,
      units: [...prev.units, unit || { name: `وحدة ${prev.units.length + 1}`, conversion_factor: "1", barcode: "" }]
    }));
  };

  const removeUnit = (index: number) => {
    if (formData.units.length <= 1) return;
    setFormData(prev => ({
      ...prev,
      units: prev.units.filter((_, i) => i !== index)
    }));
  };

  const handleEditUnit = (idx: number) => {
    const u = formData.units[idx];
    setEditingUnitIdx(idx);
    setEditingUnitData({ name: u.name, conversion_factor: u.conversion_factor, barcode: u.barcode });
  };

  const handleCancelEdit = () => {
    if (editingUnitIdx !== null && editingUnitData) {
      setFormData(prev => {
        const next = [...prev.units];
        next[editingUnitIdx] = { ...editingUnitData };
        return { ...prev, units: next };
      });
    }
    setEditingUnitIdx(null);
    setEditingUnitData(null);
  };

  const formatPrice = (n: number) => {
    const s = n.toFixed(2);
    return parseFloat(s).toString();
  };

  const getPurchaseRate = (currencyCode: string) => {
    if (!baseCurrency || !currencyCode || currencyCode === baseCurrency.code) return 1;
    return rateMap.get(currencyCode) || 1;
  };

  const resolveUnitId = (unitIdx: number) => {
    const u = formData.units[unitIdx];
    if (!u) return '';
    return material && material.units[unitIdx] ? material.units[unitIdx].id : u.name;
  };

  const getPurchasePrice = (unitIdx: number, currencyCode: string) => {
    const unitId = resolveUnitId(unitIdx);
    return formData.purchase_prices.find(p => p.unit_id === unitId && p.currency === currencyCode)?.price || "0";
  };

  const handlePurchasePriceChange = (unitIdx: number, currencyCode: string, value: string) => {
    setFormData(prev => {
      const unit = prev.units[unitIdx];
      const unitId = material && material.units[unitIdx] ? material.units[unitIdx].id : unit.name;
      const sourceRate = getPurchaseRate(currencyCode);
      const sourcePrice = parseFloat(value || "0") || 0;
      const baseValue = sourceRate > 0 ? sourcePrice / sourceRate : 0;

      const updatedPrices = activeCurrencies.map(c => {
        const rate = getPurchaseRate(c.code);
        return {
          unit_id: unitId,
          currency: c.code,
          price: formatPrice(baseValue * rate),
          price_base: formatPrice(baseValue),
        };
      });

      const inactivePrices = prev.purchase_prices.filter(
        p => p.unit_id !== unitId || !activeCurrencies.some(c => c.code === p.currency)
      );

      return { ...prev, purchase_prices: [...inactivePrices, ...updatedPrices] };
    });
  };

  const getSalePrice = (unitIdx: number, tier: string, currencyCode: string) => {
    const unitId = resolveUnitId(unitIdx);
    return formData.sale_prices.find(p => p.unit_id === unitId && p.tier === tier && p.currency === currencyCode)?.price || "0";
  };

  const getSaleMinPrice = (unitIdx: number, tier: string, currencyCode: string) => {
    const unitId = resolveUnitId(unitIdx);
    return formData.sale_prices.find(p => p.unit_id === unitId && p.tier === tier && p.currency === currencyCode)?.min_price || "0";
  };

  const getTierUnitFactor = (tier: string): number => {
    const unitName = tierMaxQtyUnit[tier] || formData.units[0]?.name || 'قطعة';
    const unit = formData.units.find(u => u.name === unitName);
    const factor = unit ? parseFloat(unit.conversion_factor) : 1;
    return factor > 0 ? factor : 1;
  };

  const getTierBaseMaxQty = (tier: string): string => {
    const val = parseFloat(tierMaxQty[tier] || "0") || 0;
    const factor = getTierUnitFactor(tier);
    return String(val * factor);
  };

  const getSaleMaxQuantity = (tier: string) => {
    return tierMaxQty[tier] || "0";
  };

  const handleMaxQuantityChange = (tier: string, value: string) => {
    setTierMaxQty(prev => ({ ...prev, [tier]: value }));
  };

  const handleTierQtyUnitChange = (tier: string, unitName: string) => {
    setTierMaxQtyUnit(prev => ({ ...prev, [tier]: unitName }));
  };

  const handleSalePriceChange = (unitIdx: number, tier: string, currencyCode: string, field: 'price' | 'min_price', value: string) => {
    setFormData(prev => {
      const unit = prev.units[unitIdx];
      const unitId = material && material.units[unitIdx] ? material.units[unitIdx].id : unit.name;

      const sourceRate = getPurchaseRate(currencyCode);
      const sourcePrice = parseFloat(value || "0") || 0;
      const baseValue = sourceRate > 0 ? sourcePrice / sourceRate : 0;

      const updatedPrices = activeCurrencies.map(c => {
        const rate = getPurchaseRate(c.code);
        const priceVal = formatPrice(baseValue * rate);
        const baseVal = formatPrice(baseValue);

        const existing = prev.sale_prices.find(
          p => p.unit_id === unitId && p.tier === tier && p.currency === c.code
        );

        if (field === 'price') {
          return {
            unit_id: unitId,
            tier,
            currency: c.code,
            price: priceVal,
            price_base: baseVal,
            min_price: existing?.min_price || "0",
            min_price_base: existing?.min_price_base || "0",
            max_quantity: existing?.max_quantity || "0",
            max_quantity_unit_id: existing?.max_quantity_unit_id || null,
          };
        }

        return {
          unit_id: unitId,
          tier,
          currency: c.code,
          price: existing?.price || "0",
          price_base: existing?.price_base || "0",
          min_price: priceVal,
          min_price_base: baseVal,
          max_quantity: existing?.max_quantity || "0",
          max_quantity_unit_id: existing?.max_quantity_unit_id || null,
        };
      });

      const inactivePrices = prev.sale_prices.filter(
        p => p.unit_id !== unitId || p.tier !== tier || !activeCurrencies.some(c => c.code === p.currency)
      );

      return { ...prev, sale_prices: [...inactivePrices, ...updatedPrices] };
    });
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
        <TabsContent value="basic" className="space-y-3">
          <SidebarSection icon={<Package className="w-3.5 h-3.5" />} title="البيانات الأساسية" defaultOpen={true}>
            <div className="space-y-2.5 text-right">
              {/* اسم المادة عربي + إنجليزي */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <FieldLabel className="flex items-center gap-1.5" required><Tag className="w-3.5 h-3.5 text-slate-400" /> اسم المادة (عربي)</FieldLabel>
                  <Input 
                    value={formData.name} 
                    onChange={e => setFormData({ ...formData, name: e.target.value })} 
                    placeholder="مثال: سكر ناعم" 
                    className="bg-white border-slate-200 h-9" 
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 text-slate-400" /> الاسم (English)</FieldLabel>
                  <Input 
                    value={formData.name_en} 
                    onChange={e => setFormData({ ...formData, name_en: e.target.value })} 
                    placeholder="Example: Fine Sugar" 
                    className="bg-white border-slate-200 h-9" 
                    dir="ltr" 
                  />
                </div>
              </div>

              {/* الكود والباركود */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <FieldLabel className="flex items-center gap-1.5"><Hash className="w-3.5 h-3.5 text-slate-400" /> الكود</FieldLabel>
                  <Input 
                    value={formData.code} 
                    onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })} 
                    className="font-mono text-xs bg-white border-slate-200 h-9" 
                    placeholder="الكود" 
                    dir="ltr" 
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel className="flex items-center gap-1.5"><Barcode className="w-3.5 h-3.5 text-slate-400" /> الباركود العام</FieldLabel>
                  <Input 
                    value={formData.barcode} 
                    onChange={e => setFormData({ ...formData, barcode: e.target.value })} 
                    className="font-mono text-xs bg-white border-slate-200 h-9" 
                    placeholder="الباركود" 
                    dir="ltr" 
                  />
                </div>
              </div>
              
              {/* حد الطلب + ملاحظات */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <FieldLabel className="flex items-center gap-1.5"><Package className="w-3.5 h-3.5 text-slate-400" /> حد الطلب</FieldLabel>
                  <Input 
                    type="number" 
                    value={formData.minimum_stock} 
                    onChange={e => setFormData({ ...formData, minimum_stock: e.target.value })} 
                    className="bg-white border-slate-200 h-9" 
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-slate-400" /> ملاحظات</FieldLabel>
                  <Textarea 
                    value={formData.notes} 
                    onChange={e => setFormData({ ...formData, notes: e.target.value })} 
                    placeholder="أي تفاصيل أو مواصفات أخرى..." 
                    className="min-h-[72px] resize-none bg-white border-slate-200 text-xs" 
                  />
                </div>
              </div>
            </div>
          </SidebarSection>

          {/* تصنيف المادة */}
          <SidebarSection icon={<Layers className="w-3.5 h-3.5" />} title="تصنيف المادة" defaultOpen={true}>
            <div className="space-y-2">
              {/* Search */}
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <Input
                  placeholder="بحث عن تصنيف..."
                  value={categorySearch}
                  onChange={e => setCategorySearch(e.target.value)}
                  className="pr-9 h-8 text-xs bg-white border-slate-200"
                />
              </div>

              <div className="border border-slate-200/70 rounded-xl overflow-hidden bg-white shadow-sm">
                {/* Header */}
                <div className="bg-slate-50 px-3 py-2 border-b text-[10px] font-black text-slate-400 grid grid-cols-[1fr_1fr_28px] gap-2 items-center">
                  <div>التصنيف الرئيسي</div>
                  <div>التصنيفات الفرعية</div>
                  <div></div>
                </div>

                {/* Content */}
                <div className="divide-y divide-slate-100 text-right">
                  {uncategorizedCat && (!categorySearch.trim() || uncategorizedCat.name.includes(categorySearch.trim())) && (
                    <div className="grid grid-cols-[1fr_1fr_28px] items-center min-h-[36px] hover:bg-slate-50/50">
                      <div className="px-3 py-1.5 font-black text-blue-600 text-xs italic">غير مصنف</div>
                      <div className="px-3 py-1.5">
                        <div
                          onClick={() => handleCategoryToggle(uncategorizedCat.id, true)}
                          className={cn("inline-flex items-center justify-center gap-2 px-3 py-1 rounded-xl border cursor-pointer text-[10px] transition-all",
                            formData.selectedCategoryIds.includes(uncategorizedCat.id)
                              ? "bg-blue-50 border-blue-200 text-blue-700 font-bold"
                              : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                          )}
                        >
                          افتراضي
                        </div>
                      </div>
                      <div></div>
                    </div>
                  )}

                  {filteredMains.map(main => {
                    const isExpanded = expandedMains.has(main.id);
                    const subs = categories.filter(c => c.parent_id === main.id);
                    const q = categorySearch.trim().toLowerCase();
                    const visibleSubs = q ? subs.filter(s => s.name.toLowerCase().includes(q)) : subs;

                    return (
                      <div key={main.id} className="group">
                        {/* Main category row */}
                        <div
                          onClick={() => toggleMain(main.id)}
                          className="grid grid-cols-[1fr_1fr_28px] items-center min-h-[36px] hover:bg-slate-50/50 cursor-pointer select-none"
                        >
                          <div className="px-3 py-1.5 font-bold text-slate-700 text-xs flex items-center gap-1.5">
                            <ChevronDown className={cn("w-3 h-3 text-slate-400 transition-transform duration-200", !isExpanded && "-rotate-90")} />
                            {main.name}
                          </div>
                          <div className="px-3 py-1.5">
                            {isExpanded ? (
                              <div className="flex flex-wrap gap-1">
                                {visibleSubs.map(sub => (
                                  <div
                                    key={sub.id}
                                    onClick={(e) => { e.stopPropagation(); handleCategoryToggle(sub.id, false, main.id); }}
                                    className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border cursor-pointer text-[9px] transition-all",
                                      formData.selectedCategoryIds.includes(sub.id)
                                        ? "bg-emerald-50 border-emerald-200 text-emerald-700 font-bold"
                                        : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                                    )}
                                  >
                                    <div className={cn("w-2 h-2 rounded-sm border flex items-center justify-center transition-colors",
                                      formData.selectedCategoryIds.includes(sub.id)
                                        ? "bg-emerald-600 border-emerald-600"
                                        : "border-slate-300 bg-white"
                                    )}>
                                      {formData.selectedCategoryIds.includes(sub.id) && <Check className="w-1.5 h-1.5 text-white" />}
                                    </div>
                                    {sub.name}
                                  </div>
                                ))}
                                {visibleSubs.length === 0 && (
                                  <span className="text-[9px] text-slate-400 italic">لا توجد تصنيفات فرعية</span>
                                )}
                              </div>
                            ) : (
                              <div className="text-[9px] text-slate-400 italic flex items-center gap-1">
                                <span>{subs.length}</span>
                                {subs.length === 1 ? 'تصنيف فرعي' : 'تصنيفات فرعية'}
                              </div>
                            )}
                          </div>
                          <div className="pl-1 flex items-center justify-center">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); openInlineCreate({ type: "sub", parentId: main.id, parentName: main.name }); }}
                              title={`إضافة تصنيف فرعي لـ ${main.name}`}
                              className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-lg border border-dashed border-slate-300 text-slate-400 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 flex items-center justify-center transition-all"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* "Add main" trigger row */}
                  <div className="bg-slate-50/50 px-3 py-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => openInlineCreate({ type: "main" })}
                      className="w-full h-7 text-[10px] font-bold gap-1 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <Plus className="w-3 h-3" /> إضافة تصنيف رئيسي
                    </Button>
                  </div>
                </div>

                {/* Inline create form */}
                {inlineCreate && (
                  <div className="border-t-2 border-blue-200 bg-blue-50/60 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-black text-blue-800 flex items-center gap-1.5">
                        {inlineCreate.type === "main" ? (
                          <><Plus className="w-3.5 h-3.5" /> تصنيف رئيسي جديد</>
                        ) : (
                          <><Plus className="w-3.5 h-3.5" /> تصنيف فرعي جديد تحت: <span className="text-blue-600">{inlineCreate.parentName}</span></>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-[1fr_60px] gap-2">
                      <Input autoFocus placeholder="اسم التصنيف" value={newCatName}
                        onChange={e => setNewCatName(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); submitInlineCreate(); } }}
                        className="h-8 text-xs bg-white border-slate-200" />
                      <Input placeholder="A" value={newCatPrefix}
                        onChange={e => setNewCatPrefix(e.target.value.slice(0, 1).toUpperCase())}
                        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); submitInlineCreate(); } }}
                        className="h-8 text-xs font-mono text-center bg-white border-slate-200" maxLength={1} dir="ltr" title="بادئة الكود (حرف واحد)" />
                    </div>
                    <p className="text-[9px] text-slate-500 leading-relaxed">
                      {inlineCreate.type === "main"
                        ? "سيُنشأ أيضاً تصنيف فرعي افتراضي «عام» ويُحدَّد تلقائياً."
                        : "سيتم تحديد التصنيف الفرعي الجديد تلقائياً للمادة."}
                    </p>
                    <div className="flex items-center gap-2 justify-end">
                      <Button type="button" size="sm" variant="ghost" onClick={cancelInlineCreate} disabled={creatingSaving} className="h-7 text-[10px] font-bold">إلغاء</Button>
                      <Button type="button" size="sm" onClick={submitInlineCreate} disabled={creatingSaving || !newCatName.trim()} className="h-7 text-[10px] font-bold bg-blue-600 hover:bg-blue-700">
                        {creatingSaving ? "جاري الحفظ..." : "حفظ التصنيف"}
                      </Button>
                    </div>
                  </div>
                )}
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
                    {formData.units.map((u, i) => {
                      const unitLabel = u.name || `وحدة ${i + 1}`;
                      return (
                        <SelectItem key={unitLabel} value={material ? (material.units[i]?.id || unitLabel) : unitLabel}>{unitLabel}</SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <FieldLabel>وحدة البيع الافتراضية</FieldLabel>
                <Select value={formData.default_sale_unit_id} onValueChange={v => setFormData({ ...formData, default_sale_unit_id: v })}>
                  <SelectTrigger className="w-full bg-white border-slate-200"><SelectValue placeholder="اختر وحدة" /></SelectTrigger>
                  <SelectContent>
                    {formData.units.map((u, i) => {
                      const unitLabel = u.name || `وحدة ${i + 1}`;
                      return (
                        <SelectItem key={unitLabel} value={material ? (material.units[i]?.id || unitLabel) : unitLabel}>{unitLabel}</SelectItem>
                      );
                    })}
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
            <Button type="button" size="sm" onClick={() => setShowUnitForm(true)} className="bg-blue-600 hover:bg-blue-700 gap-1.5 h-8 text-xs font-bold rounded-lg shadow-sm"><Plus className="w-3.5 h-3.5" /> إضافة وحدة</Button>
          </div>

          <div className="space-y-3">
            {formData.units.map((unit, idx) => {
              const isEditing = editingUnitIdx === idx;
              return (
                <UnitCard
                  key={`${idx}-${isEditing ? 'edit' : 'view'}`}
                  mode={isEditing ? "edit" : "view"}
                  unit={isEditing && editingUnitData ? editingUnitData : unit}
                  isBase={idx === 0}
                  baseUnitName={formData.units[0]?.name}
                  onUpdate={isEditing ? (field, value) => setEditingUnitData(prev => prev ? { ...prev, [field]: value } : prev) : undefined}
                  onEdit={isEditing ? undefined : () => handleEditUnit(idx)}
                  onCancelEdit={isEditing ? handleCancelEdit : undefined}
                  onDelete={idx > 0 ? () => removeUnit(idx) : undefined}
                  defaultCollapsed={!isEditing}
                />
              );
            })}

            {showUnitForm && (
              <AddUnitForm
                baseUnitName={formData.units[0]?.name || "قطعة"}
                materialName={formData.name || "..."}
                existingNames={formData.units.map(u => u.name)}
                onAdd={async (unit) => { addUnit(unit); }}
                onCancel={() => setShowUnitForm(false)}
              />
            )}
          </div>

          <div className="bg-amber-50/55 border border-amber-100 p-3.5 rounded-2xl flex gap-3 text-right">
            <Shuffle className="w-4.5 h-4.5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-800 leading-relaxed font-semibold">
              <strong>تنبيه:</strong> الوحدة الأولى تعتبر <strong>الوحدة الأساسية</strong> للمستودعات. الوحدات الإضافية تُحسب كمعادلات تعادل كمية من الوحدة الأساسية (مثلاً: دزينة = 12 قطعة).
            </p>
          </div>
        </TabsContent>

        {/* Tab 3: الأسعار */}
        <TabsContent value="prices" className="space-y-4">
          {/* أسعار الشراء */}
          <SidebarSection title="أسعار الشراء" defaultOpen={true}>
            <div className="space-y-3">
              {formData.units.map((unit, uIdx) => (
                <div key={uIdx} className="p-3 border border-slate-200/80 rounded-2xl bg-white shadow-sm space-y-2 text-right">
                  <div className="border-b pb-1.5 flex justify-between items-center">
                    <span className="font-bold text-[11px] text-slate-700">شراء: <span className="text-blue-600">{unit.name || `وحدة ${uIdx+1}`}</span></span>
                  </div>
                  <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${activeCurrencies.length}, 1fr)` }}>
                    {activeCurrencies.map(c => {
                      const sym = c.symbol || c.code;
                      return (
                        <div key={c.code} className="relative">
                          <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[8px] font-bold text-slate-400">{sym}</span>
                          <Input
                            type="number"
                            value={getPurchasePrice(uIdx, c.code)}
                            onChange={e => handlePurchasePriceChange(uIdx, c.code, e.target.value)}
                            className="h-8 pl-4 text-xs font-bold text-center bg-white border-slate-200"
                          />
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[9px] text-slate-500 leading-relaxed">
                    يُحفظ لكل وحدة سعر شراء بكل عملة مع التحديث التلقائي لبقية العملات عند تغيير أي سعر.
                  </p>
                </div>
              ))}
            </div>
          </SidebarSection>

          {/* أسعار المبيع */}
          <div className="flex items-center gap-2 pt-2 border-b pb-1.5 text-right">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-xs text-slate-800">أسعار المبيع ومستويات التسعير</h3>
          </div>

          {/* الحد الأعلى للكمية لكل مستوى (على مستوى المادة) */}
          <div className="bg-purple-50/40 border border-purple-100/70 rounded-xl p-3 space-y-2">
            <span className="text-[8px] font-black text-purple-600 block uppercase">الحد الأعلى للكمية</span>
            <div className="flex items-center gap-4 flex-wrap">
              {SALE_TIERS.filter(t => t.id !== 'wholesale').map(tier => (
                <div key={tier.id} className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-600 whitespace-nowrap">{tier.label}:</span>
                  <Input
                    type="number"
                    min="0"
                    value={getSaleMaxQuantity(tier.id)}
                    onChange={e => handleMaxQuantityChange(tier.id, e.target.value)}
                    className="h-7 w-16 text-xs font-bold text-center bg-white border-slate-200"
                  />
                  <Select
                    value={tierMaxQtyUnit[tier.id] || formData.units[0]?.name || 'قطعة'}
                    onValueChange={v => handleTierQtyUnitChange(tier.id, v)}
                  >
                    <SelectTrigger className="h-7 w-20 text-[9px] font-bold border-slate-200 px-1.5 gap-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {formData.units.map((u, i) => (
                        <SelectItem key={i} value={u.name || `وحدة ${i + 1}`}>
                          {u.name || `وحدة ${i + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-600 whitespace-nowrap">جملة:</span>
                <span className="text-[9px] text-slate-400 italic font-medium">غير محدود</span>
              </div>
            </div>
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
                              const sym = c.symbol || c.code;
                              return (
                                <div key={c.code} className="relative">
                                  <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[8px] font-bold text-slate-400">{sym}</span>
                                  <Input
                                    type="number"
                                    value={getSalePrice(uIdx, tier.id, c.code)}
                                    onChange={e => handleSalePriceChange(uIdx, tier.id, c.code, 'price', e.target.value)}
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
                              const sym = c.symbol || c.code;
                              return (
                                <div key={c.code} className="relative">
                                  <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[8px] font-bold text-slate-400">{sym}</span>
                                  <Input
                                    type="number"
                                    value={getSaleMinPrice(uIdx, tier.id, c.code)}
                                    onChange={e => handleSalePriceChange(uIdx, tier.id, c.code, 'min_price', e.target.value)}
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
        <TabsContent value="extra" className="space-y-3">
          <SidebarSection icon={<ImageIcon className="w-3.5 h-3.5" />} title="صورة المادة" defaultOpen={true}>
            <div className="space-y-3 text-right">
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

              <div className="border-t border-slate-100 pt-3 mt-3" />

              <div className="space-y-1.5">
                <FieldLabel className="flex items-center gap-1.5"><Warehouse className="w-3.5 h-3.5 text-slate-400" /> المستودع الافتراضي</FieldLabel>
                <Select value={formData.default_warehouse_id} onValueChange={v => setFormData({ ...formData, default_warehouse_id: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="بدون مستودع افتراضي" /></SelectTrigger>
                  <SelectContent>
                    {warehouses?.map(w => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${formData.has_expiry ? 'bg-amber-500 border-amber-500' : 'border-slate-300'}`}
                      onClick={() => setFormData({ ...formData, has_expiry: !formData.has_expiry })}
                    >
                      {formData.has_expiry && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className="text-xs font-medium text-slate-700">له صلاحية (تاريخ انتهاء)</span>
                  </label>
                </div>

                {formData.has_expiry && (
                  <div className="space-y-1.5 pr-6">
                    <FieldLabel className="flex items-center gap-1.5 text-[11px]"><span className="text-slate-400">التنبيه قبل انتهاء الصلاحية بـ (أيام)</span></FieldLabel>
                    <Input
                      type="number"
                      min="0"
                      value={formData.expiry_alert_before_days}
                      onChange={e => setFormData({ ...formData, expiry_alert_before_days: parseInt(e.target.value) || 0 })}
                      className="h-7 text-xs"
                    />
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 pt-3 mt-1" />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <FieldLabel className="flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5 text-slate-400" /> عملة الشراء الافتراضية</FieldLabel>
                  <Select value={formData.default_purchase_currency} onValueChange={v => setFormData({ ...formData, default_purchase_currency: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="تلقائي" /></SelectTrigger>
                    <SelectContent>
                      {activeCurrencies?.map(c => (
                        <SelectItem key={c.code} value={c.code}>{c.symbol || c.code}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <FieldLabel className="flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5 text-slate-400" /> عملة البيع الافتراضية</FieldLabel>
                  <Select value={formData.default_sale_currency} onValueChange={v => setFormData({ ...formData, default_sale_currency: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="تلقائي" /></SelectTrigger>
                    <SelectContent>
                      {activeCurrencies?.map(c => (
                        <SelectItem key={c.code} value={c.code}>{c.symbol || c.code}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </SidebarSection>
        </TabsContent>
      </Tabs>
    </FormPanel>
  );
}
