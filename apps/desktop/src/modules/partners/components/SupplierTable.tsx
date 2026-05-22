import { useMemo, useState, useCallback } from "react";
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { TableShell } from '@widgets/table-shell/TableShell';
import type { SummaryColumn } from '@widgets/table-shell/TableSummary';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useUnifiedColumns } from "@shared/hooks";
import type { SupplierDto } from "@erp/shared-types";
import { ArrowUpDown, Eye, Pencil, Trash2, NotebookText, Receipt, Truck } from "lucide-react";
import { ActionsDropdown } from "@shared/ui/actions-dropdown";

interface SupplierTableProps {
  suppliers: SupplierDto[];
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
  onView: (s: SupplierDto) => void;
  onEdit: (s: SupplierDto) => void;
  onDelete?: (id: string) => void;
  onJournal?: (s: SupplierDto) => void;
  onDocument?: (s: SupplierDto) => void;
  selectedId?: string | null;
}

type SortField = "code" | "name" | "balance";

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

export function SupplierTable({ suppliers, loading, search, onSearchChange, onView, onEdit, onDelete, onJournal, onDocument, selectedId }: SupplierTableProps) {
  const { currencies, formatAmount } = useCurrencyContext();
  const [sortField, setSortField] = useState<SortField>("code");
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

  const sortedSuppliers = useMemo(() => {
    const sorted = [...suppliers].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "code": comparison = (parseInt(a.code || "0", 10) || 0) - (parseInt(b.code || "0", 10) || 0); break;
        case "name": comparison = (a.name || "").localeCompare(b.name || "", "ar"); break;
        case "balance": comparison = (Number(a.balance) || 0) - (Number(b.balance) || 0); break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
    return sorted;
  }, [suppliers, sortField, sortDirection]);

  const allColumns = useMemo<UnifiedColumn<SupplierDto>[]>(() => {
    const cols: UnifiedColumn<SupplierDto>[] = [
      { 
        id: "code",
        header: <SortableHeader field="code" label="#" currentField={sortField} direction={sortDirection} onSort={handleSort} />, 
        label: "رقم الحساب",
        accessor: (s) => (
          <span className="font-black text-slate-500">{s.code || "—"}</span>
        ),
        className: "w-16",
        align: "center"
      },
      { 
        id: "name",
        header: <SortableHeader field="name" label="اسم المورد" currentField={sortField} direction={sortDirection} onSort={handleSort} />, 
        label: "اسم المورد",
        accessor: (s) => (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-600 shrink-0">
              <Truck className="w-4 h-4" />
            </div>
            <span className="font-bold text-slate-800">{s.name}</span>
          </div>
        ),
        className: "min-w-[200px]"
      },
      { 
        id: "phone",
        header: "رقم الهاتف", 
        label: "رقم الهاتف",
        accessor: (s) => s.phone || "—", 
        className: "tabular-nums text-slate-500 w-[140px]" 
      },
    ];

    // Account Status
    cols.push({
      id: "status",
      header: <SortableHeader field="balance" label="حالة الحساب" currentField={sortField} direction={sortDirection} onSort={handleSort} />,
      label: "حالة الحساب",
      accessor: (s) => {
        const bal = Number(s.balance || 0);
        if (bal === 0) return <span className="text-slate-300">—</span>;
        const isCredit = bal > 0;
        return (
          <span className={`font-bold ${isCredit ? "text-emerald-600" : "text-red-600"}`}>
            {isCredit ? "دائن" : "مدين"}
          </span>
        );
      },
      align: "center",
      className: "w-[90px]"
    });

    // Balances
    currencies.forEach(curr => {
      const symbol = curr.symbol || curr.code;
      cols.push({
        id: `balance_${curr.code}`,
        header: <SortableHeader field="balance" label={`الرصيد (${symbol})`} currentField={sortField} direction={sortDirection} onSort={handleSort} />,
        label: `الرصيد (${symbol})`,
        accessor: (s) => {
          const absBal = Math.abs(Number(s.balance || 0));
          return absBal > 0 ? formatAmount(absBal, { currencyCode: curr.code }) : "—";
        },
        align: "left",
        className: "tabular-nums font-bold text-slate-800"
      });
    });

    // Actions
    cols.push({
      id: "actions",
      header: "إجراءات",
      label: "إجراءات",
      accessor: (s) => (
        <ActionsDropdown
          actions={[
            { label: "عرض الملف", icon: <Eye className="w-4 h-4" />, onClick: () => onView(s) },
            { label: "تعديل البيانات", icon: <Pencil className="w-4 h-4" />, onClick: () => onEdit(s), className: "text-blue-600 focus:text-blue-600" },
            ...(onDelete ? [{ label: "حذف المورد", icon: <Trash2 className="w-4 h-4" />, onClick: () => onDelete(s.id), className: "text-red-600 focus:text-red-600" }] : []),
            ...(onJournal ? [{ label: "اليومية", icon: <NotebookText className="w-4 h-4" />, onClick: () => onJournal(s) }] : []),
            ...(onDocument ? [{ label: "سند دفع", icon: <Receipt className="w-4 h-4" />, onClick: () => onDocument(s) }] : []),
          ]}
        />
      ),
      align: "center",
      className: "w-[80px]"
    });

    return cols;
  }, [currencies, formatAmount, sortField, sortDirection, handleSort, onView, onEdit, onDelete, onJournal, onDocument]);

  const { enrichedColumns, toolbarColumns, toggleColumn } = useUnifiedColumns({
    tableId: "suppliers-unified",
    columns: allColumns,
    defaultVisible: ["code", "name", "phone", "status", ...currencies.map(c => `balance_${c.code}`), "actions"],
  });

  const summaryColumns = useMemo<SummaryColumn[]>(() => {
    const totalBal = sortedSuppliers.reduce((sum, s) => sum + Number(s.balance || 0), 0);
    const absTotal = Math.abs(totalBal);
    const overall = totalBal > 0 ? "دائن" : totalBal < 0 ? "مدين" : null;
    const overallColor = totalBal > 0 ? 'text-emerald-600' : totalBal < 0 ? 'text-red-600' : 'text-slate-400';

    const colIds = enrichedColumns.map(c => c.id);
    return colIds.map(id => {
      if (id === 'name') return { id: 'count', label: '', value: `${sortedSuppliers.length} مورد`, className: 'text-slate-500 font-medium' };
      if (id === 'code' || id === 'phone' || id === 'actions') return { id: `${id}_spacer`, label: '', value: '' };
      if (id === 'status') {
        return { id: 'status_summary', label: '', value: overall ? `الرصيد: ${overall}` : "—", className: `${overallColor} font-bold` };
      }
      const match = id.match(/^balance_(.+)$/);
      if (match) {
        const currCode = match[1];
        return {
          id: `${id}_summary`,
          label: '',
          value: absTotal > 0 ? formatAmount(absTotal, { currencyCode: currCode }) + ` (${overall})` : "—",
          align: 'left' as const,
          className: `${overallColor} font-bold`
        };
      }
      return { id: `${id}_spacer`, label: '', value: '' };
    });
  }, [sortedSuppliers, formatAmount, enrichedColumns]);

  return (
    <TableShell
      title="سجل الموردين"
      search={search}
      onSearchChange={onSearchChange}
      columns={toolbarColumns}
      onColumnToggle={toggleColumn}
    >
      <UnifiedTable
        data={sortedSuppliers}
        columns={enrichedColumns}
        loading={loading}
        onRowClick={onView}
        selectedId={selectedId}
        emptyMessage={search ? "لا توجد نتائج بحث تطابق استعلامك" : "قائمة الموردين فارغة حالياً"}
        summary={summaryColumns}
      />
    </TableShell>
  );
}
