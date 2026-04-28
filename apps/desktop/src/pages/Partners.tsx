import { useState, useMemo, useCallback } from "react";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Users, Trash2, RefreshCw, Calculator, TrendingUp, DollarSign, PieChart as PieChartIcon, Settings2, Edit } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

import { partnerService, type PartnerDto, type PartnerRequest } from "@/services/partnerService";

// Refactored Components & Hooks
import { DataTable, Column } from "@/components/erp/shared/DataTable";
import { useDataTable } from "@/hooks/useDataTable";
import { PartnerForm } from "@/components/erp/partners/PartnerForm";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"];

export default function Partners() {
  const [globalStrategy, setGlobalStrategy] = useState("BasedOnCapitalLocal");
  const {
    filtered: partners,
    loading,
    refresh,
    setData,
  } = useDataTable<PartnerDto>({
    fetchData: () => partnerService.listPartners(),
    searchFields: ["name"],
    errorLabel: "فشل جلب الشركاء",
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editPartner, setEditPartner] = useState<PartnerDto | null>(null);
  const [saving, setSaving] = useState(false);

  const totals = useMemo(() => {
    const local = partners.reduce((sum, p) => sum + parseFloat(p.amount_local), 0);
    const usd = partners.reduce((sum, p) => sum + parseFloat(p.amount_usd), 0);
    return { local, usd };
  }, [partners]);

  const partnersWithRatios = useMemo(() => {
    return partners.map(p => {
      let ratio = 0;
      if (globalStrategy === "Manual") {
        ratio = parseFloat(p.profit_sharing_ratio || "0");
      } else if (globalStrategy === "BasedOnCapitalLocal" && totals.local > 0) {
        ratio = (parseFloat(p.amount_local) / totals.local) * 100;
      } else if (globalStrategy === "BasedOnCapitalUSD" && totals.usd > 0) {
        ratio = (parseFloat(p.amount_usd) / totals.usd) * 100;
      }
      return { ...p, calculatedRatio: ratio };
    });
  }, [partners, totals, globalStrategy]);

  const handleSave = async (payload: PartnerRequest) => {
    try {
      setSaving(true);
      if (payload.id) {
        await partnerService.updatePartner(payload);
        toast.success("تم التحديث بنجاح");
      } else {
        await partnerService.addPartner(payload);
        toast.success("تم الإضافة بنجاح");
      }
      setIsDialogOpen(false);
      refresh(true);
    } catch (error) {
      toast.error("خطأ: " + error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = useCallback(async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذا الشريك؟")) return;
    try {
      await partnerService.deletePartner(id);
      toast.success("تم الحذف بنجاح");
      setData(prev => prev.filter(p => p.id !== id));
    } catch (error) {
      toast.error("فشل الحذف: " + error);
    }
  }, [setData]);

  const chartCapitalData = useMemo(() => 
    partners.map(p => ({ name: p.name, value: parseFloat(p.amount_local) })),
    [partners]
  );

  const chartProfitData = useMemo(() => 
    partnersWithRatios.map(p => ({ name: p.name, value: p.calculatedRatio })),
    [partnersWithRatios]
  );

  const columns = useMemo<Column<PartnerDto & { calculatedRatio: number }>[]>(() => [
    { header: "اسم الشريك", accessor: "name", className: "font-bold text-slate-800" },
    { 
      header: "رأس المال (محلي)", 
      accessor: (p) => formatCurrency(parseFloat(p.amount_local)), 
      align: "left", 
      className: "tabular-nums font-medium text-slate-600" 
    },
    { 
      header: "رأس المال ($)", 
      accessor: (p) => formatCurrency(parseFloat(p.amount_usd), "") + " $", 
      align: "left", 
      className: "tabular-nums text-blue-600 font-medium" 
    },
    { 
      header: "نسبة الأرباح", 
      accessor: (p) => <span className="font-extrabold text-green-600 text-base">{p.calculatedRatio.toFixed(2)}%</span>, 
      align: "left" 
    },
    {
      header: "",
      accessor: (p) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="text-blue-600 hover:bg-blue-100 h-8 w-8" onClick={() => { setEditPartner(p); setIsDialogOpen(true); }}>
            <Edit className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 h-8 w-8" onClick={() => handleDelete(p.id)}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
      className: "w-24"
    }
  ], [handleDelete, setEditPartner, setIsDialogOpen]);

  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader
        title="الشركاء ورأس المال"
        subtitle="إدارة الشركاء، حصص رأس المال، وتوزيع الأرباح"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "المحاسبة" }, { label: "الشركاء" }]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refresh()} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ml-2 ${loading ? "animate-spin" : ""}`} />تحديث
            </Button>
            <Button onClick={() => { setEditPartner(null); setIsDialogOpen(true); }}>
              <Plus className="w-4 h-4 ml-2" />إضافة شريك جديد
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="إجمالي رأس المال" value={formatCurrency(totals.local)} icon={<Calculator />} color="border-r-primary" textColor="text-primary" />
        <StatCard label="عدد الشركاء" value={partners.length} icon={<Users />} color="border-r-blue-500" textColor="text-blue-600" />
        <StatCard label="رأس المال بالدولار" value={formatCurrency(totals.usd, "") + " $"} icon={<DollarSign />} color="border-r-green-500" textColor="text-green-600" />
      </div>

      <Card className="p-5 bg-slate-50/80 border-dashed border-2 shadow-inner">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-bold text-sm">طريقة عرض وحساب توزيع الأرباح:</h3>
          </div>
          
          <RadioGroup value={globalStrategy} onValueChange={setGlobalStrategy} className="flex flex-col md:flex-row gap-3 md:gap-6">
            <StrategyOption id="g1" value="BasedOnCapitalLocal" label="بناءً على رأس المال (محلي)" />
            <StrategyOption id="g2" value="BasedOnCapitalUSD" label="بناءً على رأس المال (بالدولار)" />
            <StrategyOption id="g3" value="Manual" label="توزيع يدوي" />
          </RadioGroup>
        </div>
      </Card>

      {partners.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ChartCard title="حصص رأس المال" icon={<PieChartIcon />} data={chartCapitalData} formatter={formatCurrency} />
          <ChartCard title="توزيع الأرباح" icon={<TrendingUp />} data={chartProfitData} formatter={(v: number) => `${v.toFixed(2)}%`} />
        </div>
      )}

      <DataTable data={partnersWithRatios} columns={columns} loading={loading} />

      <PartnerForm 
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        partner={editPartner}
        onSave={handleSave}
        saving={saving}
      />
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  textColor: string;
}

function StatCard({ label, value, icon, color, textColor }: StatCardProps) {
  return (
    <Card className={`p-4 flex items-center gap-4 border-r-4 ${color} shadow-sm`}>
      <div className={`p-3 rounded-full ${textColor.replace('text-', 'bg-').replace('600', '100').replace('primary', 'primary/10')}`}>{icon}</div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-xl font-bold tabular-nums ${textColor}`}>{value}</div>
      </div>
    </Card>
  );
}

interface StrategyOptionProps {
  id: string;
  value: string;
  label: string;
}

function StrategyOption({ id, value, label }: StrategyOptionProps) {
  return (
    <div className="flex items-center space-x-2 space-x-reverse bg-white px-3 py-2 rounded-full border shadow-sm hover:border-primary transition-colors cursor-pointer">
      <RadioGroupItem value={value} id={id} />
      <Label htmlFor={id} className="cursor-pointer text-xs font-medium">{label}</Label>
    </div>
  );
}

interface ChartCardProps {
  title: string;
  icon: React.ReactNode;
  data: { name: string; value: number }[];
  formatter: (value: number | string) => string;
}

function ChartCard({ title, icon, data, formatter }: ChartCardProps) {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4 border-b pb-2">
        <span className="text-primary">{icon}</span>
        <h3 className="font-bold text-sm">{title}</h3>
      </div>
      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={formatter} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
