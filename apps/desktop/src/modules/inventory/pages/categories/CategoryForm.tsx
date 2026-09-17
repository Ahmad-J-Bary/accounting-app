import { useState, useEffect, useCallback } from "react";
import { Input } from "@shared/ui/input";
import { Button } from "@shared/ui/button";
import { FieldLabel } from "@widgets/sidebar-shell/FieldLabel";
import { FormPanel } from "@widgets/form-shell/FormPanel";
import { AlertCircle, Shuffle } from "lucide-react";
import type { CategoryDto } from "@erp/shared-types";
import { categoryService } from '@modules/inventory/api/categoryService';
import { toast } from "sonner";
import { useLocalization } from "@app/providers/LocalizationProvider";
import {
  findGeneralSubcategory,
  isGeneralSubcategory,
  isUncategorizedCategory,
  resolveCategoryName,
  resolveUncategorizedPrefix,
} from "@shared/lib/system-labels";

interface CategoryFormProps {
  /** Whether the form panel is open */
  open: boolean;
  /** Create or edit mode (categories only) */
  mode: "create_cat" | "edit_cat";
  /** The category being edited (edit mode only) */
  selected: CategoryDto | null;
  /** Parent category for create mode (null = root category) */
  parentId: string | null;
  /** All categories for duplicate/prefix resolution */
  allCategories: CategoryDto[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

/**
 * Unified category create/edit form rendered inside the shared FormPanel.
 * Ports the category branch of the old CategoryDetailsSidebar: name-uniqueness
 * checks, prefix suggestion, root/general-sub handling and is_active passthrough.
 */
export function CategoryForm({
  open,
  mode,
  selected,
  parentId,
  allCategories,
  onClose,
  onSaved,
}: CategoryFormProps) {
  const { t, language } = useLocalization();
  const [name, setName] = useState("");
  const [codePrefix, setCodePrefix] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isUncategorized = !!selected && isUncategorizedCategory(selected);
  const isSystemGeneralSub = !!selected && isGeneralSubcategory(selected);
  const isRoot = !!selected && !!selected.parent_id === false && !isUncategorized;

  const getGeneralSubPrefix = useCallback((rootId: string) => {
    const generalSub = findGeneralSubcategory(allCategories, rootId);
    return generalSub?.code_prefix || "";
  }, [allCategories]);

  const suggestPrefix = useCallback(() => {
    const isArabic = language === "ar";
    const chars = isArabic ? "أبتثجحخدذرزسشصضطظعغفقكلمنهوي" : "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const existingPrefixes = new Set(allCategories.map((c) => c.code_prefix).filter(Boolean));
    for (const char of chars) { if (!existingPrefixes.has(char)) return char; }
    return "X";
  }, [allCategories, language]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSaving(false);
    if (mode === "edit_cat" && selected) {
      setName(resolveCategoryName(selected, t));
      if (isUncategorized && !selected.code_prefix) setCodePrefix(resolveUncategorizedPrefix(language));
      else if (isRoot) setCodePrefix(getGeneralSubPrefix(selected.id));
      else setCodePrefix(selected.code_prefix || "");
    } else {
      setName("");
      setCodePrefix(mode === "create_cat" ? suggestPrefix() : "");
    }
  }, [open, mode, selected, isRoot, isUncategorized, getGeneralSubPrefix, suggestPrefix, language, t]);

  const handleSave = async () => {
    if (!name.trim()) { setError(t("categories.form.nameRequired", { namespace: "inventory",  })); return; }

    const trimmedName = name.trim();
    if (codePrefix.trim().length === 0 && mode === "create_cat") {
      setError(t("categories.form.prefixRequired", { namespace: "inventory",  })); return;
    }

    setSaving(true);
    setError(null);
    try {
      if (mode === "create_cat") {
        if (parentId) {
          if (allCategories.some((c) => c.parent_id === parentId && c.name === trimmedName)) {
            setError(t("categories.form.duplicateSub", { namespace: "inventory", vars: { name: trimmedName },  }));
            return;
          }
        } else {
          if (allCategories.some((c) => !c.parent_id && c.name === trimmedName && !isUncategorizedCategory(c))) {
            setError(t("categories.form.duplicateRoot", { namespace: "inventory", vars: { name: trimmedName },  }));
            return;
          }
        }
        await categoryService.createCategory({
          name: trimmedName,
          parent_id: parentId || undefined,
          code_prefix: codePrefix.trim().toUpperCase() || null,
        });
        toast.success(t("categories.form.categoryCreated", { namespace: "inventory",  }));
      } else if (mode === "edit_cat" && selected) {
        if (isRoot) {
          if (allCategories.some((c) => !c.parent_id && c.name === trimmedName && !isUncategorizedCategory(c) && c.id !== selected.id)) {
            setError(t("categories.form.duplicateRoot", { namespace: "inventory", vars: { name: trimmedName },  }));
            return;
          }
          await categoryService.updateCategory({
            id: selected.id,
            name: trimmedName,
            is_active: selected.is_active,
            code_prefix: null,
          });
          const generalSub = findGeneralSubcategory(allCategories, selected.id);
          if (generalSub) {
            await categoryService.updateCategory({
              id: generalSub.id,
              name: trimmedName,
              is_active: generalSub.is_active,
              code_prefix: codePrefix.trim().toUpperCase() || null,
            });
          }
        } else {
          const siblingParent = parentId || selected.parent_id;
          const effectiveName = isSystemGeneralSub
            ? allCategories.find((c) => c.id === siblingParent)?.name ?? selected.name
            : trimmedName;

          if (
            siblingParent &&
            allCategories.some((c) => c.parent_id === siblingParent && c.name === effectiveName && c.id !== selected.id)
          ) {
            setError(t("categories.form.duplicateSub", { namespace: "inventory", vars: { name: trimmedName },  }));
            return;
          }
          await categoryService.updateCategory({
            id: selected.id,
            name: effectiveName,
            parent_id: parentId || undefined,
            is_active: selected.is_active,
            code_prefix: codePrefix.trim().toUpperCase() || null,
          });
        }
        toast.success(t("categories.form.categoryUpdated", { namespace: "inventory",  }));
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("categories.form.failed", { namespace: "inventory",  }));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const prefixLabel = isRoot
    ? t("categories.form.prefixLabelGeneralSub", { namespace: "inventory",  })
    : t("categories.form.prefixLabel", { namespace: "inventory",  });

  return (
    <FormPanel
      title={mode === "edit_cat"
        ? t("categories.form.editTitle", { namespace: "inventory",  })
        : t("categories.form.createTitle", { namespace: "inventory",  })}
      icon={<span className="text-xl">{mode === "edit_cat" ? "✎" : "＋"}</span>}
      onClose={onClose}
      onSave={handleSave}
      isSaving={saving}
      saveDisabled={!name.trim()}
      saveLabel={mode === "edit_cat"
        ? t("categories.form.saveEdit", { namespace: "inventory",  })
        : t("categories.form.saveCreate", { namespace: "inventory",  })}
    >
      <div className="space-y-4">
        {error && (
          <div className="bg-red-50 text-red-700 border border-red-200 rounded-md px-3 py-2 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}
        <div className="space-y-1">
          <FieldLabel>{t("categories.details.categoryName", { namespace: "inventory",  })}</FieldLabel>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("categories.form.namePlaceholder", { namespace: "inventory",  })}
            className="bg-card"
            disabled={(isUncategorized || isSystemGeneralSub) && mode === "edit_cat"}
          />
        </div>
        <div className="space-y-1">
          <FieldLabel>{prefixLabel}</FieldLabel>
          <div className="flex gap-2">
            <Input
              value={codePrefix}
              onChange={(e) => setCodePrefix(e.target.value.slice(0, 1).toUpperCase())}
              placeholder="A"
              className="bg-card font-mono text-center"
              maxLength={1}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setCodePrefix(suggestPrefix())}
              title={t("categories.form.suggestPrefix", { namespace: "inventory",  })}
            >
              <Shuffle className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </FormPanel>
  );
}
