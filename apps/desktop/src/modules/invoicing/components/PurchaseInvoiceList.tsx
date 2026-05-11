import { useMemo } from "react";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { RefreshCw, Plus, Search, Eye, Send, Printer, MoreHorizontal, ShoppingCart, Banknote, History, Settings2 } from "lucide-react";
import { formatDate } from "@shared/lib/format";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem } from "@shared/ui/dropdown-menu";
import { InvoiceDto } from "@erp/shared-types";
import { DataTable, Column } from "@widgets/table-shell/DataTable";
import { cn } from "@shared/lib/utils";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useColumnPreferences } from "@shared/hooks";

interface PurchaseInvoiceListProps {
  invoices: InvoiceDto[];
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
  onRefresh: () => void;
  onCreate: () => void;
  onEdit: (inv: InvoiceDto) => void;
  onPost: (id: string) => void;
  formatMonetaryAmount: (amount: string | number | { base_amount?: string } | null | undefined, mode: string) => string;
}

export function PurchaseInvoiceList({
  invoices,
  loading,
  search,
  onSearchChange,
  onRefresh,
  onCreate,
  onEdit,
  onPost,
  formatMonetaryAmount
}: PurchaseInvoiceListProps) {
  const { currencies, baseCurrency, formatAmount } = useCurrencyContext();

  const filtered = useMemo(() =>
    invoices.filter(inv =>
      !search ||
      inv.invoice_number.includes(search) ||
      (inv.supplier_name ?? "").includes(search) ||
      (inv.notes ?? "").includes(search)
    ), [invoices, search]);

  const availableColumns = useMemo(() => {
    const cols = [
      { id: "invoice_number", label: "رقم الفاتورة" },
      { id: "issued_at", label: "التاريخ" },
      { id: "supplier_name", label: "المورد" },
    ];

    currencies.forEach(curr => {
      const s = curr.symbol || curr.code;
      cols.push({ id: `total_${curr.code}`, label: `الإجمالي (${s})` });
    });
    
    return cols;
  }, [currencies]);

  const defaultVisibleColumns = useMemo(() => {
    const base = ["invoice_number", "issued_at", "supplier_name"];
    currencies.forEach(curr => {
      base.push(`total_${curr.code}`);
    });
    return base;
  }, [currencies]);

  const { visibleColumns, toggleColumn, isVisible } = useColumnPreferences("purchase_invoices", defaultVisibleColumns);

  const columns = useMemo<Column<InvoiceDto>[]>(() => {
    const cols: Column<InvoiceDto>[] = [
      { 
        id: "invoice_number",
        header: "رقم الفاتورة", 
        accessor: "invoice_number", 
        className: "font-black text-blue-600 font-mono tracking-tighter" 
      },
      { 
        id: "issued_at",
        header: "التاريخ", 
        accessor: (inv) => formatDate(inv.issued_at),
        className: "text-slate-500 text-xs font-medium tabular-nums"
      },
      { 
        id: "supplier_name",
        header: "المورد", 
        accessor: (inv) => inv.supplier_name || "مورد نقدي",
        className: "font-bold text-slate-800"
      },
    ];

    // Total Amount columns grouped by currency
    currencies.forEach(curr => {
      cols.push({
        id: `total_${curr.code}`,
        header: `الإجمالي (${curr.symbol || curr.code})`,
        accessor: (inv) => {
          const val = parseFloat(inv.total_amount_v2?.base_amount || inv.total_amount || "0");
          return formatAmount(val, { currencyCode: curr.code });
        },
        align: "left",
        className: "font-black tabular-nums text-slate-900 text-[11px]"
      });
    });

    cols.push({
      id: "actions",
      header: "",
      accessor: (inv) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-white hover:shadow-sm border-transparent hover:border-slate-200 border">
              <MoreHorizontal className="w-4 h-4 text-slate-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48 p-1">
            <DropdownMenuItem onClick={() => onEdit(inv)} className="rounded-md gap-3 py-2 px-3">
              <Eye className="w-4 h-4 text-slate-400" /> <span className="font-bold">عرض / تعديل</span>
            </DropdownMenuItem>
            {inv.status === "Draft" && (
              <DropdownMenuItem onClick={() => onPost(inv.id)} className="rounded-md gap-3 py-2 px-3 text-emerald-600 focus:text-emerald-700 focus:bg-emerald-50">
                <Send className="w-4 h-4" /> <span className="font-bold">ترحيل الفاتورة</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem className="rounded-md gap-3 py-2 px-3">
              <Printer className="w-4 h-4 text-slate-400" /> <span className="font-bold">طباعة</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      className: "w-12"
    });

    return cols;
  }, [onEdit, onPost, formatAmount, currencies]);

  const filteredColumns = useMemo(() => {
    return columns.filter(col => {
      if (!col.id || col.id === "actions") return true;
      return visibleColumns.includes(col.id);
    });
  }, [columns, visibleColumns]);

  const stats = useMemo(() => {
    const total = filtered.reduce((acc, inv) => acc + parseFloat(inv.total_amount_v2?.base_amount || inv.total_amount || "0"), 0);
    return [
      { label: "عدد الفواتير", value: filtered.length, icon: ShoppingCart, color: "text-slate-900" },
      { label: "إجمالي المشتريات", value: formatMonetaryAmount(total.toString(), "base"), icon: Banknote, color: "text-rose-600" },
      { label: "فواتير معلقة", value: filtered.filter(i => i.status === 'Draft').length, icon: History, color: "text-amber-600" },
    ];
  }, [filtered, formatMonetaryAmount]);

  return (
    <OperationalTableTemplate
      title="فواتير المشتريات"
      toolbar={
        <div className="flex gap-2">
          <Button size="sm" onClick={onCreate} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100">
            <Plus className="w-4 h-4 ml-2" />فاتورة جديدة
          </Button>
        </div>
      }
      filterBar={
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="بحث برقم الفاتورة أو المورد..." 
              className="pr-10 h-11 border-slate-200 focus:ring-2 focus:ring-blue-500 transition-all" 
              value={search} 
              onChange={(e) => onSearchChange(e.target.value)} 
            />
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
          loading={loading}
          emptyMessage={search ? "لا توجد نتائج للبحث" : "لا توجد فواتير مشتريات مسجّلة"}
          onRowDoubleClick={onEdit}
        />
      }
    />
  );
}
