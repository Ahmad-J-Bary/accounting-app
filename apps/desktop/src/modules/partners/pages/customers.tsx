import { useState, useMemo, useCallback, useEffect } from "react";
import { Button } from "@shared/ui/button";
import { Plus, User, Users, DollarSign, Wallet, History, ShoppingBag, Printer, Receipt, Download } from "lucide-react";
import { toast } from "sonner";

import { customerService } from '@modules/partners/api/customerService';
import { accountingService } from '@modules/accounting/api/accountingService';
import { invoiceService } from '@modules/invoicing/api/invoiceService';
import { paymentService } from '@modules/payments/api/paymentService';
import type { CustomerDto, AccountDto, InvoiceDto, Payment, CreateCustomerRequest, UpdateCustomerRequest, CreatePaymentRequest } from "@erp/shared-types";

import { useTabs } from "@app/providers/TabContext";
import { useEntityList } from '@shared/hooks/useEntityList';
import { CustomerTable } from '@modules/partners/components/CustomerTable';
import { CustomerReceiptForm } from '@modules/partners/components/CustomerReceiptForm';

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

  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [receiptSaving, setReceiptSaving] = useState(false);

  const handleSaveReceipt = async (payload: CreatePaymentRequest) => {
    try {
      setReceiptSaving(true);
      await paymentService.createPayment(payload);
      await refresh(true);
      toast.success("تم تسجيل سند القبض بنجاح");
      setIsReceiptOpen(false);
    } catch (error) {
      toast.error("فشل تسجيل السند: " + error);
    } finally {
      setReceiptSaving(false);
    }
  };

  useEffect(() => {
    if (rateMapKey > 0) {
      refresh(true);
    }
  }, [rateMapKey, refresh]);

  const isLoading = loading || refreshing;

  const [customerInvoices, setCustomerInvoices] = useState<InvoiceDto[]>([]);
  const [customerPayments, setCustomerPayments] = useState<Payment[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [accounts, setAccounts] = useState<AccountDto[]>([]);

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
            onClick={() => {
              setIsReceiptOpen(true);
              setIsFormOpen(false);
            }}
          >
            <Receipt className="w-4 h-4 ml-2 text-amber-500" /> إنشاء سند قبض
          </Button>

          <Button 
            size="sm" 
            variant="outline"
            className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            onClick={() => {
              // Export logic handled in table or simplified here
              toast.info("جاري التصدير...");
            }}
          >
            <Download className="w-4 h-4 ml-2 text-slate-500" /> تصدير إكسل
          </Button>

          <div className="h-6 w-px bg-slate-200 mx-1" />

          <Button size="sm" onClick={handleOpenAdd} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100">
            <Plus className="w-4 h-4 ml-2" /> إضافة عميل جديد
          </Button>
        </div>
      }
      tableContent={
        <CustomerTable 
          customers={customers}
          loading={isLoading}
          search={search}
          onSearchChange={setSearch}
          onView={(c) => setSelectedId(c.id)}
          onEdit={(c) => { loadAccounts(); handleOpenEdit(c); }}
          onDelete={(id) => { setSelectedId(null); handleDelete(id); }}
          onJournal={(c) => c.account_id && openTab({
            id: `ledger-${c.account_id}`,
            title: `حركة: ${c.name}`,
            path: `/accounting/account-ledger/${c.account_id}`,
            closable: true
          })}
          onDocument={(c) => { setSelectedId(c.id); setIsReceiptOpen(true); setIsFormOpen(false); }}
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
        ) : isReceiptOpen && selectedCustomer ? (
          <div className="p-6">
            <CustomerReceiptForm 
              customer={selectedCustomer}
              onSave={handleSaveReceipt}
              onClose={() => setIsReceiptOpen(false)}
              saving={receiptSaving}
            />
          </div>
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
      isPanelOpen={isFormOpen || isReceiptOpen || !!selectedId}
    />
  );
}
