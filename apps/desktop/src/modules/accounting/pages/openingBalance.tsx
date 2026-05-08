import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { useTabs } from '@app/providers/TabContext';
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Save, RefreshCw, History, Plus, ChevronRight, Calculator, User, Truck, Landmark, Package } from "lucide-react";
import { invoiceService } from '@modules/invoicing/api/invoiceService';
import { customerService } from '@modules/partners/api/customerService';
import { supplierService } from '@modules/partners/api/supplierService';
import { accountingService } from '@modules/accounting/api/accountingService';
import { materialService } from '@modules/inventory/api/materialService';
import type { InvoiceDto, CustomerDto, SupplierDto, AccountDto, MaterialDto } from "@erp/shared-types";
import { toast } from "sonner";
import { useCurrencyContext } from "@app/providers/CurrencyContext";

// Unified Components
import { FinancialDocumentTemplate } from "@widgets/templates/FinancialDocumentTemplate";
import { GenericDocumentGrid, type DocumentColumn } from "@widgets/document-shell/GenericDocumentGrid";
import { SummaryPanel } from "@widgets/document-shell/SummaryPanel";
import { InvoicePartySelector } from "@modules/invoicing/components/InvoicePartySelector";
import { DocumentStatusBadge } from "@modules/invoicing/components/DocumentStatusBadge";
import { useDocumentEditor } from "@modules/invoicing/hooks/useDocumentEditor";
import { generateDocNumber, toBackendLines, type GridLine } from "@modules/invoicing/lib/invoiceUtils";

type BalanceType = "Inventory" | "Customer" | "Supplier" | "Account" | "Cash";

const BALANCE_TYPE_OPTIONS = [
  { value: "Inventory", label: "مخزون", icon: Package, color: "text-blue-600", bg: "bg-blue-50" },
  { value: "Customer", label: "عملاء", icon: User, color: "text-emerald-600", bg: "bg-emerald-50" },
  { value: "Supplier", label: "موردين", icon: Truck, color: "text-orange-600", bg: "bg-orange-50" },
  { value: "Account", label: "حسابات", icon: Calculator, color: "text-purple-600", bg: "bg-purple-50" },
  { value: "Cash", label: "نقدية", icon: Landmark, color: "text-rose-600", bg: "bg-rose-50" },
] as const;

interface HeaderState {
  balanceType: BalanceType;
  docNumber: string;
  issued_at: string;
  notes: string;
  partyId: string;
  partyName: string;
  debitCredit: "debit" | "credit";
  amount: string;
  accountId: string;
  currencyCode: string;
  exchangeRate: string;
}

const defaultHeader = (): HeaderState => ({
  balanceType: "Inventory",
  docNumber: generateDocNumber("OPN"),
  issued_at: new Date().toISOString().split("T")[0],
  notes: "",
  partyId: "",
  partyName: "رصيد افتتاحي",
  debitCredit: "debit",
  amount: "0",
  accountId: "",
  currencyCode: "USD",
  exchangeRate: "1",
});

export default function OpeningBalance() {
  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams();
  const { closeTab, activeTabId } = useTabs();
  
  const [header, setHeader] = useState<HeaderState>(defaultHeader());
  const { lines, setLines, updateLine, removeLine, addLine, selectMaterial, totals } = useDocumentEditor({ priceField: "last_purchase_price" });
  
  const [history, setHistory] = useState<InvoiceDto[]>([]);
  const [customers, setCustomers] = useState<CustomerDto[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
  const [accounts, setAccounts] = useState<AccountDto[]>([]);
  const [materials, setMaterials] = useState<MaterialDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const { formatAmount, formatMonetaryAmount, convertFromBase, convertBetween, currencies, baseCurrency } = useCurrencyContext();

  const isNew = location.pathname.includes("/new");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [hist, custs, supps, accs, mats] = await Promise.all([
        invoiceService.listInvoicesByType("OpeningBalance"),
        customerService.listCustomers(),
        supplierService.listSuppliers(),
        accountingService.getChartOfAccounts(),
        materialService.listMaterials(),
      ]);
      setHistory(hist);
      setCustomers(custs);
      setSuppliers(supps);
      setAccounts(accs);
      setMaterials(mats);
    } catch (e: unknown) {
      toast.error("فشل تحميل البيانات: " + e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async () => {
    if (header.balanceType === "Inventory" && lines.length === 0) {
      toast.error("أضف صنفاً واحداً على الأقل");
      return;
    }
    
    setSaving(true);
    try {
      const payload = {
        invoice_number: header.docNumber,
        invoice_type: "OpeningBalance",
        lines: header.balanceType === "Inventory" 
          ? toBackendLines(lines)
          : [{ material_id: "opening-balance", quantity: "1", unit_price: header.amount }],
        tax_amount: "0",
        discount_amount: "0",
        payment_method: "Deferred",
        amount_paid: "0",
        issued_at: new Date(header.issued_at).toISOString(),
        currency_code: header.currencyCode,
        exchange_rate: header.exchangeRate,
        notes: header.notes || undefined,
        customer_id: header.balanceType === "Customer" ? header.partyId || undefined : undefined,
        customer_name: header.balanceType === "Customer" && !header.partyId ? header.partyName : undefined,
        supplier_id: header.balanceType === "Supplier" ? header.partyId || undefined : undefined,
        supplier_name: header.balanceType === "Supplier" && !header.partyId ? header.partyName : undefined,
      };

      const result = await invoiceService.createInvoice(payload);
      await invoiceService.postInvoice(result.id);
      toast.success("تم ترحيل الرصيد الافتتاحي بنجاح");
      
      if (isNew) {
        closeTab(activeTabId);
      } else {
        setHeader(defaultHeader());
        setLines([]);
        loadData();
      }
    } catch (e: unknown) {
      toast.error("فشل الحفظ: " + e);
    } finally {
      setSaving(false);
    }
  };

  const enrichedLines = useMemo(() => {
    return lines.map((line: GridLine) => {
      const enriched: GridLine & Record<string, string> = { ...line } as any;
      const docPrice = parseFloat(line.unit_price || "0");
      const docTotal = (parseFloat(line.quantity || "0") * docPrice);
      
      currencies.forEach(curr => {
        const price = convertFromBase(docPrice, curr.code);
        const total = convertFromBase(docTotal, curr.code);
        enriched[`unit_price_${curr.code}`] = price.toFixed(2);
        enriched[`line_total_${curr.code}`] = formatAmount(total, { currencyCode: curr.code, hideSymbol: true });
      });
      return enriched;
    });
  }, [lines, currencies, convertFromBase, formatAmount]);

  const gridColumns = useMemo<DocumentColumn[]>(() => {
    const cols: DocumentColumn[] = [
      { key: "material_name", header: "المادة / الصنف", width: "flex-[3]", align: "right", type: "material" },
      { key: "quantity", header: "الكمية", width: "w-[90px]", align: "center", type: "number" },
    ];

    currencies.forEach(curr => {
      const s = curr.symbol || curr.code;
      cols.push({ 
        key: curr.is_base ? "unit_price" : `unit_price_${curr.code}`, 
        header: `التكلفة (${s})`, 
        width: "w-[110px]", 
        align: "left", 
        type: curr.is_base ? "number" : "readonly" 
      });
    });

    cols.push({ key: "retail_price", header: "مفرق", width: "w-[100px]", align: "left", type: "number" });
    cols.push({ key: "wholesale_price", header: "جملة", width: "w-[100px]", align: "left", type: "number" });
    cols.push({ key: "minimum_stock", header: "حد الطلب", width: "w-[80px]", align: "center", type: "number" });

    currencies.forEach(curr => {
      const s = curr.symbol || curr.code;
      cols.push({ 
        key: `line_total_${curr.code}`, 
        header: `القيمة (${s})`, 
        width: "w-[120px]", 
        align: "left", 
        type: "readonly" 
      });
    });

    return cols;
  }, [currencies]);

  return (
    <FinancialDocumentTemplate
      title="الأرصدة الافتتاحية"
      statusBadge={<DocumentStatusBadge status="Draft" />}
      toolbar={
        <>
          <Button variant="outline" size="sm" onClick={() => navigate("/erp/accounting")} className="bg-white">
            <ChevronRight className="w-4 h-4 ml-2" /> العودة للمحاسبة
          </Button>
          <div className="h-6 w-px bg-slate-200 mx-2" />
          <Button size="sm" onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100">
            <Save className="w-4 h-4 ml-2" /> {saving ? "جاري الحفظ..." : "حفظ وترحيل الرصيد"}
          </Button>
        </>
      }
      headerFields={
        <>
          <div className="md:col-span-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex flex-wrap gap-3">
             {BALANCE_TYPE_OPTIONS.map(opt => {
               const Icon = opt.icon;
               const active = header.balanceType === opt.value;
               return (
                 <button
                    key={opt.value}
                    onClick={() => setHeader(s => ({ ...s, balanceType: opt.value }))}
                    className={`flex items-center gap-3 px-4 py-2 rounded-lg font-bold text-sm transition-all border-2 ${
                      active ? `border-blue-500 ${opt.bg} ${opt.color} shadow-sm` : "border-transparent bg-white text-slate-500 hover:border-slate-200"
                    }`}
                 >
                   <Icon className="w-4 h-4" />
                   {opt.label}
                 </button>
               );
             })}
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase">رقم القيد</label>
            <Input value={header.docNumber} readOnly className="h-10 font-mono font-bold bg-slate-50 border-slate-200" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase">التاريخ</label>
            <Input type="date" value={header.issued_at} onChange={e => setHeader(s => ({ ...s, issued_at: e.target.value }))} className="h-10 font-bold border-slate-200" />
          </div>
          <div className="md:col-span-2 space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase">ملاحظات</label>
            <Input placeholder="أدخل أي ملاحظات هنا..." value={header.notes} onChange={e => setHeader(s => ({ ...s, notes: e.target.value }))} className="h-10 border-slate-200" />
          </div>
        </>
      }
      lineItemsGrid={
        header.balanceType === "Inventory" ? (
          <GenericDocumentGrid
            columns={gridColumns}
            lines={enrichedLines}
            onUpdateLine={updateLine}
            onRemoveLine={removeLine}
            onAddLine={addLine}
            onSelectMaterial={selectMaterial}
            materials={Object.values(materials)}
            preferenceKey="opening_balance_grid"
          />
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/70 p-8 flex flex-col items-center justify-center space-y-6">
             <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
                <Calculator className="w-8 h-8 text-blue-600" />
             </div>
             <div className="text-center space-y-2">
                <h3 className="text-lg font-black text-slate-800">إدخال رصيد مالي مباشر</h3>
                <p className="text-sm text-slate-500 max-w-xs">يرجى تحديد المبلغ والجهة في لوحة الملخص الجانبية</p>
             </div>
             <div className="w-full max-w-sm space-y-4">
                {(header.balanceType === "Customer" || header.balanceType === "Supplier") && (
                   <InvoicePartySelector
                    type={header.balanceType === "Customer" ? "customer" : "supplier"}
                    parties={header.balanceType === "Customer" ? customers : suppliers}
                    selectedId={header.partyId}
                    selectedName={header.partyName}
                    onSelect={(id, name) => setHeader(s => ({ ...s, partyId: id, partyName: name }))}
                    onClear={() => setHeader(s => ({ ...s, partyId: "", partyName: "رصيد افتتاحي" }))}
                  />
                )}
                {header.balanceType === "Account" && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase">الحساب المحاسبي</label>
                    <select
                      value={header.accountId}
                      onChange={e => setHeader(s => ({ ...s, accountId: e.target.value }))}
                      className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white font-bold text-sm"
                    >
                      <option value="">— اختر الحساب —</option>
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>{a.code} — {a.name_ar}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase">المبلغ الصافي</label>
                   <Input 
                      type="number" 
                      value={header.amount} 
                      onChange={e => setHeader(s => ({ ...s, amount: e.target.value }))}
                      className="h-12 text-2xl font-black text-left tabular-nums border-2 border-slate-200 focus:border-blue-500"
                    />
                </div>
             </div>
          </div>
        )
      }
      summaryPanel={
        <SummaryPanel
          subtotal={header.balanceType === "Inventory" ? totals.subtotal : parseFloat(header.amount)}
          discount={0}
          tax={0}
          extraCosts={0}
          net={header.balanceType === "Inventory" ? totals.subtotal : parseFloat(header.amount)}
          currency={header.currencyCode}
          status="Draft"
          invoiceType="OpeningBalance"
        >
          <div className="pt-2 border-t border-slate-100 space-y-4">
             <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase">العملة وسعر الصرف</label>
                <select
                  value={header.currencyCode}
                  onChange={e => setHeader(s => ({ ...s, currencyCode: e.target.value }))}
                  className="w-full h-9 px-3 rounded-md border border-slate-200 bg-slate-50 font-bold text-xs"
                >
                  {currencies.map(c => (
                    <option key={c.code} value={c.code}>{c.name_ar} ({c.code})</option>
                  ))}
                </select>
                {header.currencyCode !== baseCurrency?.code && (
                  <Input
                    type="number"
                    value={header.exchangeRate}
                    onChange={e => setHeader(s => ({ ...s, exchangeRate: e.target.value }))}
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

