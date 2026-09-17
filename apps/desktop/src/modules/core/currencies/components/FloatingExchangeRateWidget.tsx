import { useMemo, useState, useEffect, useLayoutEffect } from "react";
import Draggable from "react-draggable";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { Badge } from "@shared/ui/badge";
import { AlertTriangle, RefreshCw, Save, GripVertical, X } from "lucide-react";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useLocalization } from "@app/providers/LocalizationProvider";

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
  const { t, language, direction } = useLocalization();

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

  // Initialize selected currency and rate on first mount
  useLayoutEffect(() => {
    if (!selectedCode && nonBase.length > 0 && todayStatus.length > 0) {
      const first = nonBase[0];
      setSelectedCode(first.code);
      const status = todayStatus.find(s => s.currency_code === first.code);
      setRate(status?.rate ?? status?.last_rate ?? "1");
    }
  }, [nonBase, todayStatus, selectedCode]);

  const currentCode = selectedCode || nonBase[0]?.code || "";
  const currentCurrency = currencies.find((c) => c.code === currentCode);
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

  const getCurrencyName = (code: string) => {
    const currency = currencies.find((item) => item.code === code);
    if (!currency) return code;
    return language === "ar"
      ? currency.name_ar || currency.name_en || currency.code
      : currency.name_en || currency.name_ar || currency.code;
  };

  return (
    <Draggable
      handle=".drag-handle"
      defaultPosition={position}
      position={position}
      onStop={handleStop}
    >
      <div
        className="fixed bottom-4 z-50 w-[340px] cursor-default select-none space-y-2 rounded-xl border border-muted bg-white/95 p-3 shadow-xl backdrop-blur"
        style={{ insetInlineStart: "1rem" }}
        dir={direction}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2 drag-handle cursor-grab active:cursor-grabbing p-1 -m-1 hover:bg-muted/50 rounded transition-colors">
            <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
            <div className="text-[11px] font-black text-foreground uppercase tracking-wider">{t("floatingWidget.title", { namespace: "settings",  })}</div>
          </div>
          <div className="flex items-center gap-2">
            {hasRateToday ? (
              <Badge className="bg-success/10 text-success border-success/20 text-[9px] px-1.5 h-4 font-bold">{t("floatingWidget.updatedToday", { namespace: "settings",  })}</Badge>
            ) : (
              <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50 text-[9px] px-1.5 h-4 font-bold">
                <AlertTriangle className="me-1 h-2.5 w-2.5" />
                {t("floatingWidget.notUpdated", { namespace: "settings",  })}
              </Badge>
            )}
            <button onClick={onClose} className="p-1 hover:bg-muted rounded-full text-muted-foreground transition-colors">
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-2 items-center">
          <div className="col-span-5">
            <Select value={currentCode} onValueChange={handleSelect}>
              <SelectTrigger className="h-8 text-xs bg-muted/50 border-muted">
                <SelectValue placeholder={t("floatingWidget.currency", { namespace: "settings",  })} />
              </SelectTrigger>
              <SelectContent>
                {nonBase.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {getCurrencyName(c.code)} ({c.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-4">
            <Input
              className="h-8 border-muted text-start text-xs font-bold tabular-nums focus:ring-1 focus:ring-blue-500"
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

        <div className="px-1 text-[10px] font-bold text-muted-foreground text-start">
          {t("floatingWidget.equivalent", { namespace: "settings", vars: { base: baseCurrency.symbol || baseCurrency.code, rate: selectedStatus?.rate ?? selectedStatus?.last_rate ?? "—", target: currentCurrency?.symbol || currentCode } })}
        </div>

        <div className="flex items-center gap-2 border-t border-muted pt-2">
          <span className="text-[10px] text-muted-foreground font-bold">{t("floatingWidget.displayCurrency", { namespace: "settings",  })}</span>
          <Select value={displayCurrencyCode ?? baseCurrency.code} onValueChange={setDisplayCurrencyCode}>
            <SelectTrigger className="h-7 text-[10px] bg-transparent border-none p-0 shadow-none hover:text-primary transition-colors">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {currencies.filter((c) => c.is_active).map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {getCurrencyName(c.code)} ({c.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </Draggable>
  );
}
