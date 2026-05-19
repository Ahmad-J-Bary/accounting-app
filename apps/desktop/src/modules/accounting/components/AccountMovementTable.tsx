import { useMemo } from "react";
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { TableShell } from '@widgets/table-shell/TableShell';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useColumnPreferences } from "@shared/hooks/useColumnPreferences";
import type { AccountLedgerLineDto } from "@erp/shared-types";
import { formatDateTime } from '@shared/lib/format';
import { cn } from "@shared/lib/utils";
import { JOURNAL_TYPE_LABELS } from "../lib/journal-config";

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

  const allColumns = useMemo<UnifiedColumn<typeof tableData[0]>[]>(() => [
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
      className: "w-28"
    },
    {
      id: "debit_usd",
      header: "عليه / مدين ($)",
      label: "عليه / مدين ($)",
      accessor: (l) => {
        const usd = parseFloat(l.debit_usd);
        return usd > 0 ? formatAmount(usd, { currencyCode: "USD" }) : "—";
      },
      align: "left",
      className: "tabular-nums font-black text-blue-700 text-[11px]"
    },
    {
      id: "debit_syp",
      header: "عليه / مدين (ل.س)",
      label: "عليه / مدين (ل.س)",
      accessor: (l) => {
        const syp = parseFloat(l.debit_syp);
        return syp > 0 ? formatAmount(syp, { currencyCode: "SYP" }) : "—";
      },
      align: "left",
      className: "tabular-nums font-black text-blue-700 text-[11px]"
    },
    {
      id: "credit_usd",
      header: "له / دائن ($)",
      label: "له / دائن ($)",
      accessor: (l) => {
        const usd = parseFloat(l.credit_usd);
        return usd > 0 ? formatAmount(usd, { currencyCode: "USD" }) : "—";
      },
      align: "left",
      className: "tabular-nums font-black text-emerald-700 text-[11px]"
    },
    {
      id: "credit_syp",
      header: "له / دائن (ل.س)",
      label: "له / دائن (ل.س)",
      accessor: (l) => {
        const syp = parseFloat(l.credit_syp);
        return syp > 0 ? formatAmount(syp, { currencyCode: "SYP" }) : "—";
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
    {
      id: "balance",
      header: "الرصيد ($)",
      label: "الرصيد ($)",
      accessor: (l) => (
        <span className={cn(
          "font-black tabular-nums",
          parseFloat(l.balance_usd) >= 0 ? "text-slate-900" : "text-rose-600"
        )}>
          {formatAmount(parseFloat(l.balance_usd), { currencyCode: "USD" })}
        </span>
      ),
      align: "left",
      className: "w-32"
    }
  ], [formatAmount]);

  const defaultVisible = ["entry_number", "date", "journal_type", "description", "debit_usd", "credit_usd", "balance"];
  const { visibleColumns, toggleColumn } = useColumnPreferences("account-movement-unified", defaultVisible);

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
      title={`حركة الحساب: ${accountName}`}
      search={search}
      onSearchChange={onSearchChange}
      columns={toolbarColumns}
      onColumnToggle={toggleColumn}
    >
      <UnifiedTable
        data={tableData}
        columns={enrichedColumns}
        loading={loading}
        emptyMessage={search ? "لا توجد حركات تطابق معايير البحث" : "لا توجد حركات مسجلة لهذا الحساب"}
      />
    </TableShell>
  );
}