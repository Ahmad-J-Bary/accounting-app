import { useMemo } from "react";
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { TableShell } from '@widgets/table-shell/TableShell';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useUnifiedColumns, useSortable, useTableColumns } from "@shared/hooks";
import type { CustomerDto } from "@erp/shared-types";
import { NotebookText, Receipt, User } from "lucide-react";
import { TableActions } from "@widgets/table-shell/TableActions";


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
        header: "#", 
        label: "رقم الحساب",
        accessor: (c) => (
          <span className="font-black text-slate-500">{c.code || "—"}</span>
        ),
        className: "w-16",
        align: "center"
      },
      { 
        id: "name",
        header: "اسم العميل", 
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
    cols.push(getAccountStatusColumn("حالة الحساب"));

    // Balances
    cols.push(...getBalanceColumns("الرصيد"));

    // Actions
    cols.push({
      id: "actions",
      header: "إجراءات",
      label: "إجراءات",
      accessor: (c) => (
        <TableActions
          onView={() => onView(c)}
          onEdit={() => onEdit(c)}
          onDelete={onDelete ? () => onDelete(c.id) : undefined}
          extraActions={[
            ...(onJournal ? [{ label: "اليومية", icon: NotebookText, onClick: () => onJournal(c) }] : []),
            ...(onDocument ? [{ label: "سند قبض", icon: Receipt, onClick: () => onDocument(c) }] : []),
          ]}
        />
      ),
      align: "center",
      className: "w-[80px]"
    });

    return cols;
  }, [onView, onEdit, onDelete, onJournal, onDocument, getAccountStatusColumn, getBalanceColumns]);

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
        enableResize
        tableId="customers"
        sortField={sortField}
        sortDirection={sortDirection}
        onRowClick={onView}
        selectedId={selectedId}
        onHeaderClick={(col) => {
          if (col.id === "code") handleSort("code");
          else if (col.id === "name") handleSort("name");
          else if (col.id === "status" || col.id?.startsWith("balance_")) handleSort("balance");
        }}
        emptyMessage={search ? "لا توجد نتائج بحث تطابق استعلامك" : "لا يوجد عملاء مسجلون حالياً"}
        summary={summaryColumns}
      />
    </TableShell>
  );
}
