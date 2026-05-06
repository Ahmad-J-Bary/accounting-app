import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Plus, Search, RefreshCw, ArrowDownCircle, ArrowUpCircle, Banknote, Wallet, ReceiptText } from "lucide-react";
import { formatCurrency, formatDate } from '@shared/lib/format';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { paymentService } from '@modules/payments/api/paymentService';
import { customerService } from '@modules/partners/api/customerService';
import { supplierService } from '@modules/partners/api/supplierService';
import type { Payment, CreatePaymentRequest, CustomerDto, SupplierDto } from "@erp/shared-types";
import { toast } from "sonner";
import { cn } from "@shared/lib/utils";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";

// Refactored Components & Hooks
import { DataTable, Column } from '@widgets/table-shell/DataTable';
import { TableActions } from '@widgets/table-shell/TableActions';
import { useDataTable } from '@shared/hooks';
import { PaymentForm } from '@modules/payments/components/PaymentForm';
import { PAYMENT_TYPE_LABELS } from '@modules/payments/lib/constants';

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

  useEffect(() => { loadExtras(); }, [loadExtras]);

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

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه الحركة؟")) return;
    try {
      await paymentService.deletePayment(id);
      toast.success("تم حذف الحركة بنجاح");
      refresh(true);
    } catch (e) {
      toast.error("فشل حذف الحركة: " + e);
    }
  }, [refresh]);

  const columns = useMemo<Column<Payment>[]>(() => [
    { 
      header: "التاريخ", 
      accessor: (p) => formatDate(p.payment_date),
      className: "tabular-nums text-slate-500 font-medium"
    },
    { 
      header: "النوع", 
      accessor: (p) => {
        const isIn = ["Receipt", "CashIn"].includes(p.payment_type);
        return (
          <span className={cn(
            "inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-lg ring-1 ring-inset uppercase tracking-wider",
            isIn ? "bg-emerald-50 text-emerald-700 ring-emerald-100" : "bg-rose-50 text-rose-700 ring-rose-100"
          )}>
            {isIn ? <ArrowDownCircle className="w-3.5 h-3.5" /> : <ArrowUpCircle className="w-3.5 h-3.5" />}
            {PAYMENT_TYPE_LABELS[p.payment_type]}
          </span>
        );
      },
      align: "center"
    },
    { 
      header: "الطرف الثاني", 
      accessor: (p) => p.customer_name ?? p.supplier_name ?? "—",
      className: "font-black text-slate-900"
    },
    { 
      header: "المرجع / ملاحظات", 
      accessor: (p) => p.reference ?? "—",
      className: "text-slate-500 text-xs font-medium italic"
    },
    { 
      header: "المبلغ", 
      accessor: (p) => {
        const isIn = ["Receipt", "CashIn"].includes(p.payment_type);
        return (
          <span className={cn(
            "tabular-nums font-black text-base",
            isIn ? "text-emerald-600" : "text-rose-600"
          )}>
            {isIn ? "+" : "-"}{formatCurrency(parseFloat(p.amount))}
          </span>
        );
      },
      align: "left"
    },
    {
      header: "إجراءات",
      accessor: (p) => (
        <TableActions 
          onView={() => toast.info("عرض تفاصيل الحركة قيد التطوير")}
          onDelete={() => handleDelete(p.id)}
        />
      ),
      align: "left",
      className: "w-16"
    }
  ], [handleDelete]);

  const isLoading = paymentsLoading || loadingExtras;

  const stats = useMemo(() => [
    { label: "إجمالي المقبوضات", value: formatCurrency(totalIn), icon: ArrowDownCircle, color: "text-emerald-600" },
    { label: "إجمالي المدفوعات", value: formatCurrency(totalOut), icon: ArrowUpCircle, color: "text-rose-600" },
    { label: "صافي الحركة", value: formatCurrency(totalIn - totalOut), icon: Wallet, color: (totalIn - totalOut) >= 0 ? "text-blue-600" : "text-amber-600" },
    { label: "عدد الحركات", value: payments.length, icon: ReceiptText, color: "text-slate-900" },
  ], [totalIn, totalOut, payments.length]);

  return (
    <OperationalTableTemplate
      title="المدفوعات والمقبوضات"
      toolbar={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refresh()} disabled={isLoading} className="bg-white">
            <RefreshCw className={cn("w-4 h-4 ml-2", isLoading && "animate-spin")} />تحديث
          </Button>
          <Button size="sm" onClick={() => setShowDialog(true)} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100">
            <Plus className="w-4 h-4 ml-2" />حركة جديدة
          </Button>
        </div>
      }
      headerWidgets={
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {stats.map((s, i) => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between transition-all hover:shadow-md">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.label}</span>
                <div className={cn("text-xl font-black tabular-nums", s.color)}>{s.value}</div>
              </div>
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center bg-slate-50", s.color)}>
                <s.icon className="w-6 h-6" />
              </div>
            </div>
          ))}
        </div>
      }
      filterBar={
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="بحث بالاسم أو المرجع..."
              className="pr-10 h-11 border-slate-200 focus:ring-2 focus:ring-blue-500 transition-all"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[200px] h-11 border-slate-200">
              <SelectValue placeholder="تصفية حسب النوع" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الحركات</SelectItem>
              {Object.entries(PAYMENT_TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
      tableContent={
        <DataTable
          data={filtered}
          columns={columns}
          loading={isLoading}
          emptyMessage={search || typeFilter !== "all" ? "لا توجد حركات تطابق الفلتر" : "لا توجد حركات نقدية مسجّلة"}
        />
      }
    >
      <PaymentForm
        open={showDialog}
        onOpenChange={setShowDialog}
        customers={customers}
        suppliers={suppliers}
        onSave={handleCreate}
        saving={saving}
      />
    </OperationalTableTemplate>
  );
}