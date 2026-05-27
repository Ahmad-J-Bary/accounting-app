import React, { useState } from 'react';
import { useSidebarSettings } from '@shared/hooks/useSidebarSettings';
import type { SidebarWidthPreset } from '@shared/types/sidebar-settings';
import { Label } from "@shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { Switch } from "@shared/ui/switch";
import { Slider } from "@shared/ui/slider";
import { Button } from "@shared/ui/button";
import { LayoutGrid, Type, Monitor, Eye, RotateCcw, PanelRightOpen, PanelRightClose } from "lucide-react";
import { SidebarShell, SidebarHeader, SidebarBody, SidebarFooter, SidebarSection, SidebarFieldGroup } from '@widgets/sidebar';

export const SidebarSettingsManager: React.FC = () => {
  const { settings, updateSetting, resetSettings } = useSidebarSettings();
  const [previewOverlay, setPreviewOverlay] = useState(false);

  type PresetUnion = 'compact' | 'comfortable' | 'spacious';
  type BorderUnion = 'none' | 'left' | 'right' | 'all';
  type ShadowUnion = 'none' | 'sm' | 'md' | 'lg' | 'xl';
  type OverlayUnion = 'overlay' | 'inline';
  type PlacementUnion = 'left' | 'right' | 'justify';

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500" dir="rtl">
      {/* 1. Appearance Settings */}
      <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-blue-50 rounded-xl">
            <LayoutGrid className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="text-lg font-black text-slate-800">مظهر النافذة الجانبية</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-3">
            <Label className="text-slate-500 font-bold">عرض النافذة الافتراضي</Label>
            <Select 
              value={settings.widthPreset} 
              onValueChange={(v) => updateSetting('widthPreset', v as SidebarWidthPreset)}
            >
              <SelectTrigger className="h-12 rounded-2xl border-slate-200">
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

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label className="text-slate-500 font-bold">العرض المخصص ({settings.customWidth}px)</Label>
            </div>
            <Slider
              value={[settings.customWidth]}
              min={300}
              max={900}
              step={10}
              onValueChange={(v) => updateSetting('customWidth', v[0])}
              className="py-4"
            />
          </div>

          <div className="space-y-3">
            <Label className="text-slate-500 font-bold">التباعد الداخلي (Padding)</Label>
            <Select 
              value={settings.paddingPreset} 
              onValueChange={(v) => updateSetting('paddingPreset', v as PresetUnion)}
            >
              <SelectTrigger className="h-12 rounded-2xl border-slate-200">
                <SelectValue placeholder="اختر التباعد" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">مكتنز (Compact)</SelectItem>
                <SelectItem value="comfortable">مريح (Comfortable)</SelectItem>
                <SelectItem value="spacious">متسع (Spacious)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label className="text-slate-500 font-bold">التباعد بين العناصر (Spacing)</Label>
            <Select 
              value={settings.spacingPreset} 
              onValueChange={(v) => updateSetting('spacingPreset', v as PresetUnion)}
            >
              <SelectTrigger className="h-12 rounded-2xl border-slate-200">
                <SelectValue placeholder="اختر التباعد بين العناصر" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">مكتنز (Compact)</SelectItem>
                <SelectItem value="comfortable">مريح (Comfortable)</SelectItem>
                <SelectItem value="spacious">متسع (Spacious)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label className="text-slate-500 font-bold">لون الخلفية</Label>
            <Select 
              value={settings.background} 
              onValueChange={(v) => updateSetting('background', v)}
            >
              <SelectTrigger className="h-12 rounded-2xl border-slate-200">
                <SelectValue placeholder="اختر اللون" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bg-white">أبيض افتراضي (White)</SelectItem>
                <SelectItem value="bg-slate-50">رمادي فاتح جداً (Slate 50)</SelectItem>
                <SelectItem value="bg-zinc-50">رمادي دافئ (Zinc 50)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label className="text-slate-500 font-bold">درجة الظل (Shadow)</Label>
            <Select 
              value={settings.shadow} 
              onValueChange={(v) => updateSetting('shadow', v as ShadowUnion)}
            >
              <SelectTrigger className="h-12 rounded-2xl border-slate-200">
                <SelectValue placeholder="اختر مستوى الظل" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">بدون ظل (None)</SelectItem>
                <SelectItem value="sm">خفيف جداً (Small)</SelectItem>
                <SelectItem value="md">متوسط (Medium)</SelectItem>
                <SelectItem value="lg">قوي (Large)</SelectItem>
                <SelectItem value="xl">قوي جداً (Extra Large)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* 2. Typography & Fonts */}
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
              <Label className="text-slate-500 font-bold">حجم خط العناوين والحقول ({settings.fontSize}px)</Label>
            </div>
            <Slider
              value={[settings.fontSize]}
              min={12}
              max={16}
              step={1}
              onValueChange={(v) => updateSetting('fontSize', v[0])}
              className="py-4"
            />
          </div>

          <div className="space-y-3">
            <Label className="text-slate-500 font-bold">نمط الحدود (Borders)</Label>
            <Select 
              value={settings.borderStyle} 
              onValueChange={(v) => updateSetting('borderStyle', v as BorderUnion)}
            >
              <SelectTrigger className="h-12 rounded-2xl border-slate-200">
                <SelectValue placeholder="اختر الحدود" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">بدون حدود</SelectItem>
                <SelectItem value="left">حد أيسر فقط (جهة المحتوى)</SelectItem>
                <SelectItem value="right">حد أيمن فقط</SelectItem>
                <SelectItem value="all">حدود كاملة</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* 3. Behavior settings */}
      <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-emerald-50 rounded-xl">
            <Monitor className="w-5 h-5 text-emerald-600" />
          </div>
          <h3 className="text-lg font-black text-slate-800">سلوك التفاعل والتحريك</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-50 bg-slate-50/30">
            <div className="space-y-0.5">
              <Label className="text-slate-700 font-bold">وضع العرض</Label>
              <p className="text-[10px] text-slate-400">تداخل (Overlay) أو جنبًا لجنب (Inline).</p>
            </div>
            <Select 
              value={settings.overlayVsInline}
              onValueChange={(v) => updateSetting('overlayVsInline', v as OverlayUnion)}
            >
              <SelectTrigger className="w-28 h-9 border-slate-200 font-bold text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inline">جنباً لجنب</SelectItem>
                <SelectItem value="overlay">نافذة طائرة</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-50 bg-slate-50/30">
            <div className="space-y-0.5">
              <Label className="text-slate-700 font-bold">ترويسة وتذييل ثابتين</Label>
              <p className="text-[10px] text-slate-400">تثبيت الهيدر والفوتر أثناء التمرير.</p>
            </div>
            <Switch 
              checked={settings.stickyHeaderFooter} 
              onCheckedChange={(v) => updateSetting('stickyHeaderFooter', v)} 
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-50 bg-slate-50/30">
            <div className="space-y-0.5">
              <Label className="text-slate-700 font-bold">موقع زر الحفظ</Label>
              <p className="text-[10px] text-slate-400">محاذاة أزرار الحفظ والإلغاء.</p>
            </div>
            <Select 
              value={settings.saveButtonPlacement}
              onValueChange={(v) => updateSetting('saveButtonPlacement', v as PlacementUnion)}
            >
              <SelectTrigger className="w-28 h-9 border-slate-200 font-bold text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="right">يمين</SelectItem>
                <SelectItem value="left">يسار</SelectItem>
                <SelectItem value="justify">موزع بالكامل</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-50 bg-slate-50/30">
            <div className="space-y-0.5">
              <Label className="text-slate-700 font-bold">إظهار زر الإغلاق</Label>
              <p className="text-[10px] text-slate-400">عرض علامة (X) في أعلى الهيدر.</p>
            </div>
            <Switch 
              checked={settings.closeButtonVisibility} 
              onCheckedChange={(v) => updateSetting('closeButtonVisibility', v)} 
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-50 bg-slate-50/30">
            <div className="space-y-0.5">
              <Label className="text-slate-700 font-bold">سرعة التحريك</Label>
              <p className="text-[10px] text-slate-400">مدة تأثير الفتح والإغلاق بالملي ثانية.</p>
            </div>
            <Select 
              value={settings.animationSpeed.toString()}
              onValueChange={(v) => updateSetting('animationSpeed', parseInt(v))}
            >
              <SelectTrigger className="w-28 h-9 border-slate-200 font-bold text-xs">
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
      </div>

      {/* 4. Live Preview */}
      <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-violet-50 rounded-xl">
            <Eye className="w-5 h-5 text-violet-600" />
          </div>
          <h3 className="text-lg font-black text-slate-800">معاينة مباشرة للنافذة</h3>
          <div className="mr-auto flex items-center gap-2">
            <Button
              variant={previewOverlay ? "default" : "outline"}
              size="sm"
              onClick={() => setPreviewOverlay(true)}
              className="rounded-xl h-9 text-xs font-bold gap-1.5"
            >
              <PanelRightOpen className="w-3.5 h-3.5" />
              عائم
            </Button>
            <Button
              variant={!previewOverlay ? "default" : "outline"}
              size="sm"
              onClick={() => setPreviewOverlay(false)}
              className="rounded-xl h-9 text-xs font-bold gap-1.5"
            >
              <PanelRightClose className="w-3.5 h-3.5" />
              مضمن
            </Button>
          </div>
        </div>

        <div className="border border-slate-100 rounded-3xl overflow-hidden bg-slate-50/40 p-6 flex justify-center items-stretch h-[450px] relative">
          <div className="flex-1 flex items-center justify-center text-slate-400 text-xs font-bold border border-dashed border-slate-200 rounded-2xl ml-4 bg-white">
            المحتوى الرئيسي (الجدول أو الصفحة الأساسية)
          </div>
          {!previewOverlay ? (
            <SidebarShell isOpen={true} onClose={() => {}} forceOverlay={false} className="h-full border border-slate-200 rounded-2xl overflow-hidden shadow-md">
              <SidebarHeader 
                title="إضافة عميل جديد" 
                subtitle="تعريف بطاقة عميل جديدة في النظام" 
                onClose={() => {}} 
              />
              <SidebarBody>
                <SidebarSection title="البيانات الأساسية">
                  <SidebarFieldGroup>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold">اسم العميل *</span>
                      <div className="h-9 border border-slate-200 rounded bg-white px-3 flex items-center text-xs text-slate-400">شركة المواكب التجارية</div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold">رقم الهاتف</span>
                      <div className="h-9 border border-slate-200 rounded bg-white px-3 flex items-center text-xs text-slate-400">093333333</div>
                    </div>
                  </SidebarFieldGroup>
                </SidebarSection>
              </SidebarBody>
              <SidebarFooter onCancel={() => {}} onSave={() => {}} saveLabel="حفظ العميل" />
            </SidebarShell>
          ) : (
            <SidebarShell isOpen={true} onClose={() => setPreviewOverlay(false)} forceOverlay={true} className="h-full border border-slate-200 rounded-2xl overflow-hidden shadow-md">
              <SidebarHeader 
                title="إضافة عميل جديد" 
                subtitle="تعريف بطاقة عميل جديدة في النظام" 
                onClose={() => setPreviewOverlay(false)} 
              />
              <SidebarBody>
                <SidebarSection title="البيانات الأساسية">
                  <SidebarFieldGroup>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold">اسم العميل *</span>
                      <div className="h-9 border border-slate-200 rounded bg-white px-3 flex items-center text-xs text-slate-400">شركة المواكب التجارية</div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold">رقم الهاتف</span>
                      <div className="h-9 border border-slate-200 rounded bg-white px-3 flex items-center text-xs text-slate-400">093333333</div>
                    </div>
                  </SidebarFieldGroup>
                </SidebarSection>
              </SidebarBody>
              <SidebarFooter onCancel={() => setPreviewOverlay(false)} onSave={() => setPreviewOverlay(false)} saveLabel="حفظ العميل" />
            </SidebarShell>
          )}
        </div>
      </div>

      {/* 5. Reset */}
      <div className="flex justify-start">
        <Button
          variant="outline"
          onClick={resetSettings}
          className="rounded-2xl h-11 gap-2 text-slate-500 border-slate-200"
        >
          <RotateCcw className="w-4 h-4" />
          استعادة الإعدادات الافتراضية
        </Button>
      </div>
    </div>
  );
};
