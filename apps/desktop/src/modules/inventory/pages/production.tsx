import { Button } from "@shared/ui/button";
import { Plus } from "lucide-react";
import { productionService } from '@modules/inventory/api/productionService';
import type { ProductionOrder } from "@erp/shared-types";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";

import { useDataTable } from '@shared/hooks';
import { ProductionTable } from '@modules/inventory/components/ProductionTable';
import { toast } from "sonner";
import { useLocalization } from "@app/providers/LocalizationProvider";

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

  return (
    <OperationalTableTemplate
      title={t("production.title", { namespace: "inventory",  })}
      toolbar={
        <Button size="sm" onClick={() => toast.info(t("production.newOrderComingSoon", { namespace: "inventory",  }))} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 font-bold">
          <Plus className="w-4 h-4 ml-2" /> {t("production.newOrder", { namespace: "inventory",  })}
        </Button>
      }
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
