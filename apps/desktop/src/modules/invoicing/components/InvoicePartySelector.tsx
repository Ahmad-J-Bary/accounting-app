import { useState, useRef, useEffect } from "react";
import { Search, User, Truck, X, Plus, AlertCircle } from "lucide-react";
import type { CustomerDto, SupplierDto } from "@erp/shared-types";
import { cn } from '@shared/lib/utils';
import { customerService } from '@modules/partners/api/customerService';
import { supplierService } from '@modules/partners/api/supplierService';
import { formatCurrency } from '@shared/lib/format';

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
  predictedBalance?: number;
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
  predictedBalance = 0,
}: InvoicePartySelectorProps) {
  const [inputValue, setInputValue] = useState(selectedName || "");
  const [open, setOpen] = useState(false);
  const [currentBalance, setCurrentBalance] = useState<{ debit: string; credit: string } | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const label = type === "customer" ? "العميل" : "المورد";
  const Icon = type === "customer" ? User : Truck;
  const placeholder = type === "customer" ? (defaultName ?? "زبون نقدي") : (defaultName ?? "مورد نقدي");

  // Update input when props change
  useEffect(() => {
    if (selectedName) setInputValue(selectedName);
    else if (!selectedId) setInputValue("");
  }, [selectedId, selectedName]);

  // Fetch balance when partner changes
  useEffect(() => {
    const fetchBalance = async () => {
      if (!selectedId) {
        setCurrentBalance(null);
        return;
      }
      setLoadingBalance(true);
      try {
        if (type === "customer") {
          const c = await customerService.getCustomer(selectedId);
          setCurrentBalance({ debit: c.debit, credit: c.credit });
        } else {
          const s = await supplierService.getSupplier(selectedId);
          setCurrentBalance({ debit: s.debit, credit: s.credit });
        }
      } catch (e) {
        console.error("Failed to fetch balance", e);
      } finally {
        setLoadingBalance(false);
      }
    };
    fetchBalance();
  }, [selectedId, type]);

  const filtered = (parties as Array<CustomerDto | SupplierDto>).filter(p =>
    !inputValue ||
    p.name.includes(inputValue) ||
    (p.code ?? "").includes(inputValue)
  ).slice(0, 10);

  const isNewPartner = inputValue && !parties.some(p => p.name === inputValue) && !selectedId;

  return (
    <div className="relative w-full" dir="rtl">
      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
        {label}
      </label>

      <div className={cn(
        "group relative flex flex-col gap-1 rounded-xl border-2 transition-all p-1 bg-white",
        open ? "border-blue-500 shadow-lg ring-4 ring-blue-50" : "border-slate-200 hover:border-slate-300 shadow-sm",
        disabled && "opacity-50 cursor-not-allowed bg-slate-50"
      )}>
        <div className="flex items-center gap-2 px-2 h-9">
            <Icon className={cn("w-4 h-4 flex-shrink-0", selectedId ? "text-blue-600" : "text-slate-400")} />
            
            <input
                ref={inputRef}
                disabled={disabled}
                className="flex-1 text-sm bg-transparent outline-none text-right font-bold placeholder:text-slate-300"
                placeholder={placeholder}
                value={inputValue}
                onChange={e => {
                    setInputValue(e.target.value);
                    onSelect("", e.target.value); // Set as name by default
                    setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                autoComplete="off"
            />

            {(inputValue || selectedId) && !disabled && (
                <button
                    onClick={() => {
                        setInputValue("");
                        if (onClear) onClear();
                        else onSelect("", "");
                        setOpen(false);
                    }}
                    className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-red-500 transition-colors"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            )}
        </div>
      </div>

      {open && (
        <div
          ref={dropdownRef}
          className="absolute z-[100] top-full mt-2 right-0 w-full bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
        >
          {/* Options list */}
          <div className="max-h-60 overflow-y-auto">
            {filtered.map(p => (
              <button
                key={p.id}
                type="button"
                className={cn(
                  "w-full flex items-center justify-between px-4 py-3 hover:bg-blue-50 border-b border-slate-50 last:border-0 text-right transition-colors",
                  p.id === selectedId && "bg-blue-50 border-r-4 border-r-blue-600"
                )}
                onMouseDown={() => {
                  onSelect(p.id, p.name);
                  setInputValue(p.name);
                  setOpen(false);
                }}
              >
                <div className="flex flex-col">
                  <span className="text-sm font-black text-slate-800">{p.name}</span>
                  <div className="flex gap-2 items-center mt-0.5">
                    <span className="text-[10px] text-slate-400 font-mono">{p.code}</span>
                    {p.phone && <span className="text-[10px] text-slate-400 bg-slate-100 px-1 rounded">{p.phone}</span>}
                  </div>
                </div>
                {p.id === selectedId && (
                  <div className="bg-blue-600 text-white p-1 rounded-full"><Plus className="w-3 h-3 rotate-45" /></div>
                )}
              </button>
            ))}

            {isNewPartner && (
              <button
                type="button"
                className="w-full flex items-center gap-3 px-4 py-4 bg-blue-50/50 hover:bg-blue-100/50 text-blue-700 transition-colors border-t border-blue-100"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect("", inputValue);
                  setOpen(false);
                }}
              >
                <div className="p-2 bg-blue-600 text-white rounded-lg shadow-sm">
                  <Plus className="w-4 h-4" />
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-sm font-black">إضافة "{inputValue}" كـ {label} جديد</span>
                  <span className="text-[10px] font-bold opacity-70">سيتم إنشاء الحساب آلياً عند حفظ الفاتورة</span>
                </div>
              </button>
            )}

            {filtered.length === 0 && !isNewPartner && (
              <div className="py-10 text-center flex flex-col items-center gap-2">
                <Search className="w-8 h-8 text-slate-200" />
                <span className="text-sm text-slate-400 font-bold">اكتب اسماً جديداً للبدء</span>
              </div>
            )}
          </div>
          
          <div className="p-2 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 text-center font-bold">
            انقر على الاسم للاختيار أو أكمل الكتابة للإضافة
          </div>
        </div>
      )}

      {/* Prominent Balance Card for Page layout */}
      {(!open && (currentBalance || (predictedBalance > 0 && !selectedId))) && (
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 shadow-sm animate-in slide-in-from-right-1">
            <div className="flex bg-slate-50 border-b border-slate-100">
                <div className="flex-1 p-2 text-center border-l border-slate-100">
                    <div className="text-[9px] text-slate-400 font-black uppercase">
                        {type === "customer" ? "مدين (العميل)" : "مدين (عليه)"}
                    </div>
                    <div className="text-sm font-black text-destructive tabular-nums">
                        {formatCurrency(parseFloat(currentBalance?.debit || "0") + (type === "customer" ? predictedBalance : 0))}
                    </div>
                </div>
                <div className="flex-1 p-2 text-center">
                    <div className="text-[9px] text-slate-400 font-black uppercase">
                        {type === "supplier" ? "دائن (المورد)" : "دائن (له)"}
                    </div>
                    <div className="text-sm font-black text-green-700 tabular-nums">
                        {formatCurrency(parseFloat(currentBalance?.credit || "0") + (type === "supplier" ? predictedBalance : 0))}
                    </div>
                </div>
            </div>
            <div className="p-2 bg-white text-center">
                <div className="text-[9px] text-slate-400 font-bold">الرصيد الحالي (المتوقع بعد الفاتورة)</div>
                <div className={cn(
                    "text-lg font-black tabular-nums",
                    type === "customer" 
                        ? ((parseFloat(currentBalance?.debit || "0") + predictedBalance) - parseFloat(currentBalance?.credit || "0")) > 0 ? "text-destructive" : "text-green-700"
                        : (parseFloat(currentBalance?.debit || "0") - (parseFloat(currentBalance?.credit || "0") + predictedBalance)) < 0 ? "text-green-700" : "text-destructive"
                )}>
                    {formatCurrency(Math.abs(
                        type === "customer"
                            ? ((parseFloat(currentBalance?.debit || "0") + predictedBalance) - parseFloat(currentBalance?.credit || "0"))
                            : (parseFloat(currentBalance?.debit || "0") - (parseFloat(currentBalance?.credit || "0") + predictedBalance))
                    ))}
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
