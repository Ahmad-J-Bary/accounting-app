import { useMemo } from "react";
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { TableShell } from '@widgets/table-shell/TableShell';
import type { SummaryColumn } from '@widgets/table-shell/TableSummary';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useUnifiedColumns, useSortable } from "@shared/hooks";
import type { AccountLedgerLineDto } from "@erp/shared-types";
import { formatDateTime } from '@shared/lib/format';
import { JOURNAL_TYPE_LABELS } from "../lib/journal-config";

type SortField = "entry_number" | "date" | "journal_type" | "credit_account" | "debit_account";



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
  const { currencies, baseCurrency, formatAmount, toBase } = useCurrencyContext();
  const sortedCurrencies = useMemo(() => {
    if (!baseCurrency) return currencies;
    return [baseCurrency, ...currencies.filter(c => c.code !== baseCurrency.code)];
  }, [currencies, baseCurrency]);

  const tableData = useMemo(() => {
    return lines.map((line) => {
      const typeLabel = (line.journal_type === 'CashSalesJournal' || line.journal_type === 'CreditSalesJournal')
        ? 'مبيعات نقدية'
        : (JOURNAL_TYPE_LABELS[line.journal_type] || line.journal_type);
      
      const debitBase = parseFloat(line.debit_base);
      const debitOrig = parseFloat(line.debit_original);
      const creditBase = parseFloat(line.credit_base);
      const creditOrig = parseFloat(line.credit_original);

      const isDebit = debitBase > 0 || debitOrig > 0;

      return {
        ...line,
        typeLabel,
        source_account: isDebit ? line.opposite_account_name : accountName,
        destination_account: isDebit ? accountName : line.opposite_account_name,
      };
    });
  }, [lines, accountName]);

  const { sortedData, sortField, sortDirection, handleSort } = useSortable({
    data: tableData,
    defaultField: "entry_number" as SortField,
    defaultDirection: "asc",
    sortFn: (a, b, field, direction) => {
      let comparison = 0;
      switch (field) {
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
      return direction === "asc" ? comparison : -comparison;
    }
  });

  const allColumns = useMemo<UnifiedColumn<typeof tableData[0]>[]>(() => {
    const cols: UnifiedColumn<typeof tableData[0]>[] = [
      { 
        id: "entry_number",
        header: "رقم القيد", 
        label: "رقم القيد", 
        accessor: (l) => (
          <span className="font-black text-indigo-700 font-mono text-xs">{l.entry_number}</span>
        ),
        className: "w-24",
        align: "center"
      },
      { 
        id: "journal_type",
        header: "نوع الحركة", 
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
      cols.push({
        id: `debit_${curr.code}`,
        header: `عليه / مدين (${symbol})`,
        label: `عليه / مدين (${symbol})`,
        accessor: (l) => {
          const baseVal = parseFloat(l.debit_base);
          return baseVal > 0 ? formatAmount(baseVal, { currencyCode: curr.code }) : "—";
        },
        align: "left",
        className: "tabular-nums font-black text-blue-700 text-[11px]"
      });
    });

    sortedCurrencies.forEach(curr => {
      const symbol = curr.symbol || curr.code;
      cols.push({
        id: `credit_${curr.code}`,
        header: `له / دائن (${symbol})`,
        label: `له / دائن (${symbol})`,
        accessor: (l) => {
          const baseVal = parseFloat(l.credit_base);
          return baseVal > 0 ? formatAmount(baseVal, { currencyCode: curr.code }) : "—";
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
        header: "الحساب الدائن / المصدر",
        label: "الحساب الدائن / المصدر",
        accessor: (l) => l.source_account,
        className: "font-medium text-slate-800 text-sm"
      },
      {
        id: "debit_account",
        header: "الحساب المدين / الوجهة",
        label: "الحساب المدين / الوجهة",
        accessor: (l) => l.destination_account,
        className: "font-medium text-slate-800 text-sm"
      },
      { 
        id: "date",
        header: "التاريخ", 
        label: "التاريخ", 
        accessor: (l) => formatDateTime(l.date),
        className: "tabular-nums text-slate-500 text-[11px] w-32" 
      },
    );
    return cols;
  }, [sortedCurrencies, formatAmount]);

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
    const baseDebitTotal = tableData.reduce((s, l) => s + parseFloat(l.debit_base || "0"), 0);
    const baseCreditTotal = tableData.reduce((s, l) => s + parseFloat(l.credit_base || "0"), 0);

    const colIds = enrichedColumns.map(c => c.id);
    return colIds.map(id => {
      if (id === 'entry_number') {
        return { id: 'count', columnId: 'entry_number', label: '', value: `${tableData.length} حركة`, className: 'text-slate-500 font-medium' };
      }
      if (id === 'journal_type') {
        return { id: 'journal_type_summary', columnId: 'journal_type', label: '', value: 'المجموع', className: 'text-slate-600 font-bold', align: 'center' as const };
      }
      if (id === 'description') {
        const balanceParts: string[] = [];
        sortedCurrencies.forEach(curr => {
          const bal = baseDebitTotal - baseCreditTotal;
          balanceParts.push(formatAmount(bal, { currencyCode: curr.code }));
        });
        return {
          id: 'balance_summary', columnId: 'description', label: 'الرصيد',
          value: balanceParts.join(' / '),
          className: 'text-slate-900 font-black'
        };
      }
      const debitMatch = id.match(/^debit_(.+)$/);
      if (debitMatch) {
        const currCode = debitMatch[1];
        return {
          id: `${id}_total`, columnId: id, label: 'إجمالي',
          value: baseDebitTotal > 0 ? formatAmount(baseDebitTotal, { currencyCode: currCode }) : "—",
          align: 'left' as const,
          className: 'text-blue-700 font-black'
        };
      }
      const creditMatch = id.match(/^credit_(.+)$/);
      if (creditMatch) {
        const currCode = creditMatch[1];
        return {
          id: `${id}_total`, columnId: id, label: 'إجمالي',
          value: baseCreditTotal > 0 ? formatAmount(baseCreditTotal, { currencyCode: currCode }) : "—",
          align: 'left' as const,
          className: 'text-emerald-700 font-black'
        };
      }
      return { id: `${id}_spacer`, columnId: id, label: '', value: '' };
    });
  }, [tableData, formatAmount, enrichedColumns, sortedCurrencies]);

  return (
    <TableShell
      title={`حركة الحساب: ${accountName}`}
      search={search}
      onSearchChange={onSearchChange}
      columns={toolbarColumns}
      onColumnToggle={toggleColumn}
      showToolbar={true}
    >
      <UnifiedTable
        data={sortedData}
        columns={enrichedColumns}
        loading={loading}
        enableResize
        tableId="account-movement"
        sortField={sortField}
        sortDirection={sortDirection}
        onHeaderClick={(col) => {
          if (col.id === "entry_number" || col.id === "journal_type" || col.id === "credit_account" || col.id === "debit_account" || col.id === "date") {
            handleSort(col.id as SortField);
          }
        }}
        emptyMessage={search ? "لا توجد حركات تطابق معايير البحث" : "لا توجد حركات مسجلة لهذا الحساب"}
        summary={summaryColumns}
      />
    </TableShell>
  );
}
