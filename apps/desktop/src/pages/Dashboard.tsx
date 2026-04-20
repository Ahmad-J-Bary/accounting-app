import { PageHeader } from "@/components/erp/PageHeader";
import { KpiCard } from "@/components/erp/KpiCard";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { QuickActions } from "@/components/erp/QuickActions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  TrendingUp, ShoppingCart, Wallet, Users, Truck, Package,
  AlertCircle, FileText, Plus, Download, Receipt, ArrowUpRight
} from "lucide-react";
import { dashboardKpis, revenueChartData, salesInvoices, payments, products, journalEntries } from "@/lib/mockData";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Legend, PieChart, Pie, Cell
} from "recharts";

const pieData = [
  { name: "إلكترونيات", value: 45, color: "#1e3a5f" },
  { name: "أثاث", value: 25, color: "#0f766e" },
  { name: "مستلزمات", value: 20, color: "#eab308" },
  { name: "أخرى", value: 10, color: "#94a3b8" },
];

export default function Dashboard() {
  const lowStock = products.filter(p => p.stock < p.minStock);

  return (
    <>
      <PageHeader
        title="لوحة التحكم"
        subtitle="نظرة عامة على أداء أعمالك وعملياتك اليومية"
        breadcrumbs={[{ label: "الرئيسية" }, { label: "لوحة التحكم" }]}
        actions={
          <>
            <Select defaultValue="this_month">
              <SelectTrigger className="w-[180px] bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">اليوم</SelectItem>
                <SelectItem value="this_week">هذا الأسبوع</SelectItem>
                <SelectItem value="this_month">هذا الشهر</SelectItem>
                <SelectItem value="this_quarter">الربع الحالي</SelectItem>
                <SelectItem value="this_year">هذه السنة</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline"><Download className="w-4 h-4 ml-2" />تصدير</Button>
          </>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <KpiCard title="إجمالي المبيعات" value={dashboardKpis.sales.value} change={dashboardKpis.sales.change} icon={TrendingUp} iconColor="bg-blue-50 text-blue-600" />
        <KpiCard title="إجمالي المشتريات" value={dashboardKpis.purchases.value} change={dashboardKpis.purchases.change} icon={ShoppingCart} iconColor="bg-purple-50 text-purple-600" />
        <KpiCard title="الرصيد النقدي" value={dashboardKpis.cash.value} change={dashboardKpis.cash.change} icon={Wallet} iconColor="bg-green-50 text-green-600" />
        <KpiCard title="ذمم العملاء" value={dashboardKpis.receivables.value} change={dashboardKpis.receivables.change} icon={Users} iconColor="bg-amber-50 text-amber-600" />
        <KpiCard title="ذمم الموردين" value={dashboardKpis.payables.value} change={dashboardKpis.payables.change} icon={Truck} iconColor="bg-red-50 text-red-600" />
        <KpiCard title="قيمة المخزون" value={dashboardKpis.inventory.value} change={dashboardKpis.inventory.change} icon={Package} iconColor="bg-teal-50 text-teal-600" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-base">الإيرادات والمصروفات</h3>
              <p className="text-xs text-muted-foreground">آخر 6 أشهر</p>
            </div>
            <Tabs defaultValue="chart" className="w-auto">
              <TabsList>
                <TabsTrigger value="chart">مساحي</TabsTrigger>
                <TabsTrigger value="bars">أعمدة</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={revenueChartData}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1e3a5f" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#1e3a5f" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="exp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#dc2626" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip contentStyle={{ direction: "rtl", textAlign: "right" }} />
              <Legend />
              <Area type="monotone" dataKey="revenue" name="الإيرادات" stroke="#1e3a5f" fill="url(#rev)" strokeWidth={2} />
              <Area type="monotone" dataKey="expenses" name="المصروفات" stroke="#dc2626" fill="url(#exp)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-base mb-1">المبيعات حسب الفئة</h3>
          <p className="text-xs text-muted-foreground mb-4">توزيع إيرادات الشهر</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {pieData.map((d) => (
              <div key={d.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                  <span>{d.name}</span>
                </div>
                <span className="tabular-nums font-medium">{d.value}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Alerts + Quick activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="p-5 border-r-4 border-r-red-500">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <h3 className="font-semibold">تنبيهات المخزون المنخفض</h3>
          </div>
          <div className="space-y-2">
            {lowStock.slice(0, 4).map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                <span className="truncate">{p.name}</span>
                <span className="text-red-600 font-medium tabular-nums">{p.stock} / {p.minStock}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5 border-r-4 border-r-amber-500">
          <div className="flex items-center gap-2 mb-3">
            <Receipt className="w-5 h-5 text-amber-600" />
            <h3 className="font-semibold">فواتير متأخرة</h3>
          </div>
          <div className="space-y-2">
            {salesInvoices.filter(i => i.status === "overdue").slice(0, 3).map((inv) => (
              <div key={inv.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                <div>
                  <div className="font-medium">{inv.number}</div>
                  <div className="text-xs text-muted-foreground">{inv.partyName}</div>
                </div>
                <span className="tabular-nums font-medium">{formatCurrency(inv.total)}</span>
              </div>
            ))}
          </div>
        </Card>
        <QuickActions columns={2} />
      </div>

      {/* Recent lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">أحدث فواتير المبيعات</h3>
            <Button variant="ghost" size="sm" className="text-primary">عرض الكل <ArrowUpRight className="w-4 h-4 mr-1" /></Button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-border">
                <th className="text-right font-medium pb-2">رقم الفاتورة</th>
                <th className="text-right font-medium pb-2">العميل</th>
                <th className="text-left font-medium pb-2">المبلغ</th>
                <th className="text-left font-medium pb-2">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {salesInvoices.slice(0, 5).map((inv) => (
                <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-slate-50">
                  <td className="py-2.5 font-medium text-primary">{inv.number}</td>
                  <td className="py-2.5">{inv.partyName}</td>
                  <td className="py-2.5 text-left tabular-nums">{formatCurrency(inv.total)}</td>
                  <td className="py-2.5 text-left"><StatusBadge status={inv.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">أحدث المدفوعات والمقبوضات</h3>
            <Button variant="ghost" size="sm" className="text-primary">عرض الكل <ArrowUpRight className="w-4 h-4 mr-1" /></Button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-border">
                <th className="text-right font-medium pb-2">رقم السند</th>
                <th className="text-right font-medium pb-2">الجهة</th>
                <th className="text-left font-medium pb-2">المبلغ</th>
                <th className="text-left font-medium pb-2">النوع</th>
              </tr>
            </thead>
            <tbody>
              {payments.slice(0, 5).map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-slate-50">
                  <td className="py-2.5 font-medium text-primary">{p.number}</td>
                  <td className="py-2.5">{p.party}</td>
                  <td className="py-2.5 text-left tabular-nums">{formatCurrency(p.amount)}</td>
                  <td className="py-2.5 text-left"><StatusBadge status={p.type} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <div className="mt-4">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">أحدث القيود اليومية</h3>
            <Button variant="ghost" size="sm" className="text-primary">عرض الكل <ArrowUpRight className="w-4 h-4 mr-1" /></Button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-border">
                <th className="text-right font-medium pb-2">رقم القيد</th>
                <th className="text-right font-medium pb-2">التاريخ</th>
                <th className="text-right font-medium pb-2">البيان</th>
                <th className="text-left font-medium pb-2">مدين</th>
                <th className="text-left font-medium pb-2">دائن</th>
                <th className="text-left font-medium pb-2">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {journalEntries.slice(0, 5).map((j) => (
                <tr key={j.id} className="border-b border-border last:border-0 hover:bg-slate-50">
                  <td className="py-2.5 font-medium text-primary">{j.number}</td>
                  <td className="py-2.5">{formatDate(j.date)}</td>
                  <td className="py-2.5">{j.description}</td>
                  <td className="py-2.5 text-left tabular-nums">{formatCurrency(j.debit)}</td>
                  <td className="py-2.5 text-left tabular-nums">{formatCurrency(j.credit)}</td>
                  <td className="py-2.5 text-left"><StatusBadge status={j.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}