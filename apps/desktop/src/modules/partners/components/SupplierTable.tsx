import { useMemo } from "react";
import { UnifiedTable, type UnifiedColumn } from "@widgets/table-shell/UnifiedTable";
import { TableShell } from "@widgets/table-shell/TableShell";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useUnifiedColumns, useSortable, useTableColumns } from "@shared/hooks";
import type { SupplierDto } from "@erp/shared-types";
import { NotebookText, Receipt, Truck } from "lucide-react";
import { TableActions } from "@widgets/table-shell/TableActions";

interface SupplierTableProps {
  suppliers: SupplierDto[];
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
  onView: (s: SupplierDto) => void;
  onEdit: (s: SupplierDto) => void;
  onDelete?: (id: string) => void;
  onJournal?: (s: SupplierDto) => void;
  onDocument?: (s: SupplierDto) => void;
  selectedId?: string | null;
}

type SortField = "code" | "name" | "balance";

export function SupplierTable({ suppliers, loading, search, onSearchChange, onView, onEdit, onDelete, onJournal, onDocument, selectedId }: SupplierTableProps) {
  const { currencies } = useCurrencyContext();
  const { getAccountStatusColumn, getBalanceColumns, getSummaryColumns } = useTableColumns();

  const { sortedData: sortedSuppliers, sortField, sortDirection, handleSort } = useSortable({
    data: suppliers,
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

  const allColumns = useMemo<UnifiedColumn<SupplierDto>[]>(() => {
    const cols: UnifiedColumn<SupplierDto>[] = [
      {
        id: "code",
        header: "#",
        label: "رقم الحساب",
        accessor: (s) => (
          <span className="font-black text-slate-500">{s.code || "—"}</span>
        ),
        align: "center"
      },
      {
        id: "name",
        header: "اسم المورد",
        label: "اسم المورد",
        accessor: (s) => (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-600 shrink-0">
              <Truck className="w-4 h-4" />
            </div>
            <span className="font-bold text-slate-800">{s.name}</span>
          </div>
        )
      },
      {
        id: "phone",
        header: "رقم الهاتف",
        label: "رقم الهاتف",
        accessor: (s) => s.phone || "—",
        className: "tabular-nums text-slate-500"
      },
    ];

    cols.push(getAccountStatusColumn("حالة الحساب", { isCreditFirst: true }));
    cols.push(...getBalanceColumns("الرصيد"));

    cols.push({
      id: "actions",
      header: "إجراءات",
      label: "إجراءات",
      accessor: (s) => (
        <TableActions
          onView={() => onView(s)}
          onEdit={() => onEdit(s)}
          onDelete={onDelete ? () => onDelete(s.id) : undefined}
          extraActions={[
            ...(onJournal ? [{ label: "اليومية", icon: NotebookText, onClick: () => onJournal(s) }] : []),
            ...(onDocument ? [{ label: "سند دفع", icon: Receipt, onClick: () => onDocument(s) }] : []),
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
    tableId: "suppliers-unified",
    columns: allColumns,
    defaultVisible,
  });

  const summaryColumns = getSummaryColumns(enrichedColumns, sortedSuppliers, "مورد", { isCreditFirst: true });

  return (
    <TableShell
      title="سجل الموردين"
      search={search}
      onSearchChange={onSearchChange}
      columns={toolbarColumns}
      onColumnToggle={toggleColumn}
    >
      <UnifiedTable
        data={sortedSuppliers}
        columns={enrichedColumns}
        loading={loading}
        enableResize
        tableId="suppliers"
        sortField={sortField}
        sortDirection={sortDirection}
        onHeaderClick={(col) => {
          if (col.id === "#" || col.id === "name") {
            handleSort(col.id === "#" ? "code" : "name");
          }
          if (col.id === "status" || col.id?.startsWith("balance_")) {
            handleSort("balance");
          }
        }}
        onRowClick={onView}
        selectedId={selectedId}
        emptyMessage={search ? "لا توجد نتائج بحث تطابق استعلامك" : "قائمة الموردين فارغة حالياً"}
        summary={summaryColumns}
      />
    </TableShell>
  );
}