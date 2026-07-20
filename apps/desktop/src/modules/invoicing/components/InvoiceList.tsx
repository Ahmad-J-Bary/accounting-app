import { useMemo, useState, useCallback } from "react";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { Button } from "@shared/ui/button";
import { Plus, Eye, Printer, Settings2, Trash2, Download } from "lucide-react";
import { InvoiceDto } from "@erp/shared-types";
import type { CurrencyDisplayMode } from "@app/providers/CurrencyContext";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useExcelExport } from "@shared/hooks";
import type { ExcelExportColumn } from "@shared/lib/excel";
import { getInvoiceBaseAmount } from "../lib/invoiceHelpers";
import { formatDateTime } from "@shared/lib/format";
import { InvoiceTable } from "./InvoiceTable";


export interface ExtraColumn {
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
  onEditOpeningBalance?: (inv: InvoiceDto) => void;
  onViewOpeningBalance?: (inv: InvoiceDto) => void;
  onPost: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReopen: (id: string) => Promise<void>;
  formatMonetaryAmount: (amount: string | number | { base_amount?: string } | null | undefined, mode?: CurrencyDisplayMode | "both") => string;
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
  showDiscountGranted?: boolean;
  showDiscount?: boolean;
  extraColumns?: ExtraColumn[];
}

export function InvoiceList({
  invoices,
  loading,
  search,
  partyIdFilter,
  onSearchChange,
  onCreate,
  onEdit,
  onView,
  onEditOpeningBalance,
  onViewOpeningBalance,
  onPost,
  onDelete,
  onReopen,
  partyType,
  title,
  createLabel,
  searchPlaceholder,
  emptyMessage,
  preferenceKey,
  showSubtotal = false,
  showExtraCosts = false,
  showDiscountGranted = false,
  showDiscount = false,
  extraColumns = [],
}: InvoiceListProps) {
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
  const defaultName = partyType === "supplier" ? "مورد نقدي" : "زبون نقدي";

  const { currencies, baseCurrency, hasMultipleCurrencies } = useCurrencyContext();

  const { exportData } = useExcelExport();

  const handleExport = useCallback(async () => {
    const currencyCols: ExcelExportColumn[] = [];
    const summary: Record<string, 'sum' | 'subtotal' | 'average' | null> = {};
    const suf = (sym: string) => hasMultipleCurrencies ? ` (${sym})` : '';

    if (showSubtotal) {
      currencies.forEach(curr => {
        const colId = `subtotal_${curr.code}`;
        summary[colId] = 'subtotal';
        currencyCols.push({
          id: colId,
          label: `مجموع الأسعار${suf(curr.symbol || curr.code)}`,
          accessor: (row) => {
            const inv = row as unknown as InvoiceDto;
            return getInvoiceBaseAmount(inv.subtotal_amount, inv.subtotal_amount_v2, inv.currency_code, inv.exchange_rate, baseCurrency?.code);
          },
          numeric: true,
          decimalPlaces: 2,
        });
      });
    }

    if (showDiscountGranted) {
      currencies.forEach(curr => {
        const colId = `discount_granted_${curr.code}`;
        summary[colId] = 'subtotal';
        currencyCols.push({
          id: colId,
          label: `خصوم ممنوحة${suf(curr.symbol || curr.code)}`,
          accessor: (row) => {
            const inv = row as unknown as InvoiceDto;
            return getInvoiceBaseAmount(inv.discount_amount, inv.discount_amount_v2, inv.currency_code, inv.exchange_rate, baseCurrency?.code);
          },
          numeric: true,
          decimalPlaces: 2,
        });
      });
    }

    if (showDiscount) {
      currencies.forEach(curr => {
        const colId = `discount_${curr.code}`;
        summary[colId] = 'subtotal';
        currencyCols.push({
          id: colId,
          label: `خصوم مكتسبة${suf(curr.symbol || curr.code)}`,
          accessor: (row) => {
            const inv = row as unknown as InvoiceDto;
            return getInvoiceBaseAmount(inv.discount_amount, inv.discount_amount_v2, inv.currency_code, inv.exchange_rate, baseCurrency?.code);
          },
          numeric: true,
          decimalPlaces: 2,
        });
      });
    }

    if (showExtraCosts) {
      currencies.forEach(curr => {
        const colId = `extra_costs_${curr.code}`;
        summary[colId] = 'subtotal';
        currencyCols.push({
          id: colId,
          label: `التكاليف الإضافية${suf(curr.symbol || curr.code)}`,
          accessor: (row) => {
            const inv = row as unknown as InvoiceDto;
            return getInvoiceBaseAmount(inv.extra_costs, inv.extra_costs_v2, inv.currency_code, inv.exchange_rate, baseCurrency?.code);
          },
          numeric: true,
          decimalPlaces: 2,
        });
      });
    }

    currencies.forEach(curr => {
      const totalId = `total_${curr.code}`;
      const paidId = `paid_${curr.code}`;
      const remainingId = `remaining_${curr.code}`;
      summary[totalId] = 'subtotal';
      summary[paidId] = 'subtotal';
      summary[remainingId] = 'subtotal';

      // Build formula: subtotal - discount(s) + extra_costs
      let totalFormula = `{col('subtotal_${curr.code}')}{row}`;
      if (showDiscount) {
        totalFormula += `-{col('discount_${curr.code}')}{row}`;
      } else if (showDiscountGranted) {
        totalFormula += `-{col('discount_granted_${curr.code}')}{row}`;
      }
      if (showExtraCosts) {
        totalFormula += `+{col('extra_costs_${curr.code}')}{row}`;
      }

      currencyCols.push({
        id: totalId,
        label: `المجموع الكلي${suf(curr.symbol || curr.code)}`,
        formula: totalFormula,
        numeric: true,
        decimalPlaces: 2,
      });
      currencyCols.push({
        id: paidId,
        label: `المبلغ المدفوع${suf(curr.symbol || curr.code)}`,
        accessor: (row) => {
          const inv = row as unknown as InvoiceDto;
          return getInvoiceBaseAmount(inv.amount_paid, inv.amount_paid_v2, inv.currency_code, inv.exchange_rate, baseCurrency?.code);
        },
        numeric: true,
        decimalPlaces: 2,
      });
      // remaining = total - paid
      currencyCols.push({
        id: remainingId,
        label: `المبلغ المتبقي${suf(curr.symbol || curr.code)}`,
        formula: `{col('${totalId}')}{row}-{col('${paidId}')}{row}`,
        numeric: true,
        decimalPlaces: 2,
      });
    });

    const columns: ExcelExportColumn[] = [
      { id: "invoice_number", label: "رقم الفاتورة", accessor: (row) => parseInt((row as unknown as InvoiceDto).invoice_number ?? "0", 10) || 0 },
      { id: "party", label: partyLabel, accessor: (row) => {
        const inv = row as unknown as InvoiceDto;
        return partyType === "supplier" ? (inv.supplier_name || defaultName) : (inv.customer_name || defaultName);
      }},
      ...currencyCols,
      { id: "status", label: "الحالة", accessor: (row) => (row as unknown as InvoiceDto).status === "Posted" ? "مرحلة" : "مسودة" },
      { id: "notes", label: "التوصيف", accessor: (row) => String((row as unknown as InvoiceDto).notes ?? "") },
      { id: "issued_at", label: "التاريخ", accessor: (row) => formatDateTime((row as unknown as InvoiceDto).issued_at) },
    ];

    await exportData(filtered as unknown as Record<string, unknown>[], columns, title, { sheetName: title, autoFilter: true, summary, summaryLabel: "المجموع" });
  }, [filtered, currencies, baseCurrency, partyType, partyLabel, defaultName, showSubtotal, showDiscountGranted, showDiscount, showExtraCosts, title, exportData, hasMultipleCurrencies]);

  return (
    <OperationalTableTemplate
      title={title}
      toolbar={
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={onCreate} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 h-9 px-4 font-bold">
            <Plus className="w-4 h-4 ml-2" />{createLabel}
          </Button>
          <div className="w-[1px] h-6 bg-slate-200 mx-1" />
          <Button variant="outline" size="sm" disabled={!selectedId}
            onClick={() => {
              if (!selectedInvoice) return;
              if (selectedInvoice.invoice_type === "OpeningBalance") {
                onViewOpeningBalance?.(selectedInvoice);
              } else {
                onView(selectedInvoice);
              }
            }}
            className="h-9 border-slate-200 hover:bg-slate-50 font-bold">
            <Eye className="w-4 h-4 ml-2 text-blue-500" /> عرض
          </Button>
          <Button variant="outline" size="sm" disabled={!selectedId}
            onClick={() => {
              if (!selectedInvoice) return;
              if (selectedInvoice.invoice_type === "OpeningBalance") {
                onEditOpeningBalance?.(selectedInvoice);
              } else {
                onEdit(selectedInvoice);
              }
            }}
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
            onClick={handleExport}
            className="h-9 border-slate-200 hover:bg-slate-50 font-bold">
            <Download className="w-4 h-4 ml-2 text-slate-500" /> تصدير إكسل
          </Button>
        </div>
      }
      tableContent={
          <InvoiceTable
            data={filtered}
            loading={loading}
            search={search}
            onSearchChange={onSearchChange}
            searchPlaceholder={searchPlaceholder}
            emptyMessage={emptyMessage}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onView={onView}
            onEdit={onEdit}
            onViewOpeningBalance={onViewOpeningBalance}
            onEditOpeningBalance={onEditOpeningBalance}
            onPost={onPost}
            onDelete={onDelete}
            onReopen={onReopen}
            partyLabel={partyLabel}
            partyType={partyType}
            defaultName={defaultName}
            showSubtotal={showSubtotal}
            showExtraCosts={showExtraCosts}
            showDiscountGranted={showDiscountGranted}
            showDiscount={showDiscount}
            extraColumns={extraColumns}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            tableId={preferenceKey}
          />
      }
    />
  );
}
