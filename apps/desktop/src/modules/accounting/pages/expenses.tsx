import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@shared/ui/button";
import { Plus, History, Download, Receipt, Wallet, ClipboardList, DollarSign } from "lucide-react";

import { accountingService } from '@modules/accounting/api/accountingService';
import { SYSTEM_ACCOUNT_IDS, type AccountDto, type SaveAccountCommand } from "@erp/shared-types";


import { useTabs } from "@app/providers/TabContext";
import { useEntityList } from '@shared/hooks/useEntityList';
import { ExpenseTable } from '@modules/accounting/components/ExpenseTable';
import { ExpenseFormPanel } from '@modules/accounting/components/ExpenseFormPanel';
import type { ExpenseFormPayload } from '@modules/accounting/components/ExpenseFormPanel';
import { ExpenseDetailPanel } from '@modules/accounting/components/ExpenseDetailPanel';
import { ExpenseVoucherForm } from '@modules/accounting/components/ExpenseVoucherForm';
import { paymentService } from '@modules/payments/api/paymentService';
import { type CreatePaymentRequest } from "@erp/shared-types";

import { OperationalTableTemplate } from '@widgets/templates/OperationalTableTemplate';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { exportToCSV } from "@shared/lib/export";
import { getExchangeRate } from "@shared/lib/currency-strategy";
import { toast as toastSonner } from "sonner";

// The "مصاريف أخرى" parent account ID in the chart of accounts
const OTHER_EXPENSES_PARENT_ID = SYSTEM_ACCOUNT_IDS.OTHER_EXPENSES;

// Internal payload type that can carry an optional id for updates
type ExpenseSavePayload = SaveAccountCommand & { _id?: string };

export default function Expenses() {
  const { currencies, formatMonetaryAmount, baseCurrency, rateMap } = useCurrencyContext();
  const { openTab } = useTabs();
  const [rateMapKey, setRateMapKey] = useState(0);
  const [expensesParent, setExpensesParent] = useState<AccountDto | null>(null);

  useEffect(() => {
    setRateMapKey(k => k + 1);
  }, [rateMap]);

  // Load the "مصاريف أخرى" parent account by its known ID
  const loadExpensesParent = useCallback(async () => {
    try {
      const all = await accountingService.getChartOfAccounts();
      const parent = all.find(a => a.id === OTHER_EXPENSES_PARENT_ID);
      setExpensesParent(parent || null);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    loadExpensesParent();
  }, [loadExpensesParent]);

  const {
    filtered: expenses,
    loading,
    search,
    setSearch,
    refresh,
    refreshing,
    selectedId,
    setSelectedId,
    selectedItem: selectedExpense,
    editItem: editExpense,
    isFormOpen,
    setIsFormOpen,
    saving,
    handleOpenAdd,
    handleOpenEdit,
    handleSave,
    handleDelete,
  } = useEntityList<AccountDto, ExpenseSavePayload>({
    fetchData: () => accountingService.getExpenseItems(),
    saveData: async (payload) => {
      const { _id, ...cmd } = payload;
      if (_id) return accountingService.updateAccount(_id, cmd as SaveAccountCommand);
      return accountingService.createAccount(cmd as SaveAccountCommand);
    },
    deleteData: (id) => accountingService.deleteAccount(id),
    searchFields: ["name_ar", "code"],
  });

  const [isVoucherOpen, setIsVoucherOpen] = useState(false);
  const [voucherSaving, setVoucherSaving] = useState(false);

  const handleSaveVoucher = async (payload: CreatePaymentRequest) => {
    try {
      setVoucherSaving(true);
      await paymentService.createPayment(payload);
      await refresh(true);
      toastSonner.success("تم تسجيل سند الصرف بنجاح");
      setIsVoucherOpen(false);
    } catch (error) {
      toastSonner.error("فشل تسجيل السند: " + error);
    } finally {
      setVoucherSaving(false);
    }
  };

  useEffect(() => {
    if (rateMapKey > 0) {
      refresh(true);
    }
  }, [rateMapKey, refresh]);

  // Map ExpenseFormPayload → ExpenseSavePayload and call handleSave
  const handleExpenseSave = useCallback(async (payload: ExpenseFormPayload) => {
    const exchangeRate = getExchangeRate(payload.currency, rateMap, baseCurrency?.code);
    const cmd: ExpenseSavePayload = {
      _id: payload.id,
      code: payload.code,
      name_ar: payload.name_ar,
      name_en: payload.name_en,
      account_type: "Expenses",
      parent_id: expensesParent?.id ?? null,
      category: "Detail",
      level: (expensesParent?.level ?? 1) + 1,
      opening_balance: payload.opening_balance,
      notes: payload.notes,
      is_active: true,
      is_default: false,
      debit: payload.debit,
      credit: payload.credit,
      currency: payload.currency,
      exchange_rate: exchangeRate.toString(),
    };
    await handleSave(cmd);
  }, [expensesParent, handleSave, baseCurrency, rateMap]);

  const stats = useMemo(() => {
    const totalDebit = expenses.reduce((acc, e) => acc + parseFloat(e.debit || "0"), 0);
    return [
      { label: "إجمالي بنود المصاريف", value: expenses.length, icon: ClipboardList, color: "text-slate-900" },
      { label: "إجمالي المصروفات", value: formatMonetaryAmount(totalDebit, "base"), icon: Wallet, color: "text-red-600" },
    ];
  }, [expenses, formatMonetaryAmount]);

  const isLoading = loading || refreshing;

  return (
    <OperationalTableTemplate
      title="بنود المصاريف"
      stats={stats}
      toolbar={
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            disabled={!selectedId || !selectedExpense?.id}
            onClick={() => selectedExpense?.id && openTab({
              id: `ledger-${selectedExpense.id}`,
              title: `حركة: ${selectedExpense.name_ar}`,
              path: `/accounting/account-ledger/${selectedExpense.id}`,
              closable: true
            })}
          >
            <History className="w-4 h-4 ml-2 text-slate-500" /> حركة اليومية
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            disabled={!selectedId}
            onClick={() => {
              setIsVoucherOpen(true);
              setIsFormOpen(false);
            }}
          >
            <DollarSign className="w-4 h-4 ml-2 text-rose-500" /> إنشاء سند صرف
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            onClick={() => {
              toastSonner.info("جاري التصدير...");
            }}
          >
            <Download className="w-4 h-4 ml-2 text-slate-500" /> تصدير إكسل
          </Button>

          <div className="h-6 w-px bg-slate-200 mx-1" />

          <Button size="sm" onClick={handleOpenAdd} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 font-bold">
            <Plus className="w-4 h-4 ml-2" /> إضافة بند مصروف
          </Button>
        </div>
      }
      tableContent={
        <ExpenseTable
          expenses={expenses}
          loading={isLoading}
          search={search}
          onSearchChange={setSearch}
          onView={(acc) => setSelectedId(acc.id)}
          onEdit={(acc) => handleOpenEdit(acc)}
          onDelete={(id) => { setSelectedId(null); handleDelete(id); }}
          onJournal={(acc) => acc.id && openTab({
            id: `ledger-${acc.id}`,
            title: `حركة: ${acc.name_ar}`,
            path: `/accounting/account-ledger/${acc.id}`,
            closable: true
          })}
          onDocument={(acc) => { setSelectedId(acc.id); setIsVoucherOpen(true); setIsFormOpen(false); }}
          selectedId={selectedId}
          parentCode={expensesParent?.code}
        />
      }
      sidePanel={
        isFormOpen ? (
          <ExpenseFormPanel
            expense={editExpense}
            expenseItems={expenses}
            parentCode={expensesParent?.code}
            onSave={handleExpenseSave}
            onClose={() => setIsFormOpen(false)}
            saving={saving}
          />
        ) : isVoucherOpen && selectedExpense ? (
          <ExpenseVoucherForm
            expenseAccount={selectedExpense}
            onSave={handleSaveVoucher}
            onClose={() => setIsVoucherOpen(false)}
            saving={voucherSaving}
          />
        ) : (
          <ExpenseDetailPanel
            expense={selectedExpense!}
            onClose={() => setSelectedId(null)}
            onEdit={e => handleOpenEdit(e)}
            onDelete={id => { setSelectedId(null); handleDelete(id); }}
            parentCode={expensesParent?.code}
          />
        )
      }
      isPanelOpen={isFormOpen || isVoucherOpen || !!selectedId}
    />
  );
}
