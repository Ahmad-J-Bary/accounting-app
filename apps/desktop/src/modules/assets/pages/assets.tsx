import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@shared/ui/tabs";
import { Plus, Download, HardDrive, Package, TrendingUp, History, Calendar, Search, Wallet } from "lucide-react";
import { formatCurrency, formatDateTime } from '@shared/lib/format';
import { cn } from '@shared/lib/utils';
import { assetService } from '@modules/assets/api/assetService';
import { accountingService } from '@modules/accounting/api/accountingService';
import type { 
  FixedAssetDto, 
  ConsumableDto, 
  AssetCategoryDto, 
  AccountDto, 
  AssetMovement,
  CreateConsumableRequest
} from "@erp/shared-types";
import { toast } from "sonner";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { DataTable, Column } from '@widgets/table-shell/DataTable';

// Components
import { AssetForm } from '@modules/assets/components/AssetForm';
import { ConsumableForm } from '@modules/assets/components/ConsumableForm';
import { IssueConsumableDialog } from '@modules/assets/components/IssueConsumableDialog';

type CreateFixedAssetRequest = {
  code: string; name: string; categoryId: string; purchaseDate: string;
  purchaseCost: string; currency: string; fxRate: string;
  usefulLifeMonths: number; assetAccountId: string;
  depreciationAccountId: string; accumulatedDepreciationAccountId: string;
  paymentAccountId: string;
};

export default function Assets() {
  const [fixedAssets, setFixedAssets] = useState<FixedAssetDto[]>([]);
  const [consumables, setConsumables] = useState<ConsumableDto[]>([]);
  const [categories, setCategories] = useState<AssetCategoryDto[]>([]);
  const [accounts, setAccounts] = useState<AccountDto[]>([]);
  const [movements, setMovements] = useState<AssetMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("fixed");
  const [search, setSearch] = useState("");

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

  const filteredFixed = useMemo(() => 
    fixedAssets.filter(a => a.name.toLowerCase().includes(search.toLowerCase()) || a.code.toLowerCase().includes(search.toLowerCase()))
  , [fixedAssets, search]);

  const filteredConsumables = useMemo(() => 
    consumables.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase()))
  , [consumables, search]);

  const totalFixedCost = fixedAssets.reduce((acc, a) => acc + parseFloat(a.purchase_cost.amount), 0);
  const totalDepreciation = fixedAssets.reduce((acc, a) => acc + parseFloat(a.accumulated_depreciation.amount), 0);
  const netBookValue = totalFixedCost - totalDepreciation;

  const stats = useMemo(() => [
    { label: "إجمالي الأصول", value: formatCurrency(totalFixedCost), icon: TrendingUp, color: "text-blue-600" },
    { label: "مجمع الإهلاك", value: formatCurrency(totalDepreciation), icon: History, color: "text-rose-600" },
    { label: "صافي القيمة", value: formatCurrency(netBookValue), icon: Wallet, color: "text-emerald-600" },
    { label: "عدد الأصول", value: fixedAssets.length, icon: Package, color: "text-amber-600" },
  ], [totalFixedCost, totalDepreciation, netBookValue, fixedAssets.length]);

  const fixedColumns = useMemo<Column<FixedAssetDto>[]>(() => [
    { header: "الكود", accessor: "code", className: "tabular-nums font-mono text-xs" },
    { header: "الاسم", accessor: "name", className: "font-black text-slate-900" },
    { header: "التكلفة", accessor: (a) => formatCurrency(parseFloat(a.purchase_cost.amount)), className: "tabular-nums" },
    { header: "صافي القيمة", accessor: (a) => formatCurrency(parseFloat(a.purchase_cost.amount) - parseFloat(a.accumulated_depreciation.amount)), className: "tabular-nums font-bold text-emerald-600" },
    { 
      header: "الحالة", 
      accessor: (a) => (
        <span className={cn(
          "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ring-1 ring-inset",
          a.status === 'Active' ? "bg-emerald-50 text-emerald-700 ring-emerald-100" : "bg-rose-50 text-rose-700 ring-rose-100"
        )}>
          {a.status === 'Active' ? "نشط" : "مستبعد"}
        </span>
      ),
      align: "center"
    },
    {
      header: "إجراءات",
      accessor: (a) => (
        <Button variant="outline" size="sm" className="h-8 text-xs font-bold" onClick={async () => {
          try { 
            await assetService.postDepreciation(a.id, new Date().toISOString()); 
            toast.success("تم الإهلاك"); 
            loadData(); 
          } catch (e) { 
            toast.error("خطأ في المعالجة"); 
          }
        }}>إهلاك</Button>
      ),
      align: "left"
    }
  ], [loadData]);

  const consumableColumns = useMemo<Column<ConsumableDto>[]>(() => [
    { header: "الكود", accessor: "code", className: "tabular-nums font-mono text-xs" },
    { header: "الاسم", accessor: "name", className: "font-black text-slate-900" },
    { header: "الكمية", accessor: (c) => (
      <span className="font-black text-blue-600 tabular-nums text-lg">{c.quantity_on_hand}</span>
    ), align: "center" },
    { header: "تكلفة الوحدة", accessor: (c) => formatCurrency(parseFloat(c.unit_cost.amount)), className: "tabular-nums" },
    {
      header: "إجراءات",
      accessor: (c) => (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs font-bold" onClick={() => { setSelectedConsumable(c); setIsIssuingConsumable(true); }}>صرف</Button>
          <Button variant="outline" size="sm" className="h-8 text-xs font-bold" onClick={async () => {
            const qty = prompt("أدخل كمية التوريد:");
            if (qty) { try { await assetService.addConsumableStock(c.id, qty); toast.success("تم التوريد"); loadData(); } catch (e) { toast.error("خطأ"); } }
          }}>توريد</Button>
        </div>
      ),
      align: "left"
    }
  ], [loadData]);

  const movementColumns = useMemo<Column<AssetMovement>[]>(() => [
    { header: "التاريخ", accessor: (m) => formatDateTime(m.date), className: "tabular-nums text-slate-500 font-medium" },
    { 
      header: "النوع", 
      accessor: (m) => (
        <span className={cn(
          "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ring-1 ring-inset",
          m.movement_type === 'Purchase' ? "bg-blue-50 text-blue-700 ring-blue-100" :
          m.movement_type === 'Depreciation' ? "bg-amber-50 text-amber-700 ring-amber-100" :
          m.movement_type === 'Issue' ? "bg-purple-50 text-purple-700 ring-purple-100" : "bg-slate-50 text-slate-700 ring-slate-100"
        )}>{m.movement_type}</span>
      ),
      align: "center"
    },
    { header: "البيان", accessor: "description", className: "text-slate-500 text-xs italic" },
    { header: "القيمة", accessor: (m) => formatCurrency(parseFloat(m.amount.amount)), className: "tabular-nums font-bold" },
    { header: "الكمية", accessor: (m) => m.quantity || '-', className: "tabular-nums", align: "center" }
  ], []);

  return (
    <OperationalTableTemplate
      title="إدارة الموجودات"
      toolbar={
        <div className="flex gap-2">
          {activeTab === 'fixed' && (
            <Button size="sm" onClick={() => setIsAddingAsset(true)} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100">
              <Plus className="w-4 h-4 ml-2" />أصل جديد
            </Button>
          )}
          {activeTab === 'consumables' && (
            <Button size="sm" onClick={() => setIsAddingConsumable(true)} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100">
              <Plus className="w-4 h-4 ml-2" />مادة جديدة
            </Button>
          )}
          <Button variant="outline" size="sm" className="bg-white"><Download className="w-4 h-4 ml-2" />تصدير</Button>

          <div className="flex items-center gap-6 mr-auto pl-2">
            {stats.map((s, i) => (
              <div key={i} className="flex flex-col items-start gap-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{s.label}</span>
                <div className="flex items-center gap-2">
                   <s.icon className={cn("w-4 h-4", s.color)} />
                   <span className={cn("text-lg font-black tabular-nums", s.color)}>{s.value}</span>
                </div>
              </div>
            ))}
          </div>

        </div>
      }
      tableContent={
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
          <div className="px-6 py-4 border-b flex items-center justify-between bg-slate-50/50">
            <TabsList className="bg-white border p-1 h-11 rounded-xl shadow-sm">
              <TabsTrigger value="fixed" className="rounded-lg px-6 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all">
                <HardDrive className="w-4 h-4 ml-2" /> الأصول الثابتة
              </TabsTrigger>
              <TabsTrigger value="consumables" className="rounded-lg px-6 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all">
                <Package className="w-4 h-4 ml-2" /> المستهلكات
              </TabsTrigger>
              <TabsTrigger value="depreciation" className="rounded-lg px-6 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all">
                <Calendar className="w-4 h-4 ml-2" /> الإهلاك
              </TabsTrigger>
              <TabsTrigger value="movements" className="rounded-lg px-6 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all">
                <History className="w-4 h-4 ml-2" /> السجل
              </TabsTrigger>
            </TabsList>
            
            <div className="relative w-64">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="بحث..." 
                className="pr-10 h-10 border-slate-200 bg-white" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            <TabsContent value="fixed" className="m-0 p-0 h-full">
              <DataTable data={filteredFixed} columns={fixedColumns} loading={loading} />
            </TabsContent>
            
            <TabsContent value="consumables" className="m-0 p-0 h-full">
              <DataTable data={filteredConsumables} columns={consumableColumns} loading={loading} />
            </TabsContent>

            <TabsContent value="movements" className="m-0 p-0 h-full">
              <DataTable data={movements} columns={movementColumns} loading={loading} />
            </TabsContent>
            
            <TabsContent value="depreciation" className="m-0 p-8 h-full overflow-auto">
              <div className="max-w-2xl mx-auto bg-white p-12 rounded-3xl border border-slate-200 shadow-xl text-center space-y-6">
                <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto">
                  <Calendar className="w-10 h-10 text-amber-600" />
                </div>
                <h3 className="text-2xl font-black text-slate-900">معالجة الإهلاك الدوري</h3>
                <p className="text-slate-500 font-medium">سيتم حساب وتوليد قيود الإهلاك لجميع الأصول النشطة حتى تاريخ اليوم.</p>
                <Button size="lg" className="w-full bg-slate-900 hover:bg-slate-800 h-14 text-lg font-black rounded-2xl shadow-xl shadow-slate-200">
                  بدء معالجة الإهلاك
                </Button>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      }
    >
      <AssetForm open={isAddingAsset} onOpenChange={setIsAddingAsset} categories={categories} accounts={accounts} onSave={handleCreateAsset} isSubmitting={isSubmitting} />
      <ConsumableForm open={isAddingConsumable} onOpenChange={setIsAddingConsumable} categories={categories} accounts={accounts} onSave={handleCreateConsumable} isSubmitting={isSubmitting} />
      <IssueConsumableDialog open={isIssuingConsumable} onOpenChange={setIsIssuingConsumable} consumable={selectedConsumable} onConfirm={handleIssueConsumable} isSubmitting={isSubmitting} />
    </OperationalTableTemplate>
  );
}
