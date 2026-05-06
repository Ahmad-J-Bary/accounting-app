import { useMemo } from "react";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { RefreshCw, Plus, Search, Eye, Send, Printer, MoreHorizontal, TrendingUp, Receipt } from "lucide-react";
import { Card } from "@shared/ui/card";
import { formatDate, formatCurrency } from "@shared/lib/format";
import { DocumentStatusBadge } from "../components/DocumentStatusBadge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@shared/ui/dropdown-menu";
import { InvoiceDto } from "@erp/shared-types";
import { DataTable, Column } from "@widgets/table-shell/DataTable";
import { cn } from "@shared/lib/utils";

interface SalesInvoiceListProps {
  invoices: InvoiceDto[];
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
  onRefresh: () => void;
  onCreate: () => void;
  onEdit: (inv: InvoiceDto) => void;
  onPost: (id: string) => void;
  formatMonetaryAmount: (amount: any, mode: string) => string;
}

export function SalesInvoiceList({
  invoices,
  loading,
  search,
  onSearchChange,
  onRefresh,
  onCreate,
  onEdit,
  onPost,
  formatMonetaryAmount
}: SalesInvoiceListProps) {
  const filtered = useMemo(() =>
    invoices.filter(inv =>
      !search ||
      inv.invoice_number.includes(search) ||
      (inv.customer_name ?? "").includes(search) ||
      (inv.notes ?? "").includes(search)
    ), [invoices, search]);

  const columns = useMemo<Column<InvoiceDto>[]>(() => [
    { 
      header: "رقم الفاتورة", 
      accessor: "invoice_number", 
      className: "font-black text-blue-600 font-mono tracking-tighter" 
    },
    { 
      header: "التاريخ", 
      accessor: (inv) => formatDate(inv.issued_at),
      className: "text-slate-500 text-xs font-medium tabular-nums"
    },
    { 
      header: "العميل", 
      accessor: (inv) => inv.customer_name || "زبون نقدي",
      className: "font-bold text-slate-800"
    },
    { 
      header: "الإجمالي", 
      accessor: (inv) => formatMonetaryAmount(inv.total_amount_v2 || inv.total_amount, "both"),
      align: "left",
      className: "font-black tabular-nums text-slate-900"
    },
    { 
      header: "الربح التقديري", 
      accessor: (inv) => (
        <span className="inline-flex items-center gap-1 text-emerald-600 font-black tabular-nums">
          <TrendingUp className="w-3.5 h-3.5" />
          {inv.total_profit ? formatMonetaryAmount(inv.total_profit, "both") : "---"}
        </span>
      ),
      align: "left",
      className: "bg-emerald-50/30"
    },
    { 
      header: "الحالة", 
      accessor: (inv) => <DocumentStatusBadge status={inv.status} />,
      align: "center"
    },
    {
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
    }
  ], [onEdit, onPost, formatMonetaryAmount]);

  const stats = useMemo(() => {
    const total = filtered.reduce((acc, inv) => acc + parseFloat(inv.total_amount_v2?.base_amount || inv.total_amount || "0"), 0);
    const profit = filtered.reduce((acc, inv) => acc + parseFloat(inv.total_profit || "0"), 0);
    return [
      { label: "عدد الفواتير", value: filtered.length, icon: Receipt, color: "text-slate-900" },
      { label: "إجمالي المبيعات", value: formatMonetaryAmount(total.toString(), "both"), icon: TrendingUp, color: "text-blue-600" },
      { label: "إجمالي الأرباح", value: formatMonetaryAmount(profit.toString(), "both"), icon: TrendingUp, color: "text-emerald-600" },
    ];
  }, [filtered, formatMonetaryAmount]);

  return (
    <OperationalTableTemplate
      title="فواتير المبيعات"
      toolbar={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading} className="bg-white border-slate-200">
            <RefreshCw className={cn("w-4 h-4 ml-2", loading && "animate-spin")} />تحديث
          </Button>
          <Button size="sm" onClick={onCreate} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100">
            <Plus className="w-4 h-4 ml-2" />فاتورة جديدة
          </Button>
        </div>
      }
      headerWidgets={
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stats.map((s, i) => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between transition-all hover:shadow-md">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.label}</span>
                <div className={cn("text-xl font-black tabular-nums", s.color)}>{s.value}</div>
              </div>
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center bg-slate-50", s.color)}>
                <s.icon className="w-6 h-6" />
              </div>
            </div>
          ))}
        </div>
      }
      filterBar={
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="بحث برقم الفاتورة أو العميل..." 
              className="pr-10 h-11 border-slate-200 focus:ring-2 focus:ring-blue-500 transition-all" 
              value={search} 
              onChange={(e) => onSearchChange(e.target.value)} 
            />
          </div>
        </div>
      }
      tableContent={
        <DataTable
          data={filtered}
          columns={columns}
          loading={loading}
          emptyMessage={search ? "لا توجد نتائج للبحث" : "لا توجد فواتير مبيعات مسجّلة"}
          onRowDoubleClick={onEdit}
        />
      }
    />
  );
}
