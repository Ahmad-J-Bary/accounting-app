import { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useTabs } from "@app/providers/TabContext";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Plus, Search, RefreshCw, ArrowDownCircle, ArrowUpCircle, Wallet, ReceiptText, Settings2 } from "lucide-react";
import { formatDate } from '@shared/lib/format';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { paymentService } from '@modules/payments/api/paymentService';
import { customerService } from '@modules/partners/api/customerService';
import { supplierService } from '@modules/partners/api/supplierService';
import { accountingService } from '@modules/accounting/api/accountingService';
import type { Payment, CreatePaymentRequest, CustomerDto, SupplierDto, AccountDto } from "@erp/shared-types";
import { toast } from "sonner";
import { cn } from "@shared/lib/utils";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem } from "@shared/ui/dropdown-menu";

// Refactored Components & Hooks
import { DataTable, Column } from '@widgets/table-shell/DataTable';
import { TableActions } from '@widgets/table-shell/TableActions';
import { useDataTable, useColumnPreferences } from '@shared/hooks';
import { PaymentForm } from '@modules/payments/components/PaymentForm';
import { PAYMENT_TYPE_LABELS } from '@modules/payments/lib/constants';
import { useCurrencyContext } from "@app/providers/CurrencyContext";

export default function Payments() {
  const { formatAmount, currencies, baseCurrency, formatMonetaryAmount } = useCurrencyContext();
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
  const [accounts, setAccounts] = useState<AccountDto[]>([]);
  const [loadingExtras, setLoadingExtras] = useState(true);
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialType = searchParams.get("type");
  const initialCustomerId = searchParams.get("customerId");
  const initialSupplierId = searchParams.get("supplierId");
  const initialDrawingsAccountId = searchParams.get("drawingsAccountId");

  const [typeFilter, setTypeFilter] = useState("all");
  const [showDialog, setShowDialog] = useState(!!initialType);

  const initialValues = useMemo(() => ({
    payment_type: (initialType as CreatePaymentRequest['payment_type']) || "Receipt",
    customer_id: initialCustomerId || undefined,
    supplier_id: initialSupplierId || undefined,
    debit_account_id: initialDrawingsAccountId || undefined,
  }), [initialType, initialCustomerId, initialSupplierId, initialDrawingsAccountId]);
  const [saving, setSaving] = useState(false);

  const loadExtras = useCallback(async () => {
    try {
      setLoadingExtras(true);
      const [cData, sData] = await Promise.all([
        customerService.listCustomers(),
        supplierService.listSuppliers(),
      ]);
      const aData = await accountingService.getChartOfAccounts();
      setCustomers(cData);
      setSuppliers(sData);
      setAccounts(aData);
    } catch (e) {
      toast.error("فشل تحميل بيانات السندات");
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

  const availableColumns = useMemo(() => {
    const cols = [
      { id: "payment_date", label: "التاريخ" },
      { id: "payment_type", label: "النوع" },
      { id: "party_name", label: "الطرف الثاني" },
      { id: "voucher_number", label: "رقم السند" },
      { id: "journal_entry_number", label: "رقم القيد" },
      { id: "reference", label: "المرجع" },
    ];

    currencies.forEach(curr => {
      const s = curr.symbol || curr.code;
      cols.push({ id: `amount_${curr.code}`, label: `المبلغ (${s})` });
    });

    return cols;
  }, [currencies]);

  const defaultVisibleColumns = useMemo(() => {
    const base = ["payment_date", "payment_type", "party_name", "voucher_number", "journal_entry_number", "reference"];
    if (baseCurrency) {
      base.push(`amount_${baseCurrency.code}`);
    }
    return base;
  }, [baseCurrency]);

  const { visibleColumns, toggleColumn, isVisible } = useColumnPreferences("payments", defaultVisibleColumns);

  const totalIn = useMemo(() => payments
    .filter(p => ["Receipt", "CashIn"].includes(p.payment_type))
    .reduce((s, p) => s + parseFloat(p.amount), 0), [payments]);
    
  const totalOut = useMemo(() => payments
    .filter(p => ["SupplierPayment", "CashOut", "ExpenseVoucher", "DrawingsVoucher"].includes(p.payment_type))
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
    if ((payload.payment_type === "ExpenseVoucher" || payload.payment_type === "DrawingsVoucher") && !payload.debit_account_id) {
      toast.error("يرجى اختيار الحساب المدين");
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

  const columns = useMemo<Column<Payment>[]>(() => {
    const cols: Column<Payment>[] = [
      { 
        id: "payment_date",
        header: "التاريخ", 
        accessor: (p) => formatDate(p.payment_date),
        className: "tabular-nums text-slate-500 font-medium"
      },
      { 
        id: "payment_type",
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
        id: "party_name",
        header: "الطرف الثاني", 
        accessor: (p) => p.customer_name ?? p.supplier_name ?? "—",
        className: "font-black text-slate-900"
      },
      { 
        id: "reference",
        header: "المرجع / ملاحظات", 
        accessor: (p) => p.reference ?? "—",
        className: "text-slate-500 text-xs font-medium italic"
      },
      {
        id: "voucher_number",
        header: "رقم السند",
        accessor: (p) => p.voucher_number ?? "—",
        className: "font-black text-slate-700 tabular-nums"
      },
      {
        id: "journal_entry_number",
        header: "رقم القيد",
        accessor: (p) => p.journal_entry_number ?? "—",
        className: "font-black text-indigo-700 tabular-nums"
      },
    ];

    // Dynamic Multi-Currency Amount columns
    currencies.forEach(curr => {
      cols.push({
        id: `amount_${curr.code}`,
        header: `المبلغ (${curr.symbol || curr.code})`,
        accessor: (p) => {
          const isIn = ["Receipt", "CashIn"].includes(p.payment_type);
          // Assuming p.amount is in base currency or has a currency context. 
          // If p.amount is already in a specific currency, we should handle that.
          // For now, following the pattern: show base amount converted to this currency.
          const val = parseFloat(p.amount);
          return (
            <span className={cn(
              "tabular-nums font-black text-sm",
              isIn ? "text-emerald-600" : "text-rose-600"
            )}>
              {isIn ? "+" : "-"}{formatAmount(val, { currencyCode: curr.code })}
            </span>
          );
        },
        align: "left"
      });
    });

    cols.push({
      id: "actions",
      header: "إجراءات",
      accessor: (p) => (
        <TableActions 
          onView={() => toast.info("عرض تفاصيل الحركة قيد التطوير")}
          onDelete={() => handleDelete(p.id)}
        />
      ),
      align: "left",
      className: "w-16"
    });

    return cols;
  }, [handleDelete, formatAmount, currencies]);

  const filteredColumns = useMemo(() => {
    return columns.filter(col => {
      if (!col.id || col.id === "actions") return true;
      return visibleColumns.includes(col.id);
    });
  }, [columns, visibleColumns]);

  const isLoading = paymentsLoading || loadingExtras;

  const stats = useMemo(() => [
    { label: "إجمالي المقبوضات", value: formatMonetaryAmount(totalIn.toString(), "base"), icon: ArrowDownCircle, color: "text-emerald-600" },
    { label: "إجمالي المدفوعات", value: formatMonetaryAmount(totalOut.toString(), "base"), icon: ArrowUpCircle, color: "text-rose-600" },
    { label: "صافي الحركة", value: formatMonetaryAmount((totalIn - totalOut).toString(), "base"), icon: Wallet, color: (totalIn - totalOut) >= 0 ? "text-blue-600" : "text-amber-600" },
    { label: "عدد الحركات", value: payments.length, icon: ReceiptText, color: "text-slate-900" },
  ], [totalIn, totalOut, payments.length, formatMonetaryAmount]);

  return (
    <OperationalTableTemplate
      title="المدفوعات والمقبوضات"
      toolbar={
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setShowDialog(true)} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100">
            <Plus className="w-4 h-4 ml-2" />حركة جديدة
          </Button>
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
            <SelectTrigger className="w-[180px] h-11 border-slate-200">
              <SelectValue placeholder="تصفية النوع" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الحركات</SelectItem>
              {Object.entries(PAYMENT_TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-11 w-11 bg-white border-slate-200">
                <Settings2 className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[220px] max-h-[450px] overflow-y-auto shadow-xl">
              <DropdownMenuLabel className="text-right text-xs font-black uppercase text-slate-400 tracking-widest">تخصيص الأعمدة</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {availableColumns.map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={isVisible(col.id)}
                  onCheckedChange={() => toggleColumn(col.id)}
                  className="text-right flex-row-reverse gap-2 text-xs font-bold py-2"
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
        <DataTable
          data={filtered}
          columns={filteredColumns}
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
        accounts={accounts}
        onSave={handleCreate}
        saving={saving}
        initialValues={initialValues}
      />
    </OperationalTableTemplate>
  );
}
