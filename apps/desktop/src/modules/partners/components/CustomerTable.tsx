import { useMemo } from "react";
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { TableShell } from '@widgets/table-shell/TableShell';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useUnifiedColumns, useSortable, useTableColumns, useBaseCurrencyColumns } from "@shared/hooks";
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
  const { isBaseCurrency } = useBaseCurrencyColumns();
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
        accessor: (c) => c.code || "",
        className: "font-black text-slate-900 text-center",
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
        )
      },
      {
        id: "phone",
        header: "رقم الهاتف",
        label: "رقم الهاتف",
        accessor: (c) => c.phone || "",
        className: "tabular-nums text-slate-500"
      },
    ];

    cols.push(getAccountStatusColumn("حالة الحساب"));

    // Wrap the balance column factory so secondary currency columns are visually de-emphasized.
    const balanceCols = getBalanceColumns("الرصيد").map((c) => {
      const m = c.id.match(/^balance_(.+)$/);
      if (m && !isBaseCurrency(m[1])) {
        return {
          ...c,
          className: "tabular-nums font-medium text-slate-400",
          label: `${c.label}`,
        };
      }
      return c;
    });
    cols.push(...balanceCols);

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
      )
    });

    return cols;
  }, [onView, onEdit, onDelete, onJournal, onDocument, getAccountStatusColumn, getBalanceColumns, isBaseCurrency]);

  // Default visible: only base currency's balance is shown; secondary balances are hidden.
  const defaultVisible = useMemo(() => {
    const ids: string[] = ["code", "name", "status"];
    currencies.forEach(curr => {
      if (isBaseCurrency(curr.code)) {
        ids.push(`balance_${curr.code}`);
      }
    });
    ids.push("actions");
    return ids;
  }, [currencies, isBaseCurrency]);

  const { enrichedColumns, toolbarColumns, toggleColumn, resetToDefault, isModified } = useUnifiedColumns({
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
      searchPlaceholder="بحث باسم العميل أو الرقم..."
      columns={toolbarColumns}
      onColumnToggle={toggleColumn}
      onColumnsReset={resetToDefault}
      columnsModified={isModified}
      showToolbar={true}
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
