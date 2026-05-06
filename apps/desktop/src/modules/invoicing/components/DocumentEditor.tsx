import React, { ReactNode } from "react";
import { FinancialDocumentTemplate } from "@widgets/templates/FinancialDocumentTemplate";
import { GenericDocumentGrid, DocumentColumn } from "@widgets/document-shell/GenericDocumentGrid";
import { SummaryPanel } from "@widgets/document-shell/SummaryPanel";
import { useDocumentEditor } from "../hooks/useDocumentEditor";
import { MaterialDto } from "@erp/shared-types";
import { DocumentStatusBadge } from "./DocumentStatusBadge";

interface DocumentEditorProps {
  title: string;
  docNumber: string;
  docDate: string;
  status: string;
  columns: DocumentColumn[];
  headerFields: ReactNode;
  materials: MaterialDto[];
  toolbar: ReactNode;
  summaryExtra?: ReactNode;
  onSave?: () => void;
  // ... other props
}

/**
 * A unified editor component for Sales, Purchase, and Opening Balance.
 * Handles the common layout, grid interactions, and summary calculations.
 */
export function DocumentEditor({
  title,
  docNumber,
  docDate,
  status,
  columns,
  headerFields,
  materials,
  toolbar,
  summaryExtra,
}: DocumentEditorProps) {
  const { 
    lines, 
    updateLine, 
    addLine, 
    removeLine, 
    selectMaterial, 
    totals 
  } = useDocumentEditor();

  return (
    <FinancialDocumentTemplate
      title={title}
      statusBadge={<DocumentStatusBadge status={status} />}
      toolbar={toolbar}
      headerFields={headerFields}
      lineItemsGrid={
        <GenericDocumentGrid 
          columns={columns}
          lines={lines}
          onUpdateLine={updateLine}
          onRemoveLine={removeLine}
          onAddLine={addLine}
          onSelectMaterial={selectMaterial}
          materials={materials}
          readOnly={status === "Posted"}
        />
      }
      summaryPanel={
        <SummaryPanel 
          subtotal={totals.subtotal}
          net={totals.total}
          status={status as any}
        >
          {summaryExtra}
        </SummaryPanel>
      }
    />
  );
}
