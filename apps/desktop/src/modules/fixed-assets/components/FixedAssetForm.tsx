import React, { useState, useEffect, useMemo } from "react";
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
  Banknote,
  BarChart2,
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
  CreateFixedAssetRequest,
} from "@erp/shared-types";
import { toast } from "sonner";

interface FixedAssetFormProps {
  onClose: () => void;
  onSaved: () => void;
  currencies: CurrencyDto[];
  initialCategoryId?: string;
}

// ===== Constants =====
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  buildings_land: <Landmark className="w-4 h-4" />,
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

// ===== AccountSelect reusable component =====
function AccountSelect({
  label,
  required,
  value,
  onValueChange,
  accounts,
  placeholder = "اختر الحساب",
}: {
  label: string;
  required?: boolean;
  value: string;
  onValueChange: (v: string) => void;
  accounts: AccountDto[];
  placeholder?: string;
}) {
  return (
    <FormField label={label} required={required}>
      <Select dir="rtl" value={value} onValueChange={onValueChange}>
        <SelectTrigger className="bg-white border-slate-200 h-9 w-full text-right text-xs">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {accounts.map((a) => (
            <SelectItem key={a.id} value={a.id} className="text-xs">
              {a.code} - {a.name_ar}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  );
}

// ===== Main Form =====
export function FixedAssetForm({
  onClose,
  onSaved,
  currencies,
  initialCategoryId,
}: FixedAssetFormProps) {
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<AssetCategoryDto[]>([]);
  const [accounts, setAccounts] = useState<AccountDto[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseDto[]>([]);

  // --- Basic info ---
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [assetType, setAssetType] = useState<"buildings_land" | "equipment" | "furniture" | "">("");
  const [categoryId, setCategoryId] = useState("");
  const [warehouseId, setWarehouseId] = useState<string | undefined>(undefined);
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  // --- Purchase ---
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [purchaseCost, setPurchaseCost] = useState("");
  const [currency, setCurrency] = useState("");
  const [fxRate, setFxRate] = useState("1");
  const [salvageValue, setSalvageValue] = useState("");

  // --- Depreciation ---
  const [usefulLifeMonths, setUsefulLifeMonths] = useState("60");

  // --- Accounts ---
  const [assetAccountId, setAssetAccountId] = useState("");
  const [depreciationAccountId, setDepreciationAccountId] = useState("");
  const [accumulatedDepreciationAccountId, setAccumulatedDepreciationAccountId] =
    useState("");
  const [paymentAccountId, setPaymentAccountId] = useState("");

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
        if (assetType === "equipment") return lower.includes("آلة") || lower.includes("آلات") || lower.includes("جهاز");
        if (assetType === "furniture") return lower.includes("كرسي") || lower.includes("طاولة");
        return false;
      });
      setCategoryId(fallback?.id || (categories.length > 0 ? categories[0].id : ""));
    }
  }, [assetType, categories]);

  // Reset depreciation fields when switching to non-depreciable category
  useEffect(() => {
    if (isNonDepreciable) {
      setUsefulLifeMonths("0");
      setSalvageValue("");
      setDepreciationAccountId("");
      setAccumulatedDepreciationAccountId("");
    } else {
      setUsefulLifeMonths((prev) => (prev === "0" ? "60" : prev));
    }
  }, [isNonDepreciable]);

  // Load master data on mount
  useEffect(() => {
    Promise.all([
      fixedAssetService.listCategories("Fixed"),
      accountingService.getChartOfAccounts(),
      warehouseService.listWarehouses(),
    ]).then(([cats, accs, whs]) => {
      setCategories(cats);
      setAccounts(accs);
      setWarehouses(whs);

      // Map initialCategoryId to assetType
      if (initialCategoryId && cats.length > 0) {
        const cat = cats.find((c) => c.id === initialCategoryId);
        if (cat) {
          const lowerName = cat.name.toLowerCase();
          if (
            lowerName.includes("أبنية") ||
            lowerName.includes("أراضي") ||
            lowerName.includes("land") ||
            lowerName.includes("building")
          ) {
            setAssetType("buildings_land");
          } else if (
            lowerName.includes("معدات") ||
            lowerName.includes("تجهيزات") ||
            lowerName.includes("equipment")
          ) {
            setAssetType("equipment");
          } else if (
            lowerName.includes("أثاث") ||
            lowerName.includes("مفروشات") ||
            lowerName.includes("furniture")
          ) {
            setAssetType("furniture");
          }
        }
      }
    });
  }, [initialCategoryId]);

  // Set default currency when currencies are loaded
  useEffect(() => {
    if (currencies.length > 0 && !currency) {
      const base = currencies.find((c) => c.is_base);
      setCurrency(base?.code ?? currencies[0].code);
    }
  }, [currencies, currency]);

  // Account lists
  const assetAccounts = useMemo(
    () => accounts.filter((a) => a.account_type === "Assets" && a.category === "Detail"),
    [accounts]
  );
  const expenseAccounts = useMemo(
    () =>
      accounts.filter((a) => a.account_type === "Expenses" && a.category === "Detail"),
    [accounts]
  );

  // Validation
  const canSave = useMemo(() => {
    const base =
      !!code && !!name && !!assetType && !!purchaseCost && !!currency && !!assetAccountId && !!paymentAccountId;
    if (!base) return false;
    if (assetType !== "buildings_land") {
      return !!depreciationAccountId && !!accumulatedDepreciationAccountId && !!usefulLifeMonths && parseInt(usefulLifeMonths) > 0;
    }
    return true;
  }, [
    code,
    name,
    assetType,
    purchaseCost,
    currency,
    assetAccountId,
    paymentAccountId,
    depreciationAccountId,
    accumulatedDepreciationAccountId,
    usefulLifeMonths,
  ]);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const req: CreateFixedAssetRequest = {
        code,
        name,
        category_id: categoryId,
        warehouse_id: isNonDepreciable ? undefined : warehouseId,
        purchase_date: new Date(purchaseDate).toISOString(),
        purchase_cost: purchaseCost,
        currency,
        fx_rate: fxRate,
        useful_life_months: isNonDepreciable ? 0 : parseInt(usefulLifeMonths) || 0,
        asset_account_id: assetAccountId,
        depreciation_account_id: isNonDepreciable ? assetAccountId : depreciationAccountId,
        accumulated_depreciation_account_id: isNonDepreciable
          ? assetAccountId
          : accumulatedDepreciationAccountId,
        payment_account_id: paymentAccountId,
      };
      await fixedAssetService.create(req);
      toast.success("تم إضافة الأصل بنجاح");
      onSaved();
    } catch (e) {
      toast.error("فشل حفظ الأصل: " + e);
    } finally {
      setSaving(false);
    }
  };

  // Panel icon based on assetType
  const panelIcon = getAssetTypeIcon(assetType);

  return (
    <FormPanel
      title="أصل ثابت جديد"
      icon={panelIcon}
      onClose={onClose}
      onSave={handleSave}
      isSaving={saving}
      saveDisabled={!canSave}
    >
      {/* ── Section 1: Basic Info ── */}
      <SidebarSection title="البيانات الأساسية" icon={<FileText className="w-3.5 h-3.5" />} defaultOpen>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="الكود" required>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="مثال: FA-001"
              className="bg-white border-slate-200 h-9 text-xs"
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

        <FormField label="نوع الأصل" required>
          <Select dir="rtl" value={assetType} onValueChange={(v) => setAssetType(v as "buildings_land" | "equipment" | "furniture")}>
            <SelectTrigger className="bg-white border-slate-200 h-9 w-full text-right text-xs font-bold text-slate-800">
              <SelectValue placeholder="اختر نوع الأصل" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="buildings_land" className="text-xs">أبنية وأراضي</SelectItem>
              <SelectItem value="equipment" className="text-xs">معدات وتجهيزات</SelectItem>
              <SelectItem value="furniture" className="text-xs">أثاث ومفروشات</SelectItem>
            </SelectContent>
          </Select>
          {isNonDepreciable && assetType && (
            <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1">
              <Landmark className="w-3 h-3" />
              هذا النوع لا يخضع للإهلاك (أراضي)
            </p>
          )}
        </FormField>

        {showWarehouseField && (
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
        )}

        <FormField label={isNonDepreciable ? "الموقع / العنوان" : "الموقع / الغرفة / القسم"}>
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={isNonDepreciable ? "مثال: دمشق - تنظيم كفرسوسة - محضر 12" : "مثال: الطابق الثالث - مكتب المدير"}
            className="bg-white border-slate-200 h-9 text-xs"
          />
        </FormField>

        <FormField label="ملاحظات">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="أي ملاحظات إضافية..."
            className="bg-white border-slate-200 min-h-[60px] text-xs"
          />
        </FormField>
      </SidebarSection>

      {/* ── Section 2: Purchase & Cost ── */}
      <SidebarSection title="الشراء والتكلفة" icon={<BadgeDollarSign className="w-3.5 h-3.5" />} defaultOpen>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="تاريخ الاقتناء" required>
            <Input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="bg-white border-slate-200 h-9 text-xs"
            />
          </FormField>

          <FormField label="تكلفة الشراء" required>
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

          <FormField label="سعر الصرف">
            <Input
              type="number"
              value={fxRate}
              onChange={(e) => setFxRate(e.target.value)}
              placeholder="1"
              step="0.001"
              min="0"
              className="bg-white border-slate-200 h-9 text-xs"
            />
          </FormField>
        </div>

        {!isNonDepreciable && assetType && (
          <FormField label="قيمة الخردة (المتبقية)">
            <Input
              type="number"
              value={salvageValue}
              onChange={(e) => setSalvageValue(e.target.value)}
              placeholder="0.00"
              step="0.01"
              min="0"
              className="bg-white border-slate-200 h-9 text-xs"
            />
          </FormField>
        )}
      </SidebarSection>

      {/* ── Section 3: Depreciation (hidden for non-depreciable) ── */}
      {!isNonDepreciable && assetType && (
        <SidebarSection
          title="الإهلاك"
          icon={<BarChart2 className="w-3.5 h-3.5" />}
          defaultOpen
        >
          <FormField label="العمر الإنتاجي (بالشهور)" required>
            <div className="relative">
              <Input
                type="number"
                value={usefulLifeMonths}
                onChange={(e) => setUsefulLifeMonths(e.target.value)}
                placeholder="60"
                min="1"
                className="bg-white border-slate-200 h-9 pl-16 text-xs"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">
                شهر ({Math.round(parseInt(usefulLifeMonths || "0") / 12)} سنة)
              </span>
            </div>
          </FormField>
        </SidebarSection>
      )}

      {/* ── Section 4: Accounting ── */}
      {assetType && (
        <SidebarSection
          title="الحسابات المحاسبية"
          icon={<Banknote className="w-3.5 h-3.5" />}
          defaultOpen
        >
          <div className="grid grid-cols-2 gap-3">
            <AccountSelect
              label="حساب الأصل"
              required
              value={assetAccountId}
              onValueChange={setAssetAccountId}
              accounts={assetAccounts}
              placeholder="حساب الأصل"
            />

            <AccountSelect
              label="حساب الدفع"
              required
              value={paymentAccountId}
              onValueChange={setPaymentAccountId}
              accounts={assetAccounts}
              placeholder="حساب الدفع"
            />

            {!isNonDepreciable && (
              <>
                <AccountSelect
                  label="مصروف الإهلاك"
                  required
                  value={depreciationAccountId}
                  onValueChange={setDepreciationAccountId}
                  accounts={expenseAccounts}
                  placeholder="المصروف"
                />

                <AccountSelect
                  label="مجمع الإهلاك"
                  required
                  value={accumulatedDepreciationAccountId}
                  onValueChange={setAccumulatedDepreciationAccountId}
                  accounts={assetAccounts}
                  placeholder="المجمع"
                />
              </>
            )}
          </div>
        </SidebarSection>
      )}
    </FormPanel>
  );
}
