import { useMemo, useState, useCallback } from "react";
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { TableShell } from '@widgets/table-shell/TableShell';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useColumnPreferences } from "@shared/hooks/useColumnPreferences";
import type { PartnerDto } from "@erp/shared-types";
import { ArrowUpDown, Eye, MoreHorizontal, Users, History, PlusCircle } from "lucide-react";
import { Button } from "@shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@shared/ui/dropdown-menu";

type PartnerWithRatios = PartnerDto & { 
  calculatedRatio: number; 
  calculatedCapitalRatio: number; 
  displayAmountLocal: number; 
  displayAmountUsd: number 
};

interface PartnerTableProps {
  partners: PartnerWithRatios[];
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
  onViewDrawings: (p: PartnerDto) => void;
  onAddDrawings: (p: PartnerDto) => void;
  onEdit: (p: PartnerDto) => void;
  selectedId?: string | null;
  onRowClick?: (p: PartnerDto) => void;
}

type SortField = "name" | "amount_usd" | "amount_local" | "capital_ratio" | "ratio";

interface SortableHeaderProps {
  field: SortField;
  label: string;
  currentField: SortField;
  direction: "asc" | "desc";
  onSort: (field: SortField) => void;
}

const SortableHeader = ({ field, label, currentField, direction, onSort }: SortableHeaderProps) => {
  const getSortIcon = (f: SortField) => {
    if (currentField !== f) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return direction === "asc" 
      ? <ArrowUpDown className="w-3 h-3 rotate-180" /> 
      : <ArrowUpDown className="w-3 h-3" />;
  };

  return (
    <button 
      onClick={(e) => { e.stopPropagation(); onSort(field); }}
      className="flex items-center gap-1 hover:text-slate-900 transition-colors"
    >
      {label}
      {getSortIcon(field)}
    </button>
  );
};

export function PartnerTable({ 
  partners, 
  loading, 
  search, 
  onSearchChange, 
  onViewDrawings, 
  onAddDrawings, 
  onEdit,
  selectedId, 
  onRowClick 
}: PartnerTableProps) {
  const { formatAmount } = useCurrencyContext();
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const handleSort = useCallback((field: SortField) => {
    setSortDirection(prev => {
      if (sortField === field) {
        return prev === "asc" ? "desc" : "asc";
      }
      return "asc";
    });
    setSortField(field);
  }, [sortField]);

  const sortedPartners = useMemo(() => {
    const sorted = [...partners].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "name": comparison = (a.name || "").localeCompare(b.name || "", "ar"); break;
        case "amount_usd": comparison = a.displayAmountUsd - b.displayAmountUsd; break;
        case "amount_local": comparison = a.displayAmountLocal - b.displayAmountLocal; break;
        case "capital_ratio": comparison = a.calculatedCapitalRatio - b.calculatedCapitalRatio; break;
        case "ratio": comparison = a.calculatedRatio - b.calculatedRatio; break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
    return sorted;
  }, [partners, sortField, sortDirection]);

  const allColumns = useMemo<UnifiedColumn<PartnerWithRatios>[]>(() => [
    { 
      id: "name",
      header: <SortableHeader field="name" label="اسم الشريك" currentField={sortField} direction={sortDirection} onSort={handleSort} />, 
      label: "اسم الشريك",
      accessor: (p: PartnerWithRatios) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
            <Users className="w-4 h-4" />
          </div>
          <span className="font-bold text-slate-800">{p.name}</span>
        </div>
      ),
      className: "min-w-[200px]"
    },
    { 
      id: "amount_usd",
      header: <SortableHeader field="amount_usd" label="رأس المال ($)" currentField={sortField} direction={sortDirection} onSort={handleSort} />,
      label: "رأس المال ($)",
      accessor: (p: PartnerWithRatios) => formatAmount(p.displayAmountUsd, { currencyCode: "USD" }),
      align: "left",
      className: "tabular-nums font-black text-blue-600"
    },
    { 
      id: "amount_local",
      header: <SortableHeader field="amount_local" label="رأس المال (ل.س)" currentField={sortField} direction={sortDirection} onSort={handleSort} />,
      label: "رأس المال (ل.س)",
      accessor: (p: PartnerWithRatios) => formatAmount(p.displayAmountLocal, { currencyCode: "SYP" }),
      align: "left",
      className: "tabular-nums font-black text-slate-900"
    },
    { 
      id: "capital_ratio",
      header: <SortableHeader field="capital_ratio" label="نسبة رأس المال" currentField={sortField} direction={sortDirection} onSort={handleSort} />,
      label: "نسبة المساهمة في رأس المال",
      accessor: (p: PartnerWithRatios) => (
        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-black tabular-nums">
          {p.calculatedCapitalRatio.toFixed(2)}%
        </span>
      ),
      align: "center",
      className: "w-28"
    },
    { 
      id: "ratio",
      header: <SortableHeader field="ratio" label="نسبة الأرباح" currentField={sortField} direction={sortDirection} onSort={handleSort} />,
      label: "نسبة توزيع الأرباح",
      accessor: (p: PartnerWithRatios) => (
        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black tabular-nums">
          {p.calculatedRatio.toFixed(2)}%
        </span>
      ),
      align: "center",
      className: "w-28"
    },
    {
      id: "actions",
      header: "إجراءات",
      label: "إجراءات",
      accessor: (p: PartnerWithRatios) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onClick={() => onViewDrawings(p)} className="flex-row-reverse gap-2">
              <History className="w-4 h-4" /> مسحوبات الشريك
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAddDrawings(p)} className="flex-row-reverse gap-2 text-amber-600 focus:text-amber-600">
              <PlusCircle className="w-4 h-4" /> سند مسحوبات
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(p)} className="flex-row-reverse gap-2 text-blue-600 focus:text-blue-600">
              <Eye className="w-4 h-4" /> تعديل البيانات
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      align: "center",
      className: "w-[80px]"
    }
  ], [formatAmount, sortField, sortDirection, handleSort, onViewDrawings, onAddDrawings, onEdit]);

  const defaultVisible = ["name", "amount_usd", "amount_local", "capital_ratio", "ratio", "actions"];
  const { visibleColumns, toggleColumn } = useColumnPreferences("partners-unified", defaultVisible);

  const enrichedColumns = useMemo(() => {
    return allColumns.map(col => ({
      ...col,
      visible: visibleColumns.includes(col.id)
    }));
  }, [allColumns, visibleColumns]);

  const toolbarColumns = useMemo(() => {
    return allColumns.map(c => ({
      id: c.id,
      label: c.label || (typeof c.header === 'string' ? c.header : c.id),
      visible: visibleColumns.includes(c.id)
    }));
  }, [allColumns, visibleColumns]);

  return (
    <TableShell
      title="سجل الشركاء"
      search={search}
      onSearchChange={onSearchChange}
      columns={toolbarColumns}
      onColumnToggle={toggleColumn}
    >
      <UnifiedTable<PartnerWithRatios>
        data={sortedPartners}
        columns={enrichedColumns}
        loading={loading}
        onRowClick={onRowClick}
        selectedId={selectedId}
        emptyMessage={search ? "لا توجد نتائج بحث تطابق استعلامك" : "لا يوجد شركاء مسجلون حالياً"}
      />
    </TableShell>
  );
}
