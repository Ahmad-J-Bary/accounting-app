import { useState, useCallback, useMemo } from "react";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Users, RefreshCw, Calculator, TrendingUp, DollarSign, PieChart as PieChartIcon, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

import { partnerService, type PartnerDto, type PartnerRequest } from "@/services/partnerService";

// Refactored Components & Hooks
import { MasterDetailLayout } from "@/components/erp/layouts/MasterDetailLayout";
import { DataTable, Column } from "@/components/erp/shared/DataTable";
import { TableActions } from "@/components/erp/shared/TableActions";
import { useDataTable } from "@/hooks/useDataTable";
import { PartnerForm } from "@/components/erp/partners/PartnerForm";
import { StatCard } from "@/components/erp/shared/StatCard";
import { usePartnerRatios } from "@/hooks/usePartnerRatios";

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const {
    totals,
    partnersWithRatios,
    chartCapitalData,
    chartProfitData
  } = usePartnerRatios({ partners, strategy: globalStrategy });

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

  const handleDelete = useCallback(async (id: string) => {
    try {
      await partnerService.deletePartner(id);
      toast.success("تم الحذف بنجاح");
      setData(prev => prev.filter(p => p.id !== id));
    } catch (error) {
      toast.error("فشل الحذف: " + error);
    }
  }, [setData]);

  const columns = useMemo<Column<PartnerDto & { calculatedRatio: number }>[]>(() => [
    { 
      header: "الكود", 
      accessor: (p) => (
        <span className="font-mono text-[11px] bg-slate-100 text-slate-700 px-2 py-1 rounded-md font-bold ring-1 ring-slate-200/50">
          {p.code || "—"}
        </span>
      ),
      className: "w-[120px]"
    },
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
      accessor: (p) => (
        <span className="inline-flex items-center justify-center bg-green-50 text-green-700 px-3 py-1 rounded-full font-bold text-sm ring-1 ring-green-100">
          {p.calculatedRatio.toFixed(2)}%
        </span>
      ), 
      align: "left" 
    },
    {
      header: "إجراءات",
      accessor: (p) => (
        <TableActions 
          onEdit={() => { 
            setEditPartner(p); 
            setIsDialogOpen(true); 
            setSelectedId(p.id);
          }}
          onDelete={() => handleDelete(p.id)}
        />
      ),
      align: "left",
      className: "w-16"
    }
  ], [handleDelete]);

  return (
    <MasterDetailLayout
      isDetailOpen={isDialogOpen}
      detailContent={
        isDialogOpen ? (
          <PartnerForm 
            open={isDialogOpen}
            onClose={() => {
              setIsDialogOpen(false);
              setSelectedId(null);
              setEditPartner(null);
            }}
            partner={editPartner}
            onSave={handleSave}
            saving={saving}
          />
        ) : null
      }
      masterContent={
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
                <Button onClick={() => { setEditPartner(null); setIsDialogOpen(true); setSelectedId("new"); }}>
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

          <DataTable 
            data={partnersWithRatios} 
            columns={columns} 
            loading={loading} 
            selectedId={selectedId}
            onRowClick={(p) => {
              setEditPartner(p);
              setSelectedId(p.id);
              setIsDialogOpen(true);
            }}
          />
        </div>
      }
    />
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
