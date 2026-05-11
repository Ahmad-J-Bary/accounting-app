import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Plus, Search, Settings2, Truck, Wallet, History, ShoppingBag, Printer, DollarSign, Download } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@shared/ui/dropdown-menu";

import { supplierService } from '@modules/partners/api/supplierService';
import { accountingService } from '@modules/accounting/api/accountingService';
import { invoiceService } from '@modules/invoicing/api/invoiceService';
import { paymentService } from '@modules/payments/api/paymentService';
import type { SupplierDto, AccountDto, InvoiceDto, Payment, CreateSupplierRequest, UpdateSupplierRequest } from "@erp/shared-types";

import { useColumnPreferences } from '@shared/hooks';
import { useEntityList } from '@shared/hooks/useEntityList';
import { SupplierTable } from '@modules/partners/components/SupplierTable';

import { OperationalTableTemplate } from '@widgets/templates/OperationalTableTemplate';
import { PartnerDetailPanel } from '@modules/partners/components/PartnerDetailPanel';
import { PartnerFormPanel } from '@modules/partners/components/PartnerFormPanel';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { cn } from "@shared/lib/utils";
import { useTabs } from "@app/providers/TabContext";
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
  
  const availableColumns = useMemo(() => {
    const cols = [
      { id: "#", label: "رقم الحساب" },
      { id: "name", label: "اسم المورد" },
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

  const { visibleColumns, isVisible, toggleColumn } = useColumnPreferences("suppliers", defaultVisibleColumns);

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
            onClick={() => openTab({
              id: `new-payment-${Date.now()}`,
              title: "سند دفع جديد",
              path: `/payments?type=SupplierPayment&supplierId=${selectedId}`,
              closable: true
            })}
          >
            <DollarSign className="w-4 h-4 ml-2 text-rose-500" /> إنشاء سند دفع
          </Button>

          <Button 
            size="sm" 
            variant="outline"
            className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            onClick={() => exportToCSV(suppliers, availableColumns, "الموردين")}
          >
            <Download className="w-4 h-4 ml-2 text-slate-500" /> تصدير إكسل
          </Button>

          <div className="h-6 w-px bg-slate-200 mx-1" />

          <Button size="sm" onClick={handleOpenAdd} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100">
            <Plus className="w-4 h-4 ml-2" /> مورد جديد
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
        <SupplierTable 
          suppliers={suppliers}
          loading={loading}
          search={search}
          visibleColumns={visibleColumns}
          onView={(s) => setSelectedId(s.id)}
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
      isPanelOpen={isFormOpen || !!selectedId}
    />
  );
}
