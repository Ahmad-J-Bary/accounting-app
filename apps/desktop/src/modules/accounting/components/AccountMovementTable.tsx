import { useMemo } from "react";
import { DataTable, Column } from '@widgets/table-shell/DataTable';
import { formatDateTime } from '@shared/lib/format';
import type { AccountLedgerLineDto } from "@erp/shared-types";
import { JOURNAL_TYPES } from "../lib/journal-config";

interface AccountMovementTableProps {
  lines: AccountLedgerLineDto[];
  loading: boolean;
  visibleColumns?: string[];
  accountName: string;
}

export function AccountMovementTable({ lines, loading, visibleColumns, accountName }: AccountMovementTableProps) {
  const tableData = useMemo(() => {
    return lines.map((line) => {
      const typeLabel = JOURNAL_TYPES.find(t => t.value === line.journal_type)?.label || line.journal_type;
      
      const debitUSD = parseFloat(line.debit_usd);
      const debitSYP = parseFloat(line.debit_syp);
      const creditUSD = parseFloat(line.credit_usd);
      const creditSYP = parseFloat(line.credit_syp);

      const isDebit = debitUSD > 0 || debitSYP > 0;

      return {
        ...line,
        typeLabel,
        // Calculate Source/Destination based on movement
        source_account: isDebit ? line.opposite_account_name : accountName,
        destination_account: isDebit ? accountName : line.opposite_account_name,
        
        formatted_debit_usd: debitUSD > 0 
          ? `${debitUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $` 
          : "",
        formatted_credit_usd: creditUSD > 0 
          ? `${creditUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $` 
          : "",
        formatted_debit_syp: debitSYP > 0 
          ? `${debitSYP.toLocaleString('en-US', { maximumFractionDigits: 0 })} ل.س` 
          : "",
        formatted_credit_syp: creditSYP > 0 
          ? `${creditSYP.toLocaleString('en-US', { maximumFractionDigits: 0 })} ل.س` 
          : "",
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
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black bg-slate-100 text-slate-600 uppercase tracking-tighter">
            {l.typeLabel}
          </span>
        ),
      },
      {
        id: "debit_usd",
        header: "عليه / مدين ($)",
        accessor: (l) => l.formatted_debit_usd,
        align: "left",
        className: "tabular-nums font-black text-blue-700 text-[11px]"
      },
      {
        id: "debit_syp",
        header: "عليه / مدين (ل.س)",
        accessor: (l) => l.formatted_debit_syp,
        align: "left",
        className: "tabular-nums font-black text-blue-700 text-[11px]"
      },
      {
        id: "credit_usd",
        header: "له / دائن ($)",
        accessor: (l) => l.formatted_credit_usd,
        align: "left",
        className: "tabular-nums font-black text-emerald-700 text-[11px]"
      },
      {
        id: "credit_syp",
        header: "له / دائن (ل.س)",
        accessor: (l) => l.formatted_credit_syp,
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
