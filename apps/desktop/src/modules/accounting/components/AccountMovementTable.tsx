import { useMemo } from "react";
import { DataTable, Column } from '@widgets/table-shell/DataTable';
import { formatDateTime } from '@shared/lib/format';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import type { AccountLedgerLineDto } from "@erp/shared-types";
import { JOURNAL_TYPE_LABELS } from "../lib/journal-config";

interface AccountMovementTableProps {
  lines: AccountLedgerLineDto[];
  loading: boolean;
  visibleColumns?: string[];
  accountName: string;
}

export function AccountMovementTable({ lines, loading, visibleColumns, accountName }: AccountMovementTableProps) {
  const { formatAmount } = useCurrencyContext();

  const tableData = useMemo(() => {
    return lines.map((line) => {
      const typeLabel = JOURNAL_TYPE_LABELS[line.journal_type] || line.journal_type;
      
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

  const allColumns = useMemo<Column<typeof tableData[0]>[]>(() => {
    return [
      { 
        id: "entry_number",
        header: "رقم القيد", 
        accessor: (l) => l.entry_number,
        className: "font-black text-slate-900 text-[10px] text-center" 
      },
      { 
        id: "journal_type",
        header: "نوع الحركة", 
        accessor: (l) => (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black bg-slate-100 text-slate-600 uppercase tracking-tighter whitespace-nowrap">
            {l.typeLabel}
          </span>
        ),
      },
      {
        id: "debit_usd",
        header: "عليه / مدين ($)",
        accessor: (l) => {
          const usd = parseFloat(l.debit_usd);
          return usd > 0 ? formatAmount(usd, { currencyCode: "USD" }) : "";
        },
        align: "left",
        className: "tabular-nums font-black text-blue-700 text-[11px]"
      },
      {
        id: "debit_syp",
        header: "عليه / مدين (ل.س)",
        accessor: (l) => {
          const usd = parseFloat(l.debit_usd);
          return usd > 0 ? formatAmount(usd, { currencyCode: "SYP" }) : "";
        },
        align: "left",
        className: "tabular-nums font-black text-blue-700 text-[11px]"
      },
      {
        id: "credit_usd",
        header: "له / دائن ($)",
        accessor: (l) => {
          const usd = parseFloat(l.credit_usd);
          return usd > 0 ? formatAmount(usd, { currencyCode: "USD" }) : "";
        },
        align: "left",
        className: "tabular-nums font-black text-emerald-700 text-[11px]"
      },
      {
        id: "credit_syp",
        header: "له / دائن (ل.س)",
        accessor: (l) => {
          const usd = parseFloat(l.credit_usd);
          return usd > 0 ? formatAmount(usd, { currencyCode: "SYP" }) : "";
        },
        align: "left",
        className: "tabular-nums font-black text-emerald-700 text-[11px]"
      },
      { 
        id: "description",
        header: "البيان", 
        accessor: (l) => l.description,
        className: "max-w-[150px] truncate font-bold text-slate-700 text-[10px]" 
      },
      {
        id: "credit_account",
        header: "الحساب الدائن / المصدر",
        accessor: (l) => l.source_account,
        className: "text-emerald-600 font-bold text-[10px]"
      },
      {
        id: "debit_account",
        header: "الحساب المدين / الوجهة",
        accessor: (l) => l.destination_account,
        className: "text-blue-600 font-bold text-[10px]"
      },
      { 
        id: "date",
        header: "التاريخ", 
        accessor: (l) => formatDateTime(l.date),
        className: "text-slate-500 tabular-nums text-[10px]" 
      }
    ];
  }, [formatAmount]);

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
