import { useState, useEffect } from "react";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { Button } from "@shared/ui/button";
import { RefreshCw, Building, FileText, Settings as SettingsIcon, Globe, ShieldCheck, Mail, Phone, MapPin, DollarSign, Percent, CalendarDays, Table2, PanelRightOpen, Download, Info, ExternalLink, Palette, ChevronDown, ChevronUp } from "lucide-react";
import { settingsService } from '@modules/core/api/settingsService';
import type { CompanySettings } from "@erp/shared-types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { cn } from "@shared/lib/utils";

// Components
import { TableSettingsManager } from "../components/TableSettingsManager";
import { SidebarSettingsManager } from "../components/SidebarSettingsManager";
import CurrencySettings from "./currencySettings";
import { useUpdateChecker } from "../hooks/useUpdateChecker";
import pkg from "../../../../package.json";

// Templates
import { SettingsLayout, SettingsSection } from "@widgets/templates/SettingsLayout";

export default function Settings() {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeNav, setActiveNav] = useState("company");
  const [appearanceExpanded, setAppearanceExpanded] = useState(false);
  const {
    updateInfo,
    loading: updateLoading,
    isUpdating,
    updateProgress,
    error: updateError,
    check: handleCheckUpdate,
    installUpdate,
  } = useUpdateChecker();

  const load = async () => {
    setLoading(true);
    try { setSettings(await settingsService.getSettings()); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleChange = (key: keyof CompanySettings, value: string | number | boolean) => {
    if (settings) {
      setSettings({ ...settings, [key]: value });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] space-y-4">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="font-black text-slate-400">جاري تحميل الإعدادات...</p>
      </div>
    );
  }

  if (!settings) return null;

  const sidebarItems = [
    { id: "company", label: "بيانات الشركة", icon: Building },
    { id: "prefixes", label: "الأرقام التسلسلية", icon: FileText },
    { id: "currencies", label: "إدارة العملات", icon: DollarSign },
    { id: "financial", label: "الإعدادات المالية", icon: SettingsIcon },
    { id: "localization", label: "اللغة والمنطقة", icon: Globe },
    { id: "security", label: "الأمان والوصول", icon: ShieldCheck },
    { id: "about", label: "حول التطبيق", icon: Info },
  ];

  const appearanceItems = [
    { id: "tables", label: "مظهر الجداول", icon: Table2 },
    { id: "sidebar", label: "مظهر السايد بار", icon: PanelRightOpen },
  ];

  return (
    <SettingsLayout
      title="إعدادات النظام"
      description="تخصيص الخيارات الأساسية، الهوية البصرية، والقواعد المحاسبية للمنشأة."
      sidebar={
        <nav className="space-y-2">
          {sidebarItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveNav(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all",
                activeNav === item.id
                  ? "bg-blue-600 text-white shadow-md shadow-blue-100"
                  : "text-slate-500 hover:bg-slate-100"
              )}
            >
              <item.icon className="w-4.5 h-4.5" />
              {item.label}
            </button>
          ))}
          
          {/* Appearance Category */}
          <div className="space-y-1">
            <button
              onClick={() => setAppearanceExpanded(!appearanceExpanded)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl font-bold transition-all text-slate-500 hover:bg-slate-100"
            >
              <div className="flex items-center gap-3">
                <Palette className="w-4.5 h-4.5" />
                <span>المظهر</span>
              </div>
              {appearanceExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            
            {appearanceExpanded && (
              <div className="mr-6 space-y-1">
                {appearanceItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => setActiveNav(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-all",
                      activeNav === item.id
                        ? "bg-blue-600 text-white shadow-md shadow-blue-100"
                        : "text-slate-500 hover:bg-slate-100"
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </nav>
      }
    >
      {activeNav === "company" && (
        <SettingsSection title="الهوية الأساسية للشركة" description="هذه البيانات ستظهر في ترويسة الفواتير والتقارير الرسمية.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="font-bold text-slate-700">اسم الشركة (عربي) *</Label>
              <div className="relative">
                <Building className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                <Input className="pr-11 h-12 rounded-lg border-slate-200 focus:ring-blue-500" value={settings.company_name} onChange={e => handleChange("company_name", e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-slate-700">Company Name (English)</Label>
              <div className="relative">
                <Globe className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                <Input className="pr-11 h-12 rounded-lg border-slate-200 focus:ring-blue-500" dir="ltr" value={settings.company_name_en ?? ""} onChange={e => handleChange("company_name_en", e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-slate-700">الرقم الضريبي</Label>
              <Input className="h-12 rounded-lg border-slate-200" value={settings.tax_number ?? ""} onChange={e => handleChange("tax_number", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-slate-700">السجل التجاري</Label>
              <Input className="h-12 rounded-lg border-slate-200" value={settings.commercial_register ?? ""} onChange={e => handleChange("commercial_register", e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label className="font-bold text-slate-700">العنوان بالتفصيل</Label>
              <div className="relative">
                <MapPin className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                <Input className="pr-11 h-12 rounded-lg border-slate-200" value={settings.address ?? ""} onChange={e => handleChange("address", e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-slate-700">الهاتف المعتمد</Label>
              <div className="relative">
                <Phone className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                <Input className="pr-11 h-12 rounded-lg border-slate-200 font-mono" dir="ltr" value={settings.phone ?? ""} onChange={e => handleChange("phone", e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-slate-700">البريد الإلكتروني الرسمي</Label>
              <div className="relative">
                <Mail className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                <Input className="pr-11 h-12 rounded-lg border-slate-200 font-mono" dir="ltr" value={settings.email ?? ""} onChange={e => handleChange("email", e.target.value)} />
              </div>
            </div>
          </div>
        </SettingsSection>
      )}

      {activeNav === "tables" && (
        <SettingsSection 
          title="تخصيص مظهر الجداول" 
          description="تحكم في كيفية عرض البيانات في جميع أقسام النظام بما يتناسب مع احتياجاتك."
        >
          <TableSettingsManager />
        </SettingsSection>
      )}

      {activeNav === "sidebar" && (
        <SettingsSection
          title="تخصيص مظهر السايد بار"
          description="تحكم في عرض وكثافة الألواح الجانبية في جميع أقسام النظام."
        >
          <SidebarSettingsManager />
        </SettingsSection>
      )}

      {activeNav === "prefixes" && (
        <SettingsSection title="تخصيص تسلسل الوثائق" description="حدد البادئات التي يستخدمها النظام لتوليد الأرقام التسلسلية للفواتير والقيود.">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-3 p-6 rounded-2xl bg-slate-50 border border-slate-100">
              <Label className="font-black text-slate-700">مبيعات</Label>
              <Input className="h-12 rounded-lg font-mono font-bold text-center" value={settings.invoice_prefix} onChange={e => handleChange("invoice_prefix", e.target.value)} dir="ltr" />
              <p className="text-[10px] text-slate-400 font-bold text-center">مثال: {settings.invoice_prefix}0001</p>
            </div>
            <div className="space-y-3 p-6 rounded-2xl bg-slate-50 border border-slate-100">
              <Label className="font-black text-slate-700">مشتريات</Label>
              <Input className="h-12 rounded-lg font-mono font-bold text-center" value={settings.purchase_prefix} onChange={e => handleChange("purchase_prefix", e.target.value)} dir="ltr" />
              <p className="text-[10px] text-slate-400 font-bold text-center">مثال: {settings.purchase_prefix}0001</p>
            </div>
            <div className="space-y-3 p-6 rounded-2xl bg-slate-50 border border-slate-100">
              <Label className="font-black text-slate-700">قيود يومية</Label>
              <Input className="h-12 rounded-lg font-mono font-bold text-center" value={settings.journal_prefix} onChange={e => handleChange("journal_prefix", e.target.value)} dir="ltr" />
              <p className="text-[10px] text-slate-400 font-bold text-center">مثال: {settings.journal_prefix}0001</p>
            </div>
          </div>
        </SettingsSection>
      )}

      {activeNav === "currencies" && (
        <SettingsSection title="إدارة العملات" description="إضافة، تعديل، وحذف العملات — وإدارة أسعار الصرف.">
          <CurrencySettings />
        </SettingsSection>
      )}

      {activeNav === "financial" && (
        <SettingsSection title="القواعد والخيارات المالية" description="الضريبة ودورة السنة المالية.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-6">
              <div className="space-y-3">
                <Label className="font-black text-slate-700 flex items-center gap-2"><Percent className="w-4 h-4 text-rose-600" /> ضريبة القيمة المضافة الافتراضية</Label>
                <div className="relative">
                  <Input type="number" step="0.01" className="h-14 font-black pr-6 pl-14" value={settings.tax_rate} onChange={e => handleChange("tax_rate", e.target.value)} />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400">%</span>
                </div>
              </div>
            </div>
            <div className="space-y-6">
               <div className="space-y-3">
                <Label className="font-black text-slate-700 flex items-center gap-2"><CalendarDays className="w-4 h-4 text-indigo-600" /> شهر بداية السنة المالية</Label>
                <Select value={settings.fiscal_year_start_month.toString()} onValueChange={v => handleChange("fiscal_year_start_month", parseInt(v))}>
                  <SelectTrigger className="h-14 rounded-xl border-slate-200 font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }).map((_, i) => (
                      <SelectItem key={i + 1} value={(i + 1).toString()} className="font-bold">الشهر {(i + 1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-400 font-medium italic">يستخدم هذا التاريخ لحساب إغلاق الحسابات وتوليد الميزانية الافتتاحية.</p>
              </div>
            </div>
          </div>
        </SettingsSection>
      )}

      {activeNav === "about" && (
        <SettingsSection title="حول التطبيق" description="معلومات الإصدار والتحقق من التحديثات.">
          <div className="space-y-6">
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center">
                  <Info className="w-8 h-8 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800">المواكب</h3>
                  <p className="text-sm text-slate-500">نظام إدارة المنشآت</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <span className="text-slate-400 font-medium">الإصدار الحالي</span>
                  <p className="font-black text-slate-800 font-mono" dir="ltr">{pkg.version}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-400 font-medium">آخر إصدار متاح</span>
                  <p className="font-black text-slate-800 font-mono" dir="ltr">
                    {updateInfo?.latest_version === "فشل الاتصال" ? "—" : (updateInfo?.latest_version || "—")}
                  </p>
                </div>
              </div>

              {updateError && (
                <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-xl p-3.5 font-bold">
                  خطأ في التحديث: {updateError}
                </div>
              )}

              {!isUpdating && (
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-10 text-sm font-bold gap-2"
                  onClick={handleCheckUpdate}
                  disabled={updateLoading}
                >
                  {updateLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  {updateLoading ? "جاري التحقق..." : "التحقق من وجود تحديث"}
                </Button>
              )}

              {isUpdating && (
                <div className="space-y-2.5 bg-blue-50/50 border border-blue-100 rounded-xl p-4">
                  <div className="flex justify-between text-xs font-bold text-blue-600">
                    <span className="flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      جاري تنزيل وتثبيت التحديث...
                    </span>
                    <span>
                      {updateProgress && updateProgress.total > 0
                        ? `${Math.round((updateProgress.downloaded / updateProgress.total) * 100)}%`
                        : "..."}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-blue-600 h-full transition-all duration-300 rounded-full"
                      style={{
                        width:
                          updateProgress && updateProgress.total > 0
                            ? `${(updateProgress.downloaded / updateProgress.total) * 100}%`
                            : "0%",
                      }}
                    />
                  </div>
                  {updateProgress && updateProgress.total > 0 && (
                    <div className="text-[10px] text-slate-400 font-mono text-left" dir="ltr">
                      {(updateProgress.downloaded / (1024 * 1024)).toFixed(2)} MB / {(updateProgress.total / (1024 * 1024)).toFixed(2)} MB
                    </div>
                  )}
                </div>
              )}

              {updateInfo && updateInfo.has_update && !isUpdating && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-bold text-green-800 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    يتوفر تحديث جديد! ({updateInfo.latest_version})
                  </p>
                  {updateInfo.release_body && (
                    <div className="text-xs text-green-700 bg-white rounded-lg p-3 max-h-32 overflow-y-auto whitespace-pre-wrap font-mono">
                      {updateInfo.release_body}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white rounded-xl h-9 text-xs font-bold gap-1.5"
                      onClick={installUpdate}
                    >
                      <Download className="w-3.5 h-3.5" />
                      تحديث الآن
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl h-9 text-xs text-slate-500"
                      onClick={() => window.open("https://github.com/Ahmad-J-Bary/accounting-app/releases", "_blank")}
                    >
                      كل الإصدارات
                    </Button>
                  </div>
                </div>
              )}

              {updateInfo && !updateInfo.has_update && !isUpdating && updateInfo.latest_version !== "فشل الاتصال" && (
                <div className="bg-slate-100 rounded-xl p-4">
                  <p className="text-sm font-bold text-slate-600">أنت تستخدم أحدث إصدار ✅</p>
                </div>
              )}
            </div>
          </div>
        </SettingsSection>
      )}

      {["localization", "security"].includes(activeNav) && (
        <div className="flex flex-col items-center justify-center p-20 bg-slate-50/50 rounded-[2rem] border border-dashed border-slate-200 text-slate-400 text-center space-y-4">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
            <RefreshCw className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="font-black text-slate-600">هذا القسم قيد التطوير</h3>
            <p className="text-sm font-medium">سيتم توفير خيارات إضافية في التحديثات القادمة.</p>
          </div>
        </div>
      )}
    </SettingsLayout>
  );
}
