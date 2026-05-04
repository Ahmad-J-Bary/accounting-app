import { useState, useEffect, useCallback, useMemo } from "react";
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

import { supplierService } from "@/services/supplierService";
import { accountingService } from "@/services/accountingService";
import { invoiceService } from "@/services/invoiceService";
import { paymentService } from "@/services/paymentService";
import type { SupplierDto, AccountDto, InvoiceDto, Payment, CreateSupplierRequest, UpdateSupplierRequest } from "@erp/shared-types";

import { useMasterData } from "@/hooks/useMasterData";
import { useColumnPreferences } from "@/hooks/useColumnPreferences";
import { SupplierStats } from "@/components/erp/suppliers/SupplierStats";
import { SupplierTable } from "@/components/erp/suppliers/SupplierTable";

import { MasterDetailLayout } from "@/components/erp/layouts/MasterDetailLayout";
import { PartnerDetailPanel } from "@/components/erp/shared/PartnerDetailPanel";
import { PartnerFormPanel } from "@/components/erp/shared/PartnerFormPanel";

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
  
  const availableColumns = [
    { id: "name", label: "اسم المورد" },
    { id: "phone", label: "رقم الهاتف" },
    { id: "debit", label: "المدين" },
    { id: "credit", label: "الدائن" },
    { id: "balance", label: "الرصيد النهائي" },
    { id: "status", label: "الحالة" },
  ];
  const defaultVisibleColumns = ["name", "phone", "debit", "credit", "balance", "status"];
  const { visibleColumns, isVisible, toggleColumn } = useColumnPreferences("suppliers", defaultVisibleColumns);

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
        paymentService.listPayments(id)
      ]);
      setSupplierInvoices(invoices);
      setSupplierPayments(payments);
    } catch (e) { console.error(e); } finally { setLoadingDetails(false); }
  }, []);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);
  
  useEffect(() => {
    if (selectedId) {
      fetchDetails(selectedId);
      setIsFormOpen(false);
    }
  }, [selectedId, fetchDetails, setIsFormOpen]);

  const handleOpenAddSupplier = () => {
    loadAccounts();
    setSelectedId(null);
    handleOpenAdd();
  };

  const handleEditSupplier = (s: SupplierDto) => {
    loadAccounts();
    handleOpenEdit(s);
  };

  const masterContent = (
    <div className="flex flex-col h-full bg-slate-50 relative p-6">
      <div className="shrink-0 mb-6">
        <PageHeader
          title="الموردون"
          subtitle="إدارة قاعدة بيانات الموردين وأرصدتهم"
          breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "الموردون" }]}
          actions={
            <>
              <Button variant="outline" onClick={() => refresh()} disabled={loading} className="bg-white">
                <RefreshCw className={`w-4 h-4 ml-2 ${loading ? "animate-spin" : ""}`} />تحديث
              </Button>
              <Button onClick={handleOpenAddSupplier} className="shadow-sm">
                <Plus className="w-4 h-4 ml-2" />مورد جديد
              </Button>
            </>
          }
        />
        <div className="mt-6">
          <SupplierStats suppliers={suppliers} />
        </div>
      </div>

      <Card className="flex-1 min-h-0 flex flex-col p-0 border-none shadow-sm rounded-xl overflow-hidden bg-white">
        <div className="flex items-center gap-3 p-4 border-b shrink-0 bg-white">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="بحث بالاسم أو الهاتف أو الكود..."
              className="pr-10 bg-slate-50 border-slate-200"
              value={search}
              onChange={e => setSearch(e.target.value)}
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
          <SupplierTable 
            suppliers={suppliers}
            loading={loading}
            search={search}
            visibleColumns={visibleColumns}
            onView={(s) => setSelectedId(s.id)}
            onEdit={handleEditSupplier}
            onDelete={handleDelete}
            selectedId={selectedId}
          />
        </div>
      </Card>
    </div>
  );

  const detailContent = isFormOpen ? (
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
