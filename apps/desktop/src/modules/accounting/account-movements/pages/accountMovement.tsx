import { useState, useMemo, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useTabs } from "@app/providers/TabContext";
import { Printer, PlusCircle, ShoppingCart, ArrowUpRight, ArrowDownLeft, FileText, Landmark } from "lucide-react";
import { formatCurrency } from "@shared/lib/format";
import { DateRangePicker } from "@widgets/reports";
import { useReportFilters } from "@shared/hooks/useReportFilters";
import { accountingService } from "@modules/accounting/api/accountingService";
import { customerService } from "@modules/partners/api/customerService";
import { supplierService } from "@modules/partners/api/supplierService";
import { partnerService } from "@modules/partners/api/partnerService";
import { paymentService } from "@modules/payments/api/paymentService";
import { StatCard } from "@widgets/stats/StatCard";
import type {
  AccountLedgerDto,
  AccountLedgerLineDto,
  AccountDto,
  CustomerDto,
  SupplierDto,
  PartnerDto,
  CreatePaymentRequest
} from "@erp/shared-types";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { AccountMovementTable } from "../components/AccountMovementTable";
import { computeClosingBalance, computeOpeningBalance, getOpeningTotals, isOpeningLine } from "../lib/openingLines";
import { toLocalDateStr } from "@shared/lib/format";
import { useDataTable } from "@shared/hooks";
import { invalidateKeys, PAYMENT_RECEIPT_KEYS, queryClient } from "@shared/hooks/queryClient";
import { toast } from "sonner";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useLocalization } from "@app/providers/LocalizationProvider";
import { ErrorBoundary } from "@shared/ui/ErrorBoundary";
import type { ResponsiveActionItem } from "@widgets/page-header/ResponsiveActions";

import { PaymentForm, PAYMENT_CONFIGS } from "@modules/partners/components/PaymentForm";
import { ExpenseVoucherForm } from "@modules/expenses/components/ExpenseVoucherForm";

function getDescendantIds(accountId: string, accounts: AccountDto[]): string[] {
  const children = accounts.filter(a => a.parent_id === accountId);
  return [accountId, ...children.flatMap(c => getDescendantIds(c.id, accounts))];
}

export default function AccountMovement() {
  const { accountId } = useParams<{ accountId: string }>();
  const { openTab } = useTabs();
  const { baseCurrency } = useCurrencyContext();
  const { t } = useLocalization();
  const [ledger, setLedger] = useState<AccountLedgerDto | null>(null);

  // Date Filters (same defaults + URL sync as the Account Movements report page)
  const { filters: dateFilters, setFilters: setDateFilters } = useReportFilters();

  // Entity Detection
  const [accountType, setAccountType] = useState<'partner' | 'customer' | 'supplier' | 'expense' | 'other'>('other');
  const [linkedEntity, setLinkedEntity] = useState<PartnerDto | CustomerDto | SupplierDto | null>(null);
  const [isVoucherOpen, setIsVoucherOpen] = useState(false);
  const [savingVoucher, setSavingVoucher] = useState(false);

  const {
    loading,
    refresh,
    search,
    setSearch,
  } = useDataTable<AccountLedgerLineDto>({
    queryKey: ["account-ledger-lines", accountId ?? ""],
    fetchData: async () => {
      if (!accountId) return [];
      const allAccounts = await accountingService.getChartOfAccounts();
      const descendantIds = getDescendantIds(accountId, allAccounts);
      const data = await accountingService.getAccountLedger(descendantIds);
      setLedger(data);
      return data.lines;
    },
    searchFields: ["description", "entry_number", "opposite_account_name"]
  });

  // Detect Account Type and Linked Entity
  useEffect(() => {
    const detectType = async () => {
      if (!accountId) return;

      try {
        const accounts = await accountingService.getChartOfAccounts();
        const account = accounts.find(a => a.id === accountId);

        if (!account) return;

        const partners = await partnerService.listPartners();
        const partnerMatch = partners.find(p => p.drawings_account_id === accountId || p.linked_account_id === accountId);

        if (partnerMatch) {
          setLinkedEntity(partnerMatch);
          setAccountType('partner');
        } else if (account.linked_customer_id) {
          const cust = await customerService.get(account.linked_customer_id);
          setLinkedEntity(cust);
          setAccountType('customer');
        } else if (account.linked_supplier_id) {
          const supp = await supplierService.get(account.linked_supplier_id);
          setLinkedEntity(supp);
          setAccountType('supplier');
        } else if (account.code.startsWith('4')) {
          setAccountType('expense');
        } else {
          setAccountType('other');
          setLinkedEntity(null);
        }
      } catch (err) {
        console.error("Failed to detect account type", err);
      }
    };

    detectType();
  }, [accountId]);

  const openingBalance = useMemo(
    () =>
      computeOpeningBalance(
        ledger?.lines || [],
        parseFloat(ledger?.opening_balance_base || "0"),
        dateFilters.from_date,
        dateFilters.to_date,
      ),
    [ledger, dateFilters],
  );

  const openingEntry = useMemo(() => {
    const oe = ledger?.opening_entry || null;
    if (!oe) return null;

    const { from_date, to_date } = dateFilters;
    if (from_date || to_date) {
      const d = toLocalDateStr(oe.date || "");
      if (from_date && d < from_date) return null;
      if (to_date && d > to_date) return null;
    }
    return oe;
  }, [ledger, dateFilters]);

  const openingBalanceDate = useMemo(() => {
    if (dateFilters.from_date) return dateFilters.from_date;
    return openingEntry?.date || "";
  }, [dateFilters.from_date, openingEntry?.date]);

  const { debit: openingDebitTotal, credit: openingCreditTotal } = useMemo(
    () => getOpeningTotals(ledger?.lines || [], dateFilters.from_date, dateFilters.to_date),
    [ledger, dateFilters],
  );

  // Filter lines by account type AND date range
  const { filteredLines, totals } = useMemo(() => {
    const allLines = ledger?.lines || [];

    let lines = allLines;
    if (accountType === 'supplier') {
      lines = lines.filter(l => l.journal_type !== 'PurchaseCostsJournal');
    }

    // Apply date filter if dates are set
    if (dateFilters.from_date && dateFilters.to_date) {
      lines = lines.filter(l => {
        const d = toLocalDateStr(l.date);
        return d >= dateFilters.from_date && d <= dateFilters.to_date;
      });
    }

    const tots = lines.reduce(
      (acc, l) => {
        if (isOpeningLine(l)) return acc;
        acc.debit += parseFloat(l.debit_base || "0");
        acc.credit += parseFloat(l.credit_base || "0");
        return acc;
      },
      { debit: 0, credit: 0 },
    );

    return {
      filteredLines: lines,
      totals: tots,
    };
  }, [ledger, accountType, dateFilters]);

  const closing = useMemo(
    () => computeClosingBalance(openingBalance + totals.debit + openingDebitTotal, totals.credit + openingCreditTotal),
    [openingBalance, totals, openingDebitTotal, openingCreditTotal],
  );

  const openingClosing = useMemo(
    () => computeClosingBalance(openingDebitTotal, openingCreditTotal),
    [openingDebitTotal, openingCreditTotal],
  );

  const symbol = baseCurrency?.symbol || baseCurrency?.code || "";

  const handleSaveVoucher = async (payload: CreatePaymentRequest) => {
    try {
      setSavingVoucher(true);
      await paymentService.createPayment(payload);
      await invalidateKeys(queryClient, PAYMENT_RECEIPT_KEYS);
      await refresh(true);
      toast.success(t("ledger.toast.voucherSaved", { namespace: "accounting",  }));
      setIsVoucherOpen(false);
    } catch (error) {
      toast.error(t("ledger.toast.voucherSaveFailed", { namespace: "accounting", vars: { error: error instanceof Error ? error.message : String(error) } }));
    } finally {
      setSavingVoucher(false);
    }
  };

  const accountTitle = useMemo(
    () => t("ledger.accountTitle", { namespace: "accounting", vars: { name: ledger?.account_name || "..." },  }),
    [ledger?.account_name, t],
  );

  const toolbarActions = useMemo<ResponsiveActionItem[]>(() => {
    const linkedEntityId = linkedEntity?.id;
    const linkedEntityName = linkedEntity?.name;

    switch (accountType) {
      case 'partner':
        return [
          {
            id: "ledger-drawings",
            label: t("ledger.createDrawings", { namespace: "accounting" }),
            icon: PlusCircle,
            priority: "primary",
            onClick: () => setIsVoucherOpen(true),
          },
        ];
      case 'customer':
        return [
          {
            id: "ledger-receipt",
            label: t("ledger.createReceipt", { namespace: "accounting" }),
            icon: PlusCircle,
            priority: "primary",
            onClick: () => setIsVoucherOpen(true),
          },
          {
            id: "ledger-print",
            label: t("ledger.print", { namespace: "accounting" }),
            icon: Printer,
            priority: "secondary",
            variant: "outline",
            onClick: () => window.print(),
          },
          ...(linkedEntityId && linkedEntityName
            ? [{
                id: "ledger-sales",
                label: t("ledger.salesFor", { namespace: "accounting", vars: { name: linkedEntityName } }),
                icon: ShoppingCart,
                priority: "secondary" as const,
                variant: "outline" as const,
                onClick: () => {
                  openTab({
                    id: `sales-cust-${linkedEntityId}`,
                    title: t("ledger.salesTab", { namespace: "accounting", vars: { name: linkedEntityName } }),
                    path: `/sales-invoices?customerId=${linkedEntityId}`,
                    closable: true
                  });
                },
              }]
            : []),
        ];
      case 'supplier':
        return [
          {
            id: "ledger-payment",
            label: t("ledger.createPayment", { namespace: "accounting" }),
            icon: PlusCircle,
            priority: "primary",
            onClick: () => setIsVoucherOpen(true),
          },
          {
            id: "ledger-print",
            label: t("ledger.print", { namespace: "accounting" }),
            icon: Printer,
            priority: "secondary",
            variant: "outline",
            onClick: () => window.print(),
          },
          ...(linkedEntityId && linkedEntityName
            ? [{
                id: "ledger-purchases",
                label: t("ledger.purchasesFor", { namespace: "accounting", vars: { name: linkedEntityName } }),
                icon: ShoppingCart,
                priority: "secondary" as const,
                variant: "outline" as const,
                onClick: () => {
                  openTab({
                    id: `purchase-supp-${linkedEntityId}`,
                    title: t("ledger.purchasesTab", { namespace: "accounting", vars: { name: linkedEntityName } }),
                    path: `/purchase-invoices?supplierId=${linkedEntityId}`,
                    closable: true
                  });
                },
              }]
            : []),
        ];
      case 'expense':
        return [
          {
            id: "ledger-expense",
            label: t("ledger.createExpense", { namespace: "accounting" }),
            icon: PlusCircle,
            priority: "primary",
            onClick: () => setIsVoucherOpen(true),
          },
        ];
      default:
        return [];
    }
  }, [accountType, linkedEntity, openTab, t]);

  const pageContext = useMemo(
    () => (
      <DateRangePicker
        from={dateFilters.from_date}
        to={dateFilters.to_date}
        onFromChange={(v) => setDateFilters({ from_date: v })}
        onToChange={(v) => setDateFilters({ to_date: v })}
        showSeparator={toolbarActions.length > 0}
      />
    ),
    [dateFilters.from_date, dateFilters.to_date, setDateFilters, toolbarActions.length],
  );

  return (
    <ErrorBoundary>
    <OperationalTableTemplate
      title={accountTitle}
      pageContext={pageContext}
      pageContextInline
      pageContextSide="end"
      pageHeaderSingleRow
      toolbarActions={toolbarActions}
      tableContent={
        <div className="flex flex-col h-full">
          {/* Statistics Bar */}
          {ledger && (
            <div className="grid grid-cols-2 gap-2 px-3 pt-3 pb-2 md:grid-cols-4">
              <StatCard label={t("ledger.stat.openingDebit", { namespace: "accounting",  })} value={formatCurrency(openingDebitTotal, symbol)} icon={ArrowUpRight} />
              <StatCard label={t("ledger.stat.openingCredit", { namespace: "accounting",  })} value={formatCurrency(openingCreditTotal, symbol)} icon={ArrowDownLeft} />
              <StatCard
                label={t("ledger.stat.netOpening", { namespace: "accounting", vars: { sign: openingClosing.sign },  })}
                value={formatCurrency(Math.abs(openingClosing.net), symbol)}
                icon={Landmark}
                variant={openingClosing.net >= 0 ? "positive" : "negative"}
              />
              <StatCard
                label={t("ledger.stat.closing", { namespace: "accounting", vars: { sign: closing.sign },  })}
                value={formatCurrency(Math.abs(closing.net), symbol)}
                icon={FileText}
                variant="accent"
              />
            </div>
          )}

          <AccountMovementTable
            lines={filteredLines}
            loading={loading}
            search={search}
            onSearchChange={setSearch}
            accountName={ledger?.account_name || ""}
            openingBalance={openingBalance}
            openingBalanceDate={openingBalanceDate}
            openingEntry={openingEntry}
            openingEntries={ledger?.opening_entries ?? []}
            openingDebitTotal={openingDebitTotal}
            openingCreditTotal={openingCreditTotal}
          />
        </div>
      }
      sidePanel={
        isVoucherOpen && (
          <>
            {accountType === 'partner' && linkedEntity && (
              <PaymentForm
                config={PAYMENT_CONFIGS.partner({ ...(linkedEntity as PartnerDto), drawings_account_id: (linkedEntity as PartnerDto).drawings_account_id ?? undefined })}
                onSave={handleSaveVoucher}
                onClose={() => setIsVoucherOpen(false)}
                saving={savingVoucher}
              />
            )}
            {accountType === 'customer' && linkedEntity && (
              <PaymentForm
                config={PAYMENT_CONFIGS.customer(linkedEntity as CustomerDto)}
                onSave={handleSaveVoucher}
                onClose={() => setIsVoucherOpen(false)}
                saving={savingVoucher}
              />
            )}
            {accountType === 'supplier' && linkedEntity && (
              <PaymentForm
                config={PAYMENT_CONFIGS.supplier(linkedEntity as SupplierDto)}
                onSave={handleSaveVoucher}
                onClose={() => setIsVoucherOpen(false)}
                saving={savingVoucher}
              />
            )}
            {accountType === 'expense' && (
              <ExpenseVoucherForm
                expenseAccount={{
                  id: accountId!,
                  name_ar: ledger?.account_name || "",
                  code: "",
                  parent_id: null,
                  account_type: "Expense",
                  is_system: false,
                  balance: "0",
                  opening_balance: "0"
                } as unknown as AccountDto}
                onSave={handleSaveVoucher}
                onClose={() => setIsVoucherOpen(false)}
                saving={savingVoucher}
              />
            )}
          </>
        )
      }
      isPanelOpen={isVoucherOpen}
    />
    </ErrorBoundary>
  );
}
