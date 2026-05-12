import { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useTabs } from "@app/providers/TabContext";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Plus, Search, RefreshCw, ArrowDownCircle, ArrowUpCircle, Wallet, ReceiptText, Settings2 } from "lucide-react";
import { formatDate, formatDateTime } from '@shared/lib/format';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { paymentService } from '@modules/payments/api/paymentService';
import { customerService } from '@modules/partners/api/customerService';
import { supplierService } from '@modules/partners/api/supplierService';
import { accountingService } from '@modules/accounting/api/accountingService';
import type { Payment, CreatePaymentRequest, UpdatePaymentRequest, PaymentType, CustomerDto, SupplierDto, AccountDto } from "@erp/shared-types";
import { toast } from "sonner";
import { cn } from "@shared/lib/utils";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem } from "@shared/ui/dropdown-menu";

// Refactored Components & Hooks
import { DataTable, Column } from '@widgets/table-shell/DataTable';
import { TableActions } from '@widgets/table-shell/TableActions';
import { useDataTable, useColumnPreferences } from '@shared/hooks';
import { PaymentForm, type PaymentFormPayload } from '@modules/payments/components/PaymentForm';
import { PaymentDetailPanel } from '@modules/payments/components/PaymentDetailPanel';
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
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: "payment_date", direction: "desc" });

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

  const handleSort = useCallback((key: string) => {
    setSortConfig(current => {
      if (current?.key === key) {
        return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  }, []);

  const renderSortableHeader = useCallback((label: string, sortKey: string) => {
    const isActive = sortConfig?.key === sortKey;
    return (
      <button 
        onClick={() => handleSort(sortKey)}
        className="flex items-center gap-1.5 hover:text-blue-600 transition-colors focus:outline-none"
      >
        {label}
        {isActive ? (
          <span className="text-[10px] text-blue-600 font-black">
            {sortConfig.direction === "asc" ? "▲" : "▼"}
          </span>
        ) : (
          <span className="text-[10px] text-slate-300 opacity-50 hover:opacity-100">
            ↕
          </span>
        )}
      </button>
    );
  }, [sortConfig, handleSort]);

  const sortedFiltered = useMemo(() => {
    if (!sortConfig) return payments;
    
    return [...payments].sort((a, b) => {
      let aVal: string | number = a[sortConfig.key as keyof Payment] as unknown as string | number;
      let bVal: string | number = b[sortConfig.key as keyof Payment] as unknown as string | number;

      if (sortConfig.key === "amount_usd" || sortConfig.key === "amount_syp") {
        const amtA = parseFloat(a.amount);
        const rateA = parseFloat(a.exchange_rate);
        const amtB = parseFloat(b.amount);
        const rateB = parseFloat(b.exchange_rate);

        if (sortConfig.key === "amount_usd") {
            aVal = a.currency_code === "USD" ? amtA : (rateA ? amtA / rateA : amtA);
            bVal = b.currency_code === "USD" ? amtB : (rateB ? amtB / rateB : amtB);
        } else {
            aVal = a.currency_code === "SYP" ? amtA : amtA * rateA;
            bVal = b.currency_code === "SYP" ? amtB : amtB * rateB;
        }
      } else if (sortConfig.key === "journal_entry_number") {
          aVal = parseInt(a.journal_entry_number || "0", 10);
          bVal = parseInt(b.journal_entry_number || "0", 10);
      } else if (sortConfig.key === "payment_date") {
          aVal = new Date(a.payment_date).getTime();
          bVal = new Date(b.payment_date).getTime();
      }

      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [payments, sortConfig]);

  const filtered = useMemo(() => {
    return sortedFiltered.filter(p => {
      return typeFilter === "all" || p.payment_type === typeFilter;
    });
  }, [sortedFiltered, typeFilter]);

  const availableColumns = useMemo(() => {
    return [
      { id: "journal_entry_number", label: "رقم القيد" },
      { id: "payment_type", label: "النوع" },
      { id: "amount_usd", label: "المبلغ ($)" },
      { id: "amount_syp", label: "المبلغ (ل.س)" },
      { id: "notes", label: "البيان" },
      { id: "credit_account", label: "الحساب الدائن / المصدر" },
      { id: "debit_account", label: "الحساب المدين / الوجهة" },
      { id: "payment_date", label: "التاريخ" },
    ];
  }, []);

  const defaultVisibleColumns = useMemo(() => {
    return ["journal_entry_number", "payment_type", "amount_usd", "amount_syp", "notes", "credit_account", "debit_account", "payment_date"];
  }, []);

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

  const handleUpdate = async (payload: PaymentFormPayload) => {
    setSaving(true);
    try {
      if (payload.id) {
        await paymentService.updatePayment(payload as UpdatePaymentRequest);
        toast.success("تم التعديل بنجاح");
      } else {
        await handleCreate(payload);
        return;
      }
      setShowDialog(false);
      setSelectedPayment(null);
      refresh(true);
    } catch (e) {
      toast.error("فشل التعديل: " + e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه الحركة؟ سيتم حذف القيد اليومي المرتبط بها نهائياً.")) return;
    try {
      await paymentService.deletePayment(id);
      toast.success("تم الحذف بنجاح");
      setSelectedPayment(null);
      refresh(true);
    } catch (e) {
      toast.error("فشل الحذف: " + e);
    }
  }, [refresh]);

  const columns = useMemo<Column<Payment>[]>(() => {
    return [
      {
        id: "journal_entry_number",
        header: renderSortableHeader("رقم القيد", "journal_entry_number"),
        accessor: (p) => p.journal_entry_number ?? "—",
        className: "font-black text-indigo-700 tabular-nums"
      },
      { 
        id: "payment_type",
        header: renderSortableHeader("النوع", "payment_type"),
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
        id: "amount_usd",
        header: renderSortableHeader("المبلغ ($)", "amount_usd"),
        accessor: (p) => {
          const amt = parseFloat(p.amount);
          const rate = parseFloat(p.exchange_rate);
          const val = p.currency_code === "USD" ? amt : amt / rate;
          const isIn = ["Receipt", "CashIn"].includes(p.payment_type);
          return (
            <span className={cn("tabular-nums font-black text-sm", isIn ? "text-emerald-600" : "text-rose-600")}>
              {isIn ? "+" : "-"}{formatAmount(val, { currencyCode: "USD" })}
            </span>
          );
        },
        align: "left"
      },
      {
        id: "amount_syp",
        header: renderSortableHeader("المبلغ (ل.س)", "amount_syp"),
        accessor: (p) => {
          const amt = parseFloat(p.amount);
          const rate = parseFloat(p.exchange_rate);
          const val = p.currency_code === "SYP" ? amt : amt * rate;
          const isIn = ["Receipt", "CashIn"].includes(p.payment_type);
          return (
            <span className={cn("tabular-nums font-black text-sm", isIn ? "text-emerald-600" : "text-rose-600")}>
              {isIn ? "+" : "-"}{formatAmount(val, { currencyCode: "SYP" })}
            </span>
          );
        },
        align: "left"
      },
      { 
        id: "notes",
        header: "البيان", 
        accessor: (p) => p.notes || p.reference || "—",
        className: "text-slate-600 text-sm max-w-[200px] truncate"
      },
      { 
        id: "credit_account",
        header: "الحساب الدائن / المصدر", 
        accessor: (p) => {
          if (p.credit_account_id) {
            return accounts.find(a => a.id === p.credit_account_id)?.name_ar || "—";
          }
          return "—";
        },
        className: "font-medium text-slate-800 text-sm"
      },
      { 
        id: "debit_account",
        header: "الحساب المدين / الوجهة", 
        accessor: (p) => {
          if (p.debit_account_id) {
            return accounts.find(a => a.id === p.debit_account_id)?.name_ar || "—";
          }
          return "—";
        },
        className: "font-medium text-slate-800 text-sm"
      },
      { 
        id: "payment_date",
        header: renderSortableHeader("التاريخ", "payment_date"),
        accessor: (p) => formatDateTime(p.payment_date),
        className: "tabular-nums text-slate-500 font-medium"
      },
    ];
  }, [formatAmount, accounts, renderSortableHeader]);

  const filteredColumns = useMemo(() => {
    return columns.filter(col => {
      if (!col.id) return true;
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
          <Button size="sm" onClick={() => { setSelectedPayment(null); setShowDialog(true); }} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100">
            <Plus className="w-4 h-4 ml-2" />سند جديد
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
          onRowClick={(row) => setSelectedPayment(row)}
        />
      }
      sidePanel={
        showDialog ? (
          <PaymentForm
            customers={customers}
            suppliers={suppliers}
            accounts={accounts}
            onSave={handleUpdate}
            onClose={() => setShowDialog(false)}
            saving={saving}
            initialValues={selectedPayment ? {
              id: selectedPayment.id,
              payment_type: selectedPayment.payment_type as PaymentType,
              amount: parseFloat(selectedPayment.amount),
              currency_code: selectedPayment.currency_code,
              exchange_rate: parseFloat(selectedPayment.exchange_rate),
              payment_date: selectedPayment.payment_date,
              debit_account_id: selectedPayment.debit_account_id,
              credit_account_id: selectedPayment.credit_account_id,
              customer_id: selectedPayment.customer_id,
              supplier_id: selectedPayment.supplier_id,
              reference: selectedPayment.reference,
              notes: selectedPayment.notes,
              voucher_number: selectedPayment.voucher_number
            } : undefined}
          />
        ) : selectedPayment ? (
          <PaymentDetailPanel
            payment={selectedPayment}
            accounts={accounts}
            customers={customers}
            suppliers={suppliers}
            onClose={() => setSelectedPayment(null)}
            onEdit={() => setShowDialog(true)}
            onDelete={handleDelete}
          />
        ) : null
      }
      isPanelOpen={showDialog || !!selectedPayment}
    />
  );
}
