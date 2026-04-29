import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, RefreshCw } from "lucide-react";

import { supplierService } from "@/services/supplierService";
import { accountingService } from "@/services/accountingService";
import type { SupplierDto, AccountDto, CreateSupplierRequest, UpdateSupplierRequest } from "@erp/shared-types";

// Refactored Components & Hooks
import { useMasterData } from "@/hooks/useMasterData";
import { SupplierDetails } from "@/components/erp/suppliers/SupplierDetails";
import { SupplierForm } from "@/components/erp/suppliers/SupplierForm";
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

  const [selectedSupplier, setSelectedSupplier] = useState<SupplierDto | null>(null);
  const [accounts, setAccounts] = useState<AccountDto[]>([]);

  const loadAccounts = useCallback(async () => {
    try {
      const data = await accountingService.getChartOfAccounts();
      setAccounts(data);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

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
          onView={setSelectedSupplier}
          onEdit={(s) => { loadAccounts(); handleOpenEdit(s); }}
          onDelete={handleDelete}
        />
      </Card>

      <SupplierDetails supplier={selectedSupplier} onClose={() => setSelectedSupplier(null)} />
      
      <SupplierForm 
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        supplier={editSupplier}
        accounts={accounts}
        onSave={handleSave}
        saving={saving}
      />
    </>
  );
}
