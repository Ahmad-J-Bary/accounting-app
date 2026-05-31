import { useMemo } from "react";
import { Plus, Shuffle, Eye, Edit, Trash2, MoreHorizontal } from "lucide-react";
import { cn } from '@shared/lib/utils';
import type { MaterialDto, CategoryDto } from "@erp/shared-types";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { Badge } from "@shared/ui/badge";
import { Button } from "@shared/ui/button";
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { TableShell } from '@widgets/table-shell/TableShell';
import { useUnifiedColumns, useSortable } from '@shared/hooks';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@shared/ui/dropdown-menu";
import { SortableHeader } from "@shared/ui/sortable-header";

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

type SortField = "code" | "name" | "total_available" | "total_received" | "total_sold" | "minimum_stock" | "average_cost";

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
      }
      return direction === "asc" ? comparison : -comparison;
    }
  });

  const allColumns = useMemo<UnifiedColumn<MaterialDto>[]>(() => {
    const cols: UnifiedColumn<MaterialDto>[] = [
      {
        id: "code",
        header: <SortableHeader field="code" label="الكود" currentField={sortField} direction={sortDirection} onSort={handleSort} stopPropagation />,
        label: "الكود",
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
        label: "الباركود",
        accessor: (m) => (
          <span className="font-mono text-[11px] bg-slate-50 text-slate-600 px-2 py-1 rounded-md border border-slate-200">
            {m.barcode || "—"}
          </span>
        ),
        className: "w-[110px]"
      },
      {
        id: "name",
        header: <SortableHeader field="name" label="اسم المادة" currentField={sortField} direction={sortDirection} onSort={handleSort} stopPropagation />,
        label: "اسم المادة",
        accessor: (m) => (
          <div className="flex items-center gap-3">
            {m.image_path && (
              <div className="w-8 h-8 rounded border bg-slate-50 overflow-hidden flex-shrink-0">
                <img src={m.image_path} alt={m.name} className="w-full h-full object-contain" />
              </div>
            )}
            <div className="flex flex-col">
              <span className="font-bold text-slate-800">{m.name}</span>
              {m.name_en && <span className="text-[10px] text-slate-400 font-medium" dir="ltr">{m.name_en}</span>}
            </div>
          </div>
        ),
        className: "min-w-[200px]"
      },
      {
        id: "categories",
        header: "التصنيفات",
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
      {
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
        className: "min-w-[120px]"
      },
      {
        id: "total_available",
        header: <SortableHeader field="total_available" label="المتوفر" currentField={sortField} direction={sortDirection} onSort={handleSort} stopPropagation />,
        label: "المتوفر",
        accessor: (m) => parseFloat(m.total_available).toLocaleString(),
        align: "center",
        className: "tabular-nums font-bold text-slate-700"
      },
      {
        id: "total_received",
        header: <SortableHeader field="total_received" label="إجمالي الوارد" currentField={sortField} direction={sortDirection} onSort={handleSort} stopPropagation />,
        label: "إجمالي الوارد",
        accessor: (m) => parseFloat(m.total_received || "0").toLocaleString(),
        align: "center",
        className: "tabular-nums text-emerald-600"
      },
      {
        id: "total_sold",
        header: <SortableHeader field="total_sold" label="إجمالي المبيع" currentField={sortField} direction={sortDirection} onSort={handleSort} stopPropagation />,
        label: "إجمالي المبيع",
        accessor: (m) => parseFloat(m.total_sold || "0").toLocaleString(),
        align: "center",
        className: "tabular-nums text-blue-600"
      },
      {
        id: "total_damaged",
        header: "إجمالي التالف",
        label: "إجمالي التالف",
        accessor: (m) => parseFloat(m.total_damaged || "0").toLocaleString(),
        align: "center",
        className: "tabular-nums text-rose-600"
      },
      {
        id: "minimum_stock",
        header: <SortableHeader field="minimum_stock" label="حد الطلب" currentField={sortField} direction={sortDirection} onSort={handleSort} stopPropagation />,
        label: "حد الطلب",
        accessor: (m) => (
          <span className={cn(
            "tabular-nums font-medium",
            parseFloat(m.total_available) <= parseFloat(m.minimum_stock) ? "text-rose-600 font-bold" : "text-slate-500"
          )}>
            {parseFloat(m.minimum_stock).toLocaleString()}
          </span>
        ),
        align: "center"
      },
      {
        id: "default_purchase_unit",
        header: "الوحدة الافتراضية / شراء",
        label: "وحدة الشراء",
        accessor: (m) => m.units?.find(u => u.id === m.default_purchase_unit_id)?.name || "—",
        className: "w-[150px]"
      },
      {
        id: "default_sale_unit",
        header: "الوحدة الافتراضية / مبيع",
        label: "وحدة المبيع",
        accessor: (m) => m.units?.find(u => u.id === m.default_sale_unit_id)?.name || "—",
        className: "w-[150px]"
      },
      {
        id: "name_en",
        header: "الاسم (EN)",
        label: "الاسم (EN)",
        accessor: (m) => m.name_en || "—",
        className: "w-[150px]"
      },
      {
        id: "notes",
        header: "ملاحظة",
        label: "ملاحظات",
        accessor: (m) => m.notes || "—",
        className: "w-[200px]"
      }
    ];

    // Multi-currency price columns
    currencies.forEach(curr => {
      const symbol = curr.symbol || curr.code;
      cols.push({
        id: `average_cost_${curr.code}`,
        header: `التكلفة (${symbol})`,
        label: `التكلفة (${symbol})`,
        accessor: (m) => {
          const val = curr.is_base ? parseFloat(m.average_cost_base || "0") :
                    parseFloat(m.average_cost || "0");
          return formatAmount(val, { currencyCode: curr.code });
        },
        align: "left",
        className: "tabular-nums font-bold text-amber-600 text-[11px]"
      });
    });

    // Multi-currency last purchase columns
    currencies.forEach(curr => {
      const symbol = curr.symbol || curr.code;
      cols.push({
        id: `last_purchase_${curr.code}`,
        header: `آخر شراء (${symbol})`,
        label: `آخر شراء (${symbol})`,
        accessor: (m) => {
          const val = curr.is_base ? parseFloat(m.last_purchase_price_base || "0") :
                    parseFloat(m.last_purchase_price || "0");
          return val > 0 ? formatAmount(val, { currencyCode: curr.code }) : "—";
        },
        align: "left",
        className: "tabular-nums font-bold text-slate-600 text-[11px]"
      });
    });

    // Multi-currency last sale columns
    currencies.forEach(curr => {
      const symbol = curr.symbol || curr.code;
      cols.push({
        id: `last_sale_${curr.code}`,
        header: `آخر مبيع (${symbol})`,
        label: `آخر مبيع (${symbol})`,
        accessor: (m) => {
          const val = curr.is_base ? parseFloat(m.last_sale_price_base || "0") :
                    parseFloat(m.last_sale_price || "0");
          return val > 0 ? formatAmount(val, { currencyCode: curr.code }) : "—";
        },
        align: "left",
        className: "tabular-nums font-bold text-slate-600 text-[11px]"
      });
    });

    // Actions column
    cols.push({
      id: "actions",
      header: "إجراءات",
      label: "إجراءات",
      accessor: (m) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            <DropdownMenuItem onClick={() => onRowClick?.(m)} className="flex-row-reverse gap-2">
              <Eye className="w-4 h-4" /> عرض التفاصيل
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(m)} className="flex-row-reverse gap-2 text-blue-600 focus:text-blue-600">
              <Edit className="w-4 h-4" /> تعديل
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDelete(m.id, m.name)} className="flex-row-reverse gap-2 text-rose-600 focus:text-rose-600">
              <Trash2 className="w-4 h-4" /> حذف
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      align: "center",
      className: "w-[80px]"
    });

    return cols;
  }, [categories, onManageUnits, formatAmount, currencies, onEdit, onDelete, onRowClick, sortField, sortDirection, handleSort]);

  const { enrichedColumns, toolbarColumns, toggleColumn } = useUnifiedColumns({
    tableId: "materials-unified",
    columns: allColumns,
    defaultVisible: allColumns.map(c => c.id),
  });

  return (
    <TableShell
      title="قائمة المواد"
      search={search}
      onSearchChange={onSearchChange}
      columns={toolbarColumns}
      onColumnToggle={toggleColumn}
    >
      <UnifiedTable
        data={sortedMaterials}
        columns={enrichedColumns}
        loading={loading}
        onRowClick={onRowClick}
        selectedId={selectedId}
        emptyMessage={search ? "لا توجد مواد تطابق معايير البحث" : "قائمة المواد فارغة"}
      />
    </TableShell>
  );
}
