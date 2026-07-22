import { useMemo, useState } from "react";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { Button } from "@shared/ui/button";
import { Plus, Eye, Settings2, Trash2, Printer } from "lucide-react";
import type { SalesReturnDto, PurchaseReturnDto } from "@erp/shared-types";
import type { CurrencyDisplayMode } from "@app/providers/CurrencyContext";
import { ReturnsTable } from "./ReturnsTable";

interface ReturnsListProps {
  returns: (SalesReturnDto | PurchaseReturnDto)[];
  loading: boolean;
  search: string;
  partyIdFilter?: string;
  onSearchChange: (val: string) => void;
  onRefresh: () => void;
  onCreate: () => void;
  onEdit: (ret: SalesReturnDto | PurchaseReturnDto) => void;
  onView: (ret: SalesReturnDto | PurchaseReturnDto) => void;
  onDelete: (id: string) => Promise<void>;
  onExportRow?: (ret: SalesReturnDto | PurchaseReturnDto) => void;
  formatMonetaryAmount: (amount: string | number | null | undefined, mode?: CurrencyDisplayMode | "both") => string;
  partyType: "customer" | "supplier";
  title: string;
  createLabel: string;
  searchPlaceholder: string;
  emptyMessage: string;
  statsLabel: string;
  statsColor: string;
  preferenceKey: string;
  showSubtotal?: boolean;
  showExtraCosts?: boolean;
}

export function ReturnsList({
  returns,
  loading,
  search,
  partyIdFilter,
  onSearchChange,
  onCreate,
  onEdit,
  onView,
  onDelete,
  onExportRow,
  partyType,
  title,
  createLabel,
  emptyMessage,
}: ReturnsListProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() =>
    returns.filter((ret) => {
      const matchesSearch = !search ||
        ret.return_number.includes(search) ||
        (partyType === "supplier"
          ? (ret as PurchaseReturnDto).supplier_name?.includes(search)
          : (ret as SalesReturnDto).customer_name?.includes(search)) ||
        (ret.notes?.includes(search) || "");
      const matchesParty = !partyIdFilter ||
        (partyType === "supplier"
          ? (ret as PurchaseReturnDto).supplier_id === partyIdFilter
          : (ret as SalesReturnDto).customer_id === partyIdFilter);
      return matchesSearch && matchesParty;
    }), [returns, search, partyIdFilter, partyType]);

  const partyLabel = partyType === "supplier" ? "المورد" : "الزبون";

  const handleDeleteSelected = async () => {
    if (!selectedId) return;
    if (!window.confirm("هل أنت متأكد من حذف هذا المرتجع؟")) return;
    await onDelete(selectedId);
    setSelectedId(null);
  };

  return (
    <OperationalTableTemplate
      title={title}
      toolbar={
        <div className="no-print flex items-center gap-2">
          <Button size="sm" onClick={onCreate} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 h-9 px-4 font-bold">
            <Plus className="w-4 h-4 ml-2" />{createLabel}
          </Button>
          <div className="w-[1px] h-6 bg-slate-200 mx-1" />
          <Button variant="outline" size="sm" disabled={!selectedId}
            onClick={() => {
              const ret = returns.find(r => r.id === selectedId);
              if (ret) onView(ret);
            }}
            className="h-9 border-slate-200 hover:bg-slate-50 font-bold">
            <Eye className="w-4 h-4 ml-2 text-blue-500" /> عرض
          </Button>
          <Button variant="outline" size="sm" disabled={!selectedId}
            onClick={() => {
              const ret = returns.find(r => r.id === selectedId);
              if (ret) onEdit(ret);
            }}
            className="h-9 border-slate-200 hover:bg-slate-50 font-bold">
            <Settings2 className="w-4 h-4 ml-2 text-amber-500" /> تعديل
          </Button>
          <Button variant="outline" size="sm" disabled={!selectedId}
            onClick={handleDeleteSelected}
            className="h-9 border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 font-bold transition-all">
            <Trash2 className="w-4 h-4 ml-2 text-rose-500" /> حذف
          </Button>
          <Button variant="outline" size="sm" disabled={!selectedId}
            onClick={() => { window.dispatchEvent(new Event("app:prepare-print")); requestAnimationFrame(() => window.print()); }}
            className="h-9 border-slate-200 hover:bg-slate-50 font-bold">
            <Printer className="w-4 h-4 ml-2 text-slate-500" /> طباعة
          </Button>
        </div>
      }
      tableContent={
        <ReturnsTable
          items={filtered}
          loading={loading}
          search={search}
          onSearchChange={onSearchChange}
          partnerLabel={partyLabel}
          emptyMessage={emptyMessage}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
          onExportRow={onExportRow}
        />
      }
    />
  );
}
