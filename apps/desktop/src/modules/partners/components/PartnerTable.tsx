import { useMemo, useState, useCallback } from "react";
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { TableShell } from '@widgets/table-shell/TableShell';
import type { SummaryColumn } from '@widgets/table-shell/TableSummary';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useUnifiedColumns } from "@shared/hooks";
import type { PartnerDto } from "@erp/shared-types";
import { ArrowUpDown, Eye, Pencil, Trash2, NotebookText, Receipt, Users } from "lucide-react";
import { ActionsDropdown } from "@shared/ui/actions-dropdown";

type PartnerWithRatios = PartnerDto & { 
  calculatedRatio: number; 
  calculatedCapitalRatio: number; 
  displayAmountLocal: number; 
  displayAmountUsd: number 
};

interface PartnerTableProps {
  partners: PartnerWithRatios[];
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
  onView: (p: PartnerDto) => void;
  onEdit: (p: PartnerDto) => void;
  onDelete: (id: string) => void;
  onJournal: (p: PartnerDto) => void;
  onDocument: (p: PartnerDto) => void;
  selectedId?: string | null;
  onRowClick?: (p: PartnerDto) => void;
}

type SortField = "name" | "amount_usd" | "amount_local" | "capital_ratio" | "ratio";

interface SortableHeaderProps {
  field: SortField;
  label: string;
  currentField: SortField;
  direction: "asc" | "desc";
  onSort: (field: SortField) => void;
}

const SortableHeader = ({ field, label, currentField, direction, onSort }: SortableHeaderProps) => {
  const getSortIcon = (f: SortField) => {
    if (currentField !== f) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return direction === "asc" 
      ? <ArrowUpDown className="w-3 h-3 rotate-180" /> 
      : <ArrowUpDown className="w-3 h-3" />;
  };

  return (
    <button 
      onClick={(e) => { e.stopPropagation(); onSort(field); }}
      className="flex items-center gap-1 hover:text-slate-900 transition-colors"
    >
      {label}
      {getSortIcon(field)}
    </button>
  );
};

export function PartnerTable({ 
  partners, 
  loading, 
  search, 
  onSearchChange, 
  onView,
  onEdit,
  onDelete,
  onJournal,
  onDocument,
  selectedId, 
  onRowClick 
}: PartnerTableProps) {
  const { formatAmount } = useCurrencyContext();
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const handleSort = useCallback((field: SortField) => {
    setSortDirection(prev => {
      if (sortField === field) {
        return prev === "asc" ? "desc" : "asc";
      }
      return "asc";
    });
    setSortField(field);
  }, [sortField]);

  const sortedPartners = useMemo(() => {
    const sorted = [...partners].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "name": comparison = (a.name || "").localeCompare(b.name || "", "ar"); break;
        case "amount_usd": comparison = a.displayAmountUsd - b.displayAmountUsd; break;
        case "amount_local": comparison = a.displayAmountLocal - b.displayAmountLocal; break;
        case "capital_ratio": comparison = a.calculatedCapitalRatio - b.calculatedCapitalRatio; break;
        case "ratio": comparison = a.calculatedRatio - b.calculatedRatio; break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
    return sorted;
  }, [partners, sortField, sortDirection]);

  const allColumns = useMemo<UnifiedColumn<PartnerWithRatios>[]>(() => [
    { 
      id: "name",
      header: <SortableHeader field="name" label="اسم الشريك" currentField={sortField} direction={sortDirection} onSort={handleSort} />, 
      label: "اسم الشريك",
      accessor: (p: PartnerWithRatios) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
            <Users className="w-4 h-4" />
          </div>
          <span className="font-bold text-slate-800">{p.name}</span>
        </div>
      ),
      className: "min-w-[200px]"
    },
    { 
      id: "amount_usd",
      header: <SortableHeader field="amount_usd" label="رأس المال ($)" currentField={sortField} direction={sortDirection} onSort={handleSort} />,
      label: "رأس المال ($)",
      accessor: (p: PartnerWithRatios) => formatAmount(p.displayAmountUsd, { currencyCode: "USD" }),
      align: "left",
      className: "tabular-nums font-black text-blue-600"
    },
    { 
      id: "amount_local",
      header: <SortableHeader field="amount_local" label="رأس المال (ل.س)" currentField={sortField} direction={sortDirection} onSort={handleSort} />,
      label: "رأس المال (ل.س)",
      accessor: (p: PartnerWithRatios) => formatAmount(p.displayAmountLocal, { currencyCode: "SYP" }),
      align: "left",
      className: "tabular-nums font-black text-slate-900"
    },
    { 
      id: "capital_ratio",
      header: <SortableHeader field="capital_ratio" label="نسبة رأس المال" currentField={sortField} direction={sortDirection} onSort={handleSort} />,
      label: "نسبة المساهمة في رأس المال",
      accessor: (p: PartnerWithRatios) => (
        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-black tabular-nums">
          {p.calculatedCapitalRatio.toFixed(2)}%
        </span>
      ),
      align: "center",
      className: "w-28"
    },
    { 
      id: "ratio",
      header: <SortableHeader field="ratio" label="نسبة الأرباح" currentField={sortField} direction={sortDirection} onSort={handleSort} />,
      label: "نسبة توزيع الأرباح",
      accessor: (p: PartnerWithRatios) => (
        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black tabular-nums">
          {p.calculatedRatio.toFixed(2)}%
        </span>
      ),
      align: "center",
      className: "w-28"
    },
    {
      id: "actions",
      header: "إجراءات",
      label: "إجراءات",
      accessor: (p: PartnerWithRatios) => (
        <ActionsDropdown
          actions={[
            { label: "عرض الملف", icon: <Eye className="w-4 h-4" />, onClick: () => onView(p) },
            { label: "تعديل البيانات", icon: <Pencil className="w-4 h-4" />, onClick: () => onEdit(p), className: "text-blue-600 focus:text-blue-600" },
            { label: "حذف الشريك", icon: <Trash2 className="w-4 h-4" />, onClick: () => onDelete(p.id), className: "text-red-600 focus:text-red-600" },
            { label: "اليومية", icon: <NotebookText className="w-4 h-4" />, onClick: () => onJournal(p) },
            { label: "سند مسحوبات", icon: <Receipt className="w-4 h-4" />, onClick: () => onDocument(p) },
          ]}
        />
      ),
      align: "center",
      className: "w-[80px]"
    }
  ], [formatAmount, sortField, sortDirection, handleSort, onView, onEdit, onDelete, onJournal, onDocument]);

  const { enrichedColumns, toolbarColumns, toggleColumn } = useUnifiedColumns({
    tableId: "partners-unified",
    columns: allColumns,
    defaultVisible: ["name", "amount_usd", "amount_local", "capital_ratio", "ratio", "actions"],
  });

  const summaryColumns = useMemo<SummaryColumn[]>(() => {
    const totalUSD = sortedPartners.reduce((s, p) => s + p.displayAmountUsd, 0);
    const totalSYP = sortedPartners.reduce((s, p) => s + p.displayAmountLocal, 0);
    const totalCapitalRatio = sortedPartners.reduce((s, p) => s + p.calculatedCapitalRatio, 0);
    const totalRatio = sortedPartners.reduce((s, p) => s + p.calculatedRatio, 0);
    const colIds = enrichedColumns.map(c => c.id);
    return colIds.map(id => {
      switch (id) {
        case 'name':
          return { id: 'count', label: '', value: `${sortedPartners.length} شريك`, className: 'text-slate-500 font-medium' };
        case 'amount_usd':
          return { id: 'total_usd', label: 'الإجمالي', value: formatAmount(totalUSD, { currencyCode: "USD" }), align: 'left' as const, className: 'text-blue-600 font-black' };
        case 'amount_local':
          return { id: 'total_syp', label: 'الإجمالي', value: formatAmount(totalSYP, { currencyCode: "SYP" }), align: 'left' as const, className: 'text-slate-900 font-black' };
        case 'capital_ratio':
          return { id: 'total_capital_ratio', label: 'المجموع', value: `${totalCapitalRatio.toFixed(2)}%`, align: 'center' as const, className: 'text-blue-700 font-black' };
        case 'ratio':
          return { id: 'total_ratio', label: 'المجموع', value: `${totalRatio.toFixed(2)}%`, align: 'center' as const, className: 'text-emerald-700 font-black' };
        default:
          return { id: `${id}_spacer`, label: '', value: '' };
      }
    });
  }, [sortedPartners, formatAmount, enrichedColumns]);

  return (
    <TableShell
      title="سجل الشركاء"
      search={search}
      onSearchChange={onSearchChange}
      columns={toolbarColumns}
      onColumnToggle={toggleColumn}
    >
      <UnifiedTable<PartnerWithRatios>
        data={sortedPartners}
        columns={enrichedColumns}
        loading={loading}
        onRowClick={onRowClick}
        selectedId={selectedId}
        emptyMessage={search ? "لا توجد نتائج بحث تطابق استعلامك" : "لا يوجد شركاء مسجلون حالياً"}
        summary={summaryColumns}
      />
    </TableShell>
  );
}
