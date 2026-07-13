import React from 'react';
import { cn } from '@shared/lib/utils';
import { useTableSettings } from '@shared/hooks';
import { getLeftBorderClass } from "@shared/lib/table-utils";

export interface SummaryColumn {
  id: string;
  label: string;
  value: React.ReactNode;
  align?: "right" | "left" | "center";
  className?: string;
  columnId?: string;
}

interface TableSummaryProps {
  columns: SummaryColumn[];
  colSpan?: number;
  className?: string;
  columnWidths?: Record<string, number>;
  gridTemplate?: string;
  sticky?: boolean;
  beforeContent?: React.ReactNode;
  afterContent?: React.ReactNode;
  /**
   * When true, the summary renders as a 2-row page footer that sits
   * permanently at the bottom of the table (outside the scroll container):
   *   - Row 1: a slim label row (one label per active column)
   *   - Row 2: the value row (one formatted total per active column)
   * Both rows share `gridTemplateColumns` so each label/value lands
   * directly under its data column.
   */
  asPageFooter?: boolean;
}

export const TableSummary: React.FC<TableSummaryProps> = ({
  columns,
  className,
  columnWidths,
  gridTemplate,
  sticky,
  asPageFooter = false,
}) => {
  const { settings, getDensityPadding } = useTableSettings();

  if (!settings.showSummary) return null;

  const cellBorderClass = getLeftBorderClass(settings.borderStyle);
  const hasBorder = settings.borderStyle !== 'none';
  const activeColumns = columns.filter(c => c.value);
  const hasAnyActive = activeColumns.length > 0;

  if (!hasAnyActive) return null;

  const labelRow = (
    <div
      dir="rtl"
      className={cn(
        "items-center",
        gridTemplate ? "grid" : "flex",
      )}
      style={gridTemplate ? { gridTemplateColumns: gridTemplate } : { gap: 0 }}
    >
      {columns.map(col => {
        const hasValue = !!col.value;
        return (
          <div
            key={`${col.id}-label`}
            data-summary-col={col.columnId ?? col.id}
            className={cn(
              "px-2 py-1.5 flex items-center justify-center text-center select-none transition-colors",
              hasValue
                ? asPageFooter
                  ? "text-[10px] font-black text-slate-500 uppercase tracking-wider"
                  : "text-[10px] font-black text-blue-600 uppercase tracking-wider"
                : "text-transparent",
              !asPageFooter && cellBorderClass,
              asPageFooter && hasBorder && cellBorderClass,
            )}
            style={
              gridTemplate
                ? { minWidth: 0, fontFamily: settings.fontFamily }
                : { flex: columnWidths && col.columnId && columnWidths[col.columnId] ? `0 0 ${columnWidths[col.columnId]}px` : 1 }
            }
          >
            {hasValue ? col.label : ""}
          </div>
        );
      })}
    </div>
  );

  const valueRow = (
    <div
      dir="rtl"
      className={cn(
        "items-center",
        gridTemplate ? "grid" : "flex",
      )}
      style={gridTemplate ? { gridTemplateColumns: gridTemplate } : { gap: 0 }}
    >
      {columns.map(col => {
        const hasValue = !!col.value;
        return (
          <div
            key={`${col.id}-value`}
            data-summary-col={col.columnId ?? col.id}
            className={cn(
              getDensityPadding(),
              "tabular-nums flex items-center justify-center text-center transition-colors",
              hasValue
                ? asPageFooter
                  ? "font-extrabold text-slate-900"
                  : "bg-blue-50/30 font-extrabold text-slate-900"
                : "text-transparent select-none",
              !asPageFooter && cellBorderClass,
              asPageFooter && hasBorder && cellBorderClass,
              col.className,
            )}
            style={
              gridTemplate
                ? {
                    fontSize: `${settings.fontSize}px`,
                    fontFamily: settings.fontFamily,
                    minWidth: 0,
                    textAlign: 'center',
                    display: "flex",
                    alignItems: "center",
                    justifyContent: 'center',
                  }
                : {
                    flex: columnWidths && col.columnId && columnWidths[col.columnId]
                      ? `0 0 ${columnWidths[col.columnId]}px`
                      : 1,
                    fontSize: `${settings.fontSize}px`,
                    fontFamily: settings.fontFamily,
                  }
            }
          >
            {hasValue ? col.value : ""}
          </div>
        );
      })}
    </div>
  );

  if (asPageFooter) {
    return (
      <div
        className={cn(
          "relative bg-slate-50/80 border-t-2 border-slate-200",
          "shadow-[0_-2px_10px_-4px_rgba(15,23,42,0.1)]",
          sticky && "sticky bottom-0 z-10",
          className,
        )}
      >
        {hasAnyActive && (
          <div className="absolute top-0 right-4 -translate-y-1/2 px-2 py-0.5 bg-slate-700 text-white text-[9px] font-black uppercase tracking-wider rounded-full shadow-sm">
            ملخص
          </div>
        )}
        {labelRow}
        <div className={cn("border-t", asPageFooter ? "border-slate-200/70" : "border-blue-200/40")} />
        {valueRow}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative",
        cn(
          "bg-gradient-to-b from-blue-50/40 to-white",
          hasBorder && [
            'border-t-[3px] border-blue-300/60',
            'border-b border-slate-100',
          ],
          settings.borderStyle === 'full' && 'border-b border-slate-200',
          settings.borderStyle === 'none' && 'border-t-0 border-b-0',
          "shadow-[0_-4px_12px_-4px_rgba(59,130,246,0.18)]",
        ),
        sticky && "sticky bottom-0 z-10",
        className
      )}
    >
      {labelRow}
      {valueRow}
    </div>
  );
};
