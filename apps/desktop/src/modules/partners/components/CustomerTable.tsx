import { useMemo } from "react";
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { TableShell } from '@widgets/table-shell/TableShell';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useUnifiedColumns, useSortable, useTableColumns } from "@shared/hooks";
import type { CustomerDto } from "@erp/shared-types";
import { Eye, Pencil, Trash2, NotebookText, Receipt, User } from "lucide-react";
import { ActionsDropdown } from "@shared/ui/actions-dropdown";
import { SortableHeader } from "@shared/ui/sortable-header";

interface CustomerTableProps {
  customers: CustomerDto[];
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
  onView: (c: CustomerDto) => void;
  onEdit: (c: CustomerDto) => void;
  onDelete?: (id: string) => void;
  onJournal?: (c: CustomerDto) => void;
  onDocument?: (c: CustomerDto) => void;
  selectedId?: string | null;
}

type SortField = "code" | "name" | "balance";

export function CustomerTable({ customers, loading, search, onSearchChange, onView, onEdit, onDelete, onJournal, onDocument, selectedId }: CustomerTableProps) {
  const { currencies } = useCurrencyContext();
  const { getAccountStatusColumn, getBalanceColumns, getSummaryColumns } = useTableColumns();
  
  const { sortedData: sortedCustomers, sortField, sortDirection, handleSort } = useSortable({
    data: customers,
    defaultField: "code" as SortField,
    sortFn: (a, b, field, direction) => {
      let comparison = 0;
      switch (field) {
        case "code": comparison = (parseInt(a.code || "0", 10) || 0) - (parseInt(b.code || "0", 10) || 0); break;
        case "name": comparison = (a.name || "").localeCompare(b.name || "", "ar"); break;
        case "balance": comparison = (Number(a.balance) || 0) - (Number(b.balance) || 0); break;
      }
      return direction === "asc" ? comparison : -comparison;
    }
  });

  const allColumns = useMemo<UnifiedColumn<CustomerDto>[]>(() => {
    const cols: UnifiedColumn<CustomerDto>[] = [
      { 
        id: "code",
        header: <SortableHeader field="code" label="#" currentField={sortField} direction={sortDirection} onSort={handleSort} stopPropagation />, 
        label: "رقم الحساب",
        accessor: (c) => (
          <span className="font-black text-slate-500">{c.code || "—"}</span>
        ),
        className: "w-16",
        align: "center"
      },
      { 
        id: "name",
        header: <SortableHeader field="name" label="اسم العميل" currentField={sortField} direction={sortDirection} onSort={handleSort} stopPropagation />, 
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

    // Account Status
    cols.push(getAccountStatusColumn(
      <SortableHeader field="balance" label="حالة الحساب" currentField={sortField} direction={sortDirection} onSort={handleSort} stopPropagation />
    ));

    // Balances
    cols.push(...getBalanceColumns(
      <SortableHeader field="balance" label="الرصيد" currentField={sortField} direction={sortDirection} onSort={handleSort} stopPropagation />
    ));

    // Actions
    cols.push({
      id: "actions",
      header: "إجراءات",
      label: "إجراءات",
      accessor: (c) => (
        <ActionsDropdown
          actions={[
            { label: "عرض الملف", icon: <Eye className="w-4 h-4" />, onClick: () => onView(c) },
            { label: "تعديل البيانات", icon: <Pencil className="w-4 h-4" />, onClick: () => onEdit(c), className: "text-blue-600 focus:text-blue-600" },
            ...(onDelete ? [{ label: "حذف العميل", icon: <Trash2 className="w-4 h-4" />, onClick: () => onDelete(c.id), className: "text-red-600 focus:text-red-600" }] : []),
            ...(onJournal ? [{ label: "اليومية", icon: <NotebookText className="w-4 h-4" />, onClick: () => onJournal(c) }] : []),
            ...(onDocument ? [{ label: "سند قبض", icon: <Receipt className="w-4 h-4" />, onClick: () => onDocument(c) }] : []),
          ]}
        />
      ),
      align: "center",
      className: "w-[80px]"
    });

    return cols;
  }, [sortField, sortDirection, handleSort, onView, onEdit, onDelete, onJournal, onDocument, getAccountStatusColumn, getBalanceColumns]);

  const defaultVisible = useMemo(() =>
    ["code", "name", "phone", "status", ...currencies.map(c => `balance_${c.code}`), "actions"],
  [currencies]);

  const { enrichedColumns, toolbarColumns, toggleColumn } = useUnifiedColumns({
    tableId: "customers-unified",
    columns: allColumns,
    defaultVisible,
  });

  const summaryColumns = getSummaryColumns(enrichedColumns, sortedCustomers, "عميل");

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
        summary={summaryColumns}
      />
    </TableShell>
  );
}
