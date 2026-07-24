import { dateCol } from "@shared/lib/excel/export-helpers";
import type { DocumentColumn } from "@widgets/document-shell/GenericDocumentGrid";
import type { ExcelExportColumn } from "@shared/lib/excel";
import type { Currency } from "@modules/core/api/currencyService";
import type { MaterialDto, WarehouseDto } from "@erp/shared-types";

/** Grid line enriched with material info fields for export */
export interface EnrichedExportLine {
  material_id?: string;
  material_name?: string;
  quantity?: string;
  unit_name?: string;
  warehouse_id?: string;
  expiry_date?: string;
  notes?: string;
  [key: string]: unknown;
}

interface BuildColumnsOptions {
  gridColumns: DocumentColumn[];
  /** @deprecated Use hiddenColumnIds instead. If both are provided, hiddenColumnIds takes precedence. */
  visibleColumnIds?: string[];
  /** Explicit list of column keys that should be exported but hidden (collapsed) in Excel. */
  hiddenColumnIds?: string[];
  currencies: Currency[];
  hasMultipleCurrencies: boolean;
  materials?: MaterialDto[];
  warehouses?: WarehouseDto[];
  /** When "variable", non-base currency columns are hidden in the export. */
  currencyMode?: "fixed" | "variable";
}

/**
 * Maps grid columns (DocumentColumn[]) to Excel export columns (ExcelExportColumn[]).
 * All grid columns are included; hidden ones have `hidden: true` so they appear
 * collapsed in Excel. Handles per-currency iterations for price/total/discount/profit fields.
 */
export function buildInvoiceLineExportColumns({
  gridColumns,
  visibleColumnIds,
  hiddenColumnIds,
  currencies,
  hasMultipleCurrencies,
  materials: _materials = [],
  warehouses = [],
  currencyMode = "fixed",
}: BuildColumnsOptions): ExcelExportColumn[] {
  const warehouseMap = new Map(warehouses.map(w => [w.id, w]));
  const cs = (sym: string) => hasMultipleCurrencies ? ` (${sym})` : '';
  const baseCode = currencies[0]?.code || '';

  const result: ExcelExportColumn[] = [];
  const nonBaseCurrencies = currencies.filter(c => c.code !== baseCode);

  const resolveHidden = (key: string): boolean => {
    if (hiddenColumnIds) return hiddenColumnIds.includes(key);
    if (visibleColumnIds) return !visibleColumnIds.includes(key);
    return false;
  };

  const formulaForNonBase = (field: string, code: string): string | undefined => {
    if (currencyMode !== "variable") return undefined;
    const rateIdx = nonBaseCurrencies.findIndex(c => c.code === code);
    if (rateIdx < 0) return undefined;
    return `{col('${field}')}{row}*'أسعار الصرف'!C${rateIdx + 3}`;
  };

  for (const col of gridColumns) {
    const hidden = resolveHidden(col.key);

    switch (col.key) {
      case "material_image":
        result.push({
          id: "material_image",
          label: "صورة",
          hidden,
          width: 8,
          accessor: () => '',
          imageDataUrl: (row) => (row as EnrichedExportLine).material_image as string || null,
          imageWidth: 80,
          imageHeight: 80,
        });
        break;

      case "material_code":
        result.push({
          id: "material_code",
          label: "الكود",
          hidden,
          width: 14,
          accessor: (row) => String((row as EnrichedExportLine).material_code ?? ''),
        });
        break;

      case "unit_barcode":
        result.push({
          id: "unit_barcode",
          label: "الباركود",
          hidden,
          width: 15,
          accessor: (row) => String((row as EnrichedExportLine).unit_barcode ?? ''),
        });
        break;

      case "material_name":
        result.push({
          id: "material_name",
          label: "الصنف (عربي)",
          hidden,
          width: 25,
          accessor: (row) => String((row as EnrichedExportLine).material_name ?? ''),
        });
        break;

      case "name_en":
        result.push({
          id: "name_en",
          label: "الصنف (EN)",
          hidden,
          width: 20,
          accessor: (row) => String((row as EnrichedExportLine).name_en ?? ''),
        });
        break;

      case "warehouse_qty":
        result.push({
          id: "warehouse_qty",
          label: "المتوفر",
          hidden,
          width: 14,
          numeric: true,
          decimalPlaces: 2,
          accessor: (row) => {
            return parseFloat(String((row as EnrichedExportLine).warehouse_qty ?? '0')) || 0;
          },
        });
        break;

      case "quantity":
        result.push({
          id: "quantity",
          label: "الكمية",
          hidden,
          width: 12,
          numeric: true,
          decimalPlaces: 3,
          accessor: (row) => parseFloat(String((row as EnrichedExportLine).quantity ?? '0')) || 0,
        });
        break;

      case "unit_name":
        result.push({
          id: "unit_name",
          label: "الوحدة",
          hidden,
          width: 12,
          accessor: (row) => String((row as EnrichedExportLine).unit_name ?? ''),
        });
        break;

      case "warehouse_id":
        result.push({
          id: "warehouse_id",
          label: "المستودع",
          hidden,
          width: 15,
          accessor: (row) => {
            const whId = (row as EnrichedExportLine).warehouse_id;
            return whId ? (warehouseMap.get(whId)?.name ?? String(whId)) : '';
          },
        });
        break;

      case "sale_prices":
        result.push({
          id: "sale_prices",
          label: "المبيع",
          hidden,
          width: 20,
          accessor: (row) => {
            const r = row as Record<string, unknown>;
            const parts: string[] = [];
            const tiers = ["retail_price", "semi_wholesale_price", "wholesale_price"];
            for (const tier of tiers) {
              const val = r[tier] || r[`${tier}_base`];
              if (val && parseFloat(String(val)) > 0) {
                parts.push(`${tier}: ${val}`);
              }
            }
            return parts.join(', ');
          },
        });
        break;

      default: {
        // Handle per-currency columns: unit_price, line_total, discount_value, cost_price, profit_amount
        const currMatch = col.key.match(/^(unit_price|line_total|discount_value|cost_price|profit_amount)$/);
        const currMatchCode = col.key.match(/^(unit_price|line_total|discount_value|cost_price|profit_amount)_([A-Za-z0-9]+)$/);

        if (currMatch) {
          // Base currency column (e.g. "unit_price")
          const field = currMatch[1];
          const baseCode = currencies[0]?.code || '';
          const baseCurr = currencies.find(c => c.code === baseCode);
          const sym = baseCurr?.symbol || baseCode;
          const labelMap: Record<string, string> = {
            unit_price: "سعر الوحدة",
            line_total: "الإجمالي",
            discount_value: "قيمة الخصم",
            cost_price: "التكلفة",
            profit_amount: "الربح",
          };
          const headerText = typeof col.header === "string" && col.header ? col.header : `${labelMap[field]}${cs(sym)}`;
          result.push({
            id: col.key,
            label: headerText,
            hidden,
            width: 15,
            numeric: true,
            decimalPlaces: 2,
            accessor: (row) => {
              const r = row as Record<string, unknown>;
              return parseFloat(String(r[field] ?? r[`${field}_${baseCode}`] ?? '0')) || 0;
            },
          });
        } else if (currMatchCode) {
          // Per-currency column with code suffix (e.g. "unit_price_USD")
          const field = currMatchCode[1];
          const code = currMatchCode[2];
          const curr = currencies.find(c => c.code === code);
          const sym = curr?.symbol || code;
          const labelMap: Record<string, string> = {
            unit_price: "سعر الوحدة",
            line_total: "الإجمالي",
            discount_value: "قيمة الخصم",
            cost_price: "التكلفة",
            profit_amount: "الربح",
          };
          const headerText = typeof col.header === "string" && col.header ? col.header : `${labelMap[field]}${cs(sym)}`;

          if (field === 'line_total') {
            const isBase = code === baseCode;
            const priceColId = isBase ? 'unit_price' : `unit_price_${code}`;
            const discColId = isBase ? 'discount_value' : `discount_value_${code}`;
            const hasDisc = gridColumns.some(c => c.key === discColId);
            const discPart = hasDisc ? `-{col('${discColId}')}{row}` : '';
            result.push({
              id: col.key,
              label: headerText,
              hidden,
              width: 15,
              numeric: true,
              decimalPlaces: 2,
              formula: `{col('quantity')}{row}*{col('${priceColId}')}{row}${discPart}`,
            });
          } else {
            const formula = formulaForNonBase(field, code);
            result.push({
              id: col.key,
              label: headerText,
              hidden,
              width: 15,
              numeric: true,
              decimalPlaces: 2,
              ...(formula ? { formula } : { accessor: (row) => parseFloat(String((row as Record<string, unknown>)[col.key] ?? '0')) || 0 }),
            });
          }
        } else if (col.key === "discount") {
          result.push({
            id: "discount",
            label: "خصم %",
            hidden,
            width: 12,
            numeric: true,
            decimalPlaces: 3,
            formula: "IFERROR({col('discount_value')}{row}/({col('quantity')}{row}*{col('unit_price')}{row})*100,0)",
          });
        } else if (col.key === "expiry_date") {
          result.push({
            ...dateCol("expiry_date", "تاريخ الانتهاء", (row) => (row as EnrichedExportLine).expiry_date ?? ''),
            hidden,
          });
        } else if (col.key === "notes") {
          result.push({
            id: "notes",
            label: "ملاحظات",
            hidden,
            width: 20,
            accessor: (row) => String((row as EnrichedExportLine).notes ?? ''),
          });
        } else if (col.key.startsWith("retail_price") || col.key.startsWith("semi_wholesale_price") || col.key.startsWith("wholesale_price")) {
          // Sale tier price per-currency columns (e.g. "retail_price_USD")
          const saleMatch = col.key.match(/^(retail_price|semi_wholesale_price|wholesale_price)_([A-Za-z0-9]+)$/);
          const field = saleMatch ? saleMatch[1] : col.key;
          const code = saleMatch ? saleMatch[2] : baseCode;
          const formula = code !== baseCode ? formulaForNonBase(field, code) : undefined;
          result.push({
            id: col.key,
            label: col.header,
            hidden,
            width: 15,
            numeric: true,
            decimalPlaces: 2,
            ...(formula ? { formula } : { accessor: (row) => parseFloat(String((row as Record<string, unknown>)[col.key] ?? '0')) || 0 }),
          });
        } else if (col.key === "original_quantity") {
          result.push({
            id: "original_quantity",
            label: "الكمية الأصلية",
            hidden,
            width: 15,
            accessor: (row) => String((row as EnrichedExportLine).original_quantity ?? ''),
          });
        } else if (col.key === "original_price") {
          result.push({
            id: "original_price",
            label: "السعر الأصلي",
            hidden,
            width: 14,
            numeric: true,
            decimalPlaces: 2,
            accessor: (row) => parseFloat(String((row as EnrichedExportLine).original_price ?? '0')) || 0,
          });
        } else {
          // Generic fallback for any other column type
          result.push({
            id: col.key,
            label: col.header,
            hidden,
            width: 15,
            accessor: (row) => String((row as Record<string, unknown>)[col.key] ?? ''),
          });
        }
        break;
      }
    }
  }

  return result;
}

/**
 * Enriches API line data with material info and per-currency fields.
 * Used by per-row export handlers to prepare lines before calling buildInvoiceLineExportColumns.
 */
export function enrichLinesForExport(
  lines: Array<Record<string, unknown>>,
  baseCode: string,
  currencies: Currency[],
  materials: MaterialDto[],
  warehouses: WarehouseDto[],
  convertBetween: (amount: number, from: string, to: string) => number,
): Array<Record<string, unknown>> {
  const materialMap = new Map(materials.map(m => [m.id, m]));
  const warehouseMap = new Map(warehouses.map(w => [w.id, w]));

  return lines.map(line => {
    const enriched = { ...line };
    const mat = materialMap.get(String(line.material_id));

    if (mat) {
      enriched.material_image = mat.image_path || null;
      enriched.material_code = mat.code || '';
      enriched.name_en = mat.name_en || '';
      enriched.unit_barcode = mat.barcode || '';
    }

    // Warehouse name
    const whId = String(line.warehouse_id || '');
    if (whId) {
      enriched.warehouse_name = warehouseMap.get(whId)?.name || whId;
    }

    // Per-currency enrichment
    const qty = parseFloat(String(line.quantity || '0'));
    const basePrice = parseFloat(String(line.unit_price || '0'));

    currencies.forEach(curr => {
      const isBase = curr.code === baseCode;
      const price = isBase ? basePrice : convertBetween(basePrice, baseCode, curr.code);

      const priceKey = isBase ? 'unit_price' : `unit_price_${curr.code}`;
      if (!isBase) {
        enriched[priceKey] = price.toFixed(curr.decimals);
      }
      enriched[`line_total_${curr.code}`] = (price * qty).toFixed(curr.decimals);

      // Per-currency discount value
      const discPct = parseFloat(String(line.discount || '0'));
      const gross = qty * price;
      const discVal = (gross * discPct / 100).toFixed(curr.decimals);
      enriched[`discount_value_${curr.code}`] = discVal;
      if (isBase) enriched.discount_value = discVal;
    });

    return enriched;
  });
}
