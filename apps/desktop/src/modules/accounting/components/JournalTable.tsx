import { useMemo } from "react";
import { DataTable, Column } from '@widgets/table-shell/DataTable';
import { TableActions } from '@widgets/table-shell/TableActions';
import { formatDate } from '@shared/lib/format';
import type { JournalEntryDto } from "@erp/shared-types";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { cn } from "@shared/lib/utils";

interface JournalTableProps {
  entries: JournalEntryDto[];
  loading: boolean;
  onPost?: (id: string) => void;
  onView?: (id: string) => void;
  visibleColumns?: string[];
}

interface FlattenedJournalLine extends JournalEntryDto {
  line_index: number;
  line_debit: string;
  line_credit: string;
  line_account_name: string;
  line_description: string;
  is_first_line: boolean;
}

export function JournalTable({ entries, loading, onPost, onView, visibleColumns }: JournalTableProps) {
  const { formatAmount, currencies } = useCurrencyContext();

  const flattenedLines = useMemo(() => {
    return entries.flatMap(e => e.lines.map((l, i) => ({
      ...e,
      line_index: i,
      line_debit: l.debit,
      line_credit: l.credit,
      line_account_name: l.account_name,
      line_description: l.description,
      is_first_line: i === 0,
    } as FlattenedJournalLine)));
  }, [entries]);

  const allColumns = useMemo<Column<FlattenedJournalLine>[]>(() => {
    const cols: Column<FlattenedJournalLine>[] = [
      { 
        id: "entry_number",
        header: "رقم القيد", 
        accessor: (e) => e.is_first_line ? e.entry_number : "",
        className: "font-black text-slate-900 text-[10px]" 
      },
      { 
        id: "journal_type",
        header: "نوع الحركة", 
        accessor: (e) => e.is_first_line ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-black bg-slate-100 text-slate-600 uppercase tracking-tighter">
            {e.journal_type_display}
          </span>
        ) : "",
      },
      {
        id: "total_debit",
        header: "عليه / مدين",
        accessor: (e) => parseFloat(e.line_debit) > 0 ? formatAmount(parseFloat(e.line_debit), { currencyCode: "SYP" }) : "",
        align: "left",
        className: "tabular-nums font-black text-blue-700 text-xs"
      },
      {
        id: "total_credit",
        header: "له / دائن",
        accessor: (e) => parseFloat(e.line_credit) > 0 ? formatAmount(parseFloat(e.line_credit), { currencyCode: "SYP" }) : "",
        align: "left",
        className: "tabular-nums font-black text-emerald-700 text-xs"
      },
      { 
        id: "description",
        header: "البيان", 
        accessor: (e) => e.line_description || e.description,
        className: "max-w-[150px] truncate font-bold text-slate-700 text-[10px]" 
      },
      {
        id: "credit_account",
        header: "الحساب الدائن / المصدر",
        accessor: (e) => {
          const isCredit = parseFloat(e.line_credit) > 0;
          if (isCredit) return e.line_account_name;
          const counterLines = e.lines.filter(cl => parseFloat(cl.credit) > 0);
          return counterLines.length === 1 ? counterLines[0].account_name : (counterLines.length > 1 ? "حسابات متعددة" : "-");
        },
        className: "text-emerald-600 font-bold text-[10px]"
      },
      {
        id: "debit_account",
        header: "الحساب المدين / الوجهة",
        accessor: (e) => {
          const isDebit = parseFloat(e.line_debit) > 0;
          if (isDebit) return e.line_account_name;
          const counterLines = e.lines.filter(cl => parseFloat(cl.debit) > 0);
          return counterLines.length === 1 ? counterLines[0].account_name : (counterLines.length > 1 ? "حسابات متعددة" : "-");
        },
        className: "text-blue-600 font-bold text-[10px]"
      },
      { 
        id: "entry_date",
        header: "التاريخ", 
        accessor: (e) => e.is_first_line ? formatDate(e.entry_date) : "",
        className: "text-slate-500 tabular-nums text-[10px]" 
      },
      {
        id: "status",
        header: "الحالة",
        accessor: (e) => {
          if (!e.is_first_line) return "";
          const isPosted = e.status === 'Posted';
          return (
            <span className={cn(
              "px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-wider",
              isPosted ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
            )}>
              {isPosted ? "مرحل" : "مسودة"}
            </span>
          );
        }
      }
    ];

    cols.push({
      id: "actions",
      header: "إجراءات",
      accessor: (e) => e.is_first_line ? (
        <TableActions 
          onView={() => onView?.(e.id)}
          onEdit={() => toast.info("تعديل القيد قيد التطوير")}
          onDelete={() => toast.warning("حذف القيد قيد التطوير")}
          extraActions={[
            ...(e.status === 'Draft' ? [{
              label: "ترحيل القيد",
              icon: CheckCircle2,
              onClick: () => onPost?.(e.id)
            }] : [])
          ]}
        />
      ) : null,
      align: "left",
      className: "w-16"
    });

    return cols;
  }, [onPost, onView, formatAmount]);

  const columns = useMemo(() => {
    if (!visibleColumns) return allColumns;
    return allColumns.filter(col => {
      if (!col.id || col.id === "actions") return true;
      return visibleColumns.includes(col.id);
    });
  }, [allColumns, visibleColumns]);

  return (
    <DataTable
      data={flattenedLines}
      columns={columns}
      loading={loading}
      emptyMessage="لا توجد قيود يومية مسجلة"
    />
  );
}
