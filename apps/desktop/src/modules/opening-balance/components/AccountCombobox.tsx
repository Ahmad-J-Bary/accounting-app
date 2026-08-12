import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { AccountDto } from "@erp/shared-types";
import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@shared/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@shared/ui/popover";
import { TYPE_LABEL, findAccount, isDebitNature } from "../lib/migration-labels";

interface AccountComboboxProps {
  accounts: readonly AccountDto[];
  options?: AccountDto[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
}

export function AccountCombobox({
  accounts,
  options = accounts as AccountDto[],
  value,
  onValueChange,
  placeholder = "ابحث واختر حساباً...",
  searchPlaceholder = "ابحث برمز الحساب أو الاسم...",
  emptyText = "لا توجد حسابات مطابقة",
  disabled = false,
  className,
}: AccountComboboxProps) {
  const [open, setOpen] = useState(false);
  const selected = findAccount(accounts, value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-9 w-full justify-between gap-2 border-slate-200 bg-white px-3 font-normal text-slate-700 hover:bg-slate-50",
            className,
          )}
        >
          <span className="truncate text-right">
            {selected ? (
              <span className="flex items-center gap-2">
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-slate-600">
                  {selected.code}
                </span>
                <span className="truncate font-semibold text-slate-800">{selected.name_ar}</span>
                <span className="shrink-0 text-[11px] text-slate-400">({TYPE_LABEL[selected.account_type]})</span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold",
                    isDebitNature(selected.account_type)
                      ? "bg-blue-50 text-blue-600"
                      : "bg-emerald-50 text-emerald-600",
                  )}
                >
                  {isDebitNature(selected.account_type) ? "مدين" : "دائن"}
                </span>
              </span>
            ) : (
              <span className="text-slate-400">{placeholder}</span>
            )}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full min-w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((a) => {
                const debit = isDebitNature(a.account_type);
                return (
                  <CommandItem
                    key={a.id}
                    value={`${a.code} ${a.name_ar} ${TYPE_LABEL[a.account_type]}`}
                    onSelect={() => {
                      onValueChange(a.id);
                      setOpen(false);
                    }}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-slate-600">
                        {a.code}
                      </span>
                      <span className="truncate text-slate-700">{a.name_ar}</span>
                      <span className="text-[11px] text-slate-400">({TYPE_LABEL[a.account_type]})</span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold",
                          debit ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600",
                        )}
                      >
                        {debit ? "مدين" : "دائن"}
                      </span>
                    </span>
                    <Check
                      className={cn(
                        "h-4 w-4 shrink-0 text-blue-600",
                        value === a.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}