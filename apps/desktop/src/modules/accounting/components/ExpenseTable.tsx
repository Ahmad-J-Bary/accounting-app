import { useMemo, useState, useCallback } from "react";
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { TableShell } from '@widgets/table-shell/TableShell';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useColumnPreferences } from "@shared/hooks/useColumnPreferences";
import type { AccountDto } from "@erp/shared-types";
import { ArrowUpDown, Eye, MoreHorizontal } from "lucide-react";
import { Button } from "@shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@shared/ui/dropdown-menu";

interface ExpenseTableProps {
  expenses: AccountDto[];
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
  onView: (e: AccountDto) => void;
  selectedId?: string | null;
  parentCode?: string;
}

type SortField = "code" | "name" | "debit" | "credit";

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

export function ExpenseTable({ expenses, loading, search, onSearchChange, onView, selectedId, parentCode }: ExpenseTableProps) {
  const { currencies, convertFromBase, formatAmount } = useCurrencyContext();
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
        case "debit":
          comparison = (Number(a.debit) || 0) - (Number(b.debit) || 0);
          break;
        case "credit":
          comparison = (Number(a.credit) || 0) - (Number(b.credit) || 0);
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

    currencies.forEach(curr => {
      const symbol = curr.code === 'USD' ? '$' : curr.code === 'SYP' ? 'ل.س' : (curr.symbol || curr.code);
      cols.push({
        id: `debit_${curr.code}`,
        header: <SortableHeader field="debit" label={`مدين (${symbol})`} currentField={sortField} direction={sortDirection} onSort={handleSort} />,
        label: `مدين (${symbol})`,
        accessor: (c) => {
          const val = convertFromBase(Number(c.debit || 0), curr.code);
          return val > 0 ? formatAmount(Number(c.debit || 0), { currencyCode: curr.code }) : "—";
        },
        align: "left",
        className: "text-red-600 tabular-nums font-medium text-[11px]"
      });
    });

    currencies.forEach(curr => {
      const symbol = curr.code === 'USD' ? '$' : curr.code === 'SYP' ? 'ل.س' : (curr.symbol || curr.code);
      cols.push({
        id: `credit_${curr.code}`,
        header: <SortableHeader field="credit" label={`دائن (${symbol})`} currentField={sortField} direction={sortDirection} onSort={handleSort} />,
        label: `دائن (${symbol})`,
        accessor: (c) => {
          const val = convertFromBase(Number(c.credit || 0), curr.code);
          return val > 0 ? formatAmount(Number(c.credit || 0), { currencyCode: curr.code }) : "—";
        },
        align: "left",
        className: "text-green-600 tabular-nums font-medium text-[11px]"
      });
    });

    cols.push({
      id: "actions",
      header: "إجراءات",
      label: "إجراءات",
      accessor: (e) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            <DropdownMenuItem onClick={() => onView(e)} className="flex-row-reverse gap-2">
              <Eye className="w-4 h-4" /> عرض التفاصيل
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      align: "center",
      className: "w-[80px]"
    });

    return cols;
  }, [currencies, convertFromBase, formatAmount, sortField, sortDirection, handleSort, parentCode, onView]);

  const defaultVisible = useMemo(() => {
    const def = ["#", "name"];
    currencies.forEach(curr => {
      def.push(`debit_${curr.code}`);
      def.push(`credit_${curr.code}`);
    });
    def.push("actions");
    return def;
  }, [currencies]);

  const { visibleColumns, toggleColumn } = useColumnPreferences("expenses-table", defaultVisible);

  const enrichedColumns = useMemo(() => {
    return allColumns.map(col => ({
      ...col,
      visible: visibleColumns.includes(col.id)
    }));
  }, [allColumns, visibleColumns]);

  const toolbarColumns = useMemo(() => {
    return allColumns.map(c => ({
      id: c.id,
      label: c.label || (typeof c.header === 'string' ? c.header : c.id),
      visible: visibleColumns.includes(c.id)
    }));
  }, [allColumns, visibleColumns]);

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
      />
    </TableShell>
  );
}
