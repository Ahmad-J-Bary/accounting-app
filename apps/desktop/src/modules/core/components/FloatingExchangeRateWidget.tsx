import { useMemo, useState, useEffect } from "react";
import Draggable from "react-draggable";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { Badge } from "@shared/ui/badge";
import { AlertTriangle, RefreshCw, Save, GripVertical, X } from "lucide-react";
import { useCurrencyContext } from "@app/providers/CurrencyProvider";

interface FloatingExchangeRateWidgetProps {
  isVisible: boolean;
  onClose: () => void;
}

export function FloatingExchangeRateWidget({ isVisible, onClose }: FloatingExchangeRateWidgetProps) {
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
  const [position, setPosition] = useState({ x: 20, y: -20 }); // Relative to bottom-left

  // Persistence
  useEffect(() => {
    const saved = localStorage.getItem("exchange-widget-pos");
    if (saved) {
      try {
        setPosition(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load widget position", e);
      }
    }
  }, []);

  const handleStop = (_e: unknown, data: { x: number; y: number }) => {
    const newPos = { x: data.x, y: data.y };
    setPosition(newPos);
    localStorage.setItem("exchange-widget-pos", JSON.stringify(newPos));
  };

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

  if (!baseCurrency || loading || !isVisible) return null;

  return (
    <Draggable
      handle=".drag-handle"
      defaultPosition={position}
      position={position}
      onStop={handleStop}
    >
      <div className="fixed bottom-4 left-4 z-50 w-[340px] rounded-xl border border-slate-200 bg-white/95 backdrop-blur shadow-xl p-3 space-y-2 cursor-default select-none">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2 drag-handle cursor-grab active:cursor-grabbing p-1 -m-1 hover:bg-slate-50 rounded transition-colors">
            <GripVertical className="w-3.5 h-3.5 text-slate-400" />
            <div className="text-[11px] font-black text-slate-800 uppercase tracking-wider">سعر الصرف العائم</div>
          </div>
          <div className="flex items-center gap-2">
            {hasRateToday ? (
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 text-[9px] px-1.5 h-4 font-bold">محدث اليوم</Badge>
            ) : (
              <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50 text-[9px] px-1.5 h-4 font-bold">
                <AlertTriangle className="w-2.5 h-2.5 ml-1" />
                غير محدث
              </Badge>
            )}
            <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-2 items-center">
          <div className="col-span-5">
            <Select value={currentCode} onValueChange={handleSelect}>
              <SelectTrigger className="h-8 text-xs bg-slate-50/50 border-slate-200">
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
              className="h-8 text-left text-xs tabular-nums font-bold border-slate-200 focus:ring-1 focus:ring-blue-500"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              type="number"
              min="0"
              step="0.0001"
            />
          </div>

          <div className="col-span-3">
            <Button className="w-full h-8 text-xs font-bold shadow-sm" onClick={handleSave} disabled={saving || !currentCode}>
              {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            </Button>
          </div>
        </div>

        <div className="text-[10px] text-slate-400 font-medium px-1">
          1 {baseCurrency.code} = {selectedStatus?.rate ?? selectedStatus?.last_rate ?? "—"} {currentCode || "—"}
        </div>

        <div className="flex items-center gap-2 border-t border-slate-100 pt-2">
          <span className="text-[10px] text-slate-500 font-bold">عملة العرض:</span>
          <Select value={displayCurrencyCode ?? baseCurrency.code} onValueChange={setDisplayCurrencyCode}>
            <SelectTrigger className="h-7 text-[10px] bg-transparent border-none p-0 shadow-none hover:text-blue-600 transition-colors">
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
    </Draggable>
  );
}
