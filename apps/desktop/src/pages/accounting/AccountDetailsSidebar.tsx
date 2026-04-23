import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Edit, Plus, Trash2 } from "lucide-react";
import type { AccountDto } from "@erp/shared-types";

interface AccountDetailsSidebarProps {
  selected: AccountDto | null;
  parentName?: string | null;
  onCreateNew: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function AccountDetailsSidebar({
  selected,
  parentName,
  onCreateNew,
  onEdit,
  onDelete,
}: AccountDetailsSidebarProps) {
  if (!selected) {
    return (
      <Card className="p-6 h-fit border-border/60 shadow-sm flex flex-col gap-4 sticky top-6">
        <h3 className="text-base font-semibold text-slate-700">تفاصيل الحساب</h3>
        <p className="text-sm text-slate-500">
          اختر حسابًا من الشجرة لعرض التفاصيل.
        </p>

        <div className="flex gap-2 pt-2">
          <Button size="sm" onClick={onCreateNew}>
            <Plus className="w-4 h-4 ml-1.5" />
            جديد
          </Button>
          <Button size="sm" variant="outline" disabled>
            <Edit className="w-4 h-4 ml-1.5" />
            تعديل
          </Button>
          <Button size="sm" variant="outline" disabled>
            <Trash2 className="w-4 h-4 ml-1.5" />
            حذف
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 h-fit border-border/60 shadow-sm flex flex-col gap-5 sticky top-6" dir="rtl">
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

      <div className="grid grid-cols-3 gap-2 pt-1">
        <Button size="sm" onClick={onCreateNew}>
          <Plus className="w-4 h-4 ml-1.5" />
          جديد
        </Button>

        <Button size="sm" variant="outline" onClick={onEdit}>
          <Edit className="w-4 h-4 ml-1.5" />
          تعديل
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50"
          onClick={onDelete}
        >
          <Trash2 className="w-4 h-4 ml-1.5" />
          حذف
        </Button>
      </div>
    </Card>
  );
}
