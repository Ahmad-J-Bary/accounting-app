import { useMemo } from "react";
import { formatDateTime, formatCurrency } from '@shared/lib/format';
import { StatusBadge } from "@shared/ui/status-badge";
import type { ProductionOrder } from "@erp/shared-types";
import { SharedTable } from '@widgets/table-shell/SharedTable';
import type { UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { useLocalization } from "@app/providers/LocalizationProvider";

interface ProductionTableProps {
  data: ProductionOrder[];
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
  onVisibleColumnsChange?: (ids: string[]) => void;
}

export function ProductionTable({ data, loading, search, onSearchChange, onVisibleColumnsChange }: ProductionTableProps) {
  const { t } = useLocalization();
  const allColumns = useMemo<UnifiedColumn<ProductionOrder>[]>(() => [
    {
      id: "order_number",
      header: t("production.columns.orderNumber", { namespace: "inventory",  }),
      label: t("production.columns.orderNumberLabel", { namespace: "inventory",  }),
      accessor: "order_number",
      className: "font-black text-primary font-mono"
    },
    {
      id: "production_date",
      header: t("production.columns.productionDate", { namespace: "inventory",  }),
      label: t("production.columns.productionDate", { namespace: "inventory",  }),
      accessor: (o) => formatDateTime(o.production_date),
      align: "right",
      className: "tabular-nums text-muted-foreground"
    },
    {
      id: "materials_count",
      header: t("production.columns.materials", { namespace: "inventory",  }),
      label: t("production.columns.materialsLabel", { namespace: "inventory",  }),
      accessor: (o) => (
        <span className="inline-flex items-center gap-1.5 bg-muted px-2 py-1 rounded text-foreground font-bold text-xs">
          {t("production.materialsSummary", { namespace: "inventory", vars: { count: o.materials.length } })}
        </span>
      ),
    },
    {
      id: "outputs_count",
      header: t("production.columns.products", { namespace: "inventory",  }),
      label: t("production.columns.productsLabel", { namespace: "inventory",  }),
      accessor: (o) => (
        <span className="inline-flex items-center gap-1.5 bg-primary/10 px-2 py-1 rounded text-primary font-bold text-xs">
          {t("production.productsSummary", { namespace: "inventory", vars: { count: o.outputs.length } })}
        </span>
      ),
    },
    {
      id: "total_cost",
      header: t("production.columns.totalCost", { namespace: "inventory",  }),
      label: t("production.columns.totalCostLabel", { namespace: "inventory",  }),
      accessor: (o) => formatCurrency(parseFloat(o.total_cost)),
      align: "right",
      className: "tabular-nums font-black text-foreground"
    },
    {
      id: "status",
      header: t("labels.status", { namespace: "inventory" }),
      label: t("production.columns.statusLabel", { namespace: "inventory",  }),
      accessor: (o) => <StatusBadge status={o.status} />,
    }
  ], [t]);

  const filtered = useMemo(() =>
    data.filter(o =>
      o.order_number.toLowerCase().includes(search.toLowerCase())
    ),
    [data, search]
  );

  const sortFn = (a: ProductionOrder, b: ProductionOrder, field: string, direction: 'asc' | 'desc') => {
    let comparison = 0;
    switch (field) {
      case "order_number": comparison = (a.order_number || "").localeCompare(b.order_number || "", "ar", { numeric: true }); break;
      case "production_date": comparison = new Date(a.production_date).getTime() - new Date(b.production_date).getTime(); break;
      case "materials_count": comparison = a.materials.length - b.materials.length; break;
      case "outputs_count": comparison = a.outputs.length - b.outputs.length; break;
      case "total_cost": comparison = parseFloat(a.total_cost) - parseFloat(b.total_cost); break;
      case "status": comparison = (a.status || "").localeCompare(b.status || "", "ar"); break;
    }
    return direction === "asc" ? comparison : -comparison;
  };

  return (
    <SharedTable
      data={filtered}
      columns={allColumns}
      defaultVisible={allColumns.map(c => c.id)}
      loading={loading}
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder={t("production.searchPlaceholder", { namespace: "inventory" })}
      tableId="production"
      sortConfig={{ field: "production_date", direction: "desc", sortFn }}
      sortableFields={["order_number", "production_date", "materials_count", "outputs_count", "total_cost", "status"]}
      emptyMessage={search ? t("labels.noResults", { namespace: "inventory" }) : t("production.empty", { namespace: "inventory" })}
      onVisibleColumnsChange={onVisibleColumnsChange}
    />
  );
}
