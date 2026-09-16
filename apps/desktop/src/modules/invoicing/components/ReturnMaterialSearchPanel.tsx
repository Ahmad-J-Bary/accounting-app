import { useMemo } from "react";
import { X, Search, Hash, Calendar, FileText } from "lucide-react";
import type { MaterialDto } from "@erp/shared-types";
import { useLocalization } from "@app/providers/LocalizationProvider";

export interface ReturnOccurrenceItem {
  material: MaterialDto;
  original_quantity: string;
  original_price: string;
  unit_id?: string;
  unit_name?: string;
  conversion_factor?: string;
  warehouse_id?: string;
  id?: string;
  invoice_id: string;
  invoice_date: string;
  invoice_number: string;
}

interface ReturnMaterialSearchPanelProps {
  occurrences: ReturnOccurrenceItem[];
  search: string;
  searchType: "name" | "code" | "barcode";
  onSelect: (occurrence: ReturnOccurrenceItem) => void;
  onClose: () => void;
  style?: React.CSSProperties;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("ar-SA");
  } catch {
    return dateStr;
  }
}

export function ReturnMaterialSearchPanel({
  occurrences,
  search,
  searchType,
  onSelect,
  onClose,
  style,
}: ReturnMaterialSearchPanelProps) {
  const { t } = useLocalization();

  const filtered = useMemo(() => {
    if (!search) return [];
    const s = search.toLowerCase();
    return occurrences.filter((occ) => {
      if (searchType === "code") {
        return occ.material.code.toLowerCase().includes(s);
      }
      if (searchType === "barcode") {
        if ((occ.material.barcode ?? "").toLowerCase().includes(s)) return true;
        return occ.material.units.some((u) => (u.barcode ?? "").toLowerCase().includes(s));
      }
      return occ.material.name.toLowerCase().includes(s);
    }).slice(0, 40);
  }, [occurrences, search, searchType]);

  return (
    <div
      style={style}
      className="bg-white rounded-xl shadow-2xl border border-muted overflow-hidden animate-in fade-in zoom-in-95 duration-150 origin-top-right"
    >
      <div className="flex items-center gap-2.5 px-5 py-3 bg-white border-b border-muted">
        <span className="text-[11px] font-black text-muted-foreground tracking-wider">
          {t("returnMaterial.searchResultsTitle", { namespace: "invoicing",  })}
        </span>
        <span className="text-[10px] tabular-nums font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
          {filtered.length}
        </span>
        <span className="text-[10px] text-muted-foreground font-semibold">{t("returnMaterial.itemLabel", { namespace: "invoicing",  })}</span>
        <button
          onClick={onClose}
          className="mr-auto p-1 rounded-lg text-slate-300 hover:text-muted-foreground hover:bg-muted transition-all"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="max-h-72 overflow-y-auto custom-scrollbar" dir="rtl">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <Search className="w-8 h-8 text-slate-200 mb-2" />
            <p className="text-xs text-muted-foreground font-semibold">
              {search ? t("returnMaterial.noMatchingResults", { namespace: "invoicing",  }) : t("returnMaterial.startTyping", { namespace: "invoicing",  })}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map((occ, idx) => (
              <button
                key={`${occ.material.id}_${occ.invoice_id}_${idx}`}
                onMouseDown={(e) => { e.preventDefault(); onSelect(occ); }}
                className="w-full text-right block px-5 py-3 transition-all duration-75 hover:bg-primary/10/60 active:bg-primary/20/40"
              >
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-bold text-[13px] text-foreground min-w-0 leading-snug">
                    {occ.material.name}
                  </span>
                  {occ.material.name_en && (
                    <span className="text-[10px] text-muted-foreground font-medium dir-ltr">
                      {occ.material.name_en}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted border border-muted/80 font-mono text-[11px] font-bold text-muted-foreground leading-relaxed shrink-0">
                    <Hash className="w-3 h-3 text-slate-300" />
                    {occ.material.code}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-2 pt-1.5 border-t border-slate-50 flex-wrap">
                  <span className="flex items-center gap-1 text-[10px] tabular-nums text-amber-600 font-bold" title={t("returnMaterial.titleCount", { namespace: "invoicing",  })}>
                    <FileText className="w-2.5 h-2.5 opacity-60" />
                    {t("returnMaterial.countPrefix", { namespace: "invoicing",  })}{occ.original_quantity}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] tabular-nums text-primary font-bold" title={t("returnMaterial.titlePrice", { namespace: "invoicing",  })}>
                    {occ.original_price} ر.س
                  </span>
                  <span className="flex items-center gap-1 text-[10px] tabular-nums text-muted-foreground font-bold" title={t("returnMaterial.titleDate", { namespace: "invoicing",  })}>
                    <Calendar className="w-2.5 h-2.5 opacity-60" />
                    {formatDate(occ.invoice_date)}
                  </span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-muted">
                    {occ.invoice_number}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
