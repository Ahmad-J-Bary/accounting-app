import { useState, useEffect } from "react";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { Plus, Search, MoreHorizontal, Eye, Printer, RefreshCw, CheckCircle } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { purchaseService } from "@/services/purchaseService";
import { NewPurchaseInvoiceDialog } from "@/components/erp/NewPurchaseInvoiceDialog";
import type { PurchaseInvoice } from "@erp/shared-types";

export default function PurchaseInvoices() {
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [isNewInvoiceOpen, setIsNewInvoiceOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await purchaseService.listPurchaseInvoices();
      setInvoices(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();

    const handleOpenDialog = () => setIsNewInvoiceOpen(true);
    window.addEventListener("erp:open-new-purchase-invoice", handleOpenDialog);
    return () => window.removeEventListener("erp:open-new-purchase-invoice", handleOpenDialog);
  }, []);

  const filtered = invoices.filter(inv => {
    const matchSearch =
      inv.invoice_number.includes(search) ||
      (inv.supplier_name ?? "").includes(search);
    const matchStatus = statusFilter === "all" || inv.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const total = invoices.reduce((s, i) => s + parseFloat(i.total || "0"), 0);
  const paid = invoices.filter(i => i.status === "Paid").length;
  const partial = invoices.filter(i => i.status === "PartiallyPaid").length;

  const handlePost = async (id: string) => {
    try {
      await purchaseService.postPurchaseInvoice(id);
      await load();
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <>
      <NewPurchaseInvoiceDialog 
        open={isNewInvoiceOpen}
        onOpenChange={setIsNewInvoiceOpen}
        onSuccess={load}
      />

      <PageHeader
        title="فواتير المشتريات"
        subtitle="إدارة فواتير الشراء من الموردين"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "المشتريات" }, { label: "الفواتير" }]}
        actions={
          <div className="flex items-center gap-2 relative z-[100]">
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ml-2 ${loading ? "animate-spin" : ""}`} />
              تحديث
            </Button>
            <Button onClick={() => setIsNewInvoiceOpen(true)}>
              <Plus className="w-4 h-4 ml-2" />فاتورة شراء جديدة
            </Button>
          </div>
        }
      />

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          {error} <button className="mr-2 underline" onClick={() => setError(null)}>إغلاق</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
        <Card className="p-4"><div className="text-sm text-muted-foreground">إجمالي الفواتير</div><div className="text-2xl font-bold tabular-nums mt-1">{invoices.length}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">مدفوعة</div><div className="text-2xl font-bold text-green-600 tabular-nums mt-1">{paid}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">جزئية</div><div className="text-2xl font-bold text-amber-600 tabular-nums mt-1">{partial}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">غير مدفوعة</div><div className="text-2xl font-bold text-red-600 tabular-nums mt-1">{invoices.filter(i => i.status === "Draft" || i.status === "Posted").length}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">الإجمالي</div><div className="text-xl font-bold text-primary tabular-nums mt-1">{formatCurrency(total)}</div></Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="بحث برقم الفاتورة أو المورد..."
              className="pr-10"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الحالات</SelectItem>
              <SelectItem value="Paid">مدفوعة</SelectItem>
              <SelectItem value="PartiallyPaid">جزئية</SelectItem>
              <SelectItem value="Posted">مرحّلة</SelectItem>
              <SelectItem value="Draft">مسودة</SelectItem>
              <SelectItem value="Cancelled">ملغية</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {search || statusFilter !== "all" ? "لا توجد نتائج" : "لا توجد فواتير شراء حتى الآن"}
          </div>
        ) : (
          <div className="border border-border rounded-md overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  <th className="text-right px-4 py-3 font-medium">رقم الفاتورة</th>
                  <th className="text-right px-4 py-3 font-medium">التاريخ</th>
                  <th className="text-right px-4 py-3 font-medium">المورد</th>
                  <th className="text-left px-4 py-3 font-medium">الإجمالي</th>
                  <th className="text-left px-4 py-3 font-medium">المدفوع</th>
                  <th className="text-left px-4 py-3 font-medium">المتبقي</th>
                  <th className="text-left px-4 py-3 font-medium">الحالة</th>
                  <th className="text-left px-4 py-3 font-medium w-12"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => (
                  <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-primary">{inv.invoice_number}</td>
                    <td className="px-4 py-3">{formatDate(inv.invoice_date)}</td>
                    <td className="px-4 py-3">{inv.supplier_name ?? inv.supplier_id}</td>
                    <td className="px-4 py-3 text-left tabular-nums font-medium">{formatCurrency(parseFloat(inv.total))}</td>
                    <td className="px-4 py-3 text-left tabular-nums text-green-600">{formatCurrency(parseFloat(inv.amount_paid))}</td>
                    <td className="px-4 py-3 text-left tabular-nums text-red-600">{formatCurrency(parseFloat(inv.remaining_amount))}</td>
                    <td className="px-4 py-3 text-left">
                      <StatusBadge status={(inv.status || "Draft").toLowerCase()} />
                    </td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem><Eye className="w-4 h-4 ml-2" />عرض</DropdownMenuItem>
                          {inv.status === "Draft" && (
                            <DropdownMenuItem onClick={() => handlePost(inv.id)}>
                              <CheckCircle className="w-4 h-4 ml-2" />ترحيل
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem><Printer className="w-4 h-4 ml-2" />طباعة</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}