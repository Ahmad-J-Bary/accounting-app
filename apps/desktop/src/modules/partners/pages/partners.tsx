import { useState, useMemo, useCallback } from "react";
import {
  TrendingUp,
  PieChart as PieChartIcon,
} from "lucide-react";
import { partnerService, type PartnerDto, type PartnerRequest } from '@modules/partners/api/partnerService';

import { OperationalTableTemplate } from '@widgets/templates/OperationalTableTemplate';
import { PartnerTable } from '../components/PartnerTable';
import { PartnersToolbar } from '../components/PartnersToolbar';
import { PartnersSidePanel } from '../components/PartnersSidePanel';
import { ChartCard } from '@modules/partners/components/ChartCard';
import { useDataTable } from '@shared/hooks';
import { useTabs } from "@app/providers/TabContext";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@shared/ui/select";
import { toast } from "sonner";
import { paymentService } from '@modules/payments/api/paymentService';
import { type CreatePaymentRequest } from '@erp/shared-types';
import { usePartnerRatios } from '@modules/partners/hooks/usePartnerRatios';

export default function Partners() {
  const { openTab } = useTabs();
  const { formatAmount, baseCurrency, currencies } = useCurrencyContext();
  const [globalStrategy, setGlobalStrategy] = useState(() => localStorage.getItem("partnerProfitStrategy") || "BasedOnCapital");
  const persistStrategy = (v: string) => { setGlobalStrategy(v); localStorage.setItem("partnerProfitStrategy", v); };

  const {
    filtered: partners,
    loading,
    refresh,
    setData,
    search,
    setSearch,
  } = useDataTable<PartnerDto>({
    fetchData: () => partnerService.listPartners(),
    searchFields: ["name"],
    errorLabel: "فشل جلب الشركاء",
  });

  const [activePanel, setActivePanel] = useState<"edit" | "drawings" | "view" | null>(null);
  const [editPartner, setEditPartner] = useState<PartnerDto | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [drawingsSaving, setDrawingsSaving] = useState(false);

  const {
    totals,
    partnersWithRatios,
  } = usePartnerRatios({ 
    partners, 
    strategy: globalStrategy, 
  });

  const selectedPartner = useMemo(
    () => partnersWithRatios.find(p => p.id === selectedId) ?? null,
    [partnersWithRatios, selectedId]
  );

  const handleSave = async (payload: PartnerRequest) => {
    try {
      setSaving(true);
      if (payload.id) {
        await partnerService.updatePartner(payload);
        toast.success("تم التحديث بنجاح");
      } else {
        await partnerService.addPartner(payload);
        toast.success("تم الإضافة بنجاح");
      }
      setActivePanel(null);
      refresh(true);
    } catch (error) {
      toast.error("خطأ: " + error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا الشريك؟")) return;
    try {
      await partnerService.deletePartner(id);
      toast.success("تم الحذف بنجاح");
      setData(prev => prev.filter(p => p.id !== id));
    } catch (error) {
      toast.error("فشل الحذف: " + error);
    }
  }, [setData]);

  const handleSaveDrawings = async (payload: CreatePaymentRequest) => {
    try {
      setDrawingsSaving(true);
      await paymentService.createPayment(payload);
      await refresh(true);
      setActivePanel(null);
      toast.success("تم تسجيل سند المسحوبات بنجاح");
    } catch (error) {
      toast.error("فشل تسجيل السند: " + error);
    } finally {
      setDrawingsSaving(false);
    }
  };

  const isLoading = loading;

  return (
    <OperationalTableTemplate
      title="الشركاء ورأس المال"
      toolbar={
        <PartnersToolbar
          selectedPartner={selectedPartner}
          onOpenDrawingsLedger={(id, accountId, name) =>
            openTab({
              id: `ledger-${accountId}`,
              title: `مسحوبات ${name}`,
              path: `/accounting/account-ledger/${accountId}`,
              closable: true,
            })
          }
          onOpenDrawingsForm={() => setActivePanel("drawings")}
          onAddPartner={() => { setEditPartner(null); setActivePanel("edit"); setSelectedId("new"); }}
        />
      }

      tableContent={
        <PartnerTable
          partners={partnersWithRatios}
          loading={isLoading}
          search={search}
          onSearchChange={setSearch}
          filterBar={
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">التوزيع:</span>
              <Select value={globalStrategy} onValueChange={persistStrategy}>
                <SelectTrigger className="w-[120px] h-8 bg-white font-bold shadow-sm border-slate-200 text-xs">
                  <SelectValue placeholder="اختر" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BasedOnCapital" className="text-xs font-bold">تلقائي</SelectItem>
                  <SelectItem value="Manual" className="text-xs font-bold">يدوي</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
          onView={(p) => { setSelectedId(p.id); setActivePanel("view"); }}
          onEdit={(p) => { setEditPartner(p); setSelectedId(p.id); setActivePanel("edit"); }}
          onDelete={(id) => handleDelete(id)}
          onJournal={(p) => p.drawings_account_id ? openTab({
            id: `ledger-${p.drawings_account_id}`,
            title: `مسحوبات ${p.name}`,
            path: `/accounting/account-ledger/${p.drawings_account_id}`,
            closable: true
          }) : toast.error("لا يوجد حساب مسحوبات مرتبط بهذا الشريك")}
          onDocument={(p) => {
            setSelectedId(p.id);
            setActivePanel("drawings");
          }}
          selectedId={selectedId}
          onRowClick={(p) => {
            setSelectedId(p.id);
            setActivePanel("view");
          }}
        />
      }
      bottomWidgets={
        <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ChartCard title="حصص رأس المال" icon={PieChartIcon} data={partnersWithRatios.map(p => ({ name: p.name, value: p.calculatedCapitalRatio }))} formatter={(v: number) => `${v.toFixed(2)}%`} />
                  <ChartCard title="توزيع الأرباح" icon={TrendingUp} data={partnersWithRatios.map(p => ({ name: p.name, value: p.calculatedRatio }))} formatter={(v: number) => `${v.toFixed(2)}%`} />
              </div>
        </div>
      }
      sidePanel={
        <PartnersSidePanel
          activePanel={activePanel}
          selectedPartner={selectedPartner}
          editPartner={editPartner}
          baseCurrency={baseCurrency}
          currencies={currencies}
          formatAmount={formatAmount}
          saving={saving}
          drawingsSaving={drawingsSaving}
          onEdit={(p) => { setEditPartner(p); setActivePanel("edit"); }}
          onDelete={(id) => { handleDelete(id); setSelectedId(null); setActivePanel(null); }}
          onClose={() => { setActivePanel(null); setSelectedId(null); setEditPartner(null); }}
          onSaveForm={handleSave}
          onSaveDrawings={handleSaveDrawings}
        />
      }
      isPanelOpen={activePanel != null}
    />
  );
}