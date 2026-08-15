import { useMemo, useState, useEffect, useCallback } from "react";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { FieldLabel } from "@widgets/sidebar-shell/FieldLabel";
import type { AccountDto } from "@erp/shared-types";
import { accountingService } from "@modules/accounting/api/accountingService";
import type {
  AccountCategory,
  AccountType,
} from "@modules/accounting/api/accountingService";
import { customerService } from "@modules/partners/api/customerService";
import { supplierService } from "@modules/partners/api/supplierService";
import { TreeSidebar } from "@widgets/tree-sidebar/TreeSidebar";
import { BookOpen } from "lucide-react";
import { useTabs } from "@app/providers/TabContext";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { getExchangeRate } from "@shared/lib/currency-strategy";
import { useCompanyCapabilities } from "@shared/hooks";

interface AccountDetailsSidebarProps {
  selected: AccountDto | null;
  allAccounts: AccountDto[];
  parentName?: string | null;
  onSaved: () => void;
  onDelete: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export function AccountDetailsSidebar({
  selected,
  allAccounts,
  parentName,
  onSaved,
  onDelete,
  canEdit = !!selected,
  canDelete = !!selected,
}: AccountDetailsSidebarProps) {
  const { openTab } = useTabs();
  const { canUseOpeningWorkflow } = useCompanyCapabilities();
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  // ... existing state ...
  const [code, setCode] = useState("");
  const [codeSuffix, setCodeSuffix] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [parentId, setParentId] = useState<string>("null");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [debit, setDebit] = useState("0");
  const [credit, setCredit] = useState("0");
  const { currencies: activeCurrencies, rateMap, baseCurrency } = useCurrencyContext();

  const [currency, setCurrency] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parentAccount = useMemo(() => {
    if (parentId === "null") return null;
    return allAccounts.find((a) => a.id === parentId);
  }, [parentId, allAccounts]);

  const isCustomerParent =
    parentAccount?.code?.startsWith("123") ||
    parentAccount?.code?.startsWith("1203") ||
    parentAccount?.name_ar?.includes("المدينون");
  const isSupplierParent =
    parentAccount?.code?.startsWith("223") ||
    parentAccount?.code?.startsWith("2203") ||
    parentAccount?.name_ar?.includes("الدائنون");

  const isSyncAccount = useMemo(() => {
    if (formMode === "create") return isCustomerParent || isSupplierParent;
    if (formMode === "edit" && selected)
      return !!selected.linked_customer_id || !!selected.linked_supplier_id;
    return false;
  }, [formMode, isCustomerParent, isSupplierParent, selected]);

  const isCustomer = useMemo(() => {
    if (formMode === "create") return isCustomerParent;
    return !!selected?.linked_customer_id;
  }, [formMode, isCustomerParent, selected]);

  const suggestChildCode = useCallback(
    (account: AccountDto | null): string => {
      if (!account) return "";
      const base = account.code ?? "";
      const baseLen = (account.level ?? 1) + 1;
      const children = allAccounts.filter((a) => a.parent_id === account.id);
      const existingCodes = children.map((c) => c.code ?? "");
      const existingAtDepth = existingCodes.filter(
        (code) => code.length === baseLen,
      );

      if (existingAtDepth.length === 0) {
        const seed = base.length > 0 ? base + "1" : "1";
        const res = seed.length >= baseLen ? seed : seed.padEnd(baseLen, "0");
        return res.substring(0, baseLen);
      }

      const lastCode = existingAtDepth[existingAtDepth.length - 1];
      const lastDigit = parseInt(lastCode.charAt(base.length), 10);
      if (!isNaN(lastDigit) && lastDigit < 9) {
        return `${base}${lastDigit + 1}`;
      }

      for (let i = 1; i <= 9; i++) {
        const candidate = `${base}${i}`;
        if (!existingAtDepth.includes(candidate)) return candidate;
      }

      return (base + "1").substring(0, baseLen);
    },
    [allAccounts],
  );

  const openCreateDialog = useCallback(() => {
    if (selected?.is_final) {
      setError("لا يمكن إضافة حسابات فرعية تحت حساب نهائي (ورقة)");
      return;
    }
    setFormMode("create");
    setError(null);
    const targetParent = selected?.id ?? "null";

    // Split suggested code into parent prefix and own suffix
    const parentCode = selected?.code ?? "";
    const fullSuggested = suggestChildCode(selected);
    const suffix = fullSuggested.startsWith(parentCode)
      ? fullSuggested.substring(parentCode.length)
      : fullSuggested;

    setCode(suffix);
    setCodeSuffix(parentCode);
    setNameAr("");
    setParentId(targetParent);
    setPhone("");
    setAddress("");
    setNotes("");
    setOpeningBalance("0");
    setDebit("0");
    setCredit("0");
    setCurrency("");
  }, [selected, suggestChildCode]);

  useEffect(() => {
    const handler = () => openCreateDialog();
    window.addEventListener("erp:open-new-account", handler);
    return () => window.removeEventListener("erp:open-new-account", handler);
  }, [openCreateDialog]);

  useEffect(() => {
    setFormMode(null);
    setError(null);
    setSaving(false);
  }, [selected?.id]);

  useEffect(() => {
    async function fetchLinkedDetails() {
      if (formMode === "edit" && selected && isSyncAccount) {
        try {
          if (selected.linked_customer_id) {
            const customer = await customerService.get(
              selected.linked_customer_id,
            );
            if (customer) {
              setPhone(customer.phone || "");
              setAddress(customer.address || "");
              setDebit(customer.debit || "0");
              setCredit(customer.credit || "0");
              setCurrency(customer.currency || "");
            }
          } else if (selected.linked_supplier_id) {
            const supplier = await supplierService.get(
              selected.linked_supplier_id,
            );
            if (supplier) {
              setPhone(supplier.phone || "");
              setAddress(supplier.address || "");
              setDebit(supplier.debit || "0");
              setCredit(supplier.credit || "0");
              setCurrency(supplier.currency || "");
            }
          }
        } catch (err) {
          console.error("Failed to fetch linked details:", err);
        }
      }
    }
    fetchLinkedDetails();
  }, [formMode, selected, isSyncAccount, activeCurrencies]);

  const openEditDialog = () => {
    if (!selected || !canEdit) return;
    setFormMode("edit");
    setError(null);

    // Calculate parent code and suffix
    const selectedCode = selected.code ?? "";
    const parentAccount = allAccounts.find((a) => a.id === selected.parent_id);
    const parentCode = parentAccount?.code ?? "";
    const suffix = selectedCode.startsWith(parentCode)
      ? selectedCode.substring(parentCode.length)
      : "";

    setCode(suffix); // Own part is editable
    setCodeSuffix(parentCode); // Parent part is read-only
    setNameAr(selected.name_ar ?? "");
    setParentId(selected.parent_id ?? "null");
    setNotes(selected.notes ?? "");
    setOpeningBalance(selected.opening_balance ?? "0");
  };

  const closeDialog = () => {
    if (saving) return;
    setFormMode(null);
    setError(null);
  };

  const resolveLevel = (parent: string): number => {
    if (parent === "null") return 1;
    const parentAccount = allAccounts.find((account) => account.id === parent);
    return (parentAccount?.level ?? 1) + 1;
  };

  const handleSave = async () => {
    if (!nameAr.trim()) {
      setError("يرجى تعبئة اسم الحساب.");
      return;
    }

    // In edit mode, require parent code to be filled
    if (formMode === "edit" && !code.trim()) {
      setError("يرجى تعبئة رقم الحساب.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const effectiveParentId = parentId === "null" ? null : parentId;
      const targetLevel = resolveLevel(parentId);
      const targetCategory = "Detail" as AccountCategory;

      if (formMode === "edit" && selected) {
        // Combine parent prefix with own suffix
        const finalCode = codeSuffix
          ? `${codeSuffix}${code.trim()}`
          : code.trim();

        const payload = {
          code: finalCode,
          name_ar: nameAr.trim(),
          name_en: selected.name_en,
          account_type: selected.account_type as AccountType,
          parent_id: effectiveParentId,
          category: selected.category as AccountCategory,
          level: targetLevel,
          opening_balance: openingBalance || "0",
          notes: notes.trim() || null,
          is_default: selected.is_default,
          is_active: selected.is_active,
          phone: phone.trim() || null,
          address: address.trim() || null,
          debit: debit || "0",
          credit: credit || "0",
          currency: currency,
          exchange_rate: getExchangeRate(currency, rateMap, baseCurrency?.code).toString(),
        };
        await accountingService.updateAccount(selected.id, payload);
      } else {
        // Combine parent prefix with own suffix for creation
        const finalCode = codeSuffix
          ? `${codeSuffix}${code.trim()}`
          : code.trim();

        const payload = {
          code: finalCode,
          name_ar: nameAr.trim(),
          name_en: nameAr.trim(),
          account_type: (parentAccount?.account_type ??
            selected?.account_type ??
            "Assets") as AccountType,
          parent_id: effectiveParentId,
          category: targetCategory,
          level: targetLevel,
          opening_balance: openingBalance || "0",
          notes: notes.trim() || null,
          is_default: false,
          is_active: true,
          phone: phone.trim() || null,
          address: address.trim() || null,
          debit: debit || "0",
          credit: credit || "0",
          currency: currency,
          exchange_rate: getExchangeRate(currency, rateMap, baseCurrency?.code).toString(),
        };
        await accountingService.createAccount(payload);
      }
      closeDialog();
      onSaved();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "تعذر حفظ الحساب. حاول مرة أخرى.",
      );
    } finally {
      setSaving(false);
    }
  };

  const detailsView = (
    <>
      {!selected ? (
        <p className="text-sm text-slate-500">
          اختر حسابًا من الشجرة لعرض التفاصيل.
        </p>
      ) : (
        <div className="grid gap-3">
          <Button
            variant="outline"
            className="w-full bg-blue-600 text-white hover:bg-blue-700 hover:text-white border-none h-10 mb-2 font-bold"
            onClick={() =>
              openTab({
                id: `ledger-${selected.id}`,
                title: `حركة: ${selected.name_ar}`,
                path: `/accounting/account-ledger/${selected.id}`,
                closable: true,
              })
            }
          >
            <BookOpen className="w-4 h-4 ml-2" />
            حركة اليومية للحساب
          </Button>

          <div className="rounded-md border bg-slate-50 p-3">
            <p className="text-[11px] text-slate-500 mb-1">رقم الحساب</p>
            <p className="font-semibold tabular-nums text-slate-800">
              {selected.code}
            </p>
          </div>
          <div className="rounded-md border bg-slate-50 p-3">
            <p className="text-[11px] text-slate-500 mb-1">اسم الحساب</p>
            <p className="font-semibold text-slate-800">{selected.name_ar}</p>
          </div>
          <div className="rounded-md border bg-slate-50 p-3">
            <p className="text-[11px] text-slate-500 mb-1">فرعي من</p>
            <p className="font-semibold text-slate-800">
              {parentName && parentName.trim().length > 0 ? parentName : "—"}
            </p>
          </div>
        </div>
      )}
    </>
  );

  const formPanel = (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 text-red-700 border border-red-200 rounded-md px-3 py-2 text-sm">
          {error}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <FieldLabel>رقم الحساب</FieldLabel>
          {codeSuffix ? (
            <div className="flex gap-1">
              <Input
                value={codeSuffix}
                disabled
                className="bg-slate-100 text-slate-500 w-16 text-center"
                title="الجزء الموروث من الأب ولا يمكن تعديله"
              />
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="الجزء الفرعي"
                className="bg-white flex-1"
              />
            </div>
          ) : (
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="مثال: 1101"
              className="bg-white"
            />
          )}
        </div>
        <div className="space-y-1">
          <FieldLabel>اسم الحساب</FieldLabel>
          <Input
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
            placeholder="مثال: صندوق فرعي"
            className="bg-white"
          />
        </div>
      </div>
      <div className="space-y-1">
        <FieldLabel>فرعي من</FieldLabel>
        <div className="rounded-md border border-input bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {parentId === "null"
            ? "-- مستوى أول --"
            : (() => {
                const parent = allAccounts.find((a) => a.id === parentId);
                return parent ? `${parent.code} - ${parent.name_ar}` : "--";
              })()}
        </div>
      </div>
      {isSyncAccount && (
        <div className="pt-2 space-y-4 border-t border-primary/10">
          <p className="text-[10px] font-bold text-primary uppercase tracking-wider">
            خانات متقدمة ({isCustomer ? "عميل" : "مورد"})
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <FieldLabel>رقم الهاتف</FieldLabel>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="اختياري"
                className="bg-white"
              />
            </div>
            <div className="space-y-1">
              <FieldLabel>العنوان</FieldLabel>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="اختياري"
                className="bg-white"
              />
            </div>
          </div>
          <div className={`grid ${canUseOpeningWorkflow ? "grid-cols-3" : "grid-cols-1"} gap-3`}>
            {canUseOpeningWorkflow && (
              <>
                <div className="space-y-1">
                  <FieldLabel>مدين</FieldLabel>
                  <Input
                    type="number"
                    value={debit}
                    onChange={(e) => setDebit(e.target.value)}
                    className="bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <FieldLabel>دائن</FieldLabel>
                  <Input
                    type="number"
                    value={credit}
                    onChange={(e) => setCredit(e.target.value)}
                    className="bg-white"
                  />
                </div>
              </>
            )}
            <div className="space-y-1">
              <FieldLabel>العملة</FieldLabel>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="h-9 bg-white border-slate-200 text-sm">
                  <SelectValue placeholder="اختر العملة" />
                </SelectTrigger>
                <SelectContent>
                  {activeCurrencies
                    .filter((c) => c.is_active)
                    .map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.code} - {c.name_ar}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}
      <div className="pt-2 space-y-3 border-t border-primary/10">
        {canUseOpeningWorkflow && (
          <div className="space-y-1">
            <FieldLabel>الرصيد الافتتاحي</FieldLabel>
            <Input
              type="number"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              className="bg-white"
            />
          </div>
        )}
        <div className="space-y-1">
          <FieldLabel>ملاحظات</FieldLabel>
          <textarea
            className="flex min-h-[60px] w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="ملاحظات اختيارية..."
          />
        </div>
      </div>
    </div>
  );

  return (
    <TreeSidebar
      title="تفاصيل الحساب"
      selected={selected}
      formMode={formMode}
      onOpenCreate={openCreateDialog}
      onOpenEdit={openEditDialog}
      onDelete={onDelete}
      onCancel={closeDialog}
      onSave={handleSave}
      saving={saving}
      canEdit={canEdit}
      canDelete={canDelete}
      level={selected?.level}
      formPanel={formPanel}
    >
      {detailsView}
    </TreeSidebar>
  );
}
