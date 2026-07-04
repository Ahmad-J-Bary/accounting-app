import type { InvoiceLineDto, SalesReturnLineDto, PurchaseReturnLineDto } from "@erp/shared-types";

// GridLine extends InvoiceLineDto with local-only UI fields (never sent to backend)
export interface GridLine extends InvoiceLineDto {
  _id: string;        // local React key only
  discount?: string;  // line-level discount %
  line_total?: number; // computed
  
  // High-density metadata (read-only in grid usually)
  material_code?: string;
  name_en?: string;
  barcode?: string;
  material_image?: string; // Material thumbnail
  warehouse_qty?: string;
  unit_id?: string;
  unit_name?: string;
  unit_barcode?: string;
  conversion_factor?: string;
  cost_price?: string;        // Average cost in base currency
  current_cost_price?: string; // Cost for current unit in document currency
  
  // Analytics
  profit_amount?: string;
  profit_percent?: string;

  // Current selected price tier
  tier?: string;

  // Sale tier prices layout: "row" for vertical stacked, "column" for horizontal
  sale_tier_layout?: "row" | "column";

  // Return-specific fields
  original_quantity?: string;
  original_quantity_raw?: string;
  original_conversion_factor?: string;
  original_price?: string;
  original_price_base?: string;
  occurrence_key?: string;
  invoice_line_id?: string;
}

/** Strip local-only fields before sending to backend (for returns) */
export function toReturnBackendLines(lines: GridLine[], exchangeRate: string = "1"): Array<SalesReturnLineDto | PurchaseReturnLineDto> {
  const rate = parseFloat(exchangeRate) || 1;
  return lines
    .filter(l => l.material_id || l.material_name) // skip truly empty rows
    .map(({ 
      _id, id, line_total, discount, 
      name_en, barcode, material_image, warehouse_qty, unit_name, unit_barcode, 
      cost_price, current_cost_price,
      profit_amount, profit_percent, tier,
      original_quantity, original_quantity_raw, original_conversion_factor, original_price, original_price_base, occurrence_key,
      ...rest 
    }) => {
      const basePrice = parseFloat(rest.unit_price || "0");
      const docPrice = basePrice * rate;
      const qty = parseFloat(rest.quantity || "0");
      const computedTotal = (qty * docPrice);
      return { 
        id: _id, // use the local _id
        ...rest, 
        unit_price: Number.isFinite(docPrice) ? docPrice.toFixed(2).replace(/\.?0+$/, "") : rest.unit_price,
        unit_name,
        line_total: computedTotal.toFixed(2).replace(/\.?0+$/, "")
      };
    });
}

/** Strip local-only fields before sending to backend (for invoices) */
export function toBackendLines(lines: GridLine[], exchangeRate: string = "1"): InvoiceLineDto[] {
  const rate = parseFloat(exchangeRate) || 1;
  return lines
    .filter(l => l.material_id || l.material_name) // skip truly empty rows
    .map(({ 
      _id, line_total, discount, 
      name_en, barcode, material_image, warehouse_qty, unit_name, unit_barcode, 
      cost_price, current_cost_price,
      profit_amount, profit_percent, tier, sale_tier_layout, occurrence_key, original_conversion_factor, original_quantity_raw, original_price_base,
      ...rest 
    }) => {
      const basePrice = parseFloat(rest.unit_price || "0");
      const docPrice = basePrice * rate;
      return { 
        ...rest, 
        unit_price: Number.isFinite(docPrice) ? docPrice.toFixed(2).replace(/\.?0+$/, "") : rest.unit_price,
        unit_name 
      };
    });
}

/** Create a fresh empty local line */
export function newGridLine(defaultWarehouseId?: string): GridLine {
  return {
    _id: `ln_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    id: "",
    material_id: "",
    material_name: "",
    quantity: "",
    unit_price: "",
    discount: "",
    notes: "",
    line_total: 0,
    tier: "retail",
    warehouse_id: defaultWarehouseId,
    expiry_date: "",
  };
}

/** Compute line total considering discount */
export function calcLineTotal(line: GridLine): number {
  const qty = parseFloat(line.quantity) || 0;
  const price = parseFloat(line.unit_price) || 0;
  const disc = parseFloat(line.discount || "0") || 0;
  const subtotal = qty * price;
  return subtotal - (subtotal * disc / 100);
}


