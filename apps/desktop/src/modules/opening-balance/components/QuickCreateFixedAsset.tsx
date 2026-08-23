import { useState } from "react";
import { Plus, Loader2, Calendar, X } from "lucide-react";
import { Input } from "@shared/ui/input";
import { Button } from "@shared/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import type { WarehouseDto } from "@erp/shared-types";

type AssetType = "buildings_land" | "equipment" | "furniture";

const ASSET_TYPE_OPTIONS: { value: AssetType; label: string }[] = [
  { value: "buildings_land", label: "أبنية وأراضي" },
  { value: "equipment", label: "معدات وتجهيزات" },
  { value: "furniture", label: "أثاث ومفروشات" },
];

interface QuickCreateFixedAssetProps {
  warehouses: WarehouseDto[];
  onCreate: (data: {
    name: string;
    cost: string;
    assetType: AssetType;
    purchaseDate: string;
    warehouseId: string | undefined;
  }) => Promise<boolean>;
}

export function QuickCreateFixedAsset({ warehouses, onCreate }: QuickCreateFixedAssetProps) {
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState("");
  const [cost, setCost] = useState("");
  const [assetType, setAssetType] = useState<AssetType>("equipment");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split("T")[0]);
  const [warehouseId, setWarehouseId] = useState<string>("none");
  const [creating, setCreating] = useState(false);

  const showWarehouse = assetType !== "buildings_land";
  const activeWarehouses = warehouses.filter((w) => w.is_active);

  const handleCreate = async () => {
    if (!name.trim() || !cost.trim()) return;
    setCreating(true);
    try {
      const ok = await onCreate({
        name: name.trim(),
        cost: cost.trim(),
        assetType,
        purchaseDate,
        warehouseId: warehouseId === "none" ? undefined : warehouseId,
      });
      if (ok) {
        setName("");
        setCost("");
        setExpanded(false);
      }
    } finally {
      setCreating(false);
    }
  };

  if (!expanded) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setExpanded(true)}
          className="h-8 shrink-0 rounded-full border-emerald-300 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 hover:bg-emerald-100 hover:border-emerald-400 transition-all"
        >
          <Plus className="w-3.5 h-3.5 ml-1" />
          إضافة أصل ثابت
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full rounded-lg border border-emerald-200 bg-emerald-50/60 p-2.5 space-y-2">
      <div className="flex items-center gap-2">
        <Plus className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span className="text-xs font-bold text-emerald-700 shrink-0">أصل ثابت</span>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="اسم الأصل"
          className="h-7 flex-1 min-w-[120px] border-emerald-200 text-xs bg-white"
          disabled={creating}
          autoFocus
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
          className="h-7 w-24 border-emerald-200 text-xs text-right tabular-nums bg-white"
          disabled={creating}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleCreate();
            }
          }}
        />
        <div className="relative">
          <Calendar className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
          <Input
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
            title="تاريخ الحيازة"
            className="h-7 w-36 pl-6 border-emerald-200 text-xs bg-white"
            disabled={creating}
          />
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => void handleCreate()}
          disabled={creating || !name.trim() || !cost.trim()}
          className="h-7 px-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
        >
          {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => { setExpanded(false); setName(""); setCost(""); }}
          className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600 shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
      <div className="flex items-center gap-2 pl-6">
        <Select value={assetType} onValueChange={(v) => setAssetType(v as AssetType)} disabled={creating}>
          <SelectTrigger className="h-7 flex-1 border-emerald-200 text-xs bg-white">
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
        {showWarehouse && activeWarehouses.length > 0 && (
          <Select value={warehouseId} onValueChange={setWarehouseId} disabled={creating}>
            <SelectTrigger className="h-7 flex-1 border-emerald-200 text-xs bg-white">
              <SelectValue placeholder="المستودع" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="text-xs">بدون مستودع</SelectItem>
              {activeWarehouses.map((wh) => (
                <SelectItem key={wh.id} value={wh.id} className="text-xs">
                  {wh.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}
