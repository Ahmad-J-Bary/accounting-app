import { useState, useMemo, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, RefreshCw, Settings2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { customerService } from "@/services/customerService";
import { accountingService } from "@/services/accountingService";
import { invoiceService } from "@/services/invoiceService";
import { paymentService } from "@/services/paymentService";
import type { CustomerDto, AccountDto, InvoiceDto, Payment, CreateCustomerRequest, UpdateCustomerRequest } from "@erp/shared-types";

import { useMasterData } from "@/hooks/useMasterData";
import { useColumnPreferences } from "@/hooks/useColumnPreferences";
import { CustomerStats } from "@/components/erp/customers/CustomerStats";
import { CustomerTable } from "@/components/erp/customers/CustomerTable";

import { MasterDetailLayout } from "@/components/erp/layouts/MasterDetailLayout";
import { PartnerDetailPanel } from "@/components/erp/shared/PartnerDetailPanel";
import { PartnerFormPanel } from "@/components/erp/shared/PartnerFormPanel";

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
    if (selectedId) {
      fetchDetails(selectedId);
      setIsFormOpen(false); // Close form if opening details
    }
  }, [selectedId, fetchDetails, setIsFormOpen]);

  const handleOpenAddCustomer = () => {
    loadAccounts();
    setSelectedId(null); // Deselect row to switch to add mode
    handleOpenAdd();
  };

  const handleEditCustomer = (c: CustomerDto) => {
    loadAccounts();
    handleOpenEdit(c);
  };

  const masterContent = (
    <div className="flex flex-col h-full bg-slate-50 relative p-6">
      <div className="shrink-0 mb-6">
        <PageHeader
          title="العملاء"
          subtitle="إدارة قاعدة بيانات العملاء والأرصدة"
          breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "العملاء" }]}
          actions={
            <>
              <Button variant="outline" onClick={() => refresh()} disabled={loading} className="bg-white">
                <RefreshCw className={`w-4 h-4 ml-2 ${loading ? "animate-spin" : ""}`} />تحديث
              </Button>
              <Button onClick={handleOpenAddCustomer} className="shadow-sm">
                <Plus className="w-4 h-4 ml-2" />عميل جديد
              </Button>
            </>
          }
        />
        <div className="mt-6">
          <CustomerStats customers={customers} />
        </div>
      </div>

      <Card className="flex-1 min-h-0 flex flex-col p-0 border-none shadow-sm rounded-xl overflow-hidden bg-white">
        <div className="flex items-center gap-3 p-4 border-b shrink-0 bg-white">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="بحث بالاسم، الكود، الهاتف..." 
              className="pr-10 bg-slate-50 border-slate-200" 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" title="إعدادات الأعمدة" className="bg-white">
                <Settings2 className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px]">
              <DropdownMenuLabel>الأعمدة الظاهرة</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {availableColumns.map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={isVisible(col.id)}
                  onCheckedChange={() => toggleColumn(col.id)}
                >
                  {col.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex-1 overflow-auto bg-white relative">
          <CustomerTable 
            customers={customers}
            loading={loading}
            search={search}
            visibleColumns={visibleColumns}
            onView={(c) => setSelectedId(c.id)}
            onEdit={handleEditCustomer}
            onDelete={handleDelete}
            selectedId={selectedId}
          />
        </div>
      </Card>
    </div>
  );

  const detailContent = isFormOpen ? (
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
  );

  return (
    <div className="absolute inset-0">
      <MasterDetailLayout 
        masterContent={masterContent}
        detailContent={detailContent}
        isDetailOpen={isFormOpen || !!selectedId}
      />
    </div>
  );
}
