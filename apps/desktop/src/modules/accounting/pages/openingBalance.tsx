import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useTabs } from "@app/providers/TabContext";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Save, Plus } from "lucide-react";
import { invoiceService } from "@modules/invoicing/api/invoiceService";
import { materialService } from "@modules/inventory/api/materialService";
import { categoryService } from "@modules/inventory/api/categoryService";
import type { MaterialDto, CategoryDto, CreateMaterialRequest } from "@erp/shared-types";
import { toast } from "sonner";
import { useCurrencyContext } from "@app/providers/CurrencyContext";

import { FinancialDocumentTemplate } from "@widgets/templates/FinancialDocumentTemplate";
import {
  GenericDocumentGrid,
  type DocumentColumn,
} from "@widgets/document-shell/GenericDocumentGrid";
import { SummaryPanel } from "@widgets/document-shell/SummaryPanel";
import { DocumentStatusBadge } from "@modules/invoicing/components/DocumentStatusBadge";
import { useDocumentEditor } from "@modules/invoicing/hooks/useDocumentEditor";
import { toBackendLines } from "@modules/invoicing/lib/invoiceUtils";
import { useDocumentFinancials } from "@modules/invoicing/lib/useDocumentFinancials";
import { MaterialForm } from "@modules/inventory/components/MaterialForm";

interface HeaderState {
  docNumber: string;
  issued_at: string;
  notes: string;
  currency_code: string;
  exchange_rate: string;
  discount_amount: string;
  tax_amount: string;
  extra_costs: string;
  paid_amount: string;
  extra_paid_amount: string;
  payment_method: string;
}

const defaultHeader = (): HeaderState => ({
  docNumber: "...",
  issued_at: new Date().toISOString().split("T")[0],
  notes: "مواد أول المدة- رصيد افتتاحي للمواد",
  currency_code: "",
  exchange_rate: "1",
  discount_amount: "0",
  tax_amount: "0",
  extra_costs: "0",
  paid_amount: "0",
  extra_paid_amount: "0",
  payment_method: "Deferred",
});

export default function OpeningBalance() {
  const location = useLocation();
  const { closeTab, activeTabId, openTab } = useTabs();

  const [materials, setMaterials] = useState<MaterialDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [materialFormOpen, setMaterialFormOpen] = useState(false);
  const [savingMaterial, setSavingMaterial] = useState(false);

  const { currencies, rateMap, baseCurrency } = useCurrencyContext();
  const [header, setHeader] = useState<HeaderState>(defaultHeader());

  const {
    lines,
    setLines,
    updateLine,
    removeLine,
    addLine,
    selectMaterial,
    totals,
  } = useDocumentEditor({
    priceField: "last_purchase_price",
    materials,
  });

  const isNew =
    location.pathname.includes("/new") || !location.pathname.includes("/edit");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const mats = await materialService.listMaterials();
      setMaterials(mats);
    } catch (e: unknown) {
      toast.error("فشل تحميل البيانات: " + e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    if (isNew) {
      invoiceService.getNextInvoiceNumber("OpeningBalance").then((num) => {
        setHeader((s) => ({ ...s, docNumber: num }));
      });
      setHeader((s) => ({ ...s, exchange_rate: "1" }));
    }
  }, [loadData, isNew, rateMap, baseCurrency?.code]);

  useEffect(() => {
    categoryService.listCategories().then(setCategories).catch(() => {});
  }, []);

  const handleSaveMaterial = useCallback(async (data: CreateMaterialRequest) => {
    setSavingMaterial(true);
    try {
      await materialService.createMaterial(data);
      toast.success("تم إضافة المادة بنجاح");
      setMaterialFormOpen(false);
      loadData();
    } catch (e) {
      toast.error("فشل إضافة المادة: " + e);
    } finally {
      setSavingMaterial(false);
    }
  }, [loadData]);

  const handleSave = async () => {
    if (!header.currency_code) {
      toast.error("الرجاء اختيار العملات أولاً من إعدادات العملات");
      return;
    }
    if (lines.length === 0) {
      toast.error("أضف صنفاً واحداً على الأقل");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        invoice_number: header.docNumber,
        invoice_type: "OpeningBalance",
        lines: toBackendLines(lines),
        tax_amount: header.tax_amount || "0",
        discount_amount: header.discount_amount || "0",
        extra_costs: header.extra_costs || "0",
        payment_method: header.payment_method || "Deferred",
        amount_paid: header.paid_amount || "0",
        issued_at: new Date(header.issued_at).toISOString(),
        currency_code: header.currency_code,
        exchange_rate: header.exchange_rate,
        notes: header.notes || undefined,
      };

      const result = await invoiceService.createInvoice(payload);
      await invoiceService.postInvoice(result.id);
      toast.success("تم ترحيل الرصيد الافتتاحي للمخزون بنجاح");

      closeTab(activeTabId);
      openTab({
        id: "purchase-invoices",
        title: "فواتير المشتريات",
        path: "/purchase-invoices",
        closable: true,
      });
    } catch (e: unknown) {
      toast.error("فشل الحفظ: " + e);
    } finally {
      setSaving(false);
    }
  };

  const extraCols = useMemo<DocumentColumn[]>(() => {
    const sortedCurrencies = baseCurrency
      ? [
          baseCurrency,
          ...currencies.filter((c) => c.code !== baseCurrency.code),
        ]
      : currencies;
    return sortedCurrencies
      .map((curr) => ({
        key: `retail_price_${curr.code}`,
        header: `مفرق (${curr.symbol || curr.code})`,
        width: "w-[90px]",
        align: "left" as const,
        type: "number" as const,
      }))
      .concat(
        sortedCurrencies.map((curr) => ({
          key: `wholesale_price_${curr.code}`,
          header: `جملة (${curr.symbol || curr.code})`,
          width: "w-[90px]",
          align: "left" as const,
          type: "number" as const,
        })),
      );
  }, [currencies, baseCurrency]);

  const {
    enrichedLines,
    docSubtotal,
    subtotal,
    net,
    displayCurrency,
    onCurrencyChange,
    gridColumns,
  } = useDocumentFinancials({
    lines,
    setLines,
    headerState: header,
    setHeaderState: setHeader,
    currencies,
    invoiceType: "OpeningBalance",
    priceLabel: "التكلفة",
    extraColumns: extraCols,
  });

  return (
    <FinancialDocumentTemplate
      title="بضاعة أول المدة"
      statusBadge={<DocumentStatusBadge status="Draft" />}
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setMaterialFormOpen(true)}
            className="bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50"
          >
            <Plus className="w-4 h-4 ml-2" /> مادة جديدة
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || loading}
            className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
          >
            <Save className="w-4 h-4 ml-2" />{" "}
            {saving ? "جاري الحفظ..." : "حفظ وترحيل الرصيد"}
          </Button>
        </div>
      }
      headerFields={
        <>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-muted-foreground uppercase">
              رقم القيد
            </label>
            <Input
              value={header.docNumber}
              readOnly
              className="h-9 font-mono font-bold bg-muted border-border"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-muted-foreground uppercase">
              التاريخ
            </label>
            <Input
              type="date"
              value={header.issued_at}
              onChange={(e) =>
                setHeader((s) => ({ ...s, issued_at: e.target.value }))
              }
              className="h-9 font-bold border-border"
            />
          </div>
          <div className="md:col-span-2 space-y-1">
            <label className="text-[10px] font-black text-muted-foreground uppercase">
              ملاحظات
            </label>
            <Input
              placeholder="أدخل أي ملاحظات هنا..."
              value={header.notes}
              onChange={(e) =>
                setHeader((s) => ({ ...s, notes: e.target.value }))
              }
              className="h-9 border-border"
            />
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
          preferenceKey="opening_balance_grid"
          docCurrency={header.currency_code}
          exchangeRate={header.exchange_rate}
        />
      }
      summaryPanel={
        <SummaryPanel
          subtotal={subtotal}
          discount={parseFloat(header.discount_amount)}
          tax={parseFloat(header.tax_amount)}
          extraCosts={parseFloat(header.extra_costs)}
          net={net}
          paid={parseFloat(header.paid_amount) + parseFloat(header.extra_paid_amount || "0")}
          currency={displayCurrency}
          invoiceType="OpeningBalance"
          currencies={currencies}
          onCurrencyChange={onCurrencyChange}
          exchangeRate={parseFloat(header.exchange_rate)}
          docCurrency={header.currency_code}
          docSubtotal={docSubtotal}
          paymentMethod={header.payment_method}
          onPaymentMethodChange={(method) => {
            setHeader((s) => ({ ...s, payment_method: method }));
          }}
          paidAmount={header.paid_amount}
          onPaidAmountChange={(amount) => setHeader((s) => ({ ...s, paid_amount: amount }))}
          onExtraCostsChange={(value) => setHeader((s) => ({ ...s, extra_costs: value }))}
          extraPaidAmount={header.extra_paid_amount}
          onExtraPaidAmountChange={(amount) => setHeader((s) => ({ ...s, extra_paid_amount: amount }))}
        />
      }
      sidebar={
        materialFormOpen ? (
          <MaterialForm
            open={materialFormOpen}
            onClose={() => setMaterialFormOpen(false)}
            material={null}
            categories={categories}
            onSave={handleSaveMaterial}
            saving={savingMaterial}
          />
        ) : null
      }
      isSidebarOpen={materialFormOpen}
    />
  );
}
