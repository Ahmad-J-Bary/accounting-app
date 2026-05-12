import { useMemo } from "react";
import { DataTable, Column } from '@widgets/table-shell/DataTable';
import { formatDate, formatDateTime } from '@shared/lib/format';
import type { AccountLedgerLineDto } from "@erp/shared-types";

interface AccountMovementTableProps {
  lines: AccountLedgerLineDto[];
  loading: boolean;
  visibleColumns?: string[];
}

const JOURNAL_TYPE_LABELS: Record<string, string> = {
  'GeneralJournal': 'يومية عامة',
  'CashJournal': 'يومية الصندوق',
  'CashSalesJournal': 'مبيعات نقدية',
  'CreditSalesJournal': 'مبيعات آجلة',
  'PurchaseJournal': 'مشتريات',
  'PurchaseCostsJournal': 'تكاليف مشتريات',
  'OpeningBalance': 'رصيد افتتاحي',
  'PartnerCapitalOpening': 'رأس مال شركاء',
};

export function AccountMovementTable({ lines, loading, visibleColumns }: AccountMovementTableProps) {
  const tableData = useMemo(() => {
    return lines.map((line) => {
      const typeLabel = JOURNAL_TYPE_LABELS[line.journal_type] || line.journal_type;
      return {
        ...line,
        typeLabel,
        formatted_debit_usd: parseFloat(line.debit_usd) > 0 
          ? `${parseFloat(line.debit_usd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $` 
          : "",
        formatted_credit_usd: parseFloat(line.credit_usd) > 0 
          ? `${parseFloat(line.credit_usd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $` 
          : "",
        formatted_debit_syp: parseFloat(line.debit_syp) > 0 
          ? `${parseFloat(line.debit_syp).toLocaleString('en-US', { maximumFractionDigits: 0 })} ل.س` 
          : "",
        formatted_credit_syp: parseFloat(line.credit_syp) > 0 
          ? `${parseFloat(line.credit_syp).toLocaleString('en-US', { maximumFractionDigits: 0 })} ل.س` 
          : "",
        formatted_balance_usd: `${parseFloat(line.balance_usd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`,
        formatted_balance_syp: `${parseFloat(line.balance_syp).toLocaleString('en-US', { maximumFractionDigits: 0 })} ل.س`,
      };
    });
  }, [lines]);

  const allColumns = useMemo<Column<typeof tableData[0]>[]>(() => {
    return [
      { 
        id: "entry_number",
        header: "رقم القيد", 
        accessor: (l) => l.entry_number,
        className: "font-black text-slate-900 text-xs text-center" 
      },
      { 
        id: "journal_type",
        header: "نوع الحركة", 
        accessor: (l) => (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-600 uppercase tracking-tighter">
            {l.typeLabel}
          </span>
        ),
      },
      { 
        id: "description",
        header: "البيان", 
        accessor: (l) => l.description,
        className: "max-w-[200px] truncate font-bold text-slate-700 text-xs" 
      },
      {
        id: "opposite_account",
        header: "الحساب المقابل",
        accessor: (l) => l.opposite_account_name,
        className: "text-slate-600 font-bold text-xs"
      },
      {
        id: "debit_usd",
        header: "عليه / مدين ($)",
        accessor: (l) => l.formatted_debit_usd,
        align: "left",
        className: "tabular-nums font-black text-blue-700 text-xs"
      },
      {
        id: "debit_syp",
        header: "عليه / مدين (ل.س)",
        accessor: (l) => l.formatted_debit_syp,
        align: "left",
        className: "tabular-nums font-black text-blue-700 text-xs"
      },
      {
        id: "credit_usd",
        header: "له / دائن ($)",
        accessor: (l) => l.formatted_credit_usd,
        align: "left",
        className: "tabular-nums font-black text-emerald-700 text-xs"
      },
      {
        id: "credit_syp",
        header: "له / دائن (ل.س)",
        accessor: (l) => l.formatted_credit_syp,
        align: "left",
        className: "tabular-nums font-black text-emerald-700 text-xs"
      },
      {
        id: "balance_usd",
        header: "الرصيد ($)",
        accessor: (l) => l.formatted_balance_usd,
        align: "left",
        className: "tabular-nums font-black text-slate-900 bg-slate-50 px-2 py-1 rounded text-xs"
      },
      {
        id: "balance_syp",
        header: "الرصيد (ل.س)",
        accessor: (l) => l.formatted_balance_syp,
        align: "left",
        className: "tabular-nums font-black text-slate-900 bg-slate-50 px-2 py-1 rounded text-xs"
      },
      { 
        id: "date",
        header: "التاريخ", 
        accessor: (l) => formatDateTime(l.date),
        className: "text-slate-500 tabular-nums text-xs text-center" 
      }
    ];
  }, []);

  const columns = useMemo(() => {
    if (!visibleColumns) return allColumns;
    return allColumns.filter(col => col.id && visibleColumns.includes(col.id));
  }, [allColumns, visibleColumns]);

  return (
    <DataTable
      data={tableData}
      columns={columns}
      loading={loading}
      emptyMessage="لا توجد حركات مسجلة لهذا الحساب"
    />
  );
}
