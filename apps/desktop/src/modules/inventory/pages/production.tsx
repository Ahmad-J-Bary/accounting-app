import { Button } from "@shared/ui/button";
import { Plus } from "lucide-react";
import { productionService } from '@modules/inventory/api/inventoryService';
import type { ProductionOrder } from "@erp/shared-types";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";

import { useDataTable } from '@shared/hooks';
import { ProductionTable } from '@modules/inventory/components/ProductionTable';
import { toast } from "sonner";

export default function ProductionPage() {
  const {
    filtered: orders,
    loading,
    search,
    setSearch,
  } = useDataTable<ProductionOrder>({
    fetchData: () => productionService.listProductionOrders(),
    searchFields: ["order_number"],
  });

  return (
    <OperationalTableTemplate
      title="أوامر الإنتاج"
      toolbar={
        <Button size="sm" onClick={() => toast.info("أمر إنتاج جديد قيد التطوير")} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 font-bold">
          <Plus className="w-4 h-4 ml-2" /> أمر إنتاج جديد
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
