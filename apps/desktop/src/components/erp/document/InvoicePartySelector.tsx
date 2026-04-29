import { useState, useRef, useEffect } from "react";
import { Search, User, Truck, X } from "lucide-react";
import type { CustomerDto, SupplierDto } from "@erp/shared-types";
import { cn } from "@/lib/utils";

type PartyType = "customer" | "supplier";

interface InvoicePartySelectorProps {
  type: PartyType;
  parties: CustomerDto[] | SupplierDto[];
  selectedId?: string;
  selectedName?: string;
  onSelect: (id: string, name: string) => void;
  onClear?: () => void;
  disabled?: boolean;
  defaultName?: string;
}

export function InvoicePartySelector({
  type,
  parties,
  selectedId,
  selectedName,
  onSelect,
  onClear,
  disabled = false,
  defaultName,
}: InvoicePartySelectorProps) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const label = type === "customer" ? "العميل" : "المورد";
  const Icon = type === "customer" ? User : Truck;
  const placeholder = type === "customer" ? (defaultName ?? "زبون نقدي") : (defaultName ?? "مورد نقدي");

  const filtered = (parties as Array<CustomerDto | SupplierDto>).filter(p =>
    !search ||
    p.name.includes(search) ||
    (p.code ?? "").includes(search) ||
    ((p as CustomerDto).phone ?? "").includes(search)
  ).slice(0, 15);

  const displayValue = selectedId
    ? (parties.find(p => p.id === selectedId) as CustomerDto | SupplierDto | undefined)?.name ?? selectedName ?? ""
    : "";

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" dir="rtl">
      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
        {label}
      </label>

      <div
        className={cn(
          "flex items-center gap-2 h-9 px-3 rounded-md border transition-all cursor-pointer bg-white",
          focused ? "border-blue-400 ring-2 ring-blue-100" : "border-slate-200 hover:border-slate-300",
          disabled && "opacity-50 cursor-not-allowed bg-slate-50"
        )}
        onClick={() => { if (!disabled) { setOpen(true); inputRef.current?.focus(); } }}
      >
        <Icon className={cn("w-4 h-4 flex-shrink-0", selectedId ? "text-blue-500" : "text-slate-400")} />

        <input
          ref={inputRef}
          disabled={disabled}
          className="flex-1 text-sm bg-transparent outline-none text-right placeholder:text-slate-400"
          placeholder={placeholder}
          value={open ? search : displayValue}
          onChange={e => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => { setFocused(true); setOpen(true); }}
          onBlur={() => { setFocused(false); setTimeout(() => setOpen(false), 150); setSearch(""); }}
          autoComplete="off"
        />

        {selectedId && onClear && !disabled && (
          <button
            onMouseDown={e => { e.preventDefault(); onClear(); }}
            className="p-0.5 text-slate-400 hover:text-red-400 hover:bg-red-50 rounded transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div
          ref={dropdownRef}
          className="absolute z-50 top-full mt-1 right-0 w-full min-w-[280px] bg-white border border-slate-200 rounded-md shadow-xl overflow-hidden"
        >
          {/* Search hint */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border-b border-slate-100">
            <Search className="w-3 h-3 text-slate-400" />
            <span className="text-[10px] text-slate-400">
              {filtered.length} نتيجة — اكتب للبحث
            </span>
          </div>

          {/* Default option */}
          {!search && (
            <button
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-amber-50 border-b border-slate-100 text-right transition-colors"
              onMouseDown={() => { onSelect("", placeholder); setOpen(false); }}
            >
              <span className="text-xs text-amber-700 font-bold">{placeholder} (افتراضي)</span>
            </button>
          )}

          {/* Party list */}
          <div className="max-h-52 overflow-y-auto">
            {filtered.map(p => (
              <button
                key={p.id}
                type="button"
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 hover:bg-blue-50 border-b border-slate-50 last:border-0 text-right transition-colors",
                  p.id === selectedId && "bg-blue-50"
                )}
                onMouseDown={() => { onSelect(p.id, p.name); setOpen(false); setSearch(""); }}
              >
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-800">{p.name}</span>
                  <span className="text-[10px] text-slate-400">{p.code}</span>
                </div>
                {p.id === selectedId && (
                  <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">محدد</span>
                )}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="py-6 text-center text-xs text-slate-400">لا توجد نتائج</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
