import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@shared/ui/button";
import { Plus, Truck, Wallet, History, ShoppingBag, Printer, DollarSign, Download } from "lucide-react";
import { toast } from "sonner";

import { supplierService } from '@modules/partners/api/supplierService';
import { accountingService } from '@modules/accounting/api/accountingService';
import { invoiceService } from '@modules/invoicing/api/invoiceService';
import { paymentService } from '@modules/payments/api/paymentService';
import type { SupplierDto, AccountDto, InvoiceDto, Payment, CreateSupplierRequest, UpdateSupplierRequest, CreatePaymentRequest } from "@erp/shared-types";

import { useTabs } from "@app/providers/TabContext";
import { useEntityList } from '@shared/hooks/useEntityList';
import { SupplierTable } from '@modules/partners/components/SupplierTable';
import { SupplierPaymentForm } from '@modules/partners/components/SupplierPaymentForm';

import { OperationalTableTemplate } from '@widgets/templates/OperationalTableTemplate';
import { PartnerDetailPanel } from '@modules/partners/components/PartnerDetailPanel';
import { PartnerFormPanel } from '@modules/partners/components/PartnerFormPanel';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { cn } from "@shared/lib/utils";
import { exportToCSV } from "@shared/lib/export";

export default function Suppliers() {
  const { currencies, formatMonetaryAmount, baseCurrency, rateMap } = useCurrencyContext();
  const { openTab } = useTabs();
  const [rateMapKey, setRateMapKey] = useState(0);

  useEffect(() => {
    setRateMapKey(k => k + 1);
  }, [rateMap]);

  const {
    filtered: suppliers,
    loading,
    search,
    setSearch,
    refresh,
    refreshing,
    selectedId,
    setSelectedId,
    selectedItem: selectedSupplier,
    editItem: editSupplier,
    isFormOpen,
    setIsFormOpen,
    saving,
    handleOpenAdd,
    handleOpenEdit,
    handleSave,
    handleDelete,
  } = useEntityList<SupplierDto, CreateSupplierRequest | UpdateSupplierRequest>({
    fetchData: () => supplierService.listSuppliers(),
    saveData: async (payload) => {
      if ((payload as UpdateSupplierRequest).id) return supplierService.updateSupplier(payload as UpdateSupplierRequest);
      return supplierService.createSupplier(payload as CreateSupplierRequest);
    },
    deleteData: (id) => supplierService.deleteSupplier(id),
    searchFields: ["name", "phone", "code"],
  });

  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);

  const handleSavePayment = async (payload: CreatePaymentRequest) => {
    try {
      setPaymentSaving(true);
      await paymentService.createPayment(payload);
      await refresh(true);
      toast.success("تم تسجيل سند الدفع بنجاح");
      setIsPaymentOpen(false);
    } catch (error) {
      toast.error("فشل تسجيل السند: " + error);
    } finally {
      setPaymentSaving(false);
    }
  };

  useEffect(() => {
    if (rateMapKey > 0) {
      refresh(true);
    }
  }, [rateMapKey, refresh]);

  const isLoading = loading || refreshing;

  const [accounts, setAccounts] = useState<AccountDto[]>([]);
  const [supplierInvoices, setSupplierInvoices] = useState<InvoiceDto[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<Payment[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const loadAccounts = useCallback(async () => {
    try {
      const data = await accountingService.getChartOfAccounts();
      setAccounts(data);
    } catch (e) { console.error(e); }
  }, []);

  const fetchDetails = useCallback(async (id: string) => {
    setLoadingDetails(true);
    try {
      const [invoices, payments] = await Promise.all([
        invoiceService.listInvoicesByType("Purchase").then(list => list.filter(inv => inv.supplier_id === id)),
        paymentService.listPayments(id)
      ]);
      setSupplierInvoices(invoices);
      setSupplierPayments(payments);
    } catch (e) { console.error(e); } finally { setLoadingDetails(false); }
  }, []);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);
  
  useEffect(() => {
    const handler = () => handleOpenAdd();
    window.addEventListener("erp:open-new-supplier", handler);
    return () => window.removeEventListener("erp:open-new-supplier", handler);
  }, [handleOpenAdd]);

  useEffect(() => {
    if (selectedId) {
      fetchDetails(selectedId);
      setIsFormOpen(false);
    }
  }, [selectedId, fetchDetails, setIsFormOpen]);

  const stats = useMemo(() => {
    const totalBalance = suppliers.reduce((acc, s) => acc + (parseFloat(s.balance || "0")), 0);
    return [
      { label: "إجمالي الموردين", value: suppliers.length, icon: Truck, color: "text-slate-900" },
      { label: "مستحقات للموردين", value: formatMonetaryAmount(totalBalance, "base"), icon: Wallet, color: "text-blue-600" }
    ];
  }, [suppliers, formatMonetaryAmount]);

  return (
    <OperationalTableTemplate
      title="إدارة الموردين"
      stats={stats}
      toolbar={
        <div className="flex items-center gap-2">
          <Button 
            size="sm" 
            variant="outline"
            className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            disabled={!selectedId}
            onClick={() => selectedSupplier?.account_id && openTab({
              id: `ledger-${selectedSupplier.account_id}`,
              title: `حركة: ${selectedSupplier.name}`,
              path: `/accounting/account-ledger/${selectedSupplier.account_id}`,
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
              id: `purchases-supplier-${selectedId}`,
              title: `مشتريات: ${selectedSupplier?.name}`,
              path: `/purchase-invoices?supplierId=${selectedId}`,
              closable: true
            })}
          >
            <ShoppingBag className="w-4 h-4 ml-2 text-blue-500" /> مشتريات المورد
          </Button>

          <Button 
            size="sm" 
            variant="outline"
            className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            disabled={!selectedId}
            onClick={() => openTab({
              id: `statement-supplier-${selectedId}`,
              title: `كشف: ${selectedSupplier?.name}`,
              path: `/partners/supplier-statement/${selectedId}`,
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
              setIsPaymentOpen(true);
              setIsFormOpen(false);
            }}
          >
            <DollarSign className="w-4 h-4 ml-2 text-rose-500" /> إنشاء سند دفع
          </Button>

          <Button 
            size="sm" 
            variant="outline"
            className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            onClick={() => {
              // Export logic simplified
              toast.info("جاري التصدير...");
            }}
          >
            <Download className="w-4 h-4 ml-2 text-slate-500" /> تصدير إكسل
          </Button>

          <div className="h-6 w-px bg-slate-200 mx-1" />

          <Button size="sm" onClick={handleOpenAdd} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100">
            <Plus className="w-4 h-4 ml-2" /> مورد جديد
          </Button>
        </div>
      }
      tableContent={
          <SupplierTable 
            suppliers={suppliers}
            loading={isLoading}
            search={search}
            onSearchChange={setSearch}
            onView={(s) => setSelectedId(s.id)}
            onEdit={(s) => { loadAccounts(); handleOpenEdit(s); }}
            onDelete={(id) => { setSelectedId(null); handleDelete(id); }}
            onJournal={(s) => s.account_id && openTab({
              id: `ledger-${s.account_id}`,
              title: `حركة: ${s.name}`,
              path: `/accounting/account-ledger/${s.account_id}`,
              closable: true
            })}
            onDocument={(s) => { setSelectedId(s.id); setIsPaymentOpen(true); setIsFormOpen(false); }}
            selectedId={selectedId}
          />
        }
      sidePanel={
        isFormOpen ? (
          <PartnerFormPanel 
            type="supplier"
            partner={editSupplier}
            accounts={accounts}
            onSave={handleSave}
            onClose={() => setIsFormOpen(false)}
            saving={saving}
          />
        ) : isPaymentOpen && selectedSupplier ? (
          <div className="p-6">
            <SupplierPaymentForm 
              supplier={selectedSupplier}
              onSave={handleSavePayment}
              onClose={() => setIsPaymentOpen(false)}
              saving={paymentSaving}
            />
          </div>
        ) : (
          <PartnerDetailPanel 
            type="supplier"
            partner={selectedSupplier} 
            onClose={() => setSelectedId(null)}
            onEdit={(p) => { loadAccounts(); handleOpenEdit(p as unknown as SupplierDto); }}
            onDelete={(id, name) => { setSelectedId(null); handleDelete(id); }}
            invoices={supplierInvoices}
            payments={supplierPayments}
            loadingDetails={loadingDetails}
          />
        )
      }
      isPanelOpen={isFormOpen || isPaymentOpen || !!selectedId}
    />
  );
}
