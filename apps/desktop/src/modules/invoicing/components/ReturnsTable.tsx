import { useMemo } from "react";
import { Edit } from "lucide-react";
import { Button } from "@shared/ui/button";
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { TableShell } from '@widgets/table-shell/TableShell';
import { formatDateTime } from '@shared/lib/format';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useUnifiedColumns } from "@shared/hooks";
import type { MaterialDto } from "@erp/shared-types";

export type ReturnLineRow = {
  return_id?: string;
  return_number: string;
  material_name?: string;
  material_id?: string;
  partner_name?: string;
  unit_id?: string;
  quantity: string;
  unit_price: string;
  line_total: string;
  return_date: string;
  notes?: string;
};

interface ReturnsTableProps {
  items: ReturnLineRow[];
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
  materials: MaterialDto[];
  partnerLabel: string;
  emptyMessage?: string;
  onEdit?: (returnId: string) => void;
}

export function ReturnsTable({ items, loading, search, onSearchChange, materials, partnerLabel, emptyMessage, onEdit }: ReturnsTableProps) {
  const { currencies, baseCurrency, formatAmount } = useCurrencyContext();

  const allColumns = useMemo<UnifiedColumn<ReturnLineRow>[]>(() => {
    const cols: UnifiedColumn<ReturnLineRow>[] = [
      {
        id: "actions",
        header: "",
        label: "إجراءات",
        accessor: (i) => i.return_id ? (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
            onClick={(e) => { e.stopPropagation(); onEdit?.(i.return_id!); }}
          >
            <Edit className="w-3.5 h-3.5" />
          </Button>
        ) : null,
        className: "w-10 text-center",
      },
      {
        id: "index",
        header: "الرقم",
        label: "الرقم",
        accessor: (_, idx) => <span className="font-bold text-slate-400">{idx + 1}</span>,
        className: "w-12 text-center",
      },
      {
        id: "material_name",
        header: "المادة",
        label: "المادة",
        accessor: (i) => <span className="font-medium text-slate-800">{i.material_name ?? "—"}</span>,
        className: "min-w-[140px]",
      },
      {
        id: "partner_name",
        header: partnerLabel,
        label: partnerLabel,
        accessor: (i) => <span className="font-medium text-slate-700">{i.partner_name || "—"}</span>,
        className: "min-w-[120px]",
      },
      ...currencies.map(curr => ({
        id: `unit_price_${curr.code}`,
        header: `السعر (${curr.symbol || curr.code})`,
        label: `السعر الفردي (${curr.symbol || curr.code})`,
        accessor: (i: ReturnLineRow) => {
          const val = parseFloat(i.unit_price || "0");
          if (val === 0) return "—";
          return formatAmount(val, { currencyCode: curr.code });
        },
        align: "left" as const,
        className: "tabular-nums w-24",
      })),
      {
        id: "quantity",
        header: "الكمية",
        label: "الكمية المرتجعة",
        accessor: (i) => <span className="tabular-nums font-bold">{Math.round(parseFloat(i.quantity))}</span>,
        align: "left",
        className: "w-20",
      },
      {
        id: "unit_id",
        header: "الوحدة",
        label: "الوحدة",
        accessor: (i) => {
          const unitName = materials.find(m => m.id === i.material_id)?.units.find(u => u.id === i.unit_id)?.name;
          return <span className="text-slate-500">{unitName || "—"}</span>;
        },
        className: "w-20",
      },
      ...currencies.map(curr => ({
        id: `line_total_${curr.code}`,
        header: `المجموع (${curr.symbol || curr.code})`,
        label: `المجموع (${curr.symbol || curr.code})`,
        accessor: (i: ReturnLineRow) => {
          const val = parseFloat(i.line_total || "0");
          if (val === 0) return "—";
          return formatAmount(val, { currencyCode: curr.code });
        },
        align: "left" as const,
        className: "tabular-nums font-bold w-28",
      })),
      {
        id: "return_date",
        header: "التاريخ",
        label: "التاريخ",
        accessor: (i) => formatDateTime(i.return_date),
        className: "w-28",
      },
      {
        id: "notes",
        header: "ملاحظة",
        label: "ملاحظة",
        accessor: (i) => <span className="text-slate-400 text-xs">{i.notes || "-"}</span>,
        className: "min-w-[100px]",
      },
    ];
    return cols;
  }, [currencies, formatAmount, partnerLabel, materials, onEdit]);

  const defaultVisible = useMemo(() => {
    const baseCode = baseCurrency?.code;
    return [
      "actions",
      "index",
      "material_name",
      "partner_name",
      ...(baseCode ? [`unit_price_${baseCode}`] : []),
      "quantity",
      "unit_id",
      ...(baseCode ? [`line_total_${baseCode}`] : []),
      "return_date",
      "notes",
    ];
  }, [baseCurrency]);

  const { enrichedColumns, toolbarColumns, toggleColumn } = useUnifiedColumns({
    tableId: "returns-unified",
    columns: allColumns,
    defaultVisible,
  });

  return (
    <TableShell
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="بحث بالرقم أو المادة..."
      columns={toolbarColumns}
      onColumnToggle={toggleColumn}
      showToolbar={true}
    >
      <UnifiedTable
        data={items}
        columns={enrichedColumns}
        loading={loading}
        emptyMessage={emptyMessage ?? "لا توجد بيانات"}
      />
    </TableShell>
  );
}
