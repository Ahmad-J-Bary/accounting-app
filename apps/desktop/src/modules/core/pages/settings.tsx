import { useState, useEffect } from "react";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { Save, RefreshCw, Building, FileText, Settings as SettingsIcon, Globe, ShieldCheck, Mail, Phone, MapPin, DollarSign, Percent, CalendarDays } from "lucide-react";
import { settingsService } from '@modules/core/api/settingsService';
import type { CompanySettings, UpdateSettingsRequest } from "@erp/shared-types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { toast } from "sonner";
import { cn } from "@shared/lib/utils";

// Templates
import { SettingsLayout, SettingsSection } from "@widgets/templates/SettingsLayout";

export default function Settings() {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeNav, setActiveNav] = useState("company");

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

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const request: UpdateSettingsRequest = {
        company_name: settings.company_name,
        company_name_en: settings.company_name_en,
        tax_number: settings.tax_number,
        commercial_register: settings.commercial_register,
        address: settings.address,
        phone: settings.phone,
        email: settings.email,
        currency: settings.currency,
        currency_symbol: settings.currency_symbol,
        tax_rate: parseFloat(settings.tax_rate),
        invoice_prefix: settings.invoice_prefix,
        purchase_prefix: settings.purchase_prefix,
        journal_prefix: settings.journal_prefix,
        fiscal_year_start_month: settings.fiscal_year_start_month,
      };
      const updated = await settingsService.updateSettings(request);
      setSettings(updated);
      toast.success("تم تحديث إعدادات النظام بنجاح");
    } catch (e) {
      toast.error("فشل الحفظ: " + e);
    } finally {
      setSaving(false);
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
    { id: "financial", label: "الإعدادات المالية", icon: SettingsIcon },
    { id: "localization", label: "اللغة والمنطقة", icon: Globe },
    { id: "security", label: "الأمان والوصول", icon: ShieldCheck },
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
                "w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-black transition-all",
                activeNav === item.id 
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-100" 
                  : "text-slate-500 hover:bg-slate-100"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          ))}
        </nav>
      }
      actions={
        <Button 
          size="lg" 
          onClick={handleSave} 
          disabled={saving}
          className="bg-slate-900 hover:bg-slate-800 text-white px-8 rounded-2xl font-black h-14 shadow-xl shadow-slate-200"
        >
          {saving ? <RefreshCw className="w-5 h-5 ml-2 animate-spin" /> : <Save className="w-5 h-5 ml-2" />}
          {saving ? "جاري الحفظ..." : "حفظ الإعدادات"}
        </Button>
      }
    >
      {activeNav === "company" && (
        <SettingsSection title="الهوية الأساسية للشركة" description="هذه البيانات ستظهر في ترويسة الفواتير والتقارير الرسمية.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <Label className="font-black text-slate-700">اسم الشركة (عربي) *</Label>
              <div className="relative">
                <Building className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input className="pr-12 h-14 rounded-xl border-slate-200 focus:ring-blue-500" value={settings.company_name} onChange={e => handleChange("company_name", e.target.value)} />
              </div>
            </div>
            <div className="space-y-3">
              <Label className="font-black text-slate-700">Company Name (English)</Label>
              <div className="relative">
                <Globe className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input className="pr-12 h-14 rounded-xl border-slate-200 focus:ring-blue-500" dir="ltr" value={settings.company_name_en ?? ""} onChange={e => handleChange("company_name_en", e.target.value)} />
              </div>
            </div>
            <div className="space-y-3">
              <Label className="font-black text-slate-700">الرقم الضريبي</Label>
              <Input className="h-14 rounded-xl border-slate-200" value={settings.tax_number ?? ""} onChange={e => handleChange("tax_number", e.target.value)} />
            </div>
            <div className="space-y-3">
              <Label className="font-black text-slate-700">السجل التجاري</Label>
              <Input className="h-14 rounded-xl border-slate-200" value={settings.commercial_register ?? ""} onChange={e => handleChange("commercial_register", e.target.value)} />
            </div>
            <div className="space-y-3 md:col-span-2">
              <Label className="font-black text-slate-700">العنوان بالتفصيل</Label>
              <div className="relative">
                <MapPin className="absolute right-4 top-14 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input className="pr-12 h-14 rounded-xl border-slate-200" value={settings.address ?? ""} onChange={e => handleChange("address", e.target.value)} />
              </div>
            </div>
            <div className="space-y-3">
              <Label className="font-black text-slate-700">الهاتف المعتمد</Label>
              <div className="relative">
                <Phone className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input className="pr-12 h-14 rounded-xl border-slate-200 font-mono" dir="ltr" value={settings.phone ?? ""} onChange={e => handleChange("phone", e.target.value)} />
              </div>
            </div>
            <div className="space-y-3">
              <Label className="font-black text-slate-700">البريد الإلكتروني الرسمي</Label>
              <div className="relative">
                <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input className="pr-12 h-14 rounded-xl border-slate-200 font-mono" dir="ltr" value={settings.email ?? ""} onChange={e => handleChange("email", e.target.value)} />
              </div>
            </div>
          </div>
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

      {activeNav === "financial" && (
        <SettingsSection title="القواعد والخيارات المالية" description="إعداد العملة الأساسية، الضرائب، ودورة السنة المالية.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-6">
              <div className="space-y-3">
                <Label className="font-black text-slate-700 flex items-center gap-2"><DollarSign className="w-4 h-4 text-blue-600" /> العملة الأساسية</Label>
                <div className="grid grid-cols-2 gap-4">
                  <Input placeholder="الرمز (USD)" className="h-14 font-black text-center" value={settings.currency} onChange={e => handleChange("currency", e.target.value)} dir="ltr" />
                  <Input placeholder="الإشارة ($)" className="h-14 font-black text-center" value={settings.currency_symbol} onChange={e => handleChange("currency_symbol", e.target.value)} />
                </div>
              </div>
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
