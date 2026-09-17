import { useMemo } from "react";
import { Plus } from "lucide-react";
import { productionService } from '@modules/inventory/api/productionService';
import type { ProductionOrder } from "@erp/shared-types";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";

import { useDataTable } from '@shared/hooks';
import { ProductionTable } from '@modules/inventory/components/ProductionTable';
import { toast } from "sonner";
import { useLocalization } from "@app/providers/LocalizationProvider";
import type { ResponsiveActionItem } from "@widgets/page-header/ResponsiveActions";

export default function ProductionPage() {
  const { t } = useLocalization();
  const {
    filtered: orders,
    loading,
    search,
    setSearch,
  } = useDataTable<ProductionOrder>({
    queryKey: ["production-orders"],
    fetchData: () => productionService.list(),
    searchFields: ["order_number"],
  });

  const toolbarActions = useMemo<ResponsiveActionItem[]>(() => [
    {
      id: "new-production-order",
      label: t("production.newOrder", { namespace: "inventory" }),
      icon: Plus,
      priority: "primary",
      onClick: () => {
        toast.info(t("production.newOrderComingSoon", { namespace: "inventory" }));
      },
    },
  ], [t]);

  return (
    <OperationalTableTemplate
      title={t("production.title", { namespace: "inventory",  })}
      toolbarActions={toolbarActions}
      tableContent={
        <ProductionTable
          data={orders}
          loading={loading}
          search={search}
          onSearchChange={setSearch}
        />
      }
    />
  );
}
