import { useMemo } from "react";
import { ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { formatDateTime } from '@shared/lib/format';
import { cn } from "@shared/lib/utils";
import type { StockAdjustment } from "@erp/shared-types";
import { SharedTable } from '@widgets/table-shell/SharedTable';
import type { UnifiedColumn } from '@widgets/table-shell/UnifiedTable';

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
      header: "المادة",
      label: "المادة",
      accessor: (a) => a.product_name ?? a.product_id,
      className: "font-black text-slate-900"
    },
    {
      id: "adjustment_date",
      header: "التاريخ",
      label: "تاريخ التسوية",
      accessor: (a) => formatDateTime(a.adjustment_date),
      className: "tabular-nums text-slate-500"
    },
    {
      id: "system_quantity",
      header: "كمية النظام",
      label: "كمية النظام (قبل التسوية)",
      accessor: (a) => parseFloat(a.system_quantity).toFixed(2),
      className: "tabular-nums text-slate-600"
    },
    {
      id: "actual_quantity",
      header: "الكمية الفعلية",
      label: "الكمية الفعلية (الموجودة)",
      accessor: (a) => parseFloat(a.actual_quantity).toFixed(2),
      className: "tabular-nums font-bold text-slate-800"
    },
    {
      id: "difference",
      header: "الفارق",
      label: "فارق الكمية (عجز/زيادة)",
      accessor: (a) => {
        const diff = parseFloat(a.difference);
        return (
          <span className={cn(
            "inline-flex items-center gap-1.5 font-black tabular-nums",
            diff > 0 ? "text-emerald-600" : diff < 0 ? "text-rose-600" : "text-slate-400"
          )}>
            {diff > 0 ? <ArrowUpCircle className="w-4 h-4" /> : diff < 0 ? <ArrowDownCircle className="w-4 h-4" /> : null}
            {diff > 0 ? "+" : ""}{diff.toFixed(2)}
          </span>
        );
      },
    },
    {
      id: "reason",
      header: "السبب",
      label: "سبب التسوية",
      accessor: (a) => a.reason ?? "",
      className: "text-slate-500 font-medium italic"
    }
  ], []);

  type SortField = "product_name" | "adjustment_date" | "system_quantity" | "actual_quantity" | "difference" | "reason";

  const filtered = useMemo(() =>
    data.filter(a =>
      a.product_name?.toLowerCase().includes(search.toLowerCase()) ||
      a.product_id?.toLowerCase().includes(search.toLowerCase()) ||
      a.reason?.toLowerCase().includes(search.toLowerCase())
    ),
    [data, search]
  );

  const sortFn = (a: StockAdjustment, b: StockAdjustment, field: string, direction: 'asc' | 'desc') => {
    let comparison = 0;
    switch (field) {
      case "product_name": {
        const nameA = a.product_name ?? a.product_id ?? "";
        const nameB = b.product_name ?? b.product_id ?? "";
        comparison = nameA.localeCompare(nameB, "ar");
        break;
      }
      case "adjustment_date": comparison = new Date(a.adjustment_date).getTime() - new Date(b.adjustment_date).getTime(); break;
      case "system_quantity": comparison = parseFloat(a.system_quantity) - parseFloat(b.system_quantity); break;
      case "actual_quantity": comparison = parseFloat(a.actual_quantity) - parseFloat(b.actual_quantity); break;
      case "difference": comparison = parseFloat(a.difference) - parseFloat(b.difference); break;
      case "reason": comparison = (a.reason || "").localeCompare(b.reason || "", "ar"); break;
    }
    return direction === "asc" ? comparison : -comparison;
  };

  return (
    <SharedTable
      data={filtered}
      columns={allColumns}
      defaultVisible={["product_name", "adjustment_date", "difference", "reason"]}
      loading={loading}
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="بحث بالمنتج أو السبب..."
      tableId="adjustments"
      sortConfig={{ field: "adjustment_date", direction: "desc", sortFn }}
      sortableFields={["product_name", "adjustment_date", "system_quantity", "actual_quantity", "difference", "reason"]}
      emptyMessage={search ? "لا توجد نتائج للبحث" : "لا توجد تسويات مسجّلة"}
    />
  );
}
