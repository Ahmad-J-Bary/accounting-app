import React from 'react';
import { useTableSettings } from '@shared/hooks';
import { TableDensity, TableBorderStyle } from '@shared/types/table-settings';
import { Label } from "@shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { Switch } from "@shared/ui/switch";
import { Slider } from "@shared/ui/slider";
import { 
  LayoutGrid, 
  Type, 
  Monitor
} from "lucide-react";

export const TableSettingsManager: React.FC = () => {
  const { settings, updateSetting } = useTableSettings();

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500" dir="rtl">
      {/* Visual Appearance */}
      <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-blue-50 rounded-xl">
            <LayoutGrid className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="text-lg font-black text-slate-800">مظهر الجداول</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-3">
            <Label className="text-slate-500 font-bold">كثافة الصفوف</Label>
            <Select 
              value={settings.density} 
              onValueChange={(v) => updateSetting('density', v as TableDensity)}
            >
              <SelectTrigger className="h-12 rounded-2xl border-slate-200">
                <SelectValue placeholder="اختر الكثافة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">مختصر (Compact)</SelectItem>
                <SelectItem value="comfortable">مريح (Comfortable)</SelectItem>
                <SelectItem value="spacious">واسع (Spacious)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-slate-400">تحدد هذه الخاصية مقدار التباعد والارتفاع للصفوف في جميع الجداول.</p>
          </div>

          <div className="space-y-3">
            <Label className="text-slate-500 font-bold">نمط الحدود</Label>
            <Select 
              value={settings.borderStyle} 
              onValueChange={(v) => updateSetting('borderStyle', v as TableBorderStyle)}
            >
              <SelectTrigger className="h-12 rounded-2xl border-slate-200">
                <SelectValue placeholder="اختر نمط الحدود" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">حدود كاملة (Grid)</SelectItem>
                <SelectItem value="horizontal">حدود أفقية فقط</SelectItem>
                <SelectItem value="none">بدون حدود</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-slate-400">كيفية ظهور الخطوط الفاصلة بين الخلايا والصفوف.</p>
          </div>
        </div>
      </div>

      {/* Typography */}
      <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-amber-50 rounded-xl">
            <Type className="w-5 h-5 text-amber-600" />
          </div>
          <h3 className="text-lg font-black text-slate-800">الخطوط والنصوص</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label className="text-slate-500 font-bold">حجم الخط ({settings.fontSize}px)</Label>
            </div>
            <Slider
              value={[settings.fontSize]}
              min={10}
              max={18}
              step={1}
              onValueChange={(v) => updateSetting('fontSize', v[0])}
              className="py-4"
            />
          </div>

          <div className="space-y-3">
            <Label className="text-slate-500 font-bold">نوع الخط</Label>
            <Select 
              value={settings.fontFamily} 
              onValueChange={(v) => updateSetting('fontFamily', v)}
            >
              <SelectTrigger className="h-12 rounded-2xl border-slate-200 font-mono">
                <SelectValue placeholder="اختر الخط" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Inter, system-ui, sans-serif">Inter (Default)</SelectItem>
                <SelectItem value="'Cairo', sans-serif">Cairo (عربي)</SelectItem>
                <SelectItem value="'Tajawal', sans-serif">Tajawal (عربي)</SelectItem>
                <SelectItem value="monospace">Monospace</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Behavior */}
      <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-emerald-50 rounded-xl">
            <Monitor className="w-5 h-5 text-emerald-600" />
          </div>
          <h3 className="text-lg font-black text-slate-800">سلوك التفاعل</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-50 bg-slate-50/30">
            <div className="space-y-0.5">
              <Label className="text-slate-700 font-bold">تظليل الصف النشط</Label>
              <p className="text-[10px] text-slate-400">تمييز الصف عند مرور الفأرة.</p>
            </div>
            <Switch 
              checked={settings.rowHoverEffect} 
              onCheckedChange={(v) => updateSetting('rowHoverEffect', v)} 
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-50 bg-slate-50/30">
            <div className="space-y-0.5">
              <Label className="text-slate-700 font-bold">صفوف Zebra</Label>
              <p className="text-[10px] text-slate-400">تبديل ألوان الصفوف لتسهيل القراءة.</p>
            </div>
            <Switch 
              checked={settings.zebraRows} 
              onCheckedChange={(v) => updateSetting('zebraRows', v)} 
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-50 bg-slate-50/30">
            <div className="space-y-0.5">
              <Label className="text-slate-700 font-bold">تثبيت الهيدر</Label>
              <p className="text-[10px] text-slate-400">بقاء العناوين ظاهرة عند التمرير.</p>
            </div>
            <Switch 
              checked={settings.stickyHeader} 
              onCheckedChange={(v) => updateSetting('stickyHeader', v)} 
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-50 bg-slate-50/30">
            <div className="space-y-0.5">
              <Label className="text-slate-700 font-bold">شريط الأدوات</Label>
              <p className="text-[10px] text-slate-400">إظهار خيارات البحث والتصفية.</p>
            </div>
            <Switch 
              checked={settings.showToolbar} 
              onCheckedChange={(v) => updateSetting('showToolbar', v)} 
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-50 bg-slate-50/30">
            <div className="space-y-0.5">
              <Label className="text-slate-700 font-bold">منطقة الملخص</Label>
              <p className="text-[10px] text-slate-400">إظهار الإجماليات في أسفل الجدول.</p>
            </div>
            <Switch 
              checked={settings.showSummary} 
              onCheckedChange={(v) => updateSetting('showSummary', v)} 
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-50 bg-slate-50/30">
            <div className="space-y-0.5">
              <Label className="text-slate-700 font-bold">الترقيم التلقائي</Label>
              <p className="text-[10px] text-slate-400">إظهار أزرار التنقل بين الصفحات.</p>
            </div>
            <Switch 
              checked={settings.showPagination} 
              onCheckedChange={(v) => updateSetting('showPagination', v)} 
            />
          </div>
        </div>
      </div>
    </div>
  );
};
