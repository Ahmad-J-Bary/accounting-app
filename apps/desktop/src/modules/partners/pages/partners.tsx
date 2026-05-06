import { useState, useCallback, useMemo } from "react";
import { Button } from "@shared/ui/button";
import { Card } from "@shared/ui/card";
import { Label } from "@shared/ui/label";
import { RadioGroup, RadioGroupItem } from "@shared/ui/radio-group";
import { Plus, Users, RefreshCw, Calculator, TrendingUp, DollarSign, PieChart as PieChartIcon, Settings2, Search } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from '@shared/lib/format';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

import { partnerService, type PartnerDto, type PartnerRequest } from '@modules/partners/api/partnerService';

// Refactored Components & Hooks
import { OperationalTableTemplate } from '@widgets/templates/OperationalTableTemplate';
import { DataTable, Column } from '@widgets/table-shell/DataTable';
import { TableActions } from '@widgets/table-shell/TableActions';
import { useDataTable } from '@shared/hooks';
import { PartnerForm } from '@modules/partners/components/PartnerForm';
import { usePartnerRatios } from '@modules/partners/hooks/usePartnerRatios';
import { cn } from "@shared/lib/utils";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

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
    if (!confirm("هل أنت متأكد من حذف هذا الشريك؟")) return;
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
        <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200 font-black">
          {p.code || "—"}
        </span>
      ),
      className: "w-[100px]"
    },
    { header: "اسم الشريك", accessor: "name", className: "font-black text-slate-800" },
    { 
      header: "رأس المال (محلي)", 
      accessor: (p) => formatCurrency(parseFloat(p.amount_local)), 
      align: "left", 
      className: "tabular-nums font-bold text-slate-700" 
    },
    { 
      header: "رأس المال ($)", 
      accessor: (p) => (
        <div className="flex flex-col items-start">
          <span className="tabular-nums text-blue-600 font-black">{formatCurrency(parseFloat(p.amount_usd), "")}</span>
          <span className="text-[9px] text-slate-400 font-mono">USD</span>
        </div>
      ), 
      align: "left", 
    },
    { 
      header: "نسبة الأرباح", 
      accessor: (p) => (
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500 rounded-full" 
              style={{ width: `${p.calculatedRatio}%` }} 
            />
          </div>
          <span className="text-xs font-black text-emerald-700 tabular-nums">
            {p.calculatedRatio.toFixed(2)}%
          </span>
        </div>
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
      className: "w-20"
    }
  ], [handleDelete]);

  return (
    <OperationalTableTemplate
      title="الشركاء ورأس المال"
      toolbar={
        <>
          <Button variant="outline" size="sm" onClick={() => refresh(true)} disabled={loading} className="bg-white">
            <RefreshCw className={`w-4 h-4 ml-2 ${loading ? "animate-spin" : ""}`} />تحديث
          </Button>
          <Button size="sm" onClick={() => { setEditPartner(null); setIsDialogOpen(true); setSelectedId("new"); }} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100">
            <Plus className="w-4 h-4 ml-2" /> إضافة شريك جديد
          </Button>
        </>
      }
      headerWidgets={
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatsCard label="إجمالي رأس المال" value={formatCurrency(totals.local)} icon={Calculator} color="text-slate-900" border="border-slate-200" />
            <StatsCard label="عدد الشركاء" value={partners.length} icon={Users} color="text-blue-600" border="border-blue-200" />
            <StatsCard label="رأس المال بالدولار" value={formatCurrency(totals.usd, "") + " $"} icon={DollarSign} color="text-emerald-600" border="border-emerald-200" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <ChartCard title="حصص رأس المال" icon={PieChartIcon} data={chartCapitalData} formatter={formatCurrency} />
             <ChartCard title="توزيع الأرباح" icon={TrendingUp} data={chartProfitData} formatter={(v: number) => `${v.toFixed(2)}%`} />
          </div>
        </div>
      }
      filterBar={
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
           <div className="flex items-center gap-4 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text"
                  placeholder="بحث عن شريك..."
                  className="w-full pr-10 h-10 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                />
              </div>
              <div className="h-6 w-px bg-slate-200 mx-2 hidden md:block" />
              <div className="flex items-center gap-3">
                <Settings2 className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-black text-slate-500">توزيع الأرباح:</span>
                <RadioGroup value={globalStrategy} onValueChange={setGlobalStrategy} className="flex gap-2">
                  <StrategyOption id="g1" value="BasedOnCapitalLocal" label="رأس المال (محلي)" />
                  <StrategyOption id="g2" value="BasedOnCapitalUSD" label="رأس المال (دولار)" />
                  <StrategyOption id="g3" value="Manual" label="يدوي" />
                </RadioGroup>
              </div>
           </div>
        </div>
      }
      tableContent={
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
      }
      sidePanel={
        isDialogOpen ? (
          <div className="p-6">
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
          </div>
        ) : null
      }
      isPanelOpen={isDialogOpen}
    />
  );
}

function StatsCard({ label, value, icon: Icon, color, border }: any) {
  return (
    <div className={cn("bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between transition-all hover:shadow-md", border && `border-b-4 ${border}`)}>
      <div className="space-y-1">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
        <div className={cn("text-2xl font-black tabular-nums", color)}>{value}</div>
      </div>
      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center bg-slate-50", color)}>
        <Icon className="w-6 h-6" />
      </div>
    </div>
  );
}

function StrategyOption({ id, value, label }: any) {
  return (
    <div className="flex items-center space-x-2 space-x-reverse bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 hover:border-blue-200 transition-colors cursor-pointer group">
      <RadioGroupItem value={value} id={id} className="text-blue-600" />
      <Label htmlFor={id} className="cursor-pointer text-[11px] font-bold text-slate-600 group-hover:text-blue-700 transition-colors">{label}</Label>
    </div>
  );
}

function ChartCard({ title, icon: Icon, data, formatter }: any) {
  return (
    <Card className="p-6 bg-white border-slate-200/70 shadow-sm rounded-2xl overflow-hidden group hover:shadow-md transition-all">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-blue-600">
            <Icon className="w-5 h-5" />
          </div>
          <h3 className="font-black text-slate-800">{title}</h3>
        </div>
      </div>
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie 
              data={data} 
              cx="50%" 
              cy="50%" 
              innerRadius={55} 
              outerRadius={80} 
              paddingAngle={8} 
              dataKey="value"
              stroke="none"
            >
              {data.map((_: any, index: number) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              formatter={formatter} 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', direction: 'rtl' }}
            />
            <Legend verticalAlign="bottom" height={36} iconType="circle" />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
