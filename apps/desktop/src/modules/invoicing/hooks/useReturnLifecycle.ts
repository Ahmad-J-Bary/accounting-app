import { useState, useEffect, useCallback, useRef } from "react";
import { useTabs } from "@app/providers/TabContext";
import { returnService } from "@modules/invoicing/api/returnService";
import { customerService } from "@modules/partners/api/customerService";
import { supplierService } from "@modules/partners/api/supplierService";
import { materialService } from "@modules/inventory/api/materialService";
import { settingsService } from "@modules/core/api/settingsService";
import { warehouseService } from "@modules/inventory/api/warehouseService";
import type {
  SalesReturnDto,
  PurchaseReturnDto,
  CustomerDto,
  SupplierDto,
  MaterialDto,
  WarehouseDto,
  CompanySettings,
} from "@erp/shared-types";
import { toast } from "sonner";
import { useCurrencyContext } from "@app/providers/CurrencyContext";

interface UseReturnLifecycleProps {
  returnType: "SalesReturn" | "PurchaseReturn";
  partyType: "customer" | "supplier";
  priceField: "last_sale_price" | "last_purchase_price";
}

export function useReturnLifecycle({
  returnType,
  partyType,
}: UseReturnLifecycleProps) {
  const { openTab, closeTab, activeTabId } = useTabs();
  const {
    formatMonetaryAmount,
  } = useCurrencyContext();

  const [returns, setReturns] = useState<(SalesReturnDto | PurchaseReturnDto)[]>([]);
  const [parties, setParties] = useState<Array<CustomerDto | SupplierDto>>([]);
  const [materials, setMaterials] = useState<MaterialDto[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const loadData = useCallback(
    async (isInitial = false) => {
      try {
        if (isInitial) setLoading(true);
        else setRefreshing(true);

        const listReturnsPromise =
          returnType === "SalesReturn"
            ? returnService.listSalesReturns()
            : returnService.listPurchaseReturns();

        const listPartiesPromise =
          partyType === "customer"
            ? customerService.listCustomers()
            : supplierService.listSuppliers();

        const listMaterialsPromise = materialService.listMaterials();
        const listWarehousesPromise = warehouseService.listWarehouses();

        const [retData, partyData, matData, whData] = await Promise.all([
          listReturnsPromise,
          listPartiesPromise,
          listMaterialsPromise,
          listWarehousesPromise,
        ]);

        setReturns(retData);
        setParties(partyData);
        setMaterials(matData);
        setWarehouses(whData);
      } catch {
        toast.error("فشل تحميل البيانات");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [returnType, partyType],
  );

  const prevActiveTab = useRef(activeTabId);
  useEffect(() => {
    loadData(true);
  }, [loadData]);

  useEffect(() => {
    const tabName =
      returnType === "SalesReturn" ? "sales-returns" : "purchase-returns";
    if (prevActiveTab.current !== tabName && activeTabId === tabName) {
      loadData();
    }
    prevActiveTab.current = activeTabId;
  }, [activeTabId, loadData, returnType]);

  return {
    returns,
    parties,
    materials,
    warehouses,
    loading,
    refreshing,
    search,
    setSearch,
    loadData,
    formatMonetaryAmount,
    openTab,
    closeTab,
    activeTabId,
  };
}
