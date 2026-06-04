import React from 'react';
import { cn } from '@shared/lib/utils';
import { useTableSettings } from '@shared/hooks';
import { getAlignmentClass } from "@shared/lib/table-utils";
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
}

export const TableSummary: React.FC<TableSummaryProps> = ({
  columns,
  colSpan,
  className,
  columnWidths,
  gridTemplate,
  sticky,
  beforeContent,
  afterContent,
}) => {
  const { settings, getDensityPadding } = useTableSettings();

  if (!settings.showSummary) return null;

  return (
    <div className={cn(
      "border-t-2 border-slate-200 bg-slate-50/50",
      sticky && "sticky bottom-0 z-10",
      className
    )}>
      <div
        className={cn("items-center", gridTemplate ? "grid" : "flex")}
        style={gridTemplate ? { gridTemplateColumns: gridTemplate } : { gap: 0 }}
      >
        {beforeContent}
        {columns.map((col) => (
          <div
            key={col.id}
            className={cn(
              getDensityPadding(),
              "font-bold text-slate-800 tabular-nums flex items-center justify-center",
              col.className,
            )}
            style={
              gridTemplate
                ? {
                    fontSize: `${settings.fontSize}px`,
                    fontFamily: settings.fontFamily,
                    minWidth: 0,
                    textAlign: "center",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
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
            {col.value && (
              <div className='flex items-center justify-center gap-1 whitespace-nowrap'>
                <span className="text-xs text-slate-400">{col.label}:</span>
                <span>{col.value}</span>
              </div>
            )}
          </div>
        ))}
        {!gridTemplate && colSpan && columns.length < colSpan && (
          <div
            className={getDensityPadding()}
            style={{ flex: colSpan - columns.length }}
          />
        )}
        {afterContent}
      </div>
    </div>
  );
};
