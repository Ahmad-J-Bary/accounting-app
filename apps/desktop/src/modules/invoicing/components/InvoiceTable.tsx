import { useMemo, useCallback } from "react";
import { UnifiedTable, type UnifiedColumn } from "@widgets/table-shell/UnifiedTable";
import { TableShell } from "@widgets/table-shell/TableShell";
import type { SummaryColumn } from "@widgets/table-shell/TableSummary";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useUnifiedColumns, useSortable, useBaseCurrencyColumns, useExportSetup } from "@shared/hooks";
import { executeExport, dateCol } from "@shared/lib/excel";
import type { ExcelExportColumn } from "@shared/lib/excel";
import { currencyAmountCols } from "@shared/lib/excel/column-helpers";
import { Button } from "@shared/ui/button";
import { formatDateTime, formatNumber } from "@shared/lib/format";
import { getInvoiceBaseAmount } from "../lib/invoiceHelpers";
import type { InvoiceDto } from "@erp/shared-types";
import { DocumentStatusBadge } from "./DocumentStatusBadge";
import { TableActions } from "@widgets/table-shell/TableActions";
import { CheckCircle2, History, Filter, Download } from "lucide-react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@shared/ui/select";

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
  onViewOpeningBalance?: (inv: InvoiceDto) => void;
  onEditOpeningBalance?: (inv: InvoiceDto) => void;
  onPost: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReopen: (id: string) => Promise<void>;
  onExportRow?: (inv: InvoiceDto) => void;
  partyLabel: string;
  partyType: "supplier" | "customer";
  defaultName: string;
  showSubtotal?: boolean;
  showDiscountGranted?: boolean;
  showDiscount?: boolean;
  showExtraCosts?: boolean;
  extraColumns?: ExtraColumn[];
  statusFilter: string;
  onStatusFilterChange: (val: string) => void;
  toolbarTitle?: string;
  tableId?: string;
}

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
  onViewOpeningBalance,
  onEditOpeningBalance,
  onPost,
  onDelete,
  onReopen,
  onExportRow,
  partyLabel,
  partyType,
  defaultName,
  showSubtotal = false,
  showDiscountGranted = false,
  showDiscount = false,
  showExtraCosts = false,
  extraColumns = [],
  statusFilter,
  onStatusFilterChange,
  tableId = "invoices-unified",
}: InvoiceTableProps) {
  const { currencies, baseCurrency, formatAmount } = useCurrencyContext();
  const { isBaseCurrency, currencySuffix: cs } = useBaseCurrencyColumns();

  const partyField = partyType === "supplier" ? "supplier_name" : "customer_name";

  const allColumns = useMemo<UnifiedColumn<InvoiceDto>[]>(() => {
    const cols: UnifiedColumn<InvoiceDto>[] = [
      {
        id: "invoice_number",
        header: "الرقم",
        label: "رقم الفاتورة",
        accessor: (inv) => formatNumber(parseInt(inv.invoice_number) || 0),
        className: "font-black text-slate-900 text-center"
      },
      {
        id: partyField,
        header: partyLabel,
        label: partyLabel,
        accessor: (inv) => inv.invoice_type === "OpeningBalance" ? "" : (partyType === "supplier" ? (inv.supplier_name || defaultName) : (inv.customer_name || defaultName)),
        className: "font-bold text-slate-800"
      },
      ...(showSubtotal ? currencies.map(curr => {
        const isBase = isBaseCurrency(curr.code);
        return {
          id: `subtotal_${curr.code}`,
          header: `مجموع الأسعار${cs(curr.symbol || curr.code)}`,
          label: `مجموع الأسعار${cs(curr.symbol || curr.code)}`,
          accessor: (inv: InvoiceDto) => {
            const baseAmt = getInvoiceBaseAmount(
              inv.subtotal_amount,
              inv.subtotal_amount_v2,
              inv.currency_code,
              inv.exchange_rate,
              baseCurrency?.code
            );
            if (baseAmt === 0) return "";
            return formatAmount(baseAmt, { currencyCode: curr.code });
          },
          className: isBase
            ? "font-bold tabular-nums text-slate-700"
            : "font-medium tabular-nums text-slate-400"
        };
      }) : []),
      ...(showDiscountGranted ? currencies.map(curr => {
        const isBase = isBaseCurrency(curr.code);
        return {
          id: `discount_granted_${curr.code}`,
          header: `خصوم ممنوحة${cs(curr.symbol || curr.code)}`,
          label: `خصوم ممنوحة${cs(curr.symbol || curr.code)}`,
          accessor: (inv: InvoiceDto) => {
            const baseAmt = getInvoiceBaseAmount(
              inv.discount_amount,
              inv.discount_amount_v2,
              inv.currency_code,
              inv.exchange_rate,
              baseCurrency?.code
            );
            if (baseAmt === 0) return "";
            return formatAmount(baseAmt, { currencyCode: curr.code });
          },
          className: isBase
            ? "font-bold tabular-nums text-rose-600"
            : "font-medium tabular-nums text-rose-300"
        };
      }) : []),
      ...(showDiscount ? currencies.map(curr => {
        const isBase = isBaseCurrency(curr.code);
        return {
          id: `discount_${curr.code}`,
          header: `خصوم مكتسبة${cs(curr.symbol || curr.code)}`,
          label: `خصوم مكتسبة${cs(curr.symbol || curr.code)}`,
          accessor: (inv: InvoiceDto) => {
            const baseAmt = getInvoiceBaseAmount(
              inv.discount_amount,
              inv.discount_amount_v2,
              inv.currency_code,
              inv.exchange_rate,
              baseCurrency?.code
            );
            if (baseAmt === 0) return "";
            return formatAmount(baseAmt, { currencyCode: curr.code });
          },
          className: isBase
            ? "font-bold tabular-nums text-blue-600"
            : "font-medium tabular-nums text-blue-300"
        };
      }) : []),
      ...(showExtraCosts ? currencies.map(curr => {
        const isBase = isBaseCurrency(curr.code);
        return {
          id: `extra_costs_${curr.code}`,
          header: `تكاليف إضافية${cs(curr.symbol || curr.code)}`,
          label: `التكاليف الإضافية${cs(curr.symbol || curr.code)}`,
          accessor: (inv: InvoiceDto) => {
            const baseAmt = getInvoiceBaseAmount(
              inv.extra_costs,
              inv.extra_costs_v2,
              inv.currency_code,
              inv.exchange_rate,
              baseCurrency?.code
            );
            if (baseAmt === 0) return "";
            return formatAmount(baseAmt, { currencyCode: curr.code });
          },
          className: isBase
            ? "font-bold tabular-nums text-rose-600"
            : "font-medium tabular-nums text-rose-300"
        };
      }) : []),
      ...currencies.map(curr => {
        const isBase = isBaseCurrency(curr.code);
        return {
          id: `total_${curr.code}`,
          header: `المجموع الكلي${cs(curr.symbol || curr.code)}`,
          label: `المجموع الكلي${cs(curr.symbol || curr.code)}`,
          accessor: (inv: InvoiceDto) => {
            const baseSubtotal = getInvoiceBaseAmount(inv.subtotal_amount, inv.subtotal_amount_v2, inv.currency_code, inv.exchange_rate, baseCurrency?.code);
            const baseDiscount = getInvoiceBaseAmount(inv.discount_amount, inv.discount_amount_v2, inv.currency_code, inv.exchange_rate, baseCurrency?.code);
            const baseExtraCosts = getInvoiceBaseAmount(inv.extra_costs, inv.extra_costs_v2, inv.currency_code, inv.exchange_rate, baseCurrency?.code);
            const total = baseSubtotal - baseDiscount + baseExtraCosts;
            if (total === 0) return "";
            return formatAmount(total, { currencyCode: curr.code });
          },
          className: isBase
            ? "font-black tabular-nums text-slate-900"
            : "font-medium tabular-nums text-slate-400"
        };
      }),
      ...currencies.map(curr => {
        const isBase = isBaseCurrency(curr.code);
        return {
          id: `paid_${curr.code}`,
          header: `المبلغ المدفوع${cs(curr.symbol || curr.code)}`,
          label: `المبلغ المدفوع${cs(curr.symbol || curr.code)}`,
          accessor: (inv: InvoiceDto) => {
            const baseAmt = getInvoiceBaseAmount(
              inv.amount_paid,
              inv.amount_paid_v2,
              inv.currency_code,
              inv.exchange_rate,
              baseCurrency?.code
            );
            if (baseAmt === 0) return "";
            return formatAmount(baseAmt, { currencyCode: curr.code });
          },
          className: isBase
            ? "font-bold tabular-nums text-emerald-600"
            : "font-medium tabular-nums text-emerald-300"
        };
      }),
      ...currencies.map(curr => {
        const isBase = isBaseCurrency(curr.code);
        return {
          id: `remaining_${curr.code}`,
          header: `المبلغ المتبقي${cs(curr.symbol || curr.code)}`,
          label: `المبلغ المتبقي${cs(curr.symbol || curr.code)}`,
          accessor: (inv: InvoiceDto) => {
            const baseSubtotal = getInvoiceBaseAmount(inv.subtotal_amount, inv.subtotal_amount_v2, inv.currency_code, inv.exchange_rate, baseCurrency?.code);
            const baseDiscount = getInvoiceBaseAmount(inv.discount_amount, inv.discount_amount_v2, inv.currency_code, inv.exchange_rate, baseCurrency?.code);
            const baseExtraCosts = getInvoiceBaseAmount(inv.extra_costs, inv.extra_costs_v2, inv.currency_code, inv.exchange_rate, baseCurrency?.code);
            const basePaid = getInvoiceBaseAmount(inv.amount_paid, inv.amount_paid_v2, inv.currency_code, inv.exchange_rate, baseCurrency?.code);
            const total = baseSubtotal - baseDiscount + baseExtraCosts;
            const remaining = total - basePaid;
            if (remaining === 0) return "";
            return formatAmount(remaining, { currencyCode: curr.code });
          },
          className: isBase
            ? "font-bold tabular-nums text-orange-600"
            : "font-medium tabular-nums text-orange-300"
        };
      }),
      {
        id: "status",
        header: "الحالة",
        label: "حالة الفاتورة",
        accessor: (inv) => <DocumentStatusBadge status={inv.status} />
      },
      {
        id: "notes",
        header: "التوصيف",
        label: "التوصيف",
        accessor: (inv) => inv.notes || "",
        className: "text-slate-500 italic"
      },
      {
        id: "issued_at",
        header: "التاريخ",
        label: "تاريخ الفاتورة",
        accessor: (inv) => formatDateTime(inv.issued_at),
        className: "text-slate-500 tabular-nums"
      },
      ...extraColumns.map(c => ({
        id: c.key,
        header: c.label,
        label: c.label,
        accessor: c.accessor,
        className: c.className || "text-slate-500"
      })),
      {
        id: "actions",
        header: "إجراءات",
        label: "إجراءات",
        accessor: (inv) => {
          const extraActions = [];
          if (inv.status === "Draft") {
            extraActions.push({
              label: "ترحيل الآن",
              icon: CheckCircle2,
              onClick: () => onPost(inv.id),
            });
          } else if (inv.status === "Posted") {
            extraActions.push({
              label: "إلغاء الترحيل",
              icon: History,
              onClick: () => onReopen(inv.id),
            });
          }
          const isOpeningBalance = inv.invoice_type === "OpeningBalance";
          return (
            <TableActions
              onView={() => isOpeningBalance && onViewOpeningBalance ? onViewOpeningBalance(inv) : onView(inv)}
              onEdit={() => isOpeningBalance && onEditOpeningBalance ? onEditOpeningBalance(inv) : onEdit(inv)}
              onDelete={() => {
                if (window.confirm("هل أنت متأكد من حذف هذه الفاتورة؟")) {
                  onDelete(inv.id);
                }
              }}
              onExportRow={onExportRow ? () => onExportRow(inv) : undefined}
              extraActions={extraActions}
              align="start"
            />
          );
        }
      },
    ];
    return cols;
  }, [formatAmount, currencies, baseCurrency, partyField, partyLabel, partyType, defaultName, showSubtotal, showDiscountGranted, showDiscount, showExtraCosts, extraColumns, onView, onEdit, onViewOpeningBalance, onEditOpeningBalance, onPost, onReopen, onDelete, onExportRow, isBaseCurrency, cs]);

  // Default visible: hide secondary currency columns by default.
  // User can toggle them on.
  const defaultVisible = useMemo(() => {
    const baseCode = baseCurrency?.code;
    return allColumns
      .filter((c) => {
        // For per-currency columns, only include the base currency
        const m = c.id.match(/^(.+)_([A-Za-z0-9]+)$/);
        if (m && currencies.some(curr => curr.code === m[2])) {
          return m[2] === baseCode;
        }
        return true;
      })
      .map((c) => c.id);
  }, [allColumns, baseCurrency, currencies]);

  type SortField =
    | "invoice_number"
    | "notes"
    | "supplier_name"
    | "customer_name"
    | "subtotal_amount"
    | "discount_amount"
    | "extra_costs"
    | "total_amount"
    | "amount_paid"
    | "remaining_amount"
    | "status"
    | "issued_at";

  const { sortedData, sortField, sortDirection, handleSort } = useSortable({
    data,
    defaultField: "issued_at" as SortField,
    defaultDirection: "desc",
    sortFn: (a, b, field, direction) => {
      let comparison = 0;
      switch (field) {
        case "invoice_number":
          comparison = (a.invoice_number || "").localeCompare(b.invoice_number || "", "ar", { numeric: true });
          break;
        case "notes":
          comparison = (a.notes || "").localeCompare(b.notes || "", "ar");
          break;
        case "supplier_name":
        case "customer_name": {
          const valA = a.invoice_type === "OpeningBalance" ? "" : (partyType === "supplier" ? (a.supplier_name || defaultName) : (a.customer_name || defaultName));
          const valB = b.invoice_type === "OpeningBalance" ? "" : (partyType === "supplier" ? (b.supplier_name || defaultName) : (b.customer_name || defaultName));
          comparison = valA.localeCompare(valB, "ar");
          break;
        }
        case "subtotal_amount": {
          const baseAmtA = getInvoiceBaseAmount(a.subtotal_amount, a.subtotal_amount_v2, a.currency_code, a.exchange_rate, baseCurrency?.code);
          const baseAmtB = getInvoiceBaseAmount(b.subtotal_amount, b.subtotal_amount_v2, b.currency_code, b.exchange_rate, baseCurrency?.code);
          comparison = baseAmtA - baseAmtB;
          break;
        }
        case "discount_amount": {
          const baseAmtA = getInvoiceBaseAmount(a.discount_amount, a.discount_amount_v2, a.currency_code, a.exchange_rate, baseCurrency?.code);
          const baseAmtB = getInvoiceBaseAmount(b.discount_amount, b.discount_amount_v2, b.currency_code, b.exchange_rate, baseCurrency?.code);
          comparison = baseAmtA - baseAmtB;
          break;
        }
        case "extra_costs": {
          const baseAmtA = getInvoiceBaseAmount(a.extra_costs, a.extra_costs_v2, a.currency_code, a.exchange_rate, baseCurrency?.code);
          const baseAmtB = getInvoiceBaseAmount(b.extra_costs, b.extra_costs_v2, b.currency_code, b.exchange_rate, baseCurrency?.code);
          comparison = baseAmtA - baseAmtB;
          break;
        }
        case "total_amount": {
          const calc = (inv: InvoiceDto) => {
            const s = getInvoiceBaseAmount(inv.subtotal_amount, inv.subtotal_amount_v2, inv.currency_code, inv.exchange_rate, baseCurrency?.code);
            const d = getInvoiceBaseAmount(inv.discount_amount, inv.discount_amount_v2, inv.currency_code, inv.exchange_rate, baseCurrency?.code);
            const e = getInvoiceBaseAmount(inv.extra_costs, inv.extra_costs_v2, inv.currency_code, inv.exchange_rate, baseCurrency?.code);
            return s - d + e;
          };
          comparison = calc(a) - calc(b);
          break;
        }
        case "amount_paid": {
          const baseAmtA = getInvoiceBaseAmount(a.amount_paid, a.amount_paid_v2, a.currency_code, a.exchange_rate, baseCurrency?.code);
          const baseAmtB = getInvoiceBaseAmount(b.amount_paid, b.amount_paid_v2, b.currency_code, b.exchange_rate, baseCurrency?.code);
          comparison = baseAmtA - baseAmtB;
          break;
        }
        case "remaining_amount": {
          const calc = (inv: InvoiceDto) => {
            const s = getInvoiceBaseAmount(inv.subtotal_amount, inv.subtotal_amount_v2, inv.currency_code, inv.exchange_rate, baseCurrency?.code);
            const d = getInvoiceBaseAmount(inv.discount_amount, inv.discount_amount_v2, inv.currency_code, inv.exchange_rate, baseCurrency?.code);
            const e = getInvoiceBaseAmount(inv.extra_costs, inv.extra_costs_v2, inv.currency_code, inv.exchange_rate, baseCurrency?.code);
            const p = getInvoiceBaseAmount(inv.amount_paid, inv.amount_paid_v2, inv.currency_code, inv.exchange_rate, baseCurrency?.code);
            return (s - d + e) - p;
          };
          comparison = calc(a) - calc(b);
          break;
        }
        case "status":
          comparison = (a.status || "").localeCompare(b.status || "", "ar");
          break;
        case "issued_at":
          comparison = new Date(a.issued_at).getTime() - new Date(b.issued_at).getTime();
          break;
      }
      return direction === "asc" ? comparison : -comparison;
    }
  });

  const { enrichedColumns, toolbarColumns, toggleColumn, resetToDefault, isModified } = useUnifiedColumns({
    tableId,
    columns: allColumns,
    defaultVisible,
  });

  const { exportData, ratesSheet, rateMap, currencyMode } = useExportSetup();

  const handleExport = useCallback(async () => {
    const summary: Record<string, 'sum' | 'subtotal' | 'average' | null> = {};
    const hasSecondary = currencies.length > 1;

    const baseAccessors: Record<string, (inv: InvoiceDto) => number> = {
      subtotal: (inv) => getInvoiceBaseAmount(inv.subtotal_amount, inv.subtotal_amount_v2, inv.currency_code, inv.exchange_rate, baseCurrency?.code),
      discount_granted: (inv) => getInvoiceBaseAmount(inv.discount_amount, inv.discount_amount_v2, inv.currency_code, inv.exchange_rate, baseCurrency?.code),
      discount: (inv) => getInvoiceBaseAmount(inv.discount_amount, inv.discount_amount_v2, inv.currency_code, inv.exchange_rate, baseCurrency?.code),
      extra_costs: (inv) => getInvoiceBaseAmount(inv.extra_costs, inv.extra_costs_v2, inv.currency_code, inv.exchange_rate, baseCurrency?.code),
      paid: (inv) => getInvoiceBaseAmount(inv.amount_paid, inv.amount_paid_v2, inv.currency_code, inv.exchange_rate, baseCurrency?.code),
      total: (inv) => {
        const sub = getInvoiceBaseAmount(inv.subtotal_amount, inv.subtotal_amount_v2, inv.currency_code, inv.exchange_rate, baseCurrency?.code);
        const disc = getInvoiceBaseAmount(inv.discount_amount, inv.discount_amount_v2, inv.currency_code, inv.exchange_rate, baseCurrency?.code);
        const ext = getInvoiceBaseAmount(inv.extra_costs, inv.extra_costs_v2, inv.currency_code, inv.exchange_rate, baseCurrency?.code);
        return sub - disc + ext;
      },
      remaining: (inv) => {
        const sub = getInvoiceBaseAmount(inv.subtotal_amount, inv.subtotal_amount_v2, inv.currency_code, inv.exchange_rate, baseCurrency?.code);
        const disc = getInvoiceBaseAmount(inv.discount_amount, inv.discount_amount_v2, inv.currency_code, inv.exchange_rate, baseCurrency?.code);
        const ext = getInvoiceBaseAmount(inv.extra_costs, inv.extra_costs_v2, inv.currency_code, inv.exchange_rate, baseCurrency?.code);
        const paid = getInvoiceBaseAmount(inv.amount_paid, inv.amount_paid_v2, inv.currency_code, inv.exchange_rate, baseCurrency?.code);
        return sub - disc + ext - paid;
      },
    };

    const labels: Record<string, string> = {
      subtotal: "مجموع الأسعار",
      discount_granted: "خصوم ممنوحة",
      discount: "خصوم مكتسبة",
      extra_costs: "تكاليف إضافية",
      total: "المجموع الكلي",
      paid: "المبلغ المدفوع",
      remaining: "المبلغ المتبقي",
    };

    const allMetricCols = Object.entries(baseAccessors).flatMap(([prefix, accessor]) =>
      currencyAmountCols(prefix, labels[prefix], (row) => accessor(row as unknown as InvoiceDto), currencies, formatAmount, "", true, hasSecondary, currencyMode, baseCurrency?.code, rateMap)
    );
    const metricColMap = new Map(allMetricCols.map(c => [c.id, c]));

    // Replace static accessors with formulas for computed columns
    const discPrefix = showDiscountGranted ? 'discount_granted' : showDiscount ? 'discount' : null;
    for (const col of allMetricCols) {
      const totalMatch = col.id.match(/^total_(.+)$/);
      if (totalMatch) {
        const code = totalMatch[1];
        const discExpr = discPrefix ? `-{col('${discPrefix}_${code}')}{row}` : '';
        const extraExpr = showExtraCosts ? `+{col('extra_costs_${code}')}{row}` : '';
        col.formula = `{col('subtotal_${code}')}{row}${discExpr}${extraExpr}`;
        delete col.accessor;
        continue;
      }
      const remainingMatch = col.id.match(/^remaining_(.+)$/);
      if (remainingMatch) {
        const code = remainingMatch[1];
        col.formula = `{col('total_${code}')}{row}-{col('paid_${code}')}{row}`;
        delete col.accessor;
      }
    }

    const exportColumns: ExcelExportColumn[] = enrichedColumns
      .filter((col) => col.id !== "actions")
      .map((col) => {
        const metricMatch = col.id.match(/^(subtotal|discount_granted|discount|extra_costs|total|paid|remaining)_(.+)$/);

        if (metricMatch) {
          summary[col.id] = "subtotal";
        }

        const headerText = typeof col.header === "string" && col.header ? col.header : String(col.label || col.id);

        if (col.id === "issued_at") {
          return {
            ...dateCol("issued_at", headerText, (row) => (row as unknown as InvoiceDto).issued_at),
            hidden: col.visible === false,
          };
        }

        if (metricMatch) {
          const exportCol = metricColMap.get(col.id);
          return {
            ...exportCol,
            label: headerText,
            hidden: col.visible === false,
          };
        }

        return {
          id: col.id,
          label: headerText,
          hidden: col.visible === false,
          width: 15,
          accessor: (row) => {
            const inv = row as unknown as InvoiceDto;
            if (col.id === "invoice_number") return parseInt(inv.invoice_number ?? "0", 10) || 0;
            if (col.id === partyField) return (partyType === "supplier" ? inv.supplier_name : inv.customer_name) || defaultName;
            if (col.id === "status") return inv.status === "Posted" ? "مرحّل" : "مسودة";
            if (col.id === "notes") return inv.notes || "";
            const extra = extraColumns.find((c) => c.key === col.id);
            if (extra) {
              const res = extra.accessor(inv);
              return typeof res === "string" || typeof res === "number" ? res : "";
            }
            return "";
          },
        };
      });

    const exportTitle = partyType === "supplier" ? "قائمة فواتير المشتريات" : "قائمة فواتير المبيعات";

    await executeExport(exportData, {
      sheetName: exportTitle,
      filename: exportTitle,
      data: sortedData as unknown as Record<string, unknown>[],
      columns: exportColumns,
      summary: Object.keys(summary).length > 0 ? summary : undefined,
      summaryLabel: "المجموع",
      currencyRatesSheet: ratesSheet,
    });
  }, [enrichedColumns, partyField, partyType, defaultName, extraColumns, sortedData, exportData, ratesSheet, currencies, formatAmount, baseCurrency, currencyMode, rateMap, showDiscount, showDiscountGranted, showExtraCosts]);

  const summaryColumns = useMemo<SummaryColumn[]>(() => {
    let baseSubtotalTotal = 0;
    let baseDiscountTotal = 0;
    let baseExtraCostsTotal = 0;
    let basePaidTotal = 0;

    data.forEach(inv => {
      baseSubtotalTotal += getInvoiceBaseAmount(inv.subtotal_amount, inv.subtotal_amount_v2, inv.currency_code, inv.exchange_rate, baseCurrency?.code);
      baseDiscountTotal += getInvoiceBaseAmount(inv.discount_amount, inv.discount_amount_v2, inv.currency_code, inv.exchange_rate, baseCurrency?.code);
      baseExtraCostsTotal += getInvoiceBaseAmount(inv.extra_costs, inv.extra_costs_v2, inv.currency_code, inv.exchange_rate, baseCurrency?.code);
      basePaidTotal += getInvoiceBaseAmount(inv.amount_paid, inv.amount_paid_v2, inv.currency_code, inv.exchange_rate, baseCurrency?.code);
    });
    const baseComputedTotal = baseSubtotalTotal - baseDiscountTotal + baseExtraCostsTotal;
    const baseComputedRemaining = baseComputedTotal - basePaidTotal;

    const colIds = enrichedColumns.map(c => c.id);
    return colIds.map(id => {
      if (id === 'invoice_number') {
        return { id: 'count', columnId: 'invoice_number', label: '', value: `${data.length} فاتورة`, className: 'text-slate-600 font-bold' };
      }

      const subtotalMatch = id.match(/^subtotal_(.+)$/);
      if (subtotalMatch) {
        const currCode = subtotalMatch[1];
        const isBase = isBaseCurrency(currCode);
        const sym = currencies.find(c => c.code === currCode)?.symbol || currCode;
        return {
          id: `${id}_summary`,
          columnId: id,
          label: `مجموع الأسعار${cs(sym)}`,
          value: baseSubtotalTotal > 0 ? formatAmount(baseSubtotalTotal, { currencyCode: currCode }) : "—",
          className: isBase
            ? 'font-bold text-slate-700'
            : 'font-extrabold text-slate-400',
        };
      }

      const discountGrantedMatch = id.match(/^discount_granted_(.+)$/);
      if (discountGrantedMatch) {
        const currCode = discountGrantedMatch[1];
        const isBase = isBaseCurrency(currCode);
        const sym = currencies.find(c => c.code === currCode)?.symbol || currCode;
        return {
          id: `${id}_summary`,
          columnId: id,
          label: `خصوم ممنوحة${cs(sym)}`,
          value: baseDiscountTotal > 0 ? formatAmount(baseDiscountTotal, { currencyCode: currCode }) : "—",
          className: isBase
            ? 'font-bold text-rose-600'
            : 'font-extrabold text-rose-300',
        };
      }

      const discountMatch = id.match(/^discount_(.+)$/);
      if (discountMatch) {
        const currCode = discountMatch[1];
        const isBase = isBaseCurrency(currCode);
        const sym = currencies.find(c => c.code === currCode)?.symbol || currCode;
        return {
          id: `${id}_summary`,
          columnId: id,
          label: `خصوم مكتسبة${cs(sym)}`,
          value: baseDiscountTotal > 0 ? formatAmount(baseDiscountTotal, { currencyCode: currCode }) : "—",
          className: isBase
            ? 'font-bold text-blue-600'
            : 'font-extrabold text-blue-300',
        };
      }

      const extraCostsMatch = id.match(/^extra_costs_(.+)$/);
      if (extraCostsMatch) {
        const currCode = extraCostsMatch[1];
        const isBase = isBaseCurrency(currCode);
        const sym = currencies.find(c => c.code === currCode)?.symbol || currCode;
        return {
          id: `${id}_summary`,
          columnId: id,
          label: `تكاليف إضافية${cs(sym)}`,
          value: baseExtraCostsTotal > 0 ? formatAmount(baseExtraCostsTotal, { currencyCode: currCode }) : "—",
          className: isBase
            ? 'font-bold text-rose-600'
            : 'font-extrabold text-rose-300',
        };
      }

      const totalMatch = id.match(/^total_(.+)$/);
      if (totalMatch) {
        const currCode = totalMatch[1];
        const isBase = isBaseCurrency(currCode);
        const sym = currencies.find(c => c.code === currCode)?.symbol || currCode;
        return {
          id: `${id}_summary`,
          columnId: id,
          label: `المجموع الكلي${cs(sym)}`,
          value: baseComputedTotal > 0 ? formatAmount(baseComputedTotal, { currencyCode: currCode }) : "—",
          className: isBase
            ? 'font-black text-slate-900'
            : 'font-extrabold text-slate-500',
        };
      }

      const paidMatch = id.match(/^paid_(.+)$/);
      if (paidMatch) {
        const currCode = paidMatch[1];
        const isBase = isBaseCurrency(currCode);
        const sym = currencies.find(c => c.code === currCode)?.symbol || currCode;
        return {
          id: `${id}_summary`,
          columnId: id,
          label: `المبلغ المدفوع${cs(sym)}`,
          value: basePaidTotal > 0 ? formatAmount(basePaidTotal, { currencyCode: currCode }) : "—",
          className: isBase
            ? 'font-bold text-emerald-600'
            : 'font-extrabold text-emerald-300',
        };
      }

      const remainingMatch = id.match(/^remaining_(.+)$/);
      if (remainingMatch) {
        const currCode = remainingMatch[1];
        const isBase = isBaseCurrency(currCode);
        const sym = currencies.find(c => c.code === currCode)?.symbol || currCode;
        return {
          id: `${id}_summary`,
          columnId: id,
          label: `المبلغ المتبقي${cs(sym)}`,
          value: baseComputedRemaining > 0 ? formatAmount(baseComputedRemaining, { currencyCode: currCode }) : "—",
          className: isBase
            ? 'font-bold text-orange-600'
            : 'font-extrabold text-orange-300',
        };
      }

      return { id: `${id}_spacer`, columnId: id, label: '', value: '' };
    });
  }, [data, enrichedColumns, formatAmount, baseCurrency, isBaseCurrency, currencies, cs]);

  return (
    <TableShell
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder={searchPlaceholder}
      columns={toolbarColumns}
      onColumnToggle={toggleColumn}
      onColumnsReset={resetToDefault}
      columnsModified={isModified}
      showToolbar={true}
      actions={(
        <Button
          size="sm"
          variant="outline"
          className="h-8 border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          onClick={handleExport}
        >
          <Download className="w-3.5 h-3.5 ml-1.5 text-emerald-600" />
          تصدير إكسل
        </Button>
      )}
      filterBar={
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="w-[130px] h-8 bg-white font-bold shadow-sm border-slate-200 text-xs">
            <Filter className="w-3.5 h-3.5 ml-1.5 text-slate-400" />
            <SelectValue placeholder="الحالة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs font-bold">الكل</SelectItem>
            <SelectItem value="Draft" className="text-xs font-bold text-amber-600">مسودة</SelectItem>
            <SelectItem value="Posted" className="text-xs font-bold text-emerald-600">مرحلة</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      <UnifiedTable
        data={sortedData}
        columns={enrichedColumns}
        loading={loading}
        enableResize
        tableId="invoices"
        sortField={sortField}
        sortDirection={sortDirection}
        onHeaderClick={(col) => {
          if (col.id === "invoice_number") handleSort("invoice_number");
          else if (col.id === "issued_at") handleSort("issued_at");
          else if (col.id === "status") handleSort("status");
          else if (col.id === "notes") handleSort("notes");
          else if (col.id === partyField) handleSort(partyField as SortField);
          else if (col.id.startsWith("total_")) handleSort("total_amount");
          else if (col.id.startsWith("paid_")) handleSort("amount_paid");
          else if (col.id.startsWith("remaining_")) handleSort("remaining_amount");
          else if (col.id.startsWith("subtotal_")) handleSort("subtotal_amount");
          else if (col.id.startsWith("discount_")) handleSort("discount_amount");
          else if (col.id.startsWith("extra_costs_")) handleSort("extra_costs");
        }}
        onRowClick={(inv) => onSelect(inv.id)}
        onRowDoubleClick={(inv) => inv.invoice_type === "OpeningBalance" && onViewOpeningBalance ? onViewOpeningBalance(inv) : onView(inv)}
        selectedId={selectedId}
        emptyMessage={emptyMessage}
        summary={summaryColumns}
      />
    </TableShell>
  );
}
