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
import { useLocalization } from "@app/providers/LocalizationProvider";

interface PreviewRow {
  id: string;
  code: string;
  name: string;
  debit: number;
  credit: number;
  date: string;
  status: string;
}

export const TableSettingsManager: React.FC = () => {
  const { t } = useLocalization();
  const { settings, updateSetting, resetSettings } = useTableSettings();
  const { baseCurrency, formatAmount } = useCurrencyContext();
  const currSym = baseCurrency?.symbol || baseCurrency?.code || "";

  const activeLabel = t("settings.tables.previewData.active", { namespace: "settings", fallback: "نشط" });
  const PREVIEW_DATA = useMemo<PreviewRow[]>(() => [
    { id: "1", code: "11001", name: t("settings.tables.previewData.cash", { namespace: "settings", fallback: "صندوق النقد" }), debit: 15000, credit: 0, date: "2026-01-15", status: activeLabel },
    { id: "2", code: "21001", name: t("settings.tables.previewData.suppliers", { namespace: "settings", fallback: "موردين محليين" }), debit: 0, credit: 32000, date: "2026-02-01", status: activeLabel },
    { id: "3", code: "31001", name: t("settings.tables.previewData.capital", { namespace: "settings", fallback: "رأس المال" }), debit: 0, credit: 100000, date: "2026-01-01", status: activeLabel },
    { id: "4", code: "41001", name: t("settings.tables.previewData.sales", { namespace: "settings", fallback: "مبيعات" }), debit: 0, credit: 45000, date: "2026-02-10", status: t("settings.tables.previewData.closed", { namespace: "settings", fallback: "مقفل" }) },
    { id: "5", code: "51001", name: t("settings.tables.previewData.rentExpense", { namespace: "settings", fallback: "مصاريف إيجار" }), debit: 3000, credit: 0, date: "2026-02-05", status: activeLabel },
    { id: "6", code: "51002", name: t("settings.tables.previewData.salaries", { namespace: "settings", fallback: "رواتب" }), debit: 12000, credit: 0, date: "2026-02-28", status: t("settings.tables.previewData.closed", { namespace: "settings", fallback: "مقفل" }) },
  ], [t, activeLabel]);

  const previewColumns = useMemo<UnifiedColumn<PreviewRow>[]>(() => [
    {
      id: "code",
      header: t("settings.tables.columns.code", { namespace: "settings", fallback: "الكود" }),
      label: t("settings.tables.columns.code", { namespace: "settings", fallback: "الكود" }),
      accessor: "code",
      className: "font-black text-slate-900 text-center"
    },
    {
      id: "name",
      header: t("settings.tables.columns.name", { namespace: "settings", fallback: "اسم الحساب" }),
      label: t("settings.tables.columns.name", { namespace: "settings", fallback: "اسم الحساب" }),
      accessor: "name",
      className: "font-bold text-slate-800"
    },
    {
      id: "debit",
      header: t("settings.tables.columns.debit", { namespace: "settings", fallback: "مدين ({{sym}})", vars: { sym: currSym } }),
      label: t("settings.tables.columns.debit", { namespace: "settings", fallback: "مدين ({{sym}})", vars: { sym: currSym } }),
      accessor: (r) => r.debit > 0 ? formatAmount(r.debit, { currencyCode: baseCurrency?.code || "" }) : "—",
      className: "tabular-nums font-black text-blue-700",
    },
    {
      id: "credit",
      header: t("settings.tables.columns.credit", { namespace: "settings", fallback: "دائن ({{sym}})", vars: { sym: currSym } }),
      label: t("settings.tables.columns.credit", { namespace: "settings", fallback: "دائن ({{sym}})", vars: { sym: currSym } }),
      accessor: (r) => r.credit > 0 ? formatAmount(r.credit, { currencyCode: baseCurrency?.code || "" }) : "—",
      className: "tabular-nums font-black text-emerald-700",
    },
    {
      id: "date",
      header: t("settings.tables.columns.date", { namespace: "settings", fallback: "التاريخ" }),
      label: t("settings.tables.columns.date", { namespace: "settings", fallback: "التاريخ" }),
      accessor: "date",
      className: "tabular-nums text-slate-500"
    },
    {
      id: "status",
      header: t("settings.tables.columns.status", { namespace: "settings", fallback: "الحالة" }),
      label: t("settings.tables.columns.status", { namespace: "settings", fallback: "الحالة" }),
      accessor: (r) => (
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
          r.status === activeLabel ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
        }`}>
          {r.status}
        </span>
      ),
    },
  ], [currSym, formatAmount, baseCurrency, t, activeLabel]);

  const previewColumnIds = useMemo(() => previewColumns.map(c => c.id), [previewColumns]);

  const summaryColumns = useMemo(() => {
    const colIds = previewColumnIds;
    const totalDebit = PREVIEW_DATA.reduce((s, r) => s + r.debit, 0);
    const totalCredit = PREVIEW_DATA.reduce((s, r) => s + r.credit, 0);
    const totalLabel = t("settings.tables.summaryTotal", { namespace: "settings", fallback: "الإجمالي" });
    return colIds.map(id => {
      if (id === "debit") return { id: "debit_total", columnId: "debit", label: totalLabel, value: totalDebit > 0 ? formatAmount(totalDebit, { currencyCode: baseCurrency?.code || "" }) : "—", className: "text-blue-700 font-black" };
      if (id === "credit") return { id: "credit_total", columnId: "credit", label: totalLabel, value: totalCredit > 0 ? formatAmount(totalCredit, { currencyCode: baseCurrency?.code || "" }) : "—", className: "text-emerald-700 font-black" };
      if (id === "code") return { id: "code_count", columnId: "code", label: "", value: t("settings.tables.summaryAccounts", { namespace: "settings", fallback: "{{count}} حسابات", vars: { count: PREVIEW_DATA.length } }), className: "text-slate-500 font-medium" };
      return { id: `${id}_spacer`, columnId: id, label: "", value: "" };
    });
  }, [previewColumnIds, formatAmount, baseCurrency, t, PREVIEW_DATA]);

  return (
    <SettingsManagerLayout resetAction={resetSettings}>
      {/* Visual Appearance */}
      <SettingsGroup title={t("settings.tables.groupTitle", { namespace: "settings", fallback: "مظهر الجداول" })} icon={LayoutGrid}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-slate-600 font-semibold">{t("settings.tables.rowDensity", { namespace: "settings", fallback: "كثافة الصفوف" })}</Label>
            <Select 
              value={settings.density} 
              onValueChange={(v) => updateSetting('density', v as TableDensity)}
            >
              <SelectTrigger className="h-10 rounded-lg border-slate-200">
                <SelectValue placeholder={t("settings.tables.densityPlaceholder", { namespace: "settings", fallback: "اختر الكثافة" })} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">{t("settings.tables.densities.compact", { namespace: "settings", fallback: "مختصر" })}</SelectItem>
                <SelectItem value="comfortable">{t("settings.tables.densities.comfortable", { namespace: "settings", fallback: "مريح" })}</SelectItem>
                <SelectItem value="spacious">{t("settings.tables.densities.spacious", { namespace: "settings", fallback: "واسع" })}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-600 font-semibold">{t("settings.tables.borderStyle", { namespace: "settings", fallback: "نمط الحدود" })}</Label>
            <Select 
              value={settings.borderStyle} 
              onValueChange={(v) => updateSetting('borderStyle', v as TableBorderStyle)}
            >
              <SelectTrigger className="h-10 rounded-lg border-slate-200">
                <SelectValue placeholder={t("settings.tables.borderPlaceholder", { namespace: "settings", fallback: "اختر نمط الحدود" })} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">{t("settings.tables.borders.full", { namespace: "settings", fallback: "حدود كاملة" })}</SelectItem>
                <SelectItem value="horizontal">{t("settings.tables.borders.horizontal", { namespace: "settings", fallback: "حدود أفقية فقط" })}</SelectItem>
                <SelectItem value="none">{t("settings.tables.borders.none", { namespace: "settings", fallback: "بدون حدود" })}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </SettingsGroup>

      {/* Typography */}
      <SettingsGroup title={t("settings.tables.typographyTitle", { namespace: "settings", fallback: "الخطوط والنصوص" })} icon={Type} color="text-amber-600">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label className="text-slate-600 font-semibold">{t("settings.tables.fontSize", { namespace: "settings", fallback: "حجم الخط ({{size}}px)", vars: { size: settings.fontSize } })}</Label>
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
            <Label className="text-slate-600 font-semibold">{t("settings.tables.fontFamily", { namespace: "settings", fallback: "نوع الخط" })}</Label>
            <Select 
              value={settings.fontFamily} 
              onValueChange={(v) => updateSetting('fontFamily', v)}
            >
              <SelectTrigger className="h-10 rounded-lg border-slate-200 font-mono">
                <SelectValue placeholder={t("settings.tables.fontPlaceholder", { namespace: "settings", fallback: "اختر الخط" })} />
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
      <SettingsGroup title={t("settings.tables.behaviorTitle", { namespace: "settings", fallback: "سلوك التفاعل" })} icon={Monitor} color="text-emerald-600">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/30">
            <div className="space-y-0.5">
              <Label className="text-slate-700 font-semibold">{t("settings.tables.rowHover", { namespace: "settings", fallback: "تظليل الصف النشط" })}</Label>
            </div>
            <Switch 
              checked={settings.rowHoverEffect} 
              onCheckedChange={(v) => updateSetting('rowHoverEffect', v)} 
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/30">
            <div className="space-y-0.5">
              <Label className="text-slate-700 font-semibold">{t("settings.tables.zebra", { namespace: "settings", fallback: "صفوف Zebra" })}</Label>
            </div>
            <Switch 
              checked={settings.zebraRows} 
              onCheckedChange={(v) => updateSetting('zebraRows', v)} 
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/30">
            <div className="space-y-0.5">
              <Label className="text-slate-700 font-semibold">{t("settings.tables.stickyHeader", { namespace: "settings", fallback: "تثبيت الهيدر" })}</Label>
            </div>
            <Switch 
              checked={settings.stickyHeader} 
              onCheckedChange={(v) => updateSetting('stickyHeader', v)} 
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/30">
            <div className="space-y-0.5">
              <Label className="text-slate-700 font-semibold">{t("settings.tables.toolbar", { namespace: "settings", fallback: "شريط الأدوات" })}</Label>
            </div>
            <Switch 
              checked={settings.showToolbar} 
              onCheckedChange={(v) => updateSetting('showToolbar', v)} 
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/30">
            <div className="space-y-0.5">
              <Label className="text-slate-700 font-semibold">{t("settings.tables.summary", { namespace: "settings", fallback: "منطقة الملخص" })}</Label>
            </div>
            <Switch 
              checked={settings.showSummary} 
              onCheckedChange={(v) => updateSetting('showSummary', v)} 
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/30">
            <div className="space-y-0.5">
              <Label className="text-slate-700 font-semibold">{t("settings.tables.pagination", { namespace: "settings", fallback: "الترقيم التلقائي" })}</Label>
            </div>
            <Switch 
              checked={settings.showPagination} 
              onCheckedChange={(v) => updateSetting('showPagination', v)} 
            />
          </div>
        </div>
      </SettingsGroup>

      {/* Live Preview */}
      <SettingsGroup title={t("settings.tables.previewTitle", { namespace: "settings", fallback: "معاينة مباشرة" })} icon={Eye} color="text-violet-600">
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <UnifiedTable
            data={PREVIEW_DATA}
            columns={previewColumns}
            summary={summaryColumns}
            idKey="id"
            tableId="table-settings-preview"
            emptyMessage={t("settings.tables.empty", { namespace: "settings", fallback: "لا توجد بيانات للمعاينة" })}
            enableResize
          />
        </div>
      </SettingsGroup>
    </SettingsManagerLayout>
  );
};
