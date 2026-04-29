import React from "react";
import { DocumentToolbar } from "./DocumentToolbar";
import { DocumentStatusBadge } from "./DocumentStatusBadge";

interface DocumentShellProps {
  title: string;
  subtitle?: string;
  docNumber: string;
  docDate: string;
  status: string;
  onNew?: () => void;
  onSave?: () => void;
  onSaveAndPrint?: () => void;
  onPost?: () => void;
  onDelete?: () => void;
  onClose?: () => void;
  onRefresh?: () => void;
  saving?: boolean;
  posting?: boolean;
  canPost?: boolean;
  canDelete?: boolean;
  canEdit?: boolean;
  children: React.ReactNode;
  summaryPanel?: React.ReactNode;
}

export function DocumentShell({
  title,
  subtitle,
  docNumber,
  docDate,
  status,
  onNew,
  onSave,
  onSaveAndPrint,
  onPost,
  onDelete,
  onClose,
  onRefresh,
  saving,
  posting,
  canPost,
  canDelete,
  canEdit,
  children,
  summaryPanel,
}: DocumentShellProps) {
  return (
    <div className="flex flex-col h-full min-h-screen bg-slate-100" dir="rtl">
      {/* Page Title Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-base font-black text-slate-800">{title}</h1>
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
          <DocumentStatusBadge status={status} size="md" />
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <kbd className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">Tab</kbd> للانتقال
          <kbd className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">Enter</kbd> سطر جديد
          <kbd className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">Ctrl+Del</kbd> حذف سطر
        </div>
      </div>

      {/* Toolbar */}
      <DocumentToolbar
        docNumber={docNumber}
        docDate={docDate}
        status={status}
        onNew={onNew}
        onSave={onSave}
        onSaveAndPrint={onSaveAndPrint}
        onPost={onPost}
        onDelete={onDelete}
        onClose={onClose}
        onRefresh={onRefresh}
        saving={saving}
        posting={posting}
        canPost={canPost}
        canDelete={canDelete}
        canEdit={canEdit}
      />

      {/* Content Area */}
      <div className="flex-1 flex gap-0 overflow-hidden">
        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {children}
        </div>

        {/* Summary sidebar */}
        {summaryPanel && (
          <div className="w-64 flex-shrink-0 p-3 border-r border-slate-200 bg-white overflow-y-auto">
            {summaryPanel}
          </div>
        )}
      </div>
    </div>
  );
}
