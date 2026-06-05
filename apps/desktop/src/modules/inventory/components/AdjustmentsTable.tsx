import { useMemo } from "react";
import { ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { formatDateTime } from '@shared/lib/format';
import { cn } from "@shared/lib/utils";
import type { StockAdjustment } from "@erp/shared-types";
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { TableShell } from '@widgets/table-shell/TableShell';
import { useUnifiedColumns } from '@shared/hooks';

interface AdjustmentsTableProps {
  data: StockAdjustment[];
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
}

export function AdjustmentsTable({ data, loading, search, onSearchChange }: AdjustmentsTableProps) {
  const allColumns = useMemo<UnifiedColumn<StockAdjustment>[]>(() => [
    {
      id: "product_name",
      header: "المنتج / الصنف",
      label: "اسم المنتج",
      accessor: (a) => a.product_name ?? a.product_id,
      className: "font-black text-slate-900 min-w-[180px]"
    },
    {
      id: "adjustment_date",
      header: "التاريخ",
      label: "تاريخ التسوية",
      accessor: (a) => formatDateTime(a.adjustment_date),
      className: "tabular-nums text-slate-500 font-medium w-32"
    },
    {
      id: "system_quantity",
      header: "كمية النظام",
      label: "كمية النظام (قبل التسوية)",
      accessor: (a) => parseFloat(a.system_quantity).toFixed(2),
      className: "tabular-nums text-slate-600 w-24"
    },
    {
      id: "actual_quantity",
      header: "الكمية الفعلية",
      label: "الكمية الفعلية (الموجودة)",
      accessor: (a) => parseFloat(a.actual_quantity).toFixed(2),
      className: "tabular-nums font-bold text-slate-800 w-24"
    },
    {
      id: "difference",
      header: "الفارق",
      label: "فارق الكمية (عجز/زيادة)",
      accessor: (a) => {
        const diff = parseFloat(a.difference);
        return (
          <span className={cn(
            "inline-flex items-center gap-1.5 font-black tabular-nums text-base",
            diff > 0 ? "text-emerald-600" : diff < 0 ? "text-rose-600" : "text-slate-400"
          )}>
            {diff > 0 ? <ArrowUpCircle className="w-4 h-4" /> : diff < 0 ? <ArrowDownCircle className="w-4 h-4" /> : null}
            {diff > 0 ? "+" : ""}{diff.toFixed(2)}
          </span>
        );
      },
      className: "w-32"
    },
    {
      id: "reason",
      header: "السبب",
      label: "سبب التسوية",
      accessor: (a) => a.reason ?? "—",
      className: "text-slate-500 text-xs font-medium italic min-w-[150px]"
    }
  ], []);

  const { enrichedColumns, toolbarColumns, toggleColumn } = useUnifiedColumns({
    tableId: "adjustments-unified",
    columns: allColumns,
    defaultVisible: ["product_name", "adjustment_date", "difference", "reason"],
  });

  const filtered = useMemo(() =>
    data.filter(a =>
      a.product_name?.toLowerCase().includes(search.toLowerCase()) ||
      a.product_id?.toLowerCase().includes(search.toLowerCase()) ||
      a.reason?.toLowerCase().includes(search.toLowerCase())
    ),
    [data, search]
  );

  return (
    <TableShell
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="بحث بالمنتج أو السبب..."
      columns={toolbarColumns}
      onColumnToggle={toggleColumn}
      showToolbar={true}
    >
      <UnifiedTable
        data={filtered}
        columns={enrichedColumns}
        loading={loading}
        enableResize
        tableId="adjustments"
        emptyMessage={search ? "لا توجد نتائج للبحث" : "لا توجد تسويات مسجّلة"}
      />
    </TableShell>
  );
}
