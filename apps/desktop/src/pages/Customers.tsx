import { useState, useMemo, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, RefreshCw } from "lucide-react";

import { customerService } from "@/services/customerService";
import { accountingService } from "@/services/accountingService";
import { invoiceService } from "@/services/invoiceService";
import { paymentService } from "@/services/paymentService";
import type { CustomerDto, AccountDto, InvoiceDto, Payment, CreateCustomerRequest, UpdateCustomerRequest } from "@erp/shared-types";

// Refactored Components & Hooks
import { useMasterData } from "@/hooks/useMasterData";
import { CustomerDetails } from "@/components/erp/customers/CustomerDetails";
import { CustomerForm } from "@/components/erp/customers/CustomerForm";
import { CustomerStats } from "@/components/erp/customers/CustomerStats";
import { CustomerTable } from "@/components/erp/customers/CustomerTable";

export default function Customers() {
  const {
    filtered: customers,
    loading,
    search,
    setSearch,
    refresh,
    selectedId,
    setSelectedId,
    editItem: editCustomer,
    isFormOpen,
    setIsFormOpen,
    saving,
    handleOpenAdd,
    handleOpenEdit,
    handleSave,
    handleDelete,
  } = useMasterData<CustomerDto, CreateCustomerRequest | UpdateCustomerRequest>({
    fetchData: () => customerService.listCustomers(),
    saveData: async (payload) => {
      if ((payload as UpdateCustomerRequest).id) return customerService.updateCustomer(payload as UpdateCustomerRequest);
      return customerService.createCustomer(payload as CreateCustomerRequest);
    },
    deleteData: (id) => customerService.deleteCustomer(id),
    searchFields: ["name", "phone", "code"],
    errorLabel: "فشل تحميل العملاء",
    successLabel: "تم حفظ بيانات العميل بنجاح",
  });

  const [customerInvoices, setCustomerInvoices] = useState<InvoiceDto[]>([]);
  const [customerPayments, setCustomerPayments] = useState<Payment[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [accounts, setAccounts] = useState<AccountDto[]>([]);

  const selectedCustomer = useMemo(() => customers.find(c => c.id === selectedId) || null, [customers, selectedId]);

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
    if (selectedId) fetchDetails(selectedId);
  }, [selectedId, fetchDetails]);

  return (
    <>
      <PageHeader
        title="العملاء"
        subtitle="إدارة قاعدة بيانات العملاء والأرصدة"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "العملاء" }]}
        actions={
          <>
            <Button variant="outline" onClick={() => refresh()} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ml-2 ${loading ? "animate-spin" : ""}`} />تحديث
            </Button>
            <Button onClick={() => { loadAccounts(); handleOpenAdd(); }}>
              <Plus className="w-4 h-4 ml-2" />عميل جديد
            </Button>
          </>
        }
      />

      <CustomerStats customers={customers} />

      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="بحث بالاسم، الكود، الهاتف..." className="pr-10" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        <CustomerTable 
          customers={customers}
          loading={loading}
          search={search}
          onView={setSelectedId}
          onEdit={(c) => { loadAccounts(); handleOpenEdit(c); }}
          onDelete={handleDelete}
        />
      </Card>

      <CustomerDetails 
        customer={selectedCustomer} 
        onClose={() => setSelectedId(null)} 
        invoices={customerInvoices}
        payments={customerPayments}
        loadingDetails={loadingDetails}
      />

      <CustomerForm 
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        customer={editCustomer}
        accounts={accounts}
        onSave={handleSave}
        saving={saving}
      />
    </>
  );
}
