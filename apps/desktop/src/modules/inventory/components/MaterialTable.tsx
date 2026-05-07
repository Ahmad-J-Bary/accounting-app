import { useMemo } from "react";
import { Plus, Scale, Shuffle } from "lucide-react";
import { cn } from '@shared/lib/utils';
import type { MaterialDto, CategoryDto } from "@erp/shared-types";
import { useCurrencyContext } from "@app/providers/CurrencyProvider";
import { Badge } from "@shared/ui/badge";
import { Button } from "@shared/ui/button";
import { DataTable, Column } from '@widgets/table-shell/DataTable';
import { TableActions } from '@widgets/table-shell/TableActions';

interface MaterialTableProps {
  materials: MaterialDto[];
  categories: CategoryDto[];
  loading: boolean;
  search: string;
  onEdit: (m: MaterialDto) => void;
  onDelete: (id: string, name: string) => void;
  onManageUnits?: (material: MaterialDto) => void;
  visibleColumns: string[];
  selectedId?: string | null;
  onRowClick?: (material: MaterialDto) => void;
}

export function MaterialTable({ materials, categories, loading, search, onEdit, onDelete, onManageUnits, visibleColumns, selectedId, onRowClick }: MaterialTableProps) {
  const { formatAmount, currencies, convertFromBase } = useCurrencyContext();

  const columns = useMemo<Column<MaterialDto>[]>(() => {
    const cols: Column<MaterialDto>[] = [
      { 
        id: "code",
        header: "الكود", 
        accessor: (m) => (
          <span className="font-mono text-[11px] bg-slate-100 text-slate-700 px-2 py-1 rounded-md font-bold ring-1 ring-slate-200/50">
            {m.code || "—"}
          </span>
        ),
        className: "w-[100px]"
      },
      {
        id: "barcode",
        header: "الباركود",
        accessor: (m) => (
          <span className="font-mono text-[11px] bg-slate-50 text-slate-600 px-2 py-1 rounded-md border border-slate-200">
            {m.barcode || "—"}
          </span>
        ),
        className: "w-[110px]"
      },
      { 
        id: "name",
        header: "اسم المادة", 
        accessor: "name", 
        className: "font-bold text-slate-800" 
      },
      { 
        id: "categories",
        header: "التصنيفات", 
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
                    className={cn("text-[10px] font-medium px-2 py-0 border-slate-200", cat.is_hybrid && "border-purple-200 bg-purple-50 text-purple-700")}
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
      { 
        id: "units",
        header: "الوحدات", 
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
        className: "min-w-[120px]"
      },
      { 
        id: "total_available",
        header: "المتوفر", 
        accessor: (m) => parseFloat(m.total_available).toLocaleString(), 
        align: "center", 
        className: "tabular-nums font-bold text-slate-700" 
      },
    ];

    // Dynamic Multi-Currency Price/Cost Columns grouped by Type
    
    // 1. Average Cost
    currencies.forEach(curr => {
      const symbol = curr.symbol || curr.code;
      cols.push({
        id: `average_cost_${curr.code}`,
        header: `التكلفة (${symbol})`,
        accessor: (m) => {
          // average_cost_base is usually the reference cost in base currency
          const cost = parseFloat(m.average_cost_base || "0");
          return formatAmount(cost, { currencyCode: curr.code });
        },
        align: "left",
        className: "tabular-nums font-bold text-amber-600 text-[11px]"
      });
    });

    // 2. Last Purchase Price
    currencies.forEach(curr => {
      const symbol = curr.symbol || curr.code;
      cols.push({
        id: `last_purchase_${curr.code}`,
        header: `آخر شراء (${symbol})`,
        accessor: (m) => {
          const price = parseFloat(m.last_purchase_price_base || "0");
          return formatAmount(price, { currencyCode: curr.code });
        },
        align: "left",
        className: "tabular-nums font-medium text-slate-600 text-[11px]"
      });
    });

    // 3. Last Sale Price
    currencies.forEach(curr => {
      const symbol = curr.symbol || curr.code;
      cols.push({
        id: `last_sale_${curr.code}`,
        header: `آخر مبيع (${symbol})`,
        accessor: (m) => {
          const price = parseFloat(m.last_sale_price_base || "0");
          return formatAmount(price, { currencyCode: curr.code });
        },
        align: "left",
        className: "tabular-nums font-medium text-slate-600 text-[11px]"
      });
    });

    cols.push({
      id: "actions",
      header: "إجراءات",
      accessor: (m) => (
        <TableActions 
          onEdit={() => onEdit(m)}
          onDelete={() => onDelete(m.id, m.name)}
          extraActions={[
            {
              label: "إدارة وحدات القياس",
              icon: Scale,
              onClick: () => onManageUnits?.(m)
            }
          ]}
        />
      ),
      align: "left",
      className: "w-24"
    });

    return cols;
  }, [categories, onEdit, onDelete, onManageUnits, formatAmount, currencies]);

  const filteredColumns = useMemo(() => {
    return columns.filter(col => {
      if (!col.id || col.id === "actions") return true;
      return visibleColumns.includes(col.id);
    });
  }, [columns, visibleColumns]);

  return (
    <DataTable
      data={materials}
      columns={filteredColumns}
      loading={loading}
      onRowClick={onRowClick}
      selectedId={selectedId}
      emptyMessage={search ? "لا توجد مواد تطابق معايير البحث" : "قائمة المواد فارغة، ابدأ بإضافة مواد جديدة"}
    />
  );
}
