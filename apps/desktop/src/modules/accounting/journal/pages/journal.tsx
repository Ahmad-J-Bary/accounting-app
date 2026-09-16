import { useState, useMemo, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Filter, LayoutList, LayoutGrid, Plus } from "lucide-react";
import { toast } from "sonner";
import { journalEntryService, type JournalFilters } from '@modules/accounting/api/journalEntryService';
import type { JournalEntryDto, JournalType } from "@erp/shared-types";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { Button } from "@shared/ui/button";
import { DateRangePicker } from "@widgets/reports";
import { ConfirmDialog } from "@shared/ui/confirm-dialog";
import { ErrorBoundary } from "@shared/ui/ErrorBoundary";
import { useReportFilters } from "@shared/hooks/useReportFilters";
import { toLocalDateStr } from "@shared/lib/format";
import { JOURNAL_MUTATION_KEYS, invalidateKeys } from "@shared/hooks/queryClient";
import { useTabs } from "@app/providers/TabContext";
import { useLocalization } from "@app/providers/LocalizationProvider";

// Refactored Components & Hooks
import { useDataTable } from '@shared/hooks';
import { JournalTable } from '@modules/accounting/journal/components/JournalTable';
import { partitionJournalEntries, type ReversalContext } from "@modules/accounting/journal/lib/journal-view";
import { JOURNAL_TYPES, journalTypeOptionKey } from "@modules/accounting/journal/lib/journal-config";

type DisplayMode = "two-line" | "one-line";

export default function Journal() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { openTab } = useTabs();
  const { t } = useLocalization();
  const typeParam = searchParams.get('type') as JournalType | null;

  // Date range: same defaults + URL sync as the Account Movements page
  const { filters: dateFilters, setFilters: setDateFilters } = useReportFilters();

  const [journalType, setJournalType] = useState<JournalType>(typeParam || 'GeneralJournal');

  const [displayMode, setDisplayMode] = useState<DisplayMode>(
    () => (localStorage.getItem("journal-display-mode") as DisplayMode) || "one-line"
  );

  const [reversingId, setReversingId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingReverseId, setPendingReverseId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Reporting policy: the normal posted list NEVER contains reversed
  // originals or their contra journals — those live in the separated audit
  // archive shown only when the toggle is on.
  const [showAudit, setShowAudit] = useState(false);

  useEffect(() => {
    localStorage.setItem("journal-display-mode", displayMode);
  }, [displayMode]);

  useEffect(() => {
    // Sync from URL only when the query param exists.
    // Do not force-reset user selection back to GeneralJournal.
    if (typeParam && typeParam !== (journalType || 'GeneralJournal')) {
      setJournalType(typeParam);
    }
  }, [typeParam, journalType]);

  // Fetch ALL entries (official + audit). Each report names its own explicit
  // policy (`@modules/reports/lib/report-policies`): the GENERAL JOURNAL shows
  // only official Posted entries with an accounting effect, the audit archive
  // keeps the full non-operational history (Draft / Cancelled / Reversed /
  // contra). One shared fetch + client-side partition = one source of truth.
  const queryFilters = useMemo<JournalFilters>(() => ({}), []);

  const fetchData = useCallback(() => {
    return journalEntryService.listJournalEntries(queryFilters);
  }, [queryFilters]);

  const {
    filtered: entries,
    data: allEntries,
    loading,
    search,
    setSearch,
  } = useDataTable<JournalEntryDto>({
    queryKey: ["journal-entries", JSON.stringify(queryFilters)],
    fetchData,
    searchFields: ["entry_number", "description"],
  });

  // Reversal-pair lookups resolved over the FULL fetch (pre-search / pre-date),
  // so a pair split by filters still shows its counterpart's entry number.
  const reversalContext = useMemo<ReversalContext>(() => {
    const entryNumberById = new Map<string, string>();
    const reversedById = new Map<string, string>();
    for (const e of allEntries) {
      entryNumberById.set(e.id, e.entry_number);
      if (e.reversal_of_entry_id) {
        reversedById.set(e.reversal_of_entry_id, e.entry_number);
      }
    }
    return { entryNumberById, reversedById };
  }, [allEntries]);

  const displayEntries = useMemo(() => {
    let list = entries;

    // Apply date range filter (local date strings, same as Account Movements)
    if (dateFilters.from_date && dateFilters.to_date) {
      list = list.filter((e) => {
        const d = toLocalDateStr(e.entry_date);
        return d >= dateFilters.from_date && d <= dateFilters.to_date;
      });
    }

    const jt = journalType;
    if (!jt || jt === 'GeneralJournal') return list;

    const ALLOWED: Record<string, Set<string>> = {
      CashJournal:          new Set(['CashJournal', 'DrawingsVoucher', 'CashReceipt', 'CashPayment', 'ExpenseVoucher', 'CashOpeningBalance', 'AccountOpeningBalance', 'SupplierReceiptJournal', 'CustomerPaymentJournal']),
      PurchaseJournal:      new Set(['PurchaseJournal', 'PurchaseCostsJournal']),
      PurchaseCostsJournal: new Set(['PurchaseCostsJournal']),
      CashSalesJournal:     new Set(['CashSalesJournal']),
      CreditSalesJournal:   new Set(['CreditSalesJournal']),
      // ??????? ????????: ??? ??????? + ?? ??? ??? ????? ????? ??
      SalesReturnJournal:   new Set(['SalesReturnJournal']),
      // ??????? ?????????: ??? ??????? + ?? ??? ??? ?? ???? ????? ??
      PurchaseReturnJournal: new Set(['PurchaseReturnJournal']),
    };

    const allowed = ALLOWED[jt];
    if (allowed) return list.filter(e => allowed.has(e.journal_type));

    return list;
  }, [entries, journalType, dateFilters.from_date, dateFilters.to_date]);

  // Split the (date + type filtered) register into the operational posted list
  // and the separated audit archive (Reversed / contra / Draft / Cancelled).
  const { operational, audit } = useMemo(
    () => partitionJournalEntries(displayEntries),
    [displayEntries],
  );

  const journalTitle = JOURNAL_TYPES.find(x => x.value === (journalType || 'GeneralJournal'))
    ? t(journalTypeOptionKey(journalType || 'GeneralJournal'), { namespace: "accounting"})
    : t('journal.fallbackTitle', { namespace: "accounting",  });

  const handleReverseRequest = useCallback((id: string) => {
    setPendingReverseId(id);
    setConfirmOpen(true);
  }, []);

  const handleReverseConfirm = useCallback(async () => {
    if (!pendingReverseId) return;
    setConfirmOpen(false);
    setReversingId(pendingReverseId);
    try {
      const reversal = await journalEntryService.reverseJournalEntry(pendingReverseId);
      toast.success(t("journal.toast.reversePosted", { namespace: "accounting", vars: { number: reversal.entry_number },  }));
      await invalidateKeys(queryClient, JOURNAL_MUTATION_KEYS);
    } catch (e) {
      toast.error(t("journal.toast.reverseFailed", { namespace: "accounting", vars: { error: String(e) },  }));
    } finally {
      setReversingId(null);
      setPendingReverseId(null);
    }
  }, [pendingReverseId, queryClient, t]);

  const handleEntryClick = useCallback((entryId: string) => {
    openTab({
      id: `journal-entry-${entryId}`,
      title: t("journal.toast.entryTab", { namespace: "accounting",  }),
      path: `/journal/${entryId}`,
      closable: true,
    });
  }, [openTab, t]);

  const handleNewEntry = useCallback(() => {
    navigate("/journal/new");
  }, [navigate]);

  return (
    <ErrorBoundary>
      <OperationalTableTemplate
        title={journalTitle}
        toolbar={
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              onClick={handleNewEntry}
              className="h-10 px-4 font-bold bg-primary hover:bg-primary/80 text-white"
            >
              <Plus className="w-4 h-4 ms-2" />
              {t("journal.newEntry", { namespace: "accounting",  })}
            </Button>
            <DateRangePicker
              from={dateFilters.from_date}
              to={dateFilters.to_date}
              onFromChange={(v) => setDateFilters({ from_date: v })}
              onToChange={(v) => setDateFilters({ to_date: v })}
            />
          </div>
        }
        filterBar={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={journalType}
              onValueChange={(val) => setJournalType(val as JournalType)}
            >
              <SelectTrigger className="w-[180px] h-10 bg-white font-bold shadow-sm border-muted">
                <Filter className="w-4 h-4 ms-2 text-muted-foreground" />
                <SelectValue placeholder={t("journal.typePlaceholder", { namespace: "accounting",  })} />
              </SelectTrigger>
              <SelectContent>
                {JOURNAL_TYPES.map((jt) => (
                  <SelectItem key={jt.value} value={jt.value} className="font-bold">{t(journalTypeOptionKey(jt.value), { namespace: "accounting"})}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <button
              type="button"
              onClick={() => setShowAudit(v => !v)}
              className={`px-3 py-2 rounded-lg text-sm font-bold border transition-colors ${
                showAudit
                  ? "bg-slate-800 text-white border-slate-800"
                  : "bg-white text-slate-600 border-muted hover:bg-muted"
              }`}
              title={t("journal.audit.title", { namespace: "accounting",  })}
            >
              {showAudit ? t("journal.audit.hide", { namespace: "accounting",  }) : t("journal.audit.show", { namespace: "accounting",  })}
            </button>

            <div className="flex items-center gap-1 border-muted border rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setDisplayMode("two-line")}
                className={`p-2 transition-colors ${
                  displayMode === "two-line"
                    ? "bg-primary text-white"
                    : "text-muted-foreground hover:bg-muted"
                }`}
                title={t("journal.display.twoLine", { namespace: "accounting",  })}
              >
                <LayoutList className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode("one-line")}
                className={`p-2 transition-colors ${
                  displayMode === "one-line"
                    ? "bg-primary text-white"
                    : "text-muted-foreground hover:bg-muted"
                }`}
                title={t("journal.display.oneLine", { namespace: "accounting",  })}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        }
        tableContent={
          <JournalTable
            key={`journal-table-${journalType || 'GeneralJournal'}-${displayMode}`}
            entries={operational}
            auditEntries={showAudit ? audit : undefined}
            loading={loading}
            search={search}
            onSearchChange={setSearch}
            filters={queryFilters}
            displayMode={displayMode}
            onReverse={handleReverseRequest}
            reversingId={reversingId}
            reversalContext={reversalContext}
            onEntryClick={handleEntryClick}
          />
        }
      >
      </OperationalTableTemplate>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("journal.confirmReverse.title", { namespace: "accounting",  })}
        description={t("journal.confirmReverse.description", { namespace: "accounting",  })}
        confirmLabel={t("journal.confirmReverse.confirm", { namespace: "accounting",  })}
        cancelLabel={t("journal.confirmReverse.cancel", { namespace: "accounting",  })}
        destructive
        onConfirm={handleReverseConfirm}
      />
    </ErrorBoundary>
  );
}
