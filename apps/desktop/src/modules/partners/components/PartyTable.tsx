import { useMemo, useEffect } from "react";
import { UnifiedTable, type UnifiedColumn } from "@widgets/table-shell/UnifiedTable";
import type { SummaryColumn } from "@widgets/table-shell/TableSummary";
import { TableShell } from "@widgets/table-shell/TableShell";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useUnifiedColumns, useSortable, useTableColumns, useBaseCurrencyColumns } from "@shared/hooks";
import { formatNumber } from "@shared/lib/format";
import { NotebookText, Receipt, User, Truck } from "lucide-react";
import { TableActions } from "@widgets/table-shell/TableActions";
import { useLocalization } from "@app/providers/LocalizationProvider";
import { resolvePartnerDisplayName } from "@shared/lib/system-labels";

interface PartyTableProps<T extends { id: string; name: string; code?: string; phone?: string | null; balance?: string | number; notes?: string | null }> {
  entityName: "customer" | "supplier";
  data: T[];
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
  onView: (item: T) => void;
  onEdit: (item: T) => void;
  onDelete?: (id: string) => void;
  onJournal?: (item: T) => void;
  onDocument?: (item: T) => void;
  selectedId?: string | null;
  onVisibleColumnsChange?: (ids: string[]) => void;
}

const ENTITY_CONFIG = {
  customer: {
    icon: User,
    avatarBg: "bg-blue-50",
    avatarText: "text-blue-600",
    tableId: "customers",
    unifiedId: "customers-unified",
    title: "سجل العملاء",
    searchPlaceholder: "بحث باسم العميل أو الرقم...",
    emptyMessage: "لا يوجد عملاء مسجلون حالياً",
    summaryLabel: "عميل",
    documentLabel: "سند قبض",
    documentIcon: Receipt,
    isCreditFirst: false,
  },
  supplier: {
    icon: Truck,
    avatarBg: "bg-slate-50",
    avatarText: "text-slate-600",
    tableId: "suppliers",
    unifiedId: "suppliers-unified",
    title: "سجل الموردين",
    searchPlaceholder: "بحث باسم المورد أو الرقم...",
    emptyMessage: "قائمة الموردين فارغة حالياً",
    summaryLabel: "مورد",
    documentLabel: "سند دفع",
    documentIcon: Receipt,
    isCreditFirst: true,
  },
} as const;

export function PartyTable<T extends { id: string; name: string; code?: string; phone?: string | null; balance?: string | number; notes?: string | null }>({
  entityName,
  data,
  loading,
  search,
  onSearchChange,
  onView,
  onEdit,
  onDelete,
  onJournal,
  onDocument,
  selectedId,
  onVisibleColumnsChange,
}: PartyTableProps<T>) {
  const cfg = ENTITY_CONFIG[entityName];
  const Icon = cfg.icon;
  const { t, language } = useLocalization();
  const { currencies } = useCurrencyContext();
  const { isBaseCurrency } = useBaseCurrencyColumns();
  const { getAccountStatusColumn, getBalanceColumns, getSummaryColumns } = useTableColumns();

  const labels = useMemo(() => ({
    title: t(entityName === "customer" ? "partyTable.titleCustomer" : "partyTable.titleSupplier", { namespace: "partners"}),
    searchPlaceholder: t(entityName === "customer" ? "partyTable.searchPlaceholderCustomer" : "partyTable.searchPlaceholderSupplier", { namespace: "partners"}),
    emptyMessage: t(entityName === "customer" ? "partyTable.emptyCustomer" : "partyTable.emptySupplier", { namespace: "partners"}),
    summaryLabel: t(entityName === "customer" ? "partyTable.summaryLabelCustomer" : "partyTable.summaryLabelSupplier", { namespace: "partners"}),
    documentLabel: t(entityName === "customer" ? "partyTable.documentLabelCustomer" : "partyTable.documentLabelSupplier", { namespace: "partners"}),
  }), [t, entityName]);

  const { sortedData, sortField, sortDirection, handleSort } = useSortable({
    data,
    defaultField: "code" as string,
    sortFn: (a, b, field, direction) => {
      let comparison = 0;
      switch (field) {
        case "code":
          comparison = (parseInt(a.code || "0", 10) || 0) - (parseInt(b.code || "0", 10) || 0);
          break;
        case "name":
          comparison = (a.name || "").localeCompare(b.name || "", "ar");
          break;
        case "balance":
          comparison = (Number(a.balance) || 0) - (Number(b.balance) || 0);
          break;
      }
      return direction === "asc" ? comparison : -comparison;
    },
  });

  const allColumns = useMemo<UnifiedColumn<T>[]>(() => {
    const cols: UnifiedColumn<T>[] = [
      {
        id: "code",
        header: "#",
        label: t("columns.accountNumber", { namespace: "partners",  }),
        accessor: (item) => formatNumber(parseInt(item.code) || 0),
        className: "font-black text-slate-900 text-center",
      },
      {
        id: "name",
        header: entityName === "customer" ? t("columns.partyNameCustomer", { namespace: "partners",  }) : t("columns.partyNameSupplier", { namespace: "partners",  }),
        label: entityName === "customer" ? t("columns.partyNameCustomer", { namespace: "partners",  }) : t("columns.partyNameSupplier", { namespace: "partners",  }),
        accessor: (item) => (
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full ${cfg.avatarBg} flex items-center justify-center ${cfg.avatarText} shrink-0`}>
              <Icon className="w-4 h-4" />
            </div>
            <span className="font-bold text-slate-800">{resolvePartnerDisplayName(item.name, item.code || "", entityName, language, t)}</span>
          </div>
        ),
      },
      {
        id: "phone",
        header: t("columns.phone", { namespace: "partners",  }),
        label: t("columns.phone", { namespace: "partners",  }),
        accessor: (item) => item.phone || "",
        className: "tabular-nums text-slate-500",
      },
    ];

    cols.push(getAccountStatusColumn(t("columns.accountStatus", { namespace: "partners",  }), { partnerType: cfg.isCreditFirst ? "supplier" : "customer" }) as UnifiedColumn<T>);

    const balanceCols = getBalanceColumns().map((c) => {
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
    cols.push(...(balanceCols as UnifiedColumn<T>[]));

    cols.push({
      id: "notes",
      header: t("columns.notes", { namespace: "partners",  }),
      label: t("columns.notes", { namespace: "partners",  }),
      accessor: (item) => (
        <span className="text-slate-500 text-xs truncate max-w-[200px] block" title={item.notes || ""}>
          {item.notes || ""}
        </span>
      ),
    });

    cols.push({
      id: "actions",
      header: t("columns.actions", { namespace: "partners",  }),
      label: t("columns.actions", { namespace: "partners",  }),
      accessor: (item) => (
        <TableActions
          onView={() => onView(item)}
          onEdit={() => onEdit(item)}
          onDelete={onDelete ? () => onDelete(item.id) : undefined}
          extraActions={[
            ...(onJournal ? [{ label: t("actions.journal", { namespace: "partners",  }), icon: NotebookText, onClick: () => onJournal(item) }] : []),
            ...(onDocument
              ? [{ label: labels.documentLabel, icon: cfg.documentIcon, onClick: () => onDocument(item) }]
              : []),
          ]}
        />
      ),
    });

    return cols;
  }, [onView, onEdit, onDelete, onJournal, onDocument, getAccountStatusColumn, getBalanceColumns, isBaseCurrency, entityName, cfg, Icon, labels, t, language]);

  const defaultVisible = useMemo(() => {
    const ids: string[] = ["code", "name", "status"];
    currencies.forEach((curr) => {
      if (isBaseCurrency(curr.code)) {
        ids.push(`balance_${curr.code}`);
      }
    });
    ids.push("notes", "actions");
    return ids;
  }, [currencies, isBaseCurrency]);

  const { enrichedColumns, visibleColumns, toolbarColumns, toggleColumn, resetToDefault, isModified } = useUnifiedColumns({
    tableId: cfg.unifiedId,
    columns: allColumns,
    defaultVisible,
  });

  useEffect(() => {
    onVisibleColumnsChange?.(visibleColumns);
  }, [visibleColumns, onVisibleColumnsChange]);

  const summaryColumns: SummaryColumn[] = getSummaryColumns(
    enrichedColumns as UnifiedColumn<{ balance?: number | string; debit?: number | string; credit?: number | string; currency?: string }>[],
    sortedData,
    labels.summaryLabel,
    cfg.isCreditFirst ? { partnerType: "supplier" } : { partnerType: "customer" }
  );

  return (
    <TableShell
      title={labels.title}
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder={labels.searchPlaceholder}
      columns={toolbarColumns}
      onColumnToggle={toggleColumn}
      onColumnsReset={resetToDefault}
      columnsModified={isModified}
      showToolbar={true}
    >
      <UnifiedTable
        data={sortedData}
        columns={enrichedColumns}
        loading={loading}
        enableResize
        tableId={cfg.tableId}
        sortField={sortField}
        sortDirection={sortDirection}
        onRowClick={onView}
        selectedId={selectedId}
        onHeaderClick={(col) => {
          if (col.id === "code" || col.id === "name") handleSort(col.id);
          if (col.id === "status" || col.id?.startsWith("balance_")) handleSort("balance");
        }}
        emptyMessage={search ? t("partyTable.emptySearch", { namespace: "partners",  }) : labels.emptyMessage}
        summary={summaryColumns}
      />
    </TableShell>
  );
}
