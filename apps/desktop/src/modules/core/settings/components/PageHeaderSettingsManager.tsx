import { Eye, LayoutTemplate, Rows3, SlidersHorizontal } from "lucide-react";
import { Label } from "@shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { Switch } from "@shared/ui/switch";
import { Badge } from "@shared/ui/badge";
import { useUiPreferences } from "@shared/hooks/useUiPreferences";
import { SettingsGroup, SettingsManagerLayout } from "@widgets/templates/SettingsManagerLayout";
import { PageHeader } from "@widgets/templates/PageHeader";
import { useLocalization } from "@app/providers/LocalizationProvider";

export function PageHeaderSettingsManager() {
  const { preferences, updatePageHeader, updatePageTemplate, resetPageHeader, resetPageTemplate } = useUiPreferences();
  const { t } = useLocalization();
  const settings = preferences.pageHeader;

  const previewActions = [
    {
      id: "preview-create",
      label: t("actions.add", { namespace: "common" }),
      priority: "primary" as const,
    },
    {
      id: "preview-export",
      label: t("labels.exportExcel", { namespace: "common" }),
      priority: "secondary" as const,
    },
    {
      id: "preview-more",
      label: t("actions.more", { namespace: "common" }),
      priority: "tertiary" as const,
    },
  ];

  return (
    <SettingsManagerLayout resetAction={() => {
      resetPageHeader();
      resetPageTemplate();
    }}>
      <SettingsGroup title={t("pageHeader.title", { namespace: "settings" })} icon={LayoutTemplate}>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="space-y-2">
            <Label className="font-semibold text-muted-foreground">{t("pageHeader.preset", { namespace: "settings" })}</Label>
            <Select value={settings.preset} onValueChange={(value) => updatePageHeader({ preset: value as typeof settings.preset })}>
              <SelectTrigger className="h-10 rounded-lg border-muted">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">{t("pageHeader.presets.compact", { namespace: "settings" })}</SelectItem>
                <SelectItem value="standard">{t("pageHeader.presets.standard", { namespace: "settings" })}</SelectItem>
                <SelectItem value="spacious">{t("pageHeader.presets.spacious", { namespace: "settings" })}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="font-semibold text-muted-foreground">{t("pageHeader.style", { namespace: "settings" })}</Label>
            <Select value={settings.style} onValueChange={(value) => updatePageHeader({ style: value as typeof settings.style })}>
              <SelectTrigger className="h-10 rounded-lg border-muted">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">{t("pageHeader.styles.standard", { namespace: "settings" })}</SelectItem>
                <SelectItem value="slim">{t("pageHeader.styles.slim", { namespace: "settings" })}</SelectItem>
                <SelectItem value="wide">{t("pageHeader.styles.wide", { namespace: "settings" })}</SelectItem>
                <SelectItem value="compact">{t("pageHeader.styles.compact", { namespace: "settings" })}</SelectItem>
                <SelectItem value="elevated">{t("pageHeader.styles.elevated", { namespace: "settings" })}</SelectItem>
                <SelectItem value="flat">{t("pageHeader.styles.flat", { namespace: "settings" })}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="font-semibold text-muted-foreground">{t("pageHeader.height", { namespace: "settings" })}</Label>
            <Select value={settings.height} onValueChange={(value) => updatePageHeader({ height: value as typeof settings.height })}>
              <SelectTrigger className="h-10 rounded-lg border-muted">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">{t("pageHeader.heights.compact", { namespace: "settings" })}</SelectItem>
                <SelectItem value="standard">{t("pageHeader.heights.standard", { namespace: "settings" })}</SelectItem>
                <SelectItem value="spacious">{t("pageHeader.heights.spacious", { namespace: "settings" })}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="font-semibold text-muted-foreground">{t("pageHeader.density", { namespace: "settings" })}</Label>
            <Select value={settings.density} onValueChange={(value) => updatePageHeader({ density: value as typeof settings.density })}>
              <SelectTrigger className="h-10 rounded-lg border-muted">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">{t("pageHeader.densities.compact", { namespace: "settings" })}</SelectItem>
                <SelectItem value="standard">{t("pageHeader.densities.standard", { namespace: "settings" })}</SelectItem>
                <SelectItem value="spacious">{t("pageHeader.densities.spacious", { namespace: "settings" })}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="font-semibold text-muted-foreground">{t("pageHeader.surface", { namespace: "settings" })}</Label>
            <Select value={settings.surface} onValueChange={(value) => updatePageHeader({ surface: value as typeof settings.surface })}>
              <SelectTrigger className="h-10 rounded-lg border-muted">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="transparent">{t("pageHeader.surfaces.transparent", { namespace: "settings" })}</SelectItem>
                <SelectItem value="background">{t("pageHeader.surfaces.background", { namespace: "settings" })}</SelectItem>
                <SelectItem value="surface">{t("pageHeader.surfaces.surface", { namespace: "settings" })}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="font-semibold text-muted-foreground">{t("pageHeader.actionAlignment", { namespace: "settings" })}</Label>
            <Select value={settings.actionAlignment} onValueChange={(value) => updatePageHeader({ actionAlignment: value as typeof settings.actionAlignment })}>
              <SelectTrigger className="h-10 rounded-lg border-muted">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="end">{t("pageHeader.alignments.end", { namespace: "settings" })}</SelectItem>
                <SelectItem value="split">{t("pageHeader.alignments.split", { namespace: "settings" })}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </SettingsGroup>

      <SettingsGroup title={t("pageHeader.behaviorTitle", { namespace: "settings" })} icon={SlidersHorizontal} color="text-cyan-600">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[
            { key: "showBreadcrumbs", label: t("pageHeader.behavior.showBreadcrumbs", { namespace: "settings" }) },
            { key: "showSubtitle", label: t("pageHeader.behavior.showSubtitle", { namespace: "settings" }) },
            { key: "sticky", label: t("pageHeader.behavior.sticky", { namespace: "settings" }) },
            { key: "compactButtons", label: t("pageHeader.behavior.compactButtons", { namespace: "settings" }) },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between rounded-xl border border-muted bg-muted/30 p-3">
              <Label className="font-semibold text-foreground">{item.label}</Label>
              <Switch
                checked={Boolean(settings[item.key as keyof typeof settings])}
                onCheckedChange={(value) => updatePageHeader({ [item.key]: value } as Partial<typeof settings>)}
              />
            </div>
          ))}
        </div>
      </SettingsGroup>

      <SettingsGroup title={t("pageHeader.livePreviewTitle", { namespace: "settings" })} icon={Eye} color="text-violet-600">
        <div className="space-y-4 rounded-2xl border border-border bg-muted/20 p-3">
          <div className="overflow-hidden rounded-xl border border-border bg-background">
            <PageHeader
              title={t("pageHeader.preview.title", { namespace: "settings" })}
              subtitle={t("pageHeader.preview.subtitle", { namespace: "settings" })}
              breadcrumbs={[
                { label: t("pageHeader.preview.home", { namespace: "settings" }), to: "/dashboard" },
                { label: t("pageHeader.preview.accounting", { namespace: "settings" }), to: "/accounting" },
                { label: t("pageHeader.preview.journal", { namespace: "settings" }) },
              ]}
              badge={<Badge variant="secondary">{t("status.posted", { namespace: "common" })}</Badge>}
              context={
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-md border border-border bg-card px-2 py-1">{t("pageHeader.preview.from", { namespace: "settings" })}</span>
                  <span className="rounded-md border border-border bg-card px-2 py-1">{t("pageHeader.preview.to", { namespace: "settings" })}</span>
                </div>
              }
              actionItems={previewActions}
            />
          </div>

          <div className="rounded-xl border border-dashed border-border bg-card/70 p-3 text-xs text-muted-foreground">
            {t("pageHeader.note", { namespace: "settings" })}
          </div>
        </div>
      </SettingsGroup>

      <SettingsGroup title={t("pageHeader.templateLinkTitle", { namespace: "settings" })} icon={Rows3} color="text-amber-600">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label className="font-semibold text-muted-foreground">{t("pageHeader.template.pageGutter", { namespace: "settings" })}</Label>
            <Select
              value={preferences.pageTemplate.pageGutter}
              onValueChange={(value) => updatePageTemplate({ pageGutter: value as typeof preferences.pageTemplate.pageGutter })}
            >
              <SelectTrigger className="h-10 rounded-lg border-muted">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">{t("pageHeader.template.gutters.compact", { namespace: "settings" })}</SelectItem>
                <SelectItem value="standard">{t("pageHeader.template.gutters.standard", { namespace: "settings" })}</SelectItem>
                <SelectItem value="comfortable">{t("pageHeader.template.gutters.comfortable", { namespace: "settings" })}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="font-semibold text-muted-foreground">{t("pageHeader.template.regionGap", { namespace: "settings" })}</Label>
            <Select
              value={preferences.pageTemplate.regionGap}
              onValueChange={(value) => updatePageTemplate({ regionGap: value as typeof preferences.pageTemplate.regionGap })}
            >
              <SelectTrigger className="h-10 rounded-lg border-muted">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">{t("pageHeader.template.gaps.compact", { namespace: "settings" })}</SelectItem>
                <SelectItem value="standard">{t("pageHeader.template.gaps.standard", { namespace: "settings" })}</SelectItem>
                <SelectItem value="comfortable">{t("pageHeader.template.gaps.comfortable", { namespace: "settings" })}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="font-semibold text-muted-foreground">{t("pageHeader.template.tableShellRadius", { namespace: "settings" })}</Label>
            <Select
              value={preferences.pageTemplate.tableShellRadius}
              onValueChange={(value) => updatePageTemplate({ tableShellRadius: value as typeof preferences.pageTemplate.tableShellRadius })}
            >
              <SelectTrigger className="h-10 rounded-lg border-muted">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lg">{t("pageHeader.template.radii.lg", { namespace: "settings" })}</SelectItem>
                <SelectItem value="xl">{t("pageHeader.template.radii.xl", { namespace: "settings" })}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </SettingsGroup>
    </SettingsManagerLayout>
  );
}
