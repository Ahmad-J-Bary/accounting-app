import { useMemo, useState } from "react";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { Button } from "@shared/ui/button";
import { Plus, Eye, Printer, ShoppingCart, Banknote, History, Settings2, Trash2, MoreHorizontal, CheckCircle2, Download, RefreshCw } from "lucide-react";
import { formatDateTime } from "@shared/lib/format";
import { InvoiceDto } from "@erp/shared-types";
import { UnifiedTable, type UnifiedColumn } from "@widgets/table-shell/UnifiedTable";
import { TableShell } from "@widgets/table-shell/TableShell";
import type { SummaryColumn } from "@widgets/table-shell/TableSummary";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useUnifiedColumns } from "@shared/hooks";
import { DocumentStatusBadge } from "./DocumentStatusBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@shared/ui/dropdown-menu";

interface ExtraColumn {
  key: string;
  label: string;
  accessor: (inv: InvoiceDto) => string | React.ReactNode;
  className?: string;
}

interface InvoiceListProps {
  invoices: InvoiceDto[];
  loading: boolean;
  search: string;
  partyIdFilter?: string;
  onSearchChange: (val: string) => void;
  onRefresh: () => void;
  onCreate: () => void;
  onEdit: (inv: InvoiceDto) => void;
  onView: (inv: InvoiceDto) => void;
  onPost: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReopen: (id: string) => Promise<void>;
  formatMonetaryAmount: (amount: string | number | { base_amount?: string } | null | undefined, mode: string) => string;
  partyType: "supplier" | "customer";
  title: string;
  createLabel: string;
  searchPlaceholder: string;
  emptyMessage: string;
  statsLabel: string;
  statsColor: string;
  preferenceKey: string;
  showSubtotal?: boolean;
  showExtraCosts?: boolean;
  extraColumns?: ExtraColumn[];
}

export function InvoiceList({
  invoices,
  loading,
  search,
  partyIdFilter,
  onSearchChange,
  onRefresh,
  onCreate,
  onEdit,
  onView,
  onPost,
  onDelete,
  onReopen,
  formatMonetaryAmount,
  partyType,
  title,
  createLabel,
  searchPlaceholder,
  emptyMessage,
  statsLabel,
  statsColor,
  preferenceKey,
  showSubtotal = false,
  showExtraCosts = false,
  extraColumns = [],
}: InvoiceListProps) {
  const { formatAmount } = useCurrencyContext();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const selectedInvoice = useMemo(() =>
    invoices.find(inv => inv.id === selectedId),
    [invoices, selectedId]);

  const handleDeleteSelected = async () => {
    if (!selectedId) return;
    if (!window.confirm("هل أنت متأكد من حذف هذه الفاتورة؟ سيتم حذف القيود المرتبطة بها أيضاً.")) return;
    await onDelete(selectedId);
    setSelectedId(null);
  };

  const filtered = useMemo(() =>
    invoices.filter(inv => {
      const matchesSearch = !search ||
        inv.invoice_number.includes(search) ||
        (partyType === "supplier" ? (inv.supplier_name ?? "") : (inv.customer_name ?? "")).includes(search) ||
        (inv.notes ?? "").includes(search);
      const matchesParty = !partyIdFilter ||
        (partyType === "supplier" ? inv.supplier_id === partyIdFilter : inv.customer_id === partyIdFilter);
      const matchesStatus = statusFilter === "all" || inv.status === statusFilter;
      return matchesSearch && matchesParty && matchesStatus;
    }), [invoices, search, partyIdFilter, statusFilter, partyType]);

  const partyLabel = partyType === "supplier" ? "المورد" : "الزبون";
  const partyField = partyType === "supplier" ? "supplier_name" : "customer_name";
  const defaultName = partyType === "supplier" ? "مورد نقدي" : "زبون نقدي";

  const allColumns = useMemo<UnifiedColumn<InvoiceDto>[]>(() => {
    const cols: UnifiedColumn<InvoiceDto>[] = [
      {
        id: "invoice_number",
        header: "الرقم",
        label: "رقم الفاتورة",
        accessor: (inv) => (
          <span className="font-black text-blue-600 font-mono">{inv.invoice_number}</span>
        ),
        className: "w-24"
      },
      {
        id: "notes",
        header: "التوصيف",
        label: "البيان/الملاحظات",
        accessor: (inv) => (
          <span className="text-slate-500 text-xs truncate max-w-[200px] inline-block">{inv.notes || "—"}</span>
        ),
        className: "min-w-[150px]"
      },
      {
        id: partyField,
        header: partyLabel,
        label: partyLabel,
        accessor: (inv) => inv.invoice_type === "OpeningBalance" ? "—" : (partyType === "supplier" ? (inv.supplier_name || defaultName) : (inv.customer_name || defaultName)),
        className: "font-bold text-slate-800"
      },
      ...(showSubtotal ? [{
        id: "subtotal_amount",
        header: "مجموع الأسعار",
        label: "مجموع الأسعار (قبل الإضافات)",
        accessor: (inv: InvoiceDto) => formatAmount(parseFloat(inv.subtotal_amount || "0"), { currencyCode: inv.currency_code }),
        align: "left" as const,
        className: "font-bold tabular-nums text-slate-700"
      }] : []),
      ...(showExtraCosts ? [{
        id: "extra_costs",
        header: "تكاليف إضافية",
        label: "التكاليف الإضافية",
        accessor: (inv: InvoiceDto) => formatAmount(parseFloat(inv.extra_costs || "0"), { currencyCode: inv.currency_code }),
        align: "left" as const,
        className: "font-bold tabular-nums text-rose-600"
      }] : []),
      {
        id: "total_amount",
        header: "المجموع الكلي",
        label: "المجموع الكلي",
        accessor: (inv) => formatAmount(parseFloat(inv.total_amount || "0"), { currencyCode: inv.currency_code }),
        align: "left",
        className: "font-black tabular-nums text-slate-900"
      },
      {
        id: "amount_paid",
        header: "المدفوع",
        label: "المبلغ المدفوع",
        accessor: (inv) => formatAmount(parseFloat(inv.amount_paid || "0"), { currencyCode: inv.currency_code }),
        align: "left",
        className: "font-bold tabular-nums text-emerald-600"
      },
      {
        id: "remaining_amount",
        header: "المتبقي",
        label: "المبلغ المتبقي",
        accessor: (inv) => formatAmount(parseFloat(inv.remaining_amount || "0"), { currencyCode: inv.currency_code }),
        align: "left",
        className: "font-bold tabular-nums text-orange-600"
      },
      {
        id: "status",
        header: "الحالة",
        label: "حالة الفاتورة",
        accessor: (inv) => <DocumentStatusBadge status={inv.status} />,
        className: "text-center w-24"
      },
      {
        id: "issued_at",
        header: "التاريخ",
        label: "تاريخ الفاتورة",
        accessor: (inv) => formatDateTime(inv.issued_at),
        className: "text-slate-500 text-xs tabular-nums w-32"
      },
      ...extraColumns.map(c => ({
        id: c.key,
        header: c.label,
        label: c.label,
        accessor: c.accessor,
        className: c.className || "text-slate-500 text-xs"
      })),
      {
        id: "actions",
        header: "إجراءات",
        label: "إجراءات",
        accessor: (inv) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              <DropdownMenuItem onClick={() => onView(inv)} className="flex-row-reverse gap-2">
                <Eye className="w-4 h-4" /> عرض الفاتورة
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(inv)} className="flex-row-reverse gap-2 text-amber-600 focus:text-amber-600">
                <Settings2 className="w-4 h-4" /> تعديل
              </DropdownMenuItem>
              {inv.status === 'Draft' && (
                <DropdownMenuItem onClick={() => onPost(inv.id)} className="flex-row-reverse gap-2 text-emerald-600 focus:text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" /> ترحيل الآن
                </DropdownMenuItem>
              )}
              {inv.status === 'Posted' && (
                <DropdownMenuItem onClick={() => onReopen(inv.id)} className="flex-row-reverse gap-2 text-blue-600 focus:text-blue-600">
                  <History className="w-4 h-4" /> إلغاء الترحيل
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => {
                if (window.confirm("هل أنت متأكد من حذف هذه الفاتورة؟")) {
                  onDelete(inv.id);
                }
              }} className="flex-row-reverse gap-2 text-rose-600 focus:text-rose-600">
                <Trash2 className="w-4 h-4" /> حذف الفاتورة
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        align: "center",
        className: "w-[80px]"
      }
    ];
    return cols;
  }, [formatAmount, partyField, partyLabel, partyType, defaultName, showSubtotal, showExtraCosts, extraColumns, onView, onEdit, onPost, onReopen, onDelete]);

  const defaultVisible = useMemo(() => allColumns.filter(c => c.id !== 'notes').map(c => c.id), [allColumns]);
  const { enrichedColumns, toolbarColumns, toggleColumn } = useUnifiedColumns({
    tableId: preferenceKey,
    columns: allColumns,
    defaultVisible,
  });

  const stats = useMemo(() => {
    const total = filtered.reduce((acc, inv) => acc + parseFloat(inv.total_amount_v2?.base_amount || inv.total_amount || "0"), 0);
    return [
      { label: "عدد الفواتير", value: filtered.length, icon: ShoppingCart, color: "text-slate-900" },
      { label: statsLabel, value: formatMonetaryAmount(total.toString(), "base"), icon: Banknote, color: statsColor },
      { label: "فواتير معلقة", value: filtered.filter(i => i.status === 'Draft').length, icon: History, color: "text-amber-600" },
    ];
  }, [filtered, formatMonetaryAmount, statsLabel, statsColor]);

  const summaryColumns = useMemo<SummaryColumn[]>(() => {
    const totalAmount = filtered.reduce((s, inv) => s + parseFloat(inv.total_amount || "0"), 0);
    const totalPaid = filtered.reduce((s, inv) => s + parseFloat(inv.amount_paid || "0"), 0);
    const totalRemaining = filtered.reduce((s, inv) => s + parseFloat(inv.remaining_amount || "0"), 0);
    const colIds = enrichedColumns.map(c => c.id);
    return colIds.map(id => {
      switch (id) {
        case 'invoice_number':
          return { id: 'count', label: '', value: `${filtered.length} فاتورة`, className: 'text-slate-600 font-bold' };
        case 'total_amount':
          return { id: 'total_amount_summary', label: 'الإجمالي', value: formatAmount(totalAmount, { currencyCode: 'USD' }), align: 'left' as const, className: 'font-black text-slate-900' };
        case 'amount_paid':
          return { id: 'amount_paid_summary', label: 'المدفوع', value: formatAmount(totalPaid, { currencyCode: 'USD' }), align: 'left' as const, className: 'font-bold text-emerald-600' };
        case 'remaining_amount':
          return { id: 'remaining_summary', label: 'المتبقي', value: formatAmount(totalRemaining, { currencyCode: 'USD' }), align: 'left' as const, className: 'font-bold text-orange-600' };
        default:
          return { id: `${id}_spacer`, label: '', value: '' };
      }
    });
  }, [filtered, enrichedColumns, formatAmount]);

  return (
    <OperationalTableTemplate
      title={title}
      stats={stats}
      toolbar={
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={onCreate} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 h-9 px-4 font-bold">
            <Plus className="w-4 h-4 ml-2" />{createLabel}
          </Button>
          <div className="w-[1px] h-6 bg-slate-200 mx-1" />
          <Button variant="outline" size="sm" disabled={!selectedId}
            onClick={() => selectedInvoice && onView(selectedInvoice)}
            className="h-9 border-slate-200 hover:bg-slate-50 font-bold">
            <Eye className="w-4 h-4 ml-2 text-blue-500" /> عرض
          </Button>
          <Button variant="outline" size="sm" disabled={!selectedId}
            onClick={() => selectedInvoice && onEdit(selectedInvoice)}
            className="h-9 border-slate-200 hover:bg-slate-50 font-bold">
            <Settings2 className="w-4 h-4 ml-2 text-amber-500" /> تعديل
          </Button>
          <Button variant="outline" size="sm" disabled={!selectedId}
            onClick={handleDeleteSelected}
            className="h-9 border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 font-bold transition-all">
            <Trash2 className="w-4 h-4 ml-2 text-rose-500" /> حذف
          </Button>
          <div className="w-[1px] h-6 bg-slate-200 mx-1" />
          <Button variant="outline" size="sm" disabled={!selectedId}
            onClick={() => window.print()}
            className="h-9 border-slate-200 hover:bg-slate-50 font-bold">
            <Printer className="w-4 h-4 ml-2 text-slate-500" /> طباعة
          </Button>
          <Button variant="outline" size="sm"
            onClick={() => onRefresh()}
            className="h-9 border-slate-200 hover:bg-slate-50 font-bold">
            <RefreshCw className="w-4 h-4 ml-2 text-slate-500" /> تحديث
          </Button>
        </div>
      }
      tableContent={
        <TableShell
          search={search}
          onSearchChange={onSearchChange}
          searchPlaceholder={searchPlaceholder}
          columns={toolbarColumns}
          onColumnToggle={toggleColumn}
          actions={
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-9 border-slate-200" onClick={() => setStatusFilter("all")}>الكل</Button>
              <Button variant="outline" size="sm" className="h-9 border-slate-200 text-amber-600" onClick={() => setStatusFilter("Draft")}>مسودة</Button>
              <Button variant="outline" size="sm" className="h-9 border-slate-200 text-emerald-600" onClick={() => setStatusFilter("Posted")}>مرحلة</Button>
            </div>
          }
        >
          <UnifiedTable
            data={filtered}
            columns={enrichedColumns}
            loading={loading}
            onRowClick={(inv) => setSelectedId(inv.id)}
            onRowDoubleClick={onView}
            selectedId={selectedId}
            emptyMessage={emptyMessage}
            summary={summaryColumns}
          />
        </TableShell>
      }
    />
  );
}
