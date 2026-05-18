import { useMemo, useState } from "react";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Plus, Search, Eye, Printer, ShoppingCart, Banknote, History, Settings2 } from "lucide-react";
import { formatDateTime } from "@shared/lib/format";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem } from "@shared/ui/dropdown-menu";
import { InvoiceDto } from "@erp/shared-types";
import { DataTable, Column } from "@widgets/table-shell/DataTable";
import { cn } from "@shared/lib/utils";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useColumnPreferences } from "@shared/hooks";
import { DocumentStatusBadge } from "./DocumentStatusBadge";

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

  const baseColumns = useMemo<{ id: string; label: string }[]>(() => [
    { id: "invoice_number", label: "الرقم" },
    { id: "notes", label: "التوصيف" },
    { id: partyField, label: partyLabel },
    ...(showSubtotal ? [{ id: "subtotal_amount", label: "مجموع الأسعار" }] : []),
    ...(showExtraCosts ? [{ id: "extra_costs", label: "تكاليف إضافية" }] : []),
    { id: "total_amount", label: "المجموع الكلي" },
    { id: "amount_paid", label: "المبلغ المدفوع" },
    { id: "remaining_amount", label: "المبلغ المتبقي" },
    { id: "status", label: "الحالة" },
    { id: "issued_at", label: "التاريخ" },
    ...extraColumns.map(c => ({ id: c.key, label: c.label })),
  ], [partyField, partyLabel, showSubtotal, showExtraCosts, extraColumns]);

  const defaultVisible = useMemo(() => baseColumns.map(c => c.id), [baseColumns]);

  const { visibleColumns, toggleColumn, isVisible } = useColumnPreferences(preferenceKey, defaultVisible);

  const columns = useMemo<Column<InvoiceDto>[]>(() => {
    const cols: Column<InvoiceDto>[] = [
      {
        id: "invoice_number",
        header: "الرقم",
        accessor: "invoice_number",
        className: "font-black text-blue-600 font-mono"
      },
      {
        id: "notes",
        header: "التوصيف",
        accessor: (inv) => inv.notes || "-",
        className: "text-slate-500 text-xs truncate max-w-[150px]"
      },
      {
        id: partyField,
        header: partyLabel,
        accessor: (inv) => inv.invoice_type === "OpeningBalance" ? "-" : (partyType === "supplier" ? (inv.supplier_name || defaultName) : (inv.customer_name || defaultName)),
        className: "font-bold text-slate-800"
      },
      ...(showSubtotal ? [{
        id: "subtotal_amount" as const,
        header: "مجموع الأسعار",
        accessor: (inv: InvoiceDto) => formatAmount(parseFloat(inv.subtotal_amount || "0"), { currencyCode: inv.currency_code }),
        align: "left" as const,
        className: "font-bold tabular-nums text-slate-700"
      }] : []),
      ...(showExtraCosts ? [{
        id: "extra_costs" as const,
        header: "تكاليف إضافية",
        accessor: (inv: InvoiceDto) => formatAmount(parseFloat(inv.extra_costs || "0"), { currencyCode: inv.currency_code }),
        align: "left" as const,
        className: "font-bold tabular-nums text-rose-600"
      }] : []),
      {
        id: "total_amount",
        header: "المجموع الكلي",
        accessor: (inv) => formatAmount(parseFloat(inv.total_amount || "0"), { currencyCode: inv.currency_code }),
        align: "left",
        className: "font-black tabular-nums text-slate-900"
      },
      {
        id: "amount_paid",
        header: "المبلغ المدفوع",
        accessor: (inv) => formatAmount(parseFloat(inv.amount_paid || "0"), { currencyCode: inv.currency_code }),
        align: "left",
        className: "font-bold tabular-nums text-emerald-600"
      },
      {
        id: "remaining_amount",
        header: "المبلغ المتبقي",
        accessor: (inv) => formatAmount(parseFloat(inv.remaining_amount || "0"), { currencyCode: inv.currency_code }),
        align: "left",
        className: "font-bold tabular-nums text-orange-600"
      },
      {
        id: "status",
        header: "الحالة",
        accessor: (inv) => <DocumentStatusBadge status={inv.status} />,
        className: "text-center"
      },
      {
        id: "issued_at",
        header: "التاريخ",
        accessor: (inv) => formatDateTime(inv.issued_at),
        className: "text-slate-500 text-xs tabular-nums"
      },
      ...extraColumns.map(c => ({
        id: c.key,
        header: c.label,
        accessor: c.accessor,
        className: c.className || "text-slate-500 text-xs"
      })),
    ];
    return cols;
  }, [formatAmount, partyField, partyLabel, partyType, defaultName, showSubtotal, showExtraCosts, extraColumns]);

  const filteredColumns = useMemo(() =>
    columns.filter(col => col.id && visibleColumns.includes(col.id)),
    [columns, visibleColumns]);

  const stats = useMemo(() => {
    const total = filtered.reduce((acc, inv) => acc + parseFloat(inv.total_amount_v2?.base_amount || inv.total_amount || "0"), 0);
    return [
      { label: "عدد الفواتير", value: filtered.length, icon: ShoppingCart, color: "text-slate-900" },
      { label: statsLabel, value: formatMonetaryAmount(total.toString(), "base"), icon: Banknote, color: statsColor },
      { label: "فواتير معلقة", value: filtered.filter(i => i.status === 'Draft').length, icon: History, color: "text-amber-600" },
    ];
  }, [filtered, formatMonetaryAmount, statsLabel, statsColor]);

  return (
    <OperationalTableTemplate
      title={title}
      toolbar={
        <div className="flex gap-2 items-center">
          <Button size="sm" onClick={onCreate} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 h-9 px-4">
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
          <Button variant="outline" size="sm" disabled={!selectedId || selectedInvoice?.status === "Posted"}
            onClick={() => {
              if (selectedId && window.confirm("هل أنت متأكد من حذف هذه الفاتورة؟ سيتم حذف القيود المرتبطة بها أيضاً.")) {
                onDelete(selectedId).then(() => setSelectedId(null));
              }
            }}
            className="h-9 border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 font-bold transition-all disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-slate-400">
            <History className="w-4 h-4 ml-2 text-rose-500" /> حذف
          </Button>
          <Button variant="outline" size="sm" disabled={!selectedId}
            className="h-9 border-slate-200 hover:bg-slate-50 font-bold">
            <Printer className="w-4 h-4 ml-2 text-slate-500" /> طباعة
          </Button>
          <Button variant="outline" size="sm"
            className="h-9 border-slate-200 hover:bg-slate-50 font-bold">
            <Settings2 className="w-4 h-4 ml-2 text-amber-500" /> تصدير إكسل
          </Button>
        </div>
      }
      filterBar={
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder={searchPlaceholder}
              className="pr-10 h-11 border-slate-200 focus:ring-2 focus:ring-blue-500 transition-all"
              value={search} onChange={(e) => onSearchChange(e.target.value)} />
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
            {["all", "Posted", "Draft"].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={cn("px-4 py-2 text-xs font-black rounded-lg transition-all",
                  statusFilter === s ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}>
                {s === "all" ? "الكل" : s === "Posted" ? "مرحلة" : "مسودة"}
              </button>
            ))}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-11 w-11 bg-white border-slate-200">
                <Settings2 className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[220px] max-h-[450px] overflow-y-auto shadow-xl">
              <DropdownMenuLabel className="text-right text-xs font-black uppercase text-slate-400 tracking-widest">تخصيص الأعمدة</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {baseColumns.map((col) => (
                <DropdownMenuCheckboxItem key={col.id}
                  checked={isVisible(col.id)}
                  onCheckedChange={() => toggleColumn(col.id)}
                  className="text-right flex-row-reverse gap-2 text-xs font-bold py-2">
                  {col.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="flex items-center gap-6 mr-auto pl-2">
            {stats.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={i} className="flex flex-col items-start gap-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{s.label}</span>
                  <div className="flex items-center gap-2">
                    <Icon className={cn("w-4 h-4", s.color)} />
                    <span className={cn("text-lg font-black tabular-nums", s.color)}>{s.value}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      }
      tableContent={
        <DataTable
          data={filtered}
          columns={filteredColumns}
          loading={loading}
          emptyMessage={search ? "لا توجد نتائج للبحث" : emptyMessage}
          onRowDoubleClick={onView}
          onRowClick={(inv) => setSelectedId(inv.id)}
          selectedId={selectedId || undefined}
        />
      }
    />
  );
}
