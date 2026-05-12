import { ReactNode } from "react";
import { cn } from "@shared/lib/utils";

interface FinancialDocumentTemplateProps {
  /** The type of document (e.g., "فاتورة مبيعات") */
  title: string;
  /** Primary status or document number badge */
  statusBadge?: ReactNode;
  /** Toolbar actions (Save, Print, etc.) */
  toolbar?: ReactNode;
  /** Main header fields (Customer, Date, Currency) */
  headerFields: ReactNode;
  /** The editable grid of line items */
  lineItemsGrid: ReactNode;
  /** Summary calculation cards/totals */
  summaryPanel: ReactNode;
  /** Optional secondary sidebar for info/attachments */
  sidebar?: ReactNode;
  /** Optional footer notes/terms */
  footer?: ReactNode;
  /** Custom class for the wrapper */
  className?: string;
}

/**
 * A master template for financial documentary pages (Invoices, Vouchers, etc.)
 * Ensures strict visual consistency and RTL layout standards.
 */
export function FinancialDocumentTemplate({
  title,
  statusBadge,
  toolbar,
  headerFields,
  lineItemsGrid,
  summaryPanel,
  sidebar,
  footer,
  className
}: FinancialDocumentTemplateProps) {
  return (
    <div className={cn("flex flex-col h-full w-full bg-[#f8fafc]", className)} dir="rtl">
      {/* 1. Global Toolbar & Title Area */}
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200/60 shadow-sm shrink-0 sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center text-white shadow-lg shrink-0">
            <span className="text-sm font-black italic">ERP</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">{title}</h1>
              {statusBadge}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {toolbar}
        </div>
      </header>

      {/* 2. Main Content Layout */}
      <div className="flex-1 flex overflow-hidden p-2 gap-2">
        
        {/* Main Column: Header, Grid, and Summary */}
        <div className="flex-1 flex flex-col min-w-0 gap-2 overflow-hidden">
          
          {/* Header Info Card */}
          <div className="bg-white rounded-lg border border-slate-200/70 shadow-sm p-3 shrink-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {headerFields}
            </div>
          </div>

          {/* Line Items Table Area */}
          <div className="flex-1 flex flex-col bg-white rounded-lg border border-slate-200/70 shadow-sm overflow-hidden min-h-0">
            <div className="flex-1 overflow-auto custom-scrollbar">
              {lineItemsGrid}
            </div>
            
            {/* Optional Footer Notes */}
            {footer && (
              <div className="p-2 border-t border-slate-100 bg-slate-50/40">
                {footer}
              </div>
            )}
          </div>

          {/* Slim Summary Panel at the bottom */}
          <div className="shrink-0">
            {summaryPanel}
          </div>
        </div>

        {/* Optional Sidebar (Only if sidebar or extra info exists) */}
        {sidebar && (
          <aside className="w-64 flex flex-col gap-2 shrink-0 overflow-auto">
            {sidebar}
          </aside>
        )}
      </div>
    </div>

  );
}
