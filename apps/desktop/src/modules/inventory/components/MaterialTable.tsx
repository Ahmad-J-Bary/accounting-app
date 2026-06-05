import { useMemo, useCallback } from "react";
import { Plus, Shuffle, Image } from "lucide-react";
import { cn } from '@shared/lib/utils';
import type { MaterialDto, CategoryDto } from "@erp/shared-types";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { Badge } from "@shared/ui/badge";
import { Button } from "@shared/ui/button";
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { TableShell } from '@widgets/table-shell/TableShell';
import { TableActions } from '@widgets/table-shell/TableActions';
import type { SummaryColumn } from '@widgets/table-shell/TableSummary';
import { useUnifiedColumns, useSortable } from '@shared/hooks';

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
  onRowClick 
}: MaterialTableProps) {
  const { formatAmount, currencies } = useCurrencyContext();
  
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

  const unitCostBase = useCallback((m: MaterialDto) => parseFloat(m.average_cost_base || "0"), []);
  const rawPriceBase = useCallback((m: MaterialDto): number => parseFloat(m.average_raw_price_base || "0"), []);
  const extraCostBase = useCallback((m: MaterialDto) => {
    const raw = rawPriceBase(m);
    const total = unitCostBase(m);
    if (total > 0 && raw > 0 && total > raw) return total - raw;
    return 0;
  }, [rawPriceBase, unitCostBase]);
  const salePriceBase = useCallback((m: MaterialDto) => parseFloat(m.last_sale_price_base || "0"), []);
  const totalReceived = useCallback((m: MaterialDto) => parseFloat(m.total_received || "0"), []);
  const totalAvailable = useCallback((m: MaterialDto) => parseFloat(m.total_available || "0"), []);

  const allColumns = useMemo<UnifiedColumn<MaterialDto>[]>(() => {
    const cols: UnifiedColumn<MaterialDto>[] = [
      // 1. صورة
      {
        id: "image",
        header: "صورة",
        label: "صورة",
        accessor: (m) => m.image_path ? (
          <div className="w-9 h-9 rounded-md border bg-slate-50 overflow-hidden flex-shrink-0">
            <img src={m.image_path} alt={m.name} className="w-full h-full object-contain" />
          </div>
        ) : (
          <div className="w-9 h-9 rounded-md bg-slate-100 flex items-center justify-center">
            <Image className="w-4 h-4 text-slate-300" />
          </div>
        ),
        className: "w-[60px]"
      },
      // 2. الكود
      {
        id: "code",
        header: "الكود",
        label: "الكود",
        accessor: (m) => (
          <span className="font-mono text-[11px] bg-slate-100 text-slate-700 px-2 py-1 rounded-md font-bold ring-1 ring-slate-200/50">
            {m.code || "—"}
          </span>
        ),
        className: "w-[80px]",
      },
      // 3. الباركود
      {
        id: "barcode",
        header: "الباركود",
        label: "الباركود",
        accessor: (m) => (
          <span className="font-mono text-[11px] bg-slate-50 text-slate-600 px-2 py-1 rounded-md border border-slate-200">
            {m.barcode || "—"}
          </span>
        ),
        className: "w-[90px]"
      },
      // 4. اسم المادة
      {
        id: "name",
        header: "اسم المادة",
        label: "اسم المادة",
        accessor: (m) => <span className="font-bold text-slate-800">{m.name}</span>,
      },
      // 5. الاسم (EN)
      {
        id: "name_en",
        header: "الاسم (EN)",
        label: "الاسم (EN)",
        accessor: (m) => m.name_en ? (
          <span className="text-[11px] text-slate-400 font-medium" dir="ltr">{m.name_en}</span>
        ) : <span className="text-slate-200">—</span>,
      },
      // 6. التصنيفات
      {
        id: "categories",
        header: "التصنيف",
        label: "التصنيفات",
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
                    className={cn("text-[10px] font-medium px-2 py-0.5 border-slate-200", cat.is_hybrid && "border-purple-200 bg-purple-50 text-purple-700")}
                  >
                    {cat.is_hybrid && <Shuffle className="w-2.5 h-2.5 ml-1 inline" />}
                    {cat.name}
                  </Badge>
                );
              })
            ) : (
              <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-100 font-normal">غير مصنف</Badge>
            )}
          </div>
        )
      },
    ];

    // 7. السعر الإفرادي (per currency)
    currencies.forEach(curr => {
      const sym = curr.symbol || curr.code;
      cols.push({
        id: `unit_price_${curr.code}`,
        header: `السعر الإفرادي (${sym})`,
        label: `السعر الإفرادي (${sym})`,
        accessor: (m) => {
          const raw = rawPriceBase(m);
          return raw > 0 ? formatAmount(raw, { currencyCode: curr.code }) : "—";
        },
        className: "tabular-nums font-bold text-slate-700 text-[11px]"
      });
    });

    // 8. تكاليف إضافية (per currency)
    currencies.forEach(curr => {
      const sym = curr.symbol || curr.code;
      cols.push({
        id: `extra_costs_${curr.code}`,
        header: `تكاليف إضافية (${sym})`,
        label: `تكاليف إضافية (${sym})`,
        accessor: (m) => {
          const extra = extraCostBase(m);
          return extra > 0 ? formatAmount(extra, { currencyCode: curr.code }) : "—";
        },
        className: "tabular-nums text-amber-600 text-[11px]"
      });
    });

    // 9. تكلفة الوحدة (per currency)
    currencies.forEach(curr => {
      const sym = curr.symbol || curr.code;
      cols.push({
        id: `average_cost_${curr.code}`,
        header: `تكلفة الوحدة (${sym})`,
        label: `تكلفة الوحدة (${sym})`,
        accessor: (m) => {
          const val = unitCostBase(m);
          if (val <= 0) return "—";
          const raw = rawPriceBase(m);
          if (raw > 0) {
            const extra = extraCostBase(m);
            const hint = `السعر: ${formatAmount(raw, { currencyCode: curr.code })} + تكاليف: ${formatAmount(extra, { currencyCode: curr.code })}`;
            return <span title={hint}>{formatAmount(val, { currencyCode: curr.code })}</span>;
          }
          return <>{formatAmount(val, { currencyCode: curr.code })}</>;
        },
        className: "tabular-nums font-bold text-amber-600 text-[11px]"
      });
    });

    // 10. المجموع (per currency): total_received * unit_cost
    currencies.forEach(curr => {
      const sym = curr.symbol || curr.code;
      cols.push({
        id: `total_value_${curr.code}`,
        header: `المجموع (${sym})`,
        label: `المجموع (${sym})`,
        accessor: (m) => {
          const val = totalReceived(m) * unitCostBase(m);
          return val > 0 ? formatAmount(val, { currencyCode: curr.code }) : "—";
        },
        className: "tabular-nums font-black text-slate-900 text-[11px]"
      });
    });

    // 11. الكمية الكلية
    cols.push({
      id: "total_received",
      header: "الكمية الكلية",
      label: "الكمية الكلية",
      accessor: (m) => parseFloat(m.total_received || "0").toLocaleString(),
      className: "tabular-nums text-emerald-600 font-bold",
    });

    // 12. الكمية المباعة
    cols.push({
      id: "total_sold",
      header: "الكمية المباعة",
      label: "الكمية المباعة",
      accessor: (m) => parseFloat(m.total_sold || "0").toLocaleString(),
      className: "tabular-nums text-blue-600 font-bold",
    });

    // 13. الكمية التالفة
    cols.push({
      id: "total_damaged",
      header: "الكمية التالفة",
      label: "الكمية التالفة",
      accessor: (m) => parseFloat(m.total_damaged || "0").toLocaleString(),
      className: "tabular-nums text-rose-600 font-bold"
    });

    // 14. الكمية المتوفرة
    cols.push({
      id: "total_available",
      header: "الكمية المتوفرة",
      label: "الكمية المتوفرة",
      accessor: (m) => parseFloat(m.total_available).toLocaleString(),
      className: "tabular-nums font-bold text-slate-700",
    });

    // 15. المجموع للمتوفر (per currency): total_available * unit_cost
    currencies.forEach(curr => {
      const sym = curr.symbol || curr.code;
      cols.push({
        id: `available_value_${curr.code}`,
        header: `المجموع للمتوفر (${sym})`,
        label: `المجموع للمتوفر (${sym})`,
        accessor: (m) => {
          const val = totalAvailable(m) * unitCostBase(m);
          return val > 0 ? formatAmount(val, { currencyCode: curr.code }) : "—";
        },
        className: "tabular-nums font-black text-indigo-700 text-[11px]"
      });
    });

    // 16. سعر المبيع (per currency)
    currencies.forEach(curr => {
      const sym = curr.symbol || curr.code;
      cols.push({
        id: `sale_price_${curr.code}`,
        header: `سعر المبيع (${sym})`,
        label: `سعر المبيع (${sym})`,
        accessor: (m) => {
          const val = salePriceBase(m);
          return val > 0 ? formatAmount(val, { currencyCode: curr.code }) : "—";
        },
        className: "tabular-nums font-bold text-emerald-600 text-[11px]"
      });
    });

    // 17. الوحدات
    cols.push({
      id: "units",
      header: "الوحدات",
      label: "الوحدات",
      accessor: (m) => (
        <div className="flex flex-wrap items-center gap-1.5 group">
          {m.units?.map((u, i) => (
            <span key={i} className="text-[10px] font-medium bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100 whitespace-nowrap">
              {u.name} {!u.is_base && u.conversion_factor ? `: ${u.conversion_factor}` : ""}
            </span>
          ))}
          <Button
            size="icon"
            variant="ghost"
            className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-blue-600 hover:bg-blue-50 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onManageUnits?.(m);
            }}
          >
            <Plus className="w-3 h-3" />
          </Button>
        </div>
      ),
    });

    // 18. حد الطلب
    cols.push({
      id: "minimum_stock",
      header: "حد الطلب",
      label: "حد الطلب",

      accessor: (m) => (
        <span className={cn(
          "tabular-nums font-medium",
          parseFloat(m.total_available) <= parseFloat(m.minimum_stock) ? "text-rose-600 font-bold" : "text-slate-500"
        )}>
          {parseFloat(m.minimum_stock).toLocaleString()}
        </span>
      )
    });

    // 19. وحدة الشراء الافتراضية
    cols.push({
      id: "default_purchase_unit",
      header: "وحدة الشراء",
      label: "وحدة الشراء الافتراضية",
      accessor: (m) => m.units?.find(u => u.id === m.default_purchase_unit_id)?.name || "—",
    });

    // 20. وحدة المبيع الافتراضية
    cols.push({
      id: "default_sale_unit",
      header: "وحدة المبيع",
      label: "وحدة المبيع الافتراضية",
      accessor: (m) => m.units?.find(u => u.id === m.default_sale_unit_id)?.name || "—",
    });

    // 21. ملاحظة
    cols.push({
      id: "notes",
      header: "ملاحظة",
      label: "ملاحظات",
      accessor: (m) => m.notes || "—",
    });

    // 22. إجراءات
    cols.push({
      id: "actions",
      header: "إجراءات",
      label: "إجراءات",
      accessor: (m) => (
        <TableActions
          onView={() => onRowClick?.(m)}
          onEdit={() => onEdit(m)}
          onDelete={() => onDelete(m.id, m.name)}
        />
      ),
      className: "w-[80px]"
    });

    return cols;
  }, [categories, onManageUnits, formatAmount, currencies, onEdit, onDelete, onRowClick, rawPriceBase, unitCostBase, extraCostBase, salePriceBase, totalReceived, totalAvailable]);

  const defaultVisible = useMemo(() => {
    const ids = [
      "image",
      "code",
      "barcode",
      "name",
      "name_en",
      "categories",
      ...currencies.map(c => `unit_price_${c.code}`),
      ...currencies.map(c => `average_cost_${c.code}`),
      "total_received",
      "total_sold",
      "total_damaged",
      "total_available",
      ...currencies.map(c => `available_value_${c.code}`),
      ...currencies.map(c => `sale_price_${c.code}`),
      "units",
      "minimum_stock",
      "notes",
      "actions",
    ];
    return ids;
  }, [currencies]);

  const { enrichedColumns, toolbarColumns, toggleColumn } = useUnifiedColumns({
    tableId: "materials-unified",
    columns: allColumns,
    defaultVisible,
  });

  const summaryColumns = useMemo<SummaryColumn[]>(() => {
    const totalValueBase = sortedMaterials.reduce((sum, m) => sum + totalReceived(m) * unitCostBase(m), 0);
    const availableValueBase = sortedMaterials.reduce((sum, m) => sum + totalAvailable(m) * unitCostBase(m), 0);

    const colIds = enrichedColumns.map(c => c.id);
    return colIds.map(id => {
      if (id === "name") {
        return { id: "count", columnId: "name", label: "", value: `${sortedMaterials.length} مادة`, className: "text-slate-500 font-medium" };
      }
      const totalMatch = id.match(/^total_value_(.+)$/);
      if (totalMatch) {
        return {
          id: `${id}_summary`, columnId: id, label: "المجموع",
          value: totalValueBase > 0 ? formatAmount(totalValueBase, { currencyCode: totalMatch[1] }) : "—",
          className: "text-slate-900 font-black",
        };
      }
      const availMatch = id.match(/^available_value_(.+)$/);
      if (availMatch) {
        return {
          id: `${id}_summary`, columnId: id, label: "المجموع للمتوفر",
          value: availableValueBase > 0 ? formatAmount(availableValueBase, { currencyCode: availMatch[1] }) : "—",
          className: "text-indigo-700 font-black",
        };
      }
      return { id: `${id}_spacer`, columnId: id, label: "", value: "" };
    });
  }, [sortedMaterials, enrichedColumns, formatAmount, unitCostBase, totalReceived, totalAvailable]);

  return (
    <TableShell
      title="قائمة المواد"
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="بحث بالاسم أو الكود أو الباركود..."
      columns={toolbarColumns}
      onColumnToggle={toggleColumn}
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
        emptyMessage={search ? "لا توجد مواد تطابق معايير البحث" : "قائمة المواد فارغة"}
        summary={summaryColumns}
        enableResize
        tableId="materials"
      />
    </TableShell>
  );
}
