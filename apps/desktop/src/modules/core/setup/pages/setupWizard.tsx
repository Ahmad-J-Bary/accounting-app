import { publishSettingsUpdated } from "@shared/hooks/settingsEvents";
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { currencyService, type WorldCurrency } from '@modules/core/api/currencyService';
import { settingsService } from '@modules/core/api/settingsService';
import { COMPANY_TYPE_EXISTING, COMPANY_TYPE_NEW } from '@modules/opening-balance/lib/wizard-types';
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@shared/ui/card";
import { RadioGroup, RadioGroupItem } from "@shared/ui/radio-group";
import { Badge } from "@shared/ui/badge";
import { CheckCircle2, Search, Loader2, ArrowRight, Building2 } from "lucide-react";
import { useLocalization } from "@app/providers/LocalizationProvider";

export default function SetupWizard() {
  const navigate = useNavigate();
  const { t } = useLocalization();
  const [step, setStep] = useState<"loading" | "welcome" | "pick" | "done">("loading");
  const [companyName, setCompanyName] = useState("");
  const [companyType, setCompanyType] = useState<string>(COMPANY_TYPE_EXISTING);
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
      numeral_system: "western",
      accounting_start_mode: companyType,
    });
  };

  const handleSaveCompanyOnly = async () => {
    if (!companyName.trim()) return;
    setSaving(true);
    try {
      await settingsService.getSettings().then(s => saveCompanySettings(s.currency));
      publishSettingsUpdated();
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
      publishSettingsUpdated();
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
            <CheckCircle2 className="w-16 h-16 text-success mx-auto mb-2" />
            <CardTitle className="text-2xl">{t("done.title", { namespace: "setup" })}</CardTitle>
            <CardDescription>{t("done.loading", { namespace: "setup" })}</CardDescription>
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
            <CardTitle className="text-3xl">{t("welcome.title", { namespace: "setup" })}</CardTitle>
            <CardDescription className="text-base mt-2">
              {currenciesReady
                ? t("welcome.descCompanyOnly", { namespace: "setup" })
                : t("welcome.descCurrencies", { namespace: "setup" })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-right">
              <label className="block text-sm font-medium text-foreground mb-1.5">{t("welcome.companyName", { namespace: "setup" })}</label>
              <div className="relative">
                <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder={t("welcome.companyNamePlaceholder", { namespace: "setup" })}
                  className="pr-10 h-11 text-base"
                />
              </div>
            </div>

            <div className="text-right space-y-2">
              <label className="block text-sm font-medium text-foreground mb-1.5">{t("welcome.companyType", { namespace: "setup" })}</label>
              <RadioGroup value={companyType} onValueChange={setCompanyType} className="gap-2">
                <label
                  htmlFor="company-type-existing"
                  className={`flex items-start gap-3 border rounded-lg p-3 cursor-pointer transition-all ${
                    companyType === COMPANY_TYPE_EXISTING
                      ? "border-success/80 bg-success/10 ring-2 ring-success/20"
                      : "border-muted bg-white hover:border-muted/80"
                  }`}
                >
                  <RadioGroupItem value={COMPANY_TYPE_EXISTING} id="company-type-existing" aria-label={t("welcome.existingCompany", { namespace: "setup" })} className="mt-1" />
                  <span className="flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-foreground">{t("welcome.existingCompany", { namespace: "setup" })}</span>
                      {companyType === COMPANY_TYPE_EXISTING && (
                        <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                      )}
                    </span>
                    <span className="block text-xs text-muted-foreground mt-0.5">
                      {t("welcome.existingCompanyDesc", { namespace: "setup" })}
                    </span>
                  </span>
                </label>
                <label
                  htmlFor="company-type-new"
                  className={`flex items-start gap-3 border rounded-lg p-3 cursor-pointer transition-all ${
                    companyType === COMPANY_TYPE_NEW
                      ? "border-success/80 bg-success/10 ring-2 ring-success/20"
                      : "border-muted bg-white hover:border-muted/80"
                  }`}
                >
                  <RadioGroupItem value={COMPANY_TYPE_NEW} id="company-type-new" aria-label={t("welcome.newCompany", { namespace: "setup" })} className="mt-1" />
                  <span className="flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-foreground">{t("welcome.newCompany", { namespace: "setup" })}</span>
                      {companyType === COMPANY_TYPE_NEW && (
                        <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                      )}
                    </span>
                    <span className="block text-xs text-muted-foreground mt-0.5">
                      {t("welcome.newCompanyDesc", { namespace: "setup" })}
                    </span>
                  </span>
                </label>
              </RadioGroup>
            </div>
            {!currenciesReady && (
              <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 text-right text-sm text-warning">
                <p className="font-bold mb-1">{t("welcome.baseCurrencyInfo", { namespace: "setup" })}</p>
                <p>{t("welcome.baseCurrencyDesc", { namespace: "setup" })}</p>
              </div>
            )}
            {currenciesReady ? (
              <Button size="lg" className="w-full text-lg" onClick={handleSaveCompanyOnly} disabled={!companyName.trim() || saving}>
                {saving ? <Loader2 className="w-5 h-5 animate-spin ml-2" /> : null}
                {t("welcome.save", { namespace: "setup" })}
              </Button>
            ) : (
              <Button size="lg" className="w-full text-lg" onClick={handleStart} disabled={!companyName.trim()}>
                {t("welcome.startSetup", { namespace: "setup" })}
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
          <CardTitle>{t("currency.title", { namespace: "setup" })}</CardTitle>
          <CardDescription>
            {t("currency.desc", { namespace: "setup" })}
          </CardDescription>
          <div className="relative mt-2">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t("currency.searchPlaceholder", { namespace: "setup" })}
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
                      ? "border-success/80 bg-success/10 ring-2 ring-success/20"
                      : isSecondary
                      ? "border-primary/80 bg-primary/10 ring-2 ring-primary/20"
                      : "border-muted hover:border-muted/80 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <span className="text-lg font-bold text-foreground">{wc.code}</span>
                    <span className="text-xl text-muted-foreground">{wc.symbol}</span>
                  </div>
                  <div className="text-sm text-foreground">{wc.name_ar}</div>
                  <div className="text-xs text-muted-foreground">{wc.name_en}</div>
                  <div className="flex gap-1 mt-2">
                    <Badge
                      variant={isBase ? "default" : "outline"}
                      className={`cursor-pointer text-xs ${isBase ? "bg-success" : ""}`}
                      onClick={() => handleToggleBase(wc.code)}
                    >
                      {isBase ? `✓ ${t("currency.base", { namespace: "setup" })}` : t("currency.base", { namespace: "setup" })}
                    </Badge>
                    <Badge
                      variant={isSecondary ? "default" : "outline"}
                      className={`cursor-pointer text-xs ${isSecondary ? "bg-primary" : ""}`}
                      onClick={() => handleToggleSecondary(wc.code)}
                    >
                      {isSecondary ? `✓ ${t("currency.secondary", { namespace: "setup" })}` : t("currency.secondary", { namespace: "setup" })}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex items-center justify-between border-t pt-4">
            <div className="text-sm text-muted-foreground">
              {baseCode ? (
                <span className="text-success font-medium">
                  ✓ {t("currency.baseSelected", { namespace: "setup" })} {baseCode}
                  {secondaryCode && <span className="text-primary font-medium"> | {t("currency.secondarySelected", { namespace: "setup" })} {secondaryCode}</span>}
                </span>
              ) : (
                t("currency.selectBase", { namespace: "setup" })
              )}
            </div>
            <Button onClick={handleFinish} disabled={!baseCode || saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : null}
              {t("currency.confirm", { namespace: "setup" })}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
