import { useState, useEffect, useMemo, useCallback } from "react";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, RefreshCw, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { paymentService } from "@/services/paymentService";
import { customerService } from "@/services/customerService";
import { supplierService } from "@/services/supplierService";
import type { Payment, CreatePaymentRequest, CustomerDto, SupplierDto } from "@erp/shared-types";
import { toast } from "sonner";

// Refactored Components & Hooks
import { DataTable, Column } from "@/components/erp/shared/DataTable";
import { useDataTable } from "@/hooks/useDataTable";
import { PaymentForm } from "@/components/erp/payments/PaymentForm";
import { PAYMENT_TYPE_LABELS } from "@/components/erp/payments/constants";

export default function Payments() {
  const {
    filtered: payments,
    loading: paymentsLoading,
    search,
    setSearch,
    refresh,
  } = useDataTable<Payment>({
    fetchData: () => paymentService.listPayments(),
    searchFields: ["customer_name", "supplier_name", "reference"],
    errorLabel: "فشل تحميل المدفوعات",
  });

  const [customers, setCustomers] = useState<CustomerDto[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
  const [loadingExtras, setLoadingExtras] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadExtras = useCallback(async () => {
    try {
      setLoadingExtras(true);
      const [cData, sData] = await Promise.all([
        customerService.listCustomers(),
        supplierService.listSuppliers()
      ]);
      setCustomers(cData);
      setSuppliers(sData);
    } catch (e) {
      toast.error("فشل تحميل العملاء والموردين");
    } finally {
      setLoadingExtras(false);
    }
  }, []);

  useEffect(() => {
    loadExtras();
  }, [loadExtras]);

  const filtered = useMemo(() => {
    return payments.filter(p => {
      return typeFilter === "all" || p.payment_type === typeFilter;
    });
  }, [payments, typeFilter]);

  const totalIn = useMemo(() => payments
    .filter(p => ["Receipt", "CashIn"].includes(p.payment_type))
    .reduce((s, p) => s + parseFloat(p.amount), 0), [payments]);
    
  const totalOut = useMemo(() => payments
    .filter(p => ["SupplierPayment", "CashOut"].includes(p.payment_type))
    .reduce((s, p) => s + parseFloat(p.amount), 0), [payments]);

  const handleCreate = async (payload: CreatePaymentRequest) => {
    if (payload.payment_type === "Receipt" && !payload.customer_id) {
      toast.error("يرجى اختيار العميل لعملية القبض");
      return;
    }
    if (payload.payment_type === "SupplierPayment" && !payload.supplier_id) {
      toast.error("يرجى اختيار المورد لعملية الدفع");
      return;
    }

    setSaving(true);
    try {
      await paymentService.createPayment(payload);
      setShowDialog(false);
      refresh(true);
      toast.success("تم تسجيل الحركة بنجاح");
    } catch (e) { 
      toast.error("فشل حفظ الحركة: " + e);
    } finally { 
      setSaving(false); 
    }
  };

  const columns = useMemo<Column<Payment>[]>(() => [
    { 
      header: "التاريخ", 
      accessor: (p) => formatDate(p.payment_date),
      className: "tabular-nums"
    },
    { 
      header: "النوع", 
      accessor: (p) => {
        const isIn = ["Receipt", "CashIn"].includes(p.payment_type);
        return (
          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${isIn ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
            {isIn ? <ArrowDownCircle className="w-3 h-3" /> : <ArrowUpCircle className="w-3 h-3" />}
            {PAYMENT_TYPE_LABELS[p.payment_type]}
          </span>
        );
      }
    },
    { 
      header: "الطرف", 
      accessor: (p) => p.customer_name ?? p.supplier_name ?? "—"
    },
    { 
      header: "المرجع", 
      accessor: (p) => p.reference ?? "—",
      className: "text-muted-foreground text-xs"
    },
    { 
      header: "المبلغ", 
      accessor: (p) => {
        const isIn = ["Receipt", "CashIn"].includes(p.payment_type);
        return (
          <span className={`tabular-nums font-medium ${isIn ? "text-green-600" : "text-red-600"}`}>
            {isIn ? "+" : "-"}{formatCurrency(parseFloat(p.amount))}
          </span>
        );
      },
      align: "left"
    }
  ], []);

  const isLoading = paymentsLoading || loadingExtras;

  return (
    <>
      <PageHeader
        title="المدفوعات والمقبوضات"
        subtitle="إدارة حركات الصندوق والبنك"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "المدفوعات" }]}
        actions={
          <>
            <Button variant="outline" onClick={() => refresh()} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 ml-2 ${isLoading ? "animate-spin" : ""}`} />تحديث
            </Button>
            <Button onClick={() => setShowDialog(true)}>
              <Plus className="w-4 h-4 ml-2" />حركة جديدة
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">إجمالي الحركات</div>
          <div className="text-2xl font-bold tabular-nums mt-1">{payments.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground flex items-center gap-1">
            <ArrowDownCircle className="w-4 h-4 text-green-500" /> إجمالي المقبوضات
          </div>
          <div className="text-2xl font-bold text-green-600 tabular-nums mt-1">{formatCurrency(totalIn)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground flex items-center gap-1">
            <ArrowUpCircle className="w-4 h-4 text-red-500" /> إجمالي المدفوعات
          </div>
          <div className="text-2xl font-bold text-red-600 tabular-nums mt-1">{formatCurrency(totalOut)}</div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="بحث بالاسم أو المرجع..." className="pr-10" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الأنواع</SelectItem>
              {Object.entries(PAYMENT_TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DataTable
          data={filtered}
          columns={columns}
          loading={isLoading}
          emptyMessage={search || typeFilter !== "all" ? "لا توجد حركات تطابق الفلتر" : "لا توجد حركات نقدية"}
        />
      </Card>

      <PaymentForm
        open={showDialog}
        onOpenChange={setShowDialog}
        customers={customers}
        suppliers={suppliers}
        onSave={handleCreate}
        saving={saving}
      />
    </>
  );
}