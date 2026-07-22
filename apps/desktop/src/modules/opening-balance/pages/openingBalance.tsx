import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useTabs } from "@app/providers/TabContext";
import { useTabLocation } from "@app/providers/TabLocationContext";
import { DocumentToolbar } from "@widgets/document-shell/DocumentToolbar";
import { invoiceService } from "@modules/invoicing/api/invoiceService";
import { materialService } from "@modules/inventory/api/materialService";
import { categoryService } from "@modules/inventory/api/categoryService";
import type { MaterialDto, CategoryDto, CreateMaterialRequest, UpdateMaterialRequest, WarehouseDto, CompanySettings } from "@erp/shared-types";
import { settingsService } from "@modules/core/api/settingsService";
import { warehouseService } from "@modules/inventory/api/warehouseService";
import { toast } from "sonner";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { queryClient, invalidateAccountingMutationQueries } from "@shared/hooks/queryClient";
import { useExcelExport } from "@shared/hooks";
import { formatNumber } from "@shared/lib/format";
import { buildInvoiceLineExportColumns } from "@modules/invoicing/lib/invoice-export-columns";

import { HeaderField } from '@shared/ui/header-field';
import { FinancialDocumentTemplate } from "@widgets/templates/FinancialDocumentTemplate";
import {
  GenericDocumentGrid,
  type DocumentColumn,
} from "@widgets/document-shell/GenericDocumentGrid";
import { SummaryPanel } from "@widgets/document-shell/SummaryPanel";
import { DocumentStatusBadge } from "@modules/invoicing/components/DocumentStatusBadge";
import { useDocumentEditor } from "@modules/invoicing/hooks/useDocumentEditor";
import { toBackendLines, calcLineTotal } from "@modules/invoicing/lib/invoiceUtils";
import { useDocumentFinancials } from "@modules/invoicing/lib/useDocumentFinancials";
import { MaterialForm } from "@modules/inventory/components/MaterialForm";


interface HeaderState {
  id?: string;
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
  status: string;
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
  status: "Draft",
});

export default function OpeningBalance() {
  const { id } = useParams<{ id: string }>();
  const { closeTab, activeTabId, openTab } = useTabs();
  const tabLocation = useTabLocation();

  const [materials, setMaterials] = useState<MaterialDto[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseDto[]>([]);
  const [appSettings, setAppSettings] = useState<CompanySettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [, setLoading] = useState(false);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [materialFormOpen, setMaterialFormOpen] = useState(false);
  const [savingMaterial, setSavingMaterial] = useState(false);
  const [gridVisibleColumnIds, setGridVisibleColumnIds] = useState<string[]>([]);

  const { currencies, rateMap, baseCurrency, hasMultipleCurrencies } = useCurrencyContext();
  const [header, setHeader] = useState<HeaderState>(defaultHeader());

  const defaultWarehouseId = appSettings?.purchase_warehouse_id || warehouses.find(w => w.is_default)?.id;

  const {
    lines,
    setLines,
    updateLine,
    removeLine,
    addLine,
    selectMaterial,
  } = useDocumentEditor({
    priceField: "last_purchase_price",
    materials,
    invoiceType: "OpeningBalance",
    defaultWarehouseId,
  });

  const isReadOnly = tabLocation.includes("mode=view");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [mats, whData, settingsData] = await Promise.all([
        materialService.list(),
        warehouseService.list(),
        settingsService.getSettings(),
      ]);
      setMaterials(mats);
      setWarehouses(whData);
      setAppSettings(settingsData);
    } catch (e: unknown) {
      toast.error("فشل تحميل البيانات: " + e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    if (!id) {
      invoiceService.getNextInvoiceNumber("OpeningBalance").then((num) => {
        setHeader((s) => ({ ...s, docNumber: num }));
      });
      setHeader((s) => ({ ...s, exchange_rate: "1" }));
    }
  }, [loadData, id, rateMap, baseCurrency?.code]);

  // Load existing invoice data when editing/viewing
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    invoiceService.getInvoiceById(id).then((inv) => {
      setHeader({
        id: inv.id,
        docNumber: inv.invoice_number,
        issued_at: inv.issued_at.split("T")[0],
        notes: inv.notes || "",
        currency_code: inv.currency_code,
        exchange_rate: inv.exchange_rate || "1",
        discount_amount: inv.discount_amount || "0",
        tax_amount: inv.tax_amount || "0",
        extra_costs: inv.extra_costs || "0",
        paid_amount: inv.amount_paid || "0",
        extra_paid_amount: "0",
        payment_method: inv.payment_method || "Deferred",
        status: inv.status || "Draft",
      });
      setLines(inv.lines.map((l) => {
        const line = {
          id: l.id || "",
          _id: `ln_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          material_id: l.material_id || "",
          material_name: l.material_name || "",
          quantity: l.quantity || "1",
          unit_price: l.unit_price || "0",
          unit_id: l.unit_id || "",
          unit_name: l.unit_name || "",
          cost_price: l.unit_price || "0",
          notes: l.notes || "",
          discount: "",
          line_total: 0,
          warehouse_id: l.warehouse_id || defaultWarehouseId,
          expiry_date: l.expiry_date || "",
        };
        line.line_total = calcLineTotal(line);
        return line;
      }));
    }).catch((e) => {
      toast.error("فشل تحميل الرصيد الافتتاحي: " + e);
    }).finally(() => {
      setLoading(false);
    });
  }, [id, setLines, defaultWarehouseId]);

  useEffect(() => {
    categoryService.list().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    if (baseCurrency?.code && !header.currency_code) {
      setHeader(s => ({ ...s, currency_code: baseCurrency.code || "" }));
    }
  }, [baseCurrency, header.currency_code]);

  const handleSaveMaterial = useCallback(async (data: CreateMaterialRequest | UpdateMaterialRequest) => {
    setSavingMaterial(true);
    try {
      await materialService.create(data as CreateMaterialRequest);
      toast.success("تم إضافة المادة بنجاح");
      setMaterialFormOpen(false);
      invalidateAccountingMutationQueries(queryClient);
      loadData();
    } catch (e) {
      toast.error("فشل إضافة المادة: " + e);
    } finally {
      setSavingMaterial(false);
    }
  }, [loadData]);

  const handleSave = async (andPost = true) => {
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

      let result;
      if (header.id) {
        result = await invoiceService.updateInvoice({ ...payload, id: header.id });
      } else {
        result = await invoiceService.createInvoice(payload);
      }

      if (andPost) {
        await invoiceService.postInvoice(result.id);
        toast.success("تم ترحيل الرصيد الافتتاحي للمخزون بنجاح");
      } else {
        toast.success("تم حفظ المسودة");
      }

      invalidateAccountingMutationQueries(queryClient);

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

  const handleReopen = async () => {
    if (!header.id) return;
    setSaving(true);
    try {
      await invoiceService.reopenInvoice(header.id);
      toast.success("تم إلغاء الترحيل بنجاح");
      setHeader(s => ({ ...s, status: "Draft" }));
      invalidateAccountingMutationQueries(queryClient);
    } catch (e: unknown) {
      toast.error("فشل إلغاء الترحيل: " + e);
    } finally {
      setSaving(false);
    }
  };

  const extraCols = useMemo<DocumentColumn[]>(() => {
    return [
      {
        key: "expiry_date",
        header: "تاريخ الانتهاء",
        width: "w-[110px]",
        align: "center",
        type: "date",
        defaultVisible: false,
      },
      {
        key: "notes",
        header: "ملاحظات",
        width: "flex-[1]",
        align: "right",
        type: "text",
        defaultVisible: true,
      },
    ];
  }, []);

  const dynamicVisibleColumns = useMemo<string[]>(() => {
    const cols: string[] = [];
    let hasExpiry = false;
    let hasImage = false;
    for (const ln of lines) {
      if (!ln.material_id) continue;
      const mat = materials.find(m => m.id === ln.material_id);
      if (!mat) continue;
      if (mat.has_expiry) hasExpiry = true;
      if (mat.image_path) hasImage = true;
      if (hasExpiry && hasImage) break;
    }
    if (hasExpiry) cols.push("expiry_date");
    if (hasImage) cols.push("material_image");
    return cols;
  }, [lines, materials]);

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
    materials,
  });

  const { exportData } = useExcelExport();

  const handleExport = useCallback(async () => {
    if (enrichedLines.length === 0) {
      toast.error("لا توجد بنود للتصدير");
      return;
    }

    const enrichedForExport = enrichedLines.map(line => {
      const r = { ...line } as Record<string, unknown>;
      const mid = r.material_id as string;
      if (mid) {
        const mat = materials.find(m => m.id === mid);
        if (mat) {
          r.material_image = mat.image_path || null;
          r.material_code = mat.code || '';
          r.name_en = mat.name_en || '';
          r.unit_barcode = mat.barcode || '';
        }
      }
      const whId = r.warehouse_id as string;
      if (whId) r.warehouse_name = warehouses.find(w => w.id === whId)?.name || whId;
      return r;
    });

    const hiddenColumnIds = gridVisibleColumnIds.length > 0
      ? gridColumns.map(c => c.key).filter(k => !gridVisibleColumnIds.includes(k))
      : gridColumns.filter(c => c.defaultVisible === false).map(c => c.key);

    const columns = buildInvoiceLineExportColumns({
      gridColumns,
      hiddenColumnIds,
      currencies,
      hasMultipleCurrencies,
      materials,
      warehouses,
    });

    const summary: Record<string, 'sum' | 'subtotal' | 'average' | null> = {};
    currencies.forEach(curr => {
      summary[`line_total_${curr.code}`] = 'subtotal';
    });

    await exportData(
      enrichedForExport,
      columns,
      `بضاعة_أول_المدة_${header.docNumber || "جديد"}`,
      {
        sheetName: "بضاعة أول المدة",
        autoFilter: true,
        summary,
        summaryLabel: "المجموع",
        additionalSummary: [
          { label: "المجموع الكلي (الصافي)", value: net }
        ]
      }
    );
  }, [enrichedLines, exportData, header, net, currencies, hasMultipleCurrencies, gridColumns, gridVisibleColumnIds, materials, warehouses]);

  return (
    <FinancialDocumentTemplate
      title="بضاعة أول المدة"
      statusBadge={<DocumentStatusBadge status={header.status} />}
      toolbar={
        <DocumentToolbar
          status={header.status}
          isReadOnly={isReadOnly}
          saving={saving}
          onNewMaterial={() => setMaterialFormOpen(true)}
          onEdit={isReadOnly && header.id ? () => {
            closeTab(activeTabId);
            openTab({
              id: `/opening-balance/${header.id}`,
              title: `تعديل بضاعة أول المدة`,
              path: `/opening-balance/${header.id}`,
              closable: true,
            });
          } : undefined}
          onSaveDraft={() => handleSave(false)}
          onSaveAndPost={() => handleSave(true)}
          onReopen={handleReopen}
          onExport={handleExport}
          saveAndPostLabel="حفظ وترحيل الرصيد"
        />
      }
      headerFields={
        <>
          <HeaderField label="رقم القيد" value={formatNumber(parseInt(header.docNumber) || 0)} readOnly inputClassName="font-mono font-bold" />

          <HeaderField label="التاريخ" type="date" value={header.issued_at} onChange={v => setHeader(s => ({ ...s, issued_at: v }))} disabled={isReadOnly} inputClassName="font-bold" />

          <HeaderField label="ملاحظات" value={header.notes} onChange={v => setHeader(s => ({ ...s, notes: v }))} disabled={isReadOnly} placeholder="أدخل أي ملاحظات هنا..." className="lg:col-span-4" />
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
          warehouses={warehouses}
          preferenceKey="opening_balance_grid"
          readOnly={isReadOnly}
          docCurrency={header.currency_code}
          exchangeRate={header.exchange_rate}
          dynamicVisibleColumns={dynamicVisibleColumns}
          onVisibleColumnsChange={setGridVisibleColumnIds}
        />
      }
      summaryPanel={
        <SummaryPanel
          subtotal={subtotal}
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
          isReadOnly={isReadOnly}
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
