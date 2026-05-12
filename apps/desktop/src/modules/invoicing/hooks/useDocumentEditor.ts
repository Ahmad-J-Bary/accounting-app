import { useState, useCallback, useMemo } from "react";
import { GridLine, newGridLine, calcLineTotal } from "../lib/invoiceUtils";
import { MaterialDto } from "@erp/shared-types";

interface UseDocumentEditorProps {
  initialLines?: GridLine[];
  onLinesChange?: (lines: GridLine[]) => void;
  priceField?: "last_sale_price" | "last_purchase_price";
}

/**
 * Shared hook for managing financial document state and logic.
 * Encapsulates line management, calculations, and validation.
 */
export function useDocumentEditor({ 
  initialLines = [], 
  onLinesChange,
  priceField = "last_sale_price",
  materials = []
}: UseDocumentEditorProps & { materials?: MaterialDto[] } = {}) {
  const [lines, setLines] = useState<GridLine[]>(
    initialLines.length > 0 ? initialLines : [newGridLine()]
  );

  const updateLine = useCallback((index: number, updates: Partial<GridLine>) => {
    setLines(prev => {
      const next = [...prev];
      const updatedLine = { ...next[index], ...updates };
      
      // If unit changed, try to auto-update the price
      if ('unit_id' in updates && updatedLine.material_id) {
        const material = materials.find(m => m.id === updatedLine.material_id);
        if (material) {
            const unit = material.units.find(u => u.id === updates.unit_id);
            if (unit) updatedLine.conversion_factor = unit.conversion_factor.toString();

            // Find price for this unit
            if (priceField === "last_purchase_price") {
                const pPrice = material.purchase_prices.find(p => p.unit_id === updates.unit_id);
                if (pPrice) updatedLine.unit_price = pPrice.price_usd;
            } else {
                const sPrice = material.sale_prices.find(p => p.unit_id === updates.unit_id && p.tier === 'consumer');
                if (sPrice) updatedLine.unit_price = sPrice.price_usd;
            }
        }
      }

      // Auto-calculate line total if quantity, price or discount changed
      if ('quantity' in updates || 'unit_price' in updates || 'discount' in updates || 'unit_id' in updates) {
        updatedLine.line_total = calcLineTotal(updatedLine);
        
        // Profit calculation
        const cost = parseFloat(updatedLine.cost_price || "0");
        const price = parseFloat(updatedLine.unit_price || "0");
        const qty = parseFloat(updatedLine.quantity || "0");
        const disc = parseFloat(updatedLine.discount || "0");
        
        const netPrice = price - (price * disc / 100);
        const profitPerUnit = netPrice - cost;
        const totalProfit = profitPerUnit * qty;
        
        updatedLine.profit_amount = totalProfit.toFixed(2);
        updatedLine.profit_percent = cost > 0 ? ((profitPerUnit / cost) * 100).toFixed(1) : "0";
      }
      
      next[index] = updatedLine;
      onLinesChange?.(next);
      return next;
    });
  }, [onLinesChange, materials, priceField]);

  const addLine = useCallback(() => {
    setLines(prev => {
      const next = [...prev, newGridLine()];
      onLinesChange?.(next);
      return next;
    });
  }, [onLinesChange]);

  const removeLine = useCallback((index: number) => {
    setLines(prev => {
      if (prev.length <= 1) return [newGridLine()]; // Keep at least one row
      const next = prev.filter((_, i) => i !== index);
      onLinesChange?.(next);
      return next;
    });
  }, [onLinesChange]);

  const selectMaterial = useCallback((index: number, material: MaterialDto) => {
    const price = material[priceField]?.toString() || "0";
    const defaultUnitId = priceField === "last_purchase_price" ? material.default_purchase_unit_id : material.default_sale_unit_id;
    const defaultUnit = material.units.find(u => u.id === defaultUnitId) || material.units.find(u => u.is_base) || material.units[0];

    updateLine(index, {
      material_id: material.id,
      material_name: material.name,
      material_image: material.image_path || undefined,
      name_en: material.name_en,
      barcode: material.barcode,
      warehouse_qty: material.total_available,
      unit_name: defaultUnit?.name,
      unit_id: defaultUnit?.id,
      conversion_factor: defaultUnit?.conversion_factor.toString() || "1",
      unit_barcode: defaultUnit?.barcode || material.barcode,
      unit_price: price,
      cost_price: material.average_cost_base || "0",
      purchase_price: material.last_purchase_price?.toString() || "0",
    });
  }, [updateLine, priceField]);

  const totals = useMemo(() => {
    const subtotal = lines.reduce((sum, ln) => sum + (ln.line_total || 0), 0);
    return {
      subtotal,
      total: subtotal, // Add tax/global discount logic here if needed
      itemCount: lines.filter(l => !!l.material_id).length,
    };
  }, [lines]);

  return {
    lines,
    setLines,
    updateLine,
    addLine,
    removeLine,
    selectMaterial,
    totals,
  };
}
