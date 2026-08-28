import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  TrendingUp,
  PieChart as PieChartIcon,
} from "lucide-react";
import { partnerService, type PartnerDto, type PartnerRequest } from '@modules/partners/api/partnerService';
import { settingsService } from '@modules/core/api/settingsService';

import { OperationalTableTemplate } from '@widgets/templates/OperationalTableTemplate';
import { PartnerTable } from '../components/PartnerTable';
import { PartnersToolbar } from '../components/PartnersToolbar';
import { PartnersSidePanel } from '../components/PartnersSidePanel';
import { ChartCard } from '@modules/partners/components/ChartCard';
import { CapitalSourceDialog, type CapitalSource } from '../components/CapitalSourceDialog';
import { useDataTable } from '@shared/hooks';
import { useTabs } from "@app/providers/TabContext";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@shared/ui/select";
import { toast } from "sonner";
import { paymentService } from '@modules/payments/api/paymentService';
import { type CreatePaymentRequest } from '@erp/shared-types';
import { usePartnerRatios } from '@modules/partners/hooks/usePartnerRatios';
import { queryClient, PARTNER_MUTATION_KEYS, invalidateKeys } from "@shared/hooks/queryClient";
import { START_MODE_EXISTING } from "@modules/opening-balance/lib/wizard-types";
import { ProfitDistributionSidePanel } from "@modules/accounting/profit-distribution/components/ProfitDistributionSidePanel";

export default function Partners() {
  const { openTab } = useTabs();
  const { formatAmount, baseCurrency, currencies } = useCurrencyContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const [globalStrategy, setGlobalStrategy] = useState(() => localStorage.getItem("partnerProfitStrategy") || "auto");
  const persistStrategy = (v: string) => { setGlobalStrategy(v); localStorage.setItem("partnerProfitStrategy", v); };

  const {
    filtered: partners,
    loading,
    refresh,
    search,
    setSearch,
  } = useDataTable<PartnerDto>({
    queryKey: ["partners"],
    fetchData: () => partnerService.listPartners(),
    searchFields: ["name"],
    errorLabel: "فشل جلب الشركاء",
  });

  const [activePanel, setActivePanel] = useState<"edit" | "drawings" | "view" | null>(null);
  const [editPartner, setEditPartner] = useState<PartnerDto | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [drawingsSaving, setDrawingsSaving] = useState(false);
  const [pendingCapital, setPendingCapital] = useState<{
    partnerId: string;
    amount: string;
    isAmountInOriginal: boolean;
    eventId: string;
  } | null>(null);
  const [capitalSubmitting, setCapitalSubmitting] = useState(false);

  const [startMode, setStartMode] = useState<string>(START_MODE_EXISTING);

  const [showProfitDistribution, setShowProfitDistribution] = useState(false);

  useEffect(() => {
    settingsService.getSettings()
      .then((s) => setStartMode(s.accounting_start_mode || START_MODE_EXISTING))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (searchParams.get("profit-distribution") === "open") {
      setShowProfitDistribution(true);
      searchParams.delete("profit-distribution");
      searchParams.delete("migration");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const {
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
        const partnerId = await partnerService.addPartner(payload);
        // Two accounting-start modes (company-level setting):
        // - NewCompany: partner capital requires an explicit contribution event —
        //   ask "how was the capital provided?" (cash / bank / in-kind / owed).
        // - ExistingCompanyMigration: opening capital only — no cash journal.
        if (startMode !== START_MODE_EXISTING && Number(payload.amount) > 0) {
          setPendingCapital({
            partnerId,
            amount: payload.amount,
            isAmountInOriginal: payload.isAmountInOriginal,
            eventId: crypto.randomUUID(),
          });
          return; // keep the side panel open; dialog drives the contribution
        }
        toast.success(
          startMode === START_MODE_EXISTING
            ? "تمت إضافة الشريك (رأس مال افتتاحي، بدون حركة صندوق)"
            : "تمت الإضافة بنجاح",
        );
      }
      setActivePanel(null);
      await invalidateKeys(queryClient, PARTNER_MUTATION_KEYS);
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
      await invalidateKeys(queryClient, PARTNER_MUTATION_KEYS);
      refresh(true);
    } catch (error) {
      toast.error("فشل الحذف: " + error);
    }
  }, [refresh]);

  const handleSaveDrawings = async (payload: CreatePaymentRequest) => {
    if (!selectedPartner?.drawings_account_id) {
      toast.error("لم يتم إعداد حساب المسحوبات لهذا الشريك");
      return;
    }
    try {
      setDrawingsSaving(true);
      await paymentService.createPayment(payload);
      await invalidateKeys(queryClient, PARTNER_MUTATION_KEYS);
      await refresh(true);
      setActivePanel(null);
      toast.success("تم تسجيل سند المسحوبات بنجاح");
    } catch (error) {
      toast.error("فشل تسجيل السند: " + error);
    } finally {
      setDrawingsSaving(false);
    }
  };

  const handleCapitalConfirm = async (_source: CapitalSource, fundingAccountId: string) => {
    if (!pendingCapital) return;
    try {
      setCapitalSubmitting(true);
      await partnerService.createCapitalContribution({
        partnerId: pendingCapital.partnerId,
        fundingAccountId,
        amount: pendingCapital.amount,
        isAmountInOriginal: pendingCapital.isAmountInOriginal,
        eventId: pendingCapital.eventId,
      });
      setPendingCapital(null);
      setActivePanel(null);
      setSelectedId(null);
      setEditPartner(null);
      await invalidateKeys(queryClient, PARTNER_MUTATION_KEYS);
      refresh(true);
      toast.success("تم تسجيل مساهمة رأس المال بنجاح");
    } catch (error) {
      toast.error("فشل تسجيل المساهمة: " + error);
    } finally {
      setCapitalSubmitting(false);
    }
  };

  const isLoading = loading;

  return (
    <>
      <OperationalTableTemplate
      title="الشركاء ورأس المال"
      toolbar={
        <PartnersToolbar
          selectedPartner={selectedPartner}
          onOpenDrawingsLedger={(_id, accountId, name) =>
            openTab({
              id: `ledger-${accountId}`,
              title: `مسحوبات ${name}`,
              path: `/accounting/account-ledger/${accountId}`,
              closable: true,
            })
          }
          onOpenDrawingsForm={() => setActivePanel("drawings")}
          onAddPartner={() => { setEditPartner(null); setActivePanel("edit"); setSelectedId("new"); }}
          onOpenPartnerStatement={() =>
            openTab({
              id: "partner-rights",
              title: "الشركاء وحقوقهم",
              path: "/accounting/reports/partners",
              closable: true,
            })
          }
          onOpenProfitDistribution={() => setShowProfitDistribution(true)}
        />
      }

      tableContent={
        <PartnerTable
          partners={partnersWithRatios}
          loading={isLoading}
          search={search}
          onSearchChange={setSearch}
          filterBar={
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">التوزيع:</span>
              <Select value={globalStrategy} onValueChange={persistStrategy}>
                <SelectTrigger className="w-[120px] h-8 bg-white font-bold shadow-sm border-slate-200 text-xs">
                  <SelectValue placeholder="اختر" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto" className="text-xs font-bold">تلقائي حسب الشريك</SelectItem>
                  <SelectItem value="BasedOnCapitalLocal" className="text-xs font-bold">رأس المال المحلي</SelectItem>
                  <SelectItem value="BasedOnCapitalOriginal" className="text-xs font-bold">رأس المال الأصلي</SelectItem>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ChartCard title="حصص رأس المال" icon={PieChartIcon} data={partnersWithRatios.map(p => ({ name: p.name, value: p.calculatedCapitalRatio }))} formatter={(v: number) => `${v.toFixed(2)}%`} />
          <ChartCard title="توزيع الأرباح" icon={TrendingUp} data={partnersWithRatios.map(p => ({ name: p.name, value: p.calculatedRatio }))} formatter={(v: number) => `${v.toFixed(2)}%`} />
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
      <CapitalSourceDialog
        open={!!pendingCapital}
        partnerId={pendingCapital?.partnerId ?? null}
        amount={pendingCapital?.amount ?? ""}
        isAmountInOriginal={pendingCapital?.isAmountInOriginal ?? false}
        submitting={capitalSubmitting}
        onClose={() => setPendingCapital(null)}
        onConfirm={handleCapitalConfirm}
      />
      <ProfitDistributionSidePanel
        isOpen={showProfitDistribution}
        onClose={() => setShowProfitDistribution(false)}
      />
    </>
  );
}