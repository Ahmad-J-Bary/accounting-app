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
      label: t("labels.exportExcel"),
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
      <SettingsGroup title="إعدادات رأس الصفحة" icon={LayoutTemplate}>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="space-y-2">
            <Label className="font-semibold text-muted-foreground">الـ preset</Label>
            <Select value={settings.preset} onValueChange={(value) => updatePageHeader({ preset: value as typeof settings.preset })}>
              <SelectTrigger className="h-10 rounded-lg border-muted">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">مضغوط / Slim</SelectItem>
                <SelectItem value="standard">قياسي</SelectItem>
                <SelectItem value="spacious">مريح / Spacious</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="font-semibold text-muted-foreground">النمط</Label>
            <Select value={settings.style} onValueChange={(value) => updatePageHeader({ style: value as typeof settings.style })}>
              <SelectTrigger className="h-10 rounded-lg border-muted">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">قياسي</SelectItem>
                <SelectItem value="slim">نحيف</SelectItem>
                <SelectItem value="wide">عريض</SelectItem>
                <SelectItem value="compact">مضغوط</SelectItem>
                <SelectItem value="elevated">مرتفع</SelectItem>
                <SelectItem value="flat">مسطح</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="font-semibold text-muted-foreground">الارتفاع</Label>
            <Select value={settings.height} onValueChange={(value) => updatePageHeader({ height: value as typeof settings.height })}>
              <SelectTrigger className="h-10 rounded-lg border-muted">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">مضغوط</SelectItem>
                <SelectItem value="standard">قياسي</SelectItem>
                <SelectItem value="spacious">مريح</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="font-semibold text-muted-foreground">الكثافة</Label>
            <Select value={settings.density} onValueChange={(value) => updatePageHeader({ density: value as typeof settings.density })}>
              <SelectTrigger className="h-10 rounded-lg border-muted">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">مضغوطة</SelectItem>
                <SelectItem value="standard">قياسية</SelectItem>
                <SelectItem value="spacious">مريحة</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="font-semibold text-muted-foreground">السطح</Label>
            <Select value={settings.surface} onValueChange={(value) => updatePageHeader({ surface: value as typeof settings.surface })}>
              <SelectTrigger className="h-10 rounded-lg border-muted">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="transparent">شفاف</SelectItem>
                <SelectItem value="background">خلفية الصفحة</SelectItem>
                <SelectItem value="surface">سطح/بطاقة</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="font-semibold text-muted-foreground">محاذاة الأكشنات</Label>
            <Select value={settings.actionAlignment} onValueChange={(value) => updatePageHeader({ actionAlignment: value as typeof settings.actionAlignment })}>
              <SelectTrigger className="h-10 rounded-lg border-muted">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="end">إلى النهاية</SelectItem>
                <SelectItem value="split">مقسمة مع المحتوى</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </SettingsGroup>

      <SettingsGroup title="سلوك ومحتوى الرأس" icon={SlidersHorizontal} color="text-cyan-600">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[
            { key: "showBreadcrumbs", label: "إظهار المسار" },
            { key: "showSubtitle", label: "إظهار الوصف الفرعي" },
            { key: "sticky", label: "تثبيت الرأس" },
            { key: "compactButtons", label: "أزرار أكثر إحكامًا" },
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

      <SettingsGroup title="المعاينة الحية" icon={Eye} color="text-violet-600">
        <div className="space-y-4 rounded-2xl border border-border bg-muted/20 p-3">
          <div className="overflow-hidden rounded-xl border border-border bg-background">
            <PageHeader
              title="اليومية العامة"
              subtitle="قيد العمليات اليومية مع فصل واضح بين سياق الصفحة وأدوات الجدول"
              breadcrumbs={[
                { label: "الرئيسية", to: "/dashboard" },
                { label: "المحاسبة العامة", to: "/accounting" },
                { label: "اليومية العامة" },
              ]}
              badge={<Badge variant="secondary">Posted</Badge>}
              context={
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-md border border-border bg-card px-2 py-1">من 2026-01-01</span>
                  <span className="rounded-md border border-border bg-card px-2 py-1">إلى 2026-12-31</span>
                </div>
              }
              actionItems={previewActions}
            />
          </div>

          <div className="rounded-xl border border-dashed border-border bg-card/70 p-3 text-xs text-muted-foreground">
            الصف الأول في كل صفحة تشغيلية يجب أن يحمل الهوية + سياق الصفحة + الأكشن الرئيسي فقط. أدوات الجدول والبحث والأعمدة والتصدير تبقى في صف البيانات الثاني.
          </div>
        </div>
      </SettingsGroup>

      <SettingsGroup title="صلة القالب" icon={Rows3} color="text-amber-600">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label className="font-semibold text-muted-foreground">الحواف الجانبية</Label>
            <Select
              value={preferences.pageTemplate.pageGutter}
              onValueChange={(value) => updatePageTemplate({ pageGutter: value as typeof preferences.pageTemplate.pageGutter })}
            >
              <SelectTrigger className="h-10 rounded-lg border-muted">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">قليلة</SelectItem>
                <SelectItem value="standard">قياسية</SelectItem>
                <SelectItem value="comfortable">مريحة</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="font-semibold text-muted-foreground">الفجوة بين المناطق</Label>
            <Select
              value={preferences.pageTemplate.regionGap}
              onValueChange={(value) => updatePageTemplate({ regionGap: value as typeof preferences.pageTemplate.regionGap })}
            >
              <SelectTrigger className="h-10 rounded-lg border-muted">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">قليلة</SelectItem>
                <SelectItem value="standard">قياسية</SelectItem>
                <SelectItem value="comfortable">مريحة</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="font-semibold text-muted-foreground">استدارة منطقة الجدول</Label>
            <Select
              value={preferences.pageTemplate.tableShellRadius}
              onValueChange={(value) => updatePageTemplate({ tableShellRadius: value as typeof preferences.pageTemplate.tableShellRadius })}
            >
              <SelectTrigger className="h-10 rounded-lg border-muted">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lg">خفيفة</SelectItem>
                <SelectItem value="xl">أكبر</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </SettingsGroup>
    </SettingsManagerLayout>
  );
}
