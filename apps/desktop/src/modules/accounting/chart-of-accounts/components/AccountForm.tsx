import { useMemo, useState, useEffect, useCallback } from "react";
import { Input } from "@shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { FieldLabel } from "@widgets/sidebar-shell/FieldLabel";
import { FormPanel } from "@widgets/form-shell/FormPanel";
import type { AccountDto } from "@erp/shared-types";
import { accountingService, type AccountCategory, type AccountType } from "@modules/accounting/api/accountingService";
import { customerService } from "@modules/partners/api/customerService";
import { supplierService } from "@modules/partners/api/supplierService";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { getExchangeRate } from "@shared/lib/currency-strategy";
import { useCompanyCapabilities } from "@shared/hooks";

interface AccountFormProps {
  /** Whether the form panel is open */
  open: boolean;
  /** Create or edit mode */
  mode: "create" | "edit";
  /** The account being edited (edit mode only) */
  selected: AccountDto | null;
  /** The parent account for create mode (null = level-1 account) */
  parentAccount: AccountDto | null;
  /** All chart-of-accounts entries for parent/code resolution */
  allAccounts: AccountDto[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

/**
 * Unified account create/edit form rendered inside the shared FormPanel.
 * Holds the numbering/child-code suggestion, customer/supplier link fields and
 * opening-balance workflow gating that previously lived in AccountDetailsSidebar.
 */
export function AccountForm({
  open,
  mode,
  selected,
  parentAccount,
  allAccounts,
  onClose,
  onSaved,
}: AccountFormProps) {
  const { canAccessOpeningWorkflow } = useCompanyCapabilities();
  const { currencies: activeCurrencies, rateMap, baseCurrency } = useCurrencyContext();

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
  const [currency, setCurrency] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formParent = useMemo(() => {
    if (mode === "edit" && selected?.parent_id) {
      return allAccounts.find((a) => a.id === selected.parent_id) ?? null;
    }
    return parentAccount;
  }, [mode, selected, parentAccount, allAccounts]);

  const isCustomerParent =
    formParent?.code?.startsWith("123") ||
    formParent?.code?.startsWith("1203") ||
    formParent?.name_ar?.includes("المدينون");
  const isSupplierParent =
    formParent?.code?.startsWith("223") ||
    formParent?.code?.startsWith("2203") ||
    formParent?.name_ar?.includes("الدائنون");

  const isSyncAccount =
    mode === "create"
      ? isCustomerParent || isSupplierParent
      : !!selected?.linked_customer_id || !!selected?.linked_supplier_id;
  const isCustomer = mode === "create" ? isCustomerParent : !!selected?.linked_customer_id;

  const suggestChildCode = useCallback(
    (account: AccountDto | null): string => {
      if (!account) return "";
      const base = account.code ?? "";
      const baseLen = (account.level ?? 1) + 1;
      const children = allAccounts.filter((a) => a.parent_id === account.id);
      const existingCodes = children.map((c) => c.code ?? "");
      const existingAtDepth = existingCodes.filter(
        (c) => c.length === baseLen,
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

  // Initialize the form whenever the panel opens with a given mode/target.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setSaving(false);

    if (mode === "create") {
      const parentCode = parentAccount?.code ?? "";
      const fullSuggested = suggestChildCode(parentAccount);
      const suffix = fullSuggested.startsWith(parentCode)
        ? fullSuggested.substring(parentCode.length)
        : fullSuggested;

      setCode(suffix);
      setCodeSuffix(parentCode);
      setNameAr("");
      setParentId(parentAccount?.id ?? "null");
      setPhone("");
      setAddress("");
      setNotes("");
      setOpeningBalance("0");
      setDebit("0");
      setCredit("0");
      setCurrency("");
    } else if (mode === "edit" && selected) {
      const selectedCode = selected.code ?? "";
      const parentCode = formParent?.code ?? "";
      const suffix = selectedCode.startsWith(parentCode)
        ? selectedCode.substring(parentCode.length)
        : "";

      setCode(suffix);
      setCodeSuffix(parentCode);
      setNameAr(selected.name_ar ?? "");
      setParentId(selected.parent_id ?? "null");
      setNotes(selected.notes ?? "");
      setOpeningBalance(selected.opening_balance ?? "0");
    }
  }, [open, mode, selected, parentAccount, formParent, suggestChildCode]);

  // On edit of a linked account, prefill phone/address/balances from the partner.
  useEffect(() => {
    let cancelled = false;
    async function fetchLinkedDetails() {
      if (mode !== "edit" || !selected || !isSyncAccount) return;
      try {
        if (selected.linked_customer_id) {
          const customer = await customerService.get(selected.linked_customer_id);
          if (customer && !cancelled) {
            setPhone(customer.phone || "");
            setAddress(customer.address || "");
            setDebit(customer.debit || "0");
            setCredit(customer.credit || "0");
            setCurrency(customer.currency || "");
          }
        } else if (selected.linked_supplier_id) {
          const supplier = await supplierService.get(selected.linked_supplier_id);
          if (supplier && !cancelled) {
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
    fetchLinkedDetails();
    return () => { cancelled = true; };
  }, [mode, selected, isSyncAccount, activeCurrencies]);

  const resolveLevel = (parent: string): number => {
    if (parent === "null") return 1;
    const parentAccount = allAccounts.find((a) => a.id === parent);
    return (parentAccount?.level ?? 1) + 1;
  };

  const handleSave = async () => {
    if (!nameAr.trim()) {
      setError("يرجى تعبئة اسم الحساب.");
      return;
    }

    if (mode === "edit" && !code.trim()) {
      setError("يرجى تعبئة رقم الحساب.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const effectiveParentId = parentId === "null" ? null : parentId;
      const targetLevel = resolveLevel(parentId);
      const targetCategory = "Detail" as AccountCategory;
      const finalCode = codeSuffix ? `${codeSuffix}${code.trim()}` : code.trim();

      if (mode === "edit" && selected) {
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
        const payload = {
          code: finalCode,
          name_ar: nameAr.trim(),
          name_en: nameAr.trim(),
          account_type: (formParent?.account_type ?? "Assets") as AccountType,
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
      onSaved();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "تعذر حفظ الحساب. حاول مرة أخرى.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <FormPanel
      title={mode === "edit" ? "تعديل الحساب" : "إضافة حساب جديد"}
      icon={<span className="text-xl">{mode === "edit" ? "✎" : "＋"}</span>}
      onClose={onClose}
      onSave={handleSave}
      isSaving={saving}
      saveDisabled={!nameAr.trim()}
      saveLabel={mode === "edit" ? "حفظ التعديلات" : "إضافة الحساب"}
    >
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
            <div className={`grid ${canAccessOpeningWorkflow ? "grid-cols-3" : "grid-cols-1"} gap-3`}>
              {canAccessOpeningWorkflow && (
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
          {canAccessOpeningWorkflow && (
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
    </FormPanel>
  );
}