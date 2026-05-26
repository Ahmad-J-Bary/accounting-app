import { useMemo, useState, useCallback } from "react";
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { TableShell } from '@widgets/table-shell/TableShell';
import type { SummaryColumn } from '@widgets/table-shell/TableSummary';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useUnifiedColumns } from "@shared/hooks";
import type { CustomerDto } from "@erp/shared-types";
import { ArrowUpDown, Eye, Pencil, Trash2, NotebookText, Receipt, User } from "lucide-react";
import { ActionsDropdown } from "@shared/ui/actions-dropdown";

interface CustomerTableProps {
  customers: CustomerDto[];
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
  onView: (c: CustomerDto) => void;
  onEdit: (c: CustomerDto) => void;
  onDelete?: (id: string) => void;
  onJournal?: (c: CustomerDto) => void;
  onDocument?: (c: CustomerDto) => void;
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

export function CustomerTable({ customers, loading, search, onSearchChange, onView, onEdit, onDelete, onJournal, onDocument, selectedId }: CustomerTableProps) {
  const { currencies, formatAmount, toBase } = useCurrencyContext();
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

  const sortedCustomers = useMemo(() => {
    const sorted = [...customers].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "code": comparison = (parseInt(a.code || "0", 10) || 0) - (parseInt(b.code || "0", 10) || 0); break;
        case "name": comparison = (a.name || "").localeCompare(b.name || "", "ar"); break;
        case "balance": comparison = (Number(a.balance) || 0) - (Number(b.balance) || 0); break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
    return sorted;
  }, [customers, sortField, sortDirection]);

  const allColumns = useMemo<UnifiedColumn<CustomerDto>[]>(() => {
    const cols: UnifiedColumn<CustomerDto>[] = [
      { 
        id: "code",
        header: <SortableHeader field="code" label="#" currentField={sortField} direction={sortDirection} onSort={handleSort} />, 
        label: "رقم الحساب",
        accessor: (c) => (
          <span className="font-black text-slate-500">{c.code || "—"}</span>
        ),
        className: "w-16",
        align: "center"
      },
      { 
        id: "name",
        header: <SortableHeader field="name" label="اسم العميل" currentField={sortField} direction={sortDirection} onSort={handleSort} />, 
        label: "اسم العميل",
        accessor: (c) => (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
              <User className="w-4 h-4" />
            </div>
            <span className="font-bold text-slate-800">{c.name}</span>
          </div>
        ),
        className: "min-w-[200px]"
      },
      { 
        id: "phone",
        header: "رقم الهاتف", 
        label: "رقم الهاتف",
        accessor: (c) => c.phone || "—", 
        className: "tabular-nums text-slate-500 w-[140px]" 
      },
    ];

    // Account Status
    cols.push({
      id: "status",
      header: <SortableHeader field="balance" label="حالة الحساب" currentField={sortField} direction={sortDirection} onSort={handleSort} />,
      label: "حالة الحساب",
      accessor: (c) => {
        const bal = Number(c.balance || 0);
        if (bal === 0) return <span className="text-slate-300">—</span>;
        const isDebit = bal > 0;
        return (
          <span className={`font-bold ${isDebit ? "text-red-600" : "text-emerald-600"}`}>
            {isDebit ? "مدين" : "دائن"}
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
        accessor: (c) => {
          const absBal = Math.abs(Number(c.balance || 0));
          if (absBal === 0) return "—";
          const baseAmount = toBase(absBal, c.currency);
          return formatAmount(baseAmount, { currencyCode: curr.code });
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
      accessor: (c) => (
        <ActionsDropdown
          actions={[
            { label: "عرض الملف", icon: <Eye className="w-4 h-4" />, onClick: () => onView(c) },
            { label: "تعديل البيانات", icon: <Pencil className="w-4 h-4" />, onClick: () => onEdit(c), className: "text-blue-600 focus:text-blue-600" },
            ...(onDelete ? [{ label: "حذف العميل", icon: <Trash2 className="w-4 h-4" />, onClick: () => onDelete(c.id), className: "text-red-600 focus:text-red-600" }] : []),
            ...(onJournal ? [{ label: "اليومية", icon: <NotebookText className="w-4 h-4" />, onClick: () => onJournal(c) }] : []),
            ...(onDocument ? [{ label: "سند قبض", icon: <Receipt className="w-4 h-4" />, onClick: () => onDocument(c) }] : []),
          ]}
        />
      ),
      align: "center",
      className: "w-[80px]"
    });

    return cols;
  }, [currencies, formatAmount, toBase, sortField, sortDirection, handleSort, onView, onEdit, onDelete, onJournal, onDocument]);

  const { enrichedColumns, toolbarColumns, toggleColumn } = useUnifiedColumns({
    tableId: "customers-unified",
    columns: allColumns,
    defaultVisible: ["code", "name", "phone", "status", ...currencies.map(c => `balance_${c.code}`), "actions"],
  });

  const summaryColumns = useMemo<SummaryColumn[]>(() => {
    const totalBal = sortedCustomers.reduce((sum, c) => sum + Number(c.balance || 0), 0);
    const overall = totalBal > 0 ? "مدين" : totalBal < 0 ? "دائن" : null;
    const overallColor = totalBal > 0 ? 'text-red-600' : totalBal < 0 ? 'text-emerald-600' : 'text-slate-400';

    const baseTotal = sortedCustomers.reduce((sum, c) => {
      const bal = Math.abs(Number(c.balance || 0));
      if (bal === 0) return sum;
      return sum + toBase(bal, c.currency);
    }, 0);

    const colIds = enrichedColumns.map(c => c.id);
    return colIds.map(id => {
      if (id === 'name') return { id: 'count', columnId: 'name', label: '', value: `${sortedCustomers.length} عميل`, className: 'text-slate-500 font-medium' };
      if (id === 'code' || id === 'phone' || id === 'actions') return { id: `${id}_spacer`, columnId: id, label: '', value: '' };
      if (id === 'status') {
        return { id: 'status_summary', columnId: 'status', label: '', value: overall ? `الرصيد: ${overall}` : "—", className: `${overallColor} font-bold` };
      }
      const match = id.match(/^balance_(.+)$/);
      if (match) {
        const currCode = match[1];
        return {
          id: `${id}_summary`,
          columnId: id,
          label: '',
          value: baseTotal > 0 ? formatAmount(baseTotal, { currencyCode: currCode }) : "—",
          align: 'left' as const,
          className: `${overallColor} font-bold`
        };
      }
      return { id: `${id}_spacer`, label: '', value: '' };
    });
  }, [sortedCustomers, formatAmount, toBase, enrichedColumns]);

  return (
    <TableShell
      title="سجل العملاء"
      search={search}
      onSearchChange={onSearchChange}
      columns={toolbarColumns}
      onColumnToggle={toggleColumn}
    >
      <UnifiedTable
        data={sortedCustomers}
        columns={enrichedColumns}
        loading={loading}
        onRowClick={onView}
        selectedId={selectedId}
        emptyMessage={search ? "لا توجد نتائج بحث تطابق استعلامك" : "لا يوجد عملاء مسجلون حالياً"}
        summary={summaryColumns}
      />
    </TableShell>
  );
}
