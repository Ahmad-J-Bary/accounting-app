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
    if (!name.trim()) { toast.error(t("materials.addUnit.nameRequired", { namespace: "inventory", fallback: "اسم الوحدة مطلوب" })); return; }
    const trimmedLower = name.trim();
    if (existingNames?.some(n => n.toLowerCase() === trimmedLower.toLowerCase())) {
      toast.error(t("materials.addUnit.duplicateName", { namespace: "inventory", fallback: "يوجد وحدة بنفس الاسم مسبقاً" }));
      return;
    }
    const factorNum = parseFloat(factor);
    if (isNaN(factorNum) || factorNum <= 0) { toast.error(t("materials.addUnit.factorPositive", { namespace: "inventory", fallback: "معامل التعبئة يجب أن يكون أكبر من صفر" })); return; }

    setLoading(true);
    try {
      await onAdd({ name: name.trim(), conversion_factor: factor, barcode: barcode.trim() });
      resetForm();
      onCancel();
    } catch (err) {
      toast.error(t("materials.addUnit.addFailed", { namespace: "inventory", vars: { error: String(err) }, fallback: "فشل إضافة الوحدة: " + err }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50/20 relative transition-all shadow-sm space-y-3 text-right">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-200 flex items-center justify-center">
          <Package className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <span className="text-xs font-bold text-blue-700 block">{t("materials.addUnit.title", { namespace: "inventory", fallback: "إضافة وحدة قياس جديدة" })}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label className="text-[11px] font-bold text-slate-700">{t("materials.addUnit.name", { namespace: "inventory", fallback: "اسم الوحدة" })} <span className="text-red-500">*</span></Label>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t("materials.addUnit.namePlaceholder", { namespace: "inventory", fallback: "مثلاً: طرد، دزينة" })}
            className="h-8 text-sm bg-white"
            dir="rtl"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] font-bold text-slate-700">{t("materials.form.manageUnits", { namespace: "inventory", fallback: "معامل التعبئة" })} <span className="text-red-500">*</span></Label>
          <Input
            type="number"
            value={factor}
            onChange={e => setFactor(e.target.value)}
            placeholder={t("materials.addUnit.factorPlaceholder", { namespace: "inventory", fallback: "مثلاً: 12" })}
            className="h-8 text-sm font-bold bg-white"
            min="0.000001"
            step="any"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] font-bold text-slate-700">{t("materials.addUnit.barcodeOptional", { namespace: "inventory", fallback: "الباركود (اختياري)" })}</Label>
          <Input
            value={barcode}
            onChange={e => setBarcode(e.target.value)}
            placeholder={t("materials.export.barcode", { namespace: "inventory", fallback: "باركود الوحدة" })}
            className="h-8 text-sm font-mono bg-white"
            dir="ltr"
          />
        </div>
      </div>

      {name && (
        <div className="bg-blue-50 rounded-md p-3 border border-blue-100 flex items-center gap-3">
          <Package className="w-4 h-4 text-blue-500 shrink-0" />
          <div>
            <p className="text-[10px] text-blue-400 font-bold uppercase">{t("materials.addUnit.willBeAdded", { namespace: "inventory", fallback: "ستُضاف للمادة" })}</p>
            <p className="text-xs font-bold text-blue-700">{materialName}</p>
          </div>
          <div className="text-left mr-auto">
            <p className="text-[9px] text-slate-500">{t("materials.addUnit.equivalence", { namespace: "inventory", fallback: "معامل التعادل" })}</p>
            <p className="text-sm font-mono text-blue-700">1 {name} = {factor || "1"} {baseUnitName}</p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 justify-end pt-1">
        <Button type="button" size="sm" variant="ghost" onClick={() => { resetForm(); onCancel(); }} className="h-8 text-xs font-bold">{t("labels.cancel", { namespace: "inventory", fallback: "إلغاء" })}</Button>
        <Button type="button" size="sm" onClick={handleAdd} disabled={loading || !name.trim()} className="h-8 text-xs font-bold bg-blue-600 hover:bg-blue-700 gap-1.5 px-4">
          {loading ? t("materials.addUnit.adding", { namespace: "inventory", fallback: "جاري الإضافة..." }) : t("materials.addUnit.addBtn", { namespace: "inventory", fallback: "أضف الوحدة" })}
        </Button>
      </div>
    </div>
  );
}
