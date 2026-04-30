import { useState, useEffect, useCallback, useMemo } from "react";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, RefreshCw } from "lucide-react";

import { supplierService } from "@/services/supplierService";
import { accountingService } from "@/services/accountingService";
import { invoiceService } from "@/services/invoiceService";
import { paymentService } from "@/services/paymentService";
import type { SupplierDto, AccountDto, InvoiceDto, Payment, CreateSupplierRequest, UpdateSupplierRequest } from "@erp/shared-types";

// Refactored Components & Hooks
import { useMasterData } from "@/hooks/useMasterData";
import { PartnerProfileSheet } from "@/components/erp/shared/PartnerProfileSheet";
import { PartnerFormDialog } from "@/components/erp/shared/PartnerFormDialog";
import { SupplierStats } from "@/components/erp/suppliers/SupplierStats";
import { SupplierTable } from "@/components/erp/suppliers/SupplierTable";

export default function Suppliers() {
  const {
    filtered: suppliers,
    loading,
    search,
    setSearch,
    refresh,
    editItem: editSupplier,
    isFormOpen,
    setIsFormOpen,
    saving,
    handleOpenAdd,
    handleOpenEdit,
    handleSave,
    handleDelete,
    selectedId,
    setSelectedId,
  } = useMasterData<SupplierDto, CreateSupplierRequest | UpdateSupplierRequest>({
    fetchData: () => supplierService.listSuppliers(),
    saveData: async (payload) => {
      if ('id' in payload && payload.id) return supplierService.updateSupplier(payload as UpdateSupplierRequest);
      return supplierService.createSupplier(payload as CreateSupplierRequest);
    },
    deleteData: (id) => supplierService.deleteSupplier(id),
    searchFields: ["name", "phone", "code"],
    errorLabel: "فشل تحميل الموردين",
    successLabel: "تم حفظ بيانات المورد بنجاح",
  });

  const [accounts, setAccounts] = useState<AccountDto[]>([]);
  const [supplierInvoices, setSupplierInvoices] = useState<InvoiceDto[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<Payment[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const selectedSupplier = useMemo(() => suppliers.find(s => s.id === selectedId) || null, [suppliers, selectedId]);

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
        paymentService.listPayments(id) // Note: this might need adjustment if payment service distinguishes types
      ]);
      setSupplierInvoices(invoices);
      setSupplierPayments(payments);
    } catch (e) { console.error(e); } finally { setLoadingDetails(false); }
  }, []);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);
  useEffect(() => {
    if (selectedId) fetchDetails(selectedId);
  }, [selectedId, fetchDetails]);

  return (
    <>
      <PageHeader
        title="الموردون"
        subtitle="إدارة قاعدة بيانات الموردين وأرصدتهم"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "الموردون" }]}
        actions={
          <>
            <Button variant="outline" onClick={() => refresh()} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ml-2 ${loading ? "animate-spin" : ""}`} />تحديث
            </Button>
            <Button onClick={() => { loadAccounts(); handleOpenAdd(); }}>
              <Plus className="w-4 h-4 ml-2" />مورد جديد
            </Button>
          </>
        }
      />

      <SupplierStats suppliers={suppliers} />

      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="بحث بالاسم أو الهاتف أو الكود..."
              className="pr-10"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <SupplierTable 
          suppliers={suppliers}
          loading={loading}
          search={search}
          onView={(s) => setSelectedId(s.id)}
          onEdit={(s) => { loadAccounts(); handleOpenEdit(s); }}
          onDelete={handleDelete}
        />
      </Card>

      <PartnerProfileSheet 
        type="supplier"
        partner={selectedSupplier} 
        onClose={() => setSelectedId(null)} 
        invoices={supplierInvoices}
        payments={supplierPayments}
        loadingDetails={loadingDetails}
      />
      
      <PartnerFormDialog 
        type="supplier"
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        partner={editSupplier}
        accounts={accounts}
        onSave={handleSave}
        saving={saving}
      />
    </>
  );
}
