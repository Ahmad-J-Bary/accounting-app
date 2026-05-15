import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { useTabs } from '@app/providers/TabContext';
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Save, Send, Printer, History, Settings2 } from "lucide-react";
import { useDocumentFinancials } from "@modules/invoicing/lib/useDocumentFinancials";
import { invoiceService } from '@modules/invoicing/api/invoiceService';
import { customerService } from '@modules/partners/api/customerService';
import { materialService } from '@modules/inventory/api/materialService';
import { currencyService, type Currency } from '@modules/core/api/currencyService';
import type { InvoiceDto, CustomerDto, MaterialDto } from "@erp/shared-types";
import { toast } from "sonner";
import { useCurrencyContext } from "@app/providers/CurrencyContext";

import { FinancialDocumentTemplate } from '@widgets/templates/FinancialDocumentTemplate';
import { InvoiceList } from '../components/InvoiceList';
import { DocumentStatusBadge } from '../components/DocumentStatusBadge';
import { GenericDocumentGrid, DocumentColumn } from '@widgets/document-shell/GenericDocumentGrid';
import { SummaryPanel } from '@widgets/document-shell/SummaryPanel';
import { InvoicePartySelector } from '../components/InvoicePartySelector';
import { useDocumentEditor } from '../hooks/useDocumentEditor';
import { toBackendLines, type GridLine, newGridLine } from '../lib/invoiceUtils';
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
  extra_costs: string;
  payment_method: string;
  currency_code: string;
  exchange_rate: string;
  status: string;
  paid_amount: string;
  id?: string;
}

const DEFAULT_EDITOR = (baseCurrencyCode: string): EditorState => ({
  invoice_number: "...",
  customer_id: "",
  customer_name: "زبون نقدي",
  issued_at: new Date().toISOString().split("T")[0],
  notes: "",
  tax_amount: "0",
  discount_amount: "0",
  extra_costs: "0",
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
  const { openTab } = useTabs();
  const { baseCurrency, formatMonetaryAmount, rateMap } = useCurrencyContext();

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

  const { lines, setLines, updateLine, addLine, removeLine, selectMaterial, totals } = useDocumentEditor({
    materials
  });

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

  const isReadOnly = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    return searchParams.get("mode") === "view";
  }, [location.search]);

  // Handle Route Changes
  useEffect(() => {
    if (isNew) {
      setHeaderState(DEFAULT_EDITOR(baseCurrency?.code || "USD"));
      invoiceService.getNextInvoiceNumber("Sales").then(num => {
        setHeaderState(s => ({ ...s, invoice_number: num, status: "Draft" }));
      });
      // Use real exchange rate from rateMap
      const rate = rateMap.get("SYP");
      if (rate) {
        setHeaderState(s => ({ ...s, exchange_rate: rate.toString() }));
      }
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
            extra_costs: inv.extra_costs || "0",
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
  }, [isNew, id, baseCurrency, setLines, rateMap]);

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
          toast.success(headerState.status === "Posted" ? "تم تحديث وإعادة ترحيل الفاتورة" : "تم الحفظ والترحيل بنجاح");
        } catch (postError) {
          toast.error("تم حفظ الفاتورة ولكن فشل الترحيل: " + postError);
          setSaving(false);
          return;
        }
      } else {
        toast.success("تم حفظ الفاتورة كمسودة");
      }

      if (isNew || headerState.status !== "Posted") {
        navigate(`/sales-invoices/${saved.id}?mode=view`);
        setHeaderState(s => ({ ...s, status: andPost ? "Posted" : "Draft" }));
      } else {
        loadData();
        navigate(`/sales-invoices/${saved.id}?mode=view`);
      }
    } catch (e) {
      toast.error("فشل العملية: " + e);
    } finally {
      setSaving(false);
    }
  };

  const handleReopen = async () => {
    if (!headerState.id) return;
    if (!window.confirm("هل أنت متأكد من إلغاء ترحيل الفاتورة؟ سيتم عكس القيود المحاسبية وحركات المخزون.")) return;
    
    try {
      setSaving(true);
      await invoiceService.reopenInvoice(headerState.id);
      toast.success("تم إلغاء الترحيل بنجاح. الفاتورة الآن مسودة.");
      setHeaderState(s => ({ ...s, status: "Draft" }));
      navigate(`/sales-invoices/${headerState.id}`); // Edit mode
    } catch (e) {
      toast.error("فشل إلغاء الترحيل: " + e);
    } finally {
      setSaving(false);
    }
  };

  const extraCols = useMemo<DocumentColumn[]>(() => [
    { key: "cost_price", header: "التكلفة ($)", width: "w-[90px]", align: "left", type: "readonly" },
    { key: "cost_price_SYP", header: "التكلفة (ل.س)", width: "w-[90px]", align: "left", type: "readonly" },
    { key: "profit_amount", header: "الربح ($)", width: "w-[90px]", align: "left", type: "readonly" },
    { key: "profit_amount_SYP", header: "الربح (ل.س)", width: "w-[90px]", align: "left", type: "readonly" },
    { key: "profit_percent", header: "الربح %", width: "w-[70px]", align: "center", type: "readonly" },
    { key: "notes", header: "ملاحظات", width: "flex-[1]", align: "right", type: "text" }
  ], []);

  const { 
    enrichedLines, 
    docSubtotal, 
    subtotal,
    net,
    displayCurrency,
    setDisplayCurrency,
    gridColumns 
  } = useDocumentFinancials({
    lines,
    setLines,
    headerState,
    setHeaderState,
    currencies,
    invoiceType: "Sales",
    extraColumns: extraCols
  });

  // Removed duplicate state logic

  if (view === "editor") {
    return (
      <FinancialDocumentTemplate
        title="فاتورة مبيعات"
        statusBadge={<DocumentStatusBadge status={headerState.status} />}
        toolbar={
          <>
            {headerState.status === "Posted" ? (
              <>
                {isReadOnly ? (
                  <>
                    <Button 
                      size="sm" 
                      onClick={() => navigate(`/sales-invoices/${headerState.id}`)}
                      className="bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-100 font-bold"
                    >
                      <Settings2 className="w-4 h-4 ml-2" /> تعديل الفاتورة
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleReopen}
                      className="border-rose-200 text-rose-600 hover:bg-rose-50 font-bold"
                    >
                      <History className="w-4 h-4 ml-2" /> إلغاء الترحيل
                    </Button>
                  </>
                ) : (
                  <>
                    <Button 
                      size="sm" 
                      onClick={() => handleSave(true)} 
                      disabled={saving} 
                      className="bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-100 font-bold"
                    >
                      <Send className="w-4 h-4 ml-2" /> حفظ وترحيل التعديلات
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleReopen}
                      className="border-rose-200 text-rose-600 hover:bg-rose-50 font-bold"
                    >
                      <History className="w-4 h-4 ml-2" /> إلغاء الترحيل
                    </Button>
                  </>
                )}
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => handleSave(false)} disabled={saving} className="bg-white border-slate-200 text-slate-700 font-bold">
                  <Save className="w-4 h-4 ml-2" /> {saving ? "جاري الحفظ..." : "حفظ مسودة"}
                </Button>
                <Button size="sm" onClick={() => handleSave(true)} disabled={saving} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 font-bold">
                  <Send className="w-4 h-4 ml-2" /> ترحيل الفاتورة
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" className="bg-white font-bold border-slate-200">
              <Printer className="w-4 h-4 ml-2 text-slate-500" /> طباعة
            </Button>
          </>
        }
        headerFields={
          <>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase">رقم الفاتورة</label>
              <Input value={headerState.invoice_number} readOnly className="h-9 font-mono font-bold bg-slate-50 border-slate-200" />
            </div>

            <div className="md:col-span-2 space-y-1">
              <InvoicePartySelector
                type="customer"
                parties={customers}
                selectedId={headerState.customer_id}
                selectedName={headerState.customer_name}
                onSelect={(id, name) => setHeaderState(s => ({ ...s, customer_id: id, customer_name: name }))}
                onClear={() => setHeaderState(s => ({ ...s, customer_id: "", customer_name: "زبون نقدي" }))}
                readOnly={isReadOnly}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase">تاريخ الإصدار</label>
              <Input type="date" readOnly={isReadOnly} value={headerState.issued_at} onChange={e => setHeaderState(s => ({ ...s, issued_at: e.target.value }))} className="h-9 font-bold border-slate-200 disabled:opacity-100" />
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase">ملاحظات المستند</label>
              <Input placeholder="أدخل أي ملاحظات إضافية هنا..." readOnly={isReadOnly} value={headerState.notes} onChange={e => setHeaderState(s => ({ ...s, notes: e.target.value }))} className="h-9 border-slate-200 disabled:opacity-100" />
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
            readOnly={isReadOnly}
            preferenceKey="sales_invoice_grid_v2"
            docCurrency={headerState.currency_code}
            exchangeRate={headerState.exchange_rate}
          />
        }
        summaryPanel={
          <SummaryPanel
            subtotal={subtotal}
            discount={parseFloat(headerState.discount_amount)}
            tax={parseFloat(headerState.tax_amount)}
            extraCosts={parseFloat(headerState.extra_costs || "0")}
            net={net}
            paid={parseFloat(headerState.paid_amount)}
            currency={displayCurrency}
            status={headerState.status as DocumentStatus}
            invoiceType="Sales"
            currencies={currencies}
            onCurrencyChange={setDisplayCurrency}
            exchangeRate={parseFloat(headerState.exchange_rate)}
            isReadOnly={isReadOnly}
            paymentMethod={headerState.payment_method}
            onPaymentMethodChange={(method) => {
              setHeaderState(s => ({
                ...s,
                payment_method: method,
                paid_amount: method === "cash" ? net.toString() : (method === "credit" ? "0" : s.paid_amount)
              }));
            }}
            paidAmount={headerState.paid_amount}
            onPaidAmountChange={(amount) => setHeaderState(s => ({ ...s, paid_amount: amount }))}
          />
        }
        sidebar={null}
      />
    );
  }

  const searchParams = new URLSearchParams(location.search);
  const customerIdFilter = searchParams.get("customerId") || undefined;

  return (
    <InvoiceList
      invoices={invoices}
      loading={loading || refreshing}
      search={search}
      partyIdFilter={customerIdFilter}
      onSearchChange={setSearch}
      onRefresh={() => loadData(false)}
      onCreate={() => {
        const uniqueId = `/sales-invoices/new-${Date.now()}`;
        openTab({ id: uniqueId, title: "فاتورة مبيعات جديدة", path: uniqueId, closable: true });
      }}
      onEdit={(inv) => {
        openTab({ id: `/sales-invoices/${inv.id}`, title: `تعديل ${inv.invoice_number}`, path: `/sales-invoices/${inv.id}`, closable: true });
      }}
      onView={(inv) => {
        openTab({ id: `/sales-invoices/${inv.id}?mode=view`, title: `عرض ${inv.invoice_number}`, path: `/sales-invoices/${inv.id}?mode=view`, closable: true });
      }}
      onPost={(id) => invoiceService.postInvoice(id).then(() => loadData(false))}
      onDelete={(id) => invoiceService.deleteInvoice(id).then(() => loadData(false))}
      onReopen={(id) => invoiceService.reopenInvoice(id).then(() => loadData(false))}
      formatMonetaryAmount={formatMonetaryAmount}
      partyType="customer"
      title="فواتير المبيعات"
      createLabel="فاتورة جديدة"
      searchPlaceholder="بحث برقم الفاتورة أو الزبون..."
      emptyMessage="لا توجد فواتير مبيعات مسجّلة"
      statsLabel="إجمالي المبيعات"
      statsColor="text-blue-600"
      preferenceKey="sales_invoices_v2"
    />
  );
}