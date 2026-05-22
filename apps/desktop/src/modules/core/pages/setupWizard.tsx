import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { currencyService, type WorldCurrency } from '@modules/core/api/currencyService';
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@shared/ui/card";
import { Badge } from "@shared/ui/badge";
import { CheckCircle2, Search, Loader2, ArrowRight } from "lucide-react";

export default function SetupWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"loading" | "welcome" | "pick" | "done">("loading");
  const [worldCurrencies, setWorldCurrencies] = useState<WorldCurrency[]>([]);
  const [search, setSearch] = useState("");
  const [baseCode, setBaseCode] = useState<string | null>(null);
  const [secondaryCode, setSecondaryCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const done = await currencyService.isSetupComplete();
        if (done) {
          navigate("/dashboard", { replace: true });
          return;
        }
        const list = await currencyService.getWorldCurrencies();
        setWorldCurrencies(list);
        setStep("welcome");
      } catch {
        setStep("welcome");
      }
    })();
  }, [navigate]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return worldCurrencies;
    return worldCurrencies.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name_ar.includes(q) ||
        c.name_en.toLowerCase().includes(q)
    );
  }, [worldCurrencies, search]);

  const handleStart = () => {
    setStep("pick");
  };

  const handleToggleBase = (code: string) => {
    if (baseCode === code) {
      setBaseCode(null);
    } else {
      setBaseCode(code);
      if (secondaryCode === code) setSecondaryCode(null);
    }
  };

  const handleToggleSecondary = (code: string) => {
    if (code === baseCode) return;
    if (secondaryCode === code) {
      setSecondaryCode(null);
    } else {
      setSecondaryCode(code);
    }
  };

  const handleFinish = async () => {
    if (!baseCode) return;
    setSaving(true);
    try {
      await currencyService.setupCurrencies(baseCode, secondaryCode ?? undefined);
      setStep("done");
      setTimeout(() => navigate("/dashboard", { replace: true }), 1500);
    } catch (e) {
      console.error("Setup failed:", e);
    } finally {
      setSaving(false);
    }
  };

  if (step === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-2" />
            <CardTitle className="text-2xl">تم الإعداد بنجاح</CardTitle>
            <CardDescription>جاري تحميل التطبيق...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (step === "welcome") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <Card className="w-full max-w-lg text-center">
          <CardHeader>
            <CardTitle className="text-3xl">مرحباً بك في نظام المحاسبة</CardTitle>
            <CardDescription className="text-base mt-2">
              لنبدأ بإعداد العملات. اختر العملة الأساسية لنظامك، ويمكنك إضافة عملة ثانوية اختيارياً.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-right text-sm text-amber-800">
              <p className="font-bold mb-1">العملة الأساسية</p>
              <p>هي العملة التي تُسجل بها جميع المعاملات المالية في النظام. يمكنك تحويلها إلى أي عملة أخرى لاحقاً.</p>
            </div>
            <Button size="lg" className="w-full text-lg" onClick={handleStart}>
             开始 الإعداد
              <ArrowRight className="w-5 h-5 mr-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-start justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4 pt-12">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>اختيار العملات</CardTitle>
          <CardDescription>
            اختر العملة الأساسية (إلزامي) وعملة ثانوية (اختياري)
          </CardDescription>
          <div className="relative mt-2">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="بحث عن عملة..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pl-1">
            {filtered.map((wc) => {
              const isBase = baseCode === wc.code;
              const isSecondary = secondaryCode === wc.code;
              return (
                <div
                  key={wc.code}
                  className={`relative border rounded-lg p-3 cursor-pointer transition-all ${
                    isBase
                      ? "border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200"
                      : isSecondary
                      ? "border-blue-400 bg-blue-50 ring-2 ring-blue-200"
                      : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <span className="text-lg font-bold text-slate-800">{wc.code}</span>
                    <span className="text-xl text-slate-500">{wc.symbol}</span>
                  </div>
                  <div className="text-sm text-slate-600">{wc.name_ar}</div>
                  <div className="text-xs text-slate-400">{wc.name_en}</div>
                  <div className="flex gap-1 mt-2">
                    <Badge
                      variant={isBase ? "default" : "outline"}
                      className={`cursor-pointer text-xs ${isBase ? "bg-emerald-500" : ""}`}
                      onClick={() => handleToggleBase(wc.code)}
                    >
                      {isBase ? "✓ أساسية" : "أساسية"}
                    </Badge>
                    <Badge
                      variant={isSecondary ? "default" : "outline"}
                      className={`cursor-pointer text-xs ${isSecondary ? "bg-blue-500" : ""}`}
                      onClick={() => handleToggleSecondary(wc.code)}
                    >
                      {isSecondary ? "✓ ثانوية" : "ثانوية"}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex items-center justify-between border-t pt-4">
            <div className="text-sm text-slate-500">
              {baseCode ? (
                <span className="text-emerald-700 font-medium">
                  ✓ العملة الأساسية: {baseCode}
                  {secondaryCode && <span className="text-blue-700"> | الثانوية: {secondaryCode}</span>}
                </span>
              ) : (
                "الرجاء اختيار العملة الأساسية"
              )}
            </div>
            <Button onClick={handleFinish} disabled={!baseCode || saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : null}
              تأكيد الإعداد
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
