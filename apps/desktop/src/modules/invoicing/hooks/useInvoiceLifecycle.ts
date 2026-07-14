import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useTabs } from "@app/providers/TabContext";
import { useTabLocation } from "@app/providers/TabLocationContext";
import { invoiceService } from "@modules/invoicing/api/invoiceService";
import { customerService } from "@modules/partners/api/customerService";
import { supplierService } from "@modules/partners/api/supplierService";
import { materialService } from "@modules/inventory/api/materialService";
import { lotService } from "@modules/inventory/api/lotService";

import { settingsService } from "@modules/core/api/settingsService";
import { warehouseService } from "@modules/inventory/api/warehouseService";
import type {
  InvoiceDto,
  CustomerDto,
  SupplierDto,
  MaterialDto,
  WarehouseDto,
  CompanySettings,
  MaterialPriceHistoryDto,
} from "@erp/shared-types";
import { toast } from "sonner";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useDocumentEditor } from "./useDocumentEditor";
import {
  toBackendLines,
  newGridLine,
  type GridLine,
} from "../lib/invoiceUtils";
import { useDocumentFinancials } from "../lib/useDocumentFinancials";
import { type DocumentColumn } from "@widgets/document-shell/GenericDocumentGrid";
import { ALL_REPORT_KEYS } from "@shared/hooks/queryClient";

export interface InvoiceHeaderState {
  id?: string;
  invoice_number: string;
  customer_id?: string;
  customer_name?: string;
  supplier_id?: string;
  supplier_name?: string;
  issued_at: string;
  notes: string;
  tax_amount: string;
  discount_amount: string;
  extra_costs: string;
  extra_paid_amount?: string;
  payment_method: string;
  currency_code: string;
  exchange_rate: string;
  status: string;
  paid_amount: string;
}

const DEFAULT_HEADER = (
  invoiceType: "Sales" | "Purchase",
): InvoiceHeaderState => ({
  invoice_number: "...",
  issued_at: new Date().toISOString().split("T")[0],
  notes: "",
  tax_amount: "0",
  discount_amount: "0",
  extra_costs: "0",
  payment_method: "cash",
  status: "Draft",
  currency_code: "",

  exchange_rate: "1",
  paid_amount: "0",
  ...(invoiceType === "Sales"
    ? { customer_id: "", customer_name: "زبون نقدي" }
    : { supplier_id: "", supplier_name: "مورد نقدي", extra_paid_amount: "0" }),
});

interface UseInvoiceLifecycleProps {
  invoiceType: "Sales" | "Purchase";
  partyType: "customer" | "supplier";
  priceField: "last_sale_price" | "last_purchase_price";
}

export function useInvoiceLifecycle({
  invoiceType,
  partyType,
  priceField,
}: UseInvoiceLifecycleProps) {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { openTab, closeTab, activeTabId } = useTabs();
  const {
    baseCurrency,
    formatMonetaryAmount,
    rateMap,
    currencies,
  } = useCurrencyContext();

  const [view, setView] = useState<"list" | "editor">("list");
  const [invoices, setInvoices] = useState<InvoiceDto[]>([]);
  const [purchaseInvoicesForExpiry, setPurchaseInvoicesForExpiry] = useState<InvoiceDto[]>([]);
  const [parties, setParties] = useState<Array<CustomerDto | SupplierDto>>([]);
  const [materials, setMaterials] = useState<MaterialDto[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseDto[]>([]);
  const [appSettings, setAppSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const [headerState, setHeaderState] = useState<InvoiceHeaderState>(
    DEFAULT_HEADER(invoiceType),
  );

  const defaultWarehouseId = appSettings
    ? (invoiceType === "Sales"
        ? appSettings.sales_warehouse_id
        : appSettings.purchase_warehouse_id) || warehouses.find(w => w.is_default)?.id
    : undefined;

  // Build a map of material_id → latest expiry_date from purchase/opening balance invoices
  // Used to pre-fill expiry_date when selecting a material in a sales invoice
  const defaultExpiryMap = useMemo(() => {
    const map = new Map<string, string>();
    const source = invoiceType === "Sales" ? purchaseInvoicesForExpiry : invoices;
    for (const inv of source) {
      for (const line of inv.lines) {
        if (line.material_id && line.expiry_date && !map.has(line.material_id)) {
          map.set(line.material_id, line.expiry_date);
        }
      }
    }
    return map;
  }, [invoiceType, purchaseInvoicesForExpiry, invoices]);

  const getDefaultExpiryDate = useCallback(
    (materialId: string) => defaultExpiryMap.get(materialId),
    [defaultExpiryMap],
  );

  const {
    lines,
    setLines,
    updateLine,
    removeLine,
    addLine,
    selectMaterial,
    totals,
  } = useDocumentEditor({
    priceField,
    materials,
    defaultWarehouseId,
    getDefaultExpiryDate,
  });

  const tabLocation = useTabLocation();
  const isNew = tabLocation.includes("/new");

  // Fetch all necessary lookup and list data
  const loadData = useCallback(
    async (isInitial = false) => {
      try {
        if (isInitial) setLoading(true);
        else setRefreshing(true);

        const listInvoicesPromise =
          invoiceType === "Sales"
            ? invoiceService.listInvoicesByType("Sales")
            : invoiceService.listInvoicesByType(["Purchase", "OpeningBalance"]);

        const purchaseExpiryPromise =
          invoiceType === "Sales"
            ? invoiceService.listInvoicesByType(["Purchase", "OpeningBalance"])
            : Promise.resolve([] as InvoiceDto[]);

        const listPartiesPromise =
          partyType === "customer"
            ? customerService.list()
            : supplierService.list();

        const [invData, purchaseExpiryData, partyData, matData, whData, settingsData] = await Promise.all([
          listInvoicesPromise,
          purchaseExpiryPromise,
          listPartiesPromise,
          materialService.listMaterials(),
          warehouseService.list(),
          settingsService.getSettings(),
        ]);

        setInvoices(invData);
        setPurchaseInvoicesForExpiry(purchaseExpiryData);
        setParties(partyData);
        setMaterials(matData);
        setWarehouses(whData);
        setAppSettings(settingsData);
      } catch (e) {
        toast.error("فشل تحميل البيانات: " + e);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [invoiceType, partyType],
  );

  const prevActiveTabRef = useRef(activeTabId);
  useEffect(() => {
    loadData(true);
  }, [loadData]);

  // Reload data when switching back to this tab
  useEffect(() => {
    if (prevActiveTabRef.current !== activeTabId) {
      if (!isNew && !id) {
        loadData(false);
      }
    }
    prevActiveTabRef.current = activeTabId;
  }, [activeTabId, loadData, isNew, id]);

  // Read-only indicator derived from the tab's own path (not useLocation, which returns the active tab's URL)
  const isReadOnly = useMemo(() => {
    const searchParams = new URLSearchParams(tabLocation.includes("?") ? tabLocation.split("?")[1] : "");
    return searchParams.get("mode") === "view";
  }, [tabLocation]);

  // Synchronise state based on route parameter modifications (e.g. going from edit/view to list)
  useEffect(() => {
    if (isNew) {
      setHeaderState(DEFAULT_HEADER(invoiceType));

      invoiceService.getNextInvoiceNumber(invoiceType).then((num) => {
        setHeaderState((s) => ({ ...s, invoice_number: num, status: "Draft" }));
      });
      setHeaderState((s) => ({ ...s, exchange_rate: "1" }));

      setView("editor");
    } else if (id) {
      const loadInvoice = async () => {
        try {
          const inv = await invoiceService.getInvoiceById(id);
          setHeaderState({
            id: inv.id,
            invoice_number: inv.invoice_number,
            issued_at: inv.issued_at.split("T")[0],
            notes: inv.notes ?? "",
            tax_amount: inv.tax_amount,
            discount_amount: inv.discount_amount,
            extra_costs: inv.extra_costs || "0",
            extra_paid_amount: "0",
            payment_method: inv.payment_method?.toLowerCase() || "cash",
            status: inv.status,
            currency_code: inv.currency_code || "",

            exchange_rate: inv.exchange_rate || "1",
            paid_amount: inv.amount_paid || "0",
            ...(invoiceType === "Sales"
              ? {
                  customer_id: inv.customer_id ?? "",
                  customer_name: inv.customer_name ?? "زبون نقدي",
                }
              : {
                  supplier_id: inv.supplier_id ?? "",
                  supplier_name: inv.supplier_name ?? "مورد نقدي",
                }),
          });
          const loadedLines: GridLine[] = (inv.lines ?? []).map((l) => {
            const rate = parseFloat(inv.exchange_rate || "1");
            const docPrice = parseFloat(l.unit_price || "0");
            const basePrice = rate > 0 ? docPrice / rate : docPrice;
            let unit_name = l.unit_name;
            // If unit name is empty but unit id is present, try to find from materials (if available yet)
            if (!unit_name && l.unit_id) {
              const material = materials.find(m => m.id === l.material_id);
              if (material?.units) {
                const foundUnit = material.units.find(u => u.id === l.unit_id);
                if (foundUnit) {
                  unit_name = foundUnit.name;
                }
              }
            }
            return {
              ...l,
              unit_name,
              unit_price: Number.isFinite(basePrice) ? basePrice.toFixed(2).replace(/\.?0+$/, "") : l.unit_price,
              _id: `line_${Math.random()}`,
              discount: l.discount_percent || "0",
              line_total: parseFloat(l.quantity) * basePrice,
              material_code: l.code,
              unit_barcode: l.barcode,
              tier: "retail",
            };
          });

          // If the invoice is opened in edit mode (not view-only), append a blank row at the end
          if (!isReadOnly) {
            loadedLines.push(newGridLine(defaultWarehouseId));
          }

          setLines(loadedLines);
          setView("editor");
        } catch {
          toast.error("فشل تحميل الفاتورة");
        }
      };
      loadInvoice();
    } else {
      setView("list");
    }
  }, [
    isNew,
    id,
    invoiceType,
    baseCurrency,
    setLines,
    rateMap,
    isReadOnly,
    currencies,
    defaultWarehouseId,
    materials,
  ]);

  // Financial document calculations and grid columns adaptation
  const extraCols = useMemo<DocumentColumn[]>(() => {
    if (invoiceType === "Sales") {
      const sortedCurrencies = baseCurrency
        ? [
            baseCurrency,
            ...currencies.filter((c) => c.code !== baseCurrency.code),
          ]
        : currencies;
      return [
        ...sortedCurrencies.map((curr) => ({
          key: `profit_amount_${curr.code}`,
          header: `المربح (${curr.symbol || curr.code})`,
          width: "w-[90px]",
          align: "left" as const,
          type: "readonly" as const,
          defaultVisible: curr.code === baseCurrency?.code,
        })),
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
    }
    const baseCols: DocumentColumn[] = [
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
    return baseCols;
  }, [invoiceType, currencies, baseCurrency]);

  const prePriceExtraCols = useMemo<DocumentColumn[]>(() => {
    if (invoiceType !== "Sales") return [];
    const sortedCurrencies = baseCurrency
      ? [baseCurrency, ...currencies.filter((c) => c.code !== baseCurrency.code)]
      : currencies;
    return sortedCurrencies.map((curr) => ({
      key: `cost_price_${curr.code}`,
      header: `التكلفة (${curr.symbol || curr.code})`,
      width: "w-[90px]",
      align: "left" as const,
      type: "readonly" as const,
      defaultVisible: curr.code === baseCurrency?.code,
    }));
  }, [invoiceType, currencies, baseCurrency]);

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
    headerState,
    setHeaderState,
    currencies,
    invoiceType,
    priceLabel: invoiceType === "Sales" ? "السعر" : "التكلفة",
    extraColumns: extraCols,
    prePriceExtraColumns: prePriceExtraCols,
  });

  // Auto-set default currency to base currency for new documents
  useEffect(() => {
    if (isNew && !headerState.currency_code && baseCurrency) {
      const rate = rateMap.get(baseCurrency.code) || 1;
      setHeaderState((s) => ({ ...s, currency_code: baseCurrency.code, exchange_rate: rate.toString() }));
    }
  }, [isNew, baseCurrency, rateMap, headerState.currency_code]);

  // Compute columns to auto-show based on line data
  const dynamicVisibleColumns = useMemo<string[]>(() => {
    const cols: string[] = [];
    const hasExpiryLine = lines.some(ln => {
      if (!ln.material_id) return false;
      const mat = materials.find(m => m.id === ln.material_id);
      return mat?.has_expiry;
    });
    if (hasExpiryLine) cols.push("expiry_date");
    return cols;
  }, [lines, materials]);

  // Price history map for cost_with_history column
  const [priceHistoryMap, setPriceHistoryMap] = useState<Record<string, MaterialPriceHistoryDto>>({});
  const fetchedKeys = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const ln of lines) {
      if (!ln.material_id || !ln.unit_id) continue;
      const key = `${ln.material_id}_${ln.unit_id}`;
      if (fetchedKeys.current.has(key)) continue;
      fetchedKeys.current.add(key);
      lotService.getPurchasePriceHistory(ln.material_id, ln.unit_id)
        .then(dto => { setPriceHistoryMap(prev => ({ ...prev, [key]: dto })); })
        .catch(() => { fetchedKeys.current.delete(key); });
    }
  }, [lines]);

  // Action handlers
  const handleSave = async (andPost = false) => {
    if (!headerState.currency_code) {
      toast.error("الرجاء اختيار العملات أولاً من إعدادات العملات");
      return;
    }

    if (
      lines.length === 0 ||
      (invoiceType === "Purchase" && !lines[0].material_id)
    ) {
      toast.error("يجب إضافة صنف واحد على الأقل");
      return;
    }

    if (
      invoiceType === "Sales" &&
      headerState.payment_method !== "cash" &&
      !headerState.customer_id
    ) {
      toast.error(
        "المبيعات الآجلة أو الجزئية تتطلب اختيار عميل محدد. 'زبون نقدي' مخصص للبيع النقدي فقط.",
      );
      return;
    }

    if (
      invoiceType === "Purchase" &&
      headerState.payment_method !== "cash" &&
      !headerState.supplier_id
    ) {
      toast.error(
        "المشتريات الآجلة أو الجزئية تتطلب اختيار مورد محدد. 'مورد نقدي' مخصص للشراء النقدي فقط.",
      );
      return;
    }

    setSaving(true);
    try {
      const totalPaid = (
        (parseFloat(headerState.paid_amount || "0") || 0) +
        (invoiceType === "Purchase"
          ? (parseFloat(headerState.extra_paid_amount || "0") || 0)
          : 0)
      ).toFixed(2);

      const payload = {
        invoice_number: headerState.invoice_number,
        invoice_type: invoiceType,
        lines: toBackendLines(lines, headerState.exchange_rate),
        tax_amount: headerState.tax_amount,
        discount_amount: headerState.discount_amount,
        extra_costs:
          invoiceType === "Purchase" ? headerState.extra_costs : undefined,
        payment_method: 
          headerState.payment_method === "cash" ? "Cash" : 
          headerState.payment_method === "credit" ? "Deferred" : 
          headerState.payment_method === "partial" ? "Partial" : "Cash",
        amount_paid: totalPaid,
        issued_at: new Date(headerState.issued_at).toISOString(),
        currency_code: headerState.currency_code,
        exchange_rate: headerState.exchange_rate,
        notes: headerState.notes || undefined,
        ...(invoiceType === "Sales"
          ? {
              customer_id: headerState.customer_id || undefined,
              customer_name: !headerState.customer_id
                ? headerState.customer_name
                : undefined,
            }
          : {
              supplier_id: headerState.supplier_id || undefined,
              supplier_name: !headerState.supplier_id
                ? headerState.supplier_name
                : undefined,
            }),
      };

      let result: InvoiceDto;
      if (headerState.id) {
        result = await invoiceService.updateInvoice({
          ...payload,
          id: headerState.id,
        });
      } else {
        result = await invoiceService.createInvoice(payload);
      }

      if (andPost) {
        await invoiceService.postInvoice(result.id);
        for (const key of ALL_REPORT_KEYS) {
          queryClient.invalidateQueries({ queryKey: key });
        }
        toast.success("تم الحفظ والترحيل بنجاح");
      } else {
        toast.success("تم حفظ المسودة");
      }

      const listTabId =
        invoiceType === "Sales" ? "sales-invoices" : "purchase-invoices";
      closeTab(activeTabId);
      openTab({
        id: listTabId,
        title: invoiceType === "Sales" ? "فواتير المبيعات" : "فواتير المشتريات",
        path: `/${listTabId}`,
        closable: true,
      });
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
      toast.success("تم إلغاء الترحيل بنجاح. الفاتورة الآن مسودة.");
      setHeaderState((s) => ({ ...s, status: "Draft" }));
      const invoicePath = invoiceType === "Sales"
        ? `/sales-invoices/${headerState.id}`
        : `/purchase-invoices/${headerState.id}`;
      closeTab(activeTabId);
      openTab({
        id: invoicePath,
        title: headerState.invoice_number,
        path: invoicePath,
        closable: true,
      });
    } catch (e) {
      toast.error("فشل إلغاء الترحيل: " + e);
    } finally {
      setSaving(false);
    }
  };

  return {
    view,
    setView,
    invoices,
    parties,
    currencies,
    materials,
    warehouses,
    loading,
    refreshing,
    saving,
    search,
    setSearch,
    headerState,
    setHeaderState,
    lines,
    setLines,
    updateLine,
    removeLine,
    addLine,
    selectMaterial,
    totals,
    isNew,
    isReadOnly,
    loadData,
    handleSave,
    handleReopen,
    enrichedLines,
    docSubtotal,
    subtotal,
    net,
    displayCurrency,
    setDisplayCurrency: onCurrencyChange,
    gridColumns,
    dynamicVisibleColumns,
    priceHistoryMap,

    formatMonetaryAmount,
    openTab,
    closeTab,
    activeTabId,
  };
}
