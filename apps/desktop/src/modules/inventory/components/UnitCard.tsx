import { useState } from "react";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Plus, Package, Boxes, ChevronDown, Pencil, Check } from "lucide-react";
import { cn } from "@shared/lib/utils";

interface UnitItem {
  name: string;
  conversion_factor: string;
  barcode: string;
}

interface UnitCardProps {
  unit: UnitItem;
  index: number;
  isBase: boolean;
  baseUnitName?: string;
  mode: "view" | "edit";
  onUpdate?: (field: string, value: string) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onCancelEdit?: () => void;
  deleteDisabled?: boolean;
  disabled?: boolean;
  showDeleteOnHover?: boolean;
  defaultCollapsed?: boolean;
}

export function UnitCard({
  unit, index, isBase, baseUnitName, mode,
  onUpdate, onEdit, onDelete, onCancelEdit, deleteDisabled, disabled,
  showDeleteOnHover = false,
  defaultCollapsed = false,
}: UnitCardProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const deleteBtn = onDelete ? (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onDelete}
      disabled={deleteDisabled}
      className={cn(
        "absolute -left-2 -top-2 h-7 w-7 rounded-full bg-red-50 text-red-500 hover:bg-red-100 border border-red-100 shadow-sm z-10",
        showDeleteOnHover && "opacity-0 group-hover:opacity-100 transition-opacity"
      )}
    >
      <Plus className="w-3.5 h-3.5 rotate-45" />
    </Button>
  ) : null;

  // Collapsed state — works for both view and edit modes
  if (collapsed) {
    return (
      <div className={cn(
        "p-4 rounded-2xl border relative transition-all shadow-sm bg-white group",
        isBase ? "border-blue-200 bg-blue-50/20" : "border-slate-200/80"
      )}>
        {deleteBtn}
        <div className="flex items-center gap-3">
          <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", isBase ? "bg-blue-600 text-white shadow-md shadow-blue-200" : "bg-slate-100 text-slate-500")}>
            {isBase ? <Package className="w-4 h-4" /> : <Boxes className="w-4 h-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-bold text-sm text-slate-700">{unit.name}</span>
            {isBase && <span className="text-blue-600 font-bold text-xs mr-1">(أساسية)</span>}
            <span className="text-[11px] text-slate-500 block truncate">1 {unit.name} = {unit.conversion_factor} {baseUnitName || unit.name}</span>
          </div>
          {unit.barcode && mode === "view" && (
            <span className="text-[9px] font-mono text-slate-400 shrink-0 hidden sm:inline">{unit.barcode}</span>
          )}
          <div className="flex items-center gap-1 shrink-0">
            {mode === "edit" && !onCancelEdit && (
              <button
                type="button"
                onClick={() => setCollapsed(false)}
                className="w-6 h-6 rounded-full bg-slate-100/70 flex items-center justify-center hover:bg-slate-200/70 transition-colors"
              >
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 -rotate-90" />
              </button>
            )}
            {mode === "view" && onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="w-6 h-6 rounded-full bg-blue-50/70 flex items-center justify-center hover:bg-blue-100/70 transition-colors"
                title="تعديل الوحدة"
              >
                <Pencil className="w-3 h-3 text-blue-500" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Expanded — view mode
  if (mode === "view") {
    return (
      <div className="p-4 rounded-2xl border border-slate-200/80 relative transition-all shadow-sm space-y-3 text-right bg-white group">
        {deleteBtn}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
            <Boxes className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <span className="font-bold text-sm text-slate-700 block">{unit.name}</span>
            <span className="text-[11px] text-slate-500">1 {unit.name} = {unit.conversion_factor} {baseUnitName || unit.name}</span>
          </div>
          {unit.barcode && (
            <span className="text-[9px] font-mono text-slate-400 shrink-0">{unit.barcode}</span>
          )}
        </div>
      </div>
    );
  }

  // Expanded — edit mode
  return (
    <div className={cn(
      "p-4 rounded-2xl border relative transition-all shadow-sm space-y-3 text-right bg-white group",
      isBase ? "border-blue-200 bg-blue-50/20" : "border-slate-200/80"
    )}>
      {deleteBtn}

      {onCancelEdit ? (
        <button
          type="button"
          onClick={onCancelEdit}
          className="absolute left-3 top-3 w-6 h-6 rounded-full bg-green-50 flex items-center justify-center hover:bg-green-100 transition-colors z-10 border border-green-200"
          title="حفظ"
        >
          <Check className="w-3.5 h-3.5 text-green-600" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="absolute left-3 top-3 w-6 h-6 rounded-full bg-slate-100/70 flex items-center justify-center hover:bg-slate-200/70 transition-colors z-10"
        >
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </button>
      )}

      <div className="flex items-center gap-3">
        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", isBase ? "bg-blue-600 text-white shadow-md shadow-blue-200" : "bg-slate-100 text-slate-500")}>
          {isBase ? <Package className="w-4 h-4" /> : <Boxes className="w-4 h-4" />}
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-bold mb-1">
            <span className="text-slate-500">اسم الوحدة </span>
            {isBase && <span className="text-blue-600 font-bold">(أساسية)</span>}
          </p>
          <Input
            value={unit.name}
            onChange={e => onUpdate?.("name", e.target.value)}
            className="h-8 font-bold bg-white"
            placeholder="مثلاً: قطعة"
            disabled={disabled}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold text-slate-500">معامل التعبئة</p>
          <Input
            type="number"
            value={unit.conversion_factor}
            onChange={e => onUpdate?.("conversion_factor", e.target.value)}
            className="h-8 font-mono bg-white"
            disabled={disabled}
            min="0"
            step="any"
          />
          {isBase && <p className="text-[8px] text-blue-500 font-bold mt-0.5">دائماً 1 للوحدة الأساسية</p>}
        </div>
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold text-slate-500">باركود الوحدة</p>
          <Input
            value={unit.barcode}
            onChange={e => onUpdate?.("barcode", e.target.value)}
            className="h-8 font-mono text-xs bg-white"
            placeholder="اختياري"
            dir="ltr"
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}
