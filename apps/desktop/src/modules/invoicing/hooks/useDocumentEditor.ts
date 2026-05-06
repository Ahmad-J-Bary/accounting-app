import { useState, useCallback, useMemo } from "react";
import { GridLine, newGridLine, calcLineTotal } from "../lib/invoiceUtils";
import { MaterialDto } from "@erp/shared-types";

interface UseDocumentEditorProps {
  initialLines?: GridLine[];
  onLinesChange?: (lines: GridLine[]) => void;
}

/**
 * Shared hook for managing financial document state and logic.
 * Encapsulates line management, calculations, and validation.
 */
export function useDocumentEditor({ initialLines = [], onLinesChange }: UseDocumentEditorProps = {}) {
  const [lines, setLines] = useState<GridLine[]>(
    initialLines.length > 0 ? initialLines : [newGridLine()]
  );

  const updateLine = useCallback((index: number, updates: Partial<GridLine>) => {
    setLines(prev => {
      const next = [...prev];
      const updatedLine = { ...next[index], ...updates };
      
      // Auto-calculate line total if quantity, price or discount changed
      if ('quantity' in updates || 'unit_price' in updates || 'discount' in updates) {
        updatedLine.line_total = calcLineTotal(updatedLine);
      }
      
      next[index] = updatedLine;
      onLinesChange?.(next);
      return next;
    });
  }, [onLinesChange]);

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
    updateLine(index, {
      material_id: material.id,
      material_name: material.name,
      unit_price: material.last_sale_price?.toString() || "0",
      purchase_price: material.last_purchase_price?.toString() || "0",
    });
  }, [updateLine]);

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
