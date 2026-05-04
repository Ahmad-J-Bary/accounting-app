import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/erp/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  ArrowRight, TrendingUp, TrendingDown, Package, RefreshCw, Search,
  AlertTriangle, ShoppingCart, ShoppingBag, Layers, Wrench, ArrowLeftRight,
  BarChart2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { materialService } from "@/services/materialService";
import { categoryService } from "@/services/categoryService";
import type { MaterialDto, CategoryDto, StockMovementDetailDto } from "@erp/shared-types";
import { toast } from "sonner";
import { useCurrencyContext } from "@/context/CurrencyContext";
import { useColumnPreferences } from "@/hooks/useColumnPreferences";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings2, DollarSign, Coins } from "lucide-react";

// ── Helpers ─────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  Purchase:       { label: "شراء",              icon: ShoppingCart,  color: "text-green-700",  bg: "bg-green-50 border-green-200" },
  Sale:           { label: "بيع",               icon: ShoppingBag,   color: "text-blue-700",   bg: "bg-blue-50 border-blue-200" },
  OpeningBalance: { label: "أول المدة",          icon: Layers,        color: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
  In:             { label: "إدخال",             icon: TrendingUp,    color: "text-emerald-700",bg: "bg-emerald-50 border-emerald-200" },
  Out:            { label: "إخراج",             icon: TrendingDown,  color: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
  Damaged:        { label: "تالف",              icon: AlertTriangle, color: "text-red-700",    bg: "bg-red-50 border-red-200" },
  Adjustment:     { label: "تسوية",             icon: Wrench,        color: "text-amber-700",  bg: "bg-amber-50 border-amber-200" },
  Transfer:       { label: "تحويل",             icon: ArrowLeftRight,color: "text-slate-700",  bg: "bg-slate-50 border-slate-200" },
};

function getTypeConfig(type: string) {
  return TYPE_CONFIG[type] ?? { label: type, icon: Package, color: "text-slate-700", bg: "bg-slate-50 border-slate-200" };
}

function fmt(v: string | undefined, decimals = 2) {
  if (!v) return "0";
  const n = parseFloat(v);
  if (isNaN(n)) return "0";
  return n.toLocaleString("ar-SY", { minimumFractionDigits: 0, maximumFractionDigits: decimals });
}

function fmtDate(iso: string) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("ar-SY", { year: "numeric", month: "short", day: "numeric" });
  } catch { return iso; }
}

function fmtTime(iso: string) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("ar-SY", { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

// ── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className={cn("rounded-xl border px-4 py-3 space-y-0.5", color ?? "bg-white border-slate-200")}>
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-[10px] text-slate-400">{sub}</p>}
    </div>
  );
}

function MovementTypeBadge({ type }: { type: string }) {
  const cfg = getTypeConfig(type);
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border", cfg.bg, cfg.color)}>
      <Icon className="w-2.5 h-2.5" />
      {cfg.label}
    </span>
  );
}

function BalanceChart({ movements }: { movements: StockMovementDetailDto[] }) {
  const data = movements.map((m, i) => ({
    index: i + 1,
    label: fmtDate(m.movement_date),
    balance: parseFloat(m.balance_after) || 0,
    type: m.movement_type_label,
  }));
  if (!data.length) return null;
  const maxVal = Math.max(...data.map(d => d.balance), 0);
  return (
    <Card className="p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <BarChart2 className="w-4 h-4 text-blue-500" />
        <span className="text-sm font-semibold text-slate-700">منحنى الرصيد عبر الزمن</span>
        <span className="text-[10px] text-slate-400 mr-auto">{data.length} حركة</span>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="index" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis domain={[0, maxVal * 1.1 || 10]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={40} />
          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
            formatter={(v: number) => [v.toLocaleString('ar-SY'), 'الرصيد']}
            labelFormatter={(i: number) => data[i - 1]?.label ?? ''}
          />
          <Area
            type="monotone" dataKey="balance"
            stroke="#3b82f6" strokeWidth={2}
            fill="url(#balanceGrad)" dot={{ r: 3, fill: '#3b82f6' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}

interface MovementTableProps {
  movements: StockMovementDetailDto[];
  loading: boolean;
  visibleColumns: string[];
}

function MovementTable({ movements, loading, visibleColumns }: MovementTableProps) {
  const { formatAmount } = useCurrencyContext();
  
  const isVisible = (id: string) => visibleColumns.includes(id);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin ml-2" /> جاري التحميل...
      </div>
    );
  }
  if (!movements.length) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
        <Package className="w-8 h-8 opacity-30" />
        <p className="text-sm">لا توجد حركات مطابقة</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-100">
      <table className="w-full text-sm" dir="rtl">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] uppercase tracking-wide">
            <th className="px-3 py-2.5 text-right font-semibold">التاريخ</th>
            <th className="px-3 py-2.5 text-right font-semibold">نوع الحركة</th>
            <th className="px-3 py-2.5 text-right font-semibold">المرجع</th>
            <th className="px-3 py-2.5 text-right font-semibold">الجهة</th>
            <th className="px-3 py-2.5 text-center font-semibold text-green-600">الداخل</th>
            <th className="px-3 py-2.5 text-center font-semibold text-red-600">الخارج</th>
            {isVisible("balance_before") && <th className="px-3 py-2.5 text-center font-semibold">الرصيد قبل</th>}
            {isVisible("balance_after") && <th className="px-3 py-2.5 text-center font-semibold">الرصيد بعد</th>}
            {isVisible("unit_cost_usd") && (
              <th className="px-3 py-2.5 text-center font-semibold text-amber-700">
                <div className="flex items-center justify-center gap-1">
                  <DollarSign className="w-2.5 h-2.5" />
                  <span>التكلفة (USD)</span>
                </div>
              </th>
            )}
            {isVisible("unit_cost_local") && (
              <th className="px-3 py-2.5 text-center font-semibold text-amber-800">
                <div className="flex items-center justify-center gap-1">
                  <Coins className="w-2.5 h-2.5" />
                  <span>التكلفة (Display)</span>
                </div>
              </th>
            )}
            <th className="px-3 py-2.5 text-right font-semibold">ملاحظات</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {movements.map((m, i) => (
            <tr
              key={m.id}
              className={cn(
                "hover:bg-slate-50/80 transition-colors",
                i % 2 === 0 ? "bg-white" : "bg-slate-50/30"
              )}
            >
              {/* Date */}
              <td className="px-3 py-2.5 whitespace-nowrap">
                <div className="font-medium text-slate-700 text-xs">{fmtDate(m.movement_date)}</div>
                <div className="text-[10px] text-slate-400">{fmtTime(m.movement_date)}</div>
              </td>

              {/* Type */}
              <td className="px-3 py-2.5">
                <MovementTypeBadge type={m.movement_type} />
              </td>

              {/* Reference */}
              <td className="px-3 py-2.5">
                {m.invoice_number ? (
                  <span className="font-mono text-[11px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">
                    {m.invoice_number}
                  </span>
                ) : m.reference ? (
                  <span className="font-mono text-[11px] text-slate-500">{m.reference}</span>
                ) : (
                  <span className="text-slate-300 text-[11px]">—</span>
                )}
              </td>

              {/* Party */}
              <td className="px-3 py-2.5 text-[12px] text-slate-600 font-medium">
                {m.party_name ?? "—"}
              </td>

              {/* In */}
              <td className="px-3 py-2.5 text-center tabular-nums">
                {m.is_inflow ? (
                  <span className="font-bold text-green-600 text-sm">{fmt(m.quantity)}</span>
                ) : (
                  <span className="text-slate-300 text-xs">—</span>
                )}
              </td>

              {/* Out */}
              <td className="px-3 py-2.5 text-center tabular-nums">
                {!m.is_inflow ? (
                  <span className="font-bold text-red-500 text-sm">{fmt(m.quantity)}</span>
                ) : (
                  <span className="text-slate-300 text-xs">—</span>
                )}
              </td>

              {/* Balance Before */}
              {isVisible("balance_before") && (
                <td className="px-3 py-2.5 text-center tabular-nums text-slate-500 text-xs font-mono">
                  {fmt(m.balance_before)}
                </td>
              )}

              {/* Balance After */}
              {isVisible("balance_after") && (
                <td className="px-3 py-2.5 text-center tabular-nums">
                  <span className={cn(
                    "font-bold text-sm font-mono",
                    parseFloat(m.balance_after) > 0 ? "text-slate-700" : "text-red-600"
                  )}>
                    {fmt(m.balance_after)}
                  </span>
                </td>
              )}

              {/* Unit Cost USD */}
              {isVisible("unit_cost_usd") && (
                <td className="px-3 py-2.5 text-center tabular-nums text-amber-700 text-xs font-mono">
                  {parseFloat(m.unit_cost) > 0 ? formatAmount(parseFloat(m.unit_cost), { currencyCode: "USD" }) : "—"}
                </td>
              )}

              {/* Unit Cost Local */}
              {isVisible("unit_cost_local") && (
                <td className="px-3 py-2.5 text-center tabular-nums text-amber-800 text-xs font-mono">
                  {parseFloat(m.unit_cost) > 0 ? formatAmount(parseFloat(m.unit_cost)) : "—"}
                </td>
              )}

              {/* Notes */}
              <td className="px-3 py-2.5 text-[11px] text-slate-400 max-w-[120px] truncate">
                {m.notes || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function MaterialDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [material, setMaterial] = useState<MaterialDto | null>(null);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [movements, setMovements] = useState<StockMovementDetailDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [movLoading, setMovLoading] = useState(true);
  
  const { formatAmount } = useCurrencyContext();

  const availableColumns = [
    { id: "balance_before", label: "الرصيد قبل" },
    { id: "balance_after", label: "الرصيد بعد" },
    { id: "unit_cost_usd", label: "التكلفة (USD)" },
    { id: "unit_cost_local", label: "التكلفة (Display)" },
  ];
  const defaultCols = ["balance_after", "unit_cost_usd", "unit_cost_local"];
  const { visibleColumns, toggleColumn, isVisible } = useColumnPreferences("material-movements", defaultCols);

  // Filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("all");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setMovLoading(true);
    try {
      const [mat, cats, movs] = await Promise.all([
        materialService.getMaterial(id),
        categoryService.listCategories(),
        materialService.listMovementsByMaterial(id),
      ]);
      setMaterial(mat);
      setCategories(cats);
      setMovements(movs);
    } catch (e) {
      toast.error("فشل تحميل بيانات المادة");
    } finally {
      setLoading(false);
      setMovLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // ── Filter Logic ────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return movements.filter(m => {
      // tab filter
      if (activeTab === "purchases" && m.movement_type !== "Purchase") return false;
      if (activeTab === "sales"     && m.movement_type !== "Sale")     return false;
      if (activeTab === "opening"   && m.movement_type !== "OpeningBalance") return false;
      if (activeTab === "other"     && ["Purchase", "Sale", "OpeningBalance"].includes(m.movement_type)) return false;

      // type filter
      if (typeFilter !== "all" && m.movement_type !== typeFilter) return false;

      // text search
      const q = search.toLowerCase();
      if (q) {
        const haystack = [m.reference, m.invoice_number, m.party_name, m.notes, m.movement_type_label]
          .filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [movements, activeTab, typeFilter, search]);

  // ── Summary from movements ──────────────────────────────────────────────────
  const summary = useMemo(() => {
    const purchases    = movements.filter(m => m.movement_type === "Purchase");
    const sales        = movements.filter(m => m.movement_type === "Sale");
    const opening      = movements.filter(m => m.movement_type === "OpeningBalance");
    const firstMov     = movements[0];
    const lastMov      = movements[movements.length - 1];
    const unlinkedCount = movements.filter(
      m => !m.invoice_number && !m.reference
    ).length;
    return { purchases, sales, opening, firstMov, lastMov, unlinkedCount };
  }, [movements]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin ml-2" /> جاري تحميل البيانات...
      </div>
    );
  }

  if (!material) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-4">
        <Package className="w-12 h-12 opacity-30" />
        <p>المادة غير موجودة</p>
        <Button variant="outline" onClick={() => navigate("/materials")}>العودة للقائمة</Button>
      </div>
    );
  }

  const catNames = material.category_ids.map(cid => categories.find(c => c.id === cid)?.name).filter(Boolean);

  return (
    <>
      <PageHeader
        title={material.name}
        subtitle={`بطاقة تتبع المادة – ${material.code || "بدون كود"}`}
        breadcrumbs={[
          { label: "الرئيسية", to: "/dashboard" },
          { label: "المخزون" },
          { label: "بطاقات المواد", to: "/materials" },
          { label: material.name },
        ]}
        actions={
          <>
            <Button variant="outline" onClick={load} disabled={movLoading}>
              <RefreshCw className={cn("w-4 h-4 ml-2", movLoading && "animate-spin")} />
              تحديث
            </Button>
            <Button variant="outline" onClick={() => navigate("/materials")}>
              <ArrowRight className="w-4 h-4 ml-2" />
              العودة
            </Button>
          </>
        }
      />

      {/* ── Material Hero ─────────────────────────────────────────────────────── */}
      <Card className="p-5 mb-4">
        <div className="flex flex-wrap items-start gap-6">
          {/* Icon */}
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md flex-shrink-0">
            <Package className="w-7 h-7" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-[200px]">
            <h2 className="text-xl font-bold text-slate-800">{material.name}</h2>
            <div className="flex flex-wrap gap-2 mt-2">
              {material.code && (
                <span className="font-mono text-[11px] bg-slate-100 text-slate-700 px-2 py-1 rounded border font-bold">
                  {material.code}
                </span>
              )}
              {material.barcode && (
                <span className="font-mono text-[11px] bg-amber-50 text-amber-700 px-2 py-1 rounded border border-amber-200">
                  {material.barcode}
                </span>
              )}
              {catNames.map((c, i) => (
                <Badge key={i} variant="secondary" className="text-[10px]">{c}</Badge>
              ))}
            </div>

            {/* Units */}
            {material.units?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {material.units.map((u, i) => (
                  <span key={i} className="text-[10px] font-medium bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">
                    {u.name}{!u.is_base && u.conversion_factor ? ` : ${u.conversion_factor}` : ""}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Quick stats */}
          <div className="flex flex-wrap gap-2">
            <StatCard label="المتوفر" value={fmt(material.total_available)} color="bg-emerald-50 border-emerald-200 text-emerald-800" />
            <StatCard label="متوسط التكلفة" value={formatAmount(parseFloat(material.average_cost))} color="bg-amber-50 border-amber-200 text-amber-800" sub={`USD: ${formatAmount(parseFloat(material.average_cost), { currencyCode: "USD" })}`} />
            <StatCard label="آخر شراء" value={formatAmount(parseFloat(material.last_purchase_price))} color="bg-green-50 border-green-200 text-green-800" sub={`USD: ${formatAmount(parseFloat(material.last_purchase_price), { currencyCode: "USD" })}`} />
            <StatCard label="آخر مبيع" value={formatAmount(parseFloat(material.last_sale_price))} color="bg-blue-50 border-blue-200 text-blue-800" sub={`USD: ${formatAmount(parseFloat(material.last_sale_price), { currencyCode: "USD" })}`} />
          </div>
        </div>
      </Card>

      {/* ── Summary Stats ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
        <StatCard label="الكمية الكلية الواردة" value={fmt(material.total_received)} color="bg-green-50 border-green-200 text-green-800" sub={`${summary.purchases.length} عملية شراء`} />
        <StatCard label="الكمية المباعة" value={fmt(material.total_sold)} color="bg-blue-50 border-blue-200 text-blue-800" sub={`${summary.sales.length} عملية بيع`} />
        <StatCard label="الكمية المتوفرة" value={fmt(material.total_available)} color="bg-emerald-50 border-emerald-200 text-emerald-800" />
        <StatCard label="الكمية التالفة" value={fmt(material.total_damaged)} color="bg-red-50 border-red-200 text-red-800" />
        <StatCard label="أول حركة" value={summary.firstMov ? fmtDate(summary.firstMov.movement_date) : "—"} color="bg-slate-50 border-slate-200 text-slate-700" />
        <StatCard label="آخر حركة" value={summary.lastMov ? fmtDate(summary.lastMov.movement_date) : "—"} color="bg-slate-50 border-slate-200 text-slate-700" />
      </div>

      {/* ── Unlinked alert ───────────────────────────────────────────────────── */}
      {summary.unlinkedCount > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>
            <strong>{summary.unlinkedCount}</strong> حركة غير مرتبطة بمستند — لا يوجد رقم فاتورة أو مرجع لهذه الحركات.
          </span>
        </div>
      )}

      {/* ── Balance Chart ────────────────────────────────────────────────────── */}
      {!movLoading && movements.length > 1 && <BalanceChart movements={movements} />}

      {/* ── Movement Tabs ─────────────────────────────────────────────────────── */}
      <Card className="p-5">
        <Tabs value={activeTab} onValueChange={v => { setActiveTab(v); setTypeFilter("all"); }} dir="rtl">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <TabsList className="h-9">
              <TabsTrigger value="all" className="text-xs">
                كل الحركات <span className="mr-1 text-[10px] opacity-60">({movements.length})</span>
              </TabsTrigger>
              <TabsTrigger value="purchases" className="text-xs">
                الشراء <span className="mr-1 text-[10px] opacity-60">({summary.purchases.length})</span>
              </TabsTrigger>
              <TabsTrigger value="sales" className="text-xs">
                المبيعات <span className="mr-1 text-[10px] opacity-60">({summary.sales.length})</span>
              </TabsTrigger>
              <TabsTrigger value="opening" className="text-xs">
                أول المدة <span className="mr-1 text-[10px] opacity-60">({summary.opening.length})</span>
              </TabsTrigger>
              <TabsTrigger value="other" className="text-xs">أخرى</TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2">
              {/* Type filter (only shown in "all" tab) */}
              {activeTab === "all" && (
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="h-8 w-[140px] text-xs">
                    <SelectValue placeholder="نوع الحركة" />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    <SelectItem value="all">الكل</SelectItem>
                    {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Search */}
              <div className="relative">
                <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input
                  placeholder="بحث بالمرجع أو الجهة..."
                  className="h-8 pr-8 text-xs w-[180px]"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8 shrink-0">
                    <Settings2 className="w-3.5 h-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[180px]">
                  <DropdownMenuLabel className="text-xs">الأعمدة الظاهرة</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {availableColumns.map((col) => (
                    <DropdownMenuCheckboxItem
                      key={col.id}
                      className="text-xs"
                      checked={isVisible(col.id)}
                      onCheckedChange={() => toggleColumn(col.id)}
                    >
                      {col.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <TabsContent value="all"      className="mt-0"><MovementTable movements={filtered} loading={movLoading} visibleColumns={visibleColumns} /></TabsContent>
          <TabsContent value="purchases" className="mt-0"><MovementTable movements={filtered} loading={movLoading} visibleColumns={visibleColumns} /></TabsContent>
          <TabsContent value="sales"    className="mt-0"><MovementTable movements={filtered} loading={movLoading} visibleColumns={visibleColumns} /></TabsContent>
          <TabsContent value="opening"  className="mt-0"><MovementTable movements={filtered} loading={movLoading} visibleColumns={visibleColumns} /></TabsContent>
          <TabsContent value="other"    className="mt-0"><MovementTable movements={filtered} loading={movLoading} visibleColumns={visibleColumns} /></TabsContent>
        </Tabs>

        {/* Legend */}
        {!movLoading && movements.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-2">
            {Object.entries(TYPE_CONFIG).map(([k, v]) => {
              const Icon = v.icon;
              const count = movements.filter(m => m.movement_type === k).length;
              if (!count) return null;
              return (
                <button
                  key={k}
                  onClick={() => { setActiveTab("all"); setTypeFilter(typeFilter === k ? "all" : k); }}
                  className={cn("inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border cursor-pointer transition-all", v.bg, v.color, typeFilter === k ? "ring-2 ring-current" : "opacity-70 hover:opacity-100")}
                >
                  <Icon className="w-2.5 h-2.5" />
                  {v.label} ({count})
                </button>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}
