import { useState, useEffect } from "react";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, RefreshCw, Building, FileText, Settings as SettingsIcon } from "lucide-react";
import { settingsService } from "@/services/settingsService";
import type { CompanySettings, UpdateSettingsRequest } from "@erp/shared-types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try { setSettings(await settingsService.getSettings()); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleChange = (key: keyof CompanySettings, value: any) => {
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
      toast({ title: "تم الحفظ", description: "تم تحديث إعدادات النظام بنجاح" });
    } catch (e) {
      toast({ title: "خطأ", description: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-[50vh] text-muted-foreground"><RefreshCw className="animate-spin w-6 h-6 ml-2" /> جاري تحميل الإعدادات...</div>
  }

  if (!settings) return null;

  return (
    <>
      <PageHeader
        title="إعدادات النظام"
        subtitle="تخصيص الخيارات الأساسية، السلاسل الزمنية، وبيانات الشركة"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "الإعدادات" }]}
        actions={
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 ml-2" />
            {saving ? "جاري الحفظ..." : "حفظ التغييرات"}
          </Button>
        }
      />

      <Tabs defaultValue="company" className="w-full" dir="rtl">
        <TabsList className="mb-4">
          <TabsTrigger value="company" className="flex items-center gap-2"><Building className="w-4 h-4" />بيانات الشركة</TabsTrigger>
          <TabsTrigger value="prefixes" className="flex items-center gap-2"><FileText className="w-4 h-4" />الأرقام التسلسلية</TabsTrigger>
          <TabsTrigger value="financial" className="flex items-center gap-2"><SettingsIcon className="w-4 h-4" />إعدادات مالية</TabsTrigger>
        </TabsList>

        <TabsContent value="company">
          <Card>
            <CardHeader><CardTitle>بيانات الشركة الأساسية</CardTitle><CardDescription>تظهر هذه البيانات في فواتير وتقارير النظام</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>اسم الشركة (عربي) *</Label><Input value={settings.company_name} onChange={e => handleChange("company_name", e.target.value)} /></div>
                <div className="space-y-2"><Label>اسم الشركة (إنجليزي)</Label><Input value={settings.company_name_en ?? ""} onChange={e => handleChange("company_name_en", e.target.value)} dir="ltr" /></div>
                <div className="space-y-2"><Label>الرقم الضريبي</Label><Input value={settings.tax_number ?? ""} onChange={e => handleChange("tax_number", e.target.value)} /></div>
                <div className="space-y-2"><Label>السجل التجاري</Label><Input value={settings.commercial_register ?? ""} onChange={e => handleChange("commercial_register", e.target.value)} /></div>
                <div className="space-y-2 md:col-span-2"><Label>العنوان</Label><Input value={settings.address ?? ""} onChange={e => handleChange("address", e.target.value)} /></div>
                <div className="space-y-2"><Label>الهاتف</Label><Input value={settings.phone ?? ""} onChange={e => handleChange("phone", e.target.value)} dir="ltr" /></div>
                <div className="space-y-2"><Label>البريد الإلكتروني</Label><Input value={settings.email ?? ""} onChange={e => handleChange("email", e.target.value)} dir="ltr" /></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prefixes">
          <Card>
            <CardHeader><CardTitle>الأرقام التسلسلية للوثائق</CardTitle><CardDescription>تحديد البادئات المستخدمة عند إنشاء المستندات الجديدة تلقائياً</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2"><Label>بادئة فاتورة المبيعات</Label><Input value={settings.invoice_prefix} onChange={e => handleChange("invoice_prefix", e.target.value)} dir="ltr" /></div>
                <div className="space-y-2"><Label>بادئة فاتورة المشتريات</Label><Input value={settings.purchase_prefix} onChange={e => handleChange("purchase_prefix", e.target.value)} dir="ltr" /></div>
                <div className="space-y-2"><Label>بادئة قيود اليومية</Label><Input value={settings.journal_prefix} onChange={e => handleChange("journal_prefix", e.target.value)} dir="ltr" /></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financial">
          <Card>
            <CardHeader><CardTitle>الإعدادات المالية</CardTitle><CardDescription>العملة، الضرائب والسنة المالية</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>رمز العملة (مثل SAR, USD)</Label><Input value={settings.currency} onChange={e => handleChange("currency", e.target.value)} dir="ltr" /></div>
                <div className="space-y-2"><Label>إشارة العملة (مثل ر.س, $)</Label><Input value={settings.currency_symbol} onChange={e => handleChange("currency_symbol", e.target.value)} /></div>
                <div className="space-y-2"><Label>نسبة الضريبة الافتراضية (%)</Label><Input type="number" step="0.01" value={settings.tax_rate} onChange={e => handleChange("tax_rate", e.target.value)} /></div>
                <div className="space-y-2">
                  <Label>شهر بداية السنة المالية</Label>
                  <Select value={settings.fiscal_year_start_month.toString()} onValueChange={v => handleChange("fiscal_year_start_month", parseInt(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }).map((_, i) => (
                        <SelectItem key={i + 1} value={(i + 1).toString()}>شهر {i + 1}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
