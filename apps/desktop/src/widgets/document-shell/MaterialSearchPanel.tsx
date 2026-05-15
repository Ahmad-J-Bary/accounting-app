import type { MaterialDto } from "@erp/shared-types";

interface MaterialSearchPanelProps {
  materials: MaterialDto[];
  search: string;
  searchType: "name" | "code" | "barcode";
  visible: boolean;
  onSelect: (m: MaterialDto) => void;
  onClose: () => void;
}

export function MaterialSearchPanel({ materials, search, searchType, visible, onSelect, onClose }: MaterialSearchPanelProps) {
  const filtered = materials.filter(m => {
    if (!search) return false;
    const s = search.toLowerCase();
    if (searchType === "code") {
      return m.code.toLowerCase().includes(s);
    } else if (searchType === "barcode") {
      const materialBarcode = (m.barcode ?? "").toLowerCase().includes(s);
      const unitBarcode = m.units.some(u => (u.barcode ?? "").toLowerCase().includes(s));
      return materialBarcode || unitBarcode;
    }
    return m.name.toLowerCase().includes(s);
  }).slice(0, 30);

  if (!visible) return null;

  return (
    <div className="border-t border-blue-200 bg-blue-50/40">
      <div className="flex items-center gap-3 px-3 py-1.5 bg-blue-50 border-b border-blue-100">
        <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
          نتائج البحث — {filtered.length} صنف
        </span>
        <button onClick={onClose} className="text-[10px] text-blue-400 hover:text-blue-600 mr-auto">إغلاق</button>
      </div>
      <div className="max-h-44 overflow-y-auto" dir="rtl">
        {filtered.length === 0 ? (
          <div className="py-4 text-center text-xs text-muted-foreground">لا توجد نتائج</div>
        ) : (
          <table className="w-full text-xs font-sans">
            <thead className="bg-blue-50/80 sticky top-0">
              <tr>
                <th className="px-3 py-1.5 text-right font-bold text-slate-500 w-24">الكود</th>
                <th className="px-3 py-1.5 text-right font-bold text-slate-500">اسم الصنف</th>
                <th className="px-3 py-1.5 text-left font-bold text-slate-500 w-20">المخزون</th>
                <th className="px-3 py-1.5 text-left font-bold text-slate-500 w-24">آخر تكلفة شراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-50">
              {filtered.map(m => (
                <tr
                  key={m.id}
                  className="hover:bg-blue-100 cursor-pointer transition-colors"
                  onMouseDown={() => onSelect(m)}
                >
                  <td className="px-3 py-1.5 font-mono text-slate-600">{m.code}</td>
                  <td className="px-3 py-1.5 font-semibold text-slate-800">{m.name}</td>
                  <td className="px-3 py-1.5 text-left tabular-nums text-slate-600">{m.total_available}</td>
                  <td className="px-3 py-1.5 text-left tabular-nums text-slate-600">{m.last_purchase_price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
