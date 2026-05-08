import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { useTabs } from '@app/providers/TabContext';
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Save, Send, Printer, RefreshCw, ChevronRight, History } from "lucide-react";
import { invoiceService } from '@modules/invoicing/api/invoiceService';
import { customerService } from '@modules/partners/api/customerService';
import { materialService } from '@modules/inventory/api/materialService';
import { currencyService, type Currency } from '@modules/core/api/currencyService';
import type { InvoiceDto, CustomerDto, MaterialDto } from "@erp/shared-types";
import { toast } from "sonner";
import { useCurrencyContext } from "@app/providers/CurrencyContext";

import { FinancialDocumentTemplate } from '@widgets/templates/FinancialDocumentTemplate';
import { SalesInvoiceList } from '../components/SalesInvoiceList';
import { DocumentStatusBadge } from '../components/DocumentStatusBadge';
import { GenericDocumentGrid, DocumentColumn } from '@widgets/document-shell/GenericDocumentGrid';
import { SummaryPanel } from '@widgets/document-shell/SummaryPanel';
import { InvoicePartySelector } from '../components/InvoicePartySelector';
import { useDocumentEditor } from '../hooks/useDocumentEditor';
import { generateDocNumber, toBackendLines, type GridLine } from '../lib/invoiceUtils';
import { type DocumentStatus } from '../components/DocumentStatusBadge';

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
  currency_code: string;
  exchange_rate: string;
  status: string;
  id?: string;
  paid_amount?: string;
}

const DEFAULT_EDITOR = (baseCurrencyCode: string): EditorState => ({
  invoice_number: generateDocNumber("SAL"),
  customer_id: "",
  customer_name: "زبون نقدي",
  issued_at: new Date().toISOString().split("T")[0],
  notes: "",
  tax_amount: "0",
  discount_amount: "0",
  payment_method: "cash",
  currency_code: baseCurrencyCode || "USD",
  exchange_rate: "1",
  status: "Draft",
  paid_amount: "0",
});

export default function SalesInvoices() {
  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams();
  const { openTab, closeTab, activeTabId } = useTabs();
  const { baseCurrency, getLatestRate, formatAmount, formatMonetaryAmount, convertBetween, hasTodayRate } = useCurrencyContext();

  const [view, setView] = useState<ViewMode>("list");
  const [invoices, setInvoices] = useState<InvoiceDto[]>([]);
  const [customers, setCustomers] = useState<CustomerDto[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [materials, setMaterials] = useState<MaterialDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [headerState, setHeaderState] = useState<EditorState>(DEFAULT_EDITOR(baseCurrency?.code || "USD"));

  const { lines, setLines, updateLine, addLine, removeLine, selectMaterial, totals } = useDocumentEditor();

  const isNew = location.pathname.includes("/new");

  // Load Data
  const loadData = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      else setRefreshing(true);
      
      const [invData, custData, currData, matData] = await Promise.all([
        invoiceService.listInvoicesByType("Sales"),
        customerService.listCustomers(),
        currencyService.listCurrencies(),
        materialService.listMaterials(),
      ]);
      setInvoices(invData);
      setCustomers(custData);
      setCurrencies(currData);
      setMaterials(matData);
    } catch {
      toast.error("فشل تحميل البيانات");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(true); }, [loadData]);

  // Handle Route Changes
  useEffect(() => {
    if (isNew) {
      setHeaderState(DEFAULT_EDITOR(baseCurrency?.code || "USD"));
      setLines([]);
      setView("editor");
    } else if (id) {
      const loadInvoice = async () => {
        try {
          const inv = await invoiceService.getInvoiceById(id);
          setHeaderState({
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
            status: inv.status,
            currency_code: inv.currency_code || "USD",
            exchange_rate: inv.exchange_rate || "1",
          });
          setLines((inv.lines ?? []).map(l => ({
            ...l,
            _id: `line_${Math.random()}`,
            line_total: parseFloat(l.quantity) * parseFloat(l.unit_price),
          })));
          setView("editor");
        } catch {
          toast.error("فشل تحميل الفاتورة");
        }
      };
      loadInvoice();
    } else {
      setView("list");
    }
  }, [isNew, id, baseCurrency, setLines]);

  const handleSave = async (andPost = false) => {
    if (lines.length === 0) {
      toast.error("يجب إضافة صنف واحد على الأقل");
      return;
    }
    
    if (headerState.payment_method !== "cash" && !headerState.customer_id && headerState.customer_name === "زبون نقدي") {
      toast.error("المبيعات الآجلة أو الجزئية تتطلب اختيار عميل محدد. 'زبون نقدي' مخصص للبيع النقدي فقط.");
      return;
    }

    setSaving(true);
    try {
      const backendLines = toBackendLines(lines);
      const paymentMethodMap: Record<string, string> = {
        "cash": "Cash",
        "credit": "Deferred",
        "partial": "Partial"
      };

      const netAmount = totals.total - (parseFloat(headerState.discount_amount) || 0) + (parseFloat(headerState.tax_amount) || 0);
      const payload = {
        ...headerState,
        invoice_type: "Sales",
        customer_id: headerState.customer_id || undefined,
        customer_name: !headerState.customer_id ? headerState.customer_name : undefined,
        payment_method: paymentMethodMap[headerState.payment_method] || "Cash",
        amount_paid: headerState.payment_method === "cash" ? netAmount.toString() : (headerState.payment_method === "partial" ? headerState.paid_amount : "0"),
        lines: backendLines,
        issued_at: new Date(headerState.issued_at).toISOString(),
      };

      let saved: InvoiceDto;
      if (headerState.id) {
        saved = await invoiceService.updateInvoice({ ...payload, id: headerState.id });
      } else {
        saved = await invoiceService.createInvoice(payload);
        // Set ID locally so retries (e.g. after failed post) use update instead of create
        setHeaderState(s => ({ ...s, id: saved.id }));
      }

      if (andPost) {
        try {
          await invoiceService.postInvoice(saved.id);
          toast.success("تم الحفظ والترحيل بنجاح");
        } catch (postError) {
          toast.error("تم حفظ الفاتورة كمسودة ولكن فشل الترحيل: " + postError);
          setSaving(false);
          // Don't navigate away, let user fix it
          return;
        }
      } else {
        toast.success("تم حفظ الفاتورة كمسودة");
      }

      if (isNew) {
        navigate(`/erp/sales/${saved.id}`);
        closeTab(activeTabId);
      } else {
        loadData();
      }
    } catch (e) {
      toast.error("فشل العملية: " + e);
    } finally {
      setSaving(false);
    }
  };

  const enrichedLines = useMemo(() => {
    return lines.map((line: GridLine) => {
      const enriched: GridLine & Record<string, string | number | undefined> = { ...line } as any;
      
      // The current unit_price and line_total are in the document's currency (headerState.currency_code)
      const docPrice = parseFloat(line.unit_price || "0");
      const docTotal = line.line_total || 0;
      
      // Calculate values for all currencies
      currencies.forEach(curr => {
        const price = convertBetween(docPrice, headerState.currency_code, curr.code);
        const total = convertBetween(docTotal, headerState.currency_code, curr.code);
        
        enriched[`unit_price_${curr.code}`] = price.toFixed(2);
        enriched[`line_total_${curr.code}`] = formatAmount(total, { currencyCode: curr.code, hideSymbol: true });
      });
      return enriched;
    });
  }, [lines, currencies, headerState.currency_code, convertBetween, formatAmount]);

  const gridColumns = useMemo<DocumentColumn[]>(() => {
    const cols: DocumentColumn[] = [
      { key: "material_name", header: "المادة / الصنف", width: "flex-[3]", align: "right", type: "material" },
      { key: "quantity", header: "الكمية", width: "w-[90px]", align: "center", type: "number" },
    ];

    // Add unit price for each currency
    currencies.forEach(curr => {
      const s = curr.symbol || curr.code;
      const isDocCurr = curr.code === headerState.currency_code;
      cols.push({ 
        key: isDocCurr ? "unit_price" : `unit_price_${curr.code}`, 
        header: `السعر (${s})`, 
        width: "w-[110px]", 
        align: "left", 
        type: isDocCurr ? "number" : "readonly" 
      });
    });

    cols.push({ key: "discount", header: "خصم %", width: "w-[80px]", align: "center", type: "number" });

    // Add line total for each currency
    currencies.forEach(curr => {
      const s = curr.symbol || curr.code;
      cols.push({ 
        key: `line_total_${curr.code}`, 
        header: `الإجمالي (${s})`, 
        width: "w-[120px]", 
        align: "left", 
        type: "readonly" 
      });
    });

    cols.push({ key: "notes", header: "ملاحظات", width: "flex-[2]", align: "right", type: "text" });

    return cols;
  }, [currencies, headerState.currency_code]);

  if (view === "editor") {
    return (
      <FinancialDocumentTemplate
        title="فاتورة مبيعات"
        statusBadge={<DocumentStatusBadge status={headerState.status} />}
        toolbar={
          <>
            <Button variant="outline" size="sm" onClick={() => setView("list")} className="bg-white">
              <ChevronRight className="w-4 h-4 ml-2" /> العودة للقائمة
            </Button>
            <div className="h-6 w-px bg-slate-200 mx-2" />
            <Button variant="outline" size="sm" onClick={() => handleSave(false)} disabled={saving} className="bg-white border-slate-200 text-slate-700">
              <Save className="w-4 h-4 ml-2" /> {saving ? "جاري الحفظ..." : "حفظ مسودة"}
            </Button>
            <Button size="sm" onClick={() => handleSave(true)} disabled={saving} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100">
              <Send className="w-4 h-4 ml-2" /> ترحيل الفاتورة
            </Button>
            <Button variant="outline" size="sm" className="bg-white">
              <Printer className="w-4 h-4 ml-2" /> طباعة
            </Button>
          </>
        }
        headerFields={
          <>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase">رقم الفاتورة</label>
              <Input value={headerState.invoice_number} readOnly className="h-10 font-mono font-bold bg-slate-50 border-slate-200" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase">تاريخ الإصدار</label>
              <Input type="date" value={headerState.issued_at} onChange={e => setHeaderState(s => ({ ...s, issued_at: e.target.value }))} className="h-10 font-bold border-slate-200" />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase">ملاحظات المستند</label>
              <Input placeholder="أدخل أي ملاحظات إضافية هنا..." value={headerState.notes} onChange={e => setHeaderState(s => ({ ...s, notes: e.target.value }))} className="h-10 border-slate-200" />
            </div>
          </>
        }
        lineItemsGrid={
          <GenericDocumentGrid
            columns={gridColumns}
            lines={enrichedLines}
            onUpdateLine={updateLine}
            onRemoveLine={removeLine}
            onAddLine={addLine}
            onSelectMaterial={selectMaterial}
            materials={Object.values(materials)} 
            readOnly={headerState.status === "Posted"}
            preferenceKey="sales_invoice_grid"
          />
        }
        summaryPanel={
          <SummaryPanel
            subtotal={totals.subtotal}
            discount={parseFloat(headerState.discount_amount)}
            tax={parseFloat(headerState.tax_amount)}
            net={totals.total - (parseFloat(headerState.discount_amount) || 0) + (parseFloat(headerState.tax_amount) || 0)}
            paid={
              headerState.payment_method === "cash" 
                ? (totals.total - (parseFloat(headerState.discount_amount) || 0) + (parseFloat(headerState.tax_amount) || 0)) 
                : headerState.payment_method === "partial" 
                  ? parseFloat(headerState.paid_amount || "0")
                  : 0
            }
            currency={headerState.currency_code}
            status={headerState.status as DocumentStatus}
            invoiceType="Sales"
          >
            <div className="space-y-4 pt-2">
              <InvoicePartySelector
                type="customer"
                parties={customers}
                selectedId={headerState.customer_id}
                selectedName={headerState.customer_name}
                onSelect={(id, name) => setHeaderState(s => ({ ...s, customer_id: id, customer_name: name }))}
                onClear={() => setHeaderState(s => ({ ...s, customer_id: "", customer_name: "زبون نقدي" }))}
                predictedBalance={
                  headerState.payment_method === "cash" 
                    ? 0 
                    : (totals.total - (parseFloat(headerState.discount_amount) || 0) + (parseFloat(headerState.tax_amount) || 0)) - (parseFloat(headerState.paid_amount) || 0)
                }
              />
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase">طريقة الدفع</label>
                <select 
                  value={headerState.payment_method} 
                  onChange={e => {
                    const method = e.target.value;
                    const net = totals.total - (parseFloat(headerState.discount_amount) || 0) + (parseFloat(headerState.tax_amount) || 0);
                    setHeaderState(s => ({ 
                      ...s, 
                      payment_method: method,
                      paid_amount: method === "cash" ? net.toString() : (method === "credit" ? "0" : s.paid_amount)
                    }));
                  }}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                >
                  <option value="cash">نقداً (دفع كامل)</option>
                  <option value="credit">آجل (ذمم على العميل)</option>
                  <option value="partial">دفع جزئي (مقدم + ذمم)</option>
                </select>
              </div>

              {headerState.payment_method === "partial" && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <label className="text-[10px] font-black text-blue-500 uppercase flex items-center gap-2">
                    المبلغ المدفوع الآن (نقداً)
                    <div className="w-1 h-1 rounded-full bg-blue-500" />
                  </label>
                  <Input 
                    type="number" 
                    value={headerState.paid_amount} 
                    onChange={e => setHeaderState(s => ({ ...s, paid_amount: e.target.value }))}
                    className="h-10 font-black text-lg border-blue-200 focus:ring-blue-500 bg-blue-50/30"
                    placeholder="0.00"
                  />
                  <div className="text-[10px] text-slate-400 font-bold px-1">
                    المتبقي ذمة على العميل: {formatAmount((totals.total - (parseFloat(headerState.discount_amount) || 0) + (parseFloat(headerState.tax_amount) || 0)) - (parseFloat(headerState.paid_amount) || 0))}
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-slate-100">
                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">العملة وسعر الصرف</label>
                <select
                  value={headerState.currency_code}
                  onChange={e => setHeaderState(s => ({ ...s, currency_code: e.target.value }))}
                  className="w-full h-9 px-3 rounded-md border border-slate-200 bg-slate-50 font-bold text-xs"
                >
                  {currencies.map(c => (
                    <option key={c.code} value={c.code}>{c.name_ar} ({c.symbol || c.code})</option>
                  ))}
                </select>
                {headerState.currency_code !== baseCurrency?.code && (
                  <Input
                    type="number"
                    value={headerState.exchange_rate}
                    onChange={e => setHeaderState(s => ({ ...s, exchange_rate: e.target.value }))}
                    className="mt-2 h-8 text-left font-mono font-bold text-xs"
                    placeholder="سعر الصرف"
                  />
                )}
              </div>
            </div>
          </SummaryPanel>
        }
        sidebar={null}
      />
    );
  }

  return (
    <SalesInvoiceList
      invoices={invoices}
      loading={loading || refreshing}
      search={search}
      onSearchChange={setSearch}
      onRefresh={() => loadData(false)}
      onCreate={() => {
        const uniqueId = `/sales-invoices/new-${Date.now()}`;
        openTab({ 
          id: uniqueId, 
          title: "فاتورة مبيعات جديدة", 
          path: uniqueId,
          closable: true
        });
      }}
      onEdit={(inv) => {
        openTab({ 
          id: `/sales-invoices/${inv.id}`, 
          title: `فاتورة ${inv.invoice_number}`, 
          path: `/sales-invoices/${inv.id}`,
          closable: true
        });
      }}
      onPost={(id) => invoiceService.postInvoice(id).then(() => loadData(false))}
      formatMonetaryAmount={formatMonetaryAmount}
    />
  );
}

