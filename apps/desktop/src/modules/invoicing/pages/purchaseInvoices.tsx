import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { useTabs } from '@app/providers/TabContext';
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Save, Send, Printer, ChevronRight, History, RefreshCw, Plus, Settings2 } from "lucide-react";
import { invoiceService } from '@modules/invoicing/api/invoiceService';
import { supplierService } from '@modules/partners/api/supplierService';
import { materialService } from '@modules/inventory/api/materialService';
import { currencyService, type Currency } from '@modules/core/api/currencyService';
import type { InvoiceDto, SupplierDto, MaterialDto } from "@erp/shared-types";
import { toast } from "sonner";
import { useCurrencyContext } from "@app/providers/CurrencyContext";

// Unified Components
import { FinancialDocumentTemplate } from "@widgets/templates/FinancialDocumentTemplate";
import { GenericDocumentGrid, type DocumentColumn } from "@widgets/document-shell/GenericDocumentGrid";
import { SummaryPanel } from "@widgets/document-shell/SummaryPanel";
import { InvoicePartySelector } from "../components/InvoicePartySelector";
import { DocumentStatusBadge } from "../components/DocumentStatusBadge";
import { PurchaseInvoiceList } from "../components/PurchaseInvoiceList";
import { useDocumentEditor } from "../hooks/useDocumentEditor";
import { toBackendLines, type GridLine } from "../lib/invoiceUtils";
import { type DocumentStatus } from "../components/DocumentStatusBadge";

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
  invoice_number: "...",
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
  const { openTab, closeTab, activeTabId } = useTabs();
  
  const [view, setView] = useState<ViewMode>("list");
  const [invoices, setInvoices] = useState<InvoiceDto[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [materials, setMaterials] = useState<MaterialDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  
  const [headerState, setHeaderState] = useState<HeaderState>(defaultHeader());
  const { lines, setLines, updateLine, removeLine, addLine, selectMaterial, totals } = useDocumentEditor({ 
    priceField: "last_purchase_price",
    materials 
  });
  const { formatMonetaryAmount, formatAmount, baseCurrency, getLatestRate, convertBetween } = useCurrencyContext();

  const isNew = location.pathname.includes("/new");

  const loadData = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      else setRefreshing(true);

      const [invData, suppData, currData, matData] = await Promise.all([
        invoiceService.listInvoicesByType(["Purchase", "OpeningBalance"]),
        supplierService.listSuppliers(),
        currencyService.listCurrencies(),
        materialService.listMaterials(),
      ]);
      setInvoices(invData);
      setSuppliers(suppData);
      setCurrencies(currData);
      setMaterials(matData);
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
      invoiceService.getNextInvoiceNumber("Purchase").then(num => {
        setHeaderState(s => ({ ...s, invoice_number: num }));
      });
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

  const isReadOnly = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    return searchParams.get("mode") === "view";
  }, [location.search]);

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
        navigate(`/purchase-invoices/${result.id}`);
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

  const handleReopen = async () => {
    if (!headerState.id) return;
    setSaving(true);
    try {
      await invoiceService.reopenInvoice(headerState.id);
      toast.success("تم إلغاء الترحيل بنجاح");
      const inv = await invoiceService.getInvoiceById(headerState.id);
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
      loadData();
    } catch (e) {
      toast.error("فشل إلغاء الترحيل: " + e);
    } finally {
      setSaving(false);
    }
  };

  const enrichedLines = useMemo(() => {
    return lines.map((line: GridLine) => {
      type EnrichedLine = GridLine & Record<string, string | number | undefined>;
      const enriched = { ...line } as EnrichedLine;
      const docPrice = parseFloat(line.unit_price || "0");
      const docTotal = line.line_total || 0;
      
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
      { key: "material_image", header: "", width: "w-[40px]", align: "center", type: "image" },
      { key: "material_code", header: "الكود", width: "w-[100px]", align: "center", type: "material_code" },
      { key: "unit_barcode", header: "الباركود", width: "w-[120px]", align: "center", type: "material_barcode" },
      { key: "material_name", header: "الصنف (عربي)", width: "flex-[2]", align: "right", type: "material" },
      { key: "name_en", header: "الصنف (EN)", width: "flex-[1.5]", align: "left", type: "readonly" },
      { key: "warehouse_qty", header: "المتوفر", width: "w-[70px]", align: "center", type: "readonly" },
      { key: "quantity", header: "الكمية", width: "w-[80px]", align: "center", type: "number" },
      { key: "unit_name", header: "الوحدة", width: "w-[70px]", align: "center", type: "unit_select" },
    ];

    currencies.forEach(curr => {
      const s = curr.symbol || curr.code;
      const isDocCurr = curr.code === headerState.currency_code;
      cols.push({ 
        key: isDocCurr ? "unit_price" : `unit_price_${curr.code}`, 
        header: `السعر (${s})`, 
        width: "w-[100px]", 
        align: "left", 
        type: isDocCurr ? "number" : "readonly" 
      });
    });

    cols.push({ key: "discount", header: "خصم %", width: "w-[70px]", align: "center", type: "number" });

    currencies.forEach(curr => {
      const s = curr.symbol || curr.code;
      cols.push({ 
        key: `line_total_${curr.code}`, 
        header: `الإجمالي (${s})`, 
        width: "w-[110px]", 
        align: "left", 
        type: "readonly" 
      });
    });

    // Metadata for purchase
    cols.push({ key: "cost_price", header: "التكلفة ($)", width: "w-[90px]", align: "left", type: "readonly" });

    cols.push({ key: "notes", header: "ملاحظات", width: "flex-[1]", align: "right", type: "text" });

    return cols;
  }, [currencies, headerState.currency_code]);

  if (view === "editor") {
    return (
      <FinancialDocumentTemplate
        title="فاتورة مشتريات"
        statusBadge={<DocumentStatusBadge status={headerState.status} />}
        toolbar={
          <>
            {isReadOnly && (
              <Button 
                size="sm" 
                onClick={() => {
                  const searchParams = new URLSearchParams(location.search);
                  searchParams.set("mode", "edit");
                  navigate({ search: searchParams.toString() });
                }}
                className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100"
              >
                <Settings2 className="w-4 h-4 ml-2" /> تعديل الفاتورة
              </Button>
            )}
            
            {headerState.status === "Posted" && (
              <Button variant="outline" size="sm" onClick={handleReopen} disabled={saving} className="bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100">
                <RefreshCw className="w-4 h-4 ml-2" /> {saving ? "جاري المعالجة..." : "إلغاء الترحيل"}
              </Button>
            )}

            {!isReadOnly && headerState.status === "Posted" && (
              <Button size="sm" onClick={() => handleSave(true)} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-100">
                <Save className="w-4 h-4 ml-2" /> {saving ? "جاري الحفظ..." : "حفظ وترحيل التعديلات"}
              </Button>
            )}

            {!isReadOnly && headerState.status !== "Posted" && (
              <>
                <Button variant="outline" size="sm" onClick={() => handleSave(false)} disabled={saving} className="bg-white border-slate-200 text-slate-700">
                  <Save className="w-4 h-4 ml-2" /> {saving ? "جاري الحفظ..." : "حفظ مسودة"}
                </Button>
                <Button size="sm" onClick={() => handleSave(true)} disabled={saving} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100">
                  <Send className="w-4 h-4 ml-2" /> ترحيل الفاتورة
                </Button>
              </>
            )}
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
              <Input type="date" readOnly={isReadOnly} value={headerState.issued_at} onChange={e => setHeaderState(s => ({ ...s, issued_at: e.target.value }))} className="h-10 font-bold border-slate-200" />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase">ملاحظات المستند</label>
              <Input placeholder="أدخل أي ملاحظات إضافية هنا..." readOnly={isReadOnly} value={headerState.notes} onChange={e => setHeaderState(s => ({ ...s, notes: e.target.value }))} className="h-10 border-slate-200" />
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
            preferenceKey="purchase_invoice_grid"
          />
        }
        summaryPanel={
          <SummaryPanel
            subtotal={totals.subtotal}
            discount={parseFloat(headerState.discount_amount)}
            tax={parseFloat(headerState.tax_amount)}
            extraCosts={parseFloat(headerState.extra_costs)}
            net={totals.subtotal - parseFloat(headerState.discount_amount) + parseFloat(headerState.tax_amount) + parseFloat(headerState.extra_costs)}
            paid={
              headerState.payment_method === "cash" 
                ? (totals.subtotal - parseFloat(headerState.discount_amount) + parseFloat(headerState.tax_amount) + parseFloat(headerState.extra_costs)) 
                : headerState.payment_method === "partial" 
                  ? parseFloat(headerState.paid_amount || "0")
                  : 0
            }
            currency={headerState.currency_code}
            status={headerState.status as DocumentStatus}
            invoiceType="Purchase"
          >
            <div className="space-y-4 pt-2">
              <InvoicePartySelector
                type="supplier"
                parties={suppliers}
                readOnly={isReadOnly}
                selectedId={headerState.supplier_id}
                selectedName={headerState.supplier_name}
                onSelect={(id, name) => setHeaderState(s => ({ ...s, supplier_id: id, supplier_name: name }))}
                onClear={() => setHeaderState(s => ({ ...s, supplier_id: "", supplier_name: "مورد نقدي" }))}
                predictedBalance={
                  headerState.payment_method === "cash"
                    ? 0
                    : (totals.subtotal - parseFloat(headerState.discount_amount) + parseFloat(headerState.tax_amount) + parseFloat(headerState.extra_costs)) - (parseFloat(headerState.paid_amount) || 0)
                }
              />
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase">طريقة الدفع</label>
                <select 
                  value={headerState.payment_method} 
                  onChange={e => {
                    if (isReadOnly) return;
                    const method = e.target.value;
                    const net = totals.subtotal - parseFloat(headerState.discount_amount) + parseFloat(headerState.tax_amount) + parseFloat(headerState.extra_costs);
                    setHeaderState(s => ({ 
                      ...s, 
                      payment_method: method,
                      paid_amount: method === "cash" ? net.toString() : (method === "credit" ? "0" : s.paid_amount)
                    }));
                  }}
                  disabled={isReadOnly}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-70 disabled:bg-slate-50"
                >
                  <option value="cash">نقداً (دفع كامل)</option>
                  <option value="credit">آجل (ذمم على الشركة)</option>
                  <option value="partial">دفع جزئي (مقدم + ذمم)</option>
                </select>
              </div>

              {headerState.payment_method === "partial" && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <label className="text-[10px] font-black text-blue-500 uppercase flex items-center gap-2">
                    المبلغ المدفوع الآن للمورد (نقداً)
                    <div className="w-1 h-1 rounded-full bg-blue-500" />
                  </label>
                  <Input 
                    type="number" 
                    readOnly={isReadOnly}
                    value={headerState.paid_amount} 
                    onChange={e => setHeaderState(s => ({ ...s, paid_amount: e.target.value }))}
                    className="h-10 font-black text-lg border-blue-200 focus:ring-blue-500 bg-blue-50/30"
                    placeholder="0.00"
                  />
                  <div className="text-[10px] text-slate-400 font-bold px-1">
                    المتبقي ذمة للمورد: {formatAmount((totals.subtotal - parseFloat(headerState.discount_amount) + parseFloat(headerState.tax_amount) + parseFloat(headerState.extra_costs)) - (parseFloat(headerState.paid_amount) || 0))}
                  </div>
                </div>
              )}
              
              <div className="pt-2 border-t border-slate-100">
                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">العملة وسعر الصرف</label>
                <select
                  value={headerState.currency_code}
                  disabled={isReadOnly}
                  onChange={e => setHeaderState(s => ({ ...s, currency_code: e.target.value }))}
                  className="w-full h-9 px-3 rounded-md border border-slate-200 bg-slate-50 font-bold text-xs disabled:opacity-70"
                >
                  {currencies.map(c => (
                    <option key={c.code} value={c.code}>{c.name_ar} ({c.symbol || c.code})</option>
                  ))}
                </select>
                {headerState.currency_code !== baseCurrency?.code && (
                  <Input
                    type="number"
                    readOnly={isReadOnly}
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

  const searchParams = new URLSearchParams(location.search);
  const supplierIdFilter = searchParams.get("supplierId") || undefined;

  return (
    <PurchaseInvoiceList
      invoices={invoices}
      loading={loading || refreshing}
      search={search}
      supplierIdFilter={supplierIdFilter}
      onSearchChange={setSearch}
      onRefresh={() => loadData(false)}
      onCreate={() => {
        const uniqueId = `/purchase-invoices/new-${Date.now()}`;
        openTab({ 
          id: uniqueId, 
          title: "فاتورة مشتريات جديدة", 
          path: uniqueId,
          closable: true
        });
      }}
      onEdit={(inv) => {
        openTab({ 
          id: `/purchase-invoices/${inv.id}`, 
          title: `تعديل فاتورة ${inv.invoice_number}`, 
          path: `/purchase-invoices/${inv.id}?mode=edit`,
          closable: true
        });
      }}
      onView={(inv) => {
        openTab({ 
          id: `/purchase-invoices/${inv.id}-view`, 
          title: `عرض فاتورة ${inv.invoice_number}`, 
          path: `/purchase-invoices/${inv.id}?mode=view`,
          closable: true
        });
      }}
      onPost={async (id) => {
        await invoiceService.postInvoice(id);
        loadData(false);
      }}
      onDelete={async (id) => {
        try {
          await invoiceService.deleteInvoice(id);
          toast.success("تم حذف الفاتورة والقيود المرتبطة بها");
          loadData(false);
        } catch (e) {
          toast.error("فشل الحذف: " + e);
        }
      }}
      onReopen={async (id) => {
        try {
          await invoiceService.reopenInvoice(id);
          toast.success("تم إلغاء الترحيل وإعادة الفاتورة لمسودة");
          loadData(false);
        } catch (e) {
          toast.error("فشل العملية: " + e);
        }
      }}
      formatMonetaryAmount={formatMonetaryAmount}
    />
  );
}
