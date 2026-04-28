import { useState, useMemo, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { Plus, Download, Search, MoreHorizontal, Eye, Edit, Trash2, RefreshCw } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

import { customerService } from "@/services/customerService";
import { accountingService } from "@/services/accountingService";
import { invoiceService } from "@/services/invoiceService";
import { paymentService } from "@/services/paymentService";
import type { CustomerDto, AccountDto, InvoiceDto, Payment, CreateCustomerRequest, UpdateCustomerRequest } from "@erp/shared-types";

// Refactored Components & Hooks
import { DataTable, Column } from "@/components/erp/shared/DataTable";
import { useDataTable } from "@/hooks/useDataTable";
import { CustomerDetails } from "@/components/erp/customers/CustomerDetails";
import { CustomerForm } from "@/components/erp/customers/CustomerForm";
import { StatCard } from "@/components/erp/shared/StatCard";

export default function Customers() {
  const {
    filtered: customers,
    loading,
    search,
    setSearch,
    refresh,
    setData,
  } = useDataTable<CustomerDto>({
    fetchData: () => customerService.listCustomers(),
    searchFields: ["name", "phone", "code"],
    errorLabel: "فشل تحميل العملاء",
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editCustomer, setEditCustomer] = useState<CustomerDto | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Detail states
  const [customerInvoices, setCustomerInvoices] = useState<InvoiceDto[]>([]);
  const [customerPayments, setCustomerPayments] = useState<Payment[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [accounts, setAccounts] = useState<AccountDto[]>([]);

  const selectedCustomer = useMemo(() => customers.find(c => c.id === selectedId) || null, [customers, selectedId]);

  const loadAccounts = useCallback(async () => {
    try {
      const all = await accountingService.getChartOfAccounts();
      setAccounts(all);
    } catch (e) {
      console.error(e);
    }
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
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDetails(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) fetchDetails(selectedId);
  }, [selectedId, fetchDetails]);

  const handleSave = async (payload: CreateCustomerRequest | UpdateCustomerRequest) => {
    try {
      setSaving(true);
      if ("id" in payload) {
        await customerService.updateCustomer(payload);
        toast.success("تم تحديث بيانات العميل");
      } else {
        await customerService.createCustomer(payload);
        toast.success("تم إضافة العميل بنجاح");
      }
      setIsDialogOpen(false);
      refresh(true);
    } catch (e) {
      toast.error("خطأ: " + e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = useCallback(async (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف العميل ${name}؟`)) return;
    try {
      await customerService.deleteCustomer(id);
      toast.success("تم حذف العميل");
      setData(prev => prev.filter(c => c.id !== id));
    } catch (e) {
      toast.error("خطأ: " + e);
    }
  }, [setData]);

  const columns = useMemo<Column<CustomerDto>[]>(() => [
    { header: "الاسم", accessor: "name", className: "font-semibold" },
    { header: "الهاتف", accessor: (c) => c.phone || "—", className: "tabular-nums" },
    { header: "المدين", accessor: (c) => formatCurrency(Number(c.debit || 0)), align: "left", className: "text-red-600 tabular-nums" },
    { header: "الدائن", accessor: (c) => formatCurrency(Number(c.credit || 0)), align: "left", className: "text-green-600 tabular-nums" },
    { header: "الرصيد", accessor: (c) => formatCurrency(Number(c.balance || 0)), align: "left", className: "font-bold tabular-nums" },
    { header: "الحالة", accessor: (c) => <StatusBadge status={c.is_active ? "active" : "inactive"} />, align: "left" },
    {
      header: "",
      accessor: (c) => (
        <div onClick={e => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-right">
              <DropdownMenuItem onClick={() => setSelectedId(c.id)}><Eye className="w-4 h-4 ml-2" />عرض الملف</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setEditCustomer(c); loadAccounts(); setIsDialogOpen(true); }}><Edit className="w-4 h-4 ml-2" />تعديل</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDelete(c.id, c.name)} className="text-red-600"><Trash2 className="w-4 h-4 ml-2" />حذف</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
      className: "w-12"
    }
  ], [loadAccounts, handleDelete, setSelectedId, setEditCustomer, setIsDialogOpen]);

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
            <Button onClick={() => { setEditCustomer(null); loadAccounts(); setIsDialogOpen(true); }}>
              <Plus className="w-4 h-4 ml-2" />عميل جديد
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <StatCard label="إجمالي العملاء" value={customers.length} />
        <StatCard label="العملاء النشطون" value={customers.filter(c => c.is_active).length} color="text-green-600" />
        <StatCard label="إجمالي الذمم" value={formatCurrency(customers.reduce((s, c) => s + Number(c.balance || 0), 0))} color="text-blue-600" />
        <StatCard label="عملاء بأرصدة صفرية" value={customers.filter(c => Number(c.balance || 0) === 0).length} />
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="بحث بالاسم، الكود، الهاتف..." className="pr-10" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        <DataTable
          data={customers}
          columns={columns}
          loading={loading}
          onRowClick={(c) => setSelectedId(c.id)}
          emptyMessage={search ? "لا توجد نتائج" : "لا يوجد عملاء مضافون"}
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
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        customer={editCustomer}
        accounts={accounts}
        onSave={handleSave}
        saving={saving}
      />
    </>
  );
}
