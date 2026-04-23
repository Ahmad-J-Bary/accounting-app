import { useState, useEffect } from "react";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Download, Search, Filter, HardDrive, Package, TrendingUp, History, MapPin, Tag, Loader2, ShoppingCart, ArrowDownToLine, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { assetService } from "@/services/assetService";
import { accountingService } from "@/services/accountingService";
import type { FixedAssetDto, ConsumableDto, AssetCategoryDto, AccountDto } from "@erp/shared-types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function Assets() {
  const [fixedAssets, setFixedAssets] = useState<FixedAssetDto[]>([]);
  const [consumables, setConsumables] = useState<ConsumableDto[]>([]);
  const [categories, setCategories] = useState<AssetCategoryDto[]>([]);
  const [accounts, setAccounts] = useState<AccountDto[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("fixed");

  // Dialog states
  const [isAddingAsset, setIsAddingAsset] = useState(false);
  const [isAddingConsumable, setIsAddingConsumable] = useState(false);
  const [isIssuingConsumable, setIsIssuingConsumable] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Selected consumable for issuing
  const [selectedConsumable, setSelectedConsumable] = useState<ConsumableDto | null>(null);

  // Form States
  const [newAsset, setNewAsset] = useState({
    code: "",
    name: "",
    categoryId: "",
    purchaseDate: new Date().toISOString(),
    purchaseCost: "",
    currency: "SYP",
    fxRate: "1.0",
    usefulLifeMonths: 60,
    assetAccountId: "",
    depreciationAccountId: "",
    accumulatedDepreciationAccountId: "",
    paymentAccountId: "",
  });

  const [newConsumable, setNewConsumable] = useState({
    code: "",
    name: "",
    categoryId: "",
    unitCost: "",
    currency: "SYP",
    fxRate: "1.0",
    assetAccountId: "",
    expenseAccountId: "",
  });

  const [issueData, setIssueData] = useState({
    quantity: "1",
    description: "صرف دوري"
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [fa, c, cats, accs, movs] = await Promise.all([
        assetService.listFixedAssets(),
        assetService.listConsumables(),
        assetService.listAssetCategories(activeTab === 'fixed' ? 'Fixed' : 'Consumable'),
        accountingService.getChartOfAccounts(),
        assetService.listAllAssetMovements()
      ]);
      setFixedAssets(fa);
      setConsumables(c);
      setCategories(cats);
      setAccounts(accs);
      setMovements(movs);
    } catch (e) {
      console.error(e);
      toast.error("خطأ في تحميل البيانات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [activeTab]);

  const handleCreateAsset = async () => {
    if (!newAsset.code || !newAsset.name || !newAsset.categoryId || !newAsset.assetAccountId || !newAsset.paymentAccountId || !newAsset.depreciationAccountId || !newAsset.accumulatedDepreciationAccountId) {
      toast.error("يرجى ملء جميع الحقول المطلوبة");
      return;
    }

    setIsSubmitting(true);
    try {
      await assetService.createFixedAsset(newAsset);
      toast.success("تم إضافة الأصل بنجاح");
      setIsAddingAsset(false);
      loadData();
    } catch (e) {
      toast.error(typeof e === 'string' ? e : "خطأ في إضافة الأصل");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateConsumable = async () => {
    if (!newConsumable.code || !newConsumable.name || !newConsumable.categoryId || !newConsumable.assetAccountId || !newConsumable.expenseAccountId) {
      toast.error("يرجى ملء جميع الحقول المطلوبة");
      return;
    }

    setIsSubmitting(true);
    try {
      await assetService.createConsumable(newConsumable);
      toast.success("تم إضافة المادة المستهلكة بنجاح");
      setIsAddingConsumable(false);
      loadData();
    } catch (e) {
      toast.error(typeof e === 'string' ? e : "خطأ في إضافة المادة");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleIssueConsumable = async () => {
    if (!selectedConsumable) return;
    setIsSubmitting(true);
    try {
      await assetService.issueConsumable(selectedConsumable.id, issueData.quantity, issueData.description);
      toast.success("تم صرف المادة بنجاح");
      setIsIssuingConsumable(false);
      loadData();
    } catch (e) {
      toast.error(typeof e === 'string' ? e : "خطأ في صرف المادة");
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalFixedCost = fixedAssets.reduce((acc, a) => acc + parseFloat(a.purchase_cost.amount), 0);
  const totalDepreciation = fixedAssets.reduce((acc, a) => acc + parseFloat(a.accumulated_depreciation.amount), 0);
  const netBookValue = totalFixedCost - totalDepreciation;

  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader 
        title="إدارة الموجودات" 
        description="إدارة الأصول الثابتة والمستهلكات التشغيلية والاهلاك"
        actions={
          <div className="flex gap-2">
            <Button variant="outline"><Download className="w-4 h-4 ml-2" />تصدير</Button>
            {activeTab === 'fixed' ? (
              <Dialog open={isAddingAsset} onOpenChange={setIsAddingAsset}>
                <DialogTrigger asChild>
                  <Button><Plus className="w-4 h-4 ml-2" />إضافة أصل</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto" dir="rtl">
                  <DialogHeader><DialogTitle>إضافة أصل ثابت جديد</DialogTitle></DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>كود الأصل</Label><Input value={newAsset.code} onChange={e => setNewAsset({...newAsset, code: e.target.value})} /></div>
                      <div className="space-y-2"><Label>اسم الأصل</Label><Input value={newAsset.name} onChange={e => setNewAsset({...newAsset, name: e.target.value})} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>التصنيف</Label>
                        <Select value={newAsset.categoryId} onValueChange={v => setNewAsset({...newAsset, categoryId: v})}>
                          <SelectTrigger><SelectValue placeholder="اختر التصنيف" /></SelectTrigger>
                          <SelectContent>{categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2"><Label>العمر الإنتاجي (شهور)</Label><Input type="number" value={newAsset.usefulLifeMonths} onChange={e => setNewAsset({...newAsset, usefulLifeMonths: parseInt(e.target.value)})} /></div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2"><Label>العملة</Label><Select value={newAsset.currency} onValueChange={v => setNewAsset({...newAsset, currency: v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="SYP">SYP</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent></Select></div>
                      <div className="space-y-2"><Label>تكلفة الشراء</Label><Input type="number" value={newAsset.purchaseCost} onChange={e => setNewAsset({...newAsset, purchaseCost: e.target.value})}/></div>
                      <div className="space-y-2"><Label>سعر الصرف</Label><Input type="number" value={newAsset.fxRate} onChange={e => setNewAsset({...newAsset, fxRate: e.target.value})} disabled={newAsset.currency === 'SYP'}/></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 border-t pt-4">
                      <div className="space-y-2"><Label>حساب الأصول</Label><Select value={newAsset.assetAccountId} onValueChange={v => setNewAsset({...newAsset, assetAccountId: v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{accounts.filter(a => a.type === 'Asset').map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>)}</SelectContent></Select></div>
                      <div className="space-y-2"><Label>حساب الدفع</Label><Select value={newAsset.paymentAccountId} onValueChange={v => setNewAsset({...newAsset, paymentAccountId: v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{accounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>)}</SelectContent></Select></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>حساب مصروف الإهلاك</Label><Select value={newAsset.depreciationAccountId} onValueChange={v => setNewAsset({...newAsset, depreciationAccountId: v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{accounts.filter(a => a.type === 'Expense').map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>)}</SelectContent></Select></div>
                      <div className="space-y-2"><Label>حساب مجمع الإهلاك</Label><Select value={newAsset.accumulatedDepreciationAccountId} onValueChange={v => setNewAsset({...newAsset, accumulatedDepreciationAccountId: v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{accounts.filter(a => a.type === 'Asset' || a.type === 'Liability').map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>)}</SelectContent></Select></div>
                    </div>
                  </div>
                  <DialogFooter><Button onClick={handleCreateAsset} disabled={isSubmitting}>حفظ</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            ) : null}
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center gap-4 border-r-4 border-r-blue-500">
          <div className="p-3 bg-blue-50 rounded-lg"><TrendingUp className="w-6 h-6 text-blue-600" /></div>
          <div><div className="text-sm text-muted-foreground">إجمالي الأصول</div><div className="text-xl font-bold tabular-nums">{formatCurrency(totalFixedCost)}</div></div>
        </Card>
        <Card className="p-4 flex items-center gap-4 border-r-4 border-r-red-500">
          <div className="p-3 bg-red-50 rounded-lg"><History className="w-6 h-6 text-red-600" /></div>
          <div><div className="text-sm text-muted-foreground">مجمع الإهلاك</div><div className="text-xl font-bold tabular-nums text-red-600">{formatCurrency(totalDepreciation)}</div></div>
        </Card>
        <Card className="p-4 flex items-center gap-4 border-r-4 border-r-green-500">
          <div className="p-3 bg-green-50 rounded-lg"><TrendingUp className="w-6 h-6 text-green-600" /></div>
          <div><div className="text-sm text-muted-foreground">صافي القيمة</div><div className="text-xl font-bold tabular-nums text-green-600">{formatCurrency(netBookValue)}</div></div>
        </Card>
        <Card className="p-4 flex items-center gap-4 border-r-4 border-r-amber-500">
          <div className="p-3 bg-amber-50 rounded-lg"><Package className="w-6 h-6 text-amber-600" /></div>
          <div><div className="text-sm text-muted-foreground">عدد الأصول</div><div className="text-xl font-bold tabular-nums">{fixedAssets.length}</div></div>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full" dir="rtl">
        <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
          <TabsTrigger value="fixed" className="flex gap-2"><HardDrive className="w-4 h-4" /> الأصول الثابتة</TabsTrigger>
          <TabsTrigger value="consumables" className="flex gap-2"><Package className="w-4 h-4" /> المستهلكات</TabsTrigger>
          <TabsTrigger value="depreciation" className="flex gap-2"><Calendar className="w-4 h-4" /> الإهلاك</TabsTrigger>
          <TabsTrigger value="movements" className="flex gap-2"><History className="w-4 h-4" /> السجل</TabsTrigger>
        </TabsList>

        <TabsContent value="fixed" className="mt-6">
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-right p-4 font-bold">الكود</th><th className="text-right p-4 font-bold">الاسم</th><th className="text-right p-4 font-bold">التكلفة</th><th className="text-right p-4 font-bold">صافي القيمة</th><th className="text-right p-4 font-bold">الحالة</th><th className="text-left p-4 font-bold">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {fixedAssets.map((asset) => (
                    <tr key={asset.id} className="hover:bg-slate-50">
                      <td className="p-4 tabular-nums">{asset.code}</td><td className="p-4">{asset.name}</td>
                      <td className="p-4 tabular-nums">{formatCurrency(parseFloat(asset.purchase_cost.amount))}</td>
                      <td className="p-4 tabular-nums text-green-600 font-bold">{formatCurrency(parseFloat(asset.purchase_cost.amount) - parseFloat(asset.accumulated_depreciation.amount))}</td>
                      <td className="p-4">
                        <span className={cn("px-2 py-1 rounded-full text-[10px] font-bold", asset.status === 'Active' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                          {asset.status === 'Active' ? "نشط" : "مستبعد"}
                        </span>
                      </td>
                      <td className="p-4 text-left"><Button variant="outline" size="sm" onClick={async () => {
                        try { await assetService.postDepreciation(asset.id, new Date().toISOString()); toast.success("تم الإهلاك"); loadData(); } catch (e) { toast.error("خطأ"); }
                      }}>إهلاك</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="consumables" className="mt-6">
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr><th className="text-right p-4 font-bold">الكود</th><th className="text-right p-4 font-bold">الاسم</th><th className="text-right p-4 font-bold">الكمية</th><th className="text-right p-4 font-bold">تكلفة الوحدة</th><th className="text-left p-4 font-bold">الإجراءات</th></tr>
                </thead>
                <tbody className="divide-y">
                  {consumables.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="p-4 tabular-nums">{item.code}</td><td className="p-4">{item.name}</td>
                      <td className="p-4 tabular-nums font-bold text-blue-600">{item.quantity_on_hand}</td>
                      <td className="p-4 tabular-nums">{formatCurrency(parseFloat(item.unit_cost.amount))}</td>
                      <td className="p-4 text-left gap-2 flex">
                        <Button variant="outline" size="sm" onClick={() => { setSelectedConsumable(item); setIsIssuingConsumable(true); }}>صرف</Button>
                        <Button variant="outline" size="sm" onClick={async () => {
                          const qty = prompt("الكمية:");
                          if (qty) { try { await assetService.addConsumableStock(item.id, qty); loadData(); } catch (e) { console.error(e); } }
                        }}>توريد</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="movements" className="mt-6">
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-right p-4 font-bold">التاريخ</th>
                    <th className="text-right p-4 font-bold">النوع</th>
                    <th className="text-right p-4 font-bold">البيان</th>
                    <th className="text-right p-4 font-bold">القيمة</th>
                    <th className="text-right p-4 font-bold">الكمية</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {movements.map((mov) => (
                    <tr key={mov.id} className="hover:bg-slate-50">
                      <td className="p-4 tabular-nums">{formatDate(mov.date)}</td>
                      <td className="p-4">
                        <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase", 
                          mov.movement_type === 'Acquisition' ? "bg-blue-100 text-blue-700" :
                          mov.movement_type === 'Depreciation' ? "bg-amber-100 text-amber-700" :
                          mov.movement_type === 'Issue' ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-700"
                        )}>
                          {mov.movement_type}
                        </span>
                      </td>
                      <td className="p-4">{mov.description}</td>
                      <td className="p-4 tabular-nums font-bold">{formatCurrency(parseFloat(mov.amount.amount))}</td>
                      <td className="p-4 tabular-nums">{mov.quantity || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isIssuingConsumable} onOpenChange={setIsIssuingConsumable}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>صرف مواد: {selectedConsumable?.name}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2"><Label>الكمية</Label><Input type="number" value={issueData.quantity} onChange={e => setIssueData({...issueData, quantity: e.target.value})} /></div>
            <div className="space-y-2"><Label>البيان</Label><Input value={issueData.description} onChange={e => setIssueData({...issueData, description: e.target.value})} /></div>
          </div>
          <DialogFooter><Button onClick={handleIssueConsumable} disabled={isSubmitting}>تأكيد</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
