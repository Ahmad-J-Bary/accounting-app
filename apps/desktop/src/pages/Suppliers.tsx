import { useState, useMemo, useCallback } from "react";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { Plus, Search, MoreHorizontal, Eye, Edit, Trash2, RefreshCw } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

import { supplierService } from "@/services/supplierService";
import { accountingService } from "@/services/accountingService";
import type { SupplierDto, AccountDto, CreateSupplierRequest, UpdateSupplierRequest } from "@erp/shared-types";

// Refactored Components & Hooks
import { DataTable, Column } from "@/components/erp/shared/DataTable";
import { useDataTable } from "@/hooks/useDataTable";
import { SupplierDetails } from "@/components/erp/suppliers/SupplierDetails";
import { SupplierForm } from "@/components/erp/suppliers/SupplierForm";
import { StatCard } from "@/components/erp/shared/StatCard";

export default function Suppliers() {
  // Use our new generic hook for data fetching and searching
  const {
    filtered: suppliers,
    loading,
    search,
    setSearch,
    refresh,
    setData,
  } = useDataTable<SupplierDto>({
    fetchData: () => supplierService.listSuppliers(),
    searchFields: ["name", "phone", "code"],
    errorLabel: "فشل تحميل الموردين",
  });

  const [selectedSupplier, setSelectedSupplier] = useState<SupplierDto | null>(null);
  const [editSupplier, setEditSupplier] = useState<SupplierDto | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<AccountDto[]>([]);

  // Stats
  const activeCount = useMemo(() => suppliers.filter(s => s.is_active).length, [suppliers]);
  const totalBalance = useMemo(() => suppliers.reduce((sum, s) => sum + parseFloat(s.balance || "0"), 0), [suppliers]);

  const loadAccounts = useCallback(async () => {
    try {
      const data = await accountingService.getChartOfAccounts();
      setAccounts(data); // Fetch all to find parents
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleSave = async (payload: CreateSupplierRequest | UpdateSupplierRequest) => {
    try {
      setSaving(true);
      if ("id" in payload) {
        await supplierService.updateSupplier(payload);
        toast.success("تم تحديث بيانات المورد بنجاح");
      } else {
        await supplierService.createSupplier(payload);
        toast.success("تم إضافة المورد بنجاح");
      }
      setShowDialog(false);
      refresh(true); // silent refresh
    } catch (e) {
      toast.error("خطأ في العملية: " + e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = useCallback(async (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف المورد ${name}؟`)) return;
    try {
      await supplierService.deleteSupplier(id);
      toast.success("تم حذف المورد بنجاح");
      setData(prev => prev.filter(s => s.id !== id));
    } catch (e) {
      toast.error("خطأ في الحذف: " + e);
    }
  }, [setData]);

  // Table Columns Definition
  const columns = useMemo<Column<SupplierDto>[]>(() => [
    { header: "اسم المورد", accessor: "name", className: "font-medium" },
    { header: "الهاتف", accessor: (s) => s.phone || "—", className: "tabular-nums" },
    { 
      header: "المدين", 
      accessor: (s) => formatCurrency(parseFloat(s.debit || "0")), 
      align: "left", 
      className: "tabular-nums text-red-600" 
    },
    { 
      header: "الدائن", 
      accessor: (s) => formatCurrency(parseFloat(s.credit || "0")), 
      align: "left", 
      className: "tabular-nums text-green-600" 
    },
    { 
      header: "الرصيد", 
      accessor: (s) => formatCurrency(parseFloat(s.balance || "0")), 
      align: "left", 
      className: "tabular-nums font-bold" 
    },
    { 
      header: "الحالة", 
      accessor: (s) => <StatusBadge status={s.is_active ? "active" : "inactive"} />, 
      align: "left" 
    },
    {
      header: "",
      accessor: (s) => (
        <div onClick={e => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-right">
              <DropdownMenuItem onClick={() => setSelectedSupplier(s)}><Eye className="w-4 h-4 ml-2" />عرض الملف</DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                setEditSupplier(s);
                loadAccounts();
                setShowDialog(true);
              }}><Edit className="w-4 h-4 ml-2" />تعديل</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDelete(s.id, s.name)} className="text-red-600">
                <Trash2 className="w-4 h-4 ml-2" />حذف
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
      className: "w-12"
    }
  ], [loadAccounts, handleDelete, setSelectedSupplier, setEditSupplier, setShowDialog]); // Stable dependencies

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
            <Button onClick={() => {
              setEditSupplier(null);
              loadAccounts();
              setShowDialog(true);
            }}>
              <Plus className="w-4 h-4 ml-2" />مورد جديد
            </Button>
          </>
        }
      />

      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <StatCard label="إجمالي الموردين" value={suppliers.length} />
        <StatCard label="الموردون النشطون" value={activeCount} color="text-green-600" />
        <StatCard label="إجمالي الذمم الدائنة" value={formatCurrency(totalBalance)} color="text-red-600" />
        <StatCard label="موردون بأرصدة" value={suppliers.filter(s => parseFloat(s.balance || "0") > 0).length} />
      </div>

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

        <DataTable
          data={suppliers}
          columns={columns}
          loading={loading}
          onRowClick={setSelectedSupplier}
          emptyMessage={search ? "لا توجد نتائج للبحث" : "لا يوجد موردون — أضف مورداً جديداً"}
        />
      </Card>

      <SupplierDetails supplier={selectedSupplier} onClose={() => setSelectedSupplier(null)} />
      
      <SupplierForm 
        open={showDialog}
        onOpenChange={setShowDialog}
        supplier={editSupplier}
        accounts={accounts}
        onSave={handleSave}
        saving={saving}
      />
    </>
  );
}
