import { ReactNode } from "react";
import { Card } from "@shared/ui/card";
import { Button } from "@shared/ui/button";
import { Plus, Edit, Trash2 } from "lucide-react";

interface TreeSidebarProps {
  title: string;
  subtitle?: string;
  selected: unknown | null;
  formMode: "create" | "edit" | null;
  onOpenCreate: () => void;
  onOpenEdit: () => void;
  onDelete: () => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  canEdit: boolean;
  canDelete: boolean;
  children: ReactNode; // Form fields or details view
  formPanel?: ReactNode;
  level?: number;
  disableNew?: boolean;
  newButtonLabel?: string;
}

export function TreeSidebar({
  title,
  subtitle,
  selected,
  formMode,
  onOpenCreate,
  onOpenEdit,
  onDelete,
  onCancel,
  onSave,
  saving,
  canEdit,
  canDelete,
  children,
  formPanel,
  level,
  disableNew,
  newButtonLabel
}: TreeSidebarProps) {
  return (
    <Card className="p-5 h-fit border-border/60 shadow-sm flex flex-col gap-5 sticky top-6" dir="rtl">
      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {formMode ? (
          <>
            <Button size="sm" variant="outline" onClick={onCancel} disabled={saving} className="flex-1">
              إلغاء
            </Button>
            <Button size="sm" onClick={onSave} disabled={saving} className="flex-1">
              {saving ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" onClick={onOpenCreate} disabled={disableNew && !newButtonLabel} className="flex-1 whitespace-nowrap min-w-fit">
              <Plus className="w-4 h-4 ml-1.5 shrink-0" />
              {newButtonLabel || "جديد"}
            </Button>
            <Button size="sm" variant="outline" onClick={onOpenEdit} disabled={!canEdit} className="whitespace-nowrap">
              <Edit className="w-4 h-4 ml-1.5 shrink-0" />
              تعديل
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50 whitespace-nowrap"
              onClick={onDelete}
              disabled={!canDelete}
            >
              <Trash2 className="w-4 h-4 ml-1.5 shrink-0" />
              حذف
            </Button>
          </>
        )}
      </div>

      {formMode ? (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm text-slate-700">
              {formMode === "edit" ? "تعديل البيانات" : "إضافة جديد"}
            </h4>
          </div>
          {formPanel}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-700">{title}</h3>
            {level !== undefined && (
              <span className="text-xs text-slate-400">مستوى {level}</span>
            )}
          </div>
          <div className="grid gap-3">
            {children}
          </div>
        </>
      )}
    </Card>
  );
}
