import { useState, useMemo, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useTabs } from "@app/providers/TabContext";
import { Button } from "@shared/ui/button";
import { Printer, PlusCircle, ShoppingCart, ArrowUpRight, ArrowDownLeft, BookOpen, FileText, Landmark } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { formatCurrency } from "@shared/lib/format";
import { DateRangePicker } from "@widgets/reports";
import { useReportFilters } from "@shared/hooks/useReportFilters";
import { accountingService } from "@modules/accounting/api/accountingService";
import { customerService } from "@modules/partners/api/customerService";
import { supplierService } from "@modules/partners/api/supplierService";
import { partnerService } from "@modules/partners/api/partnerService";
import { paymentService } from "@modules/payments/api/paymentService";
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
import { getOpeningCreationDate, getOpeningTotals, isOpeningLine } from "../lib/openingLines";
import { useDataTable } from "@shared/hooks";
import { toast } from "sonner";
import { useCurrencyContext } from "@app/providers/CurrencyContext";

import { PaymentForm, PAYMENT_CONFIGS } from "@modules/partners/components/PaymentForm";
import { ExpenseVoucherForm } from "@modules/expenses/components/ExpenseVoucherForm";

function getDescendantIds(accountId: string, accounts: AccountDto[]): string[] {
  const children = accounts.filter(a => a.parent_id === accountId);
  return [accountId, ...children.flatMap(c => getDescendantIds(c.id, accounts))];
}

const OUTLINE_BUTTON_CLASS = "border-slate-200 text-slate-700 hover:bg-slate-50";
const TOOLBAR_CLASS_BY_TYPE = {
  partner: "bg-amber-600 hover:bg-amber-700 text-white",
  customer: "bg-blue-600 hover:bg-blue-700 text-white",
  supplier: "bg-emerald-600 hover:bg-emerald-700 text-white",
  expense: "bg-red-600 hover:bg-red-700 text-white",
} as const;

export default function AccountMovement() {
  const { accountId } = useParams<{ accountId: string }>();
  const { openTab } = useTabs();
  const { baseCurrency } = useCurrencyContext();
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
    queryKey: ["account-ledger", accountId ?? ""],
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

  const openingBalance = useMemo(() => {
    let absOpening = parseFloat(ledger?.opening_balance_base || "0");

    // The opening balance only exists once its opening entry was created.
    // If the period ends before that creation date, the balance did not
    // exist yet — hide it instead of "going back in time".
    if (dateFilters.to_date) {
      const created = getOpeningCreationDate(ledger?.opening_entry, ledger?.lines || []);
      if (created && created > dateFilters.to_date) {
        absOpening = 0;
      }
    }

    if (!dateFilters.from_date) return absOpening;

    const allLines = ledger?.lines || [];
    let debitBefore = 0;
    let creditBefore = 0;
    for (const line of allLines) {
      if (isOpeningLine(line)) continue;
      const d = line.date.split("T")[0];
      if (d < dateFilters.from_date) {
        debitBefore += parseFloat(line.debit_base || "0");
        creditBefore += parseFloat(line.credit_base || "0");
      }
    }
    return absOpening + debitBefore - creditBefore;
  }, [ledger, dateFilters]);

  const openingEntry = useMemo(() => {
    const oe = ledger?.opening_entry || null;
    if (!oe) return null;

    const { from_date, to_date } = dateFilters;
    if (from_date || to_date) {
      const d = (oe.date || "").split("T")[0];
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
    () => getOpeningTotals(ledger?.lines || [], ledger?.opening_entries ?? [], dateFilters.from_date, dateFilters.to_date),
    [ledger, dateFilters],
  );

  // Filter lines by account type AND date range
  const { filteredLines, totals, periodClosingBalance } = useMemo(() => {
    const allLines = ledger?.lines || [];

    let lines = allLines;
    if (accountType === 'supplier') {
      lines = lines.filter(l => l.journal_type !== 'PurchaseCostsJournal');
    }

    // Apply date filter if dates are set
    if (dateFilters.from_date && dateFilters.to_date) {
      lines = lines.filter(l => {
        const d = l.date.split("T")[0];
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
      periodClosingBalance: openingBalance + tots.debit - tots.credit,
    };
  }, [ledger, accountType, dateFilters, openingBalance]);

  const symbol = baseCurrency?.symbol || baseCurrency?.code || "";

  const handleSaveVoucher = async (payload: CreatePaymentRequest) => {
    try {
      setSavingVoucher(true);
      await paymentService.createPayment(payload);
      await refresh(true);
      toast.success("تم تسجيل السند بنجاح");
      setIsVoucherOpen(false);
    } catch (error) {
      toast.error("فشل تسجيل السند: " + error);
    } finally {
      setSavingVoucher(false);
    }
  };

  const accountTitle = useMemo(
    () => `حركة الحساب: ${ledger?.account_name || "..."}`,
    [ledger?.account_name],
  );

  const toolbarButtons = useMemo(() => {
    const commonPrint = (
      <Button key="print" variant="outline" size="sm" className={OUTLINE_BUTTON_CLASS}>
        <Printer className="w-4 h-4 ml-2 text-blue-500" />
        طباعة كشف حساب
      </Button>
    );

    const linkedEntityId = linkedEntity?.id;
    const linkedEntityName = linkedEntity?.name;

    switch (accountType) {
      case 'partner':
        return [
          <Button key="drawings" size="sm" onClick={() => setIsVoucherOpen(true)} className={TOOLBAR_CLASS_BY_TYPE.partner}>
            <PlusCircle className="w-4 h-4 ml-2" />
            إنشاء سند مسحوبات جديد
          </Button>
        ];
      case 'customer':
        return [
          <Button key="receipt" size="sm" onClick={() => setIsVoucherOpen(true)} className={TOOLBAR_CLASS_BY_TYPE.customer}>
            <PlusCircle className="w-4 h-4 ml-2" />
            إنشاء سند قبض جديد
          </Button>,
          commonPrint,
          linkedEntityId && linkedEntityName ? (
            <Button
              key="sales"
              variant="outline"
              size="sm"
              onClick={() => {
                openTab({
                  id: `sales-cust-${linkedEntityId}`,
                  title: `مبيعات ${linkedEntityName}`,
                  path: `/sales-invoices?customerId=${linkedEntityId}`,
                  closable: true
                });
              }}
              className={OUTLINE_BUTTON_CLASS}
            >
              <ShoppingCart className="w-4 h-4 ml-2 text-blue-500" />
              المبيعات للعميل {linkedEntityName}
            </Button>
          ) : null
        ].filter(Boolean);
      case 'supplier':
        return [
          <Button key="payment" size="sm" onClick={() => setIsVoucherOpen(true)} className={TOOLBAR_CLASS_BY_TYPE.supplier}>
            <PlusCircle className="w-4 h-4 ml-2" />
            إنشاء سند دفع جديد
          </Button>,
          commonPrint,
          linkedEntityId && linkedEntityName ? (
            <Button
              key="purchases"
              variant="outline"
              size="sm"
              onClick={() => {
                openTab({
                  id: `purchase-supp-${linkedEntityId}`,
                  title: `مشتريات ${linkedEntityName}`,
                  path: `/purchase-invoices?supplierId=${linkedEntityId}`,
                  closable: true
                });
              }}
              className={OUTLINE_BUTTON_CLASS}
            >
              <ShoppingCart className="w-4 h-4 ml-2 text-emerald-500" />
              المشتريات للمورد {linkedEntityName}
            </Button>
          ) : null
        ].filter(Boolean);
      case 'expense':
        return [
          <Button key="expense" size="sm" onClick={() => setIsVoucherOpen(true)} className={TOOLBAR_CLASS_BY_TYPE.expense}>
            <PlusCircle className="w-4 h-4 ml-2" />
            إنشاء سند صرف جديد
          </Button>
        ];
      default:
        return [];
    }
  }, [accountType, linkedEntity, openTab]);

  return (
    <OperationalTableTemplate
      title={accountTitle}
      toolbar={
        <div className="flex items-center gap-2 flex-wrap">
          {toolbarButtons}

          <DateRangePicker
            from={dateFilters.from_date}
            to={dateFilters.to_date}
            onFromChange={(v) => setDateFilters({ from_date: v })}
            onToChange={(v) => setDateFilters({ to_date: v })}
            showSeparator={toolbarButtons.length > 0}
          />
        </div>
      }
      tableContent={
        <div className="flex flex-col h-full">
          {/* Statistics Bar */}
          {ledger && (
            <div className="grid grid-cols-5 gap-3 px-4 pt-4 pb-2">
              <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100 flex items-center gap-3">
                <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                  <Landmark className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest block">الافتتاحي</span>
                  <div className="text-sm font-black text-indigo-900 tabular-nums">{formatCurrency(openingBalance, symbol)}</div>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                  <ArrowUpRight className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">المدين</span>
                  <div className="text-sm font-black text-slate-900 tabular-nums">{formatCurrency(totals.debit, symbol)}</div>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center gap-3">
                <div className="w-9 h-9 bg-emerald-600 rounded-lg flex items-center justify-center text-white">
                  <ArrowDownLeft className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">الدائن</span>
                  <div className="text-sm font-black text-slate-900 tabular-nums">{formatCurrency(totals.credit, symbol)}</div>
                </div>
              </div>

              <div className={cn(
                "p-3 rounded-xl border flex items-center gap-3",
                (totals.debit - totals.credit) >= 0
                  ? "bg-amber-50 border-amber-100"
                  : "bg-red-50 border-red-100"
              )}>
                <div className={cn(
                  "w-9 h-9 rounded-lg flex items-center justify-center text-white",
                  (totals.debit - totals.credit) >= 0 ? "bg-amber-600" : "bg-red-600"
                )}>
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">صافي</span>
                  <div className={cn(
                    "text-sm font-black tabular-nums",
                    (totals.debit - totals.credit) >= 0 ? "text-amber-700" : "text-red-700"
                  )}>
                    {formatCurrency(totals.debit - totals.credit, symbol)}
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex items-center gap-3">
                <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center text-white backdrop-blur-md">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">الختامي</span>
                  <div className="text-sm font-black text-white tabular-nums">{formatCurrency(periodClosingBalance, symbol)}</div>
                </div>
              </div>
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
  );
}
