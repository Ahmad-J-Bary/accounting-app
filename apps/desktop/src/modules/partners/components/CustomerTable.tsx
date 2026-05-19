import { useMemo, useState, useCallback } from "react";
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { TableShell } from '@widgets/table-shell/TableShell';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useColumnPreferences } from "@shared/hooks/useColumnPreferences";
import type { CustomerDto } from "@erp/shared-types";
import { ArrowUpDown, Eye, MoreHorizontal, Pencil, Trash2, User } from "lucide-react";
import { Button } from "@shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@shared/ui/dropdown-menu";

interface CustomerTableProps {
  customers: CustomerDto[];
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
  onView: (c: CustomerDto) => void;
  onEdit?: (c: CustomerDto) => void;
  onDelete?: (id: string) => void;
  selectedId?: string | null;
}

type SortField = "code" | "name" | "debit" | "credit";

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

export function CustomerTable({ customers, loading, search, onSearchChange, onView, onEdit, onDelete, selectedId }: CustomerTableProps) {
  const { currencies, convertFromBase, formatAmount } = useCurrencyContext();
  const [sortField, setSortField] = useState<SortField>("code");
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

  const sortedCustomers = useMemo(() => {
    const sorted = [...customers].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "code": comparison = (parseInt(a.code || "0", 10) || 0) - (parseInt(b.code || "0", 10) || 0); break;
        case "name": comparison = (a.name || "").localeCompare(b.name || "", "ar"); break;
        case "debit": comparison = (Number(a.debit) || 0) - (Number(b.debit) || 0); break;
        case "credit": comparison = (Number(a.credit) || 0) - (Number(b.credit) || 0); break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
    return sorted;
  }, [customers, sortField, sortDirection]);

  const allColumns = useMemo<UnifiedColumn<CustomerDto>[]>(() => {
    const cols: UnifiedColumn<CustomerDto>[] = [
      { 
        id: "code",
        header: <SortableHeader field="code" label="#" currentField={sortField} direction={sortDirection} onSort={handleSort} />, 
        label: "رقم الحساب",
        accessor: (c) => (
          <span className="font-black text-slate-500">{c.code || "—"}</span>
        ),
        className: "w-16",
        align: "center"
      },
      { 
        id: "name",
        header: <SortableHeader field="name" label="اسم العميل" currentField={sortField} direction={sortDirection} onSort={handleSort} />, 
        label: "اسم العميل",
        accessor: (c) => (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
              <User className="w-4 h-4" />
            </div>
            <span className="font-bold text-slate-800">{c.name}</span>
          </div>
        ),
        className: "min-w-[200px]"
      },
      { 
        id: "phone",
        header: "رقم الهاتف", 
        label: "رقم الهاتف",
        accessor: (c) => c.phone || "—", 
        className: "tabular-nums text-slate-500 w-[140px]" 
      },
    ];

    // Debits
    currencies.forEach(curr => {
      const symbol = curr.code === 'USD' ? '$' : curr.code === 'SYP' ? 'ل.س' : (curr.symbol || curr.code);
      cols.push({
        id: `debit_${curr.code}`,
        header: <SortableHeader field="debit" label={`مدين (${symbol})`} currentField={sortField} direction={sortDirection} onSort={handleSort} />,
        label: `إجمالي المدين (${symbol})`,
        accessor: (c) => {
          const val = Number(c.debit || 0);
          // If the currency is not base, we might need conversion if the data doesn't have it
          // Assuming formatAmount handles conversion if currencyCode is provided
          return val > 0 ? formatAmount(val, { currencyCode: curr.code }) : "—";
        },
        align: "left",
        className: "text-red-600 tabular-nums font-bold"
      });
    });

    // Credits
    currencies.forEach(curr => {
      const symbol = curr.code === 'USD' ? '$' : curr.code === 'SYP' ? 'ل.س' : (curr.symbol || curr.code);
      cols.push({
        id: `credit_${curr.code}`,
        header: <SortableHeader field="credit" label={`دائن (${symbol})`} currentField={sortField} direction={sortDirection} onSort={handleSort} />,
        label: `إجمالي الدائن (${symbol})`,
        accessor: (c) => {
          const val = Number(c.credit || 0);
          return val > 0 ? formatAmount(val, { currencyCode: curr.code }) : "—";
        },
        align: "left",
        className: "text-emerald-600 tabular-nums font-bold"
      });
    });

    // Actions
    cols.push({
      id: "actions",
      header: "إجراءات",
      label: "إجراءات",
      accessor: (c) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            <DropdownMenuItem onClick={() => onView(c)} className="flex-row-reverse gap-2">
              <Eye className="w-4 h-4" /> عرض الملف
            </DropdownMenuItem>
            {(onEdit || onDelete) && <div className="h-px bg-slate-100 my-1" />}
            {onEdit && (
              <DropdownMenuItem onClick={() => onEdit(c)} className="flex-row-reverse gap-2">
                <Pencil className="w-4 h-4" /> تعديل البيانات
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem onClick={() => onDelete(c.id)} className="flex-row-reverse gap-2 text-red-600">
                <Trash2 className="w-4 h-4" /> حذف
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      align: "center",
      className: "w-[80px]"
    });

    return cols;
  }, [currencies, formatAmount, sortField, sortDirection, handleSort, onView, onEdit, onDelete]);

  const defaultVisible = ["code", "name", "phone", "debit_USD", "credit_USD", "actions"];
  const { visibleColumns, toggleColumn } = useColumnPreferences("customers-unified", defaultVisible);

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
      title="سجل العملاء"
      search={search}
      onSearchChange={onSearchChange}
      columns={toolbarColumns}
      onColumnToggle={toggleColumn}
    >
      <UnifiedTable
        data={sortedCustomers}
        columns={enrichedColumns}
        loading={loading}
        onRowClick={onView}
        selectedId={selectedId}
        emptyMessage={search ? "لا توجد نتائج بحث تطابق استعلامك" : "لا يوجد عملاء مسجلون حالياً"}
      />
    </TableShell>
  );
}
