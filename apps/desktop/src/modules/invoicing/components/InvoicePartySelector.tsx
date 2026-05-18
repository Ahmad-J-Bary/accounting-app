import { useState, useRef, useEffect } from "react";
import { Search, User, Truck, X, Plus, AlertCircle } from "lucide-react";
import type { CustomerDto, SupplierDto } from "@erp/shared-types";
import { cn } from '@shared/lib/utils';
import { customerService } from '@modules/partners/api/customerService';
import { supplierService } from '@modules/partners/api/supplierService';

type PartyType = "customer" | "supplier";

interface InvoicePartySelectorProps {
  type: PartyType;
  parties: CustomerDto[] | SupplierDto[];
  selectedId?: string;
  selectedName?: string;
  onSelect: (id: string, name: string) => void;
  onClear?: () => void;
  disabled?: boolean;
  readOnly?: boolean;
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
  readOnly = false,
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

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        inputRef.current && !inputRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
      <label className="text-[10px] font-black text-slate-400 uppercase">
        {label}
      </label>

      <div className={cn(
        "relative flex items-center gap-2 h-9 rounded-lg border bg-white px-3 transition-colors",
        open ? "border-blue-500 ring-2 ring-blue-100" : "border-slate-200 hover:border-slate-300",
        (disabled || readOnly) && "bg-slate-50",
      )}>
          <Icon className={cn("w-4 h-4 flex-shrink-0", selectedId ? "text-blue-600" : "text-slate-400")} />
          
          <input
              ref={inputRef}
              disabled={disabled || readOnly}
              className="flex-1 text-sm bg-transparent outline-none text-right font-bold placeholder:text-slate-300"
              placeholder={placeholder}
              value={inputValue}
              onChange={e => {
                  setInputValue(e.target.value);
                  onSelect("", e.target.value);
                  setOpen(true);
              }}
              onFocus={() => {
                  if (!readOnly) setOpen(true);
              }}
              autoComplete="off"
          />

          {(inputValue || selectedId) && !disabled && !readOnly && (
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

      {open && (
        <div
          ref={dropdownRef}
          className="absolute z-[100] top-full mt-1 right-0 w-full bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <div className="max-h-60 overflow-y-auto">
            {filtered.map(p => (
              <button
                key={p.id}
                type="button"
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2.5 hover:bg-blue-50 border-b border-slate-50 last:border-0 text-right transition-colors",
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

            {filtered.length === 0 && !isNewPartner && (
              <div className="py-10 text-center flex flex-col items-center gap-2">
                <Search className="w-8 h-8 text-slate-200" />
                <span className="text-sm text-slate-400 font-bold">اكتب اسماً جديداً للبدء</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
