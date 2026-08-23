import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Input } from "@shared/ui/input";
import { Button } from "@shared/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";

type AssetType = "buildings_land" | "equipment" | "furniture";

const ASSET_TYPE_OPTIONS: { value: AssetType; label: string }[] = [
  { value: "buildings_land", label: "أبنية وأراضي" },
  { value: "equipment", label: "معدات وتجهيزات" },
  { value: "furniture", label: "أثاث ومفروشات" },
];

interface QuickCreateFixedAssetProps {
  onCreate: (data: {
    name: string;
    cost: string;
    assetType: AssetType;
  }) => Promise<boolean>;
}

/**
 * Quick-create a fixed asset inline: name + cost + asset type.
 * Used in opening-balance wizard stage 4.
 */
export function QuickCreateFixedAsset({ onCreate }: QuickCreateFixedAssetProps) {
  const [name, setName] = useState("");
  const [cost, setCost] = useState("");
  const [assetType, setAssetType] = useState<AssetType>("equipment");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || !cost.trim()) return;
    setCreating(true);
    try {
      const ok = await onCreate({ name: name.trim(), cost: cost.trim(), assetType });
      if (ok) {
        setName("");
        setCost("");
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="w-full rounded-lg border border-emerald-200 bg-emerald-50/60 p-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Plus className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span className="text-xs font-bold text-emerald-700 shrink-0">أصل ثابت</span>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="اسم الأصل"
          className="h-7 flex-1 min-w-[120px] border-emerald-200 text-xs bg-white"
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
          className="h-7 w-28 border-emerald-200 text-xs text-right tabular-nums bg-white"
          disabled={creating}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleCreate();
            }
          }}
        />
        <Select value={assetType} onValueChange={(v) => setAssetType(v as AssetType)} disabled={creating}>
          <SelectTrigger className="h-7 w-36 border-emerald-200 text-xs bg-white">
            <SelectValue placeholder="نوع الأصل" />
          </SelectTrigger>
          <SelectContent>
            {ASSET_TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="sm"
          onClick={() => void handleCreate()}
          disabled={creating || !name.trim() || !cost.trim()}
          className="h-7 px-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
        >
          {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
        </Button>
      </div>
    </div>
  );
}
