import { useState, useEffect } from "react";
import { Plus, Loader2, AlertTriangle } from "lucide-react";
import { Input } from "@shared/ui/input";
import { Button } from "@shared/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import type { AssetCategoryDto } from "@erp/shared-types";

interface QuickCreateFixedAssetProps {
  categories: AssetCategoryDto[];
  onCreate: (data: {
    name: string;
    cost: string;
    categoryId: string;
  }) => Promise<boolean>;
}

/**
 * Quick-create a fixed asset inline: name + cost + category.
 * Used in opening-balance wizard stage 4.
 */
export function QuickCreateFixedAsset({ categories, onCreate }: QuickCreateFixedAssetProps) {
  const [name, setName] = useState("");
  const [cost, setCost] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [creating, setCreating] = useState(false);

  // Auto-select first category when categories load or change
  useEffect(() => {
    if (categories.length > 0 && !categoryId) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId]);

  const handleCreate = async () => {
    if (!name.trim() || !cost.trim() || !categoryId) return;
    setCreating(true);
    try {
      const ok = await onCreate({ name: name.trim(), cost: cost.trim(), categoryId });
      if (ok) {
        setName("");
        setCost("");
      }
    } finally {
      setCreating(false);
    }
  };

  if (categories.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-2">
        <div className="text-xs font-bold text-amber-700 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" />
          إنشاء أصل ثابت
        </div>
        <p className="text-xs text-amber-600">
          يجب إنشاء فئة أصول ثابتة أولاً من صفحة الأصول الثابتة قبل إنشاء أصل جديد.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 space-y-2">
      <div className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
        <Plus className="w-3.5 h-3.5" />
        إنشاء أصل ثابت
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="اسم الأصل"
          className="h-8 flex-1 min-w-[120px] border-emerald-200 text-xs bg-white"
          disabled={creating}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              document.getElementById("quick-create-fa-cost")?.focus();
            }
          }}
        />
        <Input
          id="quick-create-fa-cost"
          type="number"
          min={0}
          step="0.01"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          placeholder="التكلفة"
          className="h-8 w-28 border-emerald-200 text-xs text-right tabular-nums bg-white"
          disabled={creating}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleCreate();
            }
          }}
        />
        <Select value={categoryId} onValueChange={setCategoryId} disabled={creating}>
          <SelectTrigger className="h-8 w-40 border-emerald-200 text-xs bg-white">
            <SelectValue placeholder="اختر الفئة" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id} className="text-xs">
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="sm"
          onClick={() => void handleCreate()}
          disabled={creating || !name.trim() || !cost.trim() || !categoryId}
          className="h-8 px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          إنشاء
        </Button>
      </div>
    </div>
  );
}
