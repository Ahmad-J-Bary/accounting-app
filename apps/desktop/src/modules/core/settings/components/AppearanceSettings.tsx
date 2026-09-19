import { useAppearance } from '@shared/hooks/useAppearance';
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
  Check, Monitor, Sun, Moon, RotateCcw, Sparkles, LayoutTemplate, PanelsTopLeft, MonitorCog,
} from 'lucide-react';
import { LayoutSettings } from './layout/LayoutSettings';
import { useLocalization } from "@app/providers/LocalizationProvider";
import { MOTION_LEVELS, WORKSPACE_PRESENTATIONS } from "@app/shell/workspacePresentationRegistry";

function PresentationPreview({ mode }: { mode: TabStyleMode }) {
  if (mode === "browser") {
    return (
      <div className="rounded-2xl border border-border/70 bg-background/90 p-2 shadow-sm">
        <div className="flex items-end gap-1 border-b border-border/60 pb-0">
          <div className="flex h-9 items-center rounded-t-xl border border-border/70 bg-background px-3 text-[10px] font-bold text-foreground">
            لوحة التحكم
          </div>
          <div className="flex h-8 items-center rounded-t-xl border border-transparent bg-muted/70 px-3 text-[10px] text-muted-foreground">
            اليومية
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">+</div>
          <div className="ms-auto flex gap-1 pb-1">
            <div className="h-7 w-7 rounded-md bg-muted" />
            <div className="h-7 w-7 rounded-md bg-muted" />
            <div className="h-7 w-7 rounded-md bg-destructive/20" />
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-border/60 bg-card px-2 py-2">
          <div className="h-8 w-8 rounded-lg bg-muted" />
          <div className="h-8 w-8 rounded-lg bg-muted" />
          <div className="h-9 flex-1 rounded-full border border-border/70 bg-background" />
          <div className="h-8 w-8 rounded-lg bg-warning/20" />
          <div className="h-8 w-8 rounded-lg bg-muted" />
        </div>
      </div>
    );
  }

  if (mode === "vscode") {
    return (
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-[#1f2430] text-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2 text-[10px]">
          <div className="h-6 w-24 rounded-md bg-white/10" />
          <div className="h-7 flex-1 rounded-md bg-white/10" />
          <div className="h-6 w-20 rounded-md bg-white/10" />
        </div>
        <div className="flex h-28">
          <div className="flex w-11 flex-col items-center gap-2 border-e border-white/10 bg-[#181c25] py-2">
            <div className="h-7 w-7 rounded-md bg-primary/70" />
            <div className="h-7 w-7 rounded-md bg-white/10" />
            <div className="h-7 w-7 rounded-md bg-white/10" />
          </div>
          <div className="w-40 border-e border-white/10 bg-[#252b39] p-2">
            <div className="mb-2 h-3 w-24 rounded bg-white/10" />
            <div className="space-y-1.5">
              <div className="h-7 rounded-md bg-white/10" />
              <div className="h-7 rounded-md bg-primary/20" />
              <div className="h-7 rounded-md bg-white/10" />
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex gap-px border-b border-white/10 bg-[#252b39] px-2 pt-1">
              <div className="h-8 w-28 rounded-t-md bg-[#1f2430]" />
              <div className="h-8 w-24 rounded-t-md bg-white/10" />
            </div>
            <div className="flex-1 bg-[#1f2430]" />
            <div className="h-8 border-t border-white/10 bg-[#181c25]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-3 shadow-sm">
      <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-background px-3 py-2">
        <div className="h-8 w-8 rounded-lg bg-primary/20" />
        <div className="h-4 w-24 rounded bg-muted" />
        <div className="ms-auto flex gap-2">
          <div className="h-8 w-8 rounded-lg bg-muted" />
          <div className="h-8 w-8 rounded-lg bg-muted" />
        </div>
      </div>
      <div className="mt-3 flex gap-3">
        <div className="w-24 rounded-xl bg-sidebar p-2">
          <div className="space-y-2">
            <div className="h-3 w-16 rounded bg-white/15" />
            <div className="h-7 rounded-md bg-primary/60" />
            <div className="h-7 rounded-md bg-white/10" />
            <div className="h-7 rounded-md bg-white/10" />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-2 h-9 rounded-xl border border-border/60 bg-background" />
          <div className="h-24 rounded-2xl border border-border/60 bg-background" />
        </div>
      </div>
    </div>
  );
}

function PresentationModeCard({
  mode,
  title,
  badge,
  description,
  active,
  onClick,
}: {
  mode: TabStyleMode;
  title: string;
  badge: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  const icon = mode === "browser" ? PanelsTopLeft : mode === "vscode" ? MonitorCog : LayoutTemplate;
  const Icon = icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex h-full flex-col gap-3 rounded-3xl border p-3 text-start transition-all",
        active
          ? "border-primary bg-primary/5 shadow-md"
          : "border-border bg-card hover:border-primary/40 hover:bg-accent/30",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className={cn(
            "flex h-10 w-10 items-center justify-center rounded-2xl",
            active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
          )}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <div className={cn("text-sm font-bold", active ? "text-primary" : "text-foreground")}>{title}</div>
            <div className="text-[11px] text-muted-foreground">{badge}</div>
          </div>
        </div>
        {active && (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
            <Check className="h-3.5 w-3.5" />
          </div>
        )}
      </div>
      <PresentationPreview mode={mode} />
      <p className="text-xs leading-5 text-muted-foreground">{description}</p>
    </button>
  );
}

function MotionLevelCard({
  label,
  description,
  active,
  onClick,
}: {
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-full flex-col gap-2 rounded-2xl border p-3 text-start transition-all",
        active ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-card hover:border-primary/30 hover:bg-accent/20",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className={cn("text-sm font-bold", active ? "text-primary" : "text-foreground")}>{label}</span>
        <Sparkles className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground")} />
      </div>
      <p className="text-[11px] leading-5 text-muted-foreground">{description}</p>
    </button>
  );
}

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
        <div className="space-y-4">
          <div>
            <span className="mb-2 block text-[11px] font-semibold text-foreground">
              {t("appearance.tabStyleCardsTitle", { namespace: "settings" })}
            </span>
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
              {WORKSPACE_PRESENTATIONS.map((presentation) => (
                <PresentationModeCard
                  key={presentation.id}
                  mode={presentation.id}
                  title={t(presentation.titleKey, { namespace: "settings" })}
                  badge={t(presentation.badgeKey, { namespace: "settings" })}
                  description={t(presentation.descriptionKey, { namespace: "settings" })}
                  active={settings.tabStyle === presentation.id}
                  onClick={() => updateSettings({ tabStyle: presentation.id })}
                />
              ))}
            </div>
          </div>

          <div>
            <span className="mb-2 block text-[11px] font-semibold text-foreground">
              {t("appearance.motionLabel", { namespace: "settings" })}
            </span>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {MOTION_LEVELS.map((level) => (
                <MotionLevelCard
                  key={level.id}
                  label={t(level.labelKey, { namespace: "settings" })}
                  description={t(level.descriptionKey, { namespace: "settings" })}
                  active={settings.motion === level.id}
                  onClick={() => updateSettings({ motion: level.id as MotionMode })}
                />
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 px-4 py-3 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{t("appearance.preview.currentMode", { namespace: "settings" })}: </span>
            {t(`appearance.tabStyles.${settings.tabStyle}`, { namespace: "settings" })} • {t(`appearance.motions.${settings.motion}`, { namespace: "settings" })}
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

    </div>
  );
}
