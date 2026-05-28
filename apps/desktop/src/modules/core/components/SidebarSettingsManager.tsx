import React, { useState } from 'react';
import { useSidebarSettings } from '@shared/hooks/useSidebarSettings';
import type { SidebarWidthPreset } from '@shared/types/sidebar-settings';
import { Label } from "@shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { Switch } from "@shared/ui/switch";
import { Slider } from "@shared/ui/slider";
import { Button } from "@shared/ui/button";
import { LayoutGrid, Type, Monitor, Eye, PanelRightOpen, PanelRightClose } from "lucide-react";
import { SidebarShell, SidebarHeader, SidebarBody, SidebarFooter, SidebarSection, SidebarFieldGroup } from '@widgets/sidebar-shell';
import { SettingsManagerLayout, SettingsGroup } from '@widgets/templates/SettingsManagerLayout';

export const SidebarSettingsManager: React.FC = () => {
  const { settings, updateSetting, resetSettings } = useSidebarSettings();
  const [previewOverlay, setPreviewOverlay] = useState(false);

  type PresetUnion = 'compact' | 'comfortable' | 'spacious';
  type BorderUnion = 'none' | 'left' | 'right' | 'all';
  type ShadowUnion = 'none' | 'sm' | 'md' | 'lg' | 'xl';
  type OverlayUnion = 'overlay' | 'inline';
  type PlacementUnion = 'left' | 'right' | 'justify';

  return (
    <SettingsManagerLayout resetAction={resetSettings}>
      <SettingsGroup title="مظهر النافذة الجانبية" icon={LayoutGrid}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-slate-600 font-semibold">عرض النافذة الافتراضي</Label>
            <Select
              value={settings.widthPreset}
              onValueChange={(v) => updateSetting('widthPreset', v as SidebarWidthPreset)}
            >
              <SelectTrigger className="h-10 rounded-lg border-slate-200">
                <SelectValue placeholder="اختر العرض" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="narrow">ضيق</SelectItem>
                <SelectItem value="standard">قياسي</SelectItem>
                <SelectItem value="wide">عريض</SelectItem>
                <SelectItem value="extra-wide">عريض جداً</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label className="text-slate-600 font-semibold">العرض المخصص ({settings.customWidth}px)</Label>
            </div>
            <Slider
              value={[settings.customWidth]}
              min={300}
              max={900}
              step={10}
              onValueChange={(v) => updateSetting('customWidth', v[0])}
              className="py-2"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-slate-600 font-semibold">التباعد الداخلي</Label>
            <Select
              value={settings.paddingPreset}
              onValueChange={(v) => updateSetting('paddingPreset', v as PresetUnion)}
            >
              <SelectTrigger className="h-10 rounded-lg border-slate-200">
                <SelectValue placeholder="اختر التباعد" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">مكتنز</SelectItem>
                <SelectItem value="comfortable">مريح</SelectItem>
                <SelectItem value="spacious">متسع</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-600 font-semibold">التباعد بين العناصر</Label>
            <Select
              value={settings.spacingPreset}
              onValueChange={(v) => updateSetting('spacingPreset', v as PresetUnion)}
            >
              <SelectTrigger className="h-10 rounded-lg border-slate-200">
                <SelectValue placeholder="اختر التباعد" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">مكتنز</SelectItem>
                <SelectItem value="comfortable">مريح</SelectItem>
                <SelectItem value="spacious">متسع</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-600 font-semibold">لون الخلفية</Label>
            <Select
              value={settings.background}
              onValueChange={(v) => updateSetting('background', v)}
            >
              <SelectTrigger className="h-10 rounded-lg border-slate-200">
                <SelectValue placeholder="اختر اللون" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bg-white">أبيض</SelectItem>
                <SelectItem value="bg-slate-50">رمادي فاتح</SelectItem>
                <SelectItem value="bg-zinc-50">رمادي دافئ</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-600 font-semibold">درجة الظل</Label>
            <Select
              value={settings.shadow}
              onValueChange={(v) => updateSetting('shadow', v as ShadowUnion)}
            >
              <SelectTrigger className="h-10 rounded-lg border-slate-200">
                <SelectValue placeholder="اختر مستوى الظل" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">بدون ظل</SelectItem>
                <SelectItem value="sm">خفيف</SelectItem>
                <SelectItem value="md">متوسط</SelectItem>
                <SelectItem value="lg">قوي</SelectItem>
                <SelectItem value="xl">قوي جداً</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </SettingsGroup>

      <SettingsGroup title="الخطوط والنصوص" icon={Type} color="text-amber-600">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label className="text-slate-600 font-semibold">حجم الخط ({settings.fontSize}px)</Label>
            </div>
            <Slider
              value={[settings.fontSize]}
              min={12}
              max={16}
              step={1}
              onValueChange={(v) => updateSetting('fontSize', v[0])}
              className="py-2"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-slate-600 font-semibold">نمط الحدود</Label>
            <Select
              value={settings.borderStyle}
              onValueChange={(v) => updateSetting('borderStyle', v as BorderUnion)}
            >
              <SelectTrigger className="h-10 rounded-lg border-slate-200">
                <SelectValue placeholder="اختر الحدود" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">بدون حدود</SelectItem>
                <SelectItem value="left">حد أيسر فقط</SelectItem>
                <SelectItem value="right">حد أيمن فقط</SelectItem>
                <SelectItem value="all">حدود كاملة</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </SettingsGroup>

      <SettingsGroup title="سلوك التفاعل والتحريك" icon={Monitor} color="text-emerald-600">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/30">
            <div className="space-y-0.5">
              <Label className="text-slate-700 font-semibold">وضع العرض</Label>
            </div>
            <Select
              value={settings.overlayVsInline}
              onValueChange={(v) => updateSetting('overlayVsInline', v as OverlayUnion)}
            >
              <SelectTrigger className="w-24 h-9 border-slate-200 font-bold text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inline">مضمن</SelectItem>
                <SelectItem value="overlay">عائم</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/30">
            <div className="space-y-0.5">
              <Label className="text-slate-700 font-semibold">ترويسة وتذييل ثابتين</Label>
            </div>
            <Switch
              checked={settings.stickyHeaderFooter}
              onCheckedChange={(v) => updateSetting('stickyHeaderFooter', v)}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/30">
            <div className="space-y-0.5">
              <Label className="text-slate-700 font-semibold">موقع زر الحفظ</Label>
            </div>
            <Select
              value={settings.saveButtonPlacement}
              onValueChange={(v) => updateSetting('saveButtonPlacement', v as PlacementUnion)}
            >
              <SelectTrigger className="w-24 h-9 border-slate-200 font-bold text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="right">يمين</SelectItem>
                <SelectItem value="left">يسار</SelectItem>
                <SelectItem value="justify">موزع</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/30">
            <div className="space-y-0.5">
              <Label className="text-slate-700 font-semibold">إظهار زر الإغلاق</Label>
            </div>
            <Switch
              checked={settings.closeButtonVisibility}
              onCheckedChange={(v) => updateSetting('closeButtonVisibility', v)}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/30">
            <div className="space-y-0.5">
              <Label className="text-slate-700 font-semibold">سرعة التحريك</Label>
            </div>
            <Select
              value={settings.animationSpeed.toString()}
              onValueChange={(v) => updateSetting('animationSpeed', parseInt(v))}
            >
              <SelectTrigger className="w-24 h-9 border-slate-200 font-bold text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="150">سريع</SelectItem>
                <SelectItem value="300">متوسط</SelectItem>
                <SelectItem value="500">سلس</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </SettingsGroup>

      <SettingsGroup title="معاينة مباشرة للنافذة" icon={Eye} color="text-violet-600">
        <div className="flex items-center gap-2 mb-4">
          <Button
            variant={previewOverlay ? "default" : "outline"}
            size="sm"
            onClick={() => setPreviewOverlay(true)}
            className="rounded-lg h-9 text-xs font-bold gap-1.5"
          >
            <PanelRightOpen className="w-3.5 h-3.5" />
            عائم
          </Button>
          <Button
            variant={!previewOverlay ? "default" : "outline"}
            size="sm"
            onClick={() => setPreviewOverlay(false)}
            className="rounded-lg h-9 text-xs font-bold gap-1.5"
          >
            <PanelRightClose className="w-3.5 h-3.5" />
            مضمن
          </Button>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/40 p-4 flex justify-center items-stretch h-[350px]">
          <div className="flex-1 flex items-center justify-center text-slate-400 text-xs font-bold border border-dashed border-slate-200 rounded-lg ml-3 bg-white">
            المحتوى الرئيسي
          </div>
          {!previewOverlay ? (
            <SidebarShell isOpen={true} onClose={() => {}} forceOverlay={false} className="h-full border border-slate-200 rounded-lg overflow-hidden">
              <SidebarHeader title="إضافة عميل جديد" subtitle="تعريف بطاقة عميل" onClose={() => {}} />
              <SidebarBody>
                <SidebarSection title="البيانات الأساسية">
                  <SidebarFieldGroup>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold">اسم العميل *</span>
                      <div className="h-9 border border-slate-200 rounded bg-white px-3 flex items-center text-xs text-slate-400">شركة المواكب التجارية</div>
                    </div>
                  </SidebarFieldGroup>
                </SidebarSection>
              </SidebarBody>
              <SidebarFooter onCancel={() => {}} onSave={() => {}} saveLabel="حفظ العميل" />
            </SidebarShell>
          ) : (
            <SidebarShell isOpen={true} onClose={() => setPreviewOverlay(false)} forceOverlay={true} className="h-full border border-slate-200 rounded-lg overflow-hidden">
              <SidebarHeader title="إضافة عميل جديد" subtitle="تعريف بطاقة عميل" onClose={() => setPreviewOverlay(false)} />
              <SidebarBody>
                <SidebarSection title="البيانات الأساسية">
                  <SidebarFieldGroup>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold">اسم العميل *</span>
                      <div className="h-9 border border-slate-200 rounded bg-white px-3 flex items-center text-xs text-slate-400">شركة المواكب التجارية</div>
                    </div>
                  </SidebarFieldGroup>
                </SidebarSection>
              </SidebarBody>
              <SidebarFooter onCancel={() => setPreviewOverlay(false)} onSave={() => setPreviewOverlay(false)} saveLabel="حفظ العميل" />
            </SidebarShell>
          )}
        </div>
      </SettingsGroup>
    </SettingsManagerLayout>
  );
};
