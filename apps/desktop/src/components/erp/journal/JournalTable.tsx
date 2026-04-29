import { useMemo } from "react";
import { DataTable, Column } from "@/components/erp/shared/DataTable";
import { TableActions } from "@/components/erp/shared/TableActions";
import { formatDate, formatCurrency } from "@/lib/format";
import type { JournalEntryDto } from "@erp/shared-types";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

interface JournalTableProps {
  entries: JournalEntryDto[];
  loading: boolean;
  onPost?: (id: string) => void;
  onView?: (id: string) => void;
}

export function JournalTable({ entries, loading, onPost, onView }: JournalTableProps) {
  const columns = useMemo<Column<JournalEntryDto>[]>(() => [
    { 
      header: "رقم القيد", 
      accessor: "entry_number",
      className: "font-bold text-primary" 
    },
    { 
      header: "التاريخ", 
      accessor: (e) => formatDate(e.entry_date),
      className: "text-slate-500 tabular-nums" 
    },
    { 
      header: "البيان", 
      accessor: "description",
      className: "max-w-[300px] truncate font-medium text-slate-700" 
    },
    { 
      header: "المبلغ الإجمالي", 
      accessor: (e) => formatCurrency(parseFloat(e.total_base_debit)), 
      align: "left", 
      className: "tabular-nums font-bold text-slate-900" 
    },
    {
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
    }
  ], [onPost, onView]);

  return (
    <DataTable
      data={entries}
      columns={columns}
      loading={loading}
      emptyMessage="لا توجد قيود يومية مسجلة"
    />
  );
}
