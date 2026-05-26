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
  CartesianGrid, Tooltip, Legend
} from "recharts";

export default function CurrencySettings() {
  const { refresh: refreshContext, updateRate } = useCurrencyContext();
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
      toast.error("خطأ", { description: "فشل تحميل بيانات العملات" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadHistory = async (from: string, to: string) => {
    try {
      const hist = await currencyService.listRateHistory(from, to, 30);
      setHistory(hist.reverse());
    } catch (e) {
      console.error(e);
    }
  };

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
      toast.success("تمت الإضافة", { description: `تمت إضافة ${wc.name_ar} (${wc.code})` });
      await loadData();
      await refreshContext();
    } catch (e) {
      toast.error("خطأ", { description: String(e) });
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
      toast.success("تم التعديل", { description: `تم تعديل ${editingCurrency.name_ar}` });
      await loadData();
      await refreshContext();
    } catch (e) {
      toast.error("خطأ", { description: String(e) });
      await loadData();
      await refreshContext();
    }
  };

  const handleDeleteCurrency = async (code: string) => {
    if (!confirm(`هل أنت متأكد من حذف هذه العملة؟`)) return;
    // Remove from local state immediately so the table updates right away
    setCurrencies(prev => prev.filter(c => c.code !== code));
    setRateStatus(prev => prev.filter(s => s.currency_code !== code));
    setHistory([]);
    setSelectedCurrencyForHistory(null);
    try {
      await currencyService.deleteCurrency(code);
      toast.success("تم الحذف", { description: "تم حذف العملة بنجاح" });
    } catch (e) {
      // Revert on failure by reloading from server
      toast.error("خطأ", { description: String(e) });
    }
    await loadData();
    await refreshContext();
  };

  const handleSetBase = async (code: string) => {
    setCurrencies(prev => prev.map(c => ({ ...c, is_base: c.code === code })));
    try {
      await currencyService.setBaseCurrency(code);
      toast.success("تم التحديث", { description: `تم تعيين ${code} كعملة أساسية` });
      await loadData();
      await refreshContext();
    } catch (e) {
      toast.error("خطأ", { description: String(e) });
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
      toast.success("تم التحديث", { description: `تم تحديث سعر صرف ${from}` });
      await loadData();
      await refreshContext();
    } catch (e) {
      toast.error("خطأ", { description: String(e) });
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
        <RefreshCw className="animate-spin w-8 h-8 ml-3" />
        جاري تحميل إعدادات العملات...
      </div>
    );
  }

  const baseCurrency = currencies.find(c => c.is_base);

  return (
    <div className="space-y-6">
      {/* Currencies List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <CardTitle>العملات</CardTitle>
                <CardDescription>إضافة وتعديل وحذف العملات — أول عملة تضاف تصبح الأساسية. ابدأ بإضافة عملة واحدة على الأقل.</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {baseCurrency && (
                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                  الأساسية: {baseCurrency.code} ({baseCurrency.symbol})
                </Badge>
              )}
              <Button variant="outline" size="sm" onClick={() => { loadData(); refreshContext(); }} disabled={refreshing}>
                <RefreshCw className={`w-3.5 h-3.5 ml-1 ${refreshing ? 'animate-spin' : ''}`} />
                تحديث
              </Button>
              <Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="w-3.5 h-3.5 ml-1" />
                إضافة عملة
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {currencies.length === 0 ? (
            <div className="text-center py-10 text-slate-400 space-y-3">
              <DollarSign className="w-12 h-12 mx-auto text-slate-200" />
              <p className="font-bold">لا توجد عملات مضافة بعد</p>
              <p className="text-sm">أضف عملتك الأولى من قائمة العملات العالمية — ستصبح تلقائياً العملة الأساسية</p>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="w-4 h-4 ml-2" />
                إضافة أول عملة
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الرمز</TableHead>
                  <TableHead className="text-right">اسم العملة</TableHead>
                  <TableHead className="text-right">الإشارة</TableHead>
                  <TableHead className="text-right">النوع</TableHead>
                  <TableHead className="text-right">العدد</TableHead>
                  <TableHead className="text-left">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currencies.map((curr) => (
                  <TableRow key={curr.code}>
                    <TableCell className="font-bold">{curr.code}</TableCell>
                    <TableCell>{curr.name_ar}</TableCell>
                    <TableCell className="font-mono">{curr.symbol}</TableCell>
                    <TableCell>
                      {curr.is_base ? (
                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none gap-1">
                          <Star className="w-3 h-3" /> أساسية
                        </Badge>
                      ) : (
                        <Badge variant="secondary">ثانوية</Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{curr.decimals}</TableCell>
                    <TableCell className="text-left">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" className="text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50" onClick={() => openEditDialog(curr)}>
                          <Pencil className="w-3.5 h-3.5 ml-1" /> تعديل
                        </Button>
                        {!curr.is_base ? (
                          <>
                            <Button variant="ghost" size="sm" className="text-xs text-amber-600 hover:text-amber-800 hover:bg-amber-50" onClick={() => handleSetBase(curr.code)}>
                              <Star className="w-3.5 h-3.5 ml-1" /> تعيين كأساسية
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteCurrency(curr.code)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
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
          )}
        </CardContent>
      </Card>

      {/* Exchange Rates + History */}
      {currencies.length > 1 && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ArrowRightLeft className="w-4 h-4 text-primary" />
                أسعار الصرف
              </CardTitle>
              <CardDescription>تحديث أسعار الصرف مقابل {baseCurrency?.code} لليوم</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {rateStatus.map((status) => (
                <div key={status.currency_code} className="p-3 border rounded-lg bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{status.currency_code}</div>
                    {status.has_rate_today ? (
                      <div className="flex items-center text-xs text-green-600 gap-1">
                        <CheckCircle2 className="w-3 h-3" /> محدث
                      </div>
                    ) : (
                      <div className="flex items-center text-xs text-amber-600 gap-1">
                        <AlertCircle className="w-3 h-3" /> يحتاج تحديث
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type="number"
                        value={newRates[status.currency_code] ?? ""}
                        onChange={e => setNewRates(prev => ({ ...prev, [status.currency_code]: e.target.value }))}
                        className="pl-10 text-left tabular-nums h-8 text-sm"
                      />
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-mono">
                        {baseCurrency?.code}
                      </span>
                    </div>
                    <Button size="sm" className="h-8 text-xs" onClick={() => handleSetRate(status.currency_code)}>
                      <Save className="w-3 h-3 ml-1" />
                      حفظ
                    </Button>
                  </div>
                  {status.last_rate_date && (
                    <div className="text-[10px] text-muted-foreground">
                      آخر تحديث: {status.last_rate_date}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="xl:col-span-2">
            <Tabs defaultValue="chart" className="w-full" dir="rtl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <History className="w-4 h-4 text-primary" />
                    سجل أسعار الصرف
                  </CardTitle>
                  <CardDescription>تغير أسعار الصرف خلال آخر 30 يوماً</CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex gap-1 bg-muted p-1 rounded-md">
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
                    <TabsTrigger value="chart">مخطط</TabsTrigger>
                    <TabsTrigger value="table">جدول</TabsTrigger>
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
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} reversed={true} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} domain={['auto', 'auto']} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }} />
                        <Area type="monotone" dataKey="rate" name="سعر الصرف" stroke="#1e3a5f" strokeWidth={2} fillOpacity={1} fill="url(#colorRate2)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>
                <TabsContent value="table" className="mt-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">التاريخ</TableHead>
                        <TableHead className="text-right">سعر الصرف ({baseCurrency?.code})</TableHead>
                        <TableHead className="text-right">النوع</TableHead>
                        <TableHead className="text-right">المصدر</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map((h) => (
                        <TableRow key={h.id}>
                          <TableCell>{new Date(h.rate_date).toLocaleDateString("ar-SY")}</TableCell>
                          <TableCell className="font-mono font-bold">{parseFloat(h.rate).toLocaleString()}</TableCell>
                          <TableCell><Badge variant="outline">{h.rate_type === 'Market' ? 'سعر السوق' : 'سعر رسمي'}</Badge></TableCell>
                          <TableCell className="text-muted-foreground text-xs">{h.source || 'يدوي'}</TableCell>
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
        <DialogContent className="sm:max-w-[550px] max-h-[80vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة عملة من القائمة العالمية</DialogTitle>
            <DialogDescription>
              اختر عملة من القائمة — أول عملة تضاف تصبح العملة الأساسية تلقائياً.
            </DialogDescription>
          </DialogHeader>
          <div className="relative mb-4">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={worldSearch}
              onChange={e => setWorldSearch(e.target.value)}
              placeholder="ابحث عن عملة..."
              className="pr-10 h-10"
            />
          </div>
          <div className="max-h-[400px] overflow-y-auto space-y-1">
            {filteredWorld.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {worldSearch ? "لا توجد نتائج تطابق البحث" : "جميع العملات العالمية مضافة بالفعل"}
              </p>
            ) : (
              filteredWorld.map(wc => (
                <button
                  key={wc.code}
                  onClick={() => handleAddCurrency(wc)}
                  className="w-full flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200 text-right"
                >
                  <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-lg font-bold text-slate-700">
                    {wc.symbol}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-slate-800">{wc.name_ar} ({wc.code})</div>
                    <div className="text-xs text-slate-400">{wc.name_en}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">{wc.decimals} منازل</div>
                  <Plus className="w-4 h-4 text-primary shrink-0" />
                </button>
              ))
            )}
          </div>
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => { setIsAddDialogOpen(false); setWorldSearch(""); }}>
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Currency Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل العملة</DialogTitle>
            <DialogDescription>
              تعديل بيانات العملة {editingCurrency?.code}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_name_ar" className="text-right">الاسم (عربي)</Label>
              <Input id="edit_name_ar" value={editForm.name_ar} onChange={e => setEditForm({...editForm, name_ar: e.target.value})} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_name_en" className="text-right">الاسم (إنجليزي)</Label>
              <Input id="edit_name_en" value={editForm.name_en} onChange={e => setEditForm({...editForm, name_en: e.target.value})} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_symbol" className="text-right">الإشارة</Label>
              <Input id="edit_symbol" value={editForm.symbol} onChange={e => setEditForm({...editForm, symbol: e.target.value})} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_decimals" className="text-right">عدد المنازل</Label>
              <Input id="edit_decimals" type="number" min={0} max={6} value={editForm.decimals} onChange={e => setEditForm({...editForm, decimals: parseInt(e.target.value) || 2})} className="col-span-3" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleEditCurrency}>حفظ التعديلات</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
