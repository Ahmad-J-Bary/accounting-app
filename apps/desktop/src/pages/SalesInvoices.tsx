import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { useTabs } from "@/context/TabContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, RefreshCw, Search, Eye, Send, Printer, MoreHorizontal, SlidersHorizontal } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { invoiceService } from "@/services/invoiceService";
import { customerService } from "@/services/customerService";
import { currencyService, type Currency } from "@/services/currencyService";
import type { InvoiceDto, CustomerDto } from "@erp/shared-types";
import { toast } from "sonner";
import { useColumnPreferences } from "@/hooks/useColumnPreferences";
import { Settings2 } from "lucide-react";
import { useCurrencyContext } from "@/context/CurrencyContext";

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
  customer_id: string;
  customer_name: string;
  issued_at: string;
  notes: string;
  tax_amount: string;
  discount_amount: string;
  payment_method: string;
  reference: string;
  lines: GridLine[];
  status: string;
  id?: string;
  paid_amount?: string;
  currency_code: string;
  exchange_rate: string;
}

function defaultEditor(): EditorState {
  return {
    invoice_number: generateDocNumber("SAL"),
    customer_id: "",
    customer_name: "زبون نقدي",
    issued_at: new Date().toISOString().split("T")[0],
    notes: "",
    tax_amount: "0",
    discount_amount: "0",
    payment_method: "cash",
    reference: "",
    lines: [],
    status: "Draft",
    paid_amount: "0",
    currency_code: "USD",
    exchange_rate: "1",
  };
}

export default function SalesInvoices() {
  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams();
  const { openTab, closeTab, activeTabId } = useTabs();
  
  const [view, setView] = useState<ViewMode>("list");
  const [invoices, setInvoices] = useState<InvoiceDto[]>([]);
  const [customers, setCustomers] = useState<CustomerDto[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [editor, setEditor] = useState<EditorState>(defaultEditor());
  const [search, setSearch] = useState("");
  const { baseCurrency, getLatestRate, formatAmount, formatMonetaryAmount, hasTodayRate } = useCurrencyContext();

  const availableColumns = [
    { id: "material_name", label: "المادة" },
    { id: "quantity", label: "الكمية" },
    { id: "unit_price", label: "سعر البيع" },
    { id: "unit_price_usd", label: "سعر البيع ($)" },
    { id: "purchase_price", label: "تكلفة المرجع" },
    { id: "purchase_price_usd", label: "تكلفة المرجع ($)" },
    { id: "profit_amount", label: "الربح" },
    { id: "profit_amount_usd", label: "الربح ($)" },
    { id: "profit_percent", label: "الربح %" },
    { id: "line_total", label: "الإجمالي" },
    { id: "notes", label: "ملاحظات" },
  ];

  const defaultVisibleCols = ["material_name", "quantity", "unit_price", "purchase_price", "profit_amount", "line_total"];
  const { visibleColumns, toggleColumn, isVisible } = useColumnPreferences("sales_invoice", defaultVisibleCols);

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
            customer_id: inv.customer_id ?? "",
            customer_name: inv.customer_name ?? "زبون نقدي",
            issued_at: inv.issued_at.split("T")[0],
            notes: inv.notes ?? "",
            tax_amount: inv.tax_amount,
            discount_amount: inv.discount_amount,
            payment_method: inv.payment_method?.toLowerCase() || "cash",
            paid_amount: inv.amount_paid || "0",
            reference: "",
            lines: (inv.lines ?? []).map(l => ({
              ...l,
              _id: `line_${Math.random()}`,
              line_total: parseFloat(l.quantity) * parseFloat(l.unit_price),
            })),
            status: inv.status,
            currency_code: inv.currency_code || "USD",
            exchange_rate: inv.exchange_rate || "1",
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
      const [invData, custData, currData] = await Promise.all([
        invoiceService.listInvoicesByType("Sales"),
        customerService.listCustomers(),
        currencyService.listCurrencies(),
      ]);
      setInvoices(invData);
      setCustomers(custData);
      setCurrencies(currData);
    } catch {
      toast.error("فشل تحميل البيانات");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Handle currency change and fetch rates
  useEffect(() => {
    if (!baseCurrency) return;
    if (editor.currency_code === baseCurrency.code) {
      setEditor((prev) => ({ ...prev, exchange_rate: "1" }));
      return;
    }

    let cancelled = false;
    void getLatestRate(editor.currency_code).then((value) => {
      if (cancelled || !value) return;
      setEditor((prev) => ({ ...prev, exchange_rate: value }));
    });

    return () => {
      cancelled = true;
    };
  }, [editor.currency_code, baseCurrency, getLatestRate]);


  const filteredInvoices = useMemo(() =>
    invoices.filter(inv =>
      !search ||
      inv.invoice_number.includes(search) ||
      (inv.customer_name ?? "").includes(search) ||
      (inv.notes ?? "").includes(search)
    ), [invoices, search]);

  // Computed totals
  const subtotal = editor.lines.reduce((s, l) => s + (l.line_total ?? 0), 0);
  const discount = parseFloat(editor.discount_amount) || 0;
  const tax = parseFloat(editor.tax_amount) || 0;
  const net = subtotal - discount + tax;

  let paid = 0;
  if (editor.payment_method === "cash") {
    paid = net;
  } else if (editor.payment_method === "partial") {
    paid = parseFloat(editor.paid_amount || "0") || 0;
  } else {
    paid = 0; // credit
  }

  const totalProfit = editor.lines.reduce((acc, l) => {
    const q = parseFloat(l.quantity) || 0;
    const sp = parseFloat(l.unit_price) || 0;
    const cp = parseFloat(l.purchase_price || "0") || 0;
    return acc + (sp - cp) * q;
  }, 0);

  const profitPercent = net > 0 ? (totalProfit / net) * 100 : 0;
  const baseCode = baseCurrency?.code ?? "USD";
  const exchangeRateNum = Math.max(parseFloat(editor.exchange_rate || "1") || 1, 1e-9);
  const isForeignDoc = editor.currency_code !== baseCode;

  // Totals in document currency
  const totalInDoc = net;
  const paidInDoc = paid;

  // Totals in base currency (for accounting)
  const totalInBase = isForeignDoc ? net / exchangeRateNum : net;
  const paidInBase = isForeignDoc ? paid / exchangeRateNum : paid;
  const profitInBase = isForeignDoc ? totalProfit / exchangeRateNum : totalProfit;

  const handleCreate = () => {
    const uniqueId = `/sales-invoices/new-${Date.now()}`;
    openTab({ 
      id: uniqueId, 
      title: "فاتورة مبيعات جديدة", 
      path: uniqueId,
      closable: true
    });
  };

  const handleEdit = (inv: InvoiceDto) => {
    openTab({ 
      id: `/sales-invoices/${inv.id}`, 
      title: `فاتورة ${inv.invoice_number}`, 
      path: `/sales-invoices/${inv.id}`,
      closable: true
    });
  };

  const handleSave = async () => {
    if (editor.lines.length === 0) {
      toast.error("يجب إضافة صنف واحد على الأقل");
      return;
    }
    if (editor.currency_code !== baseCode && !hasTodayRate(editor.currency_code)) {
      toast.error("لا يوجد سعر صرف محدث لليوم لهذه العملة");
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

      const paymentMethodMap: Record<string, string> = {
        "cash": "Cash",
        "credit": "Deferred",
        "partial": "Partial"
      };

      const totalNet = editor.lines.reduce((s, l) => s + (l.line_total ?? 0), 0) 
                       - (parseFloat(editor.discount_amount) || 0) 
                       + (parseFloat(editor.tax_amount) || 0);

      const requestPayload = {
        invoice_number: editor.invoice_number,
        invoice_type: "Sales",
        customer_id: editor.customer_id || undefined,
        customer_name: !editor.customer_id ? editor.customer_name : undefined,
        lines: backendLines,
        tax_amount: editor.tax_amount,
        discount_amount: editor.discount_amount,
        payment_method: paymentMethodMap[editor.payment_method] || "Cash",
        amount_paid: editor.payment_method === "cash" ? totalNet.toString() : (editor.payment_method === "partial" ? editor.paid_amount || "0" : "0"),
        issued_at: new Date(editor.issued_at).toISOString(),
        currency_code: editor.currency_code,
        exchange_rate: editor.exchange_rate,
        notes: editor.notes || undefined,
      };

      let savedInvoice: InvoiceDto;
      if (editor.id) {
        savedInvoice = await invoiceService.updateInvoice({
          ...requestPayload,
          id: editor.id,
        });
        toast.success("تم تعديل فاتورة المبيعات");
      } else {
        savedInvoice = await invoiceService.createInvoice(requestPayload);
        setEditor(prev => ({ ...prev, id: savedInvoice.id }));
        toast.success("تم حفظ فاتورة المبيعات");
      }
      
      if (isNew) {
        navigate(`/erp/sales/${savedInvoice.id}`);
        closeTab(activeTabId);
      } else {
        setEditor(prev => ({
          ...prev,
          id: savedInvoice.id,
          status: savedInvoice.status,
          customer_id: savedInvoice.customer_id ?? "",
          customer_name: savedInvoice.customer_name ?? prev.customer_name,
          payment_method: savedInvoice.payment_method?.toLowerCase() || prev.payment_method,
          paid_amount: savedInvoice.amount_paid || prev.paid_amount,
        }));
        loadData();
      }
    } catch (e) {
      toast.error("فشل الحفظ: " + e);
    } finally {
      setSaving(false);
    }
  };

  const handlePost = async (invoiceId?: string) => {
    const idToPost = invoiceId || editor.id;
    if (!idToPost) return;
    if (!confirm("هل تريد ترحيل الفاتورة؟")) return;
    setPosting(true);
    try {
      await invoiceService.postInvoice(idToPost);
      toast.success("تم الترحيل بنجاح");
      if (!invoiceId) {
        setEditor(e => ({ ...e, status: "Posted" }));
      }
      loadData();
    } catch (e) {
      toast.error("فشل الترحيل: " + e);
    } finally {
      setPosting(false);
    }
  };

  const handleReopen = async () => {
    if (!editor.id) return;
    if (!confirm("هل تريد فك ترحيل الفاتورة للتمكن من تعديلها؟ سيتم حذف القيد المحاسبي وحركة المخزن المرتبطة.")) return;
    setReopening(true);
    try {
      await invoiceService.reopenInvoice(editor.id);
      toast.success("تم فك الترحيل - الفاتورة الآن في حالة مسودة");
      setEditor(e => ({ ...e, status: "Draft" }));
      loadData();
    } catch (e) {
      toast.error("فشل فك الترحيل: " + e);
    } finally {
      setReopening(false);
    }
  };

  const handleSaveAndPost = async () => {
    if (editor.lines.length === 0) {
      toast.error("يجب إضافة صنف واحد على الأقل");
      return;
    }
    if (editor.currency_code !== baseCode && !hasTodayRate(editor.currency_code)) {
      toast.error("لا يوجد سعر صرف محدث لليوم لهذه العملة");
      return;
    }
    setSaving(true);
    try {
      const backendLines = toBackendLines(editor.lines);
      const paymentMethodMap: Record<string, string> = {
        "cash": "Cash",
        "credit": "Deferred",
        "partial": "Partial"
      };

      const totalNet = editor.lines.reduce((s, l) => s + (l.line_total ?? 0), 0) 
                       - (parseFloat(editor.discount_amount) || 0) 
                       + (parseFloat(editor.tax_amount) || 0);

      const requestPayload = {
        invoice_number: editor.invoice_number,
        invoice_type: "Sales",
        customer_id: editor.customer_id || undefined,
        customer_name: !editor.customer_id ? editor.customer_name : undefined,
        lines: backendLines,
        tax_amount: editor.tax_amount,
        discount_amount: editor.discount_amount,
        payment_method: paymentMethodMap[editor.payment_method] || "Cash",
        amount_paid: editor.payment_method === "cash" ? totalNet.toString() : (editor.payment_method === "partial" ? editor.paid_amount || "0" : "0"),
        issued_at: new Date(editor.issued_at).toISOString(),
        currency_code: editor.currency_code,
        exchange_rate: editor.exchange_rate,
        notes: editor.notes || undefined,
      };

      let savedInvoice: InvoiceDto;
      if (editor.id) {
        savedInvoice = await invoiceService.updateInvoice({
          ...requestPayload,
          id: editor.id,
        });
      } else {
        savedInvoice = await invoiceService.createInvoice(requestPayload);
        setEditor(prev => ({ ...prev, id: savedInvoice.id }));
      }
      
      // Post it
      await invoiceService.postInvoice(savedInvoice.id);
      toast.success("تم الحفظ والترحيل بنجاح");
      
      if (isNew) {
        navigate(`/erp/sales/${savedInvoice.id}`);
        closeTab(activeTabId);
      } else {
        setEditor(prev => ({
          ...prev,
          id: savedInvoice.id,
          status: "Posted",
          customer_id: savedInvoice.customer_id ?? "",
          customer_name: savedInvoice.customer_name ?? prev.customer_name,
        }));
        loadData();
      }
    } catch (e) {
      toast.error("فشل الحفظ والترحيل: " + e);
    } finally {
      setSaving(false);
    }
  };

  const postFromList = (id: string) => handlePost(id);

  // ── EDITOR VIEW ──────────────────────────────────────────────
  if (view === "editor") {
    return (
      <DocumentShell
        title="فاتورة مبيعات"
        subtitle="إدخال بيانات البيع واختيار العميل والأصناف"
        docNumber={editor.invoice_number}
        docDate={editor.issued_at}
        status={editor.status}
        saving={saving}
        posting={posting}
        reopening={reopening}
        canPost={!!editor.id && editor.status === "Draft"}
        canEdit={editor.status !== "Cancelled"}
        canDelete={!!editor.id && editor.status === "Draft"}
        onNew={handleCreate}
        onSave={handleSave}
        onSaveAndPost={handleSaveAndPost}
        onPost={handlePost}
        onReopen={handleReopen}
        onClose={() => closeTab(activeTabId)}
        onRefresh={loadData}
        extraActions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" title="إعدادات الأعمدة">
                <Settings2 className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px]">
              <DropdownMenuLabel className="text-right">الأعمدة الظاهرة</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {availableColumns.map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={isVisible(col.id)}
                  onCheckedChange={() => toggleColumn(col.id)}
                  className="text-right flex-row-reverse gap-2"
                >
                  {col.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        }
        summaryPanel={
          <div className="space-y-4">
            <InvoicePartySelector
                type="customer"
                parties={customers}
                selectedId={editor.customer_id}
                selectedName={editor.customer_name}
                onSelect={(id, name) => setEditor(e => ({ ...e, customer_id: id, customer_name: name }))}
                onClear={() => setEditor(e => ({ ...e, customer_id: "", customer_name: "زبون نقدي" }))}
                defaultName="زبون نقدي"
            />
            
            <SummaryPanel
                subtotal={subtotal}
                discount={discount}
                tax={tax}
                net={net}
                paid={paid}
                status={editor.status as DocumentStatus}
                invoiceType="Sales"
            >
                <div className="space-y-3">
                    {/* Profit Card — detailed breakdown */}
                    {totalProfit !== 0 || subtotal > 0 ? (
                      <div className={`border rounded-lg p-2.5 mb-2 ${totalProfit >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                        <div className="flex justify-between items-center mb-2">
                          <span className={`text-[10px] font-bold uppercase ${totalProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                            الربح التقديري
                          </span>
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${totalProfit >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                            {profitPercent.toFixed(1)}٪
                          </span>
                        </div>
                        <div className={`text-xl font-black tabular-nums mb-1 ${totalProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                          {formatAmount(totalProfit, { currencyCode: editor.currency_code })}
                        </div>
                        {isForeignDoc && (
                          <div className="text-[10px] text-slate-400 font-mono mb-2">
                            ≈ {formatAmount(profitInBase)}
                          </div>
                        )}
                        <div className="space-y-1 border-t border-dashed border-current border-opacity-20 pt-2">
                          <div className="flex justify-between text-[10px]">
                            <span className="text-slate-500">إجمالي تكلفة المرجع</span>
                            <span className="font-semibold tabular-nums text-slate-600">{formatCurrency(editor.lines.reduce((a,l) => a + (parseFloat(l.purchase_price||'0')||0) * (parseFloat(l.quantity)||0), 0))}</span>
                          </div>
                          <div className="flex justify-between text-[10px]">
                            <span className="text-slate-500">إجمالي سعر البيع</span>
                            <span className="font-semibold tabular-nums text-slate-600">{formatCurrency(subtotal)}</span>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">طريقة التحصيل</label>
                        <select
                            value={editor.payment_method}
                            onChange={e => setEditor(ed => ({ ...ed, payment_method: e.target.value }))}
                            className="w-full h-8 text-[11px] border border-slate-200 rounded-md px-2 bg-white font-bold"
                            dir="rtl"
                        >
                            <option value="cash">نقداً</option>
                            <option value="credit">آجل</option>
                            <option value="partial">دفع جزئي</option>
                        </select>
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">العملة</label>
                        <select
                            value={editor.currency_code}
                            onChange={e => {
                                const code = e.target.value;
                                setEditor(ed => ({ ...ed, currency_code: code }));
                            }}
                            className="w-full h-8 text-[11px] border border-slate-200 rounded-md px-2 bg-white font-bold mb-2"
                        >
                            {currencies.map(c => (
                                <option key={c.code} value={c.code}>{c.name_ar} ({c.code})</option>
                            ))}
                        </select>
                        
                        {editor.currency_code !== baseCode && (
                            <div className="space-y-1 animate-in slide-in-from-top-1 duration-200">
                                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-tight">سعر الصرف (مقابل {baseCode})</label>
                                <Input
                                    type="number"
                                    value={editor.exchange_rate}
                                    onChange={e => setEditor(ed => ({ ...ed, exchange_rate: e.target.value }))}
                                    className="h-7 text-[11px] font-mono bg-slate-50 border-slate-200 text-left"
                                />
                            </div>
                        )}
                    </div>

                    {editor.payment_method === "partial" && (
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">المبلغ المحصل</label>
                            <Input
                                type="number"
                                value={editor.paid_amount}
                                onChange={e => setEditor(ed => ({ ...ed, paid_amount: e.target.value }))}
                                className="h-8 text-[11px] text-left tabular-nums font-black"
                            />
                        </div>
                    )}
                    <div className="rounded-lg border border-blue-100 bg-blue-50 p-2.5 text-[11px] space-y-1">
                      <div className="font-bold text-blue-700">القيمة الأصلية والمحوّلة</div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">الصافي ({editor.currency_code})</span>
                        <span className="font-semibold tabular-nums">{formatAmount(net, { currencyCode: editor.currency_code })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">الصافي ({baseCode})</span>
                        <span className="font-semibold tabular-nums">{formatAmount(totalInBase)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">المدفوع ({baseCode})</span>
                        <span className="font-semibold tabular-nums">{formatAmount(paidInBase)}</span>
                      </div>
                    </div>
                </div>
            </SummaryPanel>
          </div>
        }
      >
        {/* Header fields */}
        <Card className="p-4 border-slate-200 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">الملاحظات</label>
              <Input
                value={editor.notes}
                onChange={e => setEditor(ed => ({ ...ed, notes: e.target.value }))}
                placeholder="شروط الدفع، تفاصيل التسليم..."
                className="h-9 text-sm text-right"
                dir="rtl"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">الخصم (ل.س)</label>
              <Input
                type="number" min="0" step="0.01"
                value={editor.discount_amount}
                onChange={e => setEditor(ed => ({ ...ed, discount_amount: e.target.value }))}
                className="h-9 text-sm text-left tabular-nums"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">الضريبة (ل.س)</label>
              <Input
                type="number" min="0" step="0.01"
                value={editor.tax_amount}
                onChange={e => setEditor(ed => ({ ...ed, tax_amount: e.target.value }))}
                className="h-9 text-sm text-left tabular-nums"
              />
            </div>
          </div>
        </Card>

        {/* Grid */}
        <Card className="p-0 overflow-hidden border-slate-200 shadow-sm">
          <InvoiceGrid
            type="Sales"
            lines={editor.lines}
            onChange={lines => setEditor(ed => ({ ...ed, lines }))}
            disabled={editor.status === "Posted"}
            visibleColumns={visibleColumns}
            currencyCode={editor.currency_code}
            exchangeRate={editor.exchange_rate}
          />
        </Card>
      </DocumentShell>
    );
  }

  // ── LIST VIEW ────────────────────────────────────────────────
  return (
    <div className="space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-800">فواتير المبيعات</h1>
          <p className="text-sm text-slate-500">إدارة عمليات البيع والتحصيل</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ml-1 ${loading ? "animate-spin" : ""}`} />
            تحديث
          </Button>
          <Button size="sm" onClick={handleCreate}>
            <Plus className="w-4 h-4 ml-1" />
            فاتورة جديدة
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "إجمالي الفواتير", value: invoices.length, color: "text-slate-800" },
          { label: "مرحّلة", value: invoices.filter(i => i.status === "Posted").length, color: "text-green-600" },
          { label: "مسودات", value: invoices.filter(i => i.status === "Draft").length, color: "text-amber-600" },
        ].map((s, i) => (
          <Card key={i} className="p-3 border-slate-200 shadow-sm">
            <div className="text-xs text-slate-500 mb-1">{s.label}</div>
            <div className={`text-2xl font-black tabular-nums ${s.color}`}>{s.value}</div>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="بحث برقم الفاتورة أو العميل..."
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
                <th className="px-4 py-2.5 text-right text-xs font-bold text-slate-500">العميل</th>
                <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-500">الإجمالي</th>
                <th className="px-4 py-2.5 text-left text-xs font-bold text-blue-600">الربح</th>
                <th className="px-4 py-2.5 text-center text-xs font-bold text-slate-500">الحالة</th>
                <th className="px-4 py-2.5 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400 text-sm">
                    {search ? "لا توجد فواتير تطابق البحث" : "لا توجد فواتير مبيعات حتى الآن"}
                  </td>
                </tr>
              ) : (
                filteredInvoices.map(inv => (
                  <tr
                    key={inv.id}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                    onDoubleClick={() => handleEdit(inv)}
                  >
                    <td className="px-4 py-2.5 font-bold text-blue-700 font-mono">{inv.invoice_number}</td>
                    <td className="px-4 py-2.5 text-slate-500 text-xs">{formatDate(inv.issued_at)}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{inv.customer_name || "زبون نقدي"}</td>
                    <td className="px-4 py-2.5 text-left font-black tabular-nums text-slate-900">
                      <div>{formatMonetaryAmount(inv.total_amount_v2 || inv.total_amount, "both")}</div>
                    </td>
                    <td className="px-4 py-2.5 text-left font-bold tabular-nums text-blue-700">
                      {inv.total_profit ? (
                        <div>{formatMonetaryAmount(inv.total_profit, "both")}</div>
                      ) : "---"}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <DocumentStatusBadge status={inv.status} />
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem onClick={() => handleEdit(inv)}>
                            <Eye className="w-4 h-4 ml-2" />عرض / تعديل
                          </DropdownMenuItem>
                          {inv.status === "Draft" && (
                            <DropdownMenuItem onClick={() => postFromList(inv.id)} className="text-green-600">
                              <Send className="w-4 h-4 ml-2" />ترحيل
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem>
                            <Printer className="w-4 h-4 ml-2" />طباعة
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
