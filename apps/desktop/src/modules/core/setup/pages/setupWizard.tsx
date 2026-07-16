import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { currencyService, type WorldCurrency } from '@modules/core/api/currencyService';
import { settingsService } from '@modules/core/api/settingsService';
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@shared/ui/card";
import { Badge } from "@shared/ui/badge";
import { CheckCircle2, Search, Loader2, ArrowRight, Building2 } from "lucide-react";

export default function SetupWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"loading" | "welcome" | "pick" | "done">("loading");
  const [companyName, setCompanyName] = useState("");
  const [currenciesReady, setCurrenciesReady] = useState(false);
  const [worldCurrencies, setWorldCurrencies] = useState<WorldCurrency[]>([]);
  const [search, setSearch] = useState("");
  const [baseCode, setBaseCode] = useState<string | null>(null);
  const [secondaryCode, setSecondaryCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [setupDone, settings] = await Promise.all([
          currencyService.isSetupComplete(),
          settingsService.getSettings().catch(() => null),
        ]);
        const needsCompany = !settings?.company_name || settings.company_name === 'شركتي';
        if (setupDone && !needsCompany) {
          navigate("/dashboard", { replace: true });
          return;
        }
        if (setupDone) {
          setCurrenciesReady(true);
          setStep("welcome");
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

  const saveCompanySettings = async (currencyCode: string) => {
    if (!companyName.trim()) return;
    const baseCurrency = worldCurrencies.find(w => w.code === currencyCode);
    await settingsService.updateSettings({
      company_name: companyName.trim(),
      currency: currencyCode,
      currency_symbol: baseCurrency?.symbol || currencyCode,
      tax_rate: 0,
      invoice_prefix: "INV",
      purchase_prefix: "PUR",
      journal_prefix: "JRN",
      fiscal_year_start_month: 1,
    });
  };

  const handleSaveCompanyOnly = async () => {
    if (!companyName.trim()) return;
    setSaving(true);
    try {
      await settingsService.getSettings().then(s => saveCompanySettings(s.currency));
      window.dispatchEvent(new CustomEvent("erp:settings-updated"));
      setStep("done");
      setTimeout(() => navigate("/dashboard", { replace: true }), 1500);
    } catch (e) {
      console.error("Setup failed:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleFinish = async () => {
    if (!baseCode) return;
    setSaving(true);
    try {
      await currencyService.setupCurrencies(baseCode, secondaryCode ?? undefined);
      await saveCompanySettings(baseCode);
      window.dispatchEvent(new CustomEvent("erp:settings-updated"));
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
              {currenciesReady
                ? "أدخل اسم المنشأة لإكمال الإعداد."
                : " لنبدأ بإعداد المنشأة والعملات. أدخل اسم المنشأة ثم اختر العملة الأساسية."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-right">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">اسم المنشأة</label>
              <div className="relative">
                <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="أدخل اسم المنشأة"
                  className="pr-10 h-11 text-base"
                />
              </div>
            </div>
            {!currenciesReady && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-right text-sm text-amber-800">
                <p className="font-bold mb-1">العملة الأساسية</p>
                <p>هي العملة التي تُسجل بها جميع المعاملات المالية في النظام. يمكنك تحويلها إلى أي عملة أخرى لاحقاً.</p>
              </div>
            )}
            {currenciesReady ? (
              <Button size="lg" className="w-full text-lg" onClick={handleSaveCompanyOnly} disabled={!companyName.trim() || saving}>
                {saving ? <Loader2 className="w-5 h-5 animate-spin ml-2" /> : null}
                حفظ
              </Button>
            ) : (
              <Button size="lg" className="w-full text-lg" onClick={handleStart} disabled={!companyName.trim()}>
                بدء الإعداد
                <ArrowRight className="w-5 h-5 mr-2" />
              </Button>
            )}
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
