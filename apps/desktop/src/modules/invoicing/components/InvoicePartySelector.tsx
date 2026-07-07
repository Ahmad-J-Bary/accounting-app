import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Search, User, Truck, X, Plus, Loader2 } from "lucide-react";
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
  hideLabel?: boolean;
  noBorder?: boolean;
  onSearchActive?: (isSearching: boolean) => void;
  onCreateParty?: (name: string) => Promise<{id: string, name: string}>;
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
  hideLabel = false,
  noBorder = false,
  onSearchActive,
  onCreateParty,
}: InvoicePartySelectorProps) {
  const [isEditing, setIsEditing] = useState(!selectedId);
  const [inputValue, setInputValue] = useState("");
  const [debouncedValue, setDebouncedValue] = useState("");
  const [open, setOpen] = useState(false);
  const [currentBalance, setCurrentBalance] = useState<{ debit: string; credit: string } | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [creating, setCreating] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isEditingRef = useRef(isEditing);
  const inputValueRef = useRef(inputValue);
  const selectedIdRef = useRef(selectedId);
  const selectedNameRef = useRef(selectedName);
  const searchActiveRef = useRef(false);

  isEditingRef.current = isEditing;
  inputValueRef.current = inputValue;
  selectedIdRef.current = selectedId;
  selectedNameRef.current = selectedName;

  const label = type === "customer" ? "العميل" : "المورد";
  const Icon = type === "customer" ? User : Truck;
  const placeholder = type === "customer" ? (defaultName ?? "زبون نقدي") : (defaultName ?? "مورد نقدي");

  useEffect(() => {
    if (selectedId && selectedName) {
      setInputValue(selectedName);
      setIsEditing(false);
      setOpen(false);
      if (searchActiveRef.current) {
        searchActiveRef.current = false;
        onSearchActive?.(false);
      }
    } else if (!selectedId) {
      if (!selectedName) {
        setInputValue("");
      }
      setIsEditing(true);
      if (searchActiveRef.current) {
        searchActiveRef.current = false;
        onSearchActive?.(false);
      }
    }
  }, [selectedId, selectedName, onSearchActive]);

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

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(inputValue), 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

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

  const filtered = useMemo(() =>
    (parties as Array<CustomerDto | SupplierDto>).filter(p =>
      !debouncedValue ||
      p.name.includes(debouncedValue) ||
      (p.code ?? "").includes(debouncedValue)
    ).slice(0, 10),
    [parties, debouncedValue]
  );

  const selectedParty = useMemo(() =>
    selectedId ? (parties as Array<CustomerDto | SupplierDto>).find(p => p.id === selectedId) ?? null : null,
    [selectedId, parties]
  );

  const handleSelect = useCallback((id: string, name: string) => {
    onSelect(id, name);
    setInputValue(name);
    setIsEditing(false);
    setOpen(false);
    if (searchActiveRef.current) {
      searchActiveRef.current = false;
      onSearchActive?.(false);
    }
  }, [onSelect, onSearchActive]);

  const handleClear = useCallback(() => {
    setInputValue("");
    setIsEditing(true);
    if (onClear) onClear();
    else onSelect("", "");
    setOpen(false);
    if (searchActiveRef.current) {
      searchActiveRef.current = false;
      onSearchActive?.(false);
    }
  }, [onClear, onSelect, onSearchActive]);

  const handleKeyDown = useCallback(async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && open && filtered.length > 0) {
      e.preventDefault();
      const first = filtered[0];
      handleSelect(first.id, first.name);
    } else if (e.key === 'Enter' && open && filtered.length === 0 && inputValueRef.current && onCreateParty && !creating) {
      e.preventDefault();
      setCreating(true);
      try {
        const result = await onCreateParty(inputValueRef.current);
        handleSelect(result.id, result.name);
      } catch (err) {
        console.error("Failed to create party", err);
      } finally {
        setCreating(false);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      if (selectedId) {
        setIsEditing(false);
        setInputValue(selectedName || "");
      }
    }
  }, [open, filtered, handleSelect, selectedId, selectedName, onCreateParty, creating]);

  const handleBlur = useCallback(() => {
    blurTimeoutRef.current = setTimeout(() => {
      if (!isEditingRef.current) return;
      const val = inputValueRef.current;
      const sId = selectedIdRef.current;
      const sName = selectedNameRef.current;
      if (!val && sId) {
        setIsEditing(false);
        setInputValue(sName || "");
      } else if (sId && val !== sName) {
        setIsEditing(false);
        setInputValue(sName || "");
      }
    }, 200);
  }, []);

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    };
  }, []);

  const balanceLabel = useMemo(() => {
    if (!currentBalance) return null;
    const d = parseFloat(currentBalance.debit);
    const c = parseFloat(currentBalance.credit);
    if (d > 0) return `مدين ${currentBalance.debit}`;
    if (c > 0) return `دائن ${currentBalance.credit}`;
    return null;
  }, [currentBalance]);

  const renderSelectedMode = () => (
    <div className={cn(
      "relative flex items-center gap-3 min-h-8 transition-all duration-200",
      noBorder ? "px-1" : "px-3 border border-border/60 rounded-lg shadow-sm hover:shadow-md hover:border-primary/20",
      readOnly ? "bg-muted/50" : noBorder ? "" : "bg-muted/20 hover:bg-muted/30"
    )}>
      <Icon className="w-5 h-5 flex-shrink-0 text-primary" />

      <div className="flex-1 min-w-0 py-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground truncate">
            {selectedName}
          </span>
          {selectedParty?.code && (
            <span className="text-[10px] text-muted-foreground font-mono bg-background px-1.5 py-0.5 rounded">
              {selectedParty.code}
            </span>
          )}
        </div>
        {selectedParty?.phone && (
          <span className="text-[10px] text-muted-foreground">{selectedParty.phone}</span>
        )}
      </div>

      {loadingBalance && (
        <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin flex-shrink-0" />
      )}

      {balanceLabel && !loadingBalance && (
        <span className="text-[10px] text-muted-foreground whitespace-nowrap bg-muted px-1.5 py-0.5 rounded flex-shrink-0">
          {balanceLabel}
        </span>
      )}

      {!readOnly && !disabled && (
        <div className="flex items-center gap-1 mr-auto">
          <button
            type="button"
            onClick={handleClear}
            className="p-1 hover:bg-muted rounded-full text-muted-foreground hover:text-destructive transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );

  const renderSearchMode = () => (
    <>
      <div className={cn(
        "relative flex items-center gap-2 min-h-8 transition-all duration-200",
        noBorder ? "px-1" : "rounded-lg border bg-background px-3 shadow-sm border-border/60 hover:border-primary/30 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10",
        (disabled || readOnly) && (noBorder ? "" : "bg-muted/50"),
      )}>
        <Search className="w-4 h-4 flex-shrink-0 text-muted-foreground" />

        <input
          ref={inputRef}
          disabled={disabled || readOnly || creating}
          className="flex-1 text-sm bg-transparent outline-none text-right font-semibold placeholder:text-muted-foreground/40"
          placeholder={placeholder}
          value={inputValue}
          onChange={e => {
            setInputValue(e.target.value);
            setOpen(true);
            if (!selectedId) {
              onSelect("", e.target.value);
            }
            if (!selectedId && !searchActiveRef.current) {
              searchActiveRef.current = true;
              onSearchActive?.(true);
            }
          }}
          onFocus={() => {
            if (!readOnly) {
              setOpen(true);
              setDebouncedValue(inputValue);
            }
          }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />

        {(inputValue || selectedId) && !disabled && !readOnly && (
          <button
            type="button"
            onClick={() => {
              setInputValue("");
              setOpen(true);
            }}
            className="p-1 hover:bg-muted rounded-full text-muted-foreground hover:text-destructive transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div
          ref={dropdownRef}
          className="absolute z-[100] top-full mt-1 right-0 w-full bg-popover border border-border rounded-lg shadow-lg overflow-hidden"
        >
          <div className="max-h-60 overflow-y-auto">
            {filtered.map(p => (
              <button
                key={p.id}
                type="button"
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2.5 hover:bg-accent border-b border-border last:border-0 text-right transition-colors",
                  p.id === selectedId && "bg-accent border-r-4 border-r-primary"
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(p.id, p.name);
                }}
              >
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-foreground">{p.name}</span>
                  <div className="flex gap-2 items-center mt-0.5">
                    <span className="text-[10px] text-muted-foreground font-mono">{p.code}</span>
                    {p.phone && <span className="text-[10px] text-muted-foreground bg-muted px-1 rounded">{p.phone}</span>}
                  </div>
                </div>
                {p.id === selectedId && (
                  <Plus className="w-3.5 h-3.5 rotate-45 text-primary" />
                )}
              </button>
            ))}

            {filtered.length === 0 && debouncedValue && (
              <div className="py-6 text-center flex flex-col items-center gap-2">
                <Search className="w-6 h-6 text-muted-foreground/20" />
                <span className="text-sm text-muted-foreground">لا توجد نتائج</span>
                {onCreateParty && (
                  <button
                    type="button"
                    disabled={creating}
                    onMouseDown={async (e) => {
                      e.preventDefault();
                      if (creating) return;
                      setCreating(true);
                      try {
                        const result = await onCreateParty(debouncedValue);
                        handleSelect(result.id, result.name);
                      } catch {
                        // error handled by parent
                      } finally {
                        setCreating(false);
                      }
                    }}
                    className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    {creating ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                    <span>إنشاء "{debouncedValue}"</span>
                  </button>
                )}
              </div>
            )}

            {filtered.length === 0 && !debouncedValue && !selectedId && (
              <div className="py-8 text-center flex flex-col items-center gap-2">
                <Search className="w-6 h-6 text-muted-foreground/20" />
                <span className="text-sm text-muted-foreground">ابدأ بالبحث...</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="relative w-full" dir="rtl">
      {!hideLabel && (
        <label className="text-xs font-semibold text-muted-foreground">
          {label}
        </label>
      )}

      {!isEditing && selectedId ? renderSelectedMode() : renderSearchMode()}
    </div>
  );
}
