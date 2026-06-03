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
    <div className="border-t border-slate-200 bg-white/98 backdrop-blur-md shadow-lg transition-all duration-200">
      <div className="flex items-center gap-3 px-4 py-2 bg-slate-50/80 border-b border-slate-200/80">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
          نتائج البحث — {filtered.length} صنف
        </span>
        <button 
          onClick={onClose} 
          className="text-[10px] font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 px-2 py-0.5 rounded transition-all duration-150 mr-auto"
        >
          إغلاق
        </button>
      </div>
      <div className="max-h-48 overflow-y-auto custom-scrollbar" dir="rtl">
        {filtered.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 font-semibold">لا توجد نتائج مطابقة لبحثك</div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead className="bg-slate-50/50 backdrop-blur border-b border-slate-200/80 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-2 text-right font-black text-slate-700 uppercase tracking-wider text-[10px] w-24">الكود</th>
                <th className="px-4 py-2 text-right font-black text-slate-700 uppercase tracking-wider text-[10px]">اسم الصنف</th>
                <th className="px-4 py-2 text-left font-black text-slate-700 uppercase tracking-wider text-[10px] w-20">المخزون</th>
                <th className="px-4 py-2 text-left font-black text-slate-700 uppercase tracking-wider text-[10px] w-24">آخر تكلفة شراء</th>
              </tr>
            </thead>
            <tbody className="divide-y-0">
              {filtered.map(m => (
                <tr
                  key={m.id}
                  className="group hover:bg-slate-50/80 active:bg-slate-100 border-b border-slate-100 cursor-pointer transition-all duration-75"
                  onMouseDown={() => onSelect(m)}
                >
                  <td className="px-4 py-2.5 font-mono text-slate-500 group-hover:text-slate-900 transition-colors">{m.code}</td>
                  <td className="px-4 py-2.5 font-semibold text-slate-700 group-hover:text-slate-950 transition-colors">{m.name}</td>
                  <td className="px-4 py-2.5 text-left tabular-nums text-slate-500 group-hover:text-slate-900 transition-colors">{m.total_available}</td>
                  <td className="px-4 py-2.5 text-left tabular-nums text-slate-500 group-hover:text-slate-900 transition-colors">{m.last_purchase_price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
