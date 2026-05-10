import { useMemo } from "react";
import { DataTable, Column } from '@widgets/table-shell/DataTable';
import { formatDate } from '@shared/lib/format';
import type { JournalEntryDto } from "@erp/shared-types";

interface JournalTableProps {
  entries: JournalEntryDto[];
  loading: boolean;
  visibleColumns?: string[];
}

export function JournalTable({ entries, loading, visibleColumns }: JournalTableProps) {
  const tableData = useMemo(() => {
    return entries.map((e, index) => {
      // Calculate total transaction value by checking both debit and credit sides
      // This ensures we get the USD amount even if the USD line was a credit line.
      const usdDebits = e.lines.reduce((acc, l) => acc + (l.currency?.toUpperCase() === 'USD' ? parseFloat(l.debit || "0") : 0), 0);
      const usdCredits = e.lines.reduce((acc, l) => acc + (l.currency?.toUpperCase() === 'USD' ? parseFloat(l.credit || "0") : 0), 0);
      const transactionUsd = Math.max(usdDebits, usdCredits);

      const sypDebits = e.lines.reduce((acc, l) => acc + (parseFloat(l.debit || "0") * parseFloat(l.fx_rate || "1")), 0);
      const sypCredits = e.lines.reduce((acc, l) => acc + (parseFloat(l.credit || "0") * parseFloat(l.fx_rate || "1")), 0);
      const transactionSyp = Math.max(sypDebits, sypCredits);
      
      // Classify the whole entry as either Debit-natured or Credit-natured
      const direction = ['CashPayment', 'PurchaseJournal', 'PurchaseCostsJournal'].includes(e.journal_type) ? 'CREDIT' : 'DEBIT';
      
      const debitLines = e.lines.filter(l => parseFloat(l.debit || "0") > 0);
      const creditLines = e.lines.filter(l => parseFloat(l.credit || "0") > 0);
      
      const debitAccount = debitLines.length === 1 
        ? debitLines[0].account_name 
        : (debitLines.length > 1 ? "حسابات متعددة" : "-");
        
      const creditAccount = creditLines.length === 1 
        ? creditLines[0].account_name 
        : (creditLines.length > 1 ? "حسابات متعددة" : "-");

      const partnerName = e.lines.find(l => l.partner_name)?.partner_name || "-";

      return {
        ...e,
        direction,
        partner_name: partnerName,
        total_debit_usd: direction === 'DEBIT' ? transactionUsd : 0,
        total_debit_syp: direction === 'DEBIT' ? transactionSyp : 0,
        total_credit_usd: direction === 'CREDIT' ? transactionUsd : 0,
        total_credit_syp: direction === 'CREDIT' ? transactionSyp : 0,
        debit_account_name: debitAccount,
        credit_account_name: creditAccount,
      };
    });
  }, [entries]);

  const allColumns = useMemo<Column<typeof tableData[0]>[]>(() => {
    const cols: Column<typeof tableData[0]>[] = [
      { 
        id: "entry_number",
        header: "رقم القيد", 
        accessor: (e) => e.entry_number,
        className: "font-black text-slate-900 text-[10px] text-center" 
      },
      { 
        id: "journal_type",
        header: "نوع الحركة", 
        accessor: (e) => (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black bg-slate-100 text-slate-600 uppercase tracking-tighter">
            {e.journal_type_display}
          </span>
        ),
      },
      {
        id: "total_debit_usd",
        header: "عليه / مدين ($)",
        accessor: (e) => e.direction === 'DEBIT' ? `${e.total_debit_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $` : "",
        align: "left",
        className: "tabular-nums font-black text-blue-700 text-[11px]"
      },
      {
        id: "total_debit_syp",
        header: "عليه / مدين (ل.س)",
        accessor: (e) => e.direction === 'DEBIT' ? `${e.total_debit_syp.toLocaleString('en-US', { maximumFractionDigits: 0 })} ل.س` : "",
        align: "left",
        className: "tabular-nums font-black text-blue-700 text-[11px]"
      },
      {
        id: "total_credit_usd",
        header: "له / دائن ($)",
        accessor: (e) => e.direction === 'CREDIT' ? `${e.total_credit_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $` : "",
        align: "left",
        className: "tabular-nums font-black text-emerald-700 text-[11px]"
      },
      {
        id: "total_credit_syp",
        header: "له / دائن (ل.س)",
        accessor: (e) => e.direction === 'CREDIT' ? `${e.total_credit_syp.toLocaleString('en-US', { maximumFractionDigits: 0 })} ل.س` : "",
        align: "left",
        className: "tabular-nums font-black text-emerald-700 text-[11px]"
      },
      { 
        id: "description",
        header: "البيان", 
        accessor: (e) => e.description,
        className: "max-w-[150px] truncate font-bold text-slate-700 text-[10px]" 
      },
      {
        id: "credit_account",
        header: "الحساب الدائن / المصدر",
        accessor: (e) => e.credit_account_name,
        className: "text-emerald-600 font-bold text-[10px]"
      },
      {
        id: "debit_account",
        header: "الحساب المدين / الوجهة",
        accessor: (e) => e.debit_account_name,
        className: "text-blue-600 font-bold text-[10px]"
      },
      { 
        id: "entry_date",
        header: "التاريخ", 
        accessor: (e) => formatDate(e.entry_date),
        className: "text-slate-500 tabular-nums text-[10px]" 
      }
    ];

    return cols;
  }, []);

  const columns = useMemo(() => {
    if (!visibleColumns) return allColumns;
    return allColumns.filter(col => {
      if (!col.id) return true;
      return visibleColumns.includes(col.id);
    });
  }, [allColumns, visibleColumns]);

  return (
    <DataTable
      data={tableData}
      columns={columns}
      loading={loading}
      emptyMessage="لا توجد قيود يومية مسجلة"
    />
  );
}
