import React, { useState } from 'react';
import { useSidePanelSettings, useNavSidebarSettings } from '@shared/hooks';
import type { SidebarWidthPreset, NavLayoutType, SidebarDensityPreset } from '@shared/types/sidebar-settings';
import { Label } from "@shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { Switch } from "@shared/ui/switch";
import { Slider } from "@shared/ui/slider";
import { Button } from "@shared/ui/button";
import { LayoutGrid, Type, Monitor, Eye, PanelRightOpen, PanelRightClose, Menu, Sliders } from "lucide-react";
import { SidebarShell, SidebarHeader, SidebarBody, SidebarFooter, SidebarSection, SidebarFieldGroup } from '@widgets/sidebar-shell';
import { SettingsManagerLayout, SettingsGroup } from '@widgets/templates/SettingsManagerLayout';

export const SidebarSettingsManager: React.FC = () => {
  const { settings: navSettings, updateSetting: updateNavSetting, resetSettings: resetNavSettings } = useNavSidebarSettings();
  const { settings: sideSettings, updateSetting: updateSideSetting, resetSettings: resetSideSettings } = useSidePanelSettings();
  const [previewOverlay, setPreviewOverlay] = useState(false);

  type PresetUnion = 'compact' | 'comfortable' | 'spacious';
  type BorderUnion = 'none' | 'left' | 'right' | 'all';
  type ShadowUnion = 'none' | 'sm' | 'md' | 'lg' | 'xl';
  type OverlayUnion = 'overlay' | 'inline';
  type PlacementUnion = 'left' | 'right' | 'justify';

  const handleResetAll = () => {
    resetNavSettings();
    resetSideSettings();
  };

  return (
    <SettingsManagerLayout resetAction={handleResetAll}>
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* القسم الأول: إعدادات شريط التنقل الجانبي الرئيسي (قائمة التطبيق) */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      <div className="space-y-5">
        <div className="flex flex-col gap-1 border-r-4 border-blue-600 pr-3 pb-1 mb-2">
          <h2 className="text-xl font-black text-slate-800">1. شريط التنقل الجانبي الرئيسي للتطبيق (قائمة التصفح)</h2>
          <p className="text-xs text-slate-500">تخصيص مظهر وتخطيط القائمة الجانبية الرئيسية للتنقل بين شاشات وفروع النظام</p>
        </div>

        <SettingsGroup title="تخطيط وأبعاد شريط التنقل الرئيسي" icon={Menu} color="text-blue-600">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-slate-600 font-semibold">نوع التخطيط</Label>
              <Select
                value={navSettings.navLayoutType}
                onValueChange={(v) => updateNavSetting('navLayoutType', v as NavLayoutType)}
              >
                <SelectTrigger className="h-10 rounded-lg border-slate-200">
                  <SelectValue placeholder="اختر نوع التخطيط" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vertical">عمودي (افتراضي)</SelectItem>
                  <SelectItem value="topnav-slim">شريط علوي نحيف</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-slate-600 font-semibold">عرض شريط التنقل ({navSettings.navWidth}px)</Label>
              </div>
              <Slider
                value={[navSettings.navWidth]}
                min={180}
                max={320}
                step={5}
                disabled={navSettings.navLayoutType === 'topnav-slim'}
                onValueChange={(v) => updateNavSetting('navWidth', v[0])}
                className="py-2"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-600 font-semibold">تباعد الكثافة</Label>
              <Select
                value={navSettings.navDensity}
                onValueChange={(v) => updateNavSetting('navDensity', v as SidebarDensityPreset)}
              >
                <SelectTrigger className="h-10 rounded-lg border-slate-200">
                  <SelectValue placeholder="اختر الكثافة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="compact">مكتنز (صغير)</SelectItem>
                  <SelectItem value="comfortable">مريح (متوسط)</SelectItem>
                  <SelectItem value="spacious">متسع (كبير)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-slate-600 font-semibold">حجم خط القائمة ({navSettings.navFontSize}px)</Label>
              </div>
              <Slider
                value={[navSettings.navFontSize]}
                min={12}
                max={16}
                step={1}
                onValueChange={(v) => updateNavSetting('navFontSize', v[0])}
                className="py-2"
              />
            </div>
          </div>
        </SettingsGroup>

        <SettingsGroup title="ألوان ومظهر شريط التنقل الرئيسي" icon={LayoutGrid} color="text-indigo-600">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label className="text-slate-600 font-semibold">خلفية شريط التنقل</Label>
              <Select
                value={navSettings.navBackground}
                onValueChange={(v) => updateNavSetting('navBackground', v)}
              >
                <SelectTrigger className="h-10 rounded-lg border-slate-200">
                  <SelectValue placeholder="اختر لون الخلفية" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bg-slate-900">داكن (افتراضي)</SelectItem>
                  <SelectItem value="bg-slate-950">داكن جداً</SelectItem>
                  <SelectItem value="bg-slate-800">رمادي داكن</SelectItem>
                  <SelectItem value="bg-white">أبيض ناصع</SelectItem>
                  <SelectItem value="bg-slate-50">رمادي فاتح</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-600 font-semibold">خلفية العنصر النشط</Label>
              <Select
                value={navSettings.navActiveBg}
                onValueChange={(v) => updateNavSetting('navActiveBg', v)}
              >
                <SelectTrigger className="h-10 rounded-lg border-slate-200">
                  <SelectValue placeholder="اختر اللون النشط" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bg-blue-600">أزرق ملكي</SelectItem>
                  <SelectItem value="bg-emerald-600">أخضر زمردي</SelectItem>
                  <SelectItem value="bg-slate-700">رمادي داكن</SelectItem>
                  <SelectItem value="bg-rose-600">أحمر مرجاني</SelectItem>
                  <SelectItem value="bg-violet-600">بنفسجي ملكي</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-600 font-semibold">مظهر التمرير (Hover)</Label>
              <Select
                value={navSettings.navHoverBg}
                onValueChange={(v) => updateNavSetting('navHoverBg', v)}
              >
                <SelectTrigger className="h-10 rounded-lg border-slate-200">
                  <SelectValue placeholder="اختر لون التمرير" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hover:bg-white/5 hover:text-white">افتراضي (شفاف خفيف)</SelectItem>
                  <SelectItem value="hover:bg-white/10 hover:text-white">تأثير مضيء</SelectItem>
                  <SelectItem value="hover:bg-slate-800 hover:text-white">تأثير داكن</SelectItem>
                  <SelectItem value="hover:bg-transparent hover:text-white">بدون خلفية (نص فقط)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </SettingsGroup>

        <SettingsGroup title="خيارات العرض وتكامل سلوك التنقل" icon={Sliders} color="text-cyan-600">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/30">
              <Label className="text-slate-700 font-semibold">إظهار تسميات العناصر</Label>
              <Switch
                checked={navSettings.navShowLabels}
                onCheckedChange={(v) => updateNavSetting('navShowLabels', v)}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/30">
              <Label className="text-slate-700 font-semibold">إظهار عناوين الأقسام</Label>
              <Switch
                checked={navSettings.navShowSectionHeaders}
                onCheckedChange={(v) => updateNavSetting('navShowSectionHeaders', v)}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/30">
              <Label className="text-slate-700 font-semibold">حفظ حالة طي القائمة</Label>
              <Switch
                checked={navSettings.navRemembersState}
                onCheckedChange={(v) => updateNavSetting('navRemembersState', v)}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/30">
              <Label className="text-slate-700 font-semibold">حدود فاصلة جانبية</Label>
              <Switch
                checked={navSettings.navBordered}
                onCheckedChange={(v) => updateNavSetting('navBordered', v)}
              />
            </div>
          </div>
        </SettingsGroup>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* القسم الثاني: إعدادات لوحة العمليات والمدخلات الجانبية (شاشات إدخال البيانات والنماذج) */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      <div className="space-y-5 pt-8 border-t border-slate-200">
        <div className="flex flex-col gap-1 border-r-4 border-emerald-600 pr-3 pb-1 mb-2">
          <h2 className="text-xl font-black text-slate-800">2. لوحة العمليات والنوافذ الجانبية للنماذج (لوحة التفاصيل)</h2>
          <p className="text-xs text-slate-500">تخصيص مظهر وأبعاد وسلوك لوحة العمليات والمدخلات الجانبية المنبثقة للنماذج (Drawer / Operations Panel)</p>
        </div>

        <SettingsGroup title="تخطيط وأبعاد لوحة العمليات الجانبية" icon={LayoutGrid} color="text-emerald-600">
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
              <Label className="text-slate-600 font-semibold">التباعد بين حقول النموذج والمدخلات</Label>
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

        <SettingsGroup title="الخطوط والحدود الفاصلة للوحة العمليات" icon={Type} color="text-amber-600">
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

        <SettingsGroup title="تفاعل وسلوك لوحة العمليات الجانبية" icon={Monitor} color="text-orange-600">
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
                <Label className="text-slate-700 font-semibold">ترويسة وتذييل ثابتين للوحة</Label>
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

        <SettingsGroup title="معاينة حية لتصميم لوحة العمليات الجانبية" icon={Eye} color="text-violet-600">
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
