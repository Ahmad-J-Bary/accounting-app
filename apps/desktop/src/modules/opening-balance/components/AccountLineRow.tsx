import { Input } from "@shared/ui/input";
import { Button } from "@shared/ui/button";
import { Trash2 } from "lucide-react";
import { cn } from "@shared/lib/utils";
import type { AccountDto } from "@erp/shared-types";
import { AccountCombobox } from "./AccountCombobox";
import { useLocalization } from "@app/providers/LocalizationProvider";

interface AccountLineRowProps {
  accountId: string;
  onAccountChange: (id: string) => void;
  amount: string;
  onAmountChange: (amount: string) => void;
  onRemove: () => void;
  accounts: readonly AccountDto[];
  options: AccountDto[];
  placeholder?: string;
  showErrorMessage?: boolean;
  errorMessage?: string;
  className?: string;
}

export function AccountLineRow({
  accountId,
  onAccountChange,
  amount,
  onAmountChange,
  onRemove,
  accounts,
  options,
  placeholder,
  showErrorMessage = false,
  errorMessage,
  className,
}: AccountLineRowProps) {
  const { t } = useLocalization();

  const resolvedPlaceholder = placeholder ?? t("accountLineRow.placeholder", { namespace: "openingBalance" });
  const resolvedErrorMessage = errorMessage ?? t("accountLineRow.invalidAmount", { namespace: "openingBalance" });
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 transition-shadow focus-within:border-blue-300 focus-within:ring-1 focus-within:ring-blue-200">
        <AccountCombobox
          accounts={accounts}
          options={options}
          value={accountId}
          onValueChange={onAccountChange}
          placeholder={resolvedPlaceholder}
          className="flex-1"
        />
        <Input
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          placeholder="0.00"
          type="number"
          min="0"
          step="0.01"
          aria-invalid={showErrorMessage}
          className={cn(
            "h-9 w-[110px] shrink-0 text-end tabular-nums",
            showErrorMessage && "border-red-300 focus-visible:ring-red-200",
          )}
        />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onRemove}
          aria-label={t("accountLineRow.deleteLine", { namespace: "openingBalance" })}
          className="h-9 w-9 shrink-0 p-0 text-red-500 hover:bg-red-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      {showErrorMessage && (
        <p className="px-1 text-2xs text-red-600">{resolvedErrorMessage}</p>
      )}
    </div>
  );
}