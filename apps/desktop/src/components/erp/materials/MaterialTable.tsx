import { useMemo } from "react";
import { DataTable, Column } from "@/components/erp/shared/DataTable";
import { TableActions } from "@/components/erp/shared/TableActions";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Shuffle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MaterialDto, CategoryDto } from "@erp/shared-types";

interface MaterialTableProps {
  materials: MaterialDto[];
  categories: CategoryDto[];
  loading: boolean;
  search: string;
  onEdit: (m: MaterialDto) => void;
  onDelete: (id: string, name: string) => void;
}

export function MaterialTable({ materials, categories, loading, search, onEdit, onDelete }: MaterialTableProps) {
  const columns = useMemo<Column<MaterialDto>[]>(() => [
    { 
      header: "الكود", 
      accessor: (m) => (
        <span className="font-mono text-[11px] bg-slate-100 text-slate-700 px-2 py-1 rounded-md font-bold ring-1 ring-slate-200/50">
          {m.code || "—"}
        </span>
      ),
      className: "w-[120px]"
    },
    { 
      header: "اسم المادة", 
      accessor: "name", 
      className: "font-bold text-slate-800" 
    },
    { 
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
      header: "المخزون", 
      accessor: (m) => m.stock_quantity.toLocaleString(), 
      align: "center", 
      className: "tabular-nums font-bold text-slate-700 w-[100px]" 
    },
    { 
      header: "الحالة", 
      accessor: (m) => <StatusBadge status={m.is_active ? "active" : "inactive"} />, 
      align: "center", 
      className: "w-[100px]" 
    },
    {
      header: "إجراءات",
      accessor: (m) => (
        <TableActions 
          onEdit={() => onEdit(m)}
          onDelete={() => onDelete(m.id, m.name)}
        />
      ),
      align: "left",
      className: "w-16"
    }
  ], [categories, onEdit, onDelete]);

  return (
    <DataTable
      data={materials}
      columns={columns}
      loading={loading}
      emptyMessage={search ? "لا توجد مواد تطابق معايير البحث" : "قائمة المواد فارغة، ابدأ بإضافة مواد جديدة"}
    />
  );
}
