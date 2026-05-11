import { useState, useMemo, useCallback, useEffect } from "react";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Plus, Search, Settings2, User, Users, Phone, DollarSign, Wallet, History, ShoppingBag, Printer, Receipt, Download } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@shared/ui/dropdown-menu";

import { customerService } from '@modules/partners/api/customerService';
import { accountingService } from '@modules/accounting/api/accountingService';
import { invoiceService } from '@modules/invoicing/api/invoiceService';
import { paymentService } from '@modules/payments/api/paymentService';
import type { CustomerDto, AccountDto, InvoiceDto, Payment, CreateCustomerRequest, UpdateCustomerRequest } from "@erp/shared-types";

import { useColumnPreferences } from '@shared/hooks';
import { useTabs } from "@app/providers/TabContext";
import { useEntityList } from '@shared/hooks/useEntityList';
import { CustomerTable } from '@modules/partners/components/CustomerTable';

import { OperationalTableTemplate } from '@widgets/templates/OperationalTableTemplate';
import { PartnerDetailPanel } from '@modules/partners/components/PartnerDetailPanel';
import { PartnerFormPanel } from '@modules/partners/components/PartnerFormPanel';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { cn } from "@shared/lib/utils";
import { exportToCSV } from "@shared/lib/export";

export default function Customers() {
  const { currencies, formatMonetaryAmount, baseCurrency, rateMap } = useCurrencyContext();
  const { openTab } = useTabs();
  const [rateMapKey, setRateMapKey] = useState(0);

  useEffect(() => {
    setRateMapKey(k => k + 1);
  }, [rateMap]);

  const {
    filtered: customers,
    loading,
    search,
    setSearch,
    refresh,
    refreshing,
    selectedId,
    setSelectedId,
    selectedItem: selectedCustomer,
    editItem: editCustomer,
    isFormOpen,
    setIsFormOpen,
    saving,
    handleOpenAdd,
    handleOpenEdit,
    handleSave,
    handleDelete,
  } = useEntityList<CustomerDto, CreateCustomerRequest | UpdateCustomerRequest>({
    fetchData: () => customerService.listCustomers(),
    saveData: async (payload) => {
      if ((payload as UpdateCustomerRequest).id) return customerService.updateCustomer(payload as UpdateCustomerRequest);
      return customerService.createCustomer(payload as CreateCustomerRequest);
    },
    deleteData: (id) => customerService.deleteCustomer(id),
    searchFields: ["name", "phone", "code"],
  });

  useEffect(() => {
    if (rateMapKey > 0) {
      refresh(true);
    }
  }, [rateMapKey, refresh]);

  const [customerInvoices, setCustomerInvoices] = useState<InvoiceDto[]>([]);
  const [customerPayments, setCustomerPayments] = useState<Payment[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [accounts, setAccounts] = useState<AccountDto[]>([]);
  
  const availableColumns = useMemo(() => {
    const cols = [
      { id: "#", label: "رقم الحساب" },
      { id: "name", label: "اسم العميل" },
      { id: "phone", label: "رقم الهاتف" },
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
    const base = ["#", "name", "phone"];
    
    if (baseCurrency) {
      base.push(`debit_${baseCurrency.code}`);
      base.push(`credit_${baseCurrency.code}`);
    }

    return base;
  }, [baseCurrency]);

  const { visibleColumns, isVisible, toggleColumn } = useColumnPreferences("customers", defaultVisibleColumns);

  const loadAccounts = useCallback(async () => {
    try {
      const all = await accountingService.getChartOfAccounts();
      setAccounts(all);
    } catch (e) { console.error(e); }
  }, []);

  const fetchDetails = useCallback(async (id: string) => {
    setLoadingDetails(true);
    try {
      const [invoices, payments] = await Promise.all([
        invoiceService.listInvoicesByType("Sales").then(list => list.filter(inv => inv.customer_id === id)),
        paymentService.listPayments(id)
      ]);
      setCustomerInvoices(invoices);
      setCustomerPayments(payments);
    } catch (e) { console.error(e); } finally { setLoadingDetails(false); }
  }, []);

  useEffect(() => {
    const handler = () => handleOpenAdd();
    window.addEventListener("erp:open-new-customer", handler);
    return () => window.removeEventListener("erp:open-new-customer", handler);
  }, [handleOpenAdd]);

  useEffect(() => {
    if (selectedId) {
      fetchDetails(selectedId);
      setIsFormOpen(false);
    }
  }, [selectedId, fetchDetails, setIsFormOpen]);

  const stats = useMemo(() => {
    const totalBalance = customers.reduce((acc, c) => acc + (parseFloat(c.balance || "0")), 0);
    return [
      { label: "إجمالي العملاء", value: customers.length, icon: Users, color: "text-slate-900" },
      { label: "إجمالي الأرصدة", value: formatMonetaryAmount(totalBalance, "base"), icon: Wallet, color: "text-blue-600" },
    ];
  }, [customers, formatMonetaryAmount]);

  const isLoading = loading || refreshing;

  return (
    <OperationalTableTemplate
      title="إدارة العملاء"
      stats={stats}
      toolbar={
        <div className="flex items-center gap-2">
          <Button 
            size="sm" 
            variant="outline"
            className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            disabled={!selectedId}
            onClick={() => selectedCustomer?.account_id && openTab({
              id: `ledger-${selectedCustomer.account_id}`,
              title: `حركة: ${selectedCustomer.name}`,
              path: `/accounting/account-ledger/${selectedCustomer.account_id}`,
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
            onClick={() => openTab({
              id: `sales-customer-${selectedId}`,
              title: `مبيعات: ${selectedCustomer?.name}`,
              path: `/sales-invoices?customerId=${selectedId}`,
              closable: true
            })}
          >
            <ShoppingBag className="w-4 h-4 ml-2 text-blue-500" /> مبيعات العميل
          </Button>

          <Button 
            size="sm" 
            variant="outline"
            className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            disabled={!selectedId}
            onClick={() => openTab({
              id: `statement-${selectedId}`,
              title: `كشف: ${selectedCustomer?.name}`,
              path: `/partners/customer-statement/${selectedId}`,
              closable: true
            })}
          >
            <Printer className="w-4 h-4 ml-2 text-emerald-500" /> طباعة كشف حساب
          </Button>

          <Button 
            size="sm" 
            variant="outline"
            className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            disabled={!selectedId}
            onClick={() => openTab({
              id: `new-receipt-${Date.now()}`,
              title: "سند قبض جديد",
              path: `/payments?type=Receipt&customerId=${selectedId}`,
              closable: true
            })}
          >
            <Receipt className="w-4 h-4 ml-2 text-amber-500" /> إنشاء سند قبض
          </Button>

          <Button 
            size="sm" 
            variant="outline"
            className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            onClick={() => exportToCSV(customers, availableColumns, "العملاء")}
          >
            <Download className="w-4 h-4 ml-2 text-slate-500" /> تصدير إكسل
          </Button>

          <div className="h-6 w-px bg-slate-200 mx-1" />

          <Button size="sm" onClick={handleOpenAdd} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100">
            <Plus className="w-4 h-4 ml-2" /> إضافة عميل جديد
          </Button>
        </div>
      }
      filterBar={
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="بحث بالاسم، الكود، الهاتف..." 
              className="pr-10 h-10 border-slate-200 focus:ring-2 focus:ring-blue-500 transition-all text-sm" 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
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
              {availableColumns.map((col) => (
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
        <CustomerTable 
          customers={customers}
          loading={loading}
          search={search}
          visibleColumns={visibleColumns}
          onView={(c) => setSelectedId(c.id)}
          selectedId={selectedId}
        />
      }
      sidePanel={
        isFormOpen ? (
          <PartnerFormPanel 
            type="customer"
            partner={editCustomer}
            accounts={accounts}
            onSave={handleSave}
            onClose={() => setIsFormOpen(false)}
            saving={saving}
          />
        ) : (
          <PartnerDetailPanel 
            type="customer"
            partner={selectedCustomer}
            onClose={() => setSelectedId(null)}
            onEdit={(p) => { loadAccounts(); handleOpenEdit(p as unknown as CustomerDto); }}
            onDelete={(id, name) => { setSelectedId(null); handleDelete(id); }}
            invoices={customerInvoices}
            payments={customerPayments}
            loadingDetails={loadingDetails}
          />
        )
      }
      isPanelOpen={isFormOpen || !!selectedId}
    />
  );
}
