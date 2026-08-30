import type { CategoryDto } from "@erp/shared-types";

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
  if (!category) return null;

  const displayPrefix = prefix ?? category.code_prefix ?? "";

  return (
    <div className="grid gap-3">
      <div className="rounded-md border bg-slate-50 p-3">
        <p className="text-[11px] text-slate-500 mb-1">اسم التصنيف</p>
        <p className="font-semibold text-slate-800">{category.name}</p>
      </div>
      {displayPrefix && (
        <div className="rounded-md border bg-slate-50 p-3">
          <p className="text-[11px] text-slate-500 mb-1">البادئة</p>
          <p className="font-semibold tabular-nums">{displayPrefix}</p>
        </div>
      )}
    </div>
  );
}