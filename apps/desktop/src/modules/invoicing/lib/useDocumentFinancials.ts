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
  /** Columns injected before the unit_price columns */
  prePriceExtraColumns?: DocumentColumn[];
}

export function useDocumentFinancials<T extends BaseFinancialState>({
  lines,
  setLines,
  headerState,
  setHeaderState,
  currencies,
  invoiceType,
  priceLabel = "السعر",
  extraColumns = [],
  prePriceExtraColumns = [],
}: UseDocumentFinancialsProps<T>) {
  const { convertBetween, rateMap, baseCurrency } = useCurrencyContext();

  // 1. Pre-calculate conversion factors and symbols once per render
  const financials = useMemo(() => {
    const baseCode = baseCurrency?.code;
    const docCurrency = headerState.currency_code;

    // Create a map of factors: Factor = (Value in Target Currency) / (Value in Base Currency)
    const conversionMap = new Map<string, number>();

    currencies.forEach((curr) => {
      let factor = 1;
      if (!baseCode || curr.code === baseCode) {
        factor = 1;
      } else {
        factor = rateMap.get(curr.code) || 1;
      }
      conversionMap.set(curr.code, factor);
    });

    // Calculate enriched lines and subtotal in a SINGLE pass
    const totalsMap = new Map<string, number>();
    currencies.forEach((c) => totalsMap.set(c.code, 0));

    const enriched = lines.map((line) => {
      const el = { ...line } as GridLine & Record<string, string | number>;
      const qty = parseFloat(line.quantity || "0");
      const unitPrice = parseFloat(line.unit_price || "0"); // always in base currency
      const lineTotal = line.line_total || 0; // always in base currency

      currencies.forEach((curr) => {
        const factor = conversionMap.get(curr.code) || 1;
        const p = unitPrice * factor;
        const t = lineTotal * factor;

        // Accumulate totals per currency
        totalsMap.set(curr.code, (totalsMap.get(curr.code) || 0) + t);

        // Base currency column key = "unit_price", others = "unit_price_<CODE>"
        const isBase = curr.code === baseCode;
        const priceKey = isBase ? "unit_price" : `unit_price_${curr.code}`;
        if (!isBase && el[priceKey] !== undefined && el[priceKey] !== "") {
          // keep user's manually entered value
        } else {
          el[priceKey] = p.toFixed(2).replace(/\.?0+$/, "");
        }
        el[`line_total_${curr.code}`] = t.toFixed(curr.decimals).replace(/\.?0+$/, "");

        [
          "cost_price",
          "profit_amount",
          "retail_price",
          "wholesale_price",
        ].forEach((field) => {
          const val = parseFloat((el[field] as string) || "0");
          if (!Number.isFinite(val)) return;
          el[`${field}_${curr.code}`] = (val * factor)
            .toFixed(curr.decimals)
            .replace(/\.?0+$/, "");
        });
      });
      return el;
    });

    const baseSubtotal = totalsMap.get(baseCode || "") || 0;
    const docSubtotal = docCurrency ? totalsMap.get(docCurrency) || 0 : baseSubtotal;

    // Calculate net totals for all currencies
    const financialsByCurrency = new Map<
      string,
      { subtotal: number; net: number }
    >();
    currencies.forEach((curr) => {
      const sub = totalsMap.get(curr.code) || 0;

      // Header amounts (discount, tax, extra_costs) are in DOC currency, not base currency.
      // Convert from doc currency to the target currency.
      const headerFactor = docCurrency && baseCode && curr.code !== docCurrency
        ? convertBetween(1, docCurrency, curr.code)
        : 1;

      const net =
        sub -
        parseFloat(headerState.discount_amount || "0") * headerFactor +
        parseFloat(headerState.tax_amount || "0") * headerFactor +
        parseFloat(headerState.extra_costs || "0") * headerFactor;

      financialsByCurrency.set(curr.code, { subtotal: sub, net });
    });

    return { enriched, financialsByCurrency, docSubtotal };
  }, [
    lines,
    currencies,
    headerState.currency_code,
    headerState.discount_amount,
    headerState.tax_amount,
    headerState.extra_costs,
    baseCurrency?.code,
    rateMap,
    convertBetween,
  ]);

  // 2. Stable currency change handler — only affects header-level amounts,
  // NOT line-level prices (which are always in base currency)
  const onCurrencyChange = useCallback(
    (newCode: string) => {
      const oldCode = headerState.currency_code;
      if (oldCode === newCode) return;

      if (!newCode) {
        setDisplayCurrency("");
        setHeaderState((s: T) => ({
          ...s,
          currency_code: "",
          exchange_rate: "1",
        }));
        return;
      }

      if (!oldCode || !baseCurrency?.code) {
        const nextRate =
          newCode === baseCurrency?.code ? 1 : rateMap.get(newCode) || 1;
        setDisplayCurrency(newCode);
        setHeaderState((s: T) => ({
          ...s,
          currency_code: newCode,
          exchange_rate: nextRate.toString(),
        }));
        return;
      }

      // Convert header amounts from old doc currency to new doc currency
      // via the FACTOR that converts from old → new
      const factor = oldCode === baseCurrency.code
        ? (rateMap.get(newCode) || 1)
        : newCode === baseCurrency.code
          ? (1 / (rateMap.get(oldCode) || 1))
          : convertBetween(1, oldCode, newCode);

      const newRate =
        newCode === baseCurrency?.code ? 1 : rateMap.get(newCode) || 1;

      setDisplayCurrency(newCode);
      setHeaderState((s: T) => ({
        ...s,
        currency_code: newCode,
        exchange_rate: newRate.toString(),
        discount_amount: (
          parseFloat(s.discount_amount || "0") * factor
        ).toFixed(2),
        tax_amount: (parseFloat(s.tax_amount || "0") * factor).toFixed(2),
        extra_costs: (parseFloat(s.extra_costs || "0") * factor).toFixed(2),
        paid_amount: s.paid_amount
          ? (parseFloat(s.paid_amount) * factor).toFixed(2)
          : "0",
        extra_paid_amount: (s as unknown as Record<string, string | undefined>).extra_paid_amount
          ? (parseFloat((s as unknown as Record<string, string>).extra_paid_amount) * factor).toFixed(2)
          : undefined,
      }));

      // Line-level prices stay in base currency — no conversion needed
    },
    [
      headerState.currency_code,
      rateMap,
      setHeaderState,
      convertBetween,
      baseCurrency?.code,
    ],
  );

  // 3. Optimized grid columns — Base-currency-anchored column keys
  const gridColumns = useMemo<DocumentColumn[]>(() => {
    const baseCols: DocumentColumn[] = [
      {
        key: "material_image",
        header: "صورة",
        width: "w-[40px]",
        align: "center",
        type: "image",
        defaultVisible: false,
      },
      {
        key: "material_code",
        header: "الكود",
        width: "w-[100px]",
        align: "center",
        type: "material_code",
      },
      {
        key: "unit_barcode",
        header: "الباركود",
        width: "w-[120px]",
        align: "center",
        type: "material_barcode",
        defaultVisible: false,
      },
      {
        key: "material_name",
        header: "الصنف (عربي)",
        width: "flex-[2]",
        align: "right",
        type: "material",
      },
      {
        key: "name_en",
        header: "الصنف (EN)",
        width: "flex-[1.5]",
        align: "left",
        type: "readonly",
        defaultVisible: false,
      },
      {
        key: "warehouse_qty",
        header: "المتوفر",
        width: "w-[70px]",
        align: "center",
        type: "readonly",
      },
      {
        key: "quantity",
        header: "الكمية",
        width: "w-[80px]",
        align: "center",
        type: "number",
      },
      {
        key: "unit_name",
        header: "الوحدة",
        width: "w-[70px]",
        align: "center",
        type: "unit_select",
      },
    ];

    const baseCode = baseCurrency?.code;
    const priceCols: DocumentColumn[] = [];
    currencies.forEach((curr) => {
      const s = curr.symbol || curr.code;
      const isBase = curr.code === baseCode;
      priceCols.push({
        key: isBase ? "unit_price" : `unit_price_${curr.code}`,
        header: `${priceLabel} (${s})`,
        width: "w-[100px]",
        align: "left",
        type: "number",
        defaultVisible: isBase,
      });
    });

    const totalCols: DocumentColumn[] = [];
    currencies.forEach((curr) => {
      const s = curr.symbol || curr.code;
      const isBase = curr.code === baseCode;
      totalCols.push({
        key: `line_total_${curr.code}`,
        header: `الإجمالي (${s})`,
        width: "w-[110px]",
        align: "left",
        type: "number",
        defaultVisible: isBase,
      });
    });

    return [
      ...baseCols,
      ...prePriceExtraColumns,
      ...priceCols,
      ...(invoiceType === "OpeningBalance" ? [] : [{
        key: "discount",
        header: "خصم %",
        width: "w-[70px]",
        align: "center",
        type: "number",
      } as DocumentColumn]),
      ...totalCols,
      ...extraColumns,
    ];
  }, [
    currencies,
    baseCurrency?.code,
    priceLabel,
    prePriceExtraColumns,
    extraColumns,
    invoiceType,
  ]);

  const [displayCurrency, setDisplayCurrency] = useState<string>(
    headerState.currency_code,
  );

  // Sync display currency if document currency changes
  useEffect(() => {
    if (headerState.currency_code) {
      setDisplayCurrency(headerState.currency_code);
    }
  }, [headerState.currency_code]);

  const currentFinancials = financials.financialsByCurrency.get(
    displayCurrency,
  ) || { subtotal: 0, net: 0 };

  return {
    enrichedLines: financials.enriched,
    docSubtotal: financials.docSubtotal, // This is always in the Document Currency for backend saving
    net: currentFinancials.net,
    subtotal: currentFinancials.subtotal, // For UI display (might be different from docSubtotal if display currency changed)
    financialsByCurrency: financials.financialsByCurrency,
    displayCurrency,
    setDisplayCurrency,
    onCurrencyChange,
    gridColumns,
  };
}
