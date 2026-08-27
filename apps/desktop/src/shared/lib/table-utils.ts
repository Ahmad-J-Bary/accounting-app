import { cn } from "./utils";

export type Align = "right" | "left" | "center";

export function getAlignmentClass(align?: Align): string {
  switch (align) {
    case "left": return "text-end";
    case "center": return "text-center";
    default: return "text-start";
  }
}

export function getCellBorderClass(borderStyle: string): string {
  return cn(
    borderStyle === 'full' && 'border border-slate-200',
    borderStyle === 'horizontal' && 'border-b border-slate-200',
    borderStyle === 'none' && 'border-0'
  );
}

export function getHeaderBorderClass(borderStyle: string): string {
  return getCellBorderClass(borderStyle);
}

export function getRowBorderClass(borderStyle: string): string {
  return cn(
    borderStyle !== "none" && "border-b border-slate-100",
    borderStyle === "full" && "border-b border-slate-200",
  );
}

export function getLeftBorderClass(borderStyle: string): string {
  return borderStyle === "full" ? "border-s border-slate-200" : "";
}

export function getRowBackgroundClass(
  isSelected: boolean,
  rowIdx: number,
  isZebra: boolean,
  hasHover: boolean,
): string {
  if (isSelected) return "bg-blue-50/80";
  if (isZebra && rowIdx % 2 === 1) return "bg-slate-100/60";
  if (hasHover) return "hover:bg-slate-50/80";
  return "bg-white";
}

export interface ColumnWidthDef {
  key?: string;
  id?: string;
  width?: string;
  className?: string;
  align?: Align;
}

/**
 * Parses a pixel width from a Tailwind CSS class string.
 * Supports: w-[Xpx], w-[X], min-w-[Xpx], w-X (tailwind scale units × 4px)
 */
export function parseWidthFromClassName(className?: string): number | undefined {
  if (!className) return undefined;
  // w-[Xpx] or w-[X]
  const pxMatch = className.match(/\bw-\[(\d+)(?:px)?\]/);
  if (pxMatch) return parseInt(pxMatch[1], 10);
  // min-w-[Xpx]
  const minPxMatch = className.match(/\bmin-w-\[(\d+)(?:px)?\]/);
  if (minPxMatch) return parseInt(minPxMatch[1], 10);
  // w-X (tailwind scale: w-24 = 24 × 4 = 96px)
  const tailwindMatch = className.match(/\bw-(\d+)\b/);
  if (tailwindMatch) return parseInt(tailwindMatch[1], 10) * 4;
  return undefined;
}

export function parsePixelWidth(width?: string): number {
  if (!width) return 100;
  const parsed = parseWidthFromClassName(width);
  if (parsed) return parsed;
  const pxMatch = width.match(/^(\d+)px$/);
  if (pxMatch) return parseInt(pxMatch[1]);
  const flexMatch = width.match(/flex-\[([\d.]+)\]/);
  if (flexMatch) return Math.round(parseFloat(flexMatch[1]) * 90);
  return 100;
}

export function getColumnId(col: ColumnWidthDef): string {
  return col.key || col.id || "";
}
