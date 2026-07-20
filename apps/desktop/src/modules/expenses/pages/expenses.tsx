import { useState, useEffect, useCallback } from "react";
import { Button } from "@shared/ui/button";
import { Plus, History, Download, DollarSign } from "lucide-react";

import { accountingService } from '@modules/accounting/api/accountingService';
import { SYSTEM_ACCOUNT_IDS, type AccountDto, type SaveAccountCommand } from "@erp/shared-types";


import { useTabs } from "@app/providers/TabContext";
import { useEntityList } from '@shared/hooks/useEntityList';
import { ExpenseTable } from '@modules/expenses/components/ExpenseTable';
import { ExpenseFormPanel } from '@modules/expenses/components/ExpenseFormPanel';
import type { ExpenseFormPayload } from '@modules/expenses/components/ExpenseFormPanel';
import { ExpenseDetailPanel } from '@modules/expenses/components/ExpenseDetailPanel';
import { ExpenseVoucherForm } from '@modules/expenses/components/ExpenseVoucherForm';
import { paymentService } from '@modules/payments/api/paymentService';
import { type CreatePaymentRequest } from "@erp/shared-types";

import { OperationalTableTemplate } from '@widgets/templates/OperationalTableTemplate';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { getExchangeRate } from "@shared/lib/currency-strategy";
import { useExcelExport } from "@shared/hooks";
import { currencyAmountCols } from "@shared/lib/excel/column-helpers";
import type { ExcelExportColumn } from "@shared/lib/excel";
import { toast } from "sonner";

// The "مصاريف أخرى" parent account ID in the chart of accounts
const OTHER_EXPENSES_PARENT_ID = SYSTEM_ACCOUNT_IDS.OTHER_EXPENSES;

// Internal payload type that can carry an optional id for updates
type ExpenseSavePayload = SaveAccountCommand & { _id?: string };

export default function Expenses() {
  const { baseCurrency, rateMap, currencies, formatAmount, toBase } = useCurrencyContext();
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
    queryKey: ["accounting", "expenseItems"],
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
      toast.success("تم تسجيل سند الصرف بنجاح");
      setIsVoucherOpen(false);
    } catch (error) {
      toast.error("فشل تسجيل السند: " + error);
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

  const { exportData } = useExcelExport();

  const handleExport = useCallback(async () => {
    const currCols = currencyAmountCols("balance", "الرصيد", (row) => {
      const c = row as unknown as AccountDto;
      const absBal = Math.abs(Number(c.balance || 0));
      if (absBal === 0) return 0;
      return toBase(absBal, c.currency || "");
    }, currencies, formatAmount, "", true);
    const summary: Record<string, 'sum' | 'subtotal' | 'average' | null> = {};
    currencies.forEach(curr => { summary[`balance_${curr.code}`] = 'subtotal'; });
    const exportColumns: ExcelExportColumn[] = [
      { id: "code", label: "#", accessor: (row) => {
        const c = row as unknown as AccountDto;
        const prefix = expensesParent?.code || "";
        const suffix = prefix && c.code?.startsWith(prefix) ? c.code.substring(prefix.length) : c.code || "";
        return suffix ? parseInt(suffix) || 0 : 0;
      }, numeric: true },
      { id: "name", label: "اسم البند", accessor: (row) => String((row as unknown as AccountDto).name_ar ?? "") },
      { id: "status", label: "حالة الحساب", accessor: (row) => {
        const c = row as unknown as AccountDto;
        const bal = c.debit !== undefined && c.credit !== undefined
          ? Number(c.debit || 0) - Number(c.credit || 0)
          : Number(c.balance || 0);
        if (bal === 0) return "";
        return bal > 0 ? "مدين" : "دائن";
      } },
      ...currCols,
    ];
    await exportData(expenses as unknown as Record<string, unknown>[], exportColumns, "بنود المصاريف", { sheetName: "بنود المصاريف", autoFilter: true, summary, summaryLabel: "المجموع" });
  }, [expenses, currencies, formatAmount, toBase, expensesParent, exportData]);

  const isLoading = loading || refreshing;

  return (
    <OperationalTableTemplate
      title="بنود المصاريف"
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
            onClick={handleExport}
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
