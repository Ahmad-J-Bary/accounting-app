import { useMemo } from "react";
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { TableShell } from '@widgets/table-shell/TableShell';
import type { SummaryColumn } from '@widgets/table-shell/TableSummary';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useUnifiedColumns, useSortable, useTableColumns, useBaseCurrencyColumns } from "@shared/hooks";
import { formatNumber } from "@shared/lib/format";
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
  const { isBaseCurrency } = useBaseCurrencyColumns();
  const { getAccountStatusColumn } = useTableColumns();

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
          return suffix ? formatNumber(parseInt(suffix) || 0) : "";
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

    cols.push(getAccountStatusColumn("حالة الحساب"));

    currencies.forEach(curr => {
      const symbol = curr.symbol || curr.code;
      const isBase = isBaseCurrency(curr.code);
      cols.push({
        id: `balance_${curr.code}`,
        header: `الرصيد (${symbol})`,
        label: `الرصيد (${symbol})`,
        accessor: (c) => {
          const absBal = Math.abs(Number(c.balance || 0));
          if (absBal === 0) return "";
          const baseAmount = toBase(absBal, c.currency || "");
          return formatAmount(baseAmount, { currencyCode: curr.code });
        },
        className: isBase
          ? "tabular-nums font-black text-slate-900"
          : "tabular-nums font-medium text-slate-400"
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
  }, [currencies, formatAmount, toBase, parentCode, onView, onEdit, onDelete, onJournal, onDocument, getAccountStatusColumn, isBaseCurrency]);

  // Default visible: only base currency's balance column is visible.
  // Secondary currency balances are hidden by default (user can toggle on).
  const defaultVisible = useMemo(() => {
    const def: string[] = ["code", "name", "status"];
    currencies.forEach(curr => {
      if (isBaseCurrency(curr.code)) {
        def.push(`balance_${curr.code}`);
      }
    });
    def.push("actions");
    return def;
  }, [currencies, isBaseCurrency]);

  const { enrichedColumns, toolbarColumns, toggleColumn, resetToDefault, isModified } = useUnifiedColumns({
    tableId: "expenses-table",
    columns: allColumns,
    defaultVisible,
  });

  const summaryColumns = useMemo<SummaryColumn[]>(() => {
    const totalBal = sortedExpenses.reduce((sum, e) => sum + Number(e.balance || 0), 0);
    const overallColor = totalBal > 0 ? 'text-red-600' : totalBal < 0 ? 'text-emerald-600' : 'text-slate-400';

    const baseTotal = sortedExpenses.reduce((sum, e) => {
      const effBal = (e.debit !== undefined && e.credit !== undefined)
        ? Number(e.debit || 0) - Number(e.credit || 0)
        : Number(e.balance || 0);
      if (effBal === 0) return sum;
      return sum + toBase(effBal, e.currency || "");
    }, 0);

    return enrichedColumns.map((col) => {
      const id = col.id;
      if (id === 'name') {
        return { id: 'name_summary', columnId: 'name', label: '', value: `${sortedExpenses.length} بند`, className: 'text-slate-600 font-medium' };
      }
      if (id === 'code' || id === 'status' || id === 'actions') {
        return { id: `${id}_spacer`, columnId: id, label: '', value: '' };
      }
      const match = id.match(/^balance_(.+)$/);
      if (match) {
        const currCode = match[1];
        const isBase = isBaseCurrency(currCode);
        const statusLabel = totalBal > 0 ? 'مدين' : 'دائن';
        return {
          id: `${id}_summary`,
          columnId: id,
          label: totalBal === 0 ? '—' : `الرصيد / ${statusLabel}`,
          value: baseTotal !== 0 ? formatAmount(baseTotal, { currencyCode: currCode }) : "—",
          className: isBase
            ? `${overallColor} font-black`
            : 'text-slate-500 font-extrabold',
        };
      }
      return { id: `${id}_spacer`, columnId: id, label: '', value: '' };
    });
  }, [sortedExpenses, formatAmount, toBase, enrichedColumns, isBaseCurrency]);

  return (
    <TableShell
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="بحث باسم البند أو الكود..."
      columns={toolbarColumns}
      onColumnToggle={toggleColumn}
      onColumnsReset={resetToDefault}
      columnsModified={isModified}
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
