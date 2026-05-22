import { useMemo, useState, useCallback } from "react";
import { ArrowUpDown } from "lucide-react";
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { TableShell } from '@widgets/table-shell/TableShell';
import type { SummaryColumn } from '@widgets/table-shell/TableSummary';
import { useCurrencyContext, formatWithLocale } from "@app/providers/CurrencyContext";
import { useUnifiedColumns } from "@shared/hooks";
import type { AccountLedgerLineDto } from "@erp/shared-types";
import { formatDateTime } from '@shared/lib/format';
import { JOURNAL_TYPE_LABELS } from "../lib/journal-config";

type SortField = "entry_number" | "date" | "journal_type" | "credit_account" | "debit_account";

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

interface AccountMovementTableProps {
  lines: AccountLedgerLineDto[];
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
  accountName: string;
}

export function AccountMovementTable({ 
  lines, 
  loading, 
  search, 
  onSearchChange, 
  accountName 
}: AccountMovementTableProps) {
  const { currencies, baseCurrency, formatAmount } = useCurrencyContext();
  const [sortField, setSortField] = useState<SortField>("entry_number");
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

  const sortedCurrencies = useMemo(() => {
    if (!baseCurrency) return currencies;
    return [baseCurrency, ...currencies.filter(c => c.code !== baseCurrency.code)];
  }, [currencies, baseCurrency]);

  const tableData = useMemo(() => {
    return lines.map((line) => {
      const typeLabel = (line.journal_type === 'CashSalesJournal' || line.journal_type === 'CreditSalesJournal')
        ? 'مبيعات نقدية'
        : (JOURNAL_TYPE_LABELS[line.journal_type] || line.journal_type);
      
      const debitUSD = parseFloat(line.debit_usd);
      const debitSYP = parseFloat(line.debit_syp);
      const creditUSD = parseFloat(line.credit_usd);
      const creditSYP = parseFloat(line.credit_syp);

      const isDebit = debitUSD > 0 || debitSYP > 0;

      return {
        ...line,
        typeLabel,
        source_account: isDebit ? line.opposite_account_name : accountName,
        destination_account: isDebit ? accountName : line.opposite_account_name,
      };
    });
  }, [lines, accountName]);

  const sortedData = useMemo(() => {
    if (!sortField) return tableData;
    return [...tableData].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "entry_number":
          comparison = (a.entry_number || "").localeCompare(b.entry_number || "", "ar", { numeric: true });
          break;
        case "date":
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case "journal_type":
          comparison = (a.typeLabel || "").localeCompare(b.typeLabel || "", "ar");
          break;
        case "credit_account":
          comparison = (a.source_account || "").localeCompare(b.source_account || "", "ar");
          break;
        case "debit_account":
          comparison = (a.destination_account || "").localeCompare(b.destination_account || "", "ar");
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [tableData, sortField, sortDirection]);

  const fieldForCurrency = useCallback((currCode: string): "debit_usd" | "debit_syp" => {
    if (baseCurrency && currCode === baseCurrency.code) return "debit_usd";
    return "debit_syp";
  }, [baseCurrency]);

  const creditFieldForCurrency = useCallback((currCode: string): "credit_usd" | "credit_syp" => {
    if (baseCurrency && currCode === baseCurrency.code) return "credit_usd";
    return "credit_syp";
  }, [baseCurrency]);

  const allColumns = useMemo<UnifiedColumn<typeof tableData[0]>[]>(() => {
    const cols: UnifiedColumn<typeof tableData[0]>[] = [
      { 
        id: "entry_number",
        header: <SortableHeader field="entry_number" label="رقم القيد" currentField={sortField} direction={sortDirection} onSort={handleSort} />, 
        label: "رقم القيد", 
        accessor: (l) => (
          <span className="font-black text-indigo-700 font-mono text-xs">{l.entry_number}</span>
        ),
        className: "w-24",
        align: "center"
      },
      { 
        id: "journal_type",
        header: <SortableHeader field="journal_type" label="نوع الحركة" currentField={sortField} direction={sortDirection} onSort={handleSort} />, 
        label: "نوع الحركة", 
        accessor: (l) => (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black bg-slate-100 text-slate-600 uppercase tracking-tighter ring-1 ring-slate-200/50">
            {l.typeLabel}
          </span>
        ),
        className: "w-32"
      },
    ];

    sortedCurrencies.forEach(curr => {
      const symbol = curr.symbol || curr.code;
      const field = fieldForCurrency(curr.code);
      cols.push({
        id: `debit_${curr.code}`,
        header: <SortableHeader field="entry_number" label={`عليه / مدين (${symbol})`} currentField={sortField} direction={sortDirection} onSort={handleSort} />,
        label: `عليه / مدين (${symbol})`,
        accessor: (l) => {
          const val = parseFloat(l[field]);
          return val > 0 ? formatWithLocale(val, curr.code === baseCurrency?.code ? 2 : 0) + ` ${symbol}` : "—";
        },
        align: "left",
        className: "tabular-nums font-black text-blue-700 text-[11px]"
      });
    });

    sortedCurrencies.forEach(curr => {
      const symbol = curr.symbol || curr.code;
      const field = creditFieldForCurrency(curr.code);
      cols.push({
        id: `credit_${curr.code}`,
        header: <SortableHeader field="entry_number" label={`له / دائن (${symbol})`} currentField={sortField} direction={sortDirection} onSort={handleSort} />,
        label: `له / دائن (${symbol})`,
        accessor: (l) => {
          const val = parseFloat(l[field]);
          return val > 0 ? formatWithLocale(val, curr.code === baseCurrency?.code ? 2 : 0) + ` ${symbol}` : "—";
        },
        align: "left",
        className: "tabular-nums font-black text-emerald-700 text-[11px]"
      });
    });

    cols.push(
      { 
        id: "description",
        header: "البيان", 
        label: "البيان", 
        accessor: "description", 
        className: "min-w-[200px] text-slate-700 font-medium" 
      },
      {
        id: "credit_account",
        header: <SortableHeader field="credit_account" label="الحساب الدائن / المصدر" currentField={sortField} direction={sortDirection} onSort={handleSort} />,
        label: "الحساب الدائن / المصدر",
        accessor: (l) => l.source_account,
        className: "font-medium text-slate-800 text-sm"
      },
      {
        id: "debit_account",
        header: <SortableHeader field="debit_account" label="الحساب المدين / الوجهة" currentField={sortField} direction={sortDirection} onSort={handleSort} />,
        label: "الحساب المدين / الوجهة",
        accessor: (l) => l.destination_account,
        className: "font-medium text-slate-800 text-sm"
      },
      { 
        id: "date",
        header: <SortableHeader field="date" label="التاريخ" currentField={sortField} direction={sortDirection} onSort={handleSort} />, 
        label: "التاريخ", 
        accessor: (l) => formatDateTime(l.date),
        className: "tabular-nums text-slate-500 text-[11px] w-32" 
      },
    );
    return cols;
  }, [sortField, sortDirection, handleSort, sortedCurrencies, baseCurrency, fieldForCurrency, creditFieldForCurrency]);

  const defaultVisible = useMemo(() => {
    const def = ["entry_number", "date", "journal_type", "description"];
    sortedCurrencies.forEach(curr => {
      def.push(`debit_${curr.code}`);
    });
    sortedCurrencies.forEach(curr => {
      def.push(`credit_${curr.code}`);
    });
    return def;
  }, [sortedCurrencies]);

  const { enrichedColumns, toolbarColumns, toggleColumn } = useUnifiedColumns({
    tableId: "account-movement-unified",
    columns: allColumns,
    defaultVisible,
  });

  const summaryColumns = useMemo<SummaryColumn[]>(() => {
    const totals: Record<string, { debit: number; credit: number }> = {};
    sortedCurrencies.forEach(curr => {
      const fieldD = fieldForCurrency(curr.code);
      const fieldC = creditFieldForCurrency(curr.code);
      totals[curr.code] = {
        debit: tableData.reduce((s, l) => s + parseFloat(l[fieldD] || "0"), 0),
        credit: tableData.reduce((s, l) => s + parseFloat(l[fieldC] || "0"), 0),
      };
    });

    const colIds = enrichedColumns.map(c => c.id);
    return colIds.map(id => {
      if (id === 'entry_number') {
        return { id: 'count', label: '', value: `${tableData.length} حركة`, className: 'text-slate-500 font-medium' };
      }
      if (id === 'journal_type') {
        return { id: 'journal_type_summary', label: '', value: 'المجموع', className: 'text-slate-600 font-bold', align: 'center' as const };
      }
      if (id === 'description') {
        const balanceParts: string[] = [];
        sortedCurrencies.forEach(curr => {
          const t = totals[curr.code];
          if (t) {
            const bal = t.debit - t.credit;
            if (curr.code === baseCurrency?.code) {
              balanceParts.push(formatAmount(bal, { currencyCode: curr.code }));
            } else {
              const symbol = curr.symbol || curr.code;
              balanceParts.push(`${formatWithLocale(bal, 0)} ${symbol}`);
            }
          } else {
            balanceParts.push(formatAmount(0, { currencyCode: curr.code }));
          }
        });
        return {
          id: 'balance_summary', label: 'الرصيد',
          value: balanceParts.join(' / '),
          className: 'text-slate-900 font-black'
        };
      }
      const debitMatch = id.match(/^debit_(.+)$/);
      if (debitMatch) {
        const currCode = debitMatch[1];
        const t = totals[currCode];
        return {
          id: `${id}_total`, label: 'إجمالي',
          value: t && t.debit > 0 ? formatAmount(t.debit, { currencyCode: currCode }) : "—",
          align: 'left' as const,
          className: 'text-blue-700 font-black'
        };
      }
      const creditMatch = id.match(/^credit_(.+)$/);
      if (creditMatch) {
        const currCode = creditMatch[1];
        const t = totals[currCode];
        return {
          id: `${id}_total`, label: 'إجمالي',
          value: t && t.credit > 0 ? formatAmount(t.credit, { currencyCode: currCode }) : "—",
          align: 'left' as const,
          className: 'text-emerald-700 font-black'
        };
      }
      return { id: `${id}_spacer`, label: '', value: '' };
    });
  }, [tableData, formatAmount, enrichedColumns, sortedCurrencies, baseCurrency, fieldForCurrency, creditFieldForCurrency]);

  return (
    <TableShell
      title={`حركة الحساب: ${accountName}`}
      search={search}
      onSearchChange={onSearchChange}
      columns={toolbarColumns}
      onColumnToggle={toggleColumn}
    >
      <UnifiedTable
        data={sortedData}
        columns={enrichedColumns}
        loading={loading}
        emptyMessage={search ? "لا توجد حركات تطابق معايير البحث" : "لا توجد حركات مسجلة لهذا الحساب"}
        summary={summaryColumns}
      />
    </TableShell>
  );
}
