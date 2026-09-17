import type { CategoryDto } from "@erp/shared-types";
import { useLocalization } from "@app/providers/LocalizationProvider";
import { resolveCategoryName } from "@shared/lib/system-labels";

interface CategoryDetailsPanelProps {
  /** Selected category (real node only, never the virtual root). */
  category: CategoryDto | null;
  /** Optional resolved prefix (root categories keep it on their «عام» sub). */
  prefix?: string;
}

/**
 * Read-only detail view for a category node.
 * Ports the category branch of the old CategoryDetailsSidebar details view:
 * name + resolved prefix. Actions live in the page toolbar now.
 */
export function CategoryDetailsPanel({ category, prefix }: CategoryDetailsPanelProps) {
  const { t } = useLocalization();
  if (!category) return null;

  const displayPrefix = prefix ?? category.code_prefix ?? "";
  const displayName = resolveCategoryName(category, t);

  return (
    <div className="grid gap-3">
      <div className="rounded-md border bg-muted p-3">
        <p className="text-[11px] text-muted-foreground mb-1">{t("categories.details.categoryName", { namespace: "inventory",  })}</p>
        <p className="font-semibold text-foreground">{displayName}</p>
      </div>
      {displayPrefix && (
        <div className="rounded-md border bg-muted p-3">
          <p className="text-[11px] text-muted-foreground mb-1">{t("categories.details.prefix", { namespace: "inventory",  })}</p>
          <p className="font-semibold tabular-nums">{displayPrefix}</p>
        </div>
      )}
    </div>
  );
}
