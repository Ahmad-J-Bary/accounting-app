import { useMemo, useCallback, useState, useEffect } from "react";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { GridLine } from "@modules/invoicing/lib/invoiceUtils";
import { DocumentColumn } from "@widgets/document-shell/GenericDocumentGrid";
import { Currency } from "@modules/core/api/currencyService";

export interface BaseFinancialState {
  currency_code: string;
  exchange_rate: string;
  discount_amount: string;
  tax_amount: string;
  extra_costs?: string;
  paid_amount?: string;
}

interface UseDocumentFinancialsProps<T extends BaseFinancialState> {
  lines: GridLine[];
  setLines: (lines: GridLine[] | ((prev: GridLine[]) => GridLine[])) => void;
  headerState: T;
  setHeaderState: (s: T | ((prev: T) => T)) => void;
  currencies: Currency[];
  invoiceType: "Sales" | "Purchase" | "OpeningBalance";
  priceLabel?: string;
  extraColumns?: DocumentColumn[];
}

export function useDocumentFinancials<T extends BaseFinancialState>({
  lines,
  setLines,
  headerState,
  setHeaderState,
  currencies,
  invoiceType,
  priceLabel = "السعر",
  extraColumns = []
}: UseDocumentFinancialsProps<T>) {
  const { formatAmount, convertBetween, rateMap, baseCurrency } = useCurrencyContext();

  // 1. Pre-calculate conversion factors and symbols once per render
  const financials = useMemo(() => {
    const docRate = parseFloat(headerState.exchange_rate) || 1;
    const docCurrency = headerState.currency_code;
    
    // Create a map of factors: Factor = (Value in Target Currency) / (Value in Document Currency)
    const conversionMap = new Map<string, number>();
    
    currencies.forEach(curr => {
      let factor = 1;
      if (curr.code === docCurrency) {
        factor = 1;
      } else if (docCurrency === baseCurrency?.code) {
        factor = docRate;
      } else if (curr.code === baseCurrency?.code) {
        factor = 1 / docRate;
      } else {
        // Cross conversion
        factor = convertBetween(1, docCurrency, curr.code);
      }
      conversionMap.set(curr.code, factor);
    });

    // Calculate enriched lines and subtotal in a SINGLE pass
    const totalsMap = new Map<string, number>();
    currencies.forEach(c => totalsMap.set(c.code, 0));

    const enriched = lines.map(line => {
      const el = { ...line } as GridLine & Record<string, string | number>;
      const qty = parseFloat(line.quantity || "0");
      const unitPrice = parseFloat(line.unit_price || "0");
      const lineTotal = line.line_total || 0;
      
      currencies.forEach(curr => {
        const factor = conversionMap.get(curr.code) || 1;
        const p = unitPrice * factor;
        const t = lineTotal * factor;

        // Accumulate totals per currency from the grid values
        totalsMap.set(curr.code, (totalsMap.get(curr.code) || 0) + t);

        // Preserve user-edited non-doc-currency prices, compute for doc currency
        const priceKey = `unit_price_${curr.code}`;
        const isDocCurr = curr.code === docCurrency;
        if (!isDocCurr && el[priceKey] !== undefined && el[priceKey] !== "") {
          // keep user's value
        } else {
          el[priceKey] = p.toFixed(2).replace(/\.?0+$/, "");
        }
        el[`line_total_${curr.code}`] = curr.code === baseCurrency?.code
          ? t.toFixed(0) 
          : formatAmount(t, { currencyCode: curr.code, hideSymbol: true });

        // Compute SYP equivalents for monetary extra fields
        if (curr.code === baseCurrency?.code) {
          const sypFactor = conversionMap.get(baseCurrency?.code || "") || 1;
          ["cost_price", "profit_amount", "retail_price", "wholesale_price"].forEach(field => {
            const val = parseFloat(el[field] as string || "0");
            if (val) {
              el[`${field}_SYP`] = (val * sypFactor).toFixed(0);
            }
          });
        }
      });
      return el;
    });

    const docSubtotal = totalsMap.get(docCurrency) || 0;
    
    // Calculate net totals for all currencies
    const financialsByCurrency = new Map<string, { subtotal: number, net: number }>();
    currencies.forEach(curr => {
      const sub = totalsMap.get(curr.code) || 0;
      const factor = conversionMap.get(curr.code) || 1;
      
      // Calculate net using currency-specific totals and converted modifiers
      const net = sub 
        - (parseFloat(headerState.discount_amount || "0") * factor)
        + (parseFloat(headerState.tax_amount || "0") * factor)
        + (parseFloat(headerState.extra_costs || "0") * factor);
      
      financialsByCurrency.set(curr.code, { subtotal: sub, net });
    });

    return { enriched, financialsByCurrency, docSubtotal };
  }, [lines, currencies, headerState.currency_code, headerState.exchange_rate, headerState.discount_amount, headerState.tax_amount, headerState.extra_costs, convertBetween, formatAmount]);

  // 2. Stable currency change handler
  const onCurrencyChange = useCallback((newCode: string) => {
    const oldCode = headerState.currency_code;
    if (oldCode === newCode) return;

    const oldRate = oldCode === baseCurrency?.code ? 1 : (rateMap.get(oldCode) || 1);
    const newRate = newCode === baseCurrency?.code ? 1 : (rateMap.get(newCode) || 1);
    const factor = newRate / oldRate;

    setHeaderState((s: T) => ({
      ...s,
      currency_code: newCode,
      exchange_rate: newRate.toString(),
      discount_amount: (parseFloat(s.discount_amount || "0") * factor).toFixed(2),
      tax_amount: (parseFloat(s.tax_amount || "0") * factor).toFixed(2),
      extra_costs: (parseFloat(s.extra_costs || "0") * factor).toFixed(2),
      paid_amount: s.paid_amount ? (parseFloat(s.paid_amount) * factor).toFixed(2) : "0",
    }));

    setLines((prev: GridLine[]) => prev.map(ln => ({
      ...ln,
      unit_price: (parseFloat(ln.unit_price || "0") * factor).toFixed(2),
      line_total: (ln.line_total || 0) * factor
    })));
  }, [headerState.currency_code, rateMap, setHeaderState, setLines]);

  // 3. Optimized grid columns
  const gridColumns = useMemo<DocumentColumn[]>(() => {
    const baseCols: DocumentColumn[] = [
      { key: "material_image", header: "صورة", width: "w-[40px]", align: "center", type: "image" },
      { key: "material_code", header: "الكود", width: "w-[100px]", align: "center", type: "material_code" },
      { key: "unit_barcode", header: "الباركود", width: "w-[120px]", align: "center", type: "material_barcode" },
      { key: "material_name", header: "الصنف (عربي)", width: "flex-[2]", align: "right", type: "material" },
      { key: "name_en", header: "الصنف (EN)", width: "flex-[1.5]", align: "left", type: "readonly" },
      { key: "warehouse_qty", header: "المتوفر", width: "w-[70px]", align: "center", type: "readonly" },
      { key: "quantity", header: "الكمية", width: "w-[80px]", align: "center", type: "number" },
      { key: "unit_name", header: "الوحدة", width: "w-[70px]", align: "center", type: "unit_select" },
    ];

    const priceCols: DocumentColumn[] = [];
    currencies.forEach(curr => {
      const s = curr.symbol || curr.code;
      const isDocCurr = curr.code === headerState.currency_code;
      priceCols.push({ 
        key: isDocCurr ? "unit_price" : `unit_price_${curr.code}`, 
        header: `${curr.code === baseCurrency?.code ? (invoiceType === "Purchase" || invoiceType === "OpeningBalance" ? "التكلفة" : "السعر") : priceLabel} (${s})`, 
        width: "w-[100px]", 
        align: "left", 
        type: "number" 
      });
    });

    const totalCols: DocumentColumn[] = [];
    currencies.forEach(curr => {
      const s = curr.symbol || curr.code;
      totalCols.push({ 
        key: `line_total_${curr.code}`, 
        header: `الإجمالي (${s})`, 
        width: "w-[110px]", 
        align: "left", 
        type: "readonly" 
      });
    });

    return [
      ...baseCols,
      ...priceCols,
      { key: "discount", header: "خصم %", width: "w-[70px]", align: "center", type: "number" },
      ...totalCols,
      ...extraColumns
    ];
  }, [currencies, headerState.currency_code, invoiceType, priceLabel, extraColumns]);

  const [displayCurrency, setDisplayCurrency] = useState<string>(headerState.currency_code);

  // Sync display currency if document currency changes
  useEffect(() => {
    if (headerState.currency_code) {
      setDisplayCurrency(headerState.currency_code);
    }
  }, [headerState.currency_code]);

  const currentFinancials = financials.financialsByCurrency.get(displayCurrency) || { subtotal: 0, net: 0 };

  return {
    enrichedLines: financials.enriched,
    docSubtotal: financials.docSubtotal, // This is always in the Document Currency for backend saving
    net: currentFinancials.net,
    subtotal: currentFinancials.subtotal, // For UI display (might be different from docSubtotal if display currency changed)
    financialsByCurrency: financials.financialsByCurrency,
    displayCurrency,
    setDisplayCurrency,
    onCurrencyChange,
    gridColumns
  };
}

