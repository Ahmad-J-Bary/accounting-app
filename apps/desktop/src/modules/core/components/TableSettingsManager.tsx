import React, { useMemo } from 'react';
import { useTableSettings } from '@shared/hooks';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { TableDensity, TableBorderStyle } from '@shared/types/table-settings';
import { Label } from "@shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { Switch } from "@shared/ui/switch";
import { Slider } from "@shared/ui/slider";
import { 
  LayoutGrid, 
  Type, 
  Monitor,
  Eye
} from "lucide-react";
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { SettingsManagerLayout, SettingsGroup } from '@widgets/templates/SettingsManagerLayout';

interface PreviewRow {
  id: string;
  code: string;
  name: string;
  debit: number;
  credit: number;
  date: string;
  status: string;
}

const PREVIEW_DATA: PreviewRow[] = [
  { id: "1", code: "11001", name: "صندوق النقد", debit: 15000, credit: 0, date: "2026-01-15", status: "نشط" },
  { id: "2", code: "12001", name: "بنك الشام", debit: 85000, credit: 0, date: "2026-01-20", status: "نشط" },
  { id: "3", code: "21001", name: "موردين محليين", debit: 0, credit: 32000, date: "2026-02-01", status: "نشط" },
  { id: "4", code: "31001", name: "رأس المال", debit: 0, credit: 100000, date: "2026-01-01", status: "نشط" },
  { id: "5", code: "41001", name: "مبيعات", debit: 0, credit: 45000, date: "2026-02-10", status: "مقفل" },
  { id: "6", code: "51001", name: "مصاريف إيجار", debit: 3000, credit: 0, date: "2026-02-05", status: "نشط" },
  { id: "7", code: "51002", name: "رواتب", debit: 12000, credit: 0, date: "2026-02-28", status: "مقفل" },
];

export const TableSettingsManager: React.FC = () => {
  const { settings, updateSetting, resetSettings } = useTableSettings();
  const { baseCurrency } = useCurrencyContext();
  const currSym = baseCurrency?.symbol || baseCurrency?.code || "";

  const previewColumns = useMemo<UnifiedColumn<PreviewRow>[]>(() => [
    {
      id: "code",
      header: "الكود",
      label: "الكود",
      accessor: "code",
      className: "tabular-nums font-mono text-xs w-20 text-center",
      width: "w-[80px]"
    },
    {
      id: "name",
      header: "اسم الحساب",
      label: "اسم الحساب",
      accessor: "name",
      className: "font-bold text-slate-900 min-w-[130px]",
      width: "w-[150px]"
    },
    {
      id: "debit",
      header: `مدين (${currSym})`,
      label: `مدين (${currSym})`,
      accessor: (r) => r.debit > 0 ? r.debit.toLocaleString() : "—",
      className: "tabular-nums text-red-600 font-bold",
    },
    {
      id: "credit",
      header: `دائن (${currSym})`,
      label: `دائن (${currSym})`,
      accessor: (r) => r.credit > 0 ? r.credit.toLocaleString() : "—",
      className: "tabular-nums text-emerald-600 font-bold",
    },
    {
      id: "date",
      header: "التاريخ",
      label: "التاريخ",
      accessor: "date",
      className: "tabular-nums text-slate-500 w-28"
    },
    {
      id: "status",
      header: "الحالة",
      label: "الحالة",
      accessor: (r) => (
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
          r.status === "نشط" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
        }`}>
          {r.status}
        </span>
      ),
      className: "w-16"
    },
  ], [currSym]);

  const previewColumnIds = useMemo(() => previewColumns.map(c => c.id), [previewColumns]);

  const summaryColumns = useMemo(() => {
    const colIds = previewColumnIds;
    return colIds.map(id => {
      if (id === "debit") return { id: "debit_total", columnId: "debit", label: "الإجمالي", value: `${PREVIEW_DATA.reduce((s, r) => s + r.debit, 0).toLocaleString()} ${currSym}`, className: "text-red-600" };
      if (id === "credit") return { id: "credit_total", columnId: "credit", label: "الإجمالي", value: `${PREVIEW_DATA.reduce((s, r) => s + r.credit, 0).toLocaleString()} ${currSym}`, className: "text-emerald-600" };
      if (id === "code") return { id: "code_count", columnId: "code", label: "", value: `${PREVIEW_DATA.length} حسابات`, className: "text-slate-500 font-medium" };
      return { id: `${id}_spacer`, columnId: id, label: "", value: "" };
    });
  }, [currSym, previewColumnIds]);

  return (
    <SettingsManagerLayout resetAction={resetSettings}>
      {/* Visual Appearance */}
      <SettingsGroup title="مظهر الجداول" icon={LayoutGrid}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-slate-600 font-semibold">كثافة الصفوف</Label>
            <Select 
              value={settings.density} 
              onValueChange={(v) => updateSetting('density', v as TableDensity)}
            >
              <SelectTrigger className="h-10 rounded-lg border-slate-200">
                <SelectValue placeholder="اختر الكثافة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">مختصر</SelectItem>
                <SelectItem value="comfortable">مريح</SelectItem>
                <SelectItem value="spacious">واسع</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-600 font-semibold">نمط الحدود</Label>
            <Select 
              value={settings.borderStyle} 
              onValueChange={(v) => updateSetting('borderStyle', v as TableBorderStyle)}
            >
              <SelectTrigger className="h-10 rounded-lg border-slate-200">
                <SelectValue placeholder="اختر نمط الحدود" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">حدود كاملة</SelectItem>
                <SelectItem value="horizontal">حدود أفقية فقط</SelectItem>
                <SelectItem value="none">بدون حدود</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </SettingsGroup>

      {/* Typography */}
      <SettingsGroup title="الخطوط والنصوص" icon={Type} color="text-amber-600">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label className="text-slate-600 font-semibold">حجم الخط ({settings.fontSize}px)</Label>
            </div>
            <Slider
              value={[settings.fontSize]}
              min={10}
              max={18}
              step={1}
              onValueChange={(v) => updateSetting('fontSize', v[0])}
              className="py-2"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-slate-600 font-semibold">نوع الخط</Label>
            <Select 
              value={settings.fontFamily} 
              onValueChange={(v) => updateSetting('fontFamily', v)}
            >
              <SelectTrigger className="h-10 rounded-lg border-slate-200 font-mono">
                <SelectValue placeholder="اختر الخط" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Inter, system-ui, sans-serif">Inter</SelectItem>
                <SelectItem value="'Cairo', sans-serif">Cairo</SelectItem>
                <SelectItem value="'Tajawal', sans-serif">Tajawal</SelectItem>
                <SelectItem value="monospace">Monospace</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </SettingsGroup>

      {/* Behavior */}
      <SettingsGroup title="سلوك التفاعل" icon={Monitor} color="text-emerald-600">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/30">
            <div className="space-y-0.5">
              <Label className="text-slate-700 font-semibold">تظليل الصف النشط</Label>
            </div>
            <Switch 
              checked={settings.rowHoverEffect} 
              onCheckedChange={(v) => updateSetting('rowHoverEffect', v)} 
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/30">
            <div className="space-y-0.5">
              <Label className="text-slate-700 font-semibold">صفوف Zebra</Label>
            </div>
            <Switch 
              checked={settings.zebraRows} 
              onCheckedChange={(v) => updateSetting('zebraRows', v)} 
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/30">
            <div className="space-y-0.5">
              <Label className="text-slate-700 font-semibold">تثبيت الهيدر</Label>
            </div>
            <Switch 
              checked={settings.stickyHeader} 
              onCheckedChange={(v) => updateSetting('stickyHeader', v)} 
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/30">
            <div className="space-y-0.5">
              <Label className="text-slate-700 font-semibold">شريط الأدوات</Label>
            </div>
            <Switch 
              checked={settings.showToolbar} 
              onCheckedChange={(v) => updateSetting('showToolbar', v)} 
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/30">
            <div className="space-y-0.5">
              <Label className="text-slate-700 font-semibold">منطقة الملخص</Label>
            </div>
            <Switch 
              checked={settings.showSummary} 
              onCheckedChange={(v) => updateSetting('showSummary', v)} 
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/30">
            <div className="space-y-0.5">
              <Label className="text-slate-700 font-semibold">الترقيم التلقائي</Label>
            </div>
            <Switch 
              checked={settings.showPagination} 
              onCheckedChange={(v) => updateSetting('showPagination', v)} 
            />
          </div>
        </div>
      </SettingsGroup>

      {/* Live Preview */}
      <SettingsGroup title="معاينة مباشرة" icon={Eye} color="text-violet-600">
        <div className="border border-slate-200 rounded-xl overflow-hidden" style={{ maxHeight: '300px' }}>
          <UnifiedTable
            data={PREVIEW_DATA}
            columns={previewColumns}
            summary={summaryColumns}
            idKey="id"
            tableId="table-settings-preview"
            emptyMessage="لا توجد بيانات للمعاينة"
            enableResize
          />
        </div>
      </SettingsGroup>
    </SettingsManagerLayout>
  );
};
