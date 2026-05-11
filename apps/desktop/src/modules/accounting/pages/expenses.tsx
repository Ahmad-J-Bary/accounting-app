import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Plus, Search, Settings2, History, Download, Receipt, Wallet, ClipboardList } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@shared/ui/dropdown-menu";

import { accountingService } from '@modules/accounting/api/accountingService';
import type { AccountDto, SaveAccountCommand } from "@erp/shared-types";

import { useColumnPreferences } from '@shared/hooks';
import { useTabs } from "@app/providers/TabContext";
import { useEntityList } from '@shared/hooks/useEntityList';
import { ExpenseTable } from '@modules/accounting/components/ExpenseTable';
import { ExpenseFormPanel } from '@modules/accounting/components/ExpenseFormPanel';
import type { ExpenseFormPayload } from '@modules/accounting/components/ExpenseFormPanel';
import { ExpenseDetailPanel } from '@modules/accounting/components/ExpenseDetailPanel';

import { OperationalTableTemplate } from '@widgets/templates/OperationalTableTemplate';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { exportToCSV } from "@shared/lib/export";

// The "مصاريف أخرى" parent account ID in the chart of accounts
const OTHER_EXPENSES_PARENT_ID = "00000000-0000-0000-0000-000000000043";

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

  useEffect(() => {
    if (rateMapKey > 0) {
      refresh(true);
    }
  }, [rateMapKey, refresh]);

  // Map ExpenseFormPayload → ExpenseSavePayload and call handleSave
  const handleExpenseSave = useCallback(async (payload: ExpenseFormPayload) => {
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
    };
    await handleSave(cmd);
  }, [expensesParent, handleSave]);

  const availableColumns = useMemo(() => {
    const cols = [
      { id: "#", label: "رقم الحساب" },
      { id: "name", label: "اسم البند" },
    ];
    currencies.forEach(curr => {
      const symbol = curr.symbol || curr.code;
      cols.push({ id: `debit_${curr.code}`, label: `المدين (${symbol})` });
    });
    currencies.forEach(curr => {
      const symbol = curr.symbol || curr.code;
      cols.push({ id: `credit_${curr.code}`, label: `الدائن (${symbol})` });
    });
    return cols;
  }, [currencies]);

  const defaultVisibleColumns = useMemo(() => {
    const base = ["#", "name"];
    if (baseCurrency) {
      base.push(`debit_${baseCurrency.code}`);
      base.push(`credit_${baseCurrency.code}`);
    }
    return base;
  }, [baseCurrency]);

  const { visibleColumns, isVisible, toggleColumn } = useColumnPreferences("expenses", defaultVisibleColumns);

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
            disabled={!selectedId}
            onClick={() => selectedExpense && openTab({
              id: `ledger-${selectedExpense.id}`,
              title: `حركة: ${selectedExpense.name_ar}`,
              path: `/accounting/account-ledger/${selectedExpense.id}`,
              closable: true,
            })}
          >
            <History className="w-4 h-4 ml-2 text-slate-500" /> حركة اليومية
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            disabled={!selectedId}
            onClick={() => openTab({
              id: `new-payment-${Date.now()}`,
              title: "سند صرف جديد",
              path: `/payments?type=Payment&accountId=${selectedId}`,
              closable: true,
            })}
          >
            <Receipt className="w-4 h-4 ml-2 text-amber-500" /> إنشاء سند صرف
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            onClick={() => exportToCSV(expenses, availableColumns, "بنود المصاريف")}
          >
            <Download className="w-4 h-4 ml-2 text-slate-500" /> تصدير إكسل
          </Button>

          <div className="h-6 w-px bg-slate-200 mx-1" />

          <Button size="sm" onClick={handleOpenAdd} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100">
            <Plus className="w-4 h-4 ml-2" /> إضافة بند مصروف
          </Button>
        </div>
      }
      filterBar={
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="بحث بالاسم، رقم الحساب..."
              className="pr-10 h-10 border-slate-200 focus:ring-2 focus:ring-blue-500 transition-all text-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-10 w-10 bg-white border-slate-200">
                <Settings2 className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[220px] max-h-[450px] overflow-y-auto shadow-xl border-slate-200">
              <DropdownMenuLabel className="text-right text-xs font-black uppercase text-slate-400 tracking-widest">تخصيص الأعمدة</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {availableColumns.map(col => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={isVisible(col.id)}
                  onCheckedChange={() => toggleColumn(col.id)}
                  className="text-right flex-row-reverse gap-2 text-xs font-bold py-2"
                >
                  {col.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
      tableContent={
<ExpenseTable
            expenses={expenses}
            loading={isLoading}
            search={search}
            visibleColumns={visibleColumns}
            onView={e => setSelectedId(e.id)}
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
        ) : (
          <ExpenseDetailPanel
            expense={selectedExpense!}
            onClose={() => setSelectedId(null)}
            onEdit={e => handleOpenEdit(e)}
            onDelete={id => { setSelectedId(null); handleDelete(id); }}
          />
        )
      }
      isPanelOpen={isFormOpen || !!selectedId}
    />
  );
}
