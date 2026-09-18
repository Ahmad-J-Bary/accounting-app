import { useMemo, useEffect } from "react";
import { UnifiedTable, type UnifiedColumn } from "@widgets/table-shell/UnifiedTable";
import type { SummaryColumn } from "@widgets/table-shell/TableSummary";
import { TableShell } from "@widgets/table-shell/TableShell";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useUnifiedColumns, useSortable, useTableColumns, useBaseCurrencyColumns } from "@shared/hooks";
import { formatNumber } from "@shared/lib/format";
import {
  Receipt,
  User,
  Truck,
  Eye,
  Edit,
  Trash2,
  History,
  ShoppingBag,
  Printer,
  Undo2,
  DollarSign,
} from "lucide-react";
import { TableActions } from "@widgets/table-shell/TableActions";
import { useLocalization } from "@app/providers/LocalizationProvider";
import { resolvePartnerDisplayName } from "@shared/lib/system-labels";
import type { RowActionDescriptor } from "@shared/types/row-actions";

interface PartyTableProps<T extends { id: string; name: string; code?: string; phone?: string | null; balance?: string | number; notes?: string | null; account_id?: string | null }> {
  entityName: "customer" | "supplier";
  data: T[];
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
  onExportExcel?: () => void;
  onView: (item: T) => void;
  onEdit: (item: T) => void;
  onDelete?: (id: string) => void;
  onJournal?: (item: T) => void;
  onSales?: (item: T) => void;
  onStatement?: (item: T) => void;
  onReturn?: (item: T) => void;
  onDocument?: (item: T) => void;
  selectedId?: string | null;
  onVisibleColumnsChange?: (ids: string[]) => void;
}

const ENTITY_CONFIG = {
  customer: {
    icon: User,
    avatarBg: "bg-primary/10",
    avatarText: "text-primary",
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
    avatarBg: "bg-muted",
    avatarText: "text-muted-foreground",
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

export function PartyTable<T extends { id: string; name: string; code?: string; phone?: string | null; balance?: string | number; notes?: string | null; account_id?: string | null }>({
  entityName,
  data,
  loading,
  search,
  onSearchChange,
  onExportExcel,
  onView,
  onEdit,
  onDelete,
  onJournal,
  onSales,
  onStatement,
  onReturn,
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
  }), [t, entityName]);

  // Shared row actions registry for both Kebab Menu and right-click Context Menu
  const rowActions = useMemo<RowActionDescriptor<T>[]>(() => {
    const list: RowActionDescriptor<T>[] = [
      {
        id: "view",
        label: t("labels.viewDetails", { namespace: "common" }),
        icon: Eye,
        priority: "primary",
        onClick: (item) => onView(item),
      },
      {
        id: "edit",
        label: t("labels.editData", { namespace: "common" }),
        icon: Edit,
        priority: "primary",
        onClick: (item) => onEdit(item),
      },
    ];

    if (onJournal) {
      list.push({
        id: "journal",
        label: t("partyPage.toolbar.ledger", { namespace: "partners" }),
        icon: History,
        priority: "secondary",
        onClick: (item) => onJournal(item),
      });
    }

    if (onSales) {
      list.push({
        id: "sales",
        label: entityName === "customer"
          ? t("partyPage.toolbar.customerSales", { namespace: "partners" })
          : t("partyPage.toolbar.supplierPurchases", { namespace: "partners" }),
        icon: ShoppingBag,
        priority: "secondary",
        onClick: (item) => onSales(item),
      });
    }

    if (onStatement) {
      list.push({
        id: "statement",
        label: t("partyPage.toolbar.printStatement", { namespace: "partners" }),
        icon: Printer,
        priority: "secondary",
        onClick: (item) => onStatement(item),
      });
    }

    if (onReturn) {
      list.push({
        id: "return",
        label: entityName === "customer"
          ? t("partyPage.toolbar.salesReturn", { namespace: "partners" })
          : t("partyPage.toolbar.purchaseReturn", { namespace: "partners" }),
        icon: Undo2,
        priority: "tertiary",
        onClick: (item) => onReturn(item),
      });
    }

    if (onDocument) {
      list.push({
        id: "document",
        label: entityName === "customer"
          ? t("partyPage.toolbar.createReceipt", { namespace: "partners" })
          : t("partyPage.toolbar.createPayment", { namespace: "partners" }),
        icon: entityName === "customer" ? Receipt : DollarSign,
        priority: "tertiary",
        onClick: (item) => onDocument(item),
      });
    }

    if (onDelete) {
      list.push({
        id: "delete",
        label: t("labels.deleteRecord", { namespace: "common" }),
        icon: Trash2,
        priority: "overflow",
        variant: "destructive",
        destructive: true,
        onClick: (item) => onDelete(item.id),
      });
    }

    return list;
  }, [entityName, onView, onEdit, onJournal, onSales, onStatement, onReturn, onDocument, onDelete, t]);

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
        accessor: (item) => formatNumber(parseInt(item.code || "0", 10) || 0),
        align: "center",
        className: "font-black text-foreground",
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
            <span className="font-bold text-foreground">{resolvePartnerDisplayName(item.name, item.code || "", entityName, language, t)}</span>
          </div>
        ),
        align: "left",
      },
      {
        id: "phone",
        header: t("columns.phone", { namespace: "partners",  }),
        label: t("columns.phone", { namespace: "partners",  }),
        accessor: (item) => item.phone || "",
        align: "left",
        className: "tabular-nums text-muted-foreground",
      },
    ];

    cols.push(getAccountStatusColumn(t("columns.accountStatus", { namespace: "partners",  }), { partnerType: cfg.isCreditFirst ? "supplier" : "customer" }) as UnifiedColumn<T>);

    const balanceCols = getBalanceColumns().map((c) => {
      const m = c.id.match(/^balance_(.+)$/);
      if (m && !isBaseCurrency(m[1])) {
        return {
          ...c,
          align: 'right' as const,
          className: "tabular-nums font-medium text-muted-foreground",
          label: `${c.label}`,
        };
      }
      return { ...c, align: 'right' as const };
    });
    cols.push(...(balanceCols as UnifiedColumn<T>[]));

    cols.push({
      id: "notes",
      header: t("columns.notes", { namespace: "partners",  }),
      label: t("columns.notes", { namespace: "partners",  }),
      accessor: (item) => (
        <span className="text-muted-foreground text-xs truncate max-w-[200px] block" title={item.notes || ""}>
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
          actions={rowActions}
          row={item}
        />
      ),
    });

    return cols;
  }, [rowActions, getAccountStatusColumn, getBalanceColumns, isBaseCurrency, entityName, cfg, Icon, t, language]);

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
      onExportExcel={onExportExcel}
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
        rowActions={rowActions}
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
