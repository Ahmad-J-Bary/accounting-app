import React, { useState } from 'react';
import { useSidePanelSettings } from '@shared/hooks';
import type { SidebarWidthPreset } from '@shared/types/sidebar-settings';
import { Label } from "@shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { Switch } from "@shared/ui/switch";
import { Slider } from "@shared/ui/slider";
import { Button } from "@shared/ui/button";
import { LayoutGrid, Type, Monitor, Eye, PanelRightOpen, PanelRightClose } from "lucide-react";
import { SidebarShell, SidebarHeader, SidebarBody, SidebarFooter, SidebarSection, SidebarFieldGroup } from '@widgets/sidebar-shell';
import { SettingsManagerLayout, SettingsGroup } from '@widgets/templates/SettingsManagerLayout';

export const PanelSettingsManager: React.FC = () => {
  const { settings: sideSettings, updateSetting: updateSideSetting, resetSettings: resetSideSettings } = useSidePanelSettings();
  const [previewOverlay, setPreviewOverlay] = useState(false);

  type PresetUnion = 'compact' | 'comfortable' | 'spacious';
  type BorderUnion = 'none' | 'left' | 'right' | 'all';
  type ShadowUnion = 'none' | 'sm' | 'md' | 'lg' | 'xl';
  type OverlayUnion = 'overlay' | 'inline';
  type PlacementUnion = 'left' | 'right' | 'justify';

  return (
    <SettingsManagerLayout resetAction={resetSideSettings}>
      <div className="space-y-5">
        <div className="flex flex-col gap-1 border-r-4 border-emerald-600 pr-3 pb-1 mb-2">
          <h2 className="text-xl font-black text-slate-800">لوحة العمليات والنماذج الجانبية</h2>
          <p className="text-xs text-slate-500">تخصيص مظهر وأبعاد وسلوك لوحة النماذج والمدخلات الجانبية المنبثقة (Drawer / Operations Panel)</p>
        </div>

        <SettingsGroup title="تخطيط وأبعاد لوحة العمليات" icon={LayoutGrid} color="text-emerald-600">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-slate-600 font-semibold">العرض الافتراضي للوحة</Label>
              <Select
                value={sideSettings.widthPreset}
                onValueChange={(v) => updateSideSetting('widthPreset', v as SidebarWidthPreset)}
              >
                <SelectTrigger className="h-10 rounded-lg border-slate-200">
                  <SelectValue placeholder="اختر العرض" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="narrow">ضيق (380px)</SelectItem>
                  <SelectItem value="standard">قياسي (500px)</SelectItem>
                  <SelectItem value="wide">عريض (640px)</SelectItem>
                  <SelectItem value="extra-wide">عريض جداً (800px)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-slate-600 font-semibold">العرض المخصص للوحة ({sideSettings.customWidth}px)</Label>
              </div>
              <Slider
                value={[sideSettings.customWidth]}
                min={300}
                max={900}
                step={10}
                onValueChange={(v) => updateSideSetting('customWidth', v[0])}
                className="py-2"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-600 font-semibold">التباعد الداخلي للوحة (الحشوة)</Label>
              <Select
                value={sideSettings.paddingPreset}
                onValueChange={(v) => updateSideSetting('paddingPreset', v as PresetUnion)}
              >
                <SelectTrigger className="h-10 rounded-lg border-slate-200">
                  <SelectValue placeholder="اختر التباعد" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="compact">مكتنز (صغير)</SelectItem>
                  <SelectItem value="comfortable">مريح (متوسط)</SelectItem>
                  <SelectItem value="spacious">متسع (كبير)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-600 font-semibold">التباعد بين حقول النموذج</Label>
              <Select
                value={sideSettings.spacingPreset}
                onValueChange={(v) => updateSideSetting('spacingPreset', v as PresetUnion)}
              >
                <SelectTrigger className="h-10 rounded-lg border-slate-200">
                  <SelectValue placeholder="اختر التباعد" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="compact">مكتنز (متراص)</SelectItem>
                  <SelectItem value="comfortable">مريح (متناسب)</SelectItem>
                  <SelectItem value="spacious">متسع (متباعد)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-600 font-semibold">لون خلفية اللوحة</Label>
              <Select
                value={sideSettings.background}
                onValueChange={(v) => updateSideSetting('background', v)}
              >
                <SelectTrigger className="h-10 rounded-lg border-slate-200">
                  <SelectValue placeholder="اختر اللون" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bg-white">أبيض ناصع</SelectItem>
                  <SelectItem value="bg-slate-50">رمادي بارد</SelectItem>
                  <SelectItem value="bg-zinc-50">رمادي دافئ</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-600 font-semibold">درجة ظل لوحة العمليات</Label>
              <Select
                value={sideSettings.shadow}
                onValueChange={(v) => updateSideSetting('shadow', v as ShadowUnion)}
              >
                <SelectTrigger className="h-10 rounded-lg border-slate-200">
                  <SelectValue placeholder="اختر مستوى الظل" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون ظل (مسطح)</SelectItem>
                  <SelectItem value="sm">خفيف</SelectItem>
                  <SelectItem value="md">متوسط</SelectItem>
                  <SelectItem value="lg">قوي (بارز)</SelectItem>
                  <SelectItem value="xl">قوي جداً</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </SettingsGroup>

        <SettingsGroup title="الخطوط والحدود الفاصلة للوحة" icon={Type} color="text-amber-600">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-slate-600 font-semibold">حجم خط حقول اللوحة ({sideSettings.fontSize}px)</Label>
              </div>
              <Slider
                value={[sideSettings.fontSize]}
                min={12}
                max={16}
                step={1}
                onValueChange={(v) => updateSideSetting('fontSize', v[0])}
                className="py-2"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-600 font-semibold">نمط حدود لوحة العمليات</Label>
              <Select
                value={sideSettings.borderStyle}
                onValueChange={(v) => updateSideSetting('borderStyle', v as BorderUnion)}
              >
                <SelectTrigger className="h-10 rounded-lg border-slate-200">
                  <SelectValue placeholder="اختر الحدود" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون حدود</SelectItem>
                  <SelectItem value="left">حد أيسر فقط (فاصل)</SelectItem>
                  <SelectItem value="right">حد أيمن فقط</SelectItem>
                  <SelectItem value="all">حدود كاملة</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </SettingsGroup>

        <SettingsGroup title="تفاعل وسلوك لوحة العمليات" icon={Monitor} color="text-orange-600">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/30">
              <div className="space-y-0.5">
                <Label className="text-slate-700 font-semibold">سلوك عرض اللوحة</Label>
              </div>
              <Select
                value={sideSettings.overlayVsInline}
                onValueChange={(v) => updateSideSetting('overlayVsInline', v as OverlayUnion)}
              >
                <SelectTrigger className="w-24 h-9 border-slate-200 font-bold text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inline">مضمنة (تدفع المحتوى)</SelectItem>
                  <SelectItem value="overlay">عائمة (فوق المحتوى)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/30">
              <div className="space-y-0.5">
                <Label className="text-slate-700 font-semibold">ترويسة وتذييل ثابتين</Label>
              </div>
              <Switch
                checked={sideSettings.stickyHeaderFooter}
                onCheckedChange={(v) => updateSideSetting('stickyHeaderFooter', v)}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/30">
              <div className="space-y-0.5">
                <Label className="text-slate-700 font-semibold">موقع أزرار الحفظ والإجراءات</Label>
              </div>
              <Select
                value={sideSettings.saveButtonPlacement}
                onValueChange={(v) => updateSideSetting('saveButtonPlacement', v as PlacementUnion)}
              >
                <SelectTrigger className="w-24 h-9 border-slate-200 font-bold text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="right">يمين (افتراضي)</SelectItem>
                  <SelectItem value="left">يسار</SelectItem>
                  <SelectItem value="justify">توزيع متساوي</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/30">
              <div className="space-y-0.5">
                <Label className="text-slate-700 font-semibold">إظهار زر الإغلاق العلوي</Label>
              </div>
              <Switch
                checked={sideSettings.closeButtonVisibility}
                onCheckedChange={(v) => updateSideSetting('closeButtonVisibility', v)}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/30">
              <div className="space-y-0.5">
                <Label className="text-slate-700 font-semibold">سرعة حركة ظهور اللوحة</Label>
              </div>
              <Select
                value={sideSettings.animationSpeed.toString()}
                onValueChange={(v) => updateSideSetting('animationSpeed', parseInt(v))}
              >
                <SelectTrigger className="w-24 h-9 border-slate-200 font-bold text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="150">سريع (150ms)</SelectItem>
                  <SelectItem value="300">متوسط (300ms)</SelectItem>
                  <SelectItem value="500">سلس (500ms)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </SettingsGroup>

        <SettingsGroup title="معاينة حية لتصميم لوحة العمليات" icon={Eye} color="text-violet-600">
          <div className="flex items-center gap-2 mb-4">
            <Button
              variant={previewOverlay ? "default" : "outline"}
              size="sm"
              onClick={() => setPreviewOverlay(true)}
              className="rounded-lg h-9 text-xs font-bold gap-1.5"
            >
              <PanelRightOpen className="w-3.5 h-3.5" />
              لوحة عائمة (Overlay)
            </Button>
            <Button
              variant={!previewOverlay ? "default" : "outline"}
              size="sm"
              onClick={() => setPreviewOverlay(false)}
              className="rounded-lg h-9 text-xs font-bold gap-1.5"
            >
              <PanelRightClose className="w-3.5 h-3.5" />
              لوحة مضمنة (Inline)
            </Button>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/40 p-4 flex justify-center items-stretch h-[350px]">
            <div className="flex-1 flex items-center justify-center text-slate-400 text-xs font-bold border border-dashed border-slate-200 rounded-lg ml-3 bg-white">
              محتوى الشاشة الرئيسي للتطبيق
            </div>
            {!previewOverlay ? (
              <SidebarShell isOpen={true} onClose={() => {}} forceOverlay={false} className="h-full border border-slate-200 rounded-lg overflow-hidden">
                <SidebarHeader title="إضافة عميل جديد" subtitle="تعريف بطاقة عميل جديدة" onClose={() => {}} />
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
                <SidebarHeader title="إضافة عميل جديد" subtitle="تعريف بطاقة عميل جديدة" onClose={() => setPreviewOverlay(false)} />
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
      </div>
    </SettingsManagerLayout>
  );
};
