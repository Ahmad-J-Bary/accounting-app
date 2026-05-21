import React from 'react';
import { cn } from '@shared/lib/utils';
import { useTableSettings } from '@shared/hooks';

export interface SummaryColumn {
  id: string;
  label: string;
  value: React.ReactNode;
  align?: "right" | "left" | "center";
  className?: string;
}

interface TableSummaryProps {
  columns: SummaryColumn[];
  colSpan?: number;
  className?: string;
}

export const TableSummary: React.FC<TableSummaryProps> = ({
  columns,
  colSpan,
  className,
}) => {
  const { settings, getDensityPadding } = useTableSettings();

  if (!settings.showSummary) return null;

  const getAlignmentClass = (align?: "right" | "left" | "center") => {
    switch (align) {
      case "left": return "text-left";
      case "center": return "text-center";
      case "right":
      default: return "text-right";
    }
  };

  return (
    <div className={cn(
      "border-t-2 border-slate-200 bg-slate-50/50",
      className
    )}>
      <div className="flex items-center" style={{ gap: '0' }}>
        {columns.map((col) => (
          <div
            key={col.id}
            className={cn(
              getDensityPadding(),
              "font-bold text-slate-800",
              getAlignmentClass(col.align),
              col.className
            )}
            style={{ flex: 1, fontSize: `${settings.fontSize}px`, fontFamily: settings.fontFamily }}
          >
            <span className="text-xs text-slate-400 ml-1">{col.label}:</span>
            {col.value}
          </div>
        ))}
        {colSpan && columns.length < colSpan && (
          <div
            className={getDensityPadding()}
            style={{ flex: colSpan - columns.length }}
          />
        )}
      </div>
    </div>
  );
};
