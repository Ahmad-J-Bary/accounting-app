import React from 'react';
import { cn } from '@shared/lib/utils';
import { useTableSettings } from '@shared/hooks';
import { getLeftBorderClass } from "@shared/lib/table-utils";
import { useLocalization } from "@app/providers/LocalizationProvider";

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
  const { t, direction } = useLocalization();

  if (!settings.showSummary) return null;

  const cellBorderClass = getLeftBorderClass(settings.borderStyle);
  const hasBorder = settings.borderStyle !== 'none';
  const activeColumns = columns.filter(c => c.value);
  const hasAnyActive = activeColumns.length > 0;

  if (!hasAnyActive) return null;

  const getAlignStyle = (align?: "right" | "left" | "center"): React.CSSProperties => {
    if (align === "left") {
      return { justifyContent: "flex-start", textAlign: "start" };
    }
    if (align === "right") {
      return { justifyContent: "flex-end", textAlign: "end" };
    }
    return { justifyContent: "center", textAlign: "center" };
  };

  const labelRow = (
    <div
      dir={direction}
      className={cn(
        "items-center",
        gridTemplate ? "grid" : "flex",
      )}
      style={gridTemplate ? { gridTemplateColumns: gridTemplate } : { gap: 0 }}
    >
      {columns.map(col => {
        const hasValue = !!col.value;
        const alignStyle = getAlignStyle(col.align);
        return (
          <div
            key={`${col.id}-label`}
            data-summary-col={col.columnId ?? col.id}
            className={cn(
              "px-2 py-1.5 flex items-center select-none transition-colors",
              hasValue
                ? asPageFooter
                  ? "text-2xs font-black text-muted-foreground uppercase tracking-wider"
                  : "text-2xs font-black text-primary uppercase tracking-wider"
                : "text-transparent",
              !asPageFooter && cellBorderClass,
              asPageFooter && hasBorder && cellBorderClass,
            )}
            style={{
              fontFamily: settings.fontFamily,
              ...alignStyle,
              ...(gridTemplate
                ? { minWidth: 0 }
                : { flex: columnWidths && col.columnId && columnWidths[col.columnId] ? `0 0 ${columnWidths[col.columnId]}px` : 1 }),
            }}
          >
            {hasValue ? col.label : ""}
          </div>
        );
      })}
    </div>
  );

  const valueRow = (
    <div
      dir={direction}
      className={cn(
        "items-center",
        gridTemplate ? "grid" : "flex",
      )}
      style={gridTemplate ? { gridTemplateColumns: gridTemplate } : { gap: 0 }}
    >
      {columns.map(col => {
        const hasValue = !!col.value;
        const alignStyle = getAlignStyle(col.align);
        return (
          <div
            key={`${col.id}-value`}
            data-summary-col={col.columnId ?? col.id}
            className={cn(
              getDensityPadding(),
              "tabular-nums flex items-center transition-colors",
              hasValue
                ? asPageFooter
                  ? "font-extrabold text-foreground"
                  : "bg-primary/10 font-extrabold text-foreground"
                : "text-transparent select-none",
              !asPageFooter && cellBorderClass,
              asPageFooter && hasBorder && cellBorderClass,
              col.className,
            )}
            style={{
              fontSize: `${settings.fontSize}px`,
              fontFamily: settings.fontFamily,
              ...alignStyle,
              ...(gridTemplate
                ? {
                    minWidth: 0,
                  }
                : {
                    flex: columnWidths && col.columnId && columnWidths[col.columnId]
                      ? `0 0 ${columnWidths[col.columnId]}px`
                      : 1,
                  }),
            }}
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
        dir={direction}
        className={cn(
          "relative bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-md border-t-2 border-slate-200 dark:border-slate-800",
          "shadow-[0_-4px_16px_-4px_rgba(15,23,42,0.08)] dark:shadow-[0_-4px_16px_-4px_rgba(0,0,0,0.3)]",
          sticky && "sticky bottom-0 z-10",
          className,
        )}
      >
        {hasAnyActive && (
          <div
            className={cn(
              "absolute top-0 -translate-y-1/2 rounded-full bg-slate-800 dark:bg-slate-200 px-2.5 py-0.5 text-3xs font-black uppercase tracking-wider text-slate-100 dark:text-slate-900 shadow-sm flex items-center gap-1 z-20",
              direction === "rtl" ? "right-4" : "left-4"
            )}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {t("labels.summary", { namespace: "common" })}
          </div>
        )}
        {labelRow}
        <div className={cn("border-t", asPageFooter ? "border-slate-200/70 dark:border-slate-800/70" : "border-blue-200/40")} />
        {valueRow}
      </div>
    );
  }

  return (
    <div
      dir={direction}
      className={cn(
        "relative",
        cn(
          "bg-gradient-to-b from-blue-50/40 to-white dark:from-slate-900/40 dark:to-slate-950",
          hasBorder && [
            'border-t-[3px] border-blue-300/60 dark:border-blue-800/60',
            'border-b border-slate-100 dark:border-slate-800',
          ],
          settings.borderStyle === 'full' && 'border-b border-slate-200 dark:border-slate-800',
          settings.borderStyle === 'none' && 'border-t-0 border-b-0',
          "shadow-[0_-4px_12px_-4px_rgba(59,130,246,0.18)]",
        ),
        sticky && "sticky bottom-0 z-10",
        className
      )}
    >
      {hasAnyActive && (
        <div
          className={cn(
            "absolute top-0 -translate-y-1/2 rounded-full bg-slate-800 dark:bg-slate-200 px-2.5 py-0.5 text-3xs font-black uppercase tracking-wider text-slate-100 dark:text-slate-900 shadow-sm flex items-center gap-1 z-20",
            direction === "rtl" ? "right-4" : "left-4"
          )}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          {t("labels.summary", { namespace: "common" })}
        </div>
      )}
      {labelRow}
      {valueRow}
    </div>
  );
};
