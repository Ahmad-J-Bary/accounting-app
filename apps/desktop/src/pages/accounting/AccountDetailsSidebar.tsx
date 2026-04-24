import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Edit, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  }, [selected?.id]);

  const summaryAccounts = useMemo(
    () =>
      allAccounts.filter(
        (account) => account.category === "Summary" || (account.level ?? 1) <= 2,
      ),
    [allAccounts],
  );

  const suggestChildCode = (account: AccountDto | null): string => {
    if (!account) return "";
    const base = account.code ?? "";
    if (base.length === 0) return "";
    return `${base}01`;
  };

  const getDescendantIds = (accountId: string): Set<string> => {
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
  };

  const openCreateDialog = () => {
    setFormMode("create");
    setError(null);
    const targetParent =
      selected && (selected.level ?? 1) >= 3 ? selected.parent_id : selected?.id;
    setCode(suggestChildCode(selected));
    setNameAr("");
    setParentId(targetParent ?? "null");
  };

  const openEditDialog = () => {
    if (!selected || !canEdit) return;
    setFormMode("edit");
    setError(null);
    setCode(selected.code ?? "");
    setNameAr(selected.name_ar ?? "");
    setParentId(selected.parent_id ?? "null");
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
      if (targetLevel > 3) {
        setError("الحد الأقصى لعمق الشجرة هو المستوى الثالث.");
        return;
      }
      const targetCategory = (targetLevel <= 2 ? "Summary" : "Detail") as AccountCategory;

      if (formMode === "edit" && selected) {
        const payload = {
          code: code.trim(),
          name_ar: nameAr.trim(),
          name_en: selected.name_en,
          account_type: selected.account_type as AccountType,
          parent_id: effectiveParentId,
          category: targetCategory,
          level: targetLevel,
          opening_balance: selected.opening_balance ?? "0",
          notes: selected.notes ?? null,
          is_default: selected.is_default,
          is_active: selected.is_active,
        };

        await accountingService.updateAccount(selected.id, payload);
      } else {
        const parentAccount =
          effectiveParentId === null
            ? null
            : allAccounts.find((account) => account.id === effectiveParentId) ?? null;

        const payload = {
          code: code.trim(),
          name_ar: nameAr.trim(),
          name_en: nameAr.trim(),
          account_type: (parentAccount?.account_type ?? selected?.account_type ?? "Assets") as AccountType,
          parent_id: effectiveParentId,
          category: targetCategory,
          level: targetLevel,
          opening_balance: "0",
          notes: null,
          is_default: false,
          is_active: true,
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
  }, [formMode, selected, allAccounts]);

  const parentOptions = summaryAccounts.filter((account) => {
    if ((account.level ?? 1) >= 3) return false;
    if (blockedIds.has(account.id)) return false;
    return true;
  });

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

        <div className="space-y-1">
          <Label>رقم الحساب</Label>
          <Input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="مثال: 1101"
          />
        </div>

        <div className="space-y-1">
          <Label>اسم الحساب</Label>
          <Input
            value={nameAr}
            onChange={(event) => setNameAr(event.target.value)}
            placeholder="مثال: صندوق فرعي"
          />
        </div>

        <div className="space-y-1">
          <Label>فرعي من</Label>
          <Select value={parentId} onValueChange={setParentId}>
            <SelectTrigger>
              <SelectValue placeholder="بدون حساب أب" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="null">-- مستوى أول (بدون أب) --</SelectItem>
              {parentOptions.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.code} - {account.name_ar}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Removed inline bottom action buttons. Use header/form actions instead. */}
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
              <Button size="sm" onClick={openCreateDialog}>
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
