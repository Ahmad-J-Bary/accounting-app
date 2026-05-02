import { useMemo } from "react";
import { DataTable, Column } from "@/components/erp/shared/DataTable";
import { TableActions } from "@/components/erp/shared/TableActions";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shuffle, Scale, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MaterialDto, CategoryDto } from "@erp/shared-types";

interface MaterialTableProps {
  materials: MaterialDto[];
  categories: CategoryDto[];
  loading: boolean;
  search: string;
  onEdit: (m: MaterialDto) => void;
  onDelete: (id: string, name: string) => void;
  onManageUnits?: (material: MaterialDto) => void;
  visibleColumns: string[];
}

export function MaterialTable({ materials, categories, loading, search, onEdit, onDelete, onManageUnits, visibleColumns }: MaterialTableProps) {
  const columns = useMemo<Column<MaterialDto>[]>(() => [
    { 
      id: "code",
      header: "الكود", 
      accessor: (m) => (
        <span className="font-mono text-[11px] bg-slate-100 text-slate-700 px-2 py-1 rounded-md font-bold ring-1 ring-slate-200/50">
          {m.code || "—"}
        </span>
      ),
      className: "w-[120px]"
    },
    {
      id: "barcode",
      header: "الباركود",
      accessor: (m) => (
        <span className="font-mono text-[11px] bg-slate-50 text-slate-600 px-2 py-1 rounded-md border border-slate-200">
          {m.barcode || "—"}
        </span>
      ),
      className: "w-[120px]"
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
      accessor: (m) => {
        return (
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
              title="إدارة الوحدات"
            >
              <Plus className="w-3 h-3" />
            </Button>
          </div>
        );
      },
      className: "min-w-[150px]"
    },
    { 
      id: "total_received",
      header: "الكمية الكلية", 
      accessor: (m) => parseFloat(m.total_received).toLocaleString(), 
      align: "center", 
      className: "tabular-nums font-medium text-green-600" 
    },
    { 
      id: "total_sold",
      header: "الكمية المباعة", 
      accessor: (m) => parseFloat(m.total_sold).toLocaleString(), 
      align: "center", 
      className: "tabular-nums font-medium text-blue-600" 
    },
    { 
      id: "total_available",
      header: "الكمية المتوفرة", 
      accessor: (m) => parseFloat(m.total_available).toLocaleString(), 
      align: "center", 
      className: "tabular-nums font-bold text-slate-700" 
    },
    { 
      id: "total_damaged",
      header: "التالف", 
      accessor: (m) => parseFloat(m.total_damaged).toLocaleString(), 
      align: "center", 
      className: "tabular-nums font-medium text-red-600" 
    },
    { 
      id: "average_cost",
      header: "متوسط التكلفة", 
      accessor: (m) => parseFloat(m.average_cost).toLocaleString(), 
      align: "center", 
      className: "tabular-nums font-bold text-amber-600" 
    },
    { 
      id: "last_purchase_price",
      header: "آخر شراء", 
      accessor: (m) => parseFloat(m.last_purchase_price).toLocaleString(), 
      align: "center", 
      className: "tabular-nums text-slate-600" 
    },
    { 
      id: "last_sale_price",
      header: "آخر مبيع", 
      accessor: (m) => parseFloat(m.last_sale_price).toLocaleString(), 
      align: "center", 
      className: "tabular-nums text-slate-600" 
    },
    {
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
    }
  ], [categories, onEdit, onDelete, onManageUnits]);

  const filteredColumns = useMemo(() => {
    return columns.filter(col => {
      // Keep actions and fixed columns always visible if they don't have an ID or are not in the toggle list
      if (!col.id || col.id === "actions") return true;
      return visibleColumns.includes(col.id);
    });
  }, [columns, visibleColumns]);

  return (
    <DataTable
      data={materials}
      columns={filteredColumns}
      loading={loading}
      emptyMessage={search ? "لا توجد مواد تطابق معايير البحث" : "قائمة المواد فارغة، ابدأ بإضافة مواد جديدة"}
    />
  );
}
