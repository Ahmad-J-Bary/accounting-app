import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { useTabs } from '@app/providers/TabContext';
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Save, Send, Printer, RefreshCw, ChevronRight, History } from "lucide-react";
import { invoiceService } from '@modules/invoicing/api/invoiceService';
import { customerService } from '@modules/partners/api/customerService';
import { currencyService, type Currency } from '@modules/core/api/currencyService';
import type { InvoiceDto, CustomerDto } from "@erp/shared-types";
import { toast } from "sonner";
import { useCurrencyContext } from "@app/providers/CurrencyProvider";

import { FinancialDocumentTemplate } from '@widgets/templates/FinancialDocumentTemplate';
import { SalesInvoiceList } from '../components/SalesInvoiceList';
import { DocumentStatusBadge } from '../components/DocumentStatusBadge';
import { GenericDocumentGrid, DocumentColumn } from '@widgets/document-shell/GenericDocumentGrid';
import { SummaryPanel } from '@widgets/document-shell/SummaryPanel';
import { InvoicePartySelector } from '../components/InvoicePartySelector';
import { useDocumentEditor } from '../hooks/useDocumentEditor';
import { generateDocNumber, toBackendLines, GridLine } from '../lib/invoiceUtils';

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
  const { baseCurrency, getLatestRate, formatAmount, formatMonetaryAmount, hasTodayRate } = useCurrencyContext();

  const [view, setView] = useState<ViewMode>("list");
  const [invoices, setInvoices] = useState<InvoiceDto[]>([]);
  const [customers, setCustomers] = useState<CustomerDto[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
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
    setSaving(true);
    try {
      const backendLines = toBackendLines(lines);
      const payload = {
        ...headerState,
        lines: backendLines,
        issued_at: new Date(headerState.issued_at).toISOString(),
      };

      let saved: InvoiceDto;
      if (headerState.id) {
        saved = await invoiceService.updateInvoice({ ...payload, id: headerState.id } as any);
      } else {
        saved = await invoiceService.createInvoice(payload as any);
      }

      if (andPost) {
        await invoiceService.postInvoice(saved.id);
        toast.success("تم الحفظ والترحيل بنجاح");
      } else {
        toast.success("تم حفظ الفاتورة");
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

  const columns: DocumentColumn[] = [
    { key: "material_name", header: "المادة / الصنف", width: "flex-[3]", type: "material" },
    { key: "quantity", header: "الكمية", width: "w-[100px]", align: "center", type: "number" },
    { key: "unit_price", header: "السعر", width: "w-[120px]", align: "left", type: "number" },
    { key: "line_total", header: "الإجمالي", width: "w-[130px]", align: "left", type: "readonly" },
  ];

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
            columns={columns}
            lines={lines}
            onUpdateLine={updateLine}
            onRemoveLine={removeLine}
            onAddLine={addLine}
            onSelectMaterial={selectMaterial}
            materials={[]} // Add material search logic
            readOnly={headerState.status === "Posted"}
          />
        }
        summaryPanel={
          <SummaryPanel
            subtotal={totals.subtotal}
            discount={parseFloat(headerState.discount_amount)}
            tax={parseFloat(headerState.tax_amount)}
            net={totals.total - (parseFloat(headerState.discount_amount) || 0) + (parseFloat(headerState.tax_amount) || 0)}
            currency={headerState.currency_code}
            status={headerState.status as any}
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
              />
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase">طريقة الدفع</label>
                <select 
                  value={headerState.payment_method} 
                  onChange={e => setHeaderState(s => ({ ...s, payment_method: e.target.value }))}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                >
                  <option value="cash">نقداً</option>
                  <option value="credit">آجل (ذمم)</option>
                  <option value="partial">دفع جزئي</option>
                </select>
              </div>
            </div>
          </SummaryPanel>
        }
        sidebar={
           <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-6 space-y-4">
              <div className="flex items-center gap-2 text-slate-800">
                <History className="w-4 h-4" />
                <span className="text-sm font-black">سجل الفاتورة</span>
              </div>
              <div className="text-[11px] text-slate-400 text-center py-8 border-2 border-dashed border-slate-100 rounded-xl">
                لا توجد حركات سابقة
              </div>
           </div>
        }
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
      onCreate={() => navigate("/erp/sales/new")}
      onEdit={(inv) => navigate(`/erp/sales/${inv.id}`)}
      onPost={(id) => invoiceService.postInvoice(id).then(() => loadData(false))}
      formatMonetaryAmount={formatMonetaryAmount}
    />
  );
}

