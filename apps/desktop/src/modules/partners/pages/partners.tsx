import { useState, useCallback, useMemo, useEffect } from "react";
import { Button } from "@shared/ui/button";
import { Card } from "@shared/ui/card";
import { Label } from "@shared/ui/label";
import { RadioGroup, RadioGroupItem } from "@shared/ui/radio-group";
import { Plus, Users, RefreshCw, Calculator, TrendingUp, DollarSign, PieChart as PieChartIcon, Settings2, Search } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from '@shared/lib/format';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Input } from "@shared/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@shared/ui/dropdown-menu";

import { partnerService, type PartnerDto, type PartnerRequest } from '@modules/partners/api/partnerService';

import { OperationalTableTemplate } from '@widgets/templates/OperationalTableTemplate';
import { DataTable, Column } from '@widgets/table-shell/DataTable';
import { TableActions } from '@widgets/table-shell/TableActions';
import { useDataTable, useColumnPreferences } from '@shared/hooks';
import { PartnerForm } from '@modules/partners/components/PartnerForm';
import { usePartnerRatios } from '@modules/partners/hooks/usePartnerRatios';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { cn } from "@shared/lib/utils";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export default function Partners() {
  const { rateMap } = useCurrencyContext();
  const [globalStrategy, setGlobalStrategy] = useState("BasedOnCapitalLocal");
  const [rateMapKey, setRateMapKey] = useState(0);

  const rateMapValues = useMemo(() => {
    if (!rateMap) return [];
    return Array.from(rateMap.values());
  }, [rateMap]);
  
  useEffect(() => {
    setRateMapKey(k => k + 1);
  }, [rateMapValues]);

  const {
    filtered: partners,
    loading,
    refresh,
    setData,
    search,
    setSearch,
  } = useDataTable<PartnerDto>({
    fetchData: () => partnerService.listPartners(),
    searchFields: ["name"],
    errorLabel: "فشل جلب الشركاء",
    dependencies: [rateMapKey],
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
  } = usePartnerRatios({ partners, strategy: globalStrategy, exchangeRate: rateMap?.get("USD") || 100 });

  const stats = useMemo(() => [
    { label: "إجمالي رأس المال (ل.س)", value: formatCurrency(totals.local), icon: Calculator, color: "text-slate-900" },
    { label: "عدد الشركاء", value: partners.length, icon: Users, color: "text-blue-600" },
    { label: "رأس المال ($)", value: formatCurrency(totals.usd, "") + " $", icon: DollarSign, color: "text-emerald-600" },
  ], [totals, partners.length]);

  const availableColumns = [
    { id: "code", label: "الكود" },
    { id: "name", label: "اسم الشريك" },
    { id: "amount_usd", label: "المبلغ المشارك به ($)" },
    { id: "amount_local", label: "المبلغ المشارك به (ل.س)" },
    { id: "capital_ratio", label: "نسبة المشاركة برأس المال" },
    { id: "ratio", label: "نسبة المشاركة بالأرباح" },
    { id: "actions", label: "إجراءات" },
  ];
  const defaultVisibleColumns = ["code", "name", "amount_usd", "amount_local", "capital_ratio", "ratio", "actions"];
  const { visibleColumns, isVisible, toggleColumn } = useColumnPreferences("partners", defaultVisibleColumns);

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

  const columns = useMemo<Column<PartnerDto & { calculatedRatio: number; calculatedCapitalRatio: number; displayAmountLocal: number; displayAmountUsd: number }>[]>(() => {
    const allColumns: Column<PartnerDto & { calculatedRatio: number; calculatedCapitalRatio: number; displayAmountLocal: number; displayAmountUsd: number }>[] = [
      { 
      id: "code",
      header: "الكود", 
      accessor: (p) => (
        <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200 font-black">
          {p.code || "—"}
        </span>
      ),
      className: "w-[100px]"
    },
    { id: "name", header: "اسم الشريك", accessor: (p) => p.name, className: "font-black text-slate-800" },
    { 
      id: "amount_usd",
      header: "المبلغ المشارك به ($)", 
      accessor: (p) => formatCurrency(p.displayAmountUsd || 0, "$"), 
      align: "left", 
      className: "tabular-nums font-black text-blue-600" 
    },
    { 
      id: "amount_local",
      header: "المبلغ المشارك به (ل.س)", 
      accessor: (p) => formatCurrency(p.displayAmountLocal || 0), 
      align: "left", 
      className: "tabular-nums font-black text-slate-900" 
    },
    { 
      id: "capital_ratio",
      header: "نسبة المشاركة برأس المال", 
      accessor: (p) => (
        <div className="flex justify-center">
          <span className="text-xs font-bold text-blue-700 tabular-nums">
            {p.calculatedCapitalRatio.toFixed(2)}%
          </span>
        </div>
      ), 
      align: "center",
      headerClassName: "text-center"
    },
    { 
      id: "ratio",
      header: "نسبة المشاركة بالأرباح", 
      accessor: (p) => (
        <div className="flex justify-center">
          <span className="text-xs font-bold text-emerald-700 tabular-nums">
            {p.calculatedRatio.toFixed(2)}%
          </span>
        </div>
      ), 
      align: "center",
      headerClassName: "text-center"
    },
    {
      id: "actions",
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
    ];
    return allColumns.filter(col => col.id ? isVisible(col.id) : true);
  }, [handleDelete, isVisible]);

  return (
    <OperationalTableTemplate
      title="الشركاء ورأس المال"
      stats={stats}
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

      filterBar={
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="بحث عن شريك..." 
              className="pr-10 h-10 border-slate-200 focus:ring-2 focus:ring-blue-500 transition-all text-sm" 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-10 w-10 bg-white border-slate-200">
                <Settings2 className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px]">
              <DropdownMenuLabel className="text-right">الأعمدة الظاهرة</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {availableColumns.map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={isVisible(col.id)}
                  onCheckedChange={() => toggleColumn(col.id)}
                  className="text-right flex-row-reverse gap-2"
                >
                  {col.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          
          <div className="flex items-center gap-2 mr-auto pl-2" dir="rtl">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider hidden md:block">التوزيع:</span>
            <RadioGroup value={globalStrategy} onValueChange={setGlobalStrategy} className="flex flex-row items-center gap-1">
              <StrategyOption id="g1" value="BasedOnCapitalLocal" label="محلي" />
              <StrategyOption id="g2" value="BasedOnCapitalUSD" label="دولار" />
              <StrategyOption id="g3" value="Manual" label="يدوي" />
            </RadioGroup>
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
      bottomWidgets={
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-center px-4 py-3 text-xs font-black text-slate-600 uppercase tracking-wider">رأس المال الأجمالي ($)</th>
                  <th className="text-center px-4 py-3 text-xs font-black text-slate-600 uppercase tracking-wider">رأس المال الأجمالي (ل.س)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100">
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm font-black text-blue-600 tabular-nums">
                      {formatCurrency(totals.usd, "$")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm font-black text-slate-900 tabular-nums">
                      {formatCurrency(totals.local)}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <ChartCard title="حصص رأس المال" icon={PieChartIcon} data={chartCapitalData} formatter={formatCurrency} />
             <ChartCard title="توزيع الأرباح" icon={TrendingUp} data={chartProfitData} formatter={(v: number) => `${v.toFixed(2)}%`} />
          </div>
        </div>
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

interface StrategyOptionProps {
  id: string;
  value: string;
  label: string;
}

function StrategyOption({ id, value, label }: StrategyOptionProps) {
  return (
    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer group shadow-sm">
      <RadioGroupItem value={value} id={id} className="text-blue-600" />
      <Label htmlFor={id} className="cursor-pointer text-xs font-bold text-slate-700 group-hover:text-blue-700 transition-colors">{label}</Label>
    </div>
  );
}

interface ChartCardProps {
  title: string;
  icon: React.ElementType;
  data: { name: string; value: number }[];
  formatter: (v: number) => string;
}

function ChartCard({ title, icon: Icon, data, formatter }: ChartCardProps) {
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
              {data.map((_: unknown, index: number) => (
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
