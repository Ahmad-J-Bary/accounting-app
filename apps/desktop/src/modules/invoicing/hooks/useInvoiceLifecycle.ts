import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { useTabs } from "@app/providers/TabContext";
import { invoiceService } from "@modules/invoicing/api/invoiceService";
import { customerService } from "@modules/partners/api/customerService";
import { supplierService } from "@modules/partners/api/supplierService";
import { materialService } from "@modules/inventory/api/materialService";
import { currencyService } from "@modules/core/api/currencyService";
import type {
  InvoiceDto,
  CustomerDto,
  SupplierDto,
  MaterialDto,
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
  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams();
  const { openTab, closeTab, activeTabId } = useTabs();
  const {
    baseCurrency,
    formatMonetaryAmount,
    rateMap,
    currencies,
  } = useCurrencyContext();

  const [view, setView] = useState<"list" | "editor">("list");
  const [invoices, setInvoices] = useState<InvoiceDto[]>([]);
  const [parties, setParties] = useState<Array<CustomerDto | SupplierDto>>([]);
  const [materials, setMaterials] = useState<MaterialDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const [headerState, setHeaderState] = useState<InvoiceHeaderState>(
    DEFAULT_HEADER(invoiceType),
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
  });

  const isNew = location.pathname.includes("/new");

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

        const listPartiesPromise =
          partyType === "customer"
            ? customerService.listCustomers()
            : supplierService.listSuppliers();

        const [invData, partyData, matData] = await Promise.all([
          listInvoicesPromise,
          listPartiesPromise,
          materialService.listMaterials(),
        ]);

        setInvoices(invData);
        setParties(partyData);
        setMaterials(matData);
      } catch (e) {
        toast.error("فشل تحميل البيانات: " + e);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [invoiceType, partyType],
  );

  const prevActiveTab = useRef(activeTabId);
  useEffect(() => {
    loadData(true);
  }, [loadData]);

  // Reload data if switching tabs back to this module
  useEffect(() => {
    const tabName =
      invoiceType === "Sales" ? "sales-invoices" : "purchase-invoices";
    if (prevActiveTab.current !== tabName && activeTabId === tabName) {
      loadData();
    }
    prevActiveTab.current = activeTabId;
  }, [activeTabId, loadData, invoiceType]);

  // Read-only indicator derived strictly from query parameters
  const isReadOnly = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    return searchParams.get("mode") === "view";
  }, [location.search]);

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
            return {
              ...l,
              unit_price: Number.isFinite(basePrice) ? basePrice.toFixed(2).replace(/\.?0+$/, "") : l.unit_price,
              _id: `line_${Math.random()}`,
              line_total: parseFloat(l.quantity) * basePrice,
              material_code: l.code,
              unit_barcode: l.barcode,
              tier: "retail",
            };
          });

          // If the invoice is opened in edit mode (not view-only), append a blank row at the end
          if (!isReadOnly) {
            loadedLines.push(newGridLine());
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
          key: "notes",
          header: "ملاحظات",
          width: "flex-[1]",
          align: "right",
          type: "text",
          defaultVisible: true,
        },
      ];
    }
    return [
      {
        key: "notes",
        header: "ملاحظات",
        width: "flex-[1]",
        align: "right",
        type: "text",
        defaultVisible: true,
      },
    ];
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
      !headerState.customer_id &&
      headerState.customer_name === "زبون نقدي"
    ) {
      toast.error(
        "المبيعات الآجلة أو الجزئية تتطلب اختيار عميل محدد. 'زبون نقدي' مخصص للبيع النقدي فقط.",
      );
      return;
    }

    if (
      invoiceType === "Purchase" &&
      headerState.payment_method !== "cash" &&
      !headerState.supplier_id &&
      headerState.supplier_name === "مورد نقدي"
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
        toast.success("تم الحفظ والترحيل بنجاح");

        // After posting a Purchase invoice, check if prices differ from stored material prices
        if (invoiceType === "Purchase") {
          const exchangeRate = parseFloat(headerState.exchange_rate || "1");
          const docCurrency = headerState.currency_code || baseCurrency?.code || "";
          for (const line of lines) {
            if (!line.material_id || !line.unit_id) continue;
            const mat = materials.find(m => m.id === line.material_id);
            if (!mat) continue;
            const basePrice = parseFloat(line.unit_price || "0"); // line.unit_price is base currency
            const docPrice = basePrice * exchangeRate;
            const storedEntry = mat.purchase_prices?.find(p => p.unit_id === line.unit_id);
            const storedBasePrice = parseFloat(storedEntry?.price_base || "0");
            
            if (basePrice > 0 && storedBasePrice > 0 && Math.abs(basePrice - storedBasePrice) > 0.001) {
              const unitName = mat.units?.find(u => u.id === line.unit_id)?.name || "";
              toast(`${mat.name} (${unitName})`, {
                description: `سعر الشراء المحفوظ: ${storedBasePrice.toFixed(2)} — السعر الجديد: ${basePrice.toFixed(2)}`,
                action: {
                  label: "تحديث",
                  onClick: async () => {
                    try {
                      const existingPrices = mat.purchase_prices || [];
                      const updatedPrices = existingPrices.some(p => p.unit_id === line.unit_id)
                        ? existingPrices.map(p => p.unit_id === line.unit_id ? { 
                            ...p, 
                            price: docPrice.toFixed(2), 
                            price_base: basePrice.toFixed(2), 
                            currency: docCurrency || p.currency 
                          } : p)
                        : [...existingPrices, { 
                            unit_id: line.unit_id!, 
                            price: docPrice.toFixed(2), 
                            price_base: basePrice.toFixed(2), 
                            currency: docCurrency || baseCurrency?.code || "" 
                          }];
                          
                      await materialService.updateMaterial({ 
                        id: mat.id, 
                        name: mat.name, 
                        name_en: mat.name_en || "", 
                        barcode: mat.barcode || "", 
                        code: mat.code || "", 
                        minimum_stock: mat.minimum_stock, 
                        category_ids: mat.category_ids, 
                        notes: mat.notes || null, 
                        image_path: mat.image_path || null, 
                        default_purchase_unit_id: mat.default_purchase_unit_id || null, 
                        default_sale_unit_id: mat.default_sale_unit_id || null, 
                        purchase_prices: updatedPrices, 
                        sale_prices: mat.sale_prices || [] 
                      });
                      toast.success(`تم تحديث سعر شراء ${mat.name}`);
                    } catch (e) { 
                      toast.error("فشل تحديث السعر: " + e); 
                    }
                  },
                },
              });
            }
          }
        }
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
      navigate(
        invoiceType === "Sales"
          ? `/sales-invoices/${headerState.id}`
          : `/purchase-invoices/${headerState.id}`,
      );
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

    formatMonetaryAmount,
    openTab,
    closeTab,
    activeTabId,
  };
}
