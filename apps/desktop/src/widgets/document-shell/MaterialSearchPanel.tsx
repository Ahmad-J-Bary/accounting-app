import { useMemo } from "react";
import { cn } from "@shared/lib/utils";
import { X, Search, Hash, Barcode, Package, TrendingUp, ShoppingCart, DollarSign } from "lucide-react";
import type { MaterialDto } from "@erp/shared-types";
import type { Currency } from "@modules/core/api/currencyService";
import type { DocumentColumn } from "./GenericDocumentGrid";
import { useLocalization } from "@app/providers/LocalizationProvider";

interface MaterialSearchPanelProps {
  materials: MaterialDto[];
  search: string;
  searchType: "name" | "code" | "barcode";
  onSelect: (m: MaterialDto) => void;
  onClose: () => void;
  columns: DocumentColumn[];
  visibleColumnKeys: string[];
  baseCurrency?: Currency | null;
  style?: React.CSSProperties;
}

// Note: fieldConfig labels are now resolved inside the component via t()

function formatCost(val: string): string {
  const n = parseFloat(val);
  if (n <= 0) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function MaterialSearchPanel({
  materials,
  search,
  searchType,
  onSelect,
  onClose,
  visibleColumnKeys,
  baseCurrency,
  style,
}: MaterialSearchPanelProps) {
  const { t, direction } = useLocalization();

  const fieldConfig = {
    material_code:   { icon: Hash,      label: t('labels.code', ),      key: "code" as const,     render: (m: MaterialDto) => m.code },
    unit_barcode:    { icon: Barcode,   label: t('labels.barcode', ),   key: "barcode" as const,  render: (m: MaterialDto) => m.barcode || (m.units.find(u => u.is_base)?.barcode) || "—" },
    material_name:   { icon: Package,   label: t('labels.materialNameAr', ), key: "name" as const,   render: (m: MaterialDto) => m.name },
  } as const;

  type FieldId = keyof typeof fieldConfig;

  const filtered = useMemo(() => {
    return materials.filter(m => {
      if (!search) return false;
      const s = search.toLowerCase();
      if (searchType === "code") {
        return m.code.toLowerCase().includes(s);
      }
      if (searchType === "barcode") {
        if ((m.barcode ?? "").toLowerCase().includes(s)) return true;
        return m.units.some(u => (u.barcode ?? "").toLowerCase().includes(s));
      }
      return m.name.toLowerCase().includes(s);
    }).slice(0, 30);
  }, [materials, search, searchType]);

  const activeFields = useMemo<FieldId[]>(() => {
    return (["material_code", "unit_barcode", "material_name"] as FieldId[]).filter(
      id => visibleColumnKeys.includes(id),
    );
  }, [visibleColumnKeys]);

  const sym = baseCurrency?.symbol || baseCurrency?.code || "";

  return (
    <div
      style={style}
      className="origin-top rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150"
      dir={direction}
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-2.5 px-5 py-3 bg-white border-b border-slate-100">
        <div className="flex items-center gap-1.5 text-slate-400">
          <Search className="w-3.5 h-3.5" />
        </div>
        <span className="text-[11px] font-black text-muted-foreground tracking-wider">
          {t('labels.searchResults', )}
        </span>
        <span className="text-2xs tabular-nums font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
          {filtered.length}
        </span>
        <span className="text-2xs text-slate-400 font-semibold">{t('labels.item', )}</span>
        <button
          onClick={onClose}
          className="ms-auto rounded-lg p-1 text-slate-300 transition-all hover:bg-slate-100 hover:text-muted-foreground"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Results ── */}
      <div className="max-h-72 overflow-y-auto custom-scrollbar">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <Search className="w-8 h-8 text-slate-200 mb-2" />
            <p className="text-xs text-slate-400 font-semibold">
              {search ? t('labels.noMatchingSearchResults', ) : t('states.startTypingToSearch', )}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map((m) => (
              <button
                key={m.id}
                onMouseDown={(e) => { e.preventDefault(); onSelect(m); }}
                className={cn(
                  "block w-full px-5 py-3 text-start transition-all duration-75",
                  "hover:bg-primary/10 active:bg-primary/20",
                )}
              >
                <div className="flex items-center gap-3 flex-wrap">
                  {activeFields.includes("material_code") && (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-100/80 font-mono text-[11px] font-bold text-muted-foreground leading-relaxed shrink-0">
                      <Hash className="w-3 h-3 text-slate-300" />
                      {fieldConfig.material_code.render(m)}
                    </span>
                  )}

                  {activeFields.includes("unit_barcode") && (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-100/80 font-mono text-[11px] text-slate-400 leading-relaxed shrink-0 dir-ltr">
                      <Barcode className="w-3 h-3 text-slate-300" />
                      {fieldConfig.unit_barcode.render(m)}
                    </span>
                  )}

                  {activeFields.includes("material_name") && (
                    <span className="font-bold text-[13px] text-foreground min-w-0 leading-snug">
                      {fieldConfig.material_name.render(m)}
                    </span>
                  )}
                </div>

                {/* ── Cost Row ── */}
                <div className="flex items-center gap-3 mt-2 pt-1.5 border-t border-slate-50 flex-wrap" dir="ltr">
                  <span className="flex items-center gap-1 text-2xs tabular-nums text-amber-600 font-bold" title={t('labels.unitCost', )}>
                    <DollarSign className="w-2.5 h-2.5 opacity-60" />
                    {formatCost(m.average_cost_base)} {sym}
                  </span>
                  <span className="flex items-center gap-1 text-2xs tabular-nums text-success font-bold" title={t('labels.lastPurchasePrice', )}>
                    <ShoppingCart className="w-2.5 h-2.5 opacity-60" />
                    {formatCost(m.last_purchase_price_base)} {sym}
                  </span>
                  <span className="flex items-center gap-1 text-2xs tabular-nums text-primary font-bold" title={t('labels.lastSalePrice', )}>
                    <TrendingUp className="w-2.5 h-2.5 opacity-60" />
                    {formatCost(m.last_sale_price_base)} {sym}
                  </span>
                  {m.costing_method === "FIFO" && (
                    <span className="text-3xs font-bold px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-200">
                      FIFO
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
