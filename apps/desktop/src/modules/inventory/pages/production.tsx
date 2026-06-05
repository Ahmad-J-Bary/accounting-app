import { useMemo } from "react";
import { Button } from "@shared/ui/button";
import { Plus, Factory, CheckCircle, Clock, Banknote } from "lucide-react";
import { formatCurrency } from '@shared/lib/format';
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

  const completed = useMemo(() => orders.filter(o => o.status === "Completed").length, [orders]);
  const inProgress = useMemo(() => orders.filter(o => o.status === "InProgress").length, [orders]);
  const totalCost = useMemo(() => orders.reduce((s, o) => s + parseFloat(o.total_cost || "0"), 0), [orders]);

  const stats = useMemo(() => [
    { label: "إجمالي الأوامر", value: orders.length, icon: Factory, color: "text-slate-900" },
    { label: "جاري التنفيذ", value: inProgress, icon: Clock, color: "text-blue-600" },
    { label: "أوامر مكتملة", value: completed, icon: CheckCircle, color: "text-emerald-600" },
    { label: "إجمالي التكاليف", value: formatCurrency(totalCost), icon: Banknote, color: "text-indigo-600" },
  ], [orders.length, inProgress, completed, totalCost]);

  return (
    <OperationalTableTemplate
      title="أوامر الإنتاج"
      stats={stats}
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
