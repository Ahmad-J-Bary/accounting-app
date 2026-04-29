import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Download, HardDrive, Package, TrendingUp, History, Calendar, RefreshCw } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { assetService } from "@/services/assetService";
import { accountingService } from "@/services/accountingService";
import type { 
  FixedAssetDto, 
  ConsumableDto, 
  AssetCategoryDto, 
  AccountDto, 
  AssetMovement,
  CreateConsumableRequest
} from "@erp/shared-types";

type CreateFixedAssetRequest = {
  code: string; name: string; categoryId: string; purchaseDate: string;
  purchaseCost: string; currency: string; fxRate: string;
  usefulLifeMonths: number; assetAccountId: string;
  depreciationAccountId: string; accumulatedDepreciationAccountId: string;
  paymentAccountId: string;
};
import { toast } from "sonner";

// Refactored Components
import { StatCard } from "@/components/erp/shared/StatCard";
import { AssetForm } from "@/components/erp/assets/AssetForm";
import { ConsumableForm } from "@/components/erp/assets/ConsumableForm";
import { IssueConsumableDialog } from "@/components/erp/assets/IssueConsumableDialog";

export default function Assets() {
  const [fixedAssets, setFixedAssets] = useState<FixedAssetDto[]>([]);
  const [consumables, setConsumables] = useState<ConsumableDto[]>([]);
  const [categories, setCategories] = useState<AssetCategoryDto[]>([]);
  const [accounts, setAccounts] = useState<AccountDto[]>([]);
  const [movements, setMovements] = useState<AssetMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("fixed");

  const [isAddingAsset, setIsAddingAsset] = useState(false);
  const [isAddingConsumable, setIsAddingConsumable] = useState(false);
  const [isIssuingConsumable, setIsIssuingConsumable] = useState(false);
  const [selectedConsumable, setSelectedConsumable] = useState<ConsumableDto | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
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
      toast.error("خطأ في تحميل البيانات");
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreateAsset = async (payload: CreateFixedAssetRequest) => {
    setIsSubmitting(true);
    try {
      await assetService.createFixedAsset(payload);
      toast.success("تم إضافة الأصل بنجاح");
      setIsAddingAsset(false);
      loadData();
    } catch (e) {
      toast.error(typeof e === 'string' ? e : "خطأ في إضافة الأصل");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateConsumable = async (payload: CreateConsumableRequest) => {
    setIsSubmitting(true);
    try {
      await assetService.createConsumable(payload);
      toast.success("تم إضافة المادة المستهلكة بنجاح");
      setIsAddingConsumable(false);
      loadData();
    } catch (e) {
      toast.error(typeof e === 'string' ? e : "خطأ في إضافة المادة");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleIssueConsumable = async (qty: string, desc: string) => {
    if (!selectedConsumable) return;
    setIsSubmitting(true);
    try {
      await assetService.issueConsumable(selectedConsumable.id, qty, desc);
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
        subtitle="إدارة الأصول الثابتة والمستهلكات التشغيلية والاهلاك"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadData} disabled={loading}><RefreshCw className={cn("w-4 h-4 ml-2", loading && "animate-spin")} />تحديث</Button>
            {activeTab === 'fixed' && <Button onClick={() => setIsAddingAsset(true)}><Plus className="w-4 h-4 ml-2" />إضافة أصل</Button>}
            {activeTab === 'consumables' && <Button onClick={() => setIsAddingConsumable(true)}><Plus className="w-4 h-4 ml-2" />مادة جديدة</Button>}
            <Button variant="secondary"><Download className="w-4 h-4 ml-2" />تصدير</Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="إجمالي الأصول" value={formatCurrency(totalFixedCost)} icon={<TrendingUp className="text-blue-600" />} iconBg="bg-blue-50" />
        <StatCard label="مجمع الإهلاك" value={formatCurrency(totalDepreciation)} color="text-red-600" icon={<History className="text-red-600" />} iconBg="bg-red-50" />
        <StatCard label="صافي القيمة" value={formatCurrency(netBookValue)} color="text-green-600" icon={<TrendingUp className="text-green-600" />} iconBg="bg-green-50" />
        <StatCard label="عدد الأصول" value={fixedAssets.length} icon={<Package className="text-amber-600" />} iconBg="bg-amber-50" />
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
                    <tr key={asset.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 tabular-nums">{asset.code}</td><td className="p-4 font-medium">{asset.name}</td>
                      <td className="p-4 tabular-nums">{formatCurrency(parseFloat(asset.purchase_cost.amount))}</td>
                      <td className="p-4 tabular-nums text-green-600 font-bold">{formatCurrency(parseFloat(asset.purchase_cost.amount) - parseFloat(asset.accumulated_depreciation.amount))}</td>
                      <td className="p-4"><span className={cn("px-2 py-1 rounded-full text-[10px] font-bold", asset.status === 'Active' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>{asset.status === 'Active' ? "نشط" : "مستبعد"}</span></td>
                      <td className="p-4 text-left"><Button variant="outline" size="sm" onClick={async () => {
                        try { await assetService.postDepreciation(asset.id, new Date().toISOString()); toast.success("تم الإهلاك"); loadData(); } catch (e) { toast.error("خطأ في المعالجة"); }
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
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 tabular-nums">{item.code}</td><td className="p-4 font-medium">{item.name}</td>
                      <td className="p-4 tabular-nums font-bold text-blue-600">{item.quantity_on_hand}</td>
                      <td className="p-4 tabular-nums">{formatCurrency(parseFloat(item.unit_cost.amount))}</td>
                      <td className="p-4 text-left gap-2 flex">
                        <Button variant="outline" size="sm" onClick={() => { setSelectedConsumable(item); setIsIssuingConsumable(true); }}>صرف</Button>
                        <Button variant="outline" size="sm" onClick={async () => {
                          const qty = prompt("أدخل كمية التوريد:");
                          if (qty) { try { await assetService.addConsumableStock(item.id, qty); toast.success("تم التوريد"); loadData(); } catch (e) { toast.error("خطأ"); } }
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
                  <tr><th className="text-right p-4 font-bold">التاريخ</th><th className="text-right p-4 font-bold">النوع</th><th className="text-right p-4 font-bold">البيان</th><th className="text-right p-4 font-bold">القيمة</th><th className="text-right p-4 font-bold">الكمية</th></tr>
                </thead>
                <tbody className="divide-y">
                  {movements.map((mov) => (
                    <tr key={mov.id} className="hover:bg-slate-50">
                      <td className="p-4 tabular-nums">{formatDate(mov.date)}</td>
                      <td className="p-4">
                        <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase", 
                          mov.movement_type === 'Purchase' ? "bg-blue-100 text-blue-700" :
                          mov.movement_type === 'Depreciation' ? "bg-amber-100 text-amber-700" :
                          mov.movement_type === 'Issue' ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-700"
                        )}>{mov.movement_type}</span>
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

      <AssetForm open={isAddingAsset} onOpenChange={setIsAddingAsset} categories={categories} accounts={accounts} onSave={handleCreateAsset} isSubmitting={isSubmitting} />
      <ConsumableForm open={isAddingConsumable} onOpenChange={setIsAddingConsumable} categories={categories} accounts={accounts} onSave={handleCreateConsumable} isSubmitting={isSubmitting} />
      <IssueConsumableDialog open={isIssuingConsumable} onOpenChange={setIsIssuingConsumable} consumable={selectedConsumable} onConfirm={handleIssueConsumable} isSubmitting={isSubmitting} />
    </div>
  );
}
