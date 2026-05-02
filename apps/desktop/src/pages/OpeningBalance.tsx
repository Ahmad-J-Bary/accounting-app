import { useState, useEffect, useCallback } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useTabs } from "@/context/TabContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Save, RefreshCw, History, CheckCircle2, Clock, ChevronDown } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { invoiceService } from "@/services/invoiceService";
import { customerService } from "@/services/customerService";
import { supplierService } from "@/services/supplierService";
import { accountingService } from "@/services/accountingService";
import type { InvoiceDto, CustomerDto, SupplierDto, AccountDto } from "@erp/shared-types";
import { toast } from "sonner";

// Document components
import { InvoiceGrid } from "@/components/erp/document/InvoiceGrid";
import { GridLine, toBackendLines, generateDocNumber } from "@/components/erp/document/invoiceUtils";
import { SummaryPanel } from "@/components/erp/document/SummaryPanel";
import { InvoicePartySelector } from "@/components/erp/document/InvoicePartySelector";
import { DocumentToolbar } from "@/components/erp/document/DocumentToolbar";
import { DocumentStatusBadge } from "@/components/erp/document/DocumentStatusBadge";

type BalanceType = "Inventory" | "Customer" | "Supplier" | "Account" | "Cash";

const BALANCE_TYPE_OPTIONS: { value: BalanceType; label: string; icon: string; description: string }[] = [
  { value: "Inventory", label: "مخزون", icon: "📦", description: "رصيد افتتاحي للمواد والأصناف" },
  { value: "Customer", label: "عميل", icon: "👤", description: "رصيد مديونية عميل" },
  { value: "Supplier", label: "مورد", icon: "🚚", description: "رصيد مستحقات مورد" },
  { value: "Account", label: "حساب", icon: "📊", description: "رصيد حساب محاسبي" },
  { value: "Cash", label: "صندوق / بنك", icon: "💰", description: "رصيد صندوق أو حساب بنكي" },
];

interface OpeningBalanceState {
  balanceType: BalanceType;
  docNumber: string;
  date: string;
  notes: string;
  // Inventory
  lines: GridLine[];
  // Customer / Supplier
  partyId: string;
  partyName: string;
  debitCredit: "debit" | "credit";
  amount: string;
  reason: string;
  prevDocRef: string;
  // Account / Cash
  accountId: string;
  accountDebitCredit: "debit" | "credit";
  accountAmount: string;
}

function defaultState(): OpeningBalanceState {
  return {
    balanceType: "Inventory",
    docNumber: generateDocNumber("OPN"),
    date: new Date().toISOString().split("T")[0],
    notes: "",
    lines: [],
    partyId: "",
    partyName: "",
    debitCredit: "debit",
    amount: "0",
    reason: "",
    prevDocRef: "",
    accountId: "",
    accountDebitCredit: "debit",
    accountAmount: "0",
  };
}

export default function OpeningBalance() {
  const location = useLocation();
  const { id } = useParams();
  const { openTab, closeTab, activeTabId } = useTabs();
  
  const [state, setState] = useState<OpeningBalanceState>(defaultState());
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<InvoiceDto[]>([]);
  const [customers, setCustomers] = useState<CustomerDto[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
  const [accounts, setAccounts] = useState<AccountDto[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const isNew = location.pathname.includes("/new");

  const loadSupporting = useCallback(async () => {
    setLoadingData(true);
    try {
      const [hist, custs, supps, accs] = await Promise.all([
        invoiceService.listInvoicesByType("OpeningBalance"),
        customerService.listCustomers(),
        supplierService.listSuppliers(),
        accountingService.getChartOfAccounts(),
      ]);
      setHistory(hist);
      setCustomers(custs);
      setSuppliers(supps);
      setAccounts(accs);
    } catch {
      toast.error("فشل تحميل البيانات");
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => { loadSupporting(); }, [loadSupporting]);

  useEffect(() => {
    if (isNew) {
      setState(defaultState());
    } else if (id) {
       // Logic to load specific opening balance if needed
    }
  }, [isNew, id]);
  
  const handleLoadInvoice = (inv: InvoiceDto) => {
    const isSupplier = !!inv.supplier_id;
    const isCustomer = !!inv.customer_id;
    
    setState({
      balanceType: isSupplier ? "Supplier" : isCustomer ? "Customer" : "Inventory",
      docNumber: inv.invoice_number,
      date: inv.issued_at.split("T")[0],
      notes: inv.notes ?? "",
      lines: (inv.lines ?? []).map(l => ({
        ...l,
        _id: `line_${Math.random()}`,
        line_total: parseFloat(l.quantity) * parseFloat(l.unit_price),
      })),
      partyId: inv.customer_id || inv.supplier_id || "",
      partyName: inv.customer_name || inv.supplier_name || "",
      debitCredit: "debit",
      amount: inv.total_amount,
      reason: inv.notes || "",
      prevDocRef: "",
      accountId: "",
      accountDebitCredit: "debit",
      accountAmount: inv.total_amount,
    });
    toast.info(`تم تحميل الفاتورة ${inv.invoice_number}`);
  };

  const subtotal = state.lines.reduce((s, l) => s + (l.line_total ?? 0), 0);

  const handleCreate = () => {
    const uniqueId = `/opening-balance/new-${Date.now()}`;
    openTab({
      id: uniqueId,
      title: "فاتورة أول مدة جديدة",
      path: uniqueId,
      closable: true
    });
  };

  const handleSave = async () => {
    if (state.balanceType === "Inventory" && state.lines.length === 0) {
      toast.error("أضف صنفاً واحداً على الأقل");
      return;
    }
    if (
      (state.balanceType === "Customer" || state.balanceType === "Supplier") &&
      !state.partyId && !state.partyName
    ) {
      toast.error("يجب تحديد العميل أو المورد");
      return;
    }

    setSaving(true);
    try {
      if (state.balanceType === "Inventory") {
        const backendLines = toBackendLines(state.lines);
        if (backendLines.length === 0) {
          toast.error("أضف صنفاً واحداً على الأقل");
          setSaving(false);
          return;
        }
        const created = await invoiceService.createInvoice({
          invoice_number: state.docNumber,
          invoice_type: "OpeningBalance",
          lines: backendLines,
          tax_amount: "0",
          discount_amount: "0",
          issued_at: new Date(state.date).toISOString(),
          notes: state.notes || undefined,
        });
        await invoiceService.postInvoice(created.id);
        toast.success("تم تسجيل رصيد المخزون الافتتاحي وترحيله");
      } else {
        await invoiceService.createInvoice({
          invoice_number: state.docNumber,
          invoice_type: "OpeningBalance",
          lines: [{
            material_id: "opening-balance",
            quantity: "1",
            unit_price: state.balanceType === "Account" || state.balanceType === "Cash" ? state.accountAmount : state.amount,
            notes: `فاتورة أول المدة - ${BALANCE_TYPE_OPTIONS.find(o => o.value === state.balanceType)?.label}`,
          }],
          tax_amount: "0",
          discount_amount: "0",
          issued_at: new Date(state.date).toISOString(),
          notes: state.notes || undefined,
          customer_id: state.balanceType === "Customer" ? state.partyId || undefined : undefined,
          supplier_id: state.balanceType === "Supplier" ? state.partyId || undefined : undefined,
        });
        toast.success("تم تسجيل الرصيد الافتتاحي بنجاح");
      }

      if (isNew) {
        closeTab(activeTabId);
      } else {
        setState(s => ({ ...defaultState(), balanceType: s.balanceType }));
        loadSupporting();
      }
    } catch (e) {
      toast.error("فشل الحفظ: " + e);
    } finally {
      setSaving(false);
    }
  };

  const currentDate = state.date;

  return (
    <div className="flex flex-col min-h-screen bg-slate-100" dir="rtl">
      {/* Title Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200 shadow-sm">
        <div>
          <h1 className="text-base font-black text-slate-800">فاتورة أول المدة</h1>
          <p className="text-xs text-slate-500">تأسيس الأرصدة الافتتاحية للنظام</p>
        </div>
        <DocumentStatusBadge status="Draft" size="md" />
      </div>

      {/* Toolbar */}
      <DocumentToolbar
        docNumber={state.docNumber}
        docDate={currentDate}
        status="Draft"
        onNew={handleCreate}
        onSave={handleSave}
        onRefresh={loadSupporting}
        saving={saving}
        canEdit
      />

      {/* Content */}
      <div className="flex-1 flex gap-0 overflow-hidden">
        {/* Main */}
        <div className="flex-1 p-4 space-y-3 overflow-y-auto">

          {/* Type Selector */}
          <Card className="p-4 border-slate-200 shadow-sm">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">نوع الرصيد الافتتاحي</div>
            <div className="flex flex-wrap gap-2">
              {BALANCE_TYPE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setState(s => ({ ...defaultState(), balanceType: opt.value, docNumber: s.docNumber, date: s.date }))}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 text-sm font-bold transition-all ${
                    state.balanceType === opt.value
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <span className="text-lg">{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>
            {state.balanceType && (
              <p className="mt-2 text-xs text-slate-500">
                {BALANCE_TYPE_OPTIONS.find(o => o.value === state.balanceType)?.description}
              </p>
            )}
          </Card>

          {/* Common header fields */}
          <Card className="p-4 border-slate-200 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">رقم المستند</label>
                <Input
                  value={state.docNumber}
                  onChange={e => setState(s => ({ ...s, docNumber: e.target.value }))}
                  className="h-9 text-sm text-right font-mono"
                  dir="rtl"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">التاريخ</label>
                <Input
                  type="date"
                  value={state.date}
                  onChange={e => setState(s => ({ ...s, date: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">الملاحظات</label>
                <Input
                  value={state.notes}
                  onChange={e => setState(s => ({ ...s, notes: e.target.value }))}
                  placeholder="مثال: أرصدة بداية العام 2025"
                  className="h-9 text-sm text-right"
                  dir="rtl"
                />
              </div>
            </div>
          </Card>

          {/* Context-sensitive fields */}
          {state.balanceType === "Inventory" && (
            <Card className="p-0 overflow-hidden border-slate-200 shadow-sm">
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
                <span className="text-xs font-bold text-slate-600">📦 أصناف المخزون الافتتاحي</span>
              </div>
              <InvoiceGrid
                type="OpeningBalance"
                lines={state.lines}
                onChange={lines => setState(s => ({ ...s, lines }))}
              />
            </Card>
          )}

          {(state.balanceType === "Customer" || state.balanceType === "Supplier") && (
            <Card className="p-4 border-slate-200 shadow-sm">
              <div className="text-xs font-bold text-slate-600 mb-4">
                {state.balanceType === "Customer" ? "👤 رصيد العميل الافتتاحي" : "🚚 رصيد المورد الافتتاحي"}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <InvoicePartySelector
                  type={state.balanceType === "Customer" ? "customer" : "supplier"}
                  parties={state.balanceType === "Customer" ? customers : suppliers}
                  selectedId={state.partyId}
                  selectedName={state.partyName}
                  onSelect={(id, name) => setState(s => ({ ...s, partyId: id, partyName: name }))}
                  onClear={() => setState(s => ({ ...s, partyId: "", partyName: "" }))}
                />

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">نوع الرصيد</label>
                  <select
                    value={state.debitCredit}
                    onChange={e => setState(s => ({ ...s, debitCredit: e.target.value as "debit" | "credit" }))}
                    className="w-full h-9 text-sm border border-slate-200 rounded-md px-3 bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none"
                    dir="rtl"
                  >
                    <option value="debit">مدين (له علينا)</option>
                    <option value="credit">دائن (لنا عليه)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">المبلغ</label>
                  <Input
                    type="number" min="0" step="0.01"
                    value={state.amount}
                    onChange={e => setState(s => ({ ...s, amount: e.target.value }))}
                    className="h-9 text-sm text-left tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">سبب الرصيد</label>
                  <Input
                    value={state.reason}
                    onChange={e => setState(s => ({ ...s, reason: e.target.value }))}
                    placeholder="مثال: مديونية مرحّلة من العام السابق"
                    className="h-9 text-sm text-right"
                    dir="rtl"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">رقم مستند سابق</label>
                  <Input
                    value={state.prevDocRef}
                    onChange={e => setState(s => ({ ...s, prevDocRef: e.target.value }))}
                    placeholder="INV-2024-XXXX"
                    className="h-9 text-sm font-mono text-right"
                    dir="rtl"
                  />
                </div>

                {/* Mini summary */}
                <div className={`flex items-center justify-center rounded-lg border-2 p-3 ${
                  state.debitCredit === "debit"
                    ? "border-orange-200 bg-orange-50"
                    : "border-green-200 bg-green-50"
                }`}>
                  <div className="text-center">
                    <div className="text-xs font-bold text-slate-500 mb-1">الرصيد المسجّل</div>
                    <div className={`text-xl font-black tabular-nums ${
                      state.debitCredit === "debit" ? "text-orange-700" : "text-green-700"
                    }`}>
                      {formatCurrency(parseFloat(state.amount) || 0)}
                    </div>
                    <div className="text-[10px] font-bold mt-1 text-slate-500">
                      {state.debitCredit === "debit" ? "مدين ← له علينا" : "دائن ← لنا عليه"}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {(state.balanceType === "Account" || state.balanceType === "Cash") && (
            <Card className="p-4 border-slate-200 shadow-sm">
              <div className="text-xs font-bold text-slate-600 mb-4">
                {state.balanceType === "Cash" ? "💰 رصيد صندوق / بنك" : "📊 رصيد حساب محاسبي"}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    {state.balanceType === "Cash" ? "الصندوق / البنك" : "الحساب"}
                  </label>
                  <select
                    value={state.accountId}
                    onChange={e => setState(s => ({ ...s, accountId: e.target.value }))}
                    className="w-full h-9 text-sm border border-slate-200 rounded-md px-3 bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none"
                    dir="rtl"
                  >
                    <option value="">— اختر الحساب —</option>
                    {accounts
                      .filter(a => state.balanceType === "Cash"
                        ? a.account_type === "Asset"
                        : true
                      )
                      .map(a => (
                        <option key={a.id} value={a.id}>{a.code} — {a.name_ar}</option>
                      ))
                    }
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">طبيعة الرصيد</label>
                  <select
                    value={state.accountDebitCredit}
                    onChange={e => setState(s => ({ ...s, accountDebitCredit: e.target.value as "debit" | "credit" }))}
                    className="w-full h-9 text-sm border border-slate-200 rounded-md px-3 bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none"
                    dir="rtl"
                  >
                    <option value="debit">مدين</option>
                    <option value="credit">دائن</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">المبلغ</label>
                  <Input
                    type="number" min="0" step="0.01"
                    value={state.accountAmount}
                    onChange={e => setState(s => ({ ...s, accountAmount: e.target.value }))}
                    className="h-9 text-sm text-left tabular-nums"
                  />
                </div>
              </div>

              {/* Account summary */}
              <div className={`mt-4 flex items-center justify-center rounded-xl border-2 p-4 ${
                state.accountDebitCredit === "debit" ? "border-blue-200 bg-blue-50" : "border-purple-200 bg-purple-50"
              }`}>
                <div className="text-center">
                  <div className="text-xs font-bold text-slate-500 mb-1">الرصيد الافتتاحي</div>
                  <div className={`text-2xl font-black tabular-nums ${
                    state.accountDebitCredit === "debit" ? "text-blue-700" : "text-purple-700"
                  }`}>
                    {formatCurrency(parseFloat(state.accountAmount) || 0)}
                  </div>
                  <div className="text-[10px] font-bold mt-1 text-slate-500">
                    {state.accountDebitCredit === "debit" ? "رصيد مدين" : "رصيد دائن"}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Save Button */}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setState(defaultState())}>إلغاء / تفريغ</Button>
            <Button onClick={handleSave} disabled={saving} className="px-8">
              <Save className="w-4 h-4 ml-2" />
              {saving ? "جاري الحفظ..." : "حفظ وترحيل الرصيد الافتتاحي"}
            </Button>
          </div>
        </div>

        {/* History Sidebar */}
        <div className="w-72 flex-shrink-0 border-r border-slate-200 bg-white overflow-y-auto p-3 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-700 pb-2 border-b border-slate-100">
            <History className="w-4 h-4 text-slate-400" />
            السجلات السابقة
            <Button variant="ghost" size="icon" className="h-6 w-6 mr-auto" onClick={loadSupporting} disabled={loadingData}>
              <RefreshCw className={`w-3 h-3 ${loadingData ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {history.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-xs">لا توجد سجلات سابقة</div>
          ) : (
            history.map(inv => (
              <div 
                key={inv.id} 
                className="p-3 border border-slate-100 rounded-lg hover:border-blue-200 hover:bg-blue-50/30 cursor-pointer transition-all group"
                onClick={() => handleLoadInvoice(inv)}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-800 font-mono group-hover:text-blue-700">{inv.invoice_number}</span>
                  <DocumentStatusBadge status={inv.status} />
                </div>
                <div className="flex justify-between items-center text-xs text-slate-500 mb-2">
                  <span>{formatDate(inv.issued_at)}</span>
                  <span>{inv.lines.length} صنف</span>
                </div>
                <div className="text-left font-black text-blue-700 tabular-nums text-sm group-hover:scale-105 transition-transform origin-left">
                  {formatCurrency(parseFloat(inv.total_amount))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
