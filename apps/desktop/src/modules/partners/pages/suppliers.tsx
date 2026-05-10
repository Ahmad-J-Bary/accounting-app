import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Plus, Search, RefreshCw, Settings2, Truck, Wallet } from "lucide-react";
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

export default function Suppliers() {
  const { currencies, formatMonetaryAmount, baseCurrency, rateMap } = useCurrencyContext();
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
  }, [rateMapKey]);

  const isLoading = loading || refreshing;

  const [accounts, setAccounts] = useState<AccountDto[]>([]);
  const [supplierInvoices, setSupplierInvoices] = useState<InvoiceDto[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<Payment[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  const availableColumns = useMemo(() => {
    const cols = [
      { id: "name", label: "اسم المورد" },
      { id: "phone", label: "رقم الهاتف" },
    ];

    // Using symbols for dropdown labels
    currencies.forEach(curr => {
      const symbol = curr.symbol || curr.code;
      cols.push({ id: `debit_${curr.code}`, label: `المدين (${symbol})` });
    });
    currencies.forEach(curr => {
      const symbol = curr.symbol || curr.code;
      cols.push({ id: `credit_${curr.code}`, label: `الدائن (${symbol})` });
    });
    currencies.forEach(curr => {
      const symbol = curr.symbol || curr.code;
      cols.push({ id: `balance_${curr.code}`, label: `الرصيد (${symbol})` });
    });

    return cols;
  }, [currencies]);

  const defaultVisibleColumns = useMemo(() => {
    const base = ["name", "phone"];
    
    if (baseCurrency) {
      base.push(`debit_${baseCurrency.code}`);
      base.push(`credit_${baseCurrency.code}`);
      base.push(`balance_${baseCurrency.code}`);
    }

    currencies.forEach(c => {
      if (baseCurrency && c.code === baseCurrency.code) return;
      base.push(`balance_${c.code}`);
    });

    return base;
  }, [currencies, baseCurrency]);

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
        <>
          <Button variant="outline" size="sm" onClick={() => refresh(true)} disabled={isLoading} className="bg-white">
            <RefreshCw className={`w-4 h-4 ml-2 ${isLoading ? "animate-spin" : ""}`} />تحديث
          </Button>
          <Button size="sm" onClick={handleOpenAdd} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100">
            <Plus className="w-4 h-4 ml-2" /> مورد جديد
          </Button>
        </>
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
          onEdit={(s) => { loadAccounts(); handleOpenEdit(s); }}
          onDelete={handleDelete}
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
