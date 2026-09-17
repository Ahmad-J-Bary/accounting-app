import { useState, useEffect, useCallback } from "react";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@shared/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@shared/ui/tabs";
import {
  Plus, Save, RefreshCw, History, DollarSign,
  ArrowRightLeft, AlertCircle, Trash2, CheckCircle2, Search, Pencil, Star
} from "lucide-react";
import { currencyService, type Currency, type ExchangeRate, type TodayRateStatus, type WorldCurrency } from '@modules/core/api/currencyService';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle
} from "@shared/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow
} from "@shared/ui/table";
import { Badge } from "@shared/ui/badge";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip
} from "recharts";
import { toLocalString } from "@shared/lib/format";
import { useLocalization } from "@app/providers/LocalizationProvider";

export default function CurrencySettings() {
  const { refresh: refreshContext, updateRate } = useCurrencyContext();
  const { t, language, direction, locale } = useLocalization();
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [rateStatus, setRateStatus] = useState<TodayRateStatus[]>([]);
  const [worldCurrencies, setWorldCurrencies] = useState<WorldCurrency[]>([]);
  const [history, setHistory] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingCurrency, setEditingCurrency] = useState<Currency | null>(null);
  const [selectedCurrencyForHistory, setSelectedCurrencyForHistory] = useState<string | null>(null);
  const [worldSearch, setWorldSearch] = useState("");
  const [newRates, setNewRates] = useState<Record<string, string>>({});

  const [editForm, setEditForm] = useState({
    name_ar: "",
    name_en: "",
    symbol: "",
    decimals: 2,
  });

  const loadHistory = useCallback(async (from: string, to: string) => {
    try {
      const hist = await currencyService.listRateHistory(from, to, 30);
      setHistory(hist.reverse());
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      const [currList, statusList, worldList] = await Promise.all([
        currencyService.listActiveCurrencies(),
        currencyService.getTodayRatesStatus(),
        currencyService.getWorldCurrencies(),
      ]);
      setCurrencies(currList);
      setRateStatus(statusList);
      setWorldCurrencies(worldList);

      const initialRates: Record<string, string> = {};
      statusList.forEach(s => {
        initialRates[s.currency_code] = s.rate || s.last_rate || "1";
      });
      setNewRates(initialRates);

      const nonBase = currList.find(c => !c.is_base);
      const base = currList.find(c => c.is_base);
      if (nonBase && base) {
        setSelectedCurrencyForHistory(nonBase.code);
        loadHistory(nonBase.code, base.code);
      }
    } catch (e) {
      console.error(e);
      toast.error(t("currencies.error", { namespace: "settings",  }), { description: t("currencies.errorLoad", { namespace: "settings",  }) });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t, loadHistory]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddCurrency = async (wc: WorldCurrency) => {
    const isFirst = currencies.length === 0;
    setIsAddDialogOpen(false);
    setWorldSearch("");
    try {
      await currencyService.createCurrency({
        code: wc.code,
        name_ar: wc.name_ar,
        name_en: wc.name_en,
        symbol: wc.symbol,
        decimals: wc.decimals,
        is_base: isFirst,
        is_active: true,
      });
      toast.success(t("currencies.addSuccess", { namespace: "settings",  }), { description: t("currencies.addSuccessDesc", { namespace: "settings", vars: { name: (language === "ar" ? wc.name_ar : wc.name_en) || wc.name_ar || wc.name_en, code: wc.code } }) });
      await loadData();
      await refreshContext();
    } catch (e) {
      toast.error(t("currencies.error", { namespace: "settings",  }), { description: String(e) });
      setIsAddDialogOpen(true);
    }
  };

  const openEditDialog = (curr: Currency) => {
    setEditingCurrency(curr);
    setEditForm({
      name_ar: curr.name_ar,
      name_en: curr.name_en,
      symbol: curr.symbol,
      decimals: curr.decimals,
    });
    setIsEditDialogOpen(true);
  };

  const handleEditCurrency = async () => {
    if (!editingCurrency) return;
    const updated: Currency = { ...editingCurrency, ...editForm, is_active: true };
    setCurrencies(prev => prev.map(c => c.code === editingCurrency.code ? updated : c));
    setIsEditDialogOpen(false);
    setEditingCurrency(null);
    try {
      await currencyService.updateCurrency({
        code: editingCurrency.code,
        name_ar: editForm.name_ar,
        name_en: editForm.name_en,
        symbol: editForm.symbol,
        decimals: editForm.decimals,
        is_active: true,
      });
      toast.success(t("currencies.editSuccess", { namespace: "settings",  }), { description: t("currencies.editSuccessDesc", { namespace: "settings", vars: { name: resolveCurrencyNames(editingCurrency).localized } }) });
      await loadData();
      await refreshContext();
    } catch (e) {
      toast.error(t("currencies.error", { namespace: "settings",  }), { description: String(e) });
      await loadData();
      await refreshContext();
    }
  };

  const handleDeleteCurrency = async (code: string) => {
    if (!confirm(t("currencies.deleteConfirm", { namespace: "settings",  }))) return;
    // Remove from local state immediately so the table updates right away
    setCurrencies(prev => prev.filter(c => c.code !== code));
    setRateStatus(prev => prev.filter(s => s.currency_code !== code));
    setHistory([]);
    setSelectedCurrencyForHistory(null);
    try {
      await currencyService.deleteCurrency(code);
      toast.success(t("currencies.deleteSuccess", { namespace: "settings",  }), { description: t("currencies.deleteSuccessDesc", { namespace: "settings",  }) });
    } catch (e) {
      // Revert on failure by reloading from server
      toast.error(t("currencies.error", { namespace: "settings",  }), { description: String(e) });
    }
    await loadData();
    await refreshContext();
  };

  const handleSetBase = async (code: string) => {
    setCurrencies(prev => prev.map(c => ({ ...c, is_base: c.code === code })));
    try {
      await currencyService.setBaseCurrency(code);
      toast.success(t("currencies.setBaseSuccess", { namespace: "settings",  }), { description: t("currencies.setBaseSuccessDesc", { namespace: "settings", vars: { code } }) });
      await loadData();
      await refreshContext();
    } catch (e) {
      toast.error(t("currencies.error", { namespace: "settings",  }), { description: String(e) });
      await loadData();
      await refreshContext();
    }
  };

  const handleSetRate = async (from: string) => {
    const base = currencies.find(c => c.is_base);
    if (!base) return;
    const rateToSet = newRates[from] || "1";

    updateRate(from, rateToSet);
    setRateStatus(prev => prev.map(s =>
      s.currency_code === from
        ? { ...s, rate: rateToSet, has_rate_today: true, last_rate_date: new Date().toISOString() }
        : s
    ));

    try {
      await currencyService.setExchangeRate({
        from_currency: base.code,
        to_currency: from,
        rate: rateToSet,
        rate_type: "Middle",
      });
      toast.success(t("currencies.rateUpdateSuccess", { namespace: "settings",  }), { description: t("currencies.rateUpdateSuccessDesc", { namespace: "settings", vars: { code: from } }) });
      await loadData();
      await refreshContext();
    } catch (e) {
      toast.error(t("currencies.error", { namespace: "settings",  }), { description: String(e) });
      await loadData();
      await refreshContext();
    }
  };

  const chartData = history.map(h => ({
    date: new Date(h.rate_date).toLocaleDateString("ar-SY", { day: 'numeric', month: 'short' }),
    rate: parseFloat(h.rate)
  }));

  const filteredWorld = worldCurrencies.filter(wc =>
    !currencies.some(c => c.code === wc.code) &&
    (wc.code.toLowerCase().includes(worldSearch.toLowerCase()) ||
     wc.name_ar.includes(worldSearch) ||
     wc.name_en.toLowerCase().includes(worldSearch.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-muted-foreground">
        <RefreshCw className="animate-spin w-8 h-8 ms-3" />
        {t("currencies.loading", { namespace: "settings",  })}
      </div>
    );
  }

  const baseCurrency = currencies.find(c => c.is_base);
  const worldCurrencyMap = new Map(worldCurrencies.map((currency) => [currency.code, currency]));
  const resolveCurrencyNames = (currency: Pick<Currency, "code" | "name_ar" | "name_en">) => {
    const worldCurrency = worldCurrencyMap.get(currency.code);
    const localized = language === "ar"
      ? worldCurrency?.name_ar || currency.name_ar || worldCurrency?.name_en || currency.name_en || currency.code
      : worldCurrency?.name_en || currency.name_en || worldCurrency?.name_ar || currency.name_ar || currency.code;
    const secondary = language === "ar"
      ? worldCurrency?.name_en || currency.name_en || ""
      : worldCurrency?.name_ar || currency.name_ar || "";
    return { localized, secondary };
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Currencies List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="min-w-0">
                <CardTitle>{t("currencies.title", { namespace: "settings" })}</CardTitle>
                <CardDescription className="truncate">{t("currencies.description", { namespace: "settings" })}</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {baseCurrency && (
                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 hidden sm:inline-flex">
                  {t("currencies.baseLabel", { namespace: "settings" })} {baseCurrency.code} ({baseCurrency.symbol})
                </Badge>
              )}
              <Button variant="outline" size="sm" onClick={() => { loadData(); refreshContext(); }} disabled={refreshing}>
                <RefreshCw className={`w-3.5 h-3.5 ms-1 ${refreshing ? 'animate-spin' : ''}`} />
                {t("currencies.update", { namespace: "settings" })}
              </Button>
              <Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="w-3.5 h-3.5 ms-1" />
                {t("currencies.addCurrency", { namespace: "settings" })}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {currencies.length === 0 ? (
            <div className="text-center py-8 sm:py-10 text-muted-foreground space-y-3">
              <DollarSign className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-muted-foreground/30" />
              <p className="font-bold">{t("currencies.noCurrencies", { namespace: "settings" })}</p>
              <p className="text-sm">{t("currencies.noCurrenciesHint", { namespace: "settings" })}</p>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="w-4 h-4 ms-2" />
                {t("currencies.addFirst", { namespace: "settings" })}
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
            <Table className="min-w-[500px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">{t("currencies.table.code", { namespace: "settings",  })}</TableHead>
                  <TableHead className="text-start">{t("currencies.table.name", { namespace: "settings",  })}</TableHead>
                  <TableHead className="text-start">{t("currencies.table.symbol", { namespace: "settings",  })}</TableHead>
                  <TableHead className="text-start">{t("currencies.table.type", { namespace: "settings",  })}</TableHead>
                  <TableHead className="text-start">{t("currencies.table.decimals", { namespace: "settings",  })}</TableHead>
                  <TableHead className="text-end">{t("currencies.table.actions", { namespace: "settings",  })}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currencies.map((curr) => (
                  <TableRow key={curr.code}>
                    <TableCell className="font-bold">{curr.code}</TableCell>
                    <TableCell>
                      <div className="font-medium text-foreground">{resolveCurrencyNames(curr).localized}</div>
                      {resolveCurrencyNames(curr).secondary ? (
                        <div className="text-xs text-muted-foreground">{resolveCurrencyNames(curr).secondary}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-mono">{curr.symbol}</TableCell>
                    <TableCell>
                      {curr.is_base ? (
                        <Badge className="bg-warning/20 text-warning hover:bg-warning/20 border-none gap-1">
                          <Star className="w-3 h-3" /> {t("currencies.base", { namespace: "settings",  })}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">{t("currencies.secondary", { namespace: "settings",  })}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{curr.decimals}</TableCell>
                    <TableCell className="text-end">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" className="text-xs text-primary hover:text-primary/80 hover:bg-primary/10" onClick={() => openEditDialog(curr)}>
                          <Pencil className="w-3.5 h-3.5 ms-1" /> {t("currencies.edit", { namespace: "settings" })}
                        </Button>
                        {!curr.is_base ? (
                          <>
                            <Button variant="ghost" size="sm" className="text-xs text-warning hover:text-warning/80 hover:bg-warning/10" onClick={() => handleSetBase(curr.code)}>
                              <Star className="w-3.5 h-3.5 ms-1" /> {t("currencies.setBase", { namespace: "settings" })}
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteCurrency(curr.code)} className="text-destructive hover:text-destructive/80 hover:bg-destructive/10">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Exchange Rates + History */}
      {currencies.length > 1 && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ArrowRightLeft className="w-4 h-4 text-primary" />
                {t("currencies.exchangeRates", { namespace: "settings",  })}
              </CardTitle>
              <CardDescription>{t("currencies.exchangeRatesDesc", { namespace: "settings", vars: { code: baseCurrency?.code } })}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {rateStatus.map((status) => (
                <div key={status.currency_code} className="p-3 border rounded-lg bg-muted/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{status.currency_code}</div>
                    {status.has_rate_today ? (
                      <div className="flex items-center text-xs text-success gap-1">
                        <CheckCircle2 className="w-3 h-3" /> {t("currencies.updated", { namespace: "settings",  })}
                      </div>
                    ) : (
                      <div className="flex items-center text-xs text-warning gap-1">
                        <AlertCircle className="w-3 h-3" /> {t("currencies.needsUpdate", { namespace: "settings",  })}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type="number"
                        value={newRates[status.currency_code] ?? ""}
                        onChange={e => setNewRates(prev => ({ ...prev, [status.currency_code]: e.target.value }))}
                        className="h-8 ps-10 text-start tabular-nums text-sm"
                      />
                      <span className="absolute start-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground">
                        {baseCurrency?.code}
                      </span>
                    </div>
                    <Button size="sm" className="h-8 text-xs" onClick={() => handleSetRate(status.currency_code)}>
                      <Save className="w-3 h-3 ms-1" />
                      {t("currencies.save", { namespace: "settings",  })}
                    </Button>
                  </div>
                  {status.last_rate_date && (
                    <div className="text-[10px] text-muted-foreground">
                      {t("currencies.lastUpdate", { namespace: "settings",  })} {status.last_rate_date}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="xl:col-span-2">
            <Tabs defaultValue="chart" className="w-full" dir={direction}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="space-y-1 min-w-0">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <History className="w-4 h-4 text-primary shrink-0" />
                    {t("currencies.rateHistory", { namespace: "settings" })}
                  </CardTitle>
                  <CardDescription className="truncate">{t("currencies.rateHistoryDesc", { namespace: "settings" })}</CardDescription>
                </div>
                <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                  <div className="flex gap-1 bg-muted p-1 rounded-md overflow-x-auto">
                    {currencies.filter(c => !c.is_base).map(c => (
                      <button
                        key={c.code}
                        onClick={() => {
                          setSelectedCurrencyForHistory(c.code);
                          if (baseCurrency) loadHistory(c.code, baseCurrency.code);
                        }}
                        className={`px-3 py-1 text-xs rounded-sm transition-all ${
                          selectedCurrencyForHistory === c.code
                            ? 'bg-white shadow-sm font-bold'
                            : 'hover:bg-white/50'
                        }`}
                      >
                        {c.code}
                      </button>
                    ))}
                  </div>
                  <TabsList>
                    <TabsTrigger value="chart">{t("currencies.chart", { namespace: "settings",  })}</TabsTrigger>
                    <TabsTrigger value="table">{t("currencies.tableTab", { namespace: "settings",  })}</TabsTrigger>
                  </TabsList>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <TabsContent value="chart" className="mt-0">
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorRate2" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#1e3a5f" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#1e3a5f" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} reversed={direction === "rtl"} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} domain={['auto', 'auto']} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }} />
                        <Area type="monotone" dataKey="rate" name={t("currencies.exchangeRate", { namespace: "settings",  })} stroke="#1e3a5f" strokeWidth={2} fillOpacity={1} fill="url(#colorRate2)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>
                <TabsContent value="table" className="mt-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-start">{t("currencies.rateDate", { namespace: "settings",  })}</TableHead>
                        <TableHead className="text-start">{t("currencies.rateValue", { namespace: "settings", vars: { code: baseCurrency?.code } })}</TableHead>
                        <TableHead className="text-start">{t("currencies.rateType", { namespace: "settings",  })}</TableHead>
                        <TableHead className="text-start">{t("currencies.rateSource", { namespace: "settings",  })}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map((h) => (
                        <TableRow key={h.id}>
                          <TableCell>{new Date(h.rate_date).toLocaleDateString(locale)}</TableCell>
                          <TableCell className="font-mono font-bold">{toLocalString(parseFloat(h.rate))}</TableCell>
                          <TableCell><Badge variant="outline">{h.rate_type === 'Market' ? t("currencies.marketPrice", { namespace: "settings",  }) : t("currencies.officialPrice", { namespace: "settings",  })}</Badge></TableCell>
                          <TableCell className="text-muted-foreground text-xs">{h.source || t("currencies.manual", { namespace: "settings",  })}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </div>
      )}

      {/* Add Currency Dialog — World Currencies List */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-[550px]" dir={direction}>
          <DialogHeader>
            <DialogTitle>{t("currencies.addDialog", { namespace: "settings",  })}</DialogTitle>
            <DialogDescription>
              {t("currencies.addDialogHint", { namespace: "settings",  })}
            </DialogDescription>
          </DialogHeader>
          <div className="relative mb-4">
            <Search className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={worldSearch}
              onChange={e => setWorldSearch(e.target.value)}
              placeholder={t("currencies.searchPlaceholder", { namespace: "settings",  })}
              className="h-10 pe-10"
            />
          </div>
          <div className="max-h-[400px] overflow-y-auto space-y-1">
            {filteredWorld.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {worldSearch ? t("currencies.noResults", { namespace: "settings",  }) : t("currencies.allAdded", { namespace: "settings",  })}
              </p>
            ) : (
              filteredWorld.map(wc => (
                <button
                  key={wc.code}
                  onClick={() => handleAddCurrency(wc)}
                  className="w-full rounded-lg border border-transparent p-3 text-start transition-colors hover:border-muted hover:bg-muted"
                >
                  <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center text-lg font-bold text-foreground">
                    {wc.symbol}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-foreground">{(language === "ar" ? wc.name_ar : wc.name_en) || wc.name_ar || wc.name_en} ({wc.code})</div>
                    <div className="text-xs text-muted-foreground">{language === "ar" ? wc.name_en : wc.name_ar}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">{wc.decimals} {t("currencies.decimalsLabel", { namespace: "settings",  })}</div>
                  <Plus className="w-4 h-4 text-primary shrink-0" />
                </button>
              ))
            )}
          </div>
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => { setIsAddDialogOpen(false); setWorldSearch(""); }}>
              {t("currencies.cancel", { namespace: "settings",  })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Currency Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]" dir={direction}>
          <DialogHeader>
            <DialogTitle>{t("currencies.editDialog", { namespace: "settings",  })}</DialogTitle>
            <DialogDescription>
              {t("currencies.editDialogDesc", { namespace: "settings", vars: { code: editingCurrency?.code } })}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_name_ar" className="text-start">{t("currencies.nameAr", { namespace: "settings",  })}</Label>
              <Input id="edit_name_ar" value={editForm.name_ar} onChange={e => setEditForm({...editForm, name_ar: e.target.value})} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_name_en" className="text-start">{t("currencies.nameEn", { namespace: "settings",  })}</Label>
              <Input id="edit_name_en" value={editForm.name_en} onChange={e => setEditForm({...editForm, name_en: e.target.value})} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_symbol" className="text-start">{t("currencies.symbolLabel", { namespace: "settings",  })}</Label>
              <Input id="edit_symbol" value={editForm.symbol} onChange={e => setEditForm({...editForm, symbol: e.target.value})} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_decimals" className="text-start">{t("currencies.decimalsField", { namespace: "settings",  })}</Label>
              <Input id="edit_decimals" type="number" min={0} max={6} value={editForm.decimals} onChange={e => setEditForm({...editForm, decimals: parseInt(e.target.value) || 2})} className="col-span-3" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleEditCurrency}>{t("currencies.saveEdits", { namespace: "settings",  })}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
