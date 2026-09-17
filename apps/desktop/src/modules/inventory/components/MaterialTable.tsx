import { useMemo, useCallback, useEffect } from "react";
import { Plus, Shuffle, Image } from "lucide-react";
import { cn } from '@shared/lib/utils';
import type { MaterialDto, CategoryDto } from "@erp/shared-types";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useLocalization } from "@app/providers/LocalizationProvider";
import { Badge } from "@shared/ui/badge";
import { Button } from "@shared/ui/button";
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { TableShell } from '@widgets/table-shell/TableShell';
import { TableActions } from '@widgets/table-shell/TableActions';
import type { SummaryColumn } from '@widgets/table-shell/TableSummary';
import { useUnifiedColumns, useSortable, useBaseCurrencyColumns } from '@shared/hooks';
import { toLocalString } from '@shared/lib/format';
import { resolveCategoryName } from "@shared/lib/system-labels";

interface MaterialTableProps {
  materials: MaterialDto[];
  categories: CategoryDto[];
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
  onEdit: (m: MaterialDto) => void;
  onDelete: (id: string, name: string) => void;
  onManageUnits?: (material: MaterialDto) => void;
  selectedId?: string | null;
  onRowClick?: (material: MaterialDto) => void;
  stockTotal?: Map<string, number>;
  onVisibleColumnsChange?: (ids: string[]) => void;
}

type SortField = "code" | "name" | "total_available" | "total_received" | "total_sold" | "minimum_stock" | "average_cost" | "unit_price" | "sale_price";

export function MaterialTable({
  materials,
  categories,
  loading,
  search,
  onSearchChange,
  onEdit,
  onDelete,
  onManageUnits,
  selectedId,
  onRowClick,
  stockTotal,
  onVisibleColumnsChange,
}: MaterialTableProps) {
  const { formatAmount, currencies } = useCurrencyContext();
  const { isBaseCurrency, currencySuffix: cs } = useBaseCurrencyColumns();
  const { t } = useLocalization();

  const { sortedData: sortedMaterials, sortField, sortDirection, handleSort } = useSortable({
    data: materials,
    defaultField: "code" as SortField,
    sortFn: (a, b, field, direction) => {
      let comparison = 0;
      switch (field) {
        case "code": comparison = (a.code || "").localeCompare(b.code || "", "ar"); break;
        case "name": comparison = (a.name || "").localeCompare(b.name || "", "ar"); break;
        case "total_available": comparison = parseFloat(a.total_available) - parseFloat(b.total_available); break;
        case "total_received": comparison = parseFloat(a.total_received || "0") - parseFloat(b.total_received || "0"); break;
        case "total_sold": comparison = parseFloat(a.total_sold || "0") - parseFloat(b.total_sold || "0"); break;
        case "minimum_stock": comparison = parseFloat(a.minimum_stock) - parseFloat(b.minimum_stock); break;
        case "average_cost": comparison = parseFloat(a.average_cost_base || "0") - parseFloat(b.average_cost_base || "0"); break;
        case "unit_price": comparison = parseFloat(a.last_purchase_price_base || "0") - parseFloat(b.last_purchase_price_base || "0"); break;
        case "sale_price": comparison = parseFloat(a.last_sale_price_base || "0") - parseFloat(b.last_sale_price_base || "0"); break;
      }
      return direction === "asc" ? comparison : -comparison;
    }
  });

  const unitCostBase = useCallback((m: MaterialDto) => {
    if (m.costing_method === "FIFO") return parseFloat(m.last_purchase_price_base || "0");
    const avgCost = parseFloat(m.average_cost_base || "0");
    const totalRecv = parseFloat(m.total_received || "0");
    const totalStock = stockTotal?.get(m.id) ?? totalRecv;
    if (totalRecv > 0 && totalStock > 0 && totalStock !== totalRecv) {
      return avgCost * totalRecv / totalStock;
    }
    return avgCost;
  }, [stockTotal]);
  const rawPriceBase = useCallback((m: MaterialDto): number => {
    const avgRaw = parseFloat(m.average_raw_price_base || "0");
    const totalRecv = parseFloat(m.total_received || "0");
    const totalStock = stockTotal?.get(m.id) ?? totalRecv;
    if (totalRecv > 0 && totalStock > 0 && totalStock !== totalRecv) {
      return avgRaw * totalRecv / totalStock;
    }
    return avgRaw;
  }, [stockTotal]);
  const extraCostBase = useCallback((m: MaterialDto) => {
    const raw = rawPriceBase(m);
    const total = unitCostBase(m);
    if (total > 0 && raw > 0 && total > raw) return total - raw;
    return 0;
  }, [rawPriceBase, unitCostBase]);
  const totalReceived = useCallback((m: MaterialDto) => parseFloat(m.total_received || "0"), []);
  const totalAvailable = useCallback((m: MaterialDto) => parseFloat(m.total_available || "0"), []);

  const allColumns = useMemo<UnifiedColumn<MaterialDto>[]>(() => {
    const cols: UnifiedColumn<MaterialDto>[] = [
      {
        id: "image",
        header: t("materials.columns.image", { namespace: "inventory" }),
        label: t("materials.columns.image", { namespace: "inventory" }),
        accessor: (m) => m.image_path ? (
          <div className="w-9 h-9 rounded-md border bg-muted overflow-hidden flex-shrink-0">
            <img src={m.image_path} alt={m.name} className="w-full h-full object-contain" />
          </div>
        ) : (
          <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center">
            <Image className="w-4 h-4 text-muted-foreground" />
          </div>
        )
      },
      {
        id: "code",
        header: t("materials.columns.code", { namespace: "inventory" }),
        label: t("materials.columns.code", { namespace: "inventory" }),
        accessor: (m) => m.code || "",
        className: "font-black text-foreground text-center"
      },
      {
        id: "barcode",
        header: t("materials.columns.barcode", { namespace: "inventory" }),
        label: t("materials.columns.barcode", { namespace: "inventory" }),
        accessor: (m) => m.barcode || "",
        className: "font-mono font-medium text-muted-foreground"
      },
      {
        id: "name",
        header: t("materials.columns.materialName", { namespace: "inventory" }),
        label: t("materials.columns.materialName", { namespace: "inventory" }),
        accessor: (m) => m.name,
        className: "font-bold text-foreground"
      },
      {
        id: "name_en",
        header: t("materials.columns.nameEn", { namespace: "inventory" }),
        label: t("materials.columns.nameEn", { namespace: "inventory" }),
        accessor: (m) => m.name_en || "",
        className: "text-muted-foreground italic"
      },
      {
        id: "categories",
        header: t("materials.columns.category", { namespace: "inventory" }),
        label: t("materials.columns.category", { namespace: "inventory" }),
        accessor: (m) => (
          <div className="flex flex-wrap gap-1.5">
            {m.category_ids.length > 0 ? (
              m.category_ids.map(id => {
                const cat = categories.find(c => c.id === id);
                if (!cat) return null;
                return (
                  <Badge
                    key={id}
                    variant={cat.is_hybrid ? "outline" : "secondary"}
                    className={cn("text-[10px] font-medium px-2 py-0.5 border-muted", cat.is_hybrid && "border-purple-200 bg-purple-50 text-purple-700")}
                  >
                    {cat.is_hybrid && <Shuffle className="w-2.5 h-2.5 ml-1 inline" />}
                    {resolveCategoryName(cat, t)}
                  </Badge>
                );
              })
            ) : (
              <Badge variant="outline" className="text-[10px] text-muted-foreground border-muted font-normal">{t("materials.columns.uncategorized", { namespace: "inventory" })}</Badge>
            )}
          </div>
        )
      },
    ];

    currencies.forEach(curr => {
      const sym = curr.symbol || curr.code;
      const isBase = isBaseCurrency(curr.code);
      cols.push({
        id: `unit_price_${curr.code}`,
        header: `${t("materials.columns.unitPrice", { namespace: "inventory" })}${cs(sym)}`,
        label: `${t("materials.columns.unitPrice", { namespace: "inventory" })}${cs(sym)}`,
        accessor: (m) => {
          const raw = rawPriceBase(m);
          return raw > 0 ? formatAmount(raw, { currencyCode: curr.code }) : "";
        },
        className: isBase
          ? "tabular-nums font-black text-foreground"
          : "tabular-nums font-medium text-muted-foreground"
      });
    });

    currencies.forEach(curr => {
      const sym = curr.symbol || curr.code;
      const isBase = isBaseCurrency(curr.code);
      cols.push({
        id: `extra_costs_${curr.code}`,
        header: `${t("materials.columns.extraCosts", { namespace: "inventory" })}${cs(sym)}`,
        label: `${t("materials.columns.extraCosts", { namespace: "inventory" })}${cs(sym)}`,
        accessor: (m) => {
          const extra = extraCostBase(m);
          return extra > 0 ? formatAmount(extra, { currencyCode: curr.code }) : "";
        },
        className: isBase
          ? "tabular-nums font-bold text-amber-600"
          : "tabular-nums font-medium text-amber-300"
      });
    });

    currencies.forEach(curr => {
      const sym = curr.symbol || curr.code;
      const isBase = isBaseCurrency(curr.code);
      cols.push({
        id: `average_cost_${curr.code}`,
        header: `${t("materials.columns.unitCost", { namespace: "inventory" })}${cs(sym)}`,
        label: `${t("materials.columns.unitCost", { namespace: "inventory" })}${cs(sym)}`,
        accessor: (m) => {
          const val = unitCostBase(m);
          if (val <= 0) return "";
          if (m.costing_method === "FIFO") {
            return (
              <span title={`${t("tooltip.lastPurchasePrice", { namespace: "common" })} (FIFO)`}>
                {formatAmount(val, { currencyCode: curr.code })}
              </span>
            );
          }
          const raw = rawPriceBase(m);
          if (raw > 0) {
            const extra = extraCostBase(m);
            const hint = `${t("materials.costingMethods.average", { namespace: "inventory" })}: ${formatAmount(raw, { currencyCode: curr.code })} + ${t("materials.columns.extraCosts", { namespace: "inventory" })}: ${formatAmount(extra, { currencyCode: curr.code })}`;
            return <span title={hint}>{formatAmount(val, { currencyCode: curr.code })}</span>;
          }
          return <>{formatAmount(val, { currencyCode: curr.code })}</>;
        },
        className: isBase
          ? "tabular-nums font-bold text-amber-600"
          : "tabular-nums font-medium text-amber-300"
      });
    });

    currencies.forEach(curr => {
      const sym = curr.symbol || curr.code;
      const isBase = isBaseCurrency(curr.code);
      cols.push({
        id: `total_value_${curr.code}`,
        header: `${t("labels.total", { namespace: "inventory" })}${cs(sym)}`,
        label: `${t("labels.total", { namespace: "inventory" })}${cs(sym)}`,
        accessor: (m) => {
          const val = totalReceived(m) * unitCostBase(m);
          return val > 0 ? formatAmount(val, { currencyCode: curr.code }) : "";
        },
        className: isBase
          ? "tabular-nums font-black text-foreground"
          : "tabular-nums font-medium text-muted-foreground"
      });
    });

    cols.push({
      id: "total_received",
      header: t("materials.columns.totalReceived", { namespace: "inventory" }),
      label: t("materials.columns.totalReceived", { namespace: "inventory" }),
      accessor: (m) => toLocalString(totalReceived(m)),
      className: "tabular-nums text-success font-bold"
    });

    cols.push({
      id: "total_sold",
      header: t("materials.columns.totalSold", { namespace: "inventory" }),
      label: t("materials.columns.totalSold", { namespace: "inventory" }),
      accessor: (m) => toLocalString(parseFloat(m.total_sold || "0")),
      className: "tabular-nums text-primary font-bold"
    });

    cols.push({
      id: "total_damaged",
      header: t("materials.columns.totalDamaged", { namespace: "inventory" }),
      label: t("materials.columns.totalDamaged", { namespace: "inventory" }),
      accessor: (m) => toLocalString(parseFloat(m.total_damaged || "0")),
      className: "tabular-nums text-destructive font-bold"
    });

    cols.push({
      id: "total_available",
      header: t("materials.columns.totalAvailable", { namespace: "inventory" }),
      label: t("materials.columns.totalAvailable", { namespace: "inventory" }),
      accessor: (m) => toLocalString(parseFloat(m.total_available)),
      className: "tabular-nums font-bold text-foreground"
    });

    currencies.forEach(curr => {
      const sym = curr.symbol || curr.code;
      const isBase = isBaseCurrency(curr.code);
      cols.push({
        id: `available_value_${curr.code}`,
        header: `${t("materials.columns.totalAvailable", { namespace: "inventory" })}${cs(sym)}`,
        label: `${t("materials.columns.totalAvailable", { namespace: "inventory" })}${cs(sym)}`,
        accessor: (m) => {
          const val = totalAvailable(m) * unitCostBase(m);
          return val > 0 ? formatAmount(val, { currencyCode: curr.code }) : "";
        },
        className: isBase
          ? "tabular-nums font-black text-indigo-700"
          : "tabular-nums font-medium text-indigo-300"
      });
    });

        const TIERS = [
      { id: "retail", label: t("saleTiers.retail", { namespace: "inventory" }) },
      { id: "semi_wholesale", label: t("saleTiers.semi_wholesale", { namespace: "inventory" }) },
      { id: "wholesale", label: t("saleTiers.wholesale", { namespace: "inventory" }) },
    ];
    currencies.forEach(curr => {
      const sym = curr.symbol || curr.code;
      const isBase = isBaseCurrency(curr.code);
      TIERS.forEach(tier => {
        cols.push({
          id: `sale_price_${tier.id}_${curr.code}`,
          header: `${tier.label}${cs(sym)}`,
          label: `${tier.label}${cs(sym)}`,
          accessor: (m) => {
            const defaultSaleUnitId = m.default_sale_unit_id;
            const salePrice = m.sale_prices?.find(
              p => p.unit_id === defaultSaleUnitId && p.tier === tier.id
            );
            const val = salePrice ? parseFloat(salePrice.price_base || "0") : 0;
            const maxQty = salePrice?.max_quantity ? parseInt(salePrice.max_quantity) : 0;
            return (
              <div className="flex flex-col items-end gap-0.5">
                <span>{val > 0 ? formatAmount(val, { currencyCode: curr.code }) : ""}</span>
                {maxQty > 0 && (
                  <span className="text-[8px] font-medium text-muted-foreground whitespace-nowrap">&le;{maxQty}</span>
                )}
              </div>
            );
          },
          className: isBase
            ? "tabular-nums font-bold text-success"
            : "tabular-nums font-medium text-success/60"
        });
      });
    });

    cols.push({
      id: "units",
      header: t("materials.columns.units", { namespace: "inventory" }),
      label: t("materials.columns.units", { namespace: "inventory" }),
      accessor: (m) => (
        <div className="flex flex-wrap items-center gap-1.5 group">
          {m.units?.map((u, i) => (
            <span key={i} className="text-[10px] font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20 whitespace-nowrap">
              {u.name} {!u.is_base && u.conversion_factor ? `: ${u.conversion_factor}` : ""}
            </span>
          ))}
          <Button
            size="icon"
            variant="ghost"
            className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary hover:bg-primary/10 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onManageUnits?.(m);
            }}
          >
            <Plus className="w-3 h-3" />
          </Button>
        </div>
      )
    });

    cols.push({
      id: "minimum_stock",
      header: t("materials.columns.minimumStock", { namespace: "inventory" }),
      label: t("materials.columns.minimumStock", { namespace: "inventory" }),
      accessor: (m) => {
        const min = parseFloat(m.minimum_stock);
        const avail = parseFloat(m.total_available);
        const isLow = avail <= min;
        return <span className={cn("tabular-nums", isLow ? "text-destructive font-bold" : "text-muted-foreground font-medium")}>{toLocalString(min)}</span>;
      },
      className: "tabular-nums"
    });

    cols.push({
      id: "costing_method",
      header: t("materials.columns.costingMethod", { namespace: "inventory" }),
      label: t("materials.columns.costingMethod", { namespace: "inventory" }),
      accessor: (m) => (
        <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full border", 
          m.costing_method === "FIFO" 
            ? "bg-purple-50 text-purple-700 border-purple-200" 
            : "bg-muted text-foreground border-muted"
        )}>
          {m.costing_method === "FIFO"
            ? "FIFO"
            : t("materials.costingMethods.average", { namespace: "inventory" })}
        </span>
      ),
      className: "text-center"
    });

    cols.push({
      id: "default_purchase_unit",
      header: t("materials.columns.purchaseUnit", { namespace: "inventory" }),
      label: t("materials.columns.purchaseUnit", { namespace: "inventory" }),
      accessor: (m) => m.units?.find(u => u.id === m.default_purchase_unit_id)?.name || "",
      className: "text-muted-foreground"
    });

    cols.push({
      id: "default_sale_unit",
      header: t("materials.columns.saleUnit", { namespace: "inventory" }),
      label: t("materials.columns.saleUnit", { namespace: "inventory" }),
      accessor: (m) => m.units?.find(u => u.id === m.default_sale_unit_id)?.name || "",
      className: "text-muted-foreground"
    });

    cols.push({
      id: "default_warehouse",
      header: t("materials.columns.defaultWarehouse", { namespace: "inventory" }),
      label: t("materials.columns.defaultWarehouse", { namespace: "inventory" }),
      accessor: (row) => (
        <span className="text-[11px] text-muted-foreground">{row.default_warehouse_id || "—"}</span>
      ),
      className: "text-center",
    });

    cols.push({
      id: "default_purchase_currency",
      header: t("materials.columns.purchaseCurrency", { namespace: "inventory" }),
      label: t("materials.columns.purchaseCurrency", { namespace: "inventory" }),
      accessor: (row) => (
        <span className="text-[11px] text-muted-foreground">{row.default_purchase_currency || "—"}</span>
      ),
      className: "text-center",
    });

    cols.push({
      id: "default_sale_currency",
      header: t("materials.columns.saleCurrency", { namespace: "inventory" }),
      label: t("materials.columns.saleCurrency", { namespace: "inventory" }),
      accessor: (row) => (
        <span className="text-[11px] text-muted-foreground">{row.default_sale_currency || "—"}</span>
      ),
      className: "text-center",
    });

    cols.push({
      id: "has_expiry",
      header: t("materials.columns.expiry", { namespace: "inventory" }),
      label: t("materials.columns.expiry", { namespace: "inventory" }),
      accessor: (row) => (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${row.has_expiry ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-muted text-muted-foreground border border-muted'}`}>
          {row.has_expiry ? t("materials.expiry.has", { namespace: "inventory" }) : t("materials.expiry.none", { namespace: "inventory" })}
        </span>
      ),
      className: "text-center",
    });

    cols.push({
      id: "expiry_alert_before_days",
      header: t("materials.columns.expiryAlert", { namespace: "inventory" }),
      label: t("materials.columns.expiryAlert", { namespace: "inventory" }),
      accessor: (row) => (
        <span className="text-[11px] text-foreground">{row.has_expiry ? row.expiry_alert_before_days : "—"}</span>
      ),
      className: "text-center",
    });

    cols.push({
      id: "notes",
      header: t("materials.columns.notes", { namespace: "inventory" }),
      label: t("materials.columns.notes", { namespace: "inventory" }),
      accessor: (m) => m.notes || "",
      className: "text-muted-foreground italic"
    });

    cols.push({
      id: "actions",
      header: t("materials.columns.actions", { namespace: "inventory" }),
      label: t("materials.columns.actions", { namespace: "inventory" }),
      accessor: (m) => (
        <TableActions
          onView={() => onRowClick?.(m)}
          onEdit={() => onEdit(m)}
          onDelete={() => onDelete(m.id, m.name)}
        />
      )
    });

    return cols;
  }, [categories, onManageUnits, formatAmount, currencies, onEdit, onDelete, onRowClick, rawPriceBase, unitCostBase, extraCostBase, totalReceived, totalAvailable, isBaseCurrency, cs, t]);

  // Default visible: only base currency's money columns are shown.
  const defaultVisible = useMemo(() => {
    const ids: string[] = [
      "code",
      "name",
      "categories",
    ];
    currencies.forEach(curr => {
      if (isBaseCurrency(curr.code)) {
        ids.push(`unit_price_${curr.code}`);
        ids.push(`extra_costs_${curr.code}`);
        ids.push(`average_cost_${curr.code}`);
        ids.push(`total_value_${curr.code}`);
        ids.push(`available_value_${curr.code}`);
        ids.push(`sale_price_retail_${curr.code}`);
        ids.push(`sale_price_semi_wholesale_${curr.code}`);
        ids.push(`sale_price_wholesale_${curr.code}`);
      }
    });
    ids.push(
      "total_received",
      "total_sold",
      "total_damaged",
      "total_available",
      "units",
    );
    if (materials.some(m => m.has_expiry)) {
      ids.push("has_expiry");
    }
    ids.push(
      "notes",
      "actions",
    );
    return ids;
  }, [currencies, isBaseCurrency, materials]);

  const { enrichedColumns, visibleColumns, toolbarColumns, toggleColumn, resetToDefault, isModified } = useUnifiedColumns({
    tableId: "materials-unified",
    columns: allColumns,
    defaultVisible,
  });

  useEffect(() => {
    onVisibleColumnsChange?.(visibleColumns);
  }, [visibleColumns, onVisibleColumnsChange]);

  const summaryColumns = useMemo<SummaryColumn[]>(() => {
    const totalValueBase = sortedMaterials.reduce((sum, m) => sum + totalReceived(m) * unitCostBase(m), 0);
    const availableValueBase = sortedMaterials.reduce((sum, m) => sum + totalAvailable(m) * unitCostBase(m), 0);

    const colIds = enrichedColumns.map(c => c.id);
    return colIds.map(id => {
      if (id === "name") {
        return { id: "count", columnId: "name", label: "", value: `${sortedMaterials.length} ${t("labels.materialsCount", { namespace: "inventory" })}`, className: "text-muted-foreground font-medium" };
      }
      const totalMatch = id.match(/^total_value_(.+)$/);
      if (totalMatch) {
        const currCode = totalMatch[1];
        const isBase = isBaseCurrency(currCode);
        return {
          id: `${id}_summary`, columnId: id, label: t("labels.summary", { namespace: "inventory" }),
          value: totalValueBase > 0 ? formatAmount(totalValueBase, { currencyCode: currCode }) : "—",
          className: isBase
            ? "text-foreground font-black"
            : "text-muted-foreground font-extrabold",
        };
      }
      const availMatch = id.match(/^available_value_(.+)$/);
      if (availMatch) {
        const currCode = availMatch[1];
        const isBase = isBaseCurrency(currCode);
        return {
          id: `${id}_summary`, columnId: id, label: t("materials.columns.totalAvailable", { namespace: "inventory" }),
          value: availableValueBase > 0 ? formatAmount(availableValueBase, { currencyCode: currCode }) : "—",
          className: isBase
            ? "text-indigo-700 font-black"
            : "text-indigo-300 font-extrabold",
        };
      }
      return { id: `${id}_spacer`, columnId: id, label: "", value: "" };
    });
  }, [sortedMaterials, enrichedColumns, formatAmount, unitCostBase, totalReceived, totalAvailable, isBaseCurrency, t]);

  return (
    <TableShell
      title={t("materials.title", { namespace: "inventory" })}
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder={t("warehouses.searchPlaceholder", { namespace: "inventory" })}
      columns={toolbarColumns}
      onColumnToggle={toggleColumn}
      onColumnsReset={resetToDefault}
      columnsModified={isModified}
      showToolbar={true}
    >
      <UnifiedTable
        data={sortedMaterials}
        columns={enrichedColumns}
        loading={loading}
        sortField={sortField}
        sortDirection={sortDirection}
        onRowClick={onRowClick}
        selectedId={selectedId}
        onHeaderClick={(col) => {
          const sortableFields: SortField[] = ["code", "name", "total_received", "total_sold", "total_available", "minimum_stock"];
          if (sortableFields.includes(col.id as SortField)) {
            handleSort(col.id as SortField);
          }
        }}
        emptyMessage={search ? t("labels.noResultsMatch", { namespace: "inventory" }) : `${t("materials.title", { namespace: "inventory" })} ${t("labels.empty", { namespace: "inventory" })}`}
        summary={summaryColumns}
        enableResize
        tableId="materials"
      />
    </TableShell>
  );
}
