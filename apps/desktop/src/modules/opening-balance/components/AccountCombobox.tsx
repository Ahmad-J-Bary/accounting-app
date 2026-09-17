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
import {
  TYPE_LABEL,
  findAccount,
  getLocalizedAccountName,
  isDebitNature,
} from "../lib/migration-labels";
import { useLocalization } from "@app/providers/LocalizationProvider";

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
  placeholder,
  searchPlaceholder,
  emptyText,
  disabled = false,
  className,
}: AccountComboboxProps) {
  const { t, language } = useLocalization();
  const [open, setOpen] = useState(false);
  const selected = findAccount(accounts, value);

  const resolvedPlaceholder = placeholder ?? t("accountCombobox.placeholder", { namespace: "openingBalance" });
  const resolvedSearchPlaceholder = searchPlaceholder ?? t("accountCombobox.searchPlaceholder", { namespace: "openingBalance" });
  const resolvedEmptyText = emptyText ?? t("accountCombobox.emptyText", { namespace: "openingBalance" });

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
            "h-9 w-full justify-between gap-2 border-border bg-card px-3 font-normal text-foreground hover:bg-accent",
            className,
          )}
        >
          <span className="truncate text-end">
            {selected ? (
              <span className="flex items-center gap-2">
                <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-muted-foreground">
                  {selected.code}
                </span>
                <span className="truncate font-semibold text-foreground">
                  {getLocalizedAccountName(selected, language)}
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground">({TYPE_LABEL[selected.account_type]?.(t)})</span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold",
                    isDebitNature(selected.account_type)
                      ? "bg-primary/10 text-primary"
                      : "bg-success/10 text-success",
                  )}
                >
                  {isDebitNature(selected.account_type) ? t("accountCombobox.debit", { namespace: "openingBalance" }) : t("accountCombobox.credit", { namespace: "openingBalance" })}
                </span>
              </span>
            ) : (
              <span className="text-muted-foreground">{resolvedPlaceholder}</span>
            )}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full min-w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder={resolvedSearchPlaceholder} />
          <CommandList>
            <CommandEmpty>{resolvedEmptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((a) => {
                const debit = isDebitNature(a.account_type);
                return (
                  <CommandItem
                    key={a.id}
                    value={`${a.code} ${a.name_ar || ""} ${a.name_en || ""} ${TYPE_LABEL[a.account_type]?.(t)}`}
                    onSelect={() => {
                      onValueChange(a.id);
                      setOpen(false);
                    }}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-muted-foreground">
                        {a.code}
                      </span>
                      <span className="truncate text-foreground">
                        {getLocalizedAccountName(a, language)}
                      </span>
                      <span className="text-[11px] text-muted-foreground">({TYPE_LABEL[a.account_type]?.(t)})</span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold",
                          debit ? "bg-primary/10 text-primary" : "bg-success/10 text-success",
                        )}
                      >
                        {debit ? t("accountCombobox.debit", { namespace: "openingBalance" }) : t("accountCombobox.credit", { namespace: "openingBalance" })}
                      </span>
                    </span>
                    <Check
                      className={cn(
                        "h-4 w-4 shrink-0 text-primary",
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
