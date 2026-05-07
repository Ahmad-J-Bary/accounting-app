import { useState, useEffect, useCallback } from "react";
import { PageHeader } from '@widgets/page-header/PageHeader';
import { Button } from "@shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@shared/ui/card";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@shared/ui/tabs";
import { 
  Plus, Save, RefreshCw, History, DollarSign, 
  ArrowRightLeft, TrendingUp, AlertCircle, Trash2, CheckCircle2 
} from "lucide-react";
import { currencyService, type Currency, type ExchangeRate, type TodayRateStatus } from '@modules/core/api/currencyService';
import { toast } from "sonner";
import { 
  Dialog, DialogContent, DialogDescription, 
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger 
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
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [rateStatus, setRateStatus] = useState<TodayRateStatus[]>([]);
  const [history, setHistory] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedCurrencyForHistory, setSelectedCurrencyForHistory] = useState<string | null>(null);

  const [newCurrency, setNewCurrency] = useState({
    code: "",
    name: "",
    name_ar: "",
    name_en: "",
    symbol: "",
    decimals: 2,
    is_base: false,
    is_active: true,
    notes: ""
  });

  const [newRate, setNewRate] = useState({
    rate: "1",
    type: "Middle"
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [currList, statusList] = await Promise.all([
        currencyService.listCurrencies(),
        currencyService.getTodayRatesStatus()
      ]);
      setCurrencies(currList);
      setRateStatus(statusList);
      
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

  const handleAddCurrency = async () => {
    try {
      await currencyService.createCurrency(newCurrency);
      toast.success("تم النجاح", { description: "تمت إضافة العملة بنجاح" });
      setIsAddDialogOpen(false);
      loadData();
    } catch (e) {
      toast.error("خطأ", { description: String(e) });
    }
  };

  const handleDeleteCurrency = async (code: string) => {
    if (!confirm(`هل أنت متأكد من حذف العملة ${code}؟`)) return;
    try {
      await currencyService.deleteCurrency(code);
      toast.success("تم الحذف", { description: "تم حذف العملة بنجاح" });
      loadData();
    } catch (e) {
      toast.error("خطأ", { description: String(e) });
    }
  };

  const handleSetRate = async (from: string) => {
    const base = currencies.find(c => c.is_base);
    if (!base) return;
    
    try {
      await currencyService.setExchangeRate({
        from_currency: base.code,
        to_currency: from,
        rate: newRate.rate,
        rate_type: newRate.type
      });
      toast.success("تم التحديث", { description: `تم تحديث سعر صرف ${from}` });
      loadData();
    } catch (e) {
      toast.error("خطأ", { description: String(e) });
    }
  };

  const chartData = history.map(h => ({
    date: new Date(h.rate_date).toLocaleDateString("ar-SY", { day: 'numeric', month: 'short' }),
    rate: parseFloat(h.rate)
  }));

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
    <>
      <PageHeader
        title="إدارة العملات وأسعار الصرف"
        subtitle="إدارة العملات المتعددة، تحديث أسعار الصرف اليومية، ومتابعة سجل التغييرات"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "إدارة العملات" }]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadData} disabled={refreshing}>
              <RefreshCw className={`w-4 h-4 ml-2 ${refreshing ? 'animate-spin' : ''}`} />
              تحديث
            </Button>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 ml-2" />
                  إضافة عملة
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]" dir="rtl">
                <DialogHeader>
                  <DialogTitle>إضافة عملة جديدة</DialogTitle>
                  <DialogDescription>
                    أدخل تفاصيل العملة الجديدة. تأكد من صحة رمز العملة (ISO 4217).
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="code" className="text-right">رمز العملة</Label>
                    <Input id="code" value={newCurrency.code} onChange={e => setNewCurrency({...newCurrency, code: e.target.value.toUpperCase()})} className="col-span-3" placeholder="مثلاً USD" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name_ar" className="text-right">الاسم (عربي)</Label>
                    <Input id="name_ar" value={newCurrency.name_ar} onChange={e => setNewCurrency({...newCurrency, name_ar: e.target.value})} className="col-span-3" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="symbol" className="text-right">الرمز ($)</Label>
                    <Input id="symbol" value={newCurrency.symbol} onChange={e => setNewCurrency({...newCurrency, symbol: e.target.value})} className="col-span-3" />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleAddCurrency}>حفظ العملة</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Currencies List */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>العملات النشطة</CardTitle>
                <CardDescription>قائمة بجميع العملات المعرفة في النظام</CardDescription>
              </div>
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                العملة الأساسية: {baseCurrency?.name_ar} ({baseCurrency?.code})
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الرمز</TableHead>
                  <TableHead className="text-right">اسم العملة</TableHead>
                  <TableHead className="text-right">الإشارة</TableHead>
                  <TableHead className="text-right">النوع</TableHead>
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
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">أساسية</Badge>
                      ) : (
                        <Badge variant="secondary">تابعة</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-left">
                      {!curr.is_base && (
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteCurrency(curr.code)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Today's Rates Quick Update */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-primary" />
              تحديث أسعار الصرف
            </CardTitle>
            <CardDescription>تحديث أسعار الصرف مقابل {baseCurrency?.code} لليوم</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {rateStatus.map((status) => (
              <div key={status.currency_code} className="p-4 border rounded-lg bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-lg">{status.currency_code}</div>
                  {status.has_rate_today ? (
                    <div className="flex items-center text-xs text-green-600 gap-1">
                      <CheckCircle2 className="w-3 h-3" /> تم التحديث
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
                      defaultValue={status.rate || status.last_rate || "1"} 
                      onChange={e => setNewRate({...newRate, rate: e.target.value})}
                      className="pl-12 text-left tabular-nums" 
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">
                      {baseCurrency?.code}
                    </span>
                  </div>
                  <Button size="sm" onClick={() => handleSetRate(status.currency_code)}>
                    تحديث
                  </Button>
                </div>
                
                {status.last_rate_date && (
                  <div className="text-[10px] text-muted-foreground">
                    آخر تحديث: {status.last_rate_date}
                  </div>
                )}
              </div>
            ))}
            
            {rateStatus.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm italic">
                لا توجد عملات تابعة للتحديث
              </div>
            )}
          </CardContent>
        </Card>

        {/* History Chart */}
        <Card className="xl:col-span-3">
          <Tabs defaultValue="chart" className="w-full" dir="rtl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5 text-primary" />
                  سجل أسعار الصرف
                </CardTitle>
                <CardDescription>مخطط بياني لتغير أسعار الصرف خلال الـ 30 يوماً الماضية</CardDescription>
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
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1e3a5f" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#1e3a5f" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fill: '#64748b', fontSize: 12}}
                        reversed={true}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fill: '#64748b', fontSize: 12}}
                        domain={['auto', 'auto']}
                      />
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="rate" 
                        name="سعر الصرف"
                        stroke="#1e3a5f" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorRate)" 
                      />
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
                        <TableCell>
                          <Badge variant="outline">{h.rate_type === 'Market' ? 'سعر السوق' : 'سعر رسمي'}</Badge>
                        </TableCell>
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
    </>
  );
}
