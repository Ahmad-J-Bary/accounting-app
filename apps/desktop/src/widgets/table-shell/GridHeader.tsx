import React, { ReactNode } from 'react';
import { cn } from '@shared/lib/utils';
import { getLeftBorderClass } from '@shared/lib/table-utils';

import type { GridResizeOptions } from '@shared/hooks/useGridResize';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface GridHeaderColumn {
  id: string;
  header: ReactNode;
  label?: string;
  align?: 'right' | 'left' | 'center';
  /** Tailwind width class (used only in flex mode, not in CSS Grid mode) */
  width?: string;
}

interface GridHeaderProps {
  /** Visible columns to render */
  columns: GridHeaderColumn[];
  getDensityPadding: () => string;
  fontSize: number;
  headerColor?: string;
  stickyHeader?: boolean;
  borderStyle?: string;

  // ── Resize ──────────────────────────────────────────────────────────────
  enableResize?: boolean;
  /** Called on single-click (title-fit) */
  onHeaderCellClick?: (colId: string) => void;
  /** Called when drag-resize starts on the handle */
  onResizeStart?: (e: React.MouseEvent, colId: string) => void;
  /** Called on double-click on handle (full auto-fit) */
  onAutoFit?: (colId: string, options?: GridResizeOptions) => void;

  // ── Flex mode ────────────────────────────────────────────────────────────
  /** Column widths map (flex mode only) */
  columnWidths?: Record<string, number>;
  /** Per-cell style function (flex mode only) */
  getColumnStyle?: (col: GridHeaderColumn) => React.CSSProperties;

  // ── Slots ────────────────────────────────────────────────────────────────
  prefixSlot?: ReactNode;
  suffixSlot?: ReactNode;

  /**
   * CSS grid-template-columns value.
   * When provided, the header renders as a CSS Grid row
   * (matching the body rows' grid) for perfect column alignment.
   * When absent, falls back to flex layout.
   */
  gridTemplate?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getHeaderText(col: GridHeaderColumn): string {
  if (typeof col.header === 'string') return col.header;
  if (typeof col.label === 'string') return col.label;
  return col.id;
}

function getTextAlign(
  align?: 'right' | 'left' | 'center',
): React.CSSProperties['textAlign'] {
  if (align === 'left') return 'left';
  if (align === 'center') return 'center';
  return 'right';
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GridHeader – A CSS Grid/Flex-based table header.
 *
 * Behavior:
 * - When `gridTemplate` is provided: renders as a CSS Grid row (same template
 *   as the body rows), guaranteeing perfect column alignment.
 * - When `gridTemplate` is absent: renders as a flex row (legacy/document-shell mode).
 * - N-1 resize handles: the handle is rendered only for columns where
 *   `index < columns.length - 1`, so there is no handle after the last column.
 * - Single-click → onHeaderCellClick (title-fit, handled by UnifiedTable)
 * - Double-click on resize handle → onAutoFit (full data-fit)
 *
 * RTL: fully supported — resize handles use `left: -4` which places them
 * between adjacent columns in both LTR and RTL flex/grid flows.
 */
export const GridHeader: React.FC<GridHeaderProps> = ({
  columns,
  getDensityPadding,
  fontSize,
  headerColor,
  stickyHeader,
  borderStyle,
  enableResize = true,
  onHeaderCellClick,
  onResizeStart,
  onAutoFit,
  columnWidths = {},
  getColumnStyle,
  prefixSlot,
  suffixSlot,
  gridTemplate,
}) => {
  const useGrid = !!gridTemplate;

  return (
    <div
      className={cn(
        'transition-colors',
        useGrid ? 'grid' : 'flex',
        headerColor || 'bg-slate-50/50 backdrop-blur-md',
        borderStyle !== 'none' && 'border-b border-slate-200',
        stickyHeader && 'sticky top-0 z-10 backdrop-blur-sm shadow-sm',
      )}
      style={useGrid ? { gridTemplateColumns: gridTemplate } : undefined}
    >
      {prefixSlot}

      {columns.map((col, idx) => (
        <div
          key={col.id}
          data-col-id={col.id}
          className={cn(
            getDensityPadding(),
            'relative text-slate-700 font-black uppercase tracking-wider select-text flex items-center justify-center',
            getLeftBorderClass(borderStyle),
            !useGrid && !columnWidths[col.id] && col.width,
          )}
          style={{
            ...(getColumnStyle ? getColumnStyle(col) : {}),
            fontSize: `${fontSize - 2}px`,
            ...(useGrid ? { minWidth: 0 } : {}),
            textAlign: 'center',
          }}
          onClick={() => onHeaderCellClick?.(col.id)}
        >
          <div
            className='w-full text-center whitespace-normal break-words leading-tight hyphens-auto'
            style={{ wordBreak: 'break-word', overflowWrap: 'anywhere', overflow: 'visible' }}
          >
            {col.header}
          </div>

          {enableResize && onResizeStart && idx < columns.length - 1 && (
            <div
              className="absolute top-0 bottom-0 w-2 cursor-col-resize z-20 hover:bg-blue-500/10 active:bg-blue-500/20 transition-colors flex items-center justify-center group/resize"
              style={{ left: -4 }}
              onMouseDown={(e) => {
                e.stopPropagation();
                onResizeStart(e, col.id);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                onAutoFit?.(col.id);
              }}
            >
              <div className="w-[1px] h-3 bg-slate-200 group-hover/resize:bg-blue-400 group-active/resize:bg-blue-600 rounded-full transition-colors" />
            </div>
          )}
        </div>
      ))}

      {suffixSlot}
    </div>
  );
};
