import React, { useState, useEffect, useMemo, useCallback } from "react";
import { FormPanel } from "@widgets/form-shell/FormPanel";
import { FieldLabel } from "@widgets/sidebar-shell/FieldLabel";
import { SidebarSection } from "@widgets/sidebar-shell/SidebarSection";
import { Input } from "@shared/ui/input";
import { Textarea } from "@shared/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shared/ui/select";
import {
  Building2,
  Wrench,
  Armchair,
  Landmark,
  BadgeDollarSign,
  FileText,
} from "lucide-react";
import { accountingService } from "@modules/accounting/api/accountingService";
import { warehouseService } from "@modules/inventory/api/warehouseService";
import { fixedAssetService } from "../api/fixedAssetService";
import type {
  AssetCategoryDto,
  AccountDto,
  CurrencyDto,
  WarehouseDto,
  FixedAssetDto,
  CreateFixedAssetRequest,
} from "@erp/shared-types";
import { SYSTEM_ACCOUNT_IDS } from "@erp/shared-types";
import { toast } from "sonner";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { getExchangeRate } from "@shared/lib/currency-strategy";
import { useCompanyCapabilities } from "@shared/hooks";
import {
  detectFixedAssetTypeFromName,
  FIXED_ASSET_TYPE_LABELS,
  type FixedAssetType,
} from "@shared/tree/fixedAssetTypes";

interface FixedAssetFormProps {
  onClose: () => void;
  onSaved: () => void;
  currencies: CurrencyDto[];
  asset?: FixedAssetDto;
  initialCategoryId?: string;
  /** Fixed-asset subtype implied by the selected COA account; locks the field. */
  initialAssetType?: FixedAssetType;
}

// ===== Constants =====
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  buildings_land: <Landmark className="w-4 h-4" />,
  automotive: <Wrench className="w-4 h-4" />,
  equipment: <Wrench className="w-4 h-4" />,
  furniture: <Armchair className="w-4 h-4" />,
  default: <Building2 className="w-4 h-4" />,
};

function getAssetTypeIcon(type: string): React.ReactNode {
  return CATEGORY_ICONS[type] || CATEGORY_ICONS.default;
}

// ===== Reusable FormField wrapper =====
function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <FieldLabel required={required}>{label}</FieldLabel>
      {children}
    </div>
  );
}

// ===== Main Form =====
export function FixedAssetForm({
  onClose,
  onSaved,
  currencies,
  asset,
  initialCategoryId,
  initialAssetType,
}: FixedAssetFormProps) {
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<AssetCategoryDto[]>([]);
  const [accounts, setAccounts] = useState<AccountDto[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseDto[]>([]);
  const { rateMap, baseCurrency } = useCurrencyContext();
  const { canAccessOpeningWorkflow } = useCompanyCapabilities();

  const isEditing = !!asset;

  // --- Mode ---
  // While an existing company is still in its opening-preparation window the
  // form only adds previous assets (أول المدة): the mode follows the lifecycle,
  // no choice is offered. Once the company is ACTIVE (or for a NEW company)
  // the natural purchase workflow applies instead.
  const [additionType, setAdditionType] = useState<"new" | "existing">(
    canAccessOpeningWorkflow ? "existing" : "new",
  );

  useEffect(() => {
    setAdditionType(canAccessOpeningWorkflow ? "existing" : "new");
  }, [canAccessOpeningWorkflow]);

  // --- Basic info ---
  const code = asset?.code ?? "";
  const [name, setName] = useState(asset?.name ?? "");
  const [assetType, setAssetType] = useState<FixedAssetType | "">("");
  const isTypeLocked = !!initialAssetType && !isEditing;
  const displayAssetType: FixedAssetType | "" = assetType || initialAssetType || "";
  const [categoryId, setCategoryId] = useState(asset?.category_id ?? "");
  const [warehouseId, setWarehouseId] = useState<string | undefined>(asset?.warehouse_id ?? undefined);
  const [location, setLocation] = useState(asset?.location ?? "");
  const [notes, setNotes] = useState(asset?.notes ?? "");

  // --- Purchase ---
  const [purchaseDate, setPurchaseDate] = useState(
    asset ? asset.purchase_date.split("T")[0] : new Date().toLocaleDateString("en-CA")
  );
  const [purchaseCost, setPurchaseCost] = useState(asset?.purchase_cost?.amount ?? "");
  const [currency, setCurrency] = useState(asset?.purchase_cost?.currency?.code ?? "");
  const [fxRate, setFxRate] = useState(asset?.fx_rate ?? "1");

  // --- Derived state ---
  const isNonDepreciable = useMemo(() => {
    return assetType === "buildings_land";
  }, [assetType]);

  const activeWarehouses = useMemo(
    () => warehouses.filter((w) => w.is_active),
    [warehouses]
  );
  const showWarehouseField = activeWarehouses.length > 0 && assetType !== "buildings_land" && assetType !== "";

  // Sync categoryId based on selected assetType
  useEffect(() => {
    if (!assetType) {
      setCategoryId("");
      return;
    }
    const matched = categories.find((c) => {
      const lower = c.name.toLowerCase();
      if (assetType === "buildings_land") {
        return lower.includes("أبنية") || lower.includes("أراضي") || lower.includes("land") || lower.includes("building");
      }
      if (assetType === "automotive") {
        return lower.includes("آليات") || lower.includes("سيارات") || lower.includes("مركبات") || lower.includes("automotive");
      }
      if (assetType === "equipment") {
        return lower.includes("معدات") || lower.includes("تجهيزات") || lower.includes("equipment");
      }
      if (assetType === "furniture") {
        return lower.includes("أثاث") || lower.includes("مفروشات") || lower.includes("furniture");
      }
      return false;
    });

    if (matched) {
      setCategoryId(matched.id);
    } else {
      // Fallback: search for partial match or use first category
      const fallback = categories.find((c) => {
        const lower = c.name.toLowerCase();
        if (assetType === "buildings_land") return lower.includes("أرض") || lower.includes("مبنى");
        if (assetType === "automotive") return lower.includes("آلة") || lower.includes("سيارة") || lower.includes("مركبة");
        if (assetType === "equipment") return lower.includes("آلة") || lower.includes("آلات") || lower.includes("جهاز");
        if (assetType === "furniture") return lower.includes("كرسي") || lower.includes("طاولة");
        return false;
      });
      setCategoryId(fallback?.id || (categories.length > 0 ? categories[0].id : ""));
    }
  }, [assetType, categories]);

  // Load master data on mount; auto-create default categories if empty
  useEffect(() => {
    const DEFAULT_CATEGORIES = [
      { name: "أبنية وأراضي", assetType: "buildings_land" },
      { name: "آليات ومركبات", assetType: "automotive" },
      { name: "معدات وتجهيزات", assetType: "equipment" },
      { name: "أثاث ومفروشات", assetType: "furniture" },
    ];

    (async () => {
      let cats = await fixedAssetService.listCategories("Fixed");

      // Ensure every default category exists (heal DBs holding only some)
      const existingNames = new Set(cats.map((c) => c.name));
      const missing = DEFAULT_CATEGORIES.filter((def) => !existingNames.has(def.name));
      if (missing.length > 0) {
        for (const def of missing) {
          await fixedAssetService.createCategory(def.name, "Fixed");
        }
        cats = await fixedAssetService.listCategories("Fixed");
      }

      const [accs, whs] = await Promise.all([
        accountingService.getChartOfAccounts(),
        warehouseService.list(),
      ]);

      setCategories(cats);
      setAccounts(accs);
      setWarehouses(whs);

      // Map initialCategoryId to assetType
      if (initialCategoryId && cats.length > 0) {
        const cat = cats.find((c) => c.id === initialCategoryId);
        if (cat) {
          setAssetType(detectFixedAssetTypeFromName(cat.name) ?? "");
        }
      }

      // Map existing asset's category to assetType
      if (asset && cats.length > 0) {
        const cat = cats.find((c) => c.id === asset.category_id);
        if (cat) {
          setAssetType(detectFixedAssetTypeFromName(cat.name) ?? "");
        }
      }
    })();
  }, [initialCategoryId, asset, setWarehouses]);

  // Fixed-asset subtype implied by the selected COA account.
  useEffect(() => {
    if (initialAssetType) setAssetType(initialAssetType);
  }, [initialAssetType]);

  // Set default currency when currencies are loaded
  useEffect(() => {
    if (currencies.length > 0 && !currency) {
      const base = currencies.find((c) => c.is_base);
      setCurrency(base?.code ?? currencies[0].code);
    }
  }, [currencies, currency]);

  // Auto-fill exchange rate when currency changes
  useEffect(() => {
    if (currency && rateMap.size > 0) {
      const rate = getExchangeRate(currency, rateMap, baseCurrency?.code);
      setFxRate(String(rate));
    }
  }, [currency, rateMap, baseCurrency]);

  // ===== Auto-account mapping =====
  const findAccount = useCallback(
    (keywords: string[], accountType?: string): AccountDto | undefined => {
      return accounts.find((a) => {
        if (accountType && a.account_type !== accountType) return false;
        const name = (a.name_ar || "").toLowerCase();
        return keywords.some((k) => name.includes(k));
      });
    },
    [accounts]
  );

  const mappedAccounts = useMemo(() => {
    if (!assetType || accounts.length === 0) {
      return {
        assetAccountId: "",
        depreciationAccountId: "",
        accumulatedDepreciationAccountId: "",
        paymentAccountId: "",
      };
    }

    let assetKeywords: string[];
    if (assetType === "buildings_land") {
      assetKeywords = ["أبنية", "أراضي"];
    } else if (assetType === "automotive") {
      assetKeywords = ["آليات", "سيارات", "مركبات", "نقليات", "ثقيلة"];
    } else if (assetType === "equipment") {
      assetKeywords = ["معدات", "تجهيزات"];
    } else {
      assetKeywords = ["أثاث", "مفروشات"];
    }

    const assetAcc = findAccount(assetKeywords, "Assets");

    let depAcc: AccountDto | undefined;
    let accDepAcc: AccountDto | undefined;

    if (assetType === "buildings_land") {
      depAcc = assetAcc;
      accDepAcc = assetAcc;
    } else {
      depAcc =
        findAccount(["إهلاك", ...assetKeywords], "Expenses") ||
        findAccount(["إهلاك"], "Expenses");
      accDepAcc =
        findAccount(["مجمع إهلاك", ...assetKeywords], "Assets") ||
        findAccount(["مجمع إهلاك"], "Assets");
    }

    let payAcc: AccountDto | undefined;
    if (additionType === "new") {
      payAcc = accounts.find((a) => a.id === SYSTEM_ACCOUNT_IDS.CASH);
    } else {
      payAcc =
        findAccount(["رأس المال", "رأس مال", "capital", "أول المدة"], "Equity") ||
        findAccount(["رأس المال", "رأس مال", "capital", "أول المدة"]);
    }

    return {
      assetAccountId: assetAcc?.id || "",
      depreciationAccountId: depAcc?.id || "",
      accumulatedDepreciationAccountId: accDepAcc?.id || "",
      paymentAccountId: payAcc?.id || "",
    };
  }, [assetType, additionType, accounts, findAccount]);

  // Validate all mapped accounts are resolved
  const accountMappingError = useMemo(() => {
    if (!assetType) return "";
    if (!categoryId) return "لم يتم العثور على تصنيف الأصل المناسب";
    const { assetAccountId, depreciationAccountId, accumulatedDepreciationAccountId, paymentAccountId } = mappedAccounts;
    if (!assetAccountId) return "لم يتم العثور على حساب الأصل المناسب";
    if (!paymentAccountId) return "لم يتم العثور على حساب الدفع المناسب";
    if (assetType !== "buildings_land") {
      if (!depreciationAccountId) return "لم يتم العثور على حساب مصروف الإهلاك";
      if (!accumulatedDepreciationAccountId) return "لم يتم العثور على حساب مجمع الإهلاك";
    }
    return "";
  }, [assetType, categoryId, mappedAccounts]);

  // Validation
  const canSave = useMemo(() => {
    const base = !!name && !!categoryId && !!assetType && !!purchaseCost && !!currency;
    if (!base) return false;
    return !accountMappingError;
  }, [name, categoryId, assetType, purchaseCost, currency, accountMappingError]);

  const handleSave = async () => {
    if (!canSave) return;
    if (accountMappingError) {
      toast.error(accountMappingError);
      return;
    }
    // Defensive: validate no empty UUIDs before sending to backend
    if (!categoryId || !mappedAccounts.assetAccountId || !mappedAccounts.paymentAccountId) {
      toast.error("بيانات الحسابات المحاسبية غير مكتملة");
      return;
    }
    setSaving(true);
    try {
      const req: CreateFixedAssetRequest = {
        code: asset?.code ?? "",
        name,
        category_id: categoryId,
        warehouse_id: isNonDepreciable ? undefined : warehouseId,
        purchase_date: new Date(purchaseDate).toISOString(),
        purchase_cost: purchaseCost,
        currency,
        fx_rate: fxRate,
        useful_life_months: isNonDepreciable ? 0 : 120,
        asset_account_id: mappedAccounts.assetAccountId,
        depreciation_account_id: mappedAccounts.depreciationAccountId,
        accumulated_depreciation_account_id: mappedAccounts.accumulatedDepreciationAccountId,
        payment_account_id: mappedAccounts.paymentAccountId,
        addition_type: additionType,
        notes: notes || undefined,
        location: location || undefined,
        depreciation_method: "DecliningBalance",
      };
      if (isEditing && asset) {
        await fixedAssetService.update(asset.id, req);
        toast.success("تم تحديث الأصل بنجاح");
      } else {
        await fixedAssetService.create(req);
        toast.success("تم إضافة الأصل بنجاح");
      }
      onSaved();
    } catch (e) {
      toast.error("فشل حفظ الأصل: " + e);
    } finally {
      setSaving(false);
    }
  };

  // Panel icon based on assetType
  const panelIcon = getAssetTypeIcon(displayAssetType);

  return (
    <FormPanel
      title={isEditing ? `تعديل أصل: ${asset?.name}` : (additionType === "new" ? "شراء أصل جديد" : "إضافة أصل سابق (أول المدة)")}
      icon={panelIcon}
      onClose={onClose}
      onSave={handleSave}
      isSaving={saving}
      saveDisabled={!canSave}
    >
      {/* ── Section 1: Basic Info ── */}
      <SidebarSection title="البيانات الأساسية" icon={<FileText className="w-3.5 h-3.5" />} defaultOpen>
        <FormField label="نوع الأصل" required>
          {isTypeLocked && displayAssetType ? (
            <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs">
              {getAssetTypeIcon(displayAssetType)}
              <span className="font-bold text-blue-800">
                {FIXED_ASSET_TYPE_LABELS[displayAssetType as FixedAssetType]}
              </span>
              <span className="mr-auto text-[10px] font-normal text-blue-500">
                مضمّن من الحساب المحدد
              </span>
            </div>
          ) : (
            <Select dir="rtl" value={assetType} onValueChange={(v) => setAssetType(v as FixedAssetType)}>
              <SelectTrigger className="bg-white border-slate-200 h-9 w-full text-right text-xs font-bold text-slate-800">
                <SelectValue placeholder="اختر نوع الأصل" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="buildings_land" className="text-xs">أبنية وأراضي</SelectItem>
                <SelectItem value="automotive" className="text-xs">آليات ومركبات</SelectItem>
                <SelectItem value="equipment" className="text-xs">معدات وتجهيزات</SelectItem>
                <SelectItem value="furniture" className="text-xs">أثاث ومفروشات</SelectItem>
              </SelectContent>
            </Select>
          )}
        </FormField>

        {code ? (
          <div className="grid grid-cols-2 gap-3">
            <FormField label="الكود">
              <Input
                value={code}
                readOnly
                className="bg-slate-50 border-slate-200 h-9 text-xs font-mono cursor-not-allowed"
              />
            </FormField>

            <FormField label="الاسم" required>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="اسم الأصل"
                className="bg-white border-slate-200 h-9 text-xs"
              />
            </FormField>
          </div>
        ) : (
          <FormField label="الاسم" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="اسم الأصل"
              className="bg-white border-slate-200 h-9 text-xs"
            />
          </FormField>
        )}

        {showWarehouseField ? (
          <div className="grid grid-cols-2 gap-3">
            <FormField label="المستودع">
              <Select dir="rtl" value={warehouseId} onValueChange={setWarehouseId}>
                <SelectTrigger className="bg-white border-slate-200 h-9 w-full text-right text-xs">
                  <SelectValue placeholder="اختر مستودع" />
                </SelectTrigger>
                <SelectContent>
                  {activeWarehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id} className="text-xs">
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label={isNonDepreciable ? "الموقع / العنوان" : "الموقع / الغرفة / القسم"}>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={isNonDepreciable ? "مثال: دمشق - تنظيم كفرسوسة - محضر 12" : "مثال: الطابق الثالث - مكتب المدير"}
                className="bg-white border-slate-200 h-9 text-xs"
              />
            </FormField>
          </div>
        ) : (
          <FormField label={isNonDepreciable ? "الموقع / العنوان" : "الموقع / الغرفة / القسم"}>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={isNonDepreciable ? "مثال: دمشق - تنظيم كفرسوسة - محضر 12" : "مثال: الطابق الثالث - مكتب المدير"}
              className="bg-white border-slate-200 h-9 text-xs"
            />
          </FormField>
        )}
      </SidebarSection>

      {/* ── Section 2: Purchase & Cost ── */}
      <SidebarSection title={additionType === "new" ? "الشراء والتكلفة" : "بيانات الأصل السابق"} icon={<BadgeDollarSign className="w-3.5 h-3.5" />} defaultOpen>
        {currencies.length > 1 ? (
          <div className="grid grid-cols-2 gap-3">
            <FormField label="العملة" required>
              <Select dir="rtl" value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="bg-white border-slate-200 h-9 w-full text-right text-xs">
                  <SelectValue placeholder="اختر العملة" />
                </SelectTrigger>
                <SelectContent>
                  {currencies
                    .filter((c) => c.is_active)
                    .map((c) => (
                      <SelectItem key={c.code} value={c.code} className="text-xs">
                        {c.name_ar} ({c.code})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label={additionType === "new" ? "تكلفة الشراء" : "التكلفة الأصلية"} required>
              <Input
                type="number"
                value={purchaseCost}
                onChange={(e) => setPurchaseCost(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="bg-white border-slate-200 h-9 text-xs"
              />
            </FormField>
          </div>
        ) : (
          <FormField label={additionType === "new" ? "تكلفة الشراء" : "التكلفة الأصلية"} required>
            <Input
              type="number"
              value={purchaseCost}
              onChange={(e) => setPurchaseCost(e.target.value)}
              placeholder="0.00"
              step="0.01"
              min="0"
              className="bg-white border-slate-200 h-9 text-xs"
            />
          </FormField>
        )}

        <FormField label={additionType === "new" ? "تاريخ الشراء" : "تاريخ الحيازة"} required>
          <Input
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
            className="bg-white border-slate-200 h-9 text-xs"
          />
        </FormField>

        <FormField label="التوصيف والملاحظات">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="أي ملاحظات إضافية..."
            className="bg-white border-slate-200 min-h-[60px] text-xs"
          />
        </FormField>
      </SidebarSection>

      {/* Account mapping status - hidden informational */}
      {assetType && !!accountMappingError && (
        <div className="px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          {accountMappingError}
        </div>
      )}
    </FormPanel>
  );
}
