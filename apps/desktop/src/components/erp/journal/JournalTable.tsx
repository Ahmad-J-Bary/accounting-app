import { useMemo } from "react";
import { DataTable, Column } from "@/components/erp/shared/DataTable";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Eye, CheckCircle2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import type { JournalEntryDto } from "@erp/shared-types";

interface JournalTableProps {
  entries: JournalEntryDto[];
  loading: boolean;
  onPost: (id: string) => Promise<void>;
  onView: (id: string) => void;
}

export function JournalTable({ entries, loading, onPost, onView }: JournalTableProps) {
  const columns = useMemo<Column<JournalEntryDto>[]>(() => [
    { 
      header: "رقم القيد", 
      accessor: "entry_number",
      className: "font-medium text-primary"
    },
    { 
      header: "التاريخ", 
      accessor: (j) => formatDate(j.entry_date)
    },
    { 
      header: "البيان", 
      accessor: "description"
    },
    { 
      header: "مدين (ل.س)", 
      accessor: (j) => formatCurrency(parseFloat(j.total_base_debit)),
      align: "left",
      className: "tabular-nums"
    },
    { 
      header: "دائن (ل.س)", 
      accessor: (j) => formatCurrency(parseFloat(j.total_base_credit)),
      align: "left",
      className: "tabular-nums"
    },
    { 
      header: "الحالة", 
      accessor: (j) => <StatusBadge status={j.status} />,
      align: "left"
    },
    {
      header: "",
      accessor: (j) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onView(j.id)}>
              <Eye className="w-4 h-4 ml-2" />عرض
            </DropdownMenuItem>
            {j.status !== "Posted" && (
              <DropdownMenuItem onClick={() => onPost(j.id)}>
                <CheckCircle2 className="w-4 h-4 ml-2" />ترحيل
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      className: "w-12"
    }
  ], [onPost, onView]);

  return (
    <DataTable
      data={entries}
      columns={columns}
      loading={loading}
      emptyMessage="لا توجد قيود يومية"
    />
  );
}
