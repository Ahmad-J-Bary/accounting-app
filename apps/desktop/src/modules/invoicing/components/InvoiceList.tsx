import { useMemo, useState } from "react";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { Button } from "@shared/ui/button";
import { Plus, Eye, Printer, ShoppingCart, Settings2, Banknote, History, Trash2, RefreshCw } from "lucide-react";
import { InvoiceDto } from "@erp/shared-types";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { InvoiceTable, getInvoiceBaseAmount } from "./InvoiceTable";

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
  const { currencies, baseCurrency, formatAmount } = useCurrencyContext();
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

  const stats = useMemo(() => {
    const total = filtered.reduce((acc, inv) => {
      const baseAmt = getInvoiceBaseAmount(
        inv.total_amount,
        inv.total_amount_v2,
        inv.currency_code,
        inv.exchange_rate,
        baseCurrency?.code
      );
      return acc + baseAmt;
    }, 0);
    return [
      { label: "عدد الفواتير", value: filtered.length, icon: ShoppingCart, color: "text-slate-900" },
      { label: statsLabel, value: formatMonetaryAmount(total.toString(), "base"), icon: Banknote, color: statsColor },
      { label: "فواتير معلقة", value: filtered.filter(i => i.status === 'Draft').length, icon: History, color: "text-amber-600" },
    ];
  }, [filtered, formatMonetaryAmount, statsLabel, statsColor, baseCurrency]);

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
          onPost={onPost}
          onDelete={onDelete}
          onReopen={onReopen}
          partyLabel={partyLabel}
          partyType={partyType}
          defaultName={defaultName}
          showSubtotal={showSubtotal}
          showExtraCosts={showExtraCosts}
          extraColumns={extraColumns}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
        />
      }
    />
  );
}
