import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Plus,
  TrendingUp,
  PieChart as PieChartIcon,
  Coins,
} from "lucide-react";
import { partnerService, type PartnerDto, type PartnerRequest } from '@modules/partners/api/partnerService';
import { settingsService } from '@modules/core/api/settingsService';

import { OperationalTableTemplate } from '@widgets/templates/OperationalTableTemplate';
import { PartnerTable } from '../components/PartnerTable';
import { PartnersSidePanel } from '../components/PartnersSidePanel';
import { ChartCard } from '@modules/partners/components/ChartCard';
import { useDataTable, useExportSetup } from '@shared/hooks';
import { executeExport, type ExcelExportColumn } from "@shared/lib/excel";
import { useTabs } from "@app/providers/TabContext";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@shared/ui/select";
import { toast } from "sonner";
import { paymentService } from '@modules/payments/api/paymentService';
import { type CreatePaymentRequest } from '@erp/shared-types';
import { usePartnerRatios, type PartnerWithRatios } from '@modules/partners/hooks/usePartnerRatios';
import { queryClient, PARTNER_MUTATION_KEYS, invalidateKeys } from "@shared/hooks/queryClient";
import { START_MODE_EXISTING } from "@modules/opening-balance/lib/wizard-types";
import { useLocalization } from "@app/providers/LocalizationProvider";
import type { ResponsiveActionItem } from "@widgets/page-header/ResponsiveActions";
import { CapitalSourceDialog, type CapitalSource } from "../components/CapitalSourceDialog";

export default function Partners() {
  const { t } = useLocalization();
  const { openTab } = useTabs();
  const { formatAmount, baseCurrency, currencies } = useCurrencyContext();
  const { exportData, ratesSheet } = useExportSetup();
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
    errorLabel: t("page.loadError", { namespace: "partners",  }),
  });

  const [activePanel, setActivePanel] = useState<"edit" | "drawings" | "view" | "profit-distribution" | null>(null);
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

  useEffect(() => {
    settingsService.getSettings()
      .then((s) => setStartMode(s.accounting_start_mode || START_MODE_EXISTING))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (searchParams.get("profit-distribution") === "open") {
      setActivePanel("profit-distribution");
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
        toast.success(t("toast.updateSuccess", { namespace: "partners",  }));
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
            ? t("toast.addedOpening", { namespace: "partners",  })
            : t("toast.added", { namespace: "partners",  }),
        );
      }
      setActivePanel(null);
      await invalidateKeys(queryClient, PARTNER_MUTATION_KEYS);
      refresh(true);
    } catch (error) {
      toast.error(t("toast.genericError", { namespace: "partners", vars: { error: String(error) },  }));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm(t("confirm.delete", { namespace: "partners",  }))) return;
    try {
      await partnerService.deletePartner(id);
      toast.success(t("toast.deleted", { namespace: "partners",  }));
      await invalidateKeys(queryClient, PARTNER_MUTATION_KEYS);
      refresh(true);
    } catch (error) {
      toast.error(t("toast.deleteError", { namespace: "partners", vars: { error: String(error) },  }));
    }
  }, [refresh, t]);

  const handleSaveDrawings = async (payload: CreatePaymentRequest) => {
    if (!selectedPartner?.drawings_account_id) {
      toast.error(t("toast.drawingsAccountNotConfigured", { namespace: "partners",  }));
      return;
    }
    try {
      setDrawingsSaving(true);
      await paymentService.createPayment(payload);
      await invalidateKeys(queryClient, PARTNER_MUTATION_KEYS);
      await refresh(true);
      setActivePanel(null);
      toast.success(t("toast.drawingsVoucherSaved", { namespace: "partners",  }));
    } catch (error) {
      toast.error(t("toast.voucherSaveFailed", { namespace: "partners", vars: { error: String(error) },  }));
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
      toast.success(t("toast.capitalSaved", { namespace: "partners",  }));
    } catch (error) {
      toast.error(t("toast.capitalFailed", { namespace: "partners", vars: { error: String(error) },  }));
    } finally {
      setCapitalSubmitting(false);
    }
  };

  const isLoading = loading;

  const handleExport = useCallback(async () => {
    const exportColumns: ExcelExportColumn[] = [
      { id: "name", label: t("table.name", { namespace: "partners" }), accessor: (row) => String((row as unknown as PartnerWithRatios).name ?? "") },
      { id: "capital_ratio", label: t("table.capitalRatio", { namespace: "partners" }), accessor: (row) => `${((row as unknown as PartnerWithRatios).calculatedCapitalRatio ?? 0).toFixed(2)}%` },
      { id: "ratio", label: t("table.profitRatio", { namespace: "partners" }), accessor: (row) => `${((row as unknown as PartnerWithRatios).calculatedRatio ?? 0).toFixed(2)}%` },
      ...currencies.map((curr) => ({
        id: `amount_${curr.code}`,
        label: `${t("table.amount", { namespace: "partners" })} (${curr.symbol || curr.code})`,
        accessor: (row: Record<string, unknown>) => {
          const p = row as unknown as PartnerWithRatios;
          return p.displayAmountBase ? formatAmount(p.displayAmountBase, { currencyCode: curr.code }) : "";
        },
      })),
      { id: "phone", label: t("table.phone", { namespace: "partners" }), accessor: (row) => String((row as Record<string, unknown>).phone ?? "") },
      { id: "notes", label: t("table.notes", { namespace: "partners" }), accessor: (row) => String((row as unknown as PartnerWithRatios).notes ?? "") },
    ];

    await executeExport(exportData, {
      sheetName: t("page.title", { namespace: "partners" }),
      filename: t("page.title", { namespace: "partners" }),
      data: partnersWithRatios as unknown as Record<string, unknown>[],
      columns: exportColumns,
      currencyRatesSheet: ratesSheet,
    });
  }, [exportData, ratesSheet, t, currencies, formatAmount, partnersWithRatios]);

  const toolbarActions = useMemo<ResponsiveActionItem[]>(() => [
    {
      id: "add-partner",
      label: t("toolbar.addPartner", { namespace: "partners" }),
      icon: Plus,
      priority: "primary",
      onClick: () => {
        setEditPartner(null);
        setActivePanel("edit");
        setSelectedId("new");
      },
    },
    {
      id: "partner-statement",
      label: t("toolbar.statement", { namespace: "partners" }),
      icon: TrendingUp,
      priority: "secondary",
      variant: "outline",
      onClick: () =>
        openTab({
          id: "partner-rights",
          title: t("page.statementTab", { namespace: "partners" }),
          path: "/accounting/reports/partners",
          closable: true,
        }),
    },
    {
      id: "profit-distribution",
      label: t("toolbar.profitDistribution", { namespace: "partners" }),
      icon: Coins,
      priority: "secondary",
      variant: "outline",
      onClick: () => setActivePanel("profit-distribution"),
    },
  ], [openTab, t]);

  return (
    <>
      <OperationalTableTemplate
      title={t("page.title", { namespace: "partners",  })}
      toolbarActions={toolbarActions}

      tableContent={
        <PartnerTable
          partners={partnersWithRatios}
          loading={isLoading}
          search={search}
          onSearchChange={setSearch}
          onExportExcel={handleExport}
          filterBar={
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider whitespace-nowrap">{t("filter.distribution", { namespace: "partners",  })}</span>
              <Select value={globalStrategy} onValueChange={persistStrategy}>
                <SelectTrigger className="w-[120px] h-8 bg-card font-bold shadow-xs border-border text-xs text-foreground">
                  <SelectValue placeholder={t("filter.select", { namespace: "partners",  })} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto" className="text-xs font-bold">{t("filter.strategyAuto", { namespace: "partners",  })}</SelectItem>
                  <SelectItem value="BasedOnCapitalLocal" className="text-xs font-bold">{t("filter.strategyCapitalLocal", { namespace: "partners",  })}</SelectItem>
                  <SelectItem value="BasedOnCapitalOriginal" className="text-xs font-bold">{t("filter.strategyCapitalOriginal", { namespace: "partners",  })}</SelectItem>
                  <SelectItem value="Manual" className="text-xs font-bold">{t("filter.strategyManual", { namespace: "partners",  })}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
          onView={(p) => { setSelectedId(p.id); setActivePanel("view"); }}
          onEdit={(p) => { setEditPartner(p); setSelectedId(p.id); setActivePanel("edit"); }}
          onDelete={(id) => handleDelete(id)}
          onJournal={(p) => p.drawings_account_id ? openTab({
            id: `ledger-${p.drawings_account_id}`,
            title: t("page.ledgerTab", { namespace: "partners", vars: { name: p.name },  }),
            path: `/accounting/account-ledger/${p.drawings_account_id}`,
            closable: true
          }) : toast.error(t("filter.noDrawingsAccount", { namespace: "partners",  }))}
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
          <ChartCard title={t("chart.capitalShares", { namespace: "partners",  })} icon={PieChartIcon} data={partnersWithRatios.map(p => ({ name: p.name, value: p.calculatedCapitalRatio }))} formatter={(v: number) => `${v.toFixed(2)}%`} />
          <ChartCard title={t("chart.profitDistribution", { namespace: "partners",  })} icon={TrendingUp} data={partnersWithRatios.map(p => ({ name: p.name, value: p.calculatedRatio }))} formatter={(v: number) => `${v.toFixed(2)}%`} />
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

    </>
  );
}
