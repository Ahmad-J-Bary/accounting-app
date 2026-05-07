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
      <header className="flex items-center justify-between px-8 py-5 bg-white border-b border-slate-200/60 shadow-[0_1px_2px_rgba(0,0,0,0.03)] shrink-0 sticky top-0 z-20">
        <div className="flex items-center gap-5">
          <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-lg shadow-slate-200 shrink-0">
            <span className="text-xl font-black">ERP</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">{title}</h1>
              {statusBadge}
            </div>
            <p className="text-xs text-slate-400 font-medium mt-1">نظام المحاسبة وإدارة الموارد • المستندات المالية</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {toolbar}
        </div>
      </header>

      {/* 2. Main Content Layout */}
      <div className="flex-1 flex overflow-hidden p-6 gap-6">
        
        {/* Left/Main Column: Document Details & Grid */}
        <div className="flex-1 flex flex-col min-w-0 gap-6 overflow-hidden">
          
          {/* Header Info Card */}
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-8 shrink-0 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-bl-full opacity-50 -mr-16 -mt-16" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
              {headerFields}
            </div>
          </div>

          {/* Line Items Table Area */}
          <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden transition-all hover:shadow-md">
            <div className="flex-1 overflow-auto custom-scrollbar">
              {lineItemsGrid}
            </div>
            
            {/* Optional Footer Notes inside the table shell */}
            {footer && (
              <div className="p-5 border-t border-slate-100 bg-slate-50/40">
                {footer}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Summary & Controls */}
        <aside className="w-80 flex flex-col gap-6 shrink-0">
          {/* Summary Panel (Sticky calculation area) */}
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden flex flex-col sticky top-0 transition-all hover:shadow-md">
            <div className="p-4 flex flex-col gap-3">
              {summaryPanel}
            </div>
          </div>

          {/* Optional Sidebar Components (Attachments, History, etc) */}
          {sidebar}
        </aside>
      </div>
    </div>

  );
}
