import { useMemo } from "react";
import { UnifiedTable, type UnifiedColumn } from "@widgets/table-shell/UnifiedTable";
import { TableShell } from "@widgets/table-shell/TableShell";
import type { SummaryColumn } from "@widgets/table-shell/TableSummary";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useUnifiedColumns } from "@shared/hooks";
import { formatDateTime } from "@shared/lib/format";
import { Button } from "@shared/ui/button";
import type { InvoiceDto } from "@erp/shared-types";
import { DocumentStatusBadge } from "./DocumentStatusBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@shared/ui/dropdown-menu";
import { Eye, Settings2, CheckCircle2, History, Trash2, MoreHorizontal } from "lucide-react";

interface ExtraColumn {
  key: string;
  label: string;
  accessor: (inv: InvoiceDto) => string | React.ReactNode;
  className?: string;
}

interface InvoiceTableProps {
  data: InvoiceDto[];
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
  searchPlaceholder: string;
  emptyMessage: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onView: (inv: InvoiceDto) => void;
  onEdit: (inv: InvoiceDto) => void;
  onPost: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReopen: (id: string) => Promise<void>;
  partyLabel: string;
  partyType: "supplier" | "customer";
  defaultName: string;
  showSubtotal?: boolean;
  showExtraCosts?: boolean;
  extraColumns?: ExtraColumn[];
  statusFilter: string;
  onStatusFilterChange: (val: string) => void;
  toolbarTitle?: string;
}

export const getInvoiceBaseAmount = (
  originalAmount: string | number | null | undefined,
  v2Amount?: { base_amount?: string },
  currencyCode?: string,
  exchangeRate?: string,
  baseCurrencyCode?: string | null
): number => {
  if (v2Amount?.base_amount) {
    return parseFloat(v2Amount.base_amount) || 0;
  }
  const amt = typeof originalAmount === "string" ? parseFloat(originalAmount) : (originalAmount ?? 0);
  if (!amt) return 0;
  if (currencyCode && baseCurrencyCode && currencyCode === baseCurrencyCode) {
    return amt;
  }
  const rate = parseFloat(exchangeRate || "1") || 1;
  return amt / rate;
};

export function InvoiceTable({
  data,
  loading,
  search,
  onSearchChange,
  searchPlaceholder,
  emptyMessage,
  selectedId,
  onSelect,
  onView,
  onEdit,
  onPost,
  onDelete,
  onReopen,
  partyLabel,
  partyType,
  defaultName,
  showSubtotal = false,
  showExtraCosts = false,
  extraColumns = [],
  statusFilter,
  onStatusFilterChange,
}: InvoiceTableProps) {
  const { currencies, baseCurrency, formatAmount } = useCurrencyContext();

  const partyField = partyType === "supplier" ? "supplier_name" : "customer_name";

  const allColumns = useMemo<UnifiedColumn<InvoiceDto>[]>(() => {
    const cols: UnifiedColumn<InvoiceDto>[] = [
      {
        id: "invoice_number",
        header: "الرقم",
        label: "رقم الفاتورة",
        accessor: (inv) => (
          <span className="font-black text-blue-600 font-mono">{inv.invoice_number}</span>
        ),
      },
      {
        id: "notes",
        header: "التوصيف",
        label: "البيان/الملاحظات",
        accessor: (inv) => (
          <span className="text-slate-500 text-xs">{inv.notes || "—"}</span>
        ),
      },
      {
        id: partyField,
        header: partyLabel,
        label: partyLabel,
        accessor: (inv) => inv.invoice_type === "OpeningBalance" ? "—" : (partyType === "supplier" ? (inv.supplier_name || defaultName) : (inv.customer_name || defaultName)),
        className: "font-bold text-slate-800",
      },
      ...(showSubtotal ? currencies.map(curr => ({
        id: `subtotal_${curr.code}`,
        header: `مجموع الأسعار (${curr.symbol || curr.code})`,
        label: `مجموع الأسعار (${curr.symbol || curr.code})`,
        accessor: (inv: InvoiceDto) => {
          const baseAmt = getInvoiceBaseAmount(
            inv.subtotal_amount,
            inv.subtotal_amount_v2,
            inv.currency_code,
            inv.exchange_rate,
            baseCurrency?.code
          );
          if (baseAmt === 0) return "—";
          return formatAmount(baseAmt, { currencyCode: curr.code });
        },
        className: "font-bold tabular-nums text-slate-700",
      })) : []),
      ...(showExtraCosts ? currencies.map(curr => ({
        id: `extra_costs_${curr.code}`,
        header: `تكاليف إضافية (${curr.symbol || curr.code})`,
        label: `التكاليف الإضافية (${curr.symbol || curr.code})`,
        accessor: (inv: InvoiceDto) => {
          const baseAmt = getInvoiceBaseAmount(
            inv.extra_costs,
            inv.extra_costs_v2,
            inv.currency_code,
            inv.exchange_rate,
            baseCurrency?.code
          );
          if (baseAmt === 0) return "—";
          return formatAmount(baseAmt, { currencyCode: curr.code });
        },
        className: "font-bold tabular-nums text-rose-600",
      })) : []),
      ...currencies.map(curr => ({
        id: `total_${curr.code}`,
        header: `المجموع الكلي (${curr.symbol || curr.code})`,
        label: `المجموع الكلي (${curr.symbol || curr.code})`,
        accessor: (inv: InvoiceDto) => {
          const baseAmt = getInvoiceBaseAmount(
            inv.total_amount,
            inv.total_amount_v2,
            inv.currency_code,
            inv.exchange_rate,
            baseCurrency?.code
          );
          if (baseAmt === 0) return "—";
          return formatAmount(baseAmt, { currencyCode: curr.code });
        },
        className: "font-black tabular-nums text-slate-900",
      })),
      ...currencies.map(curr => ({
        id: `paid_${curr.code}`,
        header: `المدفوع (${curr.symbol || curr.code})`,
        label: `المبلغ المدفوع (${curr.symbol || curr.code})`,
        accessor: (inv: InvoiceDto) => {
          const baseAmt = getInvoiceBaseAmount(
            inv.amount_paid,
            inv.amount_paid_v2,
            inv.currency_code,
            inv.exchange_rate,
            baseCurrency?.code
          );
          if (baseAmt === 0) return "—";
          return formatAmount(baseAmt, { currencyCode: curr.code });
        },
        className: "font-bold tabular-nums text-emerald-600",
      })),
      ...currencies.map(curr => ({
        id: `remaining_${curr.code}`,
        header: `المتبقي (${curr.symbol || curr.code})`,
        label: `المبلغ المتبقي (${curr.symbol || curr.code})`,
        accessor: (inv: InvoiceDto) => {
          const baseAmt = getInvoiceBaseAmount(
            inv.remaining_amount,
            inv.remaining_amount_v2,
            inv.currency_code,
            inv.exchange_rate,
            baseCurrency?.code
          );
          if (baseAmt === 0) return "—";
          return formatAmount(baseAmt, { currencyCode: curr.code });
        },
        className: "font-bold tabular-nums text-orange-600",
      })),
      {
        id: "status",
        header: "الحالة",
        label: "حالة الفاتورة",
        accessor: (inv) => <DocumentStatusBadge status={inv.status} />,
        className: "text-center",
      },
      {
        id: "issued_at",
        header: "التاريخ",
        label: "تاريخ الفاتورة",
        accessor: (inv) => formatDateTime(inv.issued_at),
        className: "text-slate-500 text-xs tabular-nums",
      },
      ...extraColumns.map(c => ({
        id: c.key,
        header: c.label,
        label: c.label,
        accessor: c.accessor,
        className: c.className || "text-slate-500 text-xs",
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
        className: "w-[80px]",
      },
    ];
    return cols;
  }, [formatAmount, currencies, baseCurrency, partyField, partyLabel, partyType, defaultName, showSubtotal, showExtraCosts, extraColumns, onView, onEdit, onPost, onReopen, onDelete]);

  const defaultVisible = useMemo(() => allColumns.filter(c => c.id !== 'notes').map(c => c.id), [allColumns]);
  const { enrichedColumns, toolbarColumns, toggleColumn } = useUnifiedColumns({
    tableId: "invoices-unified",
    columns: allColumns,
    defaultVisible,
  });

  const summaryColumns = useMemo<SummaryColumn[]>(() => {
    let baseSubtotalTotal = 0;
    let baseExtraCostsTotal = 0;
    let baseTotalTotal = 0;
    let basePaidTotal = 0;
    let baseRemainingTotal = 0;

    data.forEach(inv => {
      baseSubtotalTotal += getInvoiceBaseAmount(inv.subtotal_amount, inv.subtotal_amount_v2, inv.currency_code, inv.exchange_rate, baseCurrency?.code);
      baseExtraCostsTotal += getInvoiceBaseAmount(inv.extra_costs, inv.extra_costs_v2, inv.currency_code, inv.exchange_rate, baseCurrency?.code);
      baseTotalTotal += getInvoiceBaseAmount(inv.total_amount, inv.total_amount_v2, inv.currency_code, inv.exchange_rate, baseCurrency?.code);
      basePaidTotal += getInvoiceBaseAmount(inv.amount_paid, inv.amount_paid_v2, inv.currency_code, inv.exchange_rate, baseCurrency?.code);
      baseRemainingTotal += getInvoiceBaseAmount(inv.remaining_amount, inv.remaining_amount_v2, inv.currency_code, inv.exchange_rate, baseCurrency?.code);
    });

    const colIds = enrichedColumns.map(c => c.id);
    return colIds.map(id => {
      if (id === 'invoice_number') {
        return { id: 'count', columnId: 'invoice_number', label: '', value: `${data.length} فاتورة`, className: 'text-slate-600 font-bold' };
      }

      const subtotalMatch = id.match(/^subtotal_(.+)$/);
      if (subtotalMatch) {
        const currCode = subtotalMatch[1];
        return {
          id: `${id}_summary`,
          columnId: id,
          label: 'الإجمالي الفرعي',
          value: baseSubtotalTotal > 0 ? formatAmount(baseSubtotalTotal, { currencyCode: currCode }) : "—",
          className: 'font-bold text-slate-700',
        };
      }

      const extraCostsMatch = id.match(/^extra_costs_(.+)$/);
      if (extraCostsMatch) {
        const currCode = extraCostsMatch[1];
        return {
          id: `${id}_summary`,
          columnId: id,
          label: 'التكاليف الإضافية',
          value: baseExtraCostsTotal > 0 ? formatAmount(baseExtraCostsTotal, { currencyCode: currCode }) : "—",
          className: 'font-bold text-rose-600',
        };
      }

      const totalMatch = id.match(/^total_(.+)$/);
      if (totalMatch) {
        const currCode = totalMatch[1];
        return {
          id: `${id}_summary`,
          columnId: id,
          label: 'الإجمالي',
          value: baseTotalTotal > 0 ? formatAmount(baseTotalTotal, { currencyCode: currCode }) : "—",
          className: 'font-black text-slate-900',
        };
      }

      const paidMatch = id.match(/^paid_(.+)$/);
      if (paidMatch) {
        const currCode = paidMatch[1];
        return {
          id: `${id}_summary`,
          columnId: id,
          label: 'المدفوع',
          value: basePaidTotal > 0 ? formatAmount(basePaidTotal, { currencyCode: currCode }) : "—",
          className: 'font-bold text-emerald-600',
        };
      }

      const remainingMatch = id.match(/^remaining_(.+)$/);
      if (remainingMatch) {
        const currCode = remainingMatch[1];
        return {
          id: `${id}_summary`,
          columnId: id,
          label: 'المتبقي',
          value: baseRemainingTotal > 0 ? formatAmount(baseRemainingTotal, { currencyCode: currCode }) : "—",
          className: 'font-bold text-orange-600',
        };
      }

      return { id: `${id}_spacer`, columnId: id, label: '', value: '' };
    });
  }, [data, enrichedColumns, formatAmount, baseCurrency]);

  return (
    <TableShell
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder={searchPlaceholder}
      columns={toolbarColumns}
      onColumnToggle={toggleColumn}
      showToolbar={true}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9 border-slate-200" onClick={() => onStatusFilterChange("all")}>الكل</Button>
          <Button variant="outline" size="sm" className="h-9 border-slate-200 text-amber-600" onClick={() => onStatusFilterChange("Draft")}>مسودة</Button>
          <Button variant="outline" size="sm" className="h-9 border-slate-200 text-emerald-600" onClick={() => onStatusFilterChange("Posted")}>مرحلة</Button>
        </div>
      }
    >
      <UnifiedTable
        data={data}
        columns={enrichedColumns}
        loading={loading}
        enableResize
        tableId="invoices"
        onRowClick={(inv) => onSelect(inv.id)}
        onRowDoubleClick={onView}
        selectedId={selectedId}
        emptyMessage={emptyMessage}
        summary={summaryColumns}
      />
    </TableShell>
  );
}
