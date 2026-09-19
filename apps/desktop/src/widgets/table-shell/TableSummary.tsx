import React from 'react';
import { cn } from '@shared/lib/utils';
import { useTableSettings } from '@shared/hooks';
import { getCenteredDividerStyle, getLeftBorderClass } from "@shared/lib/table-utils";
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

  const useCenteredDividers = settings.borderStyle === "full";
  const cellBorderClass = useCenteredDividers ? "" : getLeftBorderClass(settings.borderStyle);
  const hasBorder = settings.borderStyle !== 'none';
  const activeColumns = columns.filter(c => c.value);
  const hasAnyActive = activeColumns.length > 0;

  if (!hasAnyActive) return null;

  const getAlignStyle = (_align?: "right" | "left" | "center"): React.CSSProperties => {
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
      {columns.map((col, idx) => {
        const hasValue = !!col.value;
        const alignStyle = getAlignStyle(col.align);
        return (
          <div
            key={`${col.id}-label`}
            data-summary-col={col.columnId ?? col.id}
            className={cn(
              "relative",
              "flex items-center px-1.5 py-1.5 select-none transition-colors sm:px-2",
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
            {useCenteredDividers && idx > 0 && (
              <div
                className="pointer-events-none absolute inset-y-0 z-10 w-px bg-border"
                style={getCenteredDividerStyle(direction)}
              />
            )}
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
      {columns.map((col, idx) => {
        const hasValue = !!col.value;
        const alignStyle = getAlignStyle(col.align);
        return (
          <div
            key={`${col.id}-value`}
            data-summary-col={col.columnId ?? col.id}
            className={cn(
              "relative",
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
            {useCenteredDividers && idx > 0 && (
              <div
                className="pointer-events-none absolute inset-y-0 z-10 w-px bg-border"
                style={getCenteredDividerStyle(direction)}
              />
            )}
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
          "relative bg-card/95 backdrop-blur-md border-t-2 border-border",
          "shadow-sm",
          sticky && "sticky bottom-0 z-10",
          className,
        )}
      >
        {hasAnyActive && (
          <div
            className="absolute top-0 z-20 flex -translate-y-1/2 items-center gap-1.5 rounded-full bg-foreground px-2.5 py-0.5 text-3xs font-black uppercase tracking-wider text-background shadow-xs"
            style={{ insetInlineStart: "1rem" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            {t("labels.summary", { namespace: "common" })}
          </div>
        )}
        {labelRow}
        <div className="border-t border-border/60" />
        {valueRow}
      </div>
    );
  }

  return (
    <div
      dir={direction}
      className={cn(
        "relative bg-muted/40 backdrop-blur-md",
        hasBorder && [
          'border-t-2 border-border',
          'border-b border-border',
        ],
        settings.borderStyle === 'full' && 'border-b border-border',
        settings.borderStyle === 'none' && 'border-t-0 border-b-0',
        "shadow-sm",
        sticky && "sticky bottom-0 z-10",
        className
      )}
    >
      {hasAnyActive && (
        <div
          className={cn(
            "absolute top-0 z-20 flex -translate-y-1/2 items-center gap-1.5 rounded-full bg-foreground px-2.5 py-0.5 text-3xs font-black uppercase tracking-wider text-background shadow-xs",
          )}
          style={{ insetInlineStart: "1rem" }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          {t("labels.summary", { namespace: "common" })}
        </div>
      )}
      {labelRow}
      <div className="border-t border-border/60" />
      {valueRow}
    </div>
  );
};
