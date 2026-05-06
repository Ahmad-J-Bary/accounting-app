import { useState, useMemo, useCallback, useEffect } from "react";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Plus, Search, RefreshCw, Settings2, User, Users, Phone, DollarSign, Wallet } from "lucide-react";
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
import { useEntityList } from '@shared/hooks/useEntityList';
import { CustomerStats } from '@modules/partners/components/CustomerStats';
import { CustomerTable } from '@modules/partners/components/CustomerTable';

import { OperationalTableTemplate } from '@widgets/templates/OperationalTableTemplate';
import { PartnerDetailPanel } from '@modules/partners/components/PartnerDetailPanel';
import { PartnerFormPanel } from '@modules/partners/components/PartnerFormPanel';
import { useCurrencyContext } from "@app/providers/CurrencyProvider";
import { cn } from "@shared/lib/utils";

export default function Customers() {
  const { formatMonetaryAmount } = useCurrencyContext();
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

  const [customerInvoices, setCustomerInvoices] = useState<InvoiceDto[]>([]);
  const [customerPayments, setCustomerPayments] = useState<Payment[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [accounts, setAccounts] = useState<AccountDto[]>([]);
  
  const availableColumns = [
    { id: "name", label: "اسم العميل" },
    { id: "phone", label: "رقم الهاتف" },
    { id: "debit", label: "المدين" },
    { id: "credit", label: "الدائن" },
    { id: "balance", label: "الرصيد النهائي" },
    { id: "status", label: "الحالة" },
  ];
  const defaultVisibleColumns = ["name", "phone", "debit", "credit", "balance", "status"];
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
    const activeCount = customers.filter(c => c.is_active).length;
    return [
      { label: "إجمالي العملاء", value: customers.length, icon: Users, color: "text-slate-900" },
      { label: "عملاء نشطون", value: activeCount, icon: User, color: "text-emerald-600" },
      { label: "إجمالي الأرصدة", value: formatMonetaryAmount(totalBalance, "base"), icon: Wallet, color: "text-blue-600" },
    ];
  }, [customers, formatMonetaryAmount]);

  const isLoading = loading || refreshing;

  return (
    <OperationalTableTemplate
      title="إدارة العملاء"
      toolbar={
        <>
          <Button variant="outline" size="sm" onClick={() => refresh(true)} disabled={isLoading} className="bg-white">
            <RefreshCw className={`w-4 h-4 ml-2 ${isLoading ? "animate-spin" : ""}`} />تحديث
          </Button>
          <Button size="sm" onClick={handleOpenAdd} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100">
            <Plus className="w-4 h-4 ml-2" /> إضافة عميل جديد
          </Button>
        </>
      }
      filterBar={
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="بحث بالاسم، الكود، الهاتف..." 
              className="pr-10 h-11 border-slate-200 focus:ring-2 focus:ring-blue-500 transition-all" 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-11 w-11 bg-white border-slate-200">
                <Settings2 className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px]">
              <DropdownMenuLabel className="text-right">الأعمدة الظاهرة</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {availableColumns.map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={isVisible(col.id)}
                  onCheckedChange={() => toggleColumn(col.id)}
                  className="text-right flex-row-reverse gap-2"
                >
                  {col.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          
          <div className="flex items-center gap-6 mr-auto pl-2">
            {stats.map((s, i) => (
              <div key={i} className="flex flex-col items-start gap-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{s.label}</span>
                <div className="flex items-center gap-2">
                   <s.icon className={cn("w-4 h-4", s.color)} />
                   <span className={cn("text-lg font-black tabular-nums", s.color)}>{s.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      }
      tableContent={
        <CustomerTable 
          customers={customers}
          loading={loading}
          search={search}
          visibleColumns={visibleColumns}
          onView={(c) => setSelectedId(c.id)}
          onEdit={(c) => { loadAccounts(); handleOpenEdit(c); }}
          onDelete={handleDelete}
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
