import { useMemo, useState, useCallback } from "react";
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { TableShell } from '@widgets/table-shell/TableShell';
import type { SummaryColumn } from '@widgets/table-shell/TableSummary';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useUnifiedColumns } from "@shared/hooks";
import type { AccountDto } from "@erp/shared-types";
import { ArrowUpDown, Eye, Pencil, Trash2, NotebookText, Receipt } from "lucide-react";
import { ActionsDropdown } from "@shared/ui/actions-dropdown";

interface ExpenseTableProps {
  expenses: AccountDto[];
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
  onView: (e: AccountDto) => void;
  onEdit: (e: AccountDto) => void;
  onDelete?: (id: string) => void;
  onJournal?: (e: AccountDto) => void;
  onDocument?: (e: AccountDto) => void;
  selectedId?: string | null;
  parentCode?: string;
}

type SortField = "code" | "name" | "balance";

const codeSuffix = (code: string, prefix?: string) => {
  if (prefix && code.startsWith(prefix)) return code.substring(prefix.length);
  return code;
};

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
      onClick={() => onSort(field)}
      className="flex items-center gap-1 hover:text-slate-700 transition-colors"
    >
      {label}
      {getSortIcon(field)}
    </button>
  );
};

export function ExpenseTable({ expenses, loading, search, onSearchChange, onView, onEdit, onDelete, onJournal, onDocument, selectedId, parentCode }: ExpenseTableProps) {
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

  const sortedExpenses = useMemo(() => {
    const sorted = [...expenses].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "code":
          comparison = (parseInt(codeSuffix(a.code || "0", parentCode), 10) || 0) - (parseInt(codeSuffix(b.code || "0", parentCode), 10) || 0);
          break;
        case "name":
          comparison = (a.name_ar || "").localeCompare(b.name_ar || "", "ar");
          break;
        case "balance":
          comparison = (Number(a.balance) || 0) - (Number(b.balance) || 0);
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [expenses, sortField, sortDirection, parentCode]);

  const allColumns = useMemo<UnifiedColumn<AccountDto>[]>(() => {
    const cols: UnifiedColumn<AccountDto>[] = [
      {
        id: "#",
        header: <SortableHeader field="code" label="#" currentField={sortField} direction={sortDirection} onSort={handleSort} />,
        label: "كود الحساب",
        accessor: (c) => {
          const code = c.code || "";
          const suffix = parentCode && code.startsWith(parentCode)
            ? code.substring(parentCode.length)
            : code;
          return suffix || "—";
        },
        className: "text-center font-black text-slate-500 w-14"
      },
      {
        id: "name",
        header: <SortableHeader field="name" label="اسم البند" currentField={sortField} direction={sortDirection} onSort={handleSort} />,
        label: "اسم البند",
        accessor: "name_ar",
        className: "font-bold text-slate-800"
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
          return absBal > 0 ? formatAmount(absBal, { currencyCode: curr.code }) : "—";
        },
        align: "left",
        className: "tabular-nums font-medium text-[11px] text-slate-800"
      });
    });

    cols.push({
      id: "actions",
      header: "إجراءات",
      label: "إجراءات",
      accessor: (e) => (
        <ActionsDropdown
          actions={[
            { label: "عرض التفاصيل", icon: <Eye className="w-4 h-4" />, onClick: () => onView(e) },
            { label: "تعديل البيانات", icon: <Pencil className="w-4 h-4" />, onClick: () => onEdit(e), className: "text-blue-600 focus:text-blue-600" },
            ...(onDelete ? [{ label: "حذف البند", icon: <Trash2 className="w-4 h-4" />, onClick: () => onDelete(e.id), className: "text-red-600 focus:text-red-600" }] : []),
            ...(onJournal ? [{ label: "اليومية", icon: <NotebookText className="w-4 h-4" />, onClick: () => onJournal(e) }] : []),
            ...(onDocument ? [{ label: "سند صرف", icon: <Receipt className="w-4 h-4" />, onClick: () => onDocument(e) }] : []),
          ]}
        />
      ),
      align: "center",
      className: "w-[80px]"
    });

    return cols;
  }, [currencies, formatAmount, sortField, sortDirection, handleSort, parentCode, onView, onEdit, onDelete, onJournal, onDocument]);

  const defaultVisible = useMemo(() => {
    const def = ["#", "name", "status"];
    currencies.forEach(curr => {
      def.push(`balance_${curr.code}`);
    });
    def.push("actions");
    return def;
  }, [currencies]);

  const { enrichedColumns, toolbarColumns, toggleColumn } = useUnifiedColumns({
    tableId: "expenses-table",
    columns: allColumns,
    defaultVisible,
  });

  const summaryColumns = useMemo<SummaryColumn[]>(() => {
    const totalBal = sortedExpenses.reduce((sum, e) => sum + Number(e.balance || 0), 0);
    const absTotal = Math.abs(totalBal);

    const colIds = enrichedColumns.map(c => c.id);
    return colIds.map(id => {
      if (id === 'name') {
        return { id: 'name_summary', columnId: 'name', label: '', value: 'المجموع', className: 'text-slate-600 font-bold' };
      }
      if (id === '#' || id === 'actions') {
        return { id: `${id}_spacer`, columnId: id, label: '', value: '' };
      }
      if (id === 'status') {
        const statusLabel = totalBal > 0 ? 'الرصيد: مدين' : totalBal < 0 ? 'الرصيد: دائن' : '—';
        const statusColor = totalBal > 0 ? 'text-red-600' : totalBal < 0 ? 'text-emerald-600' : 'text-slate-400';
        return {
          id: 'status_summary',
          columnId: 'status',
          label: '',
          value: statusLabel,
          className: `${statusColor} font-bold`
        };
      }
      const match = id.match(/^balance_(.+)$/);
      if (match) {
        const currCode = match[1];
        return {
          id: `${id}_summary`,
          columnId: id,
          label: 'إجمالي',
          value: absTotal > 0 ? formatAmount(absTotal, { currencyCode: currCode }) : "—",
          align: 'left' as const,
          className: `text-red-600 font-bold`
        };
      }
      return { id: `${id}_spacer`, columnId: id, label: '', value: '' };
    });
  }, [sortedExpenses, formatAmount, enrichedColumns]);

  return (
    <TableShell
      search={search}
      onSearchChange={onSearchChange}
      columns={toolbarColumns}
      onColumnToggle={toggleColumn}
      showToolbar={true}
    >
      <UnifiedTable
        data={sortedExpenses}
        columns={enrichedColumns}
        loading={loading}
        onRowClick={onView}
        selectedId={selectedId}
        emptyMessage={search ? "لا توجد نتائج بحث تطابق استعلامك" : "لا توجد بنود مصاريف مسجلة حالياً"}
        summary={summaryColumns}
      />
    </TableShell>
  );
}
