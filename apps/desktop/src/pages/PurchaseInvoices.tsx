import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useTabs } from "@/context/TabContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, RefreshCw, Search, Eye, Send, Printer, MoreHorizontal } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { invoiceService } from "@/services/invoiceService";
import { supplierService } from "@/services/supplierService";
import type { InvoiceDto, SupplierDto } from "@erp/shared-types";
import { toast } from "sonner";

// Document components
import { DocumentShell } from "@/components/erp/document/DocumentShell";
import { InvoiceGrid } from "@/components/erp/document/InvoiceGrid";
import { GridLine, toBackendLines, generateDocNumber } from "@/components/erp/document/invoiceUtils";
import { DocumentStatus } from "@/components/erp/document/DocumentStatusBadge";
import { SummaryPanel } from "@/components/erp/document/SummaryPanel";
import { InvoicePartySelector } from "@/components/erp/document/InvoicePartySelector";
import { DocumentStatusBadge } from "@/components/erp/document/DocumentStatusBadge";

type ViewMode = "list" | "editor";

interface EditorState {
  invoice_number: string;
  supplier_id: string;
  supplier_name: string;
  issued_at: string;
  notes: string;
  tax_amount: string;
  discount_amount: string;
  extra_costs: string;
  payment_method: string;
  lines: GridLine[];
  status: string;
  id?: string;
  paid_amount?: string;
}

function defaultEditor(): EditorState {
  return {
    invoice_number: generateDocNumber("PUR"),
    supplier_id: "",
    supplier_name: "مورد نقدي",
    issued_at: new Date().toISOString().split("T")[0],
    notes: "",
    tax_amount: "0",
    discount_amount: "0",
    extra_costs: "0",
    payment_method: "cash",
    lines: [],
    status: "Draft",
    paid_amount: "0",
  };
}

export default function PurchaseInvoices() {
  const location = useLocation();
  const { id } = useParams();
  const { openTab, closeTab, activeTabId } = useTabs();
  
  const [view, setView] = useState<ViewMode>("list");
  const [invoices, setInvoices] = useState<InvoiceDto[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);
  const [editor, setEditor] = useState<EditorState>(defaultEditor());
  const [search, setSearch] = useState("");

  const isNew = location.pathname.includes("/new");

  useEffect(() => {
    if (isNew) {
      setEditor(defaultEditor());
      setView("editor");
    } else if (id) {
      const loadInvoice = async () => {
        try {
          const inv = await invoiceService.getInvoiceById(id);
          setEditor({
            id: inv.id,
            invoice_number: inv.invoice_number,
            supplier_id: inv.supplier_id ?? "",
            supplier_name: inv.supplier_name ?? "مورد نقدي",
            issued_at: inv.issued_at.split("T")[0],
            notes: inv.notes ?? "",
            tax_amount: inv.tax_amount,
            discount_amount: inv.discount_amount,
            extra_costs: "0",
            payment_method: "cash",
            paid_amount: "0",
            lines: (inv.lines ?? []).map(l => ({
              ...l,
              _id: `line_${Math.random()}`,
              line_total: parseFloat(l.quantity) * parseFloat(l.unit_price),
            })),
            status: inv.status,
          });
          setView("editor");
        } catch {
          toast.error("فشل تحميل الفاتورة");
        }
      };
      loadInvoice();
    } else {
      setView("list");
    }
  }, [isNew, id]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [invData, suppData] = await Promise.all([
        invoiceService.listInvoicesByType("Purchase"),
        supplierService.listSuppliers(),
      ]);
      setInvoices(invData);
      setSuppliers(suppData);
    } catch {
      toast.error("فشل تحميل البيانات");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredInvoices = useMemo(() =>
    invoices.filter(inv =>
      !search ||
      inv.invoice_number.includes(search) ||
      (inv.supplier_name ?? "").includes(search)
    ), [invoices, search]);

  const subtotal = editor.lines.reduce((s, l) => s + (l.line_total ?? 0), 0);
  const discount = parseFloat(editor.discount_amount) || 0;
  const tax = parseFloat(editor.tax_amount) || 0;
  const extraCosts = parseFloat(editor.extra_costs) || 0;
  const net = subtotal - discount + tax + extraCosts;

  let paid = 0;
  if (editor.payment_method === "cash") {
    paid = net;
  } else if (editor.payment_method === "partial") {
    paid = parseFloat(editor.paid_amount || "0") || 0;
  } else {
    paid = 0; // credit
  }

  const handleCreate = () => {
    const uniqueId = `/purchase-invoices/new-${Date.now()}`;
    openTab({ 
      id: uniqueId, 
      title: "فاتورة مشتريات جديدة", 
      path: uniqueId,
      closable: true
    });
  };

  const handleEdit = (inv: InvoiceDto) => {
    openTab({ 
      id: `/purchase-invoices/${inv.id}`, 
      title: `فاتورة ${inv.invoice_number}`, 
      path: `/purchase-invoices/${inv.id}`,
      closable: true
    });
  };

  const handleSave = async () => {
    if (editor.lines.length === 0) {
      toast.error("يجب إضافة صنف واحد على الأقل");
      return;
    }
    setSaving(true);
    try {
      const backendLines = toBackendLines(editor.lines);
      if (backendLines.length === 0) {
        toast.error("يجب إضافة صنف واحد على الأقل");
        setSaving(false);
        return;
      }
      if (editor.id) {
        await invoiceService.updateInvoice({
          id: editor.id,
          supplier_id: editor.supplier_id || undefined,
          lines: backendLines,
          tax_amount: editor.tax_amount,
          discount_amount: editor.discount_amount,
          notes: editor.notes || undefined,
        });
        toast.success("تم تعديل فاتورة المشتريات");
      } else {
        await invoiceService.createInvoice({
          invoice_number: editor.invoice_number,
          invoice_type: "Purchase",
          supplier_id: editor.supplier_id || undefined,
          lines: backendLines,
          tax_amount: editor.tax_amount,
          discount_amount: editor.discount_amount,
          issued_at: new Date(editor.issued_at).toISOString(),
          notes: editor.notes || undefined,
        });
        toast.success("تم حفظ فاتورة المشتريات");
      }
      if (isNew || id) {
        closeTab(activeTabId);
      } else {
        setView("list");
        loadData();
      }
    } catch (e) {
      toast.error("فشل الحفظ: " + e);
    } finally {
      setSaving(false);
    }
  };

  const handlePost = async () => {
    if (!editor.id) return;
    if (!confirm("ترحيل الفاتورة؟ لا يمكن التعديل بعدها.")) return;
    setPosting(true);
    try {
      await invoiceService.postInvoice(editor.id);
      toast.success("تم الترحيل");
      setEditor(e => ({ ...e, status: "Posted" }));
      loadData();
    } catch (e) {
      toast.error("فشل الترحيل: " + e);
    } finally {
      setPosting(false);
    }
  };

  const postFromList = async (id: string) => {
    if (!confirm("ترحيل الفاتورة؟")) return;
    try {
      await invoiceService.postInvoice(id);
      toast.success("تم الترحيل");
      loadData();
    } catch (e) {
      toast.error("فشل الترحيل: " + e);
    }
  };

  // ── EDITOR VIEW ──────────────────────────────────────────────
  if (view === "editor") {
    return (
      <DocumentShell
        title="فاتورة مشتريات"
        subtitle="إدخال مشتريات المواد وتحديث تكاليف المخزون"
        docNumber={editor.invoice_number}
        docDate={editor.issued_at}
        status={editor.status}
        saving={saving}
        posting={posting}
        canPost={!!editor.id && editor.status === "Draft"}
        canEdit={editor.status === "Draft"}
        canDelete={!!editor.id && editor.status === "Draft"}
        onNew={handleCreate}
        onSave={handleSave}
        onPost={handlePost}
        onClose={() => closeTab(activeTabId)}
        onRefresh={loadData}
        summaryPanel={
          <SummaryPanel
            subtotal={subtotal}
            discount={discount}
            tax={tax}
            extraCosts={extraCosts}
            net={net}
            paid={paid}
            status={editor.status as DocumentStatus}
          />
        }
      >
        {/* Header fields */}
        <Card className="p-4 border-slate-200 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <InvoicePartySelector
              type="supplier"
              parties={suppliers}
              selectedId={editor.supplier_id}
              selectedName={editor.supplier_name}
              onSelect={(id, name) => setEditor(e => ({ ...e, supplier_id: id, supplier_name: name }))}
              onClear={() => setEditor(e => ({ ...e, supplier_id: "", supplier_name: "مورد نقدي" }))}
              defaultName="مورد نقدي"
            />

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">رقم الفاتورة</label>
              <Input
                value={editor.invoice_number}
                onChange={e => setEditor(ed => ({ ...ed, invoice_number: e.target.value }))}
                className="h-9 text-sm text-right"
                dir="rtl"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">التاريخ</label>
              <Input
                type="date"
                value={editor.issued_at}
                onChange={e => setEditor(ed => ({ ...ed, issued_at: e.target.value }))}
                className="h-9 text-sm"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">طريقة الدفع</label>
              <select
                value={editor.payment_method}
                onChange={e => setEditor(ed => ({ ...ed, payment_method: e.target.value }))}
                className="w-full h-9 text-sm border border-slate-200 rounded-md px-3 bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none"
                dir="rtl"
              >
                <option value="cash">نقداً</option>
                <option value="credit">آجل</option>
                <option value="partial">دفع جزئي</option>
              </select>
            </div>

            {editor.payment_method === "partial" && (
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">المبلغ المدفوع (ل.س)</label>
                <Input
                  type="number" min="0" step="0.01"
                  value={editor.paid_amount}
                  onChange={e => setEditor(ed => ({ ...ed, paid_amount: e.target.value }))}
                  className="h-9 text-sm text-left tabular-nums"
                />
              </div>
            )}

            <div className="lg:col-span-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">الملاحظات</label>
              <Input
                value={editor.notes}
                onChange={e => setEditor(ed => ({ ...ed, notes: e.target.value }))}
                placeholder="ملاحظات الشراء، شروط التوريد..."
                className="h-9 text-sm text-right"
                dir="rtl"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">الخصم المكتسب (ل.س)</label>
              <Input
                type="number" min="0" step="0.01"
                value={editor.discount_amount}
                onChange={e => setEditor(ed => ({ ...ed, discount_amount: e.target.value }))}
                className="h-9 text-sm text-left tabular-nums"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">تكاليف إضافية (ل.س)</label>
              <Input
                type="number" min="0" step="0.01"
                value={editor.extra_costs}
                onChange={e => setEditor(ed => ({ ...ed, extra_costs: e.target.value }))}
                className="h-9 text-sm text-left tabular-nums"
              />
            </div>
          </div>
        </Card>

        {/* Grid */}
        <Card className="p-0 overflow-hidden border-slate-200 shadow-sm">
          <InvoiceGrid
            type="Purchase"
            lines={editor.lines}
            onChange={lines => setEditor(ed => ({ ...ed, lines }))}
            disabled={editor.status === "Posted"}
          />
        </Card>
      </DocumentShell>
    );
  }

  // ── LIST VIEW ────────────────────────────────────────────────
  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-800">فواتير المشتريات</h1>
          <p className="text-sm text-slate-500">إدارة عمليات الشراء من الموردين</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ml-1 ${loading ? "animate-spin" : ""}`} />تحديث
          </Button>
          <Button size="sm" onClick={handleCreate}>
            <Plus className="w-4 h-4 ml-1" />فاتورة شراء جديدة
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "إجمالي فواتير الشراء", value: invoices.length, color: "text-slate-800" },
          { label: "مرحّلة", value: invoices.filter(i => i.status === "Posted").length, color: "text-green-600" },
          {
            label: "إجمالي قيمة الشراء",
            value: formatCurrency(invoices.filter(i => i.status === "Posted").reduce((s, i) => s + parseFloat(i.total_amount), 0)),
            color: "text-blue-700",
            raw: true,
          },
        ].map((s, i) => (
          <Card key={i} className="p-3 border-slate-200 shadow-sm">
            <div className="text-xs text-slate-500 mb-1">{s.label}</div>
            <div className={`text-2xl font-black tabular-nums ${s.color}`}>
              {(s as {raw?: boolean}).raw ? s.value : s.value}
            </div>
          </Card>
        ))}
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="بحث برقم الفاتورة أو المورد..."
              className="pr-9 h-8 text-sm border-slate-200"
              value={search}
              onChange={e => setSearch(e.target.value)}
              dir="rtl"
            />
          </div>
          <span className="text-xs text-slate-400">{filteredInvoices.length} فاتورة</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm" dir="rtl">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5 text-right text-xs font-bold text-slate-500">رقم الفاتورة</th>
                <th className="px-4 py-2.5 text-right text-xs font-bold text-slate-500">التاريخ</th>
                <th className="px-4 py-2.5 text-right text-xs font-bold text-slate-500">المورد</th>
                <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-500">الإجمالي</th>
                <th className="px-4 py-2.5 text-center text-xs font-bold text-slate-500">الحالة</th>
                <th className="px-4 py-2.5 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                  ))}</tr>
                ))
              ) : filteredInvoices.length === 0 ? (
                <tr><td colSpan={6} className="py-16 text-center text-slate-400 text-sm">
                  {search ? "لا نتائج للبحث" : "لا توجد فواتير مشتريات حتى الآن"}
                </td></tr>
              ) : filteredInvoices.map(inv => (
                <tr key={inv.id} className="hover:bg-slate-50 cursor-pointer transition-colors" onDoubleClick={() => handleEdit(inv)}>
                  <td className="px-4 py-2.5 font-bold text-blue-700 font-mono">{inv.invoice_number}</td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">{formatDate(inv.issued_at)}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-800">{inv.supplier_name ?? "مورد نقدي"}</td>
                  <td className="px-4 py-2.5 text-left font-black tabular-nums text-slate-900">{formatCurrency(parseFloat(inv.total_amount))}</td>
                  <td className="px-4 py-2.5 text-center"><DocumentStatusBadge status={inv.status} /></td>
                  <td className="px-4 py-2.5 text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={() => handleEdit(inv)}><Eye className="w-4 h-4 ml-2" />عرض / تعديل</DropdownMenuItem>
                        {inv.status === "Draft" && (
                          <DropdownMenuItem onClick={() => postFromList(inv.id)} className="text-green-600">
                            <Send className="w-4 h-4 ml-2" />ترحيل
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
      </Card>
    </div>
  );
}