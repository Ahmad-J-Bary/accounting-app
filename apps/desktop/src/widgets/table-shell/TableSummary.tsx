import React from 'react';
import { cn } from '@shared/lib/utils';
import { useTableSettings } from '@shared/hooks';
import { getAlignmentClass, getLeftBorderClass } from "@shared/lib/table-utils";
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

  const cellBorderClass = getLeftBorderClass(settings.borderStyle);

  const hasBorder = settings.borderStyle !== 'none';

  return (
    <div className={cn(
      "relative bg-white",
      hasBorder && [
        'border-t-[3px] border-blue-200/50',
        'border-b border-slate-100',
      ],
      settings.borderStyle === 'full' && 'border-b border-slate-200',
      settings.borderStyle === 'none' && 'border-t-0 border-b-0',
      "shadow-[0_-2px_8px_-4px_rgba(59,130,246,0.12)]",
      sticky && "sticky bottom-0 z-10",
      className
    )}>
      <div
        className={cn("items-center", gridTemplate ? "grid" : "flex")}
        style={gridTemplate ? { gridTemplateColumns: gridTemplate } : { gap: 0 }}
      >
        {beforeContent}
        {columns.map((col) => {
          const hasValue = !!col.value;
          return (
          <div
            key={col.id}
            className={cn(
              getDensityPadding(),
              "tabular-nums flex items-center justify-center",
              hasValue ? "font-extrabold text-slate-900" : "text-slate-400",
              cellBorderClass,
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
            {hasValue && (
              <div className='flex items-baseline justify-center gap-1.5 whitespace-normal break-words text-center leading-snug'
                style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                {col.label && (
                  <span className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider shrink-0">
                    {col.label}
                  </span>
                )}
                <span className="text-slate-900">{col.value}</span>
              </div>
            )}
          </div>
          );
        })}
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
