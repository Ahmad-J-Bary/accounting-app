import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { useTabs } from '@app/providers/TabContext';
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Save, Send, Printer, ChevronRight, History, RefreshCw, Plus } from "lucide-react";
import { invoiceService } from '@modules/invoicing/api/invoiceService';
import { supplierService } from '@modules/partners/api/supplierService';
import { currencyService, type Currency } from '@modules/core/api/currencyService';
import type { InvoiceDto, SupplierDto } from "@erp/shared-types";
import { toast } from "sonner";
import { useCurrencyContext } from "@app/providers/CurrencyProvider";

// Unified Components
import { FinancialDocumentTemplate } from "@widgets/templates/FinancialDocumentTemplate";
import { GenericDocumentGrid, type DocumentColumn } from "@widgets/document-shell/GenericDocumentGrid";
import { SummaryPanel } from "@widgets/document-shell/SummaryPanel";
import { InvoicePartySelector } from "../components/InvoicePartySelector";
import { DocumentStatusBadge } from "../components/DocumentStatusBadge";
import { PurchaseInvoiceList } from "../components/PurchaseInvoiceList";
import { useDocumentEditor } from "../hooks/useDocumentEditor";
import { generateDocNumber, toBackendLines } from "../lib/invoiceUtils";

type ViewMode = "list" | "editor";

interface HeaderState {
  invoice_number: string;
  supplier_id: string;
  supplier_name: string;
  issued_at: string;
  notes: string;
  tax_amount: string;
  discount_amount: string;
  extra_costs: string;
  payment_method: string;
  status: string;
  id?: string;
  currency_code: string;
  exchange_rate: string;
  paid_amount: string;
}

const defaultHeader = (): HeaderState => ({
  invoice_number: generateDocNumber("PUR"),
  supplier_id: "",
  supplier_name: "مورد نقدي",
  issued_at: new Date().toISOString().split("T")[0],
  notes: "",
  tax_amount: "0",
  discount_amount: "0",
  extra_costs: "0",
  payment_method: "cash",
  status: "Draft",
  currency_code: "USD",
  exchange_rate: "1",
  paid_amount: "0",
});

export default function PurchaseInvoices() {
  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams();
  const { closeTab, activeTabId } = useTabs();
  
  const [view, setView] = useState<ViewMode>("list");
  const [invoices, setInvoices] = useState<InvoiceDto[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  
  const [headerState, setHeaderState] = useState<HeaderState>(defaultHeader());
  const { lines, setLines, updateLine, removeLine, addLine, selectMaterial, totals } = useDocumentEditor();
  const { formatMonetaryAmount, baseCurrency, getLatestRate } = useCurrencyContext();

  const isNew = location.pathname.includes("/new");

  const loadData = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      else setRefreshing(true);

      const [invData, suppData, currData] = await Promise.all([
        invoiceService.listInvoicesByType("Purchase"),
        supplierService.listSuppliers(),
        currencyService.listCurrencies(),
      ]);
      setInvoices(invData);
      setSuppliers(suppData);
      setCurrencies(currData);
    } catch (e) {
      toast.error("فشل تحميل البيانات: " + e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(true); }, [loadData]);

  useEffect(() => {
    if (isNew) {
      setHeaderState(defaultHeader());
      setLines([]);
      setView("editor");
    } else if (id) {
      invoiceService.getInvoiceById(id).then(inv => {
        setHeaderState({
          id: inv.id,
          invoice_number: inv.invoice_number,
          supplier_id: inv.supplier_id ?? "",
          supplier_name: inv.supplier_name ?? "مورد نقدي",
          issued_at: inv.issued_at.split("T")[0],
          notes: inv.notes ?? "",
          tax_amount: inv.tax_amount,
          discount_amount: inv.discount_amount,
          extra_costs: "0",
          payment_method: inv.payment_method?.toLowerCase() || "cash",
          status: inv.status,
          currency_code: inv.currency_code || "USD",
          exchange_rate: inv.exchange_rate || "1",
          paid_amount: inv.amount_paid || "0",
        });
        setLines((inv.lines ?? []).map(l => ({
          ...l,
          _id: `l_${Math.random()}`,
          line_total: parseFloat(l.quantity) * parseFloat(l.unit_price)
        })));
        setView("editor");
      }).catch(() => toast.error("فشل تحميل الفاتورة"));
    } else {
      setView("list");
    }
  }, [isNew, id, setLines]);

  const handleSave = async (isPosting = false) => {
    if (lines.length === 0 || !lines[0].material_id) {
      toast.error("يجب إضافة صنف واحد على الأقل");
      return;
    }
    setSaving(true);
    try {
      const paymentMethodMap: Record<string, string> = {
        "cash": "Cash",
        "credit": "Deferred",
        "partial": "Partial"
      };

      const finalTotal = totals.subtotal - parseFloat(headerState.discount_amount) + parseFloat(headerState.tax_amount) + parseFloat(headerState.extra_costs);

      const payload = {
        invoice_number: headerState.invoice_number,
        invoice_type: "Purchase",
        supplier_id: headerState.supplier_id || undefined,
        supplier_name: !headerState.supplier_id ? headerState.supplier_name : undefined,
        lines: toBackendLines(lines),
        tax_amount: headerState.tax_amount,
        discount_amount: headerState.discount_amount,
        payment_method: paymentMethodMap[headerState.payment_method] || "Cash",
        amount_paid: headerState.payment_method === "cash" ? finalTotal.toString() : (headerState.payment_method === "partial" ? headerState.paid_amount : "0"),
        issued_at: new Date(headerState.issued_at).toISOString(),
        currency_code: headerState.currency_code,
        exchange_rate: headerState.exchange_rate,
        notes: headerState.notes || undefined,
      };

      let result: InvoiceDto;
      if (headerState.id) {
        result = await invoiceService.updateInvoice({ ...payload, id: headerState.id });
      } else {
        result = await invoiceService.createInvoice(payload);
      }

      if (isPosting) {
        await invoiceService.postInvoice(result.id);
        toast.success("تم الحفظ والترحيل بنجاح");
      } else {
        toast.success("تم حفظ المسودة");
      }

      if (isNew) {
        navigate(`/erp/purchase/${result.id}`);
        closeTab(activeTabId);
      } else {
        setHeaderState(s => ({ ...s, status: isPosting ? "Posted" : s.status, id: result.id }));
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
    { key: "unit_price", header: "سعر الشراء", width: "w-[120px]", align: "left", type: "number" },
    { key: "line_total", header: "الإجمالي", width: "w-[130px]", align: "left", type: "readonly" },
  ];

  if (view === "editor") {
    return (
      <FinancialDocumentTemplate
        title="فاتورة مشتريات"
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
            extraCosts={parseFloat(headerState.extra_costs)}
            net={totals.subtotal - parseFloat(headerState.discount_amount) + parseFloat(headerState.tax_amount) + parseFloat(headerState.extra_costs)}
            currency={headerState.currency_code}
            status={headerState.status as any}
            invoiceType="Purchase"
          >
            <div className="space-y-4 pt-2">
              <InvoicePartySelector
                type="supplier"
                parties={suppliers}
                selectedId={headerState.supplier_id}
                selectedName={headerState.supplier_name}
                onSelect={(id, name) => setHeaderState(s => ({ ...s, supplier_id: id, supplier_name: name }))}
                onClear={() => setHeaderState(s => ({ ...s, supplier_id: "", supplier_name: "مورد نقدي" }))}
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
              
              <div className="pt-2 border-t border-slate-100">
                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">العملة وسعر الصرف</label>
                <select
                  value={headerState.currency_code}
                  onChange={e => setHeaderState(s => ({ ...s, currency_code: e.target.value }))}
                  className="w-full h-9 px-3 rounded-md border border-slate-200 bg-slate-50 font-bold text-xs"
                >
                  {currencies.map(c => (
                    <option key={c.code} value={c.code}>{c.name_ar} ({c.code})</option>
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
    <PurchaseInvoiceList
      invoices={invoices}
      loading={loading || refreshing}
      search={search}
      onSearchChange={setSearch}
      onRefresh={() => loadData(false)}
      onCreate={() => navigate("/erp/purchase/new")}
      onEdit={(inv) => navigate(`/erp/purchase/${inv.id}`)}
      onPost={(id) => invoiceService.postInvoice(id).then(() => loadData(false))}
      formatMonetaryAmount={formatMonetaryAmount}
    />
  );
}
