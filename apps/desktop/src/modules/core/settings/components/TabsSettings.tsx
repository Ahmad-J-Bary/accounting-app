import { useAppearance } from '@shared/hooks/useAppearance';
import type { MotionMode, TabStyleMode } from '@shared/types/appearance';
import { SettingsSection } from '@widgets/templates/SettingsLayout';
import { cn } from '@shared/lib/utils';
import { Check, LayoutTemplate, MonitorCog, PanelsTopLeft, Sparkles } from 'lucide-react';
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

export function TabsSettings() {
  const { t, direction } = useLocalization();
  const { settings, updateSettings } = useAppearance();

  return (
    <div className="w-full space-y-3" dir={direction}>
      <SettingsSection
        title={t("appearance.tabsPageTitle", { namespace: "settings" })}
        description={t("appearance.tabsPageDescription", { namespace: "settings" })}
      >
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
    </div>
  );
}
