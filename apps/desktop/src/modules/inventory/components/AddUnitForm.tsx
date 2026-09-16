import { useState } from "react";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { Package } from "lucide-react";
import { toast } from "sonner";
import { useLocalization } from "@app/providers/LocalizationProvider";

interface AddUnitFormProps {
  baseUnitName: string;
  materialName: string;
  existingNames?: string[];
  onAdd: (unit: { name: string; conversion_factor: string; barcode: string }) => Promise<void>;
  onCancel: () => void;
}

export function AddUnitForm({ baseUnitName, materialName, existingNames, onAdd, onCancel }: AddUnitFormProps) {
  const { t } = useLocalization();
  const [name, setName] = useState("");
  const [factor, setFactor] = useState("1");
  const [barcode, setBarcode] = useState("");
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setName("");
    setFactor("1");
    setBarcode("");
  };

  const handleAdd = async () => {
    if (!name.trim()) { toast.error(t("materials.addUnit.nameRequired", { namespace: "inventory",  })); return; }
    const trimmedLower = name.trim();
    if (existingNames?.some(n => n.toLowerCase() === trimmedLower.toLowerCase())) {
      toast.error(t("materials.addUnit.duplicateName", { namespace: "inventory",  }));
      return;
    }
    const factorNum = parseFloat(factor);
    if (isNaN(factorNum) || factorNum <= 0) { toast.error(t("materials.addUnit.factorPositive", { namespace: "inventory",  })); return; }

    setLoading(true);
    try {
      await onAdd({ name: name.trim(), conversion_factor: factor, barcode: barcode.trim() });
      resetForm();
      onCancel();
    } catch (err) {
      toast.error(t("materials.addUnit.addFailed", { namespace: "inventory", vars: { error: String(err) } }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 rounded-2xl border border-primary/20 bg-primary/10 relative transition-all shadow-sm space-y-3 text-right">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary text-white shadow-md shadow-primary/20 flex items-center justify-center">
          <Package className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <span className="text-xs font-bold text-primary block">{t("materials.addUnit.title", { namespace: "inventory",  })}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label className="text-[11px] font-bold text-foreground">{t("materials.addUnit.name", { namespace: "inventory",  })} <span className="text-red-500">*</span></Label>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t("materials.addUnit.namePlaceholder", { namespace: "inventory",  })}
            className="h-8 text-sm bg-white"
            dir="rtl"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] font-bold text-foreground">{t("materials.form.manageUnits", { namespace: "inventory",  })} <span className="text-red-500">*</span></Label>
          <Input
            type="number"
            value={factor}
            onChange={e => setFactor(e.target.value)}
            placeholder={t("materials.addUnit.factorPlaceholder", { namespace: "inventory",  })}
            className="h-8 text-sm font-bold bg-white"
            min="0.000001"
            step="any"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] font-bold text-foreground">{t("materials.addUnit.barcodeOptional", { namespace: "inventory",  })}</Label>
          <Input
            value={barcode}
            onChange={e => setBarcode(e.target.value)}
            placeholder={t("materials.addUnit.barcodeOptional", { namespace: "inventory",  })}
            className="h-8 text-sm font-mono bg-white"
            dir="ltr"
          />
        </div>
      </div>

      {name && (
        <div className="bg-primary/10 rounded-md p-3 border border-primary/10 flex items-center gap-3">
          <Package className="w-4 h-4 text-primary shrink-0" />
          <div>
            <p className="text-[10px] text-muted-foreground font-bold uppercase">{t("materials.addUnit.willBeAdded", { namespace: "inventory",  })}</p>
            <p className="text-xs font-bold text-primary">{materialName}</p>
          </div>
          <div className="text-left mr-auto">
            <p className="text-[9px] text-muted-foreground">{t("materials.addUnit.equivalence", { namespace: "inventory",  })}</p>
            <p className="text-sm font-mono text-primary">1 {name} = {factor || "1"} {baseUnitName}</p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 justify-end pt-1">
        <Button type="button" size="sm" variant="ghost" onClick={() => { resetForm(); onCancel(); }} className="h-8 text-xs font-bold">{t("labels.cancel", { namespace: "inventory",  })}</Button>
        <Button type="button" size="sm" onClick={handleAdd} disabled={loading || !name.trim()} className="h-8 text-xs font-bold bg-primary hover:bg-primary/80 gap-1.5 px-4">
          {loading ? t("materials.addUnit.adding", { namespace: "inventory",  }) : t("materials.addUnit.addBtn", { namespace: "inventory",  })}
        </Button>
      </div>
    </div>
  );
}
