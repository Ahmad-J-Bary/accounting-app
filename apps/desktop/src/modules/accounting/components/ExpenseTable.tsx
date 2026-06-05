import { useMemo } from "react";
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { TableShell } from '@widgets/table-shell/TableShell';
import type { SummaryColumn } from '@widgets/table-shell/TableSummary';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useUnifiedColumns, useSortable, useTableColumns } from "@shared/hooks";
import type { AccountDto } from "@erp/shared-types";
import { NotebookText, Receipt } from "lucide-react";
import { TableActions } from "@widgets/table-shell/TableActions";


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

export function ExpenseTable({ expenses, loading, search, onSearchChange, onView, onEdit, onDelete, onJournal, onDocument, selectedId, parentCode }: ExpenseTableProps) {
  const { currencies, formatAmount, toBase } = useCurrencyContext();
  const { getAccountStatusColumn, getBalanceColumns, getSummaryColumns } = useTableColumns();
  
  const { sortedData: sortedExpenses, sortField, sortDirection, handleSort } = useSortable({
    data: expenses,
    defaultField: "code" as SortField,
    sortFn: (a, b, field, direction) => {
      let comparison = 0;
      switch (field) {
        case "code": comparison = (parseInt(codeSuffix(a.code || "0", parentCode), 10) || 0) - (parseInt(codeSuffix(b.code || "0", parentCode), 10) || 0); break;
        case "name": comparison = (a.name_ar || "").localeCompare(b.name_ar || "", "ar"); break;
        case "balance": comparison = (Number(a.balance) || 0) - (Number(b.balance) || 0); break;
      }
      return direction === "asc" ? comparison : -comparison;
    }
  });

  const allColumns = useMemo<UnifiedColumn<AccountDto>[]>(() => {
    const cols: UnifiedColumn<AccountDto>[] = [
      {
        id: "code",
        header: "#",
        label: "كود الحساب",
        accessor: (c) => {
          const code = c.code || "";
          const suffix = parentCode && code.startsWith(parentCode)
            ? code.substring(parentCode.length)
            : code;
          return suffix || "";
        },
        className: "font-black text-slate-900 text-center"
      },
      {
        id: "name",
        header: "اسم البند",
        label: "اسم البند",
        accessor: "name_ar",
        className: "font-bold text-slate-800"
      },
    ];

    // Account Status
    cols.push(getAccountStatusColumn("حالة الحساب"));

    // Balances
    currencies.forEach(curr => {
      const symbol = curr.symbol || curr.code;
      cols.push({
        id: `balance_${curr.code}`,
        header: `الرصيد (${symbol})`,
        label: `الرصيد (${symbol})`,
        accessor: (c) => {
          const absBal = Math.abs(Number(c.balance || 0));
          if (absBal === 0) return "";
          const baseAmount = toBase(absBal, c.currency);
          return formatAmount(baseAmount, { currencyCode: curr.code });
        },
        className: "tabular-nums font-black text-slate-900"
      });
    });

    cols.push({
      id: "actions",
      header: "إجراءات",
      label: "إجراءات",
      accessor: (e) => (
        <TableActions
          onView={() => onView(e)}
          onEdit={() => onEdit(e)}
          onDelete={onDelete ? () => onDelete(e.id) : undefined}
          extraActions={[
            ...(onJournal ? [{ label: "اليومية", icon: NotebookText, onClick: () => onJournal(e) }] : []),
            ...(onDocument ? [{ label: "سند صرف", icon: Receipt, onClick: () => onDocument(e) }] : []),
          ]}
        />
      )
    });

    return cols;
  }, [currencies, formatAmount, toBase, parentCode, onView, onEdit, onDelete, onJournal, onDocument, getAccountStatusColumn]);

  const defaultVisible = useMemo(() => {
    const def = ["code", "name", "status"];
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
    const overall = totalBal > 0 ? "مدين" : totalBal < 0 ? "دائن" : null;
    const overallColor = totalBal > 0 ? 'text-red-600' : totalBal < 0 ? 'text-emerald-600' : 'text-slate-400';

    const baseTotal = sortedExpenses.reduce((sum, e) => {
      const bal = Math.abs(Number(e.balance || 0));
      if (bal === 0) return sum;
      return sum + toBase(bal, e.currency);
    }, 0);

    const colIds = enrichedColumns.map(c => c.id);
    return colIds.map(id => {
      if (id === 'name') {
        return { id: 'name_summary', columnId: 'name', label: '', value: 'المجموع', className: 'text-slate-600 font-bold' };
      }
      if (id === 'code' || id === 'actions') {
        return { id: `${id}_spacer`, columnId: id, label: '', value: '' };
      }
      if (id === 'status') {
        return {
          id: 'status_summary',
          columnId: 'status',
          label: '',
          value: overall ? `الرصيد: ${overall}` : "—",
          className: `${overallColor} font-bold`
        };
      }
      const match = id.match(/^balance_(.+)$/);
      if (match) {
        const currCode = match[1];
        return {
          id: `${id}_summary`,
          columnId: id,
          label: '',
          value: baseTotal > 0 ? formatAmount(baseTotal, { currencyCode: currCode }) : "—",
          className: `${overallColor} font-bold`
        };
      }
      return { id: `${id}_spacer`, columnId: id, label: '', value: '' };
    });
  }, [sortedExpenses, formatAmount, toBase, enrichedColumns]);

  return (
    <TableShell
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="بحث باسم البند أو الكود..."
      columns={toolbarColumns}
      onColumnToggle={toggleColumn}
      showToolbar={true}
    >
      <UnifiedTable
        data={sortedExpenses}
        columns={enrichedColumns}
        loading={loading}
        enableResize
        tableId="expenses"
        sortField={sortField}
        sortDirection={sortDirection}
        onRowClick={onView}
        selectedId={selectedId}
        onHeaderClick={(col) => {
          if (col.id === "code") handleSort("code");
          else if (col.id === "name") handleSort("name");
          else if (col.id === "status" || col.id?.startsWith("balance_")) handleSort("balance");
        }}
        emptyMessage={search ? "لا توجد نتائج بحث تطابق استعلامك" : "لا توجد بنود مصاريف مسجلة حالياً"}
        summary={summaryColumns}
      />
    </TableShell>
  );
}
