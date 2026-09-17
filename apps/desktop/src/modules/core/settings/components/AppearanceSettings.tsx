import { useAppearance } from '@shared/hooks/useAppearance';
import { useNavSidebarSettings } from '@shared/hooks/useNavSidebarSettings';
import { THEME_LIST } from '@shared/config/themeRegistry';
import { PRIMARY_COLORS } from '@shared/config/primaryColors';
import { computeLayoutType } from '@shared/config/computeLayoutType';
import type {
  ColorMode,
  DensityMode,
  MotionMode,
  NavMenuType,
  NavbarAppearance,
  SidenavShape,
  TabStyleMode,
  TopnavShape,
  UIScale,
} from '@shared/types/appearance';
import { SettingsSection } from '@widgets/templates/SettingsLayout';
import { Switch } from '@shared/ui/switch';
import { cn } from '@shared/lib/utils';
import {
  Check, Monitor, Sun, Moon, RotateCcw,
} from 'lucide-react';
import { LayoutSettings } from './layout/LayoutSettings';
import { useLocalization } from "@app/providers/LocalizationProvider";

function ToggleRow({
  label, desc, checked, onChange,
}: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border last:border-0 gap-2">
      <div className="min-w-0">
        <span className="font-semibold text-[11px] text-foreground">{label}</span>
        {desc && <p className="text-[9px] text-muted-foreground mt-px">{desc}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} className="shrink-0" />
    </div>
  );
}

export function AppearanceSettings() {
  const { t, direction } = useLocalization();
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
    <div className="w-full space-y-3" dir={direction}>

      <div className="flex justify-end">
        <button
          onClick={resetSettings}
          className="flex items-center gap-1 px-2 py-1 rounded-lg border border-border text-muted-foreground text-[10px] font-semibold hover:bg-accent transition-all"
        >
          <RotateCcw className="w-3 h-3" />
          {t("appearance.reset", { namespace: "settings" })}
        </button>
      </div>

      {/* ── Layout Builder ── */}
      <SettingsSection title={t("appearance.layoutTitle", { namespace: "settings" })} description={t("appearance.layoutDescription", { namespace: "settings" })}>
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
      <SettingsSection title={t("appearance.themesTitle", { namespace: "settings" })} description={t("appearance.themesDescription", { namespace: "settings" })}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5">
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
                    : "border-border hover:border-border/80 hover:bg-accent"
                )}
              >
                {isActive && (
                  <span className="absolute top-0.5 start-0.5 w-3 h-3 bg-primary rounded-full flex items-center justify-center shadow-sm">
                    <Check className="w-1.5 h-1.5 text-primary-foreground" />
                  </span>
                )}
                <div className="w-full h-6 rounded overflow-hidden flex border border-border">
                  <div className="flex-1" style={{ background: `hsl(${bg})` }} />
                  <div className="w-3" style={{ background: `hsl(${sidebar})` }} />
                  <div className="w-1.5" style={{ background: `hsl(${primary})` }} />
                  <div className="w-1.5" style={{ background: `hsl(${accent})` }} />
                </div>
                <span className={cn("text-[9px] font-bold", isActive ? "text-primary" : "text-muted-foreground")}>
                  {theme.nameAr}
                </span>
              </button>
            );
          })}
        </div>
      </SettingsSection>

      {/* ── Color Mode ── */}
      <SettingsSection title={t("appearance.colorModeTitle", { namespace: "settings" })} description={t("appearance.colorModeDescription", { namespace: "settings" })}>
        <div className="flex gap-1.5">
          {([
            { id: 'light' as ColorMode, label: t("appearance.colorModes.light", { namespace: "settings" }), icon: Sun },
            { id: 'dark' as ColorMode, label: t("appearance.colorModes.dark", { namespace: "settings" }), icon: Moon },
            { id: 'system' as ColorMode, label: t("appearance.colorModes.system", { namespace: "settings" }), icon: Monitor },
          ]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => updateSettings({ mode: id })}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 rounded-lg border transition-all flex-1",
                settings.mode === id
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-border/80 text-muted-foreground"
              )}
            >
              <Icon className={cn("w-3.5 h-3.5", settings.mode === id ? "text-primary" : "text-muted-foreground")} />
              <span className={cn("font-bold text-[10px]", settings.mode === id ? "text-primary" : "text-foreground")}>{label}</span>
            </button>
          ))}
        </div>
      </SettingsSection>

      {/* ── Primary Color ── */}
      <SettingsSection title={t("appearance.primaryColorTitle", { namespace: "settings" })} description={t("appearance.primaryColorDescription", { namespace: "settings" })}>
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
                  isActive ? "border-foreground ring-2 ring-offset-1 ring-muted scale-110" : "border-transparent hover:scale-105"
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
      <SettingsSection title={t("appearance.densityTitle", { namespace: "settings" })} description={t("appearance.densityDescription", { namespace: "settings" })}>
        <div className="flex gap-1.5">
          {([
            { id: 'compact' as DensityMode, label: t("appearance.density.compact", { namespace: "settings" }), desc: t("appearance.densityDescriptions.compact", { namespace: "settings" }), bars: [4, 3, 4, 3, 4] },
            { id: 'comfortable' as DensityMode, label: t("appearance.density.comfortable", { namespace: "settings" }), desc: t("appearance.densityDescriptions.comfortable", { namespace: "settings" }), bars: [5, 4, 5, 4, 5] },
            { id: 'spacious' as DensityMode, label: t("appearance.density.spacious", { namespace: "settings" }), desc: t("appearance.densityDescriptions.spacious", { namespace: "settings" }), bars: [6, 5, 6, 5, 6] },
          ]).map(({ id, label, desc, bars }) => (
            <button
              key={id}
              onClick={() => updateSettings({ density: id })}
              className={cn(
                "flex flex-col items-center gap-1.5 px-3 py-2 rounded-lg border transition-all flex-1",
                settings.density === id
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-border/80"
              )}
            >
              <div className="flex items-end gap-0.5 h-4">
                {bars.map((h, i) => (
                  <div
                    key={i}
                    className={cn("rounded-sm w-2 transition-colors", settings.density === id ? "bg-primary/60" : "bg-muted-foreground/30")}
                    style={{ height: `${h * 2.5}px` }}
                  />
                ))}
              </div>
              <div className="text-center">
                <span className={cn("font-bold text-[10px] block", settings.density === id ? "text-primary" : "text-foreground")}>{label}</span>
                <span className="text-[8px] text-muted-foreground leading-tight">{desc}</span>
              </div>
            </button>
          ))}
        </div>
      </SettingsSection>

      {/* ── UI Scale ── */}
      <SettingsSection title={t("appearance.uiScaleTitle", { namespace: "settings" })} description={t("appearance.uiScaleDescription", { namespace: "settings" })}>
        <div className="flex gap-1.5">
          {([
            { id: 'small' as UIScale, label: t("appearance.uiScale.small", { namespace: "settings" }), desc: t("appearance.uiScaleDescriptions.small", { namespace: "settings" }), scale: 0.875 },
            { id: 'default' as UIScale, label: t("appearance.uiScale.default", { namespace: "settings" }), desc: t("appearance.uiScaleDescriptions.default", { namespace: "settings" }), scale: 1 },
            { id: 'large' as UIScale, label: t("appearance.uiScale.large", { namespace: "settings" }), desc: t("appearance.uiScaleDescriptions.large", { namespace: "settings" }), scale: 1.125 },
          ]).map(({ id, label, desc, scale }) => (
            <button
              key={id}
              onClick={() => updateSettings({ uiScale: id })}
              className={cn(
                "flex flex-col items-center gap-1.5 px-3 py-2 rounded-lg border transition-all flex-1",
                settings.uiScale === id
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-border/80"
              )}
            >
              <div className="flex items-center justify-center h-4">
                <span
                  className={cn("font-bold transition-all", settings.uiScale === id ? "text-primary" : "text-foreground")}
                  style={{ fontSize: `${14 * scale}px` }}
                >
                  Aa
                </span>
              </div>
              <div className="text-center">
                <span className={cn("font-bold text-[10px] block", settings.uiScale === id ? "text-primary" : "text-foreground")}>{label}</span>
                <span className="text-[8px] text-muted-foreground leading-tight">{desc}</span>
              </div>
            </button>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title={t("appearance.tabsMotionTitle", { namespace: "settings" })} description={t("appearance.tabsMotionDescription", { namespace: "settings" })}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <span className="font-semibold text-[11px] text-foreground block mb-1.5">{t("appearance.tabStyleLabel", { namespace: "settings" })}</span>
            <div className="flex gap-1.5">
              {([
                { id: 'default' as TabStyleMode, label: t("appearance.tabStyles.default", { namespace: "settings" }) },
                { id: 'browser' as TabStyleMode, label: t("appearance.tabStyles.browser", { namespace: "settings" }) },
                { id: 'vscode' as TabStyleMode, label: t("appearance.tabStyles.vscode", { namespace: "settings" }) },
              ]).map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => updateSettings({ tabStyle: id })}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2 text-[10px] font-bold transition-all",
                    settings.tabStyle === id
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:border-border/80",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="font-semibold text-[11px] text-foreground block mb-1.5">{t("appearance.motionLabel", { namespace: "settings" })}</span>
            <div className="flex gap-1.5">
              {([
                { id: 'full' as MotionMode, label: t("appearance.motions.full", { namespace: "settings" }) },
                { id: 'reduced' as MotionMode, label: t("appearance.motions.reduced", { namespace: "settings" }) },
              ]).map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => updateSettings({ motion: id })}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2 text-[10px] font-bold transition-all",
                    settings.motion === id
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:border-border/80",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* ── Show / Hide ── */}
      <SettingsSection title={t("appearance.showHideTitle", { namespace: "settings" })} description={t("appearance.showHideDescription", { namespace: "settings" })}>
        <div>
          <ToggleRow label={t("appearance.show.sidebar", { namespace: "settings" })} desc={t("appearance.show.sidebarDesc", { namespace: "settings" })} checked={settings.show.sidebar} onChange={v => updateSettings({ show: { ...settings.show, sidebar: v } })} />
          <ToggleRow label={t("appearance.show.topBar", { namespace: "settings" })} desc={t("appearance.show.topBarDesc", { namespace: "settings" })} checked={settings.show.topBar} onChange={v => updateSettings({ show: { ...settings.show, topBar: v } })} />
          <ToggleRow label={t("appearance.show.search", { namespace: "settings" })} desc={t("appearance.show.searchDesc", { namespace: "settings" })} checked={settings.show.search} onChange={v => updateSettings({ show: { ...settings.show, search: v } })} />
          <ToggleRow label={t("appearance.show.notifications", { namespace: "settings" })} desc={t("appearance.show.notificationsDesc", { namespace: "settings" })} checked={settings.show.notifications} onChange={v => updateSettings({ show: { ...settings.show, notifications: v } })} />
          <ToggleRow label={t("appearance.show.breadcrumbs", { namespace: "settings" })} desc={t("appearance.show.breadcrumbsDesc", { namespace: "settings" })} checked={settings.show.breadcrumbs} onChange={v => updateSettings({ show: { ...settings.show, breadcrumbs: v } })} />
        </div>
      </SettingsSection>

      {/* ── Sidebar Overrides ── */}
      <SettingsSection title={t("appearance.sidebarOverridesTitle", { namespace: "settings" })} description={t("appearance.sidebarOverridesDescription", { namespace: "settings" })}>
        <div>
          <ToggleRow label={t("appearance.sidebarOverrides.collapsed", { namespace: "settings" })} desc={t("appearance.sidebarOverrides.collapsedDesc", { namespace: "settings" })} checked={navSettings.navCollapsed} onChange={v => updateNav('navCollapsed', v)} />
          <ToggleRow label={t("appearance.sidebarOverrides.groupHeaders", { namespace: "settings" })} desc={t("appearance.sidebarOverrides.groupHeadersDesc", { namespace: "settings" })} checked={navSettings.navShowSectionHeaders} onChange={v => updateNav('navShowSectionHeaders', v)} />
          <ToggleRow label={t("appearance.sidebarOverrides.icons", { namespace: "settings" })} desc={t("appearance.sidebarOverrides.iconsDesc", { namespace: "settings" })} checked={!navSettings.navIconOnly} onChange={v => updateNav('navIconOnly', !v)} />
        </div>

        <div className="mt-2 pt-2 border-t border-border">
          <span className="font-semibold text-[11px] text-foreground block mb-1.5">{t("appearance.sidebarBackground", { namespace: "settings" })}</span>
          <div className="flex flex-wrap gap-1">
            {[
              { id: 'bg-slate-900', label: t("appearance.sidebarBackgrounds.dark", { namespace: "settings" }), color: '#0f172a' },
              { id: 'bg-slate-950', label: t("appearance.sidebarBackgrounds.veryDark", { namespace: "settings" }), color: '#020617' },
              { id: 'bg-slate-800', label: t("appearance.sidebarBackgrounds.darkGray", { namespace: "settings" }), color: '#1e293b' },
              { id: 'bg-white', label: t("appearance.sidebarBackgrounds.white", { namespace: "settings" }), color: '#ffffff' },
              { id: 'bg-slate-50', label: t("appearance.sidebarBackgrounds.lightGray", { namespace: "settings" }), color: '#f8fafc' },
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
                      : "border-border text-muted-foreground hover:border-border/80 hover:bg-accent"
                  )}
                >
                  <span className="w-2.5 h-2.5 rounded-full border border-border shrink-0" style={{ backgroundColor: opt.color }} />
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
