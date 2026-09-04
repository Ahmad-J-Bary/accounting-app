import { useMemo, useState, useEffect, useCallback } from "react";
import { Input } from "@shared/ui/input";
import { Textarea } from "@shared/ui/textarea";
import { FieldLabel } from "@widgets/sidebar-shell/FieldLabel";
import { FormPanel } from "@widgets/form-shell/FormPanel";
import { SidebarSection } from "@widgets/sidebar-shell/SidebarSection";
import type { AccountDto } from "@erp/shared-types";
import { accountingService, type AccountCategory, type AccountType } from "@modules/accounting/api/accountingService";
import type { ResolvedTreeNode } from "@shared/tree/nodeTypes";
import { suggestChildCode, resolveLevel } from "../lib/accountCodeSuggestion";

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
  /** Linked-account classification of the edited account (edit mode only). */
  resolved?: ResolvedTreeNode | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

export function AccountForm({
  open,
  mode,
  selected,
  parentAccount,
  allAccounts,
  onClose,
  onSaved,
}: AccountFormProps) {
  const [code, setCode] = useState("");
  const [codeSuffix, setCodeSuffix] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [parentId, setParentId] = useState<string>("null");
  const [notes, setNotes] = useState("");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formParent = useMemo(() => {
    if (mode === "edit" && selected?.parent_id) {
      return allAccounts.find((a) => a.id === selected.parent_id) ?? null;
    }
    return parentAccount;
  }, [mode, selected, parentAccount, allAccounts]);

  const getSuggestedCode = useCallback(
    (account: AccountDto | null): string => suggestChildCode(account, allAccounts),
    [allAccounts],
  );

  // Initialize the form whenever the panel opens with a given mode/target.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setSaving(false);

    if (mode === "create") {
      const parentCode = parentAccount?.code ?? "";
      const fullSuggested = getSuggestedCode(parentAccount);
      const suffix = fullSuggested.startsWith(parentCode)
        ? fullSuggested.substring(parentCode.length)
        : fullSuggested;

      setCode(suffix);
      setCodeSuffix(parentCode);
      setNameAr("");
      setParentId(parentAccount?.id ?? "null");
      setNotes("");
      setOpeningBalance("0");
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
  }, [open, mode, selected, parentAccount, formParent, getSuggestedCode]);

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
      const targetLevel = resolveLevel(parentId, allAccounts);
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
      <div className="space-y-6 text-end">
        {error && (
          <div className="bg-red-50 text-red-700 border border-red-200 rounded-md px-3 py-2 text-sm">
            {error}
          </div>
        )}
        <SidebarSection title="المعلومات الأساسية">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <FieldLabel>رقم الحساب</FieldLabel>
                {codeSuffix ? (
                  <div className="flex gap-1">
                    <Input
                      value={codeSuffix}
                      disabled
                      className="h-9 bg-slate-100 text-slate-500 w-16 text-center"
                      title="الجزء الموروث من الأب ولا يمكن تعديله"
                    />
                    <Input
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="الجزء الفرعي"
                      className="h-9 bg-white flex-1"
                    />
                  </div>
                ) : (
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="مثال: 1101"
                    className="h-9 bg-white"
                  />
                )}
              </div>
              <div className="space-y-1.5">
                <FieldLabel>اسم الحساب</FieldLabel>
                <Input
                  value={nameAr}
                  onChange={(e) => setNameAr(e.target.value)}
                  placeholder="مثال: صندوق فرعي"
                  className="h-9 bg-white"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <FieldLabel>فرعي من</FieldLabel>
              <div className="h-9 rounded-md border border-input bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                {parentId === "null"
                  ? "-- مستوى أول --"
                  : (() => {
                      const parent = allAccounts.find((a) => a.id === parentId);
                      return parent ? `${parent.code} - ${parent.name_ar}` : "--";
                    })()}
              </div>
            </div>
          </div>
        </SidebarSection>



        <div className="space-y-1.5">
          <FieldLabel>ملاحظات</FieldLabel>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="ملاحظات اختيارية..."
            className="min-h-[60px]"
          />
        </div>
      </div>
    </FormPanel>
  );
}