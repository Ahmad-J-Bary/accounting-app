import { useAppearance } from '@shared/hooks/useAppearance';
import { useNavSidebarSettings } from '@shared/hooks/useNavSidebarSettings';
import { THEME_LIST } from '@shared/config/themeRegistry';
import { PRIMARY_COLORS } from '@shared/config/primaryColors';
import { computeLayoutType } from '@shared/config/computeLayoutType';
import type { ThemeId, ColorMode, DensityMode, NavMenuType, SidenavShape, TopnavShape, NavbarAppearance } from '@shared/types/appearance';
import { SettingsSection } from '@widgets/templates/SettingsLayout';
import { Switch } from '@shared/ui/switch';
import { cn } from '@shared/lib/utils';
import {
  Check, Monitor, Sun, Moon, RotateCcw,
} from 'lucide-react';
import { LayoutSettings } from './layout/LayoutSettings';

function ToggleRow({
  label, desc, checked, onChange,
}: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
      <div>
        <span className="font-semibold text-[11px] text-slate-700">{label}</span>
        {desc && <p className="text-[9px] text-slate-400 mt-px">{desc}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function AppearanceSettings() {
  const { settings, updateSettings, resetSettings } = useAppearance();
  const { settings: navSettings, updateSetting: updateNav } = useNavSidebarSettings();

  const handleLayoutChange = (partial: {
    navMenuType?: NavMenuType;
    sidenavShape?: SidenavShape;
    topnavShape?: TopnavShape;
    verticalNavbarAppearance?: NavbarAppearance;
    horizontalNavbarAppearance?: NavbarAppearance;
  }) => {
    const next = { ...settings, ...partial };
    next.layoutType = computeLayoutType(next);
    updateSettings(next);
  };

  return (
    <div className="max-w-3xl space-y-3" dir="rtl">

      <div className="flex justify-end">
        <button
          onClick={resetSettings}
          className="flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 text-slate-500 text-[10px] font-semibold hover:bg-slate-50 transition-all"
        >
          <RotateCcw className="w-3 h-3" />
          إعادة تعيين
        </button>
      </div>

      {/* ── Layout Builder ── */}
      <SettingsSection title="تخطيط الصفحة" description="اختر نمط التخطيط الذي يناسب سير عملك">
        <LayoutSettings
          navMenuType={settings.navMenuType}
          sidenavShape={settings.sidenavShape}
          topnavShape={settings.topnavShape}
          verticalNavbarAppearance={settings.verticalNavbarAppearance}
          horizontalNavbarAppearance={settings.horizontalNavbarAppearance}
          onChange={handleLayoutChange}
        />
      </SettingsSection>

      {/* ── Themes ── */}
      <SettingsSection title="السمات" description="اختر السمة البصرية للتطبيق">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-1.5">
          {THEME_LIST.map((theme) => {
            const isActive = settings.theme === theme.id;
            const bg = theme.cssVariables['--background'] ?? '210 40% 98%';
            const primary = theme.cssVariables['--primary'] ?? '215 52% 25%';
            const accent = theme.cssVariables['--accent'] ?? '210 40% 94%';
            const sidebar = theme.cssVariables['--sidebar-background'] ?? '215 52% 18%';
            return (
              <button
                key={theme.id}
                onClick={() => updateSettings({ theme: theme.id })}
                className={cn(
                  "relative flex flex-col items-center gap-1 p-1.5 rounded-lg border transition-all",
                  isActive
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                {isActive && (
                  <span className="absolute top-0.5 left-0.5 w-3 h-3 bg-primary rounded-full flex items-center justify-center shadow-sm">
                    <Check className="w-1.5 h-1.5 text-primary-foreground" />
                  </span>
                )}
                <div className="w-full h-6 rounded overflow-hidden flex border border-slate-200">
                  <div className="flex-1" style={{ background: `hsl(${bg})` }} />
                  <div className="w-3" style={{ background: `hsl(${sidebar})` }} />
                  <div className="w-1.5" style={{ background: `hsl(${primary})` }} />
                  <div className="w-1.5" style={{ background: `hsl(${accent})` }} />
                </div>
                <span className={cn("text-[9px] font-bold", isActive ? "text-primary" : "text-slate-600")}>
                  {theme.nameAr}
                </span>
              </button>
            );
          })}
        </div>
      </SettingsSection>

      {/* ── Color Mode ── */}
      <SettingsSection title="الوضع اللوني" description="اختر بين الوضع الفاتح والداكن أو النظام">
        <div className="flex gap-1.5">
          {([
            { id: 'light' as ColorMode, label: 'فاتح', icon: Sun },
            { id: 'dark' as ColorMode, label: 'داكن', icon: Moon },
            { id: 'system' as ColorMode, label: 'النظام', icon: Monitor },
          ]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => updateSettings({ mode: id })}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 rounded-lg border transition-all flex-1",
                settings.mode === id
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-slate-200 hover:border-slate-300 text-slate-500"
              )}
            >
              <Icon className={cn("w-3.5 h-3.5", settings.mode === id ? "text-primary" : "text-slate-400")} />
              <span className={cn("font-bold text-[10px]", settings.mode === id ? "text-primary" : "text-slate-600")}>{label}</span>
            </button>
          ))}
        </div>
      </SettingsSection>

      {/* ── Primary Color ── */}
      <SettingsSection title="اللون الأساسي" description="اختر لون التطبيق الأساسي">
        <div className="flex flex-wrap gap-1.5">
          {PRIMARY_COLORS.map((pc) => {
            const isActive = settings.primaryColor === pc.id;
            const hslPreview = `hsl(${pc.hue} ${pc.saturation}% ${pc.lightness}%)`;
            return (
              <button
                key={pc.id}
                onClick={() => updateSettings({ primaryColor: pc.id })}
                className={cn(
                  "relative w-7 h-7 rounded-full border transition-all",
                  isActive ? "border-slate-700 ring-2 ring-offset-1 ring-slate-400 scale-110" : "border-transparent hover:scale-105"
                )}
                style={{ backgroundColor: hslPreview }}
                title={pc.nameAr}
              >
                {isActive && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-white drop-shadow" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </SettingsSection>

      {/* ── Density ── */}
      <SettingsSection title="كثافة العرض" description="تحكم في المسافات وحجم العناصر">
        <div className="flex gap-1.5">
          {([
            { id: 'compact' as DensityMode, label: 'مضغوط', desc: 'مسافات أصغر', bars: [4, 3, 4, 3, 4] },
            { id: 'comfortable' as DensityMode, label: 'مريح', desc: 'مسافات متوسطة', bars: [5, 4, 5, 4, 5] },
            { id: 'spacious' as DensityMode, label: 'واسع', desc: 'مسافات أكبر', bars: [6, 5, 6, 5, 6] },
          ]).map(({ id, label, desc, bars }) => (
            <button
              key={id}
              onClick={() => updateSettings({ density: id })}
              className={cn(
                "flex flex-col items-center gap-1.5 px-3 py-2 rounded-lg border transition-all flex-1",
                settings.density === id
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-slate-200 hover:border-slate-300"
              )}
            >
              <div className="flex items-end gap-0.5 h-4">
                {bars.map((h, i) => (
                  <div
                    key={i}
                    className={cn("rounded-sm w-2 transition-colors", settings.density === id ? "bg-primary/60" : "bg-slate-300")}
                    style={{ height: `${h * 2.5}px` }}
                  />
                ))}
              </div>
              <div className="text-center">
                <span className={cn("font-bold text-[10px] block", settings.density === id ? "text-primary" : "text-slate-700")}>{label}</span>
                <span className="text-[8px] text-slate-400 leading-tight">{desc}</span>
              </div>
            </button>
          ))}
        </div>
      </SettingsSection>

      {/* ── Show / Hide ── */}
      <SettingsSection title="إظهار / إخفاء العناصر" description="تحكم في ظهور العناصر المختلفة في الواجهة">
        <div>
          <ToggleRow label="الشريط الجانبي" desc="إظهار أو إخفاء شريط التنقل الجانبي" checked={settings.show.sidebar} onChange={v => updateSettings({ show: { ...settings.show, sidebar: v } })} />
          <ToggleRow label="الشريط العلوي" desc="إظهار أو إخفاء شريط الأدوات العلوي" checked={settings.show.topBar} onChange={v => updateSettings({ show: { ...settings.show, topBar: v } })} />
          <ToggleRow label="بحث" desc="إظهار أو إخفاء حقل البحث" checked={settings.show.search} onChange={v => updateSettings({ show: { ...settings.show, search: v } })} />
          <ToggleRow label="الإشعارات" desc="إظهار أو إخفاء زر الإشعارات" checked={settings.show.notifications} onChange={v => updateSettings({ show: { ...settings.show, notifications: v } })} />
          <ToggleRow label="مسار التنقل" desc="إظهار أو إخفاء مسار التنقل" checked={settings.show.breadcrumbs} onChange={v => updateSettings({ show: { ...settings.show, breadcrumbs: v } })} />
        </div>
      </SettingsSection>

      {/* ── Sidebar Overrides ── */}
      <SettingsSection title="تجاوزات الشريط الجانبي" description="إعدادات إضافية للشريط الجانبي">
        <div>
          <ToggleRow label="مطوي" desc="طي الشريط الجانبي بشكل افتراضي" checked={navSettings.navCollapsed} onChange={v => updateNav('navCollapsed', v)} />
          <ToggleRow label="مجموعات الشريط الجانبي" desc="إظهار أو إخفاء المجموعات داخل الشريط الجانبي" checked={navSettings.navShowSectionHeaders} onChange={v => updateNav('navShowSectionHeaders', v)} />
          <ToggleRow label="أيقونات الشريط الجانبي" desc="إظهار الأيقونات في الشريط الجانبي" checked={!navSettings.navIconOnly} onChange={v => updateNav('navIconOnly', !v)} />
        </div>

        <div className="mt-2 pt-2 border-t border-slate-100">
          <span className="font-semibold text-[11px] text-slate-700 block mb-1.5">خلفية الشريط الجانبي</span>
          <div className="flex flex-wrap gap-1">
            {[
              { id: 'bg-slate-900', label: 'داكن', color: '#0f172a' },
              { id: 'bg-slate-950', label: 'داكن جداً', color: '#020617' },
              { id: 'bg-slate-800', label: 'رمادي داكن', color: '#1e293b' },
              { id: 'bg-white', label: 'أبيض', color: '#ffffff' },
              { id: 'bg-slate-50', label: 'رمادي فاتح', color: '#f8fafc' },
            ].map((opt) => {
              const isActive = navSettings.navBackground === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => updateNav('navBackground', opt.id)}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-md border text-[9px] font-semibold transition-all",
                    isActive
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                  )}
                >
                  <span className="w-2.5 h-2.5 rounded-full border border-slate-300 shrink-0" style={{ backgroundColor: opt.color }} />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </SettingsSection>

    </div>
  );
}
