import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";
import { useTabs } from "@app/providers/TabContext";
import { useTabLocation } from "@app/providers/TabLocationContext";
import { returnService } from "@modules/invoicing/api/returnService";
import { customerService } from "@modules/partners/api/customerService";
import { supplierService } from "@modules/partners/api/supplierService";
import { materialService } from "@modules/inventory/api/materialService";
import { warehouseService } from "@modules/inventory/api/warehouseService";
import type {
  SalesReturnDto,
  PurchaseReturnDto,
  CustomerDto,
  SupplierDto,
  MaterialDto,
  WarehouseDto,
} from "@erp/shared-types";
import { toast } from "sonner";
import { useCurrencyContext } from "@app/providers/CurrencyContext";

interface UseReturnLifecycleProps {
  returnType: "SalesReturn" | "PurchaseReturn";
  partyType: "customer" | "supplier";
}

export function useReturnLifecycle({
  returnType,
  partyType,
}: UseReturnLifecycleProps) {
  const { id } = useParams();
  const { openTab, closeTab, activeTabId } = useTabs();
  const { formatMonetaryAmount } = useCurrencyContext();
  const tabLocation = useTabLocation();

  const isSales = returnType === "SalesReturn";
  const isNew = tabLocation.includes("/new");
  const isReadOnly = useMemo(() => {
    const searchParams = new URLSearchParams(tabLocation.includes("?") ? tabLocation.split("?")[1] : "");
    return searchParams.get("mode") === "view";
  }, [tabLocation]);

  const [view, setView] = useState<"list" | "editor">("list");
  const [returns, setReturns] = useState<(SalesReturnDto | PurchaseReturnDto)[]>([]);
  const [editingReturn, setEditingReturn] = useState<SalesReturnDto | PurchaseReturnDto | null>(null);
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

        const [retData, partyData, matData, whData] = await Promise.all([
          listReturnsPromise,
          listPartiesPromise,
          materialService.listMaterials(),
          warehouseService.listWarehouses(),
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

  // Route-based view switching
  useEffect(() => {
    if (isNew) {
      setEditingReturn(null);
      setView("editor");
    } else if (id) {
      const loadReturn = async () => {
        try {
          const ret = isSales
            ? await returnService.getSalesReturn(id)
            : await returnService.getPurchaseReturn(id);
          setEditingReturn(ret);
          setView("editor");
        } catch {
          toast.error("فشل تحميل بيانات المرتجع");
          setView("list");
        }
      };
      loadReturn();
    } else {
      setEditingReturn(null);
      setView("list");
    }
  }, [isNew, id, isSales]);

  const prevActiveTab = useRef(activeTabId);
  useEffect(() => {
    loadData(true);
  }, [loadData]);

  useEffect(() => {
    if (prevActiveTab.current !== activeTabId) {
      loadData();
    }
    prevActiveTab.current = activeTabId;
  }, [activeTabId, loadData]);

  return {
    view,
    isReadOnly,
    returns,
    editingReturn,
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
