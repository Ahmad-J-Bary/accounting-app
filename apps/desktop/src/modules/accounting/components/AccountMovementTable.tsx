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

type SortField = "entry_number" | "date" | "debit_usd" | "debit_syp" | "credit_usd" | "credit_syp" | "journal_type" | "credit_account" | "debit_account";

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
  const { formatAmount } = useCurrencyContext();
  const [sortField, setSortField] = useState<SortField>("debit_usd");
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
        default: {
          const aVal = parseFloat(a[sortField] as string || "0");
          const bVal = parseFloat(b[sortField] as string || "0");
          comparison = aVal - bVal;
        }
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [tableData, sortField, sortDirection]);

  const allColumns = useMemo<UnifiedColumn<typeof tableData[0]>[]>(() => [
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
    {
      id: "debit_usd",
      header: <SortableHeader field="debit_usd" label="عليه / مدين ($)" currentField={sortField} direction={sortDirection} onSort={handleSort} />,
      label: "عليه / مدين ($)",
      accessor: (l) => {
        const usd = parseFloat(l.debit_usd);
        return usd > 0 ? formatWithLocale(usd, 2) + " $" : "—";
      },
      align: "left",
      className: "tabular-nums font-black text-blue-700 text-[11px]"
    },
    {
      id: "debit_syp",
      header: <SortableHeader field="debit_syp" label="عليه / مدين (ل.س)" currentField={sortField} direction={sortDirection} onSort={handleSort} />,
      label: "عليه / مدين (ل.س)",
      accessor: (l) => {
        const syp = parseFloat(l.debit_syp);
        return syp > 0 ? formatWithLocale(syp, 0) + " ل.س" : "—";
      },
      align: "left",
      className: "tabular-nums font-black text-blue-700 text-[11px]"
    },
    {
      id: "credit_usd",
      header: <SortableHeader field="credit_usd" label="له / دائن ($)" currentField={sortField} direction={sortDirection} onSort={handleSort} />,
      label: "له / دائن ($)",
      accessor: (l) => {
        const usd = parseFloat(l.credit_usd);
        return usd > 0 ? formatWithLocale(usd, 2) + " $" : "—";
      },
      align: "left",
      className: "tabular-nums font-black text-emerald-700 text-[11px]"
    },
    {
      id: "credit_syp",
      header: <SortableHeader field="credit_syp" label="له / دائن (ل.س)" currentField={sortField} direction={sortDirection} onSort={handleSort} />,
      label: "له / دائن (ل.س)",
      accessor: (l) => {
        const syp = parseFloat(l.credit_syp);
        return syp > 0 ? formatWithLocale(syp, 0) + " ل.س" : "—";
      },
      align: "left",
      className: "tabular-nums font-black text-emerald-700 text-[11px]"
    },
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
  ], [formatAmount, sortField, sortDirection, handleSort]);

  const { enrichedColumns, toolbarColumns, toggleColumn } = useUnifiedColumns({
    tableId: "account-movement-unified",
    columns: allColumns,
    defaultVisible: ["entry_number", "date", "journal_type", "description", "debit_usd", "credit_usd"],
  });

  const summaryColumns = useMemo<SummaryColumn[]>(() => {
    const totalDebitUSD = tableData.reduce((s, l) => s + parseFloat(l.debit_usd || "0"), 0);
    const totalCreditUSD = tableData.reduce((s, l) => s + parseFloat(l.credit_usd || "0"), 0);
    const totalDebitSYP = tableData.reduce((s, l) => {
      const syp = parseFloat(l.debit_syp || "0");
      return s + syp;
    }, 0);
    const totalCreditSYP = tableData.reduce((s, l) => {
      const syp = parseFloat(l.credit_syp || "0");
      return s + syp;
    }, 0);
    const balanceUSD = totalDebitUSD - totalCreditUSD;
    const balanceSYP = totalDebitSYP - totalCreditSYP;

    const colIds = enrichedColumns.map(c => c.id);
    return colIds.map(id => {
      switch (id) {
        case 'entry_number':
          return { id: 'count', label: '', value: `${tableData.length} حركة`, className: 'text-slate-500 font-medium' };
        case 'journal_type':
          return { id: 'journal_type_summary', label: '', value: 'المجموع', className: 'text-slate-600 font-bold', align: 'center' as const };
        case 'description':
          return { id: 'balance_summary', label: 'الرصيد', value: `${formatAmount(balanceUSD, { currencyCode: "USD" })} / ${formatWithLocale(balanceSYP, 0)} ل.س`, className: balanceUSD >= 0 ? 'text-slate-900 font-black' : 'text-rose-600 font-black' };
        case 'debit_usd':
          return { id: 'debit_usd_total', label: 'إجمالي', value: totalDebitUSD > 0 ? formatAmount(totalDebitUSD, { currencyCode: "USD" }) : "—", align: 'left' as const, className: 'text-blue-700 font-black' };
        case 'debit_syp':
          return { id: 'debit_syp_total', label: 'إجمالي', value: totalDebitSYP > 0 ? formatWithLocale(totalDebitSYP, 0) + " ل.س" : "—", align: 'left' as const, className: 'text-blue-600 font-bold' };
        case 'credit_usd':
          return { id: 'credit_usd_total', label: 'إجمالي', value: totalCreditUSD > 0 ? formatAmount(totalCreditUSD, { currencyCode: "USD" }) : "—", align: 'left' as const, className: 'text-emerald-700 font-black' };
        case 'credit_syp':
          return { id: 'credit_syp_total', label: 'إجمالي', value: totalCreditSYP > 0 ? formatWithLocale(totalCreditSYP, 0) + " ل.س" : "—", align: 'left' as const, className: 'text-emerald-600 font-bold' };
        default:
          return { id: `${id}_spacer`, label: '', value: '' };
      }
    });
  }, [tableData, formatAmount, enrichedColumns]);

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