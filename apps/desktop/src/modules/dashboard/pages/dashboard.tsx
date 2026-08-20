import { useState, useMemo } from "react";
import { Button } from "@shared/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@shared/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import {
  Wallet, Users, Truck, Package, LayoutDashboard, Bell, DollarSign,
  Building2, Landmark, Loader2
} from "lucide-react";
import { formatDate, formatNumber } from '@shared/lib/format';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell
} from "recharts";
import { DashboardLayout, DashboardCard } from "@widgets/templates/DashboardLayout";
import { StatusBadge } from '@widgets/stats/StatusBadge';
import { QuickActions } from '@app/shell/QuickActions';
import { DashboardSection } from '@widgets/dashboard/DashboardSection';
import { FinancialMetricCard } from '@widgets/dashboard/FinancialMetricCard';

import { useDashboardMetrics, type DashboardPeriod } from "@modules/dashboard/hooks/useDashboardMetrics";

import { useCurrencyContext, type CurrencyDisplayMode } from "@app/providers/CurrencyContext";

// Month names in Arabic
const MONTH_NAMES = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

const CHART_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#64748b", "#8b5cf6", "#ec4899"];

export default function Dashboard() {
  const { formatAmount, displayMode, baseCurrency, currencies } = useCurrencyContext();
  const [localDisplayMode, setLocalDisplayMode] = useState<CurrencyDisplayMode | "both">(displayMode);
  const [period, setPeriod] = useState<DashboardPeriod>("this_month");

  // React Query feeds, invalidated after every accounting mutation (see
  // `ALL_REPORT_KEYS` / `ALL_INVENTORY_KEYS`) — the dashboard refreshes with
  // the posted ledger instead of a full page reload. GL tiles + the revenue
  // chart are filtered client-side to the selected period through the same
  // projection the Income Statement consumes (`computeGlAccountNets`).
  const { data, refreshing } = useDashboardMetrics(period);

  const toNumber = (value?: string | null) => {
    const parsed = Number.parseFloat(value ?? "0");
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const { sales, purchases, cash, bank, receivables, payables, loans, monthly: glMonthly } = data.kpis;

  const liTotal = useMemo(() => cash + bank + receivables, [cash, bank, receivables]);
  const aliTotal = useMemo(() => payables + loans, [payables, loans]);

  const recentJournals = useMemo(() => data.journalEntries.slice(0, 5), [data.journalEntries]);

  const lowStock = useMemo(() => data.materials.filter(
    (p) => toNumber(p.total_available) < toNumber(p.minimum_stock)
  ), [data.materials]);

  // === Revenue/Expenses chart from GL (posted ledger, grouped by month) ===
  const revenueChartData = useMemo(() => {
    const monthly = new Map<string, { revenue: number; expenses: number }>();
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthly.set(MONTH_NAMES[d.getMonth()], { revenue: 0, expenses: 0 });
    }
    glMonthly.forEach(({ yearMonth, revenue, expenses }) => {
      const d = new Date(`${yearMonth}-01T00:00:00`);
      if (Number.isNaN(d.getTime())) return;
      const name = MONTH_NAMES[d.getMonth()];
      if (monthly.has(name)) {
        const cur = monthly.get(name)!;
        cur.revenue += revenue;
        cur.expenses += expenses;
      }
    });
    return Array.from(monthly.entries()).map(([month, data]) => ({
      month, ...data
    }));
  }, [glMonthly]);

  // === Category distribution from real materials ===
  const catNameById = useMemo(() => {
    const map = new Map<string, string>();
    data.categories.forEach(c => map.set(c.id, c.name));
    return map;
  }, [data.categories]);

  const pieData = useMemo(() => {
    const catMap = new Map<string, number>();
    data.materials.forEach(p => {
      const firstCatId = p.category_ids?.[0];
      const name = firstCatId ? (catNameById.get(firstCatId) || "أخرى") : "بدون تصنيف";
      catMap.set(name, (catMap.get(name) || 0) + 1);
    });
    const total = data.materials.length || 1;
    return Array.from(catMap.entries()).map(([name, count], idx) => ({
      name,
      value: Math.round((count / total) * 100),
      color: CHART_COLORS[idx % CHART_COLORS.length],
    }));
  }, [data.materials, catNameById]);

  // === Recent payments (up to 5) ===
  const recentPayments = useMemo(() =>
    data.payments
      .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())
      .slice(0, 5),
  [data.payments]);

  const secondaryCurrencies = currencies.filter(c => !c.is_base);

  const paymentTypeLabel: Record<string, string> = {
    Receipt: "مقبوض",
    SupplierPayment: "مدفوع لمورد",
    CustomerPayment: "مدفوع لعميل",
    SupplierReceipt: "مقبوض من مورد",
    ExpenseVoucher: "سند صرف",
    DrawingsVoucher: "سند مسحوبات",
    CashIn: "إيداع خزينة",
    CashOut: "سحب خزينة",
  };

  return (
    <DashboardLayout
      header={
        <>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
              <LayoutDashboard className="w-8 h-8 text-white" />
            </div>
            <div className="space-y-1">
              <h1 className="text-3xl font-black text-slate-900">لوحة التحكم</h1>
              <p className="text-slate-400 font-medium">نظرة عامة على أداء نظامك المحاسبي</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setLocalDisplayMode("base")}
                className={`px-3 py-1.5 text-xs rounded-lg font-bold transition-all ${localDisplayMode === "base" ? "bg-white shadow-sm" : "text-slate-500"}`}
              >
                {baseCurrency?.symbol || baseCurrency?.code || "الأساسية"}
              </button>
              {secondaryCurrencies.map(c => (
                <button
                  key={c.code}
                  onClick={() => setLocalDisplayMode("selected")}
                  className={`px-3 py-1.5 text-xs rounded-lg font-bold transition-all ${localDisplayMode === "selected" ? "bg-white shadow-sm" : "text-slate-500"}`}
                >
                  {c.symbol || c.code}
                </button>
              ))}
              <button
                onClick={() => setLocalDisplayMode("both")}
                className={`px-3 py-1.5 text-xs rounded-lg font-bold transition-all ${localDisplayMode === "both" ? "bg-white shadow-sm" : "text-slate-500"}`}
              >
                <DollarSign className="w-3 h-3 inline ml-1" />
                كلاهما
              </button>
            </div>
            <Select value={period} onValueChange={(v) => setPeriod(v as DashboardPeriod)}>
              <SelectTrigger className="w-[180px] h-12 bg-white rounded-xl border-slate-200 shadow-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">اليوم</SelectItem>
                <SelectItem value="this_month">هذا الشهر</SelectItem>
                <SelectItem value="this_year">هذه السنة</SelectItem>
              </SelectContent>
            </Select>
            {refreshing && (
              <span className="flex h-12 items-center gap-1.5 rounded-xl bg-white px-4 border border-slate-200 shadow-sm text-slate-500 text-xs">
                <Loader2 className="h-4 w-4 animate-spin" />
                جارٍ التحديث…
              </span>
            )}
          </div>
        </>
      }
    >
      {/* Row 1: لي / علي sections */}
      <div className="col-span-12 lg:col-span-7">
        <DashboardSection title="لي" total={liTotal} subtitle="ما للشركة من أرصدة رئيسية" displayMode={localDisplayMode}>
          <FinancialMetricCard label="الصندوق (الخزينة)" value={cash} icon={Wallet} displayMode={localDisplayMode} />
          {bank !== 0 && <FinancialMetricCard label="رصيد البنك" value={bank} icon={Building2} displayMode={localDisplayMode} />}
          <FinancialMetricCard label="ذمم العملاء" value={receivables} icon={Users} displayMode={localDisplayMode} />
        </DashboardSection>
      </div>

      <div className="col-span-12 lg:col-span-5">
        <DashboardSection title="علي" total={aliTotal} subtitle="ما على الشركة من التزامات رئيسية" displayMode={localDisplayMode}>
          <FinancialMetricCard label="ذمم الموردين" value={payables} icon={Truck} displayMode={localDisplayMode} />
          {loans !== 0 && <FinancialMetricCard label="القروض" value={loans} icon={Landmark} displayMode={localDisplayMode} />}
        </DashboardSection>
      </div>

      {/* Row 2: Operational metrics */}
      <DashboardCard span={4} title="المبيعات" subtitle="إيرادات الفترة">
        <div className="text-3xl font-black tabular-nums text-slate-900">
          {formatAmount(sales, { mode: localDisplayMode })}
        </div>
      </DashboardCard>

      <DashboardCard span={4} title="المشتريات" subtitle="مشتريات الفترة">
        <div className="text-3xl font-black tabular-nums text-slate-900">
          {formatAmount(purchases, { mode: localDisplayMode })}
        </div>
      </DashboardCard>

      <DashboardCard span={4} title="المخزون" subtitle="قيمة المخزون الحالية">
        <div className="text-3xl font-black tabular-nums text-slate-900">
          {formatAmount(data.inventory, { mode: localDisplayMode })}
        </div>
      </DashboardCard>

      {/* Charts + Alerts + Recent Activity */}
      <DashboardCard 
        span={8} 
        title="الإيرادات والمصروفات" 
        subtitle="مقارنة الأداء المالي لآخر 6 أشهر"
        actions={
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <Button size="sm" variant="ghost" className="rounded-lg h-8 px-4 bg-white shadow-sm font-bold">مساحي</Button>
            <Button size="sm" variant="ghost" className="rounded-lg h-8 px-4 text-slate-500 font-bold">أعمدة</Button>
          </div>
        }
      >
        {revenueChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={revenueChartData}>
              <defs>
                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dx={-10} />
              <Tooltip 
                contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', direction: 'rtl'}}
              />
              <Area type="monotone" dataKey="revenue" name="الإيرادات" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
              <Area type="monotone" dataKey="expenses" name="المصروفات" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorExp)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[320px] text-slate-300 font-bold text-sm">
            لا توجد بيانات إيرادات أو مصروفات مسجلة بعد
          </div>
        )}
      </DashboardCard>

      <DashboardCard span={4} title="توزيع المخزون" subtitle="حسب الفئات الرئيسية">
        <div className="flex flex-col h-full justify-between">
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={5} dataKey="value">
                    {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-4 mt-6">
                {pieData.map((d) => (
                  <div key={d.name} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: d.color}} />
                    <div>
                      <div className="text-[10px] font-black text-slate-400 uppercase">{d.name}</div>
                      <div className="font-black text-slate-900">{d.value}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-[320px] text-slate-300 font-bold text-sm">
              لا توجد أصناف مسجلة بعد
            </div>
          )}
        </div>
      </DashboardCard>

      {/* Bottom Row: Alerts + Recent */}
      <DashboardCard span={4} title="تنبيهات النظام" subtitle="المخزون والتحذيرات">
        <div className="space-y-4">
          {lowStock.length > 0 ? (
            <>
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-rose-50 border border-rose-100">
                <div className="w-10 h-10 rounded-xl bg-rose-600 flex items-center justify-center">
                  <Bell className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-black text-rose-600">المخزون المنخفض</div>
                  <div className="text-sm font-bold text-rose-900">{lowStock.length} أصناف بحاجة للطلب</div>
                </div>
              </div>
              <div className="space-y-2 max-h-[200px] overflow-auto">
                {lowStock.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 border-b border-slate-50 last:border-0 group hover:bg-slate-50 rounded-lg transition-colors">
                    <span className="text-sm font-bold text-slate-700">{p.name}</span>
                    <span className="text-xs font-black tabular-nums text-rose-600 bg-rose-50 px-2 py-1 rounded-md">
                      {p.total_available} / {p.minimum_stock}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center">
                <Package className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="text-xs font-black text-emerald-600">المخزون مؤمن</div>
                <div className="text-sm font-bold text-emerald-900">جميع الأصناف ضمن الحد الآمن</div>
              </div>
            </div>
          )}
          <QuickActions columns={1} />
        </div>
      </DashboardCard>

      <DashboardCard span={8} title="أحدث النشاطات" subtitle="القيود والمدفوعات الأخيرة">
        <Tabs defaultValue="sales" className="w-full">
          <TabsList className="bg-slate-100 p-1 rounded-xl mb-6">
            <TabsTrigger value="sales" className="rounded-lg font-bold data-[state=active]:bg-white">القيود</TabsTrigger>
            <TabsTrigger value="payments" className="rounded-lg font-bold data-[state=active]:bg-white">المدفوعات</TabsTrigger>
          </TabsList>

          <TabsContent value="sales" className="m-0">
            {recentJournals.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-400 font-black text-[10px] uppercase tracking-widest border-b border-slate-100">
                      <th className="text-right pb-4">رقم القيد</th>
                      <th className="text-right pb-4">البيان</th>
                      <th className="text-left pb-4">المبلغ</th>
                      <th className="text-left pb-4">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {recentJournals.map((j) => (
                      <tr key={j.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 font-black text-blue-600">{formatNumber(parseInt(j.entry_number) || 0)}</td>
                        <td className="py-4 font-bold text-slate-700 truncate max-w-[200px]">{j.description}</td>
                        <td className="py-4 text-left tabular-nums font-black">
                          {toNumber(j.total_base_debit) > 0
                            ? formatAmount(toNumber(j.total_base_debit), { mode: localDisplayMode })
                            : formatAmount(toNumber(j.total_base_credit), { mode: localDisplayMode })}
                        </td>
                        <td className="py-4 text-left"><StatusBadge status={j.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-slate-300 font-bold text-sm">
                لا توجد قيود يومية مسجلة بعد
              </div>
            )}
          </TabsContent>

          <TabsContent value="payments" className="m-0">
            {recentPayments.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-400 font-black text-[10px] uppercase tracking-widest border-b border-slate-100">
                      <th className="text-right pb-4">رقم السند</th>
                      <th className="text-right pb-4">النوع</th>
                      <th className="text-right pb-4">الطرف</th>
                      <th className="text-left pb-4">المبلغ</th>
                      <th className="text-left pb-4">التاريخ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {recentPayments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 font-black text-blue-600">{formatNumber(parseInt(p.voucher_number) || 0)}</td>
                        <td className="py-4 font-bold text-slate-700">{paymentTypeLabel[p.payment_type] || p.payment_type}</td>
                        <td className="py-4 font-bold text-slate-700">{p.customer_name || p.supplier_name || "—"}</td>
                        <td className="py-4 text-left tabular-nums font-black">{formatAmount(toNumber(p.amount), { mode: localDisplayMode })}</td>
                        <td className="py-4 text-slate-500 tabular-nums font-mono text-xs">{formatDate(p.payment_date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-slate-300 font-bold text-sm">
                لا توجد مدفوعات مسجلة بعد
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DashboardCard>
    </DashboardLayout>
  );
}
