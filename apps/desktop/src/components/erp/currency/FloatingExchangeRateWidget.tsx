import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, RefreshCw, Save } from "lucide-react";
import { useCurrencyContext } from "@/context/CurrencyContext";

export function FloatingExchangeRateWidget() {
  const {
    loading,
    baseCurrency,
    currencies,
    todayStatus,
    setRateForToday,
    displayCurrencyCode,
    setDisplayCurrencyCode,
    hasTodayRate,
  } = useCurrencyContext();

  const [selectedCode, setSelectedCode] = useState<string>("");
  const [rate, setRate] = useState<string>("1");
  const [saving, setSaving] = useState(false);

  const nonBase = useMemo(
    () => currencies.filter((c) => !c.is_base && c.is_active),
    [currencies]
  );

  const currentCode = selectedCode || nonBase[0]?.code || "";
  const selectedStatus = todayStatus.find((s) => s.currency_code === currentCode);
  const hasRateToday = hasTodayRate(currentCode);

  const handleSelect = (code: string) => {
    setSelectedCode(code);
    const status = todayStatus.find((s) => s.currency_code === code);
    setRate(status?.rate ?? status?.last_rate ?? "1");
  };

  const handleSave = async () => {
    if (!currentCode || !rate) return;
    setSaving(true);
    try {
      await setRateForToday({ toCurrency: currentCode, rate, rateType: "Middle", source: "Widget" });
    } finally {
      setSaving(false);
    }
  };

  if (!baseCurrency || loading) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 w-[340px] rounded-xl border border-slate-200 bg-white/95 backdrop-blur shadow-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold text-slate-700">سعر الصرف العائم</div>
        {hasRateToday ? (
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100">محدث اليوم</Badge>
        ) : (
          <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50">
            <AlertTriangle className="w-3 h-3 ml-1" />
            غير محدث
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-12 gap-2 items-center">
        <div className="col-span-5">
          <Select value={currentCode} onValueChange={handleSelect}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="العملة" />
            </SelectTrigger>
            <SelectContent>
              {nonBase.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.name_ar} ({c.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-4">
          <Input
            className="h-8 text-left text-xs tabular-nums"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            type="number"
            min="0"
            step="0.0001"
          />
        </div>

        <div className="col-span-3">
          <Button className="w-full h-8 text-xs" onClick={handleSave} disabled={saving || !currentCode}>
            {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          </Button>
        </div>
      </div>

      <div className="text-[11px] text-slate-500">
        1 {baseCurrency.code} = {selectedStatus?.rate ?? selectedStatus?.last_rate ?? "—"} {currentCode || "—"}
      </div>

      <div className="flex items-center gap-2 border-t border-slate-100 pt-2">
        <span className="text-[10px] text-slate-500">عملة العرض:</span>
        <Select value={displayCurrencyCode ?? baseCurrency.code} onValueChange={setDisplayCurrencyCode}>
          <SelectTrigger className="h-7 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {currencies.filter((c) => c.is_active).map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.name_ar} ({c.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
