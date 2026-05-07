import { useMemo } from "react";
import { DataTable, Column } from '@widgets/table-shell/DataTable';
import { TableActions } from '@widgets/table-shell/TableActions';
import { formatDate } from '@shared/lib/format';
import type { JournalEntryDto } from "@erp/shared-types";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { useCurrencyContext } from "@app/providers/CurrencyProvider";

interface JournalTableProps {
  entries: JournalEntryDto[];
  loading: boolean;
  onPost?: (id: string) => void;
  onView?: (id: string) => void;
  visibleColumns?: string[];
}

export function JournalTable({ entries, loading, onPost, onView, visibleColumns }: JournalTableProps) {
  const { formatAmount, currencies } = useCurrencyContext();

  const allColumns = useMemo<Column<JournalEntryDto>[]>(() => {
    const cols: Column<JournalEntryDto>[] = [
      { 
        id: "entry_number",
        header: "رقم القيد", 
        accessor: "entry_number",
        className: "font-bold text-primary" 
      },
      { 
        id: "entry_date",
        header: "التاريخ", 
        accessor: (e) => formatDate(e.entry_date),
        className: "text-slate-500 tabular-nums" 
      },
      { 
        id: "description",
        header: "البيان", 
        accessor: "description",
        className: "max-w-[300px] truncate font-medium text-slate-700" 
      },
    ];

    // Dynamic Multi-Currency Total columns
    currencies.forEach(curr => {
      const s = curr.symbol || curr.code;
      cols.push({
        id: `amount_${curr.code}`,
        header: `المبلغ (${s})`,
        accessor: (e) => {
          const val = parseFloat(e.total_base_debit || "0");
          return formatAmount(val, { currencyCode: curr.code });
        },
        align: "left",
        className: "tabular-nums font-bold text-slate-900 text-[11px]"
      });
    });

    cols.push({
      id: "actions",
      header: "إجراءات",
      accessor: (e) => (
        <TableActions 
          onView={() => onView?.(e.id)}
          onEdit={() => toast.info("تعديل القيد قيد التطوير")}
          onDelete={() => toast.warning("حذف القيد قيد التطوير")}
          extraActions={[
            {
              label: "ترحيل القيد",
              icon: CheckCircle2,
              onClick: () => onPost?.(e.id)
            }
          ]}
        />
      ),
      align: "left",
      className: "w-16"
    });

    return cols;
  }, [onPost, onView, formatAmount, currencies]);

  const columns = useMemo(() => {
    if (!visibleColumns) return allColumns;
    return allColumns.filter(col => {
      if (!col.id || col.id === "actions") return true;
      return visibleColumns.includes(col.id);
    });
  }, [allColumns, visibleColumns]);

  return (
    <DataTable
      data={entries}
      columns={columns}
      loading={loading}
      emptyMessage="لا توجد قيود يومية مسجلة"
    />
  );
}
