import { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@shared/ui/button";
import { Plus, ArrowDownCircle, ArrowUpCircle, Wallet, MoreHorizontal, Eye, Edit, Trash2, ArrowUpDown } from "lucide-react";
import { formatDate } from '@shared/lib/format';
import { paymentService } from '@modules/payments/api/paymentService';
import { customerService } from '@modules/partners/api/customerService';
import { supplierService } from '@modules/partners/api/supplierService';
import { accountingService } from '@modules/accounting/api/accountingService';
import type { Payment, CreatePaymentRequest, UpdatePaymentRequest, CustomerDto, SupplierDto, AccountDto } from "@erp/shared-types";
import { toast } from "sonner";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@shared/ui/dropdown-menu";

// Refactored Components & Hooks
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { TableShell } from '@widgets/table-shell/TableShell';
import type { SummaryColumn } from '@widgets/table-shell/TableSummary';
import { useDataTable, useUnifiedColumns } from '@shared/hooks';
import { PaymentForm, type PaymentFormPayload } from '@modules/payments/components/PaymentForm';
import { PaymentDetailPanel } from '@modules/payments/components/PaymentDetailPanel';
import { PAYMENT_TYPE_LABELS } from '@modules/payments/lib/constants';
import { useCurrencyContext } from "@app/providers/CurrencyContext";

type SortField = "journal_entry_number" | "amount_usd" | "amount_syp" | "payment_date" | "payment_type" | "credit_account" | "debit_account";

interface SortableHeaderProps {
  field: SortField;
  label: string;
  currentField: SortField;
  direction: "asc" | "desc";
  onSort: (field: SortField) => void;
}

const SortableHeader = ({ field, label, currentField, direction, onSort }: SortableHeaderProps) => {
  const getSortIcon = (f: SortField) => {
    if (currentField !== f) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return direction === "asc"
      ? <ArrowUpDown className="w-3 h-3 rotate-180" />
      : <ArrowUpDown className="w-3 h-3" />;
  };

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onSort(field); }}
      className="flex items-center gap-1 hover:text-slate-900 transition-colors"
    >
      {label}
      {getSortIcon(field)}
    </button>
  );
};

export default function PaymentsPage() {
  const { formatAmount, formatMonetaryAmount } = useCurrencyContext();
  const {
    filtered: payments,
    loading: paymentsLoading,
    search,
    setSearch,
    refresh,
  } = useDataTable<Payment>({
    fetchData: () => paymentService.listPayments(),
    searchFields: ["customer_name", "supplier_name", "reference", "notes"],
  });

  const [customers, setCustomers] = useState<CustomerDto[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
  const [accounts, setAccounts] = useState<AccountDto[]>([]);
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialType = searchParams.get("type");
  const initialCustomerId = searchParams.get("customerId");
  const initialSupplierId = searchParams.get("supplierId");
  const initialDrawingsAccountId = searchParams.get("drawingsAccountId");

  const [typeFilter, setTypeFilter] = useState("all");
  const [showDialog, setShowDialog] = useState(!!initialType);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [saving, setSaving] = useState(false);
  const [sortField, setSortField] = useState<SortField>("payment_date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const handleSort = useCallback((field: SortField) => {
    setSortDirection(prev => {
      if (sortField === field) {
        return prev === "asc" ? "desc" : "asc";
      }
      return "asc";
    });
    setSortField(field);
  }, [sortField]);

  const loadExtras = useCallback(async () => {
    try {
      const [cData, sData, aData] = await Promise.all([
        customerService.listCustomers(),
        supplierService.listSuppliers(),
        accountingService.getChartOfAccounts()
      ]);
      setCustomers(cData);
      setSuppliers(sData);
      setAccounts(aData);
    } catch (e) {
      toast.error("فشل تحميل البيانات الإضافية");
    }
  }, []);

  useEffect(() => { loadExtras(); }, [loadExtras]);

  const sortedFiltered = useMemo(() => {
    const sorted = [...payments].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "journal_entry_number":
          comparison = (parseInt(a.journal_entry_number || "0", 10) || 0) - (parseInt(b.journal_entry_number || "0", 10) || 0);
          break;
        case "amount_usd": {
          const rateA = parseFloat(a.exchange_rate || "1");
          const rateB = parseFloat(b.exchange_rate || "1");
          const aVal = a.currency_code === "USD" ? parseFloat(a.amount) : parseFloat(a.amount) / rateA;
          const bVal = b.currency_code === "USD" ? parseFloat(b.amount) : parseFloat(b.amount) / rateB;
          comparison = aVal - bVal;
          break;
        }
        case "amount_syp": {
          const rateA = parseFloat(a.exchange_rate || "1");
          const rateB = parseFloat(b.exchange_rate || "1");
          const aVal = a.currency_code === "SYP" ? parseFloat(a.amount) : parseFloat(a.amount) * rateA;
          const bVal = b.currency_code === "SYP" ? parseFloat(b.amount) : parseFloat(b.amount) * rateB;
          comparison = aVal - bVal;
          break;
        }
        case "payment_date":
          comparison = new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime();
          break;
        case "payment_type":
          comparison = (PAYMENT_TYPE_LABELS[a.payment_type as keyof typeof PAYMENT_TYPE_LABELS] || a.payment_type).localeCompare(PAYMENT_TYPE_LABELS[b.payment_type as keyof typeof PAYMENT_TYPE_LABELS] || b.payment_type, "ar");
          break;
        case "credit_account":
          comparison = (accounts.find(acc => acc.id === a.credit_account_id)?.name_ar || "").localeCompare(accounts.find(acc => acc.id === b.credit_account_id)?.name_ar || "", "ar");
          break;
        case "debit_account":
          comparison = (accounts.find(acc => acc.id === a.debit_account_id)?.name_ar || "").localeCompare(accounts.find(acc => acc.id === b.debit_account_id)?.name_ar || "", "ar");
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
    return sorted;
  }, [payments, sortField, sortDirection, accounts]);

  const filtered = useMemo(() => {
    return sortedFiltered.filter(p => typeFilter === "all" || p.payment_type === typeFilter);
  }, [sortedFiltered, typeFilter]);

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

  const allColumns = useMemo<UnifiedColumn<Payment>[]>(() => [
    {
      id: "journal_entry_number",
      header: <SortableHeader field="journal_entry_number" label="رقم القيد" currentField={sortField} direction={sortDirection} onSort={handleSort} />,
      label: "رقم القيد",
      accessor: (p) => p.journal_entry_number ?? "—",
      className: "font-black text-indigo-700 tabular-nums w-24",
      align: "center"
    },
    { 
      id: "payment_type",
      header: <SortableHeader field="payment_type" label="النوع" currentField={sortField} direction={sortDirection} onSort={handleSort} />,
      label: "النوع",
      accessor: (p) => (
        <div className="flex items-center gap-2">
          {["Receipt", "CashIn"].includes(p.payment_type) ? (
            <ArrowDownCircle className="w-3.5 h-3.5 text-emerald-500" />
          ) : (
            <ArrowUpCircle className="w-3.5 h-3.5 text-rose-500" />
          )}
          <span className="font-bold text-[11px]">
            {PAYMENT_TYPE_LABELS[p.payment_type as keyof typeof PAYMENT_TYPE_LABELS] || p.payment_type}
          </span>
        </div>
      ),
      className: "w-32"
    },
    {
      id: "amount_usd",
      header: <SortableHeader field="amount_usd" label="المبلغ ($)" currentField={sortField} direction={sortDirection} onSort={handleSort} />,
      label: "المبلغ ($)",
      accessor: (p) => {
        const amt = parseFloat(p.amount);
        const rate = parseFloat(p.exchange_rate);
        const val = p.currency_code === "USD" ? amt : amt / rate;
        return formatAmount(val, { currencyCode: "USD" });
      },
      align: "left",
      className: "tabular-nums font-black text-slate-900 w-32"
    },
    {
      id: "amount_syp",
      header: <SortableHeader field="amount_syp" label="المبلغ (ل.س)" currentField={sortField} direction={sortDirection} onSort={handleSort} />,
      label: "المبلغ (ل.س)",
      accessor: (p) => {
        const amt = parseFloat(p.amount);
        const rate = parseFloat(p.exchange_rate);
        const val = p.currency_code === "SYP" ? amt : amt * rate;
        return formatAmount(val, { currencyCode: "SYP" });
      },
      align: "left",
      className: "tabular-nums font-black text-slate-900 w-32"
    },
    {
      id: "notes",
      header: "البيان",
      label: "البيان",
      accessor: (p) => p.notes || "—",
      className: "min-w-[200px] text-slate-500 italic"
    },
    {
      id: "credit_account",
      header: <SortableHeader field="credit_account" label="الحساب الدائن / المصدر" currentField={sortField} direction={sortDirection} onSort={handleSort} />,
      label: "الحساب الدائن / المصدر",
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
      header: <SortableHeader field="debit_account" label="الحساب المدين / الوجهة" currentField={sortField} direction={sortDirection} onSort={handleSort} />,
      label: "الحساب المدين / الوجهة",
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
      header: <SortableHeader field="payment_date" label="التاريخ" currentField={sortField} direction={sortDirection} onSort={handleSort} />,
      label: "التاريخ",
      accessor: (p) => formatDate(p.payment_date),
      className: "w-28 tabular-nums text-slate-400"
    },
    {
      id: "actions",
      header: "إجراءات",
      label: "إجراءات",
      accessor: (p) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            <DropdownMenuItem onClick={() => setSelectedPayment(p)} className="flex-row-reverse gap-2">
              <Eye className="w-4 h-4" /> عرض التفاصيل
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setSelectedPayment(p); setShowDialog(true); }} className="flex-row-reverse gap-2 text-blue-600 focus:text-blue-600">
              <Edit className="w-4 h-4" /> تعديل
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDelete(p.id)} className="flex-row-reverse gap-2 text-rose-600 focus:text-rose-600">
              <Trash2 className="w-4 h-4" /> حذف السند
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      align: "center",
      className: "w-[80px]"
    }
  ], [formatAmount, accounts, handleDelete, sortField, sortDirection, handleSort]);

  const { enrichedColumns, toolbarColumns, toggleColumn } = useUnifiedColumns({
    tableId: "payments-unified",
    columns: allColumns,
    defaultVisible: allColumns.map(c => c.id),
  });

  const summaryColumns = useMemo<SummaryColumn[]>(() => {
    const totalUSD = filtered.reduce((s, p) => {
      const amt = parseFloat(p.amount);
      const rate = parseFloat(p.exchange_rate);
      return s + (p.currency_code === "USD" ? amt : amt / rate);
    }, 0);
    const totalSYP = filtered.reduce((s, p) => {
      const amt = parseFloat(p.amount);
      const rate = parseFloat(p.exchange_rate);
      return s + (p.currency_code === "SYP" ? amt : amt * rate);
    }, 0);
    const colIds = enrichedColumns.map(c => c.id);
    return colIds.map(id => {
      switch (id) {
        case 'journal_entry_number':
          return { id: 'count', label: '', value: `${filtered.length} سند`, className: 'text-slate-500 font-medium' };
        case 'amount_usd':
          return { id: 'amount_usd_summary', label: 'الإجمالي', value: formatAmount(totalUSD, { currencyCode: "USD" }), align: 'left' as const, className: 'text-slate-900 font-black' };
        case 'amount_syp':
          return { id: 'amount_syp_summary', label: 'الإجمالي', value: formatAmount(totalSYP, { currencyCode: "SYP" }), align: 'left' as const, className: 'text-slate-900 font-black' };
        default:
          return { id: `${id}_spacer`, label: '', value: '' };
      }
    });
  }, [filtered, formatAmount, enrichedColumns]);

  const handleCreate = async (payload: CreatePaymentRequest) => {
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

  const totalIn = useMemo(() => payments
    .filter(p => ["Receipt", "CashIn"].includes(p.payment_type))
    .reduce((s, p) => s + parseFloat(p.amount), 0), [payments]);
    
  const totalOut = useMemo(() => payments
    .filter(p => ["SupplierPayment", "CashOut", "ExpenseVoucher", "DrawingsVoucher"].includes(p.payment_type))
    .reduce((s, p) => s + parseFloat(p.amount), 0), [payments]);

  return (
    <OperationalTableTemplate
      title="السندات المالية"
      stats={[
        { label: "إجمالي المقبوضات", value: formatMonetaryAmount(totalIn, "base"), icon: ArrowDownCircle, color: "text-emerald-600" },
        { label: "إجمالي المدفوعات", value: formatMonetaryAmount(totalOut, "base"), icon: ArrowUpCircle, color: "text-rose-600" },
        { label: "الرصيد الصافي", value: formatMonetaryAmount(totalIn - totalOut, "base"), icon: Wallet, color: "text-blue-600" }
      ]}
      toolbar={
        <Button size="sm" onClick={() => { setSelectedPayment(null); setShowDialog(true); }} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 font-bold">
          <Plus className="w-4 h-4 ml-2" /> سند جديد
        </Button>
      }
      tableContent={
        <TableShell
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="بحث بالمستخدم، الحساب، البيان..."
          columns={toolbarColumns}
          onColumnToggle={toggleColumn}
          actions={
            <div className="flex items-center gap-2">
              <Button variant={typeFilter === "all" ? "default" : "outline"} size="sm" className="h-9" onClick={() => setTypeFilter("all")}>الكل</Button>
              <Button variant={typeFilter === "Receipt" ? "default" : "outline"} size="sm" className="h-9 text-emerald-600" onClick={() => setTypeFilter("Receipt")}>قبض</Button>
              <Button variant={typeFilter === "SupplierPayment" ? "default" : "outline"} size="sm" className="h-9 text-rose-600" onClick={() => setTypeFilter("SupplierPayment")}>دفع</Button>
            </div>
          }
        >
          <UnifiedTable
            data={filtered}
            columns={enrichedColumns}
            loading={paymentsLoading}
            onRowClick={(p) => setSelectedPayment(p)}
            selectedId={selectedPayment?.id}
            emptyMessage="لا توجد سندات مالية مسجلة"
            summary={summaryColumns}
          />
        </TableShell>
      }
      sidePanel={
        selectedPayment && !showDialog ? (
          <PaymentDetailPanel 
            payment={selectedPayment}
            accounts={accounts}
            customers={customers}
            suppliers={suppliers}
            onClose={() => setSelectedPayment(null)}
            onEdit={() => setShowDialog(true)}
            onDelete={() => handleDelete(selectedPayment.id)}
          />
        ) : showDialog ? (
          <PaymentForm
            customers={customers}
            suppliers={suppliers}
            accounts={accounts}
            onSave={handleUpdate}
            onClose={() => { setShowDialog(false); setSelectedPayment(null); }}
            saving={saving}
            initialValues={selectedPayment ? {
                ...selectedPayment,
                amount: parseFloat(selectedPayment.amount),
                exchange_rate: parseFloat(selectedPayment.exchange_rate)
            } : (initialType ? {
                payment_type: initialType as Payment['payment_type'],
                customer_id: initialCustomerId || undefined,
                supplier_id: initialSupplierId || undefined,
                debit_account_id: initialDrawingsAccountId || undefined,
            } : undefined)}
          />
        ) : null
      }
      isPanelOpen={!!selectedPayment || showDialog}
    />
  );
}
