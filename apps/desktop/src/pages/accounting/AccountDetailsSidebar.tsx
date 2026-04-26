import { useMemo, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Edit, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AccountDto } from "@erp/shared-types";
import { accountingService } from "@/services/accountingService";
import type { AccountCategory, AccountType } from "@/services/accountingService";

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
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [code, setCode] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [parentId, setParentId] = useState<string>("null");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [debit, setDebit] = useState("0");
  const [credit, setCredit] = useState("0");
  const [currency, setCurrency] = useState("SYP");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parentAccount = useMemo(() => {
    if (parentId === "null") return null;
    return allAccounts.find(a => a.id === parentId);
  }, [parentId, allAccounts]);

  const isCustomerParent = parentAccount?.code?.startsWith("123") || parentAccount?.code?.startsWith("1203") || parentAccount?.name_ar?.includes("المدينون");
  const isSupplierParent = parentAccount?.code?.startsWith("223") || parentAccount?.code?.startsWith("2203") || parentAccount?.name_ar?.includes("الدائنون");
  
  const isSyncAccount = useMemo(() => {
    if (formMode === "create") return isCustomerParent || isSupplierParent;
    if (formMode === "edit" && selected) return !!selected.linked_customer_id || !!selected.linked_supplier_id;
    return false;
  }, [formMode, isCustomerParent, isSupplierParent, selected]);

  const isCustomer = useMemo(() => {
    if (formMode === "create") return isCustomerParent;
    return !!selected?.linked_customer_id;
  }, [formMode, isCustomerParent, selected]);

  // Reset form state when the selected account changes (so user returns to details view)
  useEffect(() => {
    // Always reset to details view when selection changes
    setFormMode(null);
    setError(null);
    setSaving(false);
    // Clear draft fields to avoid stale data when changing selection
    setCode("");
    setNameAr("");
    setParentId("null");
    setPhone("");
    setAddress("");
    setNotes("");
    setOpeningBalance("0");
    setDebit("0");
    setCredit("0");
    setCurrency("SYP");
  }, [selected?.id]);

  // Fetch linked details when entering edit mode for a sync account
  useEffect(() => {
    async function fetchLinkedDetails() {
      if (formMode === "edit" && selected && isSyncAccount) {
        try {
          if (selected.linked_customer_id) {
            const { customerService } = await import("@/services/customerService");
            const customer = await customerService.getCustomer(selected.linked_customer_id);
            if (customer) {
              setPhone(customer.phone || "");
              setAddress(customer.address || "");
              setDebit(customer.debit || "0");
              setCredit(customer.credit || "0");
              setCurrency(customer.currency || "SYP");
            }
          } else if (selected.linked_supplier_id) {
            const { supplierService } = await import("@/services/supplierService");
            const supplier = await supplierService.getSupplier(selected.linked_supplier_id);
            if (supplier) {
              setPhone(supplier.phone || "");
              setAddress(supplier.address || "");
              setDebit(supplier.debit || "0");
              setCredit(supplier.credit || "0");
              setCurrency(supplier.currency || "SYP");
            }
          }
        } catch (err) {
          console.error("Failed to fetch linked details:", err);
        }
      }
    }
    fetchLinkedDetails();
  }, [formMode, selected, isSyncAccount]);

  const suggestChildCode = (account: AccountDto | null): string => {
    if (!account) return "";
    const base = account.code ?? "";
    const baseLen = (account.level ?? 1) + 1; // desired total digits for child code

    // Collect existing children under this parent
    const children = allAccounts.filter(a => a.parent_id === account.id);
    const existingCodes = children.map(c => c.code ?? "");
    const existingAtDepth = existingCodes.filter(code => code.length === baseLen);

    if (existingAtDepth.length === 0) {
      const seed = base.length > 0 ? base + "1" : "1";
      const res = seed.length >= baseLen ? seed : seed.padEnd(baseLen, '0');
      return res.substring(0, baseLen);
    }

    // Determine next by incrementing last digit
    const lastCode = existingAtDepth[existingAtDepth.length - 1];
    const lastDigit = parseInt(lastCode.charAt(base.length), 10);
    if (!isNaN(lastDigit) && lastDigit < 9) {
      return `${base}${lastDigit + 1}`;
    }

    // Try to find a gap in 1..9
    for (let i = 1; i <= 9; i++) {
      const candidate = `${base}${i}`;
      if (!existingAtDepth.includes(candidate)) return candidate;
    }

    // Fallback
    return (base + "1").substring(0, baseLen);
  };

  const getDescendantIds = useCallback((accountId: string): Set<string> => {
    const descendants = new Set<string>();
    const queue = [accountId];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;
      for (const account of allAccounts) {
        if (account.parent_id === current && !descendants.has(account.id)) {
          descendants.add(account.id);
          queue.push(account.id);
        }
      }
    }

    return descendants;
  }, [allAccounts]);

  const openCreateDialog = () => {
    // Prevent creating children under final (leaf) accounts
    if (selected?.is_final) {
      setError("لا يمكن إضافة حسابات فرعية تحت حساب نهائي (ورقة)");
      return;
    }
    setFormMode("create");
    setError(null);
    // Always use selected account as parent (no level restrictions)
    const targetParent = selected?.id ?? "null";
    setCode(suggestChildCode(selected));
    setNameAr("");
    setParentId(targetParent);
    setPhone("");
    setAddress("");
    setNotes("");
    setOpeningBalance("0");
    setDebit("0");
    setCredit("0");
    setCurrency("SYP");
  };

  const openEditDialog = () => {
    if (!selected || !canEdit) return;
    setFormMode("edit");
    setError(null);
    setCode(selected.code ?? "");
    setNameAr(selected.name_ar ?? "");
    setParentId(selected.parent_id ?? "null");
    setNotes(selected.notes ?? "");
    setOpeningBalance(selected.opening_balance ?? "0");
    // Phone, address etc. are fetched by the useEffect hook
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
    if (!code.trim() || !nameAr.trim()) {
      setError("يرجى تعبئة رقم الحساب واسم الحساب.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const effectiveParentId = parentId === "null" ? null : parentId;
      const targetLevel = resolveLevel(parentId);
      const targetCategory = "Detail" as AccountCategory; // Use Detail for leaves

      if (formMode === "edit" && selected) {
        const payload = {
          code: code.trim(),
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
        };

        await accountingService.updateAccount(selected.id, payload);
      } else {
        const payload = {
          code: code.trim(),
          name_ar: nameAr.trim(),
          name_en: nameAr.trim(),
          account_type: (parentAccount?.account_type ?? selected?.account_type ?? "Assets") as AccountType,
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
        };

        await accountingService.createAccount(payload);
      }

      closeDialog();
      onSaved();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "تعذر حفظ الحساب. حاول مرة أخرى.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const blockedIds = useMemo(() => {
    if (formMode !== "edit" || !selected) return new Set<string>();
    const descendants = getDescendantIds(selected.id);
    descendants.add(selected.id);
    return descendants;
  }, [formMode, selected, getDescendantIds]);

  const formPanel = formMode && (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm text-slate-700">
          {formMode === "edit" ? "تعديل الحساب" : "إضافة حساب جديد"}
        </h4>
        <span className="text-xs text-slate-500">
          {formMode === "edit" ? "تعديل مباشر" : "إدخال سريع"}
        </span>
      </div>

      <div className="space-y-4">
        {error && (
          <div className="bg-red-50 text-red-700 border border-red-200 rounded-md px-3 py-2 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>رقم الحساب</Label>
            <Input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="مثال: 1101"
              className="bg-white"
            />
          </div>

          <div className="space-y-1">
            <Label>اسم الحساب</Label>
            <Input
              value={nameAr}
              onChange={(event) => setNameAr(event.target.value)}
              placeholder="مثال: صندوق فرعي"
              className="bg-white"
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label>فرعي من</Label>
          <div className="rounded-md border border-input bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            {parentId === "null" 
              ? "-- مستوى أول (بدون أب) --"
              : (() => {
                  const parent = allAccounts.find(a => a.id === parentId);
                  return parent ? `${parent.code} - ${parent.name_ar}` : "--";
                })()
            }
          </div>
        </div>

        {/* Advanced Fields for Sync Accounts (Customers/Suppliers) */}
        {isSyncAccount && (
          <div className="pt-2 space-y-4 border-t border-primary/10">
            <p className="text-[10px] font-bold text-primary uppercase tracking-wider">خانات متقدمة ({isCustomer ? "عميل" : "مورد"})</p>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>رقم الهاتف</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="اختياري"
                  className="bg-white"
                />
              </div>
              <div className="space-y-1">
                <Label>العنوان</Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="اختياري"
                  className="bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>مدين</Label>
                <Input
                  type="number"
                  value={debit}
                  onChange={(e) => setDebit(e.target.value)}
                  className="bg-white"
                />
              </div>
              <div className="space-y-1">
                <Label>دائن</Label>
                <Input
                  type="number"
                  value={credit}
                  onChange={(e) => setCredit(e.target.value)}
                  className="bg-white"
                />
              </div>
              <div className="space-y-1">
                <Label>العملة</Label>
                <select 
                  className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  <option value="SYP">SYP - ليرة سورية</option>
                  <option value="USD">USD - دولار أمريكي</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Common Details */}
        <div className="pt-2 space-y-3 border-t border-primary/10">
          <div className="space-y-1">
            <Label>الرصيد الافتتاحي</Label>
            <Input
              type="number"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              className="bg-white"
            />
          </div>
          
          <div className="space-y-1">
            <Label>ملاحظات</Label>
            <textarea
              className="flex min-h-[60px] w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ملاحظات اختيارية..."
            />
          </div>
        </div>
      </div>
    </div>
  );

  if (!selected) {
    return (
      <Card className="p-6 h-fit border-border/60 shadow-sm flex flex-col gap-4 sticky top-6">
        {formMode ? (
          formPanel
        ) : (
          <>
            <h3 className="text-base font-semibold text-slate-700">تفاصيل الحساب</h3>
            <p className="text-sm text-slate-500">
              اختر حسابًا من الشجرة لعرض التفاصيل.
            </p>
          </>
        )}

        <div className="flex gap-2 pt-2">
          {formMode ? (
            <>
              <Button size="sm" variant="outline" onClick={closeDialog} disabled={saving}>
                إلغاء
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? "جاري الحفظ..." : "حفظ"}
              </Button>
            </>
          ) : (
            <>
              <Button 
                size="sm" 
                onClick={openCreateDialog}
                disabled={selected?.is_final}
                title={selected?.is_final ? "لا يمكن إضافة حسابات تحت حساب نهائي" : "إضافة حساب جديد"}
              >
                <Plus className="w-4 h-4 ml-1.5" />
                جديد
              </Button>
              <Button size="sm" variant="outline" onClick={openEditDialog} disabled={!selected || !canEdit}>
                <Edit className="w-4 h-4 ml-1.5" />
                تعديل
              </Button>
              <Button size="sm" variant="outline" onClick={onDelete} disabled={!selected || !canDelete}>
                <Trash2 className="w-4 h-4 ml-1.5" />
                حذف
              </Button>
            </>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 h-fit border-border/60 shadow-sm flex flex-col gap-5 sticky top-6" dir="rtl">
      <div className="grid grid-cols-3 gap-2 pt-1">
        {formMode ? (
          <>
            <Button size="sm" variant="outline" onClick={closeDialog} disabled={saving}>
              إلغاء
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "جاري الحفظ..." : "حفظ"}
            </Button>
            <div />
          </>
        ) : (
          <>
            <Button size="sm" onClick={openCreateDialog}>
              <Plus className="w-4 h-4 ml-1.5" />
              جديد
            </Button>

            <Button size="sm" variant="outline" onClick={openEditDialog} disabled={!canEdit}>
              <Edit className="w-4 h-4 ml-1.5" />
              تعديل
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50"
              onClick={onDelete}
              disabled={!canDelete}
            >
              <Trash2 className="w-4 h-4 ml-1.5" />
              حذف
            </Button>
          </>
        )}
      </div>

      {formMode ? (
        formPanel
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-700">تفاصيل الحساب</h3>
            <span className="text-xs text-slate-400">مستوى {selected.level || 1}</span>
          </div>

          <div className="grid gap-3">
            <div className="rounded-md border bg-slate-50 p-3">
              <p className="text-[11px] text-slate-500 mb-1">رقم الحساب</p>
              <p className="font-semibold tabular-nums text-slate-800">{selected.code}</p>
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
        </>
      )}
    </Card>
  );
}
