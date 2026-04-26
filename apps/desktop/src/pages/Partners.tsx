import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Users, Trash2, RefreshCw, Calculator, TrendingUp, DollarSign, PieChart as PieChartIcon, Settings2, Edit } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { invoke } from "@tauri-apps/api/core";
import { formatCurrency } from "@/lib/format";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

interface PartnerDto {
  id: number;
  name: string;
  exchange_rate: string;
  amount_local: string;
  amount_usd: string;
  is_amount_in_usd: boolean;
  profit_sharing_ratio: string | null;
  profit_sharing_type: string;
  linked_account_id: string | null;
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"];

export default function Partners() {
  const [partners, setPartners] = useState<PartnerDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingPartnerId, setEditingPartnerId] = useState<number | null>(null);
  const [globalStrategy, setGlobalStrategy] = useState("BasedOnCapitalLocal");
  const [formData, setFormData] = useState({
    name: "",
    exchangeRate: "500", 
    amount: "0",
    isAmountInUsd: false,
    manualRatio: "",
  });

  const fetchPartners = async () => {
    setLoading(true);
    try {
      const data = await invoke<PartnerDto[]>("list_partners");
      setPartners(data);
    } catch (error) {
      toast.error("فشل جلب قائمة الشركاء: " + error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPartners();
  }, []);

  const handleSave = async () => {
    try {
      if (isEditMode && editingPartnerId) {
        await invoke("update_partner", {
          id: editingPartnerId,
          name: formData.name,
          exchangeRate: formData.exchangeRate,
          amount: formData.amount,
          isAmountInUsd: formData.isAmountInUsd,
          sharingType: "BasedOnCapitalLocal", 
          manualRatio: formData.manualRatio || null,
        });
        toast.success("تم تحديث بيانات الشريك بنجاح");
      } else {
        await invoke("add_partner", {
          name: formData.name,
          exchangeRate: formData.exchangeRate,
          amount: formData.amount,
          isAmountInUsd: formData.isAmountInUsd,
          sharingType: "BasedOnCapitalLocal", 
          manualRatio: formData.manualRatio || null,
        });
        toast.success("تم إضافة الشريك ورأس المال بنجاح");
      }
      setIsDialogOpen(false);
      fetchPartners();
      resetForm();
    } catch (error) {
      toast.error(isEditMode ? "فشل تحديث الشريك: " : "فشل إضافة الشريك: " + error);
    }
  };

  const handleEdit = (partner: PartnerDto) => {
    setIsEditMode(true);
    setEditingPartnerId(partner.id);
    setFormData({
      name: partner.name,
      exchangeRate: partner.exchange_rate,
      amount: partner.is_amount_in_usd ? partner.amount_usd : partner.amount_local,
      isAmountInUsd: partner.is_amount_in_usd,
      manualRatio: partner.profit_sharing_ratio || "",
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setIsEditMode(false);
    setEditingPartnerId(null);
    setFormData({
      name: "",
      exchangeRate: "500",
      amount: "0",
      isAmountInUsd: false,
      manualRatio: "",
    });
  };

  const handleDelete = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذا الشريك؟")) return;
    try {
      await invoke("delete_partner", { id });
      toast.success("تم حذف الشريك بنجاح");
      fetchPartners();
    } catch (error) {
      toast.error("فشل حذف الشريك: " + error);
    }
  };

  const totals = useMemo(() => {
    const local = partners.reduce((sum, p) => sum + parseFloat(p.amount_local), 0);
    const usd = partners.reduce((sum, p) => sum + parseFloat(p.amount_usd), 0);
    return { local, usd };
  }, [partners]);

  const partnersWithRatios = useMemo(() => {
    return partners.map(p => {
      let ratio = 0;
      if (globalStrategy === "Manual") {
        ratio = parseFloat(p.profit_sharing_ratio || "0");
      } else if (globalStrategy === "BasedOnCapitalLocal" && totals.local > 0) {
        ratio = (parseFloat(p.amount_local) / totals.local) * 100;
      } else if (globalStrategy === "BasedOnCapitalUSD" && totals.usd > 0) {
        ratio = (parseFloat(p.amount_usd) / totals.usd) * 100;
      }
      return { ...p, calculatedRatio: ratio };
    });
  }, [partners, totals, globalStrategy]);

  const capitalChartData = partners.map(p => ({
    name: p.name,
    value: parseFloat(p.amount_local)
  }));

  const profitChartData = partnersWithRatios.map(p => ({
    name: p.name,
    value: p.calculatedRatio
  }));

  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader
        title="الشركاء ورأس المال"
        subtitle="إدارة الشركاء، حصص رأس المال، وتوزيع الأرباح"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "المحاسبة" }, { label: "الشركاء" }]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchPartners} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ml-2 ${loading ? "animate-spin" : ""}`} />تحديث
            </Button>
            <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
              <Plus className="w-4 h-4 ml-2" />إضافة شريك جديد
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center gap-4 border-r-4 border-r-primary shadow-sm hover:shadow-md transition-shadow">
          <div className="p-3 bg-primary/10 rounded-full text-primary"><Calculator className="w-6 h-6" /></div>
          <div>
            <div className="text-xs text-muted-foreground">إجمالي رأس المال</div>
            <div className="text-xl font-bold tabular-nums text-primary">{formatCurrency(totals.local)}</div>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4 border-r-4 border-r-blue-500 shadow-sm">
          <div className="p-3 bg-blue-500/10 rounded-full text-blue-500"><Users className="w-6 h-6" /></div>
          <div>
            <div className="text-xs text-muted-foreground">عدد الشركاء</div>
            <div className="text-xl font-bold tabular-nums text-blue-600">{partners.length}</div>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4 border-r-4 border-r-green-500 shadow-sm">
          <div className="p-3 bg-green-500/10 rounded-full text-green-500"><DollarSign className="w-6 h-6" /></div>
          <div>
            <div className="text-xs text-muted-foreground">رأس المال بالدولار</div>
            <div className="text-xl font-bold tabular-nums text-green-600">{formatCurrency(totals.usd, "")} $</div>
          </div>
        </Card>
      </div>

      <Card className="p-5 bg-slate-50/80 border-dashed border-2 shadow-inner">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-bold text-sm">طريقة عرض وحساب توزيع الأرباح:</h3>
          </div>
          
          <RadioGroup 
            value={globalStrategy} 
            onValueChange={setGlobalStrategy}
            className="flex flex-col md:flex-row gap-3 md:gap-6"
          >
            <div className="flex items-center space-x-2 space-x-reverse bg-white px-3 py-2 rounded-full border shadow-sm hover:border-primary transition-colors cursor-pointer">
              <RadioGroupItem value="BasedOnCapitalLocal" id="g1" />
              <Label htmlFor="g1" className="cursor-pointer text-xs font-medium">بناءً على رأس المال (محلي)</Label>
            </div>
            <div className="flex items-center space-x-2 space-x-reverse bg-white px-3 py-2 rounded-full border shadow-sm hover:border-primary transition-colors cursor-pointer">
              <RadioGroupItem value="BasedOnCapitalUSD" id="g2" />
              <Label htmlFor="g2" className="cursor-pointer text-xs font-medium">بناءً على رأس المال (بالدولار)</Label>
            </div>
            <div className="flex items-center space-x-2 space-x-reverse bg-white px-3 py-2 rounded-full border shadow-sm hover:border-primary transition-colors cursor-pointer">
              <RadioGroupItem value="Manual" id="g3" />
              <Label htmlFor="g3" className="cursor-pointer text-xs font-medium">توزيع يدوي (بحسب النسب المحددة)</Label>
            </div>
          </RadioGroup>
        </div>
      </Card>

      {partners.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4 border-b pb-2">
              <PieChartIcon className="w-4 h-4 text-primary" />
              <h3 className="font-bold text-sm">حصص رأس المال</h3>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={capitalChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {capitalChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4 border-b pb-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <h3 className="font-bold text-sm">توزيع الأرباح (حسب الإعداد الحالي)</h3>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={profitChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {profitChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${value.toFixed(2)}%`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      <Card className="overflow-hidden border-2 border-slate-100">
        <div className="border border-border rounded-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-border">
              <tr>
                <th className="text-right px-4 py-3 font-bold text-slate-700">اسم الشريك</th>
                <th className="text-left px-4 py-3 font-bold text-slate-700">رأس المال (محلي)</th>
                <th className="text-left px-4 py-3 font-bold text-slate-700">رأس المال ($)</th>
                <th className="text-left px-4 py-3 font-bold text-green-700">نسبة الأرباح الحالية</th>
                <th className="w-12 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">جاري التحميل...</td></tr>
              ) : partners.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10 text-muted-foreground italic">لا يوجد شركاء مضافين حالياً</td></tr>
              ) : (
                partnersWithRatios.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-bold text-slate-800">{p.name}</td>
                    <td className="px-4 py-3 text-left tabular-nums font-medium text-slate-600">{formatCurrency(parseFloat(p.amount_local))}</td>
                    <td className="px-4 py-3 text-left tabular-nums text-blue-600 font-medium">{formatCurrency(parseFloat(p.amount_usd), "")} $</td>
                    <td className="px-4 py-3 text-left tabular-nums text-green-600 font-extrabold text-base">
                      {p.calculatedRatio.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 text-left">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="text-blue-600 hover:bg-blue-100 h-8 w-8" onClick={() => handleEdit(p)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 h-8 w-8" onClick={() => handleDelete(p.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if(!open) resetForm(); }}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">{isEditMode ? "تعديل بيانات الشريك" : "إضافة شريك جديد"}</DialogTitle>
            <DialogDescription className="text-right">
              {isEditMode ? "قم بتعديل المعلومات المطلوبة للشريك المختار." : "أدخل بيانات الشريك وحصة رأس المال الابتدائي."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="name" className="block text-right">اسم الشريك</Label>
              <Input 
                id="name" 
                placeholder="مثال: أحمد محمد" 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
                className="text-right"
              />
            </div>

            <div className="space-y-4 border p-4 rounded-lg bg-slate-50/50">
              <div className="flex items-center justify-between">
                <Label className="cursor-pointer font-bold">المبلغ المشارك به</Label>
                <div className="flex items-center gap-2">
                  <Label htmlFor="isUsd" className="text-xs cursor-pointer text-muted-foreground">ادخل المبلغ بالدولار</Label>
                  <Checkbox 
                    id="isUsd" 
                    checked={formData.isAmountInUsd} 
                    onCheckedChange={(checked) => setFormData({...formData, isAmountInUsd: !!checked})} 
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-xs block text-right">المبلغ</Label>
                  <Input 
                    id="amount" 
                    type="number" 
                    value={formData.amount} 
                    onChange={e => setFormData({...formData, amount: e.target.value})} 
                    className="text-left"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rate" className="text-xs block text-right">سعر الصرف ($)</Label>
                  <div className="relative">
                    <Input 
                      id="rate" 
                      type="number" 
                      value={formData.exchangeRate} 
                      onChange={e => setFormData({...formData, exchangeRate: e.target.value})} 
                      className="pl-8 text-left"
                    />
                    <DollarSign className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <Label htmlFor="ratio" className="block text-right font-medium">نسبة الأرباح المخصصة (%) - اختياري</Label>
              <div className="relative">
                <Input 
                  id="ratio" 
                  type="number" 
                  placeholder="اتركها فارغة للتوزيع التلقائي" 
                  value={formData.manualRatio} 
                  onChange={e => setFormData({...formData, manualRatio: e.target.value})} 
                  className="text-left pl-8"
                />
                <TrendingUp className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground opacity-50" />
              </div>
              <p className="text-[10px] text-muted-foreground text-right">تُستخدم هذه النسبة فقط عند تفعيل وضع "التوزيع اليدوي" من الصفحة الرئيسية.</p>
            </div>
          </div>

          <DialogFooter className="flex-row-reverse sm:justify-start gap-2 pt-4">
            <Button onClick={handleSave} disabled={!formData.name || !formData.amount} className="flex-1">
              {isEditMode ? "تحديث البيانات" : "حفظ الشريك"}
            </Button>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
